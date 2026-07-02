import { cn } from '../../lib/cn'

// Tabs gạch chân dùng chung — items: [{ value, label, icon?, count? }]
export default function Tabs({ items, value, onChange, className = '' }) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-border overflow-x-auto scrollbar-none', className)}>
      {items.map(item => {
        const active = item.value === value
        const ItemIcon = item.icon
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative flex items-center gap-2 px-4 h-11 text-sm font-semibold whitespace-nowrap transition-colors',
              active ? 'text-cblue' : 'text-muted hover:text-text',
            )}
          >
            {ItemIcon && <ItemIcon size={15} strokeWidth={2.1} />}
            {item.label}
            {item.count != null && (
              <span
                className={cn(
                  'text-[12px] font-bold px-1.5 py-0.5 rounded-full leading-none',
                  active ? 'bg-cblue/10 text-cblue' : 'bg-surface2 text-muted',
                )}
              >
                {item.count}
              </span>
            )}
            {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-cblue rounded-full" />}
          </button>
        )
      })}
    </div>
  )
}
