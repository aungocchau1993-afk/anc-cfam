import { Inbox, LoaderCircle } from 'lucide-react'

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
      <div className="flex items-center justify-center py-16 text-muted text-sm gap-2">
        <LoaderCircle size={16} strokeWidth={2} className="animate-spin" />
        Đang tải...
      </div>
    )
  }

  if (!rows.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted text-sm gap-2">
        <Inbox size={40} strokeWidth={1.5} className="opacity-30" />
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
            className={`bg-surface border border-border rounded-xl p-3.5 ${onRowClick ? 'active:bg-surface2 cursor-pointer' : ''}`}
          >
            {renderCard
              ? renderCard(row)
              : (
                <div className="flex flex-col gap-1.5">
                  {columns.filter(c => !c.mobileHide).map(col => (
                    <div key={col.key} className="flex items-start justify-between gap-2">
                      <span className="text-[12px] text-subtle shrink-0 mt-0.5">{col.label}</span>
                      <span className={`text-sm text-right ${col.className || 'text-text'}`}>
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
            <tr className="bg-surface2 border-b border-border text-muted text-[12px] font-semibold uppercase tracking-wide">
              {columns.map(col => (
                <th key={col.key} className={`px-4 py-3 text-left ${col.headerClass || ''}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(row => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`hover:bg-surface2 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
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
