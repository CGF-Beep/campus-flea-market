const jwt = require('jsonwebtoken');
require('dotenv').config();

// JWT密钥必须通过环境变量提供，禁止硬编码兑底值
if (!process.env.JWT_SECRET) {
  throw new Error('环境变量 JWT_SECRET 未配置，服务拒绝启动');
}

// 获取 token：优先 Authorization Bearer 头
const getToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return null;
};

// 验证JWT Token
const authenticate = (req, res, next) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ code: 401, message: '未登录或token已失效' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: 'token无效或已过期' });
  }
};

// 验证管理员权限
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ code: 403, message: '无权限访问' });
  }
  next();
};

module.exports = { authenticate, requireAdmin, getToken };
