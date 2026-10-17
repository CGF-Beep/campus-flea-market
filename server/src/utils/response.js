// 统一响应格式
const success = (data = null, message = '操作成功') => {
  return { code: 200, message, data };
};

const error = (message = '操作失败', code = 400) => {
  return { code, message, data: null };
};

// 分页结果
const paginate = (list, page, pageSize) => {
  // findAndCountAll 返回 { count, rows }，count 为 0 时不能用 `||` 兜底
  // （0 是假值，会掉到 list.length → undefined，导致 totalPages 变成 NaN）。
  // 这里显式区分「数字 count」与「纯数组」两种入参。
  const total = typeof list.count === 'number'
    ? list.count
    : (Array.isArray(list) ? list.length : 0);
  return {
    code: 200,
    message: '操作成功',
    data: {
      list: list.rows || list,
      total,
      page: Number(page),
      pageSize: Number(pageSize),
      totalPages: Math.ceil(total / pageSize)
    }
  };
};

module.exports = { success, error, paginate };
