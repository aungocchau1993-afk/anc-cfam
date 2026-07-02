import { AnimatePresence, motion } from 'framer-motion'
import { Zap, ClipboardList } from 'lucide-react'
import SaleModePanel from './SaleModePanel'
import OrderModePanel from './OrderModePanel'
import CheckoutPanel from './CheckoutPanel'

// Cột phải (Bill) — luôn sticky/full-height, độ rộng do AppPOSLayout quyết định
// theo View Mode. Chứa: Mode toggle (Bán nhanh / Đơn đặt hàng) + nội dung tương
// ứng + khối Thanh toán dùng chung.
export default function AppBillPanel({
  mode, onModeChange,
  orderDetails, onOrderDetailsChange,
  customers, customer, onSelectCustomer, onAddCustomer, onOpenRedeem,
  cart, cartCount, onQty, onRemove, onPriceEdit, onClearCart,
  checkoutProps,
}) {
  return (
    <div className="w-full flex-1 min-h-0 min-w-0 flex flex-col bg-white rounded-2xl border border-slate-800 shadow-sm md:overflow-hidden transition-all duration-200">

      {/* ── Mode toggle ─────────────────────────────────────────── */}
      <div className={`shrink-0 flex items-center border-b transition-colors duration-200 ${mode === 'order' ? 'border-amber-200 bg-amber-50/60' : 'border-slate-800'}`}>
        <button
          onClick={() => onModeChange('sale')}
          className={`flex-1 flex items-center justify-center gap-1.5 h-11 text-[13px] font-bold transition-colors ${
            mode === 'sale' ? 'text-cblue border-b-2 border-cblue' : 'text-slate-400 border-b-2 border-transparent hover:text-slate-600'
          }`}
        >
          <Zap size={14} strokeWidth={2.4} /> Bán hàng nhanh
        </button>
        <button
          onClick={() => onModeChange('order')}
          className={`flex-1 flex items-center justify-center gap-1.5 h-11 text-[13px] font-bold transition-colors ${
            mode === 'order' ? 'text-amber-700 border-b-2 border-amber-500' : 'text-slate-400 border-b-2 border-transparent hover:text-slate-600'
          }`}
        >
          <ClipboardList size={14} strokeWidth={2.4} /> Đơn đặt hàng
        </button>
      </div>

      {mode === 'order' && (
        <div className="shrink-0 flex items-center justify-center gap-1.5 py-1 bg-amber-500 text-white text-[11px] font-black tracking-wider uppercase">
          <ClipboardList size={11} strokeWidth={2.6} /> Order Mode
        </div>
      )}

      {/* Vùng giữa (Khách hàng + Giỏ hàng + form Đơn đặt hàng) tự cuộn — Thanh toán
          luôn ghim ở đáy, không bao giờ bị đẩy khuất khi Order Mode mở rộng form. */}
      <div className="flex-1 flex flex-col min-h-0 md:overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col md:overflow-y-auto">
          <SaleModePanel
            customers={customers}
            customer={customer}
            onSelectCustomer={onSelectCustomer}
            onAddCustomer={onAddCustomer}
            onOpenRedeem={onOpenRedeem}
            cart={cart}
            cartCount={cartCount}
            onQty={onQty}
            onRemove={onRemove}
            onPriceEdit={onPriceEdit}
            onClearCart={onClearCart}
          />

          <AnimatePresence initial={false}>
            {mode === 'order' && (
              <OrderModePanel details={orderDetails} onChange={onOrderDetailsChange} customer={customer} />
            )}
          </AnimatePresence>
        </div>

        <CheckoutPanel {...checkoutProps} mode={mode} />
      </div>
    </div>
  )
}
