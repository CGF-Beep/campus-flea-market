const { Op, fn, col } = require('sequelize');
const { VisitSession, VisitEvent, User, DeviceModelAlias } = require('../models');
const { success, error, paginate } = require('../utils/response');
const { parsePagination } = require('../utils/pagination');
const { formatLocation } = require('../utils/geoIp');
const { buildResolver, getAliasMap, invalidate } = require('../utils/deviceAlias');

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

// 浏览器分布最多展示 8 条，其余合并成「其他」。
// 浏览器名带主版本号（Chrome 120 / 121…），不封顶会越积越多。
const BROWSER_LIMIT = 8;

/**
 * 只留前 limit 项，其余合并成一条「其他」（数量求和，总量不丢）。
 * 浏览器名是带主版本号的（Chrome 120 / Chrome 121 / Safari 17 …），
 * 长期累积会变成几十条，把 chip 区撑成一大坨，所以按业界常规
 * （GA、百度统计都是 Top N + 其他）做个封顶。
 * 提到模块级并导出，是为了能脱离 express 直接单测这段逻辑。
 */
function capWithRest(list, limit) {
  if (!Array.isArray(list) || list.length <= limit) return list || [];
  const head = list.slice(0, limit);
  const restCount = list
    .slice(limit)
    .reduce((sum, i) => sum + (Number(i.count) || 0), 0);
  return [...head, { name: '其他', count: restCount }];
}

// 导出供校验脚本单测（路由不会用到它）
exports.capWithRest = capWithRest;

/**
 * 时间范围起点（按北京时间算自然日，而不是「当前时刻往前推 24 小时」）
 * today => 今天 00:00 起；7d / 30d => 含今天在内的最近 N 个自然日 00:00 起
 */
function rangeStart(range) {
  const bj = new Date(Date.now() + BEIJING_OFFSET_MS); // 把北京墙上时间搬到 UTC 字段上比较
  const midnightUtc = Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate());
  const days = range === '30d' ? 30 : range === '7d' ? 7 : 1;
  return new Date(midnightUtc - (days - 1) * 86400000 - BEIJING_OFFSET_MS);
}

function baseWhere(query) {
  const where = { startedAt: { [Op.gte]: rangeStart(query.range) } };
  // 爬虫默认排除，但允许一键切「含爬虫」用来看扫描器行为
  if (query.includeBots !== '1') where.isBot = 0;
  return where;
}

const num = (v) => Number(v) || 0;
const bjKey = (d) => {
  const t = new Date(new Date(d).getTime() + BEIJING_OFFSET_MS);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(
    t.getUTCDate()
  ).padStart(2, '0')}`;
};

async function countDistinctSessions(where) {
  const row = await VisitEvent.findOne({
    attributes: [[fn('COUNT', fn('DISTINCT', col('session_id'))), 'c']],
    where,
    raw: true
  });
  return num(row && row.c);
}

/**
 * 把停留时长回写到该会话最近一条事件上。
 * 页面级停留时长只能事后补：用户点「下一页」或切后台的那一刻才知道上一页待了多久。
 * 所以前端在下一次上报里带上 prevStay，由后端回写，而不是另发一条事件（那会把 PV 算重）。
 */
async function writePrevStay(sessionId, stayMs) {
  const last = await VisitEvent.findOne({
    where: { sessionId },
    order: [['id', 'DESC']],
    attributes: ['id'],
    raw: true
  });
  if (last) await VisitEvent.update({ stayMs }, { where: { id: last.id } });
}

// ============================================================
// 前端埋点上报（匿名，无需登录）
// ============================================================
/**
 * 请求体是 text/plain 的 JSON 字符串。
 * 为什么不用 application/json：跨域发 application/json 会触发 CORS 预检，
 * 而 sendBeacon 无法处理预检；text/plain 属于 CORS 安全列表内的类型，可直接发出。
 */
exports.report = async (req, res) => {
  try {
    let payload = {};
    if (typeof req.body === 'string' && req.body) {
      try {
        payload = JSON.parse(req.body);
      } catch (e) {
        payload = {};
      }
    } else if (req.body && typeof req.body === 'object') {
      payload = req.body;
    }

    const visit = req.visitPromise ? await req.visitPromise : null;
    if (!visit) return res.json(success(null));

    const session = await VisitSession.findByPk(visit.sessionId);
    if (!session) return res.json(success(null));

    const prevStay = Math.min(Math.max(parseInt(payload.prevStay, 10) || 0, 0), 30 * 60 * 1000);

    // 设备型号单独算：前端取 UA-CH 是异步的，可能晚于第一次页面浏览才拿到，
    // 所以任何一次上报（含只补停留时长的那种）都顺手把型号补上。
    // 前端的 UA-CH 值比解析 UA 更准 —— Chrome 110 起会把 UA 里的型号抹成占位符 K。
    // Safari 不支持 UA-CH 会传空，那就保留后端从 UA 解析出来的结果。
    const modelNow = payload.deviceModel ? String(payload.deviceModel).slice(0, 64) : '';
    const needModelPatch = modelNow && modelNow !== (session.deviceModel || '');

    // 补报模式：用户切后台或关页面时只补上一页的停留时长，不再新增一条页面浏览，
    // 否则同一个页面会被算两次 PV。移动端主要靠这条路径（beforeunload 在微信/iOS 上不可靠）。
    if (payload.stayOnly) {
      if (prevStay > 0) await writePrevStay(session.id, prevStay);
      if (needModelPatch) {
        await VisitSession.update({ deviceModel: modelNow }, { where: { id: session.id } });
      }
      return res.json(success(null));
    }

    // 路径只保留 pathname：查询串会让 Top 页面被 ?page=2 这类参数冲散（同 Plausible 的做法）
    let path = String(payload.path || '').split('?')[0].split('#')[0];
    if (!path.startsWith('/')) return res.json(success(null));
    if (path.length > 255) path = path.slice(0, 255);

    // 先回写上一页停留时长再插入新事件；顺序反了会更新到刚插入的这条上
    if (prevStay > 0) await writePrevStay(session.id, prevStay);

    const isFirstView = session.pageviews === 0;

    await VisitEvent.create({
      sessionId: session.id,
      path,
      pageTitle: payload.title ? String(payload.title).slice(0, 191) : null,
      stayMs: 0
    });

    const nextCount = session.pageviews + 1;
    const patch = {
      pageviews: nextCount,
      isBounce: nextCount > 1 ? 0 : 1,
      exitPath: path,
      lastActiveAt: new Date(),
      duration: Math.max(0, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000))
    };

    if (isFirstView) {
      patch.entryPath = path;
      // 会话首访时用前端上报的 document.referrer 覆盖中间件的猜测：
      // 微信内置浏览器里 referrer 常被抹掉，但 SPA 的 document.referrer 仍有值
      if (payload.referrer) {
        const { classifySource } = require('../utils/visitor');
        const { channel, referrerHost } = classifySource({
          referrer: payload.referrer,
          utmSource: payload.utm,
          isWechat: /MicroMessenger/i.test(req.headers['user-agent'] || ''),
          selfHosts: (process.env.CLIENT_URL || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((u) => {
              try {
                return new URL(u).host.toLowerCase().split(':')[0];
              } catch (e) {
                return '';
              }
            })
            .filter(Boolean)
        });
        patch.sourceChannel = channel;
        patch.referrerHost = referrerHost;
        patch.utmSource = payload.utm ? String(payload.utm).slice(0, 64) : null;
      }
    }

    if (payload.screen) patch.screen = String(payload.screen).slice(0, 16);
    if (payload.lang) patch.language = String(payload.lang).slice(0, 16);
    if (needModelPatch) patch.deviceModel = modelNow;

    if (isFirstView) {
      // 首访时中间件可能刚建完会话，这里直接覆盖写
      await VisitSession.update(patch, { where: { id: session.id } });
    } else {
      await session.update(patch);
    }

    res.json(success(null));
  } catch (err) {
    // 埋点上报失败绝不能让前端看见错误，静默返回成功
    res.json(success(null));
  }
};

// ============================================================
// 看板：总览
// ============================================================
exports.overview = async (req, res) => {
  try {
    const where = baseWhere(req.query);

    const [agg, online] = await Promise.all([
      VisitSession.findOne({
        attributes: [
          [fn('COUNT', col('id')), 'sessions'],
          [fn('COUNT', fn('DISTINCT', col('visitor_id'))), 'uv'],
          [fn('SUM', col('pageviews')), 'pv'],
          [fn('AVG', col('is_bounce')), 'bounce'],
          [fn('AVG', col('duration')), 'avgDuration']
        ],
        where,
        raw: true
      }),
      VisitSession.count({
        where: { isBot: 0, lastActiveAt: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) } }
      })
    ]);

    // 近 14 个自然日的趋势骨架，先补齐再填数，避免前端折线断档
    const days = 14;
    const nowBj = new Date(Date.now() + BEIJING_OFFSET_MS);
    const trendStart = new Date(
      Date.UTC(nowBj.getUTCFullYear(), nowBj.getUTCMonth(), nowBj.getUTCDate()) -
        (days - 1) * 86400000 -
        BEIJING_OFFSET_MS
    );

    const trendRows = await VisitSession.findAll({
      attributes: [
        [fn('DATE', col('started_at')), 'date'],
        [fn('COUNT', col('id')), 'sessions'],
        [fn('COUNT', fn('DISTINCT', col('visitor_id'))), 'uv'],
        [fn('SUM', col('pageviews')), 'pv']
      ],
      where: { ...where, startedAt: { [Op.gte]: trendStart } },
      group: [fn('DATE', col('started_at'))],
      raw: true
    });
    const trendMap = new Map(
      trendRows.map((r) => [
        String(r.date),
        { sessions: num(r.sessions), uv: num(r.uv), pv: num(r.pv) }
      ])
    );
    const trends = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() + BEIJING_OFFSET_MS - i * 86400000);
      const key = bjKey(Date.now() + BEIJING_OFFSET_MS - i * 86400000);
      const hit = trendMap.get(key) || { sessions: 0, uv: 0, pv: 0 };
      trends.push({
        date: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
        ...hit
      });
    }

    // 关键页面到达（简化的转化漏斗）：从页面浏览事件里数「到过该步骤的会话数」
    const pvWhere = { createdAt: { [Op.gte]: rangeStart(req.query.range) } };
    const [reachedMarket, reachedDetail, reachedAction] = await Promise.all([
      countDistinctSessions({
        ...pvWhere,
        [Op.or]: [{ path: '/' }, { path: '/products' }, { path: { [Op.like]: '/products?%' } }]
      }),
      countDistinctSessions({ ...pvWhere, path: { [Op.like]: '/products/%' } }),
      countDistinctSessions({
        ...pvWhere,
        [Op.or]: [{ path: { [Op.like]: '/publish%' } }, { path: { [Op.like]: '/orders%' } }]
      })
    ]);

    res.json(
      success({
        pv: num(agg && agg.pv),
        uv: num(agg && agg.uv),
        sessions: num(agg && agg.sessions),
        bounceRate: Math.round(num(agg && agg.bounce) * 100),
        avgDuration: Math.round(num(agg && agg.avgDuration)),
        online,
        trends,
        funnel: [
          { label: '进入市场', value: reachedMarket },
          { label: '查看详情', value: reachedDetail },
          { label: '发布或下单', value: reachedAction }
        ]
      })
    );
  } catch (err) {
    res.status(500).json(error('获取访问总览失败'));
  }
};

// ============================================================
// 看板：来源渠道 / 设备 / Top 页面 / 实时在线
// ============================================================
exports.sources = async (req, res) => {
  try {
    const rows = await VisitSession.findAll({
      attributes: [
        'sourceChannel',
        [fn('COUNT', col('id')), 'sessions'],
        [fn('COUNT', fn('DISTINCT', col('visitor_id'))), 'uv']
      ],
      where: baseWhere(req.query),
      group: ['sourceChannel'],
      raw: true
    });
    const list = rows
      .map((r) => ({ name: r.sourceChannel || '直接访问', sessions: num(r.sessions), uv: num(r.uv) }))
      .sort((a, b) => b.sessions - a.sessions);
    res.json(success(list));
  } catch (err) {
    res.status(500).json(error('获取来源分布失败'));
  }
};

exports.devices = async (req, res) => {
  try {
    const where = baseWhere(req.query);

    /**
     * 按某个字段分组计数。
     * 显式写列名 + 别名：raw 查询下 Sequelize 不一定把 device_model 映射回 deviceModel，
     * 加别名可以保证结果对象的键就是属性名。
     */
    const groupCount = async (column, key, options = {}) => {
      const rows = await VisitSession.findAll({
        attributes: [[col(column), key], [fn('COUNT', col('id')), 'count']],
        where,
        group: [col(column)],
        raw: true
      });
      let list = rows
        .map((r) => ({ name: r[key] || '', count: num(r.count) }))
        // 型号字段大量为空（PC、UA 被缩减、旧记录），空值不该占一个「未知」条目
        .filter((i) => (options.excludeEmpty ? !!i.name : true))
        .map((i) => ({ name: i.name || '未知', count: i.count }))
        .sort((a, b) => b.count - a.count);
      if (options.limit) list = list.slice(0, options.limit);
      return list;
    };

    // 机型要额外带品牌（拼出「Xiaomi 2211133C」），所以两个列一起取出来再按代码合并计数。
    // 同一个代码理论上可能落到不同品牌值上，合并时取第一个非空的。
    const modelRows = await VisitSession.findAll({
      attributes: [
        [col('device_model'), 'deviceModel'],
        [col('device_brand'), 'deviceBrand'],
        [fn('COUNT', col('id')), 'count']
      ],
      where,
      group: [col('device_model'), col('device_brand')],
      raw: true
    });
    const modelMap = new Map();
    modelRows.forEach((r) => {
      const code = r.deviceModel;
      if (!code) return; // PC、UA 被缩减、旧记录都会是空
      const cur = modelMap.get(code) || { code, count: 0, brand: '' };
      cur.count += num(r.count);
      if (!cur.brand && r.deviceBrand) cur.brand = r.deviceBrand;
      modelMap.set(code, cur);
    });

    const aliasMap = await getAliasMap();
    const model = Array.from(modelMap.values())
      .sort((a, b) => b.count - a.count)
      // 机型长尾很长，取前 8 就够看出主流机型
      .slice(0, 8)
      .map((m) => ({
        code: m.code,
        count: m.count,
        // aliased=true 表示已经命名过，前端就不再显示「命名」入口
        aliased: aliasMap.has(m.code),
        label: aliasMap.get(m.code) || (m.brand ? `${m.brand} ${m.code}` : m.code)
      }));

    const [device, os, browser] = await Promise.all([
      groupCount('device', 'device'),
      groupCount('os', 'os'),
      groupCount('browser', 'browser')
    ]);

    res.json(success({
      device,
      os,
      browser: capWithRest(browser, BROWSER_LIMIT),
      model
    }));
  } catch (err) {
    res.status(500).json(error('获取设备分布失败'));
  }
};

exports.pages = async (req, res) => {
  try {
    // 不 JOIN 会话表过滤爬虫：事件只由执行了 JS 的浏览器上报，爬虫天然不会产生事件
    const rows = await VisitEvent.findAll({
      attributes: [
        'path',
        [fn('COUNT', col('id')), 'views'],
        [fn('COUNT', fn('DISTINCT', col('session_id'))), 'sessions']
      ],
      where: { createdAt: { [Op.gte]: rangeStart(req.query.range) } },
      group: ['path'],
      raw: true
    });
    const list = rows
      .map((r) => ({ path: r.path, views: num(r.views), sessions: num(r.sessions) }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 12);
    res.json(success(list));
  } catch (err) {
    res.status(500).json(error('获取热门页面失败'));
  }
};

exports.realtime = async (req, res) => {
  try {
    const rows = await VisitSession.findAll({
      where: { isBot: 0, lastActiveAt: { [Op.gte]: new Date(Date.now() - 5 * 60 * 1000) } },
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'username'], required: false }],
      order: [['lastActiveAt', 'DESC']],
      limit: 30
    });
    const resolve = await buildResolver();

    res.json(
      success(
        rows.map((s) => ({
          id: s.id,
          lastActiveAt: s.lastActiveAt,
          ip: s.ip || s.ipMasked,
          location: formatLocation(s),
          device: s.device,
          deviceModel: s.deviceModel,
          deviceBrand: s.deviceBrand,
          label: resolve(s),
          os: s.os,
          browser: s.browser,
          sourceChannel: s.sourceChannel,
          currentPath: s.exitPath,
          pageviews: s.pageviews,
          duration: s.duration,
          user: s.user ? { id: s.user.id, name: s.user.nickname || s.user.username } : null
        }))
      )
    );
  } catch (err) {
    res.status(500).json(error('获取实时访问失败'));
  }
};

// ============================================================
// 地区分布（按省聚合，附带该省访问最多的几个市）
// ============================================================
exports.regions = async (req, res) => {
  try {
    const rows = await VisitSession.findAll({
      attributes: ['province', 'city', [fn('COUNT', col('id')), 'sessions']],
      where: baseWhere(req.query),
      group: ['province', 'city'],
      raw: true
    });

    const map = new Map();
    rows.forEach((r) => {
      const isPrivate = !r.province && r.city === '内网';
      const name = r.province || (isPrivate ? '内网 / 本机' : '未知地区');
      const cur = map.get(name) || { name, sessions: 0, cities: [] };
      cur.sessions += num(r.sessions);
      if (r.city && r.city !== '内网') {
        const hit = cur.cities.find((c) => c.name === r.city);
        if (hit) hit.count += num(r.sessions);
        else cur.cities.push({ name: r.city, count: num(r.sessions) });
      }
      map.set(name, cur);
    });

    // 这里只给「会话数」不给 UV：同一访客可能在同省两个市都被记一次，
    // 按省相加 UV 会重复计算，与其给个偏大的数字不如不给。
    const list = Array.from(map.values())
      .map((v) => ({
        name: v.name,
        sessions: v.sessions,
        cities: v.cities
          .sort((a, b) => b.count - a.count)
          .slice(0, 3)
          .map((c) => c.name)
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8);

    res.json(success(list));
  } catch (err) {
    res.status(500).json(error('获取地区分布失败'));
  }
};

// ============================================================
// 会话明细列表
// ============================================================
exports.sessions = async (req, res) => {
  try {
    const { page, pageSize } = parsePagination(req.query);
    const where = baseWhere(req.query);

    if (req.query.keyword) {
      const kw = String(req.query.keyword).slice(0, 64);
      where[Op.and] = [
        {
          [Op.or]: [
            // ip 是完整明文，ipMasked 是补列之前的旧记录兜底，两个都要能搜到
            { ip: { [Op.like]: `%${kw}%` } },
            { ipMasked: { [Op.like]: `%${kw}%` } },
            { province: { [Op.like]: `%${kw}%` } },
            { city: { [Op.like]: `%${kw}%` } },
            { entryPath: { [Op.like]: `%${kw}%` } },
            { exitPath: { [Op.like]: `%${kw}%` } },
            { browser: { [Op.like]: `%${kw}%` } }
          ]
        }
      ];
    }
    if (req.query.device) where.device = req.query.device;
    if (req.query.channel) where.sourceChannel = req.query.channel;

    const resolve = await buildResolver();

    const result = await VisitSession.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'nickname', 'username'], required: false }],
      order: [['startedAt', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      distinct: true
    });

    const payload = {
      count: result.count,
      rows: result.rows.map((s) => {
        const j = s.toJSON();
        delete j.ipEncrypted; // 密文不下发，前端只用 ip 明文
        // 补列之前采集的旧记录 ip 为空，退回脱敏值，避免列表出现空白
        j.ip = j.ip || j.ipMasked || null;
        j.location = formatLocation(j);
        // 统一算好的设备显示名：别名 > 品牌+型号 > 型号 > 设备类型
        j.label = resolve(s);
        if (j.user) j.user = { id: j.user.id, name: j.user.nickname || j.user.username };
        return j;
      })
    };
    res.json(paginate(payload, page, pageSize));
  } catch (err) {
    res.status(500).json(error('获取访问明细失败'));
  }
};

// ============================================================
// 清理访问明细
// ============================================================

const BEIJING_MS = 8 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' → 该日北京时间 00:00 对应的时刻 */
function beijingDayStart(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || '').trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - BEIJING_MS);
}

/**
 * 把清理条件翻译成 Sequelize 的 where。
 *
 * 时间范围六选一：today / 7d / 30d / 90d / custom（配 startDate + endDate）/ all。
 * 用户与 IP 是可叠加的附加条件，支持「只按条件删」的用法（timePreset=all + 只给 IP）。
 *
 * @throws {Error} 条件不合法时抛出，由调用方转成 400
 */
async function buildCleanWhere(q = {}) {
  const where = {};
  const preset = String(q.timePreset || '90d');

  if (preset === 'all') {
    // 不加时间条件，即全程
  } else if (preset === 'custom') {
    const from = beijingDayStart(q.startDate);
    const to = beijingDayStart(q.endDate);
    if (!from && !to) throw new Error('请至少选择一个日期');
    if (from && to && to < from) throw new Error('结束日期不能早于开始日期');
    where.startedAt = {};
    if (from) where.startedAt[Op.gte] = from;
    // 结束日期当天整天都算在内，所以取次日 00:00 作为开区间上界
    if (to) where.startedAt[Op.lt] = new Date(to.getTime() + 86400000);
  } else {
    const days = preset === 'today' ? 1 : preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    const bj = new Date(Date.now() + BEIJING_MS);
    const midnight = new Date(
      Date.UTC(bj.getUTCFullYear(), bj.getUTCMonth(), bj.getUTCDate()) - BEIJING_MS
    );
    where.startedAt = { [Op.gte]: new Date(midnight.getTime() - (days - 1) * 86400000) };
  }

  if (q.userKeyword && String(q.userKeyword).trim()) {
    const kw = String(q.userKeyword).trim().slice(0, 50);
    const users = await User.findAll({
      where: {
        [Op.or]: [
          { username: { [Op.like]: `%${kw}%` } },
          { nickname: { [Op.like]: `%${kw}%` } },
          { studentId: { [Op.like]: `%${kw}%` } }
        ]
      },
      attributes: ['id'],
      raw: true,
      limit: 500
    });
    if (!users.length) throw new Error(`没有匹配到用户「${kw}」`);
    where.userId = { [Op.in]: users.map((u) => u.id) };
  }

  if (q.ip && String(q.ip).trim()) {
    // 用前缀匹配：填 223.104. 就能一次清掉整个网段的记录
    const ip = String(q.ip).trim().slice(0, 45);
    where.ip = { [Op.like]: `${ip}%` };
  }

  return where;
}

// 导出供校验脚本单测（路由不会用到它）
exports.buildCleanWhere = buildCleanWhere;

/** 预览：只数不删，供前端做二次确认 */
exports.cleanPreview = async (req, res) => {
  try {
    let where;
    try {
      where = await buildCleanWhere(req.query);
    } catch (e) {
      return res.status(400).json(error(e.message));
    }

    const sessions = await VisitSession.count({ where });
    let events = 0;
    if (sessions > 0) {
      // 用 JOIN 数，避免把上万个 id 塞进 IN 列表
      events = await VisitEvent.count({
        include: [{ model: VisitSession, as: 'session', attributes: [], where, required: true }],
        distinct: true
      });
    }

    res.json(success({ sessions, events }));
  } catch (err) {
    res.status(500).json(error('预览失败'));
  }
};

exports.clean = async (req, res) => {
  try {
    let where;
    try {
      where = await buildCleanWhere(req.query);
    } catch (e) {
      return res.status(400).json(error(e.message));
    }

    // 防呆：空 where = 清空整张表。要求调用方显式带上 confirmAll=1，
    // 避免一个写错参数的请求（或一个陈旧的书签）就把全部历史静默删光。
    if (Object.keys(where).length === 0 && String(req.query.confirmAll) !== '1') {
      return res.status(400).json(error('这是「清空全部」操作，需要二次确认参数'));
    }

    const BATCH = 1000;
    let sessionTotal = 0;
    let eventTotal = 0;

    // 分批删：一条 DELETE 里塞上万个 id 会超长，也会长时间锁表
    for (let round = 0; round < 500; round++) {
      const rows = await VisitSession.findAll({
        attributes: ['id'],
        where,
        limit: BATCH,
        raw: true
      });
      if (!rows.length) break;
      const ids = rows.map((r) => r.id);
      eventTotal += await VisitEvent.destroy({ where: { sessionId: { [Op.in]: ids } } });
      sessionTotal += await VisitSession.destroy({ where: { id: { [Op.in]: ids } } });
      if (rows.length < BATCH) break;
    }

    // 删掉的会话可能还留在采集端的内存缓存里，
    // 不清掉的话这些访客要等 30 分钟会话过期才会重新建记录
    try {
      require('../middleware/visitCollect').clearCache();
    } catch (e) {
      /* 缓存清理失败不影响删除结果 */
    }

    // 破坏性操作留痕
    console.info(
      `[访问分析·清理留痕] 管理员#${req.user.id} 于 ${new Date().toISOString()} 清理条件 ${JSON.stringify(
        req.query
      )}，删除 ${sessionTotal} 条会话 / ${eventTotal} 条浏览记录`
    );

    res.json(
      success(
        { sessions: sessionTotal, events: eventTotal },
        `已清理 ${sessionTotal} 条会话、${eventTotal} 条浏览记录`
      )
    );
  } catch (err) {
    res.status(500).json(error('清理失败'));
  }
};

// ============================================================
// 机型别名
//
// 厂商只在 UA 里写内部型号代码（2211133C），不写市场名（小米 13）——
// 实测过两个主流识别库都到不了市场名，这个映射没有任何权威数据源，
// 所以只能由管理员命名一次，之后所有地方都用这个名字显示。
// ============================================================
const toAliasList = (rows) => rows.map((r) => ({ modelCode: r.modelCode, alias: r.alias }));

exports.aliases = async (req, res) => {
  try {
    const rows = await DeviceModelAlias.findAll({ order: [['modelCode', 'ASC']] });
    res.json(success(toAliasList(rows)));
  } catch (err) {
    res.status(500).json(error('获取机型别名失败'));
  }
};

exports.saveAlias = async (req, res) => {
  try {
    const modelCode = String((req.body && req.body.modelCode) || '').trim().slice(0, 64);
    const alias = String((req.body && req.body.alias) || '').trim().slice(0, 64);
    if (!modelCode) return res.status(400).json(error('缺少型号代码'));

    if (!alias) {
      // 别名传空 = 取消命名，恢复显示原始代码
      await DeviceModelAlias.destroy({ where: { modelCode } });
    } else {
      const [row, created] = await DeviceModelAlias.findOrCreate({
        where: { modelCode },
        defaults: { alias, operatorId: req.user.id }
      });
      if (!created) await row.update({ alias, operatorId: req.user.id });
    }

    // 别名走内存缓存，改完必须失效，否则要等到重启才生效
    invalidate();

    console.info(
      `[访问分析·命名留痕] 管理员#${req.user.id} ${alias ? `把 ${modelCode} 命名为「${alias}」` : `取消了 ${modelCode} 的命名`}`
    );

    const rows = await DeviceModelAlias.findAll({ order: [['modelCode', 'ASC']] });
    res.json(success(toAliasList(rows), alias ? `已命名为「${alias}」` : '已取消命名'));
  } catch (err) {
    res.status(500).json(error('保存机型别名失败'));
  }
};
