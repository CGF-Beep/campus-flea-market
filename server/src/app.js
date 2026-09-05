const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
require('dotenv').config();

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// 信任代理：仅当服务位于 Nginx/内网穿透代理之后时才开启（.env 中 TRUST_PROXY=true）。
// 若服务直接暴露公网，开启此项会导致攻击者伪造 X-Forwarded-For 绕过限流，故默认关闭。
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
  console.log('[安全] trust proxy 已启用（代理模式）');
}

// 安全响应头（XSS保护、内容嗅探防护等）
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // 允许跨域加载上传的图片
}));

// 中间件
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（上传的图片）：禁止浏览器嗅探内容类型，防止伪装图片执行脚本
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// API路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '校园二手交易平台服务运行中' });
});

// 生产环境：托管前端构建产物（dist），支持 SPA 路由回退
const distPath = path.join(__dirname, '../../client/dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/(api|uploads|health)).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 全局错误处理：不透出内部错误详情，避免泄露数据库结构等敏感信息
app.use((err, req, res, next) => {
  console.error('服务器错误:', err.message);
  if (err instanceof Error && err.message.includes('仅支持')) {
    return res.status(400).json({ code: 400, message: err.message, data: null });
  }
  // multer 限流/文件超限错误
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ code: 400, message: '文件大小不能超过5MB', data: null });
  }
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`\n=================================`);
  console.log(`  校园二手交易平台后端服务`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API前缀: /api`);
  console.log(`=================================\n`);
});

module.exports = app;
