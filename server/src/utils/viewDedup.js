/**
 * 商品浏览量的访客去重
 *
 * 背景：`product.increment('views')` 本身是原子的（SQL 层 `views = views + 1`），
 * 也不会被卖家自浏览污染，所以没有并发丢更新的问题。
 * 但它对**同一个人的反复刷新**完全没有抵抗力 —— 用户按住 F5 就能把浏览量刷上天，
 * 列表页「X 浏览」这个排序和信任信号就失真了。
 *
 * 做法：进程内 Map 记录「商品 + 访客」的最近计数时间，窗口期内只计一次。
 * 不引入 Redis，够用且零依赖；单进程内存占用可控（见 MAX_ENTRIES 的惰性清理）。
 *
 * 访客标识的取舍：
 *   登录用户 → 用户 ID，精确；
 *   匿名访客 → IP。注意：若部署时没有开启 TRUST_PROXY，所有匿名请求的
 *   req.ip 都会是代理的地址，导致匿名访客被合并成同一个 key、浏览量偏低。
 *   这是刻意选择 —— 宁可少算，也不要被 F5 刷爆。
 */

const WINDOW_MS = 30 * 60 * 1000;   // 同一访客对同一商品，30 分钟内只计一次
const MAX_ENTRIES = 20000;          // Map 容量上限，超出时惰性清理

const seen = new Map();             // 'productId:visitor' -> 最近一次计数时间戳

/** 清理过期条目；若清完仍超上限，按插入顺序丢弃最旧的 */
function sweep(now) {
  for (const [key, at] of seen) {
    if (now - at >= WINDOW_MS) seen.delete(key);
  }
  if (seen.size > MAX_ENTRIES) {
    const excess = seen.size - MAX_ENTRIES;
    let i = 0;
    for (const key of seen.keys()) {
      if (i++ >= excess) break;
      seen.delete(key);
    }
  }
}

/**
 * 该访客本次浏览是否应计入浏览量
 * @param {number|string} productId
 * @param {string} visitor 访客标识（已含类型前缀）
 * @returns {boolean} true 表示应 +1
 */
function shouldCountView(productId, visitor) {
  const key = `${productId}:${visitor}`;
  const now = Date.now();
  const last = seen.get(key);

  if (last !== undefined && now - last < WINDOW_MS) {
    return false;
  }

  seen.set(key, now);
  if (seen.size > MAX_ENTRIES) sweep(now);
  return true;
}

/** 由请求推导访客标识 */
function visitorOf(req) {
  if (req.user && req.user.id) return `u${req.user.id}`;
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  return `a${ip}`;
}

/** 仅用于测试与诊断 */
function stats() {
  return { size: seen.size, windowMs: WINDOW_MS, maxEntries: MAX_ENTRIES };
}

function reset() {
  seen.clear();
}

module.exports = { shouldCountView, visitorOf, stats, reset, WINDOW_MS, MAX_ENTRIES };
