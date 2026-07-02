import { useState } from 'react'
import { Toaster } from 'sonner'
import {
  LayoutDashboard, ShoppingCart, Package, Receipt, ClipboardList,
  Users, Building2, Wallet, TrendingUp, UserCog, Globe, History, Settings,
  LayoutGrid, Store, PieChart, CalendarRange, Menu, SlidersHorizontal,
  CalendarDays, NotebookPen, CreditCard, Settings2, Landmark, ShieldCheck,
} from 'lucide-react'
import { AppProvider } from './context/AppContext'
import { useAuth } from './context/SupabaseContext'
import { CurrentUserProvider } from './context/CurrentUserContext'
import AppRoute from './components/permission/AppRoute'
import { getRoutePermission } from './lib/permissions/routePermissions'
import { usePermission } from './hooks/usePermission'
import Login from './components/auth/Login'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import Dashboard from './pages/Dashboard'
import Assumptions from './pages/Assumptions'
import QuarterlyCashFlow from './pages/QuarterlyCashFlow'
import AnnualSummary from './pages/AnnualSummary'
import MonthlyInput from './pages/MonthlyInput'
import Portfolio from './pages/Portfolio'
import Config from './pages/Config'
import CreditCardManager from './pages/CreditCardManager'
import BusinessModule from './pages/business/BusinessModule'

// ── Mobile Business sub-tabs — icon đồng bộ 1:1 với Sidebar desktop ──────────
const BIZ_TABS = [
  { id:'analytics',  icon:LayoutDashboard, label:'Tổng Quan' },
  { id:'pos',        icon:ShoppingCart,    label:'Bán Hàng'  },
  { id:'products',   icon:Package,         label:'Hàng Hóa'  },
  { id:'orders',     icon:Receipt,         label:'Đơn Hàng'  },
  { id:'customers',  icon:Users,           label:'Khách Hàng' },
  { id:'suppliers',  icon:Building2,       label:'NCC'        },
  { id:'cashbook',   icon:Wallet,          label:'Sổ Quỹ'    },
  { id:'stocktake',  icon:ClipboardList,   label:'Kiểm Kho'  },
  { id:'report',     icon:TrendingUp,      label:'Báo Cáo'   },
  { id:'hrm',        icon:UserCog,         label:'Nhân Sự'   },
  { id:'users',      icon:ShieldCheck,     label:'Người Dùng'},
  { id:'channels',   icon:Globe,           label:'Đa Kênh'   },
  { id:'activitylog',icon:History,         label:'Nhật Ký'   },
  { id:'settings',   icon:Settings,        label:'Cài Đặt'  },
]

// ── Bottom nav items ──────────────────────────────────────────────────────────
const BOTTOM_NAV = [
  { id:'dashboard',  icon:LayoutGrid,    label:'Home'       },
  { id:'business',   icon:Store,         label:'Kinh Doanh' },
  { id:'portfolio',  icon:PieChart,      label:'Danh Mục'   },
  { id:'quarterly',  icon:CalendarRange, label:'Dòng Tiền'  },
  { id:'menu',       icon:Menu,          label:'Menu'       },
]

// ── Trang quản trị dòng tiền trong drawer mobile ──────────────────────────────
const CASHFLOW_TABS = [
  { id:'dashboard',   icon:LayoutGrid,        label:'Dashboard'  },
  { id:'assumptions', icon:SlidersHorizontal, label:'Giả Định'   },
  { id:'quarterly',   icon:CalendarRange,     label:'Dòng Tiền'  },
  { id:'annual',      icon:CalendarDays,      label:'Năm'        },
  { id:'monthly',     icon:NotebookPen,       label:'Nhập Tháng' },
  { id:'portfolio',   icon:PieChart,          label:'Danh Mục'   },
  { id:'creditcards', icon:CreditCard,        label:'Thẻ Tín Dụng'},
  { id:'config',      icon:Settings2,         label:'Cấu Hình'   },
]

function MainLayout() {
  const [page,        setPage]        = useState('dashboard')
  const [bizTab,      setBizTab]      = useState('analytics')
  const [drawerOpen,  setDrawerOpen]  = useState(false)   // mobile full drawer
  const { can } = usePermission()

  function handlePageChange(newPage) { setPage(newPage); setDrawerOpen(false) }
  function handleBizTabChange(tab)   { setBizTab(tab); setPage('business'); setDrawerOpen(false) }

  // Sidebar Guard áp dụng luôn cho thanh tab mobile + drawer — cùng nguồn
  // routePermissions.js với Sidebar desktop, không định nghĩa lại ở đây.
  const visibleBizTabs      = BIZ_TABS.filter(t => can(getRoutePermission(t.id)))
  const visibleCashflowTabs = CASHFLOW_TABS.filter(t => can(getRoutePermission(t.id)))

  const CASHFLOW_PAGES = {
    dashboard:   <Dashboard />,
    assumptions: <Assumptions />,
    quarterly:   <QuarterlyCashFlow />,
    annual:      <AnnualSummary />,
    monthly:     <MonthlyInput />,
    portfolio:   <Portfolio />,
    creditcards: <CreditCardManager />,
    config:      <Config />,
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* ── Desktop sidebar ── */}
      <div className="hidden md:block">
        <Sidebar
          current={page}
          currentBizTab={bizTab}
          onChange={handlePageChange}
          onBizTabChange={handleBizTabChange}
        />
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 md:ml-[260px] min-h-screen"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)' }}>
        <Topbar page={page} onNavigate={handleBizTabChange} onNavigatePage={handlePageChange} />
        <div className="overflow-x-hidden">
          {page === 'business'
            ? <BusinessModule activeTab={bizTab} onTabChange={setBizTab} />
            : (
              <AppRoute permission={getRoutePermission(page)}>
                {CASHFLOW_PAGES[page] ?? <Dashboard />}
              </AppRoute>
            )
          }
        </div>
      </div>

      {/* ── Mobile: Business sub-tab bar (hiện khi ở trang business) ── */}
      {page === 'business' && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-border overflow-x-auto scrollbar-none flex gap-0.5 px-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 52px)', paddingBottom: '6px' }}>
          {visibleBizTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setBizTab(t.id)}
              className={`shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all gap-0.5 ${
                bizTab === t.id
                  ? 'bg-cblue/15 text-cblue'
                  : 'text-muted hover:text-text'
              }`}
            >
              <t.icon size={16} strokeWidth={2} />
              <span className="whitespace-nowrap">{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border z-40 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {BOTTOM_NAV.map(n => (
          <button
            key={n.id}
            onClick={() => n.id === 'menu' ? setDrawerOpen(true) : handlePageChange(n.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[12px] font-semibold transition-colors min-h-[52px] ${
              (n.id === 'menu' ? drawerOpen : page === n.id)
                ? 'text-cblue'
                : 'text-muted'
            }`}
          >
            <n.icon size={20} strokeWidth={2} />
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Mobile full drawer (Menu) ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl border-t border-border shadow-cardHover max-h-[80vh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border"/>
            </div>

            <div className="px-4 pb-4">
              {/* ── Business tabs ── */}
              <div className="mb-4">
                <div className="flex items-center gap-1.5 text-[12px] font-black text-muted uppercase tracking-wider px-1 mb-2">
                  <Store size={12} strokeWidth={2.4} /> Kinh Doanh
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {visibleBizTabs.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleBizTabChange(t.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${
                        page === 'business' && bizTab === t.id
                          ? 'bg-cblue/15 text-cblue border border-cblue/25'
                          : 'bg-surface2 text-muted hover:text-text'
                      }`}
                    >
                      <t.icon size={22} strokeWidth={2} />
                      <span className="text-center leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Quản trị dòng tiền ── */}
              <div>
                <div className="flex items-center gap-1.5 text-[12px] font-black text-muted uppercase tracking-wider px-1 mb-2">
                  <Landmark size={12} strokeWidth={2.4} /> Quản Trị Dòng Tiền
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {visibleCashflowTabs.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handlePageChange(t.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95 ${
                        page === t.id
                          ? 'bg-cgreen/10 text-cgreen border border-cgreen/25'
                          : 'bg-surface2 text-muted hover:text-text'
                      }`}
                    >
                      <t.icon size={22} strokeWidth={2} />
                      <span className="text-center leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function AppContent() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center text-sm text-muted">
        Đang kiểm tra đăng nhập...
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <CurrentUserProvider>
      <AppProvider>
        <MainLayout />
      </AppProvider>
    </CurrentUserProvider>
  )
}

export default function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#ffffff', border: '1px solid #e5e7eb', color: '#111827', fontSize: 13 },
          success: { style: { borderColor: '#16a34a' } },
          error:   { style: { borderColor: '#ef4444' } },
        }}
      />
      <AppContent />
    </>
  )
}
