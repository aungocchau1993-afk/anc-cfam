export default function KPICard({ label, value, sub, variant = 'default', icon }) {
  const variants = {
    green:   { box: 'card-green',  label: 'text-emerald-700/70', value: 'text-emerald-700', sub: 'text-emerald-700/60' },
    blue:    { box: 'card-blue',   label: 'text-blue-700/70',    value: 'text-blue-700',    sub: 'text-blue-700/60' },
    purple:  { box: 'card-purple', label: 'text-violet-700/70',  value: 'text-violet-700',  sub: 'text-violet-700/60' },
    red:     { box: 'card-red',    label: 'text-rose-700/70',    value: 'text-rose-700',    sub: 'text-rose-700/60' },
    gold:    { box: 'card-gold',   label: 'text-amber-700/70',   value: 'text-amber-700',   sub: 'text-amber-700/60' },
    default: { box: 'card',        label: 'text-slate-500',      value: 'text-slate-900',   sub: 'text-slate-500' },
  }
  const v = variants[variant] ?? variants.default
  return (
    <div className={`${v.box} relative overflow-hidden`}>
      {icon && <div className="absolute top-4 right-4 text-3xl opacity-30">{icon}</div>}
      <div className={`text-[12px] font-semibold uppercase tracking-wide mb-2 ${v.label}`}>{label}</div>
      <div className={`text-xl font-bold leading-tight ${v.value}`}>{value}</div>
      {sub && <div className={`text-[12px] mt-1.5 ${v.sub}`}>{sub}</div>}
    </div>
  )
}
