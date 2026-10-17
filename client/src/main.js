// 应用入口：Vue实例创建、Pinia/全局样式注册
// Element Plus 改为按需引入（见 vite.config.js 的 AutoImport + Components），
// 这里不再全量注册组件/图标，也不再引入 element-plus/dist/index.css
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'
import { initAnalytics } from './utils/analytics'
import './styles/global.css'

const app = createApp(App)

const pinia = createPinia()
app.use(pinia)

// 关键：在路由守卫执行前，先从 localStorage 恢复登录状态，避免刷新后被误判为未登录
const userStore = useUserStore(pinia)
userStore.init()

// 访问埋点：必须在 app.use(router) 之前注册钩子 ——
// router 的首次导航是在 install 时触发的，注册晚了会漏掉首屏那一次浏览
initAnalytics(router)

app.use(router)

app.mount('#app')
