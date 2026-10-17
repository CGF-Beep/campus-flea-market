const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 访问会话表
 *
 * 一次「会话」= 同一访客在 30 分钟内的一连串活动（Umami 的 visit 分组思路）。
 * PV / UV / 跳出率 / 平均停留时长这些看板核心指标全部基于这张表算，
 * 因为只有会话层才有「停留时长」和「跳出」的概念，明细事件层没有。
 */
const VisitSession = sequelize.define('VisitSession', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  sessionUuid: {
    type: DataTypes.CHAR(36),
    allowNull: false,
    unique: true,
    comment: '会话标识'
  },
  visitorId: {
    type: DataTypes.CHAR(32),
    allowNull: false,
    comment: '访客日标识 hash(密钥+日期+IP+UA)，跨天不可串联同一个人'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '会话开始时间'
  },
  lastActiveAt: {
    type: DataTypes.DATE,
    allowNull: false,
    comment: '最后活跃时间，超过 30 分钟无活动即开启新会话'
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: '会话结束时间（清理旧数据时回填）'
  },
  duration: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
    comment: '停留秒数 = 最后活跃 - 开始'
  },
  pageviews: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
    comment: '本次会话浏览页数'
  },
  isBounce: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
    comment: '是否跳出：只看了 1 页即为 1'
  },
  entryPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '入口页'
  },
  exitPath: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '出口页'
  },
  sourceChannel: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '直接访问',
    comment: '来源渠道：直接访问/微信/微信内打开/站内跳转/搜索引擎/外链/推广链接'
  },
  referrerHost: {
    type: DataTypes.STRING(191),
    allowNull: true,
    comment: '来源域名（只存域名，不存完整 URL 与查询参数）'
  },
  utmSource: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'utm_source 推广来源'
  },
  device: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: '设备类型：手机/平板/PC/未知'
  },
  os: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '操作系统'
  },
  browser: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '浏览器（含微信/QQ/UC 等内置浏览器）'
  },
  deviceModel: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '设备型号标识。多为厂商内部代码（2211133C=小米、SM-S9210=三星）；iPhone/iPad 只能到设备族'
  },
  deviceBrand: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '设备品牌（Xiaomi / Vivo / Honor…），由 ua-parser-js 的规则库判定'
  },
  screen: {
    type: DataTypes.STRING(16),
    allowNull: true,
    comment: '屏幕尺寸，由前端上报'
  },
  language: {
    type: DataTypes.STRING(16),
    allowNull: true,
    comment: '浏览器语言'
  },
  ip: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: '完整 IP 明文，后台直接展示；同时用于归属地统计'
  },
  country: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '国家（离线归属地库）'
  },
  province: {
    type: DataTypes.STRING(32),
    allowNull: true,
    comment: '省份'
  },
  city: {
    type: DataTypes.STRING(48),
    allowNull: true,
    comment: '城市'
  },
  isp: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: '运营商：电信/联通/移动/教育网等'
  },
  ipMasked: {
    type: DataTypes.STRING(45),
    allowNull: true,
    comment: '脱敏 IP。列表已改为直接展示完整 IP，这里仅作兜底（如密钥轮换后密文解不开时）'
  },
  ipEncrypted: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '完整 IP 的 AES-256-GCM 密文。展示已不依赖它，继续写入是为了保留「改回脱敏模式」的可回退性'
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    comment: '登录用户 id，匿名为空；不建数据库外键，保持日志表低耦合'
  },
  isBot: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
    comment: '爬虫/自动化客户端标记，看板默认排除'
  }
}, {
  tableName: 'visit_sessions',
  timestamps: true,
  underscored: true,
  indexes: [
    // 会话复用查询：WHERE visitor_id = ? AND last_active_at >= ?
    { name: 'visit_sessions_visitor_active_idx', fields: ['visitor_id', 'last_active_at'] },
    // 看板按时间范围统计
    { name: 'visit_sessions_started_idx', fields: ['started_at'] },
    { name: 'visit_sessions_user_idx', fields: ['user_id'] }
  ]
});

module.exports = VisitSession;
