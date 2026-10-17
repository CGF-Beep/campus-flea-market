// Axios 请求封装：baseURL配置、token拦截器、响应拦截器、错误统一处理
import axios from 'axios'
const request = axios.create({
  // 生产构建时由 client/.env.production 的 VITE_API_URL 注入绝对地址；
  // 本地 npm run dev 时该变量为空，回退到 '/api'，由 Vite 代理转发到本地后端。
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 25000
})

// 「继续等待」模式：默认超时 25 秒；当用户在「加载失败」页点「继续等待」时，
// 由页面调 setLongWait(true) 把这批请求再放宽到 60 秒（用户明确表示愿意等），
// 跑完再调 setLongWait(false) 复位 —— 否则会影响其它页面的请求。
// ⚠️ 取值要明显高于默认超时，否则按钮就没意义了。
const LONG_WAIT_TIMEOUT = 60000
let longWaitMode = false
export function setLongWait(on) {
  longWaitMode = !!on
}

// 请求拦截器 - 自动附加 token
request.interceptors.request.use(
  config => {
    const user = localStorage.getItem('user')
    if (user) {
      const userData = JSON.parse(user)
      if (userData.token) {
        config.headers['Authorization'] = `Bearer ${userData.token}`
      }
    }
    // 7 秒还没回来就先提醒一次（请求结束时会由响应拦截器清掉）
    startSlowTimer(config)
    // 用户点了「继续等待」：这批请求放宽到 60 秒再放弃
    if (longWaitMode) config.timeout = LONG_WAIT_TIMEOUT
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 登录失效只处理一次：同一时刻往往有多个请求同时 401
// （首页会并发拉分类 + 商品，未读数还会在路由切换 / 60s 轮询 / 切回标签页时再发一次），
// 不加这个闸门就会叠出好几个「登录已过期」提示，并挂上多个跳转定时器。
let sessionExpiredHandled = false

// ===== 慢网络的两级提示 =====
// 本站源站部署在香港，大陆访客的数据需跨境传输，高峰时段常落到 7~25 秒区间。
// 拆成两级，各自只弹一次（首页会并发发多个请求，不加闸门会叠出好几条一样的）：
//   ① 请求发出 7 秒还没回来 → 「正在努力加载，请耐心等待」——此时请求还活着，等待才有意义；
//   ② 25 秒超时放弃        → 提示切换运营商，同时页面切换成「加载失败」状态。
const SLOW_LOADING_MS = 7000
const SLOW_HINT_COOLDOWN = 6000
let loadingSlowNotified = false
let slowNetworkNotified = false

// ① 还在加载中：提醒用户别急，别以为卡死了直接把页面关掉
function notifyLoadingSlowly() {
  if (loadingSlowNotified) return
  loadingSlowNotified = true
  setTimeout(() => {
    loadingSlowNotified = false
  }, SLOW_HINT_COOLDOWN)
  ElMessage({
    message: '网络较慢，正在努力加载，请耐心等待…',
    type: 'info',
    duration: 4000,
    showClose: true
  })
}

// ② 已经放弃：给可执行的建议（换运营商），不再喊「耐心等待」——请求已经断了，等不来结果
function notifySlowNetwork() {
  if (slowNetworkNotified) return
  slowNetworkNotified = true
  setTimeout(() => {
    slowNetworkNotified = false
  }, SLOW_HINT_COOLDOWN)
  ElMessage({
    message: '加载未完成，网络可能较慢。可切换运营商（优先移动）后重试',
    type: 'warning',
    duration: 6000,
    showClose: true
  })
}

// 每个请求挂一个「慢加载」计时器：7 秒未返回就先提醒一次。
// 请求结束时（无论成功或失败）必须在响应拦截器里清掉，否则完成之后还会误弹。
function startSlowTimer(config) {
  config.__slowTimer = setTimeout(notifyLoadingSlowly, SLOW_LOADING_MS)
}
function clearSlowTimer(config) {
  if (config && config.__slowTimer) {
    clearTimeout(config.__slowTimer)
    config.__slowTimer = null
  }
}

// 响应拦截器
request.interceptors.response.use(
  response => {
    clearSlowTimer(response.config)
    const res = response.data
    if (res.code === 200) {
      return res
    } else {
      ElMessage.error(res.message || '操作失败')
      return Promise.reject(res)
    }
  },
  error => {
    clearSlowTimer(error.config)
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem('user')
        if (!sessionExpiredHandled) {
          sessionExpiredHandled = true
          ElMessage.error('登录已过期，请重新登录')

          // 带上当前地址，登录后能回到原页面
          // （Login.vue 已支持读取 route.query.redirect，这里补上跳转来源即可）
          const current = window.location.pathname + window.location.search
          const target = current.startsWith('/login')
            ? '/login'
            : `/login?redirect=${encodeURIComponent(current)}`

          setTimeout(() => {
            window.location.href = target
          }, 1500)
        }
      } else {
        const msg = error.response.data?.message || '请求失败'
        ElMessage.error(msg)
      }
    } else if (error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')) {
      // 超时放弃：给出可执行的建议（换运营商），而不是笼统的「网络异常」。
      // 「请耐心等待」放在 7 秒那级（见 notifyLoadingSlowly），此刻请求已断，再说等待是误导。
      notifySlowNetwork()
    } else {
      ElMessage.error('网络异常，请检查网络后重试')
    }
    return Promise.reject(error)
  }
)

export default request
