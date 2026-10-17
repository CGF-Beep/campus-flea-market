const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

/**
 * 上传图片的磁盘文件工具
 *
 * 背景：上传接口会把原图转成 WebP 落到 src/uploads，并额外生成一张
 * src/uploads/thumbs 下的缩略图，但**删除商品时只删数据库记录，不删磁盘文件**。
 * 商品被永久删除、或上传后没提交表单，文件就会永远留在盘上只增不减。
 */

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs');

/**
 * 把 `/uploads/xxx.webp` 解析成磁盘绝对路径。
 * 解析结果必须仍落在 uploads 目录内，防止 `../` 目录穿越删到项目其他文件。
 * @returns {string|null}
 */
function resolveUploadPath(url) {
  if (typeof url !== 'string' || !url) return null;
  const clean = url.split('?')[0].split('#')[0];
  if (!clean.startsWith('/uploads/')) return null;

  const rel = clean.slice('/uploads/'.length);
  if (!rel) return null;

  const abs = path.resolve(UPLOAD_DIR, rel);
  if (abs !== UPLOAD_DIR && !abs.startsWith(UPLOAD_DIR + path.sep)) return null;
  return abs;
}

/** 由原图路径推导缩略图路径：/uploads/a.webp → /uploads/thumbs/a.webp */
function thumbPathOf(absPath) {
  return path.join(THUMB_DIR, path.basename(absPath));
}

/** 静默删除单个文件，返回是否真的删掉了 */
async function unlinkQuiet(filePath) {
  try {
    await fsp.unlink(filePath);
    return true;
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn('[imageFiles] 删除失败:', filePath, err.message);
    }
    return false;
  }
}

/**
 * 删除一张图片（原图 + 缩略图）
 * @returns {Promise<number>} 实际删除的文件数
 */
async function removeImageFile(url) {
  const abs = resolveUploadPath(url);
  if (!abs) return 0;
  let n = 0;
  if (await unlinkQuiet(abs)) n++;
  if (await unlinkQuiet(thumbPathOf(abs))) n++;
  return n;
}

/** 解析商品 images 字段（可能是 JSON 字符串、数组或 null） */
function parseImages(images) {
  if (Array.isArray(images)) return images.filter((u) => typeof u === 'string');
  if (typeof images === 'string' && images) {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed.filter((u) => typeof u === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** 递归列出目录下所有文件（相对 uploads 的 posix 路径），跳过 thumbs 子目录 */
async function listFilesRecursive(dir, baseDir, out = []) {
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === THUMB_DIR) continue;
      await listFilesRecursive(full, baseDir, out);
    } else if (entry.isFile()) {
      out.push(path.relative(baseDir, full).split(path.sep).join('/'));
    }
  }
  return out;
}

/** 列出 thumbs 目录下所有文件（相对 thumbs 的 posix 路径） */
async function listThumbFiles() {
  let entries = [];
  try {
    entries = await fsp.readdir(THUMB_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isFile()).map((e) => e.name);
}

module.exports = {
  UPLOAD_DIR,
  THUMB_DIR,
  resolveUploadPath,
  thumbPathOf,
  removeImageFile,
  parseImages,
  listFilesRecursive,
  listThumbFiles,
  unlinkQuiet
};
