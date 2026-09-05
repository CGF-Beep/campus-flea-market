const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  orderNo: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
    field: 'order_no',
    comment: '订单编号'
  },
  productId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'product_id',
    comment: '商品ID'
  },
  buyerId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'buyer_id',
    comment: '买家ID'
  },
  sellerId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'seller_id',
    comment: '卖家ID'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: '成交价格'
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
    comment: '状态：pending-待确认 confirmed-已确认 completed-已完成 cancelled-已取消'
  },
  remark: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: '买家备注'
  }
}, {
  tableName: 'orders',
  timestamps: true,
  underscored: true
});

module.exports = Order;
