import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { useApp } from '../context/AppContext'
import { fmtVNDFull, formatMoneyLive, parseVNDInput } from '../lib/formatters'
import { MONTH_NAMES } from '../lib/constants'

const FIELD_LABELS = {
  incomeKd:   'KD',
  incomeTmdt: 'TMDT',
  incomeAff:  'Affiliate',
  income:     'Thu nhập',
  living:     'Chi sinh hoạt',
  housing:    'Chi nhà ở',
  debtRepay:  'Trả nợ NH',
}

const SUB_INCOME = ['incomeKd', 'incomeTmdt', 'incomeAff']

// ── MonthCell ──────────────────────────────────────────────────────────────

function MonthCell({ year, mi, fieldKey, initialValue, onSave, readOnly = false, compact = false }) {
  const [display, setDisplay]   = useState(initialValue ? initialValue.toLocaleString('vi-VN') : '')
  const [saving, setSaving]     = useState(false)
  const [flashOk, setFlashOk]   = useState(false)
  const [flashErr, setFlashErr] = useState(false)
  const inputRef = useRef(null)

  const triggerSave = useCallback(async (rawDisplay) => {
    if (readOnly) return
    const value = parseVNDInput(rawDisplay)
    setSaving(true)
    try {
      await onSave(year, mi, fieldKey, value)
      setFlashOk(true)
      toast.success(`✅ ${FIELD_LABELS[fieldKey]} – ${MONTH_NAMES[mi]}`, { duration: 1800 })
      setTimeout(() => setFlashOk(false), 600)
    } catch (err) {
      setFlashErr(true)
      toast.error(`❌ Lỗi: ${err.message || 'Thử lại sau'}`, { duration: 4000 })
      setTimeout(() => setFlashErr(false), 800)
    } finally {
      setSaving(false)
    }
  }, [year, mi, fieldKey, onSave, readOnly])

  function handleBlur(e) { triggerSave(e.target.value) }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.target.blur()
      const allInputs = Array.from(document.querySelectorAll(`[data-field="${fieldKey}"]`))
      const idx = allInputs.indexOf(e.target)
      if (idx >= 0 && idx < allInputs.length - 1) setTimeout(() => allInputs[idx + 1].focus(), 50)
    }
    if (e.key === 'Escape') e.target.blur()
  }

  const borderClass = readOnly
    ? 'border-transparent bg-transparent text-muted cursor-default'
    : flashOk  ? 'border-cgreen bg-cgreen/15 scale-[1.02]'
    : flashErr ? 'border-cred  bg-cred/15'
    : saving   ? 'border-cyellow/60 bg-surface2'
    : 'border-cblue/25 bg-surface2 hover:border-cblue/50 focus:border-cblue focus:bg-[#1a2744]'

  const widthClass = compact ? 'min-w-[120px]' : 'min-w-[160px]'

  // Nếu readOnly (cột Tổng) hiển thị như text
  if (readOnly) {
    return (
      <td className={`px-2 py-1.5 ${widthClass} whitespace-nowrap`}>
        <div className="w-full px-2.5 py-1.5 text-xs text-right font-mono font-bold text-cblue tabular-nums">
          {initialValue ? initialValue.toLocaleString('vi-VN') : '0'}
        </div>
      </td>
    )
  }

  return (
    <td className={`px-2 py-1.5 ${widthClass} whitespace-nowrap`}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        data-field={fieldKey}
        value={display}
        disabled={saving}
        placeholder="0"
        autoComplete="off"
        onFocus={e => e.target.select()}
        onChange={e => setDisplay(formatMoneyLive(e.target.value))}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`
          w-full px-2.5 py-1.5 rounded-md text-xs text-right font-mono
          text-cblue border outline-none
          transition-all duration-300 ease-in-out
          ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}
          ${borderClass}
        `}
        title="Enter để lưu · Esc để huỷ"
      />
    </td>
  )
}

// ── MonthRow ───────────────────────────────────────────────────────────────

function MonthRow({ year, mi, data, computed, onSave, showDetail }) {
  return (
    <tr className="border-b border-border/40 hover:bg-white/[0.02] group">
      <td className="px-3 py-2 text-xs text-muted whitespace-nowrap font-medium min-w-[90px] sticky left-0 bg-surface">
        {MONTH_NAMES[mi]}
      </td>

      {showDetail ? (
        <>
          {/* 3 sub-income cols */}
          {SUB_INCOME.map(key => (
            <MonthCell
              key={key}
              year={year} mi={mi} fieldKey={key}
              initialValue={data[key] || 0}
              onSave={onSave}
              compact
            />
          ))}
          {/* Tổng income (readonly) */}
          <MonthCell
            key="income-total"
            year={year} mi={mi} fieldKey="income"
            initialValue={data.income || 0}
            onSave={onSave}
            readOnly
            compact
          />
        </>
      ) : (
        <MonthCell
          key="income"
          year={year} mi={mi} fieldKey="income"
          initialValue={data.income || 0}
          onSave={onSave}
        />
      )}

      {/* Chi phí */}
      {['living', 'housing', 'debtRepay'].map(key => (
        <MonthCell
          key={key}
          year={year} mi={mi} fieldKey={key}
          initialValue={data[key] || 0}
          onSave={onSave}
        />
      ))}

      {/* Thặng dư */}
      <td className={`px-3 py-2 text-xs font-bold font-mono text-right tabular-nums whitespace-nowrap min-w-[110px] ${computed.surplus >= 0 ? 'text-cgreen' : 'text-cred'}`}>
        {fmtVNDFull(computed.surplus)}
      </td>
      <td className="px-3 py-2 text-xs font-mono text-right text-cblue tabular-nums whitespace-nowrap min-w-[110px]">
        {fmtVNDFull(computed.invest)}
      </td>
      <td className="px-3 py-2 text-xs font-mono text-right text-muted tabular-nums whitespace-nowrap min-w-[110px]">
        {fmtVNDFull(computed.cumCash)}
      </td>
    </tr>
  )
}

// ── YearBlock ──────────────────────────────────────────────────────────────

function YearBlock({ year, isFirst, data, computed, onSave, showDetail }) {
  const [open, setOpen] = useState(isFirst)
  const safeData     = Array.isArray(data)     ? data     : []
  const safeComputed = Array.isArray(computed) ? computed : []
  const totIncome  = safeData.reduce((s, m) => s + (m?.income || 0), 0)
  const totSurplus = safeComputed.reduce((s, c) => s + (c?.surplus || 0), 0)

  // Sub-income totals (chỉ dùng khi showDetail)
  const totKd   = safeData.reduce((s, m) => s + (m?.incomeKd   || 0), 0)
  const totTmdt = safeData.reduce((s, m) => s + (m?.incomeTmdt || 0), 0)
  const totAff  = safeData.reduce((s, m) => s + (m?.incomeAff  || 0), 0)

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface2 transition-colors text-left"
      >
        <span className="text-xs text-muted w-3">{open ? '▼' : '▶'}</span>
        <span className="font-bold text-base">Năm {year}</span>
        <span className="ml-auto text-xs text-muted">
          Thu nhập: <strong className="text-cgreen">{fmtVNDFull(totIncome)}</strong>
          {' · '}Thặng dư: <strong className={totSurplus >= 0 ? 'text-cgreen' : 'text-cred'}>{fmtVNDFull(totSurplus)}</strong>
        </span>
      </button>

      {open && (
        <div className="border-t border-border w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900/30">
          <table className="w-full min-w-max">
            <thead>
              <tr className="bg-surface2">
                <th className="px-3 py-2 text-left text-[11px] text-muted whitespace-nowrap min-w-[90px] sticky left-0 bg-surface2">Tháng</th>

                {showDetail ? (
                  <>
                    <th className="px-2 py-2 text-[11px] text-cblue text-right whitespace-nowrap min-w-[120px]">KD ✏️</th>
                    <th className="px-2 py-2 text-[11px] text-cblue text-right whitespace-nowrap min-w-[120px]">TMĐT ✏️</th>
                    <th className="px-2 py-2 text-[11px] text-cblue text-right whitespace-nowrap min-w-[120px]">Affiliate ✏️</th>
                    <th className="px-2 py-2 text-[11px] text-cyellow text-right whitespace-nowrap min-w-[120px]">Tổng Thu</th>
                  </>
                ) : (
                  <th className="px-2 py-2 text-[11px] text-cblue text-right whitespace-nowrap min-w-[160px]">Thu Nhập ✏️</th>
                )}

                {['Chi Sinh Hoạt ✏️', 'Chi Nhà Ở ✏️', 'Trả Nợ NH ✏️'].map(h => (
                  <th key={h} className="px-2 py-2 text-[11px] text-cblue text-right whitespace-nowrap min-w-[160px]">{h}</th>
                ))}
                <th className="px-3 py-2 text-right text-[11px] text-muted whitespace-nowrap min-w-[110px]">Thặng Dư</th>
                <th className="px-3 py-2 text-right text-[11px] text-muted whitespace-nowrap min-w-[110px]">Đầu Tư</th>
                <th className="px-3 py-2 text-right text-[11px] text-muted whitespace-nowrap min-w-[110px]">Tiền Mặt</th>
              </tr>
            </thead>
            <tbody>
              {safeData.map((m, mi) => (
                <MonthRow
                  key={mi}
                  year={year} mi={mi}
                  data={m || {}}
                  computed={safeComputed[mi] || { surplus: 0, invest: 0, cumCash: 0 }}
                  onSave={onSave}
                  showDetail={showDetail}
                />
              ))}

              {/* Year total row */}
              <tr className="bg-cblue/5 border-t border-cblue/20">
                <td className="px-3 py-2 text-xs font-bold text-cblue whitespace-nowrap sticky left-0 bg-cblue/5">Cả năm</td>

                {showDetail ? (
                  <>
                    <td className="px-3 py-2 text-right text-xs font-bold font-mono text-cgreen whitespace-nowrap">{fmtVNDFull(totKd)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold font-mono text-cgreen whitespace-nowrap">{fmtVNDFull(totTmdt)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold font-mono text-cgreen whitespace-nowrap">{fmtVNDFull(totAff)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold font-mono text-cyellow whitespace-nowrap">{fmtVNDFull(totIncome)}</td>
                  </>
                ) : (
                  <td className="px-3 py-2 text-right text-xs font-bold font-mono text-cgreen whitespace-nowrap">{fmtVNDFull(totIncome)}</td>
                )}

                <td colSpan={3} />
                <td className={`px-3 py-2 text-right text-xs font-bold font-mono whitespace-nowrap ${totSurplus >= 0 ? 'text-cgreen' : 'text-cred'}`}>
                  {fmtVNDFull(totSurplus)}
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function MonthlyInput() {
  const { state, actions, getAlloc } = useApp()
  const { monthData, assumptions } = state
  const [showDetail, setShowDetail] = useState(false)

  const addedYears = Object.keys(monthData).map(Number).sort((a, b) => a - b)
  const maxYear    = addedYears.length ? Math.max(...addedYears) : assumptions.startYear - 1
  const nextYear   = maxYear + 1

  // Tính toán dòng tiền cho tất cả các năm đã thêm
  const allComputed = {}
  let cash = assumptions.initialCash
  const alloc = getAlloc()
  for (const yr of addedYears) {
    const yData = monthData[yr] || []
    allComputed[yr] = []
    for (let mi = 0; mi < 12; mi++) {
      const m       = yData[mi] || {}
      const surplus = (m.income || 0) - (m.living || 0) - (m.housing || 0) - (m.debtRepay || 0)
      const invest  = Math.max(0, surplus * (assumptions.investRatio / 100))
      const cashAmt = invest * (alloc.cash || 0) / 100
      cash += surplus - invest + cashAmt
      allComputed[yr].push({ surplus, invest, cumCash: cash })
    }
  }

  return (
    <div className="p-6 max-w-full">
      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex-1 bg-cblue/10 border border-cblue/20 rounded-lg px-4 py-3 text-sm text-cblue">
          ✏️ Nhập thu nhập & chi phí thực tế. Bấm tiêu đề năm để mở/đóng.
        </div>

        {/* Toggle detail income */}
        <button
          onClick={() => setShowDetail(v => !v)}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-semibold transition-all ${
            showDetail
              ? 'bg-cblue/20 border-cblue text-cblue'
              : 'bg-surface border-border text-muted hover:border-cblue hover:text-cblue'
          }`}
        >
          <span className="text-base">{showDetail ? '🔵' : '⚪'}</span>
          {showDetail ? 'Thu nhập: Chi tiết' : 'Thu nhập: Tổng gộp'}
        </button>
      </div>

      {/* Legend khi đang detail */}
      {showDetail && (
        <div className="flex flex-wrap gap-3 mb-4 px-1">
          {[
            { key: 'incomeKd',   label: 'KD',        desc: 'Kinh doanh',        color: '#58a6ff' },
            { key: 'incomeTmdt', label: 'TMĐT',      desc: 'Bán sàn thương mại', color: '#3fb950' },
            { key: 'incomeAff',  label: 'Affiliate',  desc: 'Tiếp thị liên kết', color: '#bc8cff' },
          ].map(item => (
            <div key={item.key} className="flex items-center gap-2 text-xs text-muted">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
              <strong style={{ color: item.color }}>{item.label}</strong>
              <span>= {item.desc}</span>
            </div>
          ))}
          <span className="text-xs text-muted ml-2">·</span>
          <span className="text-xs text-cyellow font-semibold">Tổng Thu = KD + TMĐT + Affiliate (tự tính)</span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {addedYears.map(yr => (
          <YearBlock
            key={yr}
            year={yr}
            isFirst={yr === Math.min(...addedYears)}
            data={monthData[yr] || []}
            computed={allComputed[yr] || []}
            onSave={actions.setMonth}
            showDetail={showDetail}
          />
        ))}

        {/* Thêm năm */}
        <div className="flex flex-wrap items-center gap-3 mt-1">
          <button
            onClick={() => actions.addYear(nextYear)}
            className="flex items-center gap-2 px-5 py-3.5 bg-surface border-2 border-dashed border-border rounded-xl text-muted font-semibold hover:border-cblue hover:text-cblue hover:bg-cblue/5 transition-all"
          >
            <span className="text-lg">＋</span> Thêm năm {nextYear}
          </button>
          <span className="text-xs text-muted">hoặc nhập năm bất kỳ:</span>
          <div className="flex gap-2 items-center">
            <input
              id="custom-yr"
              type="number" min="2020" max="2100" placeholder="2035"
              className="w-24 input-base text-sm"
              onKeyDown={e => { if (e.key === 'Enter') { actions.addYear(parseInt(e.target.value)); e.target.value = '' } }}
            />
            <button
              className="btn-primary px-3 py-2 text-sm"
              onClick={() => { const el = document.getElementById('custom-yr'); actions.addYear(parseInt(el.value)); el.value = '' }}
            >Thêm</button>
          </div>
        </div>
      </div>
    </div>
  )
}
