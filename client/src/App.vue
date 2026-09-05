<!-- 根组件：路由视图容器、页面切换过渡动画 -->
<template>
  <router-view v-slot="{ Component }">
    <transition name="page" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script setup>
import { onMounted } from 'vue'
import { useUserStore } from '@/stores/user'

const userStore = useUserStore()

onMounted(() => {
  userStore.init()
  if (userStore.isLoggedIn) {
    userStore.fetchProfile()
  }
})
</script>

<style>
/* 页面切换过渡：轻微上浮淡入，Apple 质感 */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.28s ease, transform 0.28s ease;
  will-change: opacity, transform;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(14px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
