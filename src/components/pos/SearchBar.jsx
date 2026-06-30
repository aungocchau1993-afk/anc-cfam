import { Search, ScanBarcode, Sparkles, History } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'

function stockBadge(qty) {
  if (qty <= 0)  return { label: 'Hết', cls: 'text-rose-600 bg-rose-50 border-rose-200' }
  if (qty <= 10) return { label: `${qty}`, cls: 'text-amber-600 bg-amber-50 border-amber-200' }
  return { label: `${qty}`, cls: 'text-cgreen bg-emerald-50 border-emerald-200' }
}

export default function SearchBar({
  search, onSearchChange, searchWrapRef,
  dropdownOpen, onFocus,
  dropdownResults, cart, onPickResult,
  onScanOcr, onShowHistory,
  totalCount, filteredCount,
  onClearSearch,
}) {
  return (
    <div className="px-6 pt-4 pb-3">
      <div className="flex items-center gap-2.5">
        {/* Search + autocomplete */}
        <div ref={searchWrapRef} className="relative flex-1">
          <Search size={18} strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" />
          <input
            autoFocus
            className="w-full h-[52px] bg-white border border-slate-800 rounded-2xl pl-11 pr-4 text-[15px] text-[#1e293b] placeholder:text-slate-400 outline-none focus:border-cblue focus:ring-4 focus:ring-cblue/10 transition-all shadow-sm"
            placeholder="Tìm theo tên hoặc SKU (F3)"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onFocus={onFocus}
          />

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-800 rounded-2xl shadow-xl z-40 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800 text-[11px] text-slate-500 font-semibold uppercase tracking-wide">
                {dropdownResults.length} kết quả — click để thêm vào giỏ
              </div>
              <div className="max-h-56 overflow-y-auto">
                {dropdownResults.map(p => {
                  const badge  = stockBadge(p.stockQuantity)
                  const inCart = cart.find(i => i.productId === p.id)
                  return (
                    <button
                      key={p.id}
                      onMouseDown={e => { e.preventDefault(); onPickResult(p) }}
                      disabled={p.stockQuantity <= 0}
                      className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${
                        p.stockQuantity <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-cblue/5 cursor-pointer'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-semibold text-[#1e293b] truncate">{p.name}</span>
                          {p.unit && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600">{p.unit}</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">{p.sku}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[13px] font-bold text-cblue tabular-nums">{fmtVNDFull(p.sellPrice)}</div>
                        <span className={`text-[10px] font-bold border rounded px-1 py-0.5 ${badge.cls}`}>{badge.label}</span>
                      </div>
                      {inCart && (
                        <div className="w-5 h-5 rounded-full bg-cblue text-white text-[10px] font-black flex items-center justify-center shrink-0">
                          {inCart.quantity}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Barcode quick-scan (focuses search, hardware scanners type into focused input) */}
        <button
          onClick={() => searchWrapRef.current?.querySelector('input')?.focus()}
          title="Quét mã vạch"
          className="shrink-0 w-[52px] h-[52px] flex items-center justify-center rounded-2xl border border-slate-800 bg-white text-slate-500 hover:border-slate-600 hover:text-[#1e293b] transition-colors shadow-sm"
        >
          <ScanBarcode size={19} strokeWidth={2} />
        </button>

        {/* OCR */}
        <button
          onClick={onScanOcr}
          title="Quét hóa đơn AI"
          className="shrink-0 h-[52px] flex items-center gap-2 px-4 rounded-2xl border border-violet-200 bg-violet-50 text-violet-600 text-sm font-semibold hover:bg-violet-100 transition-colors whitespace-nowrap"
        >
          <Sparkles size={17} strokeWidth={2.1} /> <span className="hidden sm:inline">Quét HĐ</span>
        </button>

        {/* History */}
        <button
          onClick={onShowHistory}
          title="Lịch sử đơn hàng"
          className="shrink-0 h-[52px] flex items-center gap-2 px-4 rounded-2xl border border-slate-800 bg-white text-slate-500 text-sm font-semibold hover:border-slate-600 hover:text-[#1e293b] transition-colors whitespace-nowrap shadow-sm"
        >
          <History size={17} strokeWidth={2.1} /> <span className="hidden sm:inline">Lịch sử</span>
        </button>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between mt-2.5 px-1">
        <span className="text-[12px] text-slate-500">
          {search
            ? <><strong className="text-slate-700">{filteredCount}</strong> / {totalCount} sản phẩm</>
            : <><strong className="text-slate-700">{totalCount}</strong> sản phẩm</>
          }
        </span>
        {search && (
          <button onClick={onClearSearch} className="text-[12px] text-slate-500 hover:text-rose-500 transition-colors">
            ✕ Xoá bộ lọc
          </button>
        )}
      </div>
    </div>
  )
}
