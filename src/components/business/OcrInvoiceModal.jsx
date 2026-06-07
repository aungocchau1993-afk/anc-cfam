import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../../context/SupabaseContext'
import { scanInvoice, uploadInvoiceImage } from '../../lib/invoiceScanner'
import { removeVietnameseTones, fmtVNDFull } from '../../lib/formatters'
import ModalOverlay from '../ui/ModalOverlay'

// ── Thuật toán matching thông minh ─────────────────────────────────────────

function norm(str) {
  return removeVietnameseTones((str || '').toLowerCase()).replace(/[_\-\/]+/g, ' ').trim()
}

const NUM_RE = /\d+(?:[.,]\d+)?(?:\s*(?:ml|l|lít|g|kg|mg|chai|hộp|gói|lon|thùng|cái|bộ|đôi|pcs|pc|tb|v))?/gi

function extractNums(s) {
  return (s.match(NUM_RE) || []).map(t => t.replace(/\s+/g, '').toLowerCase())
}

function scoreMatch(needle, hay) {
  const n = norm(needle)
  const h = norm(hay)
  if (!n || !h) return 0
  if (n === h) return 100
  if (h.includes(n) && n.length >= 3) return 92
  if (n.includes(h) && h.length >= 3) return 88

  let score = 0
  const nNums = extractNums(n)
  const hNums = extractNums(h)
  if (nNums.length > 0) {
    const hit = nNums.filter(t => hNums.includes(t)).length
    score += (hit / nNums.length) * 38
    if (hit === 0 && hNums.length > 0) score -= 20
  }

  const nW = n.split(/\s+/).filter(w => w.length >= 2)
  const hW = h.split(/\s+/).filter(w => w.length >= 2)
  if (nW.length > 0) {
    let ws = 0
    for (const nw of nW) {
      if (hW.includes(nw))                                    { ws += 3; continue }
      if (hW.some(hw => hw.includes(nw) || nw.includes(hw))) { ws += 1.5 }
    }
    score += Math.min((ws / (nW.length * 3)) * 38, 38)
  }

  const initials = hW.map(w => w[0]).join('')
  const nClean   = n.replace(/\s+/g, '')
  if (nClean.length >= 2 && initials.includes(nClean)) score += 22
  const nInit = nW.map(w => w[0]).join('')
  if (nInit.length >= 2 && initials.startsWith(nInit)) score += 15

  const bigrams = s => { const r = []; for (let i = 0; i < s.length - 1; i++) r.push(s.slice(i, i+2)); return r }
  const nBi = new Set(bigrams(nClean))
  const hBi = bigrams(h.replace(/\s+/g, ''))
  if (nBi.size > 0) score += (hBi.filter(b => nBi.has(b)).length / nBi.size) * 15

  return Math.max(0, Math.min(Math.round(score), 99))
}

function findMatches(name, list, nameKey = 'name') {
  if (!name || !list?.length) return []
  const n = norm(name)
  return list
    .map(item => {
      const byName = scoreMatch(name, item[nameKey] || '')
      const bySku  = item.sku && norm(item.sku).length > 2 && n.includes(norm(item.sku)) ? 85 : 0
      return { item, score: Math.max(byName, bySku) }
    })
    .filter(r => r.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
}

// ── Score Badge ────────────────────────────────────────────────────────────

function ScoreBadge({ score }) {
  const cls = score >= 80 ? 'bg-cgreen/15 text-cgreen border-cgreen/30'
    : score >= 50 ? 'bg-cyellow/15 text-cyellow border-cyellow/30'
    : 'bg-slate-700/40 text-slate-400 border-slate-600/40'
  return (
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border tabular-nums shrink-0 ${cls}`}>
      {score}%
    </span>
  )
}

// ── Main Modal ─────────────────────────────────────────────────────────────
// type: 'SALE' → thêm vào giỏ POS
// type: 'PURCHASE' → tạo đơn nhập kho

export default function OcrInvoiceModal({
  type = 'SALE',
  products = [],
  suppliers = [],
  onAddItems,         // SALE callback
  onCreateImportOrder, // PURCHASE callback
  onClose,
}) {
  const { user } = useAuth()
  const fileInputRef = useRef(null)

  const isSale = type === 'SALE'
  const title  = isSale ? '🤖 OCR Hóa Đơn Bán Hàng' : '🤖 OCR Phiếu Nhập Kho'

  // stage: 'upload' | 'scanning' | 'review'
  const [stage,    setStage]   = useState('upload')
  const [file,     setFile]    = useState(null)
  const [preview,  setPreview] = useState(null)
  const [aiData,   setAiData]  = useState(null)    // raw AI result

  // ── Review state ─────────────────────────────────────────────────────────
  const [rows,        setRows]        = useState([])    // matched product rows
  const [pickerIdx,   setPickerIdx]   = useState(-1)
  const [pickerSearch,setPickerSearch]= useState('')

  // PURCHASE-specific fields
  const [supplierMatch, setSupplierMatch] = useState(null) // {item, score} | null
  const [supplierPicker,setSupplierPicker]= useState(false)
  const [supSearch,    setSupSearch]     = useState('')
  const [dueDate,      setDueDate]       = useState('')
  const [paidAmount,   setPaidAmount]    = useState('0')
  const [orderNote,    setOrderNote]     = useState('')

  // ── File handling ─────────────────────────────────────────────────────────

  function handleFile(f) {
    if (!f) return
    if (!f.type.startsWith('image/')) { toast.error('Chỉ chấp nhận file ảnh'); return }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setStage('upload')
    setAiData(null)
    setRows([])
  }

  function handleDrop(e) {
    e.preventDefault()
    handleFile(e.dataTransfer.files?.[0])
  }

  // ── Scan ──────────────────────────────────────────────────────────────────

  async function handleScan() {
    if (!file) return
    setStage('scanning')
    try {
      if (user?.id) uploadInvoiceImage(file, user.id, type).catch(() => {})
      const data = await scanInvoice(file, type)
      setAiData(data)

      // Build product rows
      const newRows = (data.items || []).map(item => {
        const matches = findMatches(item.name, products)
        const best    = matches[0] ?? null
        return {
          item,
          matches,
          product:  best?.item  ?? null,
          score:    best?.score ?? 0,
          selected: (best?.score ?? 0) >= 40,
          qty:      item.quantity > 0 ? item.quantity : 1,
          price:    best?.item ? (isSale ? best.item.sellPrice : best.item.importPrice) : (item.price || 0),
        }
      })
      setRows(newRows)

      // PURCHASE: match supplier name
      if (!isSale && data.supplier_name) {
        const supMatches = findMatches(data.supplier_name, suppliers, 'name')
        setSupplierMatch(supMatches[0] ?? null)
      }

      // PURCHASE: pre-fill due_date
      if (!isSale && data.due_date) setDueDate(data.due_date)
      if (!isSale && data.paid_amount) setPaidAmount(String(data.paid_amount))

      setStage('review')
      const matched = newRows.filter(r => r.product).length
      toast.success(`✅ Đọc xong! Khớp ${matched}/${newRows.length} sản phẩm`)
    } catch (err) {
      setStage('upload')
      toast.error(err.message || 'Lỗi khi quét hóa đơn')
    }
  }

  // ── Row helpers ───────────────────────────────────────────────────────────

  function toggleRow(i) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r))
  }
  function updateQty(i, val) {
    const q = Math.max(1, parseInt(val) || 1)
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, qty: q } : r))
  }
  function updatePrice(i, val) {
    const p = parseFloat(String(val).replace(/[^0-9.]/g, '')) || 0
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, price: p } : r))
  }
  function pickProduct(rowIdx, product) {
    setRows(prev => prev.map((r, idx) => idx === rowIdx
      ? { ...r, product, score: 100, selected: true, price: isSale ? product.sellPrice : product.importPrice }
      : r))
    setPickerIdx(-1)
    setPickerSearch('')
  }

  const pickerProducts = pickerSearch.trim()
    ? products.filter(p => norm(p.name + ' ' + (p.sku||'')).includes(norm(pickerSearch))).slice(0, 8)
    : products.slice(0, 8)

  const filteredSuppliers = supSearch.trim()
    ? suppliers.filter(s => norm(s.name).includes(norm(supSearch))).slice(0, 6)
    : suppliers.slice(0, 6)

  // ── Confirm ───────────────────────────────────────────────────────────────

  function handleConfirm() {
    const selected = rows.filter(r => r.selected && r.product)
    if (!selected.length) { toast.error('Chưa có sản phẩm nào được chọn'); return }

    if (isSale) {
      onAddItems(selected)
      toast.success(`✅ Đã thêm ${selected.length} sản phẩm vào giỏ`)
      onClose()
    } else {
      // PURCHASE → tạo đơn nhập
      const supplierId = supplierMatch?.item?.id ?? null
      const items = selected.map(r => ({
        productId:   r.product.id,
        qty:         r.qty,
        importPrice: r.price,
        currentStock:r.product.stockQuantity ?? r.product.stock_quantity ?? 0,
      }))
      onCreateImportOrder({
        supplierId,
        items,
        note:        orderNote || aiData?.supplier_name || '',
        paidAmount:  parseFloat(paidAmount) || 0,
        dueDate:     dueDate || null,
      })
      onClose()
    }
  }

  const selectedCount = rows.filter(r => r.selected && r.product).length

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-[#0d1117] border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col w-full max-h-[92vh]"
        style={{ maxWidth: stage === 'review' ? '900px' : '520px' }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <div className="font-bold text-[#e6edf3]">{title}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {stage === 'upload' && 'Upload ảnh hóa đơn → AI tự đọc dữ liệu'}
              {stage === 'scanning' && 'Gemini AI đang phân tích…'}
              {stage === 'review' && 'Kiểm tra & chỉnh sửa trước khi lưu'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Stage dots */}
            {['upload','scanning','review'].map((s, i) => (
              <div key={s} className={`w-2 h-2 rounded-full transition-colors ${
                stage === s ? (isSale ? 'bg-cpurple' : 'bg-cteal') : 'bg-slate-700'
              }`} />
            ))}
            <button onClick={onClose}
              className="ml-2 w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-cred transition-colors text-lg flex items-center justify-center">
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        {stage !== 'review' ? (

          /* ── Upload / Scanning stage ────────────────────────────────────── */
          <div className="p-5 flex flex-col gap-4 overflow-y-auto">
            <div
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => stage !== 'scanning' && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors
                ${stage === 'scanning' ? 'border-slate-700 cursor-default' : 'border-slate-700 hover:border-cblue/50 cursor-pointer group'}`}
            >
              {preview ? (
                <img src={preview} alt="Hóa đơn" className="max-h-52 rounded-lg object-contain border border-slate-700" />
              ) : (
                <>
                  <div className="text-4xl opacity-40 group-hover:opacity-70 transition-opacity">🧾</div>
                  <div className="text-sm text-slate-500 text-center">
                    Kéo thả hoặc <span className="text-cblue font-semibold">click chọn ảnh</span>
                    <br/><span className="text-[11px] text-slate-600">JPG, PNG, WEBP…</span>
                  </div>
                </>
              )}
              {stage === 'scanning' && (
                <div className="flex items-center gap-2 text-sm text-slate-400 mt-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="10"/>
                  </svg>
                  Gemini AI đang đọc hóa đơn…
                </div>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => handleFile(e.target.files?.[0])} />
            </div>

            {!import.meta.env.VITE_GEMINI_API_KEY && (
              <div className="bg-cyellow/8 border border-cyellow/25 rounded-xl px-4 py-3 text-xs text-cyellow">
                ⚠️ Cần thêm <code className="font-mono bg-black/30 px-1 rounded">VITE_GEMINI_API_KEY</code> vào <code className="font-mono bg-black/30 px-1 rounded">.env.local</code>
              </div>
            )}
          </div>

        ) : (

          /* ── Review stage — 2 cột ─────────────────────────────────────── */
          <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">

            {/* Cột trái — Ảnh gốc */}
            <div className="md:w-[340px] shrink-0 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col">
              <div className="px-4 py-2.5 border-b border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                📄 Ảnh hóa đơn gốc
              </div>
              <div className="flex-1 overflow-y-auto p-3 flex items-start justify-center">
                <img src={preview} alt="Hóa đơn" className="max-w-full rounded-lg border border-slate-700 object-contain" />
              </div>
              <div className="px-4 py-2 border-t border-slate-800">
                <button
                  onClick={() => { setStage('upload'); setRows([]); setAiData(null) }}
                  className="text-[11px] text-slate-500 hover:text-cblue transition-colors"
                >
                  ↩ Quét lại ảnh khác
                </button>
              </div>
            </div>

            {/* Cột phải — Dữ liệu trích xuất */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                <span>📋 Dữ liệu AI trích xuất</span>
                {aiData?.total_amount > 0 && (
                  <span className="text-cyellow font-mono font-black normal-case">{fmtVNDFull(aiData.total_amount)}</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">

                {/* ── PURCHASE: Thông tin nhà cung cấp + ngày ── */}
                {!isSale && (
                  <div className="flex flex-col gap-2">
                    {/* Supplier match */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Nhà cung cấp</label>
                      <div className="relative">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/60 text-sm">
                          {supplierMatch ? (
                            <>
                              <ScoreBadge score={supplierMatch.score} />
                              <span className="flex-1 text-[#e6edf3] font-semibold truncate">{supplierMatch.item.name}</span>
                            </>
                          ) : (
                            <span className="flex-1 text-slate-500 text-xs">
                              {aiData?.supplier_name ? `AI đọc: "${aiData.supplier_name}" — không khớp` : 'Không có tên NCC trên HĐ'}
                            </span>
                          )}
                          <button
                            onClick={() => setSupplierPicker(v => !v)}
                            className="text-[10px] text-cblue hover:underline shrink-0"
                          >
                            {supplierMatch ? 'Đổi' : 'Chọn'}
                          </button>
                        </div>
                        {supplierPicker && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-[#0d1117] border border-cblue/40 rounded-xl z-20 shadow-xl overflow-hidden">
                            <div className="p-2 border-b border-slate-800">
                              <input autoFocus value={supSearch} onChange={e => setSupSearch(e.target.value)}
                                placeholder="Tìm nhà cung cấp…"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none focus:border-cblue placeholder:text-slate-600"
                              />
                            </div>
                            <div className="max-h-36 overflow-y-auto">
                              {filteredSuppliers.map(s => (
                                <button key={s.id}
                                  onClick={() => { setSupplierMatch({ item: s, score: 100 }); setSupplierPicker(false); setSupSearch('') }}
                                  className="w-full px-3 py-2 text-left text-xs hover:bg-cblue/10 transition-colors text-[#e6edf3]"
                                >
                                  {s.name}
                                </button>
                              ))}
                              {filteredSuppliers.length === 0 && (
                                <div className="px-3 py-3 text-xs text-slate-600 text-center">Không tìm thấy</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Dates + payment */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Ngày đáo hạn TT</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none focus:border-cteal"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Đã trả trước (đ)</label>
                        <input type="number" min="0" value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                          className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-[#e6edf3] font-mono outline-none focus:border-cteal"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Ghi chú</label>
                      <input value={orderNote} onChange={e => setOrderNote(e.target.value)}
                        placeholder="Ghi chú thêm cho đơn nhập…"
                        className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-[#e6edf3] outline-none focus:border-cteal placeholder:text-slate-600"
                      />
                    </div>
                  </div>
                )}

                {/* ── SALE: customer name ── */}
                {isSale && aiData?.customer_name && (
                  <div className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/40 text-xs">
                    <span className="text-slate-500">Khách hàng: </span>
                    <span className="font-semibold text-[#e6edf3]">{aiData.customer_name}</span>
                  </div>
                )}

                {/* ── Product rows ── */}
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center justify-between">
                    <span>Danh sách hàng hóa ({rows.length} dòng)</span>
                    <span className="text-cgreen normal-case font-normal">{selectedCount} khớp</span>
                  </div>

                  {rows.map((row, i) => (
                    <div key={i}>
                      <div
                        onClick={() => { if (row.product) toggleRow(i); setPickerIdx(-1) }}
                        className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border transition-all ${
                          row.product
                            ? row.selected
                              ? isSale ? 'bg-cpurple/8 border-cpurple/30 cursor-pointer' : 'bg-cteal/8 border-cteal/30 cursor-pointer'
                              : 'bg-slate-800/60 border-slate-700 cursor-pointer hover:border-slate-600'
                            : 'bg-slate-900/40 border-slate-800'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                          row.product && row.selected
                            ? isSale ? 'bg-cpurple border-cpurple' : 'bg-cteal border-cteal'
                            : 'border-slate-600'
                        }`}>
                          {row.product && row.selected && (
                            <svg className="w-2.5 h-2.5 text-black" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        {/* Names */}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[#e6edf3] truncate">{row.item.name}</div>
                          {row.product ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <ScoreBadge score={row.score} />
                              <span className={`text-[10px] truncate ${isSale ? 'text-cpurple' : 'text-cteal'}`}>
                                → {row.product.name}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-600 mt-0.5">Không tự khớp được</div>
                          )}
                        </div>

                        {/* Qty */}
                        <input type="number" min="1" value={row.qty}
                          onClick={e => e.stopPropagation()}
                          onChange={e => updateQty(i, e.target.value)}
                          className="w-11 bg-slate-800 border border-slate-700 rounded-lg px-1 py-1 text-center text-xs text-[#e6edf3] outline-none focus:border-cblue shrink-0"
                        />

                        {/* Price editable */}
                        {row.product && (
                          <input type="number" min="0" value={row.price}
                            onClick={e => e.stopPropagation()}
                            onChange={e => updatePrice(i, e.target.value)}
                            title={isSale ? 'Giá bán' : 'Giá nhập'}
                            className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-1 py-1 text-right text-xs font-mono text-cblue outline-none focus:border-cblue shrink-0"
                          />
                        )}

                        {/* Manual picker btn */}
                        <button onClick={e => { e.stopPropagation(); setPickerIdx(pickerIdx === i ? -1 : i); setPickerSearch('') }}
                          className="shrink-0 w-6 h-6 rounded-lg border border-slate-700 text-slate-500 hover:border-cblue/60 hover:text-cblue transition-colors flex items-center justify-center">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
                            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>

                      {/* Alt suggestions */}
                      {row.matches?.length > 1 && row.product && pickerIdx !== i && (
                        <div className="flex gap-1 pl-8 pb-0.5 flex-wrap mt-0.5">
                          {row.matches.slice(1).map((m, mi) => (
                            <button key={mi} onClick={() => pickProduct(i, m.item)}
                              className="text-[9px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-500 hover:border-cblue/50 hover:text-cblue transition-colors">
                              {m.score}% {(m.item.name || '').slice(0, 20)}{m.item.name?.length > 20 ? '…' : ''}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Manual picker dropdown */}
                      {pickerIdx === i && (
                        <div className="ml-6 bg-[#0d1117] border border-cblue/40 rounded-xl overflow-hidden shadow-xl z-10 mt-0.5">
                          <div className="p-1.5 border-b border-slate-800">
                            <input autoFocus value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                              placeholder="Tìm sản phẩm…"
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-[#e6edf3] placeholder:text-slate-600 outline-none focus:border-cblue"
                            />
                          </div>
                          <div className="max-h-32 overflow-y-auto">
                            {pickerProducts.map(p => (
                              <button key={p.id} onClick={() => pickProduct(i, p)}
                                className="w-full px-3 py-1.5 text-left hover:bg-cblue/10 transition-colors flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-[#e6edf3] truncate">{p.name}</div>
                                  <div className="text-[10px] text-slate-500 font-mono">{p.sku}</div>
                                </div>
                                <div className="text-[10px] font-bold text-cblue shrink-0">
                                  {fmtVNDFull(isSale ? p.sellPrice : p.importPrice)}
                                </div>
                              </button>
                            ))}
                            {pickerProducts.length === 0 && (
                              <div className="px-3 py-3 text-xs text-slate-600 text-center">Không tìm thấy</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 px-5 py-4 border-t border-slate-800 flex gap-2.5">
          {stage !== 'review' ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:text-[#e6edf3] transition-colors">
                Huỷ
              </button>
              <button
                onClick={handleScan}
                disabled={!file || stage === 'scanning'}
                className={`flex-1 py-2.5 rounded-xl text-black text-sm font-black transition-all disabled:opacity-40 flex items-center justify-center gap-2
                  ${isSale ? 'bg-cpurple hover:brightness-110' : 'bg-cteal hover:brightness-110'}`}
              >
                {stage === 'scanning' ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="10"/>
                    </svg>
                    AI đang đọc…
                  </>
                ) : '🔍 Phân tích hóa đơn'}
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-400 text-sm hover:text-[#e6edf3] transition-colors">
                Huỷ
              </button>
              <button
                onClick={handleConfirm}
                disabled={selectedCount === 0}
                className={`flex-[2] py-2.5 rounded-xl text-black text-sm font-black transition-all disabled:opacity-40
                  ${isSale ? 'bg-cpurple hover:brightness-110' : 'bg-cteal hover:brightness-110'}`}
              >
                {selectedCount > 0
                  ? isSale
                    ? `🛒 Thêm ${selectedCount} sp vào giỏ`
                    : `📦 Tạo đơn nhập ${selectedCount} sản phẩm`
                  : 'Chọn sản phẩm để tiếp tục'
                }
              </button>
            </>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}
