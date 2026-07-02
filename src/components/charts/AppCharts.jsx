import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler)

// ── Light theme dùng chung cho toàn bộ chart trong app (Dashboard, Annual, Portfolio…) ──
const TICK_LIGHT = { color: '#94a3b8', font: { size: 11, family: 'Inter' } }
const GRID_LIGHT = { color: '#eef1f6' }
const TOOLTIP_LIGHT = {
  backgroundColor: '#ffffff',
  titleColor: '#111827',
  bodyColor: '#475569',
  borderColor: '#e5e7eb',
  borderWidth: 1,
  padding: 10,
  cornerRadius: 10,
  boxPadding: 4,
  usePointStyle: true,
  titleFont: { size: 12, weight: '600', family: 'Inter' },
  bodyFont: { size: 12, family: 'Inter' },
}
const LEGEND_LIGHT = {
  position: 'top', align: 'end',
  labels: { color: '#475569', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16, font: { size: 12, family: 'Inter' } },
}
const LIGHT_BASE_OPTS = {
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: LEGEND_LIGHT, tooltip: TOOLTIP_LIGHT },
  scales: {
    x: { ticks: TICK_LIGHT, grid: { display: false }, border: { display: false } },
    y: { ticks: TICK_LIGHT, grid: GRID_LIGHT, border: { display: false } },
  },
}

// ── Asset growth line chart ────────────────────────────────────────────────
export function AssetLineChart({ quarters }) {
  const labels = quarters.map(q => `Q${q.q}`)
  return (
    <Line
      data={{
        labels,
        datasets: [
          { label:'Tổng TS ròng',  data: quarters.map(q=>q.totalAssets/1e9), borderColor:'#2563eb', backgroundColor:'rgba(37,99,235,.08)',  fill:true, tension:.4, borderWidth:2.5, pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor:'#2563eb', pointHoverBorderColor:'#fff', pointHoverBorderWidth:2 },
          { label:'Danh mục ĐT',   data: quarters.map(q=>q.portfolio/1e9),   borderColor:'#16a34a', backgroundColor:'rgba(22,163,74,.06)',  fill:true, tension:.4, borderWidth:2,   pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor:'#16a34a', pointHoverBorderColor:'#fff', pointHoverBorderWidth:2 },
          { label:'Tiền mặt',      data: quarters.map(q=>q.closingCash/1e9), borderColor:'#0d9488', backgroundColor:'rgba(13,148,136,.06)', fill:true, tension:.4, borderWidth:2,   pointRadius:0, pointHoverRadius:5, pointHoverBackgroundColor:'#0d9488', pointHoverBorderColor:'#fff', pointHoverBorderWidth:2 },
        ],
      }}
      options={{
        ...LIGHT_BASE_OPTS,
        scales: { ...LIGHT_BASE_OPTS.scales, y: { ...LIGHT_BASE_OPTS.scales.y, ticks: { ...TICK_LIGHT, callback: v=>`${v.toFixed(1)} tỷ` } } },
        plugins: { ...LIGHT_BASE_OPTS.plugins, tooltip: { ...TOOLTIP_LIGHT, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} tỷ` } } },
      }}
    />
  )
}

// ── Cash flow bar chart ────────────────────────────────────────────────────
export function CashFlowBarChart({ quarters }) {
  const labels = quarters.map(q => `Q${q.q}`)
  return (
    <Bar
      data={{
        labels,
        datasets: [
          { label:'Lợi nhuận KD',  data: quarters.map(q=>q.profit/1e6),                              backgroundColor:'#16a34a', borderRadius:4, maxBarThickness:22 },
          { label:'Chi phí+Lãi',   data: quarters.map(q=>-(q.living+q.housing+q.interest+q.repay)/1e6), backgroundColor:'#ef4444', borderRadius:4, maxBarThickness:22 },
          { label:'Phân bổ ĐT',    data: quarters.map(q=>-q.invest/1e6),                             backgroundColor:'#2563eb', borderRadius:4, maxBarThickness:22 },
        ],
      }}
      options={{
        ...LIGHT_BASE_OPTS,
        scales: { ...LIGHT_BASE_OPTS.scales, y: { ...LIGHT_BASE_OPTS.scales.y, ticks: { ...TICK_LIGHT, callback: v=>`${v} tr` } } },
        plugins: { ...LIGHT_BASE_OPTS.plugins, tooltip: { ...TOOLTIP_LIGHT, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} tr` } } },
      }}
    />
  )
}

// ── End-of-period doughnut ─────────────────────────────────────────────────
export function AssetDoughnut({ lastQ }) {
  return (
    <Doughnut
      data={{
        labels: ['Tiền mặt','Danh mục ĐT','Dư nợ (-)'],
        datasets: [{
          data: [lastQ.closingCash/1e9, lastQ.portfolio/1e9, lastQ.debt/1e9],
          backgroundColor: ['#0d9488','#16a34a','#ef4444'],
          borderWidth: 0, borderRadius: 6, spacing: 3, hoverOffset: 6,
        }],
      }}
      options={{
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: LEGEND_LIGHT,
          tooltip: { ...TOOLTIP_LIGHT, callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(2)} tỷ` } },
        },
      }}
    />
  )
}

// ── Annual bar+line ────────────────────────────────────────────────────────
export function AnnualChart({ annual }) {
  const labels = annual.map(a=>`Năm ${a.year}`)
  return (
    <Bar
      data={{
        labels,
        datasets: [
          { label:'Lợi nhuận', data:annual.map(a=>a.profit/1e9), backgroundColor:'#16a34a', borderRadius:4, maxBarThickness:28 },
          { label:'Chi phí',   data:annual.map(a=>-(a.living+a.housing)/1e9), backgroundColor:'#ef4444', borderRadius:4, maxBarThickness:28 },
          { label:'Tổng TS', type:'line', data:annual.map(a=>a.totalAssets/1e9), borderColor:'#2563eb', backgroundColor:'#2563eb', tension:.4, pointRadius:4, pointHoverRadius:6, pointBackgroundColor:'#2563eb', pointBorderColor:'#fff', pointBorderWidth:2, borderWidth:2.5, fill:false },
        ],
      }}
      options={{
        ...LIGHT_BASE_OPTS,
        scales: { ...LIGHT_BASE_OPTS.scales, y: { ...LIGHT_BASE_OPTS.scales.y, ticks: { ...TICK_LIGHT, callback: v=>`${v.toFixed(1)} tỷ` } } },
        plugins: { ...LIGHT_BASE_OPTS.plugins, tooltip: { ...TOOLTIP_LIGHT, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} tỷ` } } },
      }}
    />
  )
}

// ── Allocation bar (actual vs target) ─────────────────────────────────────
export function AllocationBarChart({ signals }) {
  return (
    <Bar
      data={{
        labels: signals.map(s=>s.label),
        datasets: [
          { label:'Thực tế', data:signals.map(s=>s.actual), backgroundColor:signals.map(s=>s.color), borderRadius:4, maxBarThickness:28 },
          { label:'Mục tiêu', data:signals.map(s=>s.target), backgroundColor:'#e5e7eb', borderRadius:4, maxBarThickness:28 },
        ],
      }}
      options={{
        ...LIGHT_BASE_OPTS,
        scales: { ...LIGHT_BASE_OPTS.scales, y: { ...LIGHT_BASE_OPTS.scales.y, ticks: { ...TICK_LIGHT, callback: v=>`${v}%` } } },
        plugins: { ...LIGHT_BASE_OPTS.plugins, tooltip: { ...TOOLTIP_LIGHT, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` } } },
      }}
    />
  )
}

// ── Allocation pie ─────────────────────────────────────────────────────────
export function AllocationPieChart({ signals }) {
  return (
    <Pie
      data={{
        labels: signals.map(s=>s.label),
        datasets:[{ data:signals.map(s=>s.value/1e6), backgroundColor:signals.map(s=>s.color), borderWidth:0, hoverOffset:6 }],
      }}
      options={{
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: LEGEND_LIGHT,
          tooltip: { ...TOOLTIP_LIGHT, callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(1)} tr` } },
        },
      }}
    />
  )
}
