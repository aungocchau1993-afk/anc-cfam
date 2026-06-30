/**
 * MobileTable — Wrapper thống nhất cho mọi bảng dữ liệu trong hệ thống.
 *
 * Desktop: table bình thường với scroll ngang
 * Mobile (<640px): tự động chuyển sang card list
 *
 * Dùng:
 *   <MobileTable
 *     columns={[{ key, label, className?, mobileHide? }]}
 *     rows={data}
 *     renderCell={(row, col) => ...}
 *     renderCard={(row) => ...}    ← optional, custom card layout
 *     keyExtractor={(row) => row.id}
 *     emptyText="Chưa có dữ liệu"
 *     loading={false}
 *   />
 */

export default function MobileTable({
  columns = [],
  rows = [],
  renderCell,
  renderCard,
  keyExtractor = (r) => r.id,
  emptyText = 'Chưa có dữ liệu',
  loading = false,
  onRowClick,
  className = '',
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-600 text-sm gap-2">
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" strokeDasharray="28" strokeDashoffset="10"/>
        </svg>
        Đang tải...
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-600 text-sm gap-2">
        <svg className="w-10 h-10 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        {emptyText}
      </div>
    )
  }

  return (
    <>
      {/* ── Mobile: Card List (< sm) ── */}
      <div className={`sm:hidden flex flex-col gap-2 p-3 ${className}`}>
        {rows.map(row => (
          <div
            key={keyExtractor(row)}
            onClick={() => onRowClick?.(row)}
            className={`bg-[#ffffff] border border-slate-800 rounded-xl p-3.5 ${onRowClick ? 'active:bg-slate-800/60 cursor-pointer' : ''}`}
          >
            {renderCard
              ? renderCard(row)
              : (
                <div className="flex flex-col gap-1.5">
                  {columns.filter(c => !c.mobileHide).map(col => (
                    <div key={col.key} className="flex items-start justify-between gap-2">
                      <span className="text-[11px] text-slate-600 shrink-0 mt-0.5">{col.label}</span>
                      <span className={`text-sm text-right ${col.className || 'text-[#1e293b]'}`}>
                        {renderCell ? renderCell(row, col) : row[col.key]}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        ))}
      </div>

      {/* ── Desktop: Table with horizontal scroll (≥ sm) ── */}
      <div className={`hidden sm:block overflow-x-auto ${className}`} style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-slate-800 text-slate-500 text-xs uppercase tracking-wide">
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 font-semibold text-left ${col.headerClass || ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {rows.map(row => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-slate-800/30 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                    {renderCell ? renderCell(row, col) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
