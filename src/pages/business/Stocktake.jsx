import { useState, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  ClipboardList, Plus, Search, Eye, Printer, X, CheckCircle2,
  FileText, PackagePlus, PackageMinus, Loader2, Download,
} from 'lucide-react'
import {
  loadProducts, loadStocktakes, loadStocktakeItems,
  createStocktake, completeStocktake,
} from '../../lib/supabase'
import { removeVietnameseTones } from '../../lib/formatters'
import ModalOverlay from '../../components/ui/ModalOverlay'
import PageHeader from '../../components/ui/PageHeader'
import DateFilterBar, { getDateRange, toInputDate, startOf } from '../../components/ui/DateFilterBar'
import { SkeletonCard } from '../../components/ui/Skeleton'
import Can from '../../components/permission/Can'
import { PERMISSIONS } from '../../lib/permissions/permissionConstants'

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
  if (variance === 0) return <span className="text-muted font-mono tabular-nums">—</span>
  return (
    <span className={`font-bold tabular-nums font-mono ${variance > 0 ? 'text-cgreen' : 'text-cred'}`}>
      {variance > 0 ? '+' : ''}{fmtQty(variance)}
    </span>
  )
}

// ── Confirm Modal ──────────────────────────────────────────────────────────
function ConfirmModal({ itemCount, changedCount, onConfirm, onClose, loading }) {
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm mx-4 p-6 shadow-card flex flex-col gap-4">
        <div className="flex items-center gap-2 text-cardtitle font-bold text-text">
          <CheckCircle2 size={20} className="text-cgreen" />
          Hoàn tất kiểm kho?
        </div>
        <div className="text-sm text-muted leading-relaxed">
          Hệ thống sẽ cân bằng tồn kho cho{' '}
          <strong className="text-text">{itemCount} sản phẩm</strong>
          {changedCount > 0 && <>, trong đó <strong className="text-cyellow">{changedCount} sản phẩm</strong> có chênh lệch</>}.
          <br /><span className="text-cred text-xs mt-1 block">Hành động này không thể hoàn tác.</span>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="btn-ghost disabled:opacity-50">
            Huỷ
          </button>
          <Can permission={PERMISSIONS.STOCKTAKE_COMPLETE}>
            <button onClick={onConfirm} disabled={loading} className="btn-success disabled:opacity-60">
              {loading
                ? <><Loader2 size={16} className="animate-spin" />Đang cân bằng…</>
                : <><CheckCircle2 size={16} />Xác nhận &amp; Cân bằng kho</>
              }
            </button>
          </Can>
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
  <h1>PHIẾU KIỂM KHO</h1>
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
      <div className="bg-surface border border-border rounded-2xl w-full max-w-3xl mx-4 shadow-card flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="flex items-center gap-2 font-bold text-text">
              <FileText size={18} className="text-cblue" />
              Chi tiết phiếu kiểm kho
            </div>
            <div className="text-xs text-muted mt-0.5">{fmtDate(stocktake.created_at)}</div>
            {stocktake.notes && <div className="text-xs text-subtle mt-0.5">Ghi chú: {stocktake.notes}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={loading}
              className="btn-ghost h-10 px-4 disabled:opacity-50"
            >
              <Printer size={16} />
              In phiếu
            </button>
            <button onClick={onClose}
              className="w-9 h-9 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-3 gap-3 px-5 py-3 border-b border-border shrink-0">
            {[
              { label: 'Tổng SP', value: items.length,    color: 'text-cblue'   },
              { label: 'Thừa',    value: surplus,          color: 'text-cgreen'  },
              { label: 'Thiếu',   value: shortage,         color: 'text-cred'    },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-caption text-muted uppercase tracking-wide">{s.label}</div>
                <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-16 text-muted text-sm">Đang tải chi tiết…</div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 text-subtle">Không có dữ liệu sản phẩm</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    {['SKU', 'Tên sản phẩm', 'Tồn hệ thống', 'Tồn thực tế', 'Chênh lệch'].map((h, i) => (
                      <th key={h} className={`sticky top-0 z-10 bg-gray-50 px-4 py-4 text-caption font-semibold text-muted uppercase tracking-wider whitespace-nowrap ${i >= 2 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map(item => {
                    const changed = item.variance !== 0
                    return (
                      <tr key={item.id} className={`transition-colors ${changed ? 'bg-cyellow/5' : 'hover:bg-surface2'}`}>
                        <td className="px-4 py-4 font-mono text-xs text-muted whitespace-nowrap">{item.sku}</td>
                        <td className="px-4 py-4 text-sm text-text max-w-[200px]">
                          <div className="truncate">{item.name}</div>
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-sm text-muted tabular-nums whitespace-nowrap">
                          {fmtQty(item.systemQty)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-sm tabular-nums whitespace-nowrap">
                          <span className={changed ? (item.variance > 0 ? 'text-cgreen font-bold' : 'text-cred font-bold') : 'text-muted'}>
                            {fmtQty(item.actualQty)}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
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

  // ── Chọn nhiều dòng lịch sử kiểm kho (chỉ để xuất Excel — không có bulk delete) ──
  const [selectedIds, setSelectedIds] = useState(() => new Set())

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

  // ── Chọn nhiều dòng lịch sử — chỉ dùng để xuất Excel, không sửa/xoá dữ liệu ──
  function toggleSelectHistOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectHistAll() {
    setSelectedIds(prev => {
      const ids = filteredHistory.map(h => h.id)
      const allSelected = ids.length > 0 && ids.every(id => prev.has(id))
      const next = new Set(prev)
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }
  function clearHistSelection() { setSelectedIds(new Set()) }

  function handleExportSelectedHistory() {
    const rows = filteredHistory
      .filter(h => selectedIds.has(h.id))
      .map(h => ({
        'Ngày kiểm': fmtDate(h.created_at),
        'Trạng thái': h.status === 'completed' ? 'Hoàn thành' : 'Nháp',
        'Ghi chú': h.notes ?? '',
      }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 40 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Kiểm Kho đã chọn')
    XLSX.writeFile(wb, 'Kiem_Kho_Da_Chon.xlsx')
    toast.success(`Đã xuất ${rows.length} phiếu kiểm kho`)
  }

  async function handleComplete() {
    setSaving(true)
    try {
      const st = await createStocktake(notes)
      await completeStocktake(st, rows, notes)
      setProducts(prev => prev.map(p => {
        const r = rows.find(x => x.productId === p.id)
        return r ? { ...p, stockQuantity: r.actualQty } : p
      }))
      toast.success(`Kiểm kho hoàn tất — đã cân bằng ${rows.length} sản phẩm`)
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
      <div className="w-full">
        <PageHeader
          icon={ClipboardList}
          title="Kiểm Kho"
          subtitle="Đối chiếu tồn kho hệ thống và thực tế"
          actions={
            <Can permission={PERMISSIONS.STOCKTAKE_CREATE}>
              <button onClick={handleNewSession} disabled={loadingProd} className="btn-primary disabled:opacity-50">
                {loadingProd
                  ? <Loader2 size={16} className="animate-spin" />
                  : <Plus size={16} />
                }
                Tạo phiếu kiểm kho mới
              </button>
            </Can>
          }
        />
      <div className="p-6 w-full">

        {/* ── Bộ lọc lịch sử ── */}
        <DateFilterBar
          preset={histPreset}   setPreset={setHistPreset}
          customFrom={histFrom} setCustomFrom={setHistFrom}
          customTo={histTo}     setCustomTo={setHistTo}
          showAllTime={true}
          className="mb-4"
        />

        {/* ══════ BULK ACTION BAR — nổi phía trên danh sách khi có chọn (chỉ xuất Excel) ══════ */}
        {selectedIds.size > 0 && (
          <div className="mb-4 bg-[#0f172a] rounded-2xl shadow-lg px-4 py-3 flex flex-wrap items-center gap-2.5 animate-slideUp">
            <span className="text-sm font-semibold text-white mr-1">Đã chọn {selectedIds.size} phiếu</span>
            <div className="w-px h-6 bg-white/15 hidden sm:block" />
            <Can permission={PERMISSIONS.INVENTORY_EXPORT}>
              <button onClick={handleExportSelectedHistory}
                className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[14px] font-medium transition-colors">
                <Download size={14} strokeWidth={2} /> Xuất Excel
              </button>
            </Can>
            <button onClick={clearHistSelection}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg text-white/60 hover:text-white text-[14px] font-medium transition-colors ml-auto">
              <X size={14} strokeWidth={2.2} /> Bỏ chọn
            </button>
          </div>
        )}

        {loadingHist ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredHistory.length > 0 ? (
          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-text flex items-center gap-2">
                <input type="checkbox"
                  checked={filteredHistory.length > 0 && filteredHistory.every(h => selectedIds.has(h.id))}
                  onChange={toggleSelectHistAll}
                  className="w-4 h-4 rounded accent-cblue mr-1" />
                <FileText size={16} className="text-cblue" />
                Lịch sử kiểm kho
              </span>
              <span className="text-xs font-semibold text-muted bg-surface2 border border-border px-3 py-1 rounded-full">
                {filteredHistory.length}{history.length !== filteredHistory.length ? ` / ${history.length}` : ''} phiếu
              </span>
            </div>
            <div className="divide-y divide-border">
              {filteredHistory.map(h => {
                const checked = selectedIds.has(h.id)
                return (
                <div key={h.id} className={`px-5 py-3.5 flex items-center gap-3 transition-colors group ${checked ? 'bg-cblue/5' : 'hover:bg-surface2'}`}>
                  <input type="checkbox" checked={checked} onChange={() => toggleSelectHistOne(h.id)}
                    className="w-4 h-4 rounded accent-cblue shrink-0" />

                  <div className="min-w-0 flex-1 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-mono text-muted">{fmtDate(h.created_at)}</div>
                      {h.notes && (
                        <div className="text-xs text-subtle mt-0.5 truncate max-w-[300px]">{h.notes}</div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Xem chi tiết */}
                      <button
                        onClick={() => setViewTarget(h)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-muted text-xs font-semibold hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors"
                      >
                        <Eye size={14} />
                        Xem chi tiết
                      </button>

                      {/* Badge trạng thái */}
                      <span className={`text-[12px] font-bold rounded-full border px-2.5 py-0.5 ${
                        h.status === 'completed'
                          ? 'text-cgreen bg-cgreen/15 border-cgreen/30'
                          : 'text-cyellow bg-cyellow/15 border-cyellow/30'
                      }`}>
                        {h.status === 'completed' ? 'Hoàn thành' : 'Nháp'}
                      </span>
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border py-20 text-center text-subtle">
            <ClipboardList size={44} className="mx-auto mb-3 text-subtle" />
            <div className="font-semibold text-muted">
              {history.length > 0 ? 'Không có phiếu nào trong khoảng thời gian này' : 'Chưa có phiếu kiểm kho nào'}
            </div>
            <div className="text-xs mt-1 text-subtle">
              {history.length > 0 ? 'Hãy chọn khoảng thời gian khác hoặc "Toàn thời gian"' : 'Bấm nút trên để bắt đầu kiểm kho'}
            </div>
          </div>
        )}

        {/* Detail Modal */}
        {viewTarget && <DetailModal stocktake={viewTarget} onClose={() => setViewTarget(null)} />}
      </div>
      </div>
    )
  }

  // ── Phiếu đang mở ─────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      <PageHeader
        icon={ClipboardList}
        title="Phiếu Kiểm Kho"
        subtitle={`Bắt đầu: ${fmtDate(session.startedAt)} · ${rows.length} sản phẩm`}
        actions={
          <>
            <Can permission={PERMISSIONS.STOCKTAKE_COMPLETE}>
              <button onClick={handleCancelSession} className="btn-ghost">
                Huỷ phiếu
              </button>
              <button onClick={() => setShowConfirm(true)} disabled={saving} className="btn-success disabled:opacity-60">
                <CheckCircle2 size={16} />
                Hoàn tất &amp; Cân bằng kho
              </button>
            </Can>
          </>
        }
      />
    <div className="p-6 w-full flex flex-col gap-4">

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng SP kiểm',  value: rows.length,    color: 'text-cblue',   icon: ClipboardList },
          { label: 'Có chênh lệch', value: stats.changed,  color: 'text-cyellow', icon: FileText },
          { label: 'Thừa hàng',     value: stats.surplus,  color: 'text-cgreen',  icon: PackagePlus },
          { label: 'Thiếu hàng',    value: stats.shortage, color: 'text-cred',    icon: PackageMinus },
        ].map(k => (
          <div key={k.label} className="card p-4">
            <div className="flex items-center gap-1.5 text-caption text-muted font-semibold uppercase tracking-wider">
              <k.icon size={13} />
              {k.label}
            </div>
            <div className={`text-2xl font-bold tabular-nums mt-1 ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            className="input-base pl-10"
            placeholder="Lọc sản phẩm trong phiếu…"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <input
          className="input-base flex-1"
          placeholder="Ghi chú phiếu kiểm kho…"
          value={notes} onChange={e => setNotes(e.target.value)}
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <span className="text-sm font-bold text-text">Bảng Nhập Liệu</span>
          <span className="text-xs font-semibold text-muted bg-surface2 border border-border px-3 py-1 rounded-full">
            {search ? `${filteredRows.length} / ${rows.length} sản phẩm` : `${rows.length} sản phẩm`}
          </span>
        </div>
        <div className="w-full overflow-x-auto max-h-[560px] overflow-y-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                {['SKU', 'Tên sản phẩm', 'Tồn hệ thống', 'Tồn thực tế', 'Chênh lệch'].map((h, i) => (
                  <th key={h} className={`sticky top-0 z-10 bg-gray-50 px-4 py-4 text-caption font-semibold text-muted uppercase tracking-wider whitespace-nowrap ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.map(r => {
                const variance = r.actualQty - r.systemQty
                const changed  = variance !== 0
                return (
                  <tr key={r.productId} className={`transition-colors ${changed ? 'bg-cyellow/5 hover:bg-cyellow/10' : 'hover:bg-surface2'}`}>
                    <td className="px-4 py-4 font-mono text-xs text-muted whitespace-nowrap">{r.sku}</td>
                    <td className="px-4 py-4 text-sm text-text max-w-[220px]">
                      <div className="truncate">{r.name}</div>
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums font-mono text-muted whitespace-nowrap">
                      {fmtQty(r.systemQty)}
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <input type="number" min="0" value={r.actualQty}
                        onChange={e => setActual(r.productId, e.target.value)}
                        className={`w-24 rounded-xl px-3 py-2 text-sm text-right font-mono font-bold outline-none transition-all border ${
                          changed
                            ? 'bg-cyellow/10 border-cyellow/50 text-cyellow focus:border-cyellow'
                            : 'bg-white border-border text-text focus:border-cblue'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
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
    </div>
  )
}
