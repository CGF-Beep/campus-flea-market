<!-- 我的主页：用户卡片 + 功能分组菜单（原散落在头像下拉/抽屉里的功能统一收敛到此处） -->
<template>
  <div class="me">
    <div class="me-wrap">
      <!-- ===== 顶部用户卡片 ===== -->
      <div class="me-hero">
        <div class="me-user-row">
          <div class="me-avatar" @click="$router.push('/profile')">
            <img v-if="userStore.user?.avatar && !avatarError" :src="userStore.user.avatar" alt="avatar" @error="avatarError = true" />
            <span v-else class="me-avatar-fallback">{{ (userStore.user?.nickname || userStore.user?.username || '用')[0] }}</span>
          </div>
          <div class="me-user-info">
            <h3 class="me-name">{{ userStore.user?.nickname || userStore.user?.username }}</h3>
            <span class="me-role" :class="userStore.user?.role === 'admin' ? 'role-admin' : 'role-user'">
              {{ userStore.user?.role === 'admin' ? '系统管理员' : '校园用户' }}
            </span>
          </div>
          <div class="me-edit" @click="$router.push('/profile')">
            <el-icon :size="15"><EditPen /></el-icon>
            <span>编辑资料</span>
          </div>
        </div>
      </div>

      <!-- ===== 分组菜单：交易与服务 ===== -->
      <div class="me-card">
        <div v-for="(item, i) in tradeMenus" :key="item.label" class="me-row" :class="{ 'row-first': i === 0 }" @click="go(item)">
          <div class="me-row-icon" :style="{ background: item.bg, color: item.color }">
            <el-icon :size="18"><component :is="item.icon" /></el-icon>
          </div>
          <span class="me-row-label">{{ item.label }}</span>
          <el-icon class="me-row-arrow"><ArrowRight /></el-icon>
        </div>
      </div>

      <!-- ===== 分组菜单：账户与支持 ===== -->
      <div class="me-card">
        <div class="me-row row-first" @click="$router.push('/profile')">
          <div class="me-row-icon" style="background: rgba(0,113,227,0.1); color:#0071e3">
            <el-icon :size="18"><User /></el-icon>
          </div>
          <span class="me-row-label">个人资料</span>
          <el-icon class="me-row-arrow"><ArrowRight /></el-icon>
        </div>
        <div v-if="userStore.user?.role === 'admin'" class="me-row" @click="$router.push('/admin')">
          <div class="me-row-icon" style="background: rgba(124,77,255,0.1); color:#7c4dff">
            <el-icon :size="18"><Setting /></el-icon>
          </div>
          <span class="me-row-label">后台管理</span>
          <el-icon class="me-row-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="me-row" @click="contactVisible = true">
          <div class="me-row-icon" style="background: rgba(255,159,10,0.12); color:#ff9f0a">
            <el-icon :size="18"><Service /></el-icon>
          </div>
          <span class="me-row-label">联系我们</span>
          <el-icon class="me-row-arrow"><ArrowRight /></el-icon>
        </div>
      </div>

      <!-- ===== 退出登录 ===== -->
      <div class="me-card">
        <div class="me-row me-row-logout row-first" @click="handleLogout">
          <div class="me-row-icon" style="background: rgba(255,69,58,0.1); color:#ff453a">
            <el-icon :size="18"><SwitchButton /></el-icon>
          </div>
          <span class="me-row-label">退出登录</span>
        </div>
      </div>

      <p class="me-version">乐购 · 校园闲置交易平台 v1.0</p>
    </div>

    <!-- ===== 联系我们弹窗 ===== -->
    <el-dialog v-model="contactVisible" title="联系我们" width="520px" class="me-contact-dialog">
      <p class="me-contact-sub">有任何问题，欢迎通过以下方式联系我们</p>
      <div class="me-contact-list">
        <div class="me-contact-item">
          <div class="me-contact-icon icon-mail"><el-icon :size="18"><Message /></el-icon></div>
          <div class="me-contact-text">
            <p class="me-contact-label">开发者联邮箱</p>
            <p class="me-contact-value">www_by@outlook.com</p>
          </div>
        </div>
        <div class="me-contact-item">
          <div class="me-contact-icon icon-phone"><el-icon :size="18"><Phone /></el-icon></div>
          <div class="me-contact-text">
            <p class="me-contact-label">电话热线</p>
            <p class="me-contact-value">暂未开通，请通过邮箱联系</p>
          </div>
        </div>
        <div class="me-contact-item">
          <div class="me-contact-icon icon-office"><el-icon :size="18"><OfficeBuilding /></el-icon></div>
          <div class="me-contact-text">
            <p class="me-contact-label">办公地址</p>
            <p class="me-contact-value">长沙市芙蓉区解放西路188号 T1栋</p>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button type="primary" round class="me-contact-ok" @click="contactVisible = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { User, Document, Goods, Star, Setting, Service, SwitchButton, EditPen, ArrowRight, Message, Phone, OfficeBuilding, House } from '@element-plus/icons-vue'

const router = useRouter()
const userStore = useUserStore()
const avatarError = ref(false)
const contactVisible = ref(false)

// 交易与服务
// 「我的主页」= 自己的公开卖家主页（与买家看到的页面完全一致），
// 与桌面端头像下拉里的同名入口指向同一地址。
// path 写成函数：直接刷新 /me 时 userStore.user 可能还没就绪，
// 放在点击那一刻再取值，避免拼出 /user/undefined
const tradeMenus = reactive([
  { label: '我的主页', icon: House, path: () => `/user/${userStore.user?.id}`, bg: 'rgba(90,200,250,0.14)', color: '#5ac8fa' },
  { label: '我的订单', icon: Document, path: '/orders', bg: 'rgba(0,113,227,0.1)', color: '#0071e3' },
  { label: '我的商品', icon: Goods, path: '/my-products', bg: 'rgba(52,199,89,0.12)', color: '#34c759' },
  { label: '我的收藏', icon: Star, path: '/favorites', bg: 'rgba(255,149,0,0.12)', color: '#ff9500' }
])

const go = (item) => {
  const target = typeof item.path === 'function' ? item.path() : item.path
  // 兜底：用户信息还没加载完时，不要跳到 /user/undefined
  if (!target || target.endsWith('/undefined')) {
    ElMessage.warning('用户信息还在加载，请稍后再试')
    return
  }
  router.push(target)
}

const handleLogout = async () => {
  // 二次确认：与 PC 下拉、移动端抽屉共用同一套交互
  try {
    await ElMessageBox.confirm('确定要退出当前账号吗？', '退出登录', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    })
  } catch (e) {
    // 用户点了取消：静默返回
    return
  }
  await userStore.logout()
  ElMessage.success('已退出登录')
  router.push('/')
}
</script>

<style scoped>
.me {
  min-height: 100vh;
  background: #f7f8fa;
  padding: 24px 16px 40px;
}

.me-wrap {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ===== 用户卡片 ===== */
.me-hero {
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.06), rgba(90, 200, 250, 0.08));
  border: 1px solid rgba(0, 113, 227, 0.08);
  border-radius: 24px;
  padding: 22px 20px;
}

.me-user-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.me-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  flex-shrink: 0;
  background: linear-gradient(135deg, #5ac8fa, #0071e3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0, 113, 227, 0.22);
  cursor: pointer;
  transition: transform 0.25s ease;
}

.me-avatar:active {
  transform: scale(0.95);
}

.me-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.me-avatar-fallback {
  color: #fff;
  font-size: 24px;
  font-weight: 600;
}

.me-user-info {
  flex: 1;
  min-width: 0;
}

.me-name {
  font-size: 20px;
  font-weight: 700;
  color: #1d1d1f;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.me-role {
  display: inline-block;
  margin-top: 6px;
  padding: 3px 12px;
  border-radius: 980px;
  font-size: 12px;
  font-weight: 600;
}

.role-admin {
  color: #c76f00;
  background: rgba(255, 149, 0, 0.14);
}

.role-user {
  color: #0071e3;
  background: rgba(0, 113, 227, 0.1);
}

.me-edit {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-radius: 980px;
  background: #fff;
  color: #0071e3;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease;
}

.me-edit:active {
  transform: scale(0.95);
  opacity: 0.85;
}

/* ===== 分组菜单卡片 ===== */
.me-card {
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.04);
  padding: 0 8px;
  overflow: hidden;
}

.me-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 15px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.045);
  cursor: pointer;
  transition: background 0.2s ease;
  -webkit-tap-highlight-color: transparent;
}

.me-row:last-child {
  border-bottom: none;
}

.me-row:active {
  background: rgba(0, 0, 0, 0.03);
}

.me-row-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.me-row-label {
  flex: 1;
  font-size: 15px;
  font-weight: 500;
  color: #1d1d1f;
}

.me-row-arrow {
  color: #c7c7cc;
  font-size: 14px;
}

.me-row-logout .me-row-label {
  color: #ff453a;
}

/* ===== 版本号 ===== */
.me-version {
  text-align: center;
  font-size: 12px;
  color: #aeaeb2;
  margin-top: 8px;
}

/* ===== 联系我们弹窗 ===== */
.me-contact-sub {
  text-align: center;
  font-size: 13px;
  color: #8e8e93;
  margin: -6px 0 18px;
}

.me-contact-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.me-contact-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #f7f8fa;
  border-radius: 16px;
}

.me-contact-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.me-contact-icon.icon-mail { color: #0071e3; }
.me-contact-icon.icon-phone { color: #ff6b00; }
.me-contact-icon.icon-office { color: #34c759; }

.me-contact-label {
  font-size: 12px;
  color: #8e8e93;
  margin-bottom: 3px;
}

.me-contact-value {
  font-size: 14px;
  font-weight: 600;
  color: #1d1d1f;
  word-break: break-all;
}

@media (max-width: 768px) {
  .me {
    padding: 16px 14px 24px;
  }
}
</style>

<style>
/* 联系我们弹窗（挂载到 body，需全局） */
.me-contact-dialog {
  border-radius: 24px !important;
  overflow: hidden;
  max-width: 90vw;
}

.me-contact-dialog .el-dialog__header {
  padding: 24px 28px 0;
  text-align: center;
}

.me-contact-dialog .el-dialog__title {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.me-contact-dialog .el-dialog__body {
  padding: 20px 28px 8px;
}

.me-contact-dialog .el-dialog__footer {
  padding: 8px 28px 24px;
}

.me-contact-ok {
  width: 100%;
  height: 42px !important;
  border: none !important;
  background: linear-gradient(135deg, #0071e3, #5ac8fa) !important;
  font-weight: 600 !important;
}

@media (max-width: 768px) {
  .me-contact-dialog {
    width: 92vw !important;
  }
}
</style>
