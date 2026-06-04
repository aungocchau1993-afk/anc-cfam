import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext'
import { computePortfolioSignals } from '../lib/calculations'
import { ALLOC_LABELS, ALLOC_COLORS, CATEGORY_CONFIG } from '../lib/constants'
import { fmtVNDFull, fmtPct } from '../lib/formatters'
import { AllocationBarChart, AllocationPieChart } from '../components/charts/AppCharts'
import PortfolioModal from '../components/portfolio/PortfolioModal'

function SignalCard({ sig, holdingCount, onClick }) {
  const cfg = CATEGORY_CONFIG[sig.key]
  const badgeMap  = { OK:'ok', TĂNG:'down', GIẢM:'up' }
  const cardBorder = { OK:'border-cblue/20', TĂNG:'border-cgreen/40 bg-cgreen/5', GIẢM:'border-cred/40 bg-cred/5' }
  const signalText = { OK:'✓ Ổn định', TĂNG:'↑ Mua thêm', GIẢM:'↓ Giải ngân' }
  const badgeColor = { OK:'tag-blue', TĂNG:'tag-green', GIẢM:'tag-red' }
  const fillPct = Math.min(100, sig.actual)

  return (
    <div
      onClick={onClick}
      className={`card border cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all ${cardBorder[sig.signal]}`}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-sm">{cfg?.icon} {sig.label}</span>
        <span className={badgeColor[sig.signal] + ' text-xs'} style={{ padding:'2px 8px', borderRadius:20 }}>{signalText[sig.signal]}</span>
      </div>
      <div className="text-xl font-black mb-1 tabular-nums" style={{ color: ALLOC_COLORS[sig.key] }}>{fmtVNDFull(sig.value)}</div>
      <div className="text-[11px] text-muted mb-2">
        {holdingCount ? `${holdingCount} khoản · click để xem chi tiết` : 'Chưa có khoản nào · click để thêm'}
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full transition-all" style={{ width:`${fillPct}%`, background: ALLOC_COLORS[sig.key] }} />
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>Thực tế: <strong>{fmtPct(sig.actual)}</strong></span>
        <span>Mục tiêu: <strong>{fmtPct(sig.target)}</strong></span>
        <span>Lệch: <strong style={{ color: sig.diff > 0 ? '#f85149':'#3fb950' }}>{sig.diff>0?'+':''}{fmtPct(sig.diff)}</strong></span>
      </div>
      {sig.signal !== 'OK' && (
        <div className="text-[11px] text-muted mt-1.5">
          Cần điều chỉnh: <strong>{fmtVNDFull(Math.abs(sig.adjustAmt))}</strong>
        </div>
      )}
    </div>
  )
}

export default function Portfolio() {
  const { state, getAlloc } = useApp()
  const [activeModal, setActiveModal] = useState(null)
  const alloc = getAlloc()

  const signals = useMemo(
    () => computePortfolioSignals(state.portfolioValues, alloc, state.deviationThreshold)
      .map(s => ({ ...s, label: ALLOC_LABELS[s.key], color: ALLOC_COLORS[s.key] })),
    [state.portfolioValues, alloc, state.deviationThreshold]
  )

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-5">
        <h2 className="text-lg font-bold">Tín Hiệu Cân Bằng Danh Mục</h2>
        <span className="tag-blue">{state.riskProfile} · Ngưỡng ±{state.deviationThreshold}%</span>
      </div>

      {/* Signal cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {signals.map(s => (
          <SignalCard
            key={s.key}
            sig={s}
            holdingCount={(state.portfolioDetails[s.key]||[]).length}
            onClick={() => setActiveModal(s.key)}
          />
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="text-sm font-semibold text-muted mb-4">🎯 Tỷ Trọng Thực Tế vs Mục Tiêu</div>
          <div className="h-60"><AllocationBarChart signals={signals} /></div>
        </div>
        <div className="card">
          <div className="text-sm font-semibold text-muted mb-4">🥧 Phân Bổ Hiện Tại</div>
          <div className="h-60"><AllocationPieChart signals={signals} /></div>
        </div>
      </div>

      {/* Modal */}
      {activeModal && <PortfolioModal categoryKey={activeModal} onClose={() => setActiveModal(null)} />}
    </div>
  )
}
