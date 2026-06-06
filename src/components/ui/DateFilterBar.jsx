// ── Shared Date Filter Bar ────────────────────────────────────────────────
// Dùng chung cho: Báo Cáo, Khách Hàng, Nhà Cung Cấp, Sổ Quỹ, Kiểm Kho

// ── Date helpers (exported để các page dùng) ──────────────────────────────

export function startOf(unit, ref = new Date()) {
  const d = new Date(ref)
  if (unit === 'day')     { d.setHours(0,0,0,0); return d }
  if (unit === 'week')    { d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d }
  if (unit === 'month')   { return new Date(d.getFullYear(), d.getMonth(), 1) }
  if (unit === 'quarter') { return new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3, 1) }
  if (unit === 'year')    { return new Date(d.getFullYear(), 0, 1) }
  return new Date('2000-01-01')
}

export function endOf(unit, ref = new Date()) {
  const d = new Date(ref)
  if (unit === 'day')     { d.setHours(23,59,59,999); return d }
  if (unit === 'week')    { const s = startOf('week',ref); return new Date(s.getTime()+6*86400000+86399999) }
  if (unit === 'month')   { return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999) }
  if (unit === 'quarter') { const q=Math.floor(d.getMonth()/3); return new Date(d.getFullYear(), q*3+3, 0, 23,59,59,999) }
  if (unit === 'year')    { return new Date(d.getFullYear(), 11, 31, 23,59,59,999) }
  return new Date('2100-01-01')
}

export function toInputDate(d) {
  return d.toISOString().slice(0, 10)
}

// Trả về { from: Date, to: Date }
export function getDateRange(preset, customFrom, customTo) {
  if (preset === 'today')   return { from: startOf('day'),     to: endOf('day') }
  if (preset === 'week')    return { from: startOf('week'),    to: endOf('week') }
  if (preset === 'month')   return { from: startOf('month'),   to: endOf('month') }
  if (preset === 'quarter') return { from: startOf('quarter'), to: endOf('quarter') }
  if (preset === 'year')    return { from: startOf('year'),    to: endOf('year') }
  if (preset === 'all')     return { from: new Date('2000-01-01'), to: new Date('2100-01-01') }
  if (preset === 'custom' && customFrom && customTo) {
    const from = new Date(customFrom); from.setHours(0,0,0,0)
    const to   = new Date(customTo);   to.setHours(23,59,59,999)
    if (from <= to) return { from, to }
  }
  return { from: startOf('month'), to: endOf('month') }
}

// ── Presets ───────────────────────────────────────────────────────────────

export const FILTER_PRESETS_BASE = [
  { id: 'today',   label: 'Hôm nay' },
  { id: 'week',    label: 'Tuần này' },
  { id: 'month',   label: 'Tháng này' },
  { id: 'quarter', label: 'Quý này' },
  { id: 'year',    label: 'Năm này' },
]

// ── Component ─────────────────────────────────────────────────────────────

/**
 * DateFilterBar — thanh bộ lọc thời gian đồng bộ với Báo Cáo P&L
 *
 * Props:
 *   preset / setPreset       — 'today'|'week'|'month'|'quarter'|'year'|'all'|'custom'
 *   customFrom / setCustomFrom — string yyyy-mm-dd
 *   customTo   / setCustomTo   — string yyyy-mm-dd
 *   onRefresh  — callback khi bấm "Làm mới" (nếu undefined, nút không hiện)
 *   loading    — bool, hiện spinner trên nút Làm mới
 *   showAllTime — bool (default true), thêm preset "Toàn thời gian"
 *   className  — thêm class cho wrapper
 */
export default function DateFilterBar({
  preset, setPreset,
  customFrom, setCustomFrom,
  customTo,   setCustomTo,
  onRefresh,
  loading    = false,
  showAllTime = true,
  className  = '',
}) {
  const presets = [
    ...FILTER_PRESETS_BASE,
    ...(showAllTime ? [{ id: 'all', label: '🌐 Toàn thời gian' }] : []),
    { id: 'custom', label: '📅 Tùy chọn' },
  ]

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {presets.map(p => (
        <button
          key={p.id}
          onClick={() => setPreset(p.id)}
          className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all whitespace-nowrap ${
            preset === p.id
              ? 'bg-cblue/20 border-cblue text-cblue'
              : 'bg-surface border-border text-muted hover:border-cblue/40 hover:text-[#e6edf3]'
          }`}
        >
          {p.label}
        </button>
      ))}

      {/* Custom date inputs */}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 ml-1">
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-cblue transition-all cursor-pointer"
          />
          <span className="text-muted text-sm">→</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-cblue transition-all cursor-pointer"
          />
        </div>
      )}

      {/* Làm mới */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted text-sm hover:border-cblue hover:text-cblue transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <svg
            className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24" fill="none"
          >
            <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4 9a8 8 0 0114.9-2.1M20 15a8 8 0 01-14.9 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {loading ? 'Đang tải…' : 'Làm mới'}
        </button>
      )}
    </div>
  )
}
