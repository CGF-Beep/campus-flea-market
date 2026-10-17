/**
 * 分页参数解析（统一钳制）
 *
 * 背景：各 controller 原来都是 `parseInt(req.query.pageSize) || 10`，
 * 只兜了"非数字"的情况，**没有上限**。客户端传 `?pageSize=999999`
 * 就会生成 `LIMIT 999999`，一次把全表拉进内存再序列化成 JSON。
 * 在跨境链路（Cloudflare 回源）上，单个请求就能吃掉大量带宽与内存。
 *
 * 这里统一收口，所有分页接口都必须走这个函数。
 */

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;      // 与前端最大的合法用法对齐（聊天记录一页 100 条）
const MAX_PAGE = 100000;        // 防止 (page-1)*pageSize 溢出成天文数字的 OFFSET

/**
 * @param {object} query  req.query
 * @param {object} [options]
 * @param {number} [options.defaultPageSize=10] 未传或非法时的默认条数
 * @param {number} [options.maxPageSize=100]    单页条数上限
 * @returns {{page:number, pageSize:number}}
 */
function parsePagination(query = {}, options = {}) {
  const defaultPageSize = options.defaultPageSize || DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize || MAX_PAGE_SIZE;

  let page = parseInt(query.page, 10);
  let pageSize = parseInt(query.pageSize, 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > MAX_PAGE) page = MAX_PAGE;

  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = defaultPageSize;
  if (pageSize > maxPageSize) pageSize = maxPageSize;

  return { page, pageSize };
}

module.exports = { parsePagination, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MAX_PAGE };
