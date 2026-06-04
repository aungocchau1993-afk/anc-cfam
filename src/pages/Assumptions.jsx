import { useApp } from '../context/AppContext'
import MoneyInput from '../components/ui/MoneyInput'

const SECTIONS = [
  { title:'💵 Vốn & Thời Gian', fields:[
    { key:'initialCash',          label:'Số dư tiền mặt ban đầu (₫)', type:'money' },
    { key:'startYear',            label:'Năm bắt đầu',                 type:'int' },
    { key:'numQuarters',          label:'Số quý lập kế hoạch',         type:'int' },
  ]},
  { title:'📊 Thu Nhập Kinh Doanh', fields:[
    { key:'monthlyProfit',        label:'Lợi nhuận / tháng – Năm 1 (₫)', type:'money' },
    { key:'profitGrowthPerYear',  label:'Tăng trưởng lợi nhuận / năm (%)', type:'pct' },
  ]},
  { title:'🏠 Chi Phí Cố Định', fields:[
    { key:'monthlyLiving',        label:'Chi phí sinh hoạt / tháng (₫)', type:'money' },
    { key:'monthlyHousing',       label:'Chi phí nhà ở / tháng (₫)',     type:'money' },
    { key:'expenseInflation',     label:'Lạm phát chi phí / năm (%)',    type:'pct' },
  ]},
  { title:'🏛️ Vay Ngân Hàng', fields:[
    { key:'bankDebt',             label:'Dư nợ gốc ban đầu (₫)',         type:'money' },
    { key:'bankRate',             label:'Lãi suất vay / năm (%)',         type:'pct' },
    { key:'debtRepayPerQuarter',  label:'Trả gốc cố định / quý (₫)',     type:'money' },
  ]},
  { title:'📈 Phân Bổ Đầu Tư', fields:[
    { key:'investRatio',          label:'% dòng tiền thặng dư đầu tư',   type:'pct' },
    { key:'investYieldPerYear',   label:'Lợi suất kỳ vọng / năm (%)',    type:'pct' },
    { key:'minCashReserve',       label:'Quỹ dự phòng tối thiểu (₫)',    type:'money' },
  ]},
]

export default function Assumptions() {
  const { state, actions } = useApp()
  const a = state.assumptions

  return (
    <div className="p-6 max-w-5xl">
      <div className="bg-cblue/10 border border-cblue/20 rounded-lg px-4 py-3 text-sm text-cblue mb-6">
        💡 Thay đổi bất kỳ giá trị nào → toàn bộ bảng tính tự cập nhật ngay lập tức
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SECTIONS.map(s => (
          <div key={s.title} className="card">
            <h4 className="text-[11px] font-bold text-cblue uppercase tracking-wider mb-3">{s.title}</h4>
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
  )
}
