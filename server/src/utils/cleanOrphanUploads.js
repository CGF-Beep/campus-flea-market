/**
 * 清理 uploads 目录里没有被任何数据引用的孤儿图片
 *
 * 用法：
 *   npm run clean-orphan-uploads          # 只扫描并列出（默认，不改动任何文件）
 *   npm run clean-orphan-uploads -- --apply   # 真正删除
 *
 * 孤儿是怎么产生的：
 *   ① 上传了图片但最终没有提交商品表单；
 *   ② 商品被永久删除时（修复前）不会删磁盘文件；
 *   ③ 上传处理中途失败，原格式临时文件残留。
 *
 * 安全设计：
 *   - 默认 dry-run，必须显式加 --apply 才会删除；
 *   - 如果「被引用文件集合」为空，直接中止 —— 这通常意味着查询出错，
 *     继续删会把整个 uploads 目录清空。
 */
require('dotenv').config();
const path = require('path');
const { Op } = require('sequelize');
const { sequelize, Product, User } = require('../models');
const {
  UPLOAD_DIR,
  THUMB_DIR,
  parseImages,
  listFilesRecursive,
  listThumbFiles,
  unlinkQuiet
} = require('./imageFiles');

const APPLY = process.argv.includes('--apply');

/** 收集数据库里所有被引用的 uploads 相对路径（posix 形式，不含前导 /uploads/） */
async function collectReferenced() {
  const referenced = new Set();

  const products = await Product.findAll({ attributes: ['images'] });
  for (const p of products) {
    for (const url of parseImages(p.images)) {
      if (url.startsWith('/uploads/')) {
        referenced.add(url.slice('/uploads/'.length));
      }
    }
  }

  const users = await User.findAll({ attributes: ['avatar'] });
  for (const u of users) {
    if (typeof u.avatar === 'string' && u.avatar.startsWith('/uploads/')) {
      referenced.add(u.avatar.slice('/uploads/'.length));
    }
  }

  return referenced;
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function main() {
  const fs = require('fs');

  const referenced = await collectReferenced();

  // 安全闸门：引用集合为空说明查询异常，绝不能在此时删文件
  if (referenced.size === 0) {
    console.error('中止：数据库中没有任何被引用的图片，疑似查询异常。为安全起见不做任何删除。');
    await sequelize.close();
    process.exit(1);
  }

  const allFiles = await listFilesRecursive(UPLOAD_DIR, UPLOAD_DIR);
  const thumbs = await listThumbFiles();

  const orphanFiles = [];
  const orphanThumbs = [];
  let orphanBytes = 0;

  for (const rel of allFiles) {
    if (!referenced.has(rel)) {
      const abs = path.join(UPLOAD_DIR, rel);
      const size = fs.existsSync(abs) ? fs.statSync(abs).size : 0;
      orphanFiles.push({ rel, size });
      orphanBytes += size;
    }
  }

  // 缩略图：原图存在则说明它有用；原图已不存在（或原图是孤儿）则缩略图也是孤儿
  const referencedThumbs = new Set(
    [...referenced].map((rel) => path.basename(rel))
  );
  for (const name of thumbs) {
    if (!referencedThumbs.has(name)) {
      const abs = path.join(THUMB_DIR, name);
      const size = fs.existsSync(abs) ? fs.statSync(abs).size : 0;
      orphanThumbs.push({ name, size });
      orphanBytes += size;
    }
  }

  console.log('========================================');
  console.log(`上传目录      : ${UPLOAD_DIR}`);
  console.log(`被引用文件    : ${referenced.size} 个`);
  console.log(`目录内文件    : ${allFiles.length} 个 + 缩略图 ${thumbs.length} 个`);
  console.log(`孤儿文件      : ${orphanFiles.length} 个原图 + ${orphanThumbs.length} 个缩略图`);
  console.log(`可回收空间    : ${humanSize(orphanBytes)}`);
  console.log('========================================');

  if (orphanFiles.length || orphanThumbs.length) {
    console.log('\n前 20 个孤儿文件：');
    [...orphanFiles, ...orphanThumbs.map((t) => ({ rel: 'thumbs/' + t.name, size: t.size }))]
      .slice(0, 20)
      .forEach((f) => console.log(`  ${humanSize(f.size).padStart(9)}  ${f.rel}`));
  }

  if (!orphanFiles.length && !orphanThumbs.length) {
    console.log('\n没有孤儿文件，无需清理。');
    await sequelize.close();
    process.exit(0);
  }

  if (!APPLY) {
    console.log('\n当前为「只扫描」模式，未删除任何文件。');
    console.log('确认无误后执行：npm run clean-orphan-uploads -- --apply');
    await sequelize.close();
    process.exit(0);
  }

  let removed = 0;
  for (const f of orphanFiles) {
    if (await unlinkQuiet(path.join(UPLOAD_DIR, f.rel))) removed++;
  }
  for (const t of orphanThumbs) {
    if (await unlinkQuiet(path.join(THUMB_DIR, t.name))) removed++;
  }

  console.log(`\n已删除 ${removed} 个文件，回收 ${humanSize(orphanBytes)}`);
  await sequelize.close();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('清理失败:', err.message);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
