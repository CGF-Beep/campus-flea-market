<template>
  <div class="admin-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">用户管理</h2>
      <p class="page-subtitle">管理平台注册用户</p>
    </div>

    <div class="admin-card">
      <!-- 筛选 -->
      <div class="filter-bar">
        <div class="filter-item">
          <el-input
            v-model="keyword"
            placeholder="搜索用户名/昵称/学号"
            clearable
            class="input-rounded"
            @keyup.enter="loadData"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </div>
        <button class="btn-primary btn-sm" @click="loadData">搜索</button>
      </div>

      <!-- 表格：弹性撑满卡片剩余高度，行多时内部滚动 -->
      <div class="table-wrap">
      <el-table :data="users" v-loading="loading" class="apple-table" height="100%">
        <el-table-column prop="id" label="ID" width="64" />
        <el-table-column label="用户" min-width="180">
          <template #default="{ row }">
            <div class="cell-user">
              <div class="cell-avatar" :class="{ 'no-img': !row.avatar }">
                <img v-if="row.avatar" :src="row.avatar" alt="avatar" />
                <span v-else>{{ (row.nickname || row.username || '用')[0] }}</span>
              </div>
              <div class="cell-info">
                <div class="cell-name">{{ row.nickname || row.username }}</div>
                <div class="cell-sub">@{{ row.username }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="studentId" label="学号" width="130">
          <template #default="{ row }">{{ row.studentId || '—' }}</template>
        </el-table-column>
        <el-table-column prop="college" label="学院" min-width="140">
          <template #default="{ row }">{{ row.college || '—' }}</template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" width="130">
          <template #default="{ row }">{{ row.phone || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="90">
          <template #default="{ row }">
            <span class="status-pill" :class="row.role === 'admin' ? 'pill-warning' : 'pill-blue'">
              {{ row.role === 'admin' ? '管理员' : '用户' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="status-pill" :class="row.status === 1 ? 'pill-success' : 'pill-danger'">
              {{ row.status === 1 ? '正常' : '禁用' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="right">
          <template #default="{ row }">
            <button
              class="btn-text"
              :class="row.status === 1 ? 'btn-danger' : 'btn-success'"
              @click="toggleStatus(row)"
            >{{ row.status === 1 ? '禁用' : '启用' }}</button>
          </template>
        </el-table-column>
      </el-table>
      </div>

      <!-- 移动端卡片列表（≤768 显示，桌面隐藏） -->
      <div class="mobile-list">
        <div v-for="row in users" :key="row.id" class="m-card">
          <div class="m-head">
            <div class="m-avatar" :class="{ 'no-img': !row.avatar }">
              <img v-if="row.avatar" :src="row.avatar" alt="avatar" />
              <span v-else>{{ (row.nickname || row.username || '用')[0] }}</span>
            </div>
            <div class="m-info">
              <div class="m-name">{{ row.nickname || row.username }}</div>
              <div class="m-sub">@{{ row.username }}</div>
            </div>
            <button
              class="btn-text"
              :class="row.status === 1 ? 'btn-danger' : 'btn-success'"
              @click="toggleStatus(row)"
            >{{ row.status === 1 ? '禁用' : '启用' }}</button>
          </div>
          <div class="m-grid">
            <div class="m-cell"><span class="m-label">学号</span><span class="m-value">{{ row.studentId || '—' }}</span></div>
            <div class="m-cell"><span class="m-label">学院</span><span class="m-value">{{ row.college || '—' }}</span></div>
            <div class="m-cell"><span class="m-label">手机</span><span class="m-value">{{ row.phone || '—' }}</span></div>
            <div class="m-cell"><span class="m-label">角色</span><span class="status-pill" :class="row.role === 'admin' ? 'pill-warning' : 'pill-blue'">{{ row.role === 'admin' ? '管理员' : '用户' }}</span></div>
            <div class="m-cell"><span class="m-label">状态</span><span class="status-pill" :class="row.status === 1 ? 'pill-success' : 'pill-danger'">{{ row.status === 1 ? '正常' : '禁用' }}</span></div>
          </div>
        </div>
        <el-empty v-if="!loading && users.length === 0" description="暂无用户" :image-size="100" />
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="page"
          :total="total"
          :page-size="7"
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
import { getAdminUsers, updateUserStatus } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const loading = ref(false)
const users = ref([])
const page = ref(1)
const total = ref(0)
const keyword = ref('')

const loadData = async () => {
  loading.value = true
  try {
    const res = await getAdminUsers({ page: page.value, pageSize: 7, keyword: keyword.value })
    users.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally { loading.value = false }
}

const toggleStatus = async (row) => {
  const newStatus = row.status === 1 ? 0 : 1
  const msg = newStatus === 0 ? '禁用' : '启用'
  try {
    await ElMessageBox.confirm(`确定要${msg}用户「${row.nickname || row.username}」吗？`, '提示', { confirmButtonText: '确定', cancelButtonText: '取消' })
    await updateUserStatus(row.id, newStatus)
    ElMessage.success(`已${msg}`)
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
}

.filter-item {
  width: 260px;
}

.btn-sm {
  padding: 10px 24px;
  font-size: 14px;
}

/* 用户单元格 */
.cell-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cell-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #4f46e5, #6366f1);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cell-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
}

.cell-sub {
  font-size: 12px;
  color: var(--admin-text-tertiary);
  margin-top: 1px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

/* 操作列右对齐 */
.apple-table :deep(.el-table__body-wrapper .el-table__row td:last-child),
.apple-table :deep(.el-table__header-wrapper th:last-child) {
  padding-right: 0;
}

/* 数据行上下内边距各减 1px（默认 8px → 7px），行间间隔紧凑 2px */
.apple-table :deep(.el-table__body-wrapper td.el-table__cell) {
  padding-top: 7px;
  padding-bottom: 7px;
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

  .filter-item {
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
    padding: 14px;
  }

  .m-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--admin-border);
  }

  .m-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    overflow: hidden;
    background: linear-gradient(135deg, #4f46e5, #6366f1);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .m-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .m-info {
    flex: 1;
    min-width: 0;
  }

  .m-name {
    font-size: 15px;
    font-weight: 700;
    color: var(--admin-text);
  }

  .m-sub {
    font-size: 12px;
    color: var(--admin-text-tertiary);
    margin-top: 1px;
  }

  .m-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px 14px;
  }

  .m-cell {
    display: flex;
    flex-direction: column;
    gap: 3px;
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