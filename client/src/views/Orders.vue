<template>
  <div class="orders page-content">
    <div class="container">
      <!-- 页面标题 -->
      <div class="page-header">
        <h2 class="page-title">我的订单</h2>
        <p class="page-subtitle">查看你的交易记录</p>
      </div>

      <!-- 分段切换 -->
      <div ref="tabRef" class="segmented">
        <div class="order-tab-slider" :style="sliderStyle"></div>
        <div
          data-tab-item
          class="seg-item"
          :class="{ active: role === 'buyer' }"
          @click="switchRole('buyer')"
        >我买到的</div>
        <div
          data-tab-item
          class="seg-item"
          :class="{ active: role === 'seller' }"
          @click="switchRole('seller')"
        >我卖出的</div>
      </div>

      <!-- 订单卡片列表 -->
      <div class="order-list" v-loading="loading">
        <div v-for="(o, i) in orders" :key="o.id" class="order-card animate-in" :style="{ animationDelay: `${i * 60}ms` }">
          <div class="order-main" @click="$router.push(`/products/${o.productId}`)">
            <SmartImage
              class="order-img"
              :src="(o.product?.images && o.product.images[0]) || ''"
              emoji="📦"
              :alt="o.product?.title || '商品'"
            />
            <div class="order-info">
              <div class="order-title">{{ o.product?.title || '商品已下架' }}</div>
              <div class="order-meta">
                <span class="meta-item">
                  <el-icon><User /></el-icon>
                  {{ role === 'buyer' ? (o.seller?.nickname || '卖家') : (o.buyer?.nickname || '买家') }}
                </span>
                <span class="meta-item">
                  <el-icon><Clock /></el-icon>
                  {{ formatDate(o.createdAt) }}
                </span>
              </div>
              <div class="order-no">订单号：{{ o.orderNo }}</div>
            </div>
            <div class="order-right">
              <div class="order-price">￥{{ o.price }}</div>
              <span class="status-pill" :class="statusClass(o.status)">{{ statusText(o.status) }}</span>
            </div>
          </div>
          <div class="order-actions">
            <button class="btn-text" @click="$router.push(`/products/${o.productId}`)">查看商品</button>
            <!-- 卖家操作：待确认状态下确认订单 -->
            <button
              v-if="role === 'seller' && o.status === 'pending'"
              class="btn-text btn-success"
              @click="handleSellerConfirm(o)"
            >确认订单</button>
            <!-- 买家操作：卖家已确认后当面确认收货 -->
            <button
              v-if="role === 'buyer' && o.status === 'confirmed'"
              class="btn-text btn-success"
              @click="handleBuyerReceive(o)"
            >确认收货</button>
            <!-- pending/confirmed 阶段双方都可取消 -->
            <button
              v-if="(o.status === 'pending' || o.status === 'confirmed') && (role === 'buyer' || role === 'seller')"
              class="btn-text btn-danger"
              @click="handleCancel(o)"
            >取消订单</button>
            <button class="btn-text btn-danger" @click="handleDelete(o)">删除记录</button>
          </div>
        </div>

        <el-empty
          v-if="!loading && orders.length === 0"
          description="暂无订单记录"
        >
          <button class="btn-primary" @click="$router.push('/products')">去逛逛</button>
        </el-empty>
      </div>

      <div class="pagination" v-if="total > 0">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="10"
          layout="prev, pager, next"
          @current-change="loadData"
          background
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { getMyOrders, confirmOrder, receiveOrder, cancelOrder, deleteOrder } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { User, Clock } from '@element-plus/icons-vue'
import SmartImage from '@/components/SmartImage.vue'
import { useTabSlider } from '@/composables/useTabSlider.js'

const loading = ref(false)
const orders = ref([])
const page = ref(1)
const total = ref(0)
const role = ref('buyer')

const { containerRef: tabRef, sliderStyle, updateSlider } = useTabSlider()
const activeIndex = computed(() => role.value === 'buyer' ? 0 : 1)
watch(activeIndex, updateSlider)

const loadData = async () => {
  loading.value = true
  try {
    const res = await getMyOrders({ page: page.value, pageSize: 10, role: role.value })
    orders.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

const switchRole = (r) => {
  if (role.value === r) return
  role.value = r
  page.value = 1
  loadData()
}

const statusText = (s) => ({ pending: '待卖家确认', confirmed: '待买家确认收货', completed: '已完成', cancelled: '已取消' })[s] || s
const statusClass = (s) => ({
  pending: 'pill-warning',
  confirmed: 'pill-primary',
  completed: 'pill-success',
  cancelled: 'pill-gray'
})[s] || 'pill-gray'

const formatDate = (d) => new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

// 卖家确认订单（pending → confirmed，等待买家当面验货）
const handleSellerConfirm = async (row) => {
  try {
    await ElMessageBox.confirm('确认后请与买家约定时间地点当面交易', '确认订单', { confirmButtonText: '确认', cancelButtonText: '取消' })
    await confirmOrder(row.id)
    ElMessage.success('已确认，等待买家当面确认收货')
    loadData()
  } catch (e) {}
}

// 买家当面确认收货（confirmed → completed，交易完成）
const handleBuyerReceive = async (row) => {
  try {
    await ElMessageBox.confirm('确认已收到商品且无问题？交易将完成。', '确认收货', { confirmButtonText: '确认', cancelButtonText: '取消' })
    await receiveOrder(row.id)
    ElMessage.success('已确认收货，交易完成')
    loadData()
  } catch (e) {}
}
const handleCancel = async (row) => {
  try {
    await ElMessageBox.confirm('确定要取消该订单吗？', '提示', { confirmButtonText: '确定', cancelButtonText: '取消' })
    await cancelOrder(row.id)
    ElMessage.success('已取消')
    loadData()
  } catch (e) {}
}
const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定要删除该订单记录吗？删除后不可恢复。', '提示', { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' })
    await deleteOrder(row.id)
    ElMessage.success('订单记录已删除')
    loadData()
  } catch (e) {}
}

onMounted(() => {
  loadData()
  updateSlider(activeIndex.value)
})
</script>

<style scoped>
.page-header {
  margin-bottom: 24px;
}
.page-title {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
}
.page-subtitle {
  margin-top: 6px;
  font-size: 15px;
  color: var(--color-text-secondary);
}

/* 分段切换 */
.segmented {
  display: inline-flex;
  padding: 4px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 980px;
  margin-bottom: 24px;
  gap: 4px;
  position: relative;
}
.order-tab-slider {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 980px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  z-index: 0;
  pointer-events: none;
}
.seg-item {
  position: relative;
  padding: 9px 28px;
  border-radius: 980px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.3s ease;
  user-select: none;
  z-index: 1;
}
.seg-item.active {
  color: var(--color-text);
}

/* 订单卡片 */
.order-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 200px;
}
.order-card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.3s ease;
  overflow: hidden;
}
.order-card:hover {
  box-shadow: var(--shadow-md);
}
.order-main {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  cursor: pointer;
}
.order-img {
  width: 96px;
  height: 96px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  overflow: hidden;
}
.order-info {
  flex: 1;
  min-width: 0;
}
.order-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.order-meta {
  display: flex;
  gap: 20px;
  margin-top: 8px;
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.order-no {
  margin-top: 6px;
  font-size: 12px;
  color: var(--color-text-tertiary);
  font-family: 'SF Mono', Consolas, monospace;
}
.order-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.order-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-price);
  letter-spacing: -0.02em;
}

/* 状态胶囊 */
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

/* 操作按钮 */
.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  background: #fafafa;
}
.btn-text {
  border: none;
  background: transparent;
  padding: 7px 18px;
  border-radius: 980px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.25s ease;
}
.btn-text:hover {
  background: rgba(0, 113, 227, 0.08);
}
.btn-success { color: #1d8a3d; }
.btn-success:hover { background: rgba(52, 199, 89, 0.12); }
.btn-danger { color: var(--color-danger); }
.btn-danger:hover { background: rgba(255, 59, 48, 0.08); }

.pagination {
  margin-top: 32px;
  display: flex;
  justify-content: center;
}

/* ================================================================
   移动端响应式（≤768px）
   ================================================================ */
@media (max-width: 768px) {
  .page-header {
    margin-bottom: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .page-subtitle {
    font-size: 13px;
    margin-top: 4px;
  }

  .segmented {
    margin-bottom: 16px;
  }

  .seg-item {
    padding: 7px 20px;
    font-size: 13px;
  }

  .order-main {
    padding: 14px;
    gap: 12px;
    align-items: flex-start;
  }

  .order-img {
    width: 76px;
    height: 76px;
    border-radius: var(--radius-sm);
  }

  .order-info {
    flex: 1 1 calc(100% - 100px);
    min-width: 0;
  }

  .order-title {
    font-size: 15px;
  }

  .order-meta {
    flex-wrap: wrap;
    gap: 6px 12px;
    margin-top: 6px;
  }

  .meta-item {
    font-size: 12px;
  }

  .order-no {
    font-size: 11px;
    margin-top: 4px;
  }

  /* 右侧价格 + 状态改为横排贴在顶部，缩小字号 */
  .order-right {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    align-self: flex-start;
    flex-shrink: 0;
  }

  .order-price {
    font-size: 17px;
  }

  .status-pill {
    padding: 3px 10px;
    font-size: 11px;
  }

  .order-actions {
    padding: 10px 14px;
    flex-wrap: wrap;
    gap: 6px 4px;
  }

  .btn-text {
    padding: 5px 12px;
    font-size: 12px;
  }

  .pagination {
    margin-top: 20px;
  }
}
</style>
