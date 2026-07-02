import { useState } from 'react'
import { Minus, Plus, Trash2, ImageOff } from 'lucide-react'
import { formatMoneyLive, parseVNDInput, fmtVNDFull } from '../../lib/formatters'
import EmptyCart from './EmptyCart'

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
    <div className="flex items-center gap-3 py-3 border-b border-slate-800/70 last:border-0 group">
      {item.imageUrl
        ? <img src={item.imageUrl} alt={item.name} className="w-11 h-11 rounded-xl object-cover border border-slate-800 shrink-0" />
        : <div className="w-11 h-11 rounded-xl bg-surface2 border border-slate-800 flex items-center justify-center shrink-0 text-slate-400">
            <ImageOff size={16} strokeWidth={1.6} />
          </div>
      }

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[14px] font-semibold text-[#111827] truncate leading-tight">{item.name}</span>
          {item.unit
            ? <span className="shrink-0 text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600">{item.unit}</span>
            : <span className="shrink-0 text-[12px] px-1.5 py-0.5 rounded-full border border-dashed border-slate-700 text-slate-500" title="Chưa cài đơn vị tính">chưa có ĐVT</span>
          }
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {editingPrice ? (
            <input
              autoFocus
              className="w-28 text-[12px] font-mono text-cblue bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 outline-none text-right"
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
              className="text-[12px] text-slate-500 hover:text-cblue font-mono transition-colors">
              {item.price.toLocaleString('vi-VN')} ₫
            </button>
          )}
          <button onClick={() => onRemove(item.productId)}
            className="text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all ml-1">
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Qty stepper */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onQty(item.productId, item.quantity - 1)}
          className="w-7 h-7 rounded-lg bg-surface2 border border-slate-800 text-slate-500 hover:border-rose-300 hover:text-rose-500 transition-colors flex items-center justify-center">
          <Minus size={13} strokeWidth={2.4} />
        </button>

        {editingQty ? (
          <input
            autoFocus type="number" min="0"
            value={qtyInput}
            onChange={e => setQtyInput(e.target.value)}
            onBlur={handleQtySave}
            onKeyDown={e => {
              if (e.key === 'Enter')  handleQtySave()
              if (e.key === 'Escape') { setQtyInput(String(item.quantity)); setEditingQty(false) }
            }}
            className="w-12 text-center text-sm font-bold tabular-nums text-cblue bg-blue-50 border border-blue-300 rounded-lg outline-none focus:border-cblue px-1 py-0.5"
          />
        ) : (
          <span
            onClick={() => { setQtyInput(String(item.quantity)); setEditingQty(true) }}
            title="Click để nhập số lượng"
            className="w-8 text-center text-sm font-bold tabular-nums text-[#111827] cursor-pointer hover:text-cblue hover:bg-blue-50 rounded transition-colors px-1 py-0.5"
          >
            {item.quantity}
          </span>
        )}

        <button onClick={() => onQty(item.productId, item.quantity + 1)}
          className="w-7 h-7 rounded-lg bg-surface2 border border-slate-800 text-slate-500 hover:border-emerald-300 hover:text-cgreen transition-colors flex items-center justify-center">
          <Plus size={13} strokeWidth={2.4} />
        </button>
      </div>

      <div className="text-right shrink-0 min-w-[84px]">
        <div className="text-[14px] font-bold text-[#111827] tabular-nums font-mono">{fmtVNDFull(subtotal)}</div>
      </div>
    </div>
  )
}

export default function CartPanel({ cart, cartCount, onQty, onRemove, onPriceEdit, onClear }) {
  return (
    <div className="overflow-y-auto px-5 max-h-52 md:max-h-none md:flex-1">
      <div className="flex items-center justify-between py-3 sticky top-0 bg-white/95 backdrop-blur-sm z-10 -mx-5 px-5 border-b border-slate-800/60 mb-1">
        <span className="text-[12px] text-slate-500 font-bold uppercase tracking-widest">
          Giỏ hàng
          {cart.length > 0 && (
            <span className="ml-2 bg-cblue/10 text-cblue text-[12px] font-bold px-1.5 py-0.5 rounded-full">{cartCount} sp</span>
          )}
        </span>
        {cart.length > 0 && (
          <button onClick={onClear} className="text-[12px] text-slate-400 hover:text-rose-500 transition-colors">Xoá tất cả</button>
        )}
      </div>

      {cart.length === 0 ? <EmptyCart /> : (
        <div className="pb-2">
          {cart.map(item => (
            <CartItem key={item.productId} item={item} onQty={onQty} onRemove={onRemove} onPriceEdit={onPriceEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
