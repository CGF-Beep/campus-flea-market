<template>
  <div class="admin-page">
    <div class="page-header">
      <h2 class="page-title">访问分析</h2>
      <p class="page-subtitle">
        访客来源、设备、地区与访问行为统计
        <span class="sub-hint">
          IP归属地基于运营商网段判定，仅精确到省市级，受校园网出口、移动流量等因素影响可能存在偏差，后台自身访问不计入统计。
        </span>
      </p>
    </div>

    <div class="visit-body" v-loading="loading">
      <!-- 工具条 -->
      <div class="toolbar">
        <div class="seg">
          <button
            v-for="item in RANGES"
            :key="item.value"
            class="seg-btn"
            :class="{ active: range === item.value }"
            @click="switchRange(item.value)"
          >{{ item.label }}</button>
        </div>

        <label class="bot-toggle">
          <input type="checkbox" v-model="includeBots" @change="loadAll" />
          <span>含爬虫</span>
        </label>

        <div class="toolbar-right">
          <button class="btn-ghost mini" @click="loadAll">刷新</button>
          <button class="btn-ghost mini" @click="openClean">清理明细</button>
        </div>
      </div>

      <!-- 指标卡 -->
      <div class="metric-grid">
        <div class="metric-card">
          <span class="metric-label">浏览量 PV</span>
          <span class="metric-value">{{ overview.pv }}</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">独立访客 UV</span>
          <span class="metric-value">{{ overview.uv }}</span>
          <span class="metric-note">按日去重，跨天不合并</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">会话数</span>
          <span class="metric-value">{{ overview.sessions }}</span>
          <span class="metric-note">30 分钟无活动算一次新会话</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">跳出率</span>
          <span class="metric-value">{{ overview.bounceRate }}%</span>
          <span class="metric-note">只看了 1 页就离开</span>
        </div>
        <div class="metric-card">
          <span class="metric-label">平均停留</span>
          <span class="metric-value small">{{ fmtDuration(overview.avgDuration) }}</span>
          <span class="metric-note">单次会话时长</span>
        </div>
        <div class="metric-card">
          <span class="metric-label"><i class="live-dot"></i>实时在线</span>
          <span class="metric-value">{{ overview.online }}</span>
          <span class="metric-note">最近 5 分钟有活动</span>
        </div>
      </div>

      <!-- 趋势 + 来源渠道 -->
      <div class="grid-2">
        <div class="visit-card">
          <div class="card-head">
            <h3>访问趋势</h3>
            <div class="legend">
              <span class="legend-item"><i class="line-solid"></i>PV</span>
              <span class="legend-item"><i class="line-dash"></i>UV</span>
            </div>
          </div>
          <div class="chart-wrap">
            <svg v-if="trendPath" class="trend-svg" viewBox="0 0 600 160" preserveAspectRatio="none">
              <defs>
                <linearGradient id="visitTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(79, 70, 229, 0.22)" />
                  <stop offset="100%" stop-color="rgba(79, 70, 229, 0)" />
                </linearGradient>
              </defs>
              <path v-if="trendPath.pv.area" :d="trendPath.pv.area" fill="url(#visitTrendFill)" />
              <path
                :d="trendPath.pv.line"
                fill="none"
                stroke="#4f46e5"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                vector-effect="non-scaling-stroke"
              />
              <path
                :d="trendPath.uv.line"
                fill="none"
                stroke="#10b981"
                stroke-width="2"
                stroke-dasharray="5 4"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
              />
            </svg>
            <div v-else class="chart-empty">暂无数据</div>
            <div v-if="trendPath" class="trend-axis">
              <span v-for="(item, i) in trendAxis" :key="i" :style="{ left: item.left }">{{ item.text }}</span>
            </div>
          </div>
        </div>

        <div class="visit-card">
          <div class="card-head">
            <h3>来源渠道</h3>
            <span class="card-desc">按会话数</span>
          </div>
          <div v-if="sources.length" class="bar-list">
            <div v-for="item in sources" :key="item.name" class="bar-row">
              <div class="bar-top">
                <span class="bar-name">{{ item.name }}</span>
                <span class="bar-value">{{ item.sessions }} <em>次</em></span>
              </div>
              <div class="bar-track"><div class="bar-fill" :style="{ width: pct(item.sessions, sources) }"></div></div>
            </div>
          </div>
          <div v-else class="card-empty">暂无数据</div>
        </div>
      </div>

      <!-- 设备分布 + 关键页面到达 -->
      <div class="grid-2">
        <div class="visit-card">
          <div class="card-head">
            <h3>设备与系统</h3>
            <span class="card-desc">按会话数</span>
          </div>
          <div class="device-groups">
            <div class="device-group">
              <span class="group-title">设备类型</span>
              <div class="chip-row">
                <span v-for="item in devices.device" :key="item.name" class="chip">
                  {{ item.name }}<em>{{ item.count }}</em>
                </span>
                <span v-if="!devices.device.length" class="card-empty">暂无数据</span>
              </div>
            </div>
            <div class="device-group">
              <span class="group-title">操作系统</span>
              <div class="chip-row">
                <span v-for="item in devices.os" :key="item.name" class="chip">
                  {{ item.name }}<em>{{ item.count }}</em>
                </span>
                <span v-if="!devices.os.length" class="card-empty">暂无数据</span>
              </div>
            </div>
            <div class="device-group">
              <span class="group-title">浏览器</span>
              <div class="chip-row">
                <span v-for="item in devices.browser" :key="item.name" class="chip">
                  {{ item.name }}<em>{{ item.count }}</em>
                </span>
                <span v-if="!devices.browser.length" class="card-empty">暂无数据</span>
              </div>
            </div>
            <div class="device-group">
              <span class="group-title">机型 Top</span>
              <div class="chip-row">
                <span
                  v-for="item in devices.model"
                  :key="item.code"
                  class="chip"
                  :class="{ 'chip-editable': !item.aliased, 'chip-named': item.aliased }"
                  @click="openAlias(item)"
                >
                  {{ item.label }}<em>{{ item.count }}</em>
                  <i v-if="!item.aliased" class="chip-edit">命名</i>
                </span>
                <span v-if="!devices.model || !devices.model.length" class="card-empty">暂无数据</span>
              </div>
            </div>
          </div>
        </div>

        <div class="visit-card">
          <div class="card-head">
            <h3>地区分布</h3>
            <span class="card-desc">按会话数 · 离线库判定</span>
          </div>
          <div v-if="regions.length" class="bar-list">
            <div v-for="item in regions" :key="item.name" class="bar-row">
              <div class="bar-top">
                <span class="bar-name">{{ item.name }}</span>
                <span class="bar-value">{{ item.sessions }} <em>次</em></span>
              </div>
              <div class="bar-track"><div class="bar-fill" :style="{ width: pct(item.sessions, regions) }"></div></div>
              <span v-if="item.cities.length" class="bar-sub">{{ item.cities.join(' · ') }}</span>
            </div>
          </div>
          <div v-else class="card-empty">暂无数据</div>
        </div>
      </div>

      <!-- 热门页面 + 实时访问 -->
      <div class="grid-2">
        <div class="visit-card">
          <div class="card-head">
            <h3>热门页面</h3>
            <span class="card-desc">按浏览量 · 前 8 位</span>
          </div>
          <div v-if="topPages.length" class="bar-list">
            <div v-for="item in topPages" :key="item.path" class="bar-row">
              <div class="bar-top">
                <span class="bar-name mono">{{ item.path }}</span>
                <span class="bar-value">{{ item.views }} <em>次</em></span>
              </div>
              <div class="bar-track"><div class="bar-fill alt" :style="{ width: pct(item.views, topPages, 'views') }"></div></div>
            </div>
          </div>
          <div v-else class="card-empty">暂无数据</div>
        </div>

        <div class="visit-card">
          <div class="card-head">
            <h3>关键页面到达</h3>
            <span class="card-desc">到过该步骤的会话数</span>
          </div>
          <div v-if="funnel.length" class="funnel">
            <div v-for="(item, i) in funnel" :key="item.label" class="funnel-row">
              <div class="funnel-bar" :style="{ width: funnelWidth(item.value, i) }">
                <span class="funnel-label">{{ item.label }}</span>
                <span class="funnel-value">{{ item.value }}</span>
              </div>
              <span v-if="i > 0" class="funnel-rate">{{ funnelRate(item.value, i) }}</span>
            </div>
          </div>
          <div v-else class="card-empty">暂无数据</div>
        </div>
      </div>

      <!-- 实时访问：信息多，单独占满一行 -->
      <div class="visit-card">
        <div class="card-head">
          <h3>实时访问</h3>
          <span class="card-desc">最近 5 分钟有活动的访客</span>
        </div>
        <div v-if="realtime.length" class="live-list">
          <div v-for="item in realtime" :key="item.id" class="live-row">
            <span class="live-time">{{ fmtClock(item.lastActiveAt) }}</span>
            <div class="live-ip">
              <span class="mono">{{ item.ip || '—' }}</span>
              <span class="cell-muted">{{ item.location || '—' }}</span>
            </div>
            <div class="live-main">
              <span class="live-path">{{ item.currentPath || '—' }}</span>
              <span class="live-meta">{{ deviceLabel(item) }} · {{ item.os || '未知' }} · {{ item.browser || '未知' }}</span>
            </div>
            <span class="live-pages">{{ item.pageviews }} 页 · {{ fmtDuration(item.duration) }}</span>
            <span class="live-user" :class="{ anon: !item.user }">{{ item.user ? item.user.name : '未登录' }}</span>
          </div>
        </div>
        <div v-else class="card-empty">当前没有在线访客</div>
      </div>

      <!-- 访问明细 -->
      <div class="visit-card table-card">
        <div class="card-head">
          <h3>访问明细</h3>
          <div class="table-tools">
            <input
              v-model="keyword"
              class="search-input"
              type="text"
              placeholder="搜索 IP / 地区 / 路径 / 浏览器"
              @keyup.enter="searchSessions"
            />
            <button class="btn-ghost mini" @click="searchSessions">搜索</button>
          </div>
        </div>

        <div class="table-wrap">
          <el-table :data="sessions" v-loading="tableLoading" class="apple-table" height="100%">
            <el-table-column label="时间" width="118">
              <template #default="{ row }">{{ fmtDateTime(row.startedAt) }}</template>
            </el-table-column>
            <el-table-column label="IP / 归属地" min-width="182">
              <template #default="{ row }">
                <div class="cell-2line">
                  <span class="mono">{{ row.ip || '—' }}</span>
                  <span class="cell-muted">{{ row.location || '—' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="用户" width="96">
              <template #default="{ row }">
                <span v-if="row.user">{{ row.user.name }}</span>
                <span v-else class="cell-muted">未登录</span>
              </template>
            </el-table-column>
            <el-table-column label="设备" min-width="150">
              <template #default="{ row }">
                <div class="cell-2line">
                  <span>{{ deviceLabel(row) }}</span>
                  <span class="cell-muted">{{ row.os || '未知' }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="浏览器" width="110">
              <template #default="{ row }">{{ row.browser || '未知' }}</template>
            </el-table-column>
            <el-table-column label="来源" width="100">
              <template #default="{ row }">
                <span class="status-pill" :class="channelPill(row.sourceChannel)">{{ row.sourceChannel }}</span>
              </template>
            </el-table-column>
            <el-table-column label="页数 / 停留" width="106">
              <template #default="{ row }">
                <div class="cell-2line">
                  <span>{{ row.pageviews }} 页</span>
                  <span class="cell-muted">{{ fmtDuration(row.duration) }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="路径" min-width="200">
              <template #default="{ row }">
                <div class="cell-2line">
                  <span class="mono">{{ row.entryPath || '—' }}</span>
                  <span class="cell-muted mono">{{ row.exitPath && row.exitPath !== row.entryPath ? `→ ${row.exitPath}` : '' }}</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- 移动端卡片列表（≤768 显示，桌面隐藏） -->
        <div class="mobile-list">
          <div v-for="row in sessions" :key="row.id" class="m-card">
            <div class="m-head">
              <span class="m-ip mono">{{ row.ip || '—' }}</span>
              <span class="status-pill" :class="channelPill(row.sourceChannel)">{{ row.sourceChannel }}</span>
              <span class="m-time">{{ fmtClock(row.startedAt) }}</span>
            </div>
            <div class="m-grid">
              <div class="m-cell"><span class="m-label">归属地</span><span class="m-value">{{ row.location || '—' }}</span></div>
              <div class="m-cell"><span class="m-label">用户</span><span class="m-value">{{ row.user ? row.user.name : '未登录' }}</span></div>
              <div class="m-cell"><span class="m-label">设备</span><span class="m-value">{{ deviceLabel(row) }} · {{ row.os || '未知' }}</span></div>
              <div class="m-cell"><span class="m-label">浏览器</span><span class="m-value">{{ row.browser || '未知' }}</span></div>
              <div class="m-cell"><span class="m-label">页数 / 停留</span><span class="m-value">{{ row.pageviews }} 页 · {{ fmtDuration(row.duration) }}</span></div>
              <div class="m-cell wide"><span class="m-label">入口</span><span class="m-value mono">{{ row.entryPath || '—' }}</span></div>
              <div class="m-cell wide"><span class="m-label">出口</span><span class="m-value mono">{{ row.exitPath || '—' }}</span></div>
            </div>
          </div>
          <el-empty v-if="!tableLoading && !sessions.length" description="暂无访问记录" :image-size="90" />
        </div>

        <div class="pagination">
          <el-pagination
            v-model:current-page="page"
            :total="total"
            :page-size="PAGE_SIZE"
            layout="prev, pager, next, total"
            background
            @current-change="loadSessions"
          />
        </div>
      </div>
    </div>

    <!-- 清理明细：自绘弹窗，不用 Element Plus 默认弹窗 -->
    <transition name="clean-fade">
      <div v-if="showClean" class="clean-mask" @click.self="closeClean">
        <div class="clean-dialog">
          <button class="clean-close" type="button" aria-label="关闭" @click="closeClean">
            <el-icon :size="15"><Close /></el-icon>
          </button>

          <h3 class="clean-title">清理访问明细</h3>
          <p class="clean-sub">先选时间范围，可选再叠加用户或 IP 条件。删除后无法恢复。</p>

          <div class="clean-block">
            <span class="clean-label">时间范围</span>
            <div class="preset-row">
              <button
                v-for="item in CLEAN_PRESETS"
                :key="item.value"
                type="button"
                class="preset-btn"
                :class="{ active: cleanForm.timePreset === item.value, wipe: item.value === 'all' }"
                @click="setCleanPreset(item.value)"
              >{{ item.label }}</button>
            </div>
          </div>

          <div v-if="cleanForm.timePreset === 'custom'" class="clean-block">
            <span class="clean-label">自定义日期（含结束当天，按北京时间）</span>
            <div class="date-row">
              <input v-model="cleanForm.startDate" class="date-input" type="date" @change="loadCleanPreview" />
              <span class="date-sep">至</span>
              <input v-model="cleanForm.endDate" class="date-input" type="date" @change="loadCleanPreview" />
            </div>
          </div>

          <div class="clean-block">
            <span class="clean-label">附加条件（可选）</span>
            <input
              v-model="cleanForm.ip"
              class="clean-input"
              type="text"
              placeholder="IP 或 IP 段，如 223.104."
              @input="schedulePreview"
            />
            <input
              v-model="cleanForm.userKeyword"
              class="clean-input"
              type="text"
              placeholder="用户名 / 昵称 / 学号"
              @input="schedulePreview"
            />
            <span class="clean-tip">IP 支持前缀：填 <code>223.104.</code> 会清掉整个网段的记录</span>
          </div>

          <div class="clean-preview" :class="{ wipe: isWipeAll }">
            <span v-if="previewLoading">正在统计…</span>
            <span v-else-if="previewError" class="preview-error">{{ previewError }}</span>
            <span v-else>
              将删除 <strong>{{ cleanPreview.sessions }}</strong> 条会话、<strong>{{ cleanPreview.events }}</strong> 条浏览记录
            </span>
          </div>

          <p v-if="isWipeAll && !previewError" class="clean-warn">
            这是「清空全部」，会把所有历史访问明细一起删掉。
          </p>

          <div class="clean-actions">
            <button class="clean-btn ghost" type="button" @click="closeClean">取消</button>
            <button
              class="clean-btn danger"
              type="button"
              :disabled="deleting || previewLoading || !!previewError"
              @click="confirmClean"
            >{{ deleting ? '清理中…' : '确定删除' }}</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- 机型命名：自绘弹窗，沿用清理弹窗的视觉语言 -->
    <transition name="clean-fade">
      <div v-if="showAlias" class="clean-mask" @click.self="closeAlias">
        <div class="clean-dialog">
          <button class="clean-close" type="button" aria-label="关闭" @click="closeAlias">
            <el-icon :size="15"><Close /></el-icon>
          </button>

          <h3 class="clean-title">{{ aliasForm.aliased ? '修改机型名称' : '命名这个机型' }}</h3>
          <p class="clean-sub">
            手机厂商只在 UA 里写型号代码、不写机型名，所以需要你命名一次。命名后所有地方都用这个名字显示，且对历史记录同样生效。
          </p>

          <div class="alias-code">
            <div>
              <span class="alias-code-label">型号代码</span>
              <span class="alias-code-value mono">{{ aliasForm.code }}</span>
            </div>
            <span class="alias-code-count">出现在 {{ aliasForm.count }} 次访问中</span>
          </div>

          <input
            v-model="aliasForm.alias"
            class="clean-input alias-input"
            type="text"
            placeholder="请输入机型名称，如「小米 13」"
            @keyup.enter="confirmAlias(false)"
          />
          <span class="clean-tip">
            不知道是哪款？
            <a class="alias-search" :href="aliasSearchUrl" target="_blank" rel="noopener">搜索这个型号</a>
          </span>

          <button
            v-if="aliasForm.aliased"
            class="alias-remove"
            type="button"
            :disabled="aliasSaving"
            @click="confirmAlias(true)"
          >取消命名（恢复显示原始代码）</button>

          <div class="clean-actions">
            <button class="clean-btn ghost" type="button" @click="closeAlias">取消</button>
            <button class="clean-btn primary" type="button" :disabled="aliasSaving" @click="confirmAlias(false)">
              {{ aliasSaving ? '保存中…' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Close } from '@element-plus/icons-vue'
import {
  getVisitOverview,
  getVisitSources,
  getVisitDevices,
  getVisitPages,
  getVisitRegions,
  getVisitRealtime,
  getVisitSessions,
  getVisitCleanPreview,
  cleanVisitLogs,
  saveVisitAlias
} from '@/api'

const RANGES = [
  { value: 'today', label: '今天' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' }
]
const PAGE_SIZE = 10
const CHART_W = 600
const CHART_H = 160
const CHART_PAD = 18

const range = ref('7d')
const includeBots = ref(false)
const loading = ref(false)
const tableLoading = ref(false)

const overview = ref({ pv: 0, uv: 0, sessions: 0, bounceRate: 0, avgDuration: 0, online: 0, trends: [], funnel: [] })
const sources = ref([])
const devices = ref({ device: [], os: [], browser: [], model: [] })
const pages = ref([])
// 热门页面只展示前 8 位（接口按浏览量倒序返回，直接截断即可）。
// 进度条宽度也按这个截断后的列表算最大值 —— 榜首仍在里面，占比不受影响。
const TOP_PAGE_LIMIT = 8
const topPages = computed(() => pages.value.slice(0, TOP_PAGE_LIMIT))
const regions = ref([])
const realtime = ref([])
const sessions = ref([])
const page = ref(1)
const total = ref(0)
const keyword = ref('')

const funnel = computed(() => overview.value.funnel || [])

// ---------- 格式化 ----------
const pad2 = (n) => String(n).padStart(2, '0')
const fmtDateTime = (d) => {
  if (!d) return '—'
  const t = new Date(d)
  return `${pad2(t.getMonth() + 1)}-${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`
}
const fmtClock = (d) => {
  if (!d) return '—'
  const t = new Date(d)
  return `${pad2(t.getHours())}:${pad2(t.getMinutes())}`
}
const fmtDuration = (s) => {
  const n = Math.max(0, Math.round(Number(s) || 0))
  if (n < 60) return `${n} 秒`
  const m = Math.floor(n / 60)
  if (m < 60) return `${m} 分 ${n % 60} 秒`
  return `${Math.floor(m / 60)} 时 ${m % 60} 分`
}

/** 设备显示名由后端统一算好（别名 > 品牌+型号 > 型号 > 设备类型），这里只做兜底 */
const deviceLabel = (row) => {
  if (row.label) return row.label
  const type = row.device || '未知'
  const model = row.deviceModel
  return model && model !== type ? `${type} · ${model}` : type
}

// ---------- 分布条 ----------
/** 相对最大值取百分比：看板里看的是「谁占大头」，绝对百分比反而不好读 */
const pct = (value, list, key = 'sessions') => {
  const max = Math.max(...list.map((i) => Number(i[key]) || 0), 1)
  return `${Math.round((Number(value) || 0) / max * 100)}%`
}
const funnelWidth = (value, index) => {
  const first = funnel.value[0]?.value || 1
  return `${Math.max(18, Math.round((Number(value) || 0) / first * 100))}%`
}
const funnelRate = (value, index) => {
  const prev = funnel.value[index - 1]?.value || 0
  if (!prev) return ''
  return `${Math.round((Number(value) || 0) / prev * 100)}%`
}
const channelPill = (channel) => {
  if (!channel) return 'pill-gray'
  if (channel.indexOf('微信') === 0) return 'pill-success'
  if (channel === '直接访问') return 'pill-blue'
  if (channel === '搜索引擎') return 'pill-warning'
  return 'pill-gray'
}

// ---------- 趋势图 ----------
const trendPath = computed(() => {
  const list = overview.value.trends || []
  if (list.length < 2) return null
  const max = Math.max(...list.map((i) => Math.max(Number(i.pv) || 0, Number(i.uv) || 0)), 1)
  const step = (CHART_W - CHART_PAD * 2) / (list.length - 1)
  const yOf = (v) => CHART_H - CHART_PAD - ((Number(v) || 0) / max) * (CHART_H - CHART_PAD * 2)
  const pointsOf = (key) => list.map((item, i) => ({ x: CHART_PAD + step * i, y: yOf(item[key]) }))
  return {
    pv: buildPath(pointsOf('pv'), true),
    uv: buildPath(pointsOf('uv'), false)
  }
})

const trendAxis = computed(() => {
  const list = overview.value.trends || []
  if (list.length < 2) return []
  const step = (CHART_W - CHART_PAD * 2) / (list.length - 1)
  // 每 3 个点标一个，避免 14 个标签挤在一起
  return list
    .map((item, i) => ({ text: item.date, x: CHART_PAD + step * i, i }))
    .filter((p) => p.i % 3 === 0 || p.i === list.length - 1)
    .map((p) => ({ text: p.text, left: `${(p.x / CHART_W * 100).toFixed(2)}%` }))
})

/** Catmull-Rom 风格的平滑贝塞尔；与数据看板里的曲线保持同一套算法 */
function buildPath(points, withArea) {
  if (points.length < 2) return { line: '', area: null }
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
  if (!withArea) return { line, area: null }
  const last = points[points.length - 1]
  const area = `${line} L ${round(last.x)} ${CHART_H - CHART_PAD} L ${round(points[0].x)} ${CHART_H - CHART_PAD} Z`
  return { line, area }
}

// ---------- 数据加载 ----------
const queryParams = () => ({ range: range.value, includeBots: includeBots.value ? '1' : '0' })

const loadRealtime = async () => {
  try {
    const res = await getVisitRealtime()
    realtime.value = res.data || []
  } catch (e) {}
}

const loadSessions = async () => {
  tableLoading.value = true
  try {
    const res = await getVisitSessions({
      ...queryParams(),
      page: page.value,
      pageSize: PAGE_SIZE,
      keyword: keyword.value
    })
    sessions.value = res.data.list
    total.value = res.data.total
  } catch (e) {} finally {
    tableLoading.value = false
  }
}

const loadAll = async () => {
  loading.value = true
  const params = queryParams()
  try {
    const [ov, src, dev, pg, rg] = await Promise.all([
      getVisitOverview(params),
      getVisitSources(params),
      getVisitDevices(params),
      getVisitPages(params),
      getVisitRegions(params)
    ])
    overview.value = ov.data
    sources.value = src.data || []
    devices.value = dev.data || { device: [], os: [], browser: [], model: [] }
    pages.value = pg.data || []
    regions.value = rg.data || []
  } catch (e) {} finally {
    loading.value = false
  }
  loadRealtime()
  loadSessions()
}

const switchRange = (value) => {
  if (range.value === value) return
  range.value = value
  page.value = 1
  loadAll()
}

const searchSessions = () => {
  page.value = 1
  loadSessions()
}

// ---------- 清理明细 ----------
const CLEAN_PRESETS = [
  { value: 'today', label: '今天' },
  { value: '7d', label: '近 7 天' },
  { value: '30d', label: '近 30 天' },
  { value: '90d', label: '近 90 天' },
  { value: 'custom', label: '自定义' },
  { value: 'all', label: '全部' }
]

const showClean = ref(false)
const deleting = ref(false)
const previewLoading = ref(false)
const previewError = ref('')
const cleanPreview = ref({ sessions: 0, events: 0 })
const cleanForm = ref({ timePreset: '90d', startDate: '', endDate: '', ip: '', userKeyword: '' })
let previewTimer = null

// 「全部」且没给任何附加条件 = 清空整张表，单独拉出来做更强的警告
const isWipeAll = computed(
  () =>
    cleanForm.value.timePreset === 'all' &&
    !cleanForm.value.ip.trim() &&
    !cleanForm.value.userKeyword.trim()
)

const cleanParams = (withConfirm = false) => {
  const f = cleanForm.value
  const p = { timePreset: f.timePreset }
  if (f.timePreset === 'custom') {
    if (f.startDate) p.startDate = f.startDate
    if (f.endDate) p.endDate = f.endDate
  }
  if (f.ip.trim()) p.ip = f.ip.trim()
  if (f.userKeyword.trim()) p.userKeyword = f.userKeyword.trim()
  // 「清空全部」必须带这个参数后端才肯执行，防止误删
  if (withConfirm && isWipeAll.value) p.confirmAll = '1'
  return p
}

const loadCleanPreview = async () => {
  previewError.value = ''
  previewLoading.value = true
  try {
    const res = await getVisitCleanPreview(cleanParams())
    cleanPreview.value = res.data || { sessions: 0, events: 0 }
  } catch (e) {
    // 请求拦截器已经弹出过错误提示，这里把预览归零并标记为不可提交
    cleanPreview.value = { sessions: 0, events: 0 }
    previewError.value = (e && e.message) || '条件不合法，请检查后重试'
  } finally {
    previewLoading.value = false
  }
}

/** 输入时防抖：不然每敲一个字符都会打一次接口 */
const schedulePreview = () => {
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(loadCleanPreview, 450)
}

const fmtDate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

const openClean = () => {
  cleanForm.value = { timePreset: '90d', startDate: '', endDate: '', ip: '', userKeyword: '' }
  cleanPreview.value = { sessions: 0, events: 0 }
  previewError.value = ''
  showClean.value = true
  loadCleanPreview()
}

const closeClean = () => {
  if (deleting.value) return
  showClean.value = false
  if (previewTimer) clearTimeout(previewTimer)
}

const setCleanPreset = (value) => {
  cleanForm.value.timePreset = value
  if (value === 'custom' && !cleanForm.value.startDate) {
    // 给个合理默认值：近 30 天，省得用户从空白开始点
    const today = new Date()
    cleanForm.value.endDate = fmtDate(today)
    cleanForm.value.startDate = fmtDate(new Date(today.getTime() - 29 * 86400000))
  }
  loadCleanPreview()
}

const confirmClean = async () => {
  if (previewError.value || deleting.value) return
  deleting.value = true
  try {
    const res = await cleanVisitLogs(cleanParams(true))
    ElMessage.success(res.message || '已清理')
    showClean.value = false
    page.value = 1
    loadAll()
  } catch (e) {
  } finally {
    deleting.value = false
  }
}

// ---------- 机型命名 ----------
const showAlias = ref(false)
const aliasSaving = ref(false)
const aliasForm = ref({ code: '', count: 0, alias: '', aliased: false })

// 不认识的型号代码，一键跳去搜索
const aliasSearchUrl = computed(
  () => `https://www.baidu.com/s?wd=${encodeURIComponent(`${aliasForm.value.code} 手机型号`)}`
)

const openAlias = (item) => {
  aliasForm.value = {
    code: item.code,
    count: item.count,
    alias: item.aliased ? item.label : '',
    aliased: !!item.aliased
  }
  showAlias.value = true
}

const closeAlias = () => {
  if (aliasSaving.value) return
  showAlias.value = false
}

/** removeName=true 表示取消命名，恢复显示原始代码 */
const confirmAlias = async (removeName) => {
  const alias = removeName ? '' : aliasForm.value.alias.trim()
  if (!removeName && !alias) {
    ElMessage.warning('请先填写机型名称')
    return
  }
  aliasSaving.value = true
  try {
    const res = await saveVisitAlias({ modelCode: aliasForm.value.code, alias })
    ElMessage.success(res.message || '已保存')
    showAlias.value = false
    loadAll()
  } catch (e) {
  } finally {
    aliasSaving.value = false
  }
}

// ---------- 轮询 ----------
let timer = null
const startPolling = () => {
  stopPolling()
  // 30 秒刷一次实时在线；页面切到后台就不刷，省手机流量和电
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') loadRealtime()
  }, 30000)
}
const stopPolling = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(() => {
  loadAll()
  startPolling()
})
onUnmounted(stopPolling)
</script>

<style scoped>
.sub-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

/* 注意：这里刻意不用 .admin-card。
   global.css 里 `.admin-layout .admin-page .admin-card { flex: 1 }` 是为「单卡片撑满整页」
   的列表页写的；本页有十几张卡片，套上那条规则会被压成等高的条。
   所以用自有的 .visit-card，配色与圆角仍走同一套 --admin-* 变量。 */
.visit-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 28px;
}

.visit-card {
  background: var(--admin-card);
  border-radius: var(--admin-radius);
  box-shadow: var(--admin-shadow);
  padding: 22px 24px;
}

/* 卡片密集，hover 只加阴影不做位移，避免整屏抖动 */
.visit-card:hover {
  box-shadow: var(--admin-shadow-hover);
}

/* ---------- 工具条 ---------- */
.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 980px;
  background: rgba(120, 120, 128, 0.08);
}

.seg-btn {
  border: none;
  background: transparent;
  padding: 7px 18px;
  border-radius: 980px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-text-secondary);
  cursor: pointer;
  transition: all 0.22s ease;
}

.seg-btn.active {
  background: var(--admin-card);
  color: var(--admin-primary);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}

.bot-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  color: var(--admin-text-secondary);
  cursor: pointer;
  user-select: none;
}

.toolbar-right {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.mini {
  padding: 8px 16px !important;
  font-size: 13px !important;
}

/* ---------- 指标卡 ---------- */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 14px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 16px 18px;
  border-radius: 16px;
  background: var(--admin-card);
  box-shadow: var(--admin-shadow);
}

.metric-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--admin-text-secondary);
}

.metric-value {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--admin-text);
}

.metric-value.small {
  font-size: 20px;
}

.metric-note {
  font-size: 11px;
  color: var(--admin-text-tertiary);
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  display: inline-block;
}

/* ---------- 布局 ---------- */
.grid-2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.card-head h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--admin-text);
}

.card-desc {
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

.card-empty {
  padding: 26px 0;
  text-align: center;
  font-size: 13px;
  color: var(--admin-text-tertiary);
}

/* ---------- 趋势图 ---------- */
.legend {
  display: flex;
  gap: 14px;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--admin-text-secondary);
}

.line-solid,
.line-dash {
  width: 15px;
  height: 0;
  border-top: 2px solid var(--admin-primary);
  display: inline-block;
}

.line-dash {
  border-top: 2px dashed #10b981;
}

.chart-wrap {
  position: relative;
}

.trend-svg {
  width: 100%;
  height: 160px;
  display: block;
}

.chart-empty {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--admin-text-tertiary);
}

.trend-axis {
  position: relative;
  height: 18px;
  margin-top: 6px;
}

.trend-axis span {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 11px;
  white-space: nowrap;
  color: var(--admin-text-tertiary);
}

/* ---------- 分布条 ---------- */
.bar-list {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.bar-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 5px;
}

.bar-name {
  font-size: 13px;
  color: var(--admin-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bar-value {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-text);
}

.bar-value em {
  font-style: normal;
  font-weight: 400;
  font-size: 11px;
  color: var(--admin-text-tertiary);
}

.bar-track {
  height: 6px;
  border-radius: 3px;
  background: rgba(120, 120, 128, 0.1);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--admin-primary);
  transition: width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.bar-fill.alt {
  background: #6366f1;
  opacity: 0.7;
}

/* 条形下方的补充说明（地区分布里用来列出该省访问最多的市） */
.bar-sub {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--admin-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

/* ---------- 设备 ---------- */
.device-groups {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.group-title {
  display: block;
  margin-bottom: 9px;
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 980px;
  background: rgba(120, 120, 128, 0.08);
  font-size: 12px;
  color: var(--admin-text);
}

.chip em {
  font-style: normal;
  font-weight: 700;
  color: var(--admin-primary);
}

/* 机型 chip：整块可点，未命名的额外挂一个「命名」提示 */
.chip-editable,
.chip-named {
  cursor: pointer;
  transition: background 0.2s ease;
}

.chip-editable:hover,
.chip-named:hover {
  background: rgba(120, 120, 128, 0.16);
}

.chip-edit {
  margin-left: 2px;
  padding-left: 7px;
  border-left: 1px solid rgba(120, 120, 128, 0.25);
  font-style: normal;
  font-size: 11px;
  color: var(--admin-primary);
}

/* ---------- 机型命名弹窗 ---------- */
.alias-code {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(120, 120, 128, 0.07);
}

.alias-code-label {
  display: block;
  font-size: 11px;
  color: var(--admin-text-tertiary);
}

.alias-code-value {
  display: block;
  margin-top: 2px;
  font-size: 15px;
  color: var(--admin-text);
}

.alias-code-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

.alias-input {
  margin-top: 14px;
}

.alias-search {
  color: var(--admin-primary);
  text-decoration: none;
  border-bottom: 1px dashed rgba(79, 70, 229, 0.4);
}

.alias-remove {
  display: block;
  width: 100%;
  margin-top: 16px;
  padding: 11px 0;
  border: none;
  border-radius: 12px;
  background: rgba(220, 38, 38, 0.07);
  font-family: inherit;
  font-size: 13px;
  color: #dc2626;
  cursor: pointer;
  transition: background 0.2s ease;
}

.alias-remove:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.14);
}

.alias-remove:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---------- 漏斗 ---------- */
.funnel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.funnel-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.funnel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 34%;
  padding: 11px 14px;
  border-radius: 10px;
  background: var(--admin-primary);
  color: #fff;
  font-size: 13px;
  transition: width 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.funnel-label {
  white-space: nowrap;
}

.funnel-value {
  font-weight: 700;
  white-space: nowrap;
}

.funnel-rate {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

/* ---------- 实时列表 ---------- */
.live-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 300px;
  overflow-y: auto;
}

.live-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--admin-border);
}

.live-row:last-child {
  border-bottom: none;
}

.live-time {
  flex-shrink: 0;
  width: 44px;
  font-size: 12px;
  font-weight: 600;
  color: var(--admin-text);
}

/* 实时行里 IP 与归属地上下排，宽屏固定宽度保证各列对齐 */
.live-ip {
  flex-shrink: 0;
  width: 176px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  overflow: hidden;
}

.live-ip .mono {
  font-size: 12px;
  color: var(--admin-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-ip .cell-muted {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-pages {
  flex-shrink: 0;
  width: 116px;
  font-size: 11px;
  color: var(--admin-text-tertiary);
  text-align: right;
}

.live-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.live-path {
  font-size: 13px;
  color: var(--admin-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-meta {
  font-size: 11px;
  color: var(--admin-text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-user {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--admin-primary);
}

.live-user.anon {
  font-weight: 400;
  color: var(--admin-text-tertiary);
}

/* ---------- 明细表 ---------- */
.table-tools {
  display: flex;
  gap: 8px;
  align-items: center;
}

.search-input {
  width: 220px;
  height: 36px;
  padding: 0 13px;
  font-size: 13px;
  color: var(--admin-text);
  background: rgba(120, 120, 128, 0.07);
  border: 1px solid transparent;
  border-radius: 980px;
  outline: none;
  transition: all 0.2s ease;
}

.search-input:focus {
  background: #fff;
  border-color: var(--admin-primary);
}

.table-wrap {
  height: 460px;
}

.cell-2line {
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.35;
}

.cell-muted {
  font-size: 11px;
  color: var(--admin-text-tertiary);
}

.pagination {
  margin-top: 18px;
  display: flex;
  justify-content: flex-end;
}

/* 表格行距压紧一点，多放几行 */
.apple-table :deep(.el-table__body-wrapper td.el-table__cell) {
  padding-top: 8px;
  padding-bottom: 8px;
}

/* ================================================================
   移动端（≤768px）：指标卡两列、所有双栏变单栏、表格换卡片列表
   ================================================================ */
.mobile-list {
  display: none;
}

@media (max-width: 1200px) {
  .metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .grid-2 {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 768px) {
  .visit-body {
    gap: 14px;
    padding-bottom: 20px;
  }

  .visit-card {
    padding: 16px 14px;
    border-radius: 16px;
  }

  .toolbar {
    gap: 10px;
  }

  .seg {
    width: 100%;
  }

  .seg-btn {
    flex: 1;
    padding: 8px 0;
  }

  .toolbar-right {
    margin-left: 0;
    width: 100%;
  }

  .toolbar-right .mini {
    flex: 1;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .metric-card {
    padding: 13px 14px;
    border-radius: 14px;
  }

  .metric-value {
    font-size: 22px;
  }

  .metric-value.small {
    font-size: 17px;
  }

  .card-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .table-tools {
    width: 100%;
  }

  .search-input {
    flex: 1;
    width: auto;
    min-width: 0;
  }

  /* 表格换成卡片列表，避免横向滚动 */
  .table-wrap {
    display: none;
  }

  .mobile-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .m-card {
    border: 1px solid var(--admin-border);
    border-radius: 14px;
    padding: 13px;
  }

  .m-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--admin-border);
  }

  .m-ip {
    max-width: 44%;
    font-size: 12px;
    color: var(--admin-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .m-time {
    margin-left: auto;
    font-size: 12px;
    color: var(--admin-text-tertiary);
  }

  .m-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px 12px;
  }

  .m-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .m-cell.wide {
    grid-column: 1 / -1;
  }

  .m-label {
    font-size: 11px;
    color: var(--admin-text-tertiary);
  }

  .m-value {
    font-size: 13px;
    color: var(--admin-text);
    word-break: break-word;
  }

  .pagination {
    justify-content: center;
    margin-top: 14px;
  }

  /* 实时行在窄屏上折成三行：时间|IP|用户 → 路径 → 页数停留 */
  .live-list {
    max-height: none;
  }

  /* 机型 chip 要能点，加大触摸目标 */
  .chip {
    padding: 8px 13px;
  }

  .live-row {
    flex-wrap: wrap;
    gap: 6px 10px;
    padding: 11px 0;
  }

  .live-time {
    order: 1;
  }

  .live-ip {
    order: 2;
    flex: 1;
    width: auto;
    min-width: 0;
  }

  .live-user {
    order: 3;
  }

  .live-main {
    order: 4;
    flex-basis: 100%;
  }

  .live-pages {
    order: 5;
    flex-basis: 100%;
    width: auto;
    text-align: left;
  }

  .funnel-bar {
    padding: 10px 12px;
    font-size: 12px;
  }

  /* 趋势图在窄屏上矮一点，但保留可读性 */
  .trend-svg,
  .chart-empty {
    height: 140px;
  }
}

/* ================================================================
   清理明细弹窗（自绘，配色跟随后台主题）
   ================================================================ */
.clean-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.42);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

/* 内容比密码框长得多，限高后内部滚动，窄屏才不会被顶出屏幕 */
.clean-dialog {
  position: relative;
  width: 100%;
  max-width: 460px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding: 30px 26px 22px;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 24px 64px rgba(15, 23, 42, 0.24);
}

.clean-close {
  position: absolute;
  top: 13px;
  right: 13px;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--admin-text-tertiary);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}

.clean-close:hover {
  background: rgba(120, 120, 128, 0.1);
  color: var(--admin-text);
}

.clean-title {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: var(--admin-text);
}

.clean-sub {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--admin-text-secondary);
}

.clean-block {
  margin-top: 20px;
}

.clean-label {
  display: block;
  margin-bottom: 9px;
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

.preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-btn {
  padding: 8px 14px;
  border: 1px solid transparent;
  border-radius: 980px;
  background: rgba(120, 120, 128, 0.08);
  font-family: inherit;
  font-size: 13px;
  color: var(--admin-text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.preset-btn:hover {
  background: rgba(120, 120, 128, 0.15);
}

.preset-btn.active {
  background: var(--admin-primary);
  color: #fff;
}

/* 「全部」是清空级别，选中后走红色，跟其它预设区分开 */
.preset-btn.wipe.active {
  background: #dc2626;
}

.date-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.date-input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  font-family: inherit;
  font-size: 13px;
  color: var(--admin-text);
  background: rgba(120, 120, 128, 0.07);
  border: 1px solid transparent;
  border-radius: 12px;
  outline: none;
  transition: all 0.2s ease;
}

.date-input:focus {
  background: #fff;
  border-color: var(--admin-primary);
}

.date-sep {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--admin-text-tertiary);
}

.clean-input {
  width: 100%;
  height: 42px;
  margin-bottom: 9px;
  padding: 0 14px;
  font-family: inherit;
  font-size: 13px;
  color: var(--admin-text);
  background: rgba(120, 120, 128, 0.07);
  border: 1px solid transparent;
  border-radius: 12px;
  outline: none;
  transition: all 0.2s ease;
}

.clean-input::placeholder {
  color: var(--admin-text-tertiary);
}

.clean-input:focus {
  background: #fff;
  border-color: var(--admin-primary);
  box-shadow: 0 0 0 3px var(--admin-primary-light);
}

.clean-tip {
  display: block;
  font-size: 11px;
  line-height: 1.6;
  color: var(--admin-text-tertiary);
}

.clean-tip code {
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(120, 120, 128, 0.12);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.clean-preview {
  margin-top: 18px;
  padding: 13px 15px;
  border-radius: 12px;
  background: var(--admin-primary-soft);
  font-size: 13px;
  line-height: 1.6;
  color: var(--admin-text);
}

.clean-preview.wipe {
  background: rgba(220, 38, 38, 0.08);
}

.clean-preview strong {
  font-weight: 700;
  color: var(--admin-primary);
}

.clean-preview.wipe strong {
  color: #dc2626;
}

.preview-error {
  color: #dc2626;
}

.clean-warn {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #dc2626;
}

.clean-actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.clean-btn {
  flex: 1;
  height: 46px;
  border: none;
  border-radius: 14px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.15s ease;
}

.clean-btn.ghost {
  background: rgba(120, 120, 128, 0.09);
  color: var(--admin-text-secondary);
}

.clean-btn.ghost:hover {
  background: rgba(120, 120, 128, 0.16);
}

.clean-btn.danger {
  background: #dc2626;
  color: #fff;
}

.clean-btn.danger:hover:not(:disabled) {
  background: #b91c1c;
}

.clean-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clean-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.clean-fade-enter-active,
.clean-fade-leave-active {
  transition: opacity 0.2s ease;
}

.clean-fade-enter-active .clean-dialog,
.clean-fade-leave-active .clean-dialog {
  transition: transform 0.24s cubic-bezier(0.25, 0.1, 0.25, 1);
}

.clean-fade-enter-from,
.clean-fade-leave-to {
  opacity: 0;
}

.clean-fade-enter-from .clean-dialog,
.clean-fade-leave-to .clean-dialog {
  transform: scale(0.94);
}

@media (max-width: 768px) {
  .clean-mask {
    padding: 12px;
    align-items: flex-end;
  }

  /* 手机上从底部弹出，按钮在手指够得到的位置 */
  .clean-dialog {
    max-height: calc(100vh - 24px);
    padding: 24px 18px 18px;
    border-radius: 22px;
  }

  .clean-title {
    font-size: 17px;
  }

  /* 三个一行，避免预设按钮把宽度撑开 */
  .preset-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .preset-btn {
    padding: 10px 0;
    text-align: center;
  }

  .date-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .date-sep {
    text-align: center;
  }

  /* 触摸目标不低于 44px */
  .date-input,
  .clean-input {
    height: 46px;
  }

  .clean-fade-enter-from .clean-dialog,
  .clean-fade-leave-to .clean-dialog {
    transform: translateY(16px) scale(0.98);
  }
}
</style>
