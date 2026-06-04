import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { computeQuarters, computeAnnual } from '../lib/calculations'
import { fmtVND, fmtVNDFull } from '../lib/formatters'
import KPICard from '../components/ui/KPICard'
import { AssetLineChart, CashFlowBarChart, AssetDoughnut } from '../components/charts/AppCharts'

export default function Dashboard() {
  const { state, getAlloc } = useApp()
  const { assumptions } = state

  const quarters = useMemo(() => computeQuarters(assumptions), [assumptions])
  const last = quarters[quarters.length - 1]
  const first = quarters[0]
  const growth = last && assumptions.initialCash > 0
    ? ((last.totalAssets / assumptions.initialCash)).toFixed(1) + 'x'
    : '—'

  const kpis = [
    { label:'Tổng Tài Sản Ròng',     value: fmtVND(last?.totalAssets), sub:`Cuối quý ${assumptions.numQuarters}`, variant:'green',  icon:'💰' },
    { label:'Danh Mục Đầu Tư',        value: fmtVND(last?.portfolio),   sub:`Lãi kép ${assumptions.investYieldPerYear}%/năm`, variant:'blue', icon:'📈' },
    { label:'Tiền Mặt Dự Phòng',      value: fmtVND(last?.closingCash), sub:`Tối thiểu ${fmtVND(assumptions.minCashReserve)}`, variant:'purple', icon:'🏦' },
    { label:'Dư Nợ Ngân Hàng',        value: fmtVND(last?.debt),        sub:`Gốc ${fmtVND(assumptions.bankDebt)} · ${assumptions.bankRate}%/năm`, variant: last?.debt===0 ? 'green':'red', icon:'🏛️' },
    { label:'Lợi Nhuận Q1 Năm 1',     value: fmtVND(first?.profit),     sub:`Tăng ${assumptions.profitGrowthPerYear}%/năm`, variant:'gold', icon:'💼' },
    { label:'Tăng Trưởng Tài Sản',    value: growth,                     sub:`Từ ${fmtVND(assumptions.initialCash)} vốn ban đầu`, variant:'green', icon:'🚀' },
  ]

  return (
    <div className="p-6 max-w-6xl">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        {kpis.map(k => <KPICard key={k.label} {...k} />)}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="card">
          <div className="text-sm font-semibold text-muted mb-4">📈 Tổng Tài Sản Ròng – {assumptions.numQuarters} Quý</div>
          <div className="h-64"><AssetLineChart quarters={quarters} /></div>
        </div>
        <div className="card">
          <div className="text-sm font-semibold text-muted mb-4">🏦 Cơ Cấu Tài Sản Năm Cuối</div>
          <div className="h-64">{last && <AssetDoughnut lastQ={last} />}</div>
        </div>
      </div>

      <div className="card">
        <div className="text-sm font-semibold text-muted mb-4">💵 Dòng Tiền & Đầu Tư Theo Quý</div>
        <div className="h-64"><CashFlowBarChart quarters={quarters} /></div>
      </div>
    </div>
  )
}
