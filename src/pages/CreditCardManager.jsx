import { useMemo, useRef, useState, useEffect } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  CreditCard, Pencil, Trash2, Download, Upload, ScanLine, Plus, X,
  Eye, EyeOff, Check, FileText, AlertTriangle, Save, Loader2, Image as ImageIcon,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { formatMoneyLive, parseVNDInput, fmtVNDFull } from '../lib/formatters'
import { scanStatement } from '../lib/invoiceScanner'
import PageHeader from '../components/ui/PageHeader'

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

function isBankEquivalent(bankA, bankB) {
  const a = String(bankA || '').toLowerCase().trim()
  const b = String(bankB || '').toLowerCase().trim()
  if (!a || !b) return false
  if (a.includes(b) || b.includes(a)) return true
  
  const abbreviations = [
    ['tcb', 'techcombank', 'techcom'],
    ['vcb', 'vietcombank', 'vietcom'],
    ['vpb', 'vpbank', 'vp bank', 'vietnam thinh vuong'],
    ['tpb', 'tpbank', 'tien phong', 'tp bank'],
    ['acb', 'a chau'],
    ['bidv', 'dau tu va phat trien'],
    ['ctg', 'vietinbank', 'vietin'],
    ['vtb', 'vietinbank', 'vietin'],
    ['mbb', 'mb', 'mbbank', 'quan doi', 'mb bank'],
    ['scb', 'saigon', 'sai gon'],
    ['stb', 'sacombank'],
    ['shb', 'saigon hanoi'],
    ['hdb', 'hdbank', 'phat trien nha'],
    ['vib', 'quoc te'],
    ['eib', 'eximbank'],
    ['msb', 'hang hai'],
  ]
  for (const group of abbreviations) {
    const hasA = group.some(x => a.includes(x))
    const hasB = group.some(x => b.includes(x))
    if (hasA && hasB) return true
  }
  return false
}

function findBestMatchingCard(result, cards) {
  if (!cards || cards.length === 0) return null
  
  const bank = String(result.bankName || '').toLowerCase()
  const holder = String(result.cardHolder || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, '')
  const last4 = String(result.cardNumberLast4 || '').replace(/\D/g, '')

  let bestCard = null
  let bestScore = 0

  for (const card of cards) {
    let score = 0

    // 1. Check cardholder name
    const cardHolderNorm = String(card.cardHolder || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/\s+/g, '')

    if (cardHolderNorm && holder) {
      if (cardHolderNorm === holder) {
        score += 40
      } else if (cardHolderNorm.includes(holder) || holder.includes(cardHolderNorm)) {
        score += 20
      }
    }

    // 2. Check bank name
    if (card.bankName && bank) {
      if (isBankEquivalent(card.bankName, bank)) {
        score += 40
      }
    }

    // 3. Check card last 4 digits
    const cardLast4 = String(card.cardNumberLast4 || '').replace(/\D/g, '')
    if (cardLast4 && last4) {
      if (cardLast4 === last4) {
        score += 50
      }
    }

    // If score is above threshold, track the best match
    if (score >= 40 && score > bestScore) {
      bestScore = score
      bestCard = card
    }
  }

  return bestCard
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon: Icon, tone }) {
  const tones = {
    blue:   'border-cblue/25 bg-cblue/10 text-cblue',
    red:    'border-cred/25 bg-cred/10 text-cred',
    green:  'border-cgreen/25 bg-cgreen/10 text-cgreen',
    gold:   'border-cyellow/25 bg-cyellow/10 text-cyellow',
  }
  return (
    <div className={`relative overflow-hidden rounded-xl border p-5 ${tones[tone]}`}>
      {Icon && <Icon size={28} strokeWidth={1.8} className="absolute right-4 top-4 opacity-25" />}
      <div className="text-[12px] font-semibold uppercase tracking-wide mb-2 text-muted">{label}</div>
      <div className="text-xl font-black tabular-nums leading-tight text-text">{value}</div>
      {sub && <div className="text-[12px] text-subtle mt-1.5">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    green:  'bg-cgreen/20  text-cgreen  border-cgreen/50',
    yellow: 'bg-cyellow/20 text-cyellow border-cyellow/50',
    red:    'bg-cred/20    text-cred    border-cred/50',
    blue:   'bg-cblue/20   text-cblue   border-cblue/50',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${styles[status.tone]}`}>
      {status.label}
    </span>
  )
}

// ── Add / Edit Modal ───────────────────────────────────────────────────────

const EMPTY_FORM = {
  bankName: '', cardHolder: '', cardNumberLast4: '', cardNumberFull: '',
  creditLimit: '', usedAmount: '', statementAmount: '',
  statementDate: '', dueDate: '',
  hasStatement: false,
}

function CardModal({ initial, onSave, onClose }) {
  const isEdit = !!initial?.id
  const [form, setForm] = useState(() => isEdit ? {
    bankName:         initial.bankName,
    cardHolder:       initial.cardHolder,
    cardNumberLast4:  initial.cardNumberLast4,
    cardNumberFull:   initial.cardNumberFull ?? '',
    creditLimit:      initial.creditLimit?.toLocaleString('vi-VN') ?? '',
    usedAmount:       initial.usedAmount?.toLocaleString('vi-VN') ?? '',
    statementAmount:  initial.statementAmount?.toLocaleString('vi-VN') ?? '',
    statementDate:    String(initial.statementDate ?? ''),
    dueDate:          String(initial.dueDate ?? ''),
    hasStatement:     !!initial.hasStatement,
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
    const fullNum = form.cardNumberFull.replace(/\D/g, '').slice(0, 16)
    const payload = {
      bankName:        form.bankName.trim(),
      cardHolder:      form.cardHolder.trim(),
      cardNumberLast4: last4,
      cardNumberFull:  fullNum.length >= 12 ? fullNum : null,
      creditLimit:     parseVNDInput(form.creditLimit),
      usedAmount:      parseVNDInput(form.usedAmount),
      statementAmount: parseVNDInput(form.statementAmount),
      statementDate:   parseInt(form.statementDate) || null,
      dueDate:         parseInt(form.dueDate) || null,
      hasStatement:    form.hasStatement,
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

  const inputCls = 'input-base'
  const moneyCls = inputCls + ' text-right font-mono text-cblue'

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-bold text-base flex items-center gap-2">
            {isEdit ? <Pencil size={16} strokeWidth={2.2} /> : <Plus size={16} strokeWidth={2.2} />}
            {isEdit ? 'Sửa thẻ' : 'Thêm thẻ mới'}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors text-sm">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted">Ngân hàng *</label>
              <input className={inputCls} placeholder="HSBC, Techcombank…" value={form.bankName} onChange={e => set('bankName', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted">Chủ thẻ *</label>
              <input className={inputCls} placeholder="NGUYEN VAN A" value={form.cardHolder} onChange={e => set('cardHolder', e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-muted">4 số cuối thẻ *</label>
            <input
              className={inputCls}
              placeholder="3626"
              maxLength={4}
              inputMode="numeric"
              value={form.cardNumberLast4}
              onChange={e => set('cardNumberLast4', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-muted">
              Full số thẻ
              <span className="ml-1.5 text-[12px] text-subtle font-normal">(tuỳ chọn — sẽ được ẩn bằng icon mắt)</span>
            </label>
            <div className="relative">
              <input
                className={inputCls + ' pr-10 font-mono tracking-widest'}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
                inputMode="numeric"
                type="password"
                autoComplete="off"
                value={form.cardNumberFull}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 16)
                  const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
                  set('cardNumberFull', formatted)
                }}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none">
                <Eye size={16} strokeWidth={1.8} />
              </div>
            </div>
            {form.cardNumberFull && (
              <div className="text-[12px] text-subtle mt-0.5">
                {form.cardNumberFull.replace(/\d(?=\d{4})/g, '*')}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted">Hạn mức (₫)</label>
              <input className={moneyCls} placeholder="93.200.000" inputMode="numeric"
                value={form.creditLimit}
                onChange={e => set('creditLimit', formatMoneyLive(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted">Dư nợ hiện tại (₫)</label>
              <input className={moneyCls} placeholder="50.000.000" inputMode="numeric"
                value={form.usedAmount}
                onChange={e => set('usedAmount', formatMoneyLive(e.target.value))}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] text-muted">Số tiền sao kê (₫)</label>
            <input className={moneyCls} placeholder="0" inputMode="numeric"
              value={form.statementAmount}
              onChange={e => set('statementAmount', formatMoneyLive(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted">Ngày chốt sao kê (1–31)</label>
              <input className={inputCls} type="number" min="1" max="31" placeholder="15"
                value={form.statementDate}
                onChange={e => set('statementDate', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-muted">Ngày đến hạn TT (1–31)</label>
              <input className={inputCls} type="number" min="1" max="31" placeholder="9"
                value={form.dueDate}
                onChange={e => set('dueDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="modalHasStatement"
              className="w-4 h-4 rounded border-border bg-white accent-cblue"
              checked={form.hasStatement}
              onChange={e => set('hasStatement', e.target.checked)}
            />
            <label htmlFor="modalHasStatement" className="text-xs text-text font-semibold cursor-pointer">
              Đã có sao kê tháng này
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
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
          <span className="font-semibold text-text">{card.bankName}</span> — {maskCard(card.cardNumberLast4)}<br />
          Hành động này không thể hoàn tác.
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
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

// ── Scan Confirmation Modal ────────────────────────────────────────────────
// ── File Scan Row Component ────────────────────────────────────────────────
function FileScanRow({ item, cards, onRemove, onChangeMatchedCard, onChangeValues }) {
  const [amountStr, setAmountStr] = useState(() => item.result?.amountDue?.toLocaleString('vi-VN') || '')
  const [dayStr, setDayStr] = useState(() => String(item.result?.dueDateDay ?? ''))

  useEffect(() => {
    if (item.result) {
      setAmountStr(item.result.amountDue?.toLocaleString('vi-VN') || '')
      setDayStr(String(item.result.dueDateDay ?? ''))
    }
  }, [item.result])

  function handleAmountChange(val) {
    const formatted = formatMoneyLive(val)
    setAmountStr(formatted)
    const parsed = parseInt(formatted.replace(/\D/g, '')) || 0
    onChangeValues(item.id, parsed, parseInt(dayStr) || null)
  }

  function handleDayChange(val) {
    const cleaned = val.replace(/\D/g, '')
    setDayStr(cleaned)
    const parsedAmount = parseInt(amountStr.replace(/\D/g, '')) || 0
    onChangeValues(item.id, parsedAmount, parseInt(cleaned) || null)
  }

  const bankMismatch = item.result?.bankName && item.matchedCard && 
    !item.matchedCard.bankName.toLowerCase().includes(item.result.bankName.toLowerCase()) && 
    !item.result.bankName.toLowerCase().includes(item.matchedCard.bankName.toLowerCase())
    
  const holderMismatch = item.result?.cardHolder && item.matchedCard && 
    item.matchedCard.cardHolder.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') !== 
    item.result.cardHolder.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  return (
    <div className="border border-border bg-surface2 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center relative">
      {/* Thumbnail */}
      <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border bg-surface shrink-0">
        <img src={item.preview} alt="Sao kê" className="w-full h-full object-cover" />
      </div>

      {/* Matching & Inputs */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5 w-full">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12px] font-semibold text-muted truncate max-w-[200px]" title={item.file.name}>
            {item.file.name}
          </span>
          <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full border ${
            item.status === 'success' ? 'bg-cgreen/10 text-cgreen border-cgreen/30' :
            item.status === 'scanning' ? 'bg-cblue/10 text-cblue border-cblue/30 animate-pulse' :
            item.status === 'failed' ? 'bg-cred/10 text-cred border-cred/30' :
            'bg-surface text-muted border-border'
          }`}>
            {item.status === 'success' ? 'Đã quét' :
             item.status === 'scanning' ? 'Đang quét...' :
             item.status === 'failed' ? 'Lỗi' : 'Chờ quét'}
          </span>
        </div>

        {item.status === 'failed' && (
          <div className="text-[12px] text-cred bg-cred/10 border border-cred/20 rounded px-2 py-1">
            {item.errorMessage}
          </div>
        )}

        {item.status === 'success' && (
          <div className="flex flex-col gap-2 pt-1 border-t border-border">
            {/* Warning mismatches */}
            {(bankMismatch || holderMismatch) && (
              <div className="text-[12px] text-cyellow bg-cyellow/10 border border-cyellow/20 rounded px-2 py-1 flex flex-col">
                <span className="font-bold flex items-center gap-1"><AlertTriangle size={11} strokeWidth={2.4} /> Cảnh báo lệch sao kê:</span>
                {bankMismatch && <div>• Ngân hàng quét: <span className="underline">{item.result.bankName}</span></div>}
                {holderMismatch && <div>• Chủ thẻ quét: <span className="underline">{item.result.cardHolder}</span></div>}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
              {/* Card selector */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[12px] text-muted uppercase tracking-wider font-semibold">Thẻ khớp</label>
                <select
                  className="rounded bg-white border border-border text-xs px-2 py-1.5 text-text outline-none focus:border-cblue"
                  value={item.matchedCard?.id || ''}
                  onChange={e => onChangeMatchedCard(item.id, e.target.value)}
                >
                  <option value="">-- Chưa khớp thẻ nào --</option>
                  {cards.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.bankName} - **** {c.cardNumberLast4} ({c.cardHolder})
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount input */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[12px] text-muted uppercase tracking-wider font-semibold">Số tiền sao kê (đ)</label>
                <input
                  className="rounded bg-white border border-border text-xs px-2 py-1 font-mono text-cblue text-right outline-none focus:border-cblue"
                  placeholder="0"
                  value={amountStr}
                  onChange={e => handleAmountChange(e.target.value)}
                />
              </div>

              {/* Due date input */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[12px] text-muted uppercase tracking-wider font-semibold">Ngày thanh toán (1-31)</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  className="rounded bg-white border border-border text-xs px-2 py-1 text-center outline-none focus:border-cblue text-text"
                  placeholder="Hạn"
                  value={dayStr}
                  onChange={e => handleDayChange(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(item.id)}
        className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center shrink-0"
        title="Xóa tệp này"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  )
}

// ── Statement Detail Modal ──────────────────────────────────────────────────
function StatementDetailModal({ card, onClose, onToggleStatus, onTriggerScan, onEdit }) {
  const status = card.hasStatement ? { label: 'Có rồi', tone: 'green' } : { label: 'Chưa có', tone: 'red' }
  const statusStyles = {
    green: 'bg-cgreen/10 text-cgreen border-cgreen/30',
    red: 'bg-cred/10 text-cred border-cred/30',
  }

  const items = [
    { label: 'Ngân hàng', value: card.bankName, bold: true },
    { label: 'Chủ thẻ', value: card.cardHolder },
    { label: 'Số thẻ', value: maskCard(card.cardNumberLast4), mono: true },
    { label: 'Trạng thái sao kê', value: (
      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${statusStyles[status.tone]}`}>
        {status.label}
      </span>
    )},
    { label: 'Hạn mức', value: fmtVNDFull(card.creditLimit), mono: true },
    { label: 'Dư nợ đã dùng', value: fmtVNDFull(card.usedAmount), mono: true, color: 'text-cred' },
    { label: 'Số tiền sao kê', value: fmtVNDFull(card.statementAmount), mono: true, color: 'text-cyellow' },
    { label: 'Ngày chốt sao kê', value: card.statementDate ? `Ngày ${card.statementDate} hàng tháng` : '—' },
    { label: 'Ngày đóng tiền', value: card.dueDate ? `Ngày ${card.dueDate} hàng tháng` : '—' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-text">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface2">
          <div className="font-bold text-base flex items-center gap-2">
            <FileText size={16} strokeWidth={2.2} />
            <span>Chi Tiết Sao Kê</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors text-lg flex items-center justify-center">×</button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <div className="divide-y divide-border/40">
            {items.map((it, idx) => (
              <div key={idx} className="flex justify-between py-2.5 text-sm">
                <span className="text-muted">{it.label}</span>
                <span className={`text-right font-medium ${it.bold ? 'font-bold text-text' : ''} ${it.mono ? 'font-mono' : ''} ${it.color || 'text-text'}`}>
                  {it.value}
                </span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border mt-1">
            <button
              onClick={() => {
                onToggleStatus(card)
                onClose()
              }}
              className="px-3 py-2 rounded-lg border border-border hover:border-cblue text-xs font-semibold transition-colors"
            >
              {card.hasStatement ? 'Đánh dấu Chưa có' : 'Đánh dấu Có rồi'}
            </button>
            <button
              onClick={() => {
                onTriggerScan(card)
                onClose()
              }}
              className="px-3 py-2 rounded-lg bg-cblue/15 border border-cblue/30 text-cblue hover:bg-cblue/25 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              <ScanLine size={14} strokeWidth={2.2} /> Quét sao kê
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border mt-2">
            <button
              onClick={() => {
                onEdit(card)
                onClose()
              }}
              className="btn-ghost px-4 py-2 text-xs flex items-center gap-1.5"
            >
              <Pencil size={13} strokeWidth={2.2} /> Sửa thẻ
            </button>
            <button onClick={onClose} className="btn-primary px-5 py-2 text-xs">
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Multi-File AI Statement Scanner Modal ──────────────────────────────────
function OcrStatementModal({ initialCard, cards, onClose, onConfirmAll }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)

  function handleFiles(newFiles) {
    if (!newFiles || newFiles.length === 0) return
    const validFiles = Array.from(newFiles).filter(f => {
      if (!f.type.startsWith('image/')) {
        toast.error(`File "${f.name}" không phải là ảnh!`)
        return false
      }
      return true
    })

    setFiles(prev => [
      ...prev,
      ...validFiles.map(f => ({
        id: crypto.randomUUID(),
        file: f,
        preview: URL.createObjectURL(f),
        status: 'pending',
        result: null,
        matchedCard: initialCard || null, // Default to initialCard if opened from row
        errorMessage: null,
      }))
    ])
  }

  function handleDrop(e) {
    e.preventDefault()
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files)
    }
  }

  // Ctrl+V paste listener
  useEffect(() => {
    function handlePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      const pasted = []
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (!blob) break
          const f = new File([blob], `pasted_statement_${Date.now()}.png`, { type: blob.type })
          pasted.push(f)
        }
      }
      if (pasted.length > 0) {
        handleFiles(pasted)
        toast.success(`📋 Đã dán ${pasted.length} ảnh từ bộ nhớ tạm!`)
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [initialCard])

  function handleRemoveFile(id) {
    setFiles(prev => {
      const target = prev.find(f => f.id === id)
      if (target?.preview) {
        URL.revokeObjectURL(target.preview)
      }
      return prev.filter(f => f.id !== id)
    })
  }

  function handleChangeMatchedCard(fileId, cardId) {
    const card = cards.find(c => c.id === cardId) || null
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, matchedCard: card } : f))
  }

  function handleChangeValues(fileId, amount, day) {
    setFiles(prev => prev.map(f => f.id === fileId ? {
      ...f,
      result: {
        ...f.result,
        amountDue: amount,
        dueDateDay: day
      }
    } : f))
  }

  async function handleScanAll() {
    const pendingItems = files.filter(f => f.status === 'pending' || f.status === 'failed')
    if (pendingItems.length === 0) return

    setLoading(true)
    for (const item of pendingItems) {
      setFiles(prev => prev.map(f => f.id === item.id ? { ...f, status: 'scanning', errorMessage: null } : f))
      try {
        const data = await scanStatement(item.file)
        
        let extractedDay = null
        if (data.due_date) {
          const d = new Date(data.due_date)
          if (!isNaN(d.getTime())) {
            extractedDay = d.getUTCDate()
          }
        }

        const result = {
          bankName: data.bank_name || '',
          cardHolder: data.card_holder || '',
          cardNumberLast4: data.card_number_last4 || '',
          amountDue: data.amount_due || 0,
          dueDateRaw: data.due_date || '',
          dueDateDay: extractedDay,
        }

        // If card was opened from a specific row, default match to that row first. Else auto-match.
        const matched = initialCard || findBestMatchingCard(result, cards)

        setFiles(prev => prev.map(f => f.id === item.id ? {
          ...f,
          status: 'success',
          result,
          matchedCard: matched,
        } : f))

      } catch (err) {
        console.error('Scan error:', err)
        setFiles(prev => prev.map(f => f.id === item.id ? {
          ...f,
          status: 'failed',
          errorMessage: err.message || 'Lỗi phân tích AI',
        } : f))
      }
    }
    setLoading(false)
  }

  function handleSaveAll() {
    const processed = files.filter(f => f.status === 'success' && f.matchedCard)
    if (processed.length === 0) {
      toast.error('Chưa có sao kê nào được quét thành công hoặc khớp thẻ!')
      return
    }

    const updates = processed.map(f => ({
      cardId: f.matchedCard.id,
      cardName: f.matchedCard.bankName,
      amount: f.result.amountDue,
      day: f.result.dueDateDay,
    }))

    onConfirmAll(updates)
  }

  const successCount = files.filter(f => f.status === 'success').length
  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'failed').length

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-text flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface2 shrink-0">
          <div className="font-bold text-base flex items-center gap-2">
            <ScanLine size={17} strokeWidth={2.2} />
            <span>Quét & Khớp Sao Kê Hàng Loạt AI</span>
          </div>
          <button onClick={onClose} disabled={loading} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors text-lg flex items-center justify-center">×</button>
        </div>

        {/* Content Area */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">

          <div className="text-xs text-muted">
            Kéo thả nhiều ảnh, chọn từ máy tính, hoặc bấm <kbd className="bg-surface2 border border-border rounded px-1.5 py-0.5 text-[12px] text-text font-mono">Ctrl+V</kbd> để dán ảnh. AI sẽ tự động phân tích và khớp với thẻ tương ứng dựa vào Ngân hàng, Tên chủ thẻ và 4 số cuối thẻ.
          </div>

          {/* Dropzone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => !loading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors min-h-[140px] cursor-pointer shrink-0
              ${loading ? 'border-border cursor-default' : 'border-border hover:border-cblue/30 focus-within:border-cblue/50 group'}`}
          >
            <ImageIcon size={32} strokeWidth={1.6} className="text-subtle opacity-60 group-hover:opacity-90 transition-opacity" />
            <div className="text-sm text-muted text-center">
              Kéo thả các ảnh sao kê vào đây hoặc <span className="text-cblue font-semibold underline underline-offset-2">chọn file ảnh</span>
              <span className="text-[12px] text-subtle mt-1 block">Hỗ trợ dán trực tiếp nhiều ảnh từ clipboard bằng <kbd className="bg-surface2 border border-border rounded px-1 text-[12px] text-muted font-mono">Ctrl+V</kbd></span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple={true}
              className="hidden"
              onChange={e => {
                handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {/* Queue List */}
          {files.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="text-xs font-bold text-text flex justify-between items-center px-1">
                <span>Danh sách tệp ({files.length})</span>
                {successCount > 0 && <span className="text-cgreen">Đã quét xong: {successCount}</span>}
              </div>
              <div className="flex flex-col gap-2.5 max-h-[350px] overflow-y-auto pr-1">
                {files.map(item => (
                  <FileScanRow
                    key={item.id}
                    item={item}
                    cards={cards}
                    onRemove={handleRemoveFile}
                    onChangeMatchedCard={handleChangeMatchedCard}
                    onChangeValues={handleChangeValues}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-5 py-4 border-t border-border bg-surface2 shrink-0">
          <button onClick={onClose} disabled={loading} className="btn-ghost px-4 py-3 text-sm">Huỷ</button>

          <div className="flex gap-2">
            {pendingCount > 0 && (
              <button
                onClick={handleScanAll}
                disabled={loading}
                className="px-4 py-2.5 rounded-lg bg-cblue/15 border border-cblue/30 text-cblue text-xs font-black hover:bg-cblue/25 active:scale-95 transition-all flex items-center gap-2"
              >
                {loading ? (
                  <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />
                ) : (
                  <ScanLine size={14} strokeWidth={2.2} />
                )}
                {loading ? 'Đang phân tích...' : `Bắt đầu quét AI (${pendingCount} tệp)`}
              </button>
            )}

            {successCount > 0 && (
              <button
                onClick={handleSaveAll}
                disabled={loading}
                className="btn-primary px-5 py-2.5 text-xs flex items-center gap-1.5"
              >
                <Save size={14} strokeWidth={2.2} /> Cập nhật tất cả ({successCount} thẻ)
              </button>
            )}
          </div>
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
  const [importing, setImporting]   = useState(false)
  const importRef = useRef(null)

  // AI Statement Scan States
  const [scanningCard, setScanningCard] = useState(null)
  const [scanResult, setScanResult] = useState(null)
  const [detailedCard, setDetailedCard] = useState(null)
  const [filterStatement, setFilterStatement] = useState('all') // 'all' | 'has' | 'none'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'active' | 'overdue' | 'nodebt'
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [filterAction, setFilterAction] = useState('all') // 'all' | 'debt' | 'paid'
  const [showActionDropdown, setShowActionDropdown] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [revealedCards, setRevealedCards] = useState(new Set())

  function toggleReveal(cardId) {
    setRevealedCards(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  function toggleStatementDropdown() {
    setShowFilterDropdown(p => !p)
    setShowStatusDropdown(false)
    setShowActionDropdown(false)
  }
  function toggleStatusDropdown() {
    setShowStatusDropdown(p => !p)
    setShowFilterDropdown(false)
    setShowActionDropdown(false)
  }
  function toggleActionDropdown() {
    setShowActionDropdown(p => !p)
    setShowFilterDropdown(false)
    setShowStatusDropdown(false)
  }

  const filteredCards = useMemo(() => {
    let list = cards

    // 1. Filter by statement
    if (filterStatement === 'has') {
      list = list.filter(c => c.hasStatement)
    } else if (filterStatement === 'none') {
      list = list.filter(c => !c.hasStatement)
    }

    // 2. Filter by status
    if (filterStatus === 'overdue') {
      list = list.filter(c => getCardStatus(c).tone === 'red')
    } else if (filterStatus === 'active') {
      list = list.filter(c => {
        const tone = getCardStatus(c).tone
        return tone === 'green' || tone === 'yellow'
      })
    } else if (filterStatus === 'nodebt') {
      list = list.filter(c => getCardStatus(c).tone === 'blue')
    }

    // 3. Filter by action / payment status
    if (filterAction === 'debt') {
      list = list.filter(c => c.usedAmount > 0)
    } else if (filterAction === 'paid') {
      list = list.filter(c => c.usedAmount === 0)
    }

    // 4. Search term (bank name or card holder)
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim()
      list = list.filter(c => 
        (c.bankName && c.bankName.toLowerCase().includes(q)) ||
        (c.cardHolder && c.cardHolder.toLowerCase().includes(q))
      )
    }

    return list
  }, [cards, filterStatement, filterStatus, filterAction, searchTerm])

  function handleTriggerScan(card) {
    setScanningCard(card)
  }

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

  // ── Export Excel ────────────────────────────────────────────────────────
  function handleExportExcel() {
    if (cards.length === 0) { toast.error('Chưa có thẻ nào để xuất!'); return }
    const rows = cards.map((c, i) => ({
      'STT':                    i + 1,
      'Loại Thẻ':               c.bankName || '',
      'Chủ Thẻ':                c.cardHolder || '',
      'Số Thẻ':                 c.cardNumberLast4 ? `**** **** **** ${c.cardNumberLast4}` : '',
      'Hạn Mức (đ)':            c.creditLimit || 0,
      'Đã Dùng (đ)':            c.usedAmount || 0,
      'Số Tiền Sao Kê (đ)':     c.statementAmount || 0,
      'Còn Lại (đ)':            (c.creditLimit || 0) - (c.usedAmount || 0),
      'Ngày Sao Kê':            c.statementDate ? `Ngày ${c.statementDate}` : '',
      'Ngày Đóng Tiền':         c.dueDate ? `Ngày ${c.dueDate}` : '',
      'Trạng Thái':             getCardStatus(c).label,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 26 }, { wch: 20 }, { wch: 22 },
      { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 14 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Quản Lý Thẻ')
    XLSX.writeFile(wb, `Quan_Ly_The_Visa_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`)
    toast.success(`Đã xuất ${cards.length} thẻ ra file Excel`)
  }

  // ── Import Excel ────────────────────────────────────────────────────────
  async function handleImportExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = null
    setImporting(true)
    const toastId = toast.loading('Đang đọc file Excel…')

    try {
      const data = await file.arrayBuffer()
      const wb = XLSX.read(new Uint8Array(data), { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 })

      // Tìm header row (chứa "Loại Thẻ" hoặc "Chủ Thẻ")
      let headerIdx = -1
      for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i]
        if (row?.some(cell => typeof cell === 'string' && /Lo[aạ]i\s*Th[eẻ]/i.test(String(cell)))) {
          headerIdx = i; break
        }
      }
      if (headerIdx === -1) {
        toast.error('Không tìm thấy header (cần cột "Loại Thẻ" hoặc "Chủ Thẻ")', { id: toastId })
        setImporting(false); return
      }

      const headers = rawRows[headerIdx].map(h => String(h ?? '').trim())
      const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/\s+/g, ' ').trim()

      function findCol(keys) {
        for (const k of keys) {
          const idx = headers.findIndex(h => norm(h).includes(norm(k)))
          if (idx >= 0) return idx
        }
        return -1
      }

      const colBank       = findCol(['Loại Thẻ', 'Loai The', 'Ngân hàng', 'Ngan hang', 'Bank'])
      const colHolder     = findCol(['Chủ Thẻ', 'Chu The', 'Card Holder'])
      const colCardNum    = findCol(['Số Thẻ', 'So The', 'Card Number'])
      const colLimit      = findCol(['Hạn Mức', 'Han Muc', 'Credit Limit'])
      const colUsed       = findCol(['Đã Dùng', 'Da Dung', 'Used'])
      const colStmtAmount = findCol(['Số Tiền Sao Kê', 'So Tien Sao Ke', 'Statement Amount'])
      const colStmtDate   = findCol(['Ngày Sao Kê', 'Ngay Sao Ke', 'Statement Date', 'Ngày SK gốc'])
      const colDueDate    = findCol(['Ngày Đóng Tiền', 'Ngay Dong Tien', 'Due Date', 'Ngày ĐT gốc'])

      if (colBank === -1 && colHolder === -1) {
        toast.error('Không nhận dạng được cấu trúc file! Cần cột "Loại Thẻ" hoặc "Chủ Thẻ"', { id: toastId })
        setImporting(false); return
      }

      // Parse Excel serial date → day-of-month
      function parseDayOfMonth(val) {
        if (val == null || val === '') return null
        if (typeof val === 'number') {
          // Excel serial date → JS Date → day of month
          if (val > 100) {
            const d = new Date((val - 25569) * 86400000)
            return d.getUTCDate()
          }
          return val >= 1 && val <= 31 ? val : null
        }
        const num = parseInt(String(val))
        return num >= 1 && num <= 31 ? num : null
      }

      // Parse money amount
      function parseMoney(val) {
        if (val == null || val === '') return 0
        if (typeof val === 'number') return Math.round(val)
        return Math.round(Number(String(val).replace(/[^0-9.]/g, '')) || 0)
      }

      const dataRows = rawRows.slice(headerIdx + 1)
      const imported = []
      const skipped = []

      const normStr = s => String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/\s+/g, ' ')

      for (const row of dataRows) {
        if (!row || !row.length) continue
        const bank = colBank >= 0 ? String(row[colBank] ?? '').trim() : ''
        const holder = colHolder >= 0 ? String(row[colHolder] ?? '').trim() : ''
        if (!bank && !holder) continue

        // Bỏ dòng tổng / thống kê ở cuối
        const sttVal = String(row[0] ?? '').trim().toLowerCase()
        if (sttVal.includes('tổng') || bank.toLowerCase().includes('tổng') || bank.toLowerCase().includes('thẻ')) {
          continue
        }

        const rawCardNum = colCardNum >= 0 ? String(row[colCardNum] ?? '').replace(/\D/g, '') : ''
        const last4 = rawCardNum.slice(-4) || '0000'

        const payload = {
          bankName:        bank || 'N/A',
          cardHolder:      holder || 'N/A',
          cardNumberLast4: last4,
          creditLimit:     colLimit >= 0 ? parseMoney(row[colLimit]) : 0,
          usedAmount:      colUsed >= 0 ? parseMoney(row[colUsed]) : 0,
          statementAmount: colStmtAmount >= 0 ? parseMoney(row[colStmtAmount]) : 0,
          statementDate:   colStmtDate >= 0 ? parseDayOfMonth(row[colStmtDate]) : null,
          dueDate:         colDueDate >= 0 ? parseDayOfMonth(row[colDueDate]) : null,
          hasStatement:    colStmtAmount >= 0 ? (parseMoney(row[colStmtAmount]) > 0) : false,
        }

        // Deduplicate: check trùng bankName + cardHolder + last4
        const exists = cards.find(c => 
          normStr(c.bankName) === normStr(payload.bankName) &&
          normStr(c.cardHolder) === normStr(payload.cardHolder) &&
          String(c.cardNumberLast4).slice(-4) === String(payload.cardNumberLast4).slice(-4)
        )
        if (exists) {
          skipped.push(payload.bankName)
          continue
        }

        // Cũng check trùng trong batch đang import
        const dupInBatch = imported.find(p => 
          normStr(p.bankName) === normStr(payload.bankName) &&
          normStr(p.cardHolder) === normStr(payload.cardHolder) &&
          String(p.cardNumberLast4).slice(-4) === String(payload.cardNumberLast4).slice(-4)
        )
        if (dupInBatch) continue

        imported.push(payload)
      }

      if (imported.length === 0) {
        const msg = skipped.length > 0
          ? `Tất cả ${skipped.length} thẻ đã tồn tại trong hệ thống!`
          : 'Không tìm thấy thẻ hợp lệ trong file!'
        toast.error(msg, { id: toastId })
        setImporting(false); return
      }

      // Insert từng thẻ
      toast.loading(`Đang nhập ${imported.length} thẻ…`, { id: toastId })
      let ok = 0
      for (const card of imported) {
        try {
          await actions.addCreditCard(card)
          ok++
        } catch (err) {
          console.error('[ImportCard] Error:', card.bankName, err)
        }
      }

      const parts = [`✅ Đã nhập ${ok} thẻ mới`]
      if (skipped.length > 0) parts.push(`${skipped.length} thẻ đã tồn tại (bỏ qua)`)
      toast.success(parts.join(' · '), { id: toastId, duration: 5000 })
    } catch (err) {
      console.error('[ImportCard]', err)
      toast.error(err.message || 'Lỗi import file!', { id: toastId })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={CreditCard}
        title="Thẻ Visa / Tín Dụng"
        subtitle="Theo dõi hạn mức, dư nợ và ngày đến hạn thanh toán"
        actions={
          <>
            <button onClick={handleExportExcel} title="Xuất Excel" className="btn-ghost px-3 py-2 text-sm">
              <Download size={15} strokeWidth={2.2} /><span className="hidden sm:inline">Xuất Excel</span>
            </button>
            <button onClick={() => importRef.current?.click()} disabled={importing} title="Nhập Excel" className="btn-ghost px-3 py-2 text-sm disabled:opacity-50">
              {importing
                ? <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
                : <Upload size={15} strokeWidth={2.2} />
              }
              <span className="hidden sm:inline">{importing ? 'Đang nhập…' : 'Nhập Excel'}</span>
            </button>
            <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImportExcel} />
            <button onClick={() => handleTriggerScan({ id: null })} title="Quét Sao Kê AI"
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cblue/15 border border-cblue/30 text-cblue text-sm font-medium hover:bg-cblue/25 active:scale-95 transition-all">
              <ScanLine size={15} strokeWidth={2.2} /><span className="hidden sm:inline">Quét Sao Kê AI</span>
            </button>
            <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 px-4 py-3 text-base">
              <Plus size={17} strokeWidth={2.4} /> Thêm thẻ
            </button>
          </>
        }
      />
    <div className="p-6 w-full">

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Tổng Hạn Mức"    value={fmtVNDFull(totals.limit)}  sub={`${cards.length} thẻ`}                                           icon={CreditCard} tone="blue"  />
        <SummaryCard label="Tổng Dư Nợ"      value={fmtVNDFull(totals.used)}   sub={totals.limit ? `${Math.round(totals.used/totals.limit*100)}% hạn mức` : '—'} icon={AlertTriangle} tone="red"   />
        <SummaryCard label="Hạn Mức Còn Lại" value={fmtVNDFull(totals.remain)} sub="Khả dụng tổng cộng"                                              icon={Check} tone="green" />
        <SummaryCard label="Thẻ Quá Hạn"     value={String(totals.overdue)}    sub={totals.overdue ? 'Cần xử lý ngay' : 'Tất cả trong hạn'}          icon={AlertTriangle} tone="gold"  />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden shadow-2xl shadow-black/20">
        <div className="px-5 py-4 border-b border-border bg-surface2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">Bảng Quản Lý Thẻ Chi Tiết</div>
            <div className="text-xs text-muted mt-0.5 truncate">Dữ liệu đồng bộ Supabase theo tài khoản đăng nhập</div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-muted">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Tìm ngân hàng, chủ thẻ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-border text-xs text-text placeholder:text-muted outline-none focus:border-cblue focus:ring-1 focus:ring-cblue/30 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted hover:text-text"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <span className="tag-blue whitespace-nowrap shrink-0">
              {filteredCards.length < cards.length ? `${filteredCards.length}/${cards.length}` : cards.length} thẻ
            </span>
          </div>
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <div className="text-4xl mb-3">💳</div>
            <div className="font-semibold mb-1">Chưa có thẻ nào</div>
            <div className="text-sm text-muted mb-4">Nhấn "Thêm thẻ" để bắt đầu quản lý</div>
            <button onClick={() => setShowAdd(true)} className="btn-primary px-5 py-2 text-sm">＋ Thêm thẻ đầu tiên</button>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[240px]">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="bg-surface2 border-b border-border">
                  {['Ngân hàng & Chủ thẻ','Số thẻ','Hạn mức','Dư nợ / Khả dụng','Số tiền sao kê','Chu kỳ thanh toán','Sao kê','Trạng thái','Thao tác'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[12px] font-bold text-text uppercase tracking-wider whitespace-nowrap">
                      {h === 'Sao kê' ? (
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={toggleStatementDropdown}
                            className={`flex items-center gap-1 hover:text-text transition-colors cursor-pointer focus:outline-none uppercase text-[12px] font-bold tracking-wider ${
                              filterStatement !== 'all' ? 'text-cblue' : 'text-text'
                            }`}
                          >
                            <span>Sao kê</span>
                            <svg className={`w-3 h-3 transition-transform text-muted ${showFilterDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {showFilterDropdown && (
                            <>
                              {/* Click-outside backdrop */}
                              <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                              
                              <div className="absolute left-0 mt-1.5 w-28 rounded-md bg-white border border-border shadow-2xl z-20 p-1 font-sans text-xs normal-case tracking-normal flex flex-col gap-0.5">
                                {[
                                  { label: 'Tất cả', value: 'all' },
                                  { label: 'Có rồi', value: 'has' },
                                  { label: 'Chưa có', value: 'none' }
                                ].map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      setFilterStatement(opt.value)
                                      setShowFilterDropdown(false)
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 hover:bg-surface2 transition-colors rounded ${
                                      filterStatement === opt.value ? 'text-cblue font-bold bg-cblue/10' : 'text-text hover:text-text'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ) : h === 'Trạng thái' ? (
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={toggleStatusDropdown}
                            className={`flex items-center gap-1 hover:text-text transition-colors cursor-pointer focus:outline-none uppercase text-[12px] font-bold tracking-wider ${
                              filterStatus !== 'all' ? 'text-cblue' : 'text-text'
                            }`}
                          >
                            <span>Trạng thái</span>
                            <svg className={`w-3 h-3 transition-transform text-muted ${showStatusDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {showStatusDropdown && (
                            <>
                              {/* Click-outside backdrop */}
                              <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                              
                              <div className="absolute left-0 mt-1.5 w-32 rounded-md bg-white border border-border shadow-2xl z-20 p-1 font-sans text-xs normal-case tracking-normal flex flex-col gap-0.5">
                                {[
                                  { label: 'Tất cả', value: 'all' },
                                  { label: 'Còn hạn', value: 'active' },
                                  { label: 'Quá hạn', value: 'overdue' },
                                  { label: 'Không dư nợ', value: 'nodebt' }
                                ].map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      setFilterStatus(opt.value)
                                      setShowStatusDropdown(false)
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 hover:bg-surface2 transition-colors rounded ${
                                      filterStatus === opt.value ? 'text-cblue font-bold bg-cblue/10' : 'text-text hover:text-text'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ) : h === 'Thao tác' ? (
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={toggleActionDropdown}
                            className={`flex items-center gap-1 hover:text-text transition-colors cursor-pointer focus:outline-none uppercase text-[12px] font-bold tracking-wider ${
                              filterAction !== 'all' ? 'text-cblue' : 'text-text'
                            }`}
                          >
                            <span>Thao tác</span>
                            <svg className={`w-3 h-3 transition-transform text-muted ${showActionDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          
                          {showActionDropdown && (
                            <>
                              {/* Click-outside backdrop */}
                              <div className="fixed inset-0 z-10" onClick={() => setShowActionDropdown(false)} />
                              
                              <div className="absolute right-0 mt-1.5 w-28 rounded-md bg-white border border-border shadow-2xl z-20 p-1 font-sans text-xs normal-case tracking-normal flex flex-col gap-0.5">
                                {[
                                  { label: 'Tất cả', value: 'all' },
                                  { label: 'Có nợ', value: 'debt' },
                                  { label: 'Đã TT', value: 'paid' }
                                ].map(opt => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                      setFilterAction(opt.value)
                                      setShowActionDropdown(false)
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 hover:bg-surface2 transition-colors rounded ${
                                      filterAction === opt.value ? 'text-cblue font-bold bg-cblue/10' : 'text-text hover:text-text'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCards.map(card => {
                  const status  = getCardStatus(card)
                  const usedPct = card.creditLimit ? Math.min(100, Math.round((card.usedAmount || 0) / card.creditLimit * 100)) : 0
                  const barColor = usedPct >= 90 ? '#ef4444' : usedPct >= 70 ? '#f59e0b' : '#2563eb'
                  const remain   = (card.creditLimit || 0) - (card.usedAmount || 0)

                  return (
                    <tr key={card.id} className="border-b border-border/40 last:border-b-0 hover:bg-surface2/40 transition-colors">

                      {/* Bank + holder */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-cblue/10 border border-cblue/20 text-cblue flex items-center justify-center text-xs font-black shrink-0">
                            {bankInitials(card.bankName)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-black text-sm text-text truncate">{card.bankName}</div>
                            <div className="text-xs text-muted truncate">{card.cardHolder}</div>
                          </div>
                        </div>
                      </td>

                      {/* Card number */}
                      <td className="px-4 py-4 text-sm text-text font-mono tracking-wide whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`transition-all duration-300 ${revealedCards.has(card.id) ? 'tracking-widest text-cblue font-bold' : 'tracking-wide'}`}>
                            {revealedCards.has(card.id)
                              ? card.cardNumberFull
                                ? card.cardNumberFull.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
                                : `**** **** **** ${String(card.cardNumberLast4 || '0000').padStart(4, '0')}`
                              : maskCard(card.cardNumberLast4)
                            }
                          </span>
                          <button
                            onClick={() => toggleReveal(card.id)}
                            title={revealedCards.has(card.id) ? 'Ẩn số thẻ' : 'Hiện số thẻ'}
                            className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md border transition-all duration-200 ${
                              revealedCards.has(card.id)
                                ? 'border-cblue/50 text-cblue bg-cblue/10 hover:bg-cblue/20'
                                : 'border-border text-muted hover:border-slate-500 hover:text-text hover:bg-surface2/50'
                            }`}
                          >
                            {revealedCards.has(card.id) ? (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M1 1l22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Limit */}
                      <td className="px-4 py-4 text-right font-mono text-sm text-text tabular-nums whitespace-nowrap">
                        {fmtVNDFull(card.creditLimit)}
                      </td>

                      {/* Used + progress */}
                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-bold font-mono text-cred tabular-nums">{fmtVNDFull(card.usedAmount)}</span>
                          <span className="text-muted font-mono tabular-nums">còn {fmtVNDFull(remain < 0 ? 0 : remain)}</span>
                        </div>
                        <div className="h-1.5 bg-surface2 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width:`${usedPct}%`, background:barColor }} />
                        </div>
                        <div className="text-right text-[12px] text-muted mt-0.5">{usedPct}%</div>
                      </td>

                      {/* Số tiền sao kê */}
                      <td className="px-4 py-4 text-right font-mono text-sm text-text tabular-nums whitespace-nowrap">
                        {card.statementAmount > 0 ? (
                          <span className={card.hasStatement ? "text-cyellow font-bold" : "text-muted"}>
                            {fmtVNDFull(card.statementAmount)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      {/* Cycle */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-xs text-muted">Sao kê: <span className="text-text">{fmtDay(card.statementDate)}</span></div>
                        <div className="text-xs text-muted mt-1">Đến hạn: <span className="text-text">{fmtDay(card.dueDate)}</span></div>
                      </td>

                      {/* Sao kê */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setDetailedCard(card)}
                          className={`text-xs font-bold flex items-center gap-1.5 hover:underline transition-colors focus:outline-none ${
                            card.hasStatement ? 'text-cgreen' : 'text-muted'
                          }`}
                          title="Bấm để xem chi tiết sao kê dạng list"
                        >
                          <span className="text-sm leading-none">{card.hasStatement ? '●' : '○'}</span>
                          <span>{card.hasStatement ? 'Có rồi' : 'Chưa có'}</span>
                        </button>
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
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(card)}
                            title="Xoá"
                            className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted hover:border-cred hover:text-cred hover:bg-cred/10 transition-colors"
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

      {/* AI Scan Modal */}
      {scanningCard && (
        <OcrStatementModal
          initialCard={scanningCard.id ? scanningCard : null}
          cards={cards}
          onClose={() => setScanningCard(null)}
          onConfirmAll={async (updates) => {
            let ok = 0
            const toastId = toast.loading(`Đang cập nhật ${updates.length} thẻ...`)
            for (const item of updates) {
              try {
                const patch = {
                  usedAmount: item.amount,
                  statementAmount: item.amount,
                  hasStatement: true,
                }
                if (item.day) {
                  patch.dueDate = item.day
                }
                await actions.updateCreditCard(item.cardId, patch)
                ok++
              } catch (err) {
                console.error(`Failed to update card ${item.cardName}:`, err)
              }
            }
            toast.dismiss(toastId)
            toast.success(`✅ Đã cập nhật thành công ${ok}/${updates.length} thẻ từ sao kê!`)
            setScanningCard(null)
          }}
        />
      )}

      {/* Statement Detail Modal */}
      {detailedCard && (
        <StatementDetailModal
          card={detailedCard}
          onClose={() => setDetailedCard(null)}
          onToggleStatus={async (card) => {
            const nextVal = !card.hasStatement
            await actions.updateCreditCard(card.id, { hasStatement: nextVal })
            toast.success(nextVal ? 'Đã đánh dấu ĐÃ CÓ sao kê' : 'Đã đánh dấu CHƯA CÓ sao kê')
          }}
          onTriggerScan={(card) => {
            handleTriggerScan(card)
          }}
          onEdit={(card) => {
            setEditTarget(card)
          }}
        />
      )}
    </div>
    </div>
  )
}
