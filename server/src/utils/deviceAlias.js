/**
 * 机型别名解析
 *
 * 背景：厂商只在 UA 里写内部型号代码（2211133C），不写市场名（小米 13）。
 * 实测过 device-detector-js 和 ua-parser-js 两个库都到不了市场名 ——
 * 这个映射关系没有任何权威数据源，所以只能由管理员自己命名一次。
 *
 * 实现：别名表通常只有几十行，整张载入内存做 Map 映射即可，比每次查询 JOIN 便宜。
 * 写入别名后调 invalidate()，下次读取时自动重新载入。
 */

const { DeviceModelAlias } = require('../models');

let cache = null;   // Map<modelCode, alias>
let loading = null; // 并发去重：多个请求同时发现缓存为空时只查一次库

async function load() {
  if (cache) return cache;
  if (loading) return loading;

  loading = DeviceModelAlias.findAll({ attributes: ['modelCode', 'alias'], raw: true })
    .then((rows) => {
      cache = new Map(rows.map((r) => [r.modelCode, r.alias]));
      return cache;
    })
    .catch(() => {
      // 表还没建好或查询失败时降级成空表 —— 别名只是显示层，绝不能因此让接口报错
      cache = new Map();
      return cache;
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

/** 别名被改动后调用，下次读取时重新载入 */
function invalidate() {
  cache = null;
}

/**
 * 取一个解析器：先保证缓存就绪，再同步逐条算显示名。
 * 用法：
 *   const resolve = await buildResolver()
 *   const list = rows.map((r) => ({ ...r, label: resolve(r) }))
 *
 * 优先级：别名（管理员命名） > 品牌 + 型号 > 型号 > 设备类型
 */
async function buildResolver() {
  const map = await load();
  return (row) => {
    const code = (row && row.deviceModel) || '';
    if (code) {
      const alias = map.get(code);
      if (alias) return alias;
      if (row.deviceBrand) return `${row.deviceBrand} ${code}`;
      return code;
    }
    return (row && row.device) || '未知';
  };
}

/** 供 devices 接口判断某个型号是否已被命名（要显示还是隐藏「命名」入口） */
async function getAliasMap() {
  return load();
}

module.exports = { buildResolver, getAliasMap, invalidate };
