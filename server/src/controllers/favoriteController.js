const { Op } = require('sequelize');
const { Favorite, Product, User } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');

// 添加收藏
exports.add = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) return res.status(400).json(error('商品ID不能为空'));

    const existing = await Favorite.findOne({
      where: { userId: req.user.id, productId }
    });
    if (existing) return res.status(400).json(error('已收藏过该商品'));

    await Favorite.create({ userId: req.user.id, productId });
    res.json(success(null, '收藏成功'));
  } catch (err) {
    res.status(500).json(error('收藏失败'));
  }
};

// 取消收藏
exports.remove = async (req, res) => {
  try {
    const productId = req.params.productId;
    await Favorite.destroy({
      where: { userId: req.user.id, productId }
    });
    res.json(success(null, '已取消收藏'));
  } catch (err) {
    res.status(500).json(error('取消收藏失败'));
  }
};

// 我的收藏列表
exports.myFavorites = async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);

    const result = await Favorite.findAndCountAll({
      where: { userId: req.user.id },
      include: [{
        model: Product,
        as: 'product',
        where: { status: { [Op.ne]: 'removed' } },
        include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'avatar'] }]
      }],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    });

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取收藏列表失败'));
  }
};
