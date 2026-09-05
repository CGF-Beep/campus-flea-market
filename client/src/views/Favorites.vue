<template>
  <div class="favorites-page">
    <div class="container">
      <div class="page-header">
        <h1 class="page-title">我的收藏</h1>
      </div>

      <div class="products-grid" v-loading="loading">
        <div
          v-for="f in favorites"
          :key="f.id"
          class="product-card"
          @click="$router.push(`/products/${f.product.id}`)"
        >
          <div class="product-image">
            <SmartImage :src="(f.product.images && f.product.images[0]) || ''" :emoji="'📦'" />
            <span class="product-condition">{{ f.product.condition }}</span>
          </div>
          <div class="product-info">
            <h3 class="product-title">{{ f.product.title }}</h3>
            <div class="product-price-row">
              <span class="product-price">￥{{ f.product.price }}</span>
            </div>
          </div>
          <div class="card-footer">
            <el-button size="small" round @click.stop="handleRemove(f)">取消收藏</el-button>
          </div>
        </div>
      </div>

      <el-empty v-if="!loading && favorites.length === 0" description="暂无收藏" :image-size="120" />

      <div class="pagination" v-if="total > 12">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="12"
          layout="prev, pager, next"
          @current-change="loadData"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getMyFavorites, removeFavorite } from '@/api'
import { ElMessage } from 'element-plus'
import SmartImage from '@/components/SmartImage.vue'

const loading = ref(false)
const favorites = ref([])
const page = ref(1)
const total = ref(0)

const loadData = async () => {
  loading.value = true
  try {
    const res = await getMyFavorites({ page: page.value, pageSize: 12 })
    favorites.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

const handleRemove = async (item) => {
  try {
    await removeFavorite(item.productId)
    ElMessage.success('已取消收藏')
    loadData()
  } catch (e) {}
}

onMounted(() => loadData())
</script>

<style scoped>
.favorites-page {
  padding: 40px 0 60px;
  background: var(--color-bg-secondary);
  min-height: calc(100vh - 64px);
}

.page-header {
  margin-bottom: 28px;
}

.page-title {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-text);
}

.products-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  min-height: 200px;
}

.product-card {
  background: var(--color-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.product-image {
  position: relative;
  height: 180px;
  background: var(--color-bg-secondary);
  overflow: hidden;
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
  margin-bottom: 8px;
}

.product-price-row {
  margin-bottom: 12px;
}

.product-price {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-price);
}

.card-footer {
  padding: 0 16px 16px;
  text-align: right;
}

.pagination {
  display: flex;
  justify-content: center;
  padding-top: 32px;
}

/* ================================================================
   移动端响应式（≤768px）
   ================================================================ */
@media (max-width: 768px) {
  .favorites-page {
    padding: 20px 0 24px;
    min-height: calc(100vh - 56px);
  }

  .page-header {
    margin-bottom: 18px;
  }

  .page-title {
    font-size: 24px;
  }

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

  .product-image {
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .product-condition {
    top: 8px;
    right: 8px;
    padding: 3px 9px;
    font-size: 10px;
  }

  .product-info {
    padding: 10px 12px;
  }

  .product-title {
    font-size: 14px;
    margin-bottom: 6px;
  }

  .product-price-row {
    margin-bottom: 8px;
  }

  .product-price {
    font-size: 16px;
  }

  .card-footer {
    padding: 0 12px 12px;
  }

  .card-footer :deep(.el-button) {
    height: 28px;
    padding: 0 14px;
    font-size: 12px;
  }

  .pagination {
    padding-top: 20px;
  }
}
</style>
