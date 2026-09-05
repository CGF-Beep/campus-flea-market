const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const upload = require('../middleware/upload');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ===== 控制器引入 =====
const authController = require('../controllers/authController');
const productController = require('../controllers/productController');
const categoryController = require('../controllers/categoryController');
const orderController = require('../controllers/orderController');
const messageController = require('../controllers/messageController');
const favoriteController = require('../controllers/favoriteController');
const uploadController = require('../controllers/uploadController');
const adminController = require('../controllers/adminController');

// ========================
// 认证相关路由
// ========================
// 登录接口限流：同一IP 15分钟内最多10次，防暴力破解
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '登录尝试过于频繁，请15分钟后再试', data: null }
});
// 注册接口限流：同一IP 1小时内最多5次，防批量注册
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 429, message: '注册过于频繁，请1小时后再试', data: null }
});

router.get('/auth/public-key', authController.publicKey);
router.post('/auth/register', registerLimiter, authController.register);
router.post('/auth/login', loginLimiter, authController.login);
router.get('/auth/profile', authenticate, authController.getProfile);
router.put('/auth/profile', authenticate, authController.updateProfile);
router.put('/auth/password', authenticate, authController.changePassword);

// ========================
// 分类路由
// ========================
router.get('/categories', categoryController.list);
router.post('/categories', authenticate, requireAdmin, categoryController.create);
router.put('/categories/:id', authenticate, requireAdmin, categoryController.update);
router.delete('/categories/:id', authenticate, requireAdmin, categoryController.remove);

// ========================
// 商品路由
// ========================
router.get('/products', productController.list);
router.get('/products/:id', (req, res, next) => {
  // 尝试解析token但不强制要求（前端商品详情页可能未登录）
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const jwt = require('jsonwebtoken');
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
      req.user = decoded;
    } catch (e) {
      // token无效也允许查看
    }
  }
  next();
}, productController.detail);
router.post('/products', authenticate, productController.create);
router.put('/products/:id', authenticate, productController.update);
router.delete('/products/:id', authenticate, productController.remove);
router.delete('/products/:id/permanent', authenticate, productController.deleteProduct);
router.get('/my/products', authenticate, productController.myProducts);

// 管理员审核商品
router.put('/admin/products/:id/approve', authenticate, requireAdmin, productController.approve);
router.put('/admin/products/:id/reject', authenticate, requireAdmin, productController.reject);

// ========================
// 订单路由
// ========================
router.post('/orders', authenticate, orderController.create);
router.get('/my/orders', authenticate, orderController.myOrders);
router.get('/orders/:id', authenticate, orderController.detail);
router.put('/orders/:id/confirm', authenticate, orderController.confirm);
router.put('/orders/:id/receive', authenticate, orderController.receive);
router.put('/orders/:id/cancel', authenticate, orderController.cancel);
router.delete('/orders/:id', authenticate, orderController.remove);

// ========================
// 收藏路由
// ========================
router.post('/favorites', authenticate, favoriteController.add);
router.delete('/favorites/:productId', authenticate, favoriteController.remove);
router.get('/my/favorites', authenticate, favoriteController.myFavorites);

// ========================
// 消息路由
// ========================
router.post('/messages', authenticate, messageController.send);
router.get('/messages/conversations', authenticate, messageController.conversations);
router.get('/messages/unread', authenticate, messageController.unreadCount);
router.get('/messages/:userId', authenticate, messageController.chatHistory);

// ========================
// 文件上传路由
// ========================
router.post('/upload', authenticate, upload.single('file'), uploadController.upload);

// ========================
// 后台管理路由
// ========================
router.get('/admin/dashboard', authenticate, requireAdmin, adminController.dashboard);
router.get('/admin/users', authenticate, requireAdmin, adminController.userList);
router.put('/admin/users/:id/status', authenticate, requireAdmin, adminController.updateUserStatus);
router.get('/admin/products', authenticate, requireAdmin, adminController.productList);
router.get('/admin/orders', authenticate, requireAdmin, adminController.orderList);
router.put('/admin/orders/:id/cancel', authenticate, requireAdmin, orderController.adminCancel);

module.exports = router;
