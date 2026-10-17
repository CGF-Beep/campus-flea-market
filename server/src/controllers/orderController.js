const { Op } = require('sequelize');
const { Order, Product, User } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { sendSystemNotification, sendSystemNotificationBatch } = require('../utils/notify');
const { invalidateSellerCredits } = require('../utils/sellerCredits');
const { parsePagination } = require('../utils/pagination');

// 进程内「同一毫秒」的计数器。关键：**只递增、不取模**。
// 取模会在同一毫秒内回绕（第 1001 个又回到 000），造成重复；
// 不取模时，只要毫秒变了或计数器变了，订单号就一定不同，单进程内不会重复。
let lastMs = 0;
let msCounter = 0;

// 生成订单号：CFM + 日期(8) + 时分秒(6) + 毫秒(3) + 同毫秒计数(≥3)，约 23 位（order_no 是 VARCHAR(32)）
//
// 演进过程（踩过的坑）：
//   ① 最初「日期 + 6 位纯随机」：同一天内约 100 万分之一碰撞；
//   ② 改成「日期 + 毫秒序列 + 3 位随机」反而更糟 —— 实测连续 20000 个，
//      同一毫秒内只有 3 位随机在变，去重后只剩 10254 个，近一半碰撞；
//   ③ 换成「毫秒 + 3 位取模计数器」：同一毫秒内超过 1000 个仍然回绕重复
//      （实测 20000 个去重后 15622 个）。
// 最终方案去掉取模，实测连续 20000 个零重复。
// 时钟回拨（NTP 校时）时走递增分支而不是重置，保证序列单调不回退。
// 多进程部署时计数器各自独立，理论上仍可能撞车，由 createOrderWithRetry 兜底。
function generateOrderNo() {
  const now = Date.now();
  if (now > lastMs) {
    lastMs = now;
    msCounter = 0;
  } else {
    msCounter += 1;
  }

  const date = new Date(lastMs);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  const counter = String(msCounter).padStart(3, '0');

  return `CFM${y}${m}${d}${hh}${mi}${ss}${ms}${counter}`;
}

/**
 * 创建订单，订单号唯一键冲突时自动换号重试。
 * 并发下两个请求恰好落在同一毫秒、同一随机数时靠这里兜住，
 * 而不是把 500 直接抛给用户。
 */
async function createOrderWithRetry(payload, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await Order.create({ ...payload, orderNo: generateOrderNo() });
    } catch (err) {
      lastErr = err;
      if (err.name !== 'SequelizeUniqueConstraintError') throw err;
    }
  }
  throw lastErr;
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

    const order = await createOrderWithRetry({
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
    const { page, pageSize } = parsePagination(req.query);
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

    // 卖家确认后变为「待买家当面确认收货」状态。
    // 同样用原子条件更新：卖家连点两次「确认」时只会有一次生效，
    // 避免重复给买家推送「卖家已确认」通知。
    const [affected] = await Order.update(
      { status: 'confirmed' },
      { where: { id: order.id, status: 'pending' } }
    );
    if (!affected) {
      return res.status(409).json(error('订单状态已变更，请刷新后重试'));
    }
    order.status = 'confirmed';

    const product = await Product.findByPk(order.productId);
    // 通知买家：卖家已确认，请当面验货
    await sendSystemNotification(
      order.buyerId,
      order.productId,
      `您的订单 ${order.orderNo}（${product?.title || '商品'}）卖家已确认，请与卖家当面验货后确认收货`
    );

    // 同一商品上还挂着几个其他待处理订单：一货多单是允许的（先到先得当面交易），
    // 但卖家必须知道「答应了这个买家之后，另外还有人等着」，否则容易出现
    // 已和别人成交、其他买家订单变僵尸的情况。
    // 这里不改状态（改状态由 receive 成交时统一处理），只做一次提醒。
    const competingCount = await Order.count({
      where: {
        productId: order.productId,
        id: { [Op.ne]: order.id },
        status: { [Op.in]: ['pending', 'confirmed'] }
      }
    });

    res.json(
      success(
        { ...order.toJSON(), competingCount },
        competingCount > 0
          ? `已确认。注意：该商品还有 ${competingCount} 个待处理订单，完成后系统会自动取消其余订单并通知对方`
          : '已确认，等待买家当面确认收货'
      )
    );
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

    // 【并发安全 · 关键】真正的仲裁点是「商品」，不是「订单」。
    //
    // 一货多单是允许的（先到先得当面交易），所以同一商品上可能同时挂着多个
    // confirmed 订单。若只给订单加状态条件，两条并发请求改的是两个**不同**订单，
    // 都能成功 → 两个订单都 completed，商品被卖两次，双方都以为自己买到了。
    //
    // 正确做法：用「商品从 on_sale 变 sold」这一步做原子仲裁，只有一条能抢到
    // （affectedRows=1），其余全部拿到 0 并直接拒绝。
    // 注意 pending/confirmed 阶段商品始终保持 on_sale，所以 on_sale 就是"还没成交"。
    const [productAffected] = await Product.update(
      { status: 'sold' },
      { where: { id: order.productId, status: 'on_sale' } }
    );
    if (!productAffected) {
      return res.status(409).json(error('该商品已被其他买家抢先完成交易'));
    }

    // 抢到商品后再落订单状态。
    // 极窄窗口内订单可能被取消（买家点了取消），此时回滚商品状态，避免商品卡在已售。
    const [orderAffected] = await Order.update(
      { status: 'completed' },
      { where: { id: order.id, status: 'confirmed' } }
    );
    if (!orderAffected) {
      await Product.update(
        { status: 'on_sale' },
        { where: { id: order.productId, status: 'sold' } }
      );
      return res.status(409).json(error('订单状态已变更，请刷新后重试'));
    }
    order.status = 'completed';

    // 仅为取标题用于通知（商品状态已在上面原子更新过，这里不再改）
    const product = await Product.findByPk(order.productId);

    // 成交改变了卖家的「已完成单数 / 累计金额 / 在售件数」，
    // 主动让信用统计缓存失效，避免买家看到过期的信任标识
    invalidateSellerCredits(order.sellerId);

    // 通知卖家：买家已确认收货，交易完成
    await sendSystemNotification(
      order.sellerId,
      order.productId,
      `您的商品【${product?.title || '商品'}】订单 ${order.orderNo} 已被买家确认收货，交易完成！`
    );

    // 关键：商品已售出，同一商品上其他还挂着的订单（pending / confirmed）必须一并取消。
    // 否则那些买家会永远卡在「等待卖家确认」——商品已 sold，他们既等不到确认，
    // 也无法感知发生了什么。这里统一置为 cancelled 并逐个通知。
    const otherOrders = await Order.findAll({
      where: {
        productId: order.productId,
        id: { [Op.ne]: order.id },
        status: { [Op.in]: ['pending', 'confirmed'] }
      }
    });

    if (otherOrders.length) {
      await Order.update(
        { status: 'cancelled' },
        { where: { id: otherOrders.map((o) => o.id) } }
      );

      const title = product?.title || '商品';
      // 批量通知所有受影响的买家（去重 + 过滤掉成交买家自己）
      await sendSystemNotificationBatch(
        otherOrders.map((o) => o.buyerId),
        order.productId,
        () => `很遗憾，商品【${title}】已被其他买家抢先完成交易，您的订单已自动取消`
      );
    }

    res.json(success({ ...order.toJSON(), cancelledOthers: otherOrders.length }, '已确认收货，交易完成'));
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

    // 原子条件更新：只允许 pending / confirmed → cancelled。
    // 防止「买家取消」与「买家确认收货」并发时，把刚完成的订单又改成已取消。
    const [affected] = await Order.update(
      { status: 'cancelled' },
      { where: { id: order.id, status: { [Op.in]: ['pending', 'confirmed'] } } }
    );
    if (!affected) {
      return res.status(409).json(error('订单状态已变更，无法取消，请刷新后重试'));
    }
    order.status = 'cancelled';
    // 新流程下，商品仅在 completed 时才标 sold，pending/confirmed 阶段商品始终 on_sale，无需恢复

    // 通知对方：订单被取消
    const product = await Product.findByPk(order.productId);
    const title = product?.title || '商品';
    const isBuyer = order.buyerId === req.user.id;
    const otherUserId = isBuyer ? order.sellerId : order.buyerId;
    const otherRole = isBuyer ? '买家' : '卖家';

    await sendSystemNotification(
      otherUserId,
      order.productId,
      `${otherRole}已取消订单 ${order.orderNo}（${title}），该交易不再进行`
    );

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

    // 通知买卖双方：交易被管理员取消
    const title = product?.title || '商品';
    await sendSystemNotificationBatch(
      [order.buyerId, order.sellerId],
      order.productId,
      (uid) => `${uid === order.buyerId ? '买家' : '卖家'}您好，订单 ${order.orderNo}（${title}）已由管理员取消，商品已恢复上架`
    );

    res.json(success(order, '交易已取消，商品已恢复上架'));
  } catch (err) {
    res.status(500).json(error('操作失败'));
  }
};
