<!-- 全局布局框架：顶部毛玻璃导航栏、主内容区、页脚、联系弹窗 -->
<template>
  <div class="layout" :class="{ 'has-mobile-tabbar': showMobileTabBar }">
    <!-- 顶部导航栏 - Apple风格毛玻璃 -->
    <header class="header glass">
      <div class="container header-content">
        <div class="logo" @click="$router.push('/')">
          <img :src="logoImg" class="logo-img" alt="logo" />
          <span class="logo-text">乐购-校园闲置</span>
        </div>

        <nav ref="navLinksRef" class="nav-links">
          <div class="nav-link-slider" :style="navSliderStyle"></div>
          <a data-tab-item class="nav-link" :class="{ active: $route.path === '/' }" @click="$router.push('/')">首页</a>
          <a data-tab-item class="nav-link" :class="{ active: $route.path === '/products' }" @click="$router.push('/products')">逛市场</a>
        </nav>

        <div class="nav-actions">
          <template v-if="userStore.isLoggedIn">
            <el-badge :value="unreadCount" :max="99" :hidden="unreadCount === 0">
              <div class="nav-icon-btn" @click="$router.push('/messages')">
                <el-icon :size="20"><ChatDotRound /></el-icon>
                <span class="nav-icon-label">消息</span>
              </div>
            </el-badge>
            <div class="nav-icon-btn" @click="showContact">
              <el-icon :size="20"><Service /></el-icon>
              <span class="nav-icon-label">联系我们</span>
            </div>
            <div class="publish-btn" @click="$router.push('/publish')">
              <el-icon><Plus /></el-icon>
              <span>发布</span>
            </div>
            <el-dropdown @command="handleCommand" trigger="click">
              <div class="user-avatar">
                <el-avatar :size="36" :src="userStore.user?.avatar || '/uploads/default-avatar.svg'">
                  <span class="avatar-fallback">{{ (userStore.user?.nickname || '用')[0] }}</span>
                </el-avatar>
              </div>
              <template #dropdown>
                <el-dropdown-menu class="user-dropdown-menu">
                  <div class="dropdown-user-card">
                    <el-avatar :size="44" :src="userStore.user?.avatar || '/uploads/default-avatar.svg'">
                      <span class="avatar-fallback">{{ (userStore.user?.nickname || '用')[0] }}</span>
                    </el-avatar>
                    <div class="dropdown-user-info">
                      <span class="dropdown-username">{{ userStore.user?.nickname || userStore.user?.username }}</span>
                      <span class="dropdown-user-role">{{ userStore.user?.role === 'admin' ? '系统管理员' : '普通用户' }}</span>
                    </div>
                  </div>
                  <div class="dropdown-group">
                    <el-dropdown-item command="profile">
                      <el-icon><User /></el-icon> 个人中心
                    </el-dropdown-item>
                    <el-dropdown-item command="orders">
                      <el-icon><Document /></el-icon> 我的订单
                    </el-dropdown-item>
                    <el-dropdown-item command="myProducts">
                      <el-icon><Goods /></el-icon> 我的商品
                    </el-dropdown-item>
                    <el-dropdown-item command="favorites">
                      <el-icon><Star /></el-icon> 我的收藏
                    </el-dropdown-item>
                  </div>
                  <div class="dropdown-group" v-if="userStore.user?.role === 'admin'">
                    <el-dropdown-item command="admin">
                      <el-icon><Setting /></el-icon> 后台管理
                    </el-dropdown-item>
                  </div>
                  <div class="dropdown-group dropdown-group-last">
                    <el-dropdown-item class="dropdown-logout" command="logout">
                      <el-icon><SwitchButton /></el-icon> 退出登录
                    </el-dropdown-item>
                  </div>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <div class="auth-btns">
              <button class="btn-login" @click="$router.push('/login')">登录</button>
              <button class="btn-register" @click="$router.push('/register')">注册</button>
            </div>
          </template>
        </div>

        <!-- 移动端汉堡菜单按钮（仅 ≤768px 显示） -->
        <div class="menu-btn" @click="menuVisible = true" aria-label="打开菜单">
          <el-icon :size="22"><Menu /></el-icon>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- 底部 -->
    <footer class="footer">
      <div class="container footer-content">
        <div class="footer-brand">
          <div class="footer-logo-row">
            <img :src="logoImg" class="footer-logo-img" alt="logo" />
            <span class="footer-logo-text">乐购-校园闲置交易平台</span>
          </div>
          <p>让闲置流动起来</p>
        </div>
        <div class="footer-info">
          <p>CGF设计项目</p>
          <p>© 2026 Campus Flea Market</p>
        </div>
      </div>
    </footer>

    <!-- ===== 移动端底部导航栏（仅 ≤768px 显示） ===== -->
    <nav v-if="showMobileTabBar" class="mobile-tabbar">
      <div class="tab-item" :class="{ active: isTabActive('/') }" @click="mobileGo('/')">
        <el-icon :size="21"><HomeFilled /></el-icon>
        <span>首页</span>
      </div>
      <div class="tab-item" :class="{ active: isTabActive('/products') }" @click="mobileGo('/products')">
        <el-icon :size="21"><ShoppingBag /></el-icon>
        <span>逛市场</span>
      </div>
      <div class="tab-item tab-publish" @click="mobileGo('/publish')">
        <div class="tab-publish-circle">
          <el-icon :size="24"><Plus /></el-icon>
        </div>
      </div>
      <div class="tab-item" :class="{ active: isTabActive('/messages') }" @click="mobileGo('/messages')">
        <el-badge :value="unreadCount" :max="99" :hidden="unreadCount === 0" class="tab-badge">
          <el-icon :size="21"><ChatDotRound /></el-icon>
        </el-badge>
        <span>消息</span>
      </div>
      <div class="tab-item" :class="{ active: isTabActive('/profile') }" @click="mobileGo('/profile')">
        <el-icon :size="21"><User /></el-icon>
        <span>我的</span>
      </div>
    </nav>

    <!-- ===== 移动端汉堡抽屉菜单 ===== -->
    <transition name="drawer-fade">
      <div v-if="menuVisible" class="drawer-overlay" @click="menuVisible = false">
        <div class="drawer-panel" @click.stop>
          <div class="drawer-head">
            <template v-if="userStore.isLoggedIn">
              <el-avatar :size="52" :src="userStore.user?.avatar || '/uploads/default-avatar.svg'">
                <span class="avatar-fallback">{{ (userStore.user?.nickname || '用')[0] }}</span>
              </el-avatar>
              <div class="drawer-user-info">
                <span class="drawer-username">{{ userStore.user?.nickname || userStore.user?.username }}</span>
                <span class="drawer-user-role">{{ userStore.user?.role === 'admin' ? '系统管理员' : '普通用户' }}</span>
              </div>
            </template>
            <template v-else>
              <div class="drawer-auth-btns">
                <button class="btn-login" @click="mobileGo('/login')">登录</button>
                <button class="btn-register" @click="mobileGo('/register')">注册</button>
              </div>
            </template>
            <div class="drawer-close" @click="menuVisible = false">
              <el-icon :size="20"><Close /></el-icon>
            </div>
          </div>

          <template v-if="userStore.isLoggedIn">
            <div class="drawer-group">
              <div class="drawer-item" @click="drawerAction('profile')"><el-icon><User /></el-icon>个人中心</div>
              <div class="drawer-item" @click="drawerAction('orders')"><el-icon><Document /></el-icon>我的订单</div>
              <div class="drawer-item" @click="drawerAction('myProducts')"><el-icon><Goods /></el-icon>我的商品</div>
              <div class="drawer-item" @click="drawerAction('favorites')"><el-icon><Star /></el-icon>我的收藏</div>
            </div>
            <div class="drawer-group" v-if="userStore.user?.role === 'admin'">
              <div class="drawer-item" @click="drawerAction('admin')"><el-icon><Setting /></el-icon>后台管理</div>
            </div>
          </template>

          <div class="drawer-group">
            <div class="drawer-item" @click="contactFromMenu"><el-icon><Service /></el-icon>联系我们</div>
          </div>

          <div class="drawer-group drawer-group-last" v-if="userStore.isLoggedIn">
            <div class="drawer-item drawer-logout" @click="drawerAction('logout')"><el-icon><SwitchButton /></el-icon>退出登录</div>
          </div>
        </div>
      </div>
    </transition>

    <!-- 联系我们弹窗 -->
    <el-dialog v-model="contactVisible" title="联系我们" width="520px" class="contact-dialog">
      <p class="contact-sub">有任何问题，欢迎通过以下方式联系我们</p>
      <div class="contact-content">
        <div class="contact-item">
          <div class="contact-icon icon-mail"><el-icon :size="18"><Message /></el-icon></div>
          <div class="contact-text">
            <p class="contact-label">开发者联邮箱</p>
            <p class="contact-value">www_by@outlook.com</p>
          </div>
        </div>
        <div class="contact-item">
          <div class="contact-icon icon-phone"><el-icon :size="18"><Phone /></el-icon></div>
          <div class="contact-text">
            <p class="contact-label">电话热线</p>
            <p class="contact-value">暂未开通，请通过邮箱联系</p>
          </div>
        </div>
        <div class="contact-item">
          <div class="contact-icon icon-office"><el-icon :size="18"><OfficeBuilding /></el-icon></div>
          <div class="contact-text">
            <p class="contact-label">办公地址</p>
            <p class="contact-value">长沙市芙蓉区解放西路188号 T1栋</p>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" round class="contact-ok-btn" @click="contactVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getUnreadCount } from '@/api'
import { Plus, ChatDotRound, User, Document, Goods, Star, Setting, SwitchButton, Message, Phone, OfficeBuilding, Service, Menu, Close, HomeFilled, ShoppingBag } from '@element-plus/icons-vue'
import logoImg from '@/assets/logo.png'
import { useTabSlider } from '@/composables/useTabSlider.js'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const contactVisible = ref(false)
const unreadCount = ref(0)
// 移动端汉堡抽屉开关
const menuVisible = ref(false)

// 顶部导航滑块动画
const navItems = [
  { path: '/', label: '首页' },
  { path: '/products', label: '逛市场' }
]
const activeNavIndex = computed(() => navItems.findIndex((item) => item.path === route.path))
const { containerRef: navLinksRef, sliderStyle: navSliderStyle, updateSlider: updateNavSlider } = useTabSlider()
watch(activeNavIndex, updateNavSlider)

const showContact = () => {
  contactVisible.value = true
}

const handleCommand = (command) => {
  switch (command) {
    case 'profile': router.push('/profile'); break
    case 'orders': router.push('/orders'); break
    case 'myProducts': router.push('/my-products'); break
    case 'favorites': router.push('/favorites'); break
    case 'admin': router.push('/admin'); break
    case 'logout': 
      userStore.logout()
      router.push('/')
      break
  }
}

// ===== 移动端：底部导航跳转（未登录时由路由守卫带去登录页） =====
const mobileGo = (path) => {
  menuVisible.value = false
  if (route.path === path) return
  router.push(path)
}

// 抽屉菜单点击：关闭抽屉后复用桌面端同一套跳转逻辑
const drawerAction = (command) => {
  menuVisible.value = false
  handleCommand(command)
}

const contactFromMenu = () => {
  menuVisible.value = false
  contactVisible.value = true
}

// 判断底部 Tab 是否高亮
const isTabActive = (tab) => {
  const p = route.path
  if (tab === '/') return p === '/'
  if (tab === '/products') return p === '/products' || p.startsWith('/products/')
  if (tab === '/messages') return p === '/messages' || p.startsWith('/messages/')
  if (tab === '/profile') return ['/profile', '/my-products', '/favorites', '/orders'].includes(p)
  return false
}

// 需要"全屏专注"的页面隐藏底部栏：
//  - /messages/:userId 聊天对话页
//  - /publish、/publish/:id 发布/编辑页（输入框唤起键盘时 TabBar 会被顶起跳动）
const showMobileTabBar = computed(() => {
  const p = route.path
  if (/^\/messages\/.+/.test(p)) return false
  if (p === '/publish' || p.startsWith('/publish/')) return false
  return true
})

const fetchUnread = async () => {
  if (userStore.isLoggedIn) {
    try {
      const res = await getUnreadCount()
      unreadCount.value = res.data.count
    } catch (e) { /* ignore */ }
  }
}

onMounted(() => {
  fetchUnread()
  setInterval(fetchUnread, 30000)
  updateNavSlider(activeNavIndex.value)
})

// 路由切换后刷新未读数（看完消息回来角标即时更新）
watch(() => route.path, () => {
  fetchUnread()
})
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  /* 动态视口（跟随手机地址栏/工具栏收展），减少底部元素跳动；不支持的浏览器回退到 100vh */
  min-height: 100dvh;
  background: var(--color-bg-secondary);
}

/* ===== Header ===== */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.header-content {
  display: flex;
  align-items: center;
  height: 64px;
  gap: 24px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  white-space: nowrap;
  transition: transform 0.3s ease;
}

.logo:hover {
  transform: scale(1.03);
}

.logo-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  border-radius: 50%;
}

.logo-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.nav-links {
  display: flex;
  gap: 4px;
  position: relative;
}

.nav-link-slider {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 980px;
  background: rgba(0, 0, 0, 0.06);
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  z-index: 0;
  pointer-events: none;
}

.nav-link {
  position: relative;
  padding: 8px 16px;
  border-radius: 980px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.3s ease;
  z-index: 1;
}

.nav-link:hover {
  color: var(--color-text);
}

.nav-link.active {
  color: var(--color-text);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--color-text-secondary);
}

.icon-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

.nav-icon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: var(--color-text-secondary);
}

.nav-icon-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

.nav-icon-label {
  font-size: 11px;
  font-weight: 500;
}

.publish-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 980px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.publish-btn:hover {
  background: var(--color-primary-hover);
  transform: scale(1.03);
}

.user-avatar {
  cursor: pointer;
  transition: transform 0.3s ease;
}

.avatar-fallback {
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.user-avatar:hover {
  transform: scale(1.08);
}

.auth-btns {
  display: flex;
  gap: 12px;
}

.btn-login {
  padding: 8px 24px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 980px;
  transition: all 0.3s ease;
}

.btn-login:hover {
  color: var(--color-text);
  background: rgba(0, 0, 0, 0.04);
}

.btn-register {
  padding: 8px 24px;
  border: none;
  background: var(--color-text);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 980px;
  transition: all 0.3s ease;
}

.btn-register:hover {
  transform: scale(1.03);
  opacity: 0.9;
}

/* ===== Main ===== */
.main-content {
  flex: 1;
}

/* ===== Footer ===== */
.footer {
  background: var(--color-bg);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 48px 0;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.footer-logo-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.footer-logo-img {
  width: 28px;
  height: 28px;
  object-fit: contain;
  border-radius: 50%;
}

.footer-logo-text {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.footer-brand p {
  margin-top: 8px;
  font-size: 14px;
  color: var(--color-text-tertiary);
}

.footer-info {
  text-align: right;
}

.footer-info p {
  font-size: 13px;
  color: var(--color-text-tertiary);
  line-height: 1.8;
}

/* ===== 联系我们弹窗 ===== */
.contact-sub {
  text-align: center;
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin: -6px 0 18px;
}

.contact-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--color-bg-secondary);
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  transition: all 0.25s ease;
}

.contact-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.07);
  border-color: rgba(0, 113, 227, 0.18);
}

.contact-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.icon-mail { color: #0071e3; }
.icon-phone { color: #ff6b00; }
.icon-office { color: #34c759; }

.contact-text {
  min-width: 0;
}

.contact-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-bottom: 3px;
}

.contact-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  word-break: break-all;
}

.contact-ok-btn {
  width: 100%;
  height: 44px !important;
  border: none !important;
  background: linear-gradient(135deg, #0071e3, #5ac8fa) !important;
  font-weight: 600 !important;
}

.contact-ok-btn:hover {
  opacity: 0.9;
}

/* ================================================================
   移动端适配（≤768px）
   - 顶部：仅保留 logo + 汉堡按钮（原导航收敛到底部 TabBar / 抽屉）
   - 底部：iOS 风格毛玻璃 TabBar，中间凸起发布按钮
   ================================================================ */
.menu-btn {
  display: none;
}

.mobile-tabbar {
  display: none;
}

/* 抽屉遮罩 + 面板 */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: min(320px, 86vw);
  height: 100%;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: saturate(180%) blur(30px);
  -webkit-backdrop-filter: saturate(180%) blur(30px);
  border-left: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.8),
    0 0 60px rgba(0, 0, 0, 0.16);
  padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.drawer-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 4px 18px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  margin-bottom: 6px;
  position: relative;
}

.drawer-user-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.drawer-username {
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 170px;
}

.drawer-user-role {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.drawer-auth-btns {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.drawer-close {
  position: absolute;
  top: 6px;
  right: 4px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  background: rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.25s ease;
}

.drawer-close:active {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(0.92);
}

.drawer-group {
  padding: 4px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.drawer-group-last {
  border-bottom: none;
}

.drawer-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 12px;
  border-radius: 14px;
  font-size: 15px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.drawer-item .el-icon {
  font-size: 18px;
  color: var(--color-text-tertiary);
  transition: color 0.2s ease;
}

.drawer-item:active {
  background: var(--color-bg-secondary);
}

.drawer-logout {
  color: #ef4444 !important;
}

.drawer-logout .el-icon {
  color: #ef4444 !important;
}

/* 抽屉淡入淡出 */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.28s ease;
}

.drawer-fade-enter-active .drawer-panel {
  animation: drawerSlideIn 0.32s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

@keyframes drawerSlideIn {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@media (max-width: 768px) {
  .menu-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    color: var(--color-text);
    cursor: pointer;
    transition: all 0.25s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .menu-btn:active {
    background: rgba(0, 0, 0, 0.06);
    transform: scale(0.92);
  }

  .header-content {
    height: 56px;
    gap: 12px;
  }

  .logo-text {
    font-size: 16px;
  }

  /* 原顶部导航收敛：文字导航 + 右侧操作区隐藏 */
  .nav-links,
  .nav-actions {
    display: none !important;
  }

  .header {
    flex-shrink: 0;
  }

  /* App-Shell：页面在 main 内部滚动（body 不滚），
     避免切页/滚动触发手机浏览器地址栏收展把底部 TabBar 顶得上下跳动 */
  .layout {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    padding-bottom: 0;
  }

  .main-content {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-y: contain;
  }

  /* 页脚隐藏，由底部 TabBar 承担 */
  .footer {
    display: none;
  }

  /* 底部导航栏：流内元素（不再 fixed），随 App-Shell 底部定位 */
  .mobile-tabbar {
    display: flex;
    position: relative;
    flex-shrink: 0;
    z-index: 120;
    height: calc(56px + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: saturate(180%) blur(24px);
    -webkit-backdrop-filter: saturate(180%) blur(24px);
    border-top: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.04);
  }

  .tab-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 500;
    color: var(--color-text-tertiary);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.25s ease;
    position: relative;
  }

  .tab-item.active {
    color: var(--color-primary);
  }

  .tab-item .el-icon {
    transition: transform 0.25s ease;
  }

  .tab-item.active .el-icon {
    transform: translateY(-1px) scale(1.06);
  }

  .tab-publish {
    position: relative;
  }

  /* 中间「+」发布按钮：圆形凸起，浮在 tabbar 上方 */
  .tab-publish-circle {
    position: absolute;
    top: -17px;
    left: 50%;
    transform: translateX(-50%);
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0071e3, #5ac8fa);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 20px rgba(0, 113, 227, 0.4);
    border: 3px solid var(--color-bg-secondary);
    transition: transform 0.25s ease, box-shadow 0.25s ease;
  }

  .tab-publish:active .tab-publish-circle {
    transform: translateX(-50%) scale(0.92);
  }

  .tab-badge :deep(.el-badge__content) {
    border: none;
    font-size: 10px;
    height: 16px;
    line-height: 16px;
    padding: 0 4px;
    min-width: 16px;
  }

  /* 联系我们弹窗移动端宽度 */
  .contact-dialog {
    width: 92vw !important;
  }
}
</style>

<style>
/* 联系我们弹窗容器（Element Plus dialog 挂载到 body，需全局覆盖） */
.contact-dialog {
  border-radius: 24px !important;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: saturate(180%) blur(30px);
  -webkit-backdrop-filter: saturate(180%) blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.5) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    inset 0 -1px 0 rgba(255, 255, 255, 0.25),
    0 24px 60px rgba(0, 0, 0, 0.14) !important;
  max-width: 90vw;
}

.contact-dialog .el-dialog__header {
  padding: 28px 28px 0;
  text-align: center;
}

.contact-dialog .el-dialog__title {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.contact-dialog .el-dialog__body {
  padding: 20px 32px 10px;
}

.contact-dialog .el-dialog__footer {
  padding: 6px 28px 26px;
}

/* 用户头像下拉菜单高级样式（Element Plus dropdown 挂载到 body，需全局覆盖） */
.user-dropdown-menu {
  padding: 10px !important;
  border-radius: 18px !important;
  background: rgba(255, 255, 255, 0.62) !important;
  backdrop-filter: saturate(180%) blur(30px);
  -webkit-backdrop-filter: saturate(180%) blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.5) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 12px 40px rgba(0, 0, 0, 0.12) !important;
  min-width: 220px !important;
}

.user-dropdown-menu .dropdown-user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 10px 16px;
  margin-bottom: 4px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.user-dropdown-menu .dropdown-user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-dropdown-menu .dropdown-username {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-dropdown-menu .dropdown-user-role {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.user-dropdown-menu .dropdown-group {
  padding: 4px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.user-dropdown-menu .dropdown-group-last {
  border-bottom: none;
}

.user-dropdown-menu .el-dropdown-menu__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px !important;
  border-radius: 12px !important;
  font-size: 14px;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
  line-height: 1.4 !important;
}

.user-dropdown-menu .el-dropdown-menu__item .el-icon {
  font-size: 17px;
  color: var(--color-text-tertiary);
  transition: color 0.2s ease;
}

.user-dropdown-menu .el-dropdown-menu__item:hover {
  background: var(--color-bg-secondary) !important;
  color: var(--color-text) !important;
}

.user-dropdown-menu .el-dropdown-menu__item:hover .el-icon {
  color: var(--color-primary);
}

.user-dropdown-menu .dropdown-logout {
  color: #ef4444 !important;
}

.user-dropdown-menu .dropdown-logout .el-icon {
  color: #ef4444 !important;
}

.user-dropdown-menu .dropdown-logout:hover {
  background: rgba(239, 68, 68, 0.08) !important;
}
</style>
