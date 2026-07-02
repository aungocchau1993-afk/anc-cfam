import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { Building2, Eye, Pencil, Trash2, RotateCcw, Printer, Ban, Search, Plus, Upload, Download, Bot, RefreshCw, ChevronDown, X, FileText, LoaderCircle } from 'lucide-react'
import {
  getSuppliers as loadSuppliers,
  addSupplier as insertSupplier,
  editSupplier as updateSupplier,
  removeSupplier as deleteSupplier,
  bulkUpsertSuppliers as upsertSuppliers,
  getSupplierOrders as loadSupplierImportOrders,
  cancelOrder as cancelOrderFull,
  returnOrderItem as partialReturnItem,
  getOrderDetail as loadOrderDetail,
  subscribeSuppliers,
  addImportOrder,
  getProducts as loadProducts,
} from '../../lib/dataService'
import OcrInvoiceModal from '../../components/business/OcrInvoiceModal'
import { loadSupplierDebtsByPeriod, supabase, isSupabaseConfigured } from '../../lib/supabase'
import DateFilterBar, { getDateRange, toInputDate, startOf } from '../../components/ui/DateFilterBar'
import { fmtVNDFull, formatMoneyLive, parseVNDInput, removeVietnameseTones } from '../../lib/formatters'
import ModalOverlay from '../../components/ui/ModalOverlay'
import { buildReceiptHtml, printViaIframe } from '../../lib/printReceipt'
import PageHeader from '../../components/ui/PageHeader'
import { SkeletonTableBody, SkeletonCard } from '../../components/ui/Skeleton'
import Can from '../../components/permission/Can'
import { usePermission } from '../../hooks/usePermission'
import { PERMISSIONS } from '../../lib/permissions/permissionConstants'

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

// ── Supplier Form Modal ────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', phone: '', address: '', debt: '', note: '' }

function SupplierModal({ initial, onSave, onClose }) {
  const isEdit = !!initial?.id
  const [form, setForm]     = useState(() => isEdit ? {
    name:    initial.name,
    phone:   initial.phone    || '',
    address: initial.address  || '',
    debt:    initial.debt ? initial.debt.toLocaleString('vi-VN') : '',
    note:    initial.note     || '',
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên nhà cung cấp'); return }
    setSaving(true)
    try {
      await onSave({
        name:    form.name.trim(),
        phone:   form.phone.trim()   || null,
        address: form.address.trim() || null,
        debt:    parseVNDInput(form.debt),
        note:    form.note.trim()    || null,
      })
      onClose()
    } catch (err) {
      toast.error(err.message || 'Lỗi lưu')
    } finally {
      setSaving(false)
    }
  }

  const iCls = 'input-base'
  const mCls = iCls + ' text-right font-mono text-cblue'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm md:max-w-md mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <div className="font-bold text-base text-text">
              {isEdit ? 'Sửa nhà cung cấp' : 'Thêm nhà cung cấp'}
            </div>
            <div className="text-xs text-muted mt-0.5">Thông tin cơ bản và công nợ</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          {/* Tên */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Tên nhà cung cấp *</label>
            <input
              autoFocus
              className={iCls}
              placeholder="Công ty TNHH ABC…"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* SĐT */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Số điện thoại</label>
            <input
              className={iCls}
              type="tel"
              placeholder="0901 234 567"
              inputMode="tel"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </div>

          {/* Địa chỉ */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Địa chỉ</label>
            <textarea
              className={iCls + ' resize-none h-auto py-2.5'}
              rows={2}
              placeholder="123 Nguyễn Văn A, Q.1, TP.HCM"
              value={form.address}
              onChange={e => set('address', e.target.value)}
            />
          </div>

          {/* Công nợ */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Công nợ (₫)</label>
            <input
              className={mCls}
              inputMode="numeric"
              placeholder="0"
              value={form.debt}
              onChange={e => set('debt', formatMoneyLive(e.target.value))}
            />
          </div>

          {/* Ghi chú */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Ghi chú</label>
            <input
              className={iCls}
              placeholder="Giao hàng thứ 2, 4, 6…"
              value={form.note}
              onChange={e => set('note', e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
              {saving
                ? <span className="flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>
                    Đang lưu…
                  </span>
                : isEdit ? 'Cập nhật' : 'Thêm NCC'
              }
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ── Confirm Delete ─────────────────────────────────────────────────────────

function ConfirmDelete({ supplier, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  async function handle() {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false) }
  }
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
        <div className="text-lg font-bold text-cred">Xoá nhà cung cấp?</div>
        <div className="text-sm text-muted">
          <span className="font-semibold text-text">{supplier.name}</span><br/>
          Hành động này không thể hoàn tác.
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
          <button
            onClick={handle}
            disabled={loading}
            className="btn-danger px-4 py-2 text-sm disabled:opacity-60"
          >
            {loading ? 'Đang xoá…' : 'Xoá'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── (date helpers đã import từ DateFilterBar) ─────────────────────────────

// ── Supplier Order Drawer ──────────────────────────────────────────────────

const STATUS_MAP = {
  completed:          { l: 'Hoàn thành',   c: 'text-cgreen   bg-emerald-50  border-emerald-200' },
  cancelled:          { l: 'Đã huỷ',       c: 'text-cred     bg-rose-50     border-rose-200' },
  partially_returned: { l: 'Trả một phần', c: 'text-cpurple  bg-violet-50   border-violet-200' },
  pending:            { l: 'Chờ xử lý',   c: 'text-cyellow  bg-amber-50    border-amber-200' },
}

function ReturnInput({ item, onConfirm, onCancel, loading }) {
  const maxReturn = (item.quantity || 0) - (item.returned_quantity || 0)
  const [qty, setQty] = useState(1)
  return (
    <div className="bg-violet-50 border border-violet-200 rounded-lg p-3 mt-2 flex flex-col gap-2">
      <div className="text-[12px] text-cpurple font-semibold flex items-center gap-1.5">
        <RotateCcw size={12} /> Trả hàng · Tối đa {maxReturn}
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min="1" max={maxReturn} autoFocus
          value={qty} onChange={e => setQty(Math.min(maxReturn, Math.max(1, parseInt(e.target.value)||1)))}
          className="w-20 rounded-lg bg-surface border border-border px-2.5 py-1.5 text-sm text-center font-mono text-text outline-none focus:border-cpurple"
        />
        <span className="text-xs text-muted">sp · Hoàn tiền:</span>
        <span className="text-xs font-bold font-mono text-cgreen">{fmtVNDFull(qty * (item.price || 0))}</span>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs text-muted hover:text-text">Huỷ</button>
        <button onClick={() => onConfirm(qty)} disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-cpurple/10 border border-cpurple/30 text-cpurple text-xs font-bold hover:bg-cpurple/20 disabled:opacity-60">
          {loading ? 'Đang xử lý…' : 'Xác nhận trả'}
        </button>
      </div>
    </div>
  )
}

function SupplierOrderDrawer({ supplier, onClose, onSupplierUpdated }) {
  const { can } = usePermission()
  const [orders,     setOrders]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState(null)   // order id đang mở chi tiết
  const [returning,  setReturning]  = useState(null)   // item id đang trả
  const [processing, setProcessing] = useState(false)

  const [drawerPreset,  setDrawerPreset]  = useState('all')
  const [drawerFrom,    setDrawerFrom]    = useState(toInputDate(startOf('month')))
  const [drawerTo,      setDrawerTo]      = useState(toInputDate(new Date()))

  const { from, to } = getDateRange(drawerPreset, drawerFrom, drawerTo)

  async function reload() {
    setLoading(true)
    try {
      const data = await loadSupplierImportOrders(supplier.id, { from, to })
      setOrders(data)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [supplier.id, drawerPreset, drawerFrom, drawerTo])

  // Realtime: tự động reload khi có đơn nhập mới từ NCC này
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return

    const channel = supabase
      .channel(`supplier_orders_${supplier.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const row = payload.new || payload.old
          if (row?.supplier_id === supplier.id || row?.type === 'import') {
            reload()
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supplier.id])

  // ── Huỷ toàn bộ đơn ─────────────────────────────────────────────────────
  async function handleCancel(order) {
    if (!window.confirm(`Huỷ đơn #${(order.order_code || order.id.slice(-8)).toUpperCase()}?\nHệ thống sẽ trừ tồn kho và giảm công nợ NCC.`)) return
    setProcessing(true)
    try {
      await cancelOrderFull(order)
      toast.success('Đã huỷ đơn và cân bằng kho + công nợ')
      await reload()
      onSupplierUpdated?.()
    } catch (e) { toast.error(e.message) }
    finally { setProcessing(false) }
  }

  // ── Trả một phần ────────────────────────────────────────────────────────
  async function handleReturn(order, item, returnQty) {
    setProcessing(true)
    try {
      await partialReturnItem({ orderId: order.id, item, returnQty, order })
      toast.success(`Đã trả ${returnQty} sp "${item.products?.name}" · Giảm nợ NCC`)
      setReturning(null)
      const updated = await loadOrderDetail(order.id)
      if (updated) setOrders(prev => prev.map(o => o.id === order.id ? updated : o))
      onSupplierUpdated?.()
    } catch (e) { toast.error(e.message) }
    finally { setProcessing(false) }
  }

  // ── In phiếu nhập ────────────────────────────────────────────────────────
  function handlePrint(order) {
    const items = (order.order_items || []).map(i => ({
      name:     i.products?.name || '—',
      quantity: i.quantity,
      price:    i.price,
      cost:     i.cost,
    }))
    const paid    = order.paid_amount  != null ? Number(order.paid_amount)  : order.total_amount
    const debt    = order.debt_amount  != null ? Number(order.debt_amount)  : Math.max(0, order.total_amount - paid)
    printViaIframe(buildReceiptHtml({
      order,
      customer:     { fullName: supplier.name, phone: supplier.phone },
      items,
      total:        order.total_amount,
      note:         order.note || '',
      paidAmount:   paid,
      debtAmount:   debt,
      isImport:     true,
      partnerLabel: 'Nhà cung cấp:',
    }))
  }

  const totalDebt   = orders.filter(o => o.status === 'completed').reduce((s, o) => s + (o.total_amount || 0), 0)
  const totalOrders = orders.length

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-xl bg-surface border-l border-border flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cblue/10 border border-cblue/20 flex items-center justify-center text-base font-black text-cblue shrink-0">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-black text-base text-text">{supplier.name}</div>
              {supplier.phone && <div className="text-xs text-muted font-mono mt-0.5">{supplier.phone}</div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Refresh button */}
            <button
              onClick={reload}
              disabled={loading}
              title="Làm mới dữ liệu"
              className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:border-cblue hover:text-cblue transition-colors flex items-center justify-center"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-0 border-b border-border shrink-0">
          {[
            { label: 'Tổng đơn',  value: totalOrders,              color: 'text-cblue'   },
            { label: 'Công nợ',   value: fmtVNDFull(supplier.debt ?? 0), color: (supplier.debt ?? 0) > 0 ? 'text-cred' : 'text-cgreen' },
            { label: 'Tổng nhập', value: fmtVNDFull(totalDebt),    color: 'text-cyellow' },
          ].map((s, i) => (
            <div key={i} className={`px-4 py-3 text-center ${i < 2 ? 'border-r border-border' : ''}`}>
              <div className="text-[12px] text-muted uppercase tracking-wide">{s.label}</div>
              <div className={`text-sm font-black tabular-nums mt-0.5 ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Date filter */}
        <div className="shrink-0 px-4 py-3 border-b border-border bg-surface2">
          <DateFilterBar
            preset={drawerPreset}   setPreset={setDrawerPreset}
            customFrom={drawerFrom} setCustomFrom={setDrawerFrom}
            customTo={drawerTo}     setCustomTo={setDrawerTo}
            onRefresh={reload}
            loading={loading}
            showAllTime={true}
            className="text-xs"
          />
        </div>

        {/* Order list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-16 text-muted text-sm">Đang tải đơn hàng…</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-20 text-subtle">
              <FileText size={40} className="mx-auto mb-2 opacity-40" />
              <div className="font-semibold">
                {drawerPreset === 'all' ? 'Chưa có đơn nhập nào từ NCC này' : 'Không có đơn nhập trong khoảng thời gian này'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {orders.map(order => {
                const code      = (order.order_code || order.id.slice(-8)).toUpperCase()
                const st        = STATUS_MAP[order.status] || STATUS_MAP.pending
                const items     = order.order_items || []
                const isOpen    = expanded === order.id
                const canCancel = ['completed', 'partially_returned'].includes(order.status)

                return (
                  <div key={order.id} className="px-4 py-3">
                    {/* Order header row */}
                    <div
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => setExpanded(isOpen ? null : order.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted">#{code}</span>
                          <span className={`text-[12px] font-bold rounded-full border px-2 py-0.5 ${st.c}`}>{st.l}</span>
                        </div>
                        <div className="text-[12px] text-muted mt-0.5">
                          {new Date(order.created_at).toLocaleString('vi-VN')} · {items.length} mặt hàng
                        </div>
                        {/* Paid/Debt summary inline */}
                        {order.paid_amount != null && order.paid_amount !== order.total_amount && (
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[12px] text-cblue">
                              Đã TT: {fmtVNDFull(order.paid_amount)}
                            </span>
                            {(order.debt_amount ?? 0) > 0 && (
                              <span className="text-[12px] text-cred font-bold">
                                · Còn nợ: {fmtVNDFull(order.debt_amount)}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-black text-text tabular-nums">{fmtVNDFull(order.total_amount)}</div>
                        {(order.debt_amount ?? 0) > 0 && (
                          <div className="text-[12px] text-cred tabular-nums">nợ {fmtVNDFull(order.debt_amount)}</div>
                        )}
                      </div>
                      <ChevronDown size={16} className={`text-muted transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="mt-3 flex flex-col gap-2">

                        {/* Items */}
                        <div className="rounded-xl border border-border overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-surface2 border-b border-border">
                                <th className="px-3 py-2 text-left text-[12px] text-muted uppercase">Sản phẩm</th>
                                <th className="px-3 py-2 text-right text-[12px] text-muted uppercase">SL</th>
                                <th className="px-3 py-2 text-right text-[12px] text-muted uppercase">Đã trả</th>
                                <th className="px-3 py-2 text-right text-[12px] text-muted uppercase">Đơn giá</th>
                                <th className="px-3 py-2 text-right text-[12px] text-muted uppercase">T.tiền</th>
                                <th className="px-3 py-2 w-8"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {items.map(item => {
                                const unreturned = (item.quantity || 0) - (item.returned_quantity || 0)
                                const canReturn  = unreturned > 0 && canCancel
                                const isReturning = returning === item.id
                                return (
                                  <div key={item.id} className="contents">
                                    <tr className="hover:bg-surface2">
                                      <td className="px-3 py-2 text-text">
                                        <div className="truncate max-w-[150px]">{item.products?.name || '—'}</div>
                                        <div className="text-[12px] text-muted font-mono">{item.products?.sku}</div>
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                                      <td className="px-3 py-2 text-right tabular-nums text-cpurple">
                                        {item.returned_quantity > 0 ? item.returned_quantity : '—'}
                                      </td>
                                      <td className="px-3 py-2 text-right tabular-nums font-mono">{fmtVNDFull(item.price)}</td>
                                      <td className="px-3 py-2 text-right tabular-nums font-mono font-bold">
                                        {fmtVNDFull((item.price || 0) * (item.quantity || 0))}
                                      </td>
                                      <td className="px-3 py-2">
                                        {canReturn && can(PERMISSIONS.ORDER_RETURN) && (
                                          <button
                                            onClick={e => { e.stopPropagation(); setReturning(isReturning ? null : item.id) }}
                                            className="text-cpurple hover:bg-cpurple/10 p-1 rounded transition-colors flex items-center justify-center"
                                            title="Trả hàng"
                                          ><RotateCcw size={12} /></button>
                                        )}
                                      </td>
                                    </tr>
                                    {isReturning && (
                                      <tr>
                                        <td colSpan={6} className="px-3 pb-2">
                                          <ReturnInput
                                            item={item}
                                            loading={processing}
                                            onCancel={() => setReturning(null)}
                                            onConfirm={qty => handleReturn(order, item, qty)}
                                          />
                                        </td>
                                      </tr>
                                    )}
                                  </div>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>

                        {order.note && (
                          <div className="text-xs text-muted italic px-1">Ghi chú: {order.note}</div>
                        )}

                        {/* Action buttons */}
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => handlePrint(order)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted text-xs hover:border-cblue hover:text-cblue hover:bg-cblue/5 transition-colors"
                          >
                            <Printer size={14} />
                            In phiếu
                          </button>
                          {canCancel && can(PERMISSIONS.ORDER_CANCEL) && (
                            <button
                              onClick={() => handleCancel(order)}
                              disabled={processing}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cred/30 text-cred text-xs hover:bg-cred/10 transition-colors disabled:opacity-50"
                            >
                              <Ban size={14} />
                              Huỷ toàn bộ đơn
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Suppliers() {
  const [suppliers,       setSuppliers]       = useState([])
  const [products,        setProducts]        = useState([])
  const [showOcrPurchase, setShowOcrPurchase] = useState(false)
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [showAdd, setShowAdd]           = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [viewTarget, setViewTarget]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]             = useState(false)
  const [importing, setImporting]           = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const importRef = useRef(null)

  // ── UI-only state bổ sung (chọn nhiều / bulk action bar) — không đụng CRUD/API ──
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkBusy, setBulkBusy]       = useState(false)

  // ── Bộ lọc ngày ───────────────────────────────────────
  const [preset,       setPreset]       = useState('all')
  const [customFrom,   setCustomFrom]   = useState(toInputDate(startOf('month')))
  const [customTo,     setCustomTo]     = useState(toInputDate(new Date()))
  const [periodMap,    setPeriodMap]    = useState({})
  const [periodLoading,setPeriodLoading]= useState(false)

  const isAllTime = preset === 'all'

  const fetchSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const [data, prods] = await Promise.all([loadSuppliers(''), loadProducts('')])
      setSuppliers(data)
      setProducts(prods || [])
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSuppliers() }, [fetchSuppliers])

  // Realtime: máy B thêm/sửa NCC → máy A tự cập nhật
  useEffect(() => {
    const unsub = subscribeSuppliers(() => fetchSuppliers())
    return unsub
  }, [fetchSuppliers])

  // Fetch công nợ theo kỳ khi preset / custom thay đổi
  useEffect(() => {
    setPeriodLoading(true)
    const { from, to } = getDateRange(preset, customFrom, customTo)
    if (!from || !to) { setPeriodMap({}); setPeriodLoading(false); return }
    loadSupplierDebtsByPeriod(from, to)
      .then(setPeriodMap)
      .catch(() => setPeriodMap({}))
      .finally(() => setPeriodLoading(false))
  }, [preset, customFrom, customTo])

  // ── KPIs ──────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = suppliers.length

    if (isAllTime) {
      // Toàn thời gian: dùng trực tiếp từ suppliers.debt
      const totalDebt = suppliers.reduce((s, c) => s + (c.debt || 0), 0)
      const inDebt    = suppliers.filter(c => (c.debt || 0) > 0).length
      const cleared   = suppliers.filter(c => !(c.debt > 0)).length
      const paidPeriod = 0  // không có dữ liệu all-time paid riêng
      return { total, totalDebt, inDebt, cleared, paidPeriod, hasPeriod: false }
    }

    // Theo kỳ: dùng periodMap
    const entries       = Object.values(periodMap)
    const totalDebt     = entries.reduce((s, e) => s + e.debtAmount, 0)
    const totalPaid     = entries.reduce((s, e) => s + e.paidAmount, 0)
    const totalImported = entries.reduce((s, e) => s + e.totalAmount, 0)
    const inDebt        = Object.keys(periodMap).filter(id => periodMap[id].debtAmount > 0).length
    const cleared       = Object.keys(periodMap).filter(id => periodMap[id].debtAmount === 0 && periodMap[id].totalAmount > 0).length
    return { total, totalDebt, inDebt, cleared, totalPaid, totalImported, hasPeriod: true }
  }, [suppliers, periodMap, isAllTime])

  const displayedSuppliers = useMemo(() => {
    const safeList  = Array.isArray(suppliers) ? suppliers : []
    const safeQuery = removeVietnameseTones(search || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return safeList
    return safeList.filter(s => {
      const name  = removeVietnameseTones(s?.name)
      const phone = removeVietnameseTones(s?.phone)
      return words.every(w => name.includes(w) || phone.includes(w))
    }).sort((a, b) => {
      const nA = removeVietnameseTones(a?.name || '')
      const nB = removeVietnameseTones(b?.name || '')
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
  }, [suppliers, search])

  const isSearching = loading && search.length > 0

  // ── Actions ───────────────────────────────────────────
  async function handleAdd(payload) {
    const saved = await insertSupplier(payload)
    setSuppliers(prev => [saved, ...prev].sort((a, b) => a.name.localeCompare(b.name)))
    toast.success(`Đã thêm "${saved.name}"`)
  }

  async function handleEdit(payload) {
    const saved = await updateSupplier(editTarget.id, payload)
    setSuppliers(prev => prev.map(s => s.id === editTarget.id ? saved : s))
    toast.success('Đã cập nhật nhà cung cấp')
    setEditTarget(null)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteSupplier(deleteTarget.id)
      setSuppliers(prev => prev.filter(s => s.id !== deleteTarget.id))
      toast.success(`Đã xoá "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  // ── Bulk actions (thanh Action nổi) — chỉ lặp gọi lại deleteSupplier đã import
  // sẵn ở đầu file, KHÔNG viết CRUD/API mới. ──────────────────────────────────
  function toggleSelectOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectAllOnPage() {
    setSelectedIds(prev => {
      const pageIds = displayedSuppliers.map(s => s.id)
      const allSelected = pageIds.length > 0 && pageIds.every(id => prev.has(id))
      const next = new Set(prev)
      pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  const selectedSuppliers = useMemo(
    () => suppliers.filter(s => selectedIds.has(s.id)),
    [suppliers, selectedIds]
  )

  async function handleBulkDelete() {
    if (!window.confirm(`Xoá ${selectedIds.size} nhà cung cấp đã chọn? Hành động này không thể hoàn tác.`)) return
    setBulkBusy(true)
    try {
      for (const s of selectedSuppliers) await deleteSupplier(s.id)
      setSuppliers(prev => prev.filter(x => !selectedIds.has(x.id)))
      toast.success(`Đã xoá ${selectedSuppliers.length} nhà cung cấp`)
      clearSelection()
    } catch (e) {
      toast.error(e.message || 'Lỗi xoá hàng loạt')
    } finally {
      setBulkBusy(false)
    }
  }

  function handleBulkExportExcel() {
    const rows = selectedSuppliers.map(s => ({
      'Tên nhà cung cấp':     s.name,
      'Điện thoại':           s.phone   || '',
      'Địa chỉ':              s.address || '',
      'Công nợ hiện tại (₫)': s.debt    ?? 0,
      'Ghi chú':              s.note    || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 36 }, { wch: 16 }, { wch: 24 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'NCC đã chọn')
    XLSX.writeFile(wb, 'Nha_Cung_Cap_Da_Chon.xlsx')
    toast.success(`Đã xuất ${rows.length} nhà cung cấp`)
  }

  // ── Xuất Excel ────────────────────────────────────────
  async function handleExportExcel() {
    const toastId = toast.loading('Đang xuất dữ liệu…')
    try {
      const all = await loadSuppliers('')

      const periodLabel = isAllTime
        ? 'Toàn thời gian'
        : (preset === 'custom' && customFrom && customTo ? `${customFrom} → ${customTo}` : preset)

      const rows = all.map(s => {
        const pData = periodMap[s.id]
        const base = {
          'Tên nhà cung cấp':     s.name,
          'Điện thoại':           s.phone   || '',
          'Địa chỉ':              s.address || '',
          'Công nợ hiện tại (₫)': s.debt    ?? 0,
          'Ghi chú':              s.note    || '',
        }
        if (!isAllTime && pData) {
          base[`Nhập kho kỳ (₫) [${periodLabel}]`] = pData.totalAmount
          base[`Đã trả kỳ (₫) [${periodLabel}]`]   = pData.paidAmount
          base[`Nợ phát sinh kỳ (₫) [${periodLabel}]`] = pData.debtAmount
        }
        return base
      })

      // Lọc chỉ NCC có giao dịch trong kỳ nếu đang lọc theo ngày
      const filtered = (!isAllTime && Object.keys(periodMap).length > 0)
        ? rows.filter((_, i) => periodMap[all[i]?.id])
        : rows

      const ws = XLSX.utils.json_to_sheet(filtered)
      ws['!cols'] = isAllTime
        ? [{ wch: 32 }, { wch: 16 }, { wch: 36 }, { wch: 16 }, { wch: 24 }]
        : [{ wch: 32 }, { wch: 16 }, { wch: 36 }, { wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 22 }, { wch: 22 }]
      const wb = XLSX.utils.book_new()
      const sheetName = isAllTime ? 'Nhà Cung Cấp' : `NCC ${periodLabel}`
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))
      const fileName = isAllTime
        ? 'Danh_Sach_Nha_Cung_Cap.xlsx'
        : `NCC_${preset === 'custom' ? `${customFrom}_${customTo}` : preset}.xlsx`
      XLSX.writeFile(wb, fileName)
      toast.success(`Đã xuất ${filtered.length} nhà cung cấp · ${periodLabel}`, { id: toastId })
    } catch (err) {
      toast.error(err.message || 'Lỗi xuất Excel', { id: toastId })
    }
  }

  // ── Nhập Excel ────────────────────────────────────────
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
        const data      = new Uint8Array(event.target.result)
        const workbook  = XLSX.read(data, { type: 'array' })
        const worksheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData  = XLSX.utils.sheet_to_json(worksheet)

        if (!jsonData || jsonData.length === 0) {
          toast.error('File không có dữ liệu hoặc sai định dạng!', { id: toastId })
          setImporting(false)
          return
        }

        const cleanPhone  = (val) => String(val ?? '').replace(/[^0-9]/g, '').trim()
        const cleanNumber = (val) => {
          if (val === undefined || val === null || val === '') return 0
          const s   = String(val).trim()
          const neg = s.startsWith('-')
          const n   = Math.round(Number(s.replace(/[^0-9.]/g, '')) || 0)
          return neg ? -n : n
        }

        const mapped = jsonData
          .map(row => {
            const phone = cleanPhone(row['Điện thoại'] ?? row['SĐT'] ?? row['Phone'] ?? '')
            if (!phone || phone.length < 8) return null

            return {
              name:    String(row['Tên nhà cung cấp'] ?? row['Tên'] ?? '').trim() || 'Nhà cung cấp chưa tên',
              phone,
              address: String(row['Địa chỉ'] ?? '').trim() || '',
              debt:    cleanNumber(row['Công nợ'] ?? row['Nợ'] ?? 0),
              note:    String(row['Ghi chú'] ?? '').trim() || '',
            }
          })
          .filter(Boolean)

        if (mapped.length === 0) {
          toast.error('Không có NCC hợp lệ (SĐT phải có ít nhất 8 chữ số)!', { id: toastId })
          setImporting(false)
          return
        }

        const saveMsg = `Đang upsert ${mapped.length} nhà cung cấp…`
        setImportProgress(saveMsg)
        toast.loading(saveMsg, { id: toastId })

        const saved = await upsertSuppliers(mapped)

        const refreshed = await loadSuppliers('')
        setSuppliers(refreshed)

        toast.success(
          `Import thành công ${saved.length} nhà cung cấp (upsert theo SĐT)`,
          { id: toastId, duration: 5000 }
        )
      } catch (err) {
        console.error('[Import Suppliers]', err)
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

  // ── Render ─────────────────────────────────────────────
  return (
    <div className="w-full">
      <PageHeader icon={Building2} title="Nhà Cung Cấp" subtitle="Quản lý nhà cung cấp và công nợ" />
    <div className="p-6 w-full">

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          {
            label: 'Tổng NCC',
            value: String(kpis.total),
            unit:  'nhà cung cấp',
            color: 'text-cblue',
            icon:  Building2,
          },
          {
            label: periodLoading ? 'Công nợ …' : isAllTime ? 'Tổng công nợ' : 'Nợ phát sinh kỳ',
            value: fmtVNDFull(kpis.totalDebt),
            unit:  isAllTime ? 'Toàn thời gian' : (preset === 'custom' && customFrom && customTo ? `${customFrom} → ${customTo}` : ''),
            color: kpis.totalDebt > 0 ? 'text-cred' : 'text-cgreen',
            icon:  null,
          },
          kpis.hasPeriod
            ? {
                label: 'Đã thanh toán kỳ',
                value: fmtVNDFull(kpis.totalPaid ?? 0),
                unit:  `Nhập: ${fmtVNDFull(kpis.totalImported ?? 0)}`,
                color: 'text-cblue',
                icon:  null,
              }
            : {
                label: 'Đang nợ',
                value: String(kpis.inDebt),
                unit:  'nhà cung cấp',
                color: kpis.inDebt > 0 ? 'text-cyellow' : 'text-cgreen',
                icon:  null,
              },
          {
            label: kpis.hasPeriod ? 'NCC đã TT đủ' : 'Đã thanh toán',
            value: String(kpis.cleared),
            unit:  'nhà cung cấp',
            color: 'text-cgreen',
            icon:  null,
          },
        ].map(k => (
          <div key={k.label} className="card p-4 relative overflow-hidden">
            {k.icon && <k.icon size={28} className="absolute top-3 right-3 opacity-10" />}
            <div className="text-[12px] text-muted font-semibold uppercase tracking-wide mb-1.5">{k.label}</div>
            <div className={`text-xl font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
            {k.unit && <div className="text-[12px] text-muted mt-0.5 truncate">{k.unit}</div>}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[180px]">
          {isSearching
            ? <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cblue animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>
            : <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          }
          <input
            className="input-base pl-9 text-sm"
            placeholder="Tìm theo tên, SĐT…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Bộ lọc thời gian */}
        <DateFilterBar
          preset={preset}       setPreset={setPreset}
          customFrom={customFrom} setCustomFrom={setCustomFrom}
          customTo={customTo}   setCustomTo={setCustomTo}
          loading={periodLoading}
          showAllTime={true}
          className="shrink-0"
        />

        {/* Xuất Excel */}
        <Can permission={PERMISSIONS.CRM_EXPORT}>
          <button
            onClick={handleExportExcel}
            className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm h-auto whitespace-nowrap"
          >
            <Download size={15} /> Xuất Excel
          </button>
        </Can>

        {/* Nhập Excel */}
        <Can permission={PERMISSIONS.CRM_CREATE}>
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="btn-ghost flex items-center gap-2 px-4 py-2 text-sm h-auto disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {importing
              ? <>
                  <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
                  </svg>
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

          <button
            onClick={() => setShowOcrPurchase(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cblue/10 border border-cblue/30 text-cblue text-sm font-semibold hover:bg-cblue/15 transition-colors whitespace-nowrap"
          >
            <Bot size={15} /> Quét HĐ nhập
          </button>

          <button
            onClick={() => setShowAdd(true)}
            className="btn-primary flex items-center gap-2 px-4 py-3 text-base"
          >
            <Plus size={16} /> Thêm NCC
          </button>
        </Can>
      </div>

      {/* ══════════════════ BULK ACTION BAR — nổi phía trên Table khi có chọn ══════════════════ */}
      {selectedIds.size > 0 && (
        <div className="mb-4 bg-[#0f172a] rounded-2xl shadow-lg px-4 py-3 flex flex-wrap items-center gap-2.5 animate-slideUp">
          <span className="text-sm font-semibold text-white mr-1">Đã chọn {selectedIds.size} nhà cung cấp</span>
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
              {bulkBusy ? <LoaderCircle size={14} strokeWidth={2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />} Xóa
            </button>
          </Can>
          <button onClick={clearSelection}
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg text-white/60 hover:text-white text-[14px] font-medium transition-colors ml-auto">
            <X size={14} strokeWidth={2.2} /> Bỏ chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
          <div className="text-sm font-bold text-text">Danh sách nhà cung cấp</div>
          <span className="tag-blue">{displayedSuppliers.length}{search ? ` / ${suppliers.length}` : ''} NCC{search ? ` (lọc: "${search}")` : ''}</span>
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
        ) : displayedSuppliers.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <div className="font-semibold mb-1">{search ? 'Không tìm thấy nhà cung cấp' : 'Chưa có nhà cung cấp'}</div>
            {!search && (
              <button onClick={() => setShowAdd(true)} className="btn-primary mt-3 px-5 py-2 text-sm">
                <Plus size={16} /> Thêm NCC đầu tiên
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile: Card list (< sm) ── */}
            <div className="sm:hidden flex flex-col gap-2 p-3">
              {displayedSuppliers.map(s => (
                <div key={s.id} onClick={() => setViewTarget(s)}
                  className="bg-surface border border-border rounded-xl p-3.5 active:bg-surface2 cursor-pointer">
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-11 h-11 rounded-xl bg-cblue/10 border border-cblue/20 flex items-center justify-center text-base font-black text-cblue shrink-0">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text truncate">{s.name}</div>
                      <div className="text-[12px] text-muted font-mono mt-0.5">{fmtPhone(s.phone)}</div>
                      {s.address && <div className="text-[12px] text-subtle truncate mt-0.5">{s.address}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      {s.debt > 0
                        ? <span className="tag-red font-mono tabular-nums">{fmtVNDFull(s.debt)}</span>
                        : <span className="tag-green">Đã TT</span>
                      }
                      <div className="text-[12px] text-subtle mt-1">Công nợ</div>
                    </div>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setViewTarget(s)} className="flex-1 h-9 rounded-lg border border-border text-muted text-xs hover:border-cblue hover:text-cblue active:scale-95 transition-all flex items-center justify-center gap-1.5">
                      <Eye size={14} /> Chi tiết
                    </button>
                    <Can permission={PERMISSIONS.CRM_UPDATE}>
                      <button onClick={() => setEditTarget(s)} className="flex-1 h-9 rounded-lg border border-border text-muted text-xs hover:border-cblue hover:text-cblue active:scale-95 transition-all flex items-center justify-center gap-1.5">
                        <Pencil size={14} /> Sửa
                      </button>
                    </Can>
                    <Can permission={PERMISSIONS.CRM_DELETE}>
                      <button onClick={() => setDeleteTarget(s)} className="h-9 w-9 rounded-lg border border-border text-subtle hover:border-cred hover:text-cred active:scale-95 transition-all flex items-center justify-center">
                        <Trash2 size={14} />
                      </button>
                    </Can>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Desktop: Table (≥ sm) ── */}
            <div className="hidden sm:block w-full overflow-x-auto whitespace-nowrap">
              <table className="w-full min-w-[700px] text-xs md:text-sm">
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-border">
                    <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={displayedSuppliers.length > 0 && displayedSuppliers.every(s => selectedIds.has(s.id))}
                        onChange={toggleSelectAllOnPage}
                        className="w-4 h-4 rounded accent-cblue" />
                    </th>
                    {['Nhà cung cấp', 'Số điện thoại', 'Địa chỉ', 'Công nợ', 'Ghi chú', 'Ngày tạo', 'Thao tác'].map(h => (
                      <th key={h} className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {displayedSuppliers.map(s => {
                    const checked = selectedIds.has(s.id)
                    return (
                    <tr
                      key={s.id}
                      onClick={() => setViewTarget(s)}
                      className={`hover:bg-surface2 transition-colors group cursor-pointer ${checked ? 'bg-blue-50/60' : ''}`}
                    >
                    {/* Checkbox */}
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={checked} onChange={() => toggleSelectOne(s.id)} className="w-4 h-4 rounded accent-cblue" />
                    </td>
                    {/* Tên */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-cblue/10 border border-cblue/20 flex items-center justify-center text-sm font-black text-cblue shrink-0">
                          {s.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-semibold text-sm text-text truncate max-w-[180px]">
                          {s.name}
                        </div>
                      </div>
                    </td>

                    {/* SĐT */}
                    <td className="px-4 py-3.5 text-sm text-muted font-mono whitespace-nowrap">
                      {fmtPhone(s.phone)}
                    </td>

                    {/* Địa chỉ */}
                    <td className="px-4 py-3.5 text-sm text-muted max-w-[200px]">
                      <div className="truncate">{s.address || '—'}</div>
                    </td>

                    {/* Công nợ */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      {s.debt > 0
                        ? <span className="tag-red font-mono tabular-nums">{fmtVNDFull(s.debt)}</span>
                        : s.debt < 0
                          ? <span className="font-mono text-sm font-bold tabular-nums text-cgreen">{fmtVNDFull(s.debt)}</span>
                          : <span className="tag-green">Đã TT</span>
                      }
                      {/* Nợ phát sinh trong kỳ */}
                      {!isAllTime && periodMap[s.id] && (
                        <div className="text-[12px] text-muted mt-1">
                          kỳ: {periodMap[s.id].debtAmount > 0
                            ? <span className="text-cred font-semibold">{fmtVNDFull(periodMap[s.id].debtAmount)}</span>
                            : <span className="text-cgreen font-semibold">Đủ</span>
                          }
                        </div>
                      )}
                    </td>

                    {/* Ghi chú */}
                    <td className="px-4 py-3.5 text-sm text-muted max-w-[160px]">
                      <div className="truncate">{s.note || '—'}</div>
                    </td>

                    {/* Ngày tạo */}
                    <td className="px-4 py-3.5 text-sm text-muted whitespace-nowrap">
                      {fmtDate(s.createdAt)}
                    </td>

                    {/* Thao tác */}
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setViewTarget(s)}
                          title="Xem lịch sử đơn nhập"
                          className="w-7 h-7 rounded-md border border-border text-muted hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors flex items-center justify-center"
                        >
                          <Eye size={14} />
                        </button>
                        <Can permission={PERMISSIONS.CRM_UPDATE}>
                          <button
                            onClick={() => setEditTarget(s)}
                            title="Sửa"
                            className="w-7 h-7 rounded-md border border-border text-muted hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors flex items-center justify-center"
                          >
                            <Pencil size={14} />
                          </button>
                        </Can>
                        <Can permission={PERMISSIONS.CRM_DELETE}>
                          <button
                            onClick={() => setDeleteTarget(s)}
                            title="Xoá"
                            className="w-7 h-7 rounded-md border border-border text-muted hover:border-cred hover:text-cred hover:bg-cred/10 transition-colors flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </Can>
                      </div>
                    </td>
                  </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {showAdd     && <SupplierModal onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {editTarget  && <SupplierModal initial={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} />}
      {viewTarget  && (
        <SupplierOrderDrawer
          supplier={viewTarget}
          onClose={() => setViewTarget(null)}
          onSupplierUpdated={() => {
            loadSuppliers('').then(setSuppliers).catch(() => {})
            setViewTarget(prev => suppliers.find(s => s.id === prev?.id) || prev)
          }}
        />
      )}
      {deleteTarget && <ConfirmDelete supplier={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}

      {showOcrPurchase && (
        <OcrInvoiceModal
          type="PURCHASE"
          products={products}
          suppliers={suppliers}
          onCreateImportOrder={async (data) => {
            try {
              await addImportOrder(data)
              toast.success('Đã tạo đơn nhập hàng thành công!')
              loadSuppliers('').then(setSuppliers).catch(() => {})
            } catch (err) {
              toast.error(err.message || 'Lỗi khi tạo đơn nhập')
            }
          }}
          onClose={() => setShowOcrPurchase(false)}
        />
      )}
    </div>
    </div>
  )
}
