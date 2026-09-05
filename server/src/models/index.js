const sequelize = require('../config/database');
const User = require('./User');
const Category = require('./Category');
const Product = require('./Product');
const Order = require('./Order');
const Message = require('./Message');
const Favorite = require('./Favorite');

// ========== 模型关联关系 ==========

// 用户 - 商品（一对多）
User.hasMany(Product, { foreignKey: 'user_id', as: 'products' });
Product.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 分类 - 商品（一对多）
Category.hasMany(Product, { foreignKey: 'category_id', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });

// 商品 - 订单（一对多）
Product.hasMany(Order, { foreignKey: 'product_id', as: 'orders' });
Order.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

// 用户 - 订单（买家）
User.hasMany(Order, { foreignKey: 'buyer_id', as: 'buyerOrders' });
Order.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' });

// 用户 - 订单（卖家）
User.hasMany(Order, { foreignKey: 'seller_id', as: 'sellerOrders' });
Order.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' });

// 用户 - 消息（发送者）
User.hasMany(Message, { foreignKey: 'from_user_id', as: 'sentMessages' });
Message.belongsTo(User, { foreignKey: 'from_user_id', as: 'sender' });

// 用户 - 消息（接收者）
User.hasMany(Message, { foreignKey: 'to_user_id', as: 'receivedMessages' });
Message.belongsTo(User, { foreignKey: 'to_user_id', as: 'receiver' });

// 用户 - 收藏（一对多）
User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' });
Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// 商品 - 收藏（一对多）
Product.hasMany(Favorite, { foreignKey: 'product_id', as: 'favorites' });
Favorite.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

module.exports = {
  sequelize,
  User,
  Category,
  Product,
  Order,
  Message,
  Favorite
};
