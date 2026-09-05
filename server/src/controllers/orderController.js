const { Op } = require('sequelize');
const { Order, Product, User, Message } = require('../models');
const { success, error, paginate } = require('../utils/response');

// 发送系统通知（以系统账号身份给用户发站内信）
async function sendSystemNotification(toUserId, productId, content) {
  try {
    const sys = await User.findOne({ where: { username: 'system' } });
    if (!sys || !toUserId) return;
    await Message.create({
      fromUserId: sys.id,
      toUserId,
      productId: productId || null,
      content
    });
  } catch (e) {
    console.error('系统通知发送失败:', e.message);
  }
}

// 生成订单号
function generateOrderNo() {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `CFM${y}${m}${d}${random}`;
}

// 创建订单（购买商品）
exports.create = async (req, res) => {
  try {
    const { productId, remark } = req.body;
    const buyerId = req.user.id;

    const product = await Product.findByPk(productId, {
      include: [{ model: User, as: 'user' }]
    });
    if (!product) return res.status(404).json(error('商品不存在'));
    if (product.status !== 'on_sale') return res.status(400).json(error('商品已下架或已售'));
    if (product.userId === buyerId) return res.status(400).json(error('不能购买自己的商品'));

    // 检查是否已有待确认/已确认的订单
    const existingOrder = await Order.findOne({
      where: { productId, buyerId, status: { [Op.in]: ['pending', 'confirmed'] } }
    });
    if (existingOrder) return res.status(400).json(error('您已有该商品的待处理订单'));

    const order = await Order.create({
      orderNo: generateOrderNo(),
      productId,
      buyerId,
      sellerId: product.userId,
      price: product.price,
      remark,
      status: 'pending'
    });

    // 系统通知卖家：有新的待确认订单
    await sendSystemNotification(
      product.userId,
      productId,
      `【${product.title}】有新的买家下单，订单号 ${order.orderNo}，请尽快确认订单`
    );

    res.json(success(order, '下单成功，请等待卖家确认'));
  } catch (err) {
    res.status(500).json(error('下单失败'));
  }
};

// 获取我的订单（作为买家或卖家）
exports.myOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const role = req.query.role || 'buyer';
    const status = req.query.status;

    let where = {};
    if (role === 'buyer') {
      where.buyerId = req.user.id;
    } else {
      where.sellerId = req.user.id;
    }
    if (status) where.status = status;

    const result = await Order.findAndCountAll({
      where,
      include: [
        { model: Product, as: 'product', attributes: ['id', 'title', 'images', 'price', 'condition'] },
        { model: User, as: 'buyer', attributes: ['id', 'username', 'nickname', 'avatar', 'phone'] },
        { model: User, as: 'seller', attributes: ['id', 'username', 'nickname', 'avatar', 'phone'] }
      ],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    });

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取订单失败'));
  }
};

// 卖家确认订单（买家下单后，卖家确认 → 等待买家当面验货并确认收货）
exports.confirm = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json(error('订单不存在'));
    if (order.sellerId !== req.user.id) return res.status(403).json(error('无权操作'));
    if (order.status !== 'pending') return res.status(400).json(error('订单状态不允许此操作'));

    // 卖家确认后变为「待买家当面确认收货」状态
    await order.update({ status: 'confirmed' });

    const product = await Product.findByPk(order.productId);
    // 通知买家：卖家已确认，请当面验货
    await sendSystemNotification(
      order.buyerId,
      order.productId,
      `您的订单 ${order.orderNo}（${product?.title || '商品'}）卖家已确认，请与卖家当面验货后确认收货`
    );

    res.json(success(order, '已确认，等待买家当面确认收货'));
  } catch (err) {
    res.status(500).json(error('操作失败'));
  }
};

// 买家当面确认收货（卖家已确认 → 买家验货后确认 → 交易完成，商品标记为已售）
exports.receive = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json(error('订单不存在'));
    if (order.buyerId !== req.user.id) return res.status(403).json(error('无权操作'));
    if (order.status !== 'confirmed') return res.status(400).json(error('请等待卖家先确认订单'));

    await order.update({ status: 'completed' });
    // 商品标记为已售
    const product = await Product.findByPk(order.productId);
    if (product) await product.update({ status: 'sold' });

    // 通知卖家：买家已确认收货，交易完成
    await sendSystemNotification(
      order.sellerId,
      order.productId,
      `您的商品【${product?.title || '商品'}】订单 ${order.orderNo} 已被买家确认收货，交易完成！`
    );

    res.json(success(order, '已确认收货，交易完成'));
  } catch (err) {
    res.status(500).json(error('操作失败'));
  }
};

// 取消订单（买家或卖家在 pending / confirmed 阶段都可取消）
exports.cancel = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json(error('订单不存在'));
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
      return res.status(403).json(error('无权操作'));
    }
    if (order.status === 'completed') return res.status(400).json(error('已完成的订单不可取消'));
    if (order.status === 'cancelled') return res.status(400).json(error('订单已取消'));

    await order.update({ status: 'cancelled' });
    // 新流程下，商品仅在 completed 时才标 sold，pending/confirmed 阶段商品始终 on_sale，无需恢复
    res.json(success(order, '订单已取消'));
  } catch (err) {
    res.status(500).json(error('操作失败'));
  }
};

// 获取订单详情
exports.detail = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'product' },
        { model: User, as: 'buyer', attributes: ['id', 'username', 'nickname', 'avatar', 'phone'] },
        { model: User, as: 'seller', attributes: ['id', 'username', 'nickname', 'avatar', 'phone'] }
      ]
    });
    if (!order) return res.status(404).json(error('订单不存在'));
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json(error('无权查看'));
    }
    res.json(success(order));
  } catch (err) {
    res.status(500).json(error('获取订单失败'));
  }
};

// 删除订单记录（仅买家或卖家本人，仅清理记录不影响商品状态）
exports.remove = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json(error('订单不存在'));
    if (order.buyerId !== req.user.id && order.sellerId !== req.user.id) {
      return res.status(403).json(error('无权操作'));
    }

    await order.destroy();
    res.json(success(null, '订单记录已删除'));
  } catch (err) {
    res.status(500).json(error('删除订单失败'));
  }
};

// 管理员取消交易（将订单标记为取消，商品恢复上架）
exports.adminCancel = async (req, res) => {
  try {
    const order = await Order.findByPk(req.params.id);
    if (!order) return res.status(404).json(error('订单不存在'));
    if (order.status === 'cancelled') return res.status(400).json(error('订单已取消'));

    await order.update({ status: 'cancelled' });

    // 无条件将商品恢复为上架状态
    const product = await Product.findByPk(order.productId);
    if (product && product.status !== 'removed' && product.status !== 'rejected') {
      await product.update({ status: 'on_sale' });
    }

    res.json(success(order, '交易已取消，商品已恢复上架'));
  } catch (err) {
    res.status(500).json(error('操作失败'));
  }
};
