/**
 * 轻量 User-Agent 解析
 *
 * 为什么手写而不用 ua-parser-js：
 *   我们只需要「设备类型 / 操作系统 / 浏览器」三个粗粒度字段，
 *   引入三方库要多一个依赖、多一份需要跟着升级的安全面。
 *   这里用正则做够用的判断，识别不出就老实落到「其他」。
 *
 * 判定顺序很关键：微信 / QQ / UC 这类内置浏览器的 UA 里
 * 同时包含 "Chrome" 甚至 "Safari"，必须先判壳、再判内核。
 */

// 爬虫与自动化客户端：命中即标记 is_bot，看板默认排除（学 GoAccess 的 --ignore-crawlers）
const BOT_PATTERN = new RegExp([
  'bot', 'crawler', 'spider', 'crawl', 'slurp', 'bingpreview', 'facebookexternalhit',
  'curl/', 'wget', 'python-requests', 'python-urllib', 'scrapy', 'go-http-client',
  'okhttp', 'java/', 'libwww', 'httpclient', 'headlesschrome', 'phantomjs',
  'puppeteer', 'playwright', 'selenium', 'lighthouse', 'pingdom', 'uptimerobot',
  'statuscake', 'masscan', 'nikto', 'nmap', 'semrush', 'ahrefs', 'mj12bot',
  'bytespider', 'petalbot', 'yisouspider', 'sm-', 'monitoring'
].join('|'), 'i');

const isBotUA = (ua) => !ua || BOT_PATTERN.test(ua);

function detectOS(ua) {
  if (/HarmonyOS/i.test(ua)) {
    const m = ua.match(/HarmonyOS[ /]?(\d+(\.\d+)?)/i);
    return m ? `HarmonyOS ${m[1]}` : 'HarmonyOS';
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    const m = ua.match(/OS (\d+)[._](\d+)/);
    return m ? `iOS ${m[1]}.${m[2]}` : 'iOS';
  }
  // Android 的 UA 里一定含 "Linux"，必须先于 Linux 判断
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android[ /]?(\d+(\.\d+)?)/i);
    return m ? `Android ${m[1]}` : 'Android';
  }
  if (/Windows Phone/i.test(ua)) return 'Windows Phone';
  if (/Windows NT/i.test(ua)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/);
    // NT 10.0 同时对应 Win10 与 Win11，UA 无法区分，合并显示
    const map = { '10.0': 'Windows 10/11', '6.3': 'Windows 8.1', '6.2': 'Windows 8', '6.1': 'Windows 7' };
    return (m && map[m[1]]) || 'Windows';
  }
  if (/Mac OS X/i.test(ua)) {
    const m = ua.match(/Mac OS X (\d+)[._](\d+)/);
    return m ? `macOS ${m[1]}.${m[2]}` : 'macOS';
  }
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return '其他';
}

function detectBrowser(ua) {
  const ver = (re) => {
    const m = ua.match(re);
    return m ? m[1].split('.')[0] : '';
  };

  // ---- 先判「壳」：国内 App 内置浏览器 ----
  if (/MicroMessenger/i.test(ua)) {
    const v = ver(/MicroMessenger\/(\d+)/i);
    return v ? `微信 ${v}` : '微信';
  }
  if (/wxwork/i.test(ua)) return '企业微信';
  if (/AlipayClient/i.test(ua)) return '支付宝';
  if (/DingTalk/i.test(ua)) return '钉钉';
  if (/aweme|BytedanceWebview|ByteLocale/i.test(ua)) return '抖音';
  if (/QQBrowser/i.test(ua)) return `QQ浏览器 ${ver(/QQBrowser\/(\d+)/i)}`.trim();
  if (/MQQBrowser/i.test(ua)) return 'QQ浏览器';
  if (/UCBrowser|UBrowser/i.test(ua)) return 'UC浏览器';
  if (/baiduboxapp|baidubrowser/i.test(ua)) return '百度App';
  if (/Quark/i.test(ua)) return '夸克';
  if (/HuaweiBrowser/i.test(ua)) return '华为浏览器';
  if (/MiuiBrowser/i.test(ua)) return '小米浏览器';

  // ---- 再判「内核」 ----
  if (/Edg\//i.test(ua)) return `Edge ${ver(/Edg\/(\d+)/i)}`.trim();
  if (/EdgA\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return `Opera ${ver(/OPR\/(\d+)/i)}`.trim();
  if (/Firefox\//i.test(ua)) return `Firefox ${ver(/Firefox\/(\d+)/i)}`.trim();
  if (/CriOS\//i.test(ua)) return `Chrome ${ver(/CriOS\/(\d+)/i)}`.trim();
  if (/Chrome\//i.test(ua)) return `Chrome ${ver(/Chrome\/(\d+)/i)}`.trim();
  if (/MSIE|Trident/i.test(ua)) return 'IE';
  if (/Safari\//i.test(ua)) return `Safari ${ver(/Version\/(\d+)/i)}`.trim();
  return '其他';
}

function detectDevice(ua) {
  if (/iPad|Tablet|PlayBook|Nexus 7|Nexus 10|SM-T/i.test(ua)) return '平板';
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return '平板';
  if (/Mobile|iPhone|iPod|Windows Phone|BlackBerry|IEMobile/i.test(ua)) return '手机';
  return 'PC';
}

/**
 * 设备品牌。
 *
 * 这里只借 ua-parser-js 的一个能力：把厂商内部型号代码映射到品牌。
 * 比如它认得 2211133C / 24129PN74C 是 Xiaomi、V2118A 是 Vivo、REA-AN00 是 Honor ——
 * 这背后是 uap-core 社区维护的规则库，自己写不现实（试过 device-detector-js，对国产机型全失效）。
 *
 * 其余字段（型号、系统、浏览器）仍走本文件手写的解析，原因：
 *   1. 手写版对微信/QQ/UC 这些国内内置浏览器给的是中文名，ua-parser-js 给的是 WeChat / QQBrowser；
 *   2. 手写版会把 UA 缩减后的占位符 K、WebView 的 wv 干净地过滤掉，ua-parser-js 会当成型号返回。
 * 所以是「拿它的品牌，用自己的其余部分」。
 */
let uaParser = null;
let uaParserFailed = false;

function detectBrand(ua) {
  if (!ua) return '';
  if (!uaParser && !uaParserFailed) {
    try {
      const mod = require('ua-parser-js');
      const UAParser = mod.UAParser || mod;
      uaParser = new UAParser();
    } catch (e) {
      uaParserFailed = true;
      console.error('[访问分析] ua-parser-js 加载失败，设备品牌将留空:', e.message);
    }
  }
  if (!uaParser) return '';
  try {
    uaParser.setUA(ua);
    const result = uaParser.getResult();
    const vendor = (result && result.device && result.device.vendor) || '';
    return String(vendor).slice(0, 32);
  } catch (e) {
    return '';
  }
}

/**
 * 从 UA 里取设备型号标识。
 *
 * 安卓的 UA 结构是 `(Linux; Android <版本>; <型号> Build/<构建号>)`，第三段就是型号：
 *   2211133C   → 小米的内部型号代码
 *   SM-S9210   → 三星 Galaxy S24
 *   Redmi Note 8 Pro → 直接就是市场名
 * 注意这些多是**厂商内部代码**，不是「小米 13」这种市场名。
 * 厂商并不在 UA 里公布市场名，所以任何工具都只能给出这个代码，GA / 百度统计也一样。
 *
 * 两个坑：
 *   1. Chrome 110 起推行 UA 缩减，安卓上这一段会被替换成占位符 `K`，
 *      这种情况只能靠前端用 UA-CH（getHighEntropyValues）补，见 client/src/utils/analytics.js。
 *   2. iOS 的 UA 永远只写 `iPhone` / `iPad`，拿不到具体机型 —— Apple 刻意去掉的，
 *      所有统计工具都拿不到，不是实现问题。
 *
 * @returns {string} 型号标识，取不到返回空串
 */
function detectDeviceModel(ua) {
  const raw = typeof ua === 'string' ? ua : '';
  if (!raw) return '';

  // iOS：能确定的只有设备族
  if (/iPhone/i.test(raw)) return 'iPhone';
  if (/iPad/i.test(raw)) return 'iPad';
  if (/iPod/i.test(raw)) return 'iPod';

  let model = '';

  // 优先取「Build/ 之前那一段」—— 安卓 UA 里型号总是紧邻 Build/。
  // 这样能绕开老安卓 UA 的干扰段：(Linux; U; Android 4.4.2; zh-cn; MT7-TL10 Build/...)
  // 里的 zh-cn 是语言而不是型号。
  const withBuild = raw.match(/;\s*([^;)]+?)\s+Build\//i);
  if (withBuild) {
    model = withBuild[1].trim();
  } else {
    // 部分机型不写 Build/ 段，退而取 Android 版本号之后的第一段
    const m = raw.match(/Android[^;)]*;\s*([^;)]+?)\s*[;)]/i);
    if (m) model = m[1].trim();
  }

  if (!model) return '';
  // K 是 Chrome UA 缩减后的占位符；wv 表示 WebView；形如 zh-cn 的是语言段
  if (model === 'K' || /^wv$/i.test(model) || /^[a-z]{2}(-[a-z]{2})?$/i.test(model)) return '';
  return model.slice(0, 64);
}

/**
 * @param {string} ua 原始 User-Agent 字符串
 * @returns {{device:string, deviceBrand:string, deviceModel:string, os:string, browser:string, isBot:number}}
 */
function parseUA(ua) {
  const raw = typeof ua === 'string' ? ua : '';
  const isBot = isBotUA(raw) ? 1 : 0;
  if (!raw) {
    // 完全没有 UA 的基本都是脚本或直连探测，标成机器人而不是「其他」
    return { device: '未知', deviceBrand: '', deviceModel: '', os: '未知', browser: '未知', isBot: 1 };
  }
  return {
    device: detectDevice(raw),
    deviceBrand: detectBrand(raw),
    deviceModel: detectDeviceModel(raw),
    os: detectOS(raw),
    browser: detectBrowser(raw),
    isBot
  };
}

module.exports = { parseUA, isBotUA, detectDeviceModel, detectBrand };
