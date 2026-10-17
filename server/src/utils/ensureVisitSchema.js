/**
 * 给已存在的日志表补字段
 *
 * 为什么需要它：sequelize.sync() 默认不带 alter，表一旦存在就整表跳过 ——
 * 模型里新加的字段在已有库上不会自动生效。
 *
 * 这里做的是幂等的「缺哪个补哪个」：只对缺失的列发 ADD COLUMN，
 * 不改类型、不删列、不碰任何已有数据。已补齐过就什么都不做。
 */

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EXTRA_COLUMNS = {
  visit_sessions: [
    ['ip', { type: DataTypes.STRING(45), allowNull: true, comment: '完整 IP 明文' }],
    ['country', { type: DataTypes.STRING(32), allowNull: true, comment: '国家' }],
    ['province', { type: DataTypes.STRING(32), allowNull: true, comment: '省份' }],
    ['city', { type: DataTypes.STRING(48), allowNull: true, comment: '城市' }],
    ['isp', { type: DataTypes.STRING(64), allowNull: true, comment: '运营商' }],
    ['device_model', { type: DataTypes.STRING(64), allowNull: true, comment: '设备型号标识' }],
    ['device_brand', { type: DataTypes.STRING(32), allowNull: true, comment: '设备品牌' }]
  ]
};

async function ensureVisitSchema() {
  const qi = sequelize.getQueryInterface();

  for (const table of Object.keys(EXTRA_COLUMNS)) {
    let exists;
    try {
      exists = await qi.describeTable(table);
    } catch (e) {
      // 表还没建：sync() 会一次性带上模型里的全部字段，这里跳过
      continue;
    }

    for (const [name, def] of EXTRA_COLUMNS[table]) {
      if (exists[name]) continue;
      await qi.addColumn(table, name, def);
      console.log(`[访问分析] 已补齐字段 ${table}.${name}`);
    }
  }
}

module.exports = ensureVisitSchema;
