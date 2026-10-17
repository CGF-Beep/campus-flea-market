import { ref } from 'vue'

/**
 * 底部 TabBar「返回顶部」态（京东那种）
 *
 * 场景：移动端页面滚过一定距离后，当前 Tab 的图标与文案变成「顶部」，
 * 点它回到页面顶部，而不是重新进这个页面。
 *
 * 为什么要有这个模块：TabBar 渲染在 Layout.vue、滚动则发生在页面组件里
 * （ProductList.vue），两者没有父子关系，需要一个模块级单例来通信。
 * 分工：页面负责写（滚到没滚到、怎么回顶），TabBar 负责读。
 *
 * 注意：handler 故意不做成 ref —— 它只是个函数引用，不需要响应式；
 * 页面在 onDeactivated / onBeforeUnmount 里 reset()，避免别的页面复用旧动作。
 */
const backTopVisible = ref(false)
let backTopHandler = null

export function useTabBackTop() {
  // 页面侧：告诉 TabBar 现在要不要切成「顶部」态
  const setVisible = (v) => {
    backTopVisible.value = !!v
  }

  // 页面侧：登记「回到顶部」的动作（一般是页面自己的 scrollToTop）
  const setHandler = (fn) => {
    backTopHandler = typeof fn === 'function' ? fn : null
  }

  // TabBar 侧：点了「顶部」时执行页面登记的动作
  const run = () => {
    if (backTopHandler) backTopHandler()
  }

  // 页面侧：离开页面时清干净（图标文案回到正常、动作失效）
  const reset = () => {
    backTopVisible.value = false
    backTopHandler = null
  }

  return { backTopVisible, setVisible, setHandler, run, reset }
}
