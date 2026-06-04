import { useApp } from '../context/AppContext'
import { ALLOCATIONS, ALLOC_LABELS } from '../lib/constants'

const PROFILES = ['Thận trọng','Cân bằng','Tăng trưởng','Tùy chỉnh']
const PROFILE_COLORS = { 'Thận trọng':'#3fb950','Cân bằng':'#58a6ff','Tăng trưởng':'#f85149','Tùy chỉnh':'#bc8cff' }

export default function Config() {
  const { state, actions } = useApp()
  const alloc = state.riskProfile === 'Tùy chỉnh' ? state.customAllocation : (ALLOCATIONS[state.riskProfile] || {})
  const customTotal = Object.values(state.customAllocation).reduce((s,v)=>s+v,0)

  return (
    <div className="p-6 max-w-3xl">
      <h2 className="text-lg font-bold mb-4">Khẩu Vị Rủi Ro</h2>

      {/* Profile pills */}
      <div className="flex gap-2 flex-wrap mb-6">
        {PROFILES.map(p => (
          <button
            key={p}
            onClick={() => actions.setRiskProfile(p)}
            className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${state.riskProfile===p ? 'text-white border-transparent' : 'border-border text-muted hover:border-cblue hover:text-cblue'}`}
            style={state.riskProfile===p ? { background: PROFILE_COLORS[p], borderColor: PROFILE_COLORS[p] } : {}}
          >{p}</button>
        ))}
      </div>

      {/* Allocation table */}
      <div className="card mb-6 overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 text-xs text-muted font-semibold">Kênh</th>
              {PROFILES.map(p => <th key={p} className="text-right py-2 text-xs text-muted font-semibold px-3">{p}</th>)}
              <th className="text-right py-2 text-xs font-semibold text-cblue px-3">Đang dùng</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(ALLOC_LABELS).map(k => (
              <tr key={k} className="border-b border-border/40">
                <td className="py-2.5 text-sm">{ALLOC_LABELS[k]}</td>
                {PROFILES.map(p => (
                  <td key={p} className="py-2.5 text-right px-3">
                    {p === 'Tùy chỉnh'
                      ? <input
                          type="number" min="0" max="100" step="1"
                          value={state.customAllocation[k]}
                          onChange={e => actions.setCustomAlloc(k, parseFloat(e.target.value)||0)}
                          className="w-16 text-right bg-cpurple/10 border border-cpurple/30 text-cpurple px-2 py-1 rounded text-xs focus:outline-none focus:border-cpurple"
                        />
                      : <span className="text-sm text-muted">{ALLOCATIONS[p]?.[k]}%</span>
                    }
                  </td>
                ))}
                <td className="py-2.5 text-right px-3">
                  <strong className="text-cblue">{alloc[k]}%</strong>
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-2 text-xs font-bold text-muted">TỔNG</td>
              {PROFILES.map(p => {
                const t = p==='Tùy chỉnh' ? customTotal : Object.values(ALLOCATIONS[p]||{}).reduce((s,v)=>s+v,0)
                return <td key={p} className={`py-2 text-right px-3 text-xs font-bold ${t===100?'text-cgreen':'text-cred'}`}>{t}%</td>
              })}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Thresholds */}
      <h2 className="text-lg font-bold mb-3">Ngưỡng Quản Trị</h2>
      <div className="card max-w-xs">
        <div className="mb-3">
          <label className="text-xs text-muted block mb-1">Ngưỡng lệch cho phép (±%)</label>
          <input
            type="number" step="0.5" min="1" max="20"
            value={state.deviationThreshold}
            onChange={e => actions.setDeviation(parseFloat(e.target.value)||0)}
            className="input-base"
          />
        </div>
      </div>
    </div>
  )
}
