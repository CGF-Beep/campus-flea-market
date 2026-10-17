const fsp = require('fs/promises');

/**
 * 图片文件头（magic number）嗅探
 *
 * 为什么需要：middleware/upload.js 的扩展名 + MIME 双重校验都来自客户端提交的信息
 * （`file.originalname` 与 `Content-Type` 都是请求头里带的），可以随意伪造。
 * 这里读文件真实的开头几个字节做最终判定，客户端伪造不了。
 *
 * 说明：上传链路本身还会经过 sharp 重编码为 WebP，非图片内容其实也会在 sharp 那步失败。
 * 但那一步抛的是 500「上传失败」，用户看不懂；这里提前用 400 + 明确文案拦下，
 * 顺带避免把垃圾内容送进图片解码器（解码器是历史上最容易出漏洞的地方）。
 */

const SIGNATURES = [
  {
    type: 'jpeg',
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  },
  {
    type: 'png',
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  },
  {
    type: 'gif',
    test: (b) => {
      if (b.length < 6) return false;
      const head = b.subarray(0, 6).toString('ascii');
      return head === 'GIF87a' || head === 'GIF89a';
    }
  },
  {
    // WebP 是 RIFF 容器：0-3 为 "RIFF"，8-11 为 "WEBP"
    type: 'webp',
    test: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString('ascii') === 'RIFF' &&
      b.subarray(8, 12).toString('ascii') === 'WEBP'
  }
];

/**
 * 判断 buffer 开头的字节是否匹配已知图片格式
 * @param {Buffer} buffer 至少 12 字节
 * @returns {string|null} 'jpeg' | 'png' | 'gif' | 'webp' | null
 */
function sniffImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 3) return null;
  for (const sig of SIGNATURES) {
    if (sig.test(buffer)) return sig.type;
  }
  return null;
}

/**
 * Express 中间件：校验 multer 刚落盘的文件是不是真图片。
 * 必须放在 upload.single(...) 之后、业务 controller 之前。
 * 校验不通过时删除临时文件并返回 400，避免留下垃圾文件。
 */
async function verifyImageContent(req, res, next) {
  if (!req.file || !req.file.path) return next();

  const filePath = req.file.path;
  let handle = null;

  try {
    handle = await fsp.open(filePath, 'r');
    const buf = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buf, 0, 12, 0);

    if (!sniffImageType(buf.subarray(0, bytesRead))) {
      await handle.close();
      handle = null;
      await fsp.unlink(filePath).catch(() => {});
      return res.status(400).json({
        code: 400,
        message: '文件内容不是有效图片，请重新选择',
        data: null
      });
    }

    return next();
  } catch (err) {
    console.error('[上传] 文件头校验异常:', err.message);
    await fsp.unlink(filePath).catch(() => {});
    return res.status(400).json({
      code: 400,
      message: '图片校验失败，请重新上传',
      data: null
    });
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

module.exports = { sniffImageType, verifyImageContent, SIGNATURES };
