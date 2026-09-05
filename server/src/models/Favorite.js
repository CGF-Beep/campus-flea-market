const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Favorite = sequelize.define('Favorite', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'user_id',
    comment: '用户ID'
  },
  productId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    field: 'product_id',
    comment: '商品ID'
  }
}, {
  tableName: 'favorites',
  timestamps: true,
  underscored: true
});

module.exports = Favorite;
