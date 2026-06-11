import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { loadOrdersByDateRange, computeOrderCOGS, computeOrderRevenue } from '../../lib/supabase'
import { fmtVNDFull } from '../../lib/formatters'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

// ── Date helpers ───────────────────────────────────────────────────────────

function startOf(unit, ref = new Date()) {
  const d = new Date(ref)
  if (unit === 'day')     { d.setHours(0,0,0,0); return d }
  if (unit === 'week')    { d.setHours(0,0,0,0); d.setDate(d.getDate() - d.getDay() + 1); return d }
  if (unit === 'month')   { return new Date(d.getFullYear(), d.getMonth(), 1) }
  if (unit === 'quarter') {
    const q = Math.floor(d.getMonth() / 3)
    return new Date(d.getFullYear(), q * 3, 1)
  }
  if (unit === 'year')    { return new Date(d.getFullYear(), 0, 1) }
  return d
}

function endOf(unit, ref = new Date()) {
  const d = new Date(ref)
  if (unit === 'day')     { d.setHours(23,59,59,999); return d }
  if (unit === 'week')    { const s = startOf('week', ref); return new Date(s.getTime() + 6*86400000 + 86399999) }
  if (unit === 'month')   { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999) }
  if (unit === 'quarter') {
    const q = Math.floor(d.getMonth() / 3)
    return new Date(d.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
  }
  if (unit === 'year')    { return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999) }
  return d
}

function fmtDateShort(iso) {
  return new Date(iso).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' })
}

function fmtDatetime(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })
}

function toInputDate(d) {
  return d.toISOString().slice(0, 10)
}

// Group orders theo ngày để vẽ chart
function groupByDay(orders) {
  const map = {}
  for (const o of orders) {
    if (o.status === 'cancelled') continue
    const key = new Date(o.created_at).toLocaleDateString('vi-VN', { day:'2-digit', month:'2-digit' })
    if (!map[key]) map[key] = { revenue: 0, profit: 0 }
    map[key].revenue += o.total_amount || 0
    map[key].profit  += o.profit       || 0
  }
  return map
}

// ── Filter presets ─────────────────────────────────────────────────────────

const PRESETS = [
  { id: 'today',   label: 'Hôm nay' },
  { id: 'week',    label: 'Tuần này' },
  { id: 'month',   label: 'Tháng này' },
  { id: 'quarter', label: 'Quý này' },
  { id: 'year',    label: 'Năm này' },
  { id: 'custom',  label: '📅 Tùy chọn' },
]

function getRange(preset, customFrom, customTo) {
  if (preset === 'today')   return { from: startOf('day'),    to: endOf('day') }
  if (preset === 'week')    return { from: startOf('week'),   to: endOf('week') }
  if (preset === 'month')   return { from: startOf('month'),  to: endOf('month') }
  if (preset === 'quarter') return { from: startOf('quarter'),to: endOf('quarter') }
  if (preset === 'year')    return { from: startOf('year'),   to: endOf('year') }
  if (preset === 'custom' && customFrom && customTo) {
    const from = new Date(customFrom); from.setHours(0,0,0,0)
    const to   = new Date(customTo);   to.setHours(23,59,59,999)
    return { from, to }
  }
  return { from: startOf('month'), to: endOf('month') }
}

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    completed: { l: 'Hoàn thành', c: 'bg-cgreen/15 text-cgreen border-cgreen/30' },
    pending:   { l: 'Chờ xử lý',  c: 'bg-cyellow/15 text-cyellow border-cyellow/30' },
    cancelled: { l: 'Đã huỷ',     c: 'bg-cred/15 text-cred border-cred/30' },
  }
  const s = map[status] || { l: status, c: 'bg-surface2 text-muted border-border' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${s.c}`}>
      {s.l}
    </span>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ProfitReport() {
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(false)
  const [preset,  setPreset]  = useState('month')
  const [customFrom, setCustomFrom] = useState(toInputDate(startOf('month')))
  const [customTo,   setCustomTo]   = useState(toInputDate(new Date()))

  // Fetch khi preset / custom range thay đổi
  const fetchOrders = useCallback(async () => {
    const { from, to } = getRange(preset, customFrom, customTo)
    if (!from || !to || from > to) return
    setLoading(true)
    try {
      const data = await loadOrdersByDateRange(from, to)
      setOrders(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [preset, customFrom, customTo])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ── Computed stats — công thức chuẩn ─────────────────────────
  const stats = useMemo(() => {
    // Chỉ đơn xuất hàng đã hoàn thành
    const done = orders.filter(o => o.status === 'completed' && o.type !== 'import')

    // Doanh thu = tiền thực nhận (paid_amount), fallback total_amount
    const revenue = done.reduce((s, o) => s + computeOrderRevenue(o), 0)

    // COGS = SUM(cost × qty) từ order_items — giá vốn thực tế
    const cogs    = done.reduce((s, o) => s + computeOrderCOGS(o), 0)

    // Lãi gộp = Doanh thu − Giá vốn
    const grossProfit = revenue - cogs

    // Margin gộp
    const margin  = revenue > 0 ? (grossProfit / revenue * 100).toFixed(1) : 0
    const count   = done.length
    const avgOrder = count > 0 ? revenue / count : 0

    return { revenue, cogs, profit: grossProfit, margin, count, avgOrder }
  }, [orders])

  // ── Chart data ────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const grouped = groupByDay(orders)
    const labels  = Object.keys(grouped)
    return {
      labels,
      datasets: [
        {
          label: 'Doanh thu',
          data: labels.map(k => grouped[k].revenue / 1e6),
          backgroundColor: 'rgba(88,166,255,0.7)',
          borderRadius: 4,
        },
        {
          label: 'Lợi nhuận',
          data: labels.map(k => grouped[k].profit / 1e6),
          backgroundColor: 'rgba(63,185,80,0.7)',
          borderRadius: 4,
        },
      ],
    }
  }, [orders])

  const TICK  = { color: '#8b949e', font: { size: 11 } }
  const GRID  = { color: 'rgba(48,54,61,.5)' }
  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8b949e', font: { size: 12 } } } },
    scales: {
      x: { ticks: TICK, grid: GRID },
      y: { ticks: { ...TICK, callback: v => `${v}tr` }, grid: GRID },
    },
  }

  // ── Totals row ────────────────────────────────────────────────
  const totals = useMemo(() => {
    const done = orders.filter(o => o.status === 'completed' && o.type !== 'import')
    const revenue = done.reduce((s, o) => s + computeOrderRevenue(o), 0)
    const cogs    = done.reduce((s, o) => s + computeOrderCOGS(o), 0)
    return { revenue, cogs, profit: revenue - cogs }
  }, [orders])

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="p-6 w-full flex flex-col gap-5">

      {/* ── Filter bar ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => setPreset(p.id)}
            className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
              preset === p.id
                ? 'bg-cblue/20 border-cblue text-cblue'
                : 'bg-surface border-border text-muted hover:border-cblue/40 hover:text-[#e6edf3]'
            }`}>
            {p.label}
          </button>
        ))}

        {preset === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-cblue transition-all" />
            <span className="text-muted text-sm">→</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-cblue transition-all" />
          </div>
        )}

        <button onClick={fetchOrders} disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted text-sm hover:border-cblue hover:text-cblue transition-colors disabled:opacity-50">
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none">
            <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 9a8 8 0 0114.9-2.1M20 15a8 8 0 01-14.9 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {/* ── 3 cột tài chính cốt lõi ─────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: 'Tổng Doanh Thu',
            sub:   'Tiền thực nhận từ khách',
            value: fmtVNDFull(stats.revenue),
            color: 'text-cblue', bg: 'bg-cblue/8 border-cblue/25', icon: '💰',
          },
          {
            label: 'Giá Vốn Hàng Bán (COGS)',
            sub:   'SUM(giá nhập × số lượng bán)',
            value: fmtVNDFull(stats.cogs),
            color: 'text-orange-400', bg: 'bg-orange-500/8 border-orange-500/25', icon: '🏭',
          },
          {
            label: 'Lãi Gộp (Gross Profit)',
            sub:   `Doanh thu − COGS · Biên ${stats.margin}%`,
            value: fmtVNDFull(stats.profit),
            color: Number(stats.profit) >= 0 ? 'text-cgreen' : 'text-cred',
            bg:    Number(stats.profit) >= 0 ? 'bg-cgreen/8 border-cgreen/25' : 'bg-cred/8 border-cred/25',
            icon: '📈',
          },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border p-5 relative overflow-hidden ${k.bg}`}>
            <div className="absolute top-3 right-4 text-3xl opacity-10">{k.icon}</div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">{k.label}</div>
            <div className={`text-2xl font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
            <div className="text-[11px] text-slate-500 mt-1.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── KPI phụ ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Biên lợi nhuận gộp', value: `${stats.margin}%`,         color: Number(stats.margin) >= 20 ? 'text-cgreen' : 'text-cyellow', icon: '🎯' },
          { label: 'Số đơn hoàn thành',  value: String(stats.count),        color: 'text-cpurple', icon: '🧾' },
          { label: 'Doanh thu TB/đơn',   value: fmtVNDFull(stats.avgOrder), color: 'text-cteal',   icon: '📊' },
        ].map(k => (
          <div key={k.label} className="card p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-2xl opacity-20">{k.icon}</div>
            <div className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1.5">{k.label}</div>
            <div className={`text-xl font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Chart ─────────────────────────────────────── */}
      {chartData.labels.length > 0 && (
        <div className="card">
          <div className="text-sm font-semibold text-muted mb-4">📊 Doanh thu & Lợi nhuận theo ngày (triệu ₫)</div>
          <div className="h-56">
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* ── Orders table ──────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xl shadow-black/20">
        <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
          <div className="text-sm font-bold">Chi tiết đơn hàng</div>
          <span className="tag-blue">{orders.length} đơn</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted text-sm">Đang tải…</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <div className="text-4xl mb-2">📊</div>
            <div className="font-semibold">Không có đơn hàng trong khoảng thời gian này</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="bg-[#0a0e14] border-b border-border">
                  {['Mã đơn', 'Thời gian', 'Khách hàng', 'Sản phẩm', 'Doanh thu', 'Giá vốn', 'Lợi nhuận', 'Trạng thái'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map(ord => {
                  const cogs    = (ord.total_amount || 0) - (ord.profit || 0)
                  const isCancelled = ord.status === 'cancelled'
                  const items   = ord.order_items || []
                  const preview = items.slice(0, 2).map(i => i.products?.name || '—').join(', ')
                    + (items.length > 2 ? ` +${items.length - 2}` : '')

                  return (
                    <tr key={ord.id}
                      className={`border-b border-border/40 last:border-0 transition-colors ${
                        isCancelled ? 'opacity-40' : 'hover:bg-slate-800/30'
                      }`}>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs bg-surface2 border border-border px-2 py-0.5 rounded text-muted">
                          #{ord.id.slice(-8).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted whitespace-nowrap">
                        {fmtDatetime(ord.created_at)}
                      </td>
                      <td className="px-4 py-3.5 text-sm">
                        {ord.customers
                          ? <span className="text-cpurple font-semibold">{ord.customers.full_name}</span>
                          : <span className="text-muted italic">Khách lẻ</span>
                        }
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted max-w-[180px]">
                        <div className="truncate" title={items.map(i => i.products?.name).join(', ')}>
                          {preview || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold text-[#e6edf3] tabular-nums whitespace-nowrap">
                        {fmtVNDFull(ord.total_amount)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-sm text-muted tabular-nums whitespace-nowrap">
                        {fmtVNDFull(cogs)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <span className={`font-mono text-sm font-bold tabular-nums ${ord.profit >= 0 ? 'text-cgreen' : 'text-cred'}`}>
                          {fmtVNDFull(ord.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={ord.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-cblue/30 bg-cblue/5">
                  <td colSpan={4} className="px-4 py-3.5 text-sm font-black text-cblue">
                    Tổng cộng ({orders.filter(o => o.status === 'completed').length} đơn hoàn thành)
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-black text-cblue tabular-nums whitespace-nowrap">
                    {fmtVNDFull(totals.revenue)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-black text-muted tabular-nums whitespace-nowrap">
                    {fmtVNDFull(totals.cogs)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono font-black text-cgreen tabular-nums whitespace-nowrap">
                    {fmtVNDFull(totals.profit)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs text-muted font-semibold">
                      Biên: {stats.margin}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
