const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 访问事件表
 *
 * 只记「页面浏览」（由前端埋点上报），不记每个 API 请求。
 * 原因：一次页面加载会并发七八个接口（分类、商品列表、未读数…），
 * 若把接口调用也写进来，明细量会是真实浏览量的十倍以上，
 * 而且「接口调了几次」并不能回答任何运营问题。
 * 服务端中间件的职责是维护会话（IP/UA/设备/在线状态），不写事件明细。
 */
const VisitEvent = sequelize.define('VisitEvent', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  sessionId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    comment: '所属会话'
  },
  eventType: {
    type: DataTypes.ENUM('pageview'),
    allowNull: false,
    defaultValue: 'pageview',
    comment: '事件类型，当前只有页面浏览'
  },
  path: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: '访问路径（不含域名）'
  },
  pageTitle: {
    type: DataTypes.STRING(191),
    allowNull: true,
    comment: '页面标题'
  },
  stayMs: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
    comment: '在该页停留毫秒数，由前端在离开时补报给下一条事件'
  }
}, {
  tableName: 'visit_events',
  timestamps: true,
  updatedAt: false, // 事件是只增不改的，不需要 updated_at
  underscored: true,
  indexes: [
    { name: 'visit_events_session_idx', fields: ['session_id'] },
    { name: 'visit_events_created_idx', fields: ['created_at'] },
    { name: 'visit_events_path_idx', fields: ['path'] }
  ]
});

module.exports = VisitEvent;
