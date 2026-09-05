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
</style>
