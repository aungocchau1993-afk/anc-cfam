import { cn } from '../../lib/cn'

// Table compound dùng chung — tái sử dụng .table-wrap (scroll ngang mobile) sẵn có trong index.css.
function Table({ className = '', children }) {
  return (
    <div className="table-wrap">
      <table className={cn('w-full text-left', className)}>{children}</table>
    </div>
  )
}

Table.Head = function TableHead({ className = '', children }) {
  return (
    <thead className={cn('bg-gray-50 sticky top-0 z-sticky', className)}>
      <tr>{children}</tr>
    </thead>
  )
}

Table.HeadCell = function TableHeadCell({ className = '', children, ...props }) {
  return (
    <th
      className={cn('px-4 py-3 text-[12px] font-semibold text-muted uppercase tracking-wide', className)}
      {...props}
    >
      {children}
    </th>
  )
}

Table.Body = function TableBody({ className = '', children }) {
  return <tbody className={cn('divide-y divide-border', className)}>{children}</tbody>
}

Table.Row = function TableRow({ className = '', children, ...props }) {
  return (
    <tr className={cn('hover:bg-surface2 transition-colors', className)} {...props}>
      {children}
    </tr>
  )
}

Table.Cell = function TableCell({ className = '', children, ...props }) {
  return (
    <td className={cn('px-4 py-3.5 text-sm text-text', className)} {...props}>
      {children}
    </td>
  )
}

export default Table
