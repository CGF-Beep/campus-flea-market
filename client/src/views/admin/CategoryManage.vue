<template>
  <div class="admin-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">分类管理</h2>
      <p class="page-subtitle">维护商品分类体系</p>
    </div>

    <div class="admin-card">
      <div class="card-toolbar">
        <button class="btn-primary btn-sm" @click="openAdd">
          <el-icon style="margin-right: 4px"><Plus /></el-icon>
          添加分类
        </button>
      </div>

      <div class="table-wrap">
      <el-table :data="categories" v-loading="loading" class="apple-table" height="100%">
        <el-table-column prop="id" label="ID" width="64" />
        <el-table-column label="分类" min-width="180">
          <template #default="{ row }">
            <div class="cell-cat">
              <span class="cat-icon-box">
                <CategoryIcon :category-id="row.id" />
              </span>
              <span class="cat-name">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="status-pill" :class="row.status === 1 ? 'pill-success' : 'pill-gray'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <div class="action-group">
              <button class="btn-text" @click="openEdit(row)">编辑</button>
              <button class="btn-text btn-danger" @click="handleDelete(row)">删除</button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑分类' : '添加分类'" width="420px" align-center>
      <el-form :model="form" label-position="top">
        <el-form-item label="分类名称">
          <el-input v-model="form.name" placeholder="如：数码产品" class="input-rounded" />
        </el-form-item>
        <el-form-item label="图标代码">
          <el-input v-model="form.icon" placeholder="可选，语义化标识如：mobile-phone / book" class="input-rounded" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <button class="btn-ghost" @click="dialogVisible = false">取消</button>
        <button class="btn-primary btn-sm" @click="handleSave">保存</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import CategoryIcon from '@/components/CategoryIcon.vue'

const loading = ref(false)
const categories = ref([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const editingId = ref(null)
const form = reactive({ name: '', icon: '', sort: 0, status: 1 })

const categoryEmoji = {
  1: '📱', 2: '📚', 3: '🏠', 4: '👕', 5: '🏀', 6: '💄', 7: '🎸', 8: '✨'
}

const loadData = async () => {
  loading.value = true
  try {
    const res = await getCategories()
    categories.value = res.data
  } catch (e) {} finally { loading.value = false }
}

const openAdd = () => {
  isEdit.value = false
  Object.assign(form, { name: '', icon: '', sort: 0, status: 1 })
  dialogVisible.value = true
}

const openEdit = (row) => {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, row)
  dialogVisible.value = true
}

const handleSave = async () => {
  if (!form.name.trim()) {
    ElMessage.warning('请输入分类名称')
    return
  }
  try {
    if (isEdit.value) {
      await updateCategory(editingId.value, form)
    } else {
      await createCategory(form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } catch (e) {}
}

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm(`确定要删除分类「${row.name}」吗？`, '提示', { confirmButtonText: '确定', cancelButtonText: '取消' })
    await deleteCategory(row.id)
    ElMessage.success('已删除')
    loadData()
  } catch (e) {}
}

onMounted(() => loadData())
</script>

<style scoped>
.card-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.btn-sm {
  padding: 10px 24px;
  font-size: 14px;
}

.cell-cat {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cat-icon-box {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: rgba(79, 70, 229, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cat-icon-box :deep(.category-svg-icon) {
  width: 22px;
  height: 22px;
  color: var(--admin-primary);
}

.cat-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--admin-text);
}

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
</style>