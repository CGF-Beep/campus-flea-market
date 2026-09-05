import { ref, nextTick } from 'vue'

/**
 * Tab 滑块跟随动画
 * 用法：
 * 1. 给 tab 容器加 ref="containerRef"
 * 2. 给每个 tab 按钮加 data-tab-item
 * 3. 在容器内放一个绝对定位的 slider 元素，:style="sliderStyle"
 * 4. 调用 updateSlider(activeIndex) 更新位置
 */
export function useTabSlider() {
  const containerRef = ref(null)
  const sliderStyle = ref({
    width: '0px',
    height: '0px',
    transform: 'translateX(0px) translateY(0px)',
    opacity: '0'
  })

  const updateSlider = async (activeIndex) => {
    await nextTick()
    if (!containerRef.value) return
    const items = containerRef.value.querySelectorAll('[data-tab-item]')
    const item = items[activeIndex]
    if (!item) {
      sliderStyle.value.opacity = '0'
      return
    }
    const containerRect = containerRef.value.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    sliderStyle.value = {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${itemRect.width}px`,
      height: `${itemRect.height}px`,
      transform: `translateX(${itemRect.left - containerRect.left}px) translateY(${itemRect.top - containerRect.top}px)`,
      opacity: '1',
      pointerEvents: 'none',
      zIndex: '0'
    }
  }

  return { containerRef, sliderStyle, updateSlider }
}
