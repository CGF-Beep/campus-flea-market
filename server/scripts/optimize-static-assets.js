/**
 * 一次性脚本：压缩站点自带静态资源 + 归置未引用的死文件。
 *  1) client/src/assets/logo.png  (1034x1195, 172KB) -> 缩到 128px 高
 *  2) client/public/favicon.png   (172KB)            -> 缩到 96px
 *  3) client/public 下未被代码引用的图片 -> 移到 client/_unused_backup/
 *     （Vite 会把 public/ 原样拷进 dist，死文件会白白增加部署体积）
 *
 * 用法：node scripts/optimize-static-assets.js --dry-run | (无参数即执行)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const CLIENT = path.join(__dirname, '..', '..', 'client');
const BACKUP = path.join(CLIENT, '_unused_backup');
const dryRun = process.argv.includes('--dry-run');

const jobs = [
  { file: path.join(CLIENT, 'src/assets/logo.png'), height: 128 },
  { file: path.join(CLIENT, 'public/favicon.png'), height: 96 }
];

// 已确认全项目 grep 不到引用的 public 资源
const deadFiles = ['auth-bg.jpg', 'auth-bg.png', 'auth-bg.webp'];

(async () => {
  console.log(`\n=== 静态资源优化 ${dryRun ? '(dry-run 预览)' : '(实际执行)'} ===`);

  for (const job of jobs) {
    if (!fs.existsSync(job.file)) {
      console.log(`  跳过（不存在）: ${path.basename(job.file)}`);
      continue;
    }
    const before = fs.statSync(job.file).size;
    const meta = await sharp(job.file).metadata();
    if (dryRun) {
      console.log(`  [将压缩] ${path.basename(job.file)}  ${meta.width}x${meta.height}  ${(before / 1024).toFixed(0)}KB -> 高${job.height}px`);
      continue;
    }
    const buf = await sharp(job.file)
      .resize({ height: job.height, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer();
    // 只在确实变小的情况下覆盖
    if (buf.length < before) {
      fs.writeFileSync(job.file, buf);
      console.log(`  压缩 ${path.basename(job.file)}: ${meta.width}x${meta.height} ${(before / 1024).toFixed(0)}KB -> ${(buf.length / 1024).toFixed(1)}KB`);
    } else {
      console.log(`  跳过 ${path.basename(job.file)}：压缩后反而更大`);
    }
  }

  console.log('\n  --- 未引用文件归置 ---');
  if (!dryRun) fs.mkdirSync(BACKUP, { recursive: true });
  for (const name of deadFiles) {
    const p = path.join(CLIENT, 'public', name);
    if (!fs.existsSync(p)) {
      console.log(`  跳过（不存在）: ${name}`);
      continue;
    }
    const size = (fs.statSync(p).size / 1024).toFixed(0);
    if (dryRun) {
      console.log(`  [将移动] public/${name}  ${size}KB -> _unused_backup/`);
      continue;
    }
    fs.renameSync(p, path.join(BACKUP, name));
    console.log(`  已移出 public/${name} (${size}KB) -> client/_unused_backup/`);
  }

  console.log(dryRun ? '\n预览模式，未做修改。\n' : '\n完成。确认无副作用后 _unused_backup/ 可自行删除。\n');
})();
