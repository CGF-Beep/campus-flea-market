const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const { success, error } = require('../utils/response');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs');

// multer 不会自动创建目录，这里确保存在
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(THUMB_DIR, { recursive: true });

// 全图最大宽度（超过则等比缩小，避免原图过大拖慢加载）
const FULL_MAX_WIDTH = 1600;
// 列表页缩略图宽度
const THUMB_WIDTH = 400;

// 文件上传：上传即优化
// 1) 原图转 WebP（宽≤1600，质量80），覆盖式保存到 /uploads
// 2) 同时生成 400px 宽 WebP 缩略图到 /uploads/thumbs
// 3) 返回 { url, thumb, filename }，数据库仍只存字符串路径，数据结构不变
exports.upload = async (req, res) => {
  // multer 已落盘的原图（原格式）。无论成功失败都必须删掉它，
  // 否则 sharp 处理失败时这个临时文件会永远留在磁盘上（孤儿文件）。
  const originalPath = req.file && req.file.path;
  const baseName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const fullName = `${baseName}.webp`;
  const thumbName = `${baseName}.webp`;
  const fullPath = path.join(UPLOAD_DIR, fullName);
  const thumbPath = path.join(THUMB_DIR, thumbName);

  try {
    if (!req.file) {
      return res.status(400).json(error('请选择要上传的文件'));
    }

    const image = sharp(originalPath);

    // 全图：按 EXIF 修正方向 + 限制宽度 + 转 WebP
    await image
      .clone()
      .rotate()
      .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(fullPath);

    // 缩略图：400px 宽 + 转 WebP（列表页懒加载用）
    await image
      .clone()
      .rotate()
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(thumbPath);

    const url = `/uploads/${fullName}`;
    const thumb = `/uploads/thumbs/${thumbName}`;
    res.json(success({ url, thumb, filename: fullName }, '上传成功'));
  } catch (err) {
    console.error('[上传] 图片处理失败:', err);
    // 失败时清掉本次可能已写出的产物（例如全图转好了、缩略图那步失败），
    // 它们不会被任何商品引用，留着只会变成孤儿文件。
    fs.unlink(fullPath, () => {});
    fs.unlink(thumbPath, () => {});
    res.status(500).json(error('上传失败'));
  } finally {
    // 原格式临时文件在成功与失败路径下都要删除
    if (originalPath) fs.unlink(originalPath, () => {});
  }
};
