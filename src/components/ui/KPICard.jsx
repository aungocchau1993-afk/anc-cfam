export default function KPICard({ label, value, sub, variant = 'default', icon }) {
  const variants = {
    green:   'card-green border',
    blue:    'card-blue border',
    purple:  'card-purple border',
    red:     'card-red border',
    gold:    'card-gold border',
    default: 'card',
  }
  return (
    <div className={`${variants[variant]} relative overflow-hidden`}>
      {icon && <div className="absolute top-4 right-4 text-3xl opacity-25">{icon}</div>}
      <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-xl font-bold text-white leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-white/50 mt-1.5">{sub}</div>}
    </div>
  )
}
