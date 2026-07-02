import { useMemo } from 'react'
import { CalendarDays, BarChart3 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { computeQuarters, computeAnnual } from '../lib/calculations'
import { fmtVND } from '../lib/formatters'
import { AnnualChart } from '../components/charts/AppCharts'
import PageHeader from '../components/ui/PageHeader'

function SummaryCard({ label, value, sub, tone = 'blue' }) {
  const tones = {
    blue: 'border-cblue/25 bg-cblue/10',
    green: 'border-cgreen/25 bg-cgreen/10',
    red: 'border-cred/25 bg-cred/10',
    gold: 'border-cyellow/25 bg-cyellow/10',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 text-2xl font-black tabular-nums text-text">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-subtle">{sub}</div>}
    </div>
  )
}

function MoneyCell({ children, className = '' }) {
  return (
    <td className={`px-4 py-3 text-right text-xs font-mono tabular-nums whitespace-nowrap min-w-[120px] ${className}`}>
      {children}
    </td>
  )
}

export default function AnnualSummary() {
  const { state } = useApp()
  const quarters = useMemo(() => computeQuarters(state.assumptions), [state.assumptions])
  const annual = useMemo(() => computeAnnual(quarters), [quarters])

  const totals = useMemo(() => {
    const last = annual[annual.length - 1]
    return {
      profit: annual.reduce((s, a) => s + a.profit, 0),
      expense: annual.reduce((s, a) => s + a.living + a.housing + a.interest + a.repay, 0),
      netCF: annual.reduce((s, a) => s + a.netCF, 0),
      invest: annual.reduce((s, a) => s + a.invest, 0),
      totalAssets: last?.totalAssets || 0,
    }
  }, [annual])

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarDays}
        title="Tổng Hợp Năm"
        subtitle="So sánh thu nhập, chi phí, thặng dư, đầu tư và tài sản cuối năm"
      />
    <div className="p-6 max-w-7xl">

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <SummaryCard label="Tổng Thu Nhập" value={fmtVND(totals.profit)} sub={`${annual.length} năm kế hoạch`} tone="green" />
        <SummaryCard label="Tổng Chi Phí" value={fmtVND(totals.expense)} sub="Chi phí, lãi vay và trả gốc" tone="red" />
        <SummaryCard label="Thặng Dư" value={fmtVND(totals.netCF)} sub="Dòng tiền thuần toàn kỳ" tone={totals.netCF >= 0 ? 'green' : 'red'} />
        <SummaryCard label="Phân Bổ Đầu Tư" value={fmtVND(totals.invest)} sub={`Tài sản cuối kỳ ${fmtVND(totals.totalAssets)}`} tone="blue" />
      </div>

      <div className="card mb-5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-muted mb-4">
          <BarChart3 size={15} strokeWidth={2.2} /> Tổng Hợp {annual.length} Năm
        </div>
        <div className="h-64"><AnnualChart annual={annual} /></div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-cardtitle font-bold text-text">Bảng Tổng Hợp Theo Năm</div>
          <div className="text-xs text-muted mt-0.5">So sánh thu nhập, chi phí, thặng dư, đầu tư và tài sản cuối năm</div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-gray-50">
                {['Năm','Thu nhập','Chi phí','Lãi NH','Trả gốc','Thặng dư','Đầu tư','Tiền cuối năm','Danh mục ĐT','Dư nợ','Tổng TS ròng'].map((h, idx) => (
                  <th
                    key={h}
                    className={`${idx === 0 ? 'text-left min-w-[90px]' : 'text-right min-w-[120px]'} sticky top-0 z-10 px-4 py-3 text-xs uppercase font-semibold text-muted whitespace-nowrap bg-gray-50`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {annual.map(a => {
                const totalExpense = a.living + a.housing + a.interest + a.repay

                return (
                  <tr key={a.year} className="border-b border-border last:border-b-0 hover:bg-surface2 transition-colors">
                    <td className="px-4 py-3 text-left whitespace-nowrap min-w-[90px]">
                      <span className="rounded-full bg-cblue/10 border border-cblue/20 px-2.5 py-1 text-xs font-black text-cblue">
                        {a.year}
                      </span>
                    </td>
                    <MoneyCell className="font-semibold text-cgreen">+{fmtVND(a.profit)}</MoneyCell>
                    <MoneyCell className="text-text">-{fmtVND(totalExpense)}</MoneyCell>
                    <MoneyCell className="text-text">-{fmtVND(a.interest)}</MoneyCell>
                    <MoneyCell className="text-text">-{fmtVND(a.repay)}</MoneyCell>
                    <MoneyCell className={`font-black ${a.netCF >= 0 ? 'text-cgreen' : 'text-cred'}`}>{a.netCF >= 0 ? '+' : ''}{fmtVND(a.netCF)}</MoneyCell>
                    <MoneyCell className="text-cblue">-{fmtVND(a.invest)}</MoneyCell>
                    <MoneyCell className="font-semibold text-text">{fmtVND(a.endCash)}</MoneyCell>
                    <MoneyCell className="font-semibold text-cteal">{fmtVND(a.endPortfolio)}</MoneyCell>
                    <MoneyCell className={a.endDebt > 0 ? 'text-cred' : 'text-cgreen'}>{a.endDebt > 0 ? `(${fmtVND(a.endDebt)})` : 'Hết nợ'}</MoneyCell>
                    <MoneyCell className="font-black text-cblue">{fmtVND(a.totalAssets)}</MoneyCell>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  )
}
