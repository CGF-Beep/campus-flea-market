<!-- 全局布局框架：顶部毛玻璃导航栏、主内容区、页脚、联系弹窗 -->
<template>
  <div class="layout">
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
          <a data-tab-item class="nav-link" :class="{ active: $route.path === '/products' }" @click="$router.push('/products')">市场</a>
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
                    <el-dropdown-item command="me">
                      <el-icon><User /></el-icon> 我的主页
                    </el-dropdown-item>
                    <el-dropdown-item command="profile">
                      <el-icon><Postcard /></el-icon> 我的信息
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

        <!-- 移动端发布入口（仅 ≤768px 显示）：
             原先是底部悬浮栏左侧那个圆钮，挪到顶栏右侧。
             现在做成 iOS 顶栏那种"裸加号"：无底色、近黑、线宽加粗（点按有浅灰反馈） -->
        <button class="header-publish" type="button" aria-label="发布闲置" @click="$router.push('/publish')">
          <!-- 自绘描边加号（不用图标库的实心 Plus），线宽可控 -->
          <svg class="header-publish-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
            <path d="M12 5.2v13.6M5.2 12h13.6" />
          </svg>
        </button>
      </div>
    </header>

    <!-- 主内容区 -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade-slide" mode="out-in">
          <!-- 只缓存「浏览型」列表页：从商品详情返回时不再重新请求、也不丢滚动位置。
               其余页面（订单 / 收藏 / 我的商品…）不进缓存，保证每次进入都是新数据。 -->
          <keep-alive :include="cachedViews">
            <component :is="Component" />
          </keep-alive>
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

    <!-- 移动端底部导航已抽走：现在由 views/TabLayout.vue（tab 页布局层）渲染
         components/FloatTabBar.vue（悬浮胶囊），发布页在 tab children 之外，天然不显示 -->

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
              <div class="drawer-item" @click="drawerAction('me')"><el-icon><User /></el-icon>我的主页</div>
              <div class="drawer-item" @click="drawerAction('profile')"><el-icon><Postcard /></el-icon>我的信息</div>
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
    <el-dialog
      v-model="contactVisible"
      width="520px"
      align-center
      class="contact-dialog"
    >
      <template #header>
        <div class="contact-head">
          <h3 class="contact-title">联系我们</h3>
          <p class="contact-sub">有任何问题，欢迎通过以下方式联系我们</p>
        </div>
      </template>

      <div class="contact-content">
        <div class="contact-item">
          <div class="contact-icon icon-mail"><el-icon :size="18"><Message /></el-icon></div>
          <div class="contact-text">
            <p class="contact-label">开发者邮箱</p>
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
        <button type="button" class="contact-ok-btn" @click="contactVisible = false">知道了</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getUnreadCount } from '@/api'
import { Plus, ChatDotRound, User, Document, Goods, Star, Setting, SwitchButton, Message, Phone, OfficeBuilding, Service, Close, Postcard } from '@element-plus/icons-vue'
import logoImg from '@/assets/logo.png'
import { useTabSlider } from '@/composables/useTabSlider.js'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const contactVisible = ref(false)
const unreadCount = ref(0)
// 未读角标要给悬浮 Tab 栏用（它挂在 TabLayout 层，拿不到这里的 ref）→ provide 下去
provide('appUnreadCount', unreadCount)
// 移动端汉堡抽屉开关
const menuVisible = ref(false)

// 需要被 <keep-alive> 缓存的页面（值必须与各页面 defineOptions({ name }) 一致）
// - TabLayout：tab 页布局层。缓存它 = 连它内部的页面缓存一起保住，
//   这样从发布页回来时，列表页不会重新请求、滚动位置也不丢（页面缓存见 TabLayout.vue）
const cachedViews = ['TabLayout']

// 顶部导航滑块动画
const navItems = [
  { path: '/', label: '首页' },
  { path: '/products', label: '市场' }
]
const activeNavIndex = computed(() => navItems.findIndex((item) => item.path === route.path))
const { containerRef: navLinksRef, sliderStyle: navSliderStyle, updateSlider: updateNavSlider } = useTabSlider()
watch(activeNavIndex, updateNavSlider)

const showContact = () => {
  contactVisible.value = true
}

const handleCommand = async (command) => {
  switch (command) {
    case 'me':
      // 「我的主页」= 自己的公开卖家主页（与买家看到的页面完全一致）
      if (userStore.user?.id) router.push(`/user/${userStore.user.id}`)
      break
    case 'profile': router.push('/profile'); break
    case 'orders': router.push('/orders'); break
    case 'myProducts': router.push('/my-products'); break
    case 'favorites': router.push('/favorites'); break
    case 'admin': router.push('/admin'); break
    case 'logout':
      // 二次确认：退出后需重新登录，避免下拉菜单误触
      try {
        await ElMessageBox.confirm('确定要退出当前账号吗？', '退出登录', {
          type: 'warning',
          confirmButtonText: '确定',
          cancelButtonText: '取消'
        })
      } catch (e) {
        // 用户点了取消：静默返回，不做任何处理
        return
      }
      await userStore.logout()
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

// 底部悬浮胶囊 Tab 栏：已抽到 views/TabLayout.vue + components/FloatTabBar.vue。
// 那边用 router-link 的 active-class 自动判高亮、也自带京东式回顶，
// 这里不再需要 isTabActive / showMobileTabBar 这些只为旧 TabBar 服务的逻辑。

// 未读消息轮询：跨境链路上每次请求都要几百毫秒，所以尽量少发
//  - 页面切到后台时不请求（省流量、也避免无谓的失败日志）
//  - 同一时刻只允许一个在途请求
//  - 回到前台立刻补一次，保证角标及时
let unreadTimer = null
let unreadPending = false

const fetchUnread = async () => {
  if (!userStore.isLoggedIn) return
  if (document.visibilityState !== 'visible') return
  if (unreadPending) return
  unreadPending = true
  try {
    const res = await getUnreadCount()
    unreadCount.value = res.data.count
  } catch (e) {
    /* 静默失败：下个周期会重试 */
  } finally {
    unreadPending = false
  }
}

onMounted(() => {
  fetchUnread()
  unreadTimer = setInterval(fetchUnread, 60000)
  document.addEventListener('visibilitychange', fetchUnread)
  updateNavSlider(activeNavIndex.value)
})

onUnmounted(() => {
  if (unreadTimer) clearInterval(unreadTimer)
  document.removeEventListener('visibilitychange', fetchUnread)
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
.contact-head {
  text-align: center;
}

.contact-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--color-text);
}

.contact-sub {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.contact-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 16px;
  /* iOS 的「填充色」：半透明灰叠在毛玻璃底上，比实色卡片更贴玻璃质感 */
  background: rgba(120, 120, 128, 0.07);
  transition: background 0.2s ease;
}

.contact-item:hover {
  background: rgba(120, 120, 128, 0.11);
}

/* 图标：圆角方形色块 + 同色图标（iOS 设置页写法） */
.contact-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-mail { color: #0071e3; background: rgba(0, 113, 227, 0.11); }
.icon-phone { color: #ff9500; background: rgba(255, 149, 0, 0.13); }
.icon-office { color: #34c759; background: rgba(52, 199, 89, 0.13); }

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
  line-height: 1.4;
  /* 按词换行即可，避免邮箱/地址被 break-all 从任意字符处截断 */
  word-break: break-word;
  user-select: text;
}

/* 主按钮：扁平实色（替换原蓝色渐变），与全站 iOS 风格一致 */
.contact-ok-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 14px;
  background: var(--color-primary);
  color: #FFFFFF;
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.contact-ok-btn:hover {
  background: var(--color-primary-hover);
}

.contact-ok-btn:active {
  transform: scale(0.98);
}

/* ================================================================
   移动端适配（≤768px）
   - 顶部：仅保留 logo + 汉堡按钮（原导航收敛到悬浮 Tab 栏 / 抽屉）
   - 底部：悬浮胶囊 Tab 栏由 views/TabLayout.vue 渲染（不在这里）
   ================================================================ */
/* 移动端顶栏的发布入口：默认桌面隐藏，移动端 @media 内显示 */
.header-publish {
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
  /* 顶栏发布按钮：无底色 + 近黑加号（iOS 顶栏那种"裸图标"按钮）。
     保留 34px 的点击热区；margin-left:auto 把它推到右侧（导航区在移动端隐藏，汉堡已删） */
  .header-publish {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    width: 34px;
    height: 34px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;
  }

  .header-publish:active {
    transform: scale(0.92);
    background: rgba(0, 0, 0, 0.06);
  }

  .header-publish-icon {
    width: 20px;
    height: 20px;
    display: block;
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

  /* 页脚隐藏，由底部悬浮胶囊 Tab 栏承担 */
  .footer {
    display: none;
  }

  /* 原「贴边 TabBar」的样式已随组件一起移除：
     现在底部导航是 views/TabLayout.vue 里的悬浮胶囊（components/FloatTabBar.vue） */

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
  background: rgba(255, 255, 255, 0.72) !important;
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
  padding: 26px 28px 0;
  margin: 0;
}

/* 关闭按钮：Element Plus 默认是贴角 48px 的方形热区（无任何视觉），
   在圆角卡片上会显得"飘"在角落，这里收敛成右上角 30px 圆形按钮并补上悬停反馈 */
.contact-dialog .el-dialog__headerbtn {
  top: 16px;
  right: 16px;
  width: 30px;
  height: 30px;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease;
}

.contact-dialog .el-dialog__headerbtn:hover {
  background: rgba(120, 120, 128, 0.12);
}

.contact-dialog .el-dialog__headerbtn .el-dialog__close {
  color: var(--color-text-tertiary);
  font-size: 16px;
  transition: color 0.2s ease;
}

.contact-dialog .el-dialog__headerbtn:hover .el-dialog__close {
  color: var(--color-text);
}

.contact-dialog .el-dialog__body {
  padding: 18px 28px 8px;
}

.contact-dialog .el-dialog__footer {
  padding: 4px 28px 24px;
}

/* 移动端：收紧左右留白，减少地址栏折行 */
@media (max-width: 768px) {
  .contact-dialog .el-dialog__header {
    padding: 24px 22px 0;
  }
  .contact-dialog .el-dialog__headerbtn {
    top: 12px;
    right: 10px;
  }
  .contact-dialog .el-dialog__body {
    padding: 16px 22px 6px;
  }
  .contact-dialog .el-dialog__footer {
    padding: 4px 22px 22px;
  }
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
