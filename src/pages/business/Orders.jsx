import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useReactToPrint } from 'react-to-print'
import { loadOrdersFiltered, cancelOrderRollback, loadOrderDetail, cancelOrderFull, partialReturnItem } from '../../lib/supabase'
import { fmtVNDFull } from '../../lib/formatters'
import { buildReceiptHtml, printViaIframe, getShopConfig } from '../../lib/printReceipt'
import ModalOverlay from '../../components/ui/ModalOverlay'
import PrintableReceipt from '../../components/business/PrintableReceipt'
import AuditLogModal from '../../components/business/AuditLogModal'

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
  { id:'all',     label:'🌐 Toàn thời gian' },
  { id:'custom',  label:'📅 Tùy chọn' },
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
      <div className="bg-[#0d1117] border border-slate-700/80 rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
        <div className="text-lg font-bold text-cred">⚠️ Hủy đơn hàng?</div>
        <div className="text-sm text-slate-400 leading-relaxed">
          Đơn <span className="font-mono text-[#e6edf3]">#{(order.order_code || order.id.slice(-8)).toUpperCase()}</span>
          {partner && <> · <span className="text-[#e6edf3]">{partner}</span></>}
          <br/>
          <span className="text-cyellow">
            Hệ thống sẽ tự động{' '}
            {order.type === 'import'
              ? 'trừ tồn kho và giảm công nợ nhà cung cấp.'
              : 'hoàn tồn kho và giảm chi tiêu khách hàng.'
            }
          </span>
          <br/>
          <span className="text-slate-500 text-xs mt-1 block">Hành động này không thể hoàn tác.</span>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Huỷ bỏ</button>
          <button onClick={handle} disabled={loading}
            className="px-4 py-2 rounded-lg bg-cred/20 border border-cred/40 text-cred text-sm font-bold hover:bg-cred/30 transition-colors disabled:opacity-60">
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
    completed:          { l:'Hoàn thành',    c:'bg-cgreen/15   text-cgreen   border-cgreen/30' },
    cancelled:          { l:'Đã hủy',        c:'bg-cred/15     text-cred     border-cred/30' },
    pending:            { l:'Chờ xử lý',     c:'bg-cyellow/15  text-cyellow  border-cyellow/30' },
    partially_returned: { l:'Trả một phần',  c:'bg-[#bc8cff]/15 text-[#bc8cff] border-[#bc8cff]/30' },
  }
  const s = map[status] || { l: status, c:'bg-surface2 text-muted border-border' }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${s.c}`}>
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
    <div className="bg-[#bc8cff]/8 border border-[#bc8cff]/25 rounded-lg p-3 mt-2 flex flex-col gap-2">
      <div className="text-[11px] text-[#bc8cff] font-semibold uppercase tracking-wide">
        ↩️ Trả hàng · Tối đa {maxReturn}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number" min="1" max={maxReturn}
          value={qty} onChange={e => setQty(Math.min(maxReturn, Math.max(1, parseInt(e.target.value)||1)))}
          className="w-20 rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-sm text-center font-mono text-[#e6edf3] outline-none focus:border-[#bc8cff] transition-all"
          autoFocus
        />
        <span className="text-xs text-slate-400">sp · Hoàn tiền:</span>
        <span className="text-xs font-bold font-mono text-cgreen tabular-nums">{fmtVNDFull(refund)}</span>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-[#e6edf3] transition-colors">
          Huỷ
        </button>
        <button type="button" onClick={() => onConfirm(qty)} disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-[#bc8cff]/20 border border-[#bc8cff]/40 text-[#bc8cff] text-xs font-bold hover:bg-[#bc8cff]/30 transition-colors disabled:opacity-60">
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

function OrderDetailModal({ initialOrder, onClose, onOrderChanged }) {
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
      toast.success(`↩️ Đã trả ${returnQty} "${item.products?.name}" · Hoàn ${refund.toLocaleString('vi-VN')} ₫`)
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
      <div className="bg-[#0d1117] border border-slate-700/80 rounded-2xl w-full max-w-sm md:max-w-lg mx-4 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <div className="font-bold text-base text-[#e6edf3] flex items-center gap-2">
              Chi tiết đơn #{code}
              {fetching && <svg className="w-3.5 h-3.5 animate-spin text-slate-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{fmtDatetime(order.created_at)}</div>
          </div>
          <div className="flex items-center gap-2">
            {/* In nhiệt (iframe) */}
            <button
              onClick={() => reprintOrder(order)}
              title="In hóa đơn nhiệt 80mm"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cblue/15 border border-cblue/30 text-cblue text-xs font-bold hover:bg-cblue/25 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              <span className="hidden sm:inline">In</span> 80mm
            </button>
            {/* In A5 (react-to-print + PrintableReceipt) */}
            {!isImport && (
              <button
                onClick={handlePrintA5}
                title="In hóa đơn A5 (PDF)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cpurple/15 border border-cpurple/30 text-cpurple text-xs font-bold hover:bg-cpurple/25 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="2" width="12" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
                  <path d="M8 2v16M12 2v16M16 2v4" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2"/>
                  <path d="M14 6h4M14 10h4M14 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="hidden sm:inline">In</span> A5
              </button>
            )}
            <button onClick={() => setShowAudit(true)} title="Lịch sử chỉnh sửa"
              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-cpurple hover:border-cpurple/50 transition-colors flex items-center justify-center">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-cred transition-colors text-lg">×</button>
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
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Loại</span>
              <span className={isImport ? 'text-cyellow font-semibold' : 'text-cblue font-semibold'}>
                {isImport ? '⬇️ Nhập hàng' : '⬆️ Xuất hàng'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Đối tác</span>
              <span className="text-[#e6edf3] font-semibold truncate">{partner || '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Tổng tiền còn lại</span>
              <span className="font-black text-[#e6edf3] tabular-nums">{fmtVNDFull(order.total_amount)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Trạng thái</span>
              <StatusBadge status={order.status} />
            </div>
            {order.note && (
              <div className="col-span-2 flex flex-col gap-0.5">
                <span className="text-[11px] text-slate-500 uppercase tracking-wide">Ghi chú</span>
                <span className="text-slate-300 text-sm italic">{order.note}</span>
              </div>
            )}
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-800/60 text-[11px] text-slate-400 font-bold uppercase tracking-wide">
                Chi tiết sản phẩm ({items.length} dòng)
              </div>
              <div className="divide-y divide-slate-800">
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
                          <div className={`text-sm truncate ${fullyRet ? 'line-through text-slate-500' : 'text-[#e6edf3]'}`}>
                            {item.products?.name || '—'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.products?.sku}</div>
                        </div>

                        {/* Qty + giá */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <div className="font-mono text-sm text-slate-200">
                            x{item.quantity}
                            {returned > 0 && (
                              <span className="ml-1.5 text-[11px] text-[#bc8cff]">(Đã trả {returned})</span>
                            )}
                          </div>
                          <div className="font-mono text-cblue text-xs">{fmtVNDFull(item.price)}</div>

                          {/* ── 2 nút cùng dòng ── */}
                          {!isCancelled && !fullyRet && !isActive && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {canReturn && (
                                <button
                                  onClick={() => setReturnItemId(item.id)}
                                  className="text-[11px] text-[#bc8cff] border border-[#bc8cff]/30 rounded-md px-2 py-0.5 hover:bg-[#bc8cff]/10 transition-colors whitespace-nowrap"
                                >
                                  ↩️ Trả hàng
                                </button>
                              )}
                              {canCancel && !cancelConfirm && (
                                <button
                                  onClick={() => setCancelConfirm(true)}
                                  className="text-[11px] text-cred border border-cred/25 rounded-md px-2 py-0.5 hover:bg-cred/10 transition-colors whitespace-nowrap"
                                >
                                  ✕ Hủy đơn
                                </button>
                              )}
                            </div>
                          )}
                          {fullyRet && (
                            <span className="text-[11px] text-cred border border-cred/20 rounded-md px-2 py-0.5">Đã trả hết</span>
                          )}
                        </div>
                      </div>

                      {/* Confirm hủy inline */}
                      {cancelConfirm && (
                        <div className="mt-2 rounded-lg bg-cred/8 border border-cred/20 px-3 py-2.5 flex flex-col gap-2">
                          <div className="text-xs text-cyellow">
                            ⚠️ Xác nhận hủy toàn bộ đơn? Hệ thống sẽ hoàn kho và{' '}
                            {isImport ? 'giảm công nợ NCC.' : 'giảm chi tiêu khách hàng.'}
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setCancelConfirm(false)} className="text-xs text-slate-400 hover:text-[#e6edf3] px-2 py-1 rounded transition-colors">
                              Thôi
                            </button>
                            <button onClick={handleCancelFull} disabled={processing}
                              className="px-3 py-1.5 rounded-lg bg-cred/20 border border-cred/40 text-cred text-xs font-bold hover:bg-cred/30 transition-colors disabled:opacity-60">
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
  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(false)

  const [preset,     setPreset]     = useState('month')
  const [customFrom, setCustomFrom] = useState(toInput(startOf('month')))
  const [customTo,   setCustomTo]   = useState(toInput(new Date()))
  const [typeFilter, setTypeFilter] = useState('all')  // 'all' | 'export' | 'import'

  const [viewMode,     setViewMode]     = useState('orders') // 'orders' | 'products'

  const [cancelTarget, setCancelTarget] = useState(null)
  const [detailTarget, setDetailTarget] = useState(null)

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
    <div className="p-6 w-full flex flex-col gap-5">

      {/* ── Bộ lọc ─────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Preset buttons */}
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

          <button onClick={fetchOrders} disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-muted text-sm hover:border-cblue hover:text-cblue transition-colors disabled:opacity-50">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none">
              <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 9a8 8 0 0114.9-2.1M20 15a8 8 0 01-14.9 2.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>

        {/* Custom date + Type filter */}
        <div className="flex flex-wrap items-center gap-3">
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-cblue transition-all" />
              <span className="text-muted text-sm">→</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="bg-surface2 border border-border rounded-lg px-3 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-cblue transition-all" />
            </div>
          )}

          {/* Loại phiếu */}
          <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
            {[
              { id:'all',    label:'Tất cả' },
              { id:'export', label:'⬆️ Xuất hàng' },
              { id:'import', label:'⬇️ Nhập hàng' },
            ].map(t => (
              <button key={t.id}
                onClick={() => { setTypeFilter(t.id); if (t.id === 'all') setViewMode('orders') }}
                className={`px-3 py-1.5 text-sm font-semibold transition-colors border-l border-border first:border-l-0 ${
                  typeFilter === t.id
                    ? 'bg-cblue/20 text-cblue'
                    : 'bg-surface text-muted hover:bg-surface2 hover:text-[#e6edf3]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* View toggle — chỉ hiện khi lọc theo loại cụ thể */}
          {typeFilter !== 'all' && (
            <div className="flex rounded-lg overflow-hidden border border-border shrink-0 ml-auto">
              {[
                { id:'orders',   icon:'🧾', label:'Danh sách đơn' },
                { id:'products', icon:'📊', label:'Theo sản phẩm' },
              ].map(v => (
                <button key={v.id} onClick={() => setViewMode(v.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l border-border first:border-l-0 ${
                    viewMode === v.id
                      ? typeFilter === 'export' ? 'bg-cblue/20 text-cblue' : 'bg-cyellow/20 text-cyellow'
                      : 'bg-surface text-muted hover:bg-surface2 hover:text-[#e6edf3]'
                  }`}>
                  <span>{v.icon}</span>
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── KPI cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:'Tổng đơn HT',    value: String(stats.total),          color:'text-cblue',   icon:'🧾' },
          { label:'Doanh thu xuất', value: fmtVNDFull(stats.revenue),    color:'text-cgreen',  icon:'⬆️' },
          { label:'Tổng nhập kho',  value: fmtVNDFull(stats.imported),   color:'text-cyellow', icon:'⬇️' },
          { label:'Lợi nhuận',      value: fmtVNDFull(stats.profit),     color: stats.profit >= 0 ? 'text-cgreen' : 'text-cred', icon:'📈' },
        ].map(k => (
          <div key={k.label} className="card p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-2xl opacity-20">{k.icon}</div>
            <div className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1.5">{k.label}</div>
            <div className={`text-xl font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* ── Table ─────────────────────────────────────── */}

      {/* View: Danh sách đơn */}
      {viewMode === 'orders' && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xl shadow-black/20">
          <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
            <div className="text-sm font-bold">Danh sách đơn hàng</div>
            <span className="tag-blue">{orders.length} đơn</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted text-sm">Đang tải…</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <div className="text-4xl mb-2">📋</div>
              <div className="font-semibold">Không có đơn hàng trong khoảng thời gian này</div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto whitespace-nowrap">
              <table className="w-full min-w-0 text-xs md:text-sm">
                <thead>
                  <tr className="bg-[#0a0e14] border-b border-border">
                    <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Mã đơn</th>
                    <th className="col-hide-mobile px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Thời gian</th>
                    <th className="col-hide-tablet px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Loại</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Đối tác</th>
                    <th className="px-3 sm:px-4 py-3 text-right text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Tổng tiền</th>
                    <th className="col-hide-mobile px-4 py-3 text-right text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Lợi nhuận</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
                    <th className="px-3 sm:px-4 py-3 text-center text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(ord => {
                    const isImport    = ord.type === 'import'
                    const isCancelled = ord.status === 'cancelled'
                    const partner     = isImport ? ord.suppliers?.name : ord.customers?.full_name
                    const code        = (ord.order_code || ord.id.slice(-8)).toUpperCase()

                    return (
                      <tr key={ord.id}
                        className={`border-b border-border/40 last:border-0 transition-colors group ${isCancelled ? 'opacity-45' : 'hover:bg-slate-800/30 cursor-pointer'}`}
                        onClick={() => !isCancelled && setDetailTarget(ord)}>

                        <td className="px-3 sm:px-4 py-3 sm:py-3.5">
                          <div className="font-mono text-xs bg-surface2 border border-border px-2 py-0.5 rounded text-muted inline-block">#{code}</div>
                          {/* Thời gian hiện ngay dưới mã đơn trên mobile */}
                          <div className="sm:hidden text-[10px] text-muted mt-0.5">{fmtDatetime(ord.created_at)}</div>
                        </td>
                        <td className="col-hide-mobile px-4 py-3.5 text-xs text-muted whitespace-nowrap">{fmtDatetime(ord.created_at)}</td>
                        <td className="col-hide-tablet px-4 py-3.5">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${isImport ? 'bg-cyellow/15 text-cyellow border-cyellow/30' : 'bg-cblue/15 text-cblue border-cblue/30'}`}>
                            {isImport ? '⬇️ Nhập' : '⬆️ Xuất'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-sm max-w-[120px] sm:max-w-none">
                          {partner
                            ? <span className={`truncate block ${isImport ? 'text-cyellow font-semibold' : 'text-cpurple font-semibold'}`}>{partner}</span>
                            : <span className="text-muted italic">Khách lẻ</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-3.5 text-right font-mono text-xs sm:text-sm font-semibold text-[#e6edf3] tabular-nums whitespace-nowrap">
                          {fmtVNDFull(ord.total_amount)}
                        </td>
                        <td className="col-hide-mobile px-4 py-3.5 text-right whitespace-nowrap">
                          {isImport ? <span className="text-muted text-xs">—</span>
                            : <span className={`font-mono text-sm font-bold tabular-nums ${(ord.profit||0) >= 0 ? 'text-cgreen' : 'text-cred'}`}>{fmtVNDFull(ord.profit)}</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-3 sm:py-3.5"><StatusBadge status={ord.status} /></td>
                        <td className="px-3 sm:px-4 py-3 sm:py-3.5" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setDetailTarget(ord)} title="Xem chi tiết"
                              className="w-8 h-8 sm:w-7 sm:h-7 rounded-md border border-slate-700 text-slate-400 hover:border-cblue hover:text-cblue hover:bg-cblue/10 active:scale-90 transition-all touch-manipulation flex items-center justify-center">
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8"/></svg>
                            </button>
                            {ord.status !== 'cancelled' && (
                              <button onClick={() => reprintOrder(ord)} title="In lại hóa đơn"
                                className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors flex items-center justify-center">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                  <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                                  <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/>
                                </svg>
                              </button>
                            )}
                            {ord.status === 'completed' && (
                              <button onClick={() => setCancelTarget(ord)} title="Hủy đơn & hoàn kho"
                                className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:border-cred hover:text-cred hover:bg-cred/10 transition-colors flex items-center justify-center">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
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
          )}
        </div>
      )}

      {/* View: Theo sản phẩm */}
      {viewMode === 'products' && (
        <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xl shadow-black/20">
          <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">
                {typeFilter === 'import' ? '⬇️ Sản phẩm nhập nhiều nhất' : '📊 Sản phẩm bán chạy nhất'}
              </span>
              <span className="text-[10px] text-muted">(sắp xếp theo số lượng)</span>
            </div>
            <span className={typeFilter === 'import'
              ? 'bg-cyellow/15 text-cyellow text-xs font-bold px-2 py-0.5 rounded'
              : 'tag-blue'}>
              {productStats.length} sản phẩm
            </span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted text-sm">Đang tải…</div>
          ) : productStats.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <div className="text-4xl mb-2">📦</div>
              <div className="font-semibold">Không có dữ liệu trong khoảng thời gian này</div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto whitespace-nowrap">
              <table className="w-full min-w-[640px] text-xs md:text-sm">
                <thead>
                  <tr className="bg-[#0a0e14] border-b border-border">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider w-10">#</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider">Sản phẩm</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Số đơn</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Số lượng</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">
                      {typeFilter === 'import' ? 'Tổng tiền nhập' : 'Doanh thu'}
                    </th>
                    {typeFilter === 'export' && (
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Lợi nhuận</th>
                    )}
                    {typeFilter === 'export' && (
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">Margin</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {productStats.map((p, idx) => {
                    const margin = p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue * 100).toFixed(1) : 0
                    const maxQty = productStats[0]?.totalQty || 1
                    const barPct = Math.round(p.totalQty / maxQty * 100)

                    return (
                      <tr key={p.productId} className="border-b border-border/40 last:border-0 hover:bg-slate-800/30 transition-colors">

                        {/* Rank */}
                        <td className="px-4 py-3.5 text-center">
                          {idx === 0 && <span className="text-base">🥇</span>}
                          {idx === 1 && <span className="text-base">🥈</span>}
                          {idx === 2 && <span className="text-base">🥉</span>}
                          {idx > 2 && <span className="text-sm text-muted font-mono">{idx + 1}</span>}
                        </td>

                        {/* Tên + SKU + bar */}
                        <td className="px-4 py-3 min-w-[220px]">
                          <div className="font-semibold text-sm text-[#e6edf3] truncate max-w-[260px]">{p.name}</div>
                          <div className="text-[10px] text-muted font-mono mt-0.5">{p.sku}</div>
                          {/* Mini progress bar */}
                          <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden w-full max-w-[200px]">
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
                          <span className="text-[10px] text-muted ml-1">sp</span>
                        </td>

                        {/* Doanh thu / tiền nhập */}
                        <td className="px-4 py-3.5 text-right font-mono text-sm font-semibold text-[#e6edf3] tabular-nums whitespace-nowrap">
                          {fmtVNDFull(p.totalRevenue)}
                        </td>

                        {/* Lợi nhuận (export only) */}
                        {typeFilter === 'export' && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className={`font-mono text-sm font-bold tabular-nums ${p.totalProfit >= 0 ? 'text-cgreen' : 'text-cred'}`}>
                              {fmtVNDFull(p.totalProfit)}
                            </span>
                          </td>
                        )}

                        {/* Margin (export only) */}
                        {typeFilter === 'export' && (
                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                              Number(margin) >= 20
                                ? 'bg-cgreen/15 text-cgreen border-cgreen/30'
                                : Number(margin) >= 10
                                ? 'bg-cyellow/15 text-cyellow border-cyellow/30'
                                : 'bg-cred/15 text-cred border-cred/30'
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
                      <span className="text-[10px] text-muted ml-1">sp</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-black text-sm text-[#e6edf3] tabular-nums whitespace-nowrap">
                      {fmtVNDFull(productStats.reduce((s,p) => s + p.totalRevenue, 0))}
                    </td>
                    {typeFilter === 'export' && (
                      <td className="px-4 py-3 text-right font-mono font-black text-sm text-cgreen tabular-nums whitespace-nowrap">
                        {fmtVNDFull(productStats.reduce((s,p) => s + p.totalProfit, 0))}
                      </td>
                    )}
                    {typeFilter === 'export' && <td />}
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
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
  )
}
