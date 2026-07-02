import { motion } from 'framer-motion'
import { LayoutGrid, List, AlignJustify } from 'lucide-react'

const MODES = [
  { id: 'grid',    label: 'Grid',    icon: LayoutGrid,   tip: 'Lưới sản phẩm — ảnh lớn, phù hợp màn cảm ứng' },
  { id: 'list',     label: 'List',    icon: List,          tip: 'Danh sách — xem nhiều sản phẩm hơn, phù hợp thu ngân' },
  { id: 'compact', label: 'Compact', icon: AlignJustify,  tip: 'Rút gọn — mật độ cao nhất, phù hợp hàng nghìn SKU' },
]

export default function ViewSwitcher({ mode, onChange }) {
  return (
    <div className="relative flex items-center gap-0.5 p-1 rounded-xl bg-surface2 border border-slate-800">
      {MODES.map(m => {
        const Icon   = m.icon
        const active = mode === m.id
        return (
          <button
            key={m.id}
            type="button"
            title={m.tip}
            onClick={() => onChange(m.id)}
            className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          >
            {active && (
              <motion.span
                layoutId="pos-view-switcher-active"
                className="absolute inset-0 rounded-lg bg-white shadow-sm border border-slate-800"
                transition={{ duration: 0.2 }}
              />
            )}
            <Icon
              size={15}
              strokeWidth={2.2}
              className={`relative z-10 transition-colors ${active ? 'text-cblue' : 'text-slate-400 hover:text-slate-600'}`}
            />
          </button>
        )
      })}
    </div>
  )
}
