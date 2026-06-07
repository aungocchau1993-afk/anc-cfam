import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  getProducts as loadProducts,
  getCustomers as loadCustomers,
  addOrder as createOrder,
  finalizeAfterSale as finalizeCustomerAfterOrder,
  spendPoints as redeemPoints,
  subscribeProducts,
  subscribeCustomers,
} from '../../lib/dataService'
import { loadOrders, cancelOrder, calcPointsEarned, productToCamel, customerToCamel } from '../../lib/supabase'
import { formatMoneyLive, parseVNDInput, fmtVNDFull, removeVietnameseTones } from '../../lib/formatters'
import { buildReceiptHtml, printViaIframe } from '../../lib/printReceipt'
import ModalOverlay from '../../components/ui/ModalOverlay'
import OcrInvoiceModal from '../../components/business/OcrInvoiceModal'
import useDebounce from '../../hooks/useDebounce'

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtPhone(p) {
  if (!p) return ''
  const d = String(p).replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}` : p
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function stockBadge(qty) {
  if (qty <= 0)  return { label: 'Hết', cls: 'text-cred bg-cred/10 border-cred/25' }
  if (qty <= 10) return { label: `${qty}`, cls: 'text-cyellow bg-cyellow/10 border-cyellow/25' }
  return { label: `${qty}`, cls: 'text-cgreen bg-cgreen/10 border-cgreen/25' }
}

// ── VIP Tier config ────────────────────────────────────────────────────────

const VIP_CONFIG = {
  MEMBER:   { label: 'Member',   color: 'text-slate-400',  bg: 'bg-slate-700/50',    border: 'border-slate-600',    icon: '🌱' },
  SILVER:   { label: 'Silver',   color: 'text-slate-300',  bg: 'bg-slate-400/15',    border: 'border-slate-400/40', icon: '🥈' },
  GOLD:     { label: 'Gold',     color: 'text-cyellow',    bg: 'bg-cyellow/15',      border: 'border-cyellow/40',   icon: '🥇' },
  PLATINUM: { label: 'Platinum', color: 'text-[#bc8cff]',  bg: 'bg-[#bc8cff]/15',   border: 'border-[#bc8cff]/40', icon: '💎' },
}

function VipBadge({ tier, size = 'sm' }) {
  const cfg = VIP_CONFIG[tier] || VIP_CONFIG.MEMBER
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold whitespace-nowrap
      ${size === 'sm' ? 'text-[10px]' : 'text-xs'}
      ${cfg.color} ${cfg.bg} ${cfg.border}`}>
      {cfg.icon} {cfg.label}
    </span>
  )
}

// ── Redeem Points Modal ─────────────────────────────────────────────────────

const REWARD_CATALOG = [
  { id: 1, name: 'Túi vải thân thiện',    points: 50,   icon: '👜' },
  { id: 2, name: 'Voucher giảm 50K',       points: 100,  icon: '🎫' },
  { id: 3, name: 'Bình nước inox 500ml',   points: 200,  icon: '🍶' },
  { id: 4, name: 'Hộp quà chăm sóc',      points: 500,  icon: '🎁' },
  { id: 5, name: 'Voucher giảm 500K',      points: 1000, icon: '💳' },
]

function RedeemModal({ customer, onRedeem, onClose }) {
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const available = customer?.rewardPoints ?? 0

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    try {
      await onRedeem(selected.points, `Đổi quà: ${selected.name}`)
      toast.success(`✅ Đã đổi ${selected.points} điểm lấy ${selected.name}`)
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-[#0d1117] border border-slate-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="font-bold text-[#e6edf3]">🎁 Đổi Điểm Lấy Quà</div>
            <div className="text-xs text-slate-500 mt-0.5">Điểm hiện có: <strong className="text-cyellow">{available.toLocaleString('vi-VN')} điểm</strong></div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-cred transition-colors text-lg">×</button>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {REWARD_CATALOG.map(item => {
            const canAfford = available >= item.points
            const isSelected = selected?.id === item.id
            return (
              <button
                key={item.id}
                disabled={!canAfford}
                onClick={() => setSelected(isSelected ? null : item)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                  ${isSelected
                    ? 'bg-cyellow/15 border-cyellow/50 text-[#e6edf3]'
                    : canAfford
                    ? 'bg-slate-800/60 border-slate-700 hover:border-slate-500 text-[#e6edf3]'
                    : 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
                  }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{item.name}</div>
                  <div className={`text-[11px] font-bold ${canAfford ? 'text-cyellow' : 'text-slate-600'}`}>
                    {item.points.toLocaleString('vi-VN')} điểm
                  </div>
                </div>
                {isSelected && <span className="text-cyellow text-lg shrink-0">✓</span>}
              </button>
            )
          })}
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:text-[#e6edf3] transition-colors">
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className="flex-1 py-2.5 rounded-xl bg-cyellow hover:brightness-110 text-black text-sm font-black transition-all disabled:opacity-40"
          >
            {loading ? 'Đang xử lý…' : `Đổi ${selected?.points ?? 0} điểm`}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Customer Selector ──────────────────────────────────────────────────────

function CustomerSelector({ customers, selected, onSelect }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const safeList  = Array.isArray(customers) ? customers : []
    const safeQuery = removeVietnameseTones(query || '')
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
  }, [customers, query])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-sm text-left transition-all ${
          selected
            ? 'bg-cpurple/10 border-cpurple/40 text-[#e6edf3]'
            : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-cpurple/40'
        }`}
      >
        <span className="text-base">{selected ? '👤' : '👥'}</span>
        <span className="flex-1 truncate font-medium">
          {selected ? selected.fullName : 'Khách lẻ'}
        </span>
        {selected && (
          <span
            onClick={e => { e.stopPropagation(); onSelect(null) }}
            className="text-slate-500 hover:text-cred text-xs px-1 rounded hover:bg-cred/10 transition-colors"
          >✕</span>
        )}
        <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none">
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-[#0d1117] border border-slate-700 rounded-xl shadow-2xl z-30 overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <input autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-[#e6edf3] placeholder:text-slate-600 outline-none focus:border-cpurple transition-all"
              placeholder="Tìm khách..."
              value={query} onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              onClick={() => { onSelect(null); setOpen(false); setQuery('') }}
              className="w-full px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-800 transition-colors flex items-center gap-2"
            >
              <span>👥</span> Khách lẻ
            </button>
            {filtered.map(c => (
              <button key={c.id}
                onClick={() => { onSelect(c); setOpen(false); setQuery('') }}
                className="w-full px-3 py-2.5 text-left hover:bg-slate-800 transition-colors flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-cpurple/20 text-cpurple text-xs font-black flex items-center justify-center shrink-0">
                    {c.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#e6edf3] truncate">{c.fullName}</div>
                    {c.phone && <div className="text-[11px] text-slate-500">{fmtPhone(c.phone)}</div>}
                  </div>
                </div>
                <div className="text-xs text-cpurple font-mono shrink-0">{fmtVNDFull(c.totalSpent || 0)}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-500">Không tìm thấy</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cart Item ──────────────────────────────────────────────────────────────

function CartItem({ item, onQty, onRemove, onPriceEdit }) {
  const [editingPrice, setEditingPrice] = useState(false)
  const [priceDisplay, setPriceDisplay] = useState(item.price.toLocaleString('vi-VN'))
  const [editingQty,   setEditingQty]   = useState(false)
  const [qtyInput,     setQtyInput]     = useState(String(item.quantity))
  const subtotal = item.price * item.quantity

  function handlePriceSave() {
    const val = parseVNDInput(priceDisplay)
    if (val > 0) onPriceEdit(item.productId, val)
    else setPriceDisplay(item.price.toLocaleString('vi-VN'))
    setEditingPrice(false)
  }

  function handleQtySave() {
    const n = parseInt(qtyInput) || 0
    onQty(item.productId, n)
    setEditingQty(false)
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-800/80 last:border-0 group">
      {/* Thumbnail */}
      {item.imageUrl
        ? <img src={item.imageUrl} alt={item.name}
            className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0" />
        : <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
      }

      {/* Name + price */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#e6edf3] truncate leading-tight">{item.name}</div>
        <div className="flex items-center gap-1 mt-0.5">
          {editingPrice ? (
            <input
              autoFocus
              className="w-28 text-[11px] font-mono text-cblue bg-cblue/10 border border-cblue/40 rounded px-1.5 py-0.5 outline-none text-right"
              value={priceDisplay}
              onChange={e => setPriceDisplay(formatMoneyLive(e.target.value))}
              onBlur={handlePriceSave}
              onKeyDown={e => {
                if (e.key === 'Enter') handlePriceSave()
                if (e.key === 'Escape') { setPriceDisplay(item.price.toLocaleString('vi-VN')); setEditingPrice(false) }
              }}
            />
          ) : (
            <button onClick={() => setEditingPrice(true)} title="Sửa giá"
              className="text-[11px] text-slate-500 hover:text-cblue font-mono transition-colors">
              {item.price.toLocaleString('vi-VN')} ₫
            </button>
          )}
          <button onClick={() => onRemove(item.productId)}
            className="text-[10px] text-slate-700 opacity-0 group-hover:opacity-100 hover:text-cred transition-all ml-1">
            xoá
          </button>
        </div>
      </div>

      {/* Qty stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onQty(item.productId, item.quantity - 1)}
          className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:border-cred hover:text-cred transition-colors text-sm font-bold flex items-center justify-center">−</button>

        {editingQty ? (
          <input
            autoFocus
            type="number"
            min="0"
            value={qtyInput}
            onChange={e => setQtyInput(e.target.value)}
            onBlur={handleQtySave}
            onKeyDown={e => {
              if (e.key === 'Enter')  handleQtySave()
              if (e.key === 'Escape') { setQtyInput(String(item.quantity)); setEditingQty(false) }
            }}
            className="w-12 text-center text-sm font-bold tabular-nums text-cblue bg-cblue/10 border border-cblue/50 rounded-lg outline-none focus:border-cblue px-1 py-0.5"
          />
        ) : (
          <span
            onClick={() => { setQtyInput(String(item.quantity)); setEditingQty(true) }}
            title="Click để nhập số lượng"
            className="w-8 text-center text-sm font-bold tabular-nums text-[#e6edf3] cursor-pointer hover:text-cblue hover:bg-cblue/10 rounded transition-colors px-1 py-0.5"
          >
            {item.quantity}
          </span>
        )}

        <button onClick={() => onQty(item.productId, item.quantity + 1)}
          className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:border-cgreen hover:text-cgreen transition-colors text-sm font-bold flex items-center justify-center">+</button>
      </div>

      {/* Subtotal */}
      <div className="text-right shrink-0 min-w-[80px]">
        <div className="text-sm font-bold text-[#e6edf3] tabular-nums font-mono">{fmtVNDFull(subtotal)}</div>
      </div>
    </div>
  )
}

// ── Order History Modal ────────────────────────────────────────────────────

function OrderHistoryModal({ onClose }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrders(30).then(setOrders).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  async function handleCancel(id) {
    if (!window.confirm('Huỷ đơn hàng này?')) return
    try {
      await cancelOrder(id)
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
      toast.success('Đã huỷ đơn')
    } catch (e) { toast.error(e.message) }
  }

  const statusMap = {
    completed: { l: 'Hoàn thành', c: 'text-cgreen' },
    pending:   { l: 'Chờ xử lý',  c: 'text-cyellow' },
    cancelled: { l: 'Đã huỷ',     c: 'text-cred' },
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="font-bold text-base">🧾 Lịch sử đơn hàng</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-muted">Đang tải…</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-muted">Chưa có đơn hàng nào</div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map(ord => {
                const st    = statusMap[ord.status] || { l: ord.status, c: 'text-muted' }
                const items = ord.order_items || []
                return (
                  <div key={ord.id} className="rounded-xl border border-border bg-surface2 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted">#{ord.id.slice(-8).toUpperCase()}</span>
                          <span className={`text-xs font-bold ${st.c}`}>{st.l}</span>
                          {ord.customers && (
                            <span className="text-xs text-cpurple">👤 {ord.customers.full_name}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">{fmtDate(ord.created_at)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-[#e6edf3] tabular-nums">{fmtVNDFull(ord.total_amount)}</div>
                        {ord.profit != null && (
                          <div className="text-[11px] text-cgreen">+{fmtVNDFull(ord.profit)} LN</div>
                        )}
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div className="border-t border-border/50 pt-2 flex flex-col gap-1">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between text-xs text-muted">
                            <span className="truncate flex-1">{item.products?.name || '—'}</span>
                            <span className="ml-3 shrink-0 font-mono">x{item.quantity} · {fmtVNDFull(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ord.note && <div className="mt-2 text-[11px] text-muted italic">📝 {ord.note}</div>}
                    {ord.status === 'completed' && (
                      <div className="mt-2 flex justify-end">
                        <button onClick={() => handleCancel(ord.id)}
                          className="text-[11px] text-muted hover:text-cred transition-colors px-2 py-1 rounded hover:bg-cred/10">
                          Huỷ đơn
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Payment Success Modal ──────────────────────────────────────────────────

// ── Print receipt (window.open + window.print) ────────────────────────────

function handlePrintReceipt(data) {
  printViaIframe(buildReceiptHtml({
    ...data,
    paidAmount: data.paidAmount,
    debtAmount: data.debtAmount,
    isImport:   false,
  }))
}

// ── Modal xác nhận in hóa đơn ─────────────────────────────────────────────

function PrintConfirmModal({ data, onPrint, onSkip }) {
  const { order, customer, items, total, paidAmount, debtAmount } = data
  return (
    <ModalOverlay onClose={onSkip} className="bg-black/80">
      <div className="bg-surface border border-cgreen/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header thành công */}
        <div className="bg-cgreen/10 px-5 py-5 text-center border-b border-cgreen/20">
          <div className="text-4xl mb-1.5">✅</div>
          <div className="font-black text-xl text-cgreen">Thanh toán thành công!</div>
          <div className="text-xs text-muted mt-1">#{order.id.slice(-8).toUpperCase()}</div>
        </div>

        {/* Tóm tắt */}
        <div className="px-5 pt-4 pb-2 flex flex-col gap-2">
          {customer && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Khách hàng</span>
              <span className="font-semibold text-cpurple">{customer.fullName}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted">Số mặt hàng</span>
            <span className="font-semibold">{items.length} loại · {items.reduce((s,i)=>s+i.quantity,0)} sp</span>
          </div>
          <div className="flex justify-between text-sm border-t border-border pt-2 mt-1">
            <span className="text-muted font-semibold">Tổng đơn hàng</span>
            <span className="font-black text-lg text-[#e6edf3] tabular-nums">{fmtVNDFull(total)}</span>
          </div>
          {paidAmount !== undefined && paidAmount < total && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Khách đã trả</span>
              <span className="font-bold text-cgreen tabular-nums">{fmtVNDFull(paidAmount)}</span>
            </div>
          )}
          {debtAmount > 0 && (
            <div className="flex justify-between text-sm rounded-lg bg-cred/10 border border-cred/25 px-3 py-2 -mx-1">
              <span className="text-cred font-bold">💳 Còn nợ lại</span>
              <span className="font-black text-cred tabular-nums">{fmtVNDFull(debtAmount)}</span>
            </div>
          )}
        </div>

        {/* Câu hỏi in */}
        <div className="px-5 pb-2 text-center text-sm text-slate-400">
          Bạn có muốn in hóa đơn không?
        </div>

        {/* Buttons */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 py-3 rounded-xl border border-border text-muted text-sm font-bold hover:bg-surface2 transition-colors"
          >
            Không
          </button>
          <button
            onClick={onPrint}
            className="flex-1 py-3 rounded-xl bg-cblue hover:brightness-110 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cblue/20"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
              <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/>
            </svg>
            In hóa đơn
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Image placeholder SVG ─────────────────────────────────────────────────

function ImgPlaceholder({ className = '' }) {
  return (
    <div className={`flex items-center justify-center bg-slate-800 ${className}`}>
      <svg className="w-8 h-8 text-slate-600" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.4"/>
        <circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── Product Card ───────────────────────────────────────────────────────────

function ProductCard({ product, inCart, onAdd }) {
  const badge = stockBadge(product.stockQuantity)
  const sold  = product.stockQuantity <= 0

  return (
    <button
      onClick={() => onAdd(product)}
      disabled={sold}
      className={`
        relative flex flex-col text-left rounded-xl border overflow-hidden
        transition-all duration-150 active:scale-[0.97] select-none
        ${sold
          ? 'border-slate-800 bg-slate-900/40 opacity-40 cursor-not-allowed'
          : inCart
          ? 'border-cblue/60 shadow-lg shadow-cblue/10 ring-1 ring-cblue/20'
          : 'border-slate-800 bg-slate-900/60 hover:border-slate-600 hover:brightness-110'
        }
      `}
    >
      {/* In-cart badge */}
      {inCart && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cblue text-white text-[10px] font-black flex items-center justify-center shadow-lg z-10">
          {inCart.quantity}
        </div>
      )}

      {/* Ảnh sản phẩm */}
      {product.imageUrl
        ? <img src={product.imageUrl} alt={product.name} className="w-full h-44 object-cover" />
        : <ImgPlaceholder className="w-full h-44" />
      }

      {/* Sold overlay */}
      {sold && (
        <div className="absolute inset-0 top-0 h-44 flex items-center justify-center bg-black/50">
          <span className="text-sm font-black text-cred bg-black/60 px-3 py-1 rounded">HẾT HÀNG</span>
        </div>
      )}

      {/* Thông tin */}
      <div className="flex flex-col p-3 flex-1">
        <div className="text-sm font-bold text-[#e6edf3] line-clamp-2 leading-snug flex-1 mb-2">
          {product.name}
        </div>
        <div className="text-[11px] text-slate-500 font-mono mb-2 truncate">{product.sku}</div>
        <div className="flex items-end justify-between gap-1">
          <div className="text-base font-black text-cblue tabular-nums leading-none">
            {fmtVNDFull(product.sellPrice)}
          </div>
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
      </div>
    </button>
  )
}

// ── Main POS ───────────────────────────────────────────────────────────────

export default function PointOfSale() {
  const [products,  setProducts]  = useState([])
  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)

  const [search,       setSearch]       = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchWrapRef                   = useRef(null)
  const debouncedSearch                 = useDebounce(search, 250)

  const [cart,          setCart]          = useState([])
  const [customer,      setCustomer]      = useState(null)
  const [note,          setNote]          = useState('')
  const [discountValue, setDiscountValue] = useState('')
  const [discountType,  setDiscountType]  = useState('amount') // 'amount' | 'percent'
  const [paidInput,     setPaidInput]     = useState('')       // '' = thanh toán đủ

  const [paying,         setPaying]         = useState(false)
  const [successData,    setSuccessData]    = useState(null)
  const [showHistory,    setShowHistory]    = useState(false)
  const [showRedeem,     setShowRedeem]     = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [showOcr,        setShowOcr]        = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([loadProducts(), loadCustomers()])
      setProducts(p)
      setCustomers(c)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime: patch từng record thay vì reload toàn bộ list (nhanh hơn, không bị lag)
  useEffect(() => {
    const unsubP = subscribeProducts((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload
      setProducts(prev => {
        if (eventType === 'INSERT') return [{ ...productToCamel(newRow) }, ...prev]
        if (eventType === 'DELETE') return prev.filter(p => p.id !== oldRow.id)
        if (eventType === 'UPDATE') return prev.map(p => p.id === newRow.id ? productToCamel(newRow) : p)
        return prev
      })
    })
    const unsubC = subscribeCustomers((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload
      setCustomers(prev => {
        if (eventType === 'INSERT') return [customerToCamel(newRow), ...prev]
        if (eventType === 'DELETE') return prev.filter(c => c.id !== oldRow.id)
        if (eventType === 'UPDATE') {
          const updated = customerToCamel(newRow)
          // Cập nhật luôn customer đang chọn nếu trùng id
          setCustomer(cur => cur?.id === updated.id ? { ...cur, ...updated } : cur)
          return prev.map(c => c.id === updated.id ? updated : c)
        }
        return prev
      })
    })
    return () => { unsubP(); unsubC() }
  }, [])

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleMouseDown(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Autocomplete từ debouncedSearch
  const dropdownResults = useMemo(() => {
    const safeList  = Array.isArray(products) ? products : []
    const safeQuery = removeVietnameseTones(debouncedSearch || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return []
    return safeList.filter(p => {
      const name = removeVietnameseTones(p?.name)
      const sku  = removeVietnameseTones(p?.sku)
      return words.every(w => name.includes(w) || sku.includes(w))
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
    }).slice(0, 8)
  }, [products, debouncedSearch])

  useEffect(() => {
    setDropdownOpen(dropdownResults.length > 0 && search.trim().length > 0)
  }, [dropdownResults, search])

  // ── Cart logic ──────────────────────────────────────────────────────────

  const addToCart = useCallback((product) => {
    if (product.stockQuantity <= 0) { toast.error('Sản phẩm đã hết hàng'); return }
    setCart(prev => {
      const exists = prev.find(i => i.productId === product.id)
      if (exists) {
        if (exists.quantity >= product.stockQuantity) {
          toast.error(`Chỉ còn ${product.stockQuantity} sp trong kho`)
          return prev
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        productId: product.id,
        name:      product.name,
        sku:       product.sku,
        price:     product.sellPrice,
        cost:      product.importPrice,
        imageUrl:  product.imageUrl ?? null,
        quantity:  1,
      }]
    })
  }, [])

  const setQty = useCallback((productId, qty) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.productId !== productId)); return }
    const product = products.find(p => p.id === productId)
    if (product && qty > product.stockQuantity) { toast.error(`Chỉ còn ${product.stockQuantity} sp`); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }, [products])

  const removeFromCart = useCallback((productId) => {
    setCart(prev => prev.filter(i => i.productId !== productId))
  }, [])

  const editPrice = useCallback((productId, newPrice) => {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, price: newPrice } : i))
  }, [])

  const clearCart = useCallback(() => {
    setCart([]); setCustomer(null); setNote('')
    setDiscountValue(''); setDiscountType('amount'); setPaidInput('')
  }, [])

  // OCR: thêm các items từ modal vào giỏ
  const handleOcrAddItems = useCallback((rows) => {
    rows.forEach(({ product, qty, price }) => {
      if (!product) return
      setCart(prev => {
        const exists = prev.find(i => i.productId === product.id)
        if (exists) {
          return prev.map(i => i.productId === product.id
            ? { ...i, quantity: i.quantity + qty, price }
            : i)
        }
        return [...prev, {
          productId: product.id,
          name:      product.name,
          sku:       product.sku,
          price,
          cost:      product.importPrice,
          imageUrl:  product.imageUrl ?? null,
          quantity:  qty,
        }]
      })
    })
  }, [])

  // ── Summary ─────────────────────────────────────────────────────────────

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const discountNum = parseFloat(String(discountValue).replace(/[^0-9.]/g, '')) || 0
  const actualDiscount = discountType === 'percent'
    ? Math.round(subtotal * Math.min(discountNum, 100) / 100)
    : Math.min(discountNum, subtotal)

  const total  = Math.max(0, subtotal - actualDiscount)
  const profit = cart.reduce((s, i) => s + (i.price - i.cost) * i.quantity, 0) - actualDiscount
  const margin = subtotal > 0 ? ((profit / subtotal) * 100).toFixed(1) : 0

  // ── Khách thanh toán & công nợ ───────────────────────────────────────────
  const customerPaid = (() => {
    if (!paidInput.trim()) return total
    const n = parseVNDInput(paidInput)
    return Math.max(0, n)
  })()
  const debtAmount   = Math.max(0, total - customerPaid)
  const changeAmount = Math.max(0, customerPaid - total)

  // ── Kiểm tra hạn mức công nợ ────────────────────────────────────────────
  const creditBlocked = (() => {
    if (!customer) return false
    const limit = customer.creditLimit ?? 0
    if (limit <= 0) return false
    // Chỉ tính phần nợ mới thêm vào, không tính phần thanh toán ngay
    return (customer.currentDebt ?? 0) + debtAmount > limit
  })()

  // ── Filtered products ────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    const safeList  = Array.isArray(products) ? products : []
    const safeQuery = removeVietnameseTones(search || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return safeList
    return safeList.filter(p => {
      const name = removeVietnameseTones(p?.name)
      const sku  = removeVietnameseTones(p?.sku)
      return words.every(w => name.includes(w) || sku.includes(w))
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
  }, [products, search])

  // ── Checkout ─────────────────────────────────────────────────────────────

  async function handlePay() {
    if (cart.length === 0) { toast.error('Giỏ hàng trống'); return }
    setPaying(true)
    try {
      const order = await createOrder({
        customerId:  customer?.id || null,
        items:       cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price, cost: i.cost })),
        note,
        discount:    actualDiscount,
        paidAmount:  customerPaid,
      })
      // Tồn kho được Realtime tự patch qua subscribeProducts — không cần update local thủ công.
      // Vẫn patch optimistic để UI phản hồi ngay (trước khi Realtime event đến)
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(i => i.productId === p.id)
        return cartItem ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - cartItem.quantity) } : p
      }))

      // Tích điểm + cập nhật tier nếu có khách
      let loyaltyResult = null
      if (customer?.id) {
        loyaltyResult = await finalizeCustomerAfterOrder({
          customerId: customer.id,
          orderId:    order.id,
          orderTotal: total,
        })
        // Cập nhật local — Realtime customer event cũng sẽ arrive và sync
        const debtAmount = order.debt_amount ?? 0
        setCustomers(prev => prev.map(c =>
          c.id === customer.id ? {
            ...c,
            totalSpent:   loyaltyResult.newSpent,
            vipTier:      loyaltyResult.newTier,
            rewardPoints: loyaltyResult.newPoints,
            currentDebt:  (c.currentDebt ?? 0) + debtAmount,
          } : c
        ))
        setCustomer(prev => prev ? {
          ...prev,
          totalSpent:   loyaltyResult.newSpent,
          vipTier:      loyaltyResult.newTier,
          rewardPoints: loyaltyResult.newPoints,
          currentDebt:  (prev.currentDebt ?? 0) + debtAmount,
        } : prev)
      }
      setSuccessData({ order, items: [...cart], total, profit, customer, discount: actualDiscount, note, pointsEarned: loyaltyResult?.earned ?? 0, paidAmount: customerPaid, debtAmount })
    } catch (e) {
      toast.error(e.message || 'Lỗi thanh toán')
    } finally {
      setPaying(false)
    }
  }

  async function handleRedeem(points, description) {
    if (!customer?.id) return
    const newPoints = await redeemPoints({ customerId: customer.id, points, description })
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, rewardPoints: newPoints } : c))
    setCustomer(prev => prev ? { ...prev, rewardPoints: newPoints } : prev)
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col md:flex-row md:h-[calc(100vh-148px)] md:overflow-hidden bg-[#080b10]">

      {/* ══════════════════════════════════════════════════════════════
          CỘT TRÁI — Danh mục sản phẩm
      ══════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">

        {/* ── Thanh tìm kiếm (cố định top) ────────────── */}
        <div className="shrink-0 px-5 pt-4 pb-4 bg-[#0d1117] border-b border-slate-800/80">
          <div className="flex items-center gap-3">

            {/* Search với autocomplete */}
            <div ref={searchWrapRef} className="relative flex-1">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <input
                autoFocus
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#e6edf3] placeholder:text-slate-600 outline-none focus:border-cblue/60 focus:bg-slate-800/50 transition-all"
                placeholder="Tìm theo tên hoặc SKU → click để thêm vào giỏ…"
                value={search}
                onChange={e => { setSearch(e.target.value); setDropdownOpen(true) }}
                onFocus={() => dropdownResults.length > 0 && setDropdownOpen(true)}
              />

              {/* Autocomplete dropdown */}
              {dropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0d1117] border border-slate-700 rounded-xl shadow-2xl z-40 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-800 text-[10px] text-slate-600 font-semibold uppercase tracking-wide">
                    {dropdownResults.length} kết quả — click để thêm vào giỏ
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {dropdownResults.map(p => {
                      const badge  = stockBadge(p.stockQuantity)
                      const inCart = cart.find(i => i.productId === p.id)
                      return (
                        <button
                          key={p.id}
                          onMouseDown={e => {
                            e.preventDefault()
                            addToCart(p)
                            setSearch('')
                            setDropdownOpen(false)
                          }}
                          disabled={p.stockQuantity <= 0}
                          className={`w-full px-3 py-1.5 text-left flex items-center gap-2 transition-colors
                            ${p.stockQuantity <= 0
                              ? 'opacity-40 cursor-not-allowed'
                              : 'hover:bg-cblue/8 cursor-pointer'
                            }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[#e6edf3] truncate">{p.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold text-cblue tabular-nums">{fmtVNDFull(p.sellPrice)}</div>
                            <span className={`text-[9px] font-bold border rounded px-1 py-0.5 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          {inCart && (
                            <div className="w-4 h-4 rounded-full bg-cblue text-white text-[9px] font-black flex items-center justify-center shrink-0">
                              {inCart.quantity}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Nút quét hóa đơn AI */}
            <button
              onClick={() => setShowOcr(true)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-cpurple/40 bg-cpurple/10 text-cpurple text-sm hover:border-cpurple/70 hover:bg-cpurple/15 transition-colors whitespace-nowrap font-semibold"
              title="OCR Hóa Đơn AI"
            >
              🤖 <span className="hidden sm:inline">Quét HĐ</span>
            </button>

            {/* Nút lịch sử */}
            <button
              onClick={() => setShowHistory(true)}
              className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-slate-400 text-sm hover:border-slate-600 hover:text-[#e6edf3] transition-colors whitespace-nowrap"
            >
              🧾 <span className="hidden sm:inline font-medium">Lịch sử</span>
            </button>
          </div>

          {/* Đếm sản phẩm + filter hint */}
          <div className="flex items-center justify-between mt-2.5 px-0.5">
            <span className="text-[11px] text-slate-600">
              {search
                ? <><strong className="text-slate-400">{filteredProducts.length}</strong> / {products.length} sản phẩm</>
                : <><strong className="text-slate-400">{products.length}</strong> sản phẩm</>
              }
            </span>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-[11px] text-slate-500 hover:text-cred transition-colors"
              >
                ✕ Xoá bộ lọc
              </button>
            )}
          </div>
        </div>

        {/* ── Lưới sản phẩm (chỉ khu vực này cuộn) ────── */}
        <div className="overflow-y-auto px-5 py-4 max-h-[50vh] md:max-h-none md:flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-600">
              <svg className="w-8 h-8 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
              </svg>
              <span className="text-sm">Đang tải dữ liệu từ Cloud…</span>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
              <div className="text-4xl">📦</div>
              <div className="font-semibold text-slate-500">
                {search ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm — Thêm tại tab Hàng Hóa'}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3.5">
              {filteredProducts.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  inCart={cart.find(i => i.productId === p.id)}
                  onAdd={addToCart}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CỘT PHẢI — Giỏ hàng & Thanh toán
      ══════════════════════════════════════════════════════════════ */}
      <div className="w-full md:w-[40%] shrink-0 flex flex-col bg-slate-900/80 border-t md:border-t-0 md:border-l border-slate-800">

        {/* ── Header: Chọn khách hàng ──────────────────── */}
        <div className="shrink-0 px-4 pt-3 pb-3 border-b border-slate-800/80 bg-slate-900">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-slate-300 font-bold uppercase tracking-widest">Khách hàng</span>
            {customer && (
              <div className="flex items-center gap-2">
                <VipBadge tier={customer.vipTier || 'MEMBER'} />
                <span className="text-[11px] text-cyellow font-bold">
                  ★ {(customer.rewardPoints ?? 0).toLocaleString('vi-VN')} điểm
                </span>
              </div>
            )}
          </div>
          <CustomerSelector customers={customers} selected={customer} onSelect={setCustomer} />
          {/* Nút đổi quà */}
          {customer && (customer.rewardPoints ?? 0) > 0 && (
            <button
              onClick={() => setShowRedeem(true)}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-cyellow/30 bg-cyellow/8 text-cyellow text-[11px] font-bold hover:bg-cyellow/15 transition-colors"
            >
              🎁 Đổi điểm lấy quà ({(customer.rewardPoints ?? 0).toLocaleString('vi-VN')} điểm)
            </button>
          )}
        </div>

        {/* ── Danh sách giỏ hàng (chỉ khu vực này cuộn) ─ */}
        <div className="overflow-y-auto px-5 max-h-52 md:max-h-none md:flex-1">
          <div className="flex items-center justify-between py-3 sticky top-0 bg-slate-900/95 backdrop-blur-sm z-10 -mx-5 px-5 border-b border-slate-800/50 mb-1">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">
              Giỏ hàng
              {cart.length > 0 && (
                <span className="ml-2 bg-cblue/20 text-cblue text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {cartCount} sp
                </span>
              )}
            </span>
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-[11px] text-slate-600 hover:text-cred transition-colors"
              >
                Xoá tất cả
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-700 select-none">
              <div className="text-4xl">🛒</div>
              <div className="text-sm font-medium text-slate-600">Chọn sản phẩm bên trái</div>
              <div className="text-xs text-slate-700">để thêm vào giỏ hàng</div>
            </div>
          ) : (
            <div className="pb-2">
              {cart.map(item => (
                <CartItem
                  key={item.productId}
                  item={item}
                  onQty={setQty}
                  onRemove={removeFromCart}
                  onPriceEdit={editPrice}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer: Tổng tiền & Thanh toán (luôn visible) ── */}
        <div className="shrink-0 border-t border-slate-800 bg-slate-900 px-5 pt-4 pb-5 flex flex-col gap-3">

          {/* Ghi chú */}
          <input
            className="w-full bg-slate-800/60 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-400 placeholder:text-slate-700 outline-none focus:border-slate-600 focus:text-[#e6edf3] transition-all"
            placeholder="Ghi chú đơn hàng…"
            value={note}
            onChange={e => setNote(e.target.value)}
          />

          {/* Tạm tính */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500">Tạm tính</span>
            <span className="font-mono tabular-nums text-slate-300">{fmtVNDFull(subtotal)}</span>
          </div>

          {/* Giảm giá — input + toggle ₫/% */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500 shrink-0">Giảm giá</span>
            <input
              type="number"
              min="0"
              max={discountType === 'percent' ? 100 : undefined}
              step={discountType === 'percent' ? 0.1 : 1000}
              className="flex-1 min-w-0 bg-slate-800/60 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-right font-mono text-cyellow placeholder:text-slate-700 outline-none focus:border-cyellow/40 transition-all"
              placeholder="0"
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
            />
            {/* Segmented control ₫ / % */}
            <div className="flex shrink-0 rounded-lg overflow-hidden border border-slate-700">
              <button
                type="button"
                onClick={() => { setDiscountType('amount'); setDiscountValue('') }}
                className={`px-3 py-1.5 text-sm font-bold transition-colors ${
                  discountType === 'amount'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >₫</button>
              <button
                type="button"
                onClick={() => { setDiscountType('percent'); setDiscountValue('') }}
                className={`px-3 py-1.5 text-sm font-bold border-l border-slate-700 transition-colors ${
                  discountType === 'percent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >%</button>
            </div>
          </div>

          {/* Tiền giảm thực tế (chỉ hiện khi dùng %) */}
          {actualDiscount > 0 && discountType === 'percent' && (
            <div className="flex justify-between items-center text-xs -mt-1">
              <span className="text-slate-600">Tiền giảm thực tế</span>
              <span className="font-mono text-cyellow tabular-nums">-{fmtVNDFull(actualDiscount)}</span>
            </div>
          )}

          {/* Lợi nhuận preview */}
          {cart.length > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">LN ước tính</span>
              <span className={`font-bold tabular-nums font-mono ${profit >= 0 ? 'text-cgreen' : 'text-cred'}`}>
                {fmtVNDFull(profit)}
                <span className="text-[10px] ml-1 opacity-60">({margin}%)</span>
              </span>
            </div>
          )}

          {/* Điểm sẽ được tích */}
          {customer && cart.length > 0 && calcPointsEarned(total) > 0 && (
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-600">Điểm tích lũy</span>
              <span className="text-cyellow font-bold">+{calcPointsEarned(total)} điểm ★</span>
            </div>
          )}

          {/* Divider + Tổng */}
          <div className="flex justify-between items-baseline pt-1 border-t border-slate-800">
            <span className="text-sm font-bold text-slate-300">Tổng cộng</span>
            <span className="text-2xl font-black text-white tabular-nums font-mono">{fmtVNDFull(total)}</span>
          </div>

          {/* Khách thanh toán */}
          {cart.length > 0 && (
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 shrink-0 w-[92px]">Khách TT</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={total.toLocaleString('vi-VN')}
                  value={paidInput}
                  onChange={e => setPaidInput(formatMoneyLive(e.target.value))}
                  onFocus={e => {
                    if (!paidInput) setPaidInput(total.toLocaleString('vi-VN'))
                    e.target.select()
                  }}
                  onBlur={() => {
                    if (!paidInput || parseVNDInput(paidInput) >= total) setPaidInput('')
                  }}
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-right font-mono font-bold text-[#e6edf3] placeholder:text-slate-600 outline-none focus:border-cblue focus:ring-1 focus:ring-cblue/20 transition-all"
                />
              </div>

              {debtAmount > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-cred/10 border border-cred/25 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-cred">💳 Còn nợ lại</span>
                    {customer && (
                      <span className="text-[10px] text-cred/70">→ ghi vào công nợ {customer.fullName}</span>
                    )}
                  </div>
                  <span className="font-mono font-black text-sm text-cred tabular-nums">{fmtVNDFull(debtAmount)}</span>
                </div>
              )}

              {changeAmount > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-cgreen/10 border border-cgreen/25 px-3 py-2">
                  <span className="text-xs font-bold text-cgreen">💵 Tiền thừa trả lại</span>
                  <span className="font-mono font-black text-sm text-cgreen tabular-nums">{fmtVNDFull(changeAmount)}</span>
                </div>
              )}
            </div>
          )}

          {/* Cảnh báo vượt hạn mức */}
          {creditBlocked && (
            <div className="flex items-start gap-2 rounded-lg bg-cred/10 border border-cred/30 px-3 py-2.5 text-xs text-cred">
              <span className="text-base leading-none shrink-0">⚠️</span>
              <div>
                <div className="font-bold">Vượt hạn mức công nợ!</div>
                <div className="text-[11px] text-red-400 mt-0.5">
                  Nợ hiện tại: {fmtVNDFull(customer.currentDebt ?? 0)} · Hạn mức: {fmtVNDFull(customer.creditLimit)}
                </div>
              </div>
            </div>
          )}

          {/* Nút Thanh toán */}
          <button
            onClick={() => setShowPayConfirm(true)}
            disabled={cart.length === 0 || paying || creditBlocked}
            className={`
              w-full h-14 rounded-xl font-black text-base tracking-wide transition-all duration-100 touch-manipulation
              ${cart.length === 0 || paying || creditBlocked
                ? 'bg-slate-800 border border-slate-700 text-slate-600 cursor-not-allowed'
                : 'bg-cgreen hover:brightness-110 text-white shadow-xl shadow-cgreen/20 active:scale-[0.97]'
              }
            `}
          >
            {paying
              ? <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
                  </svg>
                  Đang xử lý…
                </span>
              : creditBlocked
              ? '🚫 Vượt hạn mức công nợ'
              : cart.length === 0
              ? '🛒 Giỏ hàng trống'
              : `💳 Thanh toán ${fmtVNDFull(total)}`
            }
          </button>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────── */}

      {/* OCR Hóa đơn AI */}
      {showOcr && (
        <OcrInvoiceModal
          type="SALE"
          products={products}
          onAddItems={handleOcrAddItems}
          onClose={() => setShowOcr(false)}
        />
      )}

      {/* Xác nhận thanh toán */}
      {showPayConfirm && (
        <ModalOverlay onClose={() => setShowPayConfirm(false)}>
          <div className="bg-[#0d1117] border border-slate-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="text-3xl mb-3">🛒</div>
              <div className="text-base font-black text-[#e6edf3]">Xác nhận đơn hàng</div>
              <div className="text-xs text-slate-400 mt-1.5">
                Bạn có chắc muốn thực hiện đơn hàng này không?
              </div>
            </div>

            {/* Tóm tắt đơn */}
            <div className="mx-5 mb-4 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Số mặt hàng</span>
                <span className="font-semibold text-[#e6edf3]">
                  {cart.length} loại · {cart.reduce((s,i)=>s+i.quantity,0)} sp
                </span>
              </div>
              {customer && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Khách hàng</span>
                  <span className="font-semibold text-cpurple">{customer.fullName}</span>
                </div>
              )}
              {actualDiscount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Giảm giá</span>
                  <span className="font-semibold text-cyellow">− {fmtVNDFull(actualDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1.5 border-t border-slate-700 mt-0.5">
                <span className="font-bold text-slate-300">Tổng cộng</span>
                <span className="font-black text-lg text-cgreen tabular-nums">{fmtVNDFull(total)}</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowPayConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800 transition-colors"
              >
                ✗ Không
              </button>
              <button
                onClick={() => { setShowPayConfirm(false); handlePay() }}
                disabled={paying}
                className="flex-1 py-3 rounded-xl bg-cgreen hover:brightness-110 text-white text-sm font-black transition-all disabled:opacity-60 shadow-lg shadow-cgreen/20"
              >
                {paying
                  ? <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
                      </svg>
                      Đang xử lý…
                    </span>
                  : '✓ Có, xác nhận'
                }
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {showRedeem && customer && (
        <RedeemModal
          customer={customer}
          onRedeem={handleRedeem}
          onClose={() => setShowRedeem(false)}
        />
      )}
      {showHistory && <OrderHistoryModal onClose={() => setShowHistory(false)} />}
      {successData && (
        <PrintConfirmModal
          data={successData}
          onSkip={() => { clearCart(); setSuccessData(null) }}
          onPrint={() => {
            handlePrintReceipt(successData)
            clearCart()
            setSuccessData(null)
          }}
        />
      )}
    </div>
  )
}
