/**
 * 一次性脚本：为热点查询补上缺失的复合索引（幂等，可重复执行）。
 *
 * 背景：这些表在 Sequelize 里都没有声明 indexes，列表页按
 *   WHERE status='on_sale' ORDER BY created_at DESC
 * 查询，数据量一上来就会 filesort 全表扫描。
 *
 * 用法（在 server 目录下执行）：
 *   node scripts/add-indexes.js --dry-run   # 只看会加哪些索引
 *   node scripts/add-indexes.js             # 实际执行
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const sequelize = require('../src/config/database');

const dryRun = process.argv.includes('--dry-run');

// 索引清单：[表名, 索引名, 列定义]
const INDEXES = [
  ['products', 'idx_products_status_created', '(`status`, `created_at`)'],
  ['products', 'idx_products_status_category_created', '(`status`, `category_id`, `created_at`)'],
  ['products', 'idx_products_user_created', '(`user_id`, `created_at`)'],
  ['orders', 'idx_orders_buyer_created', '(`buyer_id`, `created_at`)'],
  ['orders', 'idx_orders_seller_created', '(`seller_id`, `created_at`)'],
  ['messages', 'idx_messages_pair_created', '(`from_user_id`, `to_user_id`, `created_at`)'],
  ['favorites', 'idx_favorites_user_created', '(`user_id`, `created_at`)']
];

async function columnExists(table, column) {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column], type: sequelize.QueryTypes.SELECT }
  );
  return rows[0].n > 0;
}

async function tableExists(table) {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    { replacements: [table], type: sequelize.QueryTypes.SELECT }
  );
  return rows[0].n > 0;
}

async function indexExists(table, indexName) {
  const rows = await sequelize.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    { replacements: [table, indexName], type: sequelize.QueryTypes.SELECT }
  );
  return rows[0].n > 0;
}

(async () => {
  console.log(`\n=== 索引补全 ${dryRun ? '(dry-run 预览)' : '(实际执行)'} ===`);
  let added = 0, skipped = 0, missing = 0;

  for (const [table, name, cols] of INDEXES) {
    if (!(await tableExists(table))) {
      console.log(`  跳过 ${table}.${name}：表不存在`);
      missing++;
      continue;
    }
    // 列不匹配（比如字段名改了）就跳过，避免报错
    const colNames = [...cols.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    let ok = true;
    for (const c of colNames) if (!(await columnExists(table, c))) ok = false;
    if (!ok) {
      console.log(`  跳过 ${table}.${name}：列 ${colNames.join(',')} 不存在`);
      missing++;
      continue;
    }

    if (await indexExists(table, name)) {
      console.log(`  已存在 ${table}.${name}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  [将创建] ${table}.${name} ${cols}`);
      added++;
      continue;
    }

    try {
      await sequelize.query(`ALTER TABLE \`${table}\` ADD INDEX \`${name}\` ${cols}`);
      console.log(`  已创建 ${table}.${name} ${cols}`);
      added++;
    } catch (e) {
      console.error(`  创建失败 ${table}.${name}: ${e.message}`);
    }
  }

  console.log(`\n汇总：新建 ${added}，已存在 ${skipped}，跳过 ${missing}`);
  if (!dryRun && added) {
    console.log('\n验证商品列表查询计划：');
    try {
      const plan = await sequelize.query(
        "EXPLAIN SELECT id FROM products WHERE status = 'on_sale' ORDER BY created_at DESC LIMIT 10",
        { type: sequelize.QueryTypes.SELECT }
      );
      console.table(plan.map((r) => ({ key: r.key, type: r.type, rows: r.rows, extra: r.Extra })));
    } catch (e) {
      console.error('EXPLAIN 失败:', e.message);
    }
  }
  console.log(dryRun ? '\n预览模式，未做修改。\n' : '\n完成。\n');
  await sequelize.close();
})().catch(async (e) => {
  console.error('脚本异常:', e.message);
  try { await sequelize.close(); } catch {}
  process.exit(1);
});
