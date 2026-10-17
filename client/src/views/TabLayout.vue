<!--
  Tab 页布局层

  路由结构：Layout（外壳）> TabLayout（这一层）> 各 tab 页
  - tab 页都挂在这里的 children 下，所以悬浮胶囊在整个 tab 区里是「常驻」的：
    页与页之间切换时 TabLayout 不重建，胶囊不会闪一下重进。
  - 发布页 / 登录 / 注册 / 后台不在这个 children 下，天然不渲染胶囊（无需额外判断）。

  两件事：
  1. 内容底部统一留出胶囊的高度（约 90px + 安全区），一次写在这里，
     不用逐个页面加 padding，也不会有页面漏加被遮住。
  2. 渲染 FloatTabBar（聊天对话页收起，那里有自己的输入框）。
-->
<template>
  <div class="tab-layout" :class="{ 'has-float-tabbar': showFloatTabBar }">
    <!-- 页面切换动画与缓存都收在这一层：Layout 的 keep-alive 把整个 TabLayout 缓存住，
         所以去发布页再回来时，列表页的滚动位置和状态都还在 -->
    <router-view v-slot="{ Component }">
      <transition name="fade-slide" mode="out-in">
        <keep-alive :include="cachedViews">
          <component :is="Component" />
        </keep-alive>
      </transition>
    </router-view>

    <FloatTabBar :visible="showFloatTabBar" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FloatTabBar from '@/components/FloatTabBar.vue'

// 供 Layout.vue 的 <keep-alive :include> 匹配（缓存本层 = 保住下面页面的缓存与滚动位置）
defineOptions({ name: 'TabLayout' })

// 需要与 Layout.vue 的 keep-alive include 配合：只缓存「浏览型」列表页
const cachedViews = ['Home', 'ProductList']

const route = useRoute()

// 聊天对话页有自己的输入条，胶囊会挡住它，这里收起
// （与改造前的判定保持一致：只有 /messages/:userId 这种二级路径才隐藏）
const showFloatTabBar = computed(() => !/^\/messages\/.+/.test(route.path))
</script>

<style scoped>
/* 移动端：给悬浮胶囊留位置（90px 约等于 58px 胶囊 + 上下间距），再加安全区 */
@media (max-width: 768px) {
  .tab-layout.has-float-tabbar {
    padding-bottom: calc(90px + max(env(safe-area-inset-bottom, 0px), 10px));
  }
}
</style>
