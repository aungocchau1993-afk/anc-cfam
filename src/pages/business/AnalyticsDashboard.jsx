import { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import {
  loadCurrentMonthStats,
  loadDailyRevenue,
  loadTopSellingProducts,
  loadTopDebtors,
  loadLowStockProducts,
  loadMonthlyPnl,
} from '../../lib/supabase'
import { fmtVNDFull } from '../../lib/formatters'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement,
  Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

// ── useCountUp hook ────────────────────────────────────────────────────────

function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (!target) { setVal(0); return }
    let start = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

// ── Quick Stat Card ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, gradient, textColor }) {
  const animated = useCountUp(value)
  return (
    <div className={`relative rounded-2xl border p-5 overflow-hidden ${gradient}`}>
      <div className="absolute -top-4 -right-4 text-6xl opacity-10 select-none">{icon}</div>
      <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-2xl font-black tabular-nums leading-tight ${textColor}`}>
        {fmtVNDFull(animated)}
      </div>
      {sub && <div className="text-[11px] text-slate-500 mt-1.5">{sub}</div>}
    </div>
  )
}

// ── Chart options ──────────────────────────────────────────────────────────

const TICK  = { color: '#6b7280', font: { size: 11 } }
const GRID  = { color: 'rgba(55,65,81,0.5)' }
const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12 } } },
  scales: {
    x: { ticks: TICK, grid: GRID },
    y: { ticks: { ...TICK, callback: v => v >= 1e6 ? `${(v/1e6).toFixed(0)}tr` : v }, grid: GRID },
  },
}

// ── Debt reminder helper ───────────────────────────────────────────────────

function fmtPhone(p) {
  if (!p) return ''
  return String(p).replace(/\D/g, '').replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3')
}

function sendDebtReminder(customer) {
  const msg = `Kính gửi ${customer.fullName}, hệ thống ghi nhận bạn đang có công nợ ${fmtVNDFull(customer.currentDebt)}. Vui lòng liên hệ để thanh toán. Xin cảm ơn!`
  if (customer.phone) {
    const phone = String(customer.phone).replace(/\D/g, '')
    window.open(`https://wa.me/84${phone.replace(/^0/, '')}?text=${encodeURIComponent(msg)}`, '_blank')
  } else {
    navigator.clipboard?.writeText(msg)
    toast.success('Đã copy nội dung nhắc nợ vào clipboard')
  }
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [stats,       setStats]       = useState(null)
  const [daily,       setDaily]       = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [debtors,     setDebtors]     = useState([])
  const [lowStock,    setLowStock]    = useState([])
  const [monthlyPnl,  setMonthlyPnl]  = useState([])
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadCurrentMonthStats(),
      loadDailyRevenue(7),
      loadTopSellingProducts(5),
      loadTopDebtors(5),
      loadLowStockProducts(8),
      loadMonthlyPnl(6),
    ]).then(([s, d, tp, deb, ls, mp]) => {
      setStats(s)
      setDaily(d)
      setTopProducts(tp)
      setDebtors(deb)
      setLowStock(ls)
      setMonthlyPnl([...mp].reverse())
    }).catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`

  // ── Chart data: 7-ngày doanh thu vs lợi nhuận ────────────────────────────
  const lineData = useMemo(() => ({
    labels: daily.map(d => d.date),
    datasets: [
      {
        label: 'Doanh thu',
        data:  daily.map(d => d.revenue),
        borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)',
        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#3b82f6',
      },
      {
        label: 'Lợi nhuận',
        data:  daily.map(d => d.profit),
        borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)',
        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#10b981',
      },
    ],
  }), [daily])

  // ── Chart data: 6-tháng P&L bar ──────────────────────────────────────────
  const barData = useMemo(() => ({
    labels: monthlyPnl.map(m => m.month_year),
    datasets: [
      { label: 'Doanh thu', data: monthlyPnl.map(m => m.total_revenue), backgroundColor: 'rgba(59,130,246,0.7)', borderRadius: 4 },
      { label: 'Chi phí',   data: monthlyPnl.map(m => m.total_opex),    backgroundColor: 'rgba(239,68,68,0.6)',  borderRadius: 4 },
      { label: 'Lãi ròng',  data: monthlyPnl.map(m => m.net_profit),    backgroundColor: 'rgba(16,185,129,0.8)', borderRadius: 4 },
    ],
  }), [monthlyPnl])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        <svg className="w-6 h-6 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
        </svg>
        Đang tải dữ liệu phân tích…
      </div>
    )
  }

  return (
    <div className="px-5 pt-3 pb-6 max-w-7xl flex flex-col gap-5">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-[#e6edf3]">📊 Bộ Não Điều Hành</h2>
          <p className="text-xs text-slate-500 mt-0.5">Analytics & P&L Real-time · {monthLabel}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs hover:text-[#e6edf3] hover:border-slate-500 transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Hàng 1: 3 trụ cột tài chính cốt lõi ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Doanh thu */}
        <StatCard
          label="Tổng Doanh Thu"
          value={stats?.totalRevenue ?? 0}
          sub="Tiền thực nhận từ khách"
          icon="💰" textColor="text-blue-400"
          gradient="bg-blue-950/40 border-blue-800/40"
        />
        {/* Giá vốn */}
        <StatCard
          label="Giá Vốn Hàng Bán (COGS)"
          value={stats?.totalCOGS ?? 0}
          sub="SUM(giá nhập × số lượng bán)"
          icon="🏭" textColor="text-orange-400"
          gradient="bg-orange-950/40 border-orange-800/40"
        />
        {/* Lãi gộp */}
        <StatCard
          label="Lãi Gộp (Gross Profit)"
          value={Math.abs(stats?.grossProfit ?? 0)}
          sub={(() => {
            const gp = stats?.grossProfit ?? 0
            const rev = stats?.totalRevenue ?? 0
            const margin = rev > 0 ? ((gp / rev) * 100).toFixed(1) : 0
            return gp >= 0 ? `✅ Biên lợi nhuận ${margin}%` : `⚠️ Đang lỗ gộp ${margin}%`
          })()}
          icon="📈"
          textColor={(stats?.grossProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
          gradient={(stats?.grossProfit ?? 0) >= 0 ? 'bg-emerald-950/40 border-emerald-800/40' : 'bg-red-950/40 border-red-800/40'}
        />
      </div>

      {/* ── Hàng 2: Chi phí & Lãi ròng & Công nợ ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Chi Phí Vận Hành (OPEX)"
          value={stats?.totalOpex ?? 0}
          sub="Sổ Quỹ — phiếu CHI"
          icon="📤" textColor="text-red-400"
          gradient="bg-red-950/40 border-red-800/40"
        />
        <StatCard
          label="Lãi Ròng Tháng"
          value={Math.abs(stats?.netProfit ?? 0)}
          sub={(stats?.netProfit ?? 0) >= 0 ? '✅ Lãi ròng = Lãi gộp − OPEX + Thu sổ quỹ' : '⚠️ Đang lỗ ròng'}
          icon="🏆"
          textColor={(stats?.netProfit ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}
          gradient={(stats?.netProfit ?? 0) >= 0 ? 'bg-emerald-950/40 border-emerald-800/40' : 'bg-red-950/40 border-red-800/40'}
        />
        <StatCard
          label="Tổng Khách Còn Nợ"
          value={stats?.totalDebt ?? 0}
          sub={`${debtors.length} khách đang nợ`}
          icon="⚠️" textColor="text-amber-400"
          gradient="bg-amber-950/40 border-amber-800/40"
        />
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 7-day trend */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-sm font-bold text-[#e6edf3] mb-1">📉 Xu Hướng 7 Ngày Gần Nhất</div>
          <div className="text-[11px] text-slate-500 mb-4">Doanh thu & lợi nhuận theo ngày</div>
          <div className="h-52">
            <Line data={lineData} options={chartOpts} />
          </div>
        </div>

        {/* 6-month P&L */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="text-sm font-bold text-[#e6edf3] mb-1">📊 P&L 6 Tháng Gần Nhất</div>
          <div className="text-[11px] text-slate-500 mb-4">Doanh thu · Chi phí · Lãi ròng</div>
          <div className="h-52">
            <Bar data={barData} options={chartOpts} />
          </div>
        </div>
      </div>

      {/* ── Bottom 3 panels ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Top sản phẩm */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <span className="text-base">🏆</span>
            <span className="text-sm font-bold text-[#e6edf3]">Top Bán Chạy</span>
            <span className="text-[10px] text-slate-500 ml-auto">Theo số lượng</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {topProducts.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-600 text-xs">Chưa có dữ liệu</div>
            )}
            {topProducts.map((p, i) => (
              <div key={p.productId} className="px-4 py-2.5 flex items-center gap-3">
                <span className={`text-[11px] font-black w-5 text-center tabular-nums shrink-0
                  ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-slate-600'}`}>
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#e6edf3] truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-emerald-400 tabular-nums">{p.totalQty.toLocaleString('vi-VN')} sp</div>
                  <div className="text-[10px] text-slate-500 font-mono">{fmtVNDFull(p.totalRevenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top debtors */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
            <span className="text-base">💸</span>
            <span className="text-sm font-bold text-[#e6edf3]">Khách Nợ Nhiều</span>
            <span className="text-[10px] text-slate-500 ml-auto">Top {debtors.length}</span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {debtors.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-600 text-xs">Không có khách nợ 🎉</div>
            )}
            {debtors.map((c, i) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#e6edf3] truncate">{c.fullName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{fmtPhone(c.phone)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-red-400 tabular-nums">{fmtVNDFull(c.currentDebt)}</div>
                  {c.creditLimit > 0 && (
                    <div className="text-[10px] text-slate-600">/ {fmtVNDFull(c.creditLimit)}</div>
                  )}
                </div>
                <button
                  onClick={() => sendDebtReminder(c)}
                  title="Gửi nhắc nợ"
                  className="shrink-0 w-7 h-7 rounded-lg border border-slate-700 text-slate-500 hover:border-amber-500/60 hover:text-amber-400 hover:bg-amber-500/10 transition-colors flex items-center justify-center"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alert */}
        <div className="rounded-2xl border border-amber-800/40 bg-amber-950/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-800/30 flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span className="text-sm font-bold text-amber-400">Cần Nhập Gấp</span>
            <span className="text-[10px] text-slate-500 ml-auto">Dưới mức tối thiểu</span>
          </div>
          <div className="divide-y divide-amber-800/20">
            {lowStock.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-600 text-xs">Tồn kho ổn định ✅</div>
            )}
            {lowStock.map(p => (
              <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#e6edf3] truncate">{p.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-black tabular-nums ${p.stockQuantity <= 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {p.stockQuantity}
                  </div>
                  <div className="text-[10px] text-slate-600">min {p.minStock}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
