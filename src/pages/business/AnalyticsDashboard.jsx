import { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import {
  loadCurrentMonthStats,
  loadDailyRevenue,
  loadTopSellingProducts,
  loadTopDebtors,
  loadLowStockProducts,
  loadMonthlyPnl,
  loadInventoryIntelligence,
  loadCashflowForecast,
} from '../../lib/supabase'
import { fmtVNDFull } from '../../lib/formatters'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler,
} from 'chart.js'
import { Line, Bar, Pie } from 'react-chartjs-2'
import {
  LayoutDashboard, RefreshCw, DollarSign, Factory, TrendingUp,
  Send as SendIcon, TrendingDown, Trophy, AlertTriangle, Brain,
  PiggyBank, ShieldAlert, PartyPopper, CheckCircle2,
  LineChart as LineChartIcon, PieChart as PieChartIcon, BarChart3,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

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

function StatCard({ label, value, sub, icon: Icon, tone, textColor }) {
  const animated = useCountUp(value)
  return (
    <div className="card relative overflow-hidden">
      {Icon && <Icon size={72} strokeWidth={1.5} className={`absolute -top-3 -right-3 opacity-[0.07] ${textColor}`} />}
      <div className="text-[12px] text-muted font-semibold uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-2xl font-black tabular-nums leading-tight ${textColor}`}>
        {fmtVNDFull(animated)}
      </div>
      {sub && <div className="text-[12px] text-subtle mt-1.5">{sub}</div>}
    </div>
  )
}

// ── Chart options (đồng bộ với LIGHT_BASE_OPTS trong AppCharts.jsx) ────────

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
const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: LEGEND_LIGHT, tooltip: TOOLTIP_LIGHT },
  scales: {
    x: { ticks: TICK_LIGHT, grid: { display: false }, border: { display: false } },
    y: { ticks: { ...TICK_LIGHT, callback: v => v >= 1e6 ? `${(v/1e6).toFixed(0)}tr` : v }, grid: GRID_LIGHT, border: { display: false } },
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
  const [inventory,   setInventory]   = useState([])
  const [cashflow,    setCashflow]    = useState(null)
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadCurrentMonthStats(),
      loadDailyRevenue(30),       // 30 ngày cho đủ dữ liệu lợi nhuận
      loadTopSellingProducts(8),
      loadTopDebtors(5),
      loadLowStockProducts(8),
      loadMonthlyPnl(6),
      loadInventoryIntelligence(12),
      loadCashflowForecast(),
    ]).then(([s, d, tp, deb, ls, mp, inv, cf]) => {
      setStats(s)
      setDaily(d)
      setTopProducts(tp)
      setDebtors(deb)
      setLowStock(ls)
      setMonthlyPnl([...mp].reverse())
      setInventory(inv)
      setCashflow(cf)
    }).catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  const now = new Date()
  const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`

  // ── Chart data: 30-ngày lợi nhuận (line) ────────────────────────────────
  const lineData = useMemo(() => ({
    labels: daily.map(d => d.date),
    datasets: [
      {
        label: 'Doanh thu',
        data:  daily.map(d => d.revenue),
        borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.08)',
        fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: '#2563eb', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, borderWidth: 2.5,
      },
      {
        label: 'Lợi nhuận',
        data:  daily.map(d => d.profit),
        borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.06)',
        fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 5,
        pointHoverBackgroundColor: '#16a34a', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, borderWidth: 2,
      },
    ],
  }), [daily])

  // ── Chart data: Pie — tỷ trọng doanh thu top sản phẩm ───────────────────
  const PIE_COLORS = [
    '#2563eb', '#16a34a', '#f59e0b',
    '#7c3aed', '#ef4444', '#0d9488',
    '#f97316', '#6366f1',
  ]
  const pieData = useMemo(() => {
    const top = topProducts.slice(0, 8)
    return {
      labels: top.map(p => p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name),
      datasets: [{
        data:            top.map(p => p.totalRevenue),
        backgroundColor: PIE_COLORS.slice(0, top.length),
        borderColor:     '#ffffff',
        borderWidth:     2,
      }],
    }
  }, [topProducts])

  // ── Chart data: 6-tháng P&L bar ──────────────────────────────────────────
  const barData = useMemo(() => ({
    labels: monthlyPnl.map(m => m.month_year),
    datasets: [
      { label: 'Doanh thu', data: monthlyPnl.map(m => m.total_revenue), backgroundColor: '#2563eb', borderRadius: 4, maxBarThickness: 28 },
      { label: 'Chi phí',   data: monthlyPnl.map(m => m.total_opex),    backgroundColor: '#ef4444', borderRadius: 4, maxBarThickness: 28 },
      { label: 'Lãi ròng',  data: monthlyPnl.map(m => m.net_profit),    backgroundColor: '#16a34a', borderRadius: 4, maxBarThickness: 28 },
    ],
  }), [monthlyPnl])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted gap-2">
        <RefreshCw size={18} className="animate-spin" />
        Đang tải dữ liệu phân tích…
      </div>
    )
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={LayoutDashboard}
        title="Tổng Quan"
        subtitle={`Analytics & P&L Real-time · ${monthLabel}`}
        actions={
          <button onClick={() => window.location.reload()} className="btn-ghost">
            <RefreshCw size={15} strokeWidth={2.2} /> Refresh
          </button>
        }
      />
    <div className="p-6 max-w-7xl flex flex-col gap-5">

      {/* ── Hàng 1: 3 trụ cột tài chính cốt lõi ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Doanh thu */}
        <StatCard
          label="Tổng Doanh Thu"
          value={stats?.totalRevenue ?? 0}
          sub="Tiền thực nhận từ khách"
          icon={DollarSign} textColor="text-cblue"
        />
        {/* Giá vốn */}
        <StatCard
          label="Giá Vốn Hàng Bán (COGS)"
          value={stats?.totalCOGS ?? 0}
          sub="SUM(giá nhập × số lượng bán)"
          icon={Factory} textColor="text-cyellow"
        />
        {/* Lãi gộp */}
        <StatCard
          label="Lãi Gộp (Gross Profit)"
          value={Math.abs(stats?.grossProfit ?? 0)}
          sub={(() => {
            const gp = stats?.grossProfit ?? 0
            const rev = stats?.totalRevenue ?? 0
            const margin = rev > 0 ? ((gp / rev) * 100).toFixed(1) : 0
            return gp >= 0 ? `Biên lợi nhuận ${margin}%` : `Đang lỗ gộp ${margin}%`
          })()}
          icon={TrendingUp}
          textColor={(stats?.grossProfit ?? 0) >= 0 ? 'text-cgreen' : 'text-cred'}
        />
      </div>

      {/* ── Hàng 2: Chi phí & Lãi ròng & Công nợ ─────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Chi Phí Vận Hành (OPEX)"
          value={stats?.totalOpex ?? 0}
          sub="Sổ Quỹ — phiếu CHI"
          icon={TrendingDown} textColor="text-cred"
        />
        <StatCard
          label="Lãi Ròng Tháng"
          value={Math.abs(stats?.netProfit ?? 0)}
          sub={(stats?.netProfit ?? 0) >= 0 ? 'Lãi ròng = Lãi gộp − OPEX + Thu sổ quỹ' : 'Đang lỗ ròng'}
          icon={Trophy}
          textColor={(stats?.netProfit ?? 0) >= 0 ? 'text-cgreen' : 'text-cred'}
        />
        <StatCard
          label="Tổng Khách Còn Nợ"
          value={stats?.totalDebt ?? 0}
          sub={`${debtors.length} khách đang nợ`}
          icon={AlertTriangle} textColor="text-cyellow"
        />
      </div>

      {/* ── Charts row 1: line + pie ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 30-day profit trend */}
        <div className="card">
          <div className="flex items-center gap-2 text-cardtitle font-semibold text-text mb-1">
            <LineChartIcon size={18} className="text-cblue" />
            Lợi Nhuận Theo Ngày — 30 Ngày
          </div>
          <div className="text-[12px] text-muted mb-4">Doanh thu &amp; lợi nhuận hàng ngày</div>
          <div className="h-52">
            <Line data={lineData} options={chartOpts} />
          </div>
        </div>

        {/* Pie: revenue by product */}
        <div className="card">
          <div className="flex items-center gap-2 text-cardtitle font-semibold text-text mb-1">
            <PieChartIcon size={18} className="text-cpurple" />
            Tỷ Trọng Doanh Thu Theo Sản Phẩm
          </div>
          <div className="text-[12px] text-muted mb-4">Top sản phẩm đóng góp doanh thu</div>
          <div className="h-52 flex items-center justify-center">
            {topProducts.length > 0 ? (
              <Pie data={pieData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'right', labels: { color: '#475569', usePointStyle: true, pointStyle: 'circle', font: { size: 10, family: 'Inter' }, boxWidth: 8, padding: 10 } },
                  tooltip: { ...TOOLTIP_LIGHT, callbacks: { label: ctx => ` ${fmtVNDFull(ctx.raw)}` } },
                },
              }} />
            ) : (
              <div className="text-subtle text-xs">Chưa có dữ liệu</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Charts row 2: bar P&L ─────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-2 text-cardtitle font-semibold text-text mb-1">
          <BarChart3 size={18} className="text-cblue" />
          P&amp;L 6 Tháng Gần Nhất
        </div>
        <div className="text-[12px] text-muted mb-4">Doanh thu · Chi phí · Lãi ròng</div>
        <div className="h-52">
          <Bar data={barData} options={chartOpts} />
        </div>
      </div>

      {/* ── Cashflow Forecast ──────────────────────────────── */}
      {cashflow && (
        <div className={`rounded-2xl border p-6 shadow-card ${cashflow.warning ? 'border-rose-200 bg-rose-50/50' : 'border-border bg-surface'}`}>
          <div className="flex items-center gap-2 mb-3">
            {cashflow.warning
              ? <ShieldAlert size={18} className="text-cred" />
              : <PiggyBank size={18} className="text-cgreen" />}
            <div>
              <div className="text-cardtitle font-semibold text-text">Dự Báo Dòng Tiền — Nợ Nhà Cung Cấp</div>
              <div className="text-[12px] text-muted">Phân tích khả năng thanh toán dựa trên doanh thu 7 ngày</div>
            </div>
          </div>

          {/* Warning banner */}
          {cashflow.warning && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 leading-relaxed flex items-start gap-2">
              <AlertTriangle size={14} className="text-cred shrink-0 mt-0.5" />
              <span>
                <strong>Cảnh báo tài chính:</strong> Tổng nợ nhà cung cấp&nbsp;
                <span className="font-black text-cred">{fmtVNDFull(cashflow.totalPayable)}</span>&nbsp;
                vượt quá doanh thu 7 ngày gần nhất&nbsp;
                <span className="font-black">{fmtVNDFull(cashflow.recentRevenue7d)}</span>.
                Cần lên kế hoạch thu tiền hoặc đàm phán giãn nợ với nhà cung cấp.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Tổng phải trả */}
            <div className="rounded-xl border border-border bg-surface2 px-4 py-3">
              <div className="text-[12px] text-muted font-semibold uppercase tracking-wide mb-1">Tổng Nợ NCC</div>
              <div className={`text-xl font-black tabular-nums ${cashflow.totalPayable > 0 ? 'text-cred' : 'text-cgreen'}`}>
                {fmtVNDFull(cashflow.totalPayable)}
              </div>
              <div className="text-[12px] text-subtle mt-0.5">{cashflow.supplierDebts.length} nhà cung cấp</div>
            </div>

            {/* Doanh thu 7 ngày */}
            <div className="rounded-xl border border-border bg-surface2 px-4 py-3">
              <div className="text-[12px] text-muted font-semibold uppercase tracking-wide mb-1">Doanh Thu 7 Ngày</div>
              <div className="text-xl font-black tabular-nums text-cblue">{fmtVNDFull(cashflow.recentRevenue7d)}</div>
              <div className="text-[12px] text-subtle mt-0.5">Ước tính khả năng chi trả</div>
            </div>

            {/* Hệ số an toàn */}
            <div className="rounded-xl border border-border bg-surface2 px-4 py-3">
              <div className="text-[12px] text-muted font-semibold uppercase tracking-wide mb-1">Hệ Số An Toàn</div>
              {cashflow.totalPayable > 0 ? (
                <>
                  <div className={`text-xl font-black tabular-nums ${cashflow.recentRevenue7d >= cashflow.totalPayable ? 'text-cgreen' : 'text-cred'}`}>
                    {(cashflow.recentRevenue7d / cashflow.totalPayable).toFixed(2)}x
                  </div>
                  <div className="text-[12px] text-subtle mt-0.5">Doanh thu / Nợ (≥1 là an toàn)</div>
                </>
              ) : (
                <div className="text-xl font-black text-cgreen">∞ <span className="text-xs font-normal">Không nợ</span></div>
              )}
            </div>
          </div>

          {/* Danh sách NCC nợ nhiều */}
          {cashflow.supplierDebts.length > 0 && (
            <div className="mt-4 divide-y divide-border">
              {cashflow.supplierDebts.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2">
                  <span className="text-xs text-text truncate">{s.name}</span>
                  <span className="text-xs font-black text-cred tabular-nums shrink-0 ml-3">{fmtVNDFull(s.debt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Inventory Intelligence ─────────────────────────── */}
      {inventory.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Brain size={18} className="text-cpurple" />
            <div className="flex-1">
              <div className="text-cardtitle font-semibold text-text">Phân Tích Tồn Kho Thông Minh</div>
              <div className="text-[12px] text-muted">Dựa trên tốc độ bán ra 30 ngày qua</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[12px] font-semibold text-muted uppercase tracking-wide bg-surface2">
                  <th className="px-4 py-3.5 text-left">Sản phẩm</th>
                  <th className="px-3 py-3.5 text-center">Tồn kho</th>
                  <th className="px-3 py-3.5 text-center">Bán 30 ngày</th>
                  <th className="px-3 py-3.5 text-center">TB/ngày</th>
                  <th className="px-3 py-3.5 text-center">Còn đủ</th>
                  <th className="px-4 py-3.5 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {inventory.map(p => (
                  <tr key={p.id} className="hover:bg-surface2 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-text truncate max-w-[160px]">{p.name}</div>
                      <div className="text-[12px] text-subtle font-mono">{p.sku}</div>
                    </td>
                    <td className="px-3 py-3.5 text-center font-bold tabular-nums text-text">{p.stock.toLocaleString('vi-VN')}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums text-cblue font-semibold">{p.qty30.toLocaleString('vi-VN')}</td>
                    <td className="px-3 py-3.5 text-center tabular-nums text-muted">{p.avgDaily}</td>
                    <td className="px-3 py-3.5 text-center">
                      {p.daysLeft !== null ? (
                        <span className={`font-bold tabular-nums ${p.daysLeft <= 7 ? 'text-cred' : p.daysLeft <= 14 ? 'text-cyellow' : 'text-muted'}`}>
                          {p.daysLeft} ngày
                        </span>
                      ) : (
                        <span className="text-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-block text-[12px] font-bold border rounded-full px-2 py-0.5 whitespace-nowrap ${p.labelCls}`}>
                        {p.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Bottom 3 panels ────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Top sản phẩm */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
            <Trophy size={16} className="text-cyellow" />
            <span className="text-sm font-bold text-text">Top Bán Chạy</span>
            <span className="text-[12px] text-subtle ml-auto">Theo số lượng</span>
          </div>
          <div className="divide-y divide-border">
            {topProducts.length === 0 && (
              <div className="px-4 py-8 text-center text-subtle text-xs">Chưa có dữ liệu</div>
            )}
            {topProducts.map((p, i) => (
              <div key={p.productId} className="px-4 py-2.5 flex items-center gap-3 hover:bg-surface2 transition-colors">
                <span className={`text-[12px] font-black w-5 text-center tabular-nums shrink-0
                  ${i === 0 ? 'text-cyellow' : i === 1 ? 'text-muted' : i === 2 ? 'text-amber-700' : 'text-subtle'}`}>
                  #{i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text truncate">{p.name}</div>
                  <div className="text-[12px] text-subtle font-mono">{p.sku}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-cgreen tabular-nums">{p.totalQty.toLocaleString('vi-VN')} sp</div>
                  <div className="text-[12px] text-subtle font-mono">{fmtVNDFull(p.totalRevenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top debtors */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border flex items-center gap-2">
            <SendIcon size={16} className="text-cred" />
            <span className="text-sm font-bold text-text">Khách Nợ Nhiều</span>
            <span className="text-[12px] text-subtle ml-auto">Top {debtors.length}</span>
          </div>
          <div className="divide-y divide-border">
            {debtors.length === 0 && (
              <div className="px-4 py-8 text-center text-subtle text-xs flex items-center justify-center gap-1.5">
                <PartyPopper size={14} /> Không có khách nợ
              </div>
            )}
            {debtors.map((c, i) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center gap-2 hover:bg-surface2 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text truncate">{c.fullName}</div>
                  <div className="text-[12px] text-subtle font-mono">{fmtPhone(c.phone)}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black text-cred tabular-nums">{fmtVNDFull(c.currentDebt)}</div>
                  {c.creditLimit > 0 && (
                    <div className="text-[12px] text-subtle">/ {fmtVNDFull(c.creditLimit)}</div>
                  )}
                </div>
                <button
                  onClick={() => sendDebtReminder(c)}
                  title="Gửi nhắc nợ"
                  className="shrink-0 w-7 h-7 rounded-lg border border-border text-muted hover:border-cyellow/60 hover:text-cyellow hover:bg-amber-50 transition-colors flex items-center justify-center"
                >
                  <SendIcon size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alert */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 shadow-card overflow-hidden">
          <div className="px-4 py-3.5 border-b border-amber-200 flex items-center gap-2">
            <AlertTriangle size={16} className="text-cyellow" />
            <span className="text-sm font-bold text-cyellow">Cần Nhập Gấp</span>
            <span className="text-[12px] text-subtle ml-auto">Dưới mức tối thiểu</span>
          </div>
          <div className="divide-y divide-amber-200/60">
            {lowStock.length === 0 && (
              <div className="px-4 py-8 text-center text-subtle text-xs flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} className="text-cgreen" /> Tồn kho ổn định
              </div>
            )}
            {lowStock.map(p => (
              <div key={p.id} className="px-4 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text truncate">{p.name}</div>
                  <div className="text-[12px] text-subtle font-mono">{p.sku}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-sm font-black tabular-nums ${p.stockQuantity <= 0 ? 'text-cred' : 'text-cyellow'}`}>
                    {p.stockQuantity}
                  </div>
                  <div className="text-[12px] text-subtle">min {p.minStock}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
    </div>
  )
}
