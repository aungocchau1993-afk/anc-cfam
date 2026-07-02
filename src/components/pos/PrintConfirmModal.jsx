import { useState } from 'react'
import { CheckCircle2, Printer, FileText, X } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'
import { getShopConfig } from '../../lib/printReceipt'
import ModalOverlay from '../ui/ModalOverlay'

export default function PrintConfirmModal({ data, onPrint, onSkip }) {
  const { order, customer, items, total, paidAmount, debtAmount } = data
  const shop = getShopConfig()
  const [mode, setMode] = useState(shop.printMode ?? 'thermal')

  const surplus = paidAmount > total ? paidAmount - total : 0

  return (
    <ModalOverlay onClose={onSkip} className="bg-black/80">
      <div className="bg-white border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header thành công */}
        <div className="bg-emerald-50 px-5 py-5 text-center border-b border-emerald-100">
          <CheckCircle2 size={34} strokeWidth={1.8} className="text-cgreen mx-auto mb-1.5" />
          <div className="font-black text-lg text-cgreen">Thanh toán thành công!</div>
          <div className="text-xs text-slate-500 mt-0.5 font-mono">
            #{(order?.order_code || order?.id?.slice(-8) || '').toUpperCase()}
          </div>
        </div>

        {/* Tóm tắt đơn */}
        <div className="px-5 pt-3 pb-2 flex flex-col gap-2">
          {customer && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Khách hàng</span>
              <span className="font-semibold text-violet-600">{customer.fullName}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Số mặt hàng</span>
            <span className="font-semibold">{items.length} loại · {items.reduce((s,i)=>s+i.quantity,0)} sp</span>
          </div>
          <div className="flex justify-between text-sm border-t border-slate-800 pt-2 mt-1">
            <span className="text-slate-500 font-semibold">Tổng cộng</span>
            <span className="font-black text-lg text-[#111827] tabular-nums">{fmtVNDFull(total)}</span>
          </div>
          {paidAmount !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Khách trả</span>
              <span className="font-bold text-cgreen tabular-nums">{fmtVNDFull(paidAmount)}</span>
            </div>
          )}
          {debtAmount > 0 && (
            <div className="flex justify-between text-sm rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 -mx-1">
              <span className="text-rose-700 font-bold">💳 Còn nợ</span>
              <span className="font-black text-rose-700 tabular-nums">{fmtVNDFull(debtAmount)}</span>
            </div>
          )}
          {surplus > 0 && (
            <div className="flex justify-between text-sm rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 -mx-1">
              <span className="text-cgreen font-bold">↩ Trả lại</span>
              <span className="font-black text-cgreen tabular-nums">{fmtVNDFull(surplus)}</span>
            </div>
          )}
        </div>

        {/* Toggle khổ giấy */}
        <div className="px-5 py-3 border-t border-slate-800">
          <div className="text-xs text-slate-500 mb-2 font-semibold uppercase tracking-wider">Khổ giấy</div>
          <div className="flex rounded-lg overflow-hidden border border-slate-800">
            <button
              onClick={() => setMode('thermal')}
              className={`flex-1 py-2 text-sm font-bold transition-colors flex items-center justify-center gap-1.5
                ${mode === 'thermal' ? 'bg-cblue text-white' : 'bg-surface2 text-slate-500 hover:text-[#111827]'}`}
            >
              <Printer size={14} strokeWidth={2.2} /> <span>Nhiệt 80mm</span>
            </button>
            <button
              onClick={() => setMode('a4')}
              className={`flex-1 py-2 text-sm font-bold transition-colors flex items-center justify-center gap-1.5
                ${mode === 'a4' ? 'bg-cblue text-white' : 'bg-surface2 text-slate-500 hover:text-[#111827]'}`}
            >
              <FileText size={14} strokeWidth={2.2} /> <span>A5 PDF</span>
            </button>
          </div>
          {mode === 'thermal' && (
            <div className="text-[10.5px] text-slate-400 mt-1.5 text-center">
              Máy in nhiệt 80mm · tự cuộn giấy · không cần chọn khổ
            </div>
          )}
          {mode === 'a4' && (
            <div className="text-[10.5px] text-slate-400 mt-1.5 text-center">
              In trên giấy A5 / A4 hoặc lưu PDF
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onSkip}
            className="flex-1 py-3 rounded-xl border border-slate-800 text-slate-500 text-sm font-bold hover:bg-surface2 transition-colors active:scale-95 touch-manipulation flex items-center justify-center gap-1.5"
          >
            <X size={15} strokeWidth={2.4} /> Hủy
          </button>
          <button
            onClick={() => onPrint(mode)}
            className="flex-1 py-3 rounded-xl bg-cblue hover:brightness-105 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-cblue/20 active:scale-95 touch-manipulation"
          >
            <Printer size={16} strokeWidth={2.1} />
            In hóa đơn
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
