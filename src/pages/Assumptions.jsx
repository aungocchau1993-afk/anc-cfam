import { SlidersHorizontal, Wallet, BarChart3, Home, Landmark, LineChart } from 'lucide-react'
import { useApp } from '../context/AppContext'
import MoneyInput from '../components/ui/MoneyInput'
import PageHeader from '../components/ui/PageHeader'

const SECTIONS = [
  { title:'Vốn & Thời Gian', icon: Wallet, fields:[
    { key:'initialCash',          label:'Số dư tiền mặt ban đầu (₫)', type:'money' },
    { key:'startYear',            label:'Năm bắt đầu',                 type:'int' },
    { key:'numQuarters',          label:'Số quý lập kế hoạch',         type:'int' },
  ]},
  { title:'Thu Nhập Kinh Doanh', icon: BarChart3, fields:[
    { key:'monthlyProfit',        label:'Lợi nhuận / tháng – Năm 1 (₫)', type:'money' },
    { key:'profitGrowthPerYear',  label:'Tăng trưởng lợi nhuận / năm (%)', type:'pct' },
  ]},
  { title:'Chi Phí Cố Định', icon: Home, fields:[
    { key:'monthlyLiving',        label:'Chi phí sinh hoạt / tháng (₫)', type:'money' },
    { key:'monthlyHousing',       label:'Chi phí nhà ở / tháng (₫)',     type:'money' },
    { key:'expenseInflation',     label:'Lạm phát chi phí / năm (%)',    type:'pct' },
  ]},
  { title:'Vay Ngân Hàng', icon: Landmark, fields:[
    { key:'bankDebt',             label:'Dư nợ gốc ban đầu (₫)',         type:'money' },
    { key:'bankRate',             label:'Lãi suất vay / năm (%)',         type:'pct' },
    { key:'debtRepayPerQuarter',  label:'Trả gốc cố định / quý (₫)',     type:'money' },
  ]},
  { title:'Phân Bổ Đầu Tư', icon: LineChart, fields:[
    { key:'investRatio',          label:'% dòng tiền thặng dư đầu tư',   type:'pct' },
    { key:'investYieldPerYear',   label:'Lợi suất kỳ vọng / năm (%)',    type:'pct' },
    { key:'minCashReserve',       label:'Quỹ dự phòng tối thiểu (₫)',    type:'money' },
  ]},
]

export default function Assumptions() {
  const { state, actions } = useApp()
  const a = state.assumptions

  return (
    <div className="w-full">
      <PageHeader
        icon={SlidersHorizontal}
        title="Giả Định"
        subtitle="Các thông số đầu vào dùng để tính toán dòng tiền và tài sản"
      />
    <div className="p-6 max-w-5xl">
      <div className="bg-cblue/10 border border-cblue/20 rounded-lg px-4 py-3 text-sm text-cblue mb-6">
        Thay đổi bất kỳ giá trị nào → toàn bộ bảng tính tự cập nhật ngay lập tức
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SECTIONS.map(s => (
          <div key={s.title} className="card">
            <h4 className="flex items-center gap-1.5 text-[12px] font-bold text-cblue uppercase tracking-wider mb-3">
              <s.icon size={14} strokeWidth={2.2} />
              {s.title}
            </h4>
            {s.fields.map(f => (
              <div key={f.key} className="mb-3 last:mb-0">
                <label className="text-xs text-muted block mb-1">{f.label}</label>
                {f.type === 'money'
                  ? <MoneyInput value={a[f.key]} onChange={v => actions.setAssumption(f.key, v)} />
                  : <input
                      type="number"
                      step={f.type === 'pct' ? '0.1' : '1'}
                      value={a[f.key]}
                      onChange={e => actions.setAssumption(f.key, parseFloat(e.target.value)||0)}
                      className="input-base"
                    />
                }
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
    </div>
  )
}
