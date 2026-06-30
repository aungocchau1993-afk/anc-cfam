import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import ModalOverlay from '../../components/ui/ModalOverlay'
import DateFilterBar, { getDateRange, toInputDate, startOf } from '../../components/ui/DateFilterBar'
import {
  getCustomers as loadCustomers,
  addCustomer as insertCustomer,
  editCustomer as updateCustomer,
  removeCustomer as deleteCustomer,
  getCustomerOrders as loadCustomerOrders,
  bulkUpsertCustomers as upsertCustomers,
  subscribeCustomers,
} from '../../lib/dataService'
import { loadCustomerDebts, calcVipTier } from '../../lib/supabase'
import { fmtVNDFull, formatMoneyLive, parseVNDInput, removeVietnameseTones } from '../../lib/formatters'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtPhone(phone) {
  if (!phone) return '—'
  const d = String(phone).replace(/\D/g, '')
  if (d.length === 10) return `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}`
  return phone
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN')
}

function tierOf(spent) {
  if (spent >= 50_000_000) return { label: '💎 VIP',     cls: 'bg-[#bc8cff]/15 text-[#bc8cff] border-[#bc8cff]/30' }
  if (spent >= 10_000_000) return { label: '🥇 Gold',    cls: 'bg-cyellow/15   text-cyellow   border-cyellow/30' }
  if (spent >= 2_000_000)  return { label: '🥈 Silver',  cls: 'bg-slate-400/15 text-slate-300 border-slate-500/30' }
  return                         { label: '🌱 New',      cls: 'bg-cgreen/15    text-cgreen    border-cgreen/30' }
}

const VIP_CFG = {
  MEMBER:   { label: 'Member',   icon: '🌱', cls: 'bg-slate-700/50 text-slate-400 border-slate-600' },
  SILVER:   { label: 'Silver',   icon: '🥈', cls: 'bg-slate-400/15 text-slate-300 border-slate-400/40' },
  GOLD:     { label: 'Gold',     icon: '🥇', cls: 'bg-cyellow/15 text-cyellow border-cyellow/40' },
  PLATINUM: { label: 'Platinum', icon: '💎', cls: 'bg-[#bc8cff]/15 text-[#bc8cff] border-[#bc8cff]/40' },
}

function VipBadge({ tier }) {
  const cfg = VIP_CFG[tier] || VIP_CFG.MEMBER
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

function statusOf(status) {
  return {
    completed: { label: 'Hoàn thành', cls: 'text-cgreen' },
    pending:   { label: 'Chờ xử lý',  cls: 'text-cyellow' },
    cancelled: { label: 'Đã huỷ',     cls: 'text-cred' },
  }[status] || { label: status, cls: 'text-muted' }
}

// ── Customer Form Modal ────────────────────────────────────────────────────

const EMPTY_FORM = { fullName: '', phone: '', address: '', creditLimit: '' }

function CustomerModal({ initial, onSave, onClose }) {
  const isEdit = !!initial?.id
  const [form, setForm]     = useState(() => isEdit
    ? {
        fullName:    initial.fullName,
        phone:       initial.phone       || '',
        address:     initial.address     || '',
        creditLimit: initial.creditLimit > 0 ? initial.creditLimit.toLocaleString('vi-VN') : '',
      }
    : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.fullName.trim()) { toast.error('Vui lòng nhập họ tên'); return }
    setSaving(true)
    try {
      await onSave({
        ...form,
        fullName:    form.fullName.trim(),
        creditLimit: parseVNDInput(form.creditLimit),
      })
      onClose()
    } catch (err) {
      toast.error(err.message || 'Lỗi lưu')
    } finally {
      setSaving(false)
    }
  }

  const iCls = 'w-full rounded-lg bg-slate-900/60 border border-slate-700 px-4 py-3 text-base text-[#1e293b] placeholder:text-slate-600 outline-none focus:border-cblue focus:ring-1 focus:ring-cblue/30 transition-all min-h-[52px] rounded-xl'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm md:max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="font-bold text-base">{isEdit ? '✏️ Sửa khách hàng' : '➕ Thêm khách hàng'}</div>
            <div className="text-xs text-muted mt-0.5">Thông tin cơ bản của khách</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Họ & Tên *</label>
            <input className={iCls} placeholder="Nguyễn Văn A" value={form.fullName}
              onChange={e => set('fullName', e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Số điện thoại</label>
            <input className={iCls} type="tel" placeholder="0901 234 567" value={form.phone}
              onChange={e => set('phone', e.target.value)} inputMode="tel" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Địa chỉ</label>
            <textarea className={iCls + ' resize-none'} rows={2} placeholder="123 Nguyễn Văn A, Q.7, TP.HCM"
              value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">
              Hạn mức công nợ (₫) <span className="text-slate-600 normal-case font-normal">— 0 = không cho nợ</span>
            </label>
            <input
              className={iCls + ' text-right font-mono text-cyellow border-cyellow/30 focus:border-cyellow focus:ring-cyellow/20'}
              inputMode="numeric"
              placeholder="0"
              value={form.creditLimit}
              onChange={e => set('creditLimit', formatMoneyLive(e.target.value))}
            />
          </div>
          {isEdit && (initial?.currentDebt ?? 0) > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-cred/8 border border-cred/20 px-3 py-2 text-xs">
              <span className="text-slate-400">Nợ hiện tại</span>
              <span className="font-black font-mono text-cred tabular-nums">{fmtVNDFull(initial.currentDebt)}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
              {saving ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Thêm khách'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ── Customer Detail Drawer ─────────────────────────────────────────────────

function CustomerDrawer({ customer, onClose, onEdit }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    loadCustomerOrders(customer.id)
      .then(setOrders)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [customer.id])

  const tier = tierOf(customer.totalSpent || 0)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-sm md:max-w-md bg-surface border-t md:border-t-0 md:border-l border-border flex flex-col shadow-2xl overflow-hidden max-h-[90vh] md:max-h-none">
        {/* Header */}
        <div className="px-5 py-5 border-b border-border bg-surface2 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-cpurple/15 border border-cpurple/30 flex items-center justify-center text-xl font-black text-cpurple shrink-0">
                {customer.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-black text-base text-[#1e293b]">{customer.fullName}</div>
                <div className="text-xs text-muted mt-0.5">{fmtPhone(customer.phone)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(customer)}
                className="w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:border-cblue hover:text-cblue flex items-center justify-center transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface border border-border text-muted hover:text-cred transition-colors text-sm">×</button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-surface rounded-lg border border-border p-3 text-center">
              <div className="text-[10px] text-muted uppercase tracking-wide mb-1">Tổng chi tiêu</div>
              <div className="text-sm font-black text-cpurple tabular-nums">{fmtVNDFull(customer.totalSpent)}</div>
            </div>
            <div className="bg-surface rounded-lg border border-border p-3 text-center">
              <div className="text-[10px] text-muted uppercase tracking-wide mb-1">Đơn hàng</div>
              <div className="text-sm font-black text-cblue">{orders.length}</div>
            </div>
            <div className="bg-surface rounded-lg border border-border p-3 text-center">
              <div className="text-[10px] text-muted uppercase tracking-wide mb-1">Hạng</div>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${tier.cls}`}>
                {tier.label}
              </span>
            </div>
          </div>

          {customer.address && (
            <div className="mt-3 text-xs text-muted flex items-start gap-1.5">
              <span className="mt-0.5">📍</span>
              <span>{customer.address}</span>
            </div>
          )}
        </div>

        {/* Order history */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Lịch sử đơn hàng</div>

          {loading ? (
            <div className="text-center py-8 text-muted text-sm">Đang tải…</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm">
              <div className="text-3xl mb-2">🛒</div>
              Chưa có đơn hàng nào
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {orders.map(ord => {
                const st = statusOf(ord.status)
                const items = ord.order_items || []
                return (
                  <div key={ord.id} className="rounded-xl border border-border bg-surface2 p-3.5">
                    <div className="flex items-start justify-between mb-2 gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted">#{ord.id.slice(-6).toUpperCase()}</span>
                          <span className={`text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">{fmtDate(ord.created_at)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm text-[#1e293b] tabular-nums">{fmtVNDFull(ord.total_amount)}</div>
                        {/* Đã trả / Còn nợ */}
                        {(ord.paid_amount != null && ord.paid_amount < ord.total_amount) && (
                          <div className="text-[10px] text-cblue tabular-nums mt-0.5">
                            Đã trả: {fmtVNDFull(ord.paid_amount)}
                          </div>
                        )}
                        {(ord.debt_amount != null && ord.debt_amount > 0) && (
                          <div className="text-[10px] text-cred font-bold tabular-nums">
                            Còn nợ: {fmtVNDFull(ord.debt_amount)}
                          </div>
                        )}
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div className="border-t border-border/50 pt-2 mt-2 flex flex-col gap-1">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between text-xs text-muted">
                            <span className="truncate flex-1">{item.products?.name || '—'}</span>
                            <span className="ml-2 shrink-0">x{item.quantity} · {fmtVNDFull(item.price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ord.profit != null && ord.profit > 0 && (
                      <div className="mt-2 text-[11px] text-cgreen font-semibold text-right">
                        LN: {fmtVNDFull(ord.profit)}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border shrink-0 text-center">
          <div className="text-[10px] text-muted">Ngày tạo: {fmtDate(customer.createdAt)}</div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [showAdd, setShowAdd]     = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [viewTarget, setViewTarget]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]             = useState(false)
  const [importing, setImporting]           = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const importRef = useRef(null)

  // ── Bộ lọc ngày & công nợ kỳ ────────────────────────
  const [preset,      setPreset]      = useState('all')
  const [customFrom,  setCustomFrom]  = useState(toInputDate(startOf('month')))
  const [customTo,    setCustomTo]    = useState(toInputDate(new Date()))
  const [debtMap,     setDebtMap]     = useState({})
  const [debtLoading, setDebtLoading] = useState(false)

  const isAllTime = preset === 'all'

  const fetchCustomers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await loadCustomers('')
      setCustomers(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  // Realtime: máy B thêm/sửa khách hàng → máy A tự cập nhật
  useEffect(() => {
    const unsub = subscribeCustomers(() => fetchCustomers())
    return unsub
  }, [fetchCustomers])

  // Fetch debt riêng khi preset / custom thay đổi
  useEffect(() => {
    setDebtLoading(true)
    const { from, to } = getDateRange(preset, customFrom, customTo)
    if (!from || !to) { setDebtMap({}); setDebtLoading(false); return }
    loadCustomerDebts(from, to)
      .then(setDebtMap)
      .catch(() => setDebtMap({}))
      .finally(() => setDebtLoading(false))
  }, [preset, customFrom, customTo])

  // ── KPIs ────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total      = customers.length
    const totalSpent = customers.reduce((s, c) => s + (c.totalSpent || 0), 0)
    const avgSpent   = total > 0 ? totalSpent / total : 0
    const vip        = customers.filter(c => (c.vipTier === 'PLATINUM' || c.vipTier === 'GOLD')).length
    const top        = customers[0]
    // Toàn thời gian → dùng current_debt từ customers (chính xác nhất)
    // Theo kỳ → dùng debtMap từ orders.debt_amount
    const totalDebt  = isAllTime
      ? customers.reduce((s, c) => s + (c.currentDebt || 0), 0)
      : Object.values(debtMap).reduce((s, v) => s + v, 0)
    return { total, totalSpent, avgSpent, vip, top, totalDebt }
  }, [customers, debtMap, isAllTime])

  const displayedCustomers = useMemo(() => {
    const safeList  = Array.isArray(customers) ? customers : []
    const safeQuery = removeVietnameseTones(search || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return safeList
    return safeList.filter(c => {
      const name  = removeVietnameseTones(c?.fullName)
      const phone = removeVietnameseTones(c?.phone)
      return words.every(w => name.includes(w) || phone.includes(w))
    }).sort((a, b) => {
      const nA = removeVietnameseTones(a?.fullName || '')
      const nB = removeVietnameseTones(b?.fullName || '')
      const aStarts = nA.startsWith(safeQuery)
      const bStarts = nB.startsWith(safeQuery)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      const aExact = ` ${nA} `.includes(` ${safeQuery} `)
      const bExact = ` ${nB} `.includes(` ${safeQuery} `)
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })
  }, [customers, search])

  const isSearching = loading && search.length > 0

  // ── Actions ─────────────────────────────────────────────
  async function handleAdd(payload) {
    const saved = await insertCustomer(payload)
    setCustomers(prev => [saved, ...prev])
    toast.success(`Đã thêm khách "${saved.fullName}"`)
  }

  async function handleEdit(payload) {
    const saved = await updateCustomer(editTarget.id, { ...editTarget, ...payload })
    setCustomers(prev => prev.map(c => c.id === editTarget.id ? saved : c))
    if (viewTarget?.id === editTarget.id) setViewTarget(saved)
    toast.success('Đã cập nhật thông tin khách')
    setEditTarget(null)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteCustomer(deleteTarget.id)
      setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id))
      if (viewTarget?.id === deleteTarget.id) setViewTarget(null)
      toast.success(`Đã xoá "${deleteTarget.fullName}"`)
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  // ── Xuất Excel ──────────────────────────────────────────
  async function handleExportExcel() {
    const toastId = toast.loading('Đang xuất dữ liệu…')
    try {
      const all  = await loadCustomers('')
      const rows = all.map(c => ({
        'Tên khách hàng': c.fullName,
        'Điện thoại':     c.phone   || '',
        'Địa chỉ':        c.address || '',
        'Tổng chi tiêu':  c.totalSpent ?? 0,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 36 }, { wch: 16 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Khách Hàng')
      XLSX.writeFile(wb, 'Danh_Sach_Khach_Hang.xlsx')
      toast.success(`Đã xuất ${all.length} khách hàng`, { id: toastId })
    } catch (err) {
      toast.error(err.message || 'Lỗi xuất Excel', { id: toastId })
    }
  }

  // ── Nhập Excel ──────────────────────────────────────────
  function handleImportExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = null

    setImporting(true)
    setImportProgress('')
    const toastId = toast.loading('Đang đọc file…')

    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        // ── 1. Đọc thành mảng 2 chiều để tìm header thật ────
        const data      = new Uint8Array(event.target.result)
        const workbook  = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]

        // Đọc raw để dò dòng header (bỏ qua dòng rác KiotViet ở đầu file)
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

        const HEADER_KEYWORDS = ['Điện thoại', 'Mã khách hàng', 'Tên khách hàng']
        let headerRowIndex = 0
        for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
          const row = rawRows[i]
          if (Array.isArray(row) && HEADER_KEYWORDS.some(kw => row.includes(kw))) {
            headerRowIndex = i
            break
          }
        }

        // Parse lại từ đúng dòng header
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex })

        if (!jsonData || jsonData.length === 0) {
          toast.error('File không có dữ liệu hoặc sai định dạng!', { id: toastId })
          setImporting(false)
          return
        }

        // ── 2. Map & làm sạch — chấp nhận toàn bộ khách ─────
        const cleanMoney = (val) => {
          if (val === undefined || val === null || val === '') return 0
          const s   = String(val).trim()
          const neg = s.startsWith('-')
          const n   = Math.round(Number(s.replace(/[^0-9.]/g, '')) || 0)
          return neg ? -n : n
        }

        const mapped = jsonData.map(row => {
          // Làm sạch số điện thoại
          let phone = String(
            row['Điện thoại'] ?? row['SĐT'] ?? row['Phone'] ?? ''
          ).replace(/[^0-9]/g, '').trim()

          // Nếu không có SĐT hợp lệ → tạo số ảo từ mã KH
          if (!phone || phone.length < 8) {
            const maKH = String(
              row['Mã khách hàng'] ?? row['Mã KH'] ?? ''
            ).replace(/[^0-9A-Za-z]/g, '').trim()
            phone = '000' + (maKH || Math.floor(Math.random() * 1_000_000))
          }

          return {
            fullName:   String(row['Tên khách hàng'] ?? row['Tên'] ?? '').trim() || 'Khách vãng lai',
            phone,
            address:    String(row['Địa chỉ'] ?? row['Địa chỉ chi tiết'] ?? '').trim() || '',
            totalSpent: cleanMoney(row['Tổng bán'] ?? row['Tổng chi tiêu'] ?? row['Nợ hiện tại'] ?? 0),
          }
        })

        // ── 3. Upsert lên Supabase (onConflict: phone) ───────
        const saveMsg = `Đang upsert ${mapped.length} khách hàng…`
        setImportProgress(saveMsg)
        toast.loading(saveMsg, { id: toastId })

        const saved = await upsertCustomers(mapped)

        const refreshed = await loadCustomers('')
        setCustomers(refreshed)

        toast.success(
          `✅ Import thành công ${saved.length} / ${mapped.length} khách hàng`,
          { id: toastId, duration: 5000 }
        )
      } catch (err) {
        console.error('[Import Customers]', err)
        toast.error(err.message || 'Lỗi import file', { id: toastId })
      } finally {
        setImporting(false)
        setImportProgress('')
      }
    }

    reader.onerror = () => {
      toast.error('Không đọc được file!', { id: toastId })
      setImporting(false)
      setImportProgress('')
    }

    reader.readAsArrayBuffer(file)
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="p-6 w-full">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Tổng khách hàng', value: kpis.total,                  unit: 'khách',  color: 'text-cpurple',   icon: '👥' },
          { label: 'Tổng doanh số',   value: fmtVNDFull(kpis.totalSpent), unit: '',        color: 'text-cgreen',    icon: '💰' },
          { label: 'Trung bình / KH', value: fmtVNDFull(kpis.avgSpent),   unit: '',        color: 'text-cblue',     icon: '📊' },
          { label: 'Khách VIP (💎)',  value: kpis.vip,                    unit: 'khách',   color: 'text-[#bc8cff]', icon: '💎' },
          {
            label: debtLoading ? 'Công nợ …' : isAllTime ? 'Tổng công nợ' : 'Công nợ kỳ',
            value: fmtVNDFull(kpis.totalDebt),
            unit: isAllTime ? 'Toàn thời gian' : (preset === 'custom' && customFrom && customTo ? `${customFrom} → ${customTo}` : ''),
            color: kpis.totalDebt > 0 ? 'text-cred' : 'text-slate-400',
            icon: '💸',
          },
        ].map(k => (
          <div key={k.label} className="card p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-2xl opacity-20">{k.icon}</div>
            <div className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1.5">{k.label}</div>
            <div className={`text-xl font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
            {k.unit && <div className="text-[10px] text-muted mt-0.5 truncate">{k.unit}</div>}
          </div>
        ))}
      </div>

      {/* Top khách hàng banner */}
      {kpis.top && kpis.top.totalSpent > 0 && (
        <div className="mb-5 rounded-xl border border-[#bc8cff]/25 bg-[#bc8cff]/8 px-5 py-3.5 flex items-center gap-4">
          <div className="text-2xl">🏆</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[#bc8cff] font-semibold uppercase tracking-wide">Khách hàng chi tiêu nhiều nhất</div>
            <div className="font-black text-[#1e293b] truncate">{kpis.top.fullName}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-black text-lg text-[#bc8cff] tabular-nums">{fmtVNDFull(kpis.top.totalSpent)}</div>
            {kpis.top.phone && <div className="text-xs text-muted">{fmtPhone(kpis.top.phone)}</div>}
          </div>
          <button onClick={() => setViewTarget(kpis.top)}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-[#bc8cff]/30 text-[#bc8cff] text-xs font-semibold hover:bg-[#bc8cff]/15 transition-colors">
            Xem →
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/>
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          {isSearching
            ? <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cpurple animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>
            : <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          }
          <input className="input-base pl-9 text-sm" placeholder="Tìm theo tên, SĐT… (debounce 400ms)"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {/* Bộ lọc thời gian */}
        <DateFilterBar
          preset={preset}       setPreset={setPreset}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo}   setCustomTo={setCustomTo}
          loading={debtLoading}
          showAllTime={true}
          className="shrink-0"
        />

        {/* Xuất Excel */}
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors whitespace-nowrap"
        >
          📤 Xuất Excel
        </button>

        {/* Nhập Excel */}
        <button
          onClick={() => importRef.current?.click()}
          disabled={importing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {importing
            ? <>
                <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
                </svg>
                <span className="truncate max-w-[160px]">{importProgress || 'Đang nhập…'}</span>
              </>
            : '📥 Nhập Excel'
          }
        </button>
        <input
          ref={importRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleImportExcel}
        />

        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-4 py-3 text-base">
          <span className="text-base leading-none">＋</span> Thêm khách
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xl shadow-black/20">
        <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
          <div className="text-sm font-bold">Danh sách khách hàng</div>
          <span className="tag-blue">{displayedCustomers.length}{search ? ` / ${customers.length}` : ''} khách{search ? ` (lọc: "${search}")` : ''}</span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-muted text-sm">Đang tải dữ liệu từ Cloud…</div>
        ) : displayedCustomers.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <div className="text-4xl mb-3">👥</div>
            <div className="font-semibold mb-1">{search ? 'Không tìm thấy khách' : 'Chưa có khách hàng'}</div>
            {!search && (
              <button onClick={() => setShowAdd(true)} className="btn-primary mt-3 px-5 py-2 text-sm">
                ＋ Thêm khách đầu tiên
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile: Card list (< sm) ── */}
            <div className="sm:hidden flex flex-col gap-2 p-3">
              {displayedCustomers.map((c, idx) => {
                const debt = debtMap[c.id] ?? 0
                return (
                  <div key={c.id}
                    onClick={() => setViewTarget(c)}
                    className="bg-[#ffffff] border border-slate-800 rounded-xl p-3.5 active:bg-slate-800/40 cursor-pointer">
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-11 h-11 rounded-xl bg-cpurple/15 border border-cpurple/20 flex items-center justify-center text-base font-black text-cpurple shrink-0">
                        {c.fullName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-100 truncate">{c.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{fmtPhone(c.phone)}</div>
                        {idx === 0 && c.totalSpent > 0 && <div className="text-[10px] text-[#bc8cff] mt-0.5">🏆 Top khách</div>}
                      </div>
                      <VipBadge tier={c.vipTier || calcVipTier(c.totalSpent || 0)} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
                      <div className="bg-slate-800/60 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 mb-0.5">Chi tiêu</div>
                        <div className="text-xs font-mono font-bold text-cpurple">{fmtVNDFull(c.totalSpent || 0)}</div>
                      </div>
                      <div className="bg-slate-800/60 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 mb-0.5">Nợ hiện tại</div>
                        <div className={`text-xs font-mono font-bold ${(c.currentDebt ?? 0) > 0 ? 'text-cred' : 'text-slate-500'}`}>
                          {(c.currentDebt ?? 0) > 0 ? fmtVNDFull(c.currentDebt) : '—'}
                        </div>
                      </div>
                      <div className="bg-slate-800/60 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 mb-0.5">Điểm ★</div>
                        <div className={`text-xs font-bold ${(c.rewardPoints ?? 0) > 0 ? 'text-cyellow' : 'text-slate-500'}`}>
                          {(c.rewardPoints ?? 0) > 0 ? `★ ${c.rewardPoints.toLocaleString('vi-VN')}` : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setViewTarget(c)} className="flex-1 h-9 rounded-lg border border-slate-700 text-slate-400 text-xs font-medium hover:border-cpurple hover:text-cpurple active:scale-95 transition-all">
                        👁 Chi tiết
                      </button>
                      <button onClick={() => setEditTarget(c)} className="flex-1 h-9 rounded-lg border border-slate-700 text-slate-400 text-xs font-medium hover:border-cblue hover:text-cblue active:scale-95 transition-all">
                        ✏️ Sửa
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="h-9 w-9 rounded-lg border border-slate-700 text-slate-500 hover:border-cred hover:text-cred active:scale-95 transition-all flex items-center justify-center">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M9 3h6m-8 5h10m-9 0l.6 12h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop: Table (≥ sm) ── */}
            <div className="hidden sm:block w-full overflow-x-auto whitespace-nowrap">
              <table className="w-full min-w-[700px] text-xs md:text-sm">
                <thead>
                  <tr className="bg-[#f1f5f9] border-b border-border">
                    {['Khách hàng', 'SĐT', 'Tổng chi tiêu', 'Công nợ kỳ', 'Nợ hiện tại', 'Hạn mức', 'Hạng VIP', 'Điểm ★', 'Ngày tạo', 'Thao tác'].map(h => (
                      <th key={h} className={`px-4 py-3 text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap ${['Tổng chi tiêu','Công nợ kỳ','Nợ hiện tại','Hạn mức','Điểm ★'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayedCustomers.map((c, idx) => {
                    return (
                      <tr key={c.id}
                        className="border-b border-border/40 last:border-0 hover:bg-slate-800/40 transition-colors group cursor-pointer"
                        onClick={() => setViewTarget(c)}>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-cpurple/15 border border-cpurple/20 flex items-center justify-center text-sm font-black text-cpurple shrink-0">
                              {c.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-sm text-[#1e293b]">{c.fullName}</div>
                              {idx === 0 && c.totalSpent > 0 && (
                                <div className="text-[10px] text-[#bc8cff]">🏆 Top khách</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-slate-300 font-mono whitespace-nowrap">{fmtPhone(c.phone)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm font-bold tabular-nums whitespace-nowrap">
                          <span className={(c.totalSpent ?? 0) > 0 ? 'text-cpurple' : (c.totalSpent ?? 0) < 0 ? 'text-cgreen' : 'text-slate-400'}>
                            {fmtVNDFull(c.totalSpent || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm font-bold tabular-nums whitespace-nowrap">
                          {debtLoading ? <span className="text-slate-600 text-xs">…</span> : (() => {
                            const debt = debtMap[c.id] ?? 0
                            return <span className={debt > 0 ? 'text-red-400' : debt < 0 ? 'text-green-400' : 'text-slate-500'}>{debt === 0 ? '—' : fmtVNDFull(debt)}</span>
                          })()}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm tabular-nums whitespace-nowrap">
                          {(c.currentDebt ?? 0) > 0 ? <span className="font-bold text-cred">{fmtVNDFull(c.currentDebt)}</span> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm tabular-nums whitespace-nowrap">
                          {(c.creditLimit ?? 0) > 0 ? <span className="text-cyellow">{fmtVNDFull(c.creditLimit)}</span> : <span className="text-slate-600 text-xs">Không nợ</span>}
                        </td>
                        <td className="px-4 py-3.5"><VipBadge tier={c.vipTier || calcVipTier(c.totalSpent || 0)} /></td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {(c.rewardPoints ?? 0) > 0 ? <span className="text-cyellow font-bold text-sm">★ {c.rewardPoints.toLocaleString('vi-VN')}</span> : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewTarget(c)} title="Xem chi tiết"
                              className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:border-cpurple hover:text-cpurple hover:bg-cpurple/10 transition-colors flex items-center justify-center">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8"/></svg>
                            </button>
                            <button onClick={() => setEditTarget(c)} title="Sửa"
                              className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors flex items-center justify-center">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                            <button onClick={() => setDeleteTarget(c)} title="Xoá"
                              className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:border-cred hover:text-cred hover:bg-cred/10 transition-colors flex items-center justify-center">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M9 3h6m-8 5h10m-9 0l.6 12h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modals & Drawer */}
      {showAdd    && <CustomerModal onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {editTarget && <CustomerModal initial={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} />}

      {viewTarget && (
        <CustomerDrawer
          customer={viewTarget}
          onClose={() => setViewTarget(null)}
          onEdit={c => { setViewTarget(null); setEditTarget(c) }}
        />
      )}

      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)}>
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="text-lg font-bold text-cred">Xoá khách hàng?</div>
            <div className="text-sm text-muted">
              <span className="font-semibold text-[#1e293b]">{deleteTarget.fullName}</span><br/>
              Lịch sử đơn hàng của khách sẽ không bị xoá.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-cred/20 border border-cred/40 text-cred text-sm font-bold hover:bg-cred/30 transition-colors disabled:opacity-60">
                {deleting ? 'Đang xoá…' : 'Xoá'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
