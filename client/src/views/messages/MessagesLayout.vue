<template>
  <div class="messages-layout">
    <div class="messages-card" :class="isChat ? 'state-chat' : 'state-list'">
      <!-- 左侧会话列表（移动端聊天时隐藏） -->
      <aside class="messages-sidebar">
        <ConversationList />
      </aside>

      <!-- 右侧聊天详情（移动端列表时隐藏） -->
      <main class="messages-main">
        <!-- 与全站页面切换共用同一套动画（fade-slide：淡入 + 14px 横移） -->
        <transition name="fade-slide" mode="out-in">
          <router-view :key="$route.params.userId || 'list'" />
        </transition>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import ConversationList from './ConversationList.vue'

const route = useRoute()
// /messages/:userId 为具体聊天页（移动端切换为全屏聊天）
const isChat = computed(() => /^\/messages\/.+/.test(route.path))
</script>

<style scoped>
.messages-layout {
  min-height: calc(100vh - 64px);
  padding: 16px;
  background: var(--color-bg-secondary);
  display: flex;
  justify-content: center;
}

.messages-card {
  width: 100%;
  max-width: 1200px;
  height: calc(100vh - 96px);
  min-height: 560px;
  background: #fff;
  border-radius: var(--radius-xl);
  box-shadow: 0 16px 50px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  overflow: hidden;
}

.messages-sidebar {
  flex: 0 0 25%;
  min-width: 240px;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  background: #fff;
}

.messages-main {
  flex: 0 0 75%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f8f7f5;
  position: relative;
}

/* 切换会话动画改用全站通用的 fade-slide（见 styles/global.css），
   原先的 .chat-switch 纯透明度过渡已废弃 */

/* 右侧空态 */
:deep(.chat-empty-state) {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  gap: 16px;
}

:deep(.chat-empty-state .empty-icon) {
  font-size: 56px;
  opacity: 0.35;
}

:deep(.chat-empty-state p) {
  font-size: 15px;
}

/* ================================================================
   移动端响应式（≤768px）：列表 / 聊天 二选一单列全屏
   ================================================================ */
@media (max-width: 768px) {
  .messages-layout {
    /* 必须是确定高度：只有 min-height 时百分比高度链会断，
       子级会退化成"内容高度"，导致底部留白 */
    height: 100%;
    min-height: 0;
    padding: 0;
    background: var(--color-bg-secondary);
  }

  .messages-card {
    flex-direction: column;
    height: 100%;
    min-height: 0;
    /* 移动端去掉外层白卡片，跟页面背景融合 */
    background: transparent;
    border: none;
    box-shadow: none;
    border-radius: 0;
  }

  /* 列表态：隐藏右侧空聊天区 */
  .state-list .messages-main {
    display: none;
  }

  /* 聊天态：隐藏左侧会话列表，聊天全宽 */
  .state-chat .messages-sidebar {
    display: none;
  }

  .messages-sidebar {
    flex: 1 1 100%;
    border-right: none;
    background: transparent;
  }

  .messages-main {
    flex: 1 1 100%;
    background: var(--color-bg-secondary);
  }
}
</style>
