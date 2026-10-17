/**
 * 修正 users.avatar 的列默认值：/uploads/default-avatar.png -> /uploads/default-avatar.svg
 *
 * 背景：
 *   init.sql 与早期建表时把默认值写成了 .png，但静态目录 server/src/uploads 下
 *   实际只有 default-avatar.svg（没有 .png），且所有写入路径（models/User.js、
 *   utils/initDB.js）用的都是 .svg。
 *
 *   目前因为每个创建用户的地方都显式写了 avatar，所以列默认值从未生效，
 *   属于「潜伏问题」：一旦将来有 INSERT 省略 avatar 字段，就会落库一个
 *   404 的图片地址。这里把默认值对齐到真实存在的文件。
 *
 * 幂等：先查 information_schema，已是 .svg 就直接跳过。
 * 用法：node scripts/fix-avatar-default.js [--dry-run]
 */
require('dotenv').config();
const sequelize = require('../src/config/database');

const NEW_DEFAULT = '/uploads/default-avatar.svg';
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_DEFAULT AS colDefault, IS_NULLABLE AS nullable
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'`
  );

  if (!rows.length) {
    console.error('❌ 找不到 users.avatar 列，请确认连的是正确的库');
    process.exit(1);
  }

  const current = rows[0].colDefault;
  console.log(`当前 avatar 列默认值: ${current === null ? '(NULL)' : current}`);

  if (current === NEW_DEFAULT) {
    console.log('✅ 已经是目标值，无需修改（幂等跳过）');
    return;
  }

  const sql = `ALTER TABLE users ALTER COLUMN avatar SET DEFAULT '${NEW_DEFAULT}'`;

  if (dryRun) {
    console.log(`\n[dry-run] 将执行:\n  ${sql}`);
    return;
  }

  await sequelize.query(sql);
  console.log(`\n✅ 已更新为: ${NEW_DEFAULT}`);
}

main()
  .catch((e) => {
    console.error('❌ 执行失败:', e.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
