<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import { 
  Thermometer, 
  Droplets, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  RefreshCw, 
  Sun, 
  Moon, 
  BarChart2,
  Clock,
  Laptop
} from 'lucide-vue-next'

// Reactive state
const currentTemp = ref<number | null>(null)
const currentHumidity = ref<number | null>(null)
const todayMaxTemp = ref<number | null>(null)
const todayMinTemp = ref<number | null>(null)
const todayMaxHumidity = ref<number | null>(null)
const todayMinHumidity = ref<number | null>(null)
const lastUpdated = ref<string>('--:--:--')
const loading = ref<boolean>(false)

// Theme state: 'auto' | 'light' | 'dark'
const themeMode = ref<string>('auto')
const isDark = ref<boolean>(true)

// Charts refs
const todayChartRef = ref<HTMLElement | null>(null)
const recentChartRef = ref<HTMLElement | null>(null)

let todayChartInstance: echarts.ECharts | null = null
let recentChartInstance: echarts.ECharts | null = null
let timer: any = null

// Apply theme based on mode
const applyTheme = (mode: string) => {
  themeMode.value = mode
  localStorage.setItem('themeMode', mode)

  let dark = false
  if (mode === 'auto') {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  } else if (mode === 'dark') {
    dark = true
  } else {
    dark = false
  }

  isDark.value = dark
  const root = document.documentElement
  if (dark) {
    root.classList.add('dark')
    root.style.colorScheme = 'dark'
  } else {
    root.classList.remove('dark')
    root.style.colorScheme = 'light'
  }
  updateChartsTheme()
}

// Toggle theme in cycle: auto -> light -> dark -> auto
const toggleTheme = () => {
  if (themeMode.value === 'auto') {
    applyTheme('light')
  } else if (themeMode.value === 'light') {
    applyTheme('dark')
  } else {
    applyTheme('auto')
  }
}

const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

// Fetch current sensor data
const fetchCurrentData = async () => {
  try {
    const res = await axios.get('/api/get')
    if (res.data) {
      if (res.data.temperature !== undefined) currentTemp.value = res.data.temperature
      if (res.data.humidity !== undefined) currentHumidity.value = res.data.humidity
      lastUpdated.value = dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
  } catch (err) {
    console.error('Failed to fetch current data', err)
  }
}

// Fetch today's summary & chart data
const fetchTodayData = async () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()

  try {
    // Today series data
    const res = await axios.get(`/api/get/day?year=${year}&month=${month}&day=${day}`)
    const list = res.data || []
    
    // Today min/max
    const maxRes = await axios.get(`/api/get/maxByDay?year=${year}&month=${month}&day=${day}`)
    const minRes = await axios.get(`/api/get/minByDay?year=${year}&month=${month}&day=${day}`)

    if (maxRes.data && maxRes.data.temperature !== undefined) {
      todayMaxTemp.value = maxRes.data.temperature
      todayMaxHumidity.value = maxRes.data.humidity
    } else if (list.length > 0) {
      todayMaxTemp.value = Math.max(...list.map((item: any) => item.temperature))
      todayMaxHumidity.value = Math.max(...list.map((item: any) => item.humidity))
    }

    if (minRes.data && minRes.data.temperature !== undefined) {
      todayMinTemp.value = minRes.data.temperature
      todayMinHumidity.value = minRes.data.humidity
    } else if (list.length > 0) {
      todayMinTemp.value = Math.min(...list.map((item: any) => item.temperature))
      todayMinHumidity.value = Math.min(...list.map((item: any) => item.humidity))
    }

    renderTodayChart(list)
  } catch (err) {
    console.error('Failed to fetch today data', err)
  }
}

// Fetch recent 60 days data
const fetchRecentData = async () => {
  try {
    const [tempRes, humiRes] = await Promise.all([
      axios.get('/api/get/recent/temperature?day=60'),
      axios.get('/api/get/recent/humidity?day=60')
    ])
    
    renderRecentChart(tempRes.data || [], humiRes.data || [])
  } catch (err) {
    console.error('Failed to fetch recent data', err)
  }
}

// Render Today's Chart
const renderTodayChart = (data: any[]) => {
  if (!todayChartRef.value) return
  if (!todayChartInstance) {
    todayChartInstance = echarts.init(todayChartRef.value)
  }

  const times = data.map(item => dayjs(item.timestamp).format('HH:mm'))
  const temps = data.map(item => item.temperature)
  const humis = data.map(item => item.humidity)

  const textColor = isDark.value ? '#94a3b8' : '#64748b'
  const gridColor = isDark.value ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? '#1e293b' : '#ffffff',
      borderColor: isDark.value ? '#334155' : '#e2e8f0',
      textStyle: {
        color: isDark.value ? '#f1f5f9' : '#1e293b'
      }
    },
    legend: {
      data: ['Temperature (°C)', 'Humidity (%)'],
      textStyle: { color: textColor },
      top: 0,
      itemWidth: 25,
      itemHeight: 14,
      itemGap: 20,
      selected: {
        'Temperature (°C)': true,
        'Humidity (°C)': false, // or handle humidity
        'Humidity (%)': false
      }
    },
    grid: {
      top: 55,
      bottom: 30,
      left: 40,
      right: 40,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: times,
      axisLine: { lineStyle: { color: textColor } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Temp (°C)',
        position: 'left',
        scale: true,
        min: (value: { min: number; max: number }) => Math.floor(value.min),
        max: (value: { min: number; max: number }) => Math.ceil(value.max),
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { formatter: '{value} °C' },
        axisLine: { lineStyle: { color: '#ef4444' } }
      },
      {
        type: 'value',
        name: 'Humi (%)',
        position: 'right',
        scale: true,
        min: (value: { min: number; max: number }) => Math.max(0, Math.floor(value.min - 2)),
        max: (value: { min: number; max: number }) => Math.min(100, Math.ceil(value.max + 2)),
        splitLine: { show: false },
        axisLabel: { formatter: '{value} %' },
        axisLine: { lineStyle: { color: '#3b82f6' } }
      }
    ],
    series: [
      {
        name: 'Temperature (°C)',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: temps,
        itemStyle: { color: '#ef4444' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
            { offset: 1, color: 'rgba(239, 68, 68, 0.0)' }
          ])
        }
      },
      {
        name: 'Humidity (%)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: humis,
        itemStyle: { color: '#3b82f6' },
        lineStyle: { width: 3 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
            { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
          ])
        }
      }
    ]
  }

  todayChartInstance.setOption(option)
}

// Render Recent 60 Days Chart
const renderRecentChart = (tempData: any[], humiData: any[]) => {
  if (!recentChartRef.value) return
  if (!recentChartInstance) {
    recentChartInstance = echarts.init(recentChartRef.value)
  }

  // Combine dates
  const dateMap = new Map()
  tempData.forEach((item: any) => {
    if (!dateMap.has(item.date)) dateMap.set(item.date, {})
    dateMap.get(item.date).maxTemp = item.max_temp
    dateMap.get(item.date).minTemp = item.min_temp
  })
  humiData.forEach((item: any) => {
    if (!dateMap.has(item.date)) dateMap.set(item.date, {})
    dateMap.get(item.date).maxHumi = item.max_humidity
    dateMap.get(item.date).minHumi = item.min_humidity
  })

  const sortedDates = Array.from(dateMap.keys()).sort()
  const dates = sortedDates.map(d => dayjs(d).format('MM-DD'))
  const maxTemps = sortedDates.map(d => dateMap.get(d).maxTemp ?? null)
  const minTemps = sortedDates.map(d => dateMap.get(d).minTemp ?? null)
  const maxHumis = sortedDates.map(d => dateMap.get(d).maxHumi ?? null)
  const minHumis = sortedDates.map(d => dateMap.get(d).minHumi ?? null)

  const textColor = isDark.value ? '#94a3b8' : '#64748b'
  const gridColor = isDark.value ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark.value ? '#1e293b' : '#ffffff',
      borderColor: isDark.value ? '#334155' : '#e2e8f0',
      textStyle: {
        color: isDark.value ? '#f1f5f9' : '#1e293b'
      }
    },
    legend: {
      data: ['Max Temp', 'Min Temp', 'Max Humidity', 'Min Humidity'],
      textStyle: { color: textColor },
      top: 0,
      itemWidth: 25,
      itemHeight: 12,
      itemGap: 15,
      selected: {
        'Max Humidity': false,
        'Min Humidity': false
      }
    },
    grid: {
      top: 60,
      bottom: 30,
      left: 40,
      right: 40,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: textColor } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: 'Temp (°C)',
        position: 'left',
        scale: true,
        min: (value: { min: number; max: number }) => Math.floor(value.min - 1),
        max: (value: { min: number; max: number }) => Math.ceil(value.max + 1),
        splitLine: { lineStyle: { color: gridColor } },
        axisLabel: { formatter: '{value}°C' },
        axisLine: { lineStyle: { color: '#f97316' } }
      },
      {
        type: 'value',
        name: 'Humi (%)',
        position: 'right',
        scale: true,
        min: (value: { min: number; max: number }) => Math.max(0, Math.floor(value.min - 2)),
        max: (value: { min: number; max: number }) => Math.min(100, Math.ceil(value.max + 2)),
        splitLine: { show: false },
        axisLabel: { formatter: '{value}%' },
        axisLine: { lineStyle: { color: '#06b6d4' } }
      }
    ],
    series: [
      {
        name: 'Max Temp',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: maxTemps,
        itemStyle: { color: '#f97316' },
        lineStyle: { width: 2, type: 'solid' }
      },
      {
        name: 'Min Temp',
        type: 'line',
        smooth: true,
        showSymbol: false,
        data: minTemps,
        itemStyle: { color: '#fb923c' },
        lineStyle: { width: 2, type: 'dashed' }
      },
      {
        name: 'Max Humidity',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: maxHumis,
        itemStyle: { color: '#06b6d4' },
        lineStyle: { width: 2, type: 'solid' }
      },
      {
        name: 'Min Humidity',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        data: minHumis,
        itemStyle: { color: '#67e8f9' },
        lineStyle: { width: 2, type: 'dashed' }
      }
    ]
  }

  recentChartInstance.setOption(option)
}

const updateChartsTheme = () => {
  if (todayChartInstance) {
    todayChartInstance.dispose()
    todayChartInstance = null
  }
  if (recentChartInstance) {
    recentChartInstance.dispose()
    recentChartInstance = null
  }
  fetchTodayData()
  fetchRecentData()
}

const refreshAll = async () => {
  loading.value = true
  await Promise.all([
    fetchCurrentData(),
    fetchTodayData(),
    fetchRecentData()
  ])
  setTimeout(() => {
    loading.value = false
  }, 500)
}

// Window resize handler
const handleResize = () => {
  todayChartInstance?.resize()
  recentChartInstance?.resize()
}

onMounted(() => {
  // Check system/saved theme
  const savedMode = localStorage.getItem('themeMode') || (localStorage.getItem('theme') ? (localStorage.getItem('theme') === 'dark' ? 'dark' : 'light') : 'auto')
  applyTheme(savedMode)
  darkModeMediaQuery.addEventListener("change", (_)=>applyTheme(savedMode));

  refreshAll()
  window.addEventListener('resize', handleResize)

  // Auto refresh every 5 mins
  timer = setInterval(() => {
    fetchCurrentData()
  }, 300000)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (timer) clearInterval(timer)
  todayChartInstance?.dispose()
  recentChartInstance?.dispose()
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 flex flex-col font-sans">
    <!-- Top Header -->
    <header class="sticky top-0 z-50 backdrop-blur-md bg-white/75 dark:bg-slate-900/75 border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <img src="/icon.svg" alt="" class="w-9 h-9">
          <div>
            <h1 class="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
              Environmental Monitor
            </h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock class="w-3 h-3" /> Updated: {{ lastUpdated }}
            </p>
          </div>
        </div>

        <div class="flex items-center space-x-2 sm:space-x-4">
          <button 
            @click="refreshAll" 
            class="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all flex items-center gap-1.5 text-sm font-medium shadow-sm active:scale-95 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw class="w-4 h-4" />
            <span class="hidden sm:inline">Refresh</span>
          </button>

          <button 
            @click="toggleTheme" 
            class="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5 px-3"
            :title="`Theme: ${themeMode.charAt(0).toUpperCase() + themeMode.slice(1)} (Click to switch)`"
          >
            <Laptop v-if="themeMode === 'auto'" class="w-4 h-4 text-blue-500" />
            <Sun v-else-if="themeMode === 'light'" class="w-4 h-4 text-amber-500" />
            <Moon v-else class="w-4 h-4 text-indigo-400" />
            <span class="text-xs font-medium capitalize hidden sm:inline">{{ themeMode }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Dashboard Content -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      <!-- Current & Today Extremes Cards Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        <!-- Current Temperature Card -->
        <div class="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group">
          <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-red-500/10 rounded-full blur-xl group-hover:bg-red-500/20 transition-all"></div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Temperature</span>
            <div class="p-2 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-500 dark:text-red-400">
              <Thermometer class="w-5 h-5" />
            </div>
          </div>
          <div class="flex items-baseline space-x-2">
            <span class="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {{ currentTemp !== null ? currentTemp : '--' }}
            </span>
            <span class="text-xl font-bold text-slate-500 dark:text-slate-400">°C</span>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span>SHT30 Sensor</span>
            <span class="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
              <span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping"></span> Live
            </span>
          </div>
        </div>

        <!-- Current Humidity Card -->
        <div class="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group">
          <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Current Humidity</span>
            <div class="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-500 dark:text-blue-400">
              <Droplets class="w-5 h-5" />
            </div>
          </div>
          <div class="flex items-baseline space-x-2">
            <span class="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {{ currentHumidity !== null ? currentHumidity : '--' }}
            </span>
            <span class="text-xl font-bold text-slate-500 dark:text-slate-400">%</span>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <span>Relative Humidity</span>
            <span class="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
              <span class="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-ping"></span> Live
            </span>
          </div>
        </div>

        <!-- Today's Temperature Extremes -->
        <div class="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group">
          <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Temperature</span>
            <div class="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400">
              <Sun class="w-5 h-5" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <div class="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <TrendingUp class="w-3.5 h-3.5 text-red-500" /> Max
              </div>
              <div class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {{ todayMaxTemp !== null ? todayMaxTemp : '--' }}<span class="text-sm font-normal text-slate-500">°C</span>
              </div>
            </div>
            <div>
              <div class="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <TrendingDown class="w-3.5 h-3.5 text-blue-500" /> Min
              </div>
              <div class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {{ todayMinTemp !== null ? todayMinTemp : '--' }}<span class="text-sm font-normal text-slate-500">°C</span>
              </div>
            </div>
          </div>
          <div class="mt-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            Daily peak & valley records
          </div>
        </div>

        <!-- Today's Humidity Extremes -->
        <div class="relative overflow-hidden bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group">
          <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
          <div class="flex items-center justify-between mb-4">
            <span class="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Humidity</span>
            <div class="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-500 dark:text-cyan-400">
              <Droplets class="w-5 h-5" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <div class="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <TrendingUp class="w-3.5 h-3.5 text-cyan-500" /> Max
              </div>
              <div class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {{ todayMaxHumidity !== null ? todayMaxHumidity : '--' }}<span class="text-sm font-normal text-slate-500">%</span>
              </div>
            </div>
            <div>
              <div class="text-xs text-slate-400 flex items-center gap-1 mb-1">
                <TrendingDown class="w-3.5 h-3.5 text-blue-400" /> Min
              </div>
              <div class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {{ todayMinHumidity !== null ? todayMinHumidity : '--' }}<span class="text-sm font-normal text-slate-500">%</span>
              </div>
            </div>
          </div>
          <div class="mt-3 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            Daily moisture bounds
          </div>
        </div>

      </div>

      <!-- Charts Section -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <!-- Today's Trend Chart -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
              <div class="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-500">
                <BarChart2 class="w-4 h-4" />
              </div>
              <h2 class="font-bold text-base text-slate-900 dark:text-white">Today's Weather Curve</h2>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              24 Hours
            </span>
          </div>
          <div class="flex-1 w-full min-h-[300px]" ref="todayChartRef"></div>
        </div>

        <!-- Recent 60 Days Trend Chart -->
        <div class="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
              <div class="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-500">
                <Calendar class="w-4 h-4" />
              </div>
              <h2 class="font-bold text-base text-slate-900 dark:text-white">Last 60 Days Analytics</h2>
            </div>
            <span class="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              Max & Min Range
            </span>
          </div>
          <div class="flex-1 w-full min-h-[300px]" ref="recentChartRef"></div>
        </div>

      </div>

    </main>

    <!-- Footer -->
    <footer class="py-6 border-t border-slate-200 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-500">
      <p>SHT Sensor Environmental Monitoring System &bull; Built with Vue 3, Tailwind CSS & ECharts</p>
    </footer>
  </div>
</template>
