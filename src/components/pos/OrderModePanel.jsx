import { motion } from 'framer-motion'
import { User, Phone, MapPin, CalendarDays, Truck, Receipt, Wallet, UserCog, Globe2, FileEdit } from 'lucide-react'
import { fmtVNDFull } from '../../lib/formatters'
import { SALE_CHANNELS, DELIVERY_METHODS } from './posUtils'

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 mb-1">
        <Icon size={12} strokeWidth={2.2} /> {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = 'w-full h-9 bg-surface2 border border-slate-800 rounded-lg px-2.5 text-[13px] text-[#111827] placeholder:text-slate-400 outline-none focus:border-cblue focus:ring-2 focus:ring-cblue/10 transition-all'

export default function OrderModePanel({ details, onChange, customer }) {
  const patch = p => onChange({ ...details, ...p })

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="shrink-0 px-5 py-4 border-b border-slate-800 bg-amber-50/40 flex flex-col gap-3"
    >
      <div className="grid grid-cols-2 gap-2.5">
        <Field icon={User} label="Người nhận">
          <input className={inputCls} placeholder="Tên người nhận"
            value={details.receiverName} onChange={e => patch({ receiverName: e.target.value })} />
        </Field>
        <Field icon={Phone} label="Số điện thoại">
          <input className={inputCls} placeholder="09xxxxxxxx" inputMode="tel"
            value={details.receiverPhone} onChange={e => patch({ receiverPhone: e.target.value })} />
        </Field>
      </div>

      <Field icon={MapPin} label="Địa chỉ giao hàng">
        <input className={inputCls} placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
          value={details.deliveryAddress} onChange={e => patch({ deliveryAddress: e.target.value })} />
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field icon={CalendarDays} label="Ngày giao">
          <input type="date" className={inputCls}
            value={details.deliveryDate} onChange={e => patch({ deliveryDate: e.target.value })} />
        </Field>
        <Field icon={Truck} label="Phương thức giao">
          <select className={inputCls} value={details.deliveryMethod} onChange={e => patch({ deliveryMethod: e.target.value })}>
            {DELIVERY_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field icon={Globe2} label="Kênh bán">
          <select className={inputCls} value={details.channelId} onChange={e => patch({ channelId: e.target.value })}>
            {SALE_CHANNELS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field icon={UserCog} label="Nhân viên phụ trách">
          <input className={inputCls} placeholder="Tên nhân viên"
            value={details.staffName} onChange={e => patch({ staffName: e.target.value })} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2.5 items-end">
        <Field icon={Receipt} label="VAT">
          <div className="flex items-center gap-2 h-9">
            <button type="button" onClick={() => patch({ vatEnabled: !details.vatEnabled })}
              className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${details.vatEnabled ? 'bg-cblue' : 'bg-slate-700'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${details.vatEnabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <input type="number" min="0" max="100" disabled={!details.vatEnabled}
              className={`${inputCls} disabled:opacity-40`} placeholder="%"
              value={details.vatRate} onChange={e => patch({ vatRate: e.target.value })} />
          </div>
        </Field>
        <Field icon={Wallet} label="Đặt cọc">
          <input inputMode="numeric" className={inputCls} placeholder="0"
            value={details.deposit} onChange={e => patch({ deposit: e.target.value.replace(/[^\d]/g, '') })} />
        </Field>
      </div>

      {customer && (customer.currentDebt ?? 0) > 0 && (
        <div className="flex justify-between items-center rounded-lg bg-rose-50 border border-rose-200 px-3 py-2">
          <span className="text-[12px] font-bold text-rose-700">Công nợ hiện tại của khách</span>
          <span className="font-mono font-black text-[13px] text-rose-700 tabular-nums">{fmtVNDFull(customer.currentDebt)}</span>
        </div>
      )}

      <Field icon={FileEdit} label="Ghi chú nội bộ">
        <textarea rows={2} className={`${inputCls} h-auto py-2 resize-none`} placeholder="Ghi chú riêng cho nội bộ, không in lên hoá đơn khách…"
          value={details.internalNote} onChange={e => patch({ internalNote: e.target.value })} />
      </Field>
    </motion.div>
  )
}
