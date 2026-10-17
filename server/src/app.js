const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const routes = require('./routes');
const visitCollect = require('./middleware/visitCollect');

const app = express();
const PORT = process.env.PORT || 3000;

// 信任代理：仅当服务位于 Nginx/内网穿透代理之后时才开启（.env 中 TRUST_PROXY=true）。
// 若服务直接暴露公网，开启此项会导致攻击者伪造 X-Forwarded-For 绕过限流，故默认关闭。
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
  console.log('[安全] trust proxy 已启用（代理模式）');
}

// Cloudflare 代理模式：客户端 IP 取自 CF-Connecting-IP。
// 不开启的话，橙云回源的请求会让访问日志里全是 CF 边缘节点地址。
if (process.env.CLOUDFLARE_PROXY === 'true') {
  console.log('[安全] Cloudflare 代理模式已启用，客户端 IP 取自 CF-Connecting-IP');
}

// 安全响应头（XSS保护、内容嗅探防护等）
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' } // 允许跨域加载上传的图片
}));

// 中间件
// CORS：支持 CLIENT_URL 里逗号分隔的多域名白名单。
// 注意：cors 的 origin 若为"单个字符串"，会把整串原样返回成 Access-Control-Allow-Origin，
// 多域名时（如 https://a.com,https://b.com）是无效头，浏览器会直接拒绝请求。
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowList = (process.env.CLIENT_URL || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowList.includes(origin)) return cb(null, true);
    // 兜底：允许 zeroly.me 主域、所有子域与本地开发
    const host = String(origin).split('://')[1] || origin;
    if (host === 'localhost:5173' || host === 'zeroly.me' || host.endsWith('.zeroly.me')) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 响应压缩（JSON/HTML/CSS/JS）：跨境链路上体积比带宽更敏感，压缩后传输量可降 70%+
// 注意：/uploads 下的图片本身已是 WebP，压不动，过滤器里直接跳过
// 上游已有 Cloudflare 时，这里压缩主要优化「回源」这一段
app.use(compression({
  filter: (req, res) => {
    if (req.path.startsWith('/uploads')) return false;
    return compression.filter(req, res);
  }
}));

// 静态文件服务（上传的图片）：禁止浏览器嗅探内容类型，防止伪装图片执行脚本
// 上传文件名带时间戳+随机数，内容永不变，可放心长缓存
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1y',
  immutable: true,
  fallthrough: true
}));

// 访问采集：必须挂在 /api 路由之前。
// 它只把「本次请求属于哪个会话」这个 Promise 挂到 req 上就放行，不 await、不阻塞，
// 采集本身出错也只吞掉（与 utils/notify.js 的原则一致）。
// /api/admin/* 会被它主动跳过，否则管理员看一次报表就把报表刷满自己的记录。
app.use('/api', visitCollect);

// API路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '校园二手交易平台服务运行中' });
});

// 生产环境：托管前端构建产物（dist），支持 SPA 路由回退
const distPath = path.join(__dirname, '../../client/dist');
if (require('fs').existsSync(distPath)) {
  app.use(express.static(distPath, {
    // 带 hash 的构建产物（/assets/xxx-<hash>.js）内容永不变化 -> 一年强缓存
    // 其余（index.html 等）必须 no-cache，否则发版后用户仍看到旧页面
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  app.get(/^(?!\/(api|uploads|health)).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
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

// 访问分析的两张日志表在启动时自动建。
// sync() 只发 CREATE TABLE IF NOT EXISTS，幂等且完全不碰其他已有的表，
// 所以可以安全地放在启动流程里，免得每次部署还要记着多跑一次 npm run init-db。
// 建完再补一次字段（sync 不会给已存在的表加列），同样是幂等的。
const { VisitSession, VisitEvent, DeviceModelAlias } = require('./models');
const ensureVisitSchema = require('./utils/ensureVisitSchema');
(async () => {
  try {
    await VisitSession.sync();
    await VisitEvent.sync();
    await DeviceModelAlias.sync();
    await ensureVisitSchema();
    console.log('[访问分析] 日志表已就绪');
  } catch (e) {
    console.error('[访问分析] 日志表初始化失败:', e.message);
  }
})();

// 启动服务
const server = app.listen(PORT, () => {
  console.log(`\n=================================`);
  console.log(`  校园二手交易平台后端服务`);
  console.log(`  服务地址: http://localhost:${PORT}`);
  console.log(`  API前缀: /api`);
  console.log(`=================================\n`);
});

// 【重要】Node 默认 keepAliveTimeout 只有 5 秒，而 Cloudflare 复用与源站的
// keep-alive 连接时间更长；CF 复用到源站已关闭的连接，就会出现偶发的
// net::ERR_CONNECTION_CLOSED / 502。把源站空闲超时设到 65 秒（> CF 的 60 秒）即可避免。
// headersTimeout 必须大于 keepAliveTimeout，否则 Node 会告警。
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

module.exports = app;
