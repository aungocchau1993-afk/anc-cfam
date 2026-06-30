import { useState, useEffect, useRef } from 'react'
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
    id: 'hrm',        icon: '👔', label: 'Nhân Sự',      sub: 'HRM',
    color: 'text-pink-400', activeBorder: 'border-pink-500', activeBg: 'bg-pink-500/10',
  },
  {
    id: 'activitylog', icon: '🕒', label: 'Nhật Ký',     sub: 'LOG',
    color: 'text-indigo-400', activeBorder: 'border-indigo-500', activeBg: 'bg-indigo-500/10',
  },
  {
    id: 'channels',  icon: '🌐', label: 'Đa Kênh',       sub: 'OMN',
    color: 'text-teal-400', activeBorder: 'border-teal-500', activeBg: 'bg-teal-500/10',
  },
  {
    id: 'settings',  icon: '⚙️', label: 'Cài Đặt',       sub: 'CFG',
    color: 'text-slate-400', activeBorder: 'border-slate-500', activeBg: 'bg-slate-500/10',
  },
  {
    id: 'admin',     icon: '🗑️', label: 'Xóa Dữ Liệu',  sub: 'ADM',
    color: 'text-red-400', activeBorder: 'border-red-500', activeBg: 'bg-red-500/10',
  },
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
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border transition-all ${
          hasUpdate
            ? 'text-cyellow border-cyellow/40 bg-cyellow/10 hover:bg-cyellow/20'
            : 'text-slate-700 border-slate-800 hover:text-slate-500 hover:border-slate-700'
        }`}
      >
        <span>ANC-CFAM v{CURRENT_VERSION}</span>
        {hasUpdate && <span className="w-1.5 h-1.5 rounded-full bg-cyellow animate-pulse" />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-64 bg-[#ffffff] border border-slate-700/80 rounded-xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800">
            <div className="text-xs font-bold text-[#1e293b]">ANC-CFAM</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Phiên bản hiện tại: <span className="text-slate-300 font-semibold">v{CURRENT_VERSION}</span></div>
          </div>

          {/* Content */}
          <div className="p-3 flex flex-col gap-2">
            {status === 'idle' && (
              <>
                <div className="text-[11px] text-slate-500 px-1">Kiểm tra bản cập nhật mới nhất từ server.</div>
                <button
                  onClick={handleCheck}
                  className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
                >
                  🔍 Kiểm tra cập nhật
                </button>
              </>
            )}

            {status === 'checking' && (
              <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                Đang kiểm tra...
              </div>
            )}

            {status === 'latest' && (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="w-8 h-8 rounded-full bg-cgreen/15 border border-cgreen/30 flex items-center justify-center text-cgreen text-lg">✓</div>
                <div className="text-xs font-semibold text-cgreen">Đang dùng bản mới nhất</div>
                <div className="text-[11px] text-slate-600">v{CURRENT_VERSION} là phiên bản mới nhất</div>
              </div>
            )}

            {status === 'available' && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 p-2 bg-cyellow/10 border border-cyellow/20 rounded-lg">
                  <span className="text-cyellow text-base">⬆️</span>
                  <div>
                    <div className="text-xs font-semibold text-cyellow">Có bản cập nhật mới</div>
                    <div className="text-[11px] text-slate-500">v{CURRENT_VERSION} → v{LATEST_VERSION}</div>
                  </div>
                </div>
                <button
                  onClick={() => { window.location.reload() }}
                  className="w-full py-2 rounded-lg bg-cyellow/20 hover:bg-cyellow/30 text-xs font-bold text-cyellow border border-cyellow/40 transition-colors"
                >
                  🔄 Cập nhật ngay
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-800 text-[10px] text-slate-700 text-center">
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

  return (
    <div className="flex flex-col min-h-[calc(100vh-56px)] bg-[#f1f5f9]">

      {/* ── Breadcrumb nhỏ gọn ───────────────────────────────────────────── */}
      <div className="px-5 pt-3 pb-2 flex items-center gap-1.5 text-[11px] text-slate-600 border-b border-slate-800/60">
        <span className="text-slate-700">🏪</span>
        <span className="text-slate-700">Kinh Doanh</span>
        <span className="text-slate-800">›</span>
        <span className={`font-semibold ${current?.color ?? 'text-slate-400'}`}>
          {current?.icon} {current?.label}
        </span>
        <div className="ml-auto">
          <UpdateButton />
        </div>
      </div>

      {/* ── Page content ─────────────────────────────────────────────────── */}
      <div className="flex-1">
        {PAGES[activeTab]}
      </div>

    </div>
  )
}
