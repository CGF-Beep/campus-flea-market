const { Op, fn, col } = require('sequelize');
const { User, Product, Order, Category } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { sendSystemNotification } = require('../utils/notify');
const { parsePagination } = require('../utils/pagination');

// 后台首页统计数据
exports.dashboard = async (req, res) => {
  try {
    const userCount = await User.count();
    const productCount = await Product.count();
    const pendingProducts = await Product.count({ where: { status: 'pending' } });
    const orderCount = await Order.count();
    const pendingOrders = await Order.count({ where: { status: 'pending' } });
    const completedOrders = await Order.count({ where: { status: 'completed' } });
    const totalSales = await Order.sum('price', { where: { status: 'completed' } }) || 0;

    // 各分类商品数量
    // 原实现是「遍历分类逐个 count」，8 个分类 = 8 次独立 SQL 往返（N+1）；
    // 改为一次 GROUP BY 聚合，再用分类表结果左连接补齐「数量为 0」的分类
    const categories = await Category.findAll({ attributes: ['id', 'name'] });
    const categoryRows = await Product.findAll({
      attributes: ['categoryId', [fn('COUNT', col('id')), 'count']],
      where: { status: 'on_sale' },
      group: ['categoryId'],
      raw: true
    });
    const categoryCountMap = new Map(
      categoryRows.map((r) => [Number(r.categoryId), Number(r.count)])
    );
    const categoryStats = categories.map((cat) => ({
      name: cat.name,
      count: categoryCountMap.get(Number(cat.id)) || 0
    }));

    // 最近7天注册用户数
    // 同样由「7 次循环 count」改为一次 GROUP BY DATE(created_at)；
    // 聚合结果只包含有注册的日期，必须按 7 天骨架补齐缺失日期（否则前端折线会断档）
    const dayStart = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };
    const sevenDaysAgo = dayStart(6);

    const userRows = await User.findAll({
      attributes: [[fn('DATE', col('created_at')), 'date'], [fn('COUNT', col('id')), 'count']],
      where: { createdAt: { [Op.gte]: sevenDaysAgo } },
      group: [fn('DATE', col('created_at'))],
      raw: true
    });
    // MySQL DATE() 返回 'YYYY-MM-DD'，用同样的 key 格式建立索引
    const toKey = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const userCountMap = new Map(
      userRows.map((r) => [String(r.date), Number(r.count)])
    );
    const recentUsers = [];
    for (let i = 6; i >= 0; i--) {
      const dStart = dayStart(i);
      recentUsers.push({
        date: `${dStart.getMonth() + 1}/${dStart.getDate()}`,
        count: userCountMap.get(toKey(dStart)) || 0
      });
    }

    // 趋势：全部指标统一口径 = 近7天增量 / 7天前存量（不设100%上下限；7天前为0时返回0，前端不显示徽章）
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const growthPercent = (cur, prev) => (prev > 0 ? (cur / prev) * 100 : 0);

    // 注册用户：近7天新增注册数 / 7天前总用户数
    const [curUsers, prevUsers] = await Promise.all([
      User.count({ where: { createdAt: { [Op.gte]: weekStart } } }),
      User.count({ where: { createdAt: { [Op.lt]: weekStart } } })
    ]);
    // 商品：近7天新增发布 / 7天前商品总数
    const [curProducts, prevProducts] = await Promise.all([
      Product.count({ where: { createdAt: { [Op.gte]: weekStart } } }),
      Product.count({ where: { createdAt: { [Op.lt]: weekStart } } })
    ]);
    // 订单：近7天新增订单 / 7天前订单总数
    const [curOrders, prevOrders] = await Promise.all([
      Order.count({ where: { createdAt: { [Op.gte]: weekStart } } }),
      Order.count({ where: { createdAt: { [Op.lt]: weekStart } } })
    ]);
    const [curSales, prevSales] = await Promise.all([
      Order.sum('price', { where: { status: 'completed', createdAt: { [Op.gte]: weekStart } } }) || 0,
      Order.sum('price', { where: { status: 'completed', createdAt: { [Op.lt]: weekStart } } }) || 0
    ]);

    const trends = {
      users: growthPercent(curUsers, prevUsers),
      products: growthPercent(curProducts, prevProducts),
      orders: growthPercent(curOrders, prevOrders),
      sales: growthPercent(curSales, prevSales)
    };

    res.json(success({
      userCount,
      productCount,
      pendingProducts,
      orderCount,
      pendingOrders,
      completedOrders,
      totalSales: parseFloat(totalSales),
      categoryStats,
      recentUsers,
      trends
    }));
  } catch (err) {
    res.status(500).json(error('获取统计数据失败'));
  }
};

// 用户管理 - 列表
exports.userList = async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const keyword = req.query.keyword || '';

    let where = {};
    if (keyword) {
      where[Op.or] = [
        { username: { [Op.like]: `%${keyword}%` } },
        { nickname: { [Op.like]: `%${keyword}%` } },
        { studentId: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const result = await User.findAndCountAll({
      where,
      order: [['id', 'ASC']],
      offset: (page - 1) * pageSize,
      limit: pageSize
    });

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取用户列表失败'));
  }
};

// 用户管理 - 修改状态
exports.updateUserStatus = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json(error('用户不存在'));

    const { status } = req.body;
    await user.update({ status });

    // 仅在被禁用时通知用户本人（启用无需打扰）
    if (Number(status) === 0) {
      await sendSystemNotification(
        user.id,
        null,
        '您的账号已被管理员禁用，暂时无法发布商品和下单。如有疑问请联系管理员'
      );
    }

    res.json(success(user, status === 1 ? '已启用' : '已禁用'));
  } catch (err) {
    res.status(500).json(error('操作失败'));
  }
};

// 商品管理 - 全部列表
exports.productList = async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const status = req.query.status;
    const keyword = req.query.keyword || '';

    let where = {};
    if (status) where.status = status;
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } }
      ];
    }

    const result = await Product.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'nickname', 'avatar'] },
        { model: Category, as: 'category', attributes: ['id', 'name'] }
      ],
      order: [['id', 'ASC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    });

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取商品列表失败'));
  }
};

// 订单管理 - 全部列表
exports.orderList = async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const status = req.query.status;
    const keyword = (req.query.keyword || '').trim();

    let where = {};
    if (status) where.status = status;

    // 关键词：订单号 / 商品标题 / 买家昵称 / 卖家昵称
    // 商品与用户都是 belongsTo（1:1），JOIN 不会造成行膨胀，
    // 所以命中关键词时可以安全关掉子查询，让跨表条件直接参与过滤
    // （不关的话 $product.title$ 进不了分页子查询，会报 Unknown column）
    if (keyword) {
      where[Op.or] = [
        { orderNo: { [Op.like]: `%${keyword}%` } },
        { '$product.title$': { [Op.like]: `%${keyword}%` } },
        { '$buyer.nickname$': { [Op.like]: `%${keyword}%` } },
        { '$seller.nickname$': { [Op.like]: `%${keyword}%` } }
      ];
    }

    // ⚠️ 这里绝对不要传 subQuery。
    // Sequelize 在本场景的默认值就是 false（全是 belongsTo，无 hasMany，
    // 见 sequelize/lib/model.js 的 options.subQuery === void 0 分支），
    // 跨表条件 $product.title$ 因此能直接参与过滤。
    // 曾误写成 `subQuery: keyword ? false : true` —— 没关键词时强传 true，
    // SQL 结构整个变样，接口直接 500。
    const result = await Order.findAndCountAll({
      where,
      include: [
        { model: Product, as: 'product', attributes: ['id', 'title', 'images'] },
        { model: User, as: 'buyer', attributes: ['id', 'nickname', 'avatar'] },
        { model: User, as: 'seller', attributes: ['id', 'nickname', 'avatar'] }
      ],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    });

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取订单列表失败'));
  }
};
