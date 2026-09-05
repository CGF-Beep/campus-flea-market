// 应用入口：Vue实例创建、Pinia/ElementPlus/全局样式注册
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import { useUserStore } from './stores/user'
import './styles/global.css'

const app = createApp(App)

// 注册所有Element Plus图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

const pinia = createPinia()
app.use(pinia)

// 关键：在路由守卫执行前，先从 localStorage 恢复登录状态，避免刷新后被误判为未登录
const userStore = useUserStore(pinia)
userStore.init()

app.use(router)
app.use(ElementPlus)

app.mount('#app')
