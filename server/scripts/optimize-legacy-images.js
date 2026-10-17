/**
 * 一次性脚本：把历史遗留的 jpg/png 图片统一转成 WebP + 生成 400px 缩略图，
 * 并同步改写数据库中引用这些图片的路径（.jpg/.jpeg/.png -> .webp）。
 *
 * 背景：uploadController 已经做了「上传即转 WebP + 缩略图」，但早期上传的图片
 * 仍是 jpg/png 且没有缩略图，前端 SmartImage 会先请求不存在的缩略图（404），
 * 再回退下载 0.7~2.2MB 的原图，在跨境链路上单张就要几百毫秒到 2 秒。
 *
 * 用法（在 server 目录下执行）：
 *   node scripts/optimize-legacy-images.js --dry-run   # 只预览，不改任何东西
 *   node scripts/optimize-legacy-images.js             # 真正执行
 *
 * 安全性：
 *   - 幂等：已存在同名 .webp 就跳过，可重复执行
 *   - 原始文件不删除，移动到 uploads/_legacy_backup/ 便于回滚
 *   - 改写数据库前，把受影响的行导出到 server/backup-image-paths-<时间戳>.json
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sequelize = require('../src/config/database');

const UPLOAD_DIR = path.join(__dirname, '..', 'src', 'uploads');
const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs');
const BACKUP_DIR = path.join(UPLOAD_DIR, '_legacy_backup');

const FULL_MAX_WIDTH = 1600; // 与 uploadController 保持一致
const THUMB_WIDTH = 400;
const LEGACY_EXT = ['.jpg', '.jpeg', '.png'];

const dryRun = process.argv.includes('--dry-run');

const stats = {
  scanned: 0,
  converted: 0,
  skipped: 0,
  failed: 0,
  bytesBefore: 0,
  bytesAfter: 0,
  moved: 0,
  dbRows: { products: 0, users: 0, messages: 0 }
};

function ensureDirs() {
  fs.mkdirSync(THUMB_DIR, { recursive: true });
  if (!dryRun) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function listLegacyFiles() {
  return fs.readdirSync(UPLOAD_DIR, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => LEGACY_EXT.includes(path.extname(name).toLowerCase()));
}

async function convertOne(fileName) {
  const srcPath = path.join(UPLOAD_DIR, fileName);
  const base = path.basename(fileName, path.extname(fileName));
  const fullPath = path.join(UPLOAD_DIR, `${base}.webp`);
  const thumbPath = path.join(THUMB_DIR, `${base}.webp`);

  const srcSize = fs.statSync(srcPath).size;
  stats.bytesBefore += srcSize;

  if (fs.existsSync(fullPath) && fs.existsSync(thumbPath)) {
    stats.skipped++;
    stats.bytesAfter += fs.statSync(fullPath).size + fs.statSync(thumbPath).size;
    return { fileName, base, converted: false };
  }

  if (dryRun) {
    stats.converted++;
    return { fileName, base, converted: true };
  }

  const image = sharp(srcPath);
  await image.clone().rotate()
    .resize({ width: FULL_MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 }).toFile(fullPath);
  await image.clone().rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 }).toFile(thumbPath);

  const after = fs.statSync(fullPath).size + fs.statSync(thumbPath).size;
  stats.bytesAfter += after;
  stats.converted++;

  // 原始文件挪到备份目录（不删除，可回滚）
  fs.renameSync(srcPath, path.join(BACKUP_DIR, fileName));
  stats.moved++;

  return { fileName, base, converted: true };
}

// ===== 数据库路径改写 =====
async function backupAndRewrite() {
  const t = await sequelize.query(
    "SELECT id, images FROM products WHERE images LIKE '%.jpg%' OR images LIKE '%.jpeg%' OR images LIKE '%.png%'",
    { type: sequelize.QueryTypes.SELECT }
  );
  const u = await sequelize.query(
    "SELECT id, avatar FROM users WHERE avatar LIKE '%.jpg%' OR avatar LIKE '%.jpeg%' OR avatar LIKE '%.png%'",
    { type: sequelize.QueryTypes.SELECT }
  );
  const m = await sequelize.query(
    "SELECT id, image FROM messages WHERE image LIKE '%.jpg%' OR image LIKE '%.jpeg%' OR image LIKE '%.png%'",
    { type: sequelize.QueryTypes.SELECT }
  );

  const backupPath = path.join(__dirname, '..', `backup-image-paths-${Date.now()}.json`);
  if (!dryRun) {
    fs.writeFileSync(backupPath, JSON.stringify({ products: t, users: u, messages: m }, null, 2));
    console.log(`[DB] 受影响数据已备份到: ${path.relative(path.join(__dirname, '..'), backupPath)}`);
  } else {
    console.log('[DB] dry-run：跳过备份与改写');
  }

  console.log(`[DB] 待改写: products=${t.length} users=${u.length} messages=${m.length}`);

  if (dryRun) return;

  // 只把「目标 webp 确实存在」的路径改掉，避免把不存在的文件也改了
  const webpExists = (p) => {
    if (!p || !p.startsWith('/uploads/')) return false;
    const rel = p.replace('/uploads/', '').replace(/^thumbs\//, '');
    const base = path.basename(rel, path.extname(rel));
    return fs.existsSync(path.join(UPLOAD_DIR, `${base}.webp`));
  };
  const toWebp = (p) => p.replace(/\.(jpe?g|png)$/i, '.webp');

  for (const row of t) {
    let imgs;
    try { imgs = typeof row.images === 'string' ? JSON.parse(row.images) : row.images; } catch { continue; }
    if (!Array.isArray(imgs)) continue;
    const next = imgs.map((p) => (LEGACY_EXT.includes(path.extname(p).toLowerCase()) && webpExists(p) ? toWebp(p) : p));
    if (JSON.stringify(next) !== JSON.stringify(imgs)) {
      await sequelize.query('UPDATE products SET images = ? WHERE id = ?', { replacements: [JSON.stringify(next), row.id] });
      stats.dbRows.products++;
    }
  }

  for (const row of u) {
    if (LEGACY_EXT.includes(path.extname(row.avatar || '').toLowerCase()) && webpExists(row.avatar)) {
      await sequelize.query('UPDATE users SET avatar = ? WHERE id = ?', { replacements: [toWebp(row.avatar), row.id] });
      stats.dbRows.users++;
    }
  }

  for (const row of m) {
    if (LEGACY_EXT.includes(path.extname(row.image || '').toLowerCase()) && webpExists(row.image)) {
      await sequelize.query('UPDATE messages SET image = ? WHERE id = ?', { replacements: [toWebp(row.image), row.id] });
      stats.dbRows.messages++;
    }
  }
}

(async () => {
  console.log(`\n=== 历史图片优化 ${dryRun ? '(dry-run 预览模式)' : '(实际执行)'} ===`);
  ensureDirs();

  const files = listLegacyFiles();
  stats.scanned = files.length;
  console.log(`发现遗留 jpg/png 图片: ${files.length} 张\n`);

  for (const f of files) {
    try {
      const r = await convertOne(f);
      if (r.converted) console.log(`  转换 ${f} -> ${r.base}.webp (+缩略图)`);
    } catch (e) {
      stats.failed++;
      console.error(`  失败 ${f}: ${e.message}`);
    }
  }

  await backupAndRewrite();

  const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';
  console.log('\n=== 汇总 ===');
  console.log(`扫描: ${stats.scanned}  转换: ${stats.converted}  跳过(已存在): ${stats.skipped}  失败: ${stats.failed}`);
  console.log(`原图体积: ${mb(stats.bytesBefore)}  ->  WebP+缩略图: ${mb(stats.bytesAfter)}`);
  console.log(`DB 改写: products=${stats.dbRows.products} users=${stats.dbRows.users} messages=${stats.dbRows.messages}`);
  if (!dryRun) console.log(`原文件已移至: src/uploads/_legacy_backup/（确认无误后可自行删除）`);
  console.log(dryRun ? '\n这是预览模式，未做任何修改。去掉 --dry-run 即真正执行。\n' : '\n完成。\n');

  await sequelize.close();
})().catch(async (e) => {
  console.error('脚本异常:', e);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
