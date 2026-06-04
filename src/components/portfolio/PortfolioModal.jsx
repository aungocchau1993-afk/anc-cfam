import { useState, useEffect } from 'react'
import { CATEGORY_CONFIG } from '../../lib/constants'
import { fmtVNDFull, parseVNDInput, formatMoneyLive } from '../../lib/formatters'
import { useApp } from '../../context/AppContext'

export default function PortfolioModal({ categoryKey, onClose }) {
  const { state, actions } = useApp()
  const cfg = CATEGORY_CONFIG[categoryKey]
  const holdings = state.portfolioDetails[categoryKey] || []
  const total = state.portfolioValues[categoryKey] || 0
  const [form, setForm] = useState({})
  const [moneyDisplay, setMoneyDisplay] = useState('')

  useEffect(() => {
    setForm({})
    setMoneyDisplay('')
  }, [categoryKey])

  if (!cfg) return null

  async function handleAdd() {
    if (!form.name?.trim()) return
    const item = { ...form, amount: parseVNDInput(moneyDisplay) }
    await actions.addHolding(categoryKey, item)
    setForm({})
    setMoneyDisplay('')
  }

  function getMetric(h) {
    if (h.qty) return h.qty
    if (h.area) return `${h.area} m²`
    if (h.rate) return `${h.rate}%/năm`
    return '—'
  }

  function getNote(h) {
    return h.note || h.location || '—'
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-border gap-3">
          <div>
            <div className="text-lg font-bold" style={{ color: cfg.color }}>{cfg.icon} {cfg.label}</div>
            <div className="text-xs text-muted mt-0.5">Click "Thêm" để ghi nhận khoản đầu tư · Tổng tự cập nhật</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-muted">Tổng danh mục</div>
              <div className="text-xl font-bold" style={{ color: cfg.color }}>{fmtVNDFull(total)}</div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors text-sm">×</button>
          </div>
        </div>

        {/* Add form */}
        <div className="px-5 py-4 bg-surface2 border-b border-slate-800">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-[11px] font-bold text-cblue uppercase tracking-wide">+ Thêm khoản đầu tư mới</div>
            <div className="text-[11px] text-slate-500">Giá trị tự cộng vào tổng danh mục</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            {cfg.fields.map(f => (
              <div key={f.key} className={`flex flex-col gap-1 ${f.wide ? 'lg:col-span-2' : ''}`}>
                <label className="text-[11px] text-slate-400">{f.label}</label>
                {f.money
                  ? <input
                      type="text"
                      inputMode="numeric"
                      value={moneyDisplay}
                      onChange={e => setMoneyDisplay(formatMoneyLive(e.target.value))}
                      placeholder={f.placeholder}
                      className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2 text-sm text-right font-mono text-cblue placeholder:text-slate-600 outline-none transition-all focus:border-cpurple focus:ring-2 focus:ring-purple-500/50"
                    />
                  : <input
                      type="text"
                      value={form[f.key] || ''}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="w-full rounded-lg bg-slate-900/50 border border-slate-700 px-3 py-2 text-sm text-[#e6edf3] placeholder:text-slate-600 outline-none transition-all focus:border-cpurple focus:ring-2 focus:ring-purple-500/50"
                    />
                }
              </div>
            ))}
            <button
              onClick={handleAdd}
              className="h-[38px] rounded-lg px-4 text-sm font-bold text-white shadow-lg shadow-black/20 transition-all hover:brightness-110 active:scale-[0.98] whitespace-nowrap"
              style={{ background: cfg.color }}
            >
              Thêm
            </button>
          </div>
        </div>

        {/* Holdings list */}
        <div className="flex-1 overflow-y-auto p-5 border-t border-slate-800">
          {holdings.length === 0
            ? <div className="text-center py-12 text-muted border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                <div className="text-4xl mb-2">{cfg.icon}</div>
                <div className="font-semibold mb-1">Chưa có khoản đầu tư nào</div>
                <div className="text-sm text-slate-500">Điền form bên trên và nhấn "Thêm"</div>
              </div>
            : <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/20">
                <div className="hidden md:grid grid-cols-[1.7fr_1fr_1.3fr_1.4fr_44px] gap-3 px-4 py-2.5 bg-slate-900/40 border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <div>Tài sản</div>
                  <div>Số lượng</div>
                  <div className="text-right">Giá trị</div>
                  <div>Ghi chú</div>
                  <div />
                </div>

                {holdings.map(h => (
                  <div key={h.id} className="group grid grid-cols-1 md:grid-cols-[1.7fr_1fr_1.3fr_1.4fr_44px] gap-3 items-center px-4 py-3 border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 ring-1 ring-white/5" style={{ background: cfg.color + '20', color: cfg.color }}>
                        {cfg.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-[#e6edf3] truncate">{h.name || '—'}</div>
                        <div className="md:hidden text-xs text-slate-500 mt-0.5">{getMetric(h)}</div>
                      </div>
                    </div>

                    <div className="hidden md:block text-sm text-slate-300 font-mono tabular-nums truncate">
                      {getMetric(h)}
                    </div>

                    <div className="text-base font-black text-right tabular-nums" style={{ color: cfg.color }}>
                      {fmtVNDFull(h.amount||0)}
                    </div>

                    <div className="text-xs text-slate-400 truncate">
                      {getNote(h)}
                    </div>

                    <button
                      onClick={() => actions.removeHolding(categoryKey, h.id)}
                      className="justify-self-end w-8 h-8 rounded-lg border border-slate-700 text-slate-500 opacity-50 transition-all hover:bg-cred/15 hover:border-cred hover:text-cred group-hover:opacity-100 flex items-center justify-center"
                      aria-label="Xóa khoản đầu tư"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M9 3h6m-8 5h10m-9 0l.6 12h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
          }
        </div>
      </div>
    </div>
  )
}
