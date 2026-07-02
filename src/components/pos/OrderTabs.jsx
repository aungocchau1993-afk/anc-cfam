import { Plus, X } from 'lucide-react'

export default function OrderTabs({ tabs, activeTabId, onSelect, onAdd, onClose }) {
  return (
    <div className="flex items-end gap-1 px-6 pt-2 overflow-x-auto scrollbar-none">
      {tabs.map(tab => {
        const isActive  = tab.id === activeTabId
        const itemCount = tab.cart.reduce((s, i) => s + i.quantity, 0)
        return (
          <div
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            className={`group flex items-center gap-2 px-4 h-10 rounded-t-xl text-sm cursor-pointer select-none whitespace-nowrap transition-colors border border-b-0 ${
              isActive
                ? 'bg-white border-slate-800 text-[#111827] font-semibold shadow-[0_-1px_0_0_#2563eb_inset]'
                : 'bg-transparent border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/60'
            }`}
            style={isActive ? { boxShadow: 'inset 0 2px 0 0 #2563eb' } : undefined}
          >
            <span>{tab.label}</span>
            {itemCount > 0 && (
              <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                isActive ? 'bg-cblue/10 text-cblue' : 'bg-slate-800/60 text-slate-500'
              }`}>
                {itemCount}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); onClose(tab.id) }}
                className="w-4 h-4 rounded flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 transition-all"
              >
                <X size={12} strokeWidth={2.4} />
              </button>
            )}
          </div>
        )
      })}
      <button
        onClick={onAdd}
        title="Thêm đơn mới"
        className="flex items-center justify-center w-8 h-8 mb-1 rounded-full text-slate-400 hover:text-cblue hover:bg-cblue/10 transition-all shrink-0"
      >
        <Plus size={16} strokeWidth={2.4} />
      </button>
    </div>
  )
}
