import { cn } from '../../lib/cn'

// Card gốc — .card/.card-hover đã định nghĩa sẵn trong index.css.
function Card({ className = '', hover = false, children, ...props }) {
  return (
    <div className={cn('card', hover && 'card-hover', className)} {...props}>
      {children}
    </div>
  )
}

Card.Header = function CardHeader({ icon: Icon, title, subtitle, actions, className = '' }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 mb-4', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon size={18} strokeWidth={2} className="text-cblue shrink-0" />}
        <div className="min-w-0">
          <div className="text-cardtitle text-text truncate">{title}</div>
          {subtitle && <div className="text-[12px] text-muted mt-0.5 truncate">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  )
}

Card.Body = function CardBody({ className = '', children }) {
  return <div className={cn(className)}>{children}</div>
}

Card.Footer = function CardFooter({ className = '', children }) {
  return (
    <div className={cn('mt-4 pt-4 border-t border-border flex items-center justify-between gap-3', className)}>
      {children}
    </div>
  )
}

export default Card
