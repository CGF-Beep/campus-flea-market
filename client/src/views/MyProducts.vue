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

      <!-- 商品卡片网格 -->
      <div class="products-grid" v-loading="loading">
        <div
          v-for="(p, i) in products"
          :key="p.id"
          class="product-card animate-in"
          :style="{ animationDelay: `${i * 60}ms` }"
          @click="$router.push(`/products/${p.id}`)"
        >
          <SmartImage
            class="prod-img"
            :src="(p.images && p.images[0]) || ''"
            :emoji="categoryEmoji[p.categoryId] || '📦'"
            :alt="p.title"
          />
          <div class="prod-body">
            <div class="prod-title">{{ p.title }}</div>
            <div class="prod-row">
              <span class="prod-price">￥{{ p.price }}</span>
              <span class="status-pill" :class="statusClass(p.status)">{{ statusText(p.status) }}</span>
            </div>
            <div class="prod-meta">
              <span class="meta-item"><el-icon><View /></el-icon> {{ p.views || 0 }} 次浏览</span>
              <span class="meta-item">{{ formatDate(p.createdAt) }}</span>
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
import { ElMessage, ElMessageBox } from 'element-plus'
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
  sold: 'pill-blue',
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

/* 商品网格 */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 16px;
  min-height: 200px;
}
.product-card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}
.product-card:hover {
  transform: translateY(-5px);
  box-shadow: var(--shadow-lg);
}
.prod-img {
  width: 100%;
  height: 160px;
  overflow: hidden;
}
.prod-body {
  padding: 12px 14px 8px;
}
.prod-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.prod-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}
.prod-price {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-price);
  letter-spacing: -0.02em;
}
.prod-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}
.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.prod-actions {
  display: flex;
  justify-content: center;
  gap: 2px;
  padding: 0 6px 8px;
  flex-wrap: nowrap;
}

/* 状态胶囊 */
.status-pill {
  display: inline-block;
  padding: 3px 12px;
  border-radius: 980px;
  font-size: 12px;
  font-weight: 600;
}
.pill-blue { color: #0071e3; background: rgba(0, 113, 227, 0.12); }
.pill-success { color: #1d8a3d; background: rgba(52, 199, 89, 0.14); }
.pill-warning { color: #c76f00; background: rgba(255, 149, 0, 0.14); }
.pill-red { color: var(--color-danger); background: rgba(255, 59, 48, 0.1); }
.pill-gray { color: #86868b; background: rgba(0, 0, 0, 0.06); }

.btn-text {
  border: none;
  background: transparent;
  padding: 4px 10px;
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
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .product-card:hover {
    transform: none;
  }

  .prod-img {
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .prod-body {
    padding: 10px 10px 6px;
  }

  .prod-title {
    font-size: 13px;
  }

  .prod-row {
    margin-top: 6px;
  }

  .prod-price {
    font-size: 15px;
  }

  .prod-meta {
    margin-top: 4px;
    padding-top: 4px;
  }

  .meta-item {
    font-size: 11px;
  }

  /* 4 个操作按钮改为可换行 + 紧凑 */
  .prod-actions {
    flex-wrap: wrap;
    gap: 2px;
    padding: 0 4px 8px;
  }

  .btn-text {
    padding: 4px 8px;
    font-size: 11px;
  }

  .status-pill {
    padding: 2px 8px;
    font-size: 10px;
  }

  .pagination {
    margin-top: 20px;
  }
}
</style>
