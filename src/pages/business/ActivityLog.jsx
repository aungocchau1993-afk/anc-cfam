import { useState, useEffect, useCallback, useRef } from 'react'
import * as XLSX from 'xlsx'
import { loadAuditLogsDashboard, supabase } from '../../lib/supabase'
import ModalOverlay from '../../components/ui/ModalOverlay'
import PageHeader from '../../components/ui/PageHeader'
import {
  History, Download, X, ClipboardList, Plus, Pencil, Trash2 as TrashIcon,
  Search, Loader2, ChevronLeft, ChevronRight, Package, Receipt,
} from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  name: 'Tên hàng', sku: 'Mã SKU', import_price: 'Giá vốn',
  sell_price: 'Giá bán', stock_quantity: 'Tồn kho', min_stock: 'Tồn tối thiểu',
  unit: 'ĐVT', image_url: 'Hình ảnh', status: 'Trạng thái',
  total_amount: 'Tổng tiền', paid_amount: 'Đã trả', debt_amount: 'Còn nợ',
  note: 'Ghi chú', order_code: 'Mã đơn', type: 'Loại đơn',
}
const MONEY_FIELDS = new Set(['import_price','sell_price','total_amount','paid_amount','debt_amount'])
const SKIP_FIELDS  = new Set(['id','user_id','created_at','updated_at','last_used_unit'])
const TABLE_LABELS = { products: 'Hàng hóa', orders: 'Đơn hàng' }

const ACTION_CFG = {
  INSERT: { label: 'Tạo mới', bg: 'bg-cgreen/15',  border: 'border-cgreen/30',  text: 'text-cgreen', icon: Plus },
  UPDATE: { label: 'Sửa',     bg: 'bg-cblue/10',   border: 'border-cblue/25',   text: 'text-cblue', icon: Pencil },
  DELETE: { label: 'Xóa',     bg: 'bg-cred/10',    border: 'border-cred/25',    text: 'text-cred', icon: TrashIcon },
}

function fmtVal(field, val) {
  if (val === null || val === undefined || val === '') return '—'
  if (MONEY_FIELDS.has(field)) return Number(val).toLocaleString('vi-VN') + ' ₫'
  if (typeof val === 'boolean') return val ? 'Có' : 'Không'
  if (typeof val === 'object')  return JSON.stringify(val)
  return String(val)
}

function fmtTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function getRecordLabel(log) {
  const d = log.new_data || log.old_data || {}
  if (d.name)       return d.name + (d.sku ? ` [${d.sku}]` : '')
  if (d.order_code) return `Đơn #${d.order_code}`
  return log.record_id?.slice(-8).toUpperCase() ?? '—'
}

function getChangeSummary(log) {
  if (log.action === 'DELETE') return 'Đã xóa bản ghi'
  if (log.action === 'INSERT') return 'Tạo mới bản ghi'
  const changed = Object.keys(log.new_data || {}).filter(f => {
    if (SKIP_FIELDS.has(f)) return false
    return JSON.stringify((log.old_data||{})[f]) !== JSON.stringify((log.new_data||{})[f])
  })
  if (!changed.length) return 'Không có thay đổi'
  return changed.slice(0, 2).map(f => {
    const lbl = FIELD_LABELS[f] || f
    const ov  = fmtVal(f, (log.old_data||{})[f])
    const nv  = fmtVal(f, (log.new_data||{})[f])
    return `${lbl}: ${ov} → ${nv}`
  }).join(' · ') + (changed.length > 2 ? ` (+${changed.length - 2} nữa)` : '')
}

// ── Diff Modal ──────────────────────────────────────────────────────────────

function DiffModal({ log, onClose }) {
  const isUpd = log.action === 'UPDATE'
  const changedFields = isUpd
    ? Object.keys(log.new_data || {}).filter(f =>
        !SKIP_FIELDS.has(f) &&
        JSON.stringify((log.old_data||{})[f]) !== JSON.stringify((log.new_data||{})[f])
      )
    : []
  const snapshotData = log.new_data || log.old_data || {}
  const ac = ACTION_CFG[log.action] || ACTION_CFG.UPDATE

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="font-bold text-text flex items-center gap-2">
              Chi tiết thay đổi
              <span className={`text-xs px-2 py-0.5 rounded-full border ${ac.border} ${ac.text}`}>{ac.label}</span>
            </div>
            <div className="text-xs text-muted mt-0.5">{fmtTime(log.created_at)} · {TABLE_LABELS[log.table_name] || log.table_name}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 p-4">
          {isUpd ? (
            <>
              <div className="grid grid-cols-[110px_1fr_1fr] gap-2 text-[12px] font-semibold text-muted uppercase tracking-wider pb-2 border-b border-border">
                <span>Trường</span><span className="text-cred">Giá trị cũ</span><span className="text-cgreen">Giá trị mới</span>
              </div>
              {changedFields.length === 0
                ? <div className="text-xs text-muted py-4 text-center">Không có trường nào thay đổi</div>
                : changedFields.map(f => (
                  <div key={f} className="grid grid-cols-[110px_1fr_1fr] gap-2 text-xs py-2 border-b border-border last:border-0">
                    <span className="text-muted font-medium self-start pt-0.5">{FIELD_LABELS[f] || f}</span>
                    <div className="rounded px-2 py-1 bg-rose-50 border border-cred/20 text-cred font-mono break-all">{fmtVal(f, (log.old_data||{})[f])}</div>
                    <div className="rounded px-2 py-1 bg-emerald-50 border border-cgreen/20 text-cgreen font-mono break-all">{fmtVal(f, (log.new_data||{})[f])}</div>
                  </div>
                ))}
            </>
          ) : (
            <>
              <div className="text-[12px] text-muted uppercase tracking-wider pb-2 border-b border-border font-semibold">
                {log.action === 'DELETE' ? 'Dữ liệu trước khi xóa' : 'Dữ liệu khởi tạo'}
              </div>
              {Object.entries(snapshotData)
                .filter(([f, v]) => !SKIP_FIELDS.has(f) && v !== null && v !== '')
                .map(([f, v]) => (
                  <div key={f} className="grid grid-cols-[110px_1fr] gap-2 text-xs py-2 border-b border-border last:border-0">
                    <span className="text-muted font-medium">{FIELD_LABELS[f] || f}</span>
                    <span className={`font-mono break-all ${log.action === 'DELETE' ? 'text-cred' : 'text-cgreen'}`}>{fmtVal(f, v)}</span>
                  </div>
                ))}
            </>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border shrink-0 flex justify-end">
          <button onClick={onClose} className="btn-ghost h-9 px-4 text-xs">Đóng</button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Date range presets ──────────────────────────────────────────────────────

function getPresetRange(preset) {
  const now  = new Date()
  const pad  = n => String(n).padStart(2,'0')
  const ymd  = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
  const today = ymd(now)
  if (preset === 'today') return { from: today + 'T00:00:00', to: today + 'T23:59:59' }
  if (preset === '7d')    { const f = new Date(now); f.setDate(f.getDate()-6); return { from: ymd(f)+'T00:00:00', to: today+'T23:59:59' } }
  if (preset === '30d')   { const f = new Date(now); f.setDate(f.getDate()-29); return { from: ymd(f)+'T00:00:00', to: today+'T23:59:59' } }
  if (preset === 'month') { const f = new Date(now.getFullYear(), now.getMonth(), 1); return { from: ymd(f)+'T00:00:00', to: today+'T23:59:59' } }
  return { from: '', to: '' }
}

// ── Excel Export ────────────────────────────────────────────────────────────

function exportToExcel(logs, userMap) {
  const rows = logs.map(log => ({
    'Thời gian':       fmtTime(log.created_at),
    'Người dùng':      log.changed_by ? (userMap[log.changed_by] || log.changed_by.slice(0,8).toUpperCase()) : '—',
    'Hành động':       ACTION_CFG[log.action]?.label || log.action,
    'Bảng':            TABLE_LABELS[log.table_name] || log.table_name,
    'Đối tượng':       getRecordLabel(log),
    'Nội dung thay đổi': getChangeSummary(log),
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 10 }, { wch: 12 }, { wch: 28 }, { wch: 50 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Nhật ký')
  const date = new Date().toISOString().slice(0,10)
  XLSX.writeFile(wb, `nhat-ky-hoat-dong-${date}.xlsx`)
}

// ── Main Page ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 30

export default function ActivityLog() {
  const [preset,    setPreset]    = useState('7d')
  const [fromDate,  setFromDate]  = useState('')
  const [toDate,    setToDate]    = useState('')
  const [actions,   setActions]   = useState(['INSERT','UPDATE','DELETE'])
  const [tables,    setTables]    = useState(['products','orders'])
  const [search,    setSearch]    = useState('')
  const [searchInp, setSearchInp] = useState('')
  const [logs,      setLogs]      = useState([])
  const [total,     setTotal]     = useState(0)
  const [page,      setPage]      = useState(0)
  const [loading,   setLoading]   = useState(false)
  const [diffLog,   setDiffLog]   = useState(null)
  const [userMap,   setUserMap]   = useState({})
  const searchTimer = useRef(null)

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) setUserMap(m => ({ ...m, [data.user.id]: data.user.email }))
    })
  }, [])

  const effectiveRange = preset === 'custom'
    ? { from: fromDate ? fromDate+'T00:00:00' : '', to: toDate ? toDate+'T23:59:59' : '' }
    : getPresetRange(preset)

  const fetch = useCallback(async (pg = 0) => {
    setLoading(true)
    const { data, count } = await loadAuditLogsDashboard({
      from:     effectiveRange.from || undefined,
      to:       effectiveRange.to   || undefined,
      actions:  actions.length < 3  ? actions : [],
      tables:   tables.length  < 2  ? tables  : [],
      search,
      page:     pg,
      pageSize: PAGE_SIZE,
    })
    setLogs(data)
    setTotal(count)
    setPage(pg)
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, fromDate, toDate, actions, tables, search])

  useEffect(() => { fetch(0) }, [fetch])

  function toggleAction(a) {
    setActions(prev => prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a])
  }
  function toggleTable(t) {
    setTables(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }
  function handleSearchChange(v) {
    setSearchInp(v)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setSearch(v), 400)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const countByAction = (a) => logs.filter(l => l.action === a).length

  return (
    <div className="w-full">
      <PageHeader
        icon={History}
        title="Nhật Ký Hoạt Động"
        subtitle="Theo dõi toàn bộ thay đổi trên hệ thống"
        actions={
          <button
            onClick={() => exportToExcel(logs, userMap)}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cgreen/15 border border-cgreen/30 text-cgreen text-sm font-semibold hover:bg-cgreen/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Xuất Excel
          </button>
        }
      />
    <div className="p-4 sm:p-6 w-full flex flex-col gap-4">

      {/* ── Metric cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng log',   value: total,               icon: ClipboardList, color: 'text-muted',  border: 'border-border' },
          { label: 'Tạo mới',   value: countByAction('INSERT'), icon: Plus,  color: 'text-cgreen',   border: 'border-cgreen/25' },
          { label: 'Chỉnh sửa', value: countByAction('UPDATE'), icon: Pencil,  color: 'text-cblue',    border: 'border-cblue/25'  },
          { label: 'Xóa',       value: countByAction('DELETE'), icon: TrashIcon,  color: 'text-cred',     border: 'border-cred/25'   },
        ].map(s => (
          <div key={s.label} className={`bg-surface border ${s.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
            <s.icon size={18} className={s.color} />
            <div>
              <div className={`text-xl font-black tabular-nums leading-tight ${s.color}`}>{s.value.toLocaleString()}</div>
              <div className="text-[12px] text-muted uppercase tracking-wider mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters card ───────────────────────────────────────────────────── */}
      <div className="card p-4 flex flex-col gap-3">

        {/* Dòng 1: Thời gian + Loại hành động */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted font-semibold uppercase tracking-wider shrink-0">Thời gian</span>
          {[['today','Hôm nay'],['7d','7 ngày'],['30d','30 ngày'],['month','Tháng này'],['custom','Tùy chọn']].map(([v,l]) => (
            <button key={v} onClick={() => setPreset(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                preset === v ? 'bg-cblue/10 border-cblue text-cblue' : 'bg-surface2 border-border text-muted hover:border-cblue/50'
              }`}>{l}</button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="rounded-lg bg-surface border border-border px-2 py-1 text-xs text-text outline-none focus:border-cblue" />
              <span className="text-subtle text-xs">→</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="rounded-lg bg-surface border border-border px-2 py-1 text-xs text-text outline-none focus:border-cblue" />
            </div>
          )}
          {/* Divider */}
          <div className="hidden sm:block w-px h-5 bg-border mx-1" />
          <span className="text-[12px] text-muted font-semibold uppercase tracking-wider shrink-0">Loại</span>
          {[['INSERT','Tạo mới','cgreen'],['UPDATE','Sửa','cblue'],['DELETE','Xóa','cred']].map(([a,l,c]) => (
            <button key={a} onClick={() => toggleAction(a)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                actions.includes(a)
                  ? `bg-${c}/15 border-${c}/40 text-${c}`
                  : 'bg-surface2 border-border text-muted hover:border-slate-300'
              }`}>{l}</button>
          ))}
        </div>

        {/* Dòng 2: Bảng + Search */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-muted font-semibold uppercase tracking-wider shrink-0">Bảng</span>
          {[['products','Hàng hóa',Package],['orders','Đơn hàng',Receipt]].map(([t,l,Icon]) => (
            <button key={t} onClick={() => toggleTable(t)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                tables.includes(t)
                  ? 'bg-cpurple/10 border-cpurple/40 text-cpurple'
                  : 'bg-surface2 border-border text-muted hover:border-slate-300'
              }`}><Icon size={12} /> {l}</button>
          ))}
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none" />
            <input
              placeholder="Tìm tên hàng, mã SKU, mã đơn…"
              value={searchInp}
              onChange={e => handleSearchChange(e.target.value)}
              className="w-full rounded-lg bg-surface border border-border pl-9 pr-3 py-1.5 text-xs text-text outline-none focus:border-cblue placeholder:text-subtle"
            />
          </div>
        </div>
      </div>

      {/* ── Table card ─────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">

        {/* Table header */}
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <span className="font-semibold text-sm text-text">Danh sách nhật ký</span>
          <span className="text-xs text-muted">
            {loading ? 'Đang tải…' : `${total.toLocaleString()} mục · trang ${page+1}/${Math.max(1,totalPages)}`}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Đang tải dữ liệu…
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 text-muted">
            <ClipboardList size={36} className="mx-auto mb-2 text-subtle" />
            <div className="text-sm font-medium">Không có nhật ký</div>
            <div className="text-xs mt-1 text-subtle">Thử thay đổi bộ lọc hoặc chạy SQL trigger trước</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Col headers */}
            <div className="grid grid-cols-[130px_160px_90px_180px_1fr_64px] gap-3 px-5 py-2 bg-surface2 border-b border-border text-[12px] font-semibold text-muted uppercase tracking-wider min-w-[820px]">
              <span>Thời gian</span>
              <span>Người dùng</span>
              <span>Hành động</span>
              <span>Đối tượng</span>
              <span>Nội dung thay đổi</span>
              <span className="text-center">Chi tiết</span>
            </div>
            {/* Rows */}
            {logs.map(log => {
              const ac = ACTION_CFG[log.action] || ACTION_CFG.UPDATE
              return (
                <div key={log.id}
                  className="grid grid-cols-[130px_160px_90px_180px_1fr_64px] gap-3 px-5 py-3 border-b border-border last:border-0 hover:bg-surface2 transition-colors group items-start min-w-[820px]">
                  <div className="text-xs text-muted font-mono leading-tight pt-0.5">{fmtTime(log.created_at)}</div>
                  <div className="text-xs text-muted break-all leading-tight pt-0.5" title={log.changed_by}>
                    {log.changed_by ? (userMap[log.changed_by] || log.changed_by.slice(0,8).toUpperCase()) : '—'}
                  </div>
                  <div>
                    <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${ac.border} ${ac.text} whitespace-nowrap`}>
                      {ac.label}
                    </span>
                    <div className="text-[12px] text-subtle mt-0.5">{TABLE_LABELS[log.table_name] || log.table_name}</div>
                  </div>
                  <div className="text-xs text-text font-medium leading-snug pt-0.5 break-words">{getRecordLabel(log)}</div>
                  <div className="text-xs text-muted leading-snug pt-0.5 min-w-0">{getChangeSummary(log)}</div>
                  <div className="flex justify-center pt-0.5">
                    <button
                      onClick={() => setDiffLog(log)}
                      className="px-2.5 py-1 rounded-lg border border-border text-[12px] font-semibold text-muted hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-all opacity-0 group-hover:opacity-100">
                      Xem
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border">
            <button disabled={page === 0} onClick={() => fetch(page-1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-text hover:border-cblue disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              <ChevronLeft size={14} />
              Trước
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pg
                if (totalPages <= 7)          pg = i
                else if (page <= 3)           pg = i
                else if (page >= totalPages-4) pg = totalPages-7+i
                else                           pg = page-3+i
                return (
                  <button key={pg} onClick={() => fetch(pg)}
                    className={`w-7 h-7 rounded-md text-xs font-semibold transition-all ${
                      pg === page ? 'bg-cblue text-white border border-cblue' : 'border border-border text-muted hover:border-cblue hover:text-cblue'
                    }`}>{pg+1}</button>
                )
              })}
            </div>
            <button disabled={page >= totalPages-1} onClick={() => fetch(page+1)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted hover:text-text hover:border-cblue disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              Tiếp
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {diffLog && <DiffModal log={diffLog} onClose={() => setDiffLog(null)} />}
    </div>
    </div>
  )
}
