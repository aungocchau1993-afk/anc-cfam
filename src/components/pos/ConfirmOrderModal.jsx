import { ShoppingCart, LoaderCircle, Check, X } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'
import ModalOverlay from '../ui/ModalOverlay'

export default function ConfirmOrderModal({ cart, customer, actualDiscount, total, paying, onClose, onConfirm }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white border border-slate-800 rounded-2xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-cblue/10 text-cblue flex items-center justify-center mx-auto mb-3">
            <ShoppingCart size={22} strokeWidth={2} />
          </div>
          <div className="text-base font-bold text-[#1e293b]">Xác nhận đơn hàng</div>
          <div className="text-xs text-slate-500 mt-1.5">Bạn có chắc muốn thực hiện đơn hàng này không?</div>
        </div>

        <div className="mx-5 mb-4 rounded-xl bg-surface2 border border-slate-800 px-4 py-3 flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Số mặt hàng</span>
            <span className="font-semibold text-[#1e293b]">{cart.length} loại · {cart.reduce((s,i)=>s+i.quantity,0)} sp</span>
          </div>
          {customer && (
            <div className="flex justify-between">
              <span className="text-slate-500">Khách hàng</span>
              <span className="font-semibold text-violet-600">{customer.fullName}</span>
            </div>
          )}
          {actualDiscount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Giảm giá</span>
              <span className="font-semibold text-amber-600">− {fmtVNDFull(actualDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t border-slate-800 mt-0.5">
            <span className="font-bold text-slate-600">Tổng cộng</span>
            <span className="font-black text-lg text-cgreen tabular-nums">{fmtVNDFull(total)}</span>
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-800 text-slate-600 text-sm font-bold hover:bg-surface2 transition-colors flex items-center justify-center gap-1.5">
            <X size={15} strokeWidth={2.4} /> Không
          </button>
          <button onClick={onConfirm} disabled={paying}
            className="flex-1 py-3 rounded-xl bg-cgreen hover:brightness-105 text-white text-sm font-bold transition-all disabled:opacity-60 shadow-md shadow-cgreen/20 flex items-center justify-center gap-1.5">
            {paying
              ? <><LoaderCircle size={16} strokeWidth={2.2} className="animate-spin" /> Đang xử lý…</>
              : <><Check size={16} strokeWidth={2.6} /> Có, xác nhận</>
            }
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
