import { motion } from 'framer-motion'
import { ImageOff } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'

function stockBadge(qty) {
  if (qty <= 0)  return { label: 'Hết', cls: 'text-rose-600 bg-rose-50 border-rose-200' }
  if (qty <= 10) return { label: `${qty}`, cls: 'text-amber-600 bg-amber-50 border-amber-200' }
  return { label: `${qty}`, cls: 'text-cgreen bg-emerald-50 border-emerald-200' }
}

export default function ProductCard({ product, inCart, onAdd }) {
  const badge = stockBadge(product.stockQuantity)
  const sold  = product.stockQuantity <= 0

  return (
    <motion.button
      onClick={() => onAdd(product)}
      disabled={sold}
      whileHover={sold ? undefined : { scale: 1.02 }}
      whileTap={sold ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className={`relative flex flex-col text-left rounded-xl border overflow-hidden bg-white select-none ${
        sold
          ? 'border-slate-800 opacity-60 cursor-not-allowed'
          : inCart
          ? 'border-cblue shadow-md ring-2 ring-cblue/15'
          : 'border-slate-800 shadow-sm hover:border-slate-600 hover:shadow-md'
      }`}
    >
      {/* In-cart badge */}
      {inCart && (
        <div className="absolute top-2.5 right-2.5 w-5.5 h-5.5 min-w-[22px] min-h-[22px] px-1 rounded-full bg-cblue text-white text-[11px] font-black flex items-center justify-center shadow-md z-10">
          {inCart.quantity}
        </div>
      )}

      {/* Ảnh */}
      <div className={`relative w-full h-[180px] bg-surface2 ${sold ? 'grayscale' : ''}`}>
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-400">
              <ImageOff size={28} strokeWidth={1.5} />
            </div>
        }
        {sold && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/40">
            <span className="text-[11px] font-black text-white bg-rose-500 px-2.5 py-1 rounded-lg tracking-wide shadow-sm">HẾT HÀNG</span>
          </div>
        )}
      </div>

      {/* Thông tin */}
      <div className="flex flex-col p-4 flex-1 gap-2">
        <div className="text-[14px] font-bold text-[#1e293b] line-clamp-2 leading-snug min-h-[36px]">
          {product.name}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-500 font-mono truncate">{product.sku}</span>
          {product.unit && (
            <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600">
              {product.unit}
            </span>
          )}
        </div>
        <div className="flex items-end justify-between gap-1 mt-auto pt-1">
          <div className="text-[16px] font-bold text-cblue tabular-nums leading-none">
            {fmtVNDFull(product.sellPrice)}
          </div>
          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
      </div>
    </motion.button>
  )
}
