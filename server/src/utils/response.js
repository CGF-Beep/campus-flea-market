// 统一响应格式
const success = (data = null, message = '操作成功') => {
  return { code: 200, message, data };
};

const error = (message = '操作失败', code = 400) => {
  return { code, message, data: null };
};

// 分页结果
const paginate = (list, page, pageSize) => {
  const total = list.count || list.length;
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
