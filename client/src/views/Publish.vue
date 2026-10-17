<template>
  <div class="publish page-content">
    <div class="publish-shell">
      <!-- ============================================================
           左：表单卡片（桌面端白色圆角卡片 / 移动端直接铺在白底页面上）
           ============================================================ -->
      <section class="publish-card">
        <header class="page-head">
          <h1 class="page-title">{{ isEdit ? '编辑闲置物品' : '发布闲置物品' }}</h1>
          <p class="page-sub">
            {{ isEdit ? '修改后需重新提交审核' : '把不再需要的物品，交给需要的人' }}
          </p>
        </header>

        <form class="publish-form" @submit.prevent="handleSubmit">
          <!-- 商品标题：整行 -->
          <div class="field field-full">
            <label class="field-label">商品标题 <span class="req">*</span></label>
            <el-input
              v-model="form.title"
              placeholder="如：iPhone 13 手机壳"
              maxlength="100"
              class="ios-input"
            />
          </div>

          <!-- 分类 + 交易地点：两个短字段并排，窄屏自动堆叠 -->
          <div class="field">
            <label class="field-label">商品分类 <span class="req">*</span></label>
            <el-select
              v-model="form.categoryId"
              placeholder="请选择商品分类"
              class="ios-input ios-select"
            >
              <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id">
                <span class="cat-option">
                  <CategoryIcon :category-id="c.id" class="cat-option-icon" />
                  {{ c.name }}
                </span>
              </el-option>
            </el-select>
          </div>

          <div class="field">
            <label class="field-label">交易地点</label>
            <el-input
              v-model="form.location"
              placeholder="如：东区宿舍楼下"
              class="ios-input"
            />
          </div>

          <!-- 售价 / 原价：整行两列，移动端仍保持并排（两格里都只填很短的数字） -->
          <div class="field field-full price-pair">
            <div class="price-item">
              <label class="field-label">售价 <span class="req">*</span></label>
              <el-input v-model="priceText" placeholder="0.00" class="ios-input">
                <template #prefix><span class="price-symbol">¥</span></template>
              </el-input>
            </div>
            <div class="price-item">
              <label class="field-label">原价（选填）</label>
              <el-input v-model="originalPriceText" placeholder="0.00" class="ios-input">
                <template #prefix><span class="price-symbol">¥</span></template>
              </el-input>
            </div>
          </div>

          <!-- 成色：iOS 分段控件（黑色 pill 滑块 + 平滑滑动） -->
          <div class="field field-full">
            <label class="field-label">成色</label>
            <div class="segmented">
              <div class="seg-slider" :style="segSliderStyle"></div>
              <button
                v-for="c in conditions"
                :key="c"
                type="button"
                class="seg-item"
                :class="{ active: form.condition === c }"
                @click="form.condition = c"
              >{{ c }}</button>
            </div>
          </div>

          <!-- 商品图片 -->
          <div class="field field-full">
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
              class="ios-upload"
            >
              <div class="upload-plus"></div>
            </el-upload>
            <p class="field-hint">最多 6 张，单张不超过 5MB，首张图片将作为封面展示</p>
          </div>

          <!-- 商品描述 -->
          <div class="field field-full">
            <label class="field-label">商品描述</label>
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="4"
              placeholder="成色、使用时长、配件情况…"
              maxlength="500"
              class="ios-input"
            />
          </div>

          <!-- 提交 -->
          <div class="actions">
            <button type="submit" class="btn-submit" :disabled="submitting || loading">
              <el-icon v-if="submitting" class="spin"><Loading /></el-icon>
              <span v-else>{{ isEdit ? '保存修改' : '发布闲置物品' }}</span>
            </button>
            <button type="button" class="btn-cancel" @click="$router.back()">取消</button>
          </div>
        </form>
      </section>

      <!-- ============================================================
           右：买家视角实时预览 + 发布小贴士
           桌面端常驻（吸顶跟随滚动），窄屏按移动端设计稿隐藏
           ============================================================ -->
      <aside class="publish-aside">
        <p class="aside-label">买家视角实时预览</p>

        <div class="preview-card">
          <div class="preview-image">
            <img v-if="imageList[0]" :src="imageList[0]" alt="预览图" />
            <div v-else class="preview-image-placeholder">
              <el-icon :size="26"><Picture /></el-icon>
              <span>上传首图后将展示在这里</span>
            </div>
          </div>
          <div class="preview-body">
            <p class="preview-title">{{ form.title || '商品标题会显示在这里' }}</p>
            <div class="preview-price-row">
              <span class="preview-price">¥ {{ priceText || '0.00' }}</span>
              <s v-if="originalPriceText" class="preview-origin">¥ {{ originalPriceText }}</s>
            </div>
            <span class="preview-tag">{{ form.condition }}</span>
          </div>
        </div>

        <div class="tips-card">
          <h3>发布小贴士</h3>
          <ul>
            <li>标题写明品牌 + 型号，搜索更容易被找到</li>
            <li>实拍图比网图的信任度高 3 倍</li>
            <li>定价参考同类商品的 6~8 折</li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getCategories, createProduct, updateProduct, getProductDetail, uploadFile } from '@/api'
import { Loading, Picture } from '@element-plus/icons-vue'
import CategoryIcon from '@/components/CategoryIcon.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const submitting = ref(false)
const loading = ref(false)
const categories = ref([])
const imageList = ref([])
const fileList = ref([])

const isEdit = computed(() => !!route.params.id)

const conditions = ['全新', '九成新', '八成新', '七成新及以下']

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

// 成色分段控件的滑块位置：滑块宽度为轨道的 1/4，
// 所以 translateX(100%) 正好移动一格，无需测量像素
const segIndex = computed(() => Math.max(0, conditions.indexOf(form.condition)))
const segSliderStyle = computed(() => ({
  transform: `translateX(${segIndex.value * 100}%)`
}))

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

/* ================================================================
   发布页 —— Apple HIG 风格
   桌面端：浅灰底 + 白卡片双栏（表单 / 实时预览），表单内部两列栅格
   移动端：白底单栏，控件加高，主按钮整行黑底宽字距
   ================================================================ */

.publish {
  /* 覆盖全局 .page-content 的浅灰底与内边距 */
  background: #F5F5F7;
  padding: 40px 32px 96px;
}

.publish-shell {
  max-width: 1120px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 28px;
  align-items: start;
}

/* ===== 表单卡片 ===== */
.publish-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 44px 48px;
}

.page-head {
  margin-bottom: 36px;
}
.page-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: #1D1D1F;
}
.page-sub {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: #86868B;
}

/* ===== 表单栅格：桌面两列，移动单列 ===== */
.publish-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 26px 20px;
}
.field {
  min-width: 0;
}
.field-full {
  grid-column: 1 / -1;
}
.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 400;
  color: #86868B;
}
.req {
  color: #FF3B30;
}
.field-hint {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #AEAEB2;
}

/* ===== 输入框：浅灰填充，聚焦转白底 + 蓝色细边 + 外圈光晕 ===== */
.ios-input :deep(.el-input__wrapper),
.ios-input :deep(.el-textarea__inner) {
  min-height: 48px;
  background: #F5F5F7;
  border-radius: 12px;
  box-shadow: 0 0 0 1px transparent inset;
  transition: box-shadow 0.2s ease, background 0.2s ease;
}
.ios-input :deep(.el-input__wrapper:hover),
.ios-input :deep(.el-textarea__inner:hover) {
  background: #ECECEF;
}
.ios-input :deep(.el-input__wrapper.is-focus),
.ios-input :deep(.el-textarea__inner:focus) {
  background: #FFFFFF;
  box-shadow:
    0 0 0 1px #0071E3 inset,
    0 0 0 3px rgba(0, 113, 227, 0.18);
}
.ios-input :deep(.el-input__inner),
.ios-input :deep(.el-textarea__inner) {
  color: #1D1D1F;
}
.ios-input :deep(.el-input__inner::placeholder),
.ios-input :deep(.el-textarea__inner::placeholder) {
  color: #AEAEB2;
}
.ios-input :deep(.el-textarea__inner) {
  min-height: 120px;
  padding: 14px 16px;
  line-height: 1.6;
}

/* 价格前缀 */
.price-symbol {
  color: #86868B;
}

/* ===== 分类下拉：与输入框同一套外观 ===== */
.ios-select {
  width: 100%;
}
.ios-select :deep(.el-select__wrapper) {
  min-height: 48px;
  background: #F5F5F7;
  border-radius: 12px;
  box-shadow: 0 0 0 1px transparent inset;
  transition: box-shadow 0.2s ease, background 0.2s ease;
}
.ios-select :deep(.el-select__wrapper:hover) {
  background: #ECECEF;
}
.ios-select :deep(.el-select__wrapper.is-focused) {
  background: #FFFFFF;
  box-shadow:
    0 0 0 1px #0071E3 inset,
    0 0 0 3px rgba(0, 113, 227, 0.18);
}
.ios-select :deep(.el-select__placeholder) {
  color: #AEAEB2;
}
.ios-select :deep(.el-select__selected-item) {
  color: #1D1D1F;
}
.cat-option {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cat-option-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #86868B;
}

/* ===== 价格两列 ===== */
.price-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 20px;
}

/* ===== 成色：iOS 分段控件 ===== */
.segmented {
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  padding: 4px;
  background: #F5F5F7;
  border-radius: 999px;
}
/* 滑块宽度 = 轨道内容宽的 1/4，因此 translateX(100%) 恰好移动一格，
   不需要测量像素宽度 */
.seg-slider {
  position: absolute;
  top: 4px;
  left: 4px;
  bottom: 4px;
  width: calc((100% - 8px) / 4);
  background: #000000;
  border-radius: 999px;
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0.35, 1);
}
.seg-item {
  position: relative;
  z-index: 1;
  border: none;
  background: transparent;
  padding: 11px 4px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 500;
  color: #1D1D1F;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.25s ease;
}
.seg-item.active {
  color: #FFFFFF;
  font-weight: 600;
}

/* ===== 图片上传：浅灰圆角方块 + 细加号 ===== */
.ios-upload :deep(.el-upload--picture-card),
.ios-upload :deep(.el-upload-list__item) {
  width: 96px;
  height: 96px;
  border: none;
  border-radius: 14px;
  background: #F5F5F7;
  transition: background 0.2s ease, transform 0.2s ease;
}
.ios-upload :deep(.el-upload--picture-card:hover) {
  background: #E9E9EC;
}
.ios-upload :deep(.el-upload--picture-card:active) {
  transform: scale(0.98);
}
/* 加号用纯 CSS 画（比图标更细，贴合设计稿的 2.5px 线宽） */
.upload-plus {
  position: relative;
  width: 100%;
  height: 100%;
}
.upload-plus::before,
.upload-plus::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #8E8E93;
  border-radius: 2px;
}
.upload-plus::before {
  width: 22px;
  height: 2.5px;
}
.upload-plus::after {
  width: 2.5px;
  height: 22px;
}

/* ===== 提交区：桌面端横向「黑底主按钮 + 文字取消」 ===== */
.actions {
  grid-column: 1 / -1;
  margin-top: 14px;
  display: flex;
  align-items: center;
  gap: 20px;
}
.btn-submit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 50px;
  padding: 0 44px;
  border: none;
  border-radius: 12px;
  background: #000000;
  color: #FFFFFF;
  font-family: inherit;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}
.btn-submit:hover:not(:disabled) {
  background: #2A2A2C;
}
.btn-submit:active:not(:disabled) {
  transform: scale(0.97);
}
.btn-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.spin {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.btn-cancel {
  border: none;
  background: transparent;
  padding: 12px 6px;
  color: #86868B;
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: color 0.2s ease;
}
.btn-cancel:hover {
  color: #1D1D1F;
}

/* ================================================================
   右侧：实时预览（吸顶）+ 发布小贴士
   ================================================================ */
.publish-aside {
  position: sticky;
  top: 88px; /* 全局吸顶导航 64px + 24px 间距 */
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.aside-label {
  margin: 0 0 0 6px;
  font-size: 13px;
  color: #86868B;
}
.preview-card {
  background: #FFFFFF;
  border-radius: 20px;
  overflow: hidden;
}
.preview-image {
  aspect-ratio: 4 / 3;
  background: #F5F5F7;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.preview-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.preview-image-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #AEAEB2;
  font-size: 13px;
}
.preview-body {
  padding: 18px 20px 22px;
}
.preview-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1D1D1F;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-price-row {
  margin-top: 8px;
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.preview-price {
  font-size: 20px;
  font-weight: 700;
  color: #B25F00;
  letter-spacing: -0.01em;
}
.preview-origin {
  font-size: 13px;
  color: #AEAEB2;
}
.preview-tag {
  display: inline-block;
  margin-top: 12px;
  padding: 4px 12px;
  border-radius: 999px;
  background: #F5F5F7;
  color: #86868B;
  font-size: 12px;
}
.tips-card {
  background: #FFFFFF;
  border-radius: 20px;
  padding: 22px 24px;
}
.tips-card h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #1D1D1F;
}
.tips-card li {
  position: relative;
  padding-left: 16px;
  font-size: 13px;
  line-height: 1.8;
  color: #86868B;
}
.tips-card li::before {
  content: "·";
  position: absolute;
  left: 2px;
  font-weight: 700;
}

/* ================================================================
   窄屏 / 移动端（≤1024px）：按移动端设计稿
   白底单栏、隐藏预览、控件加高、主按钮整行宽字距
   ================================================================ */
@media (max-width: 1024px) {
  .publish {
    background: #FFFFFF;
    padding: 40px 28px 88px;
  }
  .publish-shell {
    grid-template-columns: 1fr;
    gap: 0;
    max-width: 480px;
  }
  .publish-card {
    background: transparent;
    border-radius: 0;
    padding: 0;
  }
  .publish-aside {
    display: none;
  }

  .page-head {
    margin-bottom: 4px;
  }
  .page-title {
    font-size: 28px;
  }

  /* 单列：分类 / 交易地点 / 售价 / 原价 依次纵向排开 */
  .publish-form {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  /* 售价 / 原价 仍然并排：两格里都是很短的数字，并排更省空间 */
  .price-pair {
    grid-template-columns: 1fr 1fr;
    gap: 0 14px;
  }

  .ios-input :deep(.el-input__wrapper),
  .ios-input :deep(.el-textarea__inner) {
    min-height: 50px;
    border-radius: 13px;
  }
  .ios-select :deep(.el-select__wrapper) {
    min-height: 50px;
    border-radius: 13px;
  }
  .ios-input :deep(.el-input__wrapper.is-focus),
  .ios-input :deep(.el-textarea__inner:focus),
  .ios-select :deep(.el-select__wrapper.is-focused) {
    box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.55);
  }

  /* 分段控件：手机上 4 个中文标签更挤，字号收到 13px 防止「七成新及以下」溢出 */
  .seg-item {
    font-size: 13px;
    padding: 12px 2px;
  }
  .upload-plus::before { width: 26px; }
  .upload-plus::after { height: 26px; }
  .ios-upload :deep(.el-upload--picture-card),
  .ios-upload :deep(.el-upload-list__item) {
    width: 112px;
    height: 112px;
    border-radius: 18px;
  }

  /* 主按钮整行、加高、宽字距；取消按钮降级为下方文字按钮 */
  .actions {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    margin-top: 32px;
  }
  .btn-submit {
    width: 100%;
    height: 52px;
    padding: 0;
    border-radius: 14px;
    font-size: 17px;
    letter-spacing: 0.32em;
    text-indent: 0.32em;
  }
  .btn-cancel {
    width: 100%;
    padding: 14px 0;
    font-size: 15px;
  }
}

/* 超窄机型（≤420px）：分段控件再收一档，保证 4 个标签都完整显示 */
@media (max-width: 420px) {
  .publish {
    padding: 32px 20px 80px;
  }
  .seg-item {
    font-size: 12px;
  }
}

/* 尊重系统「减少动效」偏好 */
@media (prefers-reduced-motion: reduce) {
  .seg-slider,
  .btn-submit,
  .btn-cancel,
  .ios-input :deep(.el-input__wrapper),
  .ios-input :deep(.el-textarea__inner),
  .ios-select :deep(.el-select__wrapper) {
    transition: none !important;
  }
}
</style>
