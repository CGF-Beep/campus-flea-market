<template>
  <div class="admin-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">商品管理</h2>
      <p class="page-subtitle">审核与维护全站商品</p>
    </div>

    <div class="admin-card">
      <!-- 筛选栏 -->
      <div class="filter-bar">
        <div class="filter-item">
          <el-input
            v-model="keyword"
            placeholder="搜索商品标题"
            clearable
            class="input-rounded"
            @keyup.enter="loadData"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <el-select v-model="status" placeholder="全部状态" clearable @change="loadData" class="input-rounded select-rounded">
          <el-option label="待审核" value="pending" />
          <el-option label="在售" value="on_sale" />
          <el-option label="已售" value="sold" />
          <el-option label="已拒绝" value="rejected" />
          <el-option label="已下架" value="removed" />
        </el-select>
        <button class="btn-primary btn-sm" @click="loadData">搜索</button>
      </div>

      <!-- 表格：弹性撑满卡片剩余高度，行多时内部滚动 -->
      <div class="table-wrap">
      <el-table :data="products" v-loading="loading" class="apple-table" height="100%">
        <el-table-column prop="id" label="ID" width="64" />
        <el-table-column label="商品" min-width="220">
          <template #default="{ row }">
            <div class="cell-product">
              <SmartImage
                class="cell-img"
                :src="(row.images && row.images[0]) || ''"
                emoji="📦"
                :alt="row.title"
              />
              <div class="cell-info">
                <div class="cell-title">{{ row.title }}</div>
                <div class="cell-cat">{{ row.category?.name }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="价格" width="90">
          <template #default="{ row }"><span class="price">￥{{ row.price }}</span></template>
        </el-table-column>
        <el-table-column label="发布者" width="110">
          <template #default="{ row }">{{ row.user?.nickname || '—' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <span class="status-pill" :class="statusClass(row.status)">{{ statusText(row.status) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <div class="action-group">
              <button class="btn-text btn-success" v-if="row.status === 'pending'" @click="handleApprove(row)">通过</button>
              <button class="btn-text btn-danger" v-if="row.status === 'pending'" @click="handleReject(row)">拒绝</button>
              <button class="btn-text btn-danger" v-if="row.status === 'on_sale'" @click="handleRemove(row)">下架</button>
              <button class="btn-text btn-danger" @click="handleDelete(row)">删除</button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 移动端卡片列表（≤768 显示，桌面隐藏） -->
      <div class="mobile-list">
        <div v-for="row in products" :key="row.id" class="m-card">
          <div class="m-head">
            <SmartImage
              class="m-img"
              :src="(row.images && row.images[0]) || ''"
              emoji="📦"
              :alt="row.title"
            />
            <div class="m-info">
              <div class="m-title">{{ row.title }}</div>
              <div class="m-sub">{{ row.category?.name || '—' }}</div>
              <div class="m-price">￥{{ row.price }}</div>
            </div>
          </div>
          <div class="m-foot">
            <div class="m-meta">
              <span class="m-label">发布者</span>
              <span class="m-value">{{ row.user?.nickname || '—' }}</span>
              <span class="status-pill" :class="statusClass(row.status)">{{ statusText(row.status) }}</span>
            </div>
            <div class="m-actions">
              <button class="btn-text btn-success" v-if="row.status === 'pending'" @click="handleApprove(row)">通过</button>
              <button class="btn-text btn-danger" v-if="row.status === 'pending'" @click="handleReject(row)">拒绝</button>
              <button class="btn-text btn-danger" v-if="row.status === 'on_sale'" @click="handleRemove(row)">下架</button>
              <button class="btn-text btn-danger" @click="handleDelete(row)">删除</button>
            </div>
          </div>
        </div>
        <el-empty v-if="!loading && products.length === 0" description="暂无商品" :image-size="100" />
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="6"
          layout="prev, pager, next, total"
          @current-change="loadData"
          background
        />
      </div>
    </div>

    <!-- 拒绝原因对话框 -->
    <el-dialog v-model="rejectDialog" title="拒绝商品" width="420px" align-center>
      <el-input
        v-model="rejectReason"
        type="textarea"
        :rows="3"
        placeholder="请输入拒绝原因（将展示给发布者）"
      />
      <template #footer>
        <button class="btn-ghost" @click="rejectDialog = false">取消</button>
        <button class="btn-primary btn-sm" @click="confirmReject">确认拒绝</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getAdminProducts, approveProduct, rejectProduct, removeProduct, deleteProduct } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import SmartImage from '@/components/SmartImage.vue'

const route = useRoute()
const loading = ref(false)
const products = ref([])
const page = ref(1)
const total = ref(0)
const keyword = ref('')
const status = ref(route.query.status || '')
const rejectDialog = ref(false)
const rejectReason = ref('')
const rejectingProduct = ref(null)

const loadData = async () => {
  loading.value = true
  try {
    const res = await getAdminProducts({ page: page.value, pageSize: 6, keyword: keyword.value, status: status.value })
    products.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

const statusText = (s) => ({ pending: '待审核', on_sale: '在售', sold: '已售', rejected: '已拒绝', removed: '已下架' })[s] || s
const statusClass = (s) => ({
  pending: 'pill-warning',
  on_sale: 'pill-success',
  sold: 'pill-blue',
  rejected: 'pill-danger',
  removed: 'pill-gray'
})[s] || 'pill-gray'

const handleApprove = async (row) => {
  try {
    await approveProduct(row.id)
    ElMessage.success('已通过审核')
    loadData()
  } catch (e) {}
}

const handleReject = (row) => {
  rejectingProduct.value = row
  rejectReason.value = ''
  rejectDialog.value = true
}

const confirmReject = async () => {
  try {
    await rejectProduct(rejectingProduct.value.id, rejectReason.value)
    ElMessage.success('已拒绝')
    rejectDialog.value = false
    loadData()
  } catch (e) {}
}

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

onMounted(() => loadData())
</script>

<style scoped>
.filter-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-item {
  width: 220px;
}

.select-rounded {
  width: 140px;
}

.btn-sm {
  padding: 10px 24px;
  font-size: 14px;
}

/* 商品单元格 */
.cell-product {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cell-img {
  width: 52px;
  height: 52px;
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

.cell-cat {
  font-size: 12px;
  color: var(--admin-text-tertiary);
  margin-top: 2px;
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
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .filter-item,
  .select-rounded {
    width: 100%;
  }

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
    width: 64px;
    height: 64px;
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
    /* 允许两行省略 */
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .m-sub {
    font-size: 12px;
    color: var(--admin-text-tertiary);
    margin-top: 3px;
  }

  .m-price {
    font-size: 16px;
    font-weight: 700;
    color: var(--admin-price, #e74c3c);
    margin-top: 4px;
  }

  .m-foot {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid var(--admin-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .m-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--admin-text-secondary);
    flex: 1;
    min-width: 0;
  }

  .m-actions {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
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