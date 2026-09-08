<template>
  <div class="conversation-list" v-loading="loading">
    <div class="conv-list-header">
      <h3>消息</h3>
    </div>
    <div class="conv-list-body" ref="convListRef">
      <div class="conv-slider" :style="convSliderStyle"></div>
      <div
        v-for="(conv, i) in conversations"
        :key="conv.userId"
        data-tab-item
        class="conv-item"
        :class="{ active: isActive(conv), 'conv-system': conv.isSystem }"
        :style="{ animationDelay: `${i * 50}ms` }"
        @click="selectConv(conv)"
      >
        <div class="conv-avatar" :class="{ 'no-img': !conv.avatar, system: conv.isSystem }">
          <img v-if="conv.avatar && !conv.isSystem" :src="conv.avatar" alt="avatar" />
          <el-icon v-else-if="conv.isSystem" :size="22"><Bell /></el-icon>
          <span v-else class="avatar-fallback">{{ avatarText(conv.nickname) }}</span>
        </div>
        <div class="conv-info">
          <div class="conv-top">
            <span class="conv-name">{{ conv.isSystem ? '系统通知' : conv.nickname }}</span>
            <span class="conv-time">{{ formatTime(conv.lastTime) }}</span>
          </div>
          <div class="conv-bottom">
            <span class="conv-last" :class="{ unread: conv.unreadCount > 0 }">{{ conv.lastMessage }}</span>
            <span v-if="conv.unreadCount > 0" class="unread-badge">{{ conv.unreadCount > 99 ? '99+' : conv.unreadCount }}</span>
          </div>
        </div>
      </div>

      <el-empty v-if="!loading && conversations.length === 0" description="暂无消息，去逛逛市场吧" :image-size="100">
        <button class="btn-primary" @click="$router.push('/products')">逛市场</button>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getConversations } from '@/api'
import { Bell } from '@element-plus/icons-vue'
import { useTabSlider } from '@/composables/useTabSlider.js'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const conversations = ref([])

// 会话列表选中滑块
const {
  containerRef: convListRef,
  sliderStyle: convSliderStyle,
  updateSlider: updateConvSlider
} = useTabSlider()

const activeIndex = computed(() => {
  return conversations.value.findIndex((conv) => isActive(conv))
})

watch(activeIndex, () => {
  updateConvSlider(activeIndex.value)
})

const loadData = async () => {
  loading.value = true
  try {
    const res = await getConversations()
    conversations.value = res.data
    // 不再自动打开第一个会话，停留在列表页（点会话才进入聊天）
    await nextTick()
    updateConvSlider(activeIndex.value)
  } catch (e) {} finally { loading.value = false }
}

const isActive = (conv) => {
  return route.params.userId === String(conv.userId)
}

const selectConv = (conv) => {
  router.push({
    path: `/messages/${conv.userId}`,
    query: { name: conv.nickname, system: conv.isSystem ? '1' : undefined }
  })
}

const avatarText = (name) => (name || '友')[0]

const formatTime = (t) => {
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  if (d.toDateString() === yesterday.toDateString()) return '昨天'
  return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

onMounted(() => loadData())
</script>

<style scoped>
.conversation-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

.conv-list-header {
  padding: 22px 20px 16px;
  flex-shrink: 0;
}

.conv-list-header h3 {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: -0.02em;
}

.conv-list-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  position: relative;
}

/* 选中会话滑块背景：跟随当前选中项平滑滑动 */
.conv-slider {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: var(--radius-lg);
  background: rgba(0, 113, 227, 0.08);
  border: 1px solid rgba(0, 113, 227, 0.12);
  box-shadow: 0 2px 8px rgba(0, 113, 227, 0.06);
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
  z-index: 0;
  pointer-events: none;
}

.conv-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 6px;
  border: 1px solid transparent;
}

.conv-item:hover {
  background: rgba(0, 0, 0, 0.03);
}

.conv-item.active {
  /* 背景交给 .conv-slider 负责，实现平滑滑动效果 */
}

.conv-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: linear-gradient(135deg, #5ac8fa, #0071e3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.conv-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conv-avatar.system {
  background: linear-gradient(135deg, #ff9f0a, #ff6b00);
  color: #fff;
}

.avatar-fallback {
  color: #fff;
  font-size: 18px;
  font-weight: 600;
}

.conv-info {
  flex: 1;
  min-width: 0;
}

.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 3px;
}

.conv-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text);
}

.conv-time {
  font-size: 11px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  margin-left: 8px;
}

.conv-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.conv-last {
  font-size: 13px;
  color: var(--color-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-last.unread {
  color: var(--color-text);
  font-weight: 500;
}

.unread-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 980px;
  background: var(--color-danger);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
