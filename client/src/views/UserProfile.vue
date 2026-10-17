<!-- 卖家公开主页：展示卖家信用数据与在售商品，是买家建立信任的落地页 -->
<template>
  <div class="user-profile-page">
    <div class="container">
      <!-- 返回 -->
      <button class="back-btn" type="button" @click="goBack">
        <el-icon><ArrowLeft /></el-icon> 返回
      </button>

      <!-- 骨架屏 -->
      <div v-if="loadingProfile" class="skeleton-hero">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-lines">
          <div class="skeleton-line lg"></div>
          <div class="skeleton-line sm"></div>
        </div>
      </div>

      <template v-else-if="profile">
        <!-- 卖家信息卡（含信用数据）：
             头像在左、相对右侧文本列垂直居中；
             右侧文本列自上而下为「昵称 + 徽章」「联系卖家」「学院 + 加入时间」，三者左对齐；
             信用数据条 PC 端铺在右侧，移动端换行到卡片底部 -->
        <div class="profile-hero">
          <div class="hero-identity">
            <el-avatar :size="88" :src="profile.avatar" class="hero-avatar">
              {{ (profile.nickname || '友')[0] }}
            </el-avatar>

            <div class="hero-main">
              <div class="hero-name-row">
                <h1 class="hero-name">{{ profile.nickname }}</h1>
                <span v-if="profile.credits?.isTrusted" class="trust-badge">
                  <el-icon><CircleCheckFilled /></el-icon> 信用良好
                </span>
                <span v-else-if="profile.credits?.isNew" class="new-badge">新卖家</span>
              </div>

              <!-- 联系卖家：紧贴昵称下方 -->
              <div class="hero-actions">
                <el-button type="primary" round @click="startChat">
                  <el-icon><ChatDotRound /></el-icon> 联系卖家
                </el-button>
              </div>

              <!-- 学院 + 加入时间：与昵称、联系卖家左对齐 -->
              <div class="hero-meta">
                <span v-if="profile.college" class="meta-item">
                  <el-icon><School /></el-icon> {{ profile.college }}
                </span>
                <span class="meta-item">
                  <el-icon><Calendar /></el-icon> {{ profile.credits?.joinedDays || 0 }} 天前加入
                </span>
              </div>
            </div>
          </div>

          <!-- 信用数据条：与卖家信息同属一张卡片，不再单独成卡 -->
          <div class="credit-bar">
            <div class="credit-stat">
              <span class="stat-value">{{ profile.credits?.completedCount || 0 }}</span>
              <span class="stat-label">已完成交易</span>
            </div>
            <div class="credit-divider"></div>
            <div class="credit-stat">
              <span class="stat-value">{{ profile.credits?.sellingCount || 0 }}</span>
              <span class="stat-label">在售商品</span>
            </div>
            <div class="credit-divider"></div>
            <div class="credit-stat">
              <span class="stat-value">￥{{ formatAmount(profile.credits?.totalSold) }}</span>
              <span class="stat-label">累计成交</span>
            </div>
            <div class="credit-divider"></div>
            <div class="credit-stat">
              <span class="stat-value">{{ profile.credits?.joinedDays || 0 }}</span>
              <span class="stat-label">加入天数</span>
            </div>
          </div>
        </div>

        <!-- 在售商品 -->
        <div class="section-header">
          <h2 class="section-title">TA 的在售商品</h2>
          <span class="section-count" v-if="total > 0">共 {{ total }} 件</span>
        </div>

        <div v-if="loadingProducts && products.length === 0" class="skeleton-grid">
          <div v-for="n in 8" :key="'sk' + n" class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-line lg"></div>
            <div class="skeleton-line sm"></div>
          </div>
        </div>

        <div class="products-grid">
          <div
            v-for="p in products"
            :key="p.id"
            class="product-card"
            @click="$router.push(`/products/${p.id}`)"
          >
            <div class="product-image">
              <SmartImage :src="(p.images && p.images[0]) || ''" :emoji="getCategoryEmoji(p.categoryId)" />
              <span class="product-condition">{{ p.condition }}</span>
            </div>
            <div class="product-info">
              <h3 class="product-title">{{ p.title }}</h3>
              <div class="product-price-row">
                <span class="product-price">￥{{ p.price }}</span>
                <span class="product-original" v-if="p.originalPrice">￥{{ p.originalPrice }}</span>
              </div>
              <div class="product-meta">
                <span class="product-views">{{ p.views }} 浏览</span>
              </div>
            </div>
          </div>
        </div>

        <el-empty
          v-if="!loadingProducts && products.length === 0"
          description="TA 目前没有在售商品"
          :image-size="120"
        >
          <button class="btn-primary" @click="$router.push('/products')">去市场逛逛</button>
        </el-empty>

        <div class="pagination" v-if="total > pageSize">
          <el-pagination
            v-model:current-page="page"
            :total="total"
            :page-size="pageSize"
            layout="prev, pager, next"
            @current-change="loadProducts"
          />
        </div>
      </template>

      <el-empty v-else description="用户不存在或已注销" :image-size="140">
        <button class="btn-primary" @click="$router.push('/products')">返回市场</button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft, School, Calendar, ChatDotRound, CircleCheckFilled
} from '@element-plus/icons-vue'
import { getUserProfile, getUserProducts } from '@/api'
import { useUserStore } from '@/stores/user'
import SmartImage from '@/components/SmartImage.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const profile = ref(null)
const loadingProfile = ref(true)
const products = ref([])
const loadingProducts = ref(true)
const page = ref(1)
const pageSize = 12
const total = ref(0)

// 与其它页面保持一致的分类 emoji 兜底
const categoryEmojis = {
  1: '📱', 2: '📚', 3: '🏠', 4: '👕', 5: '🏀', 6: '💄', 7: '🎸', 8: '✨'
}
const getCategoryEmoji = (categoryId) => categoryEmojis[categoryId] || '📦'

const formatAmount = (v) => {
  const n = Number(v) || 0
  return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toFixed(0)
}

const loadProfile = async () => {
  loadingProfile.value = true
  try {
    const res = await getUserProfile(route.params.id)
    profile.value = res.data
  } catch (e) {
    profile.value = null
  } finally {
    loadingProfile.value = false
  }
}

const loadProducts = async () => {
  loadingProducts.value = true
  try {
    const res = await getUserProducts(route.params.id, { page: page.value, pageSize })
    products.value = res.data.list
    total.value = res.data.total || 0
  } catch (e) {
    products.value = []
    total.value = 0
  } finally {
    loadingProducts.value = false
  }
}

const goBack = () => {
  if (window.history.length > 1) router.back()
  else router.push('/products')
}

const startChat = () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (!profile.value) return
  if (Number(profile.value.id) === Number(userStore.user?.id)) {
    ElMessage.info('这是你自己的主页')
    return
  }
  router.push({
    path: `/messages/${profile.value.id}`,
    query: { name: profile.value.nickname }
  })
}

// 支持在主页之间直接跳转（点另一个卖家时复用组件）
watch(() => route.params.id, () => {
  if (!route.params.id) return
  page.value = 1
  loadProfile()
  loadProducts()
})

onMounted(() => {
  loadProfile()
  loadProducts()
})
</script>

<style scoped>
.user-profile-page {
  padding: 32px 0 60px;
  background: var(--color-bg-secondary);
  min-height: calc(100vh - 64px);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 15px;
  margin-bottom: 20px;
  border: none;
  border-radius: 980px;
  background: var(--color-card);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
}

.back-btn:hover {
  color: var(--color-text);
  box-shadow: var(--shadow-md);
}

/* ===== 卖家信息卡（身份 + 信用数据同一张卡）===== */
.profile-hero {
  display: flex;
  align-items: center;
  /* 允许换行：窄屏时信用数据整条掉到卡片底部（见 @media） */
  flex-wrap: wrap;
  gap: 24px 32px;
  padding: 28px;
  background: var(--color-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  margin-bottom: 32px;
}

/* 头像 + 身份信息：始终横向成组，移动端也保持这个朝向。
   align-items: center 让头像相对右侧文本列（昵称/按钮/信息行）垂直居中 */
.hero-identity {
  display: flex;
  align-items: center;
  gap: 24px;
  flex: 0 1 auto;
  min-width: 0;
}

.hero-avatar {
  flex-shrink: 0;
  background: var(--color-primary);
  color: #fff;
  font-size: 32px;
  font-weight: 600;
}

.hero-main {
  min-width: 0;
}

.hero-name-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  /* 下方紧接「联系卖家」按钮，留出比原来稍大的间距 */
  margin-bottom: 12px;
}

.hero-name {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

.trust-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 11px;
  border-radius: 980px;
  background: rgba(52, 199, 89, 0.12);
  color: var(--color-success);
  font-size: 12px;
  font-weight: 600;
}

.new-badge {
  padding: 3px 11px;
  border-radius: 980px;
  background: var(--color-bg-secondary);
  color: var(--color-text-tertiary);
  font-size: 12px;
  font-weight: 600;
}

/* 学院 + 加入时间：位于右侧文本列内，与昵称、联系卖家左对齐 */
.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-top: 12px;
  min-width: 0;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.hero-actions {
  display: flex;
  gap: 10px;
}

/* ===== 信用数据条 =====
   PC：flex 1 吃掉右侧剩余空间，四项数据在右侧铺开（原来右侧一大片空白）；
   移动：basis 100% 换行到卡片底部，加上分隔线与身份区区分。 */
.credit-bar {
  display: flex;
  align-items: center;
  flex: 1 1 380px;
  min-width: 0;
}

.credit-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.credit-divider {
  width: 1px;
  height: 32px;
  background: var(--color-border, #e5e5ea);
}

/* ===== 在售商品 ===== */
.section-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 18px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
}

.section-count {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  min-height: 100px;
}

.product-card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.product-card:hover {
  transform: translateY(-5px) scale(1.01);
  box-shadow: var(--shadow-md);
}

.product-image {
  position: relative;
  aspect-ratio: 4 / 3;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.product-image :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.product-card:hover .product-image :deep(img) {
  transform: scale(1.06);
}

.product-condition {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 3px 10px;
  border-radius: 980px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
}

.product-info {
  padding: 14px 16px 16px;
}

.product-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 8px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}

.product-price-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.product-price {
  font-size: 19px;
  font-weight: 700;
  color: var(--color-price);
}

.product-original {
  font-size: 12px;
  color: var(--color-text-tertiary);
  text-decoration: line-through;
}

.product-meta {
  display: flex;
  justify-content: flex-end;
}

.product-views {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 36px;
}

/* ===== 骨架屏 ===== */
.skeleton-hero {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 28px;
  background: var(--color-card);
  border-radius: var(--radius-xl);
  /* 与合并后的 .profile-hero 保持一致，避免数据到达时页面跳动 */
  margin-bottom: 32px;
}

.skeleton-avatar {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f2 25%, #e8e8ea 50%, #f0f0f2 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  flex-shrink: 0;
}

.skeleton-lines {
  flex: 1;
}

.skeleton-line {
  height: 14px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f0f0f2 25%, #e8e8ea 50%, #f0f0f2 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton-line.lg {
  width: 40%;
  height: 22px;
  margin-bottom: 12px;
}

.skeleton-line.sm {
  width: 65%;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.skeleton-card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  padding-bottom: 16px;
  overflow: hidden;
}

.skeleton-img {
  aspect-ratio: 4 / 3;
  background: linear-gradient(90deg, #f0f0f2 25%, #e8e8ea 50%, #f0f0f2 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  margin-bottom: 14px;
}

.skeleton-card .skeleton-line {
  margin: 0 16px 8px;
}

.skeleton-card .skeleton-line.lg {
  width: 75%;
}

.skeleton-card .skeleton-line.sm {
  width: 40%;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ===== 移动端 ===== */
@media (max-width: 768px) {
  .user-profile-page {
    padding: 20px 0 100px;
  }

  .profile-hero {
    /* 不再是整体竖排：头像+身份保持横向一行，信用数据靠 flex-basis 100% 换行到底部。
       row-gap 设 0 —— 身份区与数据条之间由数据条自己的 padding-top + 分隔线控制间距 */
    align-items: center;
    gap: 0;
    padding: 18px;
    border-radius: var(--radius-lg);
    margin-bottom: 24px;
  }

  /* 骨架卡与真实卡片对齐，避免数据到达时卡片高度/内边距跳动 */
  .skeleton-hero {
    padding: 18px;
    border-radius: var(--radius-lg);
    margin-bottom: 24px;
  }

  .hero-identity {
    flex: 1 1 100%;
    gap: 14px;
    /* 与 PC 端一致：头像相对右侧文本列垂直居中 */
    align-items: center;
  }

  .hero-avatar {
    --el-avatar-size: 64px !important;
    width: 64px;
    height: 64px;
    font-size: 24px;
  }

  .hero-main {
    flex: 1;
  }

  .hero-name {
    font-size: 21px;
  }

  .hero-name-row {
    gap: 8px;
    margin-bottom: 10px;
  }

  /* 学院 + 加入时间：与昵称、按钮左对齐（沿用桌面端布局） */
  .hero-meta {
    gap: 8px 12px;
    margin-top: 10px;
  }

  .hero-actions {
    width: auto;
  }

  /* 按钮收小：去掉默认左右内边距的富余，只保留紧凑边距 */
  .hero-actions .el-button {
    flex: none;
    padding: 0 14px;
  }

  /* 信用数据：紧接在身份区下方，靠留白分组（按需求去掉横向分割线） */
  .credit-bar {
    flex: 1 1 100%;
    padding-top: 22px;
  }

  .credit-divider {
    height: 24px;
  }

  .stat-value {
    font-size: 18px;
  }

  .stat-label {
    font-size: 11px;
  }

  .section-title {
    font-size: 17px;
  }

  .products-grid,
  .skeleton-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .product-card {
    border-radius: var(--radius-md);
  }

  .product-card:hover {
    transform: none;
    box-shadow: none;
  }

  .product-card:hover .product-image :deep(img) {
    transform: none;
  }

  .product-info {
    padding: 10px 12px 12px;
  }

  .product-title {
    font-size: 14px;
  }

  .product-price {
    font-size: 17px;
  }

  .pagination {
    margin-top: 24px;
  }
}
</style>
