<template>
  <div class="admin-layout">
    <!-- 左侧固定侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-inner">
        <!-- 用户信息卡片 -->
        <div class="user-card">
          <div class="user-avatar">
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
          <div class="user-avatar-sm">
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
  </div>
</template>

<script setup>
import { computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useTabSlider } from '@/composables/useTabSlider.js'
import {
  DataBoard,
  User,
  Goods,
  Document,
  Grid,
  ArrowLeft
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

const activeNavIndex = computed(() => {
  return menuItems.findIndex(item => isActive(item.path))
})

const userInitial = computed(() => {
  const name = userStore.user?.nickname || userStore.user?.username || '管'
  return name.charAt(0)
})

const menuItems = [
  { path: '/admin', label: '数据看板', icon: DataBoard },
  { path: '/admin/users', label: '用户管理', icon: User },
  { path: '/admin/products', label: '商品管理', icon: Goods },
  { path: '/admin/orders', label: '订单管理', icon: Document },
  { path: '/admin/categories', label: '分类管理', icon: Grid }
]

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
</style>