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

/* 响应式：PC 端保持侧边栏，小屏简化 */
@media (max-width: 1200px) {
  .sidebar {
    width: 260px;
  }
  .admin-main {
    margin-left: 260px;
  }
}

@media (max-width: 992px) {
  .sidebar {
    width: 88px;
    padding: 16px 0 16px 16px;
  }
  .sidebar-inner {
    padding: 20px 12px;
    align-items: center;
  }
  .user-card {
    flex-direction: column;
    padding: 14px 8px;
    gap: 10px;
  }
  .user-avatar {
    width: 44px;
    height: 44px;
    font-size: 16px;
  }
  .user-info {
    display: none;
  }
  .nav-label,
  .nav-badge {
    display: none;
  }
  .nav-item {
    justify-content: center;
    padding: 12px;
  }
  .nav-icon {
    width: 40px;
    height: 40px;
  }
  .admin-main {
    margin-left: 104px;
  }
}
</style>