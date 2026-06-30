import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { getShopConfig, saveShopConfig } from '../../lib/dataService'

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

  const iCls = 'w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-base text-[#1e293b] placeholder:text-slate-500 outline-none focus:border-cblue focus:ring-1 focus:ring-cblue/20 transition-all min-h-[52px] rounded-xl'

  return (
    <form onSubmit={handleSave} className="mb-8 rounded-2xl border border-cblue/25 bg-cblue/5 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-cblue/15">
        <span className="text-xl">🏪</span>
        <div>
          <div className="font-black text-sm text-[#1e293b]">Thông tin cửa hàng</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Hiển thị trên tất cả hóa đơn & phiếu nhập</div>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Tên cửa hàng *</label>
          <input className={iCls} placeholder="Cửa Hàng ABC" value={name} onChange={e => setName(e.target.value)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Địa chỉ</label>
          <input className={iCls} placeholder="123 Nguyễn Văn A, Q.1, TP.HCM" value={address} onChange={e => setAddress(e.target.value)} disabled={loading} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Số điện thoại</label>
          <input className={iCls} placeholder="0901 234 567" value={phone} onChange={e => setPhone(e.target.value)} inputMode="tel" disabled={loading} />
        </div>
      </div>

      <div className="px-5 pb-4 flex items-center justify-between gap-4">
        <div className="text-[11px] text-slate-500">
          ☁️ Lưu trên Supabase — đồng bộ theo tài khoản, mọi thiết bị
        </div>
        <button type="submit" disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cblue hover:brightness-110 text-white text-sm font-bold transition-all shadow-lg shadow-cblue/20 whitespace-nowrap disabled:opacity-60">
          {saving ? '⏳ Đang lưu…' : '💾 Lưu thông tin'}
        </button>
      </div>
    </form>
  )
}

// ── Định nghĩa các module dữ liệu ────────────────────────────────────────

const MODULES = [
  {
    id:    'sales',
    icon:  '🛒',
    label: 'Bán Hàng / POS',
    desc:  'Toàn bộ đơn xuất hàng, order_items, reset chi tiêu & nợ khách hàng',
    color: 'emerald',
    tables: ['orders (type=export)', 'order_items', 'customers.total_spent / current_debt / reward_points'],
  },
  {
    id:    'imports',
    icon:  '📦',
    label: 'Nhập Kho',
    desc:  'Toàn bộ đơn nhập hàng, order_items, reset công nợ nhà cung cấp',
    color: 'yellow',
    tables: ['orders (type=import)', 'order_items', 'suppliers.debt'],
  },
  {
    id:    'customers',
    icon:  '👥',
    label: 'Khách Hàng',
    desc:  'Toàn bộ hồ sơ khách hàng, điểm thưởng, lịch sử mua',
    color: 'purple',
    tables: ['customers', 'reward_history'],
  },
  {
    id:    'suppliers',
    icon:  '🏢',
    label: 'Nhà Cung Cấp',
    desc:  'Toàn bộ danh sách nhà cung cấp và công nợ',
    color: 'teal',
    tables: ['suppliers'],
  },
  {
    id:    'stock',
    icon:  '🗂️',
    label: 'Tồn Kho',
    desc:  'Reset số lượng tồn kho về 0, xóa toàn bộ phiếu kiểm kho',
    color: 'amber',
    tables: ['products.stock_quantity → 0', 'stocktakes', 'stocktake_items'],
  },
  {
    id:    'cashbook',
    icon:  '💵',
    label: 'Sổ Quỹ',
    desc:  'Toàn bộ giao dịch thu chi thủ công',
    color: 'blue',
    tables: ['cashbook_transactions'],
  },
  {
    id:    'products',
    icon:  '🏷️',
    label: 'Hàng Hóa',
    desc:  'Xóa toàn bộ sản phẩm khỏi hệ thống (SKU, giá, ảnh, tồn kho)',
    color: 'orange',
    tables: ['products', 'order_items (product_id → null)'],
  },
]

const COLOR_MAP = {
  emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-500/8',  check: 'accent-emerald-500', tag: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  yellow:  { border: 'border-yellow-500/30',  bg: 'bg-yellow-500/8',   check: 'accent-yellow-400',  tag: 'bg-yellow-500/15  text-yellow-400  border-yellow-500/30' },
  purple:  { border: 'border-purple-500/30',  bg: 'bg-purple-500/8',   check: 'accent-purple-400',  tag: 'bg-purple-500/15  text-purple-400  border-purple-500/30' },
  teal:    { border: 'border-teal-500/30',    bg: 'bg-teal-500/8',     check: 'accent-teal-400',    tag: 'bg-teal-500/15    text-teal-400    border-teal-500/30' },
  amber:   { border: 'border-amber-500/30',   bg: 'bg-amber-500/8',    check: 'accent-amber-400',   tag: 'bg-amber-500/15   text-amber-400   border-amber-500/30' },
  blue:    { border: 'border-blue-500/30',    bg: 'bg-blue-500/8',     check: 'accent-blue-400',    tag: 'bg-blue-500/15    text-blue-400    border-blue-500/30' },
  orange:  { border: 'border-orange-500/30',  bg: 'bg-orange-500/8',   check: 'accent-orange-400',  tag: 'bg-orange-500/15  text-orange-400  border-orange-500/30' },
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#ffffff] border border-cred/40 rounded-2xl w-full max-w-md shadow-2xl shadow-cred/10 overflow-hidden">

        {/* Header */}
        <div className="bg-cred/10 px-6 pt-6 pb-4 border-b border-cred/20 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-cred/20 border border-cred/30 flex items-center justify-center text-2xl shrink-0">
            ⚠️
          </div>
          <div>
            <div className="font-black text-lg text-cred">Xác nhận xóa dữ liệu</div>
            <div className="text-xs text-slate-400 mt-1 leading-relaxed">
              Bạn có chắc chắn muốn xóa vĩnh viễn dữ liệu của các mục đã chọn?
              <br/>
              <strong className="text-cred">Hành động này không thể hoàn tác!</strong>
            </div>
          </div>
        </div>

        {/* Danh sách sẽ bị xóa */}
        <div className="px-6 py-4 flex flex-col gap-2">
          <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-1">
            Các module sẽ bị xóa:
          </div>
          {modules.map(m => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg bg-cred/8 border border-cred/20 px-3 py-2.5">
              <span className="text-lg shrink-0">{m.icon}</span>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#1e293b]">{m.label}</div>
                <div className="text-[11px] text-slate-500 truncate">{m.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onNo}
            disabled={loading}
            className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 text-sm font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            ✗ Không, giữ lại
          </button>
          <button
            onClick={onYes}
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-cred hover:brightness-110 text-white text-sm font-black transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-cred/25"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10"/>
                </svg>
                Đang xóa…
              </>
            ) : '🗑️ Có, xóa vĩnh viễn'}
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
    <div className="p-6 max-w-3xl">

      {/* Thông tin cửa hàng */}
      <ShopInfoForm />

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-cred/15 border border-cred/30 flex items-center justify-center text-2xl shrink-0">
          🗑️
        </div>
        <div>
          <h2 className="text-xl font-black text-[#1e293b]">Quản Trị Dữ Liệu</h2>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">
            Xóa dữ liệu theo từng module. Chỉ những mục được chọn mới bị xóa.
            <br/>
            <span className="text-cred font-semibold">⚠️ Thao tác không thể hoàn tác — hãy cân nhắc kỹ trước khi thực hiện.</span>
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
          <span className="text-sm font-semibold text-slate-300 group-hover:text-[#1e293b] transition-colors">
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

          return (
            <label
              key={m.id}
              className={`
                flex items-start gap-4 rounded-2xl border p-4 cursor-pointer
                transition-all duration-150 select-none
                ${isChecked
                  ? `${colors.border} ${colors.bg} ring-1 ring-cred/20`
                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/40'
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
              <span className="text-2xl leading-none shrink-0 mt-0.5">{m.icon}</span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-bold text-sm ${isChecked ? 'text-[#1e293b]' : 'text-slate-300'}`}>
                    {m.label}
                  </span>
                  {isDone && (
                    <span className="text-[10px] font-black text-cgreen bg-cgreen/15 border border-cgreen/30 rounded-full px-2 py-0.5">
                      ✓ Đã xóa
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{m.desc}</p>
                {/* Tables — chỉ hiện khi đã tick */}
                {isChecked && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.tables.map(t => (
                      <span key={t} className={`text-[10px] font-mono font-semibold border rounded px-1.5 py-0.5 ${colors.tag}`}>
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
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <div className="text-sm text-slate-400">
          {hasSelected
            ? <><span className="font-bold text-cred">{selected.length} module</span> sẽ bị xóa vĩnh viễn</>
            : 'Chưa chọn module nào'
          }
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={!hasSelected || loading}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black transition-all
            ${hasSelected
              ? 'bg-cred hover:brightness-110 text-white shadow-lg shadow-cred/25 active:scale-[0.97]'
              : 'bg-slate-800 border border-slate-700 text-slate-600 cursor-not-allowed'
            }
          `}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <path d="M9 3h6m-8 5h10m-9 0l.6 12h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Xóa dữ liệu đã chọn
        </button>
      </div>

      {/* Warning box */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-3 flex items-start gap-3">
        <span className="text-base shrink-0 mt-0.5">🔒</span>
        <div className="text-xs text-slate-500 leading-relaxed">
          <strong className="text-slate-400">Bảo mật:</strong> Chỉ những module được tick mới bị xóa. Các dữ liệu khác (cấu hình, giả định tài chính, danh mục thu nhập) hoàn toàn được giữ nguyên. Nên xuất Excel backup trước khi thực hiện.
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
  )
}
