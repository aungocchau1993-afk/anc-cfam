import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useApp } from '../context/AppContext'
import { formatMoneyLive, parseVNDInput, fmtVNDFull } from '../lib/formatters'

// ── Helpers ────────────────────────────────────────────────────────────────

function maskCard(last4) {
  return `**** **** **** ${String(last4 || '0000').padStart(4, '0')}`
}

function bankInitials(bank) {
  return String(bank || '')
    .split(/\s+/)
    .map(p => p[0])
    .join('')
    .slice(0, 3)
    .toUpperCase()
}

function getNextDate(dayOfMonth) {
  if (!dayOfMonth) return null
  const today = new Date()
  let d = new Date(today.getFullYear(), today.getMonth(), dayOfMonth)
  if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth)
  return d
}

function getCardStatus(card) {
  if (!card.usedAmount) return { label: 'Không dư nợ', tone: 'blue' }
  const due = getNextDate(card.dueDate)
  if (!due) return { label: 'Còn hạn', tone: 'green' }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const days = Math.ceil((due - today) / 86400000)
  if (days < 0) return { label: 'Quá hạn', tone: 'red' }
  if (days <= 3) return { label: `Còn ${days} ngày`, tone: 'yellow' }
  return { label: `Còn ${days} ngày`, tone: 'green' }
}

function fmtDay(day) {
  return day ? `Ngày ${day} hàng tháng` : '—'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon, tone }) {
  const tones = {
    blue:   'from-[#0c2d54] to-[#1a4a7a] border-[#1a4a7a] text-cblue',
    red:    'from-[#4a1c1c] to-[#7a2c2c] border-[#7a2c2c] text-cred',
    green:  'from-[#0d4429] to-[#1a6b3d] border-[#2d5a3d] text-cgreen',
    gold:   'from-[#3d2800] to-[#6b4400] border-[#6b4400] text-cyellow',
  }
  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <div className="absolute right-4 top-4 text-3xl opacity-25">{icon}</div>
      <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wide mb-2">{label}</div>
      <div className="text-xl font-black text-white tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-white/50 mt-1.5">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    green:  'bg-cgreen/10  text-cgreen  border-cgreen/30',
    yellow: 'bg-cyellow/10 text-cyellow border-cyellow/40',
    red:    'bg-cred/10    text-cred    border-cred/40',
    blue:   'bg-cblue/10   text-cblue   border-cblue/30',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${styles[status.tone]}`}>
      {status.label}
    </span>
  )
}

// ── Add / Edit Modal ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  bankName: '', cardHolder: '', cardNumberLast4: '',
  creditLimit: '', usedAmount: '',
  statementDate: '', dueDate: '',
}

function CardModal({ initial, onSave, onClose }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(() => isEdit ? {
    bankName:         initial.bankName,
    cardHolder:       initial.cardHolder,
    cardNumberLast4:  initial.cardNumberLast4,
    creditLimit:      initial.creditLimit?.toLocaleString('vi-VN') ?? '',
    usedAmount:       initial.usedAmount?.toLocaleString('vi-VN') ?? '',
    statementDate:    String(initial.statementDate ?? ''),
    dueDate:          String(initial.dueDate ?? ''),
  } : { ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  function set(key, val) { setForm(p => ({ ...p, [key]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    const last4 = form.cardNumberLast4.replace(/\D/g, '').slice(-4)
    if (!form.bankName.trim() || !form.cardHolder.trim() || last4.length !== 4) {
      toast.error('Vui lòng điền đầy đủ: Ngân hàng, Chủ thẻ và 4 số cuối thẻ')
      return
    }
    const payload = {
      bankName:        form.bankName.trim(),
      cardHolder:      form.cardHolder.trim(),
      cardNumberLast4: last4,
      creditLimit:     parseVNDInput(form.creditLimit),
      usedAmount:      parseVNDInput(form.usedAmount),
      statementDate:   parseInt(form.statementDate) || null,
      dueDate:         parseInt(form.dueDate) || null,
    }
    setSaving(true)
    try {
      await onSave(payload)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Lỗi lưu thẻ')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg bg-slate-900/60 border border-slate-700 px-3 py-2 text-sm text-[#e6edf3] placeholder:text-slate-600 outline-none focus:border-cblue focus:ring-1 focus:ring-cblue/40 transition-all'
  const moneyCls = inputCls + ' text-right font-mono text-cblue'

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-bold text-base">{isEdit ? '✏️ Sửa thẻ' : '➕ Thêm thẻ mới'}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors text-sm">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Ngân hàng *</label>
              <input className={inputCls} placeholder="HSBC, Techcombank…" value={form.bankName} onChange={e => set('bankName', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Chủ thẻ *</label>
              <input className={inputCls} placeholder="NGUYEN VAN A" value={form.cardHolder} onChange={e => set('cardHolder', e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-slate-400">4 số cuối thẻ *</label>
            <input
              className={inputCls}
              placeholder="3626"
              maxLength={4}
              inputMode="numeric"
              value={form.cardNumberLast4}
              onChange={e => set('cardNumberLast4', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Hạn mức (₫)</label>
              <input className={moneyCls} placeholder="93.200.000" inputMode="numeric"
                value={form.creditLimit}
                onChange={e => set('creditLimit', formatMoneyLive(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Dư nợ hiện tại (₫)</label>
              <input className={moneyCls} placeholder="50.000.000" inputMode="numeric"
                value={form.usedAmount}
                onChange={e => set('usedAmount', formatMoneyLive(e.target.value))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Ngày chốt sao kê (1–31)</label>
              <input className={inputCls} type="number" min="1" max="31" placeholder="15"
                value={form.statementDate}
                onChange={e => set('statementDate', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-slate-400">Ngày đến hạn TT (1–31)</label>
              <input className={inputCls} type="number" min="1" max="31" placeholder="9"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Huỷ</button>
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
              {saving ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Thêm thẻ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Confirm Delete Modal ───────────────────────────────────────────────────

function ConfirmDeleteModal({ card, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)
  async function handleDelete() {
    setLoading(true)
    try { await onConfirm() } finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
        <div className="text-lg font-bold text-cred">Xoá thẻ này?</div>
        <div className="text-sm text-muted">
          <span className="font-semibold text-[#e6edf3]">{card.bankName}</span> — {maskCard(card.cardNumberLast4)}<br />
          Hành động này không thể hoàn tác.
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Huỷ</button>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-cred/20 border border-cred/40 text-cred text-sm font-bold hover:bg-cred/30 transition-colors disabled:opacity-60"
          >
            {loading ? 'Đang xoá…' : 'Xoá'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function CreditCardManager() {
  const { state, actions } = useApp()
  const cards = state.creditCards

  const [showAdd, setShowAdd]       = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const totals = useMemo(() => {
    const limit = cards.reduce((s, c) => s + (c.creditLimit || 0), 0)
    const used  = cards.reduce((s, c) => s + (c.usedAmount  || 0), 0)
    const remain = limit - used
    const overdue = cards.filter(c => getCardStatus(c).tone === 'red').length
    return { limit, used, remain, overdue }
  }, [cards])

  async function handleAdd(payload) {
    await actions.addCreditCard(payload)
    toast.success('Đã thêm thẻ mới')
  }

  async function handleEdit(payload) {
    await actions.updateCreditCard(editTarget.id, payload)
    toast.success('Đã cập nhật thẻ')
    setEditTarget(null)
  }

  async function handleDelete() {
    await actions.removeCreditCard(deleteTarget.id)
    toast.success('Đã xoá thẻ')
    setDeleteTarget(null)
  }

  async function handleToggleUsed(card) {
    const patch = { usedAmount: card.usedAmount > 0 ? 0 : card.creditLimit }
    await actions.updateCreditCard(card.id, patch)
    toast.success(card.usedAmount > 0 ? 'Đã đánh dấu đã thanh toán' : 'Đã phục hồi dư nợ')
  }

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold">Quản Lý Thẻ Visa / Tín Dụng</h2>
          <div className="text-xs text-muted mt-1">Theo dõi hạn mức, dư nợ và ngày đến hạn thanh toán</div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-4 py-2 text-sm">
          <span className="text-base leading-none">＋</span> Thêm thẻ
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Tổng Hạn Mức"    value={fmtVNDFull(totals.limit)}  sub={`${cards.length} thẻ`}                                           icon="💳" tone="blue"  />
        <SummaryCard label="Tổng Dư Nợ"      value={fmtVNDFull(totals.used)}   sub={totals.limit ? `${Math.round(totals.used/totals.limit*100)}% hạn mức` : '—'} icon="🔥" tone="red"   />
        <SummaryCard label="Hạn Mức Còn Lại" value={fmtVNDFull(totals.remain)} sub="Khả dụng tổng cộng"                                              icon="✅" tone="green" />
        <SummaryCard label="Thẻ Quá Hạn"     value={String(totals.overdue)}    sub={totals.overdue ? 'Cần xử lý ngay' : 'Tất cả trong hạn'}          icon="⚠️" tone="gold"  />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xl shadow-black/20">
        <div className="px-5 py-4 border-b border-border bg-surface2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold">Bảng Quản Lý Thẻ Chi Tiết</div>
            <div className="text-xs text-muted mt-0.5">Dữ liệu đồng bộ Supabase theo tài khoản đăng nhập</div>
          </div>
          <span className="tag-blue">{cards.length} thẻ</span>
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <div className="text-4xl mb-3">💳</div>
            <div className="font-semibold mb-1">Chưa có thẻ nào</div>
            <div className="text-sm text-slate-500 mb-4">Nhấn "Thêm thẻ" để bắt đầu quản lý</div>
            <button onClick={() => setShowAdd(true)} className="btn-primary px-5 py-2 text-sm">＋ Thêm thẻ đầu tiên</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-[#0a0e14] border-b border-border">
                  {['Ngân hàng & Chủ thẻ','Số thẻ','Hạn mức','Dư nợ / Khả dụng','Chu kỳ thanh toán','Trạng thái','Thao tác'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-muted uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cards.map(card => {
                  const status  = getCardStatus(card)
                  const usedPct = card.creditLimit ? Math.min(100, Math.round((card.usedAmount || 0) / card.creditLimit * 100)) : 0
                  const barColor = usedPct >= 90 ? '#f85149' : usedPct >= 70 ? '#d29922' : '#58a6ff'
                  const remain   = (card.creditLimit || 0) - (card.usedAmount || 0)

                  return (
                    <tr key={card.id} className="border-b border-border/40 last:border-b-0 hover:bg-slate-800/40 transition-colors">

                      {/* Bank + holder */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cblue/10 border border-cblue/20 text-cblue flex items-center justify-center text-xs font-black shrink-0">
                            {bankInitials(card.bankName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-sm text-[#e6edf3] truncate">{card.bankName}</div>
                            <div className="text-xs text-slate-400 truncate">{card.cardHolder}</div>
                          </div>
                        </div>
                      </td>

                      {/* Card number */}
                      <td className="px-4 py-4 text-sm text-slate-300 font-mono tracking-wide whitespace-nowrap">
                        {maskCard(card.cardNumberLast4)}
                      </td>

                      {/* Limit */}
                      <td className="px-4 py-4 text-right font-mono text-sm text-slate-200 tabular-nums whitespace-nowrap">
                        {fmtVNDFull(card.creditLimit)}
                      </td>

                      {/* Used + progress */}
                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-bold font-mono text-cred tabular-nums">{fmtVNDFull(card.usedAmount)}</span>
                          <span className="text-slate-500 font-mono tabular-nums">còn {fmtVNDFull(remain < 0 ? 0 : remain)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width:`${usedPct}%`, background:barColor }} />
                        </div>
                        <div className="text-right text-[10px] text-slate-500 mt-0.5">{usedPct}%</div>
                      </td>

                      {/* Cycle */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-xs text-slate-400">Sao kê: <span className="text-slate-200">{fmtDay(card.statementDate)}</span></div>
                        <div className="text-xs text-slate-400 mt-1">Đến hạn: <span className="text-slate-200">{fmtDay(card.dueDate)}</span></div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4"><StatusBadge status={status} /></td>

                      {/* Actions */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {/* Toggle paid */}
                          <button
                            onClick={() => handleToggleUsed(card)}
                            title={card.usedAmount > 0 ? 'Đánh dấu đã thanh toán' : 'Phục hồi dư nợ'}
                            className={`flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                              card.usedAmount === 0
                                ? 'border-cblue/30 text-cblue hover:bg-cblue/10'
                                : 'border-cgreen/30 text-cgreen hover:bg-cgreen/10'
                            }`}
                          >
                            {card.usedAmount === 0
                              ? <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                              : <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            }
                            {card.usedAmount === 0 ? 'Có nợ' : 'Đã TT'}
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => setEditTarget(card)}
                            title="Sửa"
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(card)}
                            title="Xoá"
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700 text-slate-400 hover:border-cred hover:text-cred hover:bg-cred/10 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M9 3h6m-8 5h10m-9 0l.6 12h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd    && <CardModal onSave={handleAdd}  onClose={() => setShowAdd(false)} />}
      {editTarget && <CardModal initial={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} />}
      {deleteTarget && <ConfirmDeleteModal card={deleteTarget} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />}
    </div>
  )
}
