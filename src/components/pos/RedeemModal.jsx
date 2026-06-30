import { useState } from 'react'
import { toast } from 'sonner'
import { Gift, X, Check, LoaderCircle } from 'lucide-react'
import ModalOverlay from '../ui/ModalOverlay'

const REWARD_CATALOG = [
  { id: 1, name: 'Túi vải thân thiện',    points: 50,   icon: '👜' },
  { id: 2, name: 'Voucher giảm 50K',       points: 100,  icon: '🎫' },
  { id: 3, name: 'Bình nước inox 500ml',   points: 200,  icon: '🍶' },
  { id: 4, name: 'Hộp quà chăm sóc',      points: 500,  icon: '🎁' },
  { id: 5, name: 'Voucher giảm 500K',      points: 1000, icon: '💳' },
]

export default function RedeemModal({ customer, onRedeem, onClose }) {
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(false)
  const available = customer?.rewardPoints ?? 0

  async function handleConfirm() {
    if (!selected) return
    setLoading(true)
    try {
      await onRedeem(selected.points, `Đổi quà: ${selected.name}`)
      toast.success(`✅ Đã đổi ${selected.points} điểm lấy ${selected.name}`)
      onClose()
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white border border-slate-800 rounded-2xl w-full max-w-sm mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift size={18} strokeWidth={2} className="text-amber-500" />
            <div>
              <div className="font-bold text-[#1e293b]">Đổi Điểm Lấy Quà</div>
              <div className="text-xs text-slate-500 mt-0.5">Điểm hiện có: <strong className="text-amber-600">{available.toLocaleString('vi-VN')} điểm</strong></div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-slate-800 text-slate-400 hover:text-rose-500 transition-colors flex items-center justify-center"><X size={15} strokeWidth={2.2} /></button>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {REWARD_CATALOG.map(item => {
            const canAfford = available >= item.points
            const isSelected = selected?.id === item.id
            return (
              <button
                key={item.id}
                disabled={!canAfford}
                onClick={() => setSelected(isSelected ? null : item)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all
                  ${isSelected
                    ? 'bg-amber-50 border-amber-300 text-[#1e293b]'
                    : canAfford
                    ? 'bg-surface2 border-slate-800 hover:border-slate-600 text-[#1e293b]'
                    : 'bg-surface2/50 border-slate-800 text-slate-400 cursor-not-allowed opacity-50'
                  }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{item.name}</div>
                  <div className={`text-[11px] font-bold ${canAfford ? 'text-amber-600' : 'text-slate-400'}`}>
                    {item.points.toLocaleString('vi-VN')} điểm
                  </div>
                </div>
                {isSelected && <Check size={18} strokeWidth={2.5} className="text-amber-500 shrink-0" />}
              </button>
            )
          })}
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-800 text-slate-500 text-sm hover:text-[#1e293b] transition-colors">
            Huỷ
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {loading ? <LoaderCircle size={15} strokeWidth={2.2} className="animate-spin" /> : null}
            {loading ? 'Đang xử lý…' : `Đổi ${selected?.points ?? 0} điểm`}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
