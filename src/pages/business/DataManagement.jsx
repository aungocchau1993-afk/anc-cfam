import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { getShopConfig, saveShopConfig } from '../../lib/dataService'
import PageHeader from '../../components/ui/PageHeader'
import {
  Trash2, Store, ShoppingCart, Package, Users, Building2,
  Archive, Wallet, Tag, AlertTriangle, X, Check, Loader2, Lock,
} from 'lucide-react'

// ── Shop Info Form ─────────────────────────────────────────────────────────

function ShopInfoForm() {
  const [name,    setName]    = useState('')
  const [address, setAddress] = useState('')
  const [phone,   setPhone]   = useState('')
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getShopConfig().then(cfg => {
      setName(cfg.name || '')
      setAddress(cfg.address || '')
      setPhone(cfg.phone || '')
    }).finally(() => setLoading(false))
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Vui lòng nhập tên cửa hàng'); return }
    setSaving(true)
    try {
      await saveShopConfig({ name: name.trim(), address: address.trim(), phone: phone.trim() })
      toast.success('✅ Đã lưu thông tin cửa hàng lên Supabase')
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  const iCls = 'input-base'

  return (
    <form onSubmit={handleSave} className="mb-8 rounded-2xl border border-cblue/25 bg-cblue/5 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cblue/15">
        <span className="w-9 h-9 rounded-xl bg-blue-50 text-cblue flex items-center justify-center shrink-0"><Store size={18} /></span>
        <div>
          <div className="font-black text-sm text-text">Thông tin cửa hàng</div>
          <div className="text-[12px] text-muted mt-0.5">Hiển thị trên tất cả hóa đơn & phiếu nhập</div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Tên cửa hàng *</label>
          <input className={iCls} placeholder="Cửa Hàng ABC" value={name} onChange={e => setName(e.target.value)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Địa chỉ</label>
          <input className={iCls} placeholder="123 Nguyễn Văn A, Q.1, TP.HCM" value={address} onChange={e => setAddress(e.target.value)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[12px] text-muted font-semibold uppercase tracking-wider">Số điện thoại</label>
          <input className={iCls} placeholder="0901 234 567" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" disabled={loading} />
        </div>
      </div>

      <div className="px-5 pb-4 flex items-center justify-between gap-4">
        <div className="text-[12px] text-muted">
          Lưu trên Supabase — đồng bộ theo tài khoản, mọi thiết bị
        </div>
        <button type="submit" disabled={saving || loading} className="btn-primary whitespace-nowrap">
          {saving ? <><Loader2 size={16} className="animate-spin" /> Đang lưu…</> : 'Lưu thông tin'}
        </button>
      </div>
    </form>
  )
}

// ── Định nghĩa các module dữ liệu ────────────────────────────────────────

const MODULES = [
  {
    id:    'sales',
    icon:  ShoppingCart,
    label: 'Bán Hàng / POS',
    desc:  'Toàn bộ đơn xuất hàng, order_items, reset chi tiêu & nợ khách hàng',
    color: 'emerald',
    tables: ['orders (type=export)', 'order_items', 'customers.total_spent / current_debt / reward_points'],
  },
  {
    id:    'imports',
    icon:  Package,
    label: 'Nhập Kho',
    desc:  'Toàn bộ đơn nhập hàng, order_items, reset công nợ nhà cung cấp',
    color: 'yellow',
    tables: ['orders (type=import)', 'order_items', 'suppliers.debt'],
  },
  {
    id:    'customers',
    icon:  Users,
    label: 'Khách Hàng',
    desc:  'Toàn bộ hồ sơ khách hàng, điểm thưởng, lịch sử mua',
    color: 'purple',
    tables: ['customers', 'reward_history'],
  },
  {
    id:    'suppliers',
    icon:  Building2,
    label: 'Nhà Cung Cấp',
    desc:  'Toàn bộ danh sách nhà cung cấp và công nợ',
    color: 'teal',
    tables: ['suppliers'],
  },
  {
    id:    'stock',
    icon:  Archive,
    label: 'Tồn Kho',
    desc:  'Reset số lượng tồn kho về 0, xóa toàn bộ phiếu kiểm kho',
    color: 'amber',
    tables: ['products.stock_quantity → 0', 'stocktakes', 'stocktake_items'],
  },
  {
    id:    'cashbook',
    icon:  Wallet,
    label: 'Sổ Quỹ',
    desc:  'Toàn bộ giao dịch thu chi thủ công',
    color: 'blue',
    tables: ['cashbook_transactions'],
  },
  {
    id:    'products',
    icon:  Tag,
    label: 'Hàng Hóa',
    desc:  'Xóa toàn bộ sản phẩm khỏi hệ thống (SKU, giá, ảnh, tồn kho)',
    color: 'orange',
    tables: ['products', 'order_items (product_id → null)'],
  },
]

const COLOR_MAP = {
  emerald: { border: 'border-emerald-300', bg: 'bg-emerald-50', check: 'accent-emerald-500', tag: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  yellow:  { border: 'border-yellow-300',  bg: 'bg-yellow-50',  check: 'accent-yellow-500',  tag: 'bg-yellow-100  text-yellow-700  border-yellow-200' },
  purple:  { border: 'border-purple-300',  bg: 'bg-purple-50',  check: 'accent-purple-500',  tag: 'bg-purple-100  text-purple-700  border-purple-200' },
  teal:    { border: 'border-teal-300',    bg: 'bg-teal-50',    check: 'accent-teal-500',    tag: 'bg-teal-100    text-teal-700    border-teal-200' },
  amber:   { border: 'border-amber-300',   bg: 'bg-amber-50',   check: 'accent-amber-500',   tag: 'bg-amber-100   text-amber-700   border-amber-200' },
  blue:    { border: 'border-blue-300',    bg: 'bg-blue-50',    check: 'accent-blue-500',    tag: 'bg-blue-100    text-blue-700    border-blue-200' },
  orange:  { border: 'border-orange-300',  bg: 'bg-orange-50',  check: 'accent-orange-500',  tag: 'bg-orange-100  text-orange-700  border-orange-200' },
}

// ── Hàm xóa dữ liệu Supabase ─────────────────────────────────────────────

async function deleteSalesData() {
  if (!supabase) return
  // Xóa order_items của đơn xuất trước
  const { data: exportOrders } = await supabase
    .from('orders').select('id').eq('type', 'export')
  if (exportOrders?.length) {
    const ids = exportOrders.map(o => o.id)
    await supabase.from('order_items').delete().in('order_id', ids)
  }
  // Xóa đơn xuất
  await supabase.from('orders').delete().eq('type', 'export')
  // Reset customer stats
  await supabase.from('customers').update({
    total_spent:   0,
    current_debt:  0,
    reward_points: 0,
    vip_tier:      'MEMBER',
  }).gte('total_spent', 0)
}

async function deleteImportData() {
  if (!supabase) return
  // Xóa order_items của đơn nhập trước
  const { data: importOrders } = await supabase
    .from('orders').select('id').eq('type', 'import')
  if (importOrders?.length) {
    const ids = importOrders.map(o => o.id)
    await supabase.from('order_items').delete().in('order_id', ids)
  }
  // Xóa đơn nhập
  await supabase.from('orders').delete().eq('type', 'import')
  // Reset supplier debt
  await supabase.from('suppliers').update({ debt: 0 }).gte('debt', -999_999_999_999)
}

async function deleteCustomersData() {
  if (!supabase) return
  await supabase.from('reward_history').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

async function deleteSuppliersData() {
  if (!supabase) return
  await supabase.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

async function deleteStockData() {
  if (!supabase) return
  // Reset tồn kho về 0
  await supabase.from('products').update({ stock_quantity: 0 }).gte('stock_quantity', 0)
  // Xóa stocktake_items trước
  await supabase.from('stocktake_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  // Xóa stocktakes
  await supabase.from('stocktakes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

async function deleteCashbookData() {
  if (!supabase) return
  await supabase.from('cashbook_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

async function deleteProductsData() {
  if (!supabase) return
  // Xóa toàn bộ sản phẩm (order_items.product_id sẽ thành null nhờ ON DELETE SET NULL)
  await supabase.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000')
}

const DELETE_FN = {
  sales:     deleteSalesData,
  imports:   deleteImportData,
  customers: deleteCustomersData,
  suppliers: deleteSuppliersData,
  stock:     deleteStockData,
  cashbook:  deleteCashbookData,
  products:  deleteProductsData,
}

// ── Confirm Modal ─────────────────────────────────────────────────────────

function ConfirmModal({ selected, onYes, onNo, loading }) {
  const modules = MODULES.filter(m => selected.includes(m.id))
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border-2 border-cred/50 rounded-2xl w-full max-w-md shadow-2xl shadow-cred/10 overflow-hidden">

        {/* Header */}
        <div className="bg-rose-50 px-6 pt-6 pb-4 border-b border-cred/20 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cred/15 border border-cred/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} className="text-cred" />
          </div>
          <div>
            <div className="font-black text-lg text-cred">Xác nhận xóa dữ liệu</div>
            <div className="text-xs text-muted mt-1 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn dữ liệu của các mục đã chọn?
              <br/>
              <strong className="text-cred">Hành động này không thể hoàn tác!</strong>
            </div>
          </div>
        </div>

        {/* Danh sách sẽ bị xóa */}
        <div className="px-6 py-4 flex flex-col gap-2">
          <div className="text-[12px] text-muted font-semibold uppercase tracking-wider mb-1">
            Các module sẽ bị xóa:
          </div>
          {modules.map(m => {
            const Icon = m.icon
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-lg bg-rose-50 border border-cred/20 px-3 py-2.5">
                <Icon size={18} className="text-cred shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-text">{m.label}</div>
                  <div className="text-[12px] text-muted truncate">{m.desc}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onNo}
            disabled={loading}
            className="btn-ghost flex-1"
          >
            <X size={16} /> Không, giữ lại
          </button>
          <button
            onClick={onYes}
            disabled={loading}
            className="btn-danger flex-1"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Đang xóa…
              </>
            ) : <><Trash2 size={16} /> Có, xóa vĩnh viễn</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────

export default function DataManagement() {
  const [selected,  setSelected]  = useState([])
  const [showModal, setShowModal] = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [done,      setDone]      = useState([])   // modules vừa xóa xong

  function toggle(id) {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function toggleAll() {
    setSelected(prev =>
      prev.length === MODULES.length ? [] : MODULES.map(m => m.id)
    )
  }

  async function handleDelete() {
    setLoading(true)
    const errors = []
    const completed = []

    for (const id of selected) {
      try {
        await DELETE_FN[id]()
        completed.push(id)
      } catch (e) {
        errors.push(`${MODULES.find(m => m.id === id)?.label}: ${e.message}`)
      }
    }

    setLoading(false)
    setShowModal(false)
    setDone(completed)
    setSelected([])

    if (errors.length === 0) {
      toast.success(`✅ Dữ liệu đã được làm sạch (${completed.length} module)`, { duration: 4000 })
      // Reload sau 1.5s để reset toàn bộ state
      setTimeout(() => window.location.reload(), 1500)
    } else {
      toast.error(`Lỗi: ${errors.join('; ')}`, { duration: 6000 })
      if (completed.length > 0) {
        toast.success(`Đã xóa thành công ${completed.length} module`, { duration: 4000 })
      }
    }
  }

  const allChecked = selected.length === MODULES.length
  const hasSelected = selected.length > 0

  return (
    <div className="w-full">
      <PageHeader icon={Trash2} title="Xóa Dữ Liệu" subtitle="Quản trị & dọn dẹp dữ liệu hệ thống" color="rose" />
    <div className="p-4 sm:p-6 max-w-3xl">

      {/* Thông tin cửa hàng */}
      <ShopInfoForm />

      {/* Header */}
      <div className="flex items-start gap-3 mb-6 rounded-2xl border border-cred/25 bg-rose-50 px-5 py-4">
        <AlertTriangle size={22} className="text-cred shrink-0 mt-0.5" />
        <div>
          <h2 className="text-base font-black text-text">Quản Trị Dữ Liệu</h2>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            Xóa dữ liệu theo từng module. Chỉ những mục được chọn mới bị xóa.
            <br/>
            <span className="text-cred font-semibold">Thao tác không thể hoàn tác — hãy cân nhắc kỹ trước khi thực hiện.</span>
          </p>
        </div>
      </div>

      {/* Select all */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center gap-2.5 cursor-pointer select-none group">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="w-4 h-4 rounded accent-cred cursor-pointer"
          />
          <span className="text-sm font-semibold text-muted group-hover:text-text transition-colors">
            {allChecked ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
          </span>
        </label>
        {hasSelected && (
          <span className="text-xs text-cred font-bold bg-cred/10 border border-cred/25 rounded-full px-3 py-1">
            {selected.length} / {MODULES.length} module được chọn
          </span>
        )}
      </div>

      {/* Module list */}
      <div className="flex flex-col gap-3 mb-8">
        {MODULES.map(m => {
          const isChecked = selected.includes(m.id)
          const isDone    = done.includes(m.id)
          const colors    = COLOR_MAP[m.color]
          const Icon      = m.icon

          return (
            <label
              key={m.id}
              className={`
                flex items-start gap-4 rounded-2xl border p-4 cursor-pointer
                transition-all duration-150 select-none
                ${isChecked
                  ? `${colors.border} ${colors.bg} ring-1 ring-cred/20`
                  : 'border-border bg-surface hover:border-gray-300 hover:bg-surface2'
                }
                ${isDone ? 'opacity-40 pointer-events-none' : ''}
              `}
            >
              {/* Checkbox */}
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(m.id)}
                className={`w-5 h-5 rounded mt-0.5 cursor-pointer shrink-0 ${colors.check}`}
              />

              {/* Icon */}
              <span className="shrink-0 mt-0.5 text-muted"><Icon size={22} /></span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold text-sm ${isChecked ? 'text-text' : 'text-muted'}`}>
                    {m.label}
                  </span>
                  {isDone && (
                    <span className="text-[12px] font-black text-cgreen bg-cgreen/15 border border-cgreen/30 rounded-full px-2 py-0.5 flex items-center gap-1">
                      <Check size={10} /> Đã xóa
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">{m.desc}</p>
                {/* Tables — chỉ hiện khi đã tick */}
                {isChecked && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.tables.map(t => (
                      <span key={t} className={`text-[12px] font-mono font-semibold border rounded px-1.5 py-0.5 ${colors.tag}`}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger indicator khi checked */}
              {isChecked && (
                <div className="w-2 h-2 rounded-full bg-cred shrink-0 mt-2 animate-pulse" />
              )}
            </label>
          )
        })}
      </div>

      {/* Footer action */}
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface2 px-5 py-4">
        <div className="text-sm text-muted">
          {hasSelected
            ? <><span className="font-bold text-cred">{selected.length} module</span> sẽ bị xóa vĩnh viễn</>
            : 'Chưa chọn module nào'
          }
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!hasSelected || loading}
          className={hasSelected ? 'btn-danger' : 'h-11 px-6 rounded-xl text-sm font-black bg-surface2 border border-border text-subtle cursor-not-allowed flex items-center gap-2'}
        >
          <Trash2 size={16} />
          Xóa dữ liệu đã chọn
        </button>
      </div>

      {/* Warning box */}
      <div className="mt-4 rounded-xl border border-border bg-surface2 px-4 py-3 flex items-start gap-3">
        <Lock size={16} className="text-muted shrink-0 mt-0.5" />
        <div className="text-xs text-muted leading-relaxed">
          <strong className="text-text">Bảo mật:</strong> Chỉ những module được tick mới bị xóa. Các dữ liệu khác (cấu hình, giả định tài chính, danh mục thu nhập) hoàn toàn được giữ nguyên. Nên xuất Excel backup trước khi thực hiện.
        </div>
      </div>

      {/* Confirm Modal */}
      {showModal && (
        <ConfirmModal
          selected={selected}
          loading={loading}
          onNo={() => setShowModal(false)}
          onYes={handleDelete}
        />
      )}
    </div>
    </div>
  )
}
