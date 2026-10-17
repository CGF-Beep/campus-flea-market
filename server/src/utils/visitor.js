/**
 * 访客标识与 IP 处理
 *
 * 设计原则（对标 Plausible 的做法，但适配「实名校园平台」的场景）：
 *   1. 原始 IP 不落明文库。访客身份用 hash(密钥 + 日期 + IP + UA) 表示，
 *      日期参与哈希 => 跨天必然不同，无法把同一个人在多天内串起来。
 *   2. 但管理员确实需要能查完整 IP（处理纠纷、封禁刷单），
 *      所以完整 IP 用 AES-256-GCM 加密后单独存一列，只有管理员主动点「查看」时才解密，
 *      并留下查阅留痕。这样「平时不可读」和「必要时可查」两头都占。
 *   3. 盐的保密成分直接取 JWT_SECRET，而不是「每天生成一个随机盐存起来」：
 *      随机盐存在进程内存里，服务一重启当天的 UV 就会被拆成两份；
 *      用 密钥+日期 派生则重启后当天标识依然稳定，跨天自动失效，且无需额外存储。
 */

const crypto = require('crypto');
require('dotenv').config();

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('环境变量 JWT_SECRET 未配置，无法计算访客标识');
  return s;
}

let cachedKey = null;
function getCipherKey() {
  if (!cachedKey) {
    // 与 JWT_SECRET 再掺一个用途字符串做域分离，避免两处密钥直接等价
    cachedKey = crypto.createHash('sha256').update(`${getSecret()}|visit-ip-encryption`).digest();
  }
  return cachedKey;
}

const pad2 = (n) => String(n).padStart(2, '0');

/** 北京时间的日期串 YYYY-MM-DD（不依赖 ICU，手动 +8 小时算） */
function beijingDateKey(date = new Date()) {
  const t = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
}

/**
 * 访客日标识：同一天内同一 (IP, UA) 得到同一个值；换一天必然不同。
 * @returns {string} 32 位 hex
 */
function dailyVisitorId(ip, ua, date = new Date()) {
  return crypto
    .createHash('sha256')
    .update(`${getSecret()}|${beijingDateKey(date)}|${ip || ''}|${ua || ''}`)
    .digest('hex')
    .slice(0, 32);
}

/** 脱敏 IP：IPv4 保留前两段，IPv6 保留前三组 */
function maskIp(ip) {
  if (!ip) return null;
  const v = String(ip).replace(/^::ffff:/i, '');
  if (v.includes('.')) {
    const parts = v.split('.');
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
    return v;
  }
  const seg = v.split(':').filter(Boolean);
  if (seg.length >= 3) return `${seg.slice(0, 3).join(':')}:*`;
  return v;
}

/** 完整 IP 加密存储（AES-256-GCM，格式 base64(iv|tag|ciphertext)） */
function encryptIp(ip) {
  if (!ip) return null;
  try {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getCipherKey(), iv);
    const enc = Buffer.concat([cipher.update(String(ip), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
  } catch (e) {
    return null;
  }
}

/** 解密完整 IP；密钥变更或数据损坏时返回 null，不抛错 */
function decryptIp(payload) {
  if (!payload) return null;
  try {
    const buf = Buffer.from(String(payload), 'base64');
    if (buf.length < 29) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', getCipherKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  } catch (e) {
    return null;
  }
}

/** 是否处于 Cloudflare 代理之后（显式声明，见下方 getClientIp 注释） */
function isCloudflareMode() {
  return process.env.CLOUDFLARE_PROXY === 'true';
}

/**
 * 取客户端 IP。
 *
 * 三级优先：
 *   1. .env 显式开启 CLOUDFLARE_PROXY=true 时，用 `CF-Connecting-IP`。
 *      域名挂 Cloudflare 代理（橙云）后，回源请求的 TCP 来源是 CF 的边缘节点，
 *      req.ip / remoteAddress 拿到的都是 CF 机房地址（172.64.* / 162.158.* 等），
 *      归属地会变成旧金山、法兰克福这些 CF 机房位置。
 *      CF 一定会带 `CF-Connecting-IP`，而且它只有一个值，没有 X-Forwarded-For
 *      那种链式推导的歧义，比调 trust proxy 跳数可靠得多。
 *
 *   2. TRUST_PROXY=true 时，Express 会把 req.ip 还原成 X-Forwarded-For 里的真实地址。
 *
 *   3. 兜底：直连地址。
 *
 * 为什么第 1 步做成显式开关，而不是「自动检测到 CF 就用」：
 * `CF-Connecting-IP` 只是一个普通请求头，谁都能伪造。只有当运维明确声明
 * 「我的源站只在 Cloudflare 后面」时才信任它；一旦将来撤掉 CF 改成直连，
 * 这个开关必须跟着关掉，否则伪造该头就能污染访问日志。
 */
function getClientIp(req) {
  if (isCloudflareMode()) {
    const cf = req.headers && req.headers['cf-connecting-ip'];
    if (cf) return String(cf).trim();
    // CF 模式下仍可能有直连请求（健康检查、本机调试），继续往下走
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}

const SEARCH_HOST_RE = /(^|\.)(baidu|sogou|so|bing|google|yandex|duckduckgo|haosou|sm)\./i;
const WECHAT_HOST_RE = /(^|\.)(weixin|wechat|qq)\./i;

/**
 * 来源渠道归类
 * @param {object} opts
 * @param {string} [opts.referrer] 前端上报的 document.referrer
 * @param {string} [opts.utmSource] URL 上的 utm_source
 * @param {boolean} [opts.isWechat] 是否在微信内置浏览器中打开
 * @param {string[]} [opts.selfHosts] 本站域名列表，用于识别站内跳转
 * @returns {{channel:string, referrerHost:string|null}}
 */
function classifySource({ referrer, utmSource, isWechat, selfHosts = [] } = {}) {
  let host = '';
  if (referrer) {
    try {
      host = String(new URL(referrer).host).toLowerCase().split(':')[0];
    } catch (e) {
      host = '';
    }
  }

  let channel;
  if (utmSource) {
    channel = '推广链接';
  } else if (!host) {
    // 微信内打开时 referrer 常被抹掉，只能靠 UA 判断是不是从微信进来的
    channel = isWechat ? '微信内打开' : '直接访问';
  } else if (selfHosts.some((h) => h && (host === h || host.endsWith(`.${h}`)))) {
    channel = '站内跳转';
  } else if (WECHAT_HOST_RE.test(host)) {
    channel = '微信';
  } else if (SEARCH_HOST_RE.test(host)) {
    channel = '搜索引擎';
  } else {
    channel = '外链';
  }

  return { channel, referrerHost: host || null };
}

module.exports = {
  beijingDateKey,
  dailyVisitorId,
  maskIp,
  encryptIp,
  decryptIp,
  getClientIp,
  classifySource
};
