import { ShoppingCart } from 'lucide-react'

export default function PageHeader() {
  return (
    <div className="flex items-center gap-3.5 px-6 pt-5 pb-4">
      <div className="w-11 h-11 rounded-2xl bg-cblue/10 text-cblue flex items-center justify-center shrink-0">
        <ShoppingCart size={22} strokeWidth={2.2} />
      </div>
      <div className="min-w-0">
        <h1 className="text-[28px] font-bold text-[#1e293b] leading-tight tracking-tight">Bán Hàng</h1>
        <p className="text-[15px] text-slate-500 mt-0.5">Tạo đơn hàng nhanh chóng và dễ dàng</p>
      </div>
    </div>
  )
}
