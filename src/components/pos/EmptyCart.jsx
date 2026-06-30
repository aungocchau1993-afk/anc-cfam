import { ShoppingCart } from 'lucide-react'

export default function EmptyCart() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2.5 text-slate-300 select-none">
      <div className="w-16 h-16 rounded-2xl bg-surface2 flex items-center justify-center text-slate-300">
        <ShoppingCart size={28} strokeWidth={1.6} />
      </div>
      <div className="text-sm font-semibold text-slate-500">Giỏ hàng trống</div>
      <div className="text-xs text-slate-400">Chọn sản phẩm bên trái để thêm vào giỏ</div>
    </div>
  )
}
