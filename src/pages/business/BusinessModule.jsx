import { useState } from 'react'
import AnalyticsDashboard from './AnalyticsDashboard'
import PointOfSale        from './PointOfSale'
import Products           from './Products'
import Customers          from './Customers'
import Suppliers          from './Suppliers'
import Orders             from './Orders'
import Cashbook           from './Cashbook'
import Stocktake          from './Stocktake'
import ProfitReport       from './ProfitReport'
import DataManagement    from './DataManagement'

// ── Tab definitions (thứ tự hợp lý theo workflow bán lẻ) ──────────────────

const TABS = [
  {
    id: 'analytics', icon: '📊', label: 'Dashboard',    sub: 'KPI',
    color: 'text-violet-400', activeBorder: 'border-violet-500', activeBg: 'bg-violet-500/10',
  },
  {
    id: 'pos',       icon: '🛒', label: 'Bán Hàng',     sub: 'POS',
    color: 'text-emerald-400', activeBorder: 'border-emerald-500', activeBg: 'bg-emerald-500/10',
  },
  {
    id: 'products',  icon: '📦', label: 'Hàng Hóa',     sub: 'Kho',
    color: 'text-blue-400', activeBorder: 'border-blue-500', activeBg: 'bg-blue-500/10',
  },
  {
    id: 'customers', icon: '👥', label: 'Khách Hàng',   sub: 'CRM',
    color: 'text-purple-400', activeBorder: 'border-purple-500', activeBg: 'bg-purple-500/10',
  },
  {
    id: 'cashbook',  icon: '💵', label: 'Sổ Quỹ',       sub: 'CASH',
    color: 'text-emerald-400', activeBorder: 'border-emerald-500', activeBg: 'bg-emerald-500/10',
  },
  {
    id: 'orders',    icon: '🧾', label: 'Đơn Hàng',     sub: 'ĐH',
    color: 'text-sky-400', activeBorder: 'border-sky-500', activeBg: 'bg-sky-500/10',
  },
  {
    id: 'suppliers', icon: '🏢', label: 'Nhà Cung Cấp', sub: 'NCC',
    color: 'text-teal-400', activeBorder: 'border-teal-500', activeBg: 'bg-teal-500/10',
  },
  {
    id: 'stocktake', icon: '🗂️',  label: 'Kiểm Kho',    sub: 'INV',
    color: 'text-amber-400', activeBorder: 'border-amber-500', activeBg: 'bg-amber-500/10',
  },
  {
    id: 'report',    icon: '📈', label: 'Báo Cáo',       sub: 'P&L',
    color: 'text-yellow-400', activeBorder: 'border-yellow-500', activeBg: 'bg-yellow-500/10',
  },
  {
    id: 'admin',     icon: '🗑️', label: 'Xóa Dữ Liệu',  sub: 'ADM',
    color: 'text-red-400', activeBorder: 'border-red-500', activeBg: 'bg-red-500/10',
  },
]

const PAGES = {
  analytics: <AnalyticsDashboard />,
  pos:       <PointOfSale />,
  products:  <Products />,
  customers: <Customers />,
  cashbook:  <Cashbook />,
  orders:    <Orders />,
  suppliers: <Suppliers />,
  stocktake: <Stocktake />,
  report:    <ProfitReport />,
  admin:     <DataManagement />,
}

// ── Component ──────────────────────────────────────────────────────────────

export default function BusinessModule({ activeTab: propTab, onTabChange }) {
  // Dùng internal state nếu không có prop, ngược lại dùng prop (controlled từ Sidebar)
  const [internalTab, setInternalTab] = useState(propTab ?? 'analytics')
  const activeTab = propTab ?? internalTab

  function setActiveTab(tab) {
    if (onTabChange) onTabChange(tab)
    else setInternalTab(tab)
  }

  const current = TABS.find(t => t.id === activeTab)

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-[#080b10]">

      {/* ── Breadcrumb nhỏ gọn ───────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-2 flex items-center gap-1.5 text-[11px] text-slate-600 border-b border-slate-800/60">
        <span className="text-slate-700">🏪</span>
        <span className="text-slate-700">Kinh Doanh</span>
        <span className="text-slate-800">›</span>
        <span className={`font-semibold ${current?.color ?? 'text-slate-400'}`}>
          {current?.icon} {current?.label}
        </span>
        <span className="ml-auto text-[10px] font-black text-slate-800 uppercase tracking-widest">
          Business OS v4
        </span>
      </div>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div className="flex-1">
        {PAGES[activeTab]}
      </div>

    </div>
  )
}
