<!-- 分类线条图标组件：根据categoryId渲染对应SVG线条图标 -->
<template>
  <svg class="category-svg-icon" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
  >
    <!-- 数码电子: 手机 -->
    <template v-if="categoryId === 1">
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <line x1="12" y1="18" x2="12" y2="18.01" />
      <line x1="8" y1="7" x2="16" y2="7" />
    </template>

    <!-- 书籍教材: 合上的书本 -->
    <template v-else-if="categoryId === 2">
      <path d="M4 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="6" y1="7" x2="10" y2="7" />
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="6" y1="15" x2="10" y2="15" />
    </template>

    <!-- 生活用品: 房子 -->
    <template v-else-if="categoryId === 3">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </template>

    <!-- 服饰鞋包: T恤 -->
    <template v-else-if="categoryId === 4">
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" />
    </template>

    <!-- 运动健身: 篮球 -->
    <template v-else-if="categoryId === 5">
      <circle cx="12" cy="12" r="10" />
      <path d="M4.93 4.93c3.9 3.9 10.24 3.9 14.14 0" />
      <path d="M4.93 19.07c3.9-3.9 10.24-3.9 14.14 0" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </template>

    <!-- 美妆护肤: 化妆镜 -->
    <template v-else-if="categoryId === 6">
      <ellipse cx="12" cy="7" rx="7" ry="6" />
      <line x1="12" y1="13" x2="12" y2="20" />
      <line x1="7" y1="20" x2="17" y2="20" />
    </template>

    <!-- 乐器: 音符 -->
    <template v-else-if="categoryId === 7">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="21" cy="16" r="3" />
    </template>

    <!-- 其他: 更多/星形 -->
    <template v-else>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  categoryId: { type: Number, required: true }
})
</script>

<style scoped>
.category-svg-icon {
  width: 24px;
  height: 24px;
  display: block;
}
</style>
