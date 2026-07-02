import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '../../lib/cn'

const TONE_CLASS = {
  blue:   'bg-blue-50 text-cblue',
  green:  'bg-emerald-50 text-cgreen',
  amber:  'bg-amber-50 text-cyellow',
  rose:   'bg-rose-50 text-cred',
  violet: 'bg-violet-50 text-cpurple',
  teal:   'bg-teal-50 text-cteal',
}

// StatCard dùng chung: icon badge + value lớn + delta xu hướng.
// Khác KPICard (giữ nguyên cho các module đang dùng) — thiên về style Enterprise SaaS 2026.
export default function StatCard({ icon: Icon, label, value, trend, tone = 'blue', className = '' }) {
  const isUp = typeof trend === 'number' && trend >= 0
  return (
    <div className={cn('card', className)}>
      <div className="flex items-center justify-between mb-3">
        {Icon && (
          <span className={cn('w-10 h-10 rounded-xl flex items-center justify-center', TONE_CLASS[tone] ?? TONE_CLASS.blue)}>
            <Icon size={18} strokeWidth={2} />
          </span>
        )}
        {trend != null && (
          <span className={cn('flex items-center gap-1 text-[12px] font-bold', isUp ? 'text-cgreen' : 'text-cred')}>
            {isUp ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="text-xl font-bold text-text tabular-nums leading-tight">{value}</div>
      <div className="text-[12px] text-muted mt-1">{label}</div>
    </div>
  )
}
