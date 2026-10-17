const { Op } = require('sequelize');
const { sequelize, Product, Category, User, Favorite, Order } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { sendSystemNotification, sendSystemNotificationBatch } = require('../utils/notify');
const { validateProduct } = require('../utils/validateProduct');
const { getSellerCredits } = require('../utils/sellerCredits');
const { expandKeyword, buildKeywordWhere, buildRelevanceOrder } = require('../utils/queryExpander');
const { parsePagination } = require('../utils/pagination');
const { parseImages, removeImageFile } = require('../utils/imageFiles');
const { shouldCountView, visitorOf } = require('../utils/viewDedup');

// 获取商品列表（分页+搜索+筛选）
exports.list = async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const keyword = req.query.keyword || '';
    const categoryId = req.query.categoryId;
    const condition = req.query.condition;
    const sortBy = req.query.sortBy || 'latest';
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;

    // 检索词扩展（解决中文同义/词形不一致导致的漏召回）：
    //   ① 同义词组：搜「帽子」扩展成 帽 / 棒球帽 / 鸭舌帽 → 命中「New Era/纽亦华 920棒球帽」
    //               搜「相机」扩展成 大疆 / 云台 / 微单   → 命中「DJI/大疆 Pocket4」
    //   ② 品类词映射分类：搜「乐器」「化妆品」这类上位词，直接召回对应分类的商品
    // 原来只做 title LIKE '%帽子%'，而「棒球帽」不含「帽子」二字，永远搜不到。
    const expansion = keyword ? await expandKeyword(keyword) : null;

    let where = { status: 'on_sale' };
    if (expansion) {
      where[Op.or] = buildKeywordWhere(expansion.terms, expansion.categoryIds);
    }
    if (categoryId) where.categoryId = categoryId;
    if (condition) where.condition = condition;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
    }

    // 排序：扩展后召回面变宽，默认排序下让相关度优先，把精确命中顶到最前面，
    // 避免「棒球帽」淹没在一堆弱相关结果里。
    // 但用户显式选了价格/热度排序时完全尊重其选择（与淘宝、京东的行为一致）。
    let order = [];
    if (expansion && sortBy === 'latest') {
      const relevance = buildRelevanceOrder(sequelize, expansion.terms, expansion.categoryIds);
      if (relevance) order.push([relevance, 'ASC']);
    }
    if (sortBy === 'price_asc') order.push(['price', 'ASC']);
    else if (sortBy === 'price_desc') order.push(['price', 'DESC']);
    else if (sortBy === 'popular') order.push(['views', 'DESC']);
    else order.push(['createdAt', 'DESC']);

    const result = await Product.findAndCountAll({
      where,
      // 列表页只需要卡片用到的字段：不回 description（TEXT，可能很长）与 rejectReason，
      // 单次响应体可缩小一半以上
      attributes: [
        'id', 'userId', 'categoryId', 'title', 'price', 'originalPrice',
        'images', 'condition', 'location', 'views', 'status', 'createdAt'
      ],
      include: [
        { model: User, as: 'user', attributes: ['id', 'username', 'nickname', 'avatar'] },
        { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] }
      ],
      order,
      offset: (page - 1) * pageSize,
      limit: pageSize
      // 两个 include 都是 belongsTo（多对一），不会造成行数膨胀，
      // 因此不需要 distinct: true（它会生成 COUNT(DISTINCT) 子查询，反而更慢）
    });

    const payload = paginate(result, page, pageSize);

    // 把扩展结果回传前端，用于展示「已为你扩展搜索：帽 / 棒球帽」，
    // 让用户理解为什么搜「帽子」会出来「棒球帽」。
    if (expansion) {
      payload.data.search = {
        keyword: expansion.keyword,
        expanded: expansion.expanded,
        // 命中分类时告诉前端命中了哪个分类，便于展示「已按分类『乐器』匹配」
        categoryLabels: expansion.categoryLabels,
        dictReady: expansion.dictReady
      };
    }

    res.json(payload);
  } catch (err) {
    console.error('[productController.list]', err);
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

    // 卖家信用统计（已完成单数 / 在售件数 / 注册天数）：
    // 买家判断「这个卖家靠不靠谱」的核心依据。
    // 与收藏数并行查询，避免串行叠加延迟。
    const credits = await getSellerCredits(product.userId);
    data.sellerCredits = credits;

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

    // 非卖家查看才增加浏览量（卖家自己浏览不算曝光）。
    // 再叠一层访客去重：increment 本身是原子的、不怕并发，
    // 但挡不住同一个人反复刷新把浏览量刷上天（30 分钟内同一访客只计一次）。
    if (!req.user || product.userId !== req.user.id) {
      if (shouldCountView(product.id, visitorOf(req))) {
        await product.increment('views');
      }
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

    // 服务端兜底校验（前端校验可被绕过，这里是最后一道防线）
    const invalid = validateProduct(req.body);
    if (invalid) return res.status(400).json(error(invalid));

    const product = await Product.create({
      title: title.trim(),
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

    // 服务端兜底校验：更新时同样不能绕过（partial 允许前端只提交部分字段）
    const invalid = validateProduct(req.body, { partial: true });
    if (invalid) return res.status(400).json(error(invalid));

    // 记录改价前的价格，用于判断是否「降价」
    const oldPrice = Number(product.price);
    const newPrice = price !== undefined && price !== '' ? Number(price) : oldPrice;

    // 用户修改商品后重置为待审核状态（已售出商品不可编辑）
    const status = product.status === 'sold' ? 'sold' : 'pending';
    await product.update({
      title: typeof title === 'string' ? title.trim() : title,
      categoryId, price, originalPrice, description, images, condition, location, status
    });

    // 降价提醒：通知所有收藏了该商品的用户（收藏后零回流是此前的产品缺口）。
    // 节流策略：同一商品 24 小时内只提醒一次，避免卖家反复微调价格刷屏。
    const THROTTLE_MS = 24 * 60 * 60 * 1000;
    const canNotify =
      newPrice < oldPrice &&
      status !== 'sold' &&
      (!product.priceNoticeAt || Date.now() - new Date(product.priceNoticeAt).getTime() > THROTTLE_MS);

    if (canNotify) {
      const favs = await Favorite.findAll({
        where: { productId: product.id },
        attributes: ['userId']
      });
      const userIds = favs.map((f) => f.userId).filter((id) => Number(id) !== Number(product.userId));

      if (userIds.length) {
        await sendSystemNotificationBatch(
          userIds,
          product.id,
          () => `您收藏的商品【${product.title}】降价啦！现价 ￥${newPrice}（原 ￥${oldPrice}），手慢无`
        );
        await product.update({ priceNoticeAt: new Date() });
      }
    }

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

    const isAdminAction = req.user.role === 'admin' && product.userId !== req.user.id;
    await product.update({ status: 'removed' });

    // 管理员下架他人商品时，通知卖家
    if (isAdminAction) {
      await sendSystemNotification(
        product.userId,
        product.id,
        `您的商品【${product.title}】已被管理员下架，如有疑问请联系管理员`
      );
    }

    res.json(success(null, '下架成功'));
  } catch (err) {
    res.status(500).json(error('下架商品失败'));
  }
};

// 获取当前用户发布的商品
exports.myProducts = async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
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

    // 通知卖家：审核通过
    await sendSystemNotification(
      product.userId,
      product.id,
      `您的商品【${product.title}】已通过审核，现已上架，其他同学可以看到了`
    );

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

    // 通知卖家：审核未通过（附驳回原因）
    await sendSystemNotification(
      product.userId,
      product.id,
      `您的商品【${product.title}】未通过审核${reason ? `，原因：${reason}` : ''}。修改后可以重新提交审核`
    );

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

    // 先取出图片地址：商品行删掉之后就查不到了
    const imageUrls = parseImages(product.images);

    // 删除关联的收藏记录
    await Favorite.destroy({ where: { productId: product.id } });
    // 删除商品本身
    await product.destroy();

    // 再清磁盘文件。必须放在 product.destroy() 之后 ——
    // 否则「还有没有别的商品引用这张图」的检查会把这个商品自己算进去，
    // 导致永远判定为"仍被引用"而一张都删不掉。
    // 同一张图理论上可能被多个商品复用（接口层没禁止），所以逐个确认无人引用后才删。
    let removedFiles = 0;
    for (const url of imageUrls) {
      const stillUsed = await Product.count({
        where: { images: { [Op.like]: `%${url}%` } }
      });
      if (stillUsed > 0) continue;
      removedFiles += await removeImageFile(url);
    }

    res.json(success({ removedFiles }, '商品已永久删除'));
  } catch (err) {
    console.error('[deleteProduct]', err);
    res.status(500).json(error('删除商品失败'));
  }
};
