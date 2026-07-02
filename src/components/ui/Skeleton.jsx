// Skeleton loading dùng chung — thay thế spinner/"Đang tải…" cho bảng & danh sách,
// giữ nguyên layout đang chờ dữ liệu (giống Shopify/Linear) thay vì màn hình trống + spinner giữa.

// 1 dòng bar xám nhấp nháy — building block cho các skeleton bên dưới.
function Bar({ className = '' }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />
}

// Dòng skeleton cho <tbody> của table (ảnh + 2 dòng text + vài cột số liệu).
export function SkeletonRow({ columns = 4, hasImage = true }) {
  return (
    <tr>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          {hasImage && <Bar className="w-10 h-10 rounded-lg shrink-0" />}
          <div className="flex flex-col gap-1.5 min-w-0 flex-1">
            <Bar className="h-3.5 w-3/5" />
            <Bar className="h-3 w-2/5" />
          </div>
        </div>
      </td>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3.5"><Bar className="h-3.5 w-16 ml-auto" /></td>
      ))}
    </tr>
  )
}

// Nhiều dòng skeleton — dùng trực tiếp trong <tbody> khi loading=true.
export function SkeletonTableBody({ rows = 6, columns = 4, hasImage = true }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} columns={columns} hasImage={hasImage} />
      ))}
    </>
  )
}

// Card danh sách dạng mobile (ảnh vuông + 2-3 dòng text) — dùng cho card-list loading.
export function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5">
      <div className="flex items-center gap-3 mb-3">
        <Bar className="w-12 h-12 rounded-xl shrink-0" />
        <div className="flex-1 flex flex-col gap-1.5">
          <Bar className="h-3.5 w-3/4" />
          <Bar className="h-3 w-1/2" />
        </div>
      </div>
      <Bar className="h-8 w-full rounded-lg" />
    </div>
  )
}

// Card KPI (icon + label + số) — dùng cho hàng KPI đang tải.
export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-card">
      <Bar className="w-10 h-10 rounded-xl mb-3" />
      <Bar className="h-3 w-1/2 mb-2" />
      <Bar className="h-5 w-2/3" />
    </div>
  )
}
