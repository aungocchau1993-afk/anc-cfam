import { LoaderCircle, CreditCard, ClipboardList, AlertTriangle, Save, Star, Ban, Wallet, Banknote } from 'lucide-react'
import { formatMoneyLive, fmtVNDFull } from '../../lib/formatters'

export default function CheckoutPanel({
  cart, note, onNoteChange,
  subtotal, discountValue, onDiscountValueChange, discountType, onDiscountTypeChange, actualDiscount,
  profit, margin, customer, pointsEarned,
  total,
  paidInput, onPaidInputChange, totalStr,
  debtAmount, changeAmount,
  creditBlocked,
  paying, onHold, onPay,
  mode = 'sale',
}) {
  return (
    <div className="shrink-0 border-t border-slate-800 bg-white px-5 pt-4 pb-5 flex flex-col gap-3">

      <input
        className="w-full bg-surface2 border border-slate-800 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-600 placeholder:text-slate-400 outline-none focus:border-slate-600 focus:text-[#111827] transition-all"
        placeholder="Ghi chú đơn hàng…"
        value={note}
        onChange={e => onNoteChange(e.target.value)}
      />

      <div className="flex justify-between items-center text-sm">
        <span className="text-slate-500">Tạm tính</span>
        <span className="font-mono tabular-nums text-slate-700">{fmtVNDFull(subtotal)}</span>
      </div>

      {/* Giảm giá */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 shrink-0">Giảm giá</span>
        <input
          type="number" min="0"
          max={discountType === 'percent' ? 100 : undefined}
          step={discountType === 'percent' ? 0.1 : 1000}
          className="flex-1 min-w-0 bg-surface2 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-right font-mono text-amber-700 placeholder:text-slate-400 outline-none focus:border-amber-300 transition-all"
          placeholder="0"
          value={discountValue}
          onChange={e => onDiscountValueChange(e.target.value)}
        />
        <div className="flex shrink-0 rounded-lg overflow-hidden border border-slate-800">
          <button type="button" onClick={() => onDiscountTypeChange('amount')}
            className={`px-3 py-1.5 text-sm font-bold transition-colors ${discountType === 'amount' ? 'bg-cblue text-white' : 'bg-surface2 text-slate-500 hover:bg-slate-800/60'}`}>₫</button>
          <button type="button" onClick={() => onDiscountTypeChange('percent')}
            className={`px-3 py-1.5 text-sm font-bold border-l border-slate-800 transition-colors ${discountType === 'percent' ? 'bg-cblue text-white' : 'bg-surface2 text-slate-500 hover:bg-slate-800/60'}`}>%</button>
        </div>
      </div>

      {actualDiscount > 0 && discountType === 'percent' && (
        <div className="flex justify-between items-center text-xs -mt-1">
          <span className="text-slate-400">Tiền giảm thực tế</span>
          <span className="font-mono text-amber-700 tabular-nums">-{fmtVNDFull(actualDiscount)}</span>
        </div>
      )}

      {cart.length > 0 && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">LN ước tính</span>
          <span className={`font-bold tabular-nums font-mono ${profit >= 0 ? 'text-cgreen' : 'text-rose-500'}`}>
            {fmtVNDFull(profit)}<span className="text-[12px] ml-1 opacity-60">({margin}%)</span>
          </span>
        </div>
      )}

      {customer && cart.length > 0 && pointsEarned > 0 && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Điểm tích lũy</span>
          <span className="text-amber-700 font-bold flex items-center gap-0.5">+{pointsEarned} <Star size={11} strokeWidth={2.4} fill="currentColor" /></span>
        </div>
      )}

      {/* Tổng */}
      <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
        <span className="text-sm font-bold text-slate-700">Tổng cộng</span>
        <span className="text-2xl font-black text-[#111827] tabular-nums font-mono">{fmtVNDFull(total)}</span>
      </div>

      {/* Khách thanh toán */}
      {cart.length > 0 && (
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 shrink-0 w-[92px]">Khách TT</span>
            <input
              type="text" inputMode="numeric"
              placeholder={totalStr}
              value={paidInput}
              onChange={e => onPaidInputChange(formatMoneyLive(e.target.value))}
              onFocus={e => e.target.select()}
              className="flex-1 min-w-0 bg-surface2 border border-slate-700 rounded-xl px-4 py-3 text-base text-right font-mono font-bold text-[#111827] placeholder:text-slate-400 outline-none focus:border-cblue focus:ring-2 focus:ring-cblue/15 transition-all"
            />
          </div>

          {debtAmount > 0 && (
            <div className="flex justify-between items-center rounded-xl bg-rose-50 border border-rose-200 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Wallet size={13} strokeWidth={2.2} className="text-rose-700 shrink-0" />
                <span className="text-xs font-bold text-rose-700">Còn nợ lại</span>
                {customer && <span className="text-[12px] text-rose-400">→ ghi vào công nợ {customer.fullName}</span>}
              </div>
              <span className="font-mono font-black text-sm text-rose-700 tabular-nums">{fmtVNDFull(debtAmount)}</span>
            </div>
          )}

          {changeAmount > 0 && (
            <div className="flex justify-between items-center rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Banknote size={13} strokeWidth={2.2} className="text-cgreen shrink-0" />
                <span className="text-xs font-bold text-cgreen">Tiền thừa trả lại</span>
              </div>
              <span className="font-mono font-black text-sm text-cgreen tabular-nums">{fmtVNDFull(changeAmount)}</span>
            </div>
          )}
        </div>
      )}

      {creditBlocked && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs text-rose-700">
          <AlertTriangle size={16} strokeWidth={2} className="shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Vượt hạn mức công nợ!</div>
          </div>
        </div>
      )}

      {/* Actions — nút Thanh Toán phải lớn nhất & nổi bật nhất trong toàn bộ POS */}
      <div className="flex flex-col gap-2.5">
        <button
          onClick={onPay}
          disabled={cart.length === 0 || paying || creditBlocked}
          className={`w-full h-16 rounded-2xl font-bold text-[16px] tracking-wide transition-all duration-150 touch-manipulation flex items-center justify-center gap-2.5 ${
            cart.length === 0 || paying || creditBlocked
              ? 'bg-surface2 border border-slate-800 text-slate-400 cursor-not-allowed'
              : 'bg-gradient-to-b from-[#3b82f6] to-[#2563eb] hover:brightness-105 text-white shadow-lg shadow-blue-500/25 active:scale-[0.98]'
          }`}
        >
          {paying ? (
            <><LoaderCircle size={20} strokeWidth={2.2} className="animate-spin" /> Đang xử lý…</>
          ) : creditBlocked ? (
            <><Ban size={20} strokeWidth={2.2} /> Vượt hạn mức</>
          ) : cart.length === 0 ? (
            <>Giỏ hàng trống</>
          ) : mode === 'order' ? (
            <><ClipboardList size={20} strokeWidth={2.2} /> Tạo Đơn Đặt Hàng</>
          ) : (
            <><CreditCard size={20} strokeWidth={2.2} /> Thanh Toán {fmtVNDFull(total)}</>
          )}
        </button>

        <button
          onClick={onHold}
          disabled={cart.length === 0}
          title="Lưu tạm đơn này và mở đơn mới"
          className="w-full h-10 rounded-xl border border-slate-800 bg-white text-slate-500 text-[14px] font-semibold hover:border-slate-600 hover:text-[#111827] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
        >
          <Save size={14} strokeWidth={2} /> Lưu tạm đơn
        </button>
      </div>
    </div>
  )
}
