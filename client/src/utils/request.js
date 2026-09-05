// Axios 请求封装：baseURL配置、token拦截器、响应拦截器、错误统一处理
import axios from 'axios'
import { ElMessage } from 'element-plus'

const request = axios.create({
  // 生产构建时由 client/.env.production 的 VITE_API_URL 注入绝对地址；
  // 本地 npm run dev 时该变量为空，回退到 '/api'，由 Vite 代理转发到本地后端。
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000
})

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
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    const res = response.data
    if (res.code === 200) {
      return res
    } else {
      ElMessage.error(res.message || '操作失败')
      return Promise.reject(res)
    }
  },
  error => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem('user')
        ElMessage.error('登录已过期，请重新登录')
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
      } else {
        const msg = error.response.data?.message || '请求失败'
        ElMessage.error(msg)
      }
    } else {
      ElMessage.error('网络异常')
    }
    return Promise.reject(error)
  }
)

export default request
