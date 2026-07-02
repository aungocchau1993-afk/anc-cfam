import { cn } from '../../lib/cn'

// Section dùng chung — khối tiêu đề phụ (title/subtitle/actions) bên trong một trang,
// nhẹ hơn PageHeader (dùng cho toàn trang).
export default function Section({ title, subtitle, actions, className = '', children }) {
  return (
    <section className={cn('flex flex-col gap-4', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            {title && <h2 className="text-section text-text truncate">{title}</h2>}
            {subtitle && <p className="text-[14px] text-muted mt-0.5 truncate">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
