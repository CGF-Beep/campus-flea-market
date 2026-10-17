<template>
  <div class="admin-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">订单管理</h2>
      <p class="page-subtitle">查看全站交易订单</p>
    </div>

    <div class="admin-card">
      <!-- 筛选：左边一体化搜索框，右边状态筛选 -->
      <div class="admin-filter-bar">
        <div class="admin-filter-search">
          <el-input
            v-model="keyword"
            placeholder="搜索订单号/商品/买家"
            clearable
            @keyup.enter="search"
            @clear="search"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <button class="admin-search-btn" @click="search">搜索</button>
        </div>
        <el-select
          v-model="status"
          placeholder="全部状态"
          clearable
          @change="search"
          class="admin-filter-select"
        >
          <el-option label="待卖家确认" value="pending" />
          <el-option label="已确认" value="confirmed" />
          <el-option label="已完成" value="completed" />
          <el-option label="已取消" value="cancelled" />
        </el-select>
      </div>

      <!-- 表格：弹性撑满卡片剩余高度，行多时内部滚动 -->
      <div class="table-wrap">
      <el-table :data="orders" v-loading="loading" class="apple-table" height="100%">
        <el-table-column prop="orderNo" label="订单号" width="180">
          <template #default="{ row }">
            <span class="order-no">{{ row.orderNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="商品" min-width="200">
          <template #default="{ row }">
            <div class="cell-product">
              <SmartImage
                class="cell-img"
                :src="(row.product?.images && row.product.images[0]) || ''"
                emoji="📦"
                :alt="row.product?.title"
              />
              <span class="cell-title">{{ row.product?.title || '商品已删除' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="买家" width="100">
          <template #default="{ row }">{{ row.buyer?.nickname || '—' }}</template>
        </el-table-column>
        <el-table-column label="卖家" width="100">
          <template #default="{ row }">{{ row.seller?.nickname || '—' }}</template>
        </el-table-column>
        <el-table-column label="价格" width="90">
          <template #default="{ row }"><span class="price">￥{{ row.price }}</span></template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-pill" :class="statusClass(row.status)">{{ statusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="下单时间" width="150">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <div class="action-group">
              <button
                v-if="row.status !== 'cancelled'"
                class="btn-text btn-danger"
                @click="handleCancel(row)"
              >取消交易</button>
              <span v-else class="text-muted">已取消</span>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 移动端卡片列表（≤768 显示，桌面隐藏） -->
      <div class="mobile-list">
        <div v-for="row in orders" :key="row.id" class="m-card">
          <div class="m-head">
            <SmartImage
              class="m-img"
              :src="(row.product?.images && row.product.images[0]) || ''"
              emoji="📦"
              :alt="row.product?.title"
            />
            <div class="m-info">
              <div class="m-title">{{ row.product?.title || '商品已删除' }}</div>
              <div class="m-orderno">{{ row.orderNo }}</div>
            </div>
            <div class="m-price">￥{{ row.price }}</div>
          </div>
          <div class="m-foot">
            <div class="m-grid">
              <div class="m-cell"><span class="m-label">买家</span><span class="m-value">{{ row.buyer?.nickname || '—' }}</span></div>
              <div class="m-cell"><span class="m-label">卖家</span><span class="m-value">{{ row.seller?.nickname || '—' }}</span></div>
              <div class="m-cell"><span class="m-label">状态</span><span class="status-pill" :class="statusClass(row.status)">{{ statusText(row.status) }}</span></div>
              <div class="m-cell"><span class="m-label">下单</span><span class="m-value">{{ formatDate(row.createdAt) }}</span></div>
            </div>
            <div class="m-actions">
              <button
                v-if="row.status !== 'cancelled'"
                class="btn-text btn-danger"
                @click="handleCancel(row)"
              >取消交易</button>
              <span v-else class="text-muted">已取消</span>
            </div>
          </div>
        </div>
        <el-empty
          v-if="!loading && orders.length === 0"
          :description="status ? '该状态下暂无订单' : '暂无订单'"
          :image-size="100"
        />
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="15"
          layout="prev, pager, next, total"
          @current-change="loadData"
          background
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAdminOrders, adminCancelOrder } from '@/api'
import { Search } from '@element-plus/icons-vue'
import SmartImage from '@/components/SmartImage.vue'

const route = useRoute()
const loading = ref(false)
const orders = ref([])
const page = ref(1)
const total = ref(0)
const status = ref('')
const keyword = ref('')

const loadData = async () => {
  loading.value = true
  try {
    const res = await getAdminOrders({
      page: page.value,
      pageSize: 15,
      status: status.value,
      keyword: keyword.value.trim()
    })
    orders.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

// 改条件（关键词/状态）后必须回到第 1 页，
// 否则停在第 3 页搜索会落到空结果上
const search = () => {
  page.value = 1
  loadData()
}

const statusText = (s) => ({ pending: '待卖家确认', confirmed: '已确认', completed: '已完成', cancelled: '已取消' })[s] || s
const statusClass = (s) => ({
  pending: 'pill-warning',
  confirmed: 'pill-blue',
  completed: 'pill-success',
  cancelled: 'pill-gray'
})[s] || 'pill-gray'
const formatDate = (d) => new Date(d).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

const handleCancel = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要取消订单「${row.orderNo}」吗？取消后商品将恢复上架。`,
      '取消交易',
      { type: 'warning', confirmButtonText: '确定', cancelButtonText: '取消' }
    )
    await adminCancelOrder(row.id)
    ElMessage.success('交易已取消，商品已恢复上架')
    loadData()
  } catch (e) {}
}

onMounted(() => {
  // 支持从看板等页面携带 status 参数跳转（如 /admin/orders?status=pending）
  if (route.query.status) status.value = route.query.status
  loadData()
})
</script>

<style scoped>
/* 筛选栏样式统一在 global.css 的 .admin-filter-bar 里 */

.order-no {
  font-size: 12px;
  color: var(--admin-text-tertiary);
  font-family: 'SF Mono', Consolas, monospace;
}

.cell-product {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cell-img {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  flex-shrink: 0;
}

.cell-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
}

.text-muted {
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 操作列：flex布局保证表头与内容对齐 */
.action-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.apple-table :deep(.el-table__body-wrapper .el-table__row td:last-child .cell),
.apple-table :deep(.el-table__header-wrapper th:last-child .cell) {
  display: flex;
  align-items: center;
}

/* ================================================================
   移动端响应式（≤768px）：表格 → 卡片列表
   ================================================================ */
.mobile-list {
  display: none;
}

@media (max-width: 768px) {
  .table-wrap {
    display: none;
  }

  .mobile-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .m-card {
    border-radius: 16px;
    border: 1px solid var(--admin-border);
    padding: 12px;
  }

  .m-head {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .m-img {
    width: 60px;
    height: 60px;
    border-radius: var(--radius-sm);
    overflow: hidden;
    flex-shrink: 0;
  }

  .m-info {
    flex: 1;
    min-width: 0;
  }

  .m-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--admin-text);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .m-orderno {
    font-size: 11px;
    color: var(--admin-text-tertiary);
    margin-top: 3px;
    font-family: 'SF Mono', Consolas, monospace;
  }

  .m-price {
    font-size: 16px;
    font-weight: 700;
    color: var(--admin-price, #e74c3c);
    flex-shrink: 0;
  }

  .m-foot {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--admin-border);
  }

  .m-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 14px;
    margin-bottom: 10px;
  }

  .m-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .m-label {
    font-size: 11px;
    color: var(--admin-text-tertiary);
  }

  .m-value {
    font-size: 13px;
    color: var(--admin-text);
    font-weight: 500;
    word-break: break-all;
  }

  .m-actions {
    display: flex;
    justify-content: flex-end;
  }

  .page-title {
    font-size: 22px;
  }

  .page-subtitle {
    font-size: 13px;
  }

  .pagination {
    justify-content: center;
    margin-top: 16px;
  }
}
</style>