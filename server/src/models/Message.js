const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  fromUserId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'from_user_id',
    comment: '发送者ID'
  },
  toUserId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'to_user_id',
    comment: '接收者ID'
  },
  productId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: 'product_id',
    comment: '关联商品ID'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: '消息内容'
  },
  image: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '图片URL（图片消息）'
  },
  isRead: {
    type: DataTypes.TINYINT,
    defaultValue: 0,
    field: 'is_read',
    comment: '是否已读：0-未读 1-已读'
  }
}, {
  tableName: 'messages',
  timestamps: true,
  underscored: true
});

module.exports = Message;
