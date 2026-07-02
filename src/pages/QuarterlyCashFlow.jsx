import { useMemo } from 'react'
import { CalendarRange, TrendingUp } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { computeQuarters } from '../lib/calculations'
import { fmtVND } from '../lib/formatters'
import { AssetLineChart } from '../components/charts/AppCharts'
import PageHeader from '../components/ui/PageHeader'

const Y_ACCENTS = ['#2563eb','#7c3aed','#16a34a','#f59e0b','#0d9488']

function SummaryCard({ label, value, sub, tone = 'blue' }) {
  const tones = {
    blue: 'border-cblue/25 bg-cblue/10 text-cblue',
    green: 'border-cgreen/25 bg-cgreen/10 text-cgreen',
    red: 'border-cred/25 bg-cred/10 text-cred',
    gold: 'border-cyellow/25 bg-cyellow/10 text-cyellow',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-2 text-2xl font-black tabular-nums text-text">{value}</div>
      {sub && <div className="mt-1 text-[12px] text-subtle">{sub}</div>}
    </div>
  )
}

function MoneyCell({ children, className = '', style }) {
  return (
    <td className={`px-3.5 py-3 text-right text-xs font-mono tabular-nums whitespace-nowrap min-w-[120px] ${className}`} style={style}>
      {children}
    </td>
  )
}

export default function QuarterlyCashFlow() {
  const { state } = useApp()
  const quarters = useMemo(() => computeQuarters(state.assumptions), [state.assumptions])

  const byYear = useMemo(() => {
    const m = {}
    quarters.forEach(q => { if (!m[q.year]) m[q.year] = []; m[q.year].push(q) })
    return Object.entries(m)
  }, [quarters])

  const totals = useMemo(() => {
    const last = quarters[quarters.length - 1]
    return {
      profit: quarters.reduce((s, q) => s + q.profit, 0),
      expense: quarters.reduce((s, q) => s + q.living + q.housing + q.interest + q.repay, 0),
      netCF: quarters.reduce((s, q) => s + q.netCF, 0),
      invest: quarters.reduce((s, q) => s + q.invest, 0),
      totalAssets: last?.totalAssets || 0,
    }
  }, [quarters])

  return (
    <div className="w-full">
      <PageHeader
        icon={CalendarRange}
        title="Dòng Tiền Quý"
        subtitle="Chi tiết thu, chi, đầu tư, nợ và tổng tài sản ròng theo từng quý"
      />
    <div className="p-6 max-w-full">

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <SummaryCard label="Tổng Thu Nhập" value={fmtVND(totals.profit)} sub={`${quarters.length} quý kế hoạch`} tone="green" />
        <SummaryCard label="Tổng Chi Phí" value={fmtVND(totals.expense)} sub="Sinh hoạt, nhà ở, lãi và gốc vay" tone="red" />
        <SummaryCard label="Thặng Dư" value={fmtVND(totals.netCF)} sub="Dòng tiền thuần toàn kỳ" tone={totals.netCF >= 0 ? 'green' : 'red'} />
        <SummaryCard label="Phân Bổ Đầu Tư" value={fmtVND(totals.invest)} sub={`Tài sản cuối kỳ ${fmtVND(totals.totalAssets)}`} tone="blue" />
      </div>

      <div className="card mb-5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-muted mb-4">
          <TrendingUp size={15} strokeWidth={2.2} /> Xu Hướng Tài Sản Theo Quý
        </div>
        <div className="h-64"><AssetLineChart quarters={quarters} /></div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="px-5 py-4 border-b border-border">
          <div className="text-cardtitle font-bold text-text">Bảng Dòng Tiền Theo Quý</div>
          <div className="text-xs text-muted mt-0.5">Chi tiết thu, chi, đầu tư, nợ và tổng tài sản ròng</div>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-gray-50">
                {['Quý','Tồn đầu kỳ','Lợi nhuận','Chi phí','Lãi NH','Trả gốc','Dòng tiền thuần','Đầu tư','Tồn cuối','Danh mục','Dư nợ','Tổng TS ròng'].map((h, idx) => (
                  <th
                    key={h}
                    className={`${idx === 0 ? 'text-left min-w-[90px]' : 'text-right min-w-[120px]'} sticky top-0 z-10 px-3.5 py-3 text-xs uppercase font-semibold text-muted whitespace-nowrap bg-gray-50`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {byYear.map(([year, qs], yi) => {
                const accent = Y_ACCENTS[yi % Y_ACCENTS.length]
                const lastQ = qs[qs.length - 1]
                const yProfit = qs.reduce((s, q) => s + q.profit, 0)
                const yExpense = qs.reduce((s, q) => s + q.living + q.housing + q.interest + q.repay, 0)
                const yNetCF = qs.reduce((s, q) => s + q.netCF, 0)

                return [
                  <tr key={`y-${year}`} className="border-t border-border bg-surface2">
                    <td colSpan={12} className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-4">
                        <span className="font-black text-sm uppercase tracking-wide" style={{ color: accent }}>Năm {year}</span>
                        <span className="text-xs text-muted">Thu: <strong className="text-cgreen">{fmtVND(yProfit)}</strong></span>
                        <span className="text-xs text-muted">Chi: <strong className="text-text">{fmtVND(yExpense)}</strong></span>
                        <span className="text-xs text-muted">Thuần: <strong className={yNetCF >= 0 ? 'text-cgreen' : 'text-cred'}>{fmtVND(yNetCF)}</strong></span>
                        <span className="ml-auto text-xs text-muted">Tổng TS cuối: <strong style={{ color: accent }}>{fmtVND(lastQ.totalAssets)}</strong></span>
                      </div>
                    </td>
                  </tr>,
                  ...qs.map((q, qi) => (
                    <tr key={q.q} className="border-b border-border hover:bg-surface2 transition-colors">
                      <td className="px-3.5 py-3 text-left whitespace-nowrap min-w-[90px]">
                        <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ background:`${accent}22`, color:accent }}>
                          {['Q1','Q2','Q3','Q4'][qi]}
                        </span>
                      </td>
                      <MoneyCell className="text-muted">{fmtVND(q.openingCash)}</MoneyCell>
                      <MoneyCell className="font-semibold text-cgreen">+{fmtVND(q.profit)}</MoneyCell>
                      <MoneyCell className="text-text">-{fmtVND(q.living + q.housing)}</MoneyCell>
                      <MoneyCell className="text-text">-{fmtVND(q.interest)}</MoneyCell>
                      <MoneyCell className="text-text">-{fmtVND(q.repay)}</MoneyCell>
                      <MoneyCell className={`font-black ${q.netCF >= 0 ? 'text-cgreen' : 'text-cred'}`}>{q.netCF >= 0 ? '+' : ''}{fmtVND(q.netCF)}</MoneyCell>
                      <MoneyCell className="text-cblue">-{fmtVND(q.invest)}</MoneyCell>
                      <MoneyCell className="font-semibold text-text">{fmtVND(q.closingCash)}</MoneyCell>
                      <MoneyCell className="font-semibold text-cteal">{fmtVND(q.portfolio)}</MoneyCell>
                      <MoneyCell className={q.debt > 0 ? 'text-cred' : 'text-cgreen'}>{q.debt > 0 ? `(${fmtVND(q.debt)})` : 'Hết nợ'}</MoneyCell>
                      <MoneyCell className="font-black" style={{ color: accent }}>{fmtVND(q.totalAssets)}</MoneyCell>
                    </tr>
                  )),
                ]
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    </div>
  )
}
