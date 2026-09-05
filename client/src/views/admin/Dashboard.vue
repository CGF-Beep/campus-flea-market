<template>
  <div class="dashboard">
    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">数据看板</h1>
      <p class="page-subtitle">校园闲置二手平台运营概览 ( 增速对比数据为环比总数 )</p>
    </div>

    <!-- 顶部统计卡片 -->
    <div class="stats-grid">
      <div class="stat-card" v-for="(stat, index) in stats" :key="index">
        <div class="stat-icon" :style="{ background: stat.gradient }">
          <el-icon :size="22"><component :is="stat.icon" /></el-icon>
        </div>
        <div class="stat-info">
          <span class="stat-value">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </div>
        <div class="stat-trend" v-if="stat.trend" :title="stat.trendTitle + (stat.trend > 0 ? '增长' : '下降') + Math.abs(Math.round(stat.trend * 10) / 10) + '%'">
          <span :class="stat.trend > 0 ? 'trend-up' : 'trend-down'">
            {{ stat.trend > 0 ? '+' : '' }}{{ Math.round(stat.trend * 10) / 10 }}%
          </span>
        </div>
      </div>
    </div>

    <!-- 中间快捷指标 -->
    <div class="quick-grid">
      <div class="quick-card warning">
        <div class="quick-body">
          <div class="quick-icon">
            <el-icon :size="26"><Clock /></el-icon>
          </div>
          <div class="quick-info">
            <span class="quick-value">{{ data.pendingProducts || 0 }}</span>
            <span class="quick-label">待审核商品</span>
          </div>
        </div>
        <button class="quick-action" @click="$router.push('/admin/products?status=pending')">
          去审核 <el-icon :size="14"><ArrowRight /></el-icon>
        </button>
      </div>

      <div class="quick-card info">
        <div class="quick-body">
          <div class="quick-icon">
            <el-icon :size="26"><DocumentChecked /></el-icon>
          </div>
          <div class="quick-info">
            <span class="quick-value">{{ data.pendingOrders || 0 }}</span>
            <span class="quick-label">待确认交易</span>
          </div>
        </div>
        <button class="quick-action" @click="$router.push('/admin/orders?status=pending')">
          去查看 <el-icon :size="14"><ArrowRight /></el-icon>
        </button>
      </div>
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
  const line = points.reduce((path, p, i) => {
    return path + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`)
  }, '')
  const area = `${line} L ${points[points.length - 1].x} 120 L ${points[0].x} 120 Z`
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

.stat-value {
  font-size: 24px;
  font-weight: 800;
  color: var(--admin-text);
  letter-spacing: -0.02em;
}

.stat-label {
  font-size: 13px;
  color: var(--admin-text-secondary);
  margin-top: 2px;
}

.stat-trend {
  font-size: 12px;
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

/* 快捷指标 */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.quick-card {
  background: var(--admin-card);
  border-radius: var(--admin-radius);
  padding: 24px;
  box-shadow: var(--admin-shadow);
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.35s ease;
}

.quick-card:hover {
  box-shadow: var(--admin-shadow-hover);
  transform: translateY(-3px);
}

.quick-body {
  display: flex;
  align-items: center;
  gap: 16px;
}

.quick-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.quick-card.warning .quick-icon {
  background: linear-gradient(135deg, #4f46e5, #6366f1);
}

.quick-card.info .quick-icon {
  background: linear-gradient(135deg, #0ea5e9, #38bdf8);
}

.quick-info {
  display: flex;
  flex-direction: column;
}

.quick-value {
  font-size: 32px;
  font-weight: 800;
  color: var(--admin-text);
}

.quick-label {
  font-size: 14px;
  color: var(--admin-text-secondary);
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: var(--admin-primary-light);
  color: var(--admin-primary);
  padding: 10px 18px;
  border-radius: 980px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s ease;
}

.quick-action:hover {
  background: var(--admin-primary);
  color: #fff;
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
  .stats-grid,
  .quick-grid {
    grid-template-columns: 1fr;
  }
}
</style>