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
      // ===== Tab 页布局层 =====
      // 所有「该有底部悬浮 Tab 栏」的页面都挂在这一层的 children 下，
      // TabLayout 只负责：渲染常驻的 FloatTabBar + 给内容底部留出胶囊的高度。
      {
        path: '',
        component: () => import('@/views/TabLayout.vue'),
        children: [
          { path: '', name: 'Home', component: () => import('@/views/Home.vue') },
          { path: 'products', name: 'ProductList', component: () => import('@/views/ProductList.vue') },
          { path: 'products/:id', name: 'ProductDetail', component: () => import('@/views/ProductDetail.vue') },
          // 卖家公开主页：无需登录即可查看（买家建立信任用）
          { path: 'user/:id', name: 'UserProfile', component: () => import('@/views/UserProfile.vue') },
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
          { path: 'profile', name: 'Profile', component: () => import('@/views/Profile.vue'), meta: { requireAuth: true } },
          {
            path: 'me',
            name: 'MyCenter',
            component: () => import('@/views/MyCenter.vue'),
            meta: { requireAuth: true },
            // 「我的」聚合页是移动端专用（PC 的入口在头像下拉里）。
            // PC 端直接访问该地址时重定向到个人信息页，避免桌面上出现为手机设计的页面
            beforeEnter: () => (window.innerWidth > 768 ? { path: '/profile' } : true)
          }
        ]
      },

      // ===== Tab children 之外的页面：不渲染悬浮 Tab 栏 =====
      // 发布/编辑页（输入框唤起键盘时不会被 Tab 栏顶起来）
      { path: 'publish', name: 'Publish', component: () => import('@/views/Publish.vue'), meta: { requireAuth: true } },
      { path: 'publish/:id', name: 'PublishEdit', component: () => import('@/views/Publish.vue'), meta: { requireAuth: true } }
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
      { path: 'categories', name: 'AdminCategories', component: () => import('@/views/admin/CategoryManage.vue') },
      // 隐藏入口：侧边栏连点头像三下 + 密码校验通过后才会出现在菜单里（见 AdminLayout.vue）
      { path: 'visit-analysis', name: 'AdminVisitAnalysis', component: () => import('@/views/admin/VisitAnalysis.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  // 浏览器「后退/前进」时还原离开前的滚动位置；普通跳转仍回顶部。
  // 注意：savedPosition 只在 popstate（后退/前进）导航时才有值。
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      // Layout.vue 的页面过渡是 fade-slide + mode="out-in"（0.35s）。
      // 过渡未结束时目标页还没挂载、文档高度接近 0，直接滚会滚不动，
      // 所以等过渡播完再还原。数字略大于 350ms 留一点余量。
      return new Promise((resolve) => {
        setTimeout(() => resolve(savedPosition), 420)
      })
    }
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
  UserProfile: '卖家主页',
  Publish: '发布闲置',
  PublishEdit: '编辑商品',
  MyProducts: '我的商品',
  Favorites: '我的收藏',
  Orders: '我的订单',
  Messages: '消息中心',
  Chat: '对话',
  Profile: '个人中心',
  MyCenter: '我的',
  Login: '登录',
  Register: '注册',
  AdminDashboard: '数据看板',
  AdminUsers: '用户管理',
  AdminProducts: '商品管理',
  AdminOrders: '订单管理',
  AdminCategories: '分类管理',
  AdminVisitAnalysis: '访问分析'
}

router.afterEach((to) => {
  const title = TITLES[to.name] || ''
  document.title = title ? `${title} · 乐购-校园闲置交易平台` : '乐购-校园闲置交易平台'
})

export default router
