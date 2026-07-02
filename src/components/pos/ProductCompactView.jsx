import { PackageSearch, LoaderCircle, Plus } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'
import { stockBadge } from './posUtils'

export default function ProductCompactView({ loading, products, cart, search, onAdd }) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 py-20">
        <LoaderCircle size={28} strokeWidth={2} className="animate-spin" />
        <span className="text-sm">Đang tải dữ liệu từ Cloud…</span>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2.5 text-slate-400 py-20">
        <PackageSearch size={36} strokeWidth={1.5} />
        <div className="font-semibold text-slate-500 text-sm">
          {search ? 'Không tìm thấy sản phẩm' : 'Chưa có sản phẩm — Thêm tại tab Hàng Hóa'}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden bg-white">
      <div className="divide-y divide-slate-800/60">
        {products.map(p => {
          const badge  = stockBadge(p.stockQuantity)
          const sold   = p.stockQuantity <= 0
          const inCart = cart.find(i => i.productId === p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => !sold && onAdd(p)}
              disabled={sold}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors ${
                sold
                  ? 'opacity-50 cursor-not-allowed'
                  : inCart
                  ? 'bg-blue-50/70 hover:bg-blue-50'
                  : 'hover:bg-surface2'
              }`}
            >
              <span className="flex-1 min-w-0 text-[13px] font-semibold text-[#111827] truncate">{p.name}</span>
              <span className="hidden md:block w-20 shrink-0 text-[11px] text-slate-500 font-mono truncate">{p.sku}</span>
              <span className={`shrink-0 text-[11px] font-bold ${badge.cls.split(' ')[0]}`}>{badge.label}</span>
              <span className="w-24 shrink-0 text-right text-[13px] font-bold text-cblue tabular-nums">{fmtVNDFull(p.sellPrice)}</span>
              <span className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center transition-colors ${
                sold ? 'text-slate-300' : inCart ? 'bg-cblue text-white' : 'bg-surface2 border border-slate-800 text-slate-500'
              }`}>
                {inCart ? <span className="text-[11px] font-black">{inCart.quantity}</span> : <Plus size={12} strokeWidth={2.4} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
