const { Op } = require('sequelize');
const { Message, User, Product } = require('../models');
const { success, error, paginate } = require('../utils/response');

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
exports.conversations = async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取与我相关的所有消息
    const messages = await Message.findAll({
      where: {
        [Op.or]: [{ fromUserId: userId }, { toUserId: userId }]
      },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: User, as: 'receiver', attributes: ['id', 'username', 'nickname', 'avatar'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // 提取唯一会话对方
    const convMap = new Map();
    messages.forEach(msg => {
      const otherUser = msg.fromUserId === userId ? msg.receiver : msg.sender;
      const key = otherUser.id;
      if (!convMap.has(key)) {
        const unread = messages.filter(m => m.toUserId === userId && m.fromUserId === otherUser.id && m.isRead === 0).length;
        convMap.set(key, {
          userId: otherUser.id,
          nickname: otherUser.nickname,
          avatar: otherUser.avatar,
          isSystem: otherUser.username === 'system',
          lastMessage: msg.image ? '[图片]' : msg.content,
          lastTime: msg.createdAt,
          unreadCount: unread
        });
      }
    });

    // 系统通知会话置顶
    const list = Array.from(convMap.values());
    list.sort((a, b) => (b.isSystem ? 1 : 0) - (a.isSystem ? 1 : 0));

    res.json(success(list));
  } catch (err) {
    res.status(500).json(error('获取会话列表失败'));
  }
};

// 获取与某用户的聊天记录
exports.chatHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const otherUserId = parseInt(req.params.userId);
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;

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
