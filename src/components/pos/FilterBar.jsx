import { ChevronDown } from 'lucide-react'

// Bộ lọc Danh mục / Thương hiệu / Kho — sản phẩm chưa có các trường này trong
// schema hiện tại nên 3 select chỉ hiển thị "Tất cả" (placeholder), sẵn sàng
// bật lọc thật khi dữ liệu category/brand/warehouse được bổ sung.
const FILTERS = [
  { label: 'Tất cả danh mục' },
  { label: 'Tất cả thương hiệu' },
  { label: 'Kho: Tất cả' },
]

export default function FilterBar({ right }) {
  return (
    <div className="flex items-center justify-between gap-2 px-6 pb-4 -mt-1">
      <div className="flex items-center gap-2">
        {FILTERS.map(f => (
          <button
            key={f.label}
            disabled
            title="Chưa có dữ liệu để lọc"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-slate-800 bg-white text-[14px] text-slate-500 cursor-not-allowed opacity-70"
          >
            {f.label}
            <ChevronDown size={14} strokeWidth={2.2} className="text-slate-400" />
          </button>
        ))}
      </div>
      {right}
    </div>
  )
}
