import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  loadProducts, loadStocktakes, loadStocktakeItems,
  createStocktake, completeStocktake,
} from '../../lib/supabase'
import { removeVietnameseTones } from '../../lib/formatters'
import ModalOverlay from '../../components/ui/ModalOverlay'
import DateFilterBar, { getDateRange, toInputDate, startOf } from '../../components/ui/DateFilterBar'

const LS_SESSION = 'stocktake_session'
const LS_ROWS    = 'stocktake_rows'
const LS_NOTES   = 'stocktake_notes'

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtQty(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN')
}
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('vi-VN')
}

// ── Variance badge ─────────────────────────────────────────────────────────
function VarianceBadge({ variance }) {
  if (variance === 0) return <span className="text-slate-500 font-mono tabular-nums">—</span>
  return (
    <span className={`font-black tabular-nums font-mono ${variance > 0 ? 'text-cgreen' : 'text-cred'}`}>
      {variance > 0 ? '+' : ''}{fmtQty(variance)}
    </span>
  )
}

// ── Confirm Modal ──────────────────────────────────────────────────────────
function ConfirmModal({ itemCount, changedCount, onConfirm, onClose, loading }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-[#0d1117] border border-slate-700 rounded-2xl w-full max-w-sm mx-4 p-6 shadow-2xl flex flex-col gap-4">
        <div className="text-base font-bold text-[#e6edf3]">✅ Hoàn tất kiểm kho?</div>
        <div className="text-sm text-slate-400 leading-relaxed">
          Hệ thống sẽ cân bằng tồn kho cho{' '}
          <strong className="text-[#e6edf3]">{itemCount} sản phẩm</strong>
          {changedCount > 0 && <>, trong đó <strong className="text-cyellow">{changedCount} sản phẩm</strong> có chênh lệch</>}.
          <br /><span className="text-cred text-xs mt-1 block">Hành động này không thể hoàn tác.</span>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={loading}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:text-[#e6edf3] transition-colors disabled:opacity-50">
            Huỷ
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-5 py-2 rounded-lg bg-cgreen hover:brightness-110 text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center gap-2">
            {loading
              ? <><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>Đang cân bằng…</>
              : '✅ Xác nhận & Cân bằng kho'
            }
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Detail Modal ───────────────────────────────────────────────────────────
function DetailModal({ stocktake, onClose }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStocktakeItems(stocktake.id)
      .then(setItems)
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [stocktake.id])

  const changed  = items.filter(i => i.variance !== 0)
  const surplus  = items.filter(i => i.variance > 0).length
  const shortage = items.filter(i => i.variance < 0).length

  function handlePrint() {
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <title>Phiếu Kiểm Kho — ${fmtDate(stocktake.created_at)}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
    h1 { font-size: 18px; font-weight: bold; margin-bottom: 4px; }
    .meta { font-size: 11px; color: #555; margin-bottom: 16px; }
    .stats { display: flex; gap: 24px; margin-bottom: 16px; }
    .stat { background: #f5f5f5; border-radius: 6px; padding: 8px 14px; }
    .stat-label { font-size: 10px; color: #777; text-transform: uppercase; }
    .stat-value { font-size: 16px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #222; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; }
    th.r, td.r { text-align: right; }
    td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
    tr.changed { background: #fffbeb; }
    .plus  { color: #16a34a; font-weight: bold; }
    .minus { color: #dc2626; font-weight: bold; }
    .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <h1>📋 PHIẾU KIỂM KHO</h1>
  <div class="meta">
    Ngày kiểm: ${fmtDate(stocktake.created_at)} &nbsp;|&nbsp;
    Trạng thái: Hoàn thành &nbsp;|&nbsp;
    Tổng SP: ${items.length}
    ${stocktake.notes ? `<br/>Ghi chú: ${stocktake.notes}` : ''}
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-label">Có chênh lệch</div><div class="stat-value">${changed.length}</div></div>
    <div class="stat"><div class="stat-label">Thừa hàng</div><div class="stat-value" style="color:#16a34a">${surplus}</div></div>
    <div class="stat"><div class="stat-label">Thiếu hàng</div><div class="stat-value" style="color:#dc2626">${shortage}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>SKU</th><th>Tên sản phẩm</th>
        <th class="r">Tồn hệ thống</th>
        <th class="r">Tồn thực tế</th>
        <th class="r">Chênh lệch</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item, idx) => `
        <tr class="${item.variance !== 0 ? 'changed' : ''}">
          <td>${idx + 1}</td>
          <td style="font-family:monospace">${item.sku}</td>
          <td>${item.name}</td>
          <td class="r">${fmtQty(item.systemQty)}</td>
          <td class="r">${fmtQty(item.actualQty)}</td>
          <td class="r ${item.variance > 0 ? 'plus' : item.variance < 0 ? 'minus' : ''}">
            ${item.variance === 0 ? '—' : (item.variance > 0 ? '+' : '') + fmtQty(item.variance)}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="footer">In bởi hệ thống Business OS · ${new Date().toLocaleString('vi-VN')}</div>
</body>
</html>`

    const win = window.open('', '_blank', 'width=900,height=700')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-[#0d1117] border border-slate-700/80 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <div className="font-bold text-[#e6edf3]">📋 Chi tiết phiếu kiểm kho</div>
            <div className="text-xs text-slate-500 mt-0.5">{fmtDate(stocktake.created_at)}</div>
            {stocktake.notes && <div className="text-xs text-slate-400 mt-0.5">📝 {stocktake.notes}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              In phiếu
            </button>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-cred transition-colors text-lg leading-none">
              ×
            </button>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-slate-800 shrink-0">
            {[
              { label: 'Tổng SP', value: items.length,    color: 'text-cblue'   },
              { label: 'Thừa',    value: surplus,          color: 'text-cgreen'  },
              { label: 'Thiếu',   value: shortage,         color: 'text-cred'    },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-[10px] text-slate-500 uppercase tracking-wide">{s.label}</div>
                <div className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-16 text-slate-500 text-sm">Đang tải chi tiết…</div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-slate-600">Không có dữ liệu sản phẩm</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800">
                    {['SKU', 'Tên sản phẩm', 'Tồn hệ thống', 'Tồn thực tế', 'Chênh lệch'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${i >= 2 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {items.map(item => {
                    const changed = item.variance !== 0
                    return (
                      <tr key={item.id} className={`transition-colors ${changed ? 'bg-cyellow/5' : 'hover:bg-slate-800/30'}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">{item.sku}</td>
                        <td className="px-4 py-2.5 text-sm text-[#e6edf3] max-w-[200px]">
                          <div className="truncate">{item.name}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm text-slate-300 tabular-nums whitespace-nowrap">
                          {fmtQty(item.systemQty)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums whitespace-nowrap">
                          <span className={changed ? (item.variance > 0 ? 'text-cgreen font-bold' : 'text-cred font-bold') : 'text-slate-300'}>
                            {fmtQty(item.actualQty)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <VarianceBadge variance={item.variance} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </ModalOverlay>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Stocktake() {
  const [products,    setProducts]    = useState([])
  const [loadingProd, setLoadingProd] = useState(true)
  const [history,     setHistory]     = useState([])
  const [loadingHist, setLoadingHist] = useState(true)
  const [viewTarget,  setViewTarget]  = useState(null)

  // ── Bộ lọc lịch sử kiểm kho ──────────────────────────────────────────────
  const [histPreset,  setHistPreset]  = useState('all')
  const [histFrom,    setHistFrom]    = useState(toInputDate(startOf('month')))
  const [histTo,      setHistTo]      = useState(toInputDate(new Date()))

  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_SESSION) || 'null') } catch { return null }
  })
  const [rows, setRows] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_ROWS) || '[]') } catch { return [] }
  })
  const [notes, setNotes] = useState(() => localStorage.getItem(LS_NOTES) || '')

  const [search,      setSearch]      = useState('')
  const [saving,      setSaving]      = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    loadProducts('')
      .then(setProducts)
      .catch(e => toast.error(e.message))
      .finally(() => setLoadingProd(false))
  }, [])

  useEffect(() => {
    loadStocktakes()
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(e => console.warn('Không load được lịch sử:', e.message))
      .finally(() => setLoadingHist(false))
  }, [])

  useEffect(() => {
    if (session) localStorage.setItem(LS_SESSION, JSON.stringify(session))
    else         localStorage.removeItem(LS_SESSION)
  }, [session])

  useEffect(() => { localStorage.setItem(LS_ROWS, JSON.stringify(rows)) }, [rows])
  useEffect(() => { localStorage.setItem(LS_NOTES, notes) }, [notes])

  function handleNewSession() {
    setRows(products.map(p => ({
      productId: p.id, sku: p.sku, name: p.name,
      systemQty: p.stockQuantity ?? 0, actualQty: p.stockQuantity ?? 0,
    })))
    setNotes('')
    setSearch('')
    setSession({ id: null, startedAt: new Date().toISOString() })
  }

  function handleCancelSession() {
    setSession(null); setRows([]); setNotes('')
    localStorage.removeItem(LS_SESSION)
    localStorage.removeItem(LS_ROWS)
    localStorage.removeItem(LS_NOTES)
  }

  function setActual(productId, val) {
    const n = Math.max(0, parseInt(val) || 0)
    setRows(prev => prev.map(r => r.productId === productId ? { ...r, actualQty: n } : r))
  }

  const filteredRows = useMemo(() => {
    const safeList  = Array.isArray(rows) ? rows : []
    const safeQuery = removeVietnameseTones(search || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return safeList
    return safeList.filter(r => {
      const name = removeVietnameseTones(r?.name)
      const sku  = removeVietnameseTones(r?.sku)
      return words.every(w => name.includes(w) || sku.includes(w))
    })
  }, [rows, search])

  const stats = useMemo(() => ({
    changed:  rows.filter(r => r.actualQty !== r.systemQty).length,
    surplus:  rows.filter(r => r.actualQty >  r.systemQty).length,
    shortage: rows.filter(r => r.actualQty <  r.systemQty).length,
  }), [rows])

  // Lọc lịch sử theo preset
  const filteredHistory = useMemo(() => {
    if (histPreset === 'all') return history
    const { from, to } = getDateRange(histPreset, histFrom, histTo)
    if (!from || !to) return history
    return history.filter(st => {
      const d = new Date(st.created_at)
      return d >= from && d <= to
    })
  }, [history, histPreset, histFrom, histTo])

  async function handleComplete() {
    setSaving(true)
    try {
      const st = await createStocktake(notes)
      await completeStocktake(st, rows, notes)
      setProducts(prev => prev.map(p => {
        const r = rows.find(x => x.productId === p.id)
        return r ? { ...p, stockQuantity: r.actualQty } : p
      }))
      toast.success(`✅ Kiểm kho hoàn tất — đã cân bằng ${rows.length} sản phẩm`)
      const updated = await loadStocktakes()
      setHistory(Array.isArray(updated) ? updated : [])
      handleCancelSession()
    } catch (e) {
      toast.error(e.message || 'Lỗi cân bằng kho')
    } finally {
      setSaving(false)
      setShowConfirm(false)
    }
  }

  // ── Màn hình danh sách ────────────────────────────────────────────────────
  if (!session) {
    return (
      <div className="p-6 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-lg font-bold text-[#e6edf3]">📋 Kiểm Kho</h2>
            <p className="text-xs text-slate-500 mt-0.5">Đối chiếu tồn kho thực tế với hệ thống và cân bằng tự động</p>
          </div>
          <button onClick={handleNewSession} disabled={loadingProd}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cblue hover:brightness-110 text-white text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-cblue/20">
            {loadingProd
              ? <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>
              : <span className="text-lg leading-none">＋</span>
            }
            Tạo phiếu kiểm kho mới
          </button>
        </div>

        {/* ── Bộ lọc lịch sử ── */}
        <DateFilterBar
          preset={histPreset}   setPreset={setHistPreset}
          customFrom={histFrom} setCustomFrom={setHistFrom}
          customTo={histTo}     setCustomTo={setHistTo}
          showAllTime={true}
          className="mb-4"
        />

        {loadingHist ? (
          <div className="text-center py-16 text-slate-500 text-sm">Đang tải lịch sử…</div>
        ) : filteredHistory.length > 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-300">📂 Lịch sử kiểm kho</span>
              <span className="text-xs text-slate-500">
                {filteredHistory.length}{history.length !== filteredHistory.length ? ` / ${history.length}` : ''} phiếu
              </span>
            </div>
            <div className="divide-y divide-slate-800">
              {filteredHistory.map(h => (
                <div key={h.id} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors group">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-slate-400">{fmtDate(h.created_at)}</div>
                    {h.notes && (
                      <div className="text-xs text-slate-500 mt-0.5 truncate max-w-[300px]">📝 {h.notes}</div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Xem chi tiết */}
                    <button
                      onClick={() => setViewTarget(h)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs font-semibold hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8"/>
                        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8"/>
                      </svg>
                      Xem chi tiết
                    </button>

                    {/* Badge trạng thái */}
                    <span className={`text-[11px] font-bold rounded-full border px-2.5 py-0.5 ${
                      h.status === 'completed'
                        ? 'text-cgreen bg-cgreen/15 border-cgreen/30'
                        : 'text-cyellow bg-cyellow/15 border-cyellow/30'
                    }`}>
                      {h.status === 'completed' ? '✅ Hoàn thành' : '⏳ Nháp'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-800 py-20 text-center text-slate-600">
            <div className="text-5xl mb-3">📋</div>
            <div className="font-semibold text-slate-500">
              {history.length > 0 ? 'Không có phiếu nào trong khoảng thời gian này' : 'Chưa có phiếu kiểm kho nào'}
            </div>
            <div className="text-xs mt-1 text-slate-600">
              {history.length > 0 ? 'Hãy chọn khoảng thời gian khác hoặc "Toàn thời gian"' : 'Bấm nút trên để bắt đầu kiểm kho'}
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {viewTarget && <DetailModal stocktake={viewTarget} onClose={() => setViewTarget(null)} />}
      </div>
    )
  }

  // ── Phiếu đang mở ─────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-7xl flex flex-col gap-4">

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-[#e6edf3]">📋 Phiếu Kiểm Kho</h2>
          <div className="text-xs text-slate-500 mt-0.5">
            Bắt đầu: {fmtDate(session.startedAt)} · {rows.length} sản phẩm
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCancelSession}
            className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:text-cred hover:border-cred/50 transition-colors">
            Huỷ phiếu
          </button>
          <button onClick={() => setShowConfirm(true)} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cgreen hover:brightness-110 text-white text-sm font-bold transition-all disabled:opacity-60 shadow-lg shadow-cgreen/20">
            ✅ Hoàn tất & Cân bằng kho
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng SP kiểm',  value: rows.length,    color: 'text-cblue',   bg: 'bg-cblue/8   border-cblue/20'   },
          { label: 'Có chênh lệch', value: stats.changed,  color: 'text-cyellow', bg: 'bg-cyellow/8 border-cyellow/20' },
          { label: 'Thừa hàng',     value: stats.surplus,  color: 'text-cgreen',  bg: 'bg-cgreen/8  border-cgreen/20'  },
          { label: 'Thiếu hàng',    value: stats.shortage, color: 'text-cred',    bg: 'bg-cred/8    border-cred/20'    },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{k.label}</div>
            <div className={`text-2xl font-black tabular-nums mt-1 ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/>
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#e6edf3] placeholder:text-slate-600 outline-none focus:border-cblue/60 transition-all"
            placeholder="Lọc sản phẩm trong phiếu…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <input
          className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-[#e6edf3] placeholder:text-slate-600 outline-none focus:border-cblue/60 transition-all"
          placeholder="Ghi chú phiếu kiểm kho…"
          value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-sm font-bold text-[#e6edf3]">Bảng Nhập Liệu</span>
          <span className="text-xs text-slate-500">
            {search ? `${filteredRows.length} / ${rows.length} sản phẩm` : `${rows.length} sản phẩm`}
          </span>
        </div>
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800">
                {['SKU', 'Tên sản phẩm', 'Tồn hệ thống', 'Tồn thực tế', 'Chênh lệch'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRows.map(r => {
                const variance = r.actualQty - r.systemQty
                const changed  = variance !== 0
                return (
                  <tr key={r.productId} className={`transition-colors ${changed ? 'bg-cyellow/5 hover:bg-cyellow/8' : 'hover:bg-slate-800/40'}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400 whitespace-nowrap">{r.sku}</td>
                    <td className="px-4 py-3 text-sm text-[#e6edf3] max-w-[220px]">
                      <div className="truncate">{r.name}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-slate-300 whitespace-nowrap">
                      {fmtQty(r.systemQty)}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <input type="number" min="0" value={r.actualQty}
                        onChange={e => setActual(r.productId, e.target.value)}
                        className={`w-24 rounded-lg px-3 py-1.5 text-sm text-right font-mono font-bold outline-none transition-all border ${
                          changed
                            ? 'bg-cyellow/10 border-cyellow/50 text-cyellow focus:border-cyellow'
                            : 'bg-slate-800 border-slate-700 text-[#e6edf3] focus:border-cblue'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <VarianceBadge variance={variance} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showConfirm && (
        <ConfirmModal
          itemCount={rows.length}
          changedCount={stats.changed}
          loading={saving}
          onConfirm={handleComplete}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
