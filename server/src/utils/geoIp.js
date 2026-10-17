/**
 * IP 归属地查询（离线库，不联网、不外发用户 IP）
 *
 * 用 ip2region@2.3.0：包内自带 IPv4 库（8.33MB）与 IPv6 库（2.54MB），
 * 零配置、无需单独下载数据文件，实测 11 次查询合计 1 毫秒。
 *
 * 精度边界必须说清楚，否则会误判成「库不准」：
 *   归属地库是按运营商网段分配记录维护的，只能给出「国家 / 省 / 市 / 运营商」，
 *   它反映的是**这个 IP 段归属**，不等于用户此刻的真实位置。
 *   典型偏差：校园网出口常显示成学校所在市或运营商机房所在城市；
 *   手机 4G/5G 常显示成省会或骨干节点城市。
 *   基站级定位用 IP 做不到，Google Analytics 也一样，这不是缺陷而是原理限制。
 *
 * 本模块全程不抛错：库加载失败或查询失败都返回 null，让业务侧降级显示，
 * 绝不能因为归属地查询把访问采集搞挂。
 */

let searcher = null;
let initFailed = false;

// 内网 / 回环段：这些地址送进库只会得到「内网IP」，单独挡掉更清晰
const PRIVATE_RE = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;

function getSearcher() {
  if (searcher || initFailed) return searcher;
  try {
    // 这个包的导出是 ESM 风格的 default，必须取 .default
    const IP2Region = require('ip2region').default;
    searcher = new IP2Region();
    console.log('[访问分析] IP 归属地库已加载（IPv4 + IPv6）');
  } catch (e) {
    initFailed = true;
    console.error('[访问分析] IP 归属地库加载失败，地理位置将留空:', e.message);
  }
  return searcher;
}

/**
 * @param {string} ip
 * @returns {{country:string, province:string, city:string, isp:string}|null}
 */
function lookup(ip) {
  if (!ip) return null;

  // IPv4-mapped IPv6（Nginx 常见写法 ::ffff:1.2.3.4）要先还原成 IPv4
  const v = String(ip).replace(/^::ffff:/i, '');

  if (v === '127.0.0.1' || PRIVATE_RE.test(v)) {
    return { country: '', province: '', city: '内网', isp: '' };
  }

  const s = getSearcher();
  if (!s) return null;

  try {
    const r = s.search(v);
    if (!r) return null;
    // 库里对内网/本机地址的表示方式
    if (r.city === '内网IP' || r.isp === '内网IP' || r.isp === '本机地址') {
      return { country: '', province: '', city: '内网', isp: '' };
    }
    return {
      country: r.country || '',
      province: r.province || '',
      city: r.city || '',
      isp: r.isp || ''
    };
  } catch (e) {
    return null;
  }
}

/**
 * 拼成一行展示文本，例如「广东省 深圳市 · 电信」
 * @param {{province?:string, city?:string, isp?:string}} geo
 */
function formatLocation(geo) {
  if (!geo) return '';
  // 内网 / 本机地址没有归属地可言，单独给一个明确的说法
  if (geo.city === '内网') return '内网 / 本机';
  const area = [geo.province, geo.city].filter(Boolean).join(' ');
  const isp = geo.isp || '';
  if (!area && !isp) return '';
  return isp ? `${area} · ${isp}` : area;
}

module.exports = { lookup, formatLocation };
