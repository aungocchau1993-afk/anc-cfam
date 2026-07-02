import { useState, useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  Package, PackagePlus, PackageX, PackageSearch, Search, Download, Upload, ScanLine,
  Pencil, Trash2, History, MoreVertical, X, ImageOff, ImagePlus, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Settings2,
  TrendingUp, TrendingDown, Boxes, Wallet, LineChart, Plus, LoaderCircle, Printer,
  Filter, Tag, Building2, Warehouse, Minus, Equal, Sparkles,
} from 'lucide-react'
import { loadProducts, insertProduct, updateProduct, deleteProduct, uploadProductImage, deleteProductImage, upsertProducts, uploadProductImageBlob, loadSuppliers, createImportOrder } from '../../lib/supabase'
import { buildReceiptHtml, printViaIframe } from '../../lib/printReceipt'
import ModalOverlay from '../../components/ui/ModalOverlay'
import PageHeader from '../../components/ui/PageHeader'
import Money from '../../components/ui/Money'
import { SkeletonTableBody, SkeletonCard } from '../../components/ui/Skeleton'
import OcrInvoiceModal from '../../components/business/OcrInvoiceModal'
import AuditLogModal from '../../components/business/AuditLogModal'
import { ImportMethodModal, ImportBestExpressModal } from './ImportBestExpress'
import useDebounce from '../../hooks/useDebounce'
import Can from '../../components/permission/Can'
import { usePermission } from '../../hooks/usePermission'
import { PERMISSIONS } from '../../lib/permissions/permissionConstants'
import { formatMoneyLive, parseVNDInput, fmtVNDFull, removeVietnameseTones } from '../../lib/formatters'
const fmtVND = v => v >= 1e6 ? `${(v/1e6).toFixed(1)}tr` : v >= 1e3 ? `${(v/1e3).toFixed(0)}k` : (v||0).toString()

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtQty(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('vi-VN')
}

// Ngưỡng phân loại tồn kho giữ nguyên (qty<=0 / qty<=10) — chỉ đổi màu badge sang Green100/700, Amber100/700, Red100/700.
function stockBadge(qty) {
  if (qty <= 0)  return { label: 'Hết hàng', cls: 'bg-red-100 text-red-700',   icon: XCircle }
  if (qty <= 10) return { label: 'Sắp hết',  cls: 'bg-amber-100 text-amber-700', icon: AlertTriangle }
  return { label: 'Còn hàng', cls: 'bg-green-100 text-green-700', icon: CheckCircle2 }
}

// Sinh danh sách số trang có dấu "…"
function pageList(cur, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (cur <= 4)        return [1, 2, 3, 4, 5, '…', total]
  if (cur >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '…', cur - 1, cur, cur + 1, '…', total]
}

// ── LocalStorage helpers (UI preference only — không phải business data) ────
function loadLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function saveLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota/private mode — bỏ qua */ }
}

const LS_KEYS = {
  viewMode:     'anc_products_view_mode',
  columns:      'anc_products_visible_columns',
  savedFilters: 'anc_products_saved_filters',
}

// ── Sparkline SVG nhỏ gọn cho KPI card ───────────────────────────────────────
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null
  const w = 100, h = 32
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Cột tùy chỉnh khả dụng (Column Manager) ─────────────────────────────────
// Một số cột (Barcode, Nhà cung cấp, Danh mục, Thương hiệu) chưa có field tương ứng
// trong bảng `products` hiện tại — bật cột đó sẽ hiển thị "—" thay vì giá trị giả.
const COLUMN_DEFS = [
  { key: 'sku',      label: 'SKU',            hasData: true },
  { key: 'cost',     label: 'Giá vốn',        hasData: true },
  { key: 'price',    label: 'Giá bán',        hasData: true },
  { key: 'profit',   label: 'Lợi nhuận',      hasData: true },
  { key: 'barcode',  label: 'Barcode',        hasData: false },
  { key: 'supplier', label: 'Nhà cung cấp',   hasData: false },
  { key: 'category', label: 'Danh mục',       hasData: false },
  { key: 'brand',    label: 'Thương hiệu',    hasData: false },
  { key: 'unit',     label: 'ĐVT',            hasData: true },
  { key: 'createdAt',label: 'Ngày tạo',       hasData: true },
]
const DEFAULT_COLUMNS = Object.fromEntries(COLUMN_DEFS.map(c => [c.key, ['sku','cost','price','profit','unit'].includes(c.key)]))

const STATUS_OPTIONS = [
  { v: 'all', l: 'Tất cả trạng thái' },
  { v: 'in',  l: 'Còn hàng' },
  { v: 'low', l: 'Sắp hết' },
  { v: 'out', l: 'Hết hàng' },
]

// ── MOCK trend/sparkline cho KPI ─────────────────────────────────────────────
// TODO(API thật): thay bằng dữ liệu lịch sử thật (vd. bảng snapshot tồn kho theo ngày)
// khi backend có endpoint /analytics/products-trend. Value hiển thị trên card vẫn là
// số liệu THẬT tính từ `products` — chỉ phần % xu hướng + hình sparkline là mock.
function buildMockTrend(seed, dir = 1) {
  const pts = Array.from({ length: 8 }, (_, i) => seed + Math.sin(i * 1.3 + seed) * seed * 0.08 + i * dir * seed * 0.02)
  return pts
}
// Hướng mũi tên trend suy trực tiếp từ dấu +/- của trendLabel khi render (xem `arrowUp`
// trong KPI card bên dưới) — sparkColor là tín hiệu tốt/xấu riêng, không gắn cứng vào chiều mũi tên.
const MOCK_KPI_META = {
  totalSkus:   { trendLabel: '+12 sản phẩm mới', spark: buildMockTrend(40, 1),  sparkColor: '#2563eb' },
  totalStock:  { trendLabel: '+8%',              spark: buildMockTrend(60, 1),  sparkColor: '#16a34a' },
  stockValue:  { trendLabel: '-2%',              spark: buildMockTrend(50, -1), sparkColor: '#f59e0b' },
  potentialRev:{ trendLabel: '+15%',             spark: buildMockTrend(70, 1),  sparkColor: '#0d9488' },
  outOfStock:  { trendLabel: '+5',               spark: buildMockTrend(30, 1),  sparkColor: '#ef4444' },
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

  const lCls = 'text-[12px] text-gray-500 font-semibold uppercase tracking-wider'

  return (
    <ModalOverlay onClose={onClose} className="bg-black/75">
      <div className="bg-white rounded-2xl w-full max-w-lg md:max-w-2xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200 shrink-0">
          <div>
            <div className="font-bold text-base text-gray-900 flex items-center gap-2">
              {isEdit ? <Pencil size={16} strokeWidth={2} className="text-cblue" /> : <PackagePlus size={16} strokeWidth={2} className="text-cblue" />}
              {isEdit ? 'Sửa hàng hóa' : 'Thêm hàng mới'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">{isEdit ? 'Chỉnh sửa thông tin sản phẩm' : 'Tạo mã hàng mới chưa từng có trong hệ thống'}</div>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:text-cred transition-colors flex items-center justify-center"><X size={18} strokeWidth={2.2} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row gap-0">
            {/* Ảnh */}
            <div className="md:w-52 shrink-0 flex flex-col items-center gap-3 p-4 border-b md:border-b-0 md:border-r border-gray-200">
              <div className={`${lCls} self-start`}>Hình ảnh</div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              <label onClick={() => fileInputRef.current?.click()} className="relative w-full h-48 rounded-xl overflow-hidden cursor-pointer group block">
                {displayUrl ? (
                  <>
                    <img src={displayUrl} alt="preview" className="w-full h-48 object-contain bg-gray-50 rounded-xl border border-gray-200 shadow-sm" />
                    <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex flex-col items-center justify-center gap-2">
                      <ImagePlus size={26} strokeWidth={1.8} className="text-white" />
                      <span className="text-white text-xs font-semibold">Đổi ảnh</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-48 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:border-cblue/60 hover:bg-cblue/5 transition-all flex flex-col items-center justify-center gap-2.5 text-gray-400 hover:text-cblue">
                    <ImagePlus size={30} strokeWidth={1.6} />
                    <span className="text-sm font-medium">Bấm để tải ảnh lên</span>
                    <span className="text-[12px] text-gray-400">PNG, JPG, WEBP · Tối đa 5MB</span>
                  </div>
                )}
              </label>
              {displayUrl && (
                <button type="button" onClick={handleRemoveImage} className="w-full py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:border-cred hover:text-cred hover:bg-cred/5 transition-colors">Xoá ảnh</button>
              )}
            </div>

            {/* Fields */}
            <div className="flex-1 p-4 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-[110px_1fr] gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={lCls}>SKU *</label>
                  <input className="input-base uppercase font-mono" placeholder="SP001" value={form.sku}
                    onChange={e => set('sku', e.target.value)} disabled={isEdit} autoFocus={!isEdit} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={lCls}>Tên hàng *</label>
                  <input className="input-base" placeholder="Tên sản phẩm mới…" value={form.name}
                    onChange={e => set('name', e.target.value)} autoFocus={isEdit} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={lCls}>Giá vốn (₫)</label>
                  <input className="input-money" inputMode="numeric" placeholder="80.000" value={form.importPrice}
                    onChange={e => set('importPrice', formatMoneyLive(e.target.value))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={lCls}>Giá bán (₫)</label>
                  <input className="input-money" inputMode="numeric" placeholder="120.000" value={form.sellPrice}
                    onChange={e => set('sellPrice', formatMoneyLive(e.target.value))} />
                </div>
              </div>

              {(unitPrice > 0 || parseVNDInput(form.sellPrice) > 0) && (
                <div className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-xs border ${profit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <span className="text-gray-500">Lợi nhuận / sản phẩm</span>
                  <span className={`font-bold font-mono tabular-nums ${profit >= 0 ? 'text-cgreen' : 'text-cred'}`}>
                    {fmtVNDFull(profit)} <span className="text-[12px] opacity-60">({marginPct}%)</span>
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className={lCls}>
                    {isEdit ? 'Tồn kho hiện tại' : 'Tồn kho ban đầu'}
                  </label>
                  <input className="input-base" type="number" min="0" placeholder="0" value={form.stockQuantity}
                    onChange={e => set('stockQuantity', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={`${lCls} flex items-center gap-1`}>
                    Tồn kho tối thiểu <AlertTriangle size={11} strokeWidth={2.4} className="text-cyellow" />
                  </label>
                  <input className="input-base !border-amber-300 focus:!border-cyellow focus:!ring-amber-200" type="number" min="0" placeholder="5" value={form.minStock}
                    onChange={e => set('minStock', e.target.value)} />
                </div>
              </div>

              {/* Đơn vị tính */}
              <div className="flex flex-col gap-1.5">
                <label className={lCls}>
                  Đơn vị tính
                </label>
                <input className="input-base" placeholder="Lon, Thùng, Hộp…" value={form.unit}
                  onChange={e => set('unit', e.target.value)} />
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_UNITS.map(u => (
                    <button key={u} type="button"
                      onClick={() => set('unit', u)}
                      className={`px-2 py-0.5 rounded-full text-[12px] border transition-colors
                        ${form.unit === u
                          ? 'bg-cblue/10 border-cblue/50 text-cblue font-bold'
                          : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
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
                    ? <span className="flex items-center gap-2"><LoaderCircle size={15} strokeWidth={2.2} className="animate-spin" />{imageFile ? 'Đang upload ảnh…' : 'Đang lưu…'}</span>
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

  const iCls = 'input-base focus:!border-cgreen focus:!ring-cgreen/15'

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
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-green-50 px-5 py-5 text-center border-b border-green-100">
            <CheckCircle2 size={34} strokeWidth={1.8} className="text-cgreen mx-auto mb-1.5" />
            <div className="font-black text-xl text-cgreen">Nhập kho thành công!</div>
            <div className="text-xs text-gray-500 mt-1 font-mono">
              #{(successData.order.id?.slice(-8) || '').toUpperCase()}
            </div>
          </div>
          {/* Tóm tắt */}
          <div className="px-5 pt-4 pb-3 flex flex-col gap-2">
            {supplier && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Nhà cung cấp</span>
                <span className="font-semibold text-cteal">{supplier.name}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Số sản phẩm</span>
              <span className="font-semibold">{successData.items.length} loại · {successData.items.reduce((s,i)=>s+i.quantity,0)} sp</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2 mt-1">
              <span className="text-gray-500">Tổng tiền nhập</span>
              <span className="font-bold text-gray-900 tabular-nums">{fmtVNDFull(total)}</span>
            </div>
            {paidAmount !== total && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Đã thanh toán</span>
                <span className="font-bold text-cblue tabular-nums">{fmtVNDFull(paidAmount)}</span>
              </div>
            )}
            {showDebt && (
              <div className="flex justify-between items-center rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                <span className="text-xs font-bold text-cred flex items-center gap-1"><Wallet size={12} strokeWidth={2.2} /> Nợ NCC phát sinh</span>
                <span className="font-black text-cred tabular-nums">{fmtVNDFull(debtDelta)}</span>
              </div>
            )}
            {showSurplus && (
              <div className="flex justify-between items-center rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <span className="text-xs font-bold text-cgreen flex items-center gap-1"><Wallet size={12} strokeWidth={2.2} /> NCC nợ ta (trả dư)</span>
                <span className="font-black text-cgreen tabular-nums">{fmtVNDFull(-debtDelta)}</span>
              </div>
            )}
          </div>
          <div className="px-5 pb-2 text-center text-sm text-gray-500">Bạn có muốn in phiếu nhập không?</div>
          <div className="px-5 pb-5 flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition-colors">
              Không
            </button>
            <button onClick={handlePrintReceipt}
              className="flex-1 py-3 rounded-xl bg-cblue hover:brightness-105 text-white text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
              <Printer size={16} strokeWidth={2} />
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
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cgreen/10 text-cgreen flex items-center justify-center mx-auto mb-3">
              <PackagePlus size={22} strokeWidth={2} />
            </div>
            <div className="text-base font-black text-gray-900">Xác nhận nhập kho</div>
            <div className="text-xs text-gray-500 mt-1.5">Bạn có chắc muốn thực hiện phiếu nhập này không?</div>
          </div>
          <div className="mx-5 mb-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Số sản phẩm</span>
              <span className="font-semibold text-gray-900">{cart.length} loại · {cart.reduce((s,i)=>s+i.qty,0)} sp</span>
            </div>
            {selectedSupplier && (
              <div className="flex justify-between">
                <span className="text-gray-500">Nhà cung cấp</span>
                <span className="font-semibold text-cteal">{suppliersList.find(s=>s.id===selectedSupplier)?.name}</span>
              </div>
            )}
            <div className="flex justify-between pt-1.5 border-t border-gray-200 mt-0.5">
              <span className="font-bold text-gray-700">Tổng tiền nhập</span>
              <span className="font-black text-lg text-cyellow tabular-nums">{grandTotal.toLocaleString('vi-VN')} ₫</span>
            </div>
          </div>
          <div className="flex gap-3 px-5 pb-5">
            <button onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5">
              <X size={15} strokeWidth={2.4} /> Không
            </button>
            <button onClick={processImport} disabled={saving}
              className="flex-1 py-3 rounded-xl bg-cgreen hover:brightness-105 text-white text-sm font-black transition-all disabled:opacity-60 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5">
              {saving
                ? <><LoaderCircle size={16} strokeWidth={2.2} className="animate-spin" /> Đang xử lý…</>
                : <><CheckCircle2 size={16} strokeWidth={2.2} /> Có, xác nhận</>
              }
            </button>
          </div>
        </div>
      </div>
    )}

    <ModalOverlay onClose={onClose} className="bg-black/75">
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <div className="font-bold text-base text-gray-900 flex items-center gap-2"><PackagePlus size={17} strokeWidth={2} className="text-cgreen" /> Nhập Kho</div>
            <div className="text-xs text-gray-500 mt-0.5">Thêm nhiều sản phẩm cùng lúc → xác nhận 1 lần</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-cred transition-colors flex items-center justify-center"><X size={16} strokeWidth={2.2} /></button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-200 shrink-0" ref={wrapRef}>
          <div className="relative">
            <Search size={16} strokeWidth={2} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
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
              <ul className="absolute top-full mt-1 left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                {suggestions.map(p => (
                  <li key={p.id}>
                    <button type="button"
                      onMouseDown={e => { e.preventDefault(); addToCart(p) }}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 transition-colors text-left">
                      {p.imageUrl
                        ? <img src={p.imageUrl} alt={p.name} className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0" />
                        : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-[12px] font-bold shrink-0">{p.sku?.slice(0,2)}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900 truncate">{p.name}</div>
                        <div className="text-[12px] text-gray-500 font-mono">{p.sku} · Tồn: <span className={p.stockQuantity > 0 ? 'text-cgreen' : 'text-cred'}>{p.stockQuantity}</span></div>
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
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
              <PackageSearch size={34} strokeWidth={1.5} />
              <div className="text-sm font-medium text-gray-500">Tìm và thêm sản phẩm ở thanh tìm kiếm trên</div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[600px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <thead>
                  <tr className="bg-[#f8fafc] border-b border-gray-200">
                    {['Sản phẩm', 'Tồn kho', 'SL nhập', 'ĐVT', 'Giá nhập (₫)', 'Thành tiền', ''].map((h, i) => (
                      <th key={i} className={`px-4 py-2.5 text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap ${i >= 1 ? 'text-right' : 'text-left'} ${i === 6 ? 'w-8' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cart.map(item => {
                    const price   = parseVNDInput(item.unitPrice) || 0
                    const lineAmt = price * item.qty
                    return (
                      <tr key={item.productId} className="hover:bg-[#f8fafc] transition-colors duration-200 group">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            {item.imageUrl
                              ? <img src={item.imageUrl} alt={item.name} className="w-8 h-8 rounded-lg object-cover border border-gray-200 shrink-0" />
                              : <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-400 text-[12px] font-bold shrink-0">{item.sku?.slice(0,2)}</div>
                            }
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-gray-900 truncate max-w-[160px]">{item.name}</div>
                              <div className="text-[12px] text-gray-500 font-mono">{item.sku}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-mono text-xs text-gray-500 whitespace-nowrap">
                          {item.currentStock}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <input
                            type="number" min="1"
                            value={item.qty}
                            onChange={e => updateQty(item.productId, e.target.value)}
                            className="w-20 rounded-lg bg-green-50 border border-green-200 text-cgreen text-sm text-center font-bold font-mono outline-none focus:border-cgreen px-2 py-1 transition-all"
                          />
                        </td>
                        {/* ĐVT — có thể nhập tay */}
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <input
                            type="text"
                            value={item.unit ?? ''}
                            onChange={e => updateUnit(item.productId, e.target.value)}
                            placeholder="đvt"
                            className="w-16 rounded-lg bg-blue-50 border border-blue-200 text-cblue text-xs text-center font-bold outline-none focus:border-cblue px-2 py-1 transition-all placeholder:text-gray-400"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <input
                            type="text" inputMode="numeric"
                            value={item.unitPrice}
                            onChange={e => updateUnitPrice(item.productId, e.target.value)}
                            placeholder="0"
                            className="w-28 rounded-lg bg-white border border-gray-300 text-cblue text-sm text-right font-mono outline-none focus:border-cblue px-2 py-1 transition-all"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-mono text-sm font-bold text-gray-900 whitespace-nowrap">
                          {lineAmt > 0 ? fmtVNDFull(lineAmt) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <button onClick={() => removeFromCart(item.productId)}
                            className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md border border-gray-200 text-gray-500 hover:border-cred hover:text-cred hover:bg-red-50 transition-all flex items-center justify-center">
                            <X size={12} strokeWidth={2.4} />
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
          <div className="shrink-0 border-t border-gray-200 px-6 py-4 flex flex-col gap-3 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* NCC */}
              <div className="flex-1">
                <label className="text-[12px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">Nhà cung cấp</label>
                <select className={iCls + ' cursor-pointer'} value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                  <option value="">— Không chọn —</option>
                  {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {/* Ghi chú */}
              <div className="flex-1">
                <label className="text-[12px] text-gray-500 font-semibold uppercase tracking-wider block mb-1">Ghi chú</label>
                <input className={iCls} placeholder="Ghi chú phiếu nhập…" value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>

            {/* ── Thanh toán & công nợ NCC ── */}
            <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">

              {/* Tổng tiền nhập */}
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Tổng tiền nhập</span>
                <span className="font-black text-base tabular-nums text-gray-900">{fmtVNDFull(grandTotal)}</span>
              </div>

              {/* Input: Số tiền TT */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 shrink-0 w-[108px]">Số tiền thanh toán</span>
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
                  className="flex-1 min-w-0 bg-white border border-gray-300 rounded-lg px-4 py-3 text-base text-right font-mono font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:border-cgreen focus:ring-4 focus:ring-cgreen/10 transition-all"
                />
              </div>

              {/* Còn nợ NCC */}
              {newDebtAmt > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                  <div>
                    <span className="text-xs font-bold text-cred flex items-center gap-1"><Wallet size={12} strokeWidth={2.2} className="inline" /> Còn nợ NCC</span>
                    {selectedSupplier && (
                      <span className="text-[12px] text-red-400 ml-1">
                        → cộng vào nợ {suppliersList.find(s => s.id === selectedSupplier)?.name}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-black text-sm text-cred tabular-nums">{fmtVNDFull(newDebtAmt)}</span>
                </div>
              )}

              {/* Trả dư — NCC nợ ta */}
              {surplusAmt > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                  <div>
                    <span className="text-xs font-bold text-cgreen flex items-center gap-1"><Wallet size={12} strokeWidth={2.2} className="inline" /> Trả dư — NCC nợ ta</span>
                    {selectedSupplier && (
                      <span className="text-[12px] text-green-500 ml-1">
                        → trừ vào nợ hiện tại của {suppliersList.find(s => s.id === selectedSupplier)?.name}
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-black text-sm text-cgreen tabular-nums">{fmtVNDFull(surplusAmt)}</span>
                </div>
              )}

              {/* Đã thanh toán đủ */}
              {paidInput && debtDelta === 0 && (
                <div className="text-xs text-cgreen font-semibold text-center py-1 flex items-center justify-center gap-1">
                  <CheckCircle2 size={13} strokeWidth={2.2} /> Thanh toán đầy đủ — không phát sinh nợ
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="text-xs text-gray-500">
                <span className="text-cgreen font-bold">{cart.length}</span> sản phẩm
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:text-gray-900 transition-colors">Huỷ</button>
                <button
                  onClick={handleConfirmClick}
                  disabled={cart.length === 0}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-cgreen hover:brightness-105 text-white text-sm font-bold transition-all duration-200 disabled:opacity-50 shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                >
                  <PackagePlus size={16} strokeWidth={2.2} /> Xác nhận nhập {cart.length} sản phẩm
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
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="font-bold text-base text-gray-900 flex items-center gap-2"><Boxes size={18} strokeWidth={2} className="text-cblue" /> Điều chỉnh tồn kho</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-cred transition-colors flex items-center justify-center"><X size={15} strokeWidth={2.2} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="text-sm text-gray-900">
            <span className="font-bold text-cblue">{product.name}</span>
            <span className="text-muted ml-2">· Tồn hiện tại: <strong className="text-gray-900 tabular-nums">{fmtQty(product.stockQuantity)}</strong></span>
          </div>

          {/* Mode selector */}
          <div className="flex gap-2">
            {[['add','+ Nhập', Plus],['sub','- Xuất', Minus],['set','= Đặt', Equal]].map(([v, l, Icon]) => (
              <button key={v} onClick={() => setMode(v)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                  mode === v ? 'bg-cblue/10 border-cblue text-cblue' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-cblue'
                }`}><Icon size={13} strokeWidth={2.4} />{l}</button>
            ))}
          </div>

          <input
            autoFocus type="number" min="0" placeholder="Số lượng"
            value={delta} onChange={e => setDelta(e.target.value)}
            className="input-base text-center font-mono text-lg"
          />

          <div className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs">
            <span className="text-muted">Tồn sau điều chỉnh</span>
            <span className={`font-bold font-mono tabular-nums text-base ${preview <= 0 ? 'text-cred' : preview <= 10 ? 'text-cyellow' : 'text-cgreen'}`}>
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

// ── Bulk: Cập nhật tồn kho hàng loạt ────────────────────────────────────────
function BulkStockModal({ count, busy, onClose, onApply }) {
  const [mode, setMode]   = useState('add')
  const [delta, setDelta] = useState('')
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="font-bold text-base text-gray-900 flex items-center gap-2"><Boxes size={18} strokeWidth={2} className="text-cblue" /> Cập nhật tồn kho hàng loạt</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-cred transition-colors flex items-center justify-center"><X size={15} strokeWidth={2.2} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="text-sm text-gray-600">Áp dụng cho <strong className="text-gray-900">{count}</strong> sản phẩm đã chọn</div>
          <div className="flex gap-2">
            {[['add','+ Cộng thêm', Plus], ['sub','- Trừ bớt', Minus], ['set','= Đặt lại', Equal]].map(([v, l, Icon]) => (
              <button key={v} onClick={() => setMode(v)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
                  mode === v ? 'bg-cblue/10 border-cblue text-cblue' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-cblue'
                }`}><Icon size={13} strokeWidth={2.4} />{l}</button>
            ))}
          </div>
          <input autoFocus type="number" min="0" placeholder="Số lượng" value={delta} onChange={e => setDelta(e.target.value)}
            className="input-base text-center font-mono text-lg" />
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
            <button onClick={() => onApply(mode, delta)} disabled={busy} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
              {busy ? 'Đang xử lý…' : 'Áp dụng'}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Bulk: Cập nhật giá bán hàng loạt (theo %) ───────────────────────────────
function BulkPriceModal({ count, busy, onClose, onApply }) {
  const [percent, setPercent] = useState('')
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="font-bold text-base text-gray-900 flex items-center gap-2"><Wallet size={18} strokeWidth={2} className="text-cblue" /> Cập nhật giá bán hàng loạt</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-cred transition-colors flex items-center justify-center"><X size={15} strokeWidth={2.2} /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="text-sm text-gray-600">Điều chỉnh giá bán cho <strong className="text-gray-900">{count}</strong> sản phẩm đã chọn (% trên giá hiện tại)</div>
          <div className="relative">
            <input autoFocus type="number" placeholder="vd: 10 hoặc -5" value={percent} onChange={e => setPercent(e.target.value)}
              className="input-base text-center font-mono text-lg pr-10" />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
            <button onClick={() => onApply(percent)} disabled={busy} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
              {busy ? 'Đang xử lý…' : 'Áp dụng'}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function Products() {
  const { can } = usePermission()
  const canViewCost = can(PERMISSIONS.INVENTORY_VIEW_COST)
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

  // ── UI-only state bổ sung (view mode / cột / chọn nhiều / bộ lọc đã lưu) ──
  // Không đụng tới CRUD/API — chỉ là preference hiển thị, lưu localStorage.
  const [viewMode, setViewMode]           = useState(() => loadLS(LS_KEYS.viewMode, 'table')) // 'table' | 'compact' | 'grid'
  const [visibleColumns, setVisibleColumns] = useState(() => loadLS(LS_KEYS.columns, DEFAULT_COLUMNS))
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [selectedIds, setSelectedIds]     = useState(() => new Set())
  const [savedFilters, setSavedFilters]   = useState(() => loadLS(LS_KEYS.savedFilters, []))
  const [showSaveFilter, setShowSaveFilter] = useState(false)
  const [saveFilterName, setSaveFilterName] = useState('')
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const [showStatusMenu, setShowStatusMenu] = useState(false)
  const [bulkBusy, setBulkBusy]           = useState(false)
  const [bulkStockModal, setBulkStockModal] = useState(false)
  const [bulkPriceModal, setBulkPriceModal] = useState(false)

  useEffect(() => saveLS(LS_KEYS.viewMode, viewMode), [viewMode])
  useEffect(() => saveLS(LS_KEYS.columns, visibleColumns), [visibleColumns])
  useEffect(() => saveLS(LS_KEYS.savedFilters, savedFilters), [savedFilters])

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

  // ── Bulk actions (thanh Action nổi) — chỉ lặp gọi lại deleteProduct/updateProduct
  // đã import sẵn ở đầu file, KHÔNG viết CRUD/API mới. ────────────────────────
  function toggleSelectOne(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleSelectAllOnPage() {
    setSelectedIds(prev => {
      const pageIds = pagedProducts.map(p => p.id)
      const allSelected = pageIds.length > 0 && pageIds.every(id => prev.has(id))
      const next = new Set(prev)
      pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  const selectedProducts = useMemo(
    () => products.filter(p => selectedIds.has(p.id)),
    [products, selectedIds]
  )

  async function handleBulkDelete() {
    if (!window.confirm(`Xoá ${selectedIds.size} sản phẩm đã chọn? Hành động này không thể hoàn tác.`)) return
    setBulkBusy(true)
    try {
      for (const p of selectedProducts) await deleteProduct(p.id)
      setProducts(prev => prev.filter(x => !selectedIds.has(x.id)))
      toast.success(`Đã xoá ${selectedProducts.length} sản phẩm`)
      clearSelection()
    } catch (e) {
      toast.error(e.message || 'Lỗi xoá hàng loạt')
    } finally {
      setBulkBusy(false)
    }
  }

  function handleBulkExportExcel() {
    const rows = selectedProducts.map(p => ({
      'Mã Hàng (SKU)': p.sku,
      'Tên Hàng':      p.name,
      'ĐVT':           p.unit          ?? '',
      'Giá Vốn':       p.importPrice   ?? 0,
      'Giá Bán':       p.sellPrice     ?? 0,
      'Tồn Kho':       p.stockQuantity ?? 0,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 16 }, { wch: 36 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Hàng Hóa đã chọn')
    XLSX.writeFile(wb, 'Hang_Hoa_Da_Chon.xlsx')
    toast.success(`Đã xuất ${rows.length} sản phẩm`)
  }

  // Cộng/trừ/đặt tồn kho hàng loạt — cùng logic với AdjustStockModal, chỉ áp dụng cho nhiều sp.
  async function handleBulkStockUpdate(mode, delta) {
    const d = parseInt(delta) || 0
    if (!d && mode !== 'set') { toast.error('Nhập số lượng'); return }
    setBulkBusy(true)
    try {
      for (const p of selectedProducts) {
        let newQty
        if (mode === 'set') newQty = Math.max(0, d)
        else if (mode === 'add') newQty = (p.stockQuantity || 0) + d
        else newQty = Math.max(0, (p.stockQuantity || 0) - d)
        const saved = await updateProduct(p.id, { stockQuantity: newQty })
        setProducts(prev => prev.map(x => x.id === p.id ? saved : x))
      }
      toast.success(`Đã cập nhật tồn kho ${selectedProducts.length} sản phẩm`)
      setBulkStockModal(false)
      clearSelection()
    } catch (e) {
      toast.error(e.message || 'Lỗi cập nhật tồn kho')
    } finally {
      setBulkBusy(false)
    }
  }

  // Điều chỉnh giá bán hàng loạt theo %  — dùng lại updateProduct đã có.
  async function handleBulkPriceUpdate(percent) {
    const pct = parseFloat(percent)
    if (!pct) { toast.error('Nhập % điều chỉnh'); return }
    setBulkBusy(true)
    try {
      for (const p of selectedProducts) {
        const newPrice = Math.max(0, Math.round((p.sellPrice || 0) * (1 + pct / 100)))
        const saved = await updateProduct(p.id, { sellPrice: newPrice })
        setProducts(prev => prev.map(x => x.id === p.id ? saved : x))
      }
      toast.success(`Đã cập nhật giá bán ${selectedProducts.length} sản phẩm`)
      setBulkPriceModal(false)
      clearSelection()
    } catch (e) {
      toast.error(e.message || 'Lỗi cập nhật giá')
    } finally {
      setBulkBusy(false)
    }
  }

  // ── Saved filter (chỉ bọc lại search + stockFilter hiện có) ─────────────────
  function applySavedFilter(f) {
    setSearch(f.search ?? '')
    setStockFilter(f.stockFilter ?? 'all')
    setShowFilterMenu(false)
  }
  function saveCurrentFilter() {
    const name = saveFilterName.trim()
    if (!name) return
    setSavedFilters(prev => [...prev, { id: Date.now(), name, search, stockFilter }])
    setSaveFilterName('')
    setShowSaveFilter(false)
    toast.success(`Đã lưu bộ lọc "${name}"`)
  }
  function deleteSavedFilter(id) {
    setSavedFilters(prev => prev.filter(f => f.id !== id))
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
    <div className="w-full">
      <PageHeader
        icon={Package}
        title="Hàng Hóa"
        subtitle="Quản lý toàn bộ sản phẩm trong hệ thống"
        actions={
          <button className="h-11 px-4 rounded-xl border border-white/20 text-white/90 text-sm font-semibold hover:bg-white/10 hover:border-white/30 active:scale-[0.98] transition-all duration-200 flex items-center gap-2 shrink-0">
            <Settings2 size={16} strokeWidth={2} /> Cài đặt
          </button>
        }
      />

      <div className="p-6 w-full">

      {/* Low-stock alert */}
      {lowStockItems.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">

          {/* ── Header — luôn hiển thị, click để toggle ── */}
          <button
            onClick={() => setShowLowStock(v => !v)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-100/50 transition-colors text-left"
          >
            <AlertTriangle size={17} strokeWidth={2} className="text-cyellow shrink-0" />
            <span className="text-cyellow font-bold text-sm flex-1">
              {lowStockItems.length} sản phẩm dưới mức tồn kho tối thiểu
              {' '}
              <span className="text-amber-600/70 font-normal">
                ({lowStockItems.filter(p => p.stockQuantity <= 0).length} hết hàng)
              </span>
            </span>
            <span className="text-[12px] text-amber-600/80 font-semibold hidden sm:inline">
              {showLowStock ? 'Ẩn bớt' : 'Xem chi tiết'}
            </span>
            <ChevronDown size={15} strokeWidth={2.2} className={`text-amber-500 shrink-0 transition-transform duration-200 ${showLowStock ? 'rotate-180' : ''}`} />
          </button>

          {/* ── List — chỉ hiện khi mở ── */}
          {showLowStock && (
            <div className="border-t border-amber-200">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2 bg-amber-100/40 border-b border-amber-200/60">
                <span className="text-[12px] font-bold text-amber-600/80 uppercase tracking-wider">Sản phẩm</span>
                <span className="text-[12px] font-bold text-amber-600/80 uppercase tracking-wider text-right">Tồn kho</span>
                <span className="text-[12px] font-bold text-amber-600/80 uppercase tracking-wider text-right">Tối thiểu</span>
                <span className="text-[12px] font-bold text-amber-600/80 uppercase tracking-wider text-right">Thiếu</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-amber-200/50 max-h-64 overflow-y-auto">
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
                        className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2.5 hover:bg-amber-100/40 cursor-pointer transition-colors group"
                      >
                        {/* Tên + SKU */}
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-900 truncate group-hover:text-cyellow transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[12px] font-mono text-gray-500 mt-0.5">{p.sku}</div>
                        </div>

                        {/* Tồn kho */}
                        <div className="text-right self-center">
                          <span className={`text-sm font-black tabular-nums ${isOut ? 'text-cred' : 'text-cyellow'}`}>
                            {p.stockQuantity ?? 0}
                          </span>
                          {isOut && (
                            <div className="text-[12px] font-bold text-cred uppercase tracking-wide">Hết</div>
                          )}
                        </div>

                        {/* Tối thiểu */}
                        <div className="text-right self-center">
                          <span className="text-xs tabular-nums text-gray-500">{min}</span>
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
              <div className="px-4 py-2.5 border-t border-amber-200/60 flex items-center justify-between bg-amber-100/30">
                <span className="text-[12px] text-amber-600/80">Click vào dòng để chỉnh sửa sản phẩm</span>
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
                    className="flex items-center gap-1 text-[12px] font-semibold text-emerald-600/90 hover:text-emerald-700 border border-emerald-200 hover:border-emerald-400 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-all"
                  >
                    <Download size={12} strokeWidth={2.2} />
                    Xuất Excel
                  </button>
                  <button
                    onClick={() => setShowLowStock(false)}
                    className="text-[12px] text-amber-600/80 hover:text-cyellow transition-colors flex items-center gap-0.5"
                  >
                    Thu gọn <ChevronUp size={11} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI row — value là số liệu THẬT từ `kpis`; trend/sparkline hiện là mock (MOCK_KPI_META,
          xem comment TODO(API thật) phía trên) do backend chưa có endpoint lịch sử tồn kho. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { key: 'totalSkus',   label: 'Tổng SKU',            value: kpis.totalSkus,                unit: 'sản phẩm', icon: Package,   tone: 'blue'   },
          { key: 'totalStock',  label: 'Tổng tồn kho',        value: fmtQty(kpis.totalStock),       unit: 'sản phẩm', icon: Boxes,     tone: 'green'  },
          { key: 'stockValue',  label: 'Giá trị vốn',         value: fmtVNDFull(kpis.stockValue),   unit: '',          icon: Wallet,    tone: 'amber'  },
          { key: 'potentialRev',label: 'Doanh thu tiềm năng', value: fmtVNDFull(kpis.potentialRev), unit: '',          icon: LineChart, tone: 'teal'   },
          { key: 'outOfStock',  label: 'Hết hàng',            value: kpis.outOfStock,               unit: 'mặt hàng',  icon: PackageX,  tone: 'red'    },
        ].map(k => {
          const meta = MOCK_KPI_META[k.key]
          const Icon = k.icon
          const tones = {
            blue:  'bg-blue-50 text-cblue',
            green: 'bg-green-50 text-cgreen',
            amber: 'bg-amber-50 text-cyellow',
            teal:  'bg-teal-50 text-cteal',
            red:   'bg-red-50 text-cred',
          }
          // Hướng mũi tên phản ánh đúng dấu +/- của trendLabel (không phải "tốt/xấu") —
          // màu sắc (sparkColor) mới là tín hiệu tốt/xấu, tránh mâu thuẫn kiểu "+5" nhưng mũi tên chỉ xuống.
          const arrowUp = meta.trendLabel.trim().startsWith('+')
          return (
            <div
              key={k.key}
              className="bg-white rounded-2xl p-6 shadow-card hover:shadow-cardHover transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[k.tone]}`}>
                  <Icon size={18} strokeWidth={2} />
                </span>
                <span className="flex items-center gap-0.5 text-[12px] font-bold shrink-0" style={{ color: meta.sparkColor }}>
                  {arrowUp ? <TrendingUp size={13} strokeWidth={2.6} /> : <TrendingDown size={13} strokeWidth={2.6} />}
                </span>
              </div>
              <div className="text-[12px] font-semibold text-muted mb-1 truncate">{k.label}</div>
              <div className="text-xl font-bold text-text tabular-nums leading-tight truncate">
                {k.value}{k.unit && <span className="text-[12px] font-medium text-muted ml-1">{k.unit}</span>}
              </div>
              <div className="text-[12px] font-semibold mt-1" style={{ color: meta.sparkColor }}>{meta.trendLabel}</div>
              <div className="mt-2.5 -mx-1">
                <Sparkline data={meta.spark} color={meta.sparkColor} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ══════════════════ TOOLBAR — card riêng, sticky khi cuộn ══════════════════ */}
      <div className="sticky top-0 z-30 bg-white rounded-2xl shadow-sm p-4 mb-4 flex flex-wrap items-center gap-2.5">

        {/* Search — chiếm ~60% chiều ngang */}
        <div className="relative w-full lg:w-[60%] lg:flex-none flex-1 min-w-[220px]">
          {isSearching
            ? <LoaderCircle size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cblue animate-spin" />
            : <Search size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          }
          <input
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-cblue focus:ring-4 focus:ring-cblue/10 transition-all"
            placeholder="Tìm theo tên, SKU, mã vạch..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Trạng thái — dropdown thật, dùng lại stockFilter/setStockFilter đã có */}
        <div className="relative">
          <button onClick={() => setShowStatusMenu(v => !v)}
            className="h-11 flex items-center gap-2 px-3.5 rounded-xl border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 transition-colors">
            <Filter size={15} strokeWidth={2} className="text-gray-500" />
            {STATUS_OPTIONS.find(o => o.v === stockFilter)?.l ?? 'Trạng thái'}
            <ChevronDown size={14} strokeWidth={2.2} className={`text-gray-400 transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
          </button>
          {showStatusMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowStatusMenu(false)} />
              <div className="absolute left-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden py-1">
                {STATUS_OPTIONS.map(o => (
                  <button key={o.v} onClick={() => { setStockFilter(o.v); setShowStatusMenu(false) }}
                    className={`w-full flex items-center justify-between px-3.5 h-10 text-left text-sm transition-colors ${
                      stockFilter === o.v ? 'bg-blue-50 text-cblue font-semibold' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                    {o.l}
                    <span className="text-[12px] text-gray-400 tabular-nums">
                      {o.v === 'all' ? products.length
                        : o.v === 'in'  ? products.filter(p => (p.stockQuantity ?? 0) > 10).length
                        : o.v === 'low' ? products.filter(p => (p.stockQuantity ?? 0) > 0 && (p.stockQuantity ?? 0) <= 10).length
                        : products.filter(p => (p.stockQuantity ?? 0) <= 0).length}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Danh mục / Thương hiệu / Kho — CHƯA có field trong schema products, hiện placeholder disabled */}
        {[
          { label: 'Danh mục',    icon: Tag },
          { label: 'Thương hiệu', icon: Building2 },
          { label: 'Kho',         icon: Warehouse },
        ].map(f => (
          <button key={f.label} disabled title="Chưa có dữ liệu để lọc"
            className="h-11 hidden md:flex items-center gap-2 px-3.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400 cursor-not-allowed whitespace-nowrap">
            <f.icon size={15} strokeWidth={2} />{f.label}
            <ChevronDown size={14} strokeWidth={2.2} />
          </button>
        ))}

        {/* Saved filter */}
        <div className="relative">
          <button onClick={() => setShowFilterMenu(v => !v)} title="Bộ lọc đã lưu"
            className="h-11 w-11 flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-cyellow transition-colors">
            <Sparkles size={16} strokeWidth={2} />
          </button>
          {showFilterMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setShowFilterMenu(false); setShowSaveFilter(false) }} />
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-gray-200 text-[12px] font-bold uppercase tracking-wide text-gray-400">Bộ lọc đã lưu</div>
                <div className="max-h-52 overflow-y-auto">
                  {savedFilters.length === 0 ? (
                    <div className="px-3.5 py-4 text-[14px] text-gray-500 text-center">Chưa có bộ lọc nào</div>
                  ) : savedFilters.map(f => (
                    <div key={f.id} className="flex items-center gap-1 px-2 hover:bg-gray-50 transition-colors group">
                      <button onClick={() => applySavedFilter(f)} className="flex-1 flex items-center gap-2 py-2.5 text-left text-[14px] text-gray-900 truncate">
                        <Sparkles size={13} strokeWidth={2} className="text-cyellow shrink-0" /> {f.name}
                      </button>
                      <button onClick={() => deleteSavedFilter(f.id)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-cred transition-all shrink-0">
                        <X size={13} strokeWidth={2.2} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 p-2.5">
                  {showSaveFilter ? (
                    <div className="flex items-center gap-1.5">
                      <input autoFocus value={saveFilterName} onChange={e => setSaveFilterName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveCurrentFilter()}
                        placeholder="Đặt tên bộ lọc…" className="input-sm flex-1 h-9 text-xs" />
                      <button onClick={saveCurrentFilter} className="btn-primary h-9 px-2.5 text-xs shrink-0">Lưu</button>
                    </div>
                  ) : (
                    <button onClick={() => setShowSaveFilter(true)}
                      className="w-full h-9 rounded-lg border border-dashed border-gray-300 text-[12px] font-semibold text-gray-500 hover:border-cblue hover:text-cblue transition-colors flex items-center justify-center gap-1.5">
                      <Plus size={13} strokeWidth={2.4} /> Lưu bộ lọc hiện tại
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-7 bg-gray-200 hidden lg:block" />

        {/* View mode — Table / Compact / Grid, lưu localStorage */}
        <div className="hidden lg:flex items-center gap-0.5 p-1 rounded-xl bg-gray-100">
          {[
            { v: 'table',   icon: Boxes,        title: 'Bảng' },
            { v: 'compact', icon: MoreVertical, title: 'Rút gọn' },
            { v: 'grid',    icon: PackageSearch,title: 'Lưới' },
          ].map(v => (
            <button key={v.v} onClick={() => setViewMode(v.v)} title={v.title}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                viewMode === v.v ? 'bg-white text-cblue shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <v.icon size={16} strokeWidth={2} />
            </button>
          ))}
        </div>

        {/* Column manager */}
        <div className="relative">
          <button onClick={() => setShowColumnMenu(v => !v)} title="Tùy chỉnh cột"
            className="h-11 w-11 flex items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-cblue transition-colors">
            <Settings2 size={16} strokeWidth={2} />
          </button>
          {showColumnMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowColumnMenu(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-gray-200 text-[12px] font-bold uppercase tracking-wide text-gray-400">Tùy chỉnh cột</div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {COLUMN_DEFS.filter(c => canViewCost || (c.key !== 'cost' && c.key !== 'profit')).map(c => (
                    <label key={c.key} className="flex items-center gap-2.5 px-3.5 h-9 cursor-pointer hover:bg-gray-50 transition-colors">
                      <input type="checkbox" checked={!!visibleColumns[c.key]}
                        onChange={() => setVisibleColumns(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                        className="w-4 h-4 rounded accent-cblue" />
                      <span className={`text-[14px] flex-1 ${c.hasData ? 'text-gray-900' : 'text-gray-400'}`}>{c.label}</span>
                      {!c.hasData && <span className="text-[12px] text-gray-400">chưa có DL</span>}
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="w-px h-7 bg-gray-200 hidden sm:block" />

        <button onClick={handleExportExcel} title="Xuất Excel"
          className="h-11 flex items-center gap-2 px-3.5 rounded-xl bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] touch-manipulation transition-all duration-200 whitespace-nowrap">
          <Download size={16} strokeWidth={2} className="text-green-700" /><span className="hidden sm:inline">Xuất Excel</span>
        </button>

        <Can permission={PERMISSIONS.INVENTORY_IMPORT}>
          <button onClick={() => importRef.current?.click()} disabled={importing} title="Nhập Excel"
            className="h-11 flex items-center gap-2 px-3.5 rounded-xl bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] touch-manipulation transition-all duration-200 disabled:opacity-50 whitespace-nowrap">
            {importing ? <LoaderCircle size={16} strokeWidth={2} className="animate-spin text-cblue" /> : <Upload size={16} strokeWidth={2} className="text-cblue" />}
            <span className="hidden sm:inline">{importing ? (importProgress || 'Đang nhập…') : 'Nhập Excel'}</span>
          </button>
          <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportExcel} />

          <button onClick={() => setShowImportMethod(true)} title="Nhập kho"
            className="h-11 flex items-center gap-2 px-3.5 rounded-xl bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] touch-manipulation transition-all duration-200 whitespace-nowrap">
            <PackagePlus size={16} strokeWidth={2} /><span className="hidden sm:inline">Nhập kho</span>
          </button>

          <button onClick={() => setShowOcrPurchase(true)} title="Quét mã / HĐ nhập"
            className="h-11 flex items-center gap-2 px-3.5 rounded-xl bg-white border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:border-gray-400 active:scale-[0.98] touch-manipulation transition-all duration-200 whitespace-nowrap">
            <ScanLine size={16} strokeWidth={2} /><span className="hidden sm:inline">Quét mã</span>
          </button>
        </Can>

        <Can permission={PERMISSIONS.INVENTORY_CREATE}>
          <button onClick={() => setIsAddOpen(true)}
            className="h-11 flex items-center gap-2 px-4 rounded-xl bg-cblue text-white text-sm font-semibold hover:brightness-105 active:scale-[0.98] touch-manipulation transition-all duration-200 whitespace-nowrap shadow-sm shadow-blue-500/20 ml-auto lg:ml-0">
            <Plus size={16} strokeWidth={2.4} /><span>Thêm sản phẩm</span>
          </button>
        </Can>
      </div>

      {/* ══════════════════ BULK ACTION BAR — nổi phía trên Table khi có chọn ══════════════════ */}
      {selectedIds.size > 0 && (
        <div className="mb-4 bg-[#0f172a] rounded-2xl shadow-lg px-4 py-3 flex flex-wrap items-center gap-2.5 animate-slideUp">
          <span className="text-sm font-semibold text-white mr-1">Đã chọn {selectedIds.size} sản phẩm</span>
          <div className="w-px h-6 bg-white/15 hidden sm:block" />
          <Can permission={PERMISSIONS.INVENTORY_EXPORT}>
            <button onClick={handleBulkExportExcel} disabled={bulkBusy}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[14px] font-medium transition-colors disabled:opacity-50">
              <Download size={14} strokeWidth={2} /> Xuất Excel
            </button>
          </Can>
          <Can permission={PERMISSIONS.INVENTORY_UPDATE}>
            <button onClick={() => setBulkStockModal(true)} disabled={bulkBusy}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[14px] font-medium transition-colors disabled:opacity-50">
              <Boxes size={14} strokeWidth={2} /> Cập nhật tồn kho
            </button>
            <button onClick={() => setBulkPriceModal(true)} disabled={bulkBusy}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-white text-[14px] font-medium transition-colors disabled:opacity-50">
              <Wallet size={14} strokeWidth={2} /> Cập nhật giá
            </button>
          </Can>
          <Can permission={PERMISSIONS.INVENTORY_DELETE}>
            <button onClick={handleBulkDelete} disabled={bulkBusy}
              className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 text-[14px] font-medium transition-colors disabled:opacity-50">
              {bulkBusy ? <LoaderCircle size={14} strokeWidth={2} className="animate-spin" /> : <Trash2 size={14} strokeWidth={2} />} Xóa
            </button>
          </Can>
          <button onClick={clearSelection}
            className="h-9 flex items-center gap-1.5 px-3 rounded-lg text-white/60 hover:text-white text-[14px] font-medium transition-colors ml-auto">
            <X size={14} strokeWidth={2.2} /> Bỏ chọn
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden text-xs md:text-sm">

        {/* Table header bar */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-cblue/10 text-cblue flex items-center justify-center"><Package size={14} strokeWidth={2} /></span>
            <span className="font-bold text-[16px] text-gray-900">Danh sách hàng hóa</span>
          </div>
          <span className="text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 px-3 py-1 rounded-full">
            {search ? `${displayedProducts.length} / ${products.length} mặt hàng · "${search}"` : `${products.length} mặt hàng`}
          </span>
        </div>

        {loading ? (
          <>
            <div className="sm:hidden flex flex-col gap-2 p-3">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-0">
                <tbody className="divide-y divide-gray-200">
                  <SkeletonTableBody rows={8} columns={5} />
                </tbody>
              </table>
            </div>
          </>
        ) : displayedProducts.length === 0 ? (
          <div className="text-center py-16 text-gray-500 flex flex-col items-center gap-2">
            <PackageSearch size={40} strokeWidth={1.5} className="text-gray-300" />
            <div className="font-semibold text-gray-600">{search ? 'Không tìm thấy kết quả' : 'Chưa có hàng hóa'}</div>
            {!search && (
              <button onClick={() => setIsAddOpen(true)} className="btn-primary mt-2 px-5 py-2 text-sm">
                <Plus size={15} strokeWidth={2.4} /> Thêm hàng đầu tiên
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Mobile: Card list (< sm) — luôn dạng card gọn, không phụ thuộc viewMode ── */}
            <div className="sm:hidden flex flex-col gap-2 p-3">
              {pagedProducts.map(p => {
                const profit = (p.sellPrice || 0) - (p.importPrice || 0)
                const badge  = stockBadge(p.stockQuantity)
                return (
                  <div key={p.id} onClick={() => setEditTarget(p)}
                    className="bg-white border border-gray-200 rounded-xl p-3.5 active:bg-gray-50 cursor-pointer">
                    <div className="flex items-center gap-3 mb-3">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-xl object-cover border border-gray-200 shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 text-gray-400">
                          <ImageOff size={18} strokeWidth={1.6} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                        <div className="text-[12px] text-gray-500 font-mono mt-0.5">{p.sku}</div>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${badge.cls}`}>
                        <badge.icon size={11} strokeWidth={2.4} />{badge.label}
                      </span>
                    </div>
                    <div className={`grid gap-2 text-center mb-3 ${canViewCost ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      {canViewCost && (
                        <div className="bg-gray-50 rounded-lg p-2">
                          <div className="text-[12px] text-gray-500 mb-0.5">Giá vốn</div>
                          <div className="text-xs font-mono tabular-nums text-gray-600">{fmtVND(p.importPrice)}</div>
                        </div>
                      )}
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-[12px] text-gray-500 mb-0.5">Giá bán</div>
                        <div className="text-xs font-mono tabular-nums font-semibold text-gray-900">{fmtVND(p.sellPrice)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-[12px] text-gray-500 mb-0.5">Tồn kho</div>
                        <button onClick={e => { e.stopPropagation(); setStockTarget(p) }}
                          className={`text-xs font-bold font-mono tabular-nums ${p.stockQuantity <= 0 ? 'text-cred' : p.stockQuantity <= 10 ? 'text-cyellow' : 'text-cgreen'}`}>
                          {fmtQty(p.stockQuantity)}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setStockTarget(p)}
                        className="flex-1 h-9 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:border-cyellow hover:text-cyellow active:scale-95 transition-all flex items-center justify-center gap-1.5">
                        <Boxes size={13} strokeWidth={2} /> Kho
                      </button>
                      <Can permission={PERMISSIONS.INVENTORY_UPDATE}>
                        <button onClick={() => setEditTarget(p)}
                          className="flex-1 h-9 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:border-cblue hover:text-cblue active:scale-95 transition-all flex items-center justify-center gap-1.5">
                          <Pencil size={13} strokeWidth={2} /> Sửa
                        </button>
                      </Can>
                      <button onClick={() => setAuditTarget(p)}
                        className="flex-1 h-9 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:border-cpurple hover:text-cpurple active:scale-95 transition-all flex items-center justify-center gap-1.5">
                        <History size={13} strokeWidth={2} /> Lịch sử
                      </button>
                      <Can permission={PERMISSIONS.INVENTORY_DELETE}>
                        <button onClick={() => setDeleteTarget(p)}
                          className="h-9 w-9 rounded-lg border border-gray-200 text-gray-500 hover:border-cred hover:text-cred active:scale-95 transition-all flex items-center justify-center shrink-0">
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </Can>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Desktop — 3 chế độ xem: Table / Compact / Grid ── */}
            <div className="hidden sm:block">
              {viewMode === 'grid' ? (
                /* ═══ GRID ═══ */
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 p-5">
                  {pagedProducts.map(p => {
                    const profit = (p.sellPrice || 0) - (p.importPrice || 0)
                    const badge  = stockBadge(p.stockQuantity)
                    const checked = selectedIds.has(p.id)
                    return (
                      <div key={p.id} onClick={() => setEditTarget(p)}
                        className={`relative flex flex-col text-left rounded-xl border overflow-hidden bg-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                          checked ? 'border-cblue ring-2 ring-cblue/15' : 'border-gray-200 hover:shadow-md'
                        }`}>
                        <div onClick={e => e.stopPropagation()}
                          className="absolute top-2.5 left-2.5 z-10 w-5 h-5 rounded-md bg-white/90 border border-gray-300 flex items-center justify-center">
                          <input type="checkbox" checked={checked} onChange={() => toggleSelectOne(p.id)} className="w-3.5 h-3.5 rounded accent-cblue" />
                        </div>
                        <div className="relative w-full aspect-square bg-gray-50">
                          {p.imageUrl
                            ? <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageOff size={26} strokeWidth={1.5} /></div>}
                        </div>
                        <div className="flex flex-col p-3 gap-1.5">
                          <div className="text-[14px] font-bold text-gray-900 line-clamp-2 leading-snug min-h-[34px]">{p.name}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-500 font-mono truncate">{p.sku}</span>
                          </div>
                          <div className="flex items-end justify-between gap-1 pt-1">
                            <div className="text-[16px] font-bold text-cblue tabular-nums leading-none">{fmtVNDFull(p.sellPrice)}</div>
                            <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-bold ${badge.cls}`}>
                              <badge.icon size={10} strokeWidth={2.6} />{badge.label}
                            </span>
                          </div>
                          <div className={`text-[12px] font-bold tabular-nums ${profit >= 0 ? (profit === 0 ? 'text-gray-500' : 'text-cgreen') : 'text-cred'}`}>
                            LN {fmtVNDFull(profit)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* ═══ TABLE / COMPACT — cùng cấu trúc, khác padding/row-height ═══ */
                <div className="overflow-x-auto">
                  <table className="w-full min-w-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <thead>
                      <tr className="bg-[#f8fafc] border-b border-gray-200">
                        <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 w-10">
                          <input type="checkbox"
                            checked={pagedProducts.length > 0 && pagedProducts.every(p => selectedIds.has(p.id))}
                            onChange={toggleSelectAllOnPage}
                            className="w-4 h-4 rounded accent-cblue" />
                        </th>
                        <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-5 py-3 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap min-w-[220px]">Sản phẩm</th>
                        {visibleColumns.sku && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">SKU</th>}
                        {visibleColumns.category && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Danh mục</th>}
                        {visibleColumns.brand && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Thương hiệu</th>}
                        {visibleColumns.cost && canViewCost && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-right text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Giá vốn</th>}
                        {visibleColumns.price && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-right text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Giá bán</th>}
                        {visibleColumns.profit && canViewCost && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-right text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Lợi nhuận</th>}
                        {visibleColumns.barcode && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Barcode</th>}
                        {visibleColumns.supplier && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Nhà cung cấp</th>}
                        {visibleColumns.unit && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-center text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">ĐVT</th>}
                        {visibleColumns.createdAt && <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Ngày tạo</th>}
                        <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-right text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Tồn kho</th>
                        <th className="sticky top-0 z-10 bg-[#f8fafc] px-4 py-3 text-left text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Trạng thái</th>
                        <th className="sticky top-0 z-10 bg-[#f8fafc] px-3 sm:px-4 py-3 text-center text-[12px] font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pagedProducts.map(p => {
                        const profit  = (p.sellPrice || 0) - (p.importPrice || 0)
                        const margin  = p.importPrice > 0 ? (profit / p.importPrice * 100).toFixed(0) : 0
                        const badge   = stockBadge(p.stockQuantity)
                        const checked = selectedIds.has(p.id)
                        const rowPad  = viewMode === 'compact' ? 'py-1.5' : 'py-3.5'
                        const imgSize = viewMode === 'compact' ? 'w-8 h-8' : 'w-12 h-12'
                        return (
                          <tr key={p.id} onClick={() => setEditTarget(p)}
                            className={`hover:bg-[#f8fafc] transition-colors duration-200 group cursor-pointer ${checked ? 'bg-blue-50/60' : ''}`}>
                            <td className={`px-4 ${rowPad}`} onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={checked} onChange={() => toggleSelectOne(p.id)} className="w-4 h-4 rounded accent-cblue" />
                            </td>
                            <td className={`px-3 sm:px-5 ${rowPad}`}>
                              <div className="flex items-center gap-3">
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt={p.name} className={`${imgSize} rounded-lg object-cover border border-gray-200 shrink-0 transition-all duration-200`} />
                                ) : (
                                  <div className={`${imgSize} rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center shrink-0 text-gray-400 transition-all duration-200`}>
                                    <ImageOff size={viewMode === 'compact' ? 13 : 16} strokeWidth={1.6} />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-gray-900 whitespace-nowrap group-hover:text-cblue transition-colors">{p.name}</div>
                                  {viewMode !== 'compact' && <div className="text-[12px] text-gray-500 font-mono mt-0.5">{p.sku}</div>}
                                </div>
                              </div>
                            </td>
                            {visibleColumns.sku && <td className="px-4 py-3 text-left text-gray-500 font-mono whitespace-nowrap">{p.sku}</td>}
                            {visibleColumns.category && <td className="px-4 py-3"><span title="Chưa có dữ liệu danh mục" className="text-[12px] text-gray-400">—</span></td>}
                            {visibleColumns.brand && <td className="px-4 py-3"><span title="Chưa có dữ liệu thương hiệu" className="text-[12px] text-gray-400">—</span></td>}
                            {visibleColumns.cost && canViewCost && <td className="px-4 py-3 text-right whitespace-nowrap"><Money value={p.importPrice} tone="muted" /></td>}
                            {visibleColumns.price && <td className="px-4 py-3 text-right whitespace-nowrap"><Money value={p.sellPrice} bold /></td>}
                            {visibleColumns.profit && canViewCost && (
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <Money value={profit} bold tone={profit > 0 ? 'success' : profit === 0 ? 'muted' : 'danger'} />
                                {viewMode !== 'compact' && <div className="text-[12px] text-gray-500">{margin}%</div>}
                              </td>
                            )}
                            {visibleColumns.barcode && <td className="px-4 py-3"><span title="Chưa có dữ liệu barcode" className="text-[12px] text-gray-400">—</span></td>}
                            {visibleColumns.supplier && <td className="px-4 py-3"><span title="Chưa có dữ liệu nhà cung cấp" className="text-[12px] text-gray-400">—</span></td>}
                            {visibleColumns.unit && (
                              <td className="px-4 py-3 text-center whitespace-nowrap">
                                {p.unit
                                  ? <span className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-600">{p.unit}</span>
                                  : <span className="text-gray-400 text-[12px]">—</span>}
                              </td>
                            )}
                            {visibleColumns.createdAt && (
                              <td className="px-4 py-3 text-left whitespace-nowrap text-gray-500 text-[12px]">
                                {p.createdAt ? new Date(p.createdAt).toLocaleDateString('vi-VN') : '—'}
                              </td>
                            )}
                            <td className={`px-3 sm:px-4 ${rowPad} text-right whitespace-nowrap`} onClick={e => e.stopPropagation()}>
                              <button onClick={() => setStockTarget(p)} title="Điều chỉnh tồn kho"
                                className={`tabular-nums font-bold font-mono transition-colors hover:opacity-75 ${p.stockQuantity <= 0 ? 'text-cred' : p.stockQuantity <= 10 ? 'text-cyellow' : 'text-gray-900'}`}>
                                {fmtQty(p.stockQuantity)}
                              </button>
                            </td>
                            <td className={`px-4 ${rowPad}`}>
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${badge.cls}`}>
                                <badge.icon size={11} strokeWidth={2.4} />{badge.label}
                              </span>
                            </td>
                            <td className={`px-3 sm:px-4 ${rowPad} text-center`} onClick={e => e.stopPropagation()}>
                              <button
                                title="Thao tác"
                                onClick={e => {
                                  const r = e.currentTarget.getBoundingClientRect()
                                  setRowMenu({ p, top: r.bottom + 4, left: Math.max(8, r.right - 184) })
                                }}
                                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-center mx-auto"
                              >
                                <MoreVertical size={16} strokeWidth={2} />
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
          </>
        )}

        {/* Pagination */}
        {!loading && displayedProducts.length > 0 && (
          <div className="px-5 py-3.5 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-gray-500 order-2 sm:order-1">
              Hiển thị <span className="font-semibold text-gray-900 tabular-nums">{pageStart}-{pageEnd}</span> / {displayedProducts.length} sản phẩm
            </div>
            <div className="flex items-center gap-1 order-1 sm:order-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center">
                <ChevronLeft size={15} strokeWidth={2.2} />
              </button>
              {pageList(page, totalPages).map((n, i) => n === '…'
                ? <span key={'e' + i} className="w-8 h-8 flex items-center justify-center text-gray-500 text-xs">…</span>
                : <button key={n} onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors flex items-center justify-center ${
                      n === page ? 'bg-cblue text-white shadow-sm' : 'border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}>{n}</button>
              )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center">
                <ChevronRight size={15} strokeWidth={2.2} />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 order-3">
              Hiển thị
              <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}
                className="bg-white border border-gray-200 rounded-lg pl-2 pr-1 py-1 text-gray-900 font-semibold outline-none focus:border-cblue cursor-pointer">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              sản phẩm / trang
            </div>
          </div>
        )}
      </div>

      {/* Bulk: cập nhật tồn kho hàng loạt */}
      {bulkStockModal && (
        <BulkStockModal count={selectedProducts.length} busy={bulkBusy} onClose={() => setBulkStockModal(false)} onApply={handleBulkStockUpdate} />
      )}
      {/* Bulk: cập nhật giá bán hàng loạt (theo %) */}
      {bulkPriceModal && (
        <BulkPriceModal count={selectedProducts.length} busy={bulkBusy} onClose={() => setBulkPriceModal(false)} onApply={handleBulkPriceUpdate} />
      )}

      {/* Row action menu (kebab) */}
      {rowMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setRowMenu(null)} />
          <div className="fixed z-50 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1"
            style={{ top: rowMenu.top, left: rowMenu.left }}>
            <Can permission={PERMISSIONS.INVENTORY_UPDATE}>
              <button onClick={() => { setEditTarget(rowMenu.p); setRowMenu(null) }}
                className="w-full text-left px-3.5 h-9 text-[14px] font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2.5"><Pencil size={14} strokeWidth={2} className="text-gray-500" /> Sửa thông tin</button>
              <button onClick={() => { setStockTarget(rowMenu.p); setRowMenu(null) }}
                className="w-full text-left px-3.5 h-9 text-[14px] font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2.5"><Boxes size={14} strokeWidth={2} className="text-gray-500" /> Điều chỉnh kho</button>
            </Can>
            <button onClick={() => { setAuditTarget(rowMenu.p); setRowMenu(null) }}
              className="w-full text-left px-3.5 h-9 text-[14px] font-medium text-gray-900 hover:bg-gray-50 transition-colors flex items-center gap-2.5"><History size={14} strokeWidth={2} className="text-gray-500" /> Xem lịch sử</button>
            <Can permission={PERMISSIONS.INVENTORY_DELETE}>
              <div className="h-px bg-gray-200 my-1" />
              <button onClick={() => { setDeleteTarget(rowMenu.p); setRowMenu(null) }}
                className="w-full text-left px-3.5 h-9 text-[14px] font-semibold text-cred hover:bg-red-50 transition-colors flex items-center gap-2.5"><Trash2 size={14} strokeWidth={2} /> Xoá sản phẩm</button>
            </Can>
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
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-xl bg-red-50 text-cred flex items-center justify-center shrink-0"><Trash2 size={18} strokeWidth={2} /></span>
              <div className="text-lg font-bold text-cred">Xoá hàng hóa?</div>
            </div>
            <div className="text-sm text-muted">
              <span className="font-semibold text-gray-900">[{deleteTarget.sku}] {deleteTarget.name}</span><br/>
              Hành động này không thể hoàn tác. Các đơn hàng đã có sẽ không bị ảnh hưởng.
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
              <button onClick={handleDelete} disabled={deleting} className="btn-danger px-5 py-2 text-sm disabled:opacity-60">
                {deleting ? <><LoaderCircle size={15} strokeWidth={2.2} className="animate-spin" /> Đang xoá…</> : <><Trash2 size={15} strokeWidth={2} /> Xoá</>}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
      </div>
    </div>
  )
}
