/**
 * 访问采集中间件
 *
 * 职责：只负责「把这次请求归属到某个会话」——解析 IP / UA / 设备，
 * 按 30 分钟窗口复用或新建会话，登录用户回填 user_id。
 * **不写事件明细**：一次页面加载会并发七八个接口，逐个记事件只会把明细淹掉，
 * 页面级浏览交给前端埋点上报（POST /api/visit/report）。
 *
 * 性能上的三个关键决定：
 *   1. 不 await。中间件只把 Promise 挂到 req.visitPromise 上就走，不占用请求关键路径；
 *      需要会话信息的埋点接口自己去 await。这样普通接口的延迟增长为零。
 *   2. 进程内缓存 visitorId -> 会话，命中即不再查库；last_active_at 最多 60 秒回写一次，
 *      否则一次页面加载就能触发七八次 UPDATE。
 *   3. 全程 try/catch + catch 吞掉。采集失败绝不能影响任何业务请求 ——
 *      与项目里 notify.js 的原则一致。
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { VisitSession } = require('../models');
const { parseUA } = require('../utils/userAgent');
const {
  dailyVisitorId,
  maskIp,
  encryptIp,
  getClientIp,
  classifySource
} = require('../utils/visitor');
const { lookup } = require('../utils/geoIp');

const SESSION_IDLE_MS = 30 * 60 * 1000; // 30 分钟无活动即视为新会话
const FLUSH_INTERVAL_MS = 60 * 1000;    // 同一会话最多 60 秒回写一次数据库
const CACHE_MAX = 3000;                 // 缓存上限，防内存无界增长

/** visitorId -> { sessionId, uuid, startedAt, lastActiveAt, flushedAt, userId } */
const cache = new Map();
/** 防止同一访客的并发请求重复建会话 */
const inflight = new Map();

let selfHostsCache = null;
function getSelfHosts() {
  if (selfHostsCache) return selfHostsCache;
  const hosts = [];
  (process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((item) => {
      try {
        const h = new URL(item).host.toLowerCase().split(':')[0];
        if (h) hosts.push(h);
      } catch (e) {
        /* CLIENT_URL 里可能有非 URL 的写法，忽略 */
      }
    });
  hosts.push('zeroly.me');
  selfHostsCache = hosts;
  return hosts;
}

/**
 * 尝试解出登录用户 id，但**不强制要求登录**。
 * 注意与 middleware/auth.js 的区别：那里 token 缺失即 401，这里失败只是返回 null。
 */
function readUserId(req) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    return (decoded && decoded.id) || null;
  } catch (e) {
    return null;
  }
}

function shouldSkip(req) {
  // 浏览器预检请求不采集
  if (req.method === 'OPTIONS') return true;
  const p = (req.originalUrl || req.url || '').split('?')[0];
  // 后台自己的每次翻页/筛选都采集的话，看一次报表就把报表刷满，而且全是管理员自己的记录
  if (p.startsWith('/api/admin')) return true;
  if (p === '/api/health') return true;
  return false;
}

function evictExpired(now) {
  for (const [key, val] of cache) {
    if (now - val.lastActiveAt >= SESSION_IDLE_MS) cache.delete(key);
  }
}

/** 后台回写：只更新会变的那几列，失败静默 */
function flushSession(hit, userId) {
  const patch = {
    lastActiveAt: new Date(hit.lastActiveAt),
    duration: Math.max(0, Math.round((hit.lastActiveAt - hit.startedAt) / 1000))
  };
  if (userId) patch.userId = userId;
  VisitSession.update(patch, { where: { id: hit.sessionId } }).catch(() => {});
}

async function createSession(req, visitorId, ip, ua) {
  const uaInfo = parseUA(ua);
  const now = Date.now();
  const { channel, referrerHost } = classifySource({
    referrer: req.headers.referer,
    isWechat: /MicroMessenger/i.test(ua),
    selfHosts: getSelfHosts()
  });

  // 只在建会话时查一次归属地：离线库约 0.1ms，不会给请求增加可感延迟
  const geo = lookup(ip);

  const row = await VisitSession.create({
    sessionUuid: crypto.randomUUID(),
    visitorId,
    startedAt: new Date(now),
    lastActiveAt: new Date(now),
    duration: 0,
    pageviews: 0,
    isBounce: 1,
    sourceChannel: channel,
    referrerHost,
    device: uaInfo.device,
    os: uaInfo.os,
    browser: uaInfo.browser,
    deviceModel: uaInfo.deviceModel || null,
    deviceBrand: uaInfo.deviceBrand || null,
    // 完整 IP 明文（后台直接展示） + 脱敏与密文两列一并保留：
    // 前者兜底，后者留出「将来改回脱敏模式」的回退余地
    ip,
    country: geo ? geo.country || null : null,
    province: geo ? geo.province || null : null,
    city: geo ? geo.city || null : null,
    isp: geo ? geo.isp || null : null,
    ipMasked: maskIp(ip),
    ipEncrypted: encryptIp(ip),
    userId: readUserId(req),
    isBot: uaInfo.isBot
  });

  if (cache.size >= CACHE_MAX) evictExpired(now);

  cache.set(visitorId, {
    sessionId: row.id,
    uuid: row.sessionUuid,
    startedAt: now,
    lastActiveAt: now,
    flushedAt: now,
    userId: row.userId
  });

  return { sessionId: row.id, sessionUuid: row.sessionUuid, visitorId, isNew: true };
}

/**
 * 解析出本次请求所属的会话
 * @returns {Promise<{sessionId:number, sessionUuid:string, visitorId:string, isNew:boolean}|null>}
 */
async function resolveSession(req) {
  const ua = req.headers['user-agent'] || '';
  const ip = getClientIp(req);
  const visitorId = dailyVisitorId(ip, ua);
  const now = Date.now();
  const hit = cache.get(visitorId);

  if (hit && now - hit.lastActiveAt < SESSION_IDLE_MS) {
    hit.lastActiveAt = now;

    // 会话中途登录（或换号）：立刻回写，不等 60 秒节流
    const uid = readUserId(req);
    let force = false;
    if (uid && hit.userId !== uid) {
      hit.userId = uid;
      force = true;
    }

    if (force || now - hit.flushedAt >= FLUSH_INTERVAL_MS) {
      hit.flushedAt = now;
      flushSession(hit, hit.userId);
    }
    return { sessionId: hit.sessionId, sessionUuid: hit.uuid, visitorId, isNew: false };
  }

  // 并发去重：同一访客同时打进来的多个请求只建一个会话
  if (inflight.has(visitorId)) return inflight.get(visitorId);

  const task = createSession(req, visitorId, ip, ua).finally(() => inflight.delete(visitorId));
  inflight.set(visitorId, task);
  return task;
}

module.exports = function visitCollect(req, res, next) {
  try {
    if (shouldSkip(req)) return next();
    // 不 await：解析结果挂在请求上，谁需要谁自己等
    req.visitPromise = resolveSession(req).catch(() => null);
  } catch (e) {
    req.visitPromise = Promise.resolve(null);
  }
  next();
};

module.exports.SESSION_IDLE_MS = SESSION_IDLE_MS;
module.exports.resolveSession = resolveSession;

/**
 * 清空内存缓存。
 * 后台清理掉历史明细后必须调用一次：否则被删会话的访客还挂在缓存里，
 * 要等 30 分钟会话过期才会重新建记录，中间这段时间的访问会丢。
 */
module.exports.clearCache = () => {
  cache.clear();
  inflight.clear();
};
