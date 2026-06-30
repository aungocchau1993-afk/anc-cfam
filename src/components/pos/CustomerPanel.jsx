import { useState, useMemo } from 'react'
import { User, Users, X, ChevronDown, Gift, Star } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'
import { removeVietnameseTones } from '../../lib/formatters'

function fmtPhone(p) {
  if (!p) return ''
  const d = String(p).replace(/\D/g, '')
  return d.length === 10 ? `${d.slice(0,4)} ${d.slice(4,7)} ${d.slice(7)}` : p
}

const VIP_CONFIG = {
  MEMBER:   { label: 'Member',   cls: 'text-slate-500 bg-slate-800/50 border-slate-700' },
  SILVER:   { label: 'Silver',   cls: 'text-slate-600 bg-slate-400/15 border-slate-400/40' },
  GOLD:     { label: 'Gold',     cls: 'text-amber-600 bg-amber-50 border-amber-200' },
  PLATINUM: { label: 'Platinum', cls: 'text-violet-600 bg-violet-50 border-violet-200' },
}

export function VipBadge({ tier }) {
  const cfg = VIP_CONFIG[tier] || VIP_CONFIG.MEMBER
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold whitespace-nowrap ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

function CustomerSelector({ customers, selected, onSelect }) {
  const [open, setOpen]   = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const safeList  = Array.isArray(customers) ? customers : []
    const safeQuery = removeVietnameseTones(query || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return safeList
    return safeList.filter(c => {
      const name  = removeVietnameseTones(c?.fullName)
      const phone = removeVietnameseTones(c?.phone)
      return words.every(w => name.includes(w) || phone.includes(w))
    }).sort((a, b) => {
      const nA = removeVietnameseTones(a?.fullName || '')
      const nB = removeVietnameseTones(b?.fullName || '')
      const aStarts = nA.startsWith(safeQuery)
      const bStarts = nB.startsWith(safeQuery)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      const aExact = ` ${nA} `.includes(` ${safeQuery} `)
      const bExact = ` ${nB} `.includes(` ${safeQuery} `)
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })
  }, [customers, query])

  return (
    <div className="relative flex-1 min-w-0">
      <button
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 h-10 px-3 rounded-xl border text-sm text-left transition-all ${
          selected
            ? 'bg-violet-50 border-violet-200 text-[#1e293b]'
            : 'bg-surface2 border-slate-800 text-slate-500 hover:border-slate-600'
        }`}
      >
        {selected ? <User size={16} strokeWidth={2} className="text-violet-500 shrink-0" /> : <Users size={16} strokeWidth={2} className="shrink-0" />}
        <span className="flex-1 truncate font-medium">{selected ? selected.fullName : 'Khách lẻ'}</span>
        {selected && (
          <span
            onClick={e => { e.stopPropagation(); onSelect(null) }}
            className="text-slate-400 hover:text-rose-500 p-0.5 rounded hover:bg-rose-50 transition-colors"
          ><X size={13} strokeWidth={2.2} /></span>
        )}
        <ChevronDown size={14} strokeWidth={2.2} className={`text-slate-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-800 rounded-xl shadow-xl z-30 overflow-hidden">
          <div className="p-2 border-b border-slate-800">
            <input autoFocus
              className="w-full bg-surface2 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-[#1e293b] placeholder:text-slate-500 outline-none focus:border-cblue transition-all"
              placeholder="Tìm khách..."
              value={query} onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              onClick={() => { onSelect(null); setOpen(false); setQuery('') }}
              className="w-full px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-surface2 transition-colors flex items-center gap-2"
            >
              <Users size={14} strokeWidth={2} /> Khách lẻ
            </button>
            {filtered.map(c => (
              <button key={c.id}
                onClick={() => { onSelect(c); setOpen(false); setQuery('') }}
                className="w-full px-3 py-2.5 text-left hover:bg-surface2 transition-colors flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 text-xs font-black flex items-center justify-center shrink-0">
                    {c.fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#1e293b] truncate">{c.fullName}</div>
                    {c.phone && <div className="text-[11px] text-slate-500">{fmtPhone(c.phone)}</div>}
                  </div>
                </div>
                <div className="text-xs text-violet-600 font-mono shrink-0">{fmtVNDFull(c.totalSpent || 0)}</div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-slate-500">Không tìm thấy</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CustomerPanel({ customers, customer, onSelect, onAddNew, onOpenRedeem }) {
  return (
    <div className="shrink-0 px-5 pt-4 pb-4 border-b border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Khách hàng</span>
        {customer && (
          <div className="flex items-center gap-1.5">
            <VipBadge tier={customer.vipTier || 'MEMBER'} />
            <span className="text-[11px] text-amber-600 font-bold flex items-center gap-0.5">
              <Star size={11} strokeWidth={2.4} fill="currentColor" /> {(customer.rewardPoints ?? 0).toLocaleString('vi-VN')}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <CustomerSelector customers={customers} selected={customer} onSelect={onSelect} />
        {onAddNew && (
          <button
            onClick={onAddNew}
            title="Thêm khách hàng mới"
            className="shrink-0 w-10 h-10 rounded-xl border border-slate-800 bg-white text-slate-500 hover:border-cblue hover:text-cblue transition-colors flex items-center justify-center"
          >
            <span className="text-base leading-none">＋</span>
          </button>
        )}
      </div>

      {customer && (customer.rewardPoints ?? 0) > 0 && (
        <button
          onClick={onOpenRedeem}
          className="mt-2.5 w-full flex items-center justify-center gap-1.5 h-9 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 text-[12px] font-bold hover:bg-amber-100 transition-colors"
        >
          <Gift size={14} strokeWidth={2.2} /> Đổi điểm lấy quà ({(customer.rewardPoints ?? 0).toLocaleString('vi-VN')} điểm)
        </button>
      )}
    </div>
  )
}
