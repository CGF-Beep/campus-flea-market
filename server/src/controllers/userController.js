const { Op } = require('sequelize');
const { User, Product, Category } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { getSellerCredits } = require('../utils/sellerCredits');
const { parsePagination } = require('../utils/pagination');

/**
 * 用户公开主页信息（卖家主页）。
 * 只暴露公开字段，绝不返回 phone / email / studentId 等隐私数据。
 */
exports.publicProfile = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) return res.status(400).json(error('用户ID不合法'));

    const user = await User.findByPk(userId, {
      // 注意：不要 include phone / email / studentId —— 主页是公开页面
      attributes: ['id', 'username', 'nickname', 'avatar', 'college', 'createdAt']
    });
    if (!user) return res.status(404).json(error('用户不存在'));

    // 系统账号不作为主页展示对象（也不该出现在任何用户入口里）
    if (user.username === 'system') {
      return res.status(404).json(error('用户不存在'));
    }

    const credits = await getSellerCredits(userId);

    res.json(
      success({
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        college: user.college,
        joinedAt: user.createdAt,
        credits
      })
    );
  } catch (err) {
    console.error('获取用户主页失败:', err);
    res.status(500).json(error('获取用户主页失败'));
  }
};

/**
 * 某用户的在售商品列表（复用商品列表的分页与字段白名单）
 */
exports.userProducts = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!userId) return res.status(400).json(error('用户ID不合法'));

    const { page, pageSize } = parsePagination(req.query, { defaultPageSize: 12 });

    const result = await Product.findAndCountAll({
      where: { userId, status: 'on_sale' },
      // 与 productController.list 保持一致的字段白名单（不回 description）
      attributes: [
        'id', 'userId', 'categoryId', 'title', 'price', 'originalPrice',
        'images', 'condition', 'location', 'views', 'status', 'createdAt'
      ],
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] }
      ],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize
      // 两个 include 都是 belongsTo，不会造成行数膨胀，无需 distinct
    });

    res.json(paginate(result, page, pageSize));
  } catch (err) {
    console.error('获取用户商品失败:', err);
    res.status(500).json(error('获取用户商品失败'));
  }
};
