/**
 * 迁移脚本：为 products 表补上 price_notice_at 字段（幂等，可重复执行）。
 *
 * 用途：降价提醒功能的节流时间戳。没有这个字段时，
 * productController.update 读 product.priceNoticeAt 会拿到 undefined，
 * 节流失效（但不会报错），所以上线前务必执行。
 *
 * 用法（在 server 目录下执行）：
 *   node scripts/add-price-notice-column.js --dry-run   # 只看是否会改
 *   node scripts/add-price-notice-column.js             # 实际执行
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sequelize = require('../src/config/database');

const dryRun = process.argv.includes('--dry-run');
const TABLE = 'products';
const COLUMN = 'price_notice_at';

(async () => {
  console.log(`\n=== 迁移 ${TABLE}.${COLUMN} ${dryRun ? '(dry-run 预览)' : '(实际执行)'} ===`);

  try {
    const [exists] = await sequelize.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      { replacements: [TABLE, COLUMN] }
    );

    if (Number(exists[0].n) > 0) {
      console.log(`✓ 字段已存在，无需变更（脚本可安全重复执行）`);
      await sequelize.close();
      return;
    }

    if (dryRun) {
      console.log(`[dry-run] 将执行：`);
      console.log(`  ALTER TABLE \`${TABLE}\` ADD COLUMN \`${COLUMN}\` DATETIME DEFAULT NULL COMMENT '最近一次降价通知收藏者的时间'`);
      await sequelize.close();
      return;
    }

    await sequelize.query(
      `ALTER TABLE \`${TABLE}\` ADD COLUMN \`${COLUMN}\` DATETIME DEFAULT NULL COMMENT '最近一次降价通知收藏者的时间'`
    );
    console.log(`✓ 已添加 \`${COLUMN}\` 字段`);

    // 回读确认
    const [check] = await sequelize.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      { replacements: [TABLE, COLUMN] }
    );
    console.log(`  回读确认: ${JSON.stringify(check[0])}`);
  } catch (e) {
    console.error('迁移失败:', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
})();
