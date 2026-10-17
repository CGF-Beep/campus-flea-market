const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { Message, User, Product } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// 发送消息（支持文字/图片，图片为已上传的URL）
exports.send = async (req, res) => {
  try {
    const { toUserId, productId, content, image } = req.body;
    if (!toUserId || (!content && !image)) {
      return res.status(400).json(error('接收者和消息内容不能为空'));
    }
    if (toUserId === req.user.id) {
      return res.status(400).json(error('不能给自己发消息'));
    }

    const message = await Message.create({
      fromUserId: req.user.id,
      toUserId,
      productId: productId || null,
      content: content || '',
      image: image || null
    });

    res.json(success(message, '发送成功'));
  } catch (err) {
    res.status(500).json(error('发送失败'));
  }
};

// 获取会话列表
//
// 原实现：把「与我相关的所有消息」一次性 findAll 出来（无 limit），再在 JS 里
//   Map 分组，且每个会话内层又 filter 一遍全量消息统计未读 —— 复杂度 O(n²)，
//   用户聊得越久越慢，且每次都要把所有消息（含 TEXT content）搬进内存。
//
// 现实现：直接用 SQL 聚合出「每个会话对方 ID + 最后一条消息 + 未读数」，
//   再补一次用户信息查询。数据量从 O(消息总数) 降到 O(会话数)。
exports.conversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) 每个会话的聚合：对方 ID、最后一条消息时间、未读条数
    //   对方 ID 用 CASE 推导：消息是我发的 → 对方是收件人，否则是发件人。
    //   走 idx_messages_pair_created 索引，GROUP BY 在数据库侧完成。
    //
    //   注意 other_user_id IS NOT NULL：历史脏数据里存在 to_user_id 为 NULL 的
    //   系统通知（早期测试调用时漏传收件人）。这类消息无法归属到任何会话，
    //   原实现在此处会因 otherUser 为 null 而抛 TypeError 导致接口 500，
    //   这里直接用 WHERE 过滤掉，从根上避免脏数据污染会话列表。
    const [rows] = await sequelize.query(
      `
      SELECT
        CASE WHEN from_user_id = :userId THEN to_user_id ELSE from_user_id END AS other_user_id,
        MAX(created_at) AS last_time,
        SUM(CASE WHEN to_user_id = :userId AND is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
        COUNT(*) AS total_count
      FROM messages
      WHERE (from_user_id = :userId OR to_user_id = :userId)
        AND from_user_id IS NOT NULL
        AND to_user_id IS NOT NULL
      GROUP BY other_user_id
      ORDER BY last_time DESC, other_user_id DESC
      `,
      { replacements: { userId } }
    );

    if (!rows.length) {
      return res.json(success([]));
    }

    const otherIds = rows.map((r) => Number(r.other_user_id));

    // 2) 一次性取回所有会话对方的用户信息（替代原来的 include 两条 User 关联）
    const users = await User.findAll({
      where: { id: { [Op.in]: otherIds } },
      attributes: ['id', 'username', 'nickname', 'avatar']
    });
    const userMap = new Map(users.map((u) => [Number(u.id), u]));

    // 3) 取每个会话「最后一条消息」的正文与图片。
    //    按 (对方, 时间) 精确回查，批量用 OR 条件一次搞定，避免每个会话单独查一次。
    //    同一毫秒多条消息的极端情况取 id 最大的那条即可。
    const lastMessages = await Message.findAll({
      attributes: ['id', 'fromUserId', 'toUserId', 'content', 'image', 'createdAt'],
      where: {
        [Op.or]: rows.map((r) => ({
          createdAt: new Date(r.last_time),
          [Op.or]: [
            { fromUserId: userId, toUserId: Number(r.other_user_id) },
            { fromUserId: Number(r.other_user_id), toUserId: userId }
          ]
        }))
      },
      order: [['id', 'DESC']]
    });

    // 每个会话只保留 id 最大（即最后一条）的消息
    const lastMsgMap = new Map();
    for (const m of lastMessages) {
      const otherId = Number(m.fromUserId) === Number(userId)
        ? Number(m.toUserId)
        : Number(m.fromUserId);
      if (!lastMsgMap.has(otherId)) lastMsgMap.set(otherId, m);
    }

    // 4) 组装：字段与改造前完全一致，前端无需改动。
    //    双保险：即使 SQL 层过滤后仍出现对方用户已注销（userMap 查不到）的情况，
    //    也不会抛错，只是该会话显示为「未知用户」。
    const list = rows
      .filter((r) => r.other_user_id !== null && r.other_user_id !== undefined)
      .map((r) => {
        const otherId = Number(r.other_user_id);
        const otherUser = userMap.get(otherId);
        const lastMsg = lastMsgMap.get(otherId);

        return {
          userId: otherId,
          nickname: otherUser?.nickname || '未知用户',
          avatar: otherUser?.avatar || null,
          isSystem: otherUser?.username === 'system',
          lastMessage: lastMsg ? (lastMsg.image ? '[图片]' : lastMsg.content) : '',
          lastTime: r.last_time,
          unreadCount: Number(r.unread_count) || 0
        };
      });

    // 5) 排序：系统通知置顶，其余按最后一条消息时间倒序（与原实现一致）
    // 原实现依赖 findAll 的 ORDER BY createdAt DESC 让 Map 自然有序；
    // 改成聚合后必须显式排序，否则会话顺序会随 GROUP BY 返回顺序漂移。
    // 注意：MySQL DATETIME 为秒精度，两个会话最后消息同秒时 lastTime 并列，
    // 必须用 userId 作为次级键兜底，否则列表顺序不稳定（刷新一次换个位）。
    list.sort((a, b) => {
      const sysDiff = (b.isSystem ? 1 : 0) - (a.isSystem ? 1 : 0);
      if (sysDiff !== 0) return sysDiff;
      const timeDiff = new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.userId - a.userId;
    });

    res.json(success(list));
  } catch (err) {
    console.error('获取会话列表失败:', err);
    res.status(500).json(error('获取会话列表失败'));
  }
};

// 获取与某用户的聊天记录
exports.chatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.userId);
    const { page, pageSize } = parsePagination(req.query, { defaultPageSize: 50 });

    const result = await Message.findAndCountAll({
      where: {
        [Op.or]: [
          { fromUserId: userId, toUserId: otherUserId },
          { fromUserId: otherUserId, toUserId: userId }
        ]
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: User, as: 'receiver', attributes: ['id', 'nickname', 'avatar'] }
      ],
      order: [['createdAt', 'ASC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    });

    // 标记为已读
    await Message.update(
      { isRead: 1 },
      { where: { fromUserId: otherUserId, toUserId: userId, isRead: 0 } }
    );

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取聊天记录失败'));
  }
};

// 获取未读消息数
exports.unreadCount = async (req, res) => {
  try {
    const count = await Message.count({
      where: { toUserId: req.user.id, isRead: 0 }
    });
    res.json(success({ count }));
  } catch (err) {
    res.status(500).json(error('获取未读数失败'));
  }
};
