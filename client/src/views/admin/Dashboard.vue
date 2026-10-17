<template>
  <div class="dashboard">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">数据看板</h1>
      <p class="page-subtitle">注册、商品、订单与成交额</p>
    </div>

    <!-- 顶部统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="(stat, index) in stats" :key="index">
        <div class="stat-icon" :style="{ background: stat.gradient }">
          <el-icon :size="20"><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stat-info">
          <!-- 趋势徽章跟数字贴在同一行，比单独怼在卡片右端更好读 -->
          <div class="stat-value-row">
            <span class="stat-value">{{ stat.value }}</span>
            <span
              v-if="stat.trend"
              class="stat-trend"
              :class="stat.trend > 0 ? 'trend-up' : 'trend-down'"
              :title="stat.trendTitle + (stat.trend > 0 ? '增长' : '下降') + Math.abs(Math.round(stat.trend * 10) / 10) + '%'"
            >{{ stat.trend > 0 ? '+' : '' }}{{ Math.round(stat.trend * 10) / 10 }}%</span>
          </div>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
      </div>
    </div>

    <!-- 关键状态一览：4 个可整块点击的紧凑指标，比原来的 2 个大卡信息密度高一倍 -->
    <div class="quick-grid">
      <button
        v-for="q in quickStats"
        :key="q.label"
        type="button"
        class="quick-card"
        :class="{ 'is-alert': q.alert }"
        @click="$router.push(q.path)"
      >
        <span class="quick-icon" :style="{ background: q.bg, color: q.color }">
          <el-icon :size="18"><component :is="q.icon" /></el-icon>
        </span>
        <span class="quick-info">
          <span class="quick-value">{{ q.value }}</span>
          <span class="quick-label">{{ q.label }}</span>
        </span>
        <el-icon class="quick-arrow" :size="14"><ArrowRight /></el-icon>
      </button>
    </div>

    <!-- 图表与分析区 -->
    <div class="analysis-grid">
      <!-- 分类商品占比 -->
      <div class="admin-card chart-card">
        <div class="card-header">
          <h3>分类商品占比</h3>
          <span class="card-desc">各分类下商品数量分布</span>
        </div>
        <div class="card-body">
          <div class="donut-wrap">
            <!-- conic-gradient 环形图：扇区角度严格按百分比计算，色块占比精确 -->
            <div class="donut-ring" :style="{ background: donutBackground }">
              <div class="donut-hole"></div>
              <div class="donut-center">
                <span class="donut-total">{{ totalCategoryCount }}</span>
                <span class="donut-unit">件商品</span>
              </div>
            </div>
          </div>
          <div class="donut-legend">
            <div class="legend-item" v-for="(item, i) in legendItems" :key="i">
              <span class="legend-dot" :style="{ background: item.color }"></span>
              <span class="legend-name">{{ item.name }}</span>
              <span class="legend-value">{{ item.count }}</span>
              <span class="legend-percent">{{ item.percent }}%</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 最近7天用户注册 -->
      <div class="admin-card chart-card">
        <div class="card-header">
          <h3>用户增长趋势</h3>
          <span class="card-desc">最近7天新用户注册量</span>
        </div>
        <div class="card-body">
          <div class="trend-chart">
            <svg class="trend-svg" viewBox="0 0 300 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(79, 70, 229, 0.25)" />
                  <stop offset="100%" stop-color="rgba(79, 70, 229, 0)" />
                </linearGradient>
              </defs>
              <path
                v-if="trendPath"
                :d="trendPath.area"
                fill="url(#trendFill)"
              />
              <path
                v-if="trendPath"
                :d="trendPath.line"
                fill="none"
                stroke="#4f46e5"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle
                v-for="(point, i) in trendPoints"
                :key="i"
                :cx="point.x"
                :cy="point.y"
                r="4"
                fill="#fff"
                stroke="#4f46e5"
                stroke-width="2"
              />
            </svg>
            <div class="trend-labels">
              <span v-for="item in data.recentUsers" :key="item.date">{{ formatDate(item.date) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getDashboard } from '@/api'
import {
  User,
  Goods,
  Document,
  Money,
  Clock,
  DocumentChecked,
  CircleCheck,
  ArrowRight
} from '@element-plus/icons-vue'
const data = ref({})

// 顶部统计卡片：数值来自后端，趋势统一为近7天增量 vs 7天前存量（不设100%上下限）
const stats = computed(() => [
  {
    icon: User,
    label: '注册用户',
    value: data.value.userCount || 0,
    gradient: 'linear-gradient(135deg, #4f46e5, #6366f1)',
    trend: data.value.trends?.users ?? 0,
    trendTitle: '近7天新增较7天前总数'
  },
  {
    icon: Goods,
    label: '商品总数',
    value: data.value.productCount || 0,
    gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
    trend: data.value.trends?.products ?? 0,
    trendTitle: '近7天新增较7天前总数'
  },
  {
    icon: Document,
    label: '订单总数',
    value: data.value.orderCount || 0,
    gradient: 'linear-gradient(135deg, #10b981, #34d399)',
    trend: data.value.trends?.orders ?? 0,
    trendTitle: '近7天新增较7天前总数'
  },
  {
    icon: Money,
    label: '累计成交额',
    value: `￥${data.value.totalSales || 0}`,
    gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
    trend: data.value.trends?.sales ?? 0,
    trendTitle: '近7天成交较7天前累计'
  }
])

// 饼图数据
const palette = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#64748b', '#06b6d4']
const totalCategoryCount = computed(() => {
  return (data.value.categoryStats || []).reduce((sum, c) => sum + c.count, 0)
})

// 关键状态一览：4 个可整块点击的指标。
// 「在售商品」= categoryStats 求和（后端就是按 status='on_sale' 聚合的），
// 「已完成订单」用后端已返回但原先没用上的 completedOrders。
// 待办类指标 > 0 时描边高亮，提示需要处理。
const quickStats = computed(() => [
  {
    icon: Clock,
    label: '待审核商品',
    value: data.value.pendingProducts || 0,
    bg: 'rgba(79, 70, 229, 0.1)',
    color: '#4f46e5',
    path: '/admin/products?status=pending',
    alert: Number(data.value.pendingProducts || 0) > 0
  },
  {
    icon: DocumentChecked,
    label: '待确认交易',
    value: data.value.pendingOrders || 0,
    bg: 'rgba(14, 165, 233, 0.12)',
    color: '#0ea5e9',
    path: '/admin/orders?status=pending',
    alert: Number(data.value.pendingOrders || 0) > 0
  },
  {
    icon: Goods,
    label: '在售商品',
    value: totalCategoryCount.value,
    bg: 'rgba(16, 185, 129, 0.12)',
    color: '#10b981',
    path: '/admin/products?status=on_sale',
    alert: false
  },
  {
    icon: CircleCheck,
    label: '已完成订单',
    value: data.value.completedOrders || 0,
    bg: 'rgba(245, 158, 11, 0.14)',
    color: '#d97706',
    path: '/admin/orders?status=completed',
    alert: false
  }
])

// 环形图：conic-gradient 按百分比精确着色（0 值分类不占色块，颜色与图例保持对应）
const donutBackground = computed(() => {
  const list = data.value.categoryStats || []
  const total = totalCategoryCount.value
  if (!total) return 'conic-gradient(#e5e7eb 0deg 360deg)'
  let acc = 0
  const stops = []
  list.forEach((cat, i) => {
    if (!cat.count) return
    const start = (acc / total) * 360
    acc += cat.count
    const end = (acc / total) * 360
    stops.push(`${palette[i % palette.length]} ${start}deg ${end}deg`)
  })
  if (!stops.length) return 'conic-gradient(#e5e7eb 0deg 360deg)'
  return `conic-gradient(${stops.join(', ')})`
})

const legendItems = computed(() => {
  const list = data.value.categoryStats || []
  return list.map((cat, i) => ({
    name: cat.name,
    count: cat.count,
    color: palette[i % palette.length],
    percent: totalCategoryCount.value ? Math.round((cat.count / totalCategoryCount.value) * 100) : 0
  }))
})

// 趋势图数据
const trendPoints = computed(() => {
  const list = data.value.recentUsers || []
  if (!list.length) return []
  const max = Math.max(...list.map(u => u.count), 1)
  const width = 300
  const height = 120
  const padding = 16
  const step = list.length > 1 ? (width - padding * 2) / (list.length - 1) : 0
  return list.map((item, i) => ({
    x: padding + step * i,
    y: height - padding - (item.count / max) * (height - padding * 2)
  }))
})

const trendPath = computed(() => {
  const points = trendPoints.value
  if (points.length < 2) return null

  // Cardinal/Catmull-Rom 风格 cubic bezier 平滑曲线，
  // tension 越小越平缓，过大容易过头；0.18 是经验舒适值
  const tension = 0.18
  const round = (n) => Math.round(n * 100) / 100

  let line = `M ${round(points[0].x)} ${round(points[0].y)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] || points[i + 1]
    const cp1x = p1.x + (p2.x - p0.x) * tension
    const cp1y = p1.y + (p2.y - p0.y) * tension
    const cp2x = p2.x - (p3.x - p1.x) * tension
    const cp2y = p2.y - (p3.y - p1.y) * tension
    line += ` C ${round(cp1x)} ${round(cp1y)}, ${round(cp2x)} ${round(cp2y)}, ${round(p2.x)} ${round(p2.y)}`
  }

  const last = points[points.length - 1]
  const first = points[0]
  const area = `${line} L ${last.x} 120 L ${first.x} 120 Z`
  return { line, area }
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

onMounted(async () => {
  try {
    const res = await getDashboard()
    data.value = res.data
  } catch (e) {}
})
</script>

<style scoped>
/* 顶部统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: var(--admin-card);
  border-radius: var(--admin-radius);
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  box-shadow: var(--admin-shadow);
  transition: all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.stat-card:hover {
  box-shadow: var(--admin-shadow-hover);
  transform: translateY(-4px);
}

.stat-icon {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.stat-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

/* 数值 + 趋势徽章同行 */
.stat-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--admin-text);
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.stat-label {
  font-size: 13px;
  color: var(--admin-text-secondary);
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stat-trend {
  flex: none;
  font-size: 11px;
  font-weight: 700;
}

.trend-up {
  color: #16a34a;
  background: rgba(22, 163, 74, 0.1);
  padding: 4px 8px;
  border-radius: 8px;
}

.trend-down {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
  padding: 4px 8px;
  border-radius: 8px;
}

/* 关键状态一览：4 个紧凑指标卡（整块可点，箭头提示可进入） */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 20px;
}

.quick-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  background: var(--admin-card);
  border: 1px solid var(--admin-border);
  border-radius: 16px;
  box-shadow: var(--admin-shadow);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
}

.quick-card:hover {
  box-shadow: var(--admin-shadow-hover);
  transform: translateY(-2px);
}

/* 有待办时描边高亮，扫一眼就知道要不要处理 */
.quick-card.is-alert {
  border-color: rgba(79, 70, 229, 0.35);
}

.quick-icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.quick-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.quick-value {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.15;
  color: var(--admin-text);
  letter-spacing: -0.02em;
}

.quick-label {
  font-size: 12px;
  color: var(--admin-text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.quick-arrow {
  color: var(--admin-text-tertiary);
  flex-shrink: 0;
}

/* 图表区 */
.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.chart-card .card-body {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.card-header {
  margin-bottom: 20px;
}

.card-header h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--admin-text);
}

.card-desc {
  display: block;
  font-size: 13px;
  color: var(--admin-text-secondary);
  margin-top: 4px;
}

/* 环形图：conic-gradient 实现，占比精确 */
.donut-ring {
  position: relative;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  flex-shrink: 0;
}

.donut-hole {
  position: absolute;
  inset: 32px;
  background: var(--admin-card);
  border-radius: 50%;
}

.donut-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.donut-total {
  font-size: 26px;
  font-weight: 800;
  color: var(--admin-text);
  line-height: 1;
}

.donut-unit {
  font-size: 12px;
  color: var(--admin-text-secondary);
  margin-top: 4px;
}

.donut-legend {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 160px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-name {
  flex: 1;
  color: var(--admin-text-secondary);
}

.legend-value {
  width: 28px;
  font-weight: 700;
  color: var(--admin-text);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.legend-percent {
  width: 42px;
  color: var(--admin-text-tertiary);
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

/* 趋势图 */
.trend-chart {
  width: 100%;
}

.trend-svg {
  width: 100%;
  height: 160px;
  overflow: visible;
}

.trend-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

/* 响应式 */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 992px) {
  .analysis-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  /* 移动端不再一列一个大卡：统计卡与状态卡都走 2 列。
     以前是单列，一屏只能看到 4 个数字，得滚半天才见到别的信息 */
  .stats-grid,
  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 12px;
  }

  .stat-card {
    align-items: center;
    gap: 10px;
    padding: 13px;
    border-radius: 16px;
  }

  .stat-icon {
    width: 34px;
    height: 34px;
    border-radius: 11px;
  }

  .stat-value {
    font-size: 19px;
  }

  .stat-label {
    font-size: 11px;
    margin-top: 2px;
  }

  .stat-trend {
    font-size: 10px;
  }

  .quick-card {
    padding: 12px 14px;
    gap: 10px;
    border-radius: 14px;
  }

  .quick-icon {
    width: 32px;
    height: 32px;
    border-radius: 10px;
  }

  .quick-value {
    font-size: 18px;
  }

  /* 手机上省掉箭头，给数字和标签让位 */
  .quick-arrow {
    display: none;
  }

  /* 图表区单列，并把留白收紧 */
  .analysis-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .card-header {
    margin-bottom: 14px;
  }

  .donut-ring {
    width: 140px;
    height: 140px;
  }

  .donut-hole {
    inset: 26px;
  }
}
</style>