<template>
  <div class="messages page-content">
    <div class="container container-narrow">
      <!-- 页面标题 -->
      <div class="page-header">
        <h2 class="page-title">消息中心</h2>
      </div>

      <!-- 会话列表 -->
      <div class="conv-list" v-loading="loading">
        <div
          v-for="(conv, i) in conversations"
          :key="conv.userId"
          class="conv-item animate-in"
          :class="{ 'conv-system': conv.isSystem }"
          :style="{ animationDelay: `${i * 50}ms` }"
          @click="$router.push({ path: `/messages/${conv.userId}`, query: { name: conv.nickname, system: conv.isSystem ? '1' : undefined } })"
        >
          <div class="conv-avatar" :class="{ 'no-img': !conv.avatar, system: conv.isSystem }">
            <img v-if="conv.avatar && !conv.isSystem" :src="conv.avatar" alt="avatar" />
            <el-icon v-else-if="conv.isSystem" :size="24"><Bell /></el-icon>
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
          <el-icon class="chevron"><ArrowRight /></el-icon>
        </div>

        <el-empty v-if="!loading && conversations.length === 0" description="暂无消息，去逛逛市场吧">
          <button class="btn-primary" @click="$router.push('/products')">逛市场</button>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getConversations } from '@/api'
import { ArrowRight, Bell } from '@element-plus/icons-vue'

const loading = ref(false)
const conversations = ref([])

const loadData = async () => {
  loading.value = true
  try {
    const res = await getConversations()
    conversations.value = res.data
  } catch (e) {} finally { loading.value = false }
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
.container-narrow {
  max-width: 720px;
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

.conv-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}
.conv-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  background: var(--color-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all 0.3s ease;
}
.conv-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.conv-avatar {
  width: 52px;
  height: 52px;
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
.avatar-fallback {
  color: #fff;
  font-size: 20px;
  font-weight: 600;
}
.conv-avatar.system {
  background: linear-gradient(135deg, #ff9f0a, #ff6b00);
  color: #fff;
}
.conv-info {
  flex: 1;
  min-width: 0;
}
.conv-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 4px;
}
.conv-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}
.conv-time {
  font-size: 12px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  margin-left: 12px;
}
.conv-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
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
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
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
.chevron {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  transition: transform 0.3s ease;
}
.conv-item:hover .chevron {
  transform: translateX(3px);
  color: var(--color-primary);
}
</style>
