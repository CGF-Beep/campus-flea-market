<template>
  <div class="chat-page">
    <!-- 顶部导航 -->
    <div class="chat-topbar">
      <div class="topbar-inner">
        <div class="chat-title">
          <span class="peer-name">{{ isSystem ? '系统通知' : (otherNickname || '对话') }}</span>
          <span class="peer-sub">{{ isSystem ? '订单状态与交易通知' : '' }}</span>
        </div>
        <div class="topbar-actions">
          <button class="icon-btn" @click="$router.push(`/products`)" title="逛市场">
            <el-icon :size="18"><ShoppingBag /></el-icon>
          </button>
        </div>
      </div>
    </div>

    <!-- 消息区 -->
    <div class="chat-body">
      <div class="chat-messages" ref="msgBox" v-loading="loading">
        <template v-if="!loading && messages.length === 0">
          <div class="chat-empty">
            <p>打个招呼，开启对话吧</p>
          </div>
        </template>
        <div v-for="msg in messages" :key="msg.id" :class="['msg-row', msg.fromUserId === userId ? 'row-self' : 'row-other']">
          <div class="msg-avatar" v-if="msg.fromUserId !== userId">
            <img v-if="msg.sender?.avatar" :src="msg.sender.avatar" alt="avatar" />
            <span v-else class="avatar-fallback">{{ (msg.sender?.nickname || '友')[0] }}</span>
          </div>
          <div class="msg-stack">
            <!-- 图片消息：直接展示图片本体，不带气泡边框 -->
            <el-image
              v-if="msg.image"
              :src="msg.image"
              :preview-src-list="[msg.image]"
              preview-teleported
              fit="cover"
              class="msg-image"
              alt="聊天图片"
            />
            <div class="msg-bubble" v-if="msg.content" :class="msgBubbleClass(msg)">
              <div class="bubble-text">{{ msg.content }}</div>
              <a
                v-if="isConfirmNotice(msg)"
                class="confirm-link"
                @click.prevent="goConfirm(msg)"
              >去确认订单 →</a>
            </div>
            <span class="msg-time">{{ formatTime(msg.createdAt) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区：系统通知会话不提供回复 -->
    <div class="chat-inputbar glass" v-if="!isSystem">
      <div class="inputbar-inner">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden-file-input"
          @change="handlePickImage"
        />
        <button
          class="img-btn"
          :disabled="uploading"
          :title="uploading ? '图片上传中...' : '发送图片'"
          @click="fileInput.click()"
        >
          <el-icon v-if="!uploading" :size="22"><CirclePlus /></el-icon>
          <span v-else class="img-loading"></span>
        </button>
        <el-input
          v-model="text"
          class="chat-input"
          placeholder="输入消息..."
          maxlength="500"
          @keyup.enter="handleSend"
        />
        <button
          class="send-btn"
          :disabled="!text.trim() || sending || uploading"
          :class="{ active: text.trim() }"
          @click="handleSend"
        >
          <el-icon v-if="!sending" :size="18"><Promotion /></el-icon>
          <span v-else class="send-loading"></span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getChatHistory, sendMessage, uploadFile } from '@/api'
import { ElMessage } from 'element-plus'
import { ShoppingBag, Promotion, CirclePlus } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const userId = computed(() => userStore.user?.id)
const otherUserId = computed(() => route.params.userId)
const loading = ref(false)
const messages = ref([])
const text = ref('')
const sending = ref(false)
const msgBox = ref()
const fileInput = ref()
const uploading = ref(false)

const otherNickname = computed(() => {
  return route.query.name || (() => {
    const otherMsg = [...messages.value].reverse().find(m => m.fromUserId !== userId.value)
    return otherMsg?.sender?.nickname || ''
  })()
})

// 是否为系统通知会话（只读，无需回复）
const isSystem = computed(() => route.query.system === '1')

const msgBubbleClass = (msg) => {
  if (msg.fromUserId === userId.value) return 'bubble-self'
  if (msg.sender?.username === 'system') return 'bubble-system'
  return 'bubble-other'
}

// 是否为"待确认订单"系统通知（带商品、可直达确认）
const isConfirmNotice = (msg) => {
  return msg.sender?.username === 'system' && !!msg.productId && msg.content.includes('请尽快确认订单')
}

// 跳转到商品详情页，卖家视角会展示订单确认区
const goConfirm = (msg) => {
  if (!msg.productId) return
  router.push(`/products/${msg.productId}`)
}

const loadData = async () => {
  if (!otherUserId.value) return
  loading.value = true
  try {
    const res = await getChatHistory(otherUserId.value, { page: 1, pageSize: 100 })
    messages.value = res.data.list
    await nextTick()
    scrollToBottom()
  } catch (e) {} finally { loading.value = false }
}

const handleSend = async () => {
  if (!text.value.trim() || sending.value || !otherUserId.value) return
  sending.value = true
  try {
    await sendMessage({ toUserId: Number(otherUserId.value), content: text.value })
    text.value = ''
    await loadData()
  } catch (e) {} finally { sending.value = false }
}

// 选择图片：上传后直接以图片消息发送（文字与图片可同时携带）
const handlePickImage = async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('只能发送图片文件')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过5MB')
    return
  }
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await uploadFile(formData)
    await sendMessage({ toUserId: Number(otherUserId.value), image: res.data.url })
    await loadData()
  } catch (e) {} finally { uploading.value = false }
}

const formatTime = (t) => new Date(t).toLocaleString('zh-CN', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
})

const scrollToBottom = () => {
  if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
}

onMounted(() => loadData())

// 在左右分栏布局下切换会话时，路由参数变化但组件复用，需要重新加载
watch(() => route.params.userId, (newId, oldId) => {
  if (newId && newId !== oldId) {
    text.value = ''
    loadData()
  }
})
</script>

<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8f7f5;
}

/* 顶部栏 */
.chat-topbar {
  flex-shrink: 0;
  background: transparent;
}
.topbar-inner {
  padding: 0 28px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.chat-title {
  flex: 1;
  text-align: center;
}
.peer-name {
  display: block;
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.01em;
}
.peer-sub {
  display: block;
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 2px;
}
.icon-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
}
.icon-btn:hover {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text);
}

/* 消息区 */
.chat-body {
  flex: 1;
  overflow: hidden;
}
.chat-messages {
  height: 100%;
  overflow-y: auto;
  padding: 28px 28px 40px;
}
.chat-messages :deep(.el-loading-mask) {
  background: transparent !important;
}
.chat-empty {
  text-align: center;
  padding-top: 120px;
  color: var(--color-text-tertiary);
}
.chat-empty p {
  font-size: 14px;
}

.msg-row {
  display: flex;
  gap: 12px;
  margin-bottom: 22px;
  align-items: flex-end;
}
.row-self {
  justify-content: flex-end;
}
.msg-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #5ac8fa, #0071e3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}
.msg-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-fallback {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}
.msg-stack {
  max-width: 65%;
  display: flex;
  flex-direction: column;
}
.row-self .msg-stack {
  align-items: flex-end;
}
.msg-bubble {
  padding: 12px 18px;
  font-size: 15px;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}
.bubble-other {
  background: #fff;
  color: var(--color-text);
  border-radius: 20px 20px 20px 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}
.bubble-system {
  background: rgba(255, 149, 0, 0.1);
  color: var(--color-text);
  border-radius: 20px 20px 20px 6px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(255, 149, 0, 0.2);
}
.confirm-link {
  display: inline-block;
  margin-top: 10px;
  padding: 6px 14px;
  border-radius: 980px;
  background: linear-gradient(135deg, #ff9f0a, #ff6b00);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.25s ease;
}
.confirm-link:hover {
  opacity: 0.85;
  transform: scale(1.03);
}
.bubble-self {
  background: var(--color-primary);
  color: #fff;
  border-radius: 20px 20px 6px 20px;
  box-shadow: 0 4px 12px rgba(0, 113, 227, 0.22);
}

/* 图片消息：无边框直接展示 */
.msg-image {
  max-width: 260px;
  max-height: 260px;
  border-radius: 14px;
  display: block;
  cursor: zoom-in;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
}

.msg-image + .msg-bubble {
  margin-top: 8px;
}
.msg-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
  margin-top: 5px;
}

/* 输入区：悬浮圆角条 */
.chat-inputbar {
  flex-shrink: 0;
  padding: 0 24px 20px;
  background: transparent;
}
.inputbar-inner {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  border-radius: 980px;
  padding: 6px 6px 6px 22px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.25s ease;
}
.inputbar-inner:focus-within {
  box-shadow: 0 6px 24px rgba(0, 113, 227, 0.14);
}
.chat-input {
  flex: 1;
}
.chat-input :deep(.el-input__wrapper) {
  background: transparent;
  border-radius: 980px;
  padding: 12px 0;
  box-shadow: none !important;
}
.chat-input :deep(.el-input__inner) {
  font-size: 15px;
  color: var(--color-text);
}
.chat-input :deep(.el-input__inner::placeholder) {
  color: var(--color-text-tertiary);
}

/* 图片上传按钮 */
.hidden-file-input {
  display: none;
}

.img-btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.img-btn:hover:not(:disabled) {
  background: rgba(0, 113, 227, 0.08);
  color: var(--color-primary);
}

.img-btn:hover:not(:disabled) .el-icon {
  transform: rotate(90deg);
}

.img-btn .el-icon {
  transition: transform 0.3s ease;
}

.img-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.img-loading {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(0, 113, 227, 0.25);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.send-btn {
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 113, 227, 0.12);
  color: var(--color-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  flex-shrink: 0;
}
.send-btn.active {
  background: var(--color-primary);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 113, 227, 0.28);
}
.send-btn.active:hover {
  background: var(--color-primary-hover);
  transform: scale(1.05);
}
.send-btn:disabled {
  cursor: not-allowed;
}
.send-loading {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
