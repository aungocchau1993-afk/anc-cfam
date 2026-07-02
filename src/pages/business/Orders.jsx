import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { useReactToPrint } from 'react-to-print'
import {
  Receipt, RefreshCw, Calendar, ArrowUp, ArrowDown, Printer, FileText,
  History, X, Eye, RotateCcw, Ban, MoreVertical, ClipboardList, Package,
  CheckCircle2, Clock, XCircle, Undo2, Globe, CalendarDays, TrendingUp,
  AlertTriangle, Loader2, Trophy, Medal, Award, Download,
} from 'lucide-react'
import { loadOrdersFiltered, cancelOrderRollback, loadOrderDetail, cancelOrderFull, partialReturnItem } from '../../lib/supabase'
import { fmtVNDFull } from '../../lib/formatters'
import { buildReceiptHtml, printViaIframe, getShopConfig } from '../../lib/printReceipt'
import ModalOverlay from '../../components/ui/ModalOverlay'
import PrintableReceipt from '../../components/business/PrintableReceipt'
import AuditLogModal from '../../components/business/AuditLogModal'
import PageHeader from '../../components/ui/PageHeader'
import { SkeletonTableBody } from '../../components/ui/Skeleton'
import Can from '../../components/permission/Can'
import { usePermission } from '../../hooks/usePermission'
import { PERMISSIONS } from '../../lib/permissions/permissionConstants'

// ── Date helpers ───────────────────────────────────────────────────────────

function startOf(unit, ref = new Date()) {
  const d = new Date(ref)
  if (unit === 'day')     { d.setHours(0,0,0,0); return d }
  if (unit === 'week')    { d.setHours(0,0,0,0); d.setDate(d.getDate() - ((d.getDay()+6)%7)); return d }
  if (unit === 'month')   { return new Date(d.getFullYear(), d.getMonth(), 1) }
  if (unit === 'quarter') { return new Date(d.getFullYear(), Math.floor(d.getMonth()/3)*3, 1) }
  if (unit === 'year')    { return new Date(d.getFullYear(), 0, 1) }
  return new Date('2000-01-01')
}

function endOf(unit, ref = new Date()) {
  const d = new Date(ref)
  if (unit === 'day')     { d.setHours(23,59,59,999); return d }
  if (unit === 'week')    { const s = startOf('week', ref); return new Date(s.getTime() + 6*86400000 + 86399999) }
  if (unit === 'month')   { return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999) }
  if (unit === 'quarter') { const q=Math.floor(d.getMonth()/3); return new Date(d.getFullYear(), q*3+3, 0, 23,59,59,999) }
  if (unit === 'year')    { return new Date(d.getFullYear(), 11, 31, 23,59,59,999) }
  return new Date('2100-01-01')
}

const toInput = d => d.toISOString().slice(0,10)

function fmtDatetime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour:'2-digit', minute:'2-digit' })
}

const PRESETS = [
  { id:'today',   label:'Hôm nay' },
  { id:'week',    label:'Tuần này' },
  { id:'month',   label:'Tháng này' },
  { id:'quarter', label:'Quý này' },
  { id:'year',    label:'Năm này' },
  { id:'all',     label:'Toàn thời gian', icon: Globe },
  { id:'custom',  label:'Tùy chọn', icon: CalendarDays },
]

// ── Confirm Cancel Modal ───────────────────────────────────────────────────

function ConfirmCancelModal({ order, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  const partner = order.type === 'import'
    ? order.suppliers?.name
    : order.customers?.full_name

  async function handle() {
    setLoading(true)
    try { await onConfirm() }
    catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="card w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4 rounded-2xl">
        <div className="flex items-center gap-2 text-lg font-bold text-cred">
          <AlertTriangle size={20} /> Hủy đơn hàng?
        </div>
        <div className="text-sm text-muted leading-relaxed">
          Đơn <span className="font-mono text-text">#{(order.order_code || order.id.slice(-8)).toUpperCase()}</span>
          {partner && <> · <span className="text-text">{partner}</span></>}
          <br/>
          <span className="text-cyellow">
            Hệ thống sẽ tự động{' '}
            {order.type === 'import'
              ? 'trừ tồn kho và giảm công nợ nhà cung cấp.'
              : 'hoàn tồn kho và giảm chi tiêu khách hàng.'
            }
          </span>
          <br/>
          <span className="text-subtle text-xs mt-1 block">Hành động này không thể hoàn tác.</span>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ bỏ</button>
          <button onClick={handle} disabled={loading} className="btn-danger">
            {loading ? 'Đang xử lý…' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Status Badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    completed:          { l:'Hoàn thành',    cls:'tag-green',  Icon: CheckCircle2 },
    cancelled:          { l:'Đã hủy',        cls:'tag-red',    Icon: XCircle },
    pending:            { l:'Chờ xử lý',     cls:'tag-yellow', Icon: Clock },
    partially_returned: { l:'Trả một phần',  cls:'bg-violet-50 text-cpurple text-xs font-bold px-2.5 py-0.5 rounded-full', Icon: Undo2 },
  }
  const s = map[status] || { l: status, cls:'bg-surface2 text-muted text-xs font-bold px-2.5 py-0.5 rounded-full', Icon: null }
  const Icon = s.Icon
  return (
    <span className={`inline-flex items-center gap-1 ${s.cls}`}>
      {Icon && <Icon size={12} />}
      {s.l}
    </span>
  )
}

// ── Order Detail Modal ─────────────────────────────────────────────────────

function ReturnQtyInput({ item, onConfirm, onCancel, loading }) {
  const maxReturn = (item.quantity || 0) - (item.returned_quantity || 0)
  const [qty, setQty] = useState(1)
  const refund = qty * (item.price || 0)

  return (
    <div className="bg-violet-50 border border-cpurple/25 rounded-lg p-3 mt-2 flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[12px] text-cpurple font-semibold uppercase tracking-wide">
        <Undo2 size={12} /> Trả hàng · Tối đa {maxReturn}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number" min="1" max={maxReturn}
          value={qty} onChange={e => setQty(Math.min(maxReturn, Math.max(1, parseInt(e.target.value)||1)))}
          className="w-20 rounded-lg bg-white border border-border px-2.5 py-1.5 text-sm text-center font-mono text-text outline-none focus:border-cpurple transition-all"
          autoFocus
        />
        <span className="text-xs text-muted">sp · Hoàn tiền:</span>
        <span className="text-xs font-bold font-mono text-cgreen tabular-nums">{fmtVNDFull(refund)}</span>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-text transition-colors">
          Huỷ
        </button>
        <button type="button" onClick={() => onConfirm(qty)} disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-violet-100 border border-cpurple/40 text-cpurple text-xs font-bold hover:bg-violet-200 transition-colors disabled:opacity-60">
          {loading ? 'Đang xử lý…' : 'Xác nhận trả'}
        </button>
      </div>
    </div>
  )
}

// ── Reprint helper ────────────────────────────────────────────────────────

function reprintOrder(ord) {
  const isImport = ord.type === 'import'
  const items    = (ord.order_items || []).map(i => ({
    name:     i.products?.name || '—',
    quantity: i.quantity,
    price:    i.price,
    cost:     i.cost ?? i.price,
    unit:     i.unit ?? i.products?.unit ?? null,
  }))

  // Đối tác: khách hàng hoặc NCC
  const partnerRaw = isImport ? ord.suppliers : ord.customers
  const customer   = partnerRaw
    ? { fullName: partnerRaw.full_name || partnerRaw.name, phone: partnerRaw.phone }
    : null

  const paid = ord.paid_amount != null ? Number(ord.paid_amount) : ord.total_amount
  const debt = ord.debt_amount != null ? Number(ord.debt_amount) : Math.max(0, ord.total_amount - paid)

  const html = buildReceiptHtml({
    order:        ord,
    customer,
    items,
    total:        ord.total_amount,
    note:         ord.note || '',
    paidAmount:   paid,
    debtAmount:   debt,
    isImport,
    partnerLabel: isImport ? 'Nhà cung cấp:' : 'Khách hàng:',
  })
  printViaIframe(html)
}

// ── Order Progress Timeline (Tạo đơn → Thanh toán → Hoàn thành) ─────────────

function OrderProgressTimeline({ order }) {
  const isCancelled = order.status === 'cancelled'
  const isCompleted  = ['completed', 'partially_returned'].includes(order.status)
  const isPending    = order.status === 'pending'

  const steps = [
    { id:'created', label:'Tạo đơn',     done: true },
    { id:'paid',    label:'Thanh toán',  done: isCompleted || isCancelled },
    { id:'done',    label: isCancelled ? 'Đã hủy' : 'Hoàn thành', done: isCompleted || isCancelled, isCancel: isCancelled },
  ]

  return (
    <div className="flex items-center w-full">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              s.isCancel ? 'bg-cred text-white' : s.done ? 'bg-cgreen text-white' : isPending && i === 1 ? 'bg-cyellow text-white' : 'bg-surface2 text-subtle'
            }`}>
              {s.isCancel ? <XCircle size={14} /> : s.done ? <CheckCircle2 size={14} /> : <Clock size={14} />}
            </div>
            <span className={`text-[12px] font-semibold whitespace-nowrap ${s.done ? 'text-text' : 'text-subtle'}`}>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1.5 rounded-full ${s.done ? 'bg-cgreen' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

function OrderDetailModal({ initialOrder, onClose, onOrderChanged }) {
  const { can } = usePermission()
  const [order,        setOrder]        = useState(initialOrder)
  const [cancelConfirm,setCancelConfirm]= useState(false)
  const [returnItemId, setReturnItemId] = useState(null)   // item.id đang mở return input
  const [processing,   setProcessing]  = useState(false)
  const [fetching,     setFetching]    = useState(false)
  const [showAudit,    setShowAudit]   = useState(false)

  const isImport   = order.type === 'import'
  const partner    = isImport ? order.suppliers?.name : order.customers?.full_name
  const canCancel  = ['completed','partially_returned'].includes(order.status)
  const isCancelled = order.status === 'cancelled'
  const items      = order.order_items || []
  const code       = (order.order_code || order.id.slice(-8)).toUpperCase()

  // ── react-to-print (A5 PrintableReceipt) ───────────────────────────────
  const printRef   = useRef(null)
  const handlePrintA5 = useReactToPrint({
    contentRef: printRef,
    documentTitle: `HoaDon_${code}`,
    pageStyle: `@page { size: A5; margin: 10mm; }`,
  })

  // Re-fetch chi tiết đơn sau mỗi thao tác
  async function refresh() {
    setFetching(true)
    try {
      const updated = await loadOrderDetail(order.id)
      if (updated) { setOrder(updated); onOrderChanged?.(updated) }
    } finally { setFetching(false) }
  }

  // ── Hủy toàn bộ đơn ────────────────────────────────
  async function handleCancelFull() {
    setProcessing(true)
    try {
      await cancelOrderFull(order)
      toast.success(`Đã hủy đơn #${code} và hoàn tồn kho`)
      setCancelConfirm(false)
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Lỗi hủy đơn')
    } finally {
      setProcessing(false)
    }
  }

  // ── Trả một phần sản phẩm ───────────────────────────
  async function handlePartialReturn(item, returnQty) {
    setProcessing(true)
    try {
      await partialReturnItem({ orderId: order.id, item, returnQty, order })
      const refund = returnQty * (item.price || 0)
      toast.success(`Đã trả ${returnQty} "${item.products?.name}" · Hoàn ${refund.toLocaleString('vi-VN')} ₫`)
      setReturnItemId(null)
      await refresh()
    } catch (e) {
      toast.error(e.message || 'Lỗi trả hàng')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="card w-full max-w-md md:max-w-2xl mx-4 shadow-2xl flex flex-col max-h-[90vh] rounded-2xl p-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="font-bold text-base text-text flex items-center gap-2">
              Chi tiết đơn #{code}
              {fetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-subtle" />}
            </div>
            <div className="text-xs text-subtle mt-0.5">{fmtDatetime(order.created_at)}</div>
          </div>
          <div className="flex items-center gap-2">
            {/* In nhiệt (iframe) */}
            <button
              onClick={() => reprintOrder(order)}
              title="In hóa đơn nhiệt 80mm"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-cblue/30 text-cblue text-xs font-bold hover:bg-blue-100 transition-colors"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">In</span> 80mm
            </button>
            {/* In A5 (react-to-print + PrintableReceipt) */}
            {!isImport && (
              <button
                onClick={handlePrintA5}
                title="In hóa đơn A5 (PDF)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-50 border border-cpurple/30 text-cpurple text-xs font-bold hover:bg-violet-100 transition-colors"
              >
                <FileText size={14} />
                <span className="hidden sm:inline">In</span> A5
              </button>
            )}
            <button onClick={() => setShowAudit(true)} title="Lịch sử chỉnh sửa"
              className="w-8 h-8 rounded-lg bg-surface2 border border-border text-subtle hover:text-cpurple hover:border-cpurple/50 transition-colors flex items-center justify-center">
              <History size={14} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-subtle hover:text-cred transition-colors flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        </div>
        {showAudit && (
          <AuditLogModal
            tableName="orders"
            recordId={order.id}
            title={`Đơn #${code}`}
            onClose={() => setShowAudit(false)}
          />
        )}

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 overflow-y-auto">

          {/* Progress timeline */}
          <div className="bg-surface2 rounded-xl px-4 py-3">
            <OrderProgressTimeline order={order} />
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-subtle uppercase tracking-wide">Loại</span>
              <span className={`flex items-center gap-1 font-semibold ${isImport ? 'text-cyellow' : 'text-cblue'}`}>
                {isImport ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                {isImport ? 'Nhập hàng' : 'Xuất hàng'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-subtle uppercase tracking-wide">Đối tác</span>
              <span className="text-text font-semibold truncate">{partner || '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-subtle uppercase tracking-wide">Tổng tiền còn lại</span>
              <span className="font-black text-text tabular-nums">{fmtVNDFull(order.total_amount)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[12px] text-subtle uppercase tracking-wide">Trạng thái</span>
              <StatusBadge status={order.status} />
            </div>
            {order.note && (
              <div className="col-span-2 flex flex-col gap-0.5">
                <span className="text-[12px] text-subtle uppercase tracking-wide">Ghi chú</span>
                <span className="text-muted text-sm italic">{order.note}</span>
              </div>
            )}
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 bg-surface2 text-[12px] text-muted font-bold uppercase tracking-wide">
                Chi tiết sản phẩm ({items.length} dòng)
              </div>
              <div className="divide-y divide-border overflow-y-auto max-h-[48vh]">
                {items.map((item, i) => {
                  const returned    = item.returned_quantity || 0
                  const remaining   = (item.quantity || 0) - returned
                  const fullyRet    = remaining <= 0
                  const canReturn   = !isCancelled && remaining > 0
                  const isActive    = returnItemId === item.id

                  return (
                    <div key={item.id || i} className={`px-4 py-3 ${fullyRet ? 'opacity-45' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        {/* Tên + SKU */}
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm truncate ${fullyRet ? 'line-through text-subtle' : 'text-text'}`}>
                            {item.products?.name || '—'}
                          </div>
                          <div className="text-[12px] text-subtle font-mono mt-0.5">{item.products?.sku}</div>
                        </div>

                        {/* Qty + giá */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <div className="font-mono text-sm text-muted">
                            x{item.quantity}
                            {returned > 0 && (
                              <span className="ml-1.5 text-[12px] text-cpurple">(Đã trả {returned})</span>
                            )}
                          </div>
                          <div className="font-mono text-cblue text-xs">{fmtVNDFull(item.price)}</div>

                          {/* ── 2 nút cùng dòng ── */}
                          {!isCancelled && !fullyRet && !isActive && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {canReturn && can(PERMISSIONS.ORDER_RETURN) && (
                                <button
                                  onClick={() => setReturnItemId(item.id)}
                                  className="flex items-center gap-1 text-[12px] text-cpurple border border-cpurple/30 rounded-md px-2 py-0.5 hover:bg-violet-50 transition-colors whitespace-nowrap"
                                >
                                  <Undo2 size={11} /> Trả hàng
                                </button>
                              )}
                              {canCancel && !cancelConfirm && can(PERMISSIONS.ORDER_CANCEL) && (
                                <button
                                  onClick={() => setCancelConfirm(true)}
                                  className="flex items-center gap-1 text-[12px] text-cred border border-cred/25 rounded-md px-2 py-0.5 hover:bg-rose-50 transition-colors whitespace-nowrap"
                                >
                                  <X size={11} /> Hủy đơn
                                </button>
                              )}
                            </div>
                          )}
                          {fullyRet && (
                            <span className="text-[12px] text-cred border border-cred/20 rounded-md px-2 py-0.5">Đã trả hết</span>
                          )}
                        </div>
                      </div>

                      {/* Confirm hủy inline */}
                      {cancelConfirm && (
                        <div className="mt-2 rounded-lg bg-rose-50 border border-cred/20 px-3 py-2.5 flex flex-col gap-2">
                          <div className="flex items-start gap-1.5 text-xs text-cyellow">
                            <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                            <span>
                              Xác nhận hủy toàn bộ đơn? Hệ thống sẽ hoàn kho và{' '}
                              {isImport ? 'giảm công nợ NCC.' : 'giảm chi tiêu khách hàng.'}
                            </span>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setCancelConfirm(false)} className="text-xs text-muted hover:text-text px-2 py-1 rounded transition-colors">
                              Thôi
                            </button>
                            <button onClick={handleCancelFull} disabled={processing}
                              className="px-3 py-1.5 rounded-lg bg-rose-100 border border-cred/40 text-cred text-xs font-bold hover:bg-rose-200 transition-colors disabled:opacity-60">
                              {processing ? 'Đang xử lý…' : 'Xác nhận hủy'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Inline return input */}
                      {isActive && (
                        <ReturnQtyInput
                          item={item}
                          loading={processing}
                          onConfirm={qty => handlePartialReturn(item, qty)}
                          onCancel={() => setReturnItemId(null)}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* PrintableReceipt — ẩn, chỉ dùng khi react-to-print kích hoạt */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
        <PrintableReceipt
          printRef={printRef}
          shopConfig={getShopConfig()}
          orderData={{
            ...order,
            customer: order.customers
              ? { fullName: order.customers.full_name, phone: order.customers.phone, address: order.customers.address, currentDebt: order.customers.current_debt }
              : null,
            items: order.order_items || [],
          }}
        />
      </div>

    </ModalOverlay>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Orders() {
  const { can } = usePermission()
  const canViewCost = can(PERMISSIONS.INVENTORY_VIEW_COST)
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(false)

  const [preset,     setPreset]     = useState('month')
  const [customFrom, setCustomFrom] = useState(toInput(startOf('month')))
  const [customTo,   setCustomTo]   = useState(toInput(new Date()))
  const [typeFilter, setTypeFilter] = useState('all')  // 'all' | 'export' | 'import'

  const [viewMode,     setViewMode]     = useState('orders') // 'orders' | 'products'

  const [cancelTarget, setCancelTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)
  const [rowMenu,      setRowMenu]      = useState(null) // { ord, top, left }

  // ── Chọn nhiều dòng (UI-only) — chỉ phục vụ Xuất Excel hàng loạt, KHÔNG có
  // bulk delete/cancel vì hủy đơn có tác động tồn kho/công nợ, nằm ngoài phạm vi này.
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  // ── Tính from/to từ preset ──────────────────────────
  const { from, to } = useMemo(() => {
    if (preset === 'all')    return { from: startOf('all'), to: endOf('all') }
    if (preset === 'custom') {
      if (!customFrom || !customTo) return { from: null, to: null }
      const f = new Date(customFrom); f.setHours(0,0,0,0)
      const t = new Date(customTo);   t.setHours(23,59,59,999)
      return { from: f, to: t }
    }
    const unit = preset === 'today' ? 'day' : preset
    return { from: startOf(unit), to: endOf(unit) }
  }, [preset, customFrom, customTo])

  // ── Fetch ────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    if (!from || !to) return
    setLoading(true)
    try {
      const data = await loadOrdersFiltered({ from, to, type: typeFilter })
      setOrders(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [from, to, typeFilter])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ── Cancel & rollback ────────────────────────────────
  async function handleCancel() {
    await cancelOrderRollback(cancelTarget)
    toast.success(`Đã hủy đơn #${(cancelTarget.order_code || cancelTarget.id.slice(-8)).toUpperCase()} và hoàn tồn kho`)
    setCancelTarget(null)
    fetchOrders()
  }

  // ── Chọn nhiều (UI-only) ──────────────────────────────
  function toggleSelectOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectAllOnPage() {
    setSelectedIds(prev => {
      const pageIds = orders.map(o => o.id)
      const allSelected = pageIds.length > 0 && pageIds.every(id => prev.has(id))
      const next = new Set(prev)
      pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  const selectedOrders = useMemo(
    () => orders.filter(o => selectedIds.has(o.id)),
    [orders, selectedIds]
  )

  // Xuất Excel các đơn đã chọn — chỉ đọc dữ liệu, không đụng CRUD/API.
  function handleBulkExportExcel() {
    const rows = selectedOrders.map(o => {
      const isImport = o.type === 'import'
      const partner  = isImport ? o.suppliers?.name : o.customers?.full_name
      const code     = (o.order_code || o.id.slice(-8)).toUpperCase()
      return {
        'Mã Đơn':      code,
        'Thời gian':   fmtDatetime(o.created_at),
        'Loại':        isImport ? 'Nhập hàng' : 'Xuất hàng',
        'Đối tác':     partner || 'Khách lẻ',
        'Tổng tiền':   o.total_amount ?? 0,
        'Lợi nhuận':   isImport ? '' : (o.profit ?? 0),
        'Trạng thái':  ({ completed: 'Hoàn thành', cancelled: 'Đã hủy', pending: 'Chờ xử lý', partially_returned: 'Trả một phần' })[o.status] || o.status,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 }, { wch: 14 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn Hàng đã chọn')
    XLSX.writeFile(wb, 'Don_Hang_Da_Chon.xlsx')
    toast.success(`Đã xuất ${rows.length} đơn hàng`)
  }

  // ── KPIs ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const done    = orders.filter(o => o.status === 'completed')
    const exports = done.filter(o => o.type !== 'import')
    const imports = done.filter(o => o.type === 'import')
    return {
      total:    done.length,
      revenue:  exports.reduce((s,o) => s + (o.total_amount||0), 0),
      imported: imports.reduce((s,o) => s + (o.total_amount||0), 0),
      profit:   exports.reduce((s,o) => s + (o.profit||0), 0),
    }
  }, [orders])

  // ── Tổng hợp theo sản phẩm ───────────────────────────
  const productStats = useMemo(() => {
    const map = {}
    for (const ord of orders) {
      if (ord.status === 'cancelled') continue
      for (const item of ord.order_items || []) {
        const id = item.product_id
        if (!id) continue
        if (!map[id]) map[id] = {
          productId:    id,
          name:         item.products?.name ?? '—',
          sku:          item.products?.sku  ?? '—',
          totalQty:     0,
          totalRevenue: 0,
          totalProfit:  0,
          orderCount:   new Set(),
        }
        map[id].totalQty     += Number(item.quantity) || 0
        map[id].totalRevenue += (Number(item.price) || 0) * (Number(item.quantity) || 0)
        map[id].totalProfit  += ((Number(item.price) || 0) - (Number(item.cost) || 0)) * (Number(item.quantity) || 0)
        map[id].orderCount.add(ord.id)
      }
    }
    return Object.values(map)
      .map(r => ({ ...r, orderCount: r.orderCount.size }))
      .sort((a, b) => b.totalQty - a.totalQty)
  }, [orders])

  // ── Render ────────────────────────────────────────────
  return (
    <div className="w-full">
      <PageHeader icon={Receipt} title="Đơn Hàng" subtitle="Quản lý đơn xuất/nhập, theo dõi trạng thái" />
    <div className="p-6 w-full flex flex-col gap-5">

      {/* ── Bộ lọc ─────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Preset buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`flex items-center gap-1.5 h-11 px-4 rounded-xl border text-sm font-semibold transition-all ${
                preset === p.id
                  ? 'bg-blue-50 border-cblue text-cblue'
                  : 'bg-surface border-border text-muted hover:border-cblue/40 hover:text-text'
              }`}>
              {p.icon && <p.icon size={14} />}
              {p.label}
            </button>
          ))}

          <button onClick={fetchOrders} disabled={loading}
            className="ml-auto flex items-center gap-1.5 h-11 px-4 rounded-xl border border-border text-muted text-sm hover:border-cblue hover:text-cblue transition-colors disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>

        {/* Custom date + Type filter */}
        <div className="flex flex-wrap items-center gap-3">
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="input-base w-auto" />
              <span className="text-muted text-sm">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="input-base w-auto" />
            </div>
          )}

          {/* Loại phiếu */}
          <div className="flex h-11 rounded-xl overflow-hidden border border-border shrink-0">
            {[
              { id:'all',    label:'Tất cả', icon: null },
              { id:'export', label:'Xuất hàng', icon: ArrowUp },
              { id:'import', label:'Nhập hàng', icon: ArrowDown },
            ].map(t => (
              <button key={t.id}
                onClick={() => { setTypeFilter(t.id); if (t.id === 'all') setViewMode('orders') }}
                className={`flex items-center gap-1.5 px-3.5 text-sm font-semibold transition-colors border-l border-border first:border-l-0 ${
                  typeFilter === t.id
                    ? 'bg-blue-50 text-cblue'
                    : 'bg-surface text-muted hover:bg-surface2 hover:text-text'
                }`}>
                {t.icon && <t.icon size={14} />}
                {t.label}
              </button>
            ))}
          </div>

          {/* View toggle — chỉ hiện khi lọc theo loại cụ thể */}
          {typeFilter !== 'all' && (
            <div className="flex h-11 rounded-xl overflow-hidden border border-border shrink-0 ml-auto">
              {[
                { id:'orders',   icon: ClipboardList, label:'Danh sách đơn' },
                { id:'products', icon: Package,       label:'Theo sản phẩm' },
              ].map(v => (
                <button key={v.id} onClick={() => setViewMode(v.id)}
                  className={`flex items-center gap-1.5 px-3.5 text-xs font-semibold transition-colors border-l border-border first:border-l-0 ${
                    viewMode === v.id
                      ? typeFilter === 'export' ? 'bg-blue-50 text-cblue' : 'bg-amber-50 text-cyellow'
                      : 'bg-surface text-muted hover:bg-surface2 hover:text-text'
                  }`}>
                  <v.icon size={14} />
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Tổng đơn HT',    value: String(stats.total),          color:'text-cblue',   icon: ClipboardList },
          { label:'Doanh thu xuất', value: fmtVNDFull(stats.revenue),    color:'text-cgreen',  icon: ArrowUp },
          { label:'Tổng nhập kho',  value: fmtVNDFull(stats.imported),   color:'text-cyellow', icon: ArrowDown },
          { label:'Lợi nhuận',      value: fmtVNDFull(stats.profit),     color: stats.profit >= 0 ? 'text-cgreen' : 'text-cred', icon: TrendingUp },
        ].map(k => (
          <div key={k.label} className="card p-4 relative overflow-hidden">
            <k.icon className="absolute top-3 right-3 opacity-15" size={28} />
            <div className="text-[12px] text-muted font-semibold uppercase tracking-wide mb-1.5">{k.label}</div>
            <div className={`text-xl font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────── */}

      {/* View: Danh sách đơn */}
      {viewMode === 'orders' && (
        <>
          {/* ══════════════════ BULK ACTION BAR — nổi phía trên Table khi có chọn ══════════════════ */}
          {/* Chỉ Xuất Excel + Bỏ chọn — KHÔNG có hủy/xóa hàng loạt vì hủy đơn tác động tồn kho/công nợ. */}
          {selectedIds.size > 0 && (
            <div className="mb-4 bg-[#0f172a] rounded-2xl shadow-lg px-4 py-3 flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-semibold text-white mr-1">Đã chọn {selectedIds.size} đơn hàng</span>
              <div className="w-px h-6 bg-white/15 hidden sm:block" />
              <Can permission={PERMISSIONS.ORDER_EXPORT}>
              <button onClick={handleBulkExportExcel}
                className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[14px] font-medium transition-colors">
                <Download size={14} strokeWidth={2} /> Xuất Excel
              </button>
              </Can>
              <button onClick={clearSelection}
                className="h-9 flex items-center gap-1.5 px-3 rounded-lg text-white/60 hover:text-white text-[14px] font-medium transition-colors ml-auto">
                <X size={14} strokeWidth={2.2} /> Bỏ chọn
              </button>
            </div>
          )}

        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-card">
          <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
            <div className="text-sm font-bold text-text">Danh sách đơn hàng</div>
            <span className="tag-blue">{orders.length} đơn</span>
          </div>

          {loading ? (
            <div className="hidden sm:block w-full overflow-x-auto">
              <table className="w-full min-w-0 text-xs md:text-sm">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-border">
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 w-10"></th>
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Mã đơn</th>
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Thời gian</th>
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Loại</th>
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Đối tác</th>
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Tổng tiền</th>
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Lợi nhuận</th>
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-center text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <SkeletonTableBody rows={8} columns={7} hasImage={false} />
                </tbody>
              </table>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <ClipboardList className="mx-auto mb-2 text-subtle" size={36} />
              <div className="font-semibold">Không có đơn hàng trong khoảng thời gian này</div>
            </div>
          ) : (
            <>
              {/* ── Mobile: Card list (< sm) ── */}
              <div className="sm:hidden flex flex-col gap-2 p-3">
                {orders.map(ord => {
                  const isImport    = ord.type === 'import'
                  const isCancelled = ord.status === 'cancelled'
                  const partner     = isImport ? ord.suppliers?.name : ord.customers?.full_name
                  const code        = (ord.order_code || ord.id.slice(-8)).toUpperCase()
                  return (
                    <div key={ord.id}
                      onClick={() => !isCancelled && setDetailTarget(ord)}
                      className={`bg-surface border border-border rounded-xl p-3.5 ${isCancelled ? 'opacity-40' : 'active:bg-surface2 cursor-pointer'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold mb-1 ${isImport ? 'bg-amber-50 text-cyellow' : 'bg-blue-50 text-cblue'}`}>
                            {isImport ? <ArrowDown size={10} /> : <ArrowUp size={10} />}
                            {isImport ? 'Nhập' : 'Xuất'}
                          </span>
                          <div className="font-mono text-[12px] text-subtle">#{code}</div>
                          <div className="text-[12px] text-subtle mt-0.5">{fmtDatetime(ord.created_at)}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono font-bold text-sm text-text">{fmtVNDFull(ord.total_amount)}</div>
                          {!isImport && canViewCost && <div className={`text-xs font-mono font-semibold ${(ord.profit||0) >= 0 ? 'text-cgreen' : 'text-cred'}`}>{fmtVNDFull(ord.profit)}</div>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        {partner
                          ? <span className={`text-sm font-semibold truncate ${isImport ? 'text-cyellow' : 'text-cpurple'}`}>{partner}</span>
                          : <span className="text-subtle italic text-sm">Khách lẻ</span>}
                        <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                          <StatusBadge status={ord.status} />
                          <button onClick={() => setDetailTarget(ord)}
                            className="h-8 px-3 rounded-lg border border-border text-muted text-xs hover:border-cblue hover:text-cblue active:scale-95 transition-all">
                            Chi tiết
                          </button>
                          {ord.status === 'completed' && (
                            <button onClick={() => setCancelTarget(ord)}
                              className="h-8 w-8 rounded-lg border border-border text-subtle hover:border-cred hover:text-cred active:scale-95 transition-all flex items-center justify-center">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Desktop: Table (≥ sm) ── */}
              <div className="hidden sm:block w-full overflow-x-auto whitespace-nowrap">
                <table className="w-full min-w-0 text-xs md:text-sm">
                  <thead>
                    <tr className="bg-[#f8fafc] border-b border-border">
                      <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 w-10">
                        <input type="checkbox"
                          checked={orders.length > 0 && orders.every(o => selectedIds.has(o.id))}
                          onChange={toggleSelectAllOnPage}
                          className="w-4 h-4 rounded accent-cblue" />
                      </th>
                      <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Mã đơn</th>
                      <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Thời gian</th>
                      <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Loại</th>
                      <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Đối tác</th>
                      <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Tổng tiền</th>
                      {canViewCost && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Lợi nhuận</th>}
                      <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
                      <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-center text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map(ord => {
                      const isImport    = ord.type === 'import'
                      const isCancelled = ord.status === 'cancelled'
                      const partner     = isImport ? ord.suppliers?.name : ord.customers?.full_name
                      const code        = (ord.order_code || ord.id.slice(-8)).toUpperCase()
                      const checked     = selectedIds.has(ord.id)
                      return (
                        <tr key={ord.id}
                          className={`transition-colors group ${isCancelled ? 'opacity-45' : 'hover:bg-surface2 cursor-pointer'} ${checked ? 'bg-blue-50/60' : ''}`}
                          onClick={() => !isCancelled && setDetailTarget(ord)}>
                          <td className="px-4 py-3 sm:py-3.5" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={checked} onChange={() => toggleSelectOne(ord.id)} className="w-4 h-4 rounded accent-cblue" />
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5">
                            <div className="font-mono text-xs bg-surface2 border border-border px-2 py-0.5 rounded text-muted inline-block">#{code}</div>
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted whitespace-nowrap">{fmtDatetime(ord.created_at)}</td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold ${isImport ? 'bg-amber-50 text-cyellow' : 'bg-blue-50 text-cblue'}`}>
                              {isImport ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                              {isImport ? 'Nhập' : 'Xuất'}
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-sm">
                            {partner
                              ? <span className={`${isImport ? 'text-cyellow font-semibold' : 'text-cpurple font-semibold'}`}>{partner}</span>
                              : <span className="text-muted italic">Khách lẻ</span>}
                          </td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right font-mono text-xs sm:text-sm font-semibold text-text tabular-nums whitespace-nowrap">
                            {fmtVNDFull(ord.total_amount)}
                          </td>
                          {canViewCost && (
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              {isImport ? <span className="text-muted text-xs">—</span>
                                : <span className={`font-mono text-sm font-bold tabular-nums ${(ord.profit||0) >= 0 ? 'text-cgreen' : 'text-cred'}`}>{fmtVNDFull(ord.profit)}</span>}
                            </td>
                          )}
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5"><StatusBadge status={ord.status} /></td>
                          <td className="px-3 sm:px-4 py-3 sm:py-3.5" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <button onClick={() => setDetailTarget(ord)} title="Xem chi tiết"
                                className="w-7 h-7 rounded-md border border-border text-muted hover:border-cblue hover:text-cblue hover:bg-blue-50 active:scale-90 transition-all flex items-center justify-center">
                                <Eye size={14} />
                              </button>
                              {ord.status !== 'cancelled' && (
                                <button onClick={() => reprintOrder(ord)} title="In lại hóa đơn"
                                  className="w-7 h-7 rounded-md border border-border text-muted hover:border-cblue hover:text-cblue hover:bg-blue-50 transition-colors flex items-center justify-center">
                                  <Printer size={14} />
                                </button>
                              )}
                              {ord.status === 'completed' && (
                                <button
                                  onClick={e => {
                                    const r = e.currentTarget.getBoundingClientRect()
                                    setRowMenu({ ord, top: r.bottom + 4, left: Math.max(8, r.right - 184) })
                                  }}
                                  title="Thao tác khác"
                                  className="w-7 h-7 rounded-md border border-border text-muted hover:border-cblue hover:text-cblue hover:bg-surface2 transition-colors flex items-center justify-center">
                                  <MoreVertical size={14} />
                                </button>
                              )}
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
        </>
      )}

      {/* View: Theo sản phẩm */}
      {viewMode === 'products' && (
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-card">
          <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text flex items-center gap-1.5">
                {typeFilter === 'import' ? <><ArrowDown size={14} className="text-cyellow" /> Sản phẩm nhập nhiều nhất</> : <><TrendingUp size={14} className="text-cblue" /> Sản phẩm bán chạy nhất</>}
              </span>
              <span className="text-[12px] text-muted">(sắp xếp theo số lượng)</span>
            </div>
            <span className={typeFilter === 'import'
              ? 'bg-amber-50 text-cyellow text-xs font-bold px-2.5 py-0.5 rounded-full'
              : 'tag-blue'}>
              {productStats.length} sản phẩm
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted text-sm">Đang tải…</div>
          ) : productStats.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Package className="mx-auto mb-2 text-subtle" size={36} />
              <div className="font-semibold">Không có dữ liệu trong khoảng thời gian này</div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto whitespace-nowrap">
              <table className="w-full min-w-[640px] text-xs md:text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    <th className="px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider w-10">#</th>
                    <th className="px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider">Sản phẩm</th>
                    <th className="px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Số đơn</th>
                    <th className="px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Số lượng</th>
                    <th className="px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">
                      {typeFilter === 'import' ? 'Tổng tiền nhập' : 'Doanh thu'}
                    </th>
                    {typeFilter === 'export' && canViewCost && (
                      <th className="px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Lợi nhuận</th>
                    )}
                    {typeFilter === 'export' && canViewCost && (
                      <th className="px-4 py-3 text-right text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Margin</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productStats.map((p, idx) => {
                    const margin = p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue * 100).toFixed(1) : 0
                    const maxQty = productStats[0]?.totalQty || 1
                    const barPct = Math.round(p.totalQty / maxQty * 100)

                    return (
                      <tr key={p.productId} className="hover:bg-surface2 transition-colors">

                        {/* Rank */}
                        <td className="px-4 py-3.5 text-center">
                          {idx === 0 && <Trophy size={16} className="text-cyellow inline-block" />}
                          {idx === 1 && <Medal size={16} className="text-subtle inline-block" />}
                          {idx === 2 && <Award size={16} className="text-amber-700 inline-block" />}
                          {idx > 2 && <span className="text-sm text-muted font-mono">{idx + 1}</span>}
                        </td>

                        {/* Tên + SKU + bar */}
                        <td className="px-4 py-3 min-w-[220px]">
                          <div className="font-semibold text-sm text-text truncate max-w-[260px]">{p.name}</div>
                          <div className="text-[12px] text-muted font-mono mt-0.5">{p.sku}</div>
                          {/* Mini progress bar */}
                          <div className="mt-1.5 h-1 bg-surface2 rounded-full overflow-hidden w-full max-w-[200px]">
                            <div className={`h-full rounded-full ${typeFilter === 'import' ? 'bg-cyellow/70' : 'bg-cblue/70'}`}
                              style={{ width: `${barPct}%` }} />
                          </div>
                        </td>

                        {/* Số đơn */}
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-xs bg-surface2 border border-border px-2 py-0.5 rounded font-mono text-muted">
                            {p.orderCount} đơn
                          </span>
                        </td>

                        {/* Số lượng */}
                        <td className="px-4 py-3.5 text-right">
                          <span className={`text-base font-black tabular-nums ${typeFilter === 'import' ? 'text-cyellow' : 'text-cblue'}`}>
                            {p.totalQty.toLocaleString('vi-VN')}
                          </span>
                          <span className="text-[12px] text-muted ml-1">sp</span>
                        </td>

                        {/* Doanh thu / tiền nhập */}
                        <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold text-text tabular-nums whitespace-nowrap">
                          {fmtVNDFull(p.totalRevenue)}
                        </td>

                        {/* Lợi nhuận (export only) */}
                        {typeFilter === 'export' && canViewCost && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className={`font-mono text-sm font-bold tabular-nums ${p.totalProfit >= 0 ? 'text-cgreen' : 'text-cred'}`}>
                              {fmtVNDFull(p.totalProfit)}
                            </span>
                          </td>
                        )}

                        {/* Margin (export only) */}
                        {typeFilter === 'export' && canViewCost && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              Number(margin) >= 20
                                ? 'tag-green'
                                : Number(margin) >= 10
                                ? 'tag-yellow'
                                : 'tag-red'
                            }`}>
                              {margin}%
                            </span>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>

                {/* Footer tổng */}
                <tfoot>
                  <tr className="border-t-2 border-border bg-surface2">
                    <td colSpan={3} className="px-4 py-3 text-xs font-bold text-muted">
                      Tổng cộng ({productStats.length} loại hàng)
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      <span className={`text-base font-black tabular-nums ${typeFilter === 'import' ? 'text-cyellow' : 'text-cblue'}`}>
                        {productStats.reduce((s,p) => s + p.totalQty, 0).toLocaleString('vi-VN')}
                      </span>
                      <span className="text-[12px] text-muted ml-1">sp</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-sm text-text tabular-nums whitespace-nowrap">
                      {fmtVNDFull(productStats.reduce((s,p) => s + p.totalRevenue, 0))}
                    </td>
                    {typeFilter === 'export' && canViewCost && (
                      <td className="px-4 py-3 text-right font-mono font-black text-sm text-cgreen tabular-nums whitespace-nowrap">
                        {fmtVNDFull(productStats.reduce((s,p) => s + p.totalProfit, 0))}
                      </td>
                    )}
                    {typeFilter === 'export' && canViewCost && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Row action menu (kebab) */}
      {rowMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
          <div className="fixed z-50 w-44 bg-surface border border-border rounded-xl shadow-xl py-1"
            style={{ top: rowMenu.top, left: rowMenu.left }}>
            <Can permission={PERMISSIONS.ORDER_CANCEL}>
              <button onClick={() => { setCancelTarget(rowMenu.ord); setRowMenu(null) }}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-cred hover:bg-rose-50 transition-colors flex items-center gap-2">
                <Ban size={13} /> Hủy đơn & hoàn kho
              </button>
            </Can>
          </div>
        </>
      )}

      {/* ── Modals ─────────────────────────────────────── */}
      {cancelTarget && (
        <ConfirmCancelModal
          order={cancelTarget}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
      {detailTarget && (
        <OrderDetailModal
          initialOrder={detailTarget}
          onClose={() => setDetailTarget(null)}
          onOrderChanged={updated => {
            // Cập nhật luôn bảng ngoài mà không cần refetch toàn bộ
            setOrders(prev => prev.map(o => o.id === updated.id ? updated : o))
          }}
        />
      )}
    </div>
    </div>
  )
}
