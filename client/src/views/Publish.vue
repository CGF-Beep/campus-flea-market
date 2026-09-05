<template>
  <div class="publish page-content">
    <div class="container container-narrow">
      <!-- 页面标题 -->
      <div class="page-header">
        <h2 class="page-title">{{ isEdit ? '编辑闲置物品' : '发布闲置物品' }}</h2>
        <p class="page-subtitle">{{ isEdit ? '修改信息后需重新审核' : '' }}</p>
      </div>

      <div class="publish-card">
        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent>
          <!-- 标题 -->
          <div class="field-group">
            <label class="field-label">商品标题 <span class="required">*</span></label>
            <el-input
              v-model="form.title"
              placeholder="如：iPhone 13 手机壳"
              maxlength="100"
              show-word-limit
              class="input-rounded"
            />
          </div>

          <!-- 分类 -->
          <div class="field-group">
            <label class="field-label">商品分类 <span class="required">*</span></label>
            <div class="category-grid">
              <div
                v-for="c in categories"
                :key="c.id"
                class="category-chip"
                :class="{ active: form.categoryId === c.id }"
                @click="form.categoryId = c.id"
              >
                <CategoryIcon :category-id="c.id" class="chip-icon" />
                <span class="chip-name">{{ c.name }}</span>
              </div>
            </div>
          </div>

          <!-- 价格 -->
          <div class="field-group">
            <div class="price-row">
              <div class="price-item">
                <label class="field-label">售价（元） <span class="required">*</span></label>
                <el-input
                  v-model="priceText"
                  placeholder="0.00"
                  class="input-rounded"
                />
              </div>
              <div class="price-item">
                <label class="field-label">原价（元）</label>
                <el-input
                  v-model="originalPriceText"
                  placeholder="0.00"
                  class="input-rounded"
                />
              </div>
            </div>
          </div>

          <!-- 成色 -->
          <div class="field-group">
            <label class="field-label">成色</label>
            <div class="chip-row">
              <div
                v-for="cond in conditions"
                :key="cond"
                class="chip"
                :class="{ active: form.condition === cond }"
                @click="form.condition = cond"
              >{{ cond }}</div>
            </div>
          </div>

          <!-- 图片 -->
          <div class="field-group">
            <label class="field-label">商品图片</label>
            <el-upload
              v-model:file-list="fileList"
              list-type="picture-card"
              :show-file-list="true"
              :auto-upload="true"
              :http-request="handleUpload"
              :before-upload="beforeUpload"
              :on-remove="handleRemove"
              :limit="6"
              class="apple-upload"
            >
              <div class="upload-plus">
                <el-icon :size="22"><Plus /></el-icon>
                <span>添加图片</span>
              </div>
            </el-upload>
            <div class="upload-tip">最多上传 6 张，支持 jpg / png / gif / webp，单张不超过 5MB</div>
          </div>

          <!-- 描述 -->
          <div class="field-group">
            <label class="field-label">商品描述</label>
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="5"
              placeholder="描述商品的使用时间、磨损情况、入手渠道等～"
              maxlength="500"
              show-word-limit
              class="input-rounded"
            />
          </div>

          <!-- 交易地点 -->
          <div class="field-group">
            <label class="field-label">交易地点</label>
            <el-input
              v-model="form.location"
              placeholder=""
              class="input-rounded"
            >
              <template #prefix><el-icon><Location /></el-icon></template>
            </el-input>
          </div>

          <!-- 提交 -->
          <div class="submit-row">
            <button class="btn-primary submit-btn" :disabled="submitting || loading" @click.prevent="handleSubmit">
              <el-icon v-if="submitting" class="spin-icon"><Loading /></el-icon>
              <span v-else>{{ isEdit ? '保存修改' : '发 布' }}</span>
            </button>
            <button class="btn-ghost" @click.prevent="$router.back()">取消</button>
          </div>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getCategories, createProduct, updateProduct, getProductDetail, uploadFile } from '@/api'
import { ElMessage } from 'element-plus'
import { Plus, Location, Loading } from '@element-plus/icons-vue'
import CategoryIcon from '@/components/CategoryIcon.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const formRef = ref()
const submitting = ref(false)
const loading = ref(false)
const categories = ref([])
const imageList = ref([])
const fileList = ref([])

const isEdit = computed(() => !!route.params.id)

const conditions = ['全新', '九成新', '八成新', '七成新及以下']

const categoryEmoji = {
  1: '📱', 2: '📚', 3: '🏠', 4: '👕', 5: '🏀', 6: '💄', 7: '🎸', 8: '✨'
}

const form = reactive({
  title: '',
  categoryId: null,
  price: null,
  originalPrice: null,
  condition: '九成新',
  description: '',
  location: ''
})

// 价格用文本输入，提交时转换（支持空原价）
const priceText = ref('')
const originalPriceText = ref('')

const rules = {
  title: [{ required: true, message: '请输入商品标题', trigger: 'blur' }]
}

const beforeUpload = (file) => {
  const isImage = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isImage) { ElMessage.error('仅支持图片格式'); return false }
  if (!isLt5M) { ElMessage.error('图片大小不能超过5MB'); return false }
  return true
}

const handleUpload = async (options) => {
  const formData = new FormData()
  formData.append('file', options.file)
  try {
    const res = await uploadFile(formData)
    imageList.value.push(res.data.url)
    options.file.url = res.data.url
    ElMessage.success('上传成功')
  } catch (e) {
    ElMessage.error('上传失败')
  }
}

const handleRemove = (file) => {
  const idx = imageList.value.findIndex(url => file.url?.includes(url))
  if (idx > -1) imageList.value.splice(idx, 1)
}

const handleSubmit = async () => {
  if (!form.title.trim()) {
    ElMessage.warning('请填写商品标题')
    return
  }
  if (!form.categoryId) {
    ElMessage.warning('请选择商品分类')
    return
  }
  const price = parseFloat(priceText.value)
  if (!priceText.value || isNaN(price) || price < 0) {
    ElMessage.warning('请填写正确的售价')
    return
  }
  const originalPrice = originalPriceText.value ? parseFloat(originalPriceText.value) : null
  if (originalPrice !== null && (isNaN(originalPrice) || originalPrice < 0)) {
    ElMessage.warning('原价格式不正确')
    return
  }

  submitting.value = true
  try {
    const payload = {
      title: form.title,
      categoryId: form.categoryId,
      price,
      originalPrice,
      condition: form.condition,
      description: form.description,
      location: form.location,
      images: imageList.value
    }
    if (isEdit.value) {
      await updateProduct(route.params.id, payload)
      ElMessage.success('修改已保存，等待管理员重新审核')
    } else {
      await createProduct(payload)
      ElMessage.success('发布成功，等待管理员审核')
    }
    router.push('/my-products')
  } catch (e) {
    // handled
  } finally {
    submitting.value = false
  }
}

// 编辑模式：加载商品数据回填
const loadProduct = async () => {
  loading.value = true
  try {
    const res = await getProductDetail(route.params.id)
    const p = res.data
    if (p.userId !== userStore.user.id) {
      ElMessage.error('只能编辑自己发布的商品')
      router.replace('/my-products')
      return
    }
    form.title = p.title
    form.categoryId = p.categoryId
    form.condition = p.condition || '九成新'
    form.description = p.description || ''
    form.location = p.location || ''
    priceText.value = p.price != null ? String(p.price) : ''
    originalPriceText.value = p.originalPrice != null ? String(p.originalPrice) : ''
    imageList.value = p.images ? [...p.images] : []
    fileList.value = imageList.value.map((url, i) => ({ name: 'image-' + (i + 1), url }))
  } catch (e) {
    ElMessage.error('商品加载失败')
    router.replace('/my-products')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const res = await getCategories()
  categories.value = res.data
  if (isEdit.value) await loadProduct()
})
</script>

<style scoped>
.container-narrow {
  max-width: 760px;
}
.page-header {
  margin-bottom: 24px;
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

.publish-card {
  background: var(--color-card);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  padding: 36px 40px;
}
@media (max-width: 640px) {
  .publish-card { padding: 24px 20px; }
}

.field-group {
  margin-bottom: 28px;
}
.field-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 10px;
}
.required {
  color: var(--color-danger);
}
.input-rounded :deep(.el-input__wrapper),
.input-rounded :deep(.el-textarea__inner) {
  border-radius: var(--radius-md);
}

/* 分类选择 */
.category-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
@media (max-width: 640px) {
  .category-grid { grid-template-columns: repeat(2, 1fr); }
}
.category-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1.5px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.25s ease;
  background: #fff;
}
.category-chip:hover {
  border-color: var(--color-primary);
}
.category-chip.active {
  border-color: var(--color-primary);
  background: rgba(0, 113, 227, 0.06);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
}
.chip-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: #555;
}
.category-chip.active .chip-icon {
  color: var(--color-primary);
}
.chip-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

/* 价格 */
.price-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 640px) {
  .price-row { grid-template-columns: 1fr; }
}

/* 成色胶囊 */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.chip {
  padding: 10px 22px;
  border-radius: 980px;
  border: 1.5px solid var(--color-border);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.25s ease;
  background: #fff;
}
.chip:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}
.chip.active {
  background: var(--color-text);
  border-color: var(--color-text);
  color: #fff;
}

/* 上传 */
.apple-upload :deep(.el-upload--picture-card) {
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: #fafafa;
  transition: all 0.25s ease;
}
.apple-upload :deep(.el-upload--picture-card:hover) {
  border-color: var(--color-primary);
  background: rgba(0, 113, 227, 0.03);
}
.apple-upload :deep(.el-upload-list__item) {
  border-radius: var(--radius-md);
  overflow: hidden;
}
.upload-plus {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.upload-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

/* 提交 */
.submit-row {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
.submit-btn {
  padding: 14px 48px;
  font-size: 16px;
  letter-spacing: 0.1em;
}
.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.spin-icon {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.btn-ghost {
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text);
  padding: 14px 32px;
  border-radius: 980px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}
.btn-ghost:hover {
  background: rgba(0, 0, 0, 0.09);
}
</style>
