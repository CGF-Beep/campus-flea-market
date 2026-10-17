<template>
  <div class="my-products page-content">
    <div class="container">
      <!-- 页面标题 -->
      <div class="page-header">
        <div>
          <h2 class="page-title">我的商品</h2>
          <p class="page-subtitle">管理你发布的闲置物品</p>
        </div>
        <button class="btn-primary publish-btn" @click="$router.push('/publish')">
          <el-icon style="margin-right: 6px"><Plus /></el-icon>
          发布新商品
        </button>
      </div>

      <!-- 状态分段切换 -->
      <div ref="tabRef" class="segmented">
        <div class="product-tab-slider" :style="sliderStyle"></div>
        <div
          v-for="tab in tabs"
          :key="tab.value"
          data-tab-item
          class="seg-item"
          :class="{ active: activeTab === tab.value }"
          @click="switchTab(tab.value)"
        >{{ tab.label }}</div>
      </div>

      <!-- 首次加载骨架屏（与逛市场商品卡片同尺寸） -->
      <div v-if="loading && products.length === 0" class="skeleton-grid">
        <div v-for="n in 4" :key="'sk' + n" class="skeleton-card">
          <div class="skeleton-img"></div>
          <div class="skeleton-line lg"></div>
          <div class="skeleton-line sm"></div>
        </div>
      </div>

      <!-- 商品卡片网格（首次用骨架，后续直接数据切换） -->
      <div class="products-grid">
        <div v-for="p in products" :key="p.id" class="product-card">
          <div class="prod-main" @click="$router.push(`/products/${p.id}`)">
            <SmartImage
              class="prod-img"
              :src="(p.images && p.images[0]) || ''"
              :emoji="categoryEmoji[p.categoryId] || '📦'"
              :alt="p.title"
            />
            <div class="prod-info">
              <div class="prod-title">{{ p.title }}</div>
              <div class="prod-meta">
                <span class="meta-item"><el-icon><View /></el-icon> {{ p.views || 0 }} 次浏览</span>
                <span class="meta-item">{{ formatDate(p.createdAt) }}</span>
              </div>
            </div>
            <div class="prod-right">
              <div class="prod-price">￥{{ p.price }}</div>
              <span class="status-pill" :class="statusClass(p.status)">{{ statusText(p.status) }}</span>
            </div>
          </div>
          <div class="prod-actions" @click.stop>
            <button class="btn-text" @click="$router.push(`/products/${p.id}`)">查看</button>
            <button
              v-if="p.status !== 'sold'"
              class="btn-text"
              @click="$router.push(`/publish/${p.id}`)"
            >编辑</button>
            <button
              v-if="p.status === 'on_sale'"
              class="btn-text btn-danger"
              @click="handleRemove(p)"
            >下架</button>
            <button class="btn-text btn-danger" @click="handleDelete(p)">删除</button>
          </div>
        </div>

        <el-empty
          v-if="!loading && products.length === 0"
          description="还没有商品，快去发布第一件闲置吧"
          style="grid-column: 1 / -1"
        >
          <button class="btn-primary" @click="$router.push('/publish')">立即发布</button>
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
import { getMyProducts, removeProduct, deleteProduct } from '@/api'
import { Plus, View } from '@element-plus/icons-vue'
import SmartImage from '@/components/SmartImage.vue'
import { useTabSlider } from '@/composables/useTabSlider.js'

const loading = ref(false)
const products = ref([])
const page = ref(1)
const total = ref(0)
const activeTab = ref('')

const tabs = [
  { label: '全部', value: '' },
  { label: '待审核', value: 'pending' },
  { label: '在售', value: 'on_sale' },
  { label: '已售', value: 'sold' },
  { label: '下架', value: 'removed' }
]

const { containerRef: tabRef, sliderStyle, updateSlider } = useTabSlider()
const activeIndex = computed(() => tabs.findIndex((t) => t.value === activeTab.value))
watch(activeIndex, updateSlider)

const categoryEmoji = {
  1: '📱', 2: '📚', 3: '🏠', 4: '👕', 5: '🏀', 6: '💄', 7: '🎸', 8: '✨'
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getMyProducts({ page: page.value, pageSize: 10, status: activeTab.value })
    products.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

const switchTab = (v) => {
  if (activeTab.value === v) return
  activeTab.value = v
  page.value = 1
  loadData()
}

const statusText = (s) => ({ pending: '待审核', on_sale: '在售', sold: '已售', rejected: '被拒绝', removed: '已下架' })[s] || s
const statusClass = (s) => ({
  pending: 'pill-warning',
  on_sale: 'pill-success',
  sold: 'pill-primary',
  rejected: 'pill-red',
  removed: 'pill-gray'
})[s] || 'pill-gray'

const formatDate = (d) => new Date(d).toLocaleDateString('zh-CN')

const handleRemove = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要下架「${row.title}」吗？`, '提示', { confirmButtonText: '确定', cancelButtonText: '取消' })
    await removeProduct(row.id)
    ElMessage.success('已下架')
    loadData()
  } catch (e) {}
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除「${row.title}」吗？此操作不可恢复！`,
      '永久删除',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
    await deleteProduct(row.id)
    ElMessage.success('已永久删除')
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
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
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
.publish-btn {
  display: inline-flex;
  align-items: center;
  padding: 12px 28px;
}

/* 分段切换 */
.segmented {
  display: inline-flex;
  padding: 4px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 980px;
  margin-bottom: 24px;
  gap: 4px;
  flex-wrap: wrap;
  position: relative;
}
.product-tab-slider {
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
  padding: 9px 24px;
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

/* 卡片列表：与「我的订单」保持一致的横向列表卡结构
   （缩略图在左 / 信息居中 / 价格与状态在右 / 底部操作条） */
.products-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 200px;
}
.product-card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.3s ease;
  overflow: hidden;
}
/* 显式覆盖 global.css 里 .product-card:hover 的 translateY 抬起动画：
   列表卡片只需阴影变化，整行位移会让观感不稳 */
.product-card:hover {
  transform: none;
  box-shadow: var(--shadow-md);
}
.prod-main {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 24px;
  cursor: pointer;
}
.prod-img {
  width: 96px;
  height: 96px;
  border-radius: var(--radius-md);
  flex-shrink: 0;
  overflow: hidden;
}
.prod-info {
  flex: 1;
  min-width: 0;
}
.prod-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prod-meta {
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
.prod-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}
.prod-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-price);
  letter-spacing: -0.02em;
}
.prod-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  background: #fafafa;
}

/* 状态胶囊（尺寸与「我的订单」保持一致） */
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
.pill-red { color: var(--color-danger); background: rgba(255, 59, 48, 0.1); }
.pill-gray { color: #86868b; background: rgba(0, 0, 0, 0.06); }

.btn-text {
  border: none;
  background: transparent;
  padding: 7px 18px;
  border-radius: 980px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-primary);
  cursor: pointer;
  transition: all 0.25s ease;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-text:hover {
  background: rgba(0, 113, 227, 0.08);
}
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
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    margin-bottom: 16px;
  }

  .page-title {
    font-size: 24px;
  }

  .page-subtitle {
    font-size: 13px;
    margin-top: 4px;
  }

  .publish-btn {
    align-self: flex-start;
  }

  .segmented {
    margin-bottom: 16px;
    gap: 4px;
  }

  .seg-item {
    padding: 7px 16px;
    font-size: 13px;
  }

  .products-grid {
    /* 已是 flex 纵向列表，移动端只需收紧卡片间距 */
    gap: 12px;
  }

  .prod-main {
    padding: 12px;
    gap: 10px;
    align-items: flex-start;
    /* 允许右侧价格+状态换到第二行 */
    flex-wrap: wrap;
  }

  .prod-img {
    width: 64px;
    height: 64px;
    border-radius: var(--radius-sm);
  }

  .prod-info {
    flex: 1 1 calc(100% - 74px);
    min-width: 0;
  }

  .prod-title {
    font-size: 15px;
  }

  /* meta 两项都很短（如「22 次浏览」「2026/8/6」），保持一行即可，
     竖排会白占两行高度 */
  .prod-meta {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    margin-top: 6px;
  }

  .meta-item {
    font-size: 12px;
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* 价格 + 状态：换到第二行，并缩进到与标题左对齐
     （缩进 = 缩略图 64 + 间距 10 = 74px），避免贴到卡片最左侧显得孤立 */
  .prod-right {
    flex: 1 1 100%;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding-left: 74px;
  }

  .prod-price {
    font-size: 17px;
  }

  .prod-actions {
    padding: 10px 14px;
    flex-wrap: wrap;
    gap: 6px 4px;
  }

  .btn-text {
    padding: 5px 12px;
    font-size: 12px;
  }

  .status-pill {
    padding: 3px 10px;
    font-size: 11px;
  }

  .pagination {
    margin-top: 20px;
  }
}
</style>
