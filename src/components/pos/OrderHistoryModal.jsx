import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { History, X, User } from 'lucide-react'
import { loadOrders, cancelOrder } from '../../lib/supabase'
import { fmtVNDFull } from '../../lib/formatters'
import ModalOverlay from '../ui/ModalOverlay'

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

export default function OrderHistoryModal({ onClose }) {
  const [orders, setOrders]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOrders(30).then(setOrders).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }, [])

  async function handleCancel(id) {
    if (!window.confirm('Huỷ đơn hàng này?')) return
    try {
      await cancelOrder(id)
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'cancelled' } : o))
      toast.success('Đã huỷ đơn')
    } catch (e) { toast.error(e.message) }
  }

  const statusMap = {
    completed: { l: 'Hoàn thành', c: 'text-cgreen' },
    pending:   { l: 'Chờ xử lý',  c: 'text-amber-700' },
    cancelled: { l: 'Đã huỷ',     c: 'text-rose-500' },
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 font-bold text-base text-[#111827]">
            <History size={18} strokeWidth={2} /> Lịch sử đơn hàng
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-slate-800 text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center"><X size={15} strokeWidth={2.2} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-12 text-slate-400">Đang tải…</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 text-slate-400">Chưa có đơn hàng nào</div>
          ) : (
            <div className="flex flex-col gap-3">
              {orders.map(ord => {
                const st    = statusMap[ord.status] || { l: ord.status, c: 'text-slate-400' }
                const items = ord.order_items || []
                return (
                  <div key={ord.id} className="rounded-xl border border-slate-800 bg-surface2/50 p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400">#{ord.id.slice(-8).toUpperCase()}</span>
                          <span className={`text-xs font-bold ${st.c}`}>{st.l}</span>
                          {ord.customers && (
                            <span className="text-xs text-violet-500 flex items-center gap-1"><User size={11} strokeWidth={2.2} /> {ord.customers.full_name}</span>
                          )}
                        </div>
                        <div className="text-[12px] text-slate-400 mt-0.5">{fmtDate(ord.created_at)}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-sm text-[#111827] tabular-nums">{fmtVNDFull(ord.total_amount)}</div>
                        {ord.profit != null && (
                          <div className="text-[12px] text-cgreen">+{fmtVNDFull(ord.profit)} LN</div>
                        )}
                      </div>
                    </div>
                    {items.length > 0 && (
                      <div className="border-t border-slate-800/60 pt-2 flex flex-col gap-1">
                        {items.map(item => (
                          <div key={item.id} className="flex justify-between text-xs text-slate-500">
                            <span className="truncate flex-1">{item.products?.name || '—'}</span>
                            <span className="ml-3 shrink-0 font-mono">x{item.quantity} · {fmtVNDFull(item.price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ord.note && <div className="mt-2 text-[12px] text-slate-400 italic">📝 {ord.note}</div>}
                    {ord.status === 'completed' && (
                      <div className="mt-2 flex justify-end">
                        <button onClick={() => handleCancel(ord.id)}
                          className="text-[12px] text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 rounded hover:bg-rose-50">
                          Huỷ đơn
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}
