import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { loadCashbook, insertCashbookTx, deleteCashbookTx } from '../../lib/supabase'
import { fmtVNDFull, formatMoneyLive, parseVNDInput } from '../../lib/formatters'
import ModalOverlay from '../../components/ui/ModalOverlay'
import PageHeader from '../../components/ui/PageHeader'
import DateFilterBar, { getDateRange, toInputDate, startOf } from '../../components/ui/DateFilterBar'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import {
  Wallet, Plus, ArrowUp, ArrowDown, BarChart3, FolderOpen,
  ListChecks, Loader2, X, Trash2,
} from 'lucide-react'
import Can from '../../components/permission/Can'
import { PERMISSIONS } from '../../lib/permissions/permissionConstants'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

// ── Constants ──────────────────────────────────────────────────────────────

const THU_CATS_DEFAULT = ['Khách trả nợ', 'Bán hàng (tiền mặt)', 'Thu ngoài', 'Khác']
const CHI_CATS_DEFAULT = ['Trả lương', 'Tiền điện / nước', 'Phí vận chuyển', 'Nhập hàng', 'Ăn uống', 'Chi phí khác', 'Khác']

const LS_KEY_THU = 'cashbook_custom_thu'
const LS_KEY_CHI = 'cashbook_custom_chi'

function loadCustomCats(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
}
function saveCustomCat(key, value) {
  const existing = loadCustomCats(key)
  if (!value || existing.includes(value)) return
  localStorage.setItem(key, JSON.stringify([...existing, value]))
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDatetime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function fmtDay(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ── useCountUp hook ────────────────────────────────────────────────────────

function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0)
  const raf = useRef(null)
  useEffect(() => {
    if (!target) { setVal(0); return }
    let start = null
    const step = ts => {
      if (!start) start = ts
      const p = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(eased * target))
      if (p < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])
  return val
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, textColor, gradient, count }) {
  const animated = useCountUp(value)
  return (
    <div className={`relative rounded-2xl border p-5 overflow-hidden transition-all hover:scale-[1.01] ${gradient}`}>
      <Icon className="absolute -top-2 -right-2 w-16 h-16 opacity-[0.08] select-none pointer-events-none" strokeWidth={1.5} />
      <div className="text-caption text-muted font-semibold uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-2xl font-black tabular-nums leading-tight ${textColor}`}>
        {fmtVNDFull(animated)}
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[12px] text-muted">{sub}</span>
        {count !== undefined && (
          <span className="text-[12px] font-bold text-muted bg-surface2 px-2 py-0.5 rounded-full">
            {count} phiếu
          </span>
        )}
      </div>
    </div>
  )
}

// ── Category Breakdown Panel ───────────────────────────────────────────────

function CategoryBreakdown({ transactions, type }) {
  const data = useMemo(() => {
    const map = {}
    transactions
      .filter(t => t.transaction_type === type)
      .forEach(t => {
        const cat = t.category || 'Khác'
        map[cat] = (map[cat] || 0) + (Number(t.amount) || 0)
      })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amount]) => ({
        cat,
        amount,
        pct: total > 0 ? (amount / total * 100).toFixed(1) : 0,
      }))
  }, [transactions, type])

  const total = data.reduce((s, d) => s + d.amount, 0)
  const isThu = type === 'THU'
  const barColor = isThu ? 'bg-cgreen' : 'bg-cred'
  const textColor = isThu ? 'text-cgreen' : 'text-cred'

  if (data.length === 0) {
    return (
      <div className="text-center py-6 text-subtle text-xs">
        Chưa có dữ liệu
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {data.map(d => (
        <div key={d.cat}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text font-medium truncate max-w-[60%]">{d.cat}</span>
            <div className="flex items-center gap-2">
              <span className={`text-[12px] font-bold tabular-nums ${textColor}`}>
                {fmtVNDFull(d.amount)}
              </span>
              <span className="text-[12px] text-subtle tabular-nums w-10 text-right">{d.pct}%</span>
            </div>
          </div>
          <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${total > 0 ? (d.amount / total * 100) : 0}%`, opacity: 0.7 }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Add Transaction Modal ──────────────────────────────────────────────────

function TxModal({ onSave, onClose }) {
  const [type,     setType]     = useState('THU')
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState('')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [customThu, setCustomThu] = useState(() => loadCustomCats(LS_KEY_THU))
  const [customChi, setCustomChi] = useState(() => loadCustomCats(LS_KEY_CHI))

  const isKhac = category === 'Khác'
  const lsKey  = type === 'THU' ? LS_KEY_THU : LS_KEY_CHI

  const baseCats   = type === 'THU' ? THU_CATS_DEFAULT : CHI_CATS_DEFAULT
  const customCats = type === 'THU' ? customThu : customChi
  // Hiển thị: custom cats trước "Khác", bỏ "Khác" khỏi vị trí cuối rồi thêm lại
  const cats = [
    ...baseCats.filter(c => c !== 'Khác'),
    ...customCats,
    'Khác',
  ]

  async function handleSubmit(e) {
    e.preventDefault()
    const amt = parseVNDInput(amount)
    if (!amt || amt <= 0) { toast.error('Vui lòng nhập số tiền hợp lệ'); return }
    if (!category)        { toast.error('Vui lòng chọn danh mục'); return }

    // Nếu chọn "Khác" và có ghi chú → lưu ghi chú thành danh mục tùy chỉnh
    const customLabel = isKhac && notes.trim() ? notes.trim() : null
    if (customLabel) {
      saveCustomCat(lsKey, customLabel)
      if (type === 'THU') setCustomThu(loadCustomCats(LS_KEY_THU))
      else                setCustomChi(loadCustomCats(LS_KEY_CHI))
    }

    setSaving(true)
    try {
      await onSave({ type, amount: amt, category, notes })
      onClose()
    } catch (e) {
      toast.error(e.message || 'Lỗi lưu')
    } finally {
      setSaving(false)
    }
  }

  const iCls = 'input-base'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 font-bold text-base text-text"><Wallet size={18} className="text-cblue" /> Tạo Phiếu Thu / Chi</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">

          {/* Toggle THU / CHI */}
          <div className="flex rounded-xl overflow-hidden border border-border">
            {['THU', 'CHI'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setCategory('') }}
                className={`flex-1 py-2.5 text-sm font-black transition-colors flex items-center justify-center gap-1.5 ${
                  type === t
                    ? t === 'THU'
                      ? 'bg-cgreen text-white'
                      : 'bg-cred text-white'
                    : 'bg-surface2 text-muted hover:text-text'
                }`}
              >
                {t === 'THU' ? <ArrowUp size={14} /> : <ArrowDown size={14} />} {t}
              </button>
            ))}
          </div>

          {/* Số tiền */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Số tiền (₫) *</label>
            <input
              autoFocus
              className={`${iCls} text-right font-mono text-xl font-black ${type === 'THU' ? 'text-cgreen border-cgreen/40 focus:border-cgreen focus:ring-cgreen/20' : 'text-cred border-cred/40 focus:border-cred focus:ring-cred/20'}`}
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(formatMoneyLive(e.target.value))}
            />
          </div>

          {/* Danh mục */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Danh mục *</label>
            <select
              className={`${iCls} cursor-pointer`}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">— Chọn danh mục —</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Ghi chú */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Ghi chú</label>
            <textarea
              className={`${iCls} resize-none h-auto py-3`}
              rows={2}
              placeholder="Nội dung chi tiết…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Huỷ</button>
            <button
              type="submit"
              disabled={saving}
              className={`h-11 px-6 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 ${type === 'THU' ? 'bg-cgreen hover:brightness-110' : 'bg-cred hover:brightness-110'}`}
            >
              {saving ? 'Đang lưu…' : `Tạo phiếu ${type}`}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ── Chart options ──────────────────────────────────────────────────────────

const TICK = { color: '#6b7280', font: { size: 11 } }
const GRID = { color: 'rgba(229,231,235,0.8)' }
const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#9ca3af', font: { size: 11 }, boxWidth: 12 } },
    tooltip: {
      callbacks: {
        label: ctx => ` ${ctx.dataset.label}: ${fmtVNDFull(ctx.raw * 1e6)}`,
      },
    },
  },
  scales: {
    x: { ticks: TICK, grid: { display: false } },
    y: { ticks: { ...TICK, callback: v => `${v}tr` }, grid: GRID },
  },
}

// ── Type filter tabs ───────────────────────────────────────────────────────

const TYPE_FILTERS = [
  { id: 'all', label: 'Tất cả',  icon: ListChecks },
  { id: 'THU', label: 'Phiếu Thu', icon: ArrowUp },
  { id: 'CHI', label: 'Phiếu Chi', icon: ArrowDown },
]

// ── Main Component ─────────────────────────────────────────────────────────

export default function Cashbook() {
  const [transactions, setTransactions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [deleting,     setDeleting]     = useState(null)
  const [typeFilter,   setTypeFilter]   = useState('all')

  // ── Bộ lọc thời gian ──────────────────────────────────────────────────────
  const [preset,     setPreset]     = useState('month')
  const [customFrom, setCustomFrom] = useState(toInputDate(startOf('month')))
  const [customTo,   setCustomTo]   = useState(toInputDate(new Date()))

  const fetchData = useCallback(async () => {
    const { from, to } = getDateRange(preset, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)
    try {
      const data = await loadCashbook({ from: from.toISOString(), to: to.toISOString() })
      setTransactions(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [preset, customFrom, customTo])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Thống kê ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const thuTxs = transactions.filter(t => t.transaction_type === 'THU')
    const chiTxs = transactions.filter(t => t.transaction_type === 'CHI')
    const totalThu = thuTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
    const totalChi = chiTxs.reduce((s, t) => s + (Number(t.amount) || 0), 0)
    return {
      totalThu,
      totalChi,
      balance: totalThu - totalChi,
      thuCount: thuTxs.length,
      chiCount: chiTxs.length,
    }
  }, [transactions])

  // ── Chart data: THU vs CHI theo ngày ──────────────────────────────────────
  const chartData = useMemo(() => {
    const dayMap = {}
    for (const tx of transactions) {
      const key = fmtDay(tx.created_at)
      if (!dayMap[key]) dayMap[key] = { thu: 0, chi: 0 }
      if (tx.transaction_type === 'THU') dayMap[key].thu += Number(tx.amount) || 0
      else dayMap[key].chi += Number(tx.amount) || 0
    }
    const labels = Object.keys(dayMap)
    return {
      labels,
      datasets: [
        {
          label: 'Thu',
          data: labels.map(k => dayMap[k].thu / 1e6),
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderRadius: 4,
        },
        {
          label: 'Chi',
          data: labels.map(k => -dayMap[k].chi / 1e6),
          backgroundColor: 'rgba(239,68,68,0.6)',
          borderRadius: 4,
        },
      ],
    }
  }, [transactions])

  // ── Filtered transactions ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (typeFilter === 'all') return transactions
    return transactions.filter(t => t.transaction_type === typeFilter)
  }, [transactions, typeFilter])

  // ── Running balance ───────────────────────────────────────────────────────
  const withBalance = useMemo(() => {
    // Tính running balance từ cuối lên (vì transactions sorted desc)
    const reversed = [...filtered].reverse()
    let balance = 0
    const mapped = reversed.map(tx => {
      if (tx.transaction_type === 'THU') balance += Number(tx.amount) || 0
      else balance -= Number(tx.amount) || 0
      return { ...tx, _runningBalance: balance }
    })
    return mapped.reverse()
  }, [filtered])

  // ── Thêm giao dịch ────────────────────────────────────────────────────────
  async function handleSave(tx) {
    const saved = await insertCashbookTx(tx)
    // Thêm vào đầu danh sách nếu nằm trong khoảng thời gian đang xem
    const { from, to } = getDateRange(preset, customFrom, customTo)
    const d = new Date(saved.created_at)
    if (!from || !to || (d >= from && d <= to)) {
      setTransactions(prev => [saved, ...prev])
    }
    toast.success(`✅ Đã ghi phiếu ${tx.type}: ${fmtVNDFull(tx.amount)}`)
  }

  // ── Xoá giao dịch ─────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!window.confirm('Xoá giao dịch này?')) return
    setDeleting(id)
    try {
      await deleteCashbookTx(id)
      setTransactions(prev => prev.filter(t => t.id !== id))
      toast.success('Đã xoá giao dịch')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(null)
    }
  }

  // ── Period label ──────────────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    const now = new Date()
    if (preset === 'today')   return `Hôm nay — ${now.toLocaleDateString('vi-VN')}`
    if (preset === 'week')    return 'Tuần này'
    if (preset === 'month')   return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`
    if (preset === 'quarter') return `Quý ${Math.floor(now.getMonth() / 3) + 1}/${now.getFullYear()}`
    if (preset === 'year')    return `Năm ${now.getFullYear()}`
    if (preset === 'all')     return 'Toàn thời gian'
    if (preset === 'custom')  return `${customFrom} → ${customTo}`
    return ''
  }, [preset, customFrom, customTo])

  return (
    <div className="w-full">
      <PageHeader
        icon={Wallet}
        title="Sổ Quỹ Thu Chi"
        subtitle={`Quản lý dòng tiền ngoài bán hàng · ${periodLabel}`}
        actions={
          <Can permission={PERMISSIONS.CASHBOOK_CREATE}>
            <button onClick={() => setShowModal(true)} className="btn-primary whitespace-nowrap">
              <Plus size={16} strokeWidth={2.5} />
              Tạo phiếu Thu/Chi
            </button>
          </Can>
        }
      />
    <div className="px-5 pt-3 pb-6 w-full flex flex-col gap-5">

      {/* ── Bộ lọc thời gian ─────────────────────────────────────── */}
      <DateFilterBar
        preset={preset}     setPreset={setPreset}
        customFrom={customFrom} setCustomFrom={setCustomFrom}
        customTo={customTo}   setCustomTo={setCustomTo}
        onRefresh={fetchData}
        loading={loading}
        showAllTime={true}
      />

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          label="Tổng Thu"
          value={stats.totalThu}
          sub={periodLabel}
          icon={ArrowUp}
          textColor="text-cgreen"
          gradient="bg-emerald-50 border-emerald-200"
          count={stats.thuCount}
        />
        <StatCard
          label="Tổng Chi"
          value={stats.totalChi}
          sub={periodLabel}
          icon={ArrowDown}
          textColor="text-cred"
          gradient="bg-rose-50 border-rose-200"
          count={stats.chiCount}
        />
        <StatCard
          label="Tồn Quỹ"
          value={Math.abs(stats.balance)}
          sub={stats.balance >= 0 ? 'Dương — dòng tiền lành mạnh' : 'Âm — chi vượt thu'}
          icon={Wallet}
          textColor={stats.balance >= 0 ? 'text-cblue' : 'text-cred'}
          gradient={stats.balance >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200'}
        />
      </div>

      {/* ── Chart + Breakdown row ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart: Thu vs Chi theo ngày */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center gap-2 text-sm font-bold text-text mb-1"><BarChart3 size={16} className="text-cblue" /> Biến Động Thu Chi Theo Ngày</div>
          <div className="text-[12px] text-muted mb-4">Thu (dương) · Chi (âm) — đơn vị: triệu ₫</div>
          <div className="h-52">
            {chartData.labels.length > 0 ? (
              <Bar data={chartData} options={chartOpts} />
            ) : (
              <div className="flex items-center justify-center h-full text-subtle text-xs">
                Chưa có dữ liệu trong khoảng thời gian này
              </div>
            )}
          </div>
        </div>

        {/* Category breakdown */}
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <FolderOpen size={16} className="text-cblue" />
            <span className="text-sm font-bold text-text">Phân Bổ Danh Mục</span>
          </div>
          <div className="p-4">
            {/* Show both breakdowns stacked */}
            <div className="mb-4">
              <div className="text-[12px] text-cgreen font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><ArrowUp size={11} /> Khoản Thu</div>
              <CategoryBreakdown transactions={transactions} type="THU" />
            </div>
            <div className="border-t border-border pt-3">
              <div className="text-[12px] text-cred font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><ArrowDown size={11} /> Khoản Chi</div>
              <CategoryBreakdown transactions={transactions} type="CHI" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Type filter + Transaction table ────────────────────────── */}
      <div className="card p-0 overflow-hidden">

        {/* Table header with type filters */}
        <div className="px-5 py-3 border-b border-border bg-surface2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-text">Lịch Sử Giao Dịch</span>
            <span className="text-[12px] font-bold text-muted bg-surface border border-border px-2 py-0.5 rounded-full">
              {filtered.length} / {transactions.length}
            </span>
          </div>

          {/* Type filter pills */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {TYPE_FILTERS.map(f => {
              const Icon = f.icon
              return (
                <button
                  key={f.id}
                  onClick={() => setTypeFilter(f.id)}
                  className={`px-3 py-1.5 text-[12px] font-bold transition-colors whitespace-nowrap flex items-center gap-1 ${
                    typeFilter === f.id
                      ? f.id === 'THU'
                        ? 'bg-emerald-50 text-cgreen'
                        : f.id === 'CHI'
                          ? 'bg-rose-50 text-cred'
                          : 'bg-cblue/10 text-cblue'
                      : 'bg-surface text-muted hover:text-text'
                  } ${f.id !== 'all' ? 'border-l border-border' : ''}`}
                >
                  <Icon size={12} /> {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted text-sm gap-2">
            <Loader2 size={18} className="animate-spin" />
            Đang tải dữ liệu…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Wallet size={48} className="mx-auto mb-3 text-subtle opacity-60" />
            <div className="font-bold text-muted mb-1">
              {typeFilter !== 'all'
                ? `Không có phiếu ${typeFilter === 'THU' ? 'Thu' : 'Chi'} nào`
                : 'Chưa có giao dịch nào'
              }
            </div>
            <div className="text-xs text-subtle mb-4">trong khoảng thời gian đã chọn</div>
            <Can permission={PERMISSIONS.CASHBOOK_CREATE}>
              <button
                onClick={() => setShowModal(true)}
                className="btn-primary mx-auto"
              >
                <Plus size={16} /> Tạo phiếu đầu tiên
              </button>
            </Can>
          </div>
        ) : (
          <>
            {/* ── Mobile: Card list (< sm) ── */}
            <div className="sm:hidden flex flex-col gap-2 p-3">
              {withBalance.map(tx => {
                const isThu = tx.transaction_type === 'THU'
                return (
                  <div key={tx.id} className="bg-surface border border-border rounded-xl p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-black mb-1.5 ${isThu ? 'bg-emerald-50 text-cgreen border-emerald-200' : 'bg-rose-50 text-cred border-rose-200'}`}>
                          {isThu ? <ArrowUp size={10} /> : <ArrowDown size={10} />} {isThu ? 'THU' : 'CHI'}
                        </span>
                        <div className="text-sm font-semibold text-text">{tx.category}</div>
                        {tx.notes && <div className="text-[12px] text-muted mt-0.5 line-clamp-1">{tx.notes}</div>}
                        <div className="text-[12px] text-subtle mt-1 font-mono">
                          {fmtDay(tx.created_at)} · {new Date(tx.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-mono font-black text-base tabular-nums ${isThu ? 'text-cgreen' : 'text-cred'}`}>
                          {isThu ? '+' : '−'}{fmtVNDFull(tx.amount)}
                        </div>
                        <div className={`text-[12px] font-mono font-semibold tabular-nums mt-0.5 ${tx._runningBalance >= 0 ? 'text-cblue' : 'text-cred'}`}>
                          = {fmtVNDFull(tx._runningBalance)}
                        </div>
                        <Can permission={PERMISSIONS.CASHBOOK_DELETE}>
                          <button onClick={() => handleDelete(tx.id)} disabled={deleting === tx.id}
                            className="mt-2 h-7 w-7 rounded-lg border border-border text-subtle hover:border-cred hover:text-cred active:scale-95 transition-all flex items-center justify-center ml-auto disabled:opacity-40">
                            <Trash2 size={14} />
                          </button>
                        </Can>
                      </div>
                    </div>
                  </div>
                )
              })}
              {/* Mobile footer summary */}
              <div className="bg-cblue/5 border border-cblue/20 rounded-xl p-3.5 mt-1">
                <div className="text-xs font-black text-cblue mb-2">Tổng cộng ({filtered.length} giao dịch)</div>
                <div className="flex justify-between text-xs">
                  <span className="text-cgreen font-mono font-black">+{fmtVNDFull(filtered.filter(t => t.transaction_type === 'THU').reduce((s, t) => s + (Number(t.amount) || 0), 0))}</span>
                  <span className="text-cred font-mono font-black">−{fmtVNDFull(filtered.filter(t => t.transaction_type === 'CHI').reduce((s, t) => s + (Number(t.amount) || 0), 0))}</span>
                  <span className={`font-mono font-black ${stats.balance >= 0 ? 'text-cblue' : 'text-cred'}`}>{fmtVNDFull(stats.balance)}</span>
                </div>
              </div>
            </div>

            {/* ── Desktop: Table (≥ sm) ── */}
            <div className="hidden sm:block w-full overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="bg-surface2 border-b border-border">
                    {['Thời gian', 'Loại', 'Danh mục', 'Ghi chú', 'Số tiền', 'Tồn quỹ', ''].map((h, i) => (
                      <th key={i} className={`px-4 py-3 text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap ${h === 'Số tiền' || h === 'Tồn quỹ' ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {withBalance.map(tx => {
                    const isThu = tx.transaction_type === 'THU'
                    return (
                      <tr key={tx.id} className="hover:bg-surface2 transition-colors group">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-xs text-text font-medium">{fmtDay(tx.created_at)}</div>
                          <div className="text-[12px] text-subtle font-mono">{new Date(tx.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] font-black ${isThu ? 'bg-emerald-50 text-cgreen border-emerald-200' : 'bg-rose-50 text-cred border-rose-200'}`}>
                            {isThu ? <ArrowUp size={11} /> : <ArrowDown size={11} />} {isThu ? 'THU' : 'CHI'}
                          </span>
                        </td>
                        <td className="px-4 py-3"><span className="text-sm text-text font-medium">{tx.category}</span></td>
                        <td className="px-4 py-3 max-w-[200px]"><div className="text-xs text-muted truncate">{tx.notes || '—'}</div></td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`text-sm font-black tabular-nums font-mono ${isThu ? 'text-cgreen' : 'text-cred'}`}>{isThu ? '+' : '−'}{fmtVNDFull(tx.amount)}</span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={`text-xs font-bold tabular-nums font-mono ${tx._runningBalance >= 0 ? 'text-cblue' : 'text-cred'}`}>{fmtVNDFull(tx._runningBalance)}</span>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <Can permission={PERMISSIONS.CASHBOOK_DELETE}>
                            <button onClick={() => handleDelete(tx.id)} disabled={deleting === tx.id}
                              className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md border border-border text-muted hover:border-cred hover:text-cred hover:bg-cred/10 transition-all flex items-center justify-center disabled:opacity-50">
                              <Trash2 size={14} />
                            </button>
                          </Can>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-cblue/30 bg-cblue/5">
                    <td colSpan={4} className="px-4 py-3 text-sm font-black text-cblue">Tổng cộng ({filtered.length} giao dịch)</td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-xs font-black tabular-nums text-cgreen">+{fmtVNDFull(filtered.filter(t => t.transaction_type === 'THU').reduce((s, t) => s + (Number(t.amount) || 0), 0))}</div>
                      <div className="text-xs font-black tabular-nums text-cred">−{fmtVNDFull(filtered.filter(t => t.transaction_type === 'CHI').reduce((s, t) => s + (Number(t.amount) || 0), 0))}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm font-black tabular-nums ${stats.balance >= 0 ? 'text-cblue' : 'text-cred'}`}>{fmtVNDFull(stats.balance)}</span>
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {showModal && <TxModal onSave={handleSave} onClose={() => setShowModal(false)} />}
    </div>
    </div>
  )
}
