import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, ShoppingCart, Package, Users, Wallet, Receipt,
  Truck, ClipboardList, LineChart, UserCog, History, Globe, Settings,
  Trash2, Store, ChevronRight, Search, Check, ArrowUp, RefreshCw, ShieldCheck,
} from 'lucide-react'
import { showTechInfo } from '../../lib/env'
import AppRoute from '../../components/permission/AppRoute'
import { getRoutePermission } from '../../lib/permissions/routePermissions'
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
import ShopSettings      from './ShopSettings'
import ActivityLog       from './ActivityLog'
import HRM              from './HRM'
import ChannelOverview  from './ChannelOverview'
import UserManagement   from './UserManagement'

// ── Tab definitions (thứ tự hợp lý theo workflow bán lẻ) ──────────────────

const TABS = [
  { id: 'analytics',   icon: LayoutDashboard, label: 'Dashboard',    sub: 'KPI',  color: 'text-cpurple' },
  { id: 'pos',         icon: ShoppingCart,    label: 'Bán Hàng',     sub: 'POS',  color: 'text-cgreen' },
  { id: 'products',    icon: Package,         label: 'Hàng Hóa',     sub: 'Kho',  color: 'text-cblue' },
  { id: 'customers',   icon: Users,           label: 'Khách Hàng',   sub: 'CRM',  color: 'text-cpurple' },
  { id: 'cashbook',    icon: Wallet,          label: 'Sổ Quỹ',       sub: 'CASH', color: 'text-cgreen' },
  { id: 'orders',      icon: Receipt,         label: 'Đơn Hàng',     sub: 'ĐH',   color: 'text-sky-500' },
  { id: 'suppliers',   icon: Truck,           label: 'Nhà Cung Cấp', sub: 'NCC',  color: 'text-cteal' },
  { id: 'stocktake',   icon: ClipboardList,   label: 'Kiểm Kho',     sub: 'INV',  color: 'text-cyellow' },
  { id: 'report',      icon: LineChart,       label: 'Báo Cáo',      sub: 'P&L',  color: 'text-cyellow' },
  { id: 'hrm',         icon: UserCog,         label: 'Nhân Sự',      sub: 'HRM',  color: 'text-pink-500' },
  { id: 'activitylog', icon: History,         label: 'Nhật Ký',      sub: 'LOG',  color: 'text-indigo-500' },
  { id: 'channels',    icon: Globe,           label: 'Đa Kênh',      sub: 'OMN',  color: 'text-cteal' },
  { id: 'users',       icon: ShieldCheck,     label: 'Người Dùng',   sub: 'USR',  color: 'text-cblue' },
  { id: 'settings',    icon: Settings,        label: 'Cài Đặt',      sub: 'CFG',  color: 'text-muted' },
  { id: 'admin',       icon: Trash2,          label: 'Xóa Dữ Liệu',  sub: 'ADM',  color: 'text-cred' },
]

// ── Version config ────────────────────────────────────────────────────────
const CURRENT_VERSION = '1.01'
const LATEST_VERSION  = '1.01' // Đổi số này khi có bản mới

function UpdateButton() {
  const [open,    setOpen]    = useState(false)
  const [status,  setStatus]  = useState('idle') // idle | checking | latest | available
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleCheck() {
    setStatus('checking')
    setTimeout(() => {
      setStatus(LATEST_VERSION === CURRENT_VERSION ? 'latest' : 'available')
    }, 1200)
  }

  const hasUpdate = LATEST_VERSION !== CURRENT_VERSION

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(v => !v); setStatus('idle') }}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[12px] font-bold uppercase tracking-widest border transition-all ${
          hasUpdate
            ? 'text-cyellow border-cyellow/40 bg-cyellow/10 hover:bg-cyellow/20'
            : 'text-muted border-border hover:text-text hover:border-slate-300'
        }`}
      >
        <span>ANC-CFAM v{CURRENT_VERSION}</span>
        {hasUpdate && <span className="w-1.5 h-1.5 rounded-full bg-cyellow animate-pulse" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-surface border border-border rounded-xl shadow-cardHover z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-bold text-text">ANC-CFAM</div>
            <div className="text-[12px] text-muted mt-0.5">Phiên bản hiện tại: <span className="text-text font-semibold">v{CURRENT_VERSION}</span></div>
          </div>

          {/* Content */}
          <div className="p-3 flex flex-col gap-2">
            {status === 'idle' && (
              <>
                <div className="text-[12px] text-muted px-1">Kiểm tra bản cập nhật mới nhất từ server.</div>
                <button
                  onClick={handleCheck}
                  className="w-full py-2 rounded-lg bg-surface2 hover:bg-slate-100 text-xs font-semibold text-text border border-border transition-colors flex items-center justify-center gap-1.5"
                >
                  <Search size={13} strokeWidth={2.2} /> Kiểm tra cập nhật
                </button>
              </>
            )}

            {status === 'checking' && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-muted">
                <RefreshCw size={15} className="animate-spin" />
                Đang kiểm tra...
              </div>
            )}

            {status === 'latest' && (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="w-8 h-8 rounded-full bg-cgreen/15 border border-cgreen/30 flex items-center justify-center text-cgreen">
                  <Check size={16} strokeWidth={2.5} />
                </div>
                <div className="text-xs font-semibold text-cgreen">Đang dùng bản mới nhất</div>
                <div className="text-[12px] text-subtle">v{CURRENT_VERSION} là phiên bản mới nhất</div>
              </div>
            )}

            {status === 'available' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 p-2 bg-cyellow/10 border border-cyellow/20 rounded-lg">
                  <ArrowUp size={16} className="text-cyellow shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-cyellow">Có bản cập nhật mới</div>
                    <div className="text-[12px] text-muted">v{CURRENT_VERSION} → v{LATEST_VERSION}</div>
                  </div>
                </div>
                <button
                  onClick={() => { window.location.reload() }}
                  className="w-full py-2 rounded-lg bg-cyellow/20 hover:bg-cyellow/30 text-xs font-bold text-cyellow border border-cyellow/40 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw size={13} strokeWidth={2.2} /> Cập nhật ngay
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border text-[12px] text-subtle text-center">
            Cập nhật sẽ tải lại trang · Dữ liệu không bị mất
          </div>
        </div>
      )}
    </div>
  )
}

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
  hrm:         <HRM />,
  activitylog: <ActivityLog />,
  channels:  <ChannelOverview />,
  users:     <UserManagement />,
  settings:  <ShopSettings />,
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
  const CurrentIcon = current?.icon

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-bg">

      {/* ── Breadcrumb nhỏ gọn ───────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-2 flex items-center gap-1.5 text-[12px] text-muted border-b border-border bg-surface">
        <Store size={13} className="text-subtle" />
        <span>Kinh Doanh</span>
        <ChevronRight size={13} className="text-subtle" />
        <span className={`flex items-center gap-1 font-semibold ${current?.color ?? 'text-muted'}`}>
          {CurrentIcon && <CurrentIcon size={13} strokeWidth={2.2} />}
          {current?.label}
        </span>
        {/* Version badge là thông tin kỹ thuật — chỉ hiện ở dev/staging, ẩn ở production
            theo design rule "Header không hiển thị thông tin kỹ thuật cho khách hàng". */}
        {showTechInfo && (
          <div className="ml-auto">
            <UpdateButton />
          </div>
        )}
      </div>

      {/* ── Page content — Route Guard, Page không tự kiểm tra quyền ────── */}
      <div className="flex-1">
        <AppRoute permission={getRoutePermission(activeTab)} label={current?.label}>
          {PAGES[activeTab]}
        </AppRoute>
      </div>

    </div>
  )
}
