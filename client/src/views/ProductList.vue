<!-- 逛市场页：分类筛选、排序、价格范围、搜索、商品网格 -->
<template>
  <div class="product-list-page">
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">逛市场</h1>
        <div class="header-row">
          <div class="page-search">
            <el-input
              v-model="filters.keyword"
              placeholder="搜索商品..."
              clearable
              @keyup.enter="reload"
              @clear="reload"
              class="search-input"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>
          <button class="filter-trigger" @click="drawerVisible = true" type="button">
            <el-icon><Filter /></el-icon>
            <span class="filter-trigger-text">筛选</span>
            <span v-if="filterCount" class="filter-badge">{{ filterCount }}</span>
          </button>
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
            @click="filters.sortBy = s.value; reload(false)"
          >{{ s.label }}</span>
        </div>
        <div class="price-range">
          <el-input v-model="filters.minPrice" placeholder="最低价" size="small" style="width: 90px" @change="reload(false)" />
          <span class="price-dash">-</span>
          <el-input v-model="filters.maxPrice" placeholder="最高价" size="small" style="width: 90px" @change="reload(false)" />
        </div>
      </div>

      <!-- 移动端筛选：中间卡片弹窗（毛玻璃） -->
      <el-dialog
        v-model="drawerVisible"
        :show-close="false"
        :modal="true"
        :close-on-click-modal="true"
        :close-on-press-escape="true"
        width="92%"
        class="filter-modal"
        custom-class="filter-modal-glass"
      >
        <div class="filter-sheet">
          <div class="sheet-header">
            <h3>筛选</h3>
            <el-icon class="sheet-close" @click="drawerVisible = false"><Close /></el-icon>
          </div>
          <div class="sheet-section">
            <h4>分类</h4>
            <div class="sheet-chips">
              <div class="sheet-chip" :class="{ active: !filters.categoryId }" @click="filters.categoryId = null">全部</div>
              <div
                v-for="cat in categories"
                :key="cat.id"
                class="sheet-chip"
                :class="{ active: filters.categoryId === cat.id }"
                @click="filters.categoryId = cat.id"
              >{{ cat.name }}</div>
            </div>
          </div>
          <div class="sheet-section">
            <h4>排序</h4>
            <div class="sheet-sort">
              <div
                v-for="s in sortOptions"
                :key="s.value"
                class="sheet-sort-btn"
                :class="{ active: filters.sortBy === s.value }"
                @click="filters.sortBy = s.value"
              >{{ s.label }}</div>
            </div>
          </div>
          <div class="sheet-section">
            <h4>价格区间</h4>
            <div class="sheet-price">
              <el-input v-model="localMin" placeholder="最低价" type="number" clearable />
              <span class="sheet-dash">—</span>
              <el-input v-model="localMax" placeholder="最高价" type="number" clearable />
            </div>
          </div>
          <div class="sheet-footer">
            <el-button @click="resetFilter" plain>重置</el-button>
            <el-button type="primary" @click="applyFilter">应用</el-button>
          </div>
        </div>
      </el-dialog>

      <!-- 商品网格 -->
      <div class="products-area">
        <!-- 首次加载骨架屏：占位卡片 + 微光扫过；陈哥：不要转圈，只要骨架 -->
        <div v-if="loading && products.length === 0" class="skeleton-grid">
          <div v-for="n in 8" :key="'sk' + n" class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-line lg"></div>
            <div class="skeleton-line sm"></div>
          </div>
        </div>
        <!-- 切分类时整块网格优雅淡出，期间不显示任何遮罩，
             数据回来时新卡片逐个弹出（无 v-loading 转圈） -->
        <transition-group
          :key="gridKey"
          name="product-pop"
          tag="div"
          class="products-grid"
          :class="{ 'is-switching': switching }"
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

      <!-- 加载失败：与「真的没有商品」分开。
           跨境变慢时接口可能超时，这时是失败态而不是空态 ——
           否则会显示「市场里还没有商品」，让人误以为站里没货。 -->
      <el-empty
        v-if="!loading && loadFailed"
        description="加载失败，请重试"
        :image-size="120"
      >
        <div class="load-fail-actions">
          <button class="btn-primary" @click="continueWaiting">继续等待</button>
          <button class="btn-secondary" @click="reload(false)">重试</button>
        </div>
      </el-empty>

      <!-- 空状态分场景：有筛选条件时提示换关键词并给「清空筛选」，否则引导去发布 -->
      <el-empty
        v-else-if="!loading && products.length === 0"
        :description="hasActiveFilter ? '没有找到符合条件的好物' : '市场里还没有商品'"
        :image-size="120"
      >
        <button v-if="hasActiveFilter" class="btn-primary" @click="clearAllFilters">清空筛选条件</button>
        <button v-else class="btn-primary" @click="$router.push('/publish')">成为第一个发布的人</button>
      </el-empty>

    </div>

    <!-- 返回顶部（仅 PC）：桌面没有底部 TabBar，所以留在右下角；
         移动端改成京东式 —— 滚下去时底部「市场」Tab 自己变成「顶部」（见 useTabBackTop + Layout.vue） -->
    <transition name="back-top">
      <button
        v-show="showBackTop"
        class="back-top"
        type="button"
        aria-label="返回顶部"
        @click="scrollToTop"
      >
        <el-icon><Top /></el-icon>
      </button>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onActivated, onDeactivated, watch, computed, nextTick, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { getCategories, getProducts } from '@/api'
import { setLongWait } from '@/utils/request'
import { Search, Filter, Close, Top } from '@element-plus/icons-vue'
import SmartImage from '@/components/SmartImage.vue'
import { useTabSlider } from '@/composables/useTabSlider.js'
import { useTabBackTop } from '@/composables/useTabBackTop.js'

// 供 Layout.vue 的 <keep-alive :include> 匹配，改这里要同步改 Layout 的 cachedViews
defineOptions({ name: 'ProductList' })

const route = useRoute()
const categories = ref([])
const products = ref([])
const loading = ref(true)
const switching = ref(false)
const fadeDone = ref(false)
// 切换分类后 +1，强制重建商品网格，让新列表所有卡片重新触发阶梯弹出动画。
// 排序不重建 —— 排序是同一批商品换顺序，走 transition-group 的原地重排（FLIP）。
// 所有分类共用同一套动画，没有按分类分支的逻辑。
const gridKey = ref(0)
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
// 网格退场动画时长，与 .products-grid.is-switching 的 transition 保持一致
const FADE_OUT_MS = 350
let loadToken = 0
// 加载失败标记：把「请求失败」和「真的没有商品」区分开。
// 之前失败时不设任何标记，页面会落到商品空状态上显示「市场里还没有商品」，
// 让人误以为站里没货（跨境变慢时尤其容易触发）。
const loadFailed = ref(false)

const sortOptions = [
  { label: '最新', value: 'latest' },
  { label: '价格↑', value: 'price_asc' },
  { label: '价格↓', value: 'price_desc' },
  { label: '热门', value: 'popular' }
]

// ===== 数据加载（已取消分页）=====
// 需求：不再给用户翻页，列表一次到底。
// 后端 `utils/pagination.js` 把单页条数钳在 100，所以不能靠「一个请求 pageSize=1000」，
// 改为前端按页拉、自动循环取完为止（校园市场商品量级小，通常 1 个请求就够）。
// 只动前端 → 部署时不需要重启后端。
const PAGE_SIZE = 100
// 安全阀：最多取 50 页（5000 条），避免后端 total 异常时无限循环
const MAX_PAGES = 50
const total = ref(0)


// 移动端：<=768 判定（返回顶部按钮要按端选滚动容器）
const isMobile = ref(false)
const syncIsMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

const filters = ref({
  categoryId: null,
  condition: '',
  sortBy: 'latest',
  keyword: '',
  minPrice: '',
  maxPrice: ''
})

// ===== 移动端筛选抽屉（≤768 使用） =====
const drawerVisible = ref(false)
const localMin = ref('')
const localMax = ref('')

const filterCount = computed(() => {
  let n = 0
  if (filters.value.categoryId) n++
  if (filters.value.sortBy && filters.value.sortBy !== 'latest') n++
  if (localMin.value || localMax.value) n++
  return n
})

watch(drawerVisible, (v) => {
  if (v) {
    localMin.value = filters.value.minPrice || ''
    localMax.value = filters.value.maxPrice || ''
  }
})

const resetFilter = () => {
  filters.value.categoryId = null
  filters.value.sortBy = 'latest'
  localMin.value = ''
  localMax.value = ''
}

const applyFilter = () => {
  filters.value.minPrice = localMin.value
  filters.value.maxPrice = localMax.value
  drawerVisible.value = false
  reload(false)
}

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
  reload(true)
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
  loadFailed.value = false
  const startedAt = Date.now()
  if (fade) {
    // 立即开始淡出，与下面的数据请求并行；网格淡出期间不显示任何遮罩，避免叠加旧内容
    switching.value = true
    fadeDone.value = false
  }
  try {
    const buildParams = (p) => {
      const params = {
        page: p,
        pageSize: PAGE_SIZE,
        status: 'on_sale'
      }
      if (filters.value.categoryId) params.categoryId = filters.value.categoryId
      if (filters.value.condition) params.condition = filters.value.condition
      if (filters.value.keyword) params.keyword = filters.value.keyword
      if (filters.value.minPrice) params.minPrice = filters.value.minPrice
      if (filters.value.maxPrice) params.maxPrice = filters.value.maxPrice
      params.sortBy = filters.value.sortBy
      return params
    }

    // 循环拉完所有页（后端单页上限 100）。中途任一次被新的加载取代就整体放弃。
    // 后端 paginate() 返回 { list, total, page, pageSize, totalPages }
    let list = []
    for (let p = 1; p <= MAX_PAGES; p++) {
      const res = await getProducts(buildParams(p))
      if (token !== loadToken) return
      const data = res.data || {}
      const chunk = data.list || []
      total.value = data.total || chunk.length
      list = list.concat(chunk)
      // 本页没取满、或已取够 total → 到底了
      if (chunk.length < PAGE_SIZE || list.length >= total.value) break
    }

    if (fade) {
      // 等「淡出动画播完」与「数据回来」中较慢的那个，保证换数据时网格已完全不可见（绝不新旧叠加）
      const elapsed = Date.now() - startedAt
      if (elapsed < FADE_OUT_MS) await delay(FADE_OUT_MS - elapsed)
      if (token !== loadToken) return
      fadeDone.value = true // 若仍在校验/慢网络，在空白区显示独立加载提示
      products.value = list
      gridKey.value++ // 强制重建网格，所有卡片重新走阶梯弹出动画（避免新旧列表相同商品不触发 enter）
      await nextTick()
      switching.value = false // 新列表逐个弹出
    } else {
      products.value = list
    }
    loading.value = false
  } catch (e) {
    console.error('加载商品失败', e)
    if (token === loadToken) {
      loading.value = false
      switching.value = false
      // 清空列表，让「加载失败」状态真正显示出来
      // （否则会带着上一批结果渲染，用户看不出这次筛选失败了）
      products.value = []
      loadFailed.value = true
    }
  }
}

// 统一的「条件变更」入口：带淡出重新加载
const reload = (fade = true) => {
  loadData(fade)
}

// 「继续等待」：用户明确表示愿意多等，把这批请求的超时放宽到 60 秒再跑一次。
// 跑完必须复位，否则后续其它页面的请求也会跟着放宽。
// 等待期间 loading 会亮起，7 秒时还会再弹一次「正在努力加载，请耐心等待…」。
const continueWaiting = async () => {
  setLongWait(true)
  try {
    await loadData(false)
  } finally {
    setLongWait(false)
  }
}

// ===== 返回顶部 =====
// 两端滚动容器不同：PC 滚 window；移动端是 App-Shell（body 不滚），滚的是 Layout 的 .main-content。
// 呈现方式两端也不同（陈哥定的「京东式」）：
//   PC    —— 没底部 TabBar，仍是右下角浮一个圆形按钮；
//   移动端 —— 滚下去时底部「市场」Tab 自己变成「顶部」，点它回顶，见 useTabBackTop。
const showBackTop = ref(false)
const BACK_TOP_OFFSET = 400
let backTopTicking = false

const {
  setVisible: setTabBackTop,
  setHandler: setTabBackTopHandler,
  reset: resetTabBackTop
} = useTabBackTop()

const mainScrollEl = () => document.querySelector('.main-content')

const currentScrollTop = () => {
  const el = mainScrollEl()
  if (isMobile.value && el) return el.scrollTop
  return window.scrollY || document.documentElement.scrollTop || 0
}

// 滚动事件很密，用 rAF 节流：一帧最多判断一次，避免卡顿
const handleScroll = () => {
  if (backTopTicking) return
  backTopTicking = true
  requestAnimationFrame(() => {
    backTopTicking = false
    const scrolled = currentScrollTop() > BACK_TOP_OFFSET
    // PC：浮标；移动端：交给 TabBar（它只在 ≤768px 渲染，所以直接把状态发过去）
    showBackTop.value = scrolled && !isMobile.value
    setTabBackTop(scrolled)
  })
}

const scrollToTop = () => {
  const el = isMobile.value ? mainScrollEl() : null
  if (el) el.scrollTo({ top: 0, behavior: 'smooth' })
  else window.scrollTo({ top: 0, behavior: 'smooth' })
}

// 捕获阶段挂在 window 上：元素自身的 scroll 不冒泡，但能被 window 捕获，
// 这样 PC 的 window 滚动和移动端 .main-content 的滚动一个监听就都覆盖了。
const bindScroll = () => {
  setTabBackTopHandler(scrollToTop) // 页面重新进入时补登记（reset 会清掉旧引用）
  window.removeEventListener('scroll', handleScroll, true)
  window.addEventListener('scroll', handleScroll, true)
  handleScroll()
}

const unbindScroll = () => {
  window.removeEventListener('scroll', handleScroll, true)
  resetTabBackTop() // 离开本页：Tab 图标文案复原、动作失效
}

// 是否存在生效中的筛选条件（决定空状态展示哪种引导）
const hasActiveFilter = computed(() => {
  return !!(
    filters.value.keyword ||
    filters.value.categoryId ||
    filters.value.condition ||
    filters.value.minPrice ||
    filters.value.maxPrice
  )
})

// 清空全部筛选条件（含分类、排序、价格、搜索词）
const clearAllFilters = () => {
  filters.value.keyword = ''
  filters.value.categoryId = null
  filters.value.condition = ''
  filters.value.minPrice = ''
  filters.value.maxPrice = ''
  filters.value.sortBy = 'latest'
  localMin.value = ''
  localMax.value = ''
  reload(true)
}

watch(() => route.query.keyword, (val) => {
  filters.value.keyword = val || ''
  reload(true)
})

watch(() => route.query.categoryId, (val) => {
  filters.value.categoryId = val ? Number(val) : null
  reload(true)
})

watch(activeCategoryIndex, updateCategorySlider)
watch(activeSortIndex, updateSortSlider)
watch(categories, () => updateCategorySlider(activeCategoryIndex.value))

// 绑定 resize 监听（幂等：重复调用不会叠加同一个函数的多个监听）
// 跨断点后「浮标 / Tab 顶部态」由哪个承载会变，所以要顺手重算一次滚动状态
const handleResize = () => {
  syncIsMobile()
  handleScroll()
}

const bindResize = () => {
  window.removeEventListener('resize', handleResize)
  window.addEventListener('resize', handleResize)
}

onMounted(async () => {
  syncIsMobile()
  bindResize()
  bindScroll()

  const catRes = await getCategories()
  categories.value = catRes.data

  if (route.query.keyword) filters.value.keyword = route.query.keyword
  if (route.query.categoryId) filters.value.categoryId = Number(route.query.categoryId)

  loadData()
  updateCategorySlider(activeCategoryIndex.value)
  updateSortSlider(activeSortIndex.value)
})

// 本页被 <keep-alive> 缓存：从商品详情返回时走 activated 而不是 mounted。
// 这里刻意不重新请求数据（保持列表原样、不闪骨架），只把随 DOM 挂载/卸载
// 一起进出的资源接回来，并重新量一次 tab 滑块尺寸。
onActivated(() => {
  bindResize()
  bindScroll()
  syncIsMobile()
  updateCategorySlider(activeCategoryIndex.value)
  updateSortSlider(activeSortIndex.value)
})

onDeactivated(() => {
  window.removeEventListener('resize', handleResize)
  unbindScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  unbindScroll()
})
</script>

<style scoped>
/* 「加载失败」的两个操作并排：继续等待（主）+ 重试（次） */
.load-fail-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.product-list-page {
  padding: 40px 0 60px;
  background: var(--color-bg-secondary);
  min-height: calc(100vh - 64px);
}

/* 移动端专属入口：默认桌面隐藏，移动端 @media 内重新显示 */
.filter-trigger,
.filter-drawer {
  display: none;
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

/* ============ 一键返回顶部 ============
   固定视口右下角，PC / 移动端共用；移动端在 @media 里避开底部 TabBar。
   （已取消分页，列表一次到底，长列表滚久了点它就回到顶部） */
.back-top {
  position: fixed;
  right: 28px;
  bottom: 40px;
  z-index: 110;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  color: var(--color-text);
  font-size: 18px;
  cursor: pointer;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.12),
    0 0 0 0.5px rgba(0, 0, 0, 0.05);
  transition: transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.25s ease;
}

.back-top:hover {
  transform: translateY(-2px);
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.16),
    0 0 0 0.5px rgba(0, 0, 0, 0.05);
}

.back-top:active {
  transform: scale(0.94);
}

/* v-show 的显隐过渡：淡入 + 轻微上浮，与全站节奏一致 */
.back-top-enter-active,
.back-top-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.back-top-enter-from,
.back-top-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.9);
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

/* 被「换出」的卡片必须立即移除，不能滞留。
 *
 * 「全部」是唯一会换出卡片的分页场景：29 件商品、每页 24 件，
 * 按价格排序会把第 2 页的商品换进来，同时把原来的换出去。
 * Vue 的 transition-group 会等「离开过渡」播完才真正移除元素，
 * 而 .product-card 上的 `transition: all 0.35s`（本意是给 hover 用的）
 * 会被 Vue 当成离开过渡 —— 于是被换出的卡片在原位滞留 350ms。
 * 这段时间里网格中新旧两批卡片并存、顺序是错的，
 * 表现出来就是「图片卡一下、切到另一批、再卡一下才对」。
 *
 * 实测（点「价格↑」后 DOM 顺序就位时刻）：
 *   加这条之前 → 376ms（两张换出的卡片滞留 373ms）
 *   加这条之后 →  19ms
 *
 * 注意：这里只处理「离开」。重排（move）动画与入场阶梯动画都完全保留。 */
.product-pop-leave-active {
  transition: none !important;
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

  /* 移动端不用右下角浮标 —— 改成底部「市场」Tab 变「顶部」（京东式，见 Layout.vue） */
  .back-top {
    display: none;
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
    /* 与首页「最新发布」卡片保持 4:3 比例（原来是 1:1） */
    aspect-ratio: 4 / 3;
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

  /* 移动端：标题+搜索+筛选按钮顶栏 */
  .page-title { font-size: 24px; margin-bottom: 10px; }
  .page-header { flex-direction: column; align-items: stretch; gap: 0; margin-bottom: 0; }
  .header-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .page-search { flex: 1; min-width: 0; }
  .page-desc { display: none; }
  .filter-trigger {
    display: flex; align-items: center; gap: 4px; flex-shrink: 0;
    height: 36px; padding: 0 14px; border-radius: 18px;
    background: #ecf5ff; color: #0071e3;
    font-size: 13px; font-weight: 600; border: none; cursor: pointer;
  }
  .filter-trigger-text { font-size: 13px; }
  .filter-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 16px; height: 16px; padding: 0 4px; border-radius: 8px;
    background: #ff4d4f; color: #fff;
    font-size: 10px; font-weight: 700; line-height: 1; margin-left: 2px;
  }

  /* 移动端：原分类 + 排序 + 价格 收起（改到 drawer） */
  .category-tabs, .toolbar { display: none; }

  /* 移动端：drawer sheet 毛玻璃 */
  .filter-drawer :deep(.el-drawer__panel) {
    /* 兜底，万一 custom-class 没生效也能用 */
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: saturate(180%) blur(30px);
    -webkit-backdrop-filter: saturate(180%) blur(30px);
    border-top: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.7),
      0 -12px 40px rgba(0, 0, 0, 0.18);
  }
  .filter-drawer :deep(.el-drawer__body) { padding: 0; background: transparent; }
  .filter-drawer :deep(.el-overlay) {
    background-color: rgba(0, 0, 0, 0.32);
    backdrop-filter: blur(2px);
  }

  .filter-sheet {
    display: flex; flex-direction: column; height: 100%;
    background: transparent; border-radius: 16px 16px 0 0;
  }

  .sheet-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 20px 12px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  }
  .sheet-header h3 { margin: 0; font-size: 16px; font-weight: 700; }
  .sheet-close {
    font-size: 20px; color: #606266; cursor: pointer;
    width: 30px; height: 30px;
    display: inline-flex; align-items: center; justify-content: center;
    border-radius: 50%; transition: background 0.2s ease;
  }
  .sheet-close:active { background: rgba(0, 0, 0, 0.06); }

  .sheet-section {
    padding: 14px 20px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  }
  .sheet-section h4 {
    margin: 0 0 12px; font-size: 13px;
    font-weight: 600; color: #606266;
  }
  .sheet-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .sheet-chip {
    padding: 7px 14px; border-radius: 16px;
    background: rgba(255, 255, 255, 0.55);
    /* 不叠 backdrop-filter：嵌套模糊会导致卡顿，视觉交给弹窗那层 */
    color: #606266;
    font-size: 13px; cursor: pointer;
    transition: all 0.2s ease;
  }
  .sheet-chip:active { transform: scale(0.96); }
  .sheet-chip.active {
    background: var(--color-primary);
    color: #fff;
    border-color: transparent;
  }
  .sheet-sort { display: flex; flex-wrap: wrap; gap: 8px; }
  .sheet-sort-btn {
    padding: 6px 14px; border-radius: 16px;
    background: rgba(255, 255, 255, 0.55);
    color: #606266;
    font-size: 13px; cursor: pointer;
    transition: all 0.2s ease;
  }
  .sheet-sort-btn:active { transform: scale(0.96); }
  .sheet-sort-btn.active {
    background: var(--color-primary);
    color: #fff;
    border-color: transparent;
  }
  .sheet-price { display: flex; align-items: center; gap: 10px; }
  .sheet-price :deep(.el-input) { flex: 1; }
  .sheet-price :deep(.el-input__wrapper) {
    background: rgba(255, 255, 255, 0.55);
    border-radius: 14px;
  }
  .sheet-dash { color: #c0c4cc; font-size: 13px; }

  .sheet-footer {
    display: flex; gap: 12px;
    padding: 14px 20px calc(16px + env(safe-area-inset-bottom));
    margin-top: auto;
    border-top: 1px solid rgba(0, 0, 0, 0.05);
    /* 去掉自身白底，直接继承 dialog 毛玻璃，不再出现"实色块" */
    background: transparent;
  }
  .sheet-footer .el-button { flex: 1; border-radius: 980px; height: 44px; }
  .sheet-footer .el-button:first-child {
    background: rgba(255, 255, 255, 0.35) !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    color: var(--color-text) !important;
  }
  .sheet-footer .el-button:last-child {
    border: none !important;
    background: linear-gradient(135deg, #0071e3, #5ac8fa) !important;
    color: #fff !important;
    font-weight: 600 !important;
    box-shadow: 0 6px 18px rgba(0, 113, 227, 0.32) !important;
  }
}</style>

<style>
/* el-dialog 走 Teleport 到 body，scoped + :deep 经常抢不过 Element Plus 自身样式。
   Element Plus 2.14.x 的 dialog 类名是 .el-dialog，背景由 CSS 变量
   --el-dialog-bg-color 控制。覆盖变量 + 直接 background，双保险。
   项目里只有这个筛选弹窗用 el-dialog，影响面可控。 */
.el-dialog {
  --el-dialog-bg-color: rgba(255, 255, 255, 0.6) !important;
  --el-dialog-border-radius: 22px !important;
  background: rgba(255, 255, 255, 0.6) !important;
  /* 单层 backdrop-filter：半径适中（过大渲染开销大、低端机会卡）；不再嵌套子 blur */
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  border: 1px solid rgba(255, 255, 255, 0.6) !important;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.7),
    0 16px 48px rgba(0, 0, 0, 0.18) !important;
  overflow: hidden;
  margin: 8vh auto 50px !important;
  max-width: 480px;
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  transform: translateZ(0);
  will-change: backdrop-filter;
}
.el-dialog.filter-modal-glass {
  /* custom-class 钩子，留作冗余 */
}
.el-dialog__header {
  padding: 0 !important;
}
.el-dialog__body {
  padding: 0 !important;
  background: transparent !important;
  overflow: hidden !important;
  flex: 1;
}
.el-overlay {
  background-color: rgba(0, 0, 0, 0.4) !important;
}
</style>
