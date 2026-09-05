<template>
  <div class="product-detail-page" v-loading="loading">
    <div class="container" v-if="product">
      <div class="detail-layout">
        <!-- 左侧图片区 -->
        <div class="image-section">
          <div class="main-image">
            <SmartImage :src="currentImage" :emoji="'📦'" :thumb="false" />
          </div>
          <div class="image-thumbs" v-if="product.images && product.images.length > 1">
            <div
              v-for="(img, i) in product.images"
              :key="i"
              class="thumb"
              :class="{ active: currentImage === img }"
              @click="currentImage = img"
            >
              <img :src="img" loading="lazy" decoding="async" />
            </div>
          </div>
        </div>

        <!-- 右侧信息区 -->
        <div class="info-section">
          <!-- 卖家视角：该商品已有订单 → 显示订单与买家信息 -->
          <template v-if="isOwner && activeOrder">
            <h1 class="title">{{ product.title }}</h1>
            <div class="price-row">
              <span class="price">￥{{ product.price }}</span>
              <span class="status-pill" :class="orderStatusClass(activeOrder.status)">{{ orderStatusText(activeOrder.status) }}</span>
            </div>

            <!-- 买家信息卡片 -->
            <div class="buyer-card">
              <el-avatar :size="56" :src="activeOrder.buyer?.avatar" />
              <div class="buyer-info">
                <span class="buyer-name">{{ activeOrder.buyer?.nickname || '未知买家' }}</span>
                <span class="buyer-college" v-if="activeOrder.buyer?.college">{{ activeOrder.buyer.college }}</span>
                <span class="buyer-phone" v-if="activeOrder.buyer?.phone">📞 {{ activeOrder.buyer.phone }}</span>
              </div>
              <el-button size="small" round @click="chatWithBuyer">
                <el-icon><ChatDotRound /></el-icon> 联系买家
              </el-button>
            </div>

            <!-- 订单信息 -->
            <div class="order-info-card">
              <div class="order-info-row">
                <span class="label">订单编号</span>
                <span class="value mono">{{ activeOrder.orderNo }}</span>
              </div>
              <div class="order-info-row">
                <span class="label">成交价格</span>
                <span class="value">￥{{ activeOrder.price }}</span>
              </div>
              <div class="order-info-row">
                <span class="label">下单时间</span>
                <span class="value">{{ formatTime(activeOrder.createdAt) }}</span>
              </div>
              <div class="order-info-row" v-if="activeOrder.remark">
                <span class="label">买家备注</span>
                <span class="value">{{ activeOrder.remark }}</span>
              </div>
            </div>

            <!-- 订单操作：pending 状态卖家确认 / 取消；confirmed 状态卖家只能取消 -->
            <div class="order-actions" v-if="activeOrder.status === 'pending' || activeOrder.status === 'confirmed'">
              <el-button
                v-if="activeOrder.status === 'pending'"
                type="primary"
                size="large"
                round
                class="action-btn"
                @click="handleSellerConfirm"
              >确认订单</el-button>
              <el-button size="large" round class="action-btn" @click="handleCancel">取消订单</el-button>
            </div>

            <div class="detail-stats">
              <span>{{ product.views }} 次浏览</span>
              <span>{{ product.favorites || 0 }} 人收藏</span>
            </div>

            <div class="location-bar" v-if="product.location">
              <el-icon><Location /></el-icon>
              <span class="location-label">交易地点</span>
              <span class="location-value">{{ product.location }}</span>
            </div>

            <div class="desc-section">
              <h3>商品描述</h3>
              <p class="desc-text">{{ product.description || '卖家很懒，没有填写描述' }}</p>
            </div>
          </template>

          <!-- 其他视角：正常商品详情 -->
          <template v-else>
            <h1 class="title">{{ product.title }}</h1>
            <div class="price-row">
              <span class="price">￥{{ product.price }}</span>
              <span class="original-price" v-if="product.originalPrice">￥{{ product.originalPrice }}</span>
              <span class="condition-tag">{{ product.condition }}</span>
              <span v-if="product.status === 'sold'" class="status-pill pill-sold">已售出</span>
            </div>

            <div class="seller-card">
              <el-avatar :size="44" :src="product.user?.avatar" />
              <div class="seller-info">
                <span class="seller-name">{{ product.user?.nickname }}</span>
                <span class="seller-college" v-if="product.user?.college">{{ product.user.college }}</span>
              </div>
              <div class="seller-actions" v-if="!isOwner">
                <el-button size="small" round @click="startChat">
                  <el-icon><ChatDotRound /></el-icon> 联系卖家
                </el-button>
              </div>
            </div>

            <div class="action-btns" v-if="!isOwner && product.status !== 'sold' && !myActiveOrder">
              <el-button type="primary" size="large" class="buy-btn" :loading="buying" @click="handleBuy">
                立即购买
              </el-button>
              <el-button size="large" class="fav-btn" :type="isFavorited ? 'danger' : 'default'" @click="toggleFavorite">
                <el-icon><Star /></el-icon> {{ isFavorited ? '已收藏' : '收藏' }}
              </el-button>
            </div>

            <!-- 买家视角：卖家已确认 → 当面验货后点「确认收货」 -->
            <div class="action-btns" v-if="!isOwner && myActiveOrder && myActiveOrder.status === 'confirmed'">
              <el-button type="primary" size="large" class="buy-btn" @click="handleReceive">
                确认收货
              </el-button>
              <el-button size="large" round class="action-btn" @click="handleCancel">取消订单</el-button>
            </div>

            <!-- 卖家查看自己未售出的商品 -->
            <div class="owner-tip" v-if="isOwner">
              <el-icon><InfoFilled /></el-icon>
              <span>这是您发布的商品</span>
              <el-button size="small" round @click="$router.push(`/publish/${product.id}`)">编辑商品</el-button>
            </div>

            <div class="detail-stats">
              <span>{{ product.views }} 次浏览</span>
              <span>{{ product.favorites || 0 }} 人收藏</span>
            </div>

            <div class="location-bar" v-if="product.location">
              <el-icon><Location /></el-icon>
              <span class="location-label">交易地点</span>
              <span class="location-value">{{ product.location }}</span>
            </div>

            <div class="desc-section">
              <h3>商品描述</h3>
              <p class="desc-text">{{ product.description || '卖家很懒，没有填写描述' }}</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getProductDetail, createOrder, addFavorite, removeFavorite, confirmOrder, receiveOrder, cancelOrder } from '@/api'
import { useUserStore } from '@/stores/user'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ChatDotRound, Star, InfoFilled, Location } from '@element-plus/icons-vue'
import SmartImage from '@/components/SmartImage.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const loading = ref(true)
const product = ref(null)
const currentImage = ref('')
const isFavorited = ref(false)
const buying = ref(false)

const loadProduct = async () => {
  loading.value = true
  try {
    const res = await getProductDetail(route.params.id)
    product.value = res.data
    isFavorited.value = res.data.isFavorited || false
    currentImage.value = (product.value.images && product.value.images[0]) || ''
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

// 当前登录用户是否为商品卖家
const isOwner = computed(() => {
  const u = userStore.user
  return !!u && !!product.value && product.value.userId === u.id
})

// 商品的活跃订单：优先取非取消状态的订单，其次取最新一条订单
const activeOrder = computed(() => {
  const orders = product.value?.orders || []
  if (orders.length === 0) return null
  return orders.find((o) => o.status !== 'cancelled') || orders[0]
})

// 当前买家对该商品的未完结订单（pending 已下单待卖家确认 / confirmed 卖家已确认待买家收货）
const myActiveOrder = computed(() => {
  const u = userStore.user
  const orders = product.value?.orders || []
  if (!u) return null
  return orders.find((o) => o.buyerId === u.id && (o.status === 'pending' || o.status === 'confirmed')) || null
})

const orderStatusText = (s) => ({ pending: '待卖家确认', confirmed: '待买家确认收货', completed: '已完成', cancelled: '已取消' })[s] || s
const orderStatusClass = (s) => ({
  pending: 'pill-warning',
  confirmed: 'pill-primary',
  completed: 'pill-success',
  cancelled: 'pill-gray'
})[s] || 'pill-gray'

const formatTime = (d) => new Date(d).toLocaleString('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
})

const chatWithBuyer = () => {
  const buyer = activeOrder.value?.buyer
  if (!buyer) {
    ElMessage.warning('买家信息不存在')
    return
  }
  router.push({ path: `/messages/${buyer.id}`, query: { name: buyer.nickname } })
}

// 卖家确认订单（pending → confirmed，等待买家当面验货）
const handleSellerConfirm = async () => {
  const order = activeOrder.value
  if (!order) return
  try {
    await ElMessageBox.confirm('确认后请与买家约定时间地点当面交易', '确认订单', { confirmButtonText: '确认', cancelButtonText: '取消' })
    await confirmOrder(order.id)
    ElMessage.success('已确认，等待买家当面确认收货')
    loadProduct()
  } catch (e) {}
}

// 买家当面确认收货（confirmed → completed，交易完成）
const handleReceive = async () => {
  const order = myActiveOrder.value
  if (!order) return
  try {
    await ElMessageBox.confirm('确认已收到商品且无问题？交易将完成。', '确认收货', { confirmButtonText: '确认', cancelButtonText: '取消' })
    await receiveOrder(order.id)
    ElMessage.success('已确认收货，交易完成')
    loadProduct()
  } catch (e) {}
}

const handleCancel = async () => {
  const order = myActiveOrder.value || activeOrder.value
  if (!order) return
  try {
    await ElMessageBox.confirm('确定要取消该订单吗？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消' })
    await cancelOrder(order.id)
    ElMessage.success('已取消')
    loadProduct()
  } catch (e) {}
}

const toggleFavorite = async () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  try {
    if (isFavorited.value) {
      await removeFavorite(route.params.id)
      ElMessage.success('取消收藏')
    } else {
      await addFavorite(Number(route.params.id))
      ElMessage.success('收藏成功')
    }
    isFavorited.value = !isFavorited.value
  } catch (e) { /* handled */ }
}

const handleBuy = async () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  try {
    await ElMessageBox.confirm('确定要购买此商品吗？', '确认购买', { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' })
    buying.value = true
    await createOrder({ productId: Number(route.params.id) })
    ElMessage.success('下单成功')
    router.push('/orders')
  } catch (e) {
    if (e !== 'cancel') console.error(e)
  } finally {
    buying.value = false
  }
}

const startChat = () => {
  if (!userStore.isLoggedIn) {
    ElMessage.warning('请先登录')
    router.push({ path: '/login', query: { redirect: route.fullPath } })
    return
  }
  if (!product.value.user) {
    ElMessage.warning('卖家信息不存在')
    return
  }
  router.push({
    path: `/messages/${product.value.user.id}`,
    query: { name: product.value.user.nickname }
  })
}

onMounted(() => loadProduct())
</script>

<style scoped>
.product-detail-page {
  padding: 40px 0 60px;
  background: var(--color-bg-secondary);
  min-height: calc(100vh - 64px);
}

.detail-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 48px;
  background: var(--color-card);
  border-radius: var(--radius-xl);
  padding: 40px;
  box-shadow: var(--shadow-sm);
}

.main-image {
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--color-bg-secondary);
  margin-bottom: 16px;
}

.main-image img {
  width: 100%;
  height: 400px;
  object-fit: cover;
}

.image-thumbs {
  display: flex;
  gap: 12px;
}

.thumb {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.3s ease;
}

.thumb.active {
  border-color: var(--color-primary);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
  margin-bottom: 16px;
  line-height: 1.3;
}

.price-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 24px;
}

.price {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-price);
}

.original-price {
  font-size: 18px;
  color: var(--color-text-tertiary);
  text-decoration: line-through;
}

.condition-tag {
  padding: 4px 12px;
  background: var(--color-bg-secondary);
  border-radius: 980px;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.seller-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 24px;
}

.seller-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.seller-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.seller-college {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.action-btns {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.buy-btn {
  flex: 1;
  height: 50px !important;
  border-radius: 980px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
}

.fav-btn {
  width: 120px;
  height: 50px !important;
  border-radius: 980px !important;
  font-size: 15px !important;
}

.detail-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin-bottom: 24px;
}

.location-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 18px;
  background: rgba(0, 113, 227, 0.05);
  border: 1px solid rgba(0, 113, 227, 0.1);
  border-radius: var(--radius-md);
  margin-bottom: 24px;
  font-size: 14px;
}

.location-bar .el-icon {
  color: var(--color-primary);
  flex-shrink: 0;
}

.location-label {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.location-value {
  color: var(--color-text);
  font-weight: 600;
  word-break: break-all;
}

.desc-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
}

.desc-text {
  font-size: 15px;
  color: var(--color-text-secondary);
  line-height: 1.8;
  white-space: pre-line;
}

/* ===== 卖家视角 - 订单/买家信息 ===== */
.status-pill {
  display: inline-block;
  padding: 4px 14px;
  border-radius: 980px;
  font-size: 12px;
  font-weight: 600;
}
.pill-primary { color: #0071e3; background: rgba(0, 113, 227, 0.12); }
.pill-success { color: #1d8a3d; background: rgba(52, 199, 89, 0.14); }
.pill-warning { color: #c76f00; background: rgba(255, 149, 0, 0.14); }
.pill-gray { color: #86868b; background: rgba(0, 0, 0, 0.06); }
.pill-sold { color: #86868b; background: rgba(0, 0, 0, 0.06); }

.buyer-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  margin-bottom: 16px;
}
.buyer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.buyer-name {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
}
.buyer-college {
  font-size: 13px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}
.buyer-phone {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.order-info-card {
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  padding: 6px 18px;
  margin-bottom: 20px;
}
.order-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  font-size: 14px;
}
.order-info-row:last-child { border-bottom: none; }
.order-info-row .label {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
.order-info-row .value {
  color: var(--color-text);
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}
.order-info-row .mono {
  font-family: 'SF Mono', Consolas, monospace;
  font-size: 13px;
}

.order-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.action-btn {
  flex: 1;
  min-width: 120px;
  height: 50px !important;
  border-radius: 980px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
}

.owner-tip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px;
  background: rgba(0, 113, 227, 0.06);
  border-radius: var(--radius-lg);
  color: var(--color-primary);
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.owner-tip .el-button { margin-left: auto; }

/* ================================================================
   移动端响应式（≤768px）：详情两栏 → 单栏堆叠
   ================================================================ */
@media (max-width: 768px) {
  .product-detail-page {
    padding: 12px 0 28px;
    min-height: calc(100vh - 56px);
  }

  .detail-layout {
    grid-template-columns: 1fr;
    gap: 20px;
    padding: 14px;
    border-radius: var(--radius-lg);
  }

  .main-image {
    margin-bottom: 12px;
  }

  .main-image img {
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .thumb {
    width: 60px;
    height: 60px;
    border-radius: var(--radius-sm);
  }

  .title {
    font-size: 20px;
    margin-bottom: 12px;
  }

  .price-row {
    gap: 8px;
    margin-bottom: 16px;
  }

  .price {
    font-size: 26px;
  }

  .original-price {
    font-size: 14px;
  }

  .condition-tag {
    padding: 3px 10px;
    font-size: 11px;
  }

  .seller-card {
    padding: 12px;
    margin-bottom: 16px;
  }

  .action-btns {
    gap: 10px;
    margin-bottom: 16px;
  }

  .buy-btn,
  .fav-btn {
    height: 46px !important;
  }

  .fav-btn {
    width: 96px;
    font-size: 14px !important;
  }

  .detail-stats {
    flex-wrap: wrap;
    gap: 10px 16px;
    margin-bottom: 16px;
  }

  .location-bar {
    padding: 12px 14px;
    margin-bottom: 16px;
    font-size: 13px;
  }

  .desc-text {
    font-size: 14px;
    line-height: 1.75;
  }

  .owner-tip {
    padding: 12px 14px;
  }
}
</style>
