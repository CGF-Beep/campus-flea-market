const { Message, User } = require('../models');

// system 账号 ID 缓存。
// system 是初始化时创建的固定账号，ID 不会变，没必要每次发通知都查一次库。
// 原实现每次 sendSystemNotification 都 User.findOne({ username: 'system' })，
// 批量通知 N 个人就产生 N 次冗余查询。
let systemUserIdCache = null;

async function getSystemUserId() {
  if (systemUserIdCache !== null) return systemUserIdCache;
  const sys = await User.findOne({
    where: { username: 'system' },
    attributes: ['id']
  });
  if (!sys) {
    console.warn('系统通知跳过：未找到 system 账号');
    return null;
  }
  systemUserIdCache = Number(sys.id);
  return systemUserIdCache;
}

// 系统通知：以 system 账号身份给用户发站内信
// 前端会把 system 会话识别为「系统通知」并置顶显示
async function sendSystemNotification(toUserId, productId, content) {
  try {
    if (!toUserId || !content) return null;
    const sysId = await getSystemUserId();
    if (!sysId) return null;
    // 不给自己发通知（例如管理员给自己发的商品下架）
    if (sysId === Number(toUserId)) return null;

    return await Message.create({
      fromUserId: sysId,
      toUserId,
      productId: productId || null,
      content
    });
  } catch (e) {
    // 通知失败不阻断主流程
    console.error('系统通知发送失败:', e.message);
    return null;
  }
}

// 批量通知（同一事件通知多个用户，如管理员取消交易需同时通知买卖双方）
// system 账号只查一次（命中缓存），插入并行执行，避免串行 await 拖慢接口响应
async function sendSystemNotificationBatch(userIds, productId, contentBuilder) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (!unique.length) return [];

  const sysId = await getSystemUserId();
  if (!sysId) return [];

  // 提前过滤掉 system 自己，避免无效写入
  const targets = unique.filter((uid) => sysId !== Number(uid));
  if (!targets.length) return [];

  return Promise.all(
    targets.map((uid) => {
      const content = typeof contentBuilder === 'function' ? contentBuilder(uid) : contentBuilder;
      if (!content) return null;
      return Message.create({
        fromUserId: sysId,
        toUserId: uid,
        productId: productId || null,
        content
      }).catch((e) => {
        console.error('系统批量通知发送失败:', e.message);
        return null;
      });
    })
  );
}

module.exports = { sendSystemNotification, sendSystemNotificationBatch };
