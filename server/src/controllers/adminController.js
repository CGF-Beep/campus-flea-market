const { Op } = require('sequelize');
const { User, Product, Order, Category } = require('../models');
const { success, error, paginate } = require('../utils/response');

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
    const categories = await Category.findAll({ attributes: ['id', 'name'] });
    const categoryStats = [];
    for (const cat of categories) {
      const count = await Product.count({ where: { categoryId: cat.id, status: 'on_sale' } });
      categoryStats.push({ name: cat.name, count });
    }

    // 最近7天注册用户数
    const recentUsers = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dEnd = new Date(dStart);
      dEnd.setDate(dEnd.getDate() + 1);
      const count = await User.count({
        where: { createdAt: { [Op.gte]: dStart, [Op.lt]: dEnd } }
      });
      recentUsers.push({
        date: `${dStart.getMonth() + 1}/${dStart.getDate()}`,
        count
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
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
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
    res.json(success(user, status === 1 ? '已启用' : '已禁用'));
  } catch (err) {
    res.status(500).json(error('操作失败'));
  }
};

// 商品管理 - 全部列表
exports.productList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
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
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const status = req.query.status;

    let where = {};
    if (status) where.status = status;

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
