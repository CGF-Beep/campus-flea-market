const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'user_id',
    comment: '发布者ID'
  },
  categoryId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'category_id',
    comment: '分类ID'
  },
  title: {
    type: DataTypes.STRING(100),
    allowNull: false,
    comment: '商品标题'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: '商品描述'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '售价'
  },
  originalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: '原价'
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: '商品图片（JSON数组）'
  },
  condition: {
    type: DataTypes.ENUM('全新', '九成新', '八成新', '七成新及以下'),
    allowNull: false,
    defaultValue: '九成新',
    comment: '成色'
  },
  location: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: '交易地点'
  },
  status: {
    type: DataTypes.ENUM('pending', 'on_sale', 'sold', 'rejected', 'removed'),
    allowNull: false,
    defaultValue: 'pending',
    comment: '状态：pending-待审核 on_sale-在售 sold-已售 rejected-审核拒绝 removed-已下架'
  },
  rejectReason: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '拒绝原因'
  },
  views: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    comment: '浏览量'
  },
  priceNoticeAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'price_notice_at',
    comment: '最近一次降价通知收藏者的时间（用于节流，避免反复改价刷屏）'
  }
}, {
  tableName: 'products',
  timestamps: true,
  underscored: true
});

module.exports = Product;
