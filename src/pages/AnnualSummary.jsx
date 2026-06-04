import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { computeQuarters, computeAnnual } from '../lib/calculations'
import { fmtVND } from '../lib/formatters'
import { AnnualChart } from '../components/charts/AppCharts'

function SummaryCard({ label, value, sub, tone = 'blue' }) {
  const tones = {
    blue: 'border-cblue/25 bg-cblue/10',
    green: 'border-cgreen/25 bg-cgreen/10',
    red: 'border-cred/25 bg-cred/10',
    gold: 'border-cyellow/25 bg-cyellow/10',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{label}</div>
      <div className="mt-2 text-2xl font-black tabular-nums text-[#e6edf3]">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-slate-500">{sub}</div>}
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
    <div className="p-6 max-w-7xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <SummaryCard label="Tổng Thu Nhập" value={fmtVND(totals.profit)} sub={`${annual.length} năm kế hoạch`} tone="green" />
        <SummaryCard label="Tổng Chi Phí" value={fmtVND(totals.expense)} sub="Chi phí, lãi vay và trả gốc" tone="red" />
        <SummaryCard label="Thặng Dư" value={fmtVND(totals.netCF)} sub="Dòng tiền thuần toàn kỳ" tone={totals.netCF >= 0 ? 'green' : 'red'} />
        <SummaryCard label="Phân Bổ Đầu Tư" value={fmtVND(totals.invest)} sub={`Tài sản cuối kỳ ${fmtVND(totals.totalAssets)}`} tone="blue" />
      </div>

      <div className="card mb-5">
        <div className="text-sm font-semibold text-muted mb-4">📊 Tổng Hợp {annual.length} Năm</div>
        <div className="h-64"><AnnualChart annual={annual} /></div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-2xl shadow-black/20">
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40">
          <div className="text-sm font-bold text-[#e6edf3]">Bảng Tổng Hợp Theo Năm</div>
          <div className="text-xs text-slate-500 mt-0.5">So sánh thu nhập, chi phí, thặng dư, đầu tư và tài sản cuối năm</div>
        </div>

        <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/30">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-slate-950/90">
                {['Năm','Thu nhập','Chi phí','Lãi NH','Trả gốc','Thặng dư','Đầu tư','Tiền cuối năm','Danh mục ĐT','Dư nợ','Tổng TS ròng'].map((h, idx) => (
                  <th
                    key={h}
                    className={`${idx === 0 ? 'text-left min-w-[90px]' : 'text-right min-w-[120px]'} sticky top-0 z-10 px-4 py-3 text-xs uppercase font-semibold text-slate-400 whitespace-nowrap bg-slate-950/95`}
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
                  <tr key={a.year} className="border-b border-slate-800/70 last:border-b-0 even:bg-slate-800/20 hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-left whitespace-nowrap min-w-[90px]">
                      <span className="rounded-full bg-cblue/10 border border-cblue/20 px-2.5 py-1 text-xs font-black text-cblue">
                        {a.year}
                      </span>
                    </td>
                    <MoneyCell className="font-semibold text-green-400">+{fmtVND(a.profit)}</MoneyCell>
                    <MoneyCell className="text-slate-300">-{fmtVND(totalExpense)}</MoneyCell>
                    <MoneyCell className="text-slate-300">-{fmtVND(a.interest)}</MoneyCell>
                    <MoneyCell className="text-slate-300">-{fmtVND(a.repay)}</MoneyCell>
                    <MoneyCell className={`font-black ${a.netCF >= 0 ? 'text-green-400' : 'text-red-400'}`}>{a.netCF >= 0 ? '+' : ''}{fmtVND(a.netCF)}</MoneyCell>
                    <MoneyCell className="text-cblue">-{fmtVND(a.invest)}</MoneyCell>
                    <MoneyCell className="font-semibold text-slate-100">{fmtVND(a.endCash)}</MoneyCell>
                    <MoneyCell className="font-semibold text-cteal">{fmtVND(a.endPortfolio)}</MoneyCell>
                    <MoneyCell className={a.endDebt > 0 ? 'text-red-400' : 'text-green-400'}>{a.endDebt > 0 ? `(${fmtVND(a.endDebt)})` : 'Hết nợ'}</MoneyCell>
                    <MoneyCell className="font-black text-cblue">{fmtVND(a.totalAssets)}</MoneyCell>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
