// 用户状态管理(Pinia)：登录、获取个人信息、登出、本地持久化
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, getProfile } from '@/api'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)

  const isLoggedIn = computed(() => !!user.value)

  // 登录
  async function login(loginData) {
    const res = await loginApi(loginData)
    user.value = res.data.user
    localStorage.setItem('user', JSON.stringify({ ...res.data.user, token: res.data.token }))
    return res
  }

  // 获取用户信息
  async function fetchProfile() {
    try {
      const res = await getProfile()
      // 保留原 token：后端返回的 user 对象不含 token，直接覆盖会导致 token 丢失、刷新后被迫重新登录
      const saved = localStorage.getItem('user')
      const token = saved ? JSON.parse(saved).token : null
      user.value = res.data
      localStorage.setItem('user', JSON.stringify({ ...res.data, token }))
    } catch (err) {
      logout()
    }
  }

  // 退出登录
  async function logout() {
    user.value = null
    localStorage.removeItem('user')
  }

  // 初始化 - 从localStorage恢复用户信息
  function init() {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      user.value = JSON.parse(savedUser)
    }
  }

  return {
    user,
    isLoggedIn,
    login,
    fetchProfile,
    logout,
    init
  }
})
