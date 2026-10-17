/**
 * 商品表单服务端校验。
 *
 * 背景：前端 Publish.vue 的校验只是「用户体验优化」，绕过前端直接调
 * POST /api/products 仍然可以写入超长标题、负价格、外链图片等脏数据。
 * 这里做的是最后一道防线，必须与前端规则保持一致口径。
 *
 * 用法：
 *   const { validateProduct, CONDITION_OPTIONS } = require('../utils/validateProduct');
 *   const msg = validateProduct(req.body);   // 返回错误文案，null 表示通过
 */

// 与 Product 模型的 ENUM 保持一致，避免写库时报 "Data truncated"
const CONDITION_OPTIONS = ['全新', '九成新', '八成新', '七成新及以下'];

// 各字段上限（与模型定义对齐：title VARCHAR(100) 这里收紧到 50 更合理）
const LIMITS = {
  titleMin: 2,
  titleMax: 50,
  descMax: 500,
  locationMax: 50,
  priceMax: 999999,
  imagesMax: 6
};

/**
 * 价格字段校验：接受 number 或数字字符串，拒绝负数 / 非数字 / 超出上限
 * @returns {number|null} 合法时返回 Number，非法返回 null
 */
function parsePrice(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > LIMITS.priceMax) return null;
  return n;
}

/**
 * 图片数组校验：必须是数组、数量受限、且全部为本站 /uploads/ 开头的相对路径。
 * 限制同源是为了堵住「外链盗图」与「第三方追踪像素」。
 */
function validateImages(images) {
  if (images === undefined || images === null) return null;
  if (!Array.isArray(images)) return '图片格式不正确';
  if (images.length > LIMITS.imagesMax) return `最多上传 ${LIMITS.imagesMax} 张图片`;
  const illegal = images.find(
    (u) => typeof u !== 'string' || !u.startsWith('/uploads/')
  );
  if (illegal !== undefined) return '图片地址不合法，请重新上传';
  return null;
}

/**
 * 校验商品提交内容
 * @param {object} body 请求体
 * @param {object} [options]
 * @param {boolean} [options.partial=false] 更新场景下是否允许「未传字段跳过校验」
 * @returns {string|null} 错误文案，null 表示校验通过
 */
function validateProduct(body, options = {}) {
  const { partial = false } = options;
  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  // ===== title =====
  if (!partial || has('title')) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return '商品标题不能为空';
    if (title.length < LIMITS.titleMin) return `标题至少 ${LIMITS.titleMin} 个字`;
    if (title.length > LIMITS.titleMax) return `标题不能超过 ${LIMITS.titleMax} 个字`;
  }

  // ===== categoryId =====
  if (!partial || has('categoryId')) {
    const cid = Number(body.categoryId);
    if (!body.categoryId || !Number.isInteger(cid) || cid <= 0) return '请选择商品分类';
  }

  // ===== price（必填）=====
  if (!partial || has('price')) {
    if (body.price === undefined || body.price === null || body.price === '') {
      return '请填写商品价格';
    }
    const price = parsePrice(body.price);
    if (price === null) return `价格需在 0 ~ ${LIMITS.priceMax} 之间`;
  }

  // ===== originalPrice（选填）=====
  if (has('originalPrice') && body.originalPrice !== '' && body.originalPrice !== null) {
    if (parsePrice(body.originalPrice) === null) {
      return `原价需在 0 ~ ${LIMITS.priceMax} 之间`;
    }
  }

  // ===== description（选填）=====
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') return '商品描述格式不正确';
    if (body.description.length > LIMITS.descMax) {
      return `商品描述不能超过 ${LIMITS.descMax} 个字`;
    }
  }

  // ===== location（选填）=====
  if (body.location !== undefined && body.location !== null && body.location !== '') {
    if (typeof body.location !== 'string') return '交易地点格式不正确';
    if (body.location.length > LIMITS.locationMax) {
      return `交易地点不能超过 ${LIMITS.locationMax} 个字`;
    }
  }

  // ===== images =====
  const imgErr = validateImages(body.images);
  if (imgErr) return imgErr;

  // ===== condition（选填，默认九成新）=====
  if (body.condition !== undefined && body.condition !== null && body.condition !== '') {
    if (!CONDITION_OPTIONS.includes(body.condition)) return '商品成色不合法';
  }

  return null;
}

module.exports = { validateProduct, CONDITION_OPTIONS, LIMITS };
