const { Op } = require('sequelize');
const { Product, Category, User, Favorite, Order } = require('../models');
const { success, error, paginate } = require('../utils/response');

// 获取商品列表（分页+搜索+筛选）
exports.list = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const keyword = req.query.keyword || '';
    const categoryId = req.query.categoryId;
    const condition = req.query.condition;
    const sortBy = req.query.sortBy || 'latest';
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;

    let where = { status: 'on_sale' };
    if (keyword) {
      where[Op.or] = [
        { title: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } }
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (condition) where.condition = condition;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
    }

    let order = [['createdAt', 'DESC']];
    if (sortBy === 'price_asc') order = [['price', 'ASC']];
    if (sortBy === 'price_desc') order = [['price', 'DESC']];
    if (sortBy === 'popular') order = [['views', 'DESC']];

    const result = await Product.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] }
      ],
      order,
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    });

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取商品列表失败'));
  }
};

// 获取商品详情
exports.detail = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar', 'phone'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] }
      ]
    });

    if (!product) {
      return res.status(404).json(error('商品不存在'));
    }

    const data = product.toJSON();

    // 检查是否被当前用户收藏
    let isFavorited = false;
    // 收藏总数（展示“X人收藏”）
    const favorites = await Favorite.count({ where: { productId: product.id } });
    if (req.user) {
      const fav = await Favorite.findOne({
        where: { userId: req.user.id, productId: product.id }
      });
      isFavorited = !!fav;

      // 卖家查看自己的商品时，附带订单信息（含买家信息），用于卖家视角的交易管理
      if (product.userId === req.user.id) {
        const orders = await Order.findAll({
          where: { productId: product.id },
          include: [
            { model: User, as: 'buyer', attributes: ['id', 'username', 'nickname', 'avatar', 'college', 'phone'] }
          ],
          order: [['createdAt', 'DESC']]
        });
        data.orders = orders;
      }
    }

    // 非卖家查看才增加浏览量（卖家自己浏览不算曝光）
    if (!req.user || product.userId !== req.user.id) {
      await product.increment('views');
    }

    res.json(success({ ...data, isFavorited, favorites }));
  } catch (err) {
    res.status(500).json(error('获取商品详情失败'));
  }
};

// 发布商品
exports.create = async (req, res) => {
  try {
    const { title, categoryId, price, originalPrice, description, images, condition, location } = req.body;

    if (!title || !categoryId || !price) {
      return res.status(400).json(error('标题、分类、价格为必填项'));
    }

    const product = await Product.create({
      title,
      userId: req.user.id,
      categoryId,
      price,
      originalPrice,
      description,
      images: images || [],
      condition: condition || '九成新',
      location,
      status: 'pending'
    });

    res.json(success(product, '发布成功，等待管理员审核'));
  } catch (err) {
    res.status(500).json(error('发布商品失败'));
  }
};

// 更新商品
exports.update = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json(error('商品不存在'));
    }
    if (product.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json(error('无权修改此商品'));
    }

    const { title, categoryId, price, originalPrice, description, images, condition, location } = req.body;
    // 用户修改商品后重置为待审核状态（已售出商品不可编辑）
    const status = product.status === 'sold' ? 'sold' : 'pending';
    await product.update({
      title, categoryId, price, originalPrice, description, images, condition, location, status
    });
    res.json(success(product, '更新成功，等待管理员审核'));
  } catch (err) {
    res.status(500).json(error('更新商品失败'));
  }
};

// 删除/下架商品
exports.remove = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json(error('商品不存在'));
    }
    if (product.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json(error('无权操作此商品'));
    }

    await product.update({ status: 'removed' });
    res.json(success(null, '下架成功'));
  } catch (err) {
    res.status(500).json(error('下架商品失败'));
  }
};

// 获取当前用户发布的商品
exports.myProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const status = req.query.status;

    let where = { userId: req.user.id };
    if (status) where.status = status;

    const result = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    });

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取我的商品失败'));
  }
};

// 管理员审核商品 - 通过
exports.approve = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json(error('商品不存在'));

    await product.update({ status: 'on_sale', rejectReason: null });
    res.json(success(product, '审核通过'));
  } catch (err) {
    res.status(500).json(error('审核失败'));
  }
};

// 管理员审核商品 - 拒绝
exports.reject = async (req, res) => {
  try {
    const { reason } = req.body;
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json(error('商品不存在'));

    await product.update({ status: 'rejected', rejectReason: reason });
    res.json(success(product, '已拒绝'));
  } catch (err) {
    res.status(500).json(error('操作失败'));
  }
};

// 永久删除商品（仅发布者本人）
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) {
      return res.status(404).json(error('商品不存在'));
    }
    if (product.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json(error('无权删除此商品'));
    }

    // 删除关联的收藏记录
    await Favorite.destroy({ where: { productId: product.id } });
    // 删除商品本身
    await product.destroy();
    res.json(success(null, '商品已永久删除'));
  } catch (err) {
    res.status(500).json(error('删除商品失败'));
  }
};
