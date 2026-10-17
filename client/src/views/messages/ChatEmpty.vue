<template>
  <div class="chat-empty-state">
    <span class="empty-icon">💬</span>
    <p>选择一个会话，开始聊天吧</p>
  </div>
</template>

<style scoped>
.chat-empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  gap: 16px;
}

.empty-icon {
  font-size: 56px;
  opacity: 0.35;
}

p {
  font-size: 15px;
}

/* 移动端是「会话列表 / 聊天详情」二选一的全屏切换，这个空状态不会被有意展示；
   从列表点进聊天时它是"即将退场"的旧内容，隐藏掉才不会闪一下。
   桌面端双栏布局保留空状态。
   !important：避免被 MessagesLayout 里 :deep(.chat-empty-state){display:flex} 抢占 */
@media (max-width: 768px) {
  .chat-empty-state {
    display: none !important;
  }
}
</style>
