import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Doughnut, Pie } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Title, Tooltip, Legend, Filler)

const TICK  = { color: '#8b949e', font: { size: 11 } }
const GRID  = { color: 'rgba(48,54,61,.5)' }
const BASE_OPTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8b949e', font: { size: 12 } } } },
  scales: { x: { ticks: TICK, grid: GRID }, y: { ticks: TICK, grid: GRID } },
}

// ── Asset growth line chart ────────────────────────────────────────────────
export function AssetLineChart({ quarters }) {
  const labels = quarters.map(q => `Q${q.q}`)
  return (
    <Line
      data={{
        labels,
        datasets: [
          { label:'Tổng TS ròng',  data: quarters.map(q=>q.totalAssets/1e9), borderColor:'#58a6ff', backgroundColor:'rgba(88,166,255,.1)', fill:true, tension:.4, pointRadius:2 },
          { label:'Danh mục ĐT',   data: quarters.map(q=>q.portfolio/1e9),   borderColor:'#3fb950', backgroundColor:'rgba(63,185,80,.05)',  fill:true, tension:.4, pointRadius:2 },
          { label:'Tiền mặt',      data: quarters.map(q=>q.closingCash/1e9), borderColor:'#39c5cf', backgroundColor:'rgba(57,197,207,.05)', fill:true, tension:.4, pointRadius:2 },
        ],
      }}
      options={{ ...BASE_OPTS, scales: { ...BASE_OPTS.scales, y: { ...BASE_OPTS.scales.y, ticks: { ...TICK, callback: v=>`${v.toFixed(1)} tỷ` } } } }}
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
          { label:'Lợi nhuận KD',  data: quarters.map(q=>q.profit/1e6),                              backgroundColor:'rgba(63,185,80,.7)' },
          { label:'Chi phí+Lãi',   data: quarters.map(q=>-(q.living+q.housing+q.interest+q.repay)/1e6), backgroundColor:'rgba(248,81,73,.6)' },
          { label:'Phân bổ ĐT',    data: quarters.map(q=>-q.invest/1e6),                             backgroundColor:'rgba(88,166,255,.6)' },
        ],
      }}
      options={{ ...BASE_OPTS, scales: { ...BASE_OPTS.scales, y: { ...BASE_OPTS.scales.y, ticks: { ...TICK, callback: v=>`${v} tr` } } } }}
    />
  )
}

// ── End-of-period doughnut ─────────────────────────────────────────────────
export function AssetDoughnut({ lastQ }) {
  return (
    <Doughnut
      data={{
        labels: ['Tiền mặt','Danh mục ĐT','Dư nợ (-)'],
        datasets: [{ data:[lastQ.closingCash/1e9, lastQ.portfolio/1e9, lastQ.debt/1e9], backgroundColor:['#39c5cf','#3fb950','#f85149'], borderWidth:0 }],
      }}
      options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color:'#8b949e' } } } }}
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
          { label:'Lợi nhuận', data:annual.map(a=>a.profit/1e9), backgroundColor:'rgba(63,185,80,.8)', borderRadius:4 },
          { label:'Chi phí',   data:annual.map(a=>-(a.living+a.housing)/1e9), backgroundColor:'rgba(248,81,73,.6)', borderRadius:4 },
          { label:'Tổng TS', type:'line', data:annual.map(a=>a.totalAssets/1e9), borderColor:'#58a6ff', tension:.4, pointRadius:5, fill:false },
        ],
      }}
      options={{ ...BASE_OPTS, scales: { ...BASE_OPTS.scales, y: { ...BASE_OPTS.scales.y, ticks: { ...TICK, callback: v=>`${v.toFixed(1)} tỷ` } } } }}
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
          { label:'Thực tế', data:signals.map(s=>s.actual), backgroundColor:signals.map(s=>s.color+'bb'), borderRadius:4 },
          { label:'Mục tiêu', data:signals.map(s=>s.target), backgroundColor:'rgba(255,255,255,.1)', borderRadius:4 },
        ],
      }}
      options={{ ...BASE_OPTS, scales: { ...BASE_OPTS.scales, y: { ...BASE_OPTS.scales.y, ticks: { ...TICK, callback: v=>`${v}%` } } } }}
    />
  )
}

// ── Allocation pie ─────────────────────────────────────────────────────────
export function AllocationPieChart({ signals }) {
  return (
    <Pie
      data={{
        labels: signals.map(s=>s.label),
        datasets:[{ data:signals.map(s=>s.value/1e6), backgroundColor:signals.map(s=>s.color), borderWidth:0 }],
      }}
      options={{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color:'#8b949e' } } } }}
    />
  )
}
