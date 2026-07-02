import { Search, ScanBarcode, Sparkles, History, SearchX, X } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'

function stockBadge(qty) {
  if (qty <= 0)  return { label: 'Hết', cls: 'text-rose-700 bg-rose-50 border-rose-200' }
  if (qty <= 10) return { label: `${qty}`, cls: 'text-amber-700 bg-amber-50 border-amber-200' }
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
    <div className="px-6 pt-3 pb-2.5">
      <div className="flex items-center gap-2.5">
        {/* Search + autocomplete */}
        <div ref={searchWrapRef} className="relative flex-1">
          <Search size={17} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
          <input
            autoFocus
            className="w-full h-11 bg-white border border-gray-300 rounded-xl pl-10 pr-4 text-[15px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-cblue focus:ring-4 focus:ring-cblue/10 transition-all shadow-sm"
            placeholder="Tìm theo tên hoặc SKU (F3)"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            onFocus={onFocus}
          />

          {dropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg z-40 overflow-hidden">
              {dropdownResults.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
                  <SearchX size={28} strokeWidth={1.5} className="text-gray-400" />
                  <div className="text-[14px] font-semibold text-gray-500">Không tìm thấy sản phẩm</div>
                  <div className="text-[12px] text-gray-500">Hãy thử từ khóa khác</div>
                </div>
              ) : (
                <>
                  <div className="px-4 py-2.5 border-b border-gray-200 text-[12px] text-gray-500 font-semibold uppercase tracking-wide">
                    {dropdownResults.length} kết quả — click để thêm vào giỏ
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {dropdownResults.map(p => {
                      const badge  = stockBadge(p.stockQuantity)
                      const inCart = cart.find(i => i.productId === p.id)
                      const disabled = p.stockQuantity <= 0
                      return (
                        <button
                          key={p.id}
                          onMouseDown={e => { e.preventDefault(); onPickResult(p) }}
                          disabled={disabled}
                          className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors border-b border-gray-200 last:border-0 ${
                            disabled
                              ? 'opacity-40 cursor-not-allowed'
                              : inCart
                              ? 'bg-blue-100 border-l-2 border-l-blue-300 hover:bg-blue-100'
                              : 'hover:bg-blue-50 cursor-pointer'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[14px] font-semibold text-gray-900 truncate">{p.name}</span>
                              {p.unit && <span className="shrink-0 text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600">{p.unit}</span>}
                            </div>
                            <div className="text-[12px] text-gray-500 font-mono">{p.sku}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[14px] font-bold text-cblue tabular-nums">{fmtVNDFull(p.sellPrice)}</div>
                            <span className={`text-[12px] font-bold border rounded px-1 py-0.5 ${badge.cls}`}>{badge.label}</span>
                          </div>
                          {inCart && (
                            <div className="w-5 h-5 rounded-full bg-cblue text-white text-[12px] font-black flex items-center justify-center shrink-0">
                              {inCart.quantity}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Barcode quick-scan (focuses search, hardware scanners type into focused input) */}
        <button
          onClick={() => searchWrapRef.current?.querySelector('input')?.focus()}
          title="Quét mã vạch"
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-900 transition-colors shadow-sm"
        >
          <ScanBarcode size={18} strokeWidth={2} />
        </button>

        {/* OCR */}
        <button
          onClick={onScanOcr}
          title="Quét hóa đơn AI"
          className="shrink-0 h-11 flex items-center gap-2 px-3.5 rounded-xl border border-violet-200 bg-violet-50 text-violet-600 text-sm font-semibold hover:bg-violet-100 transition-colors whitespace-nowrap"
        >
          <Sparkles size={16} strokeWidth={2.1} /> <span className="hidden sm:inline">Quét HĐ</span>
        </button>

        {/* History */}
        <button
          onClick={onShowHistory}
          title="Lịch sử đơn hàng"
          className="shrink-0 h-11 flex items-center gap-2 px-3.5 rounded-xl border border-gray-300 bg-white text-gray-500 text-sm font-semibold hover:border-gray-400 hover:text-gray-900 transition-colors whitespace-nowrap shadow-sm"
        >
          <History size={16} strokeWidth={2.1} /> <span className="hidden sm:inline">Lịch sử</span>
        </button>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between mt-2 px-1">
        <span className="text-[12px] text-gray-500">
          {search
            ? <><strong className="text-gray-700">{filteredCount}</strong> / {totalCount} sản phẩm</>
            : <><strong className="text-gray-700">{totalCount}</strong> sản phẩm</>
          }
        </span>
        {search && (
          <button onClick={onClearSearch} className="flex items-center gap-1 text-[12px] text-gray-500 hover:text-rose-500 transition-colors">
            <X size={12} strokeWidth={2.4} /> Xoá bộ lọc
          </button>
        )}
      </div>
    </div>
  )
}
