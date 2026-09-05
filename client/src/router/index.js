// 路由配置：页面路由定义、懒加载、路由守卫、动态页面标题
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'
import Login from '@/views/Login.vue'
import Register from '@/views/Register.vue'

const routes = [
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    children: [
      { path: '', name: 'Home', component: () => import('@/views/Home.vue') },
      { path: 'products', name: 'ProductList', component: () => import('@/views/ProductList.vue') },
      { path: 'products/:id', name: 'ProductDetail', component: () => import('@/views/ProductDetail.vue') },
      { path: 'publish', name: 'Publish', component: () => import('@/views/Publish.vue'), meta: { requireAuth: true } },
      { path: 'publish/:id', name: 'PublishEdit', component: () => import('@/views/Publish.vue'), meta: { requireAuth: true } },
      { path: 'my-products', name: 'MyProducts', component: () => import('@/views/MyProducts.vue'), meta: { requireAuth: true } },
      { path: 'favorites', name: 'Favorites', component: () => import('@/views/Favorites.vue'), meta: { requireAuth: true } },
      { path: 'orders', name: 'Orders', component: () => import('@/views/Orders.vue'), meta: { requireAuth: true } },
      {
        path: 'messages',
        component: () => import('@/views/messages/MessagesLayout.vue'),
        meta: { requireAuth: true },
        children: [
          { path: '', name: 'Messages', component: () => import('@/views/messages/ChatEmpty.vue') },
          { path: ':userId', name: 'Chat', component: () => import('@/views/Chat.vue') }
        ]
      },
      { path: 'profile', name: 'Profile', component: () => import('@/views/Profile.vue'), meta: { requireAuth: true } }
    ]
  },
  { path: '/login', name: 'Login', component: Login },
  { path: '/register', name: 'Register', component: Register },
  {
    path: '/admin',
    component: () => import('@/views/admin/AdminLayout.vue'),
    meta: { requireAuth: true, requireAdmin: true },
    children: [
      { path: '', name: 'AdminDashboard', component: () => import('@/views/admin/Dashboard.vue') },
      { path: 'users', name: 'AdminUsers', component: () => import('@/views/admin/UserManage.vue') },
      { path: 'products', name: 'AdminProducts', component: () => import('@/views/admin/ProductManage.vue') },
      { path: 'orders', name: 'AdminOrders', component: () => import('@/views/admin/OrderManage.vue') },
      { path: 'categories', name: 'AdminCategories', component: () => import('@/views/admin/CategoryManage.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()
  
  if (to.meta.requireAuth && !userStore.isLoggedIn) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.meta.requireAdmin && userStore.user?.role !== 'admin') {
    next({ name: 'Home' })
  } else {
    next()
  }
})

// 页面标题
const TITLES = {
  Home: '首页',
  ProductList: '逛市场',
  ProductDetail: '商品详情',
  Publish: '发布闲置',
  PublishEdit: '编辑商品',
  MyProducts: '我的商品',
  Favorites: '我的收藏',
  Orders: '我的订单',
  Messages: '消息中心',
  Chat: '对话',
  Profile: '个人中心',
  Login: '登录',
  Register: '注册',
  AdminDashboard: '数据看板',
  AdminUsers: '用户管理',
  AdminProducts: '商品管理',
  AdminOrders: '订单管理',
  AdminCategories: '分类管理'
}

router.afterEach((to) => {
  const title = TITLES[to.name] || ''
  document.title = title ? `${title} · 乐购-校园闲置交易平台` : '乐购-校园闲置交易平台'
})

export default router
