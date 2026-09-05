<!-- 智能图片组件：图片加载失败时显示随机渐变色+emoji占位 -->
<template>
  <div class="smart-image" :style="placeholderStyle">
    <img
      v-if="displaySrc && !error"
      :src="displaySrc"
      :alt="alt"
      class="img"
      loading="lazy"
      decoding="async"
      @error="handleError"
    />
    <div v-else class="placeholder" :style="placeholderStyle">
      <span class="placeholder-emoji">{{ emoji }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  emoji: { type: String, default: '📦' },
  gradient: { type: String, default: '' },
  // 是否使用缩略图：列表页默认 true（更快），详情页主图传 false 用全图
  thumb: { type: Boolean, default: true }
})

const error = ref(false)
const triedFull = ref(false)

const gradients = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #667eea 0%, #4facfe 100%)'
]

const randomGradient = gradients[Math.floor(Math.random() * gradients.length)]

const placeholderStyle = computed(() => ({
  background: props.gradient || randomGradient
}))

// 由全图路径推算缩略图路径：/uploads/xxx.webp -> /uploads/thumbs/xxx.webp
const thumbSrc = computed(() => {
  if (!props.src) return ''
  if (props.src.startsWith('/uploads/')) {
    return props.src.replace('/uploads/', '/uploads/thumbs/')
  }
  return props.src
})

// 实际展示的图：优先缩略图；缩略图加载失败自动回退全图；全图也失败才显示占位
const displaySrc = computed(() => {
  if (error.value) return ''
  if (props.thumb && !triedFull.value) return thumbSrc.value
  return props.src
})

const handleError = () => {
  if (props.thumb && !triedFull.value && thumbSrc.value !== props.src) {
    triedFull.value = true // 缩略图挂了，回退到全图再试一次
  } else {
    error.value = true // 全图也失败，显示占位
  }
}
</script>

<style scoped>
.smart-image {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.placeholder-emoji {
  font-size: 48px;
  opacity: 0.9;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
}
</style>
