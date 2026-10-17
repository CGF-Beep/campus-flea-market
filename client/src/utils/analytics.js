/**
 * 访问埋点 SDK（无依赖，约 2KB）
 *
 * 为什么需要它：前端是 Vue SPA，站内切页面走的是前端路由，
 * 不产生任何后端请求 —— 纯服务端日志根本看不见「用户访问了哪些页面」。
 * 所以页面级浏览必须由前端上报，服务端只负责维护会话与设备信息。
 *
 * 移动端是重点考虑对象（本项目主要用户是手机端学生）：
 *   1. 微信内置浏览器 / iOS Safari 切后台或锁屏时 beforeunload 不触发，
 *      必须靠 visibilitychange + pagehide 兜底补报停留时长，否则「平均停留」会系统性偏短。
 *   2. 移动网络抖动频繁，上报一律静默失败，绝不弹错、绝不重试堆积。
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api'
const ENDPOINT = `${API_BASE}/visit/report`

// 后台页面不上报：管理员看一次报表就多一条 PV，会把真实用户数据稀释掉。
// 服务端中间件同样跳过 /api/admin/*，两边口径保持一致。
const ADMIN_PREFIX = '/admin'

// 单页停留上限 30 分钟：挂着页面去吃个饭，不该把「平均停留」拉成几小时
const MAX_STAY_MS = 30 * 60 * 1000
// 停留不足 1 秒的补报没有意义，只会产生噪声
const MIN_STAY_MS = 1000
// 切后台时 visibilitychange 与 pagehide 可能连着触发，做一次合并
const FLUSH_DEDUP_MS = 800

// document.referrer / utm_source 只在首次进入时有意义，SPA 内部跳转不会更新它们
let firstReferrer = ''
let firstUtm = ''

// 设备型号：Chrome 110 起推行 UA 缩减，安卓 UA 里的型号被替换成占位符 `K`，
// 只有 UA-CH（客户端提示）这个浏览器 API 还能拿到真型号，所以在前端取一次带给后端。
// Safari / Firefox 不支持它 —— 但 iPhone 本来也只显示 "iPhone"，没有损失。
// 取不到时后端还有 UA 解析兜底（微信内置浏览器等未跟进缩减的 UA 仍带着型号）。
let deviceModel = ''

function loadDeviceModel() {
  try {
    const uaData = navigator.userAgentData
    if (!uaData || typeof uaData.getHighEntropyValues !== 'function') return
    uaData
      .getHighEntropyValues(['model'])
      .then((v) => {
        if (v && v.model) deviceModel = String(v.model).slice(0, 64)
      })
      .catch(() => {})
  } catch (e) {
    /* 不支持就算了，不影响统计 */
  }
}

let currentPath = null
let enteredAt = 0
let lastFlushAt = 0
let inited = false

function post(body) {
  // 用 text/plain 承载 JSON：它属于 CORS 安全列表内的类型，跨域时不会触发预检，
  // sendBeacon 才能正常发出（application/json 会被预检挡住，而 beacon 无法处理预检）。
  const blob = new Blob([body], { type: 'text/plain;charset=UTF-8' })
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, blob)) return
  } catch (e) {
    /* 落到下面的 fetch 兜底 */
  }
  try {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body,
      keepalive: true
    }).catch(() => {})
  } catch (e) {
    /* 上报失败静默，绝不影响页面 */
  }
}

function send(payload) {
  try {
    post(JSON.stringify(payload))
  } catch (e) {
    /* 静默 */
  }
}

function trackPageView(to) {
  const fullPath = to.fullPath || to.path || '/'
  const path = fullPath.split('?')[0].split('#')[0]

  if (path.startsWith(ADMIN_PREFIX)) {
    // 进入后台时丢弃计时，离开后台后的第一次上报不应带上后台的停留时间
    currentPath = null
    return
  }

  const prevStay = currentPath ? Math.min(Date.now() - enteredAt, MAX_STAY_MS) : 0

  send({
    path,
    title: document.title,
    referrer: firstReferrer,
    utm: firstUtm,
    prevStay,
    deviceModel,
    screen: `${window.innerWidth}x${window.innerHeight}`,
    lang: navigator.language || ''
  })

  currentPath = path
  enteredAt = Date.now()
}

/** 补报当前页停留时长（只更新时长，不新增页面浏览，避免 PV 算重） */
function flushStay() {
  if (!currentPath) return
  const now = Date.now()
  if (now - lastFlushAt < FLUSH_DEDUP_MS) return
  const stay = Math.min(now - enteredAt, MAX_STAY_MS)
  if (stay < MIN_STAY_MS) return
  lastFlushAt = now
  enteredAt = now
  // 这是离开前最后一次上报机会，顺带把型号带上（UA-CH 可能到这时才拿到）
  send({ path: currentPath, stayOnly: true, prevStay: stay, deviceModel })
}

/**
 * 在 app.use(router) 之前调用：router 的首次导航发生在 install 时，
 * 钩子注册晚了会漏掉首屏那一次浏览。
 */
export function initAnalytics(router) {
  if (inited || typeof window === 'undefined') return
  inited = true

  try {
    firstReferrer = document.referrer || ''
    firstUtm = new URLSearchParams(window.location.search).get('utm_source') || ''
  } catch (e) {
    firstReferrer = ''
    firstUtm = ''
  }

  // 尽早发起：UA-CH 是异步的，早点拿到就能赶在第一次页面浏览之前带上
  loadDeviceModel()

  router.afterEach((to) => {
    // 让 router/index.js 里的 afterEach 先把 document.title 写好再取
    setTimeout(() => trackPageView(to), 0)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushStay()
  })

  // iOS Safari / 微信内切走时 pagehide 比 beforeunload 可靠得多
  window.addEventListener('pagehide', flushStay)
}

export default { initAnalytics }
