import { PackageSearch, LoaderCircle, ImageOff, Plus } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'
import { stockBadge } from './posUtils'

export default function ProductListView({ loading, products, cart, search, onAdd }) {
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
    <div className="flex flex-col rounded-xl border border-slate-800 overflow-hidden bg-white">
      <div className="hidden sm:flex items-center gap-3 px-3 py-2 bg-surface2 border-b border-slate-800 text-[12px] font-bold text-slate-500 uppercase tracking-wider">
        <span className="w-10 shrink-0" />
        <span className="flex-1 min-w-0">Tên</span>
        <span className="w-24 shrink-0">SKU</span>
        <span className="w-14 shrink-0 text-center">ĐVT</span>
        <span className="w-28 shrink-0 text-right">Giá</span>
        <span className="w-16 shrink-0 text-center">Tồn</span>
        <span className="w-10 shrink-0" />
      </div>
      <div className="divide-y divide-slate-800/70">
        {products.map(p => {
          const badge   = stockBadge(p.stockQuantity)
          const sold    = p.stockQuantity <= 0
          const inCart  = cart.find(i => i.productId === p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => !sold && onAdd(p)}
              disabled={sold}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                sold
                  ? 'opacity-50 cursor-not-allowed'
                  : inCart
                  ? 'bg-blue-50/70 hover:bg-blue-50'
                  : 'hover:bg-surface2'
              }`}
            >
              <div className={`relative w-10 h-10 rounded-lg overflow-hidden bg-surface2 border border-slate-800 shrink-0 ${sold ? 'grayscale' : ''}`}>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-slate-400"><ImageOff size={14} strokeWidth={1.6} /></div>
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-semibold text-[#111827] truncate">{p.name}</div>
                <div className="sm:hidden text-[12px] text-slate-500 font-mono">{p.sku}</div>
              </div>

              <span className="hidden sm:block w-24 shrink-0 text-[12px] text-slate-500 font-mono truncate">{p.sku}</span>
              <span className="hidden sm:block w-14 shrink-0 text-center text-[12px] text-blue-600 font-bold">{p.unit || '—'}</span>
              <span className="w-24 sm:w-28 shrink-0 text-right text-[14px] font-bold text-cblue tabular-nums">{fmtVNDFull(p.sellPrice)}</span>
              <span className={`hidden sm:inline-flex w-16 shrink-0 items-center justify-center rounded-md border px-1.5 py-0.5 text-[12px] font-bold ${badge.cls}`}>{badge.label}</span>

              <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                sold ? 'text-slate-300' : inCart ? 'bg-cblue text-white' : 'bg-surface2 border border-slate-800 text-slate-500'
              }`}>
                {inCart ? <span className="text-[12px] font-black">{inCart.quantity}</span> : <Plus size={14} strokeWidth={2.4} />}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
