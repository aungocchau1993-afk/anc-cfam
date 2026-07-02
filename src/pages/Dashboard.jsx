import { useMemo } from 'react'
import {
  LayoutDashboard, TrendingUp, Landmark, Banknote, Printer,
  Wallet, PieChart, Briefcase, Rocket, ArrowUpRight, ArrowDownRight,
  Clock, PiggyBank,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { computeQuarters } from '../lib/calculations'
import { fmtVND, fmtVNDFull } from '../lib/formatters'
import { ALLOC_LABELS, ALLOC_COLORS } from '../lib/constants'
import PageHeader from '../components/ui/PageHeader'
import { AssetLineChart, CashFlowBarChart, AssetDoughnut } from '../components/charts/AppCharts'

// ── Sparkline SVG nhỏ gọn cho KPI card — không dùng Chart.js cho trang trí nhẹ ──
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null
  const w = 100, h = 32
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TONES = {
  blue:   { badge: 'bg-blue-50 text-cblue',   line: '#2563eb' },
  green:  { badge: 'bg-emerald-50 text-cgreen', line: '#16a34a' },
  purple: { badge: 'bg-violet-50 text-cpurple', line: '#7c3aed' },
  red:    { badge: 'bg-rose-50 text-cred',    line: '#ef4444' },
  amber:  { badge: 'bg-amber-50 text-cyellow', line: '#f59e0b' },
  teal:   { badge: 'bg-teal-50 text-cteal',   line: '#0d9488' },
}

// ── KPI Card kiểu Stripe: icon badge + trend delta + sparkline ──
function StatCard({ icon: Icon, label, value, sub, trend, sparkData, tone = 'blue' }) {
  const t    = TONES[tone] ?? TONES.blue
  const isUp = typeof trend === 'number' && trend >= 0
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.badge}`}>
          <Icon size={18} strokeWidth={2} />
        </span>
        {trend != null && (
          <span className={`flex items-center gap-0.5 text-[12px] font-bold shrink-0 ${isUp ? 'text-cgreen' : 'text-cred'}`}>
            {isUp ? <ArrowUpRight size={13} strokeWidth={2.6} /> : <ArrowDownRight size={13} strokeWidth={2.6} />}
            {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="text-[12px] font-semibold text-muted mb-1 truncate">{label}</div>
      <div className="text-xl font-bold text-text tabular-nums leading-tight truncate">{value}</div>
      {sub && <div className="text-[12px] text-subtle mt-1 truncate">{sub}</div>}
      {sparkData && <div className="mt-3 -mx-1"><Sparkline data={sparkData} color={t.line} /></div>}
    </div>
  )
}

// Chênh lệch % kỳ này so với kỳ trước — thuần suy ra từ dữ liệu quarters đã tính sẵn.
function calcTrend(quarters, key, invert = false) {
  if (quarters.length < 2) return null
  const prev = quarters[quarters.length - 2]?.[key]
  const curr = quarters[quarters.length - 1]?.[key]
  if (!prev) return null
  const pct = ((curr - prev) / Math.abs(prev)) * 100
  return invert ? -pct : pct
}

export default function Dashboard() {
  const { state, getAlloc } = useApp()
  const { assumptions } = state

  const quarters = useMemo(() => computeQuarters(assumptions), [assumptions])
  const last  = quarters[quarters.length - 1]
  const first = quarters[0]
  const growth = last && assumptions.initialCash > 0
    ? ((last.totalAssets / assumptions.initialCash)).toFixed(1) + 'x'
    : '—'

  const kpis = [
    {
      label: 'Tổng Tài Sản Ròng', value: fmtVND(last?.totalAssets), sub: `Cuối quý ${assumptions.numQuarters}`,
      icon: Wallet, tone: 'green', trend: calcTrend(quarters, 'totalAssets'), sparkData: quarters.map(q => q.totalAssets),
    },
    {
      label: 'Danh Mục Đầu Tư', value: fmtVND(last?.portfolio), sub: `Lãi kép ${assumptions.investYieldPerYear}%/năm`,
      icon: TrendingUp, tone: 'blue', trend: calcTrend(quarters, 'portfolio'), sparkData: quarters.map(q => q.portfolio),
    },
    {
      label: 'Tiền Mặt Dự Phòng', value: fmtVND(last?.closingCash), sub: `Tối thiểu ${fmtVND(assumptions.minCashReserve)}`,
      icon: PiggyBank, tone: 'purple', trend: calcTrend(quarters, 'closingCash'), sparkData: quarters.map(q => q.closingCash),
    },
    {
      label: 'Dư Nợ Ngân Hàng', value: fmtVND(last?.debt), sub: `Gốc ${fmtVND(assumptions.bankDebt)} · ${assumptions.bankRate}%/năm`,
      icon: Landmark, tone: last?.debt === 0 ? 'green' : 'red', trend: calcTrend(quarters, 'debt', true), sparkData: quarters.map(q => q.debt),
    },
    {
      label: 'Lợi Nhuận Kinh Doanh', value: fmtVND(last?.profit), sub: `Tăng ${assumptions.profitGrowthPerYear}%/năm`,
      icon: Briefcase, tone: 'amber', trend: calcTrend(quarters, 'profit'), sparkData: quarters.map(q => q.profit),
    },
    {
      label: 'Tăng Trưởng Tài Sản', value: growth, sub: `Từ ${fmtVND(assumptions.initialCash)} vốn ban đầu`,
      icon: Rocket, tone: 'teal', sparkData: quarters.map(q => q.totalAssets / (assumptions.initialCash || 1)),
    },
  ]

  // "Top Product" quy đổi sang bối cảnh tài chính cá nhân: phân bổ danh mục theo tỉ trọng mục tiêu.
  const alloc = getAlloc() || {}
  const allocList = Object.entries(alloc)
    .map(([key, pct]) => ({ key, pct, label: ALLOC_LABELS[key] ?? key, color: ALLOC_COLORS[key] ?? '#94a3b8' }))
    .filter(a => a.pct > 0)
    .sort((a, b) => b.pct - a.pct)

  // Timeline hoạt động gần đây — lấy N quý cuối cùng đã tính sẵn, hiển thị mới nhất trước.
  const recentQuarters = [...quarters].slice(-6).reverse()

  return (
    <div className="w-full">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        subtitle="Tổng quan tài sản & dòng tiền"
        actions={
          <button onClick={() => window.print()} className="btn-ghost">
            <Printer size={16} strokeWidth={2} /> In báo cáo
          </button>
        }
      />
    <div className="p-6 max-w-7xl">

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-6">
        {kpis.map(k => <StatCard key={k.label} {...k} />)}
      </div>

      {/* ── Chart chính + Phân bổ danh mục ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 text-cardtitle font-semibold text-text mb-4">
            <TrendingUp size={18} className="text-cblue" />
            Tổng Tài Sản Ròng – {assumptions.numQuarters} Quý
          </div>
          <div className="h-72"><AssetLineChart quarters={quarters} /></div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-cardtitle font-semibold text-text mb-4">
            <PieChart size={18} className="text-cpurple" />
            Phân Bổ Danh Mục
          </div>
          <div className="flex flex-col gap-3.5">
            {allocList.map(a => (
              <div key={a.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.color }} />
                    <span className="text-[14px] font-medium text-text truncate">{a.label}</span>
                  </div>
                  <span className="text-[14px] font-bold text-text tabular-nums shrink-0">{a.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface2 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${a.pct}%`, background: a.color }} />
                </div>
              </div>
            ))}
            {allocList.length === 0 && (
              <div className="text-[14px] text-muted text-center py-6">Chưa có phân bổ danh mục</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Dòng tiền + Cơ cấu cuối kỳ ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 text-cardtitle font-semibold text-text mb-4">
            <Banknote size={18} className="text-cgreen" />
            Dòng Tiền & Đầu Tư Theo Quý
          </div>
          <div className="h-72"><CashFlowBarChart quarters={quarters} /></div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 text-cardtitle font-semibold text-text mb-4">
            <Landmark size={18} className="text-cteal" />
            Cơ Cấu Tài Sản Năm Cuối
          </div>
          <div className="h-72">{last && <AssetDoughnut lastQ={last} />}</div>
        </div>
      </div>

      {/* ── Timeline hoạt động gần đây ── */}
      <div className="card">
        <div className="flex items-center gap-2 text-cardtitle font-semibold text-text mb-5">
          <Clock size={18} className="text-cblue" />
          Hoạt Động Gần Đây
        </div>
        <div className="flex flex-col">
          {recentQuarters.map((q, i) => {
            const isProfit = q.profit >= 0
            const isLast   = i === recentQuarters.length - 1
            return (
              <div key={q.q} className="flex gap-4">
                {/* Connector */}
                <div className="flex flex-col items-center shrink-0">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${isProfit ? 'bg-cgreen' : 'bg-cred'}`} />
                  {!isLast && <span className="w-px flex-1 bg-border mt-1" />}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pb-5 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-text">Quý {q.q}</div>
                    <div className="text-[12px] text-muted mt-0.5">
                      Tài sản ròng: <span className="font-medium text-text">{fmtVNDFull(q.totalAssets)}</span>
                    </div>
                  </div>
                  <span className={`text-[12px] font-bold px-2.5 py-0.5 rounded-full ${isProfit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {isProfit ? '+' : ''}{fmtVND(q.profit)} lợi nhuận
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
    </div>
  )
}
