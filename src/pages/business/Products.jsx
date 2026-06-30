import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { loadProducts, insertProduct, updateProduct, deleteProduct, uploadProductImage, deleteProductImage, upsertProducts, uploadProductImageBlob, loadSuppliers, createImportOrder } from '../../lib/supabase'
import { buildReceiptHtml, printViaIframe } from '../../lib/printReceipt'
import ModalOverlay from '../../components/ui/ModalOverlay'
import OcrInvoiceModal from '../../components/business/OcrInvoiceModal'
import AuditLogModal from '../../components/business/AuditLogModal'
import { ImportMethodModal, ImportBestExpressModal } from './ImportBestExpress'
import useDebounce from '../../hooks/useDebounce'
import { formatMoneyLive, parseVNDInput, fmtVNDFull, removeVietnameseTones } from '../../lib/formatters'
const fmtVND = v => v >= 1e6 ? `${(v/1e6).toFixed(1)}tr` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : (v||0).toString()

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtQty(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN')
}

function stockBadge(qty) {
  if (qty <= 0)  return { label: 'Hết hàng', cls: 'bg-cred/15 text-cred border-cred/30' }
  if (qty <= 10) return { label: 'Sắp hết',  cls: 'bg-cyellow/15 text-cyellow border-cyellow/30' }
  return { label: 'Còn hàng', cls: 'bg-cgreen/15 text-cgreen border-cgreen/30' }
}

// Sinh danh sách số trang có dấu "…"
function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (cur <= 4)        return [1, 2, 3, 4, 5, '…', total]
  if (cur >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', cur - 1, cur, cur + 1, '…', total]
}

// ── Product Form Modal ─────────────────────────────────────────────────────

const EMPTY = { sku: '', name: '', importPrice: '', sellPrice: '', stockQuantity: '', minStock: '5', unit: '' }
const COMMON_UNITS = ['Cái', 'Hộp', 'Lon', 'Thùng', 'Chai', 'Gói', 'Kg', 'Lít', 'Bộ', 'Đôi', 'Tá', 'Cuộn']

// ── Modal 1: Thêm hàng mới / Sửa thông tin ────────────────────────────────
function AddProductModal({ initial, onSave, onClose }) {
  const isEdit = !!initial?.id
  const [form, setForm]       = useState(() => isEdit ? {
    sku:           initial.sku,
    name:          initial.name,
    importPrice:   initial.importPrice?.toLocaleString('vi-VN') ?? '',
    sellPrice:     initial.sellPrice?.toLocaleString('vi-VN')   ?? '',
    stockQuantity: String(initial.stockQuantity ?? ''),
    minStock:      String(initial.minStock ?? 5),
    unit:          initial.unit ?? '',
  } : { ...EMPTY })
  const [saving, setSaving]       = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl,  setImageUrl]  = useState(initial?.imageUrl ?? null)
  const [preview,   setPreview]   = useState(null)
  const fileInputRef = useRef(null)

  const displayUrl = preview || imageUrl
  const unitPrice  = parseVNDInput(form.importPrice)
  const profit     = parseVNDInput(form.sellPrice) - unitPrice
  const marginPct  = unitPrice > 0 ? (profit / unitPrice * 100).toFixed(1) : 0

  function set(k, v) { setForm(p => ({ ...p, [k]: v })) }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Ảnh tối đa 5MB'); return }
    setPreview(URL.createObjectURL(file))
    setImageFile(file)
  }

  function handleRemoveImage() {
    setPreview(null); setImageFile(null); setImageUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên hàng'); return }
    if (!form.sku.trim())  { toast.error('Vui lòng nhập mã hàng (SKU)'); return }
    setSaving(true)
    try {
      let finalImageUrl = imageUrl
      if (imageFile) {
        if (initial?.imageUrl) await deleteProductImage(initial.imageUrl)
        finalImageUrl = await uploadProductImage(imageFile)
      }
      await onSave({
        sku:           form.sku.trim().toUpperCase(),
        name:          form.name.trim(),
        importPrice:   unitPrice,
        sellPrice:     parseVNDInput(form.sellPrice),
        stockQuantity: parseInt(form.stockQuantity) || 0,
        minStock:      parseInt(form.minStock) || 5,
        imageUrl:      finalImageUrl,
        unit:          form.unit.trim() || null,
      })
      onClose()
    } catch (err) {
      toast.error(err.message?.includes('unique') ? 'Mã SKU đã tồn tại' : (err.message || 'Lỗi lưu'))
    } finally {
      setSaving(false)
    }
  }

  const iCls = 'w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-base text-[#1e293b] placeholder:text-slate-600 outline-none focus:border-cblue focus:ring-1 focus:ring-cblue/30 transition-all min-h-[52px] rounded-xl'
  const mCls = iCls + ' text-right font-mono text-cblue'

  return (
    <ModalOverlay onClose={onClose} className="bg-black/75">
      <div className="bg-[#ffffff] border border-slate-700/80 rounded-2xl w-full max-w-lg md:max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800 shrink-0">
          <div>
            <div className="font-bold text-base text-[#1e293b]">{isEdit ? '✏️ Sửa hàng hóa' : '➕ Thêm hàng mới'}</div>
            <div className="text-xs text-slate-500 mt-0.5">{isEdit ? 'Chỉnh sửa thông tin sản phẩm' : 'Tạo mã hàng mới chưa từng có trong hệ thống'}</div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-cred transition-colors text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row gap-0">
            {/* Ảnh */}
            <div className="md:w-52 shrink-0 flex flex-col items-center gap-3 p-4 border-b md:border-b-0 md:border-r border-slate-800">
              <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider self-start">Hình ảnh</div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <label onClick={() => fileInputRef.current?.click()} className="relative w-full h-48 rounded-xl overflow-hidden cursor-pointer group block">
                {displayUrl ? (
                  <>
                    <img src={displayUrl} alt="preview" className="w-full h-48 object-contain bg-slate-800 rounded-xl border border-slate-700 shadow-sm" />
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center gap-2">
                      <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      <span className="text-white text-xs font-semibold">Đổi ảnh</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-48 rounded-xl border-2 border-dashed border-slate-700 bg-slate-900/50 hover:border-cblue/60 hover:bg-cblue/5 transition-all flex flex-col items-center justify-center gap-2.5 text-slate-500 hover:text-cblue">
                    <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <span className="text-sm font-medium">Bấm để tải ảnh lên</span>
                    <span className="text-[11px] text-slate-600">PNG, JPG, WEBP · Tối đa 5MB</span>
                  </div>
                )}
              </label>
              {displayUrl && (
                <button type="button" onClick={handleRemoveImage} className="w-full py-1.5 rounded-lg border border-slate-700 text-xs text-slate-500 hover:border-cred hover:text-cred hover:bg-cred/8 transition-colors">Xoá ảnh</button>
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 p-4 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">SKU *</label>
                  <input className={iCls + ' uppercase font-mono'} placeholder="SP001" value={form.sku}
                    onChange={e => set('sku', e.target.value)} disabled={isEdit} autoFocus={!isEdit} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Tên hàng *</label>
                  <input className={iCls} placeholder="Tên sản phẩm mới…" value={form.name}
                    onChange={e => set('name', e.target.value)} autoFocus={isEdit} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Giá vốn (₫)</label>
                  <input className={mCls} inputMode="numeric" placeholder="80.000" value={form.importPrice}
                    onChange={e => set('importPrice', formatMoneyLive(e.target.value))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Giá bán (₫)</label>
                  <input className={mCls} inputMode="numeric" placeholder="120.000" value={form.sellPrice}
                    onChange={e => set('sellPrice', formatMoneyLive(e.target.value))} />
                </div>
              </div>

              {(unitPrice > 0 || parseVNDInput(form.sellPrice) > 0) && (
                <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs border ${profit >= 0 ? 'bg-cgreen/8 border-cgreen/20' : 'bg-cred/8 border-cred/20'}`}>
                  <span className="text-slate-400">Lợi nhuận / sản phẩm</span>
                  <span className={`font-bold font-mono ${profit >= 0 ? 'text-cgreen' : 'text-cred'}`}>
                    {fmtVNDFull(profit)} <span className="text-[10px] opacity-60">({marginPct}%)</span>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    {isEdit ? 'Tồn kho hiện tại' : 'Tồn kho ban đầu'}
                  </label>
                  <input className={iCls} type="number" min="0" placeholder="0" value={form.stockQuantity}
                    onChange={e => set('stockQuantity', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                    Tồn kho tối thiểu ⚠️
                  </label>
                  <input className={iCls + ' border-cyellow/40 focus:border-cyellow focus:ring-cyellow/20'} type="number" min="0" placeholder="5" value={form.minStock}
                    onChange={e => set('minStock', e.target.value)} />
                </div>
              </div>

              {/* Đơn vị tính */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">
                  Đơn vị tính
                </label>
                <input className={iCls} placeholder="Lon, Thùng, Hộp…" value={form.unit}
                  onChange={e => set('unit', e.target.value)} />
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_UNITS.map(u => (
                    <button key={u} type="button"
                      onClick={() => set('unit', u)}
                      className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors
                        ${form.unit === u
                          ? 'bg-cblue/20 border-cblue/50 text-cblue font-bold'
                          : 'border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
                        }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-2 mt-auto">
                <button type="button" onClick={onClose} className="btn-ghost flex-1">Huỷ</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-60">
                  {saving
                    ? <span className="flex items-center gap-2"><svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>{imageFile ? 'Đang upload ảnh…' : 'Đang lưu…'}</span>
                    : isEdit ? 'Cập nhật' : 'Thêm hàng mới'
                  }
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ── Modal 2: Nhập kho nhiều sản phẩm ──────────────────────────────────────
function ImportStockModal({ products = [], onImported, onClose }) {
  // Cart nhập kho: [{ productId, name, sku, imageUrl, currentStock, importPrice, qty, unitPrice }]
  const [cart,           setCart]           = useState([])
  const [query,          setQuery]          = useState('')
  const [showDrop,       setShowDrop]       = useState(false)
  const [suppliersList,  setSuppliersList]  = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [notes,          setNotes]          = useState('')
  const [saving,         setSaving]         = useState(false)
  const [showConfirm,    setShowConfirm]    = useState(false)   // step 1
  const [successData,    setSuccessData]    = useState(null)    // step 2
  const [paidInput,      setPaidInput]      = useState('')      // '' = trả đủ
  const searchRef = useRef(null)
  const wrapRef   = useRef(null)

  const iCls = 'w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-base text-[#1e293b] placeholder:text-slate-600 outline-none focus:border-cgreen focus:ring-1 focus:ring-cgreen/20 transition-all min-h-[52px] rounded-xl'

  useEffect(() => {
    loadSuppliers('').then(setSuppliersList).catch(() => {})
  }, [])

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setShowDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Gợi ý tìm kiếm — loại trừ sản phẩm đã có trong cart
  const cartIds = useMemo(() => new Set(cart.map(i => i.productId)), [cart])
  const suggestions = useMemo(() => {
    const safeList  = Array.isArray(products) ? products : []
    const safeQuery = removeVietnameseTones(query || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return []
    return safeList.filter(p => {
      if (cartIds.has(p.id)) return false
      const name = removeVietnameseTones(p?.name)
      const sku  = removeVietnameseTones(p?.sku)
      return words.every(w => name.includes(w) || sku.includes(w))
    }).sort((a, b) => {
      const nA = removeVietnameseTones(a?.name || '')
      const nB = removeVietnameseTones(b?.name || '')
      if (nA.startsWith(safeQuery) && !nB.startsWith(safeQuery)) return -1
      if (!nA.startsWith(safeQuery) && nB.startsWith(safeQuery)) return 1
      return 0
    }).slice(0, 8)
  }, [products, query, cartIds])

  // Thêm vào cart
  function addToCart(p) {
    setCart(prev => [...prev, {
      productId:    p.id,
      name:         p.name,
      sku:          p.sku,
      imageUrl:     p.imageUrl ?? null,
      currentStock: p.stockQuantity ?? 0,
      qty:          1,
      unitPrice:    p.importPrice ? p.importPrice.toLocaleString('vi-VN') : '',
      unit:         p.lastUsedUnit ?? p.unit ?? null,
    }])
    setQuery('')
    setShowDrop(false)
    searchRef.current?.focus()
  }

  function removeFromCart(productId) {
    setCart(prev => prev.filter(i => i.productId !== productId))
  }

  function updateQty(productId, val) {
    const n = Math.max(1, parseInt(val) || 1)
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, qty: n } : i))
  }

  function updateUnitPrice(productId, val) {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, unitPrice: formatMoneyLive(val) } : i))
  }

  function updateUnit(productId, val) {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, unit: val || null } : i))
  }

  // Tổng tiền
  const grandTotal = useMemo(() =>
    cart.reduce((s, i) => s + (parseVNDInput(i.unitPrice) || 0) * i.qty, 0)
  , [cart])

  // Công nợ NCC
  const customerPaid = (() => {
    if (!paidInput.trim()) return grandTotal
    return Math.max(0, parseVNDInput(paidInput))
  })()
  const debtDelta    = grandTotal - customerPaid   // >0 ta nợ NCC, <0 NCC nợ ta
  const surplusAmt   = Math.max(0, -debtDelta)      // số tiền dư (NCC nợ ta)
  const newDebtAmt   = Math.max(0, debtDelta)       // số tiền ta mới nợ NCC

  // Mở step 1 confirm
  function handleConfirmClick() {
    if (cart.length === 0) { toast.error('Chưa có sản phẩm nào trong phiếu'); return }
    const invalid = cart.find(i => i.qty <= 0)
    if (invalid) { toast.error(`Số lượng "${invalid.name}" phải > 0`); return }
    setShowConfirm(true)
  }

  // Xử lý nhập kho thực sự (sau khi step 1 xác nhận)
  async function processImport() {
    setSaving(true)
    try {
      const items = cart.map(i => ({
        productId:    i.productId,
        name:         i.name,
        qty:          i.qty,
        importPrice:  parseVNDInput(i.unitPrice) || 0,
        currentStock: i.currentStock,
        unit:         i.unit ?? null,
      }))

      const order = await createImportOrder({
        supplierId: selectedSupplier || null,
        items,
        note:       notes,
        paidAmount: customerPaid,
      })

      // Cập nhật local product list
      cart.forEach(item => {
        const price    = parseVNDInput(item.unitPrice) || 0
        const newStock = item.currentStock + item.qty
        onImported(item.productId, {
          stockQuantity: newStock,
          ...(price > 0 ? { importPrice: price } : {}),
        })
      })

      const supplier = suppliersList.find(s => s.id === selectedSupplier) || null
      toast.success(`✅ Nhập kho thành công ${cart.length} sản phẩm!`)
      setShowConfirm(false)
      setPaidInput('')
      setSuccessData({
        order,
        items: cart.map(i => ({
          name:     i.name,
          quantity: i.qty,
          price:    parseVNDInput(i.unitPrice) || 0,
          cost:     parseVNDInput(i.unitPrice) || 0,
          unit:     i.unit ?? null,
        })),
        total:       grandTotal,
        paidAmount:  customerPaid,
        debtDelta,
        supplier,
      })
    } catch (err) {
      toast.error(err.message || 'Lỗi nhập kho')
      setShowConfirm(false)
    } finally {
      setSaving(false)
    }
  }

  function handlePrintReceipt() {
    if (!successData) return
    printViaIframe(buildReceiptHtml({
      order:        successData.order,
      customer:     successData.supplier
        ? { fullName: successData.supplier.name, phone: successData.supplier.phone }
        : null,
      items:        successData.items,
      total:        successData.total,
      paidAmount:   successData.paidAmount,
      debtAmount:   successData.debtDelta > 0 ? successData.debtDelta : 0,
      isImport:     true,
      partnerLabel: 'Nhà cung cấp:',
    }))
    onClose()
  }

  // Step 2 — Print confirm (modal thay thế sau khi nhập thành công)
  if (successData) {
    const { total, paidAmount, debtDelta, supplier } = successData
    const showDebt    = debtDelta > 0
    const showSurplus = debtDelta < 0
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-[#ffffff] border border-cgreen/30 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-cgreen/10 px-5 py-5 text-center border-b border-cgreen/20">
            <div className="text-4xl mb-1.5">✅</div>
            <div className="font-black text-xl text-cgreen">Nhập kho thành công!</div>
            <div className="text-xs text-slate-400 mt-1">
              #{(successData.order.id?.slice(-8) || '').toUpperCase()}
            </div>
          </div>
          {/* Tóm tắt */}
          <div className="px-5 pt-4 pb-3 flex flex-col gap-2">
            {supplier && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Nhà cung cấp</span>
                <span className="font-semibold text-cteal">{supplier.name}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Số sản phẩm</span>
              <span className="font-semibold">{successData.items.length} loại · {successData.items.reduce((s,i)=>s+i.quantity,0)} sp</span>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-800 pt-2 mt-1">
              <span className="text-slate-400">Tổng tiền nhập</span>
              <span className="font-bold text-[#1e293b] tabular-nums">{fmtVNDFull(total)}</span>
            </div>
            {paidAmount !== total && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Đã thanh toán</span>
                <span className="font-bold text-cblue tabular-nums">{fmtVNDFull(paidAmount)}</span>
              </div>
            )}
            {showDebt && (
              <div className="flex justify-between items-center rounded-lg bg-cred/10 border border-cred/25 px-3 py-2">
                <span className="text-xs font-bold text-cred">💳 Nợ NCC phát sinh</span>
                <span className="font-black text-cred tabular-nums">{fmtVNDFull(debtDelta)}</span>
              </div>
            )}
            {showSurplus && (
              <div className="flex justify-between items-center rounded-lg bg-cgreen/10 border border-cgreen/25 px-3 py-2">
                <span className="text-xs font-bold text-cgreen">💵 NCC nợ ta (trả dư)</span>
                <span className="font-black text-cgreen tabular-nums">{fmtVNDFull(-debtDelta)}</span>
              </div>
            )}
          </div>
          <div className="px-5 pb-2 text-center text-sm text-slate-400">Bạn có muốn in phiếu nhập không?</div>
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800 transition-colors">
              Không
            </button>
            <button onClick={handlePrintReceipt}
              className="flex-1 py-3 rounded-xl bg-cblue hover:brightness-110 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-cblue/20">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <rect x="6" y="14" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
              In phiếu nhập
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
    {/* Step 1 — Xác nhận nhập */}
    {showConfirm && (
      <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
        <div className="bg-[#ffffff] border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="text-3xl mb-3">📦</div>
            <div className="text-base font-black text-[#1e293b]">Xác nhận nhập kho</div>
            <div className="text-xs text-slate-400 mt-1.5">Bạn có chắc muốn thực hiện phiếu nhập này không?</div>
          </div>
          <div className="mx-5 mb-4 rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Số sản phẩm</span>
              <span className="font-semibold text-[#1e293b]">{cart.length} loại · {cart.reduce((s,i)=>s+i.qty,0)} sp</span>
            </div>
            {selectedSupplier && (
              <div className="flex justify-between">
                <span className="text-slate-400">Nhà cung cấp</span>
                <span className="font-semibold text-cteal">{suppliersList.find(s=>s.id===selectedSupplier)?.name}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-slate-700 mt-0.5">
              <span className="font-bold text-slate-300">Tổng tiền nhập</span>
              <span className="font-black text-lg text-cyellow tabular-nums">{grandTotal.toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>
          <div className="flex gap-3 px-5 pb-5">
            <button onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800 transition-colors">
              ✗ Không
            </button>
            <button onClick={processImport} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-cgreen hover:brightness-110 text-white text-sm font-black transition-all disabled:opacity-60 shadow-lg shadow-cgreen/20">
              {saving
                ? <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>
                    Đang xử lý…
                  </span>
                : '✓ Có, xác nhận'
              }
            </button>
          </div>
        </div>
      </div>
    )}

    <ModalOverlay onClose={onClose} className="bg-black/75">
      <div className="bg-[#ffffff] border border-slate-700/80 rounded-2xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <div className="font-bold text-base text-[#1e293b]">📦 Nhập Kho</div>
            <div className="text-xs text-slate-500 mt-0.5">Thêm nhiều sản phẩm cùng lúc → xác nhận 1 lần</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-cred transition-colors text-lg leading-none">×</button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-800 shrink-0" ref={wrapRef}>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchRef}
              autoFocus
              className={iCls + ' pl-9'}
              placeholder="Tìm tên hoặc SKU → click để thêm vào phiếu nhập…"
              value={query}
              onChange={e => { setQuery(e.target.value); setShowDrop(true) }}
              onFocus={() => suggestions.length > 0 && setShowDrop(true)}
            />
            {showDrop && suggestions.length > 0 && (
              <ul className="absolute top-full mt-1 left-0 right-0 z-50 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
                {suggestions.map(p => (
                  <li key={p.id}>
                    <button type="button"
                      onMouseDown={e => { e.preventDefault(); addToCart(p) }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-slate-700 transition-colors text-left">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0" />
                        : <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-500 text-[10px] font-bold shrink-0">{p.sku?.slice(0,2)}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[#1e293b] truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{p.sku} · Tồn: <span className={p.stockQuantity > 0 ? 'text-cgreen' : 'text-cred'}>{p.stockQuantity}</span></div>
                      </div>
                      <span className="text-xs font-mono text-cgreen shrink-0">+ Thêm</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Cart table */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-600">
              <div className="text-4xl">📦</div>
              <div className="text-sm font-medium text-slate-500">Tìm và thêm sản phẩm ở thanh tìm kiếm trên</div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="bg-slate-950/80 border-b border-slate-800">
                    {['Sản phẩm', 'Tồn kho', 'SL nhập', 'ĐVT', 'Giá nhập (₫)', 'Thành tiền', ''].map((h, i) => (
                      <th key={i} className={`px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider whitespace-nowrap ${i >= 1 ? 'text-right' : 'text-left'} ${i === 6 ? 'w-8' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cart.map(item => {
                    const price   = parseVNDInput(item.unitPrice) || 0
                    const lineAmt = price * item.qty
                    return (
                      <tr key={item.productId} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {item.imageUrl
                              ? <img src={item.imageUrl} alt={item.name} className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0" />
                              : <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 text-[10px] font-bold shrink-0">{item.sku?.slice(0,2)}</div>
                            }
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#1e293b] truncate max-w-[160px]">{item.name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{item.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-mono text-xs text-slate-400 whitespace-nowrap">
                          {item.currentStock}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <input
                            type="number" min="1"
                            value={item.qty}
                            onChange={e => updateQty(item.productId, e.target.value)}
                            className="w-20 rounded-lg bg-cgreen/10 border border-cgreen/40 text-cgreen text-sm text-center font-bold font-mono outline-none focus:border-cgreen px-2 py-1 transition-all"
                          />
                        </td>
                        {/* ĐVT — có thể nhập tay */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <input
                            type="text"
                            value={item.unit ?? ''}
                            onChange={e => updateUnit(item.productId, e.target.value)}
                            placeholder="đvt"
                            className="w-16 rounded-lg bg-cblue/10 border border-cblue/30 text-cblue text-xs text-center font-bold outline-none focus:border-cblue px-2 py-1 transition-all placeholder:text-slate-600"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <input
                            type="text" inputMode="numeric"
                            value={item.unitPrice}
                            onChange={e => updateUnitPrice(item.productId, e.target.value)}
                            placeholder="0"
                            className="w-28 rounded-lg bg-slate-800 border border-slate-700 text-cblue text-sm text-right font-mono outline-none focus:border-cblue px-2 py-1 transition-all"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-mono text-sm font-bold text-[#1e293b] whitespace-nowrap">
                          {lineAmt > 0 ? fmtVNDFull(lineAmt) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => removeFromCart(item.productId)}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md border border-slate-700 text-slate-500 hover:border-cred hover:text-cred hover:bg-cred/10 transition-all flex items-center justify-center text-xs">
                            ×
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

        {/* Footer */}
        {cart.length > 0 && (
          <div className="shrink-0 border-t border-slate-800 px-6 py-4 flex flex-col gap-3 bg-slate-900/60">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* NCC */}
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Nhà cung cấp</label>
                <select className={iCls + ' cursor-pointer'} value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                  <option value="">— Không chọn —</option>
                  {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {/* Ghi chú */}
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">Ghi chú</label>
                <input className={iCls} placeholder="Ghi chú phiếu nhập…" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            {/* ── Thanh toán & công nợ NCC ── */}
            <div className="flex flex-col gap-2 border-t border-slate-800/60 pt-3">

              {/* Tổng tiền nhập */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Tổng tiền nhập</span>
                <span className="font-black text-base tabular-nums text-[#1e293b]">{fmtVNDFull(grandTotal)}</span>
              </div>

              {/* Input: Số tiền TT */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 shrink-0 w-[108px]">Số tiền thanh toán</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={grandTotal.toLocaleString('vi-VN')}
                  value={paidInput}
                  onChange={e => setPaidInput(formatMoneyLive(e.target.value))}
                  onFocus={e => {
                    if (!paidInput) setPaidInput(grandTotal.toLocaleString('vi-VN'))
                    e.target.select()
                  }}
                  onBlur={() => {
                    if (!paidInput || parseVNDInput(paidInput) >= grandTotal) setPaidInput('')
                  }}
                  className="flex-1 min-w-0 bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-base text-right font-mono font-bold text-[#1e293b] placeholder:text-slate-600 outline-none focus:border-cgreen focus:ring-1 focus:ring-cgreen/20 transition-all"
                />
              </div>

              {/* Còn nợ NCC */}
              {newDebtAmt > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-cred/10 border border-cred/25 px-3 py-2">
                  <div>
                    <span className="text-xs font-bold text-cred">💳 Còn nợ NCC</span>
                    {selectedSupplier && (
                      <span className="text-[10px] text-cred/70 ml-1">
                        → cộng vào nợ {suppliersList.find(s => s.id === selectedSupplier)?.name}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-black text-sm text-cred tabular-nums">{fmtVNDFull(newDebtAmt)}</span>
                </div>
              )}

              {/* Trả dư — NCC nợ ta */}
              {surplusAmt > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-cgreen/10 border border-cgreen/25 px-3 py-2">
                  <div>
                    <span className="text-xs font-bold text-cgreen">💵 Trả dư — NCC nợ ta</span>
                    {selectedSupplier && (
                      <span className="text-[10px] text-cgreen/70 ml-1">
                        → trừ vào nợ hiện tại của {suppliersList.find(s => s.id === selectedSupplier)?.name}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-black text-sm text-cgreen tabular-nums">{fmtVNDFull(surplusAmt)}</span>
                </div>
              )}

              {/* Đã thanh toán đủ */}
              {paidInput && debtDelta === 0 && (
                <div className="text-xs text-cgreen font-semibold text-center py-1">✓ Thanh toán đầy đủ — không phát sinh nợ</div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-slate-500">
                <span className="text-cgreen font-bold">{cart.length}</span> sản phẩm
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 text-sm hover:text-[#1e293b] transition-colors">Huỷ</button>
                <button
                  onClick={handleConfirmClick}
                  disabled={cart.length === 0}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-cgreen hover:brightness-110 text-white text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-cgreen/20"
                >
                  {`📦 Xác nhận nhập ${cart.length} sản phẩm`}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </ModalOverlay>
    </>
  )
}

// ── (giữ lại để tránh lỗi tham chiếu) ────────────────────────────────────
function _OldImportSingleRef() {
  // đã thay thế bằng ImportStockModal đa sản phẩm ở trên
  return null
}

// ── Adjust Stock Modal ─────────────────────────────────────────────────────

function AdjustStockModal({ product, onSave, onClose }) {
  const [delta, setDelta]   = useState('')
  const [mode, setMode]     = useState('add')  // 'add' | 'sub' | 'set'
  const [saving, setSaving] = useState(false)

  const preview = useMemo(() => {
    const d = parseInt(delta) || 0
    if (mode === 'set') return d
    if (mode === 'add') return product.stockQuantity + d
    return Math.max(0, product.stockQuantity - d)
  }, [delta, mode, product.stockQuantity])

  async function handleSave() {
    const d = parseInt(delta) || 0
    if (!d && mode !== 'set') { toast.error('Nhập số lượng'); return }
    setSaving(true)
    try {
      let newQty
      if (mode === 'set') newQty = Math.max(0, d)
      else if (mode === 'add') newQty = product.stockQuantity + d
      else newQty = Math.max(0, product.stockQuantity - d)
      await onSave(product.id, { stockQuantity: newQty })
      toast.success(`Đã cập nhật tồn kho: ${fmtQty(newQty)} sp`)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Lỗi cập nhật')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="font-bold text-base">📦 Điều chỉnh tồn kho</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors">×</button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="text-sm text-[#1e293b]">
            <span className="font-bold text-cblue">{product.name}</span>
            <span className="text-muted ml-2">· Tồn hiện tại: <strong className="text-[#1e293b]">{fmtQty(product.stockQuantity)}</strong></span>
          </div>

          {/* Mode selector */}
          <div className="flex gap-2">
            {[['add','+ Nhập'],['sub','- Xuất'],['set','= Đặt']].map(([v, l]) => (
              <button key={v} onClick={() => setMode(v)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                  mode === v ? 'bg-cblue/20 border-cblue text-cblue' : 'bg-surface2 border-border text-muted hover:border-cblue'
                }`}>{l}</button>
            ))}
          </div>

          <input
            autoFocus type="number" min="0" placeholder="Số lượng"
            value={delta} onChange={e => setDelta(e.target.value)}
            className="w-full rounded-lg bg-slate-900/60 border border-slate-700 px-4 py-3 text-base text-[#1e293b] outline-none focus:border-cblue transition-all text-center font-mono text-lg"
          />

          <div className="flex items-center justify-between rounded-lg bg-surface2 border border-border px-3 py-2 text-xs">
            <span className="text-muted">Tồn sau điều chỉnh</span>
            <span className={`font-bold font-mono text-base ${preview <= 0 ? 'text-cred' : preview <= 10 ? 'text-cyellow' : 'text-cgreen'}`}>
              {fmtQty(preview)}
            </span>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
              {saving ? 'Đang lưu…' : 'Xác nhận'}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Products() {
  const [products, setProducts]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [stockFilter, setStockFilter] = useState('all') // 'all' | 'in' | 'low' | 'out'
  const [page, setPage]         = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [rowMenu, setRowMenu]   = useState(null) // { p, top, left }
  const [isAddOpen,      setIsAddOpen]      = useState(false)
  const [isImportOpen,   setIsImportOpen]   = useState(false)
  const [isImportExcelOpen, setIsImportExcelOpen] = useState(false)
  const [showImportMethod, setShowImportMethod]   = useState(false)
  const [isBestImportOpen, setIsBestImportOpen]   = useState(false)
  const [showOcrPurchase,setShowOcrPurchase]= useState(false)
  const [showLowStock,   setShowLowStock]   = useState(false)
  const [editTarget,   setEditTarget]   = useState(null)
  const [stockTarget, setStockTarget]   = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [auditTarget,  setAuditTarget]  = useState(null)
  const [suppliers,      setSuppliers]      = useState([])
  const [deleting,   setDeleting]   = useState(false)
  const [importing,     setImporting]     = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const importRef = useRef(null)

  // Load toàn bộ 1 lần, filter client-side để hỗ trợ tìm không dấu
  useEffect(() => {
    setLoading(true)
    Promise.all([loadProducts(''), loadSuppliers('')])
      .then(([prods, sups]) => { setProducts(prods); setSuppliers(sups || []) })
      .catch(e => toast.error(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Client-side filter — hỗ trợ gõ không dấu tiếng Việt
  const displayedProducts = useMemo(() => {
    let list = Array.isArray(products) ? products : []

    // Filter theo trạng thái tồn kho
    if (stockFilter === 'out') list = list.filter(p => (p.stockQuantity ?? 0) <= 0)
    else if (stockFilter === 'low') list = list.filter(p => (p.stockQuantity ?? 0) > 0 && (p.stockQuantity ?? 0) <= 10)
    else if (stockFilter === 'in')  list = list.filter(p => (p.stockQuantity ?? 0) > 10)

    const safeQuery = removeVietnameseTones(search || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return list
    return list.filter(p => {
      const name = removeVietnameseTones(p?.name)
      const sku  = removeVietnameseTones(p?.sku)
      return words.every(w => name.includes(w) || sku.includes(w))
    }).sort((a, b) => {
      const nA = removeVietnameseTones(a?.name || '')
      const nB = removeVietnameseTones(b?.name || '')
      const aStarts = nA.startsWith(safeQuery)
      const bStarts = nB.startsWith(safeQuery)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      const aExact = ` ${nA} `.includes(` ${safeQuery} `)
      const bExact = ` ${nB} `.includes(` ${safeQuery} `)
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })
  }, [products, search, stockFilter])

  // ── Pagination ──────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(displayedProducts.length / pageSize))
  useEffect(() => { setPage(1) }, [search, stockFilter, pageSize])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])
  const pagedProducts = useMemo(
    () => displayedProducts.slice((page - 1) * pageSize, page * pageSize),
    [displayedProducts, page, pageSize]
  )
  const pageStart = displayedProducts.length === 0 ? 0 : (page - 1) * pageSize + 1
  const pageEnd   = Math.min(page * pageSize, displayedProducts.length)

  // ── Low-stock alerts ────────────────────────────────────
  const lowStockItems = useMemo(() =>
    products.filter(p => p.stockQuantity <= (p.minStock ?? 5))
  , [products])

  // ── KPIs ────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalSkus    = products.length
    const totalStock   = products.reduce((s, p) => s + (p.stockQuantity || 0), 0)
    const stockValue   = products.reduce((s, p) => s + (p.importPrice || 0) * (p.stockQuantity || 0), 0)
    const potentialRev = products.reduce((s, p) => s + (p.sellPrice || 0) * (p.stockQuantity || 0), 0)
    const outOfStock   = products.filter(p => p.stockQuantity <= 0).length
    return { totalSkus, totalStock, stockValue, potentialRev, outOfStock }
  }, [products])

  const isSearching = loading

  // ── Actions ─────────────────────────────────────────────
  async function handleAdd(payload) {
    const saved = await insertProduct(payload)
    setProducts(p => [saved, ...p])
    toast.success(`Đã thêm "${saved.name}"`)
  }

  async function handleEdit(payload) {
    const saved = await updateProduct(editTarget.id, payload)
    setProducts(p => p.map(x => x.id === editTarget.id ? saved : x))
    toast.success('Đã cập nhật')
    setEditTarget(null)
  }

  async function handleStock(id, patch) {
    const saved = await updateProduct(id, patch)
    setProducts(p => p.map(x => x.id === id ? saved : x))
  }

  // Callback sau khi ImportStockModal UPDATE thành công
  function handleImported(productId, patch) {
    setProducts(p => p.map(x => x.id === productId ? { ...x, ...patch } : x))
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteProduct(deleteTarget.id)
      setProducts(p => p.filter(x => x.id !== deleteTarget.id))
      toast.success(`Đã xoá "${deleteTarget.name}"`)
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setDeleting(false)
    }
  }

  // ── Excel Export ────────────────────────────────────────
  async function handleExportExcel() {
    const toastId = toast.loading('Đang xuất dữ liệu…')
    try {
      // Fetch toàn bộ (không lọc theo search) để export đầy đủ
      const all = await loadProducts('')
      const rows = all.map(p => ({
        'Mã Hàng (SKU)': p.sku,
        'Tên Hàng':      p.name,
        'ĐVT':           p.unit          ?? '',
        'Giá Vốn':       p.importPrice   ?? 0,
        'Giá Bán':       p.sellPrice     ?? 0,
        'Tồn Kho':       p.stockQuantity ?? 0,
      }))
      const ws  = XLSX.utils.json_to_sheet(rows)
      const wb  = XLSX.utils.book_new()

      // Đặt độ rộng cột
      ws['!cols'] = [
        { wch: 16 }, { wch: 36 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Hàng Hóa')
      XLSX.writeFile(wb, 'Danh_Sach_Hang_Hoa.xlsx')
      toast.success(`Đã xuất ${all.length} sản phẩm`, { id: toastId })
    } catch (e) {
      toast.error(e.message || 'Lỗi xuất Excel', { id: toastId })
    }
  }

  // ── Excel Import ────────────────────────────────────────
  function handleImportExcel(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = null

    setImporting(true)
    setImportProgress('')
    const toastId = toast.loading('Đang đọc file Excel…')

    const reader = new FileReader()

    reader.onload = async (event) => {
      try {
        // ── 1. Parse Excel an toàn qua FileReader ────────
        const data      = new Uint8Array(event.target.result)
        const workbook  = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData  = XLSX.utils.sheet_to_json(worksheet)

        if (!jsonData || jsonData.length === 0) {
          toast.error('File Excel không có dữ liệu hoặc sai định dạng!', { id: toastId })
          setImporting(false)
          return
        }

        // ── 2. Map cột (hỗ trợ KiotViet lẫn format app) ─
        // Normalize: bỏ dấu, lowercase, trim — để khớp header dù encoding khác nhau
        const norm = s => String(s ?? '').toLowerCase().trim()
          .normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/đ/g, 'd').replace(/\s+/g, ' ')

        const rowNorm = Object.fromEntries(
          Object.entries(jsonData[0] || {}).map(([k]) => [norm(k), k])
        )
        function pick(row, keys) {
          for (const k of keys) {
            // thử exact match trước
            const v = row[k]
            if (v !== undefined && v !== null && v !== '') return v
            // thử normalized match
            const origKey = rowNorm[norm(k)]
            if (origKey) {
              const v2 = row[origKey]
              if (v2 !== undefined && v2 !== null && v2 !== '') return v2
            }
          }
          return null
        }

        const COL = {
          sku:           ['Mã hàng', 'Mã Hàng (SKU)', 'Mã Hàng', 'SKU', 'sku'],
          name:          ['Tên hàng', 'Tên Hàng', 'Tên', 'name'],
          unit:          ['ĐVT', 'DVT', 'Đvt', 'đvt', 'Đơn vị tính', 'Don vi tinh', 'unit'],
          importPrice:   ['Giá vốn', 'Giá Vốn', 'import_price'],
          sellPrice:     ['Giá bán', 'Giá Bán', 'sell_price'],
          stockQuantity: ['Tồn kho', 'Tồn Kho', 'stock_quantity'],
          imageUrl:      ['Hình ảnh (url1,url2...)', 'Hình ảnh', 'image_url', 'imageUrl'],
        }

        const cleanNumber = (val) =>
          Math.round(Number(String(val ?? '0').replace(/[^0-9.]/g, '')) || 0)

        const mapped = jsonData
          .map((row, i) => {
            const sku  = String(pick(row, COL.sku)  ?? '').trim().toUpperCase()
            const name = String(pick(row, COL.name) ?? '').trim() || 'Chưa có tên'
            if (!sku) return null // bỏ qua dòng không có SKU

            const rawImg  = String(pick(row, COL.imageUrl) ?? '').trim()
            const firstImg = rawImg ? rawImg.split(',')[0].trim() : null
            const isKiotViet = !!(firstImg && firstImg.includes('kiotviet'))

            return {
              sku,
              name,
              unit:              String(pick(row, COL.unit) ?? '').trim() || null,
              importPrice:       cleanNumber(pick(row, COL.importPrice)),
              sellPrice:         cleanNumber(pick(row, COL.sellPrice)),
              stockQuantity:     cleanNumber(pick(row, COL.stockQuantity)),
              imageUrl:          firstImg || null,
              _needsImageUpload: isKiotViet,
            }
          })
          .filter(Boolean) // loại dòng null (không có SKU)

        if (mapped.length === 0) {
          toast.error('Không có sản phẩm hợp lệ trong file!', { id: toastId })
          setImporting(false)
          return
        }

        // Xoá flag (không upload blob nữa, lưu thẳng link CDN)
        mapped.forEach(p => delete p._needsImageUpload)

        // ── 3. Upsert vào Database ───────────────────────
        const saveMsg = `Đang lưu ${mapped.length} sản phẩm vào Database…`
        setImportProgress(saveMsg)
        toast.loading(saveMsg, { id: toastId })

        const saved = await upsertProducts(mapped)

        setProducts(prev => {
          const map = new Map(prev.map(p => [p.sku, p]))
          saved.forEach(p => map.set(p.sku, p))
          return Array.from(map.values())
        })

        const imgCount = mapped.filter(p => p.imageUrl).length
        toast.success(
          `✅ Import thành công ${saved.length} sản phẩm` +
          (imgCount ? ` · ${imgCount} sản phẩm có ảnh` : ''),
          { id: toastId, duration: 5000 }
        )
      } catch (err) {
        console.error('[Import] Lỗi:', err)
        toast.error(err.message || 'Lỗi import Excel', { id: toastId })
      } finally {
        setImporting(false)
        setImportProgress('')
      }
    }

    reader.onerror = () => {
      toast.error('Không đọc được file!', { id: toastId })
      setImporting(false)
      setImportProgress('')
    }

    reader.readAsArrayBuffer(file)
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="p-6 w-full">

      {/* Low-stock alert */}
      {lowStockItems.length > 0 && (
        <div className="mb-5 rounded-xl border border-cyellow/40 bg-cyellow/8 overflow-hidden">

          {/* ── Header — luôn hiển thị, click để toggle ── */}
          <button
            onClick={() => setShowLowStock(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyellow/5 transition-colors text-left"
          >
            <span className="text-base leading-none">⚠️</span>
            <span className="text-cyellow font-bold text-sm flex-1">
              {lowStockItems.length} sản phẩm dưới mức tồn kho tối thiểu
              {' '}
              <span className="text-cyellow/60 font-normal">
                ({lowStockItems.filter(p => p.stockQuantity <= 0).length} hết hàng)
              </span>
            </span>
            {/* Badge counts */}
            <span className="text-[10px] text-cyellow/70 font-semibold hidden sm:inline">
              {showLowStock ? 'Ẩn bớt ▲' : 'Xem chi tiết ▼'}
            </span>
            <svg
              className={`w-4 h-4 text-cyellow/60 shrink-0 transition-transform duration-200 ${showLowStock ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none"
            >
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>

          {/* ── List — chỉ hiện khi mở ── */}
          {showLowStock && (
            <div className="border-t border-cyellow/20">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2 bg-cyellow/5 border-b border-cyellow/10">
                <span className="text-[10px] font-bold text-cyellow/60 uppercase tracking-wider">Sản phẩm</span>
                <span className="text-[10px] font-bold text-cyellow/60 uppercase tracking-wider text-right">Tồn kho</span>
                <span className="text-[10px] font-bold text-cyellow/60 uppercase tracking-wider text-right">Tối thiểu</span>
                <span className="text-[10px] font-bold text-cyellow/60 uppercase tracking-wider text-right">Thiếu</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-cyellow/10 max-h-64 overflow-y-auto">
                {lowStockItems
                  .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0))
                  .map(p => {
                    const min      = p.minStock ?? 5
                    const shortage = min - (p.stockQuantity ?? 0)
                    const isOut    = p.stockQuantity <= 0
                    return (
                      <div
                        key={p.id}
                        onClick={() => setEditTarget(p)}
                        className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2.5 hover:bg-cyellow/8 cursor-pointer transition-colors group"
                      >
                        {/* Tên + SKU */}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#1e293b] truncate group-hover:text-cyellow transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">{p.sku}</div>
                        </div>

                        {/* Tồn kho */}
                        <div className="text-right self-center">
                          <span className={`text-sm font-black tabular-nums ${isOut ? 'text-cred' : 'text-cyellow'}`}>
                            {p.stockQuantity ?? 0}
                          </span>
                          {isOut && (
                            <div className="text-[9px] font-bold text-cred uppercase tracking-wide">Hết</div>
                          )}
                        </div>

                        {/* Tối thiểu */}
                        <div className="text-right self-center">
                          <span className="text-xs tabular-nums text-slate-400">{min}</span>
                        </div>

                        {/* Thiếu */}
                        <div className="text-right self-center">
                          <span className={`text-xs font-bold tabular-nums ${isOut ? 'text-cred' : 'text-cyellow'}`}>
                            −{shortage}
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-cyellow/15 flex items-center justify-between bg-cyellow/5">
                <span className="text-[10px] text-cyellow/60">Click vào dòng để chỉnh sửa sản phẩm</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const rows = lowStockItems
                        .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0))
                        .map(p => ({
                          'Tên sản phẩm': p.name,
                          'SKU':          p.sku || '',
                          'Tồn kho':      p.stockQuantity ?? 0,
                          'Tối thiểu':    p.minStock ?? 5,
                          'Còn thiếu':    (p.minStock ?? 5) - (p.stockQuantity ?? 0),
                          'Trạng thái':   (p.stockQuantity ?? 0) <= 0 ? 'Hết hàng' : 'Sắp hết',
                        }))
                      const ws = XLSX.utils.json_to_sheet(rows)
                      ws['!cols'] = [{ wch: 40 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }]
                      const wb = XLSX.utils.book_new()
                      XLSX.utils.book_append_sheet(wb, ws, 'Tồn Kho Thấp')
                      XLSX.writeFile(wb, `Canh_Bao_Ton_Kho_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`)
                    }}
                    className="flex items-center gap-1 text-[10px] font-semibold text-cgreen/80 hover:text-cgreen border border-cgreen/20 hover:border-cgreen/50 bg-cgreen/5 hover:bg-cgreen/10 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Xuất Excel
                  </button>
                  <button
                    onClick={() => setShowLowStock(false)}
                    className="text-[10px] text-cyellow/60 hover:text-cyellow transition-colors"
                  >
                    Thu gọn ▲
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Tổng SKU',            value: kpis.totalSkus,              unit: 'sản phẩm', color: 'text-cblue',   icon: '📦' },
          { label: 'Tổng tồn kho',        value: fmtQty(kpis.totalStock),     unit: 'sản phẩm', color: 'text-cgreen',  icon: '🏭' },
          { label: 'Giá trị vốn',         value: fmtVNDFull(kpis.stockValue), unit: '',          color: 'text-cyellow', icon: '💰' },
          { label: 'Doanh thu tiềm năng', value: fmtVNDFull(kpis.potentialRev), unit: '',        color: 'text-cteal',  icon: '📈' },
          { label: 'Hết hàng',            value: kpis.outOfStock,             unit: 'mặt hàng',  color: kpis.outOfStock > 0 ? 'text-cred' : 'text-cgreen', icon: '⚠️' },
        ].map(k => (
          <div key={k.label} className="card p-4 relative overflow-hidden">
            <div className="absolute top-3 right-3 text-2xl opacity-20">{k.icon}</div>
            <div className="text-[10px] text-muted font-semibold uppercase tracking-wide mb-1.5">{k.label}</div>
            <div className={`text-xl font-black tabular-nums leading-tight ${k.color}`}>{k.value}</div>
            {k.unit && <div className="text-[10px] text-muted mt-0.5">{k.unit}</div>}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
        <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
          {isSearching
            ? <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-cblue animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg>
            : <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8"/><path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          }
          <input
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-slate-700 text-sm text-[#1e293b] placeholder:text-slate-500 outline-none focus:border-cblue focus:ring-2 focus:ring-cblue/15 transition-all"
            placeholder="Tìm tên hoặc SKU sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <button onClick={handleExportExcel} title="Xuất Excel"
          className="h-11 flex items-center gap-2 px-3.5 rounded-xl bg-white border border-slate-700 text-[#1e293b] text-sm font-semibold hover:bg-surface2 hover:border-slate-600 active:scale-95 touch-manipulation transition-all whitespace-nowrap shadow-sm">
          <span className="text-emerald-600 text-base">⤓</span><span className="hidden sm:inline">Xuất Excel</span>
        </button>

        <button onClick={() => importRef.current?.click()} disabled={importing} title="Nhập Excel"
          className="h-11 flex items-center gap-2 px-3.5 rounded-xl bg-white border border-slate-700 text-[#1e293b] text-sm font-semibold hover:bg-surface2 hover:border-slate-600 active:scale-95 touch-manipulation transition-all disabled:opacity-50 whitespace-nowrap shadow-sm">
          {importing ? <svg className="w-4 h-4 animate-spin text-cblue" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/></svg> : <span className="text-blue-600 text-base">⤒</span>}
          <span className="hidden sm:inline">{importing ? (importProgress || 'Đang nhập…') : 'Nhập Excel'}</span>
        </button>
        <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />

        <button onClick={() => setShowImportMethod(true)} title="Nhập kho"
          className="h-11 flex items-center gap-2 px-3.5 rounded-xl bg-white border border-slate-700 text-[#1e293b] text-sm font-semibold hover:bg-surface2 hover:border-slate-600 active:scale-95 touch-manipulation transition-all whitespace-nowrap shadow-sm">
          <span className="text-base">📦</span><span className="hidden sm:inline">Nhập kho</span>
        </button>

        <button onClick={() => setShowOcrPurchase(true)} title="Quét HĐ nhập"
          className="h-11 flex items-center gap-2 px-3.5 rounded-xl bg-white border border-slate-700 text-[#1e293b] text-sm font-semibold hover:bg-surface2 hover:border-slate-600 active:scale-95 touch-manipulation transition-all whitespace-nowrap shadow-sm">
          <span className="text-base">🧾</span><span className="hidden sm:inline">Quét HĐ nhập</span>
        </button>

        <button onClick={() => setIsAddOpen(true)}
          className="h-11 flex items-center gap-2 px-4 rounded-xl bg-cblue text-white text-sm font-semibold hover:opacity-90 active:scale-95 touch-manipulation transition-all whitespace-nowrap shadow-sm ml-auto sm:ml-0">
          <span className="text-base leading-none">＋</span><span>Thêm sản phẩm</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-800 shadow-sm overflow-hidden text-xs md:text-sm">

        {/* Table header bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-cblue/10 text-cblue flex items-center justify-center text-sm">📋</span>
            <span className="font-bold text-[15px] text-[#1e293b]">Danh sách hàng hóa</span>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-surface2 border border-slate-800 px-3 py-1 rounded-full">
            {search ? `${displayedProducts.length} / ${products.length} mặt hàng · "${search}"` : `${products.length} mặt hàng`}
          </span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500 text-sm">Đang tải dữ liệu…</div>
        ) : displayedProducts.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-4xl mb-3">📦</div>
            <div className="font-semibold mb-1">{search ? 'Không tìm thấy kết quả' : 'Chưa có hàng hóa'}</div>
            {!search && <button onClick={() => setIsAddOpen(true)} className="btn-primary mt-3 px-5 py-2 text-sm">＋ Thêm hàng đầu tiên</button>}
          </div>
        ) : (
          <>
            {/* ── Mobile: Card list (< sm) ── */}
            <div className="sm:hidden flex flex-col gap-2 p-3">
              {pagedProducts.map(p => {
                const profit = (p.sellPrice || 0) - (p.importPrice || 0)
                const badge  = stockBadge(p.stockQuantity)
                return (
                  <div key={p.id} onClick={() => setEditTarget(p)}
                    className="bg-[#ffffff] border border-slate-800 rounded-xl p-3.5 active:bg-slate-800/40 cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl border border-slate-700 bg-slate-800 flex items-center justify-center shrink-0 text-slate-600">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-100 truncate">{p.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{p.sku}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${badge.cls}`}>{badge.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="bg-slate-800/60 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 mb-0.5">Giá vốn</div>
                        <div className="text-xs font-mono text-slate-300">{fmtVND(p.importPrice)}</div>
                      </div>
                      <div className="bg-slate-800/60 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 mb-0.5">Giá bán</div>
                        <div className="text-xs font-mono font-semibold text-slate-100">{fmtVND(p.sellPrice)}</div>
                      </div>
                      <div className="bg-slate-800/60 rounded-lg p-2">
                        <div className="text-[10px] text-slate-500 mb-0.5">Tồn kho</div>
                        <button onClick={e => { e.stopPropagation(); setStockTarget(p) }}
                          className={`text-xs font-bold font-mono ${p.stockQuantity <= 0 ? 'text-cred' : p.stockQuantity <= 10 ? 'text-cyellow' : 'text-cgreen'}`}>
                          {fmtQty(p.stockQuantity)}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setStockTarget(p)}
                        className="flex-1 h-9 rounded-lg border border-slate-700 text-slate-400 text-xs font-medium hover:border-cyellow hover:text-cyellow active:scale-95 transition-all">
                        📦 Kho
                      </button>
                      <button onClick={() => setEditTarget(p)}
                        className="flex-1 h-9 rounded-lg border border-slate-700 text-slate-400 text-xs font-medium hover:border-cblue hover:text-cblue active:scale-95 transition-all">
                        ✏️ Sửa
                      </button>
                      <button onClick={() => setAuditTarget(p)}
                        className="flex-1 h-9 rounded-lg border border-slate-700 text-slate-400 text-xs font-medium hover:border-cpurple hover:text-cpurple active:scale-95 transition-all">
                        🕒 Lịch sử
                      </button>
                      <button onClick={() => setDeleteTarget(p)}
                        className="h-9 w-9 rounded-lg border border-slate-700 text-slate-500 hover:border-cred hover:text-cred active:scale-95 transition-all flex items-center justify-center">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M9 3h6m-8 5h10m-9 0l.6 12h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop: Table (≥ sm) ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-0">
                <thead>
                  <tr className="bg-surface2 border-b border-slate-800">
                    <th className="sticky top-0 z-10 bg-surface2 px-3 sm:px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap min-w-[220px]">Sản phẩm</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Giá vốn</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Giá bán</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Lợi nhuận</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">ĐVT</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-3 sm:px-4 py-3 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Tồn kho</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      <select value={stockFilter} onChange={e => setStockFilter(e.target.value)} onClick={e => e.stopPropagation()}
                        className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-transparent border-none outline-none cursor-pointer hover:text-[#1e293b] transition-colors">
                        <option value="all">Trạng thái ▾</option>
                        <option value="in">✅ Còn hàng</option>
                        <option value="low">⚠️ Sắp hết</option>
                        <option value="out">❌ Hết hàng</option>
                      </select>
                    </th>
                    <th className="sticky top-0 z-10 bg-surface2 px-3 sm:px-4 py-3 text-center text-[11px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {pagedProducts.map(p => {
                    const profit = (p.sellPrice || 0) - (p.importPrice || 0)
                    const margin = p.importPrice > 0 ? (profit / p.importPrice * 100).toFixed(0) : 0
                    const badge  = stockBadge(p.stockQuantity)
                    return (
                      <tr key={p.id} onClick={() => setEditTarget(p)} className="hover:bg-surface2 transition-colors group cursor-pointer">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-slate-800 shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg border border-slate-800 bg-surface2 flex items-center justify-center shrink-0 text-slate-500">
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="8.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-[#1e293b] whitespace-nowrap group-hover:text-cblue transition-colors">{p.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{p.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[#1e293b] font-mono">{fmtVNDFull(p.importPrice)}</td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-[#1e293b] font-mono">{fmtVNDFull(p.sellPrice)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className={`tabular-nums font-bold font-mono ${profit >= 0 ? 'text-cgreen' : 'text-cred'}`}>{fmtVNDFull(profit)}</div>
                          <div className="text-[10px] text-slate-500">{margin}%</div>
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          {p.unit
                            ? <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600">{p.unit}</span>
                            : <span className="text-slate-500 text-[11px]">—</span>}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setStockTarget(p)} title="Điều chỉnh tồn kho"
                            className={`tabular-nums font-bold font-mono transition-colors hover:opacity-75 ${p.stockQuantity <= 0 ? 'text-cred' : p.stockQuantity <= 10 ? 'text-cyellow' : 'text-[#1e293b]'}`}>
                            {fmtQty(p.stockQuantity)}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${badge.cls}`}>{badge.label}</span>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            title="Thao tác"
                            onClick={e => {
                              const r = e.currentTarget.getBoundingClientRect()
                              setRowMenu({ p, top: r.bottom + 4, left: Math.max(8, r.right - 184) })
                            }}
                            className="w-8 h-8 rounded-lg text-slate-400 hover:text-[#1e293b] hover:bg-surface2 transition-colors flex items-center justify-center mx-auto"
                          >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Pagination */}
        {!loading && displayedProducts.length > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 order-2 sm:order-1">
              Hiển thị <span className="font-semibold text-[#1e293b]">{pageStart}-{pageEnd}</span> / {displayedProducts.length} sản phẩm
            </div>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="w-8 h-8 rounded-lg border border-slate-800 text-slate-500 hover:bg-surface2 hover:text-[#1e293b] disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center">‹</button>
              {pageList(page, totalPages).map((n, i) => n === '…'
                ? <span key={'e' + i} className="w-8 h-8 flex items-center justify-center text-slate-500 text-xs">…</span>
                : <button key={n} onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center ${
                      n === page ? 'bg-cblue text-white shadow-sm' : 'border border-slate-800 text-slate-500 hover:bg-surface2 hover:text-[#1e293b]'
                    }`}>{n}</button>
              )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="w-8 h-8 rounded-lg border border-slate-800 text-slate-500 hover:bg-surface2 hover:text-[#1e293b] disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center">›</button>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 order-3">
              Hiển thị
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-800 rounded-lg pl-2 pr-1 py-1 text-[#1e293b] font-semibold outline-none focus:border-cblue cursor-pointer">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              sản phẩm / trang
            </div>
          </div>
        )}
      </div>

      {/* Row action menu (kebab) */}
      {rowMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
          <div className="fixed z-50 w-44 bg-white border border-slate-800 rounded-xl shadow-xl py-1"
            style={{ top: rowMenu.top, left: rowMenu.left }}>
            <button onClick={() => { setEditTarget(rowMenu.p); setRowMenu(null) }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-[#1e293b] hover:bg-surface2 transition-colors flex items-center gap-2">✏️ Sửa thông tin</button>
            <button onClick={() => { setStockTarget(rowMenu.p); setRowMenu(null) }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-[#1e293b] hover:bg-surface2 transition-colors flex items-center gap-2">📦 Điều chỉnh kho</button>
            <button onClick={() => { setAuditTarget(rowMenu.p); setRowMenu(null) }}
              className="w-full text-left px-3 py-2 text-xs font-medium text-[#1e293b] hover:bg-surface2 transition-colors flex items-center gap-2">🕒 Lịch sử thay đổi</button>
            <div className="h-px bg-slate-800 my-1" />
            <button onClick={() => { setDeleteTarget(rowMenu.p); setRowMenu(null) }}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-cred hover:bg-cred/10 transition-colors flex items-center gap-2">🗑️ Xoá sản phẩm</button>
          </div>
        </>
      )}

      {/* Modals */}
      {isAddOpen    && <AddProductModal onSave={handleAdd} onClose={() => setIsAddOpen(false)} />}
      {showImportMethod && (
        <ImportMethodModal
          onManual={() => { setShowImportMethod(false); setIsImportOpen(true) }}
          onExcel={() =>  { setShowImportMethod(false); setIsImportExcelOpen(true) }}
          onBest={() =>   { setShowImportMethod(false); setIsBestImportOpen(true) }}
          onClose={() =>  setShowImportMethod(false)}
        />
      )}
      {isImportOpen && <ImportStockModal products={products} onImported={handleImported} onClose={() => setIsImportOpen(false)} />}
      {isBestImportOpen && <ImportBestExpressModal products={products} onImported={handleImported} onClose={() => setIsBestImportOpen(false)} />}
      {showOcrPurchase && (
        <OcrInvoiceModal
          type="PURCHASE"
          products={products}
          suppliers={suppliers}
          onCreateImportOrder={async (data) => {
            try {
              await createImportOrder(data)
              toast.success('✅ Đã tạo đơn nhập hàng thành công!')
              loadProducts('').then(setProducts).catch(() => {})
            } catch (err) {
              toast.error(err.message || 'Lỗi khi tạo đơn nhập')
            }
          }}
          onClose={() => setShowOcrPurchase(false)}
        />
      )}
      {editTarget   && <AddProductModal initial={editTarget} onSave={handleEdit} onClose={() => setEditTarget(null)} />}
      {stockTarget  && <AdjustStockModal product={stockTarget} onSave={handleStock} onClose={() => setStockTarget(null)} />}
      {auditTarget  && (
        <AuditLogModal
          tableName="products"
          recordId={auditTarget.id}
          title={`[${auditTarget.sku}] ${auditTarget.name}`}
          onClose={() => setAuditTarget(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)}>
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="text-lg font-bold text-cred">Xoá hàng hóa?</div>
            <div className="text-sm text-muted">
              <span className="font-semibold text-[#1e293b]">[{deleteTarget.sku}] {deleteTarget.name}</span><br/>
              Hành động này không thể hoàn tác. Các đơn hàng đã có sẽ không bị ảnh hưởng.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
              <button onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg bg-cred/20 border border-cred/40 text-cred text-sm font-bold hover:bg-cred/30 transition-colors disabled:opacity-60">
                {deleting ? 'Đang xoá…' : 'Xoá'}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}
