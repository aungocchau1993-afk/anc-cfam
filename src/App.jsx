import { useState } from 'react'
import { Toaster } from 'sonner'
import { AppProvider } from './context/AppContext'
import { useAuth } from './context/SupabaseContext'
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

// ── Mobile Business sub-tabs ─────────────────────────────────────────────────
const BIZ_TABS = [
  { id:'analytics',  icon:'📊', label:'Tổng Quan' },
  { id:'pos',        icon:'🛒', label:'Bán Hàng'  },
  { id:'products',   icon:'📦', label:'Hàng Hóa'  },
  { id:'orders',     icon:'🧾', label:'Đơn Hàng'  },
  { id:'customers',  icon:'👥', label:'Khách Hàng' },
  { id:'suppliers',  icon:'🏢', label:'NCC'        },
  { id:'cashbook',   icon:'💵', label:'Sổ Quỹ'    },
  { id:'stocktake',  icon:'🗂️', label:'Kiểm Kho'  },
  { id:'report',     icon:'📈', label:'Báo Cáo'   },
  { id:'hrm',        icon:'👔', label:'Nhân Sự'   },
  { id:'channels',   icon:'🌐', label:'Đa Kênh'   },
  { id:'activitylog',icon:'🕒', label:'Nhật Ký'   },
  { id:'settings',   icon:'⚙️', label:'Cài Đặt'  },
]

// ── Bottom nav items ──────────────────────────────────────────────────────────
const BOTTOM_NAV = [
  { id:'dashboard',  icon:'📊', label:'Home'       },
  { id:'business',   icon:'🏪', label:'Kinh Doanh' },
  { id:'portfolio',  icon:'🏦', label:'Danh Mục'   },
  { id:'quarterly',  icon:'📅', label:'Dòng Tiền'  },
  { id:'menu',       icon:'☰',  label:'Menu'       },
]

function MainLayout() {
  const [page,        setPage]        = useState('dashboard')
  const [bizTab,      setBizTab]      = useState('analytics')
  const [drawerOpen,  setDrawerOpen]  = useState(false)   // mobile full drawer

  function handlePageChange(newPage) { setPage(newPage); setDrawerOpen(false) }
  function handleBizTabChange(tab)   { setBizTab(tab); setPage('business'); setDrawerOpen(false) }

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
      <div className="flex-1 md:ml-[240px] min-h-screen"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 56px)' }}>
        <Topbar page={page} onNavigate={handleBizTabChange} />
        <div className="overflow-x-hidden">
          {page === 'business'
            ? <BusinessModule activeTab={bizTab} onTabChange={setBizTab} />
            : (CASHFLOW_PAGES[page] ?? <Dashboard />)
          }
        </div>
      </div>

      {/* ── Mobile: Business sub-tab bar (hiện khi ở trang business) ── */}
      {page === 'business' && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-[#ffffff] border-b border-border overflow-x-auto scrollbar-none flex gap-0.5 px-2"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 52px)', paddingBottom: '6px' }}>
          {BIZ_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setBizTab(t.id)}
              className={`shrink-0 flex flex-col items-center px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all gap-0.5 ${
                bizTab === t.id
                  ? 'bg-cblue/15 text-cblue'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className="text-base leading-none">{t.icon}</span>
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
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-semibold transition-colors min-h-[52px] ${
              (n.id === 'menu' ? drawerOpen : page === n.id)
                ? 'text-cblue'
                : 'text-muted'
            }`}
          >
            <span className="text-xl leading-none">{n.icon}</span>
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
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#ffffff] rounded-t-2xl border-t border-slate-800 max-h-[80vh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-slate-700"/>
            </div>

            <div className="px-4 pb-4">
              {/* ── Business tabs ── */}
              <div className="mb-4">
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-wider px-1 mb-2">🏪 Kinh Doanh</div>
                <div className="grid grid-cols-4 gap-2">
                  {BIZ_TABS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleBizTabChange(t.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 ${
                        page === 'business' && bizTab === t.id
                          ? 'bg-cblue/15 text-cblue border border-cblue/25'
                          : 'bg-slate-800/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-2xl leading-none">{t.icon}</span>
                      <span className="text-center leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Quản trị dòng tiền ── */}
              <div>
                <div className="text-[10px] font-black text-slate-600 uppercase tracking-wider px-1 mb-2">💼 Quản Trị Dòng Tiền</div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id:'dashboard',   icon:'📊', label:'Dashboard'  },
                    { id:'assumptions', icon:'⚙️', label:'Giả Định'   },
                    { id:'quarterly',   icon:'📅', label:'Dòng Tiền'  },
                    { id:'annual',      icon:'📆', label:'Năm'        },
                    { id:'monthly',     icon:'📝', label:'Nhập Tháng' },
                    { id:'portfolio',   icon:'🏦', label:'Danh Mục'   },
                    { id:'creditcards', icon:'💳', label:'Thẻ Tín Dụng'},
                    { id:'config',      icon:'🎛️', label:'Cấu Hình'   },
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => handlePageChange(t.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95 ${
                        page === t.id
                          ? 'bg-cgreen/10 text-cgreen border border-cgreen/25'
                          : 'bg-slate-800/60 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="text-2xl leading-none">{t.icon}</span>
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
    <AppProvider>
      <MainLayout />
    </AppProvider>
  )
}

export default function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b', fontSize: 13 },
          success: { style: { borderColor: '#3fb950' } },
          error:   { style: { borderColor: '#f85149' } },
        }}
      />
      <AppContent />
    </>
  )
}
