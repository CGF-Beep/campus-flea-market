const { Category } = require('../models');
const { success, error } = require('../utils/response');

// 获取所有分类
exports.list = async (req, res) => {
  try {
    const categories = await Category.findAll({
      where: { status: 1 },
      order: [['sort', 'ASC'], ['id', 'ASC']]
    });
    // 分类极少变动：允许浏览器缓存 5 分钟、CDN 边缘缓存 10 分钟，
    // 首屏那次跨境请求可以直接命中缓存
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400');
    res.json(success(categories));
  } catch (err) {
    res.status(500).json(error('获取分类失败'));
  }
};

// 创建分类（管理员）
exports.create = async (req, res) => {
  try {
    const { name, icon, sort } = req.body;
    if (!name) return res.status(400).json(error('分类名称不能为空'));

    const category = await Category.create({ name, icon, sort: sort || 0 });
    res.json(success(category, '创建成功'));
  } catch (err) {
    res.status(500).json(error('创建分类失败'));
  }
};

// 更新分类（管理员）
exports.update = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json(error('分类不存在'));

    const { name, icon, sort, status } = req.body;
    await category.update({ name, icon, sort, status });
    res.json(success(category, '更新成功'));
  } catch (err) {
    res.status(500).json(error('更新分类失败'));
  }
};

// 删除分类（管理员）
exports.remove = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) return res.status(404).json(error('分类不存在'));

    await category.destroy();
    res.json(success(null, '删除成功'));
  } catch (err) {
    res.status(500).json(error('删除分类失败'));
  }
};
