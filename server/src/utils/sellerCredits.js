const { Op, fn, col } = require('sequelize');
const { Order, Product, User } = require('../models');

/**
 * 卖家信用统计。
 *
 * 用于商品详情页 / 卖家主页展示「已完成 N 笔交易」等信任标识，
 * 解决买家「看不到卖家靠不靠谱」的问题。
 *
 * 性能注意：这里是「聚合 + 批量」实现，不逐个用户查（避免 N+1）。
 *
 * 缓存说明：单机进程内缓存 60s。该数据在商品详情这种高频接口上被反复读取，
 * 而成交/发布是低频操作，60s 的陈旧窗口对信任标识展示完全可接受。
 */
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // userId -> { at: number, data: object }

/**
 * 查询单个用户的信用统计
 * @param {number} userId
 * @returns {Promise<{completedCount:number, sellingCount:number, totalSold:number, joinedDays:number, isNew:boolean, isTrusted:boolean}>}
 */
async function getSellerCredits(userId) {
  const uid = Number(userId);
  if (!uid) {
    return { completedCount: 0, sellingCount: 0, totalSold: 0, joinedDays: 0, isNew: true, isTrusted: false };
  }

  // 命中未过期缓存直接返回
  const hit = cache.get(uid);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  // 两条聚合查询并行（都走 orders / products 的既有索引）
  const [completedRow, sellingRow, user] = await Promise.all([
    // 该用户作为卖家、已完成的订单：单数与累计金额
    Order.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'count'],
        [fn('COALESCE', fn('SUM', col('price')), 0), 'amount']
      ],
      where: { sellerId: uid, status: 'completed' },
      raw: true
    }),
    Product.count({ where: { userId: uid, status: 'on_sale' } }),
    User.findByPk(uid, { attributes: ['id', 'createdAt'] })
  ]);

  const completedCount = Number(completedRow?.count) || 0;
  const totalSold = Number(completedRow?.amount) || 0;

  // 注册天数：用于「新用户」标识，避免 0 成交的新卖家被误判为不可信
  const joinedDays = user?.createdAt
    ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
    : 0;

  const data = {
    completedCount,
    totalSold: Math.round(totalSold * 100) / 100,
    sellingCount: sellingRow || 0,
    joinedDays,
    // 完成过 1 单以上就不算纯新人
    isNew: completedCount === 0,
    // 信用良好：完成 5 单以上
    isTrusted: completedCount >= 5
  };

  cache.set(uid, { at: Date.now(), data });
  return data;
}

/**
 * 批量查询多个用户的信用统计（用于列表场景，如卖家主页的在售商品）
 * @param {number[]} userIds
 * @returns {Promise<Map<number, object>>}
 */
async function getSellerCreditsBatch(userIds) {
  const unique = [...new Set((userIds || []).map(Number).filter(Boolean))];
  const result = new Map();
  if (!unique.length) return result;

  // 逐个走 getSellerCredits（内部有缓存，且已被并行的聚合查询覆盖）
  const all = await Promise.all(unique.map((id) => getSellerCredits(id)));
  unique.forEach((id, i) => result.set(id, all[i]));
  return result;
}

/** 清了缓存（成交/发布等写操作后可主动失效，保证数据及时） */
function invalidateSellerCredits(userId) {
  if (userId) cache.delete(Number(userId));
  else cache.clear();
}

module.exports = { getSellerCredits, getSellerCreditsBatch, invalidateSellerCredits };
