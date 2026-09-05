<!-- 逛市场页：分类筛选、排序、价格范围、搜索、商品网格 -->
<template>
  <div class="product-list-page">
    <div class="container">
      <div class="page-header">
        <div class="page-header-left">
          <h1 class="page-title">逛市场</h1>
          <p class="page-desc">发现宝贝好物</p>
        </div>
        <div class="page-search">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索商品..."
            clearable
            @keyup.enter="loadData"
            @clear="loadData"
            class="search-input"
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>
      </div>

      <!-- 分类标签 -->
      <div ref="categoryTabRef" class="category-tabs">
        <div class="category-tab-slider" :style="categorySliderStyle"></div>
        <div data-tab-item class="category-tab" :class="{ active: !filters.categoryId }" @click="selectCategory(null)">全部</div>
        <div
          v-for="cat in categories"
          :key="cat.id"
          data-tab-item
          class="category-tab"
          :class="{ active: filters.categoryId === cat.id }"
          @click="selectCategory(cat.id)"
        >{{ cat.name }}</div>
      </div>

      <!-- 排序/价格 -->
      <div class="toolbar">
        <div ref="sortTabRef" class="sort-btns">
          <div class="sort-tab-slider" :style="sortSliderStyle"></div>
          <span
            v-for="s in sortOptions"
            :key="s.value"
            data-tab-item
            class="sort-btn"
            :class="{ active: filters.sortBy === s.value }"
            @click="filters.sortBy = s.value; loadData()"
          >{{ s.label }}</span>
        </div>
        <div class="price-range">
          <el-input v-model="filters.minPrice" placeholder="最低价" size="small" style="width: 90px" @change="loadData" />
          <span class="price-dash">-</span>
          <el-input v-model="filters.maxPrice" placeholder="最高价" size="small" style="width: 90px" @change="loadData" />
        </div>
      </div>

      <!-- 商品网格 -->
      <div class="products-area">
        <!-- 慢网络时，在网格已淡出的空白区显示独立加载提示（不叠加在旧卡片上） -->
        <div v-if="loading && switching && fadeDone" class="grid-spinner">
          <el-icon class="spin"><Loading /></el-icon>
          <span>加载中…</span>
        </div>
        <transition-group
          :key="gridKey"
          name="product-pop"
          tag="div"
          class="products-grid"
          :class="{ 'is-switching': switching }"
          v-loading="loading && !switching"
          appear
        >
        <div
          v-for="(p, index) in products"
          :key="p.id"
          class="product-card"
          :style="{ '--delay': `${Math.min(index, 12) * 0.04}s` }"
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
              <div class="product-seller">
                <el-avatar :size="22" :src="p.user?.avatar" />
                <span>{{ p.user?.nickname }}</span>
              </div>
              <span class="product-views">{{ p.views }} 浏览</span>
            </div>
          </div>
        </div>
        </transition-group>
      </div>

      <el-empty v-if="!loading && products.length === 0" description="暂无商品" :image-size="120" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { getCategories, getProducts } from '@/api'
import { Search, Loading } from '@element-plus/icons-vue'
import SmartImage from '@/components/SmartImage.vue'
import { useTabSlider } from '@/composables/useTabSlider.js'

const route = useRoute()
const categories = ref([])
const products = ref([])
const loading = ref(false)
const switching = ref(false)
const fadeDone = ref(false)
// 切换分类/排序后 +1，强制重建商品网格，让新列表所有卡片重新触发阶梯弹出动画
const gridKey = ref(0)
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
// 网格退场动画时长，与 .products-grid.is-switching 的 transition 保持一致
const FADE_OUT_MS = 350
let loadToken = 0

const sortOptions = [
  { label: '最新', value: 'latest' },
  { label: '价格↑', value: 'price_asc' },
  { label: '价格↓', value: 'price_desc' },
  { label: '热门', value: 'popular' }
]

const filters = ref({
  categoryId: null,
  condition: '',
  sortBy: 'latest',
  keyword: '',
  minPrice: '',
  maxPrice: ''
})

// 分类 / 排序滑块动画
const {
  containerRef: categoryTabRef,
  sliderStyle: categorySliderStyle,
  updateSlider: updateCategorySlider
} = useTabSlider()
const {
  containerRef: sortTabRef,
  sliderStyle: sortSliderStyle,
  updateSlider: updateSortSlider
} = useTabSlider()

const activeCategoryIndex = computed(() => {
  if (!filters.value.categoryId) return 0
  return categories.value.findIndex((c) => c.id === filters.value.categoryId) + 1
})
const activeSortIndex = computed(() => sortOptions.findIndex((s) => s.value === filters.value.sortBy))

const selectCategory = (id) => {
  filters.value.categoryId = id
  loadData(true)
}

const categoryEmojis = {
  1: '📱', 2: '📚', 3: '🏠', 4: '👕', 5: '🏀', 6: '💄', 7: '🎸', 8: '✨'
}

const getCategoryEmoji = (categoryId) => {
  return categoryEmojis[categoryId] || '📦'
}

const loadData = async (fade = false) => {
  const token = ++loadToken
  loading.value = true
  const startedAt = Date.now()
  if (fade) {
    // 立即开始淡出，与下面的数据请求并行；网格淡出期间不显示任何遮罩，避免叠加旧内容
    switching.value = true
    fadeDone.value = false
  }
  try {
    const params = {
      page: 1,
      pageSize: 1000,
      status: 'on_sale'
    }
    if (filters.value.categoryId) params.categoryId = filters.value.categoryId
    if (filters.value.condition) params.condition = filters.value.condition
    if (filters.value.keyword) params.keyword = filters.value.keyword
    if (filters.value.minPrice) params.minPrice = filters.value.minPrice
    if (filters.value.maxPrice) params.maxPrice = filters.value.maxPrice
    params.sortBy = filters.value.sortBy

    const res = await getProducts(params)
    if (token !== loadToken) return
    if (fade) {
      // 等「淡出动画播完」与「数据回来」中较慢的那个，保证换数据时网格已完全不可见（绝不新旧叠加）
      const elapsed = Date.now() - startedAt
      if (elapsed < FADE_OUT_MS) await delay(FADE_OUT_MS - elapsed)
      if (token !== loadToken) return
      fadeDone.value = true // 若仍在校验/慢网络，在空白区显示独立加载提示
      products.value = res.data.list
      gridKey.value++ // 强制重建网格，所有卡片重新走阶梯弹出动画（避免新旧列表相同商品不触发 enter）
      await nextTick()
      switching.value = false // 新列表逐个弹出
    } else {
      products.value = res.data.list
    }
    loading.value = false
  } catch (e) {
    console.error('加载商品失败', e)
    if (token === loadToken) {
      loading.value = false
      switching.value = false
    }
  }
}

watch(() => route.query.keyword, (val) => {
  filters.value.keyword = val || ''
  loadData(true)
})

watch(() => route.query.categoryId, (val) => {
  filters.value.categoryId = val ? Number(val) : null
  loadData(true)
})

watch(activeCategoryIndex, updateCategorySlider)
watch(activeSortIndex, updateSortSlider)
watch(categories, () => updateCategorySlider(activeCategoryIndex.value))

onMounted(async () => {
  const catRes = await getCategories()
  categories.value = catRes.data

  if (route.query.keyword) filters.value.keyword = route.query.keyword
  if (route.query.categoryId) filters.value.categoryId = Number(route.query.categoryId)

  loadData()
  updateCategorySlider(activeCategoryIndex.value)
  updateSortSlider(activeSortIndex.value)
})
</script>

<style scoped>
.product-list-page {
  padding: 40px 0 60px;
  background: var(--color-bg-secondary);
  min-height: calc(100vh - 64px);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 28px;
}

.page-header-left {
  flex-shrink: 0;
}

.page-title {
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

.page-desc {
  font-size: 16px;
  color: var(--color-text-secondary);
  margin-top: 6px;
}

.page-search {
  flex: 1;
  max-width: 360px;
  margin-left: 24px;
}

.search-input :deep(.el-input__wrapper) {
  background: #fff;
  border: 1.5px solid #e5e5ea;
  border-radius: 980px !important;
  padding: 8px 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

.search-input :deep(.el-input__wrapper:hover) {
  border-color: #c7c7cc;
}

.search-input :deep(.el-input__wrapper.is-focus) {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.12);
}

.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  position: relative;
}

.category-tab-slider {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 980px;
  background: var(--color-text);
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  will-change: transform, opacity;
  z-index: 0;
  pointer-events: none;
}

.category-tab {
  position: relative;
  padding: 8px 20px;
  border-radius: 980px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.3s ease;
  z-index: 1;
}

.category-tab:hover {
  color: var(--color-text);
}

.category-tab.active {
  color: #fff;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.sort-btns {
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 980px;
  padding: 3px;
  position: relative;
}

.sort-tab-slider {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 980px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  will-change: transform, opacity;
  z-index: 0;
  pointer-events: none;
}

.sort-btn {
  position: relative;
  padding: 6px 16px;
  border-radius: 980px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.3s ease;
  z-index: 1;
}

.sort-btn:hover {
  color: var(--color-text);
}

.sort-btn.active {
  color: var(--color-text);
}

.price-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.price-dash {
  color: var(--color-text-tertiary);
}

.products-area {
  position: relative;
  min-height: 200px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  min-height: 200px;
  position: relative;
}

/* 切换分类时整块网格优雅退场（上浮+缩小+淡出），数据在不可见时替换，杜绝新旧叠加残影；
   与 tab 滑块同速同缓动（0.35s），节奏统一；淡入由下方卡片 enter 动画逐个接管，故不设常驻过渡 */
.products-grid.is-switching {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
}

/* 慢网络时在空白区显示独立加载提示（位于网格之外，不会叠加在旧卡片上） */
.grid-spinner {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.grid-spinner .spin {
  animation: grid-spin 0.9s linear infinite;
}

@keyframes grid-spin {
  to { transform: rotate(360deg); }
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

/* 卡片阶梯弹出（初次加载与分类/排序切换共用）：
   与顶部 tab 滑块同速同缓动，保留阶梯延迟；appear 时 Vue 自动复用 enter 类 */
.product-pop-enter-active {
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  transition-delay: var(--delay, 0s);
  will-change: transform, opacity;
}

.product-pop-enter-from {
  opacity: 0;
  transform: translateY(18px) scale(0.96);
}

.product-image {
  position: relative;
  height: 200px;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.product-card:hover .product-image img {
  transform: scale(1.05);
}

.product-condition {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(10px);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  border-radius: 980px;
}

.product-info {
  padding: 16px;
}

.product-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 10px;
}

.product-price-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 12px;
}

.product-price {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-price);
}

.product-original {
  font-size: 13px;
  color: var(--color-text-tertiary);
  text-decoration: line-through;
}

.product-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-seller {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.product-views {
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* ================================================================
   移动端响应式（≤768px）
   ================================================================ */
@media (max-width: 768px) {
  .product-list-page {
    padding: 16px 0 24px;
    min-height: calc(100vh - 56px);
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    margin-bottom: 20px;
  }

  .page-title {
    font-size: 28px;
  }

  .page-desc {
    font-size: 14px;
    margin-top: 4px;
  }

  .page-search {
    flex: 1;
    max-width: 100%;
    margin-left: 0;
  }

  .category-tabs {
    gap: 6px;
    margin-bottom: 16px;
  }

  .category-tab {
    padding: 7px 15px;
    font-size: 13px;
  }

  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    margin-bottom: 20px;
  }

  .sort-btns {
    align-self: flex-start;
  }

  .sort-btn {
    padding: 6px 13px;
    font-size: 12px;
  }

  .price-range {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .price-range :deep(.el-input) {
    width: auto !important;
    flex: 1;
  }

  /* 商品 4 列 → 2 列 */
  .products-grid {
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

  .product-card:hover .product-image img {
    transform: none;
  }

  .product-image {
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .product-image img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .product-condition {
    top: 8px;
    right: 8px;
    padding: 3px 9px;
    font-size: 10px;
  }

  .product-info {
    padding: 10px 12px 12px;
  }

  .product-title {
    font-size: 14px;
    margin-bottom: 6px;
  }

  .product-price-row {
    gap: 6px;
    margin-bottom: 8px;
  }

  .product-price {
    font-size: 17px;
  }

  .product-original {
    font-size: 11px;
  }

  .product-seller {
    font-size: 11px;
  }

  .product-seller :deep(.el-avatar) {
    width: 18px !important;
    height: 18px !important;
  }

  .product-views {
    font-size: 11px;
  }
}</style>
