const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const upload = require('../middleware/upload');
const { verifyImageContent } = require('../utils/imageSignature');
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
const userController = require('../controllers/userController');
const visitController = require('../controllers/visitController');

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
// 用户公开主页路由
// ========================
// 无需登录即可查看（买家逛市场时先建立信任，再决定是否下单）
router.get('/users/:id', userController.publicProfile);
router.get('/users/:id/products', userController.userProducts);

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
// verifyImageContent 必须夹在 multer 与 controller 之间：
// multer 的扩展名/MIME 校验都来自客户端可伪造的字段，这里读文件头做真实判定
router.post('/upload', authenticate, upload.single('file'), verifyImageContent, uploadController.upload);

// ========================
// 后台管理路由
// ========================
router.get('/admin/dashboard', authenticate, requireAdmin, adminController.dashboard);
router.get('/admin/users', authenticate, requireAdmin, adminController.userList);
router.put('/admin/users/:id/status', authenticate, requireAdmin, adminController.updateUserStatus);
router.get('/admin/products', authenticate, requireAdmin, adminController.productList);
router.get('/admin/orders', authenticate, requireAdmin, adminController.orderList);
router.put('/admin/orders/:id/cancel', authenticate, requireAdmin, orderController.adminCancel);

// ========================
// 访问分析路由
// ========================
// 前端埋点上报：用 text/plain 承载 JSON（避免 CORS 预检，见 visitController.report 注释）。
// 这里刻意不加 authenticate —— 未登录访客的浏览也要统计。
router.post(
  '/visit/report',
  express.text({ type: 'text/plain', limit: '4kb' }),
  visitController.report
);

// 后台访问分析（仅管理员可见）
router.get('/admin/visit/overview', authenticate, requireAdmin, visitController.overview);
router.get('/admin/visit/sources', authenticate, requireAdmin, visitController.sources);
router.get('/admin/visit/devices', authenticate, requireAdmin, visitController.devices);
router.get('/admin/visit/pages', authenticate, requireAdmin, visitController.pages);
router.get('/admin/visit/regions', authenticate, requireAdmin, visitController.regions);
router.get('/admin/visit/realtime', authenticate, requireAdmin, visitController.realtime);
router.get('/admin/visit/sessions', authenticate, requireAdmin, visitController.sessions);
// 机型别名：查全部 / 新增或改名（alias 传空即取消命名）
router.get('/admin/visit/aliases', authenticate, requireAdmin, visitController.aliases);
router.put('/admin/visit/aliases', authenticate, requireAdmin, visitController.saveAlias);
// 清理：先预览（只数不删）供前端二次确认，再执行
router.get('/admin/visit/clean/preview', authenticate, requireAdmin, visitController.cleanPreview);
router.delete('/admin/visit/clean', authenticate, requireAdmin, visitController.clean);

module.exports = router;
