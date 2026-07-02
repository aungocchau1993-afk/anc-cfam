import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  Users, Search, Loader2, Download, Upload, Plus, X, Pencil, Eye,
  Trash2, MapPin, ShoppingCart, Trophy, Wallet, Star, Gem,
} from 'lucide-react'
import ModalOverlay from '../../components/ui/ModalOverlay'
import PageHeader from '../../components/ui/PageHeader'
import DateFilterBar, { getDateRange, toInputDate, startOf } from '../../components/ui/DateFilterBar'
import { SkeletonTableBody, SkeletonCard } from '../../components/ui/Skeleton'
import Can from '../../components/permission/Can'
import { PERMISSIONS } from '../../lib/permissions/permissionConstants'
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
  if (spent >= 50_000_000) return { label: 'VIP',    cls: 'bg-violet-50 text-cpurple border border-violet-200' }
  if (spent >= 10_000_000) return { label: 'Gold',   cls: 'bg-amber-50 text-cyellow border border-amber-200' }
  if (spent >= 2_000_000)  return { label: 'Silver', cls: 'bg-gray-100 text-muted border border-border' }
  return                         { label: 'New',     cls: 'bg-emerald-50 text-cgreen border border-emerald-200' }
}

const VIP_CFG = {
  MEMBER:   { label: 'Member',   cls: 'bg-gray-100 text-muted border border-border' },
  SILVER:   { label: 'Silver',   cls: 'bg-gray-100 text-slate-600 border border-border' },
  GOLD:     { label: 'Gold',     cls: 'bg-amber-50 text-cyellow border border-amber-200' },
  PLATINUM: { label: 'Platinum', cls: 'bg-violet-50 text-cpurple border border-violet-200' },
}

// Avatar gradient theo VIP tier
const AVATAR_CFG = {
  MEMBER:   'bg-gradient-to-br from-gray-400 to-gray-500',
  SILVER:   'bg-gradient-to-br from-slate-400 to-slate-500',
  GOLD:     'bg-gradient-to-br from-amber-400 to-amber-600',
  PLATINUM: 'bg-gradient-to-br from-violet-500 to-purple-600',
}

function VipBadge({ tier }) {
  const cfg = VIP_CFG[tier] || VIP_CFG.MEMBER
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap ${cfg.cls}`}>
      {tier === 'PLATINUM' && <Gem size={11} />}
      {cfg.label}
    </span>
  )
}

function CustomerAvatar({ name, tier, size = 'md' }) {
  const sizes = {
    sm: 'w-9 h-9 text-sm',
    md: 'w-11 h-11 text-base',
    lg: 'w-12 h-12 text-xl',
  }
  const cfg = AVATAR_CFG[tier] || AVATAR_CFG.MEMBER
  return (
    <div className={`${sizes[size]} rounded-full ${cfg} flex items-center justify-center font-black text-white shrink-0 shadow-sm`}>
      {(name || '?').charAt(0).toUpperCase()}
    </div>
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

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm md:max-w-md mx-4 shadow-cardHover">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="font-bold text-cardtitle text-text">{isEdit ? 'Sửa khách hàng' : 'Thêm khách hàng'}</div>
            <div className="text-caption text-muted mt-0.5">Thông tin cơ bản của khách</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-surface2 border border-border text-muted hover:text-cred hover:border-cred/40 transition-colors flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wide">Họ & Tên *</label>
            <input className="input-base" placeholder="Nguyễn Văn A" value={form.fullName}
              onChange={e => set('fullName', e.target.value)} autoFocus />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wide">Số điện thoại</label>
            <input className="input-base" type="tel" placeholder="0901 234 567" value={form.phone}
              onChange={e => set('phone', e.target.value)} inputMode="tel" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wide">Địa chỉ</label>
            <textarea className="input-base resize-none !h-auto py-2.5" rows={2} placeholder="123 Nguyễn Văn A, Q.7, TP.HCM"
              value={form.address} onChange={e => set('address', e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wide">
              Hạn mức công nợ (₫) <span className="text-subtle normal-case font-normal">— 0 = không cho nợ</span>
            </label>
            <input
              className="input-base text-right font-mono text-cyellow border-amber-200 focus:border-cyellow focus:ring-cyellow/20"
              inputMode="numeric"
              placeholder="0"
              value={form.creditLimit}
              onChange={e => set('creditLimit', formatMoneyLive(e.target.value))}
            />
          </div>
          {isEdit && (initial?.currentDebt ?? 0) > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-sm">
              <span className="text-muted">Nợ hiện tại</span>
              <span className="font-black font-mono text-cred tabular-nums">{fmtVNDFull(initial.currentDebt)}</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost">Huỷ</button>
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-60">
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
  const vipTier = customer.vipTier || calcVipTier(customer.totalSpent || 0)

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-full max-w-sm md:max-w-md bg-surface border-t md:border-t-0 md:border-l border-border flex flex-col shadow-cardHover overflow-hidden max-h-[90vh] md:max-h-none">
        {/* Header */}
        <div className="px-5 py-5 border-b border-border bg-surface2 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <CustomerAvatar name={customer.fullName} tier={vipTier} size="lg" />
              <div>
                <div className="font-black text-cardtitle text-text">{customer.fullName}</div>
                <div className="text-caption text-muted mt-0.5">{fmtPhone(customer.phone)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(customer)}
                className="w-9 h-9 rounded-xl border border-border bg-surface text-muted hover:border-cblue hover:text-cblue flex items-center justify-center transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={onClose} className="w-9 h-9 rounded-xl bg-surface border border-border text-muted hover:text-cred transition-colors flex items-center justify-center">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-surface rounded-xl border border-border p-3 text-center">
              <div className="text-[12px] text-muted uppercase tracking-wide mb-1">Tổng chi tiêu</div>
              <div className="text-sm font-black text-cpurple tabular-nums">{fmtVNDFull(customer.totalSpent)}</div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-3 text-center">
              <div className="text-[12px] text-muted uppercase tracking-wide mb-1">Đơn hàng</div>
              <div className="text-sm font-black text-cblue">{orders.length}</div>
            </div>
            <div className="bg-surface rounded-xl border border-border p-3 text-center">
              <div className="text-[12px] text-muted uppercase tracking-wide mb-1">Hạng</div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-bold ${tier.cls}`}>
                {tier.label}
              </span>
            </div>
          </div>

          {customer.address && (
            <div className="mt-3 text-caption text-muted flex items-start gap-1.5">
              <MapPin size={13} className="mt-0.5 shrink-0" />
              <span>{customer.address}</span>
            </div>
          )}
        </div>

        {/* Order history */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Lịch sử đơn hàng</div>

          {loading ? (
            <div className="text-center py-8 text-muted text-sm flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin" /> Đang tải…
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm flex flex-col items-center gap-2">
              <ShoppingCart size={28} className="text-subtle" />
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
                          <span className="font-mono text-[12px] text-muted">#{ord.id.slice(-6).toUpperCase()}</span>
                          <span className={`text-[12px] font-bold ${st.cls}`}>{st.label}</span>
                        </div>
                        <div className="text-[12px] text-muted mt-0.5">{fmtDate(ord.created_at)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-sm text-text tabular-nums">{fmtVNDFull(ord.total_amount)}</div>
                        {/* Đã trả / Còn nợ */}
                        {(ord.paid_amount != null && ord.paid_amount < ord.total_amount) && (
                          <div className="text-[12px] text-cblue tabular-nums mt-0.5">
                            Đã trả: {fmtVNDFull(ord.paid_amount)}
                          </div>
                        )}
                        {(ord.debt_amount != null && ord.debt_amount > 0) && (
                          <div className="text-[12px] text-cred font-bold tabular-nums">
                            Còn nợ: {fmtVNDFull(ord.debt_amount)}
                          </div>
                        )}
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div className="border-t border-border pt-2 mt-2 flex flex-col gap-1">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between text-xs text-muted">
                            <span className="truncate flex-1">{item.products?.name || '—'}</span>
                            <span className="ml-2 shrink-0">x{item.quantity} · {fmtVNDFull(item.price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ord.profit != null && ord.profit > 0 && (
                      <div className="mt-2 text-[12px] text-cgreen font-semibold text-right">
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
          <div className="text-[12px] text-muted">Ngày tạo: {fmtDate(customer.createdAt)}</div>
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

  // ── UI-only state bổ sung (chọn nhiều / bulk actions) — không đụng CRUD/API ──
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkBusy,    setBulkBusy]    = useState(false)

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

  // ── Pagination (client-side, theo pattern Products.jsx) ──
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const totalPages = Math.max(1, Math.ceil(displayedCustomers.length / pageSize))
  useEffect(() => { setPage(1) }, [search, pageSize])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const pagedCustomers = useMemo(
    () => displayedCustomers.slice((page - 1) * pageSize, page * pageSize),
    [displayedCustomers, page, pageSize]
  )
  const pageStart = displayedCustomers.length === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd   = Math.min(page * pageSize, displayedCustomers.length)

  function pageList(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
    if (cur <= 4)        return [1, 2, 3, 4, 5, '…', total]
    if (cur >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
    return [1, '…', cur - 1, cur, cur + 1, '…', total]
  }

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

  // ── Bulk actions (thanh Action nổi) — chỉ lặp gọi lại deleteCustomer đã import
  // sẵn ở đầu file, KHÔNG viết CRUD/API mới. ───────────────────────────────
  function toggleSelectOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectAllOnPage() {
    setSelectedIds(prev => {
      const pageIds = pagedCustomers.map(c => c.id)
      const allSelected = pageIds.length > 0 && pageIds.every(id => prev.has(id))
      const next = new Set(prev)
      pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  const selectedCustomers = useMemo(
    () => customers.filter(c => selectedIds.has(c.id)),
    [customers, selectedIds]
  )

  async function handleBulkDelete() {
    if (!window.confirm(`Xoá ${selectedIds.size} khách hàng đã chọn? Hành động này không thể hoàn tác.`)) return
    setBulkBusy(true)
    try {
      for (const c of selectedCustomers) await deleteCustomer(c.id)
      setCustomers(prev => prev.filter(x => !selectedIds.has(x.id)))
      if (viewTarget && selectedIds.has(viewTarget.id)) setViewTarget(null)
      toast.success(`Đã xoá ${selectedCustomers.length} khách hàng`)
      clearSelection()
    } catch (e) {
      toast.error(e.message || 'Lỗi xoá hàng loạt')
    } finally {
      setBulkBusy(false)
    }
  }

  function handleBulkExportExcel() {
    const rows = selectedCustomers.map(c => ({
      'Tên khách hàng': c.fullName,
      'Điện thoại':     c.phone   || '',
      'Địa chỉ':        c.address || '',
      'Tổng chi tiêu':  c.totalSpent ?? 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 36 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Khách Hàng đã chọn')
    XLSX.writeFile(wb, 'Khach_Hang_Da_Chon.xlsx')
    toast.success(`Đã xuất ${rows.length} khách hàng`)
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
          `Import thành công ${saved.length} / ${mapped.length} khách hàng`,
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
    <div className="w-full">
      <PageHeader icon={Users} title="Khách Hàng" subtitle="Quản lý khách hàng, công nợ và điểm thưởng" />
    <div className="p-6 w-full">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Tổng khách hàng', value: kpis.total,                  unit: 'khách',  color: 'text-cpurple', icon: Users },
          { label: 'Tổng doanh số',   value: fmtVNDFull(kpis.totalSpent), unit: '',        color: 'text-cgreen',  icon: Wallet },
          { label: 'Trung bình / KH', value: fmtVNDFull(kpis.avgSpent),   unit: '',        color: 'text-cblue',   icon: Trophy },
          { label: 'Khách VIP',       value: kpis.vip,                    unit: 'khách',   color: 'text-cpurple', icon: Gem },
          {
            label: debtLoading ? 'Công nợ …' : isAllTime ? 'Tổng công nợ' : 'Công nợ kỳ',
            value: fmtVNDFull(kpis.totalDebt),
            unit: isAllTime ? 'Toàn thời gian' : (preset === 'custom' && customFrom && customTo ? `${customFrom} → ${customTo}` : ''),
            color: kpis.totalDebt > 0 ? 'text-cred' : 'text-muted',
            icon: Wallet,
          },
        ].map(k => (
          <div key={k.label} className="card p-4 relative overflow-hidden">
            <k.icon size={36} className="absolute top-3 right-3 opacity-10" />
            <div className="text-[12px] text-muted font-semibold uppercase tracking-wide mb-1.5">{k.label}</div>
            <div className={`text-xl font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
            {k.unit && <div className="text-[12px] text-muted mt-0.5 truncate">{k.unit}</div>}
          </div>
        ))}
      </div>

      {/* Top khách hàng banner */}
      {kpis.top && kpis.top.totalSpent > 0 && (
        <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3.5 flex items-center gap-4">
          <Trophy size={24} className="text-cpurple shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-cpurple font-semibold uppercase tracking-wide">Khách hàng chi tiêu nhiều nhất</div>
            <div className="font-black text-text truncate">{kpis.top.fullName}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-black text-lg text-cpurple tabular-nums">{fmtVNDFull(kpis.top.totalSpent)}</div>
            {kpis.top.phone && <div className="text-xs text-muted">{fmtPhone(kpis.top.phone)}</div>}
          </div>
          <button onClick={() => setViewTarget(kpis.top)}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-violet-200 text-cpurple text-xs font-semibold hover:bg-violet-100 transition-colors">
            Xem →
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          {isSearching
            ? <Loader2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cpurple animate-spin" />
            : <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
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
        <Can permission={PERMISSIONS.CRM_EXPORT}>
          <button
            onClick={handleExportExcel}
            className="btn-ghost whitespace-nowrap"
          >
            <Download size={15} /> Xuất Excel
          </button>
        </Can>

        {/* Nhập Excel */}
        <Can permission={PERMISSIONS.CRM_CREATE}>
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {importing
              ? <>
                  <Loader2 size={15} className="animate-spin shrink-0" />
                  <span className="truncate max-w-[160px]">{importProgress || 'Đang nhập…'}</span>
                </>
              : <><Upload size={15} /> Nhập Excel</>
            }
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImportExcel}
          />

          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <Plus size={16} /> Thêm khách
          </button>
        </Can>
      </div>

      {/* ══════════════════ BULK ACTION BAR — nổi phía trên Table khi có chọn ══════════════════ */}
      {selectedIds.size > 0 && (
        <div className="mb-4 bg-[#0f172a] rounded-2xl shadow-lg px-4 py-3 flex flex-wrap items-center gap-2.5 animate-slideUp">
          <span className="text-sm font-semibold text-white mr-1">Đã chọn {selectedIds.size} khách hàng</span>
          <div className="w-px h-6 bg-white/15 hidden sm:block" />
          <Can permission={PERMISSIONS.CRM_EXPORT}>
            <button onClick={handleBulkExportExcel} disabled={bulkBusy}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[14px] font-medium transition-colors disabled:opacity-50">
              <Download size={14} strokeWidth={2} /> Xuất Excel
            </button>
          </Can>
          <Can permission={PERMISSIONS.CRM_DELETE}>
            <button onClick={handleBulkDelete} disabled={bulkBusy}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-[14px] font-medium transition-colors disabled:opacity-50">
              {bulkBusy ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />} Xóa
            </button>
          </Can>
          <button onClick={clearSelection}
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg text-white/60 hover:text-white text-[14px] font-medium transition-colors ml-auto">
            <X size={14} strokeWidth={2.2} /> Bỏ chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
          <div className="text-sm font-bold text-text">Danh sách khách hàng</div>
          <span className="tag-blue">{displayedCustomers.length}{search ? ` / ${customers.length}` : ''} khách{search ? ` (lọc: "${search}")` : ''}</span>
        </div>

        {loading ? (
          <>
            <div className="sm:hidden flex flex-col gap-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-0">
                <tbody className="divide-y divide-border">
                  <SkeletonTableBody rows={8} columns={5} />
                </tbody>
              </table>
            </div>
          </>
        ) : displayedCustomers.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Users size={40} className="mx-auto mb-3 text-subtle" />
            <div className="font-semibold mb-1">{search ? 'Không tìm thấy khách' : 'Chưa có khách hàng'}</div>
            {!search && (
              <button onClick={() => setShowAdd(true)} className="btn-primary mt-3 mx-auto">
                <Plus size={15} /> Thêm khách đầu tiên
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile: Card list (< sm) ── */}
            <div className="sm:hidden flex flex-col gap-2 p-3">
              {pagedCustomers.map((c, idx) => {
                const vipTier = c.vipTier || calcVipTier(c.totalSpent || 0)
                return (
                  <div key={c.id}
                    onClick={() => setViewTarget(c)}
                    className="bg-surface border border-border rounded-xl p-3.5 active:bg-surface2 cursor-pointer transition-colors">
                    <div className="flex items-center gap-3 mb-2.5">
                      <CustomerAvatar name={c.fullName} tier={vipTier} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-text truncate">{c.fullName}</div>
                        <div className="text-[12px] text-muted font-mono mt-0.5">{fmtPhone(c.phone)}</div>
                        {page === 1 && idx === 0 && c.totalSpent > 0 && (
                          <div className="text-[12px] text-cpurple mt-0.5 flex items-center gap-1"><Trophy size={10} /> Top khách</div>
                        )}
                      </div>
                      <VipBadge tier={vipTier} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-2.5">
                      <div className="bg-surface2 rounded-lg p-2">
                        <div className="text-[12px] text-muted mb-0.5">Chi tiêu</div>
                        <div className="text-xs font-mono font-bold text-cpurple">{fmtVNDFull(c.totalSpent || 0)}</div>
                      </div>
                      <div className="bg-surface2 rounded-lg p-2">
                        <div className="text-[12px] text-muted mb-0.5">Nợ hiện tại</div>
                        <div className={`text-xs font-mono font-bold ${(c.currentDebt ?? 0) > 0 ? 'text-cred' : 'text-subtle'}`}>
                          {(c.currentDebt ?? 0) > 0 ? fmtVNDFull(c.currentDebt) : '—'}
                        </div>
                      </div>
                      <div className="bg-surface2 rounded-lg p-2">
                        <div className="text-[12px] text-muted mb-0.5">Điểm</div>
                        <div className={`text-xs font-bold flex items-center justify-center gap-0.5 ${(c.rewardPoints ?? 0) > 0 ? 'text-cyellow' : 'text-subtle'}`}>
                          {(c.rewardPoints ?? 0) > 0 ? <><Star size={10} fill="currentColor" /> {c.rewardPoints.toLocaleString('vi-VN')}</> : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setViewTarget(c)} className="flex-1 h-9 rounded-lg border border-border text-muted text-xs font-medium hover:border-cpurple hover:text-cpurple active:scale-95 transition-all flex items-center justify-center gap-1.5">
                        <Eye size={13} /> Chi tiết
                      </button>
                      <Can permission={PERMISSIONS.CRM_UPDATE}>
                        <button onClick={() => setEditTarget(c)} className="flex-1 h-9 rounded-lg border border-border text-muted text-xs font-medium hover:border-cblue hover:text-cblue active:scale-95 transition-all flex items-center justify-center gap-1.5">
                          <Pencil size={13} /> Sửa
                        </button>
                      </Can>
                      <Can permission={PERMISSIONS.CRM_DELETE}>
                        <button onClick={() => setDeleteTarget(c)} className="h-9 w-9 rounded-lg border border-border text-subtle hover:border-cred hover:text-cred active:scale-95 transition-all flex items-center justify-center">
                          <Trash2 size={14} />
                        </button>
                      </Can>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop: Table (≥ sm) ── */}
            <div className="hidden sm:block w-full overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs md:text-sm">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-border">
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={pagedCustomers.length > 0 && pagedCustomers.every(c => selectedIds.has(c.id))}
                        onChange={toggleSelectAllOnPage}
                        className="w-4 h-4 rounded accent-cblue" />
                    </th>
                    {['Khách hàng', 'SĐT', 'Tổng chi tiêu', 'Công nợ kỳ', 'Nợ hiện tại', 'Hạn mức', 'Hạng VIP', 'Điểm', 'Ngày tạo', 'Thao tác'].map(h => (
                      <th key={h} className={`sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap ${['Tổng chi tiêu','Công nợ kỳ','Nợ hiện tại','Hạn mức','Điểm'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagedCustomers.map((c, idx) => {
                    const vipTier = c.vipTier || calcVipTier(c.totalSpent || 0)
                    const checked = selectedIds.has(c.id)
                    return (
                      <tr key={c.id}
                        className={`hover:bg-surface2 transition-colors group cursor-pointer ${checked ? 'bg-blue-50/60' : ''}`}
                        onClick={() => setViewTarget(c)}>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={checked} onChange={() => toggleSelectOne(c.id)} className="w-4 h-4 rounded accent-cblue" />
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <CustomerAvatar name={c.fullName} tier={vipTier} size="sm" />
                            <div>
                              <div className="font-semibold text-sm text-text">{c.fullName}</div>
                              {page === 1 && idx === 0 && c.totalSpent > 0 && (
                                <div className="text-[12px] text-cpurple flex items-center gap-1"><Trophy size={10} /> Top khách</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted font-mono whitespace-nowrap">{fmtPhone(c.phone)}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm font-bold tabular-nums whitespace-nowrap">
                          <span className={(c.totalSpent ?? 0) > 0 ? 'text-cpurple' : (c.totalSpent ?? 0) < 0 ? 'text-cgreen' : 'text-subtle'}>
                            {fmtVNDFull(c.totalSpent || 0)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm font-bold tabular-nums whitespace-nowrap">
                          {debtLoading ? <span className="text-subtle text-xs">…</span> : (() => {
                            const debt = debtMap[c.id] ?? 0
                            return <span className={debt > 0 ? 'text-cred' : debt < 0 ? 'text-cgreen' : 'text-subtle'}>{debt === 0 ? '—' : fmtVNDFull(debt)}</span>
                          })()}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm tabular-nums whitespace-nowrap">
                          {(c.currentDebt ?? 0) > 0 ? <span className="font-bold text-cred">{fmtVNDFull(c.currentDebt)}</span> : <span className="text-subtle">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm tabular-nums whitespace-nowrap">
                          {(c.creditLimit ?? 0) > 0 ? <span className="text-cyellow">{fmtVNDFull(c.creditLimit)}</span> : <span className="text-subtle text-xs">Không nợ</span>}
                        </td>
                        <td className="px-4 py-3.5"><VipBadge tier={vipTier} /></td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {(c.rewardPoints ?? 0) > 0
                            ? <span className="text-cyellow font-bold text-sm inline-flex items-center gap-1"><Star size={12} fill="currentColor" /> {c.rewardPoints.toLocaleString('vi-VN')}</span>
                            : <span className="text-subtle text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-muted whitespace-nowrap">{fmtDate(c.createdAt)}</td>
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setViewTarget(c)} title="Xem chi tiết"
                              className="w-7 h-7 rounded-md border border-border text-muted hover:border-cpurple hover:text-cpurple hover:bg-violet-50 transition-colors flex items-center justify-center">
                              <Eye size={13} />
                            </button>
                            <Can permission={PERMISSIONS.CRM_UPDATE}>
                              <button onClick={() => setEditTarget(c)} title="Sửa"
                                className="w-7 h-7 rounded-md border border-border text-muted hover:border-cblue hover:text-cblue hover:bg-blue-50 transition-colors flex items-center justify-center">
                                <Pencil size={13} />
                              </button>
                            </Can>
                            <Can permission={PERMISSIONS.CRM_DELETE}>
                              <button onClick={() => setDeleteTarget(c)} title="Xoá"
                                className="w-7 h-7 rounded-md border border-border text-muted hover:border-cred hover:text-cred hover:bg-rose-50 transition-colors flex items-center justify-center">
                                <Trash2 size={13} />
                              </button>
                            </Can>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-3.5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-muted order-2 sm:order-1">
                Hiển thị <span className="font-semibold text-text">{pageStart}-{pageEnd}</span> / {displayedCustomers.length} khách hàng
              </div>
              <div className="flex items-center gap-1 order-1 sm:order-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  className="w-8 h-8 rounded-lg border border-border text-muted hover:bg-surface2 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center">‹</button>
                {pageList(page, totalPages).map((n, i) => n === '…'
                  ? <span key={'e' + i} className="w-8 h-8 flex items-center justify-center text-muted text-xs">…</span>
                  : <button key={n} onClick={() => setPage(n)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center ${
                        n === page ? 'bg-cblue text-white shadow-sm' : 'border border-border text-muted hover:bg-surface2 hover:text-text'
                      }`}>{n}</button>
                )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="w-8 h-8 rounded-lg border border-border text-muted hover:bg-surface2 hover:text-text disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center">›</button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted order-3">
                Hiển thị
                <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                  className="bg-surface border border-border rounded-lg pl-2 pr-1 py-1 text-text font-semibold outline-none focus:border-cblue cursor-pointer">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                khách / trang
              </div>
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
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-cardHover p-6 flex flex-col gap-4">
            <div className="text-lg font-bold text-cred">Xoá khách hàng?</div>
            <div className="text-sm text-muted">
              <span className="font-semibold text-text">{deleteTarget.fullName}</span><br/>
              Lịch sử đơn hàng của khách sẽ không bị xoá.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost">Huỷ</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger disabled:opacity-60">
                {deleting ? 'Đang xoá…' : 'Xoá'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
    </div>
  )
}
