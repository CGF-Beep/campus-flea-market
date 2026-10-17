const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 机型别名表
 *
 * 为什么单独一张表，而不是在 visit_sessions 上直接存一列命名后的机型：
 * 访问记录里存的是**事实**（UA 里的原始型号代码），别名是**解释**。
 * 分成两层的好处是改一次别名，所有历史记录立刻跟着变；
 * 如果把别名写进每条访问记录，改个名字就得批量更新整张表（数据一多根本动不了）。
 *
 * 别名表通常只有几十行，所以读取时整张载入内存做 Map 映射，比每次查询 JOIN 便宜。
 */
const DeviceModelAlias = sequelize.define('DeviceModelAlias', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  modelCode: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    comment: 'UA 里的原始型号代码，如 2211133C'
  },
  alias: {
    type: DataTypes.STRING(64),
    allowNull: false,
    comment: '管理员起的名字，如「小米 13」'
  },
  operatorId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: '命名人（管理员 id）'
  }
}, {
  tableName: 'device_model_aliases',
  timestamps: true,
  underscored: true
});

module.exports = DeviceModelAlias;
