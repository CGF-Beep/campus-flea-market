// API 接口统一封装：认证、商品、分类、订单、收藏、消息、后台管理等接口
import request from '@/utils/request'
import { encryptSensitive } from '@/utils/crypto'

// ===== 认证 =====
// 密码/手机号等敏感字段先经 RSA 公钥加密再传输，避免明文被抓包
// 注册（密码、手机号加密）
export const register = async (data) => {
  const payload = { ...data, password: await encryptSensitive(data.password) }
  if (payload.phone) {
    payload.phone = await encryptSensitive(payload.phone)
  }
  return request.post('/auth/register', payload)
}

// 登录（密码加密）
export const login = async (data) => {
  const payload = { ...data, password: await encryptSensitive(data.password) }
  return request.post('/auth/login', payload)
}

export const getProfile = () => request.get('/auth/profile')

// 更新个人资料（手机号加密；null/undefined 不携带该字段，避免后端误判为解密失败）
export const updateProfile = async (data) => {
  const payload = { ...data }
  if (payload.phone === null || payload.phone === undefined) {
    delete payload.phone
  } else if (payload.phone !== '') {
    payload.phone = await encryptSensitive(payload.phone)
  }
  return request.put('/auth/profile', payload)
}

// 修改密码（原密码、新密码加密）
export const changePassword = async (data) => {
  const payload = {
    oldPassword: await encryptSensitive(data.oldPassword),
    newPassword: await encryptSensitive(data.newPassword)
  }
  return request.put('/auth/password', payload)
}

// ===== 商品 =====
export const getProducts = (params) => request.get('/products', { params })
export const getProductDetail = (id) => request.get(`/products/${id}`)
export const createProduct = (data) => request.post('/products', data)
export const updateProduct = (id, data) => request.put(`/products/${id}`, data)
export const removeProduct = (id) => request.delete(`/products/${id}`)
export const deleteProduct = (id) => request.delete(`/products/${id}/permanent`)
export const getMyProducts = (params) => request.get('/my/products', { params })

// ===== 用户公开主页（卖家主页）=====
export const getUserProfile = (id) => request.get(`/users/${id}`)
export const getUserProducts = (id, params) => request.get(`/users/${id}/products`, { params })

// ===== 分类 =====
export const getCategories = () => request.get('/categories')
export const createCategory = (data) => request.post('/categories', data)
export const updateCategory = (id, data) => request.put(`/categories/${id}`, data)
export const deleteCategory = (id) => request.delete(`/categories/${id}`)

// ===== 订单 =====
export const createOrder = (data) => request.post('/orders', data)
export const getMyOrders = (params) => request.get('/my/orders', { params })
export const getOrderDetail = (id) => request.get(`/orders/${id}`)
export const confirmOrder = (id) => request.put(`/orders/${id}/confirm`)
export const receiveOrder = (id) => request.put(`/orders/${id}/receive`)
export const cancelOrder = (id) => request.put(`/orders/${id}/cancel`)
export const deleteOrder = (id) => request.delete(`/orders/${id}`)

// ===== 收藏 =====
export const addFavorite = (productId) => request.post('/favorites', { productId })
export const removeFavorite = (productId) => request.delete(`/favorites/${productId}`)
export const getMyFavorites = (params) => request.get('/my/favorites', { params })

// ===== 消息 =====
export const sendMessage = (data) => request.post('/messages', data)
export const getConversations = () => request.get('/messages/conversations')
export const getUnreadCount = () => request.get('/messages/unread')
export const getChatHistory = (userId, params) => request.get(`/messages/${userId}`, { params })

// ===== 文件上传 =====
export const uploadFile = (formData) => request.post('/upload', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
})

// ===== 后台管理 =====
export const getDashboard = () => request.get('/admin/dashboard')
export const getAdminUsers = (params) => request.get('/admin/users', { params })
export const updateUserStatus = (id, status) => request.put(`/admin/users/${id}/status`, { status })
export const getAdminProducts = (params) => request.get('/admin/products', { params })
export const getAdminOrders = (params) => request.get('/admin/orders', { params })
export const approveProduct = (id) => request.put(`/admin/products/${id}/approve`)
export const rejectProduct = (id, reason) => request.put(`/admin/products/${id}/reject`, { reason })
export const adminCancelOrder = (id) => request.put(`/admin/orders/${id}/cancel`)

// ===== 后台访问分析 =====
export const getVisitOverview = (params) => request.get('/admin/visit/overview', { params })
export const getVisitSources = (params) => request.get('/admin/visit/sources', { params })
export const getVisitDevices = (params) => request.get('/admin/visit/devices', { params })
export const getVisitPages = (params) => request.get('/admin/visit/pages', { params })
export const getVisitRegions = (params) => request.get('/admin/visit/regions', { params })
export const getVisitRealtime = () => request.get('/admin/visit/realtime')
export const getVisitSessions = (params) => request.get('/admin/visit/sessions', { params })
// 机型别名：厂商只在 UA 里写型号代码不写市场名，所以由管理员命名一次，之后全局生效
export const getVisitAliases = () => request.get('/admin/visit/aliases')
export const saveVisitAlias = (data) => request.put('/admin/visit/aliases', data)
// 清理前先预览会删掉多少条（只数不删）
export const getVisitCleanPreview = (params) => request.get('/admin/visit/clean/preview', { params })
// params: timePreset(today/7d/30d/90d/custom/all) + startDate/endDate + userKeyword + ip
export const cleanVisitLogs = (params) => request.delete('/admin/visit/clean', { params })
