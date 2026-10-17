<template>
  <div class="admin-layout">
    <!-- 左侧固定侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-inner">
        <!-- 用户信息卡片 -->
        <div class="user-card">
          <div class="user-avatar" @click="handleAvatarClick">
            <img v-if="userStore.user?.avatar" :src="userStore.user.avatar" alt="avatar" />
            <span v-else>{{ userInitial }}</span>
          </div>
          <div class="user-info">
            <div class="user-name">{{ userStore.user?.nickname || userStore.user?.username || '管理员' }}</div>
            <div class="user-role">{{ userStore.user?.role === 'admin' ? '超级管理员' : '管理员' }}</div>
          </div>
        </div>

        <!-- 导航菜单 -->
        <nav class="sidebar-nav" ref="navRef">
          <div class="nav-slider" :style="navSliderStyle"></div>
          <a
            v-for="item in menuItems"
            :key="item.path"
            data-tab-item
            class="nav-item"
            :class="{ active: isActive(item.path) }"
            @click="navigate(item.path)"
          >
            <span class="nav-icon">
              <el-icon :size="20"><component :is="item.icon" /></el-icon>
            </span>
            <span class="nav-label">{{ item.label }}</span>
            <span v-if="item.badge" class="nav-badge">{{ item.badge }}</span>
          </a>
        </nav>

        <!-- 底部返回 -->
        <div class="sidebar-footer">
          <a class="nav-item back-btn" @click="$router.push('/')">
            <span class="nav-icon">
              <el-icon :size="20"><ArrowLeft /></el-icon>
            </span>
            <span class="nav-label">返回前台</span>
          </a>
        </div>
      </div>
    </aside>

    <!-- 移动端顶部 nav（≤768 显示）：用户头像 + 横向 tab + 返回 -->
    <header class="mobile-topnav">
      <div class="topnav-inner">
        <div class="topnav-user">
          <div class="user-avatar-sm" @click="handleAvatarClick">
            <img v-if="userStore.user?.avatar" :src="userStore.user.avatar" alt="avatar" />
            <span v-else>{{ userInitial }}</span>
          </div>
        </div>
        <nav class="topnav-menu">
          <a
            v-for="item in menuItems"
            :key="item.path"
            class="topnav-item"
            :class="{ active: isActive(item.path) }"
            @click="navigate(item.path)"
          >
            <el-icon :size="15"><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
          </a>
        </nav>
        <a class="topnav-back" @click="$router.push('/')" title="返回前台">
          <el-icon :size="18"><ArrowLeft /></el-icon>
        </a>
      </div>
    </header>

    <!-- 主内容区域 -->
    <main class="admin-main">
      <div class="admin-content">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- 隐藏入口：连点头像三下后弹出的密码校验框（自绘，不用 Element Plus 默认弹窗） -->
    <transition name="unlock-fade">
      <div v-if="showUnlock" class="unlock-mask" @click.self="closeUnlock">
        <div class="unlock-dialog" :class="{ 'is-shaking': unlockShaking }">
          <button class="unlock-close" type="button" aria-label="关闭" @click="closeUnlock">
            <el-icon :size="15"><Close /></el-icon>
          </button>

          <div class="unlock-icon">
            <el-icon :size="23"><Lock /></el-icon>
          </div>

          <h3 class="unlock-title">访问分析</h3>
          <p class="unlock-sub">该功能为受保护入口，请输入访问密码</p>

          <input
            ref="passwordInput"
            v-model="unlockPassword"
            class="unlock-input"
            :class="{ 'has-error': unlockError }"
            type="password"
            autocomplete="off"
            placeholder="请输入访问密码"
            @input="unlockError = ''"
            @keyup.enter="submitUnlock"
          />
          <p class="unlock-error">{{ unlockError }}</p>

          <div class="unlock-actions">
            <button class="unlock-btn ghost" type="button" @click="closeUnlock">取消</button>
            <button class="unlock-btn primary" type="button" @click="submitUnlock">确定</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted, ref, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useTabSlider } from '@/composables/useTabSlider.js'
import {
  DataBoard,
  User,
  Goods,
  Document,
  Grid,
  ArrowLeft,
  DataAnalysis,
  Lock,
  Close
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

// 侧边栏导航滑块
const {
  containerRef: navRef,
  sliderStyle: navSliderStyle,
  updateSlider: updateNavSlider
} = useTabSlider()

const userInitial = computed(() => {
  const name = userStore.user?.nickname || userStore.user?.username || '管'
  return name.charAt(0)
})

// ===== 侧边栏菜单 =====
// 桌面侧边栏与移动端顶部 nav 共用同一个 menuItems，所以解锁后两端会同时出现「访问分析」。
const baseMenus = [
  { path: '/admin', label: '数据看板', icon: DataBoard },
  { path: '/admin/users', label: '用户管理', icon: User },
  { path: '/admin/products', label: '商品管理', icon: Goods },
  { path: '/admin/orders', label: '订单管理', icon: Document },
  { path: '/admin/categories', label: '分类管理', icon: Grid }
]

// 隐藏菜单项：仅在解锁后注入
const secretMenu = { path: '/admin/visit-analysis', label: '访问分析', icon: DataAnalysis }

// ===== 隐藏入口：连点头像三下 + 密码校验 =====
// 解锁状态放 sessionStorage —— 关掉标签页/浏览器就恢复隐藏，答辩演示前后不留痕迹。
// 说明：这只是「不把入口露出来」的遮蔽，真正的权限边界仍是后端管理员 JWT 校验与路由守卫。
const UNLOCK_KEY = 'admin_visit_analysis_unlocked'
const UNLOCK_PASSWORD = 'Cgf200603'
const CLICK_WINDOW = 800 // 三次点击必须落在同一个 800ms 窗口内，超时重新计数
const CLICK_COUNT = 3

const unlocked = ref(sessionStorage.getItem(UNLOCK_KEY) === '1')
const showUnlock = ref(false)
const unlockPassword = ref('')
const unlockError = ref('')
const unlockShaking = ref(false)
const passwordInput = ref(null)

const menuItems = computed(() => (unlocked.value ? [...baseMenus, secretMenu] : baseMenus))

let clickTimes = []

const handleAvatarClick = () => {
  // 已解锁后不再响应，避免误触反复弹密码框
  if (unlocked.value) return
  const now = Date.now()
  clickTimes = clickTimes.filter((t) => now - t < CLICK_WINDOW)
  clickTimes.push(now)
  if (clickTimes.length >= CLICK_COUNT) {
    clickTimes = []
    openUnlock()
  }
}

const openUnlock = async () => {
  unlockPassword.value = ''
  unlockError.value = ''
  showUnlock.value = true
  await nextTick()
  passwordInput.value?.focus()
}

const closeUnlock = () => {
  showUnlock.value = false
  unlockPassword.value = ''
  unlockError.value = ''
}

const submitUnlock = () => {
  if (unlockPassword.value !== UNLOCK_PASSWORD) {
    unlockError.value = '密码错误，请重新输入'
    unlockPassword.value = ''
    unlockShaking.value = true
    setTimeout(() => {
      unlockShaking.value = false
    }, 420)
    nextTick(() => passwordInput.value?.focus())
    return
  }
  unlocked.value = true
  sessionStorage.setItem(UNLOCK_KEY, '1')
  closeUnlock()
}

// 弹框打开时才挂 Esc 监听，关闭即摘掉，不常驻全局监听
const onUnlockKeydown = (e) => {
  if (e.key === 'Escape') closeUnlock()
}

const activeNavIndex = computed(() => {
  return menuItems.value.findIndex(item => isActive(item.path))
})

const isActive = (path) => {
  if (path === '/admin') {
    return route.path === '/admin'
  }
  return route.path.startsWith(path)
}

const navigate = (path) => {
  if (route.path !== path) {
    router.push(path)
  }
}

watch(activeNavIndex, updateNavSlider)

watch(showUnlock, (visible) => {
  if (visible) window.addEventListener('keydown', onUnlockKeydown)
  else window.removeEventListener('keydown', onUnlockKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', onUnlockKeydown))

onMounted(() => {
  updateNavSlider(activeNavIndex.value)
})
</script>

<style scoped>
.admin-layout {
  display: flex;
  min-height: 100vh;
  background: var(--admin-bg);
}

/* 侧边栏外壳：固定定位 + 内边距形成漂浮感 */
.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: 280px;
  padding: 20px 0 20px 20px;
  z-index: 100;
}

.sidebar-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--admin-card);
  border-radius: var(--admin-radius-lg);
  box-shadow: var(--admin-shadow);
  padding: 24px 16px;
  transition: box-shadow 0.4s ease;
}

.sidebar-inner:hover {
  box-shadow: var(--admin-shadow-hover);
}

/* 用户卡片 */
.user-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(79, 70, 229, 0.02));
  border-radius: var(--admin-radius);
  border: 1px solid rgba(79, 70, 229, 0.12);
}

.user-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--admin-primary), #6366f1);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-info {
  min-width: 0;
}

.user-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--admin-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  font-size: 12px;
  color: var(--admin-primary);
  font-weight: 600;
  margin-top: 4px;
}

/* 导航菜单 */
.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
}

/* 侧边栏导航滑块背景：跟随当前选中项平滑滑动 */
.nav-slider {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: var(--radius-md);
  background: var(--admin-primary-light);
  box-shadow: inset 0 0 0 1px rgba(79, 70, 229, 0.15);
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  z-index: 0;
  pointer-events: none;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text-secondary);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
  position: relative;
}

.nav-item:hover {
  color: var(--admin-primary);
  background: var(--admin-primary-soft);
  transform: translateX(4px);
}

.nav-item.active {
  color: var(--admin-primary);
  /* 背景交给 .nav-slider 负责，实现平滑滑动效果 */
}

.nav-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.03);
  transition: all 0.25s ease;
}

.nav-item:hover .nav-icon,
.nav-item.active .nav-icon {
  background: rgba(79, 70, 229, 0.12);
}

.nav-label {
  flex: 1;
}

.nav-badge {
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 11px;
  background: var(--admin-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 底部分隔与返回按钮 */
.sidebar-footer {
  border-top: 1px solid var(--admin-border);
  padding-top: 16px;
  margin-top: 8px;
}

.back-btn:hover {
  color: var(--admin-text);
}

/* 主内容区 */
.admin-main {
  flex: 1;
  margin-left: 280px;
  min-height: 100vh;
  padding: 20px 20px 20px 0;
}

.admin-content {
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 40px);
  /* 底部不留内边距：内容卡片底边与左侧悬浮侧边栏底边对齐（均距视口底部 20px） */
  padding: 32px 32px 0;
  background: transparent;
}

/* 响应式：≤1200 全部切移动版（iPad 横屏/小 PC 也隐藏侧边栏） */
@media (max-width: 1200px) {
  .sidebar {
    display: none !important;
  }
  .admin-main {
    margin-left: 0 !important;
  }
  .mobile-topnav {
    display: block;
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--admin-card);
    border-bottom: 1px solid var(--admin-border);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  }
}

@media (max-width: 992px) {
  /* ≤992 隐藏侧边栏（加 !important 防上层覆盖），启用顶部水平 nav */
  .sidebar {
    display: none !important;
  }
  .admin-main {
    margin-left: 0 !important;
  }
  .mobile-topnav {
    display: block;
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--admin-card);
    border-bottom: 1px solid var(--admin-border);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  }
}

/* ================================================================
   移动端响应式（≤768px）：sidebar 隐藏，顶部水平 nav
   ================================================================ */
.mobile-topnav {
  display: none;
}

@media (max-width: 768px) {
  /* 纵向堆叠：顶部 nav 在上，内容区全宽在下（避免横向 flex 撑破视口） */
  .admin-layout {
    flex-direction: column;
  }

  .sidebar {
    display: none;
  }

  .admin-main {
    margin-left: 0;
    padding: 0;
    width: 100%;
  }

  .admin-content {
    padding: 16px 14px 32px;
  }

  .mobile-topnav {
    display: block;
    width: 100%;
    flex: none;
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--admin-card);
    border-bottom: 1px solid var(--admin-border);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  }

  .topnav-inner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
  }

  .user-avatar-sm {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    background: linear-gradient(135deg, var(--admin-primary), #6366f1);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .user-avatar-sm img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .topnav-menu {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 4px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    /* 隐藏滚动条但保留滚动 */
    scrollbar-width: none;
  }

  .topnav-menu::-webkit-scrollbar {
    display: none;
  }

  .topnav-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: var(--admin-text-secondary);
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .topnav-item.active {
    background: var(--admin-primary-light);
    color: var(--admin-primary);
  }

  .topnav-item:active {
    background: var(--admin-primary-soft);
  }

  .topnav-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.05);
    color: var(--admin-text);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .topnav-back:active {
    background: rgba(0, 0, 0, 0.1);
    transform: scale(0.92);
  }
}

/* ================================================================
   隐藏入口密码弹窗（自绘，不用 Element Plus 默认弹窗）
   配色跟随后台主题变量 --admin-*，与前台 #0071e3 蓝区分开
   ================================================================ */
.unlock-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.unlock-dialog {
  position: relative;
  width: 100%;
  max-width: 380px;
  padding: 32px 28px 24px;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
}

/* Element Plus 默认关闭按钮是贴角 48×48 的纯热区、没有视觉，必须显式覆写 */
.unlock-close {
  position: absolute;
  top: 13px;
  right: 13px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--admin-text-tertiary);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.unlock-close:hover {
  background: rgba(120, 120, 128, 0.1);
  color: var(--admin-text);
}

.unlock-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: var(--admin-primary-light);
  color: var(--admin-primary);
}

.unlock-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  text-align: center;
  color: var(--admin-text);
}

.unlock-sub {
  margin: 7px 0 0;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
  color: var(--admin-text-secondary);
}

.unlock-input {
  width: 100%;
  height: 46px;
  margin-top: 20px;
  padding: 0 14px;
  font-size: 15px;
  letter-spacing: 0.06em;
  color: var(--admin-text);
  background: rgba(120, 120, 128, 0.07);
  border: 1px solid transparent;
  border-radius: 14px;
  outline: none;
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.unlock-input::placeholder {
  letter-spacing: normal;
  color: var(--admin-text-tertiary);
}

.unlock-input:focus {
  background: #fff;
  border-color: var(--admin-primary);
  box-shadow: 0 0 0 3px var(--admin-primary-light);
}

.unlock-input.has-error {
  background: #fff;
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

/* 固定最小高度：出错时弹窗高度不跳动 */
.unlock-error {
  min-height: 17px;
  margin: 8px 0 0;
  font-size: 12px;
  color: #dc2626;
}

.unlock-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.unlock-btn {
  flex: 1;
  height: 46px;
  border: none;
  border-radius: 14px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.unlock-btn.ghost {
  background: rgba(120, 120, 128, 0.09);
  color: var(--admin-text-secondary);
}

.unlock-btn.ghost:hover {
  background: rgba(120, 120, 128, 0.16);
}

/* 主按钮扁平实色，不加渐变 */
.unlock-btn.primary {
  background: var(--admin-primary);
  color: #fff;
}

.unlock-btn.primary:hover {
  background: var(--admin-primary-hover);
}

.unlock-btn:active {
  transform: scale(0.98);
}

@keyframes unlock-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-8px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(3px); }
}

.unlock-dialog.is-shaking {
  animation: unlock-shake 0.42s ease;
}

/* 进出场：淡入 + 轻微缩放 */
.unlock-fade-enter-active,
.unlock-fade-leave-active {
  transition: opacity 0.2s ease;
}

.unlock-fade-enter-active .unlock-dialog,
.unlock-fade-leave-active .unlock-dialog {
  transition: transform 0.24s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.unlock-fade-enter-from,
.unlock-fade-leave-to {
  opacity: 0;
}

.unlock-fade-enter-from .unlock-dialog,
.unlock-fade-leave-to .unlock-dialog {
  transform: scale(0.94);
}

@media (max-width: 768px) {
  .unlock-dialog {
    padding: 28px 22px 20px;
    border-radius: 22px;
  }

  .unlock-title {
    font-size: 18px;
  }
}

/* 尊重系统「减少动态效果」设置：只保留淡入 */
@media (prefers-reduced-motion: reduce) {
  .unlock-dialog.is-shaking {
    animation: none;
  }

  .unlock-fade-enter-active .unlock-dialog,
  .unlock-fade-leave-active .unlock-dialog {
    transition: none;
  }
}
</style>