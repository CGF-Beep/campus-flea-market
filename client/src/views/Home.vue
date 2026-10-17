<!-- 首页：Hero搜索区、分类导航、最新发布商品网格 -->
<template>
  <div class="home">
    <!-- Hero Section -->
    <section class="hero">
      <div class="container">
        <h1 class="hero-title">发现好物</h1>
        <p class="hero-subtitle">乐购，让每一件物品找到新主人</p>
        <div class="hero-search">
          <div class="search-box" :class="{ focused: searchFocused }">
            <el-icon class="search-icon"><Search /></el-icon>
            <input
              v-model="heroKeyword"
              class="search-input"
              placeholder="搜索教材、数码、服饰、美妆…"
              @keyup.enter="searchFromHero"
              @focus="searchFocused = true"
              @blur="searchFocused = false"
            />
            <button class="search-btn" @click="searchFromHero">搜索</button>
          </div>
        </div>
      </div>
    </section>

    <!-- 分类导航（加载失败时整块收起，避免留下一片空白） -->
    <section v-if="!loadFailed" class="categories-section">
      <div class="container">
        <div class="categories-grid">
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="category-item"
            @click="$router.push({ path: '/products', query: { categoryId: cat.id } })"
          >
            <div class="category-icon">
              <CategoryIcon :category-id="cat.id" />
            </div>
            <span class="category-name">{{ cat.name }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 最新发布 -->
    <section class="products-section">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">最新发布</h2>
          <a class="section-more" @click="$router.push('/products')">
            查看更多 <el-icon><ArrowRight /></el-icon>
          </a>
        </div>
        <!-- 首次加载骨架屏 -->
        <div v-if="loading" class="skeleton-grid">
          <div v-for="n in 8" :key="'sk' + n" class="skeleton-card">
            <div class="skeleton-img"></div>
            <div class="skeleton-line lg"></div>
            <div class="skeleton-line sm"></div>
          </div>
        </div>
        <!-- 加载失败：给明确提示和重试入口，而不是让页面空着一块 -->
        <el-empty
          v-else-if="loadFailed"
          description="加载失败，请重试"
          :image-size="120"
        >
          <div class="load-fail-actions">
            <button class="btn-primary" @click="continueWaiting">继续等待</button>
            <button class="btn-secondary" @click="loadHome">重试</button>
          </div>
        </el-empty>

        <div v-else class="products-grid">
          <div
            v-for="p in latestProducts"
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
                <div class="product-seller">
                  <el-avatar :size="22" :src="p.user?.avatar" />
                  <span>{{ p.user?.nickname }}</span>
                </div>
                <span class="product-views">{{ p.views }} 浏览</span>
              </div>
            </div>
          </div>
        </div>
        <!-- 「还没有人发布商品」只在真的加载成功且确实没数据时才显示。
            原来没加 !loading 判断，首次进入时骨架屏会跟这条空态一起冒出来。 -->
        <el-empty
          v-if="!loading && !loadFailed && latestProducts.length === 0"
          description="还没有人发布商品"
          :image-size="120"
        >
          <button class="btn-primary" @click="$router.push('/publish')">发布第一件闲置</button>
        </el-empty>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getCategories, getProducts } from '@/api'
import { setLongWait } from '@/utils/request'
import { Search, ArrowRight } from '@element-plus/icons-vue'
import SmartImage from '@/components/SmartImage.vue'
import CategoryIcon from '@/components/CategoryIcon.vue'

// 供 Layout.vue 的 <keep-alive :include> 匹配，改这里要同步改 Layout 的 cachedViews
defineOptions({ name: 'Home' })

const router = useRouter()
const categories = ref([])
const latestProducts = ref([])
const loading = ref(true)
// 加载失败标记：区分「请求失败」和「确实没有数据」，
// 失败时不再让页面空着（之前只 console.error，用户看不到任何反馈）。
const loadFailed = ref(false)
const heroKeyword = ref('')
const searchFocused = ref(false)

const searchFromHero = () => {
  router.push({ path: '/products', query: { keyword: heroKeyword.value } })
}

const categoryEmojis = {
  1: '📱', 2: '📚', 3: '🏠', 4: '👕', 5: '🏀', 6: '💄', 7: '🎸', 8: '✨'
}

const getCategoryEmoji = (categoryId) => {
  return categoryEmojis[categoryId] || '📦'
}

// 抽成独立函数，失败态的「重试」按钮直接复用
const loadHome = async () => {
  loading.value = true
  loadFailed.value = false
  try {
    const [catRes, prodRes] = await Promise.all([
      getCategories(),
      getProducts({ page: 1, pageSize: 8, sortBy: 'latest' })
    ])
    categories.value = catRes.data
    latestProducts.value = prodRes.data.list
  } catch (e) {
    console.error('加载首页失败', e)
    // 两个请求是 Promise.all，任一失败就整体算失败：
    // 清掉可能已写入的半截数据，避免出现「分类正常、商品空白」这种看起来没坏的中间态。
    categories.value = []
    latestProducts.value = []
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(loadHome)

// 「继续等待」：用户明确表示愿意多等，把这批请求的超时放宽到 60 秒再跑一次。
// 跑完必须复位，否则后续其它页面的请求也会跟着放宽。
const continueWaiting = async () => {
  setLongWait(true)
  try {
    await loadHome()
  } finally {
    setLongWait(false)
  }
}
</script>

<style scoped>
/* 「加载失败」的两个操作并排：继续等待（主）+ 重试（次） */
.load-fail-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.home {
  background: var(--color-bg-secondary);
}

/* ===== Hero ===== */
.hero {
  background: linear-gradient(180deg, #fff 0%, var(--color-bg-secondary) 100%);
  padding: 100px 0 80px;
  text-align: center;
}

.hero-title {
  font-size: 56px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--color-text);
  margin-bottom: 16px;
}

.hero-subtitle {
  font-size: 21px;
  color: var(--color-text-secondary);
  font-weight: 400;
  margin-bottom: 56px;
}

.hero-search {
  max-width: 520px;
  margin: 0 auto 25px;
}

/* 一体式胶囊搜索框 */
.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 6px 6px 20px;
  background: #fff;
  border: 1.5px solid #e5e5ea;
  border-radius: 980px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}

.search-box:hover {
  border-color: #c7c7cc;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.1);
}

.search-box.focused {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.12), 0 4px 24px rgba(0, 0, 0, 0.08);
}

.search-icon {
  font-size: 18px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  min-width: 0;
  height: 40px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 16px;
  color: var(--color-text);
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

.search-btn {
  height: 40px;
  padding: 0 28px;
  border: none;
  border-radius: 980px;
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.search-btn:hover {
  background: var(--color-primary-hover);
  transform: scale(1.03);
}

.search-btn:active {
  transform: scale(0.96);
}

/* ===== Categories ===== */
.categories-section {
  padding: 24px 0 8px;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 12px;
}

.category-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 2px;
  border-radius: 14px;
  background: var(--color-card);
  cursor: pointer;
  transition: all 0.3s ease;
}

.category-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
}

.category-icon {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: #fff;
  color: #333;
  transition: color 0.3s ease;
}
.category-item:hover .category-icon {
  color: var(--color-primary);
}

.category-name {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

/* ===== Products ===== */
.products-section {
  padding: 20px 0 60px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.section-title {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

.section-more {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  color: var(--color-primary);
  cursor: pointer;
  font-weight: 500;
  transition: gap 0.3s ease;
}

.section-more:hover {
  gap: 8px;
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.product-card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.product-card:hover {
  transform: translateY(-6px);
  box-shadow: var(--shadow-lg);
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
  .hero {
    /* 下内边距 36 → 24：原本它与分类区上内边距叠加后让胶囊上方留了 50px，
       而下方只有 18px，上下严重不均 */
    padding: 44px 0 24px;
  }

  .hero-title {
    font-size: 34px;
    letter-spacing: -0.02em;
    margin-bottom: 10px;
  }

  .hero-subtitle {
    font-size: 14px;
    margin-bottom: 30px;
  }

  .hero-search {
    max-width: 100%;
    margin-bottom: 0;
  }

  .search-box {
    padding: 4px 4px 4px 16px;
  }

  .search-input {
    height: 38px;
    font-size: 15px;
  }

  .search-btn {
    height: 38px;
    padding: 0 20px;
    font-size: 14px;
  }

  .categories-section {
    /* 与 .hero 下内边距、.categories-grid 内边距叠加后：
       胶囊上方 ≈ 30px、下方 ≈ 30px，上下均衡 */
    padding: 4px 0 8px;
  }

  /* 移动端：4 列图标网格 → 单行纯文字胶囊，横向滑动。
     桌面端（8 列网格 + 图标）保持不变，仅在此断点内覆盖 */
  .categories-grid {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    /* 上下留一点余量，避免胶囊的圆角被裁掉 */
    padding: 2px 0 4px;
    /* 滑动结束时吸附到标签边界，不会停在两个标签中间 */
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    /* 隐藏滚动条：Firefox */
    scrollbar-width: none;
  }

  /* 隐藏滚动条：WebKit（Chrome / Safari / 微信内置浏览器） */
  .categories-grid::-webkit-scrollbar {
    display: none;
  }

  .category-item {
    /* 不再等分列宽：按内容宽度排列，且不被压缩 */
    flex: 0 0 auto;
    flex-direction: row;
    gap: 0;
    padding: 8px 16px;
    border-radius: 980px;
    scroll-snap-align: start;
    transition: background 0.25s ease;
  }

  /* 移动端没有 hover，用 :active 给出按压反馈 */
  .category-item:active {
    background: var(--color-bg-secondary);
  }

  /* 移动端隐藏图标，只保留文字 */
  .category-icon {
    display: none;
  }

  .category-name {
    font-size: 14px;
    color: var(--color-text);
    font-weight: 500;
    white-space: nowrap;
  }

  .products-section {
    /* 上内边距 8 → 18：与分类区下内边距叠加后补足到 30px，
       让「最新发布」与上方胶囊的间距和胶囊与搜索框的间距一致 */
    padding: 18px 0 8px;
  }

  .section-header {
    margin-bottom: 16px;
  }

  .section-title {
    font-size: 20px;
  }

  .section-more {
    font-size: 13px;
  }

  /* 商品 4 列 → 2 列 */
  .products-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .product-card {
    border-radius: var(--radius-md);
  }

  /* 触屏上去掉悬停抬起效果，避免点击闪动 */
  .product-card:hover,
  .category-item:hover {
    transform: none;
    box-shadow: none;
  }

  .product-image {
    height: auto;
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
}

/* 超窄屏（≤400px）进一步收紧 */
@media (max-width: 400px) {
  .category-icon {
    width: 34px;
    height: 34px;
  }

  .product-price {
    font-size: 16px;
  }
}
</style>
