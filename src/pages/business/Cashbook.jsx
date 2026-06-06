import { useState, useEffect, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import { loadCashbook, insertCashbookTx, deleteCashbookTx } from '../../lib/supabase'
import { fmtVNDFull, formatMoneyLive, parseVNDInput } from '../../lib/formatters'
import ModalOverlay from '../../components/ui/ModalOverlay'
import DateFilterBar, { getDateRange, toInputDate, startOf } from '../../components/ui/DateFilterBar'

// ── Constants ──────────────────────────────────────────────────────────────

const THU_CATS = ['Khách trả nợ', 'Bán hàng (tiền mặt)', 'Thu ngoài', 'Khác']
const CHI_CATS = ['Trả lương', 'Tiền điện / nước', 'Phí vận chuyển', 'Nhập hàng', 'Ăn uống', 'Chi phí khác']

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtDatetime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

// ── Add Transaction Modal ──────────────────────────────────────────────────

function TxModal({ onSave, onClose }) {
  const [type,     setType]     = useState('THU')
  const [amount,   setAmount]   = useState('')
  const [category, setCategory] = useState('')
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)

  const cats = type === 'THU' ? THU_CATS : CHI_CATS

  async function handleSubmit(e) {
    e.preventDefault()
    const amt = parseVNDInput(amount)
    if (!amt || amt <= 0) { toast.error('Vui lòng nhập số tiền hợp lệ'); return }
    if (!category)        { toast.error('Vui lòng chọn danh mục'); return }
    setSaving(true)
    try {
      await onSave({ type, amount: amt, category, notes })
      onClose()
    } catch (e) {
      toast.error(e.message || 'Lỗi lưu')
    } finally {
      setSaving(false)
    }
  }

  const iCls = 'w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2.5 text-sm text-[#e6edf3] placeholder:text-slate-600 outline-none transition-all'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-[#0d1117] border border-slate-700/80 rounded-2xl w-full max-w-sm mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="font-bold text-base text-[#e6edf3]">💰 Tạo Phiếu Thu / Chi</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-cred transition-colors text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">

          {/* Toggle THU / CHI */}
          <div className="flex rounded-xl overflow-hidden border border-slate-700">
            {['THU', 'CHI'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setType(t); setCategory('') }}
                className={`flex-1 py-2.5 text-sm font-black transition-colors ${
                  type === t
                    ? t === 'THU'
                      ? 'bg-cgreen text-white'
                      : 'bg-cred text-white'
                    : 'bg-slate-800 text-slate-500 hover:text-[#e6edf3]'
                }`}
              >
                {t === 'THU' ? '⬆️ THU' : '⬇️ CHI'}
              </button>
            ))}
          </div>

          {/* Số tiền */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Số tiền (₫) *</label>
            <input
              autoFocus
              className={`${iCls} text-right font-mono text-xl font-black ${type === 'THU' ? 'text-cgreen border-cgreen/40 focus:border-cgreen focus:ring-1 focus:ring-cgreen/20' : 'text-cred border-cred/40 focus:border-cred focus:ring-1 focus:ring-cred/20'}`}
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={e => setAmount(formatMoneyLive(e.target.value))}
            />
          </div>

          {/* Danh mục */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Danh mục *</label>
            <select
              className={`${iCls} cursor-pointer focus:border-cblue`}
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">— Chọn danh mục —</option>
              {cats.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Ghi chú */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Ghi chú</label>
            <textarea
              className={`${iCls} resize-none focus:border-cblue`}
              rows={2}
              placeholder="Nội dung chi tiết…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:text-[#e6edf3] transition-colors">Huỷ</button>
            <button
              type="submit"
              disabled={saving}
              className={`px-6 py-2 rounded-lg text-white text-sm font-bold transition-all disabled:opacity-60 ${type === 'THU' ? 'bg-cgreen hover:brightness-110' : 'bg-cred hover:brightness-110'}`}
            >
              {saving ? 'Đang lưu…' : `Tạo phiếu ${type}`}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Cashbook() {
  const [transactions, setTransactions] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [showModal,    setShowModal]    = useState(false)
  const [deleting,     setDeleting]     = useState(null)

  // ── Bộ lọc thời gian ──────────────────────────────────────────────────────
  const [preset,     setPreset]     = useState('month')
  const [customFrom, setCustomFrom] = useState(toInputDate(startOf('month')))
  const [customTo,   setCustomTo]   = useState(toInputDate(new Date()))

  const fetchData = useCallback(async () => {
    const { from, to } = getDateRange(preset, customFrom, customTo)
    if (!from || !to) return
    setLoading(true)
    try {
      const data = await loadCashbook({ from: from.toISOString(), to: to.toISOString() })
      setTransactions(data)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [preset, customFrom, customTo])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Thống kê ──────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalThu = transactions
      .filter(t => t.transaction_type === 'THU')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0)
    const totalChi = transactions
      .filter(t => t.transaction_type === 'CHI')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0)
    return { totalThu, totalChi, balance: totalThu - totalChi }
  }, [transactions])

  // ── Thêm giao dịch ────────────────────────────────────────────────────────
  async function handleSave(tx) {
    const saved = await insertCashbookTx(tx)
    // Thêm vào đầu danh sách nếu nằm trong khoảng thời gian đang xem
    const { from, to } = getDateRange(preset, customFrom, customTo)
    const d = new Date(saved.created_at)
    if (!from || !to || (d >= from && d <= to)) {
      setTransactions(prev => [saved, ...prev])
    }
    toast.success(`✅ Đã ghi phiếu ${tx.type}: ${fmtVNDFull(tx.amount)}`)
  }

  // ── Xoá giao dịch ─────────────────────────────────────────────────────────
  async function handleDelete(id) {
    if (!window.confirm('Xoá giao dịch này?')) return
    setDeleting(id)
    try {
      await deleteCashbookTx(id)
      setTransactions(prev => prev.filter(t => t.id !== id))
      toast.success('Đã xoá giao dịch')
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6 max-w-5xl flex flex-col gap-5">

      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#e6edf3]">💵 Sổ Quỹ Thu Chi</h2>
          <p className="text-xs text-slate-500 mt-0.5">Ghi chép dòng tiền ngoài bán hàng</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cblue hover:brightness-110 text-white text-sm font-bold transition-all shadow-lg shadow-cblue/20 whitespace-nowrap"
        >
          ＋ Tạo phiếu Thu/Chi
        </button>
      </div>

      {/* ── Bộ lọc thời gian ─────────────────────────────────────── */}
      <DateFilterBar
        preset={preset}     setPreset={setPreset}
        customFrom={customFrom} setCustomFrom={setCustomFrom}
        customTo={customTo}   setCustomTo={setCustomTo}
        onRefresh={fetchData}
        loading={loading}
        showAllTime={true}
      />

      {/* ── Thẻ thống kê ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-cgreen/25 bg-cgreen/8 p-5">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">⬆️ Tổng Thu</div>
          <div className="text-3xl font-black tabular-nums text-cgreen">{fmtVNDFull(stats.totalThu)}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {transactions.filter(t => t.transaction_type === 'THU').length} giao dịch
          </div>
        </div>
        <div className="rounded-2xl border border-cred/25 bg-cred/8 p-5">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">⬇️ Tổng Chi</div>
          <div className="text-3xl font-black tabular-nums text-cred">{fmtVNDFull(stats.totalChi)}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {transactions.filter(t => t.transaction_type === 'CHI').length} giao dịch
          </div>
        </div>
        <div className={`rounded-2xl border p-5 ${
          stats.balance >= 0
            ? 'border-cblue/25 bg-cblue/8'
            : 'border-cred/25 bg-cred/8'
        }`}>
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2">💰 Tồn Quỹ</div>
          <div className={`text-3xl font-black tabular-nums ${stats.balance >= 0 ? 'text-cblue' : 'text-cred'}`}>
            {fmtVNDFull(stats.balance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {preset === 'month' ? `Tháng ${new Date().getMonth()+1}/${new Date().getFullYear()}` : preset === 'custom' ? `${customFrom} → ${customTo}` : preset}
          </div>
        </div>
      </div>

      {/* ── Bảng giao dịch ───────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-sm font-bold text-[#e6edf3]">Lịch Sử Giao Dịch</span>
          <span className="text-xs text-slate-500">{transactions.length} giao dịch</span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500 text-sm">Đang tải…</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-20 text-slate-600">
            <div className="text-5xl mb-3">💵</div>
            <div className="font-semibold">Chưa có giao dịch nào trong khoảng thời gian này</div>
            <button onClick={() => setShowModal(true)} className="mt-4 px-5 py-2 rounded-xl bg-cblue hover:brightness-110 text-white text-sm font-bold transition-all">
              ＋ Tạo phiếu đầu tiên
            </button>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800">
                  {['Thời gian', 'Loại', 'Danh mục', 'Ghi chú', 'Số tiền', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${h === 'Số tiền' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {transactions.map(tx => {
                  const isThu = tx.transaction_type === 'THU'
                  return (
                    <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap font-mono">
                        {fmtDatetime(tx.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-black ${
                          isThu
                            ? 'bg-cgreen/15 text-cgreen border-cgreen/30'
                            : 'bg-cred/15 text-cred border-cred/30'
                        }`}>
                          {isThu ? '⬆ THU' : '⬇ CHI'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[#e6edf3] whitespace-nowrap">
                        {tx.category}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400 max-w-[200px]">
                        <div className="truncate">{tx.notes || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`text-sm font-black tabular-nums font-mono ${isThu ? 'text-cgreen' : 'text-cred'}`}>
                          {isThu ? '+' : '-'}{fmtVNDFull(tx.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleDelete(tx.id)}
                          disabled={deleting === tx.id}
                          className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md border border-slate-700 text-slate-500 hover:border-cred hover:text-cred hover:bg-cred/10 transition-all flex items-center justify-center disabled:opacity-50"
                          title="Xoá giao dịch"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                            <path d="M9 3h6m-8 5h10m-9 0l.6 12h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && <TxModal onSave={handleSave} onClose={() => setShowModal(false)} />}
    </div>
  )
}
