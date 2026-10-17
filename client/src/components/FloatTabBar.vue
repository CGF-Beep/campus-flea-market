<!--
  悬浮胶囊底部 Tab 栏（仅移动端 ≤768px 显示）

  结构：一颗悬浮胶囊，里面 4 个 tab，选中项底下是半透明玻璃滑块。
  （发布入口 2026-10-16 从胶囊左侧挪到了顶栏，见 Layout.vue 的 .header-publish —— 挤在胶囊旁边太窄）

  设计要点：
  - 只有一层 fixed 外壳（.ftab-layer）负责贴底 + 安全区 + pointer-events: none，
    可点的胶囊自己 pointer-events: auto —— 两侧空白不会挡住页面点击。
  - 图标全部用内联 <symbol> + <use>，颜色走 currentColor，不引图片、不加图标库。
  - 高亮用 router-link 的 exact-active-class 自动判断；少数 router 匹配不到的子路径
    （/products/5、/profile 等）再补一条前缀/枚举规则。
  - 「市场」Tab 沿用京东式回顶：页面滚过阈值后图标变向上箭头、文案变「顶部」。

  用法：<FloatTabBar :visible="showFloatTabBar" />，未读角标由 Layout provide 进来。
-->
<template>
  <div class="ftab-layer">
    <!-- 图标 symbol 库：0 尺寸，不参与布局，也不影响点击 -->
    <svg class="ftab-sprite" aria-hidden="true" focusable="false">
      <symbol id="ftab-home" viewBox="0 0 24 24">
        <path d="M3.8 10.6 12 3.9l8.2 6.7" />
        <path d="M5.5 9.4v10.1c0 .6.4 1 1 1h11c.6 0 1-.4 1-1V9.4" />
        <path d="M9.6 20.5v-5c0-.9.6-1.5 1.5-1.5h1.8c.9 0 1.5.6 1.5 1.5v5" />
      </symbol>
      <symbol id="ftab-market" viewBox="0 0 24 24">
        <path d="M4.6 8.7V18c0 .8.7 1.5 1.5 1.5h11.8c.8 0 1.5-.7 1.5-1.5V8.7" />
        <path d="M4 8.7h16" />
        <path d="M4 8.7 6.3 4.4c.3-.6.9-1 1.6-1h8.2c.7 0 1.3.4 1.6 1l2.3 4.3" />
        <path d="M12 7.2v2.2" />
      </symbol>
      <symbol id="ftab-chat" viewBox="0 0 24 24">
        <path d="M12 3.9c4.8 0 8.6 3.3 8.6 7.4 0 4.1-3.8 7.4-8.6 7.4-1 0-1.9-.1-2.7-.4l-3.1 1.6.9-2.9c-2.2-1.4-3.7-3.5-3.7-5.7 0-4.1 3.8-7.4 8.6-7.4Z" />
        <path d="M8.7 11.3h.01" />
        <path d="M12 11.3h.01" />
        <path d="M15.3 11.3h.01" />
      </symbol>
      <symbol id="ftab-user" viewBox="0 0 24 24">
        <circle cx="12" cy="8.2" r="3.5" />
        <path d="M5.1 19.7c1-3.4 3.6-5.4 6.9-5.4s5.9 2 6.9 5.4" />
      </symbol>
      <symbol id="ftab-top" viewBox="0 0 24 24">
        <path d="M12 19.4V5.6" />
        <path d="m5.9 11.7 6.1-6.1 6.1 6.1" />
      </symbol>
    </svg>

    <transition name="ftab-rise">
      <div v-if="visible" class="ftab-bar">
        <!-- 胶囊：4 个 tab + 滑块（发布入口已挪到顶栏，见 Layout.vue 的 .header-publish） -->
        <nav class="ftab-capsule">
          <div ref="tabTrackRef" class="ftab-track">
            <div class="ftab-slider" :style="sliderStyle"></div>
            <router-link
              v-for="tab in tabs"
              :key="tab.path"
              :to="tab.path"
              data-tab-item
              class="ftab-item"
              active-class="ftab-partial"
              exact-active-class="is-active"
              :class="{ 'is-active': isActiveTab(tab) }"
              @click.capture="onTabClick($event, tab)"
            >
              <!-- :key 让激活状态切换时重建图标，触发一次弹出动画（路由切换的过渡效果） -->
              <span class="ftab-icon-wrap" :key="isActiveTab(tab) ? 'on' : 'off'">
                <svg class="ftab-icon"><use :href="isBackTopTab(tab) ? '#ftab-top' : '#' + tab.icon" /></svg>
                <span v-if="tab.badge && unreadCount > 0" class="ftab-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
              </span>
              <span class="ftab-label">{{ isBackTopTab(tab) ? '顶部' : tab.label }}</span>
            </router-link>
          </div>
        </nav>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useTabBackTop } from '@/composables/useTabBackTop.js'
import { useTabSlider } from '@/composables/useTabSlider.js'

const props = defineProps({
  // 由布局层控制显示：发布页 / 聊天页不渲染胶囊
  visible: { type: Boolean, default: true }
})

const route = useRoute()

// 未读数由 Layout.vue provide（那边有轮询，避免这里再拉一份）
const unreadCount = inject('appUnreadCount', ref(0))

const tabs = [
  { path: '/', icon: 'ftab-home', label: '首页' },
  { path: '/products', icon: 'ftab-market', label: '市场' },
  { path: '/messages', icon: 'ftab-chat', label: '消息', badge: true },
  // 「我的」在路由上是聚合入口，桌面的 /profile、/my-products 等也在这一支里
  { path: '/me', icon: 'ftab-user', label: '我的', extra: ['/profile', '/my-products', '/favorites', '/orders'] }
]

// ⚠️ router-link 的 active-class 有个坑：指向根路径的链接（首页）在**任何**页面都会被
// 判成 active（当前路由的 matched 链里带着 '/' 这条父记录），会导致「首页」和「市场」
// 同时高亮。所以视觉类 is-active 挂的是 exact-active-class（严格同路径），
// 再由下面的前缀/枚举规则补齐子路径和 /me 这一支。
const isActiveTab = (tab) => {
  const p = route.path
  if (p === tab.path) return true
  if (tab.path !== '/' && p.startsWith(tab.path + '/')) return true
  return (tab.extra || []).includes(p)
}

// ===== 滑块：跟随当前选中的 tab（复用全局的 useTabSlider）=====
const { containerRef: tabTrackRef, sliderStyle, updateSlider: updateTabSlider } = useTabSlider()
const activeIndex = computed(() => tabs.findIndex((t) => isActiveTab(t)))

const syncSlider = () => {
  if (!props.visible) return
  updateTabSlider(activeIndex.value)
}

watch(activeIndex, syncSlider)
// 胶囊是 v-if 出来的，挂载后要量一次；进场动画期间 container 与 item 一起位移，
// useTabSlider 取的是两者相对位置，所以动画中量也准。
watch(() => props.visible, (v) => {
  if (v) nextTick(syncSlider)
})
watch(() => route.path, () => nextTick(syncSlider))

// 宽度变化（横竖屏切换等）会改变每个 tab 的宽度，重新量一次
const onResize = () => syncSlider()

onMounted(() => {
  nextTick(syncSlider)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
})

// 京东式回顶：仅「市场」Tab，且该页已滚过阈值时生效（状态来自 composables/useTabBackTop.js）
const { backTopVisible, run: runTabBackTop } = useTabBackTop()
const isBackTopTab = (tab) => tab.path === '/products' && isActiveTab(tab) && backTopVisible.value

const onTabClick = (e, tab) => {
  if (!isBackTopTab(tab)) return
  e.preventDefault() // 已经是当前页，别跳转，回顶就行
  runTabBackTop()
}
</script>

<style scoped>
/* 桌面端整体不渲染：这套只在手机上用 */
.ftab-layer {
  display: none;
}

.ftab-sprite {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

@media (max-width: 768px) {
  /* 外层：贴底 + 安全区，自身不吃点击（pointer-events: none），只让圆钮和胶囊可点 */
  .ftab-layer {
    display: block;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 120;
    /* iOS 手势条留白；安卓浏览器常返回 0，补 10px 保底 */
    padding-bottom: max(env(safe-area-inset-bottom, 0px), 10px);
    pointer-events: none;
  }

  /* 一行：只剩 tab 胶囊（发布入口已挪到顶栏，不再挤在这里） */
  .ftab-bar {
    display: flex;
    align-items: center;
    padding: 0 16px;
    pointer-events: none;
  }

  /* ===== 胶囊容器：iOS 分段控件的毛玻璃底（透明度与滑块一致，整体再透一点） ===== */
  .ftab-capsule {
    flex: 1;
    min-width: 0;
    pointer-events: auto;
    height: 54px;
    padding: 3px;
    border-radius: 27px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: saturate(180%) blur(20px);
    -webkit-backdrop-filter: saturate(180%) blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.5);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    /* 透明度/毛玻璃切换时不要突变 */
    transition: background 0.25s ease, box-shadow 0.25s ease;
  }

  /* 轨道：只做滑块的定位容器；滑块只跟胶囊留 3px（padding），贴着边框走 */
  .ftab-track {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
    height: 100%;
    padding: 0;
    border-radius: 24px;
    background: transparent;
  }

  /* 滑块：比容器再透一档（能透出后面内容），
     靠亮描边 + 内高光 + 一层轻阴影把边界勾出来；只跟胶囊留 3px，贴边 */
  .ftab-slider {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
    border-radius: 23px;
    background: rgba(255, 255, 255, 0.38);
    border: 1px solid rgba(255, 255, 255, 0.8);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.65),
      0 2px 8px rgba(0, 0, 0, 0.15);
    transition: all 0.28s cubic-bezier(0.25, 0.8, 0.25, 1);
    pointer-events: none;
    will-change: transform, width;
  }

  /* 4 个 tab 均分轨道 */
  .ftab-item {
    position: relative;
    z-index: 1;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 100%;
    font-size: 10px;
    font-weight: 500;
    /* iOS 规则：未选中中灰，选中近黑 + 加粗，不再用蓝色 */
    color: #8e8e93;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.25s ease;
  }

  .ftab-item.is-active {
    color: #1c1c1e;
    font-weight: 600;
  }

  /* 选中态图标也略加重，跟文字一起"变实" */
  .ftab-item.is-active .ftab-icon {
    stroke-width: 2.1;
  }

  .ftab-icon-wrap {
    position: relative;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .ftab-item.is-active .ftab-icon-wrap {
    transform: translateY(-1px) scale(1.06);
  }

  .ftab-item:active .ftab-icon-wrap {
    transform: scale(0.9);
  }

  /* 路由切换 / Tab 切换时，新激活的图标弹一下 */
  .ftab-item.is-active .ftab-icon {
    animation: ftabPop 0.36s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes ftabPop {
    0% { transform: scale(0.78); }
    100% { transform: scale(1); }
  }

  /* 图标统一圆角线宽，颜色靠 currentColor 继承上面的 color */
  .ftab-icon {
    width: 20px;
    height: 20px;
    display: block;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .ftab-label {
    line-height: 1.1;
    white-space: nowrap;
  }

  /* 未读角标：自绘，避免在胶囊里再塞一个 UI 库组件。
     图标层只有 20px 高、没有 overflow 裁切，所以角标压住图标右上角即可，别溢出到胶囊外 */
  .ftab-badge {
    position: absolute;
    top: -4px;
    left: 12px;
    min-width: 15px;
    height: 15px;
    padding: 0 4px;
    border-radius: 8px;
    background: #ff3b30;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    line-height: 15px;
    text-align: center;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.9);
  }

  /* 整条栏进场/退场 */
  .ftab-rise-enter-active,
  .ftab-rise-leave-active {
    transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.25, 0.1, 0.25, 1);
  }

  .ftab-rise-enter-from,
  .ftab-rise-leave-to {
    opacity: 0;
    transform: translateY(120%);
  }
}
</style>
