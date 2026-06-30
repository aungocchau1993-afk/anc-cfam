import { PackageSearch, LoaderCircle } from 'lucide-react'
import ProductCard from './ProductCard'

export default function ProductGrid({ loading, products, cart, search, onAdd }) {
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
    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
      {products.map(p => (
        <ProductCard
          key={p.id}
          product={p}
          inCart={cart.find(i => i.productId === p.id)}
          onAdd={onAdd}
        />
      ))}
    </div>
  )
}
