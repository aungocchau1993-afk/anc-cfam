import { cn } from '../../lib/cn'

const TONE_CLASS = {
  green:  'bg-emerald-50 text-emerald-700',
  red:    'bg-rose-50 text-rose-700',
  blue:   'bg-blue-50 text-blue-600',
  yellow: 'bg-amber-50 text-amber-700',
  gray:   'bg-surface2 text-muted',
  purple: 'bg-violet-50 text-violet-600',
  teal:   'bg-teal-50 text-cteal',
}

// Badge pill dùng chung — cùng thang màu với .tag-* sẵn có, thêm tone gray/purple/teal + icon.
export default function Badge({ tone = 'gray', icon: Icon, className = '', children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-0.5 rounded-full',
        TONE_CLASS[tone] ?? TONE_CLASS.gray,
        className,
      )}
    >
      {Icon && <Icon size={11} strokeWidth={2.4} />}
      {children}
    </span>
  )
}
