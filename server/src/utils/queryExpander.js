const { Op } = require('sequelize');
const { Category } = require('../models');
const {
  SYNONYM_BY_WORD,
  SYNONYM_BY_GROUP,
  CATEGORY_ALIAS_BY_NAME,
  normalize
} = require('./searchDict');

/**
 * 检索词扩展器（Query Expansion）
 *
 * 解决的问题：原来只做 `title LIKE '%帽子%'`，而商品叫「棒球帽」——
 * 中文里「帽子」和「棒球帽」字面互不包含，导致明明有货却搜不到。
 *
 * 词典来源：`./searchDict` 里的代码常量（不走数据库，见该文件顶部说明）。
 *
 * 两条并行分支：
 *
 * 分支一 · 同义词组（处理"并列同义"）
 *   level 0 —— 用户原词，最高优先级
 *   level 1 —— 词典同义词组（含"词根再查词典"一跳）
 *   level 2 —— 虚化后缀剥离得到的词根，仅兜底
 *   例：搜「帽子」→ 帽 / 棒球帽 / 鸭舌帽 → 命中「New Era/纽亦华 920棒球帽」
 *       搜「相机」→ 大疆 / 云台 / 微单 → 命中「DJI/大疆 Pocket4」
 *
 * 分支二 · 品类词 → 分类（处理"上下位关系"）
 *   level 3 —— 命中分类，权重最低
 *   同义词组表达不了「化妆品 ⊃ 香水」这种包含关系，
 *   这类上位词直接映射到分类，把整个分类的在售商品召回。
 *   例：搜「乐器」→ 分类「乐器」→ 吉他 / 架子鼓
 *       搜「化妆品」→ 分类「美妆护肤」→ 粉饼 / 香水 / 精华
 */

// 虚化后缀：剥离后得到词根（「帽子」→「帽」、「鞋子」→「鞋」）
// 注意：只收纯虚化字，刻意不收「机 / 器 / 品 / 款」等实义语素，
// 否则「相机」会被剥成「相」，命中一堆无关商品，属于过度召回。
const WEAK_SUFFIXES = ['子', '儿', '头', '们', '巴'];

const MAX_EXPAND_TERMS = 14;      // 单次扩展词上限，防止 SQL 条件过长
const DICT_CACHE_TTL = 5 * 60 * 1000;   // 词典内存缓存 5 分钟
const CATEGORY_LEVEL = 3;         // 分类命中的相关度层级（数值最大 = 排最后）

/**
 * 缓存：同义词组与品类别名来自代码常量（见 searchDict.js），进程内恒定，无需缓存；
 * 只有「分类名 → id」需要查库，管理员改分类后要能看到变化，故保留 TTL。
 */
let cache = {
  at: 0,
  byWord: SYNONYM_BY_WORD,
  byGroup: SYNONYM_BY_GROUP,
  aliasToCat: new Map(),
  categories: [],
  catNameById: new Map()
};

/**
 * 剥离虚化后缀取词根。
 * 长度需 >= 2（「帽子」可剥，「帽」不再剥），剥离后至少留 1 个字。
 */
function stripWeakSuffix(word) {
  if (word.length < 2) return null;
  const last = word[word.length - 1];
  if (!WEAK_SUFFIXES.includes(last)) return null;
  const root = word.slice(0, -1);
  return root.length >= 1 ? root : null;
}

/** 转义 LIKE 通配符，避免用户输入的 % _ 被当成通配符导致全表命中 */
function escapeLike(str) {
  return str.replace(/[\\%_]/g, (m) => '\\' + m);
}

/**
 * 加载词典到内存。
 *
 * 同义词组与品类别名都是**代码常量**，无需查库；这里只解析一件事：
 * 把「按分类名配置的品类别名」翻译成真实的 categoryId（分类 id 是库里的）。
 * 分类查询失败也不抛，只是分支二（品类词召回）降级为空，搜索本身照常工作。
 */
async function loadDict(force = false) {
  const now = Date.now();
  if (!force && cache.at && now - cache.at < DICT_CACHE_TTL) {
    return cache;
  }

  const categories = [];
  const catNameById = new Map();
  const aliasToCat = new Map();

  try {
    // 分类名本身直接参与匹配，无需人工配置
    const catRows = await Category.findAll({ attributes: ['id', 'name'], where: { status: 1 } });

    for (const row of catRows) {
      const name = normalize(row.name);
      if (!name) continue;
      categories.push({ id: row.id, name });
      catNameById.set(row.id, row.name);
    }

    // 品类别名按「分类名」配置，这里解析成真实 id —— 分类改名后依然能对上
    const missing = [];
    for (const [catName, words] of CATEGORY_ALIAS_BY_NAME) {
      const target = catRows.find((row) => normalize(row.name) === normalize(catName));
      if (!target) {
        missing.push(catName);
        continue;
      }
      for (const word of words) aliasToCat.set(word, target.id);
    }
    if (missing.length) {
      console.warn(`[queryExpander] 以下分类在数据库中不存在，已跳过其别名：${missing.join('、')}`);
    }
  } catch (err) {
    console.warn('[queryExpander] 分类表读取失败，已跳过分类匹配：', err.message);
  }

  cache = {
    at: now,
    byWord: SYNONYM_BY_WORD,
    byGroup: SYNONYM_BY_GROUP,
    aliasToCat,
    categories,
    catNameById
  };
  return cache;
}

/** 清掉缓存，让分类改动立即生效（同义词是常量，本来就不需要刷新） */
function clearDictCache() {
  cache = {
    at: 0,
    byWord: SYNONYM_BY_WORD,
    byGroup: SYNONYM_BY_GROUP,
    aliasToCat: new Map(),
    categories: [],
    catNameById: new Map()
  };
}

/**
 * 分支二：把关键词匹配到分类。
 * 两种来源：① 人工维护的品类词别名 ② 分类名本身（相等 / 互相包含）
 * @returns {Map<number,string>} categoryId -> 分类名
 */
function matchCategories(keyword, dict) {
  const hits = new Map();

  const aliasCatId = dict.aliasToCat.get(keyword);
  if (aliasCatId != null) {
    hits.set(aliasCatId, dict.catNameById.get(aliasCatId) || '');
  }

  // 分类名匹配：要求关键词至少 2 个字，避免「品」「用」这类单字把整类商品捞出来。
  //
  // 关键：只做「精确 / 前缀 / 后缀」匹配，**不做中间子串匹配**。
  // 因为分类名是复合词，「服饰鞋包」里含「鞋」字——若放开子串匹配，
  // 搜「鞋」会把短袖、棒球帽一起捞出来，属于明显回归。
  // 前缀后缀能覆盖「美妆→美妆护肤」「用品→生活用品」，又不会误伤。
  if (keyword.length >= 2) {
    for (const cat of dict.categories) {
      if (!cat.name) continue;
      const matched =
        cat.name === keyword ||
        cat.name.startsWith(keyword) ||
        cat.name.endsWith(keyword) ||
        keyword.includes(cat.name);   // 反方向：长句里含完整分类名
      if (matched) {
        hits.set(cat.id, dict.catNameById.get(cat.id) || '');
      }
    }
  }

  return hits;
}

/**
 * 把用户输入扩展成「检索词 + 关联分类」。
 * @param {string} rawKeyword 用户原始输入
 * @returns {Promise<{keyword:string, terms:Array<{word:string,level:number}>, expanded:string[], categoryIds:number[], categoryLabels:string[], dictReady:boolean}>}
 */
async function expandKeyword(rawKeyword) {
  const keyword = normalize(rawKeyword);
  if (!keyword) {
    return {
      keyword: '',
      terms: [],
      expanded: [],
      categoryIds: [],
      categoryLabels: [],
      dictReady: true
    };
  }

  const terms = new Map();  // word -> level
  const add = (word, level) => {
    if (!word) return;
    const prev = terms.get(word);
    if (prev === undefined || prev > level) terms.set(word, level);
  };

  // level 0：原词永远保留，且优先级最高
  add(keyword, 0);

  // 词典来自代码常量，恒可用；loadDict 内部已吞掉分类查询异常，
  // 最坏情况只是缺分支二（品类词召回），不影响同义词与词根扩展。
  const dict = await loadDict();

  const root = stripWeakSuffix(keyword);
  let categoryHits = new Map();

  // ① 词典直接命中：整组词一起召回
  const groupId = dict.byWord.get(keyword);
  if (groupId != null) {
    for (const word of dict.byGroup.get(groupId) || []) add(word, 1);
  }

  // ② 词根再查一次词典：「帽子」若未单独收录，用「帽」兜一层
  if (root) {
    const rootGroupId = dict.byWord.get(root);
    if (rootGroupId != null) {
      for (const word of dict.byGroup.get(rootGroupId) || []) add(word, 1);
    }
  }

  // ③ 分支二：品类词 → 分类
  categoryHits = matchCategories(keyword, dict);

  // ④ 词根降级：最低优先级，只在前面都搜不到时才会体现在结果尾部
  if (root) add(root, 2);

  const list = Array.from(terms.entries())
    .map(([word, level]) => ({ word, level }))
    .sort((a, b) => a.level - b.level || a.word.length - b.word.length)
    .slice(0, MAX_EXPAND_TERMS);

  const categoryIds = Array.from(categoryHits.keys());

  return {
    keyword,
    terms: list,
    expanded: list.filter((t) => t.level > 0).map((t) => t.word),
    categoryIds,
    categoryLabels: categoryIds.map((id) => categoryHits.get(id)).filter(Boolean),
    dictReady: true
  };
}

/**
 * 构造关键字 WHERE 条件（标题 / 描述 任一命中即可）。
 * 用 Op.or 铺开所有扩展词，单次查询完成，分页总数才准确。
 * 命中分类时，额外把该分类下的商品纳入召回。
 */
function buildKeywordWhere(terms, categoryIds = []) {
  const or = [];
  for (const { word } of terms) {
    const pattern = `%${escapeLike(word)}%`;
    or.push({ title: { [Op.like]: pattern } });
    or.push({ description: { [Op.like]: pattern } });
  }

  const safeIds = categoryIds.filter((id) => Number.isInteger(id));
  if (safeIds.length) {
    or.push({ categoryId: { [Op.in]: safeIds } });
  }

  return or;
}

/**
 * 构造相关度排序表达式（数值越小越靠前）：
 *   原词命中标题 0 / 原词命中描述 1
 *   同义词命中标题 2 / 同义词命中描述 3
 *   词根命中标题 4 / 词根命中描述 5
 *   命中分类 6（最宽泛，排最后）
 * 扩展后召回面变宽，必须靠它把"精确命中"顶到最前面，
 * 否则「棒球帽」会淹在一堆弱相关结果里。
 */
function buildRelevanceOrder(sequelize, terms, categoryIds = []) {
  const cases = [];

  for (const { word, level } of terms) {
    const pattern = sequelize.escape(`%${escapeLike(word)}%`);
    cases.push(`WHEN title LIKE ${pattern} THEN ${level * 2}`);
    cases.push(`WHEN description LIKE ${pattern} THEN ${level * 2 + 1}`);
  }

  const safeIds = categoryIds.filter((id) => Number.isInteger(id));
  if (safeIds.length) {
    cases.push(`WHEN category_id IN (${safeIds.join(',')}) THEN ${CATEGORY_LEVEL * 2}`);
  }

  if (!cases.length) return null;

  // CASE 按书写顺序取第一个命中分支：terms 已按 level 升序，
  // 且分类分支写在最后，因此"文字精确命中"永远优先于"分类兜底命中"
  return sequelize.literal(`CASE ${cases.join(' ')} ELSE 99 END`);
}

module.exports = {
  expandKeyword,
  buildKeywordWhere,
  buildRelevanceOrder,
  clearDictCache,
  stripWeakSuffix,
  escapeLike,
  WEAK_SUFFIXES,
  CATEGORY_LEVEL
};
