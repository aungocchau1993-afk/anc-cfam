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

function MainLayout() {
  const [page,       setPage]       = useState('dashboard')
  const [bizTab,     setBizTab]     = useState('analytics')  // tab đang active trong BusinessModule

  // Khi chuyển trang, nếu sang business thì giữ bizTab hiện tại
  function handlePageChange(newPage) { setPage(newPage) }
  function handleBizTabChange(tab)   { setBizTab(tab); setPage('business') }

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
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar
          current={page}
          currentBizTab={bizTab}
          onChange={handlePageChange}
          onBizTabChange={handleBizTabChange}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 md:ml-[220px] min-h-screen pb-20 md:pb-0">
        <Topbar page={page} />
        <div className="overflow-x-hidden">
          {page === 'business'
            ? <BusinessModule activeTab={bizTab} onTabChange={setBizTab} />
            : (CASHFLOW_PAGES[page] ?? <Dashboard />)
          }
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 flex overflow-x-auto scrollbar-none">
        {[
          { id:'dashboard',  icon:'📊', label:'Home' },
          { id:'assumptions',icon:'⚙️', label:'Giả Định' },
          { id:'quarterly',  icon:'📅', label:'Quý' },
          { id:'monthly',    icon:'📝', label:'Tháng' },
          { id:'portfolio',  icon:'🏦', label:'Danh Mục' },
          { id:'business',   icon:'🏪', label:'Kinh Doanh' },
          { id:'creditcards',icon:'💳', label:'Thẻ' },
        ].map(n => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={`shrink-0 w-[14.28%] min-w-[60px] flex flex-col items-center justify-center py-2 gap-0.5 text-[9px] font-medium transition-colors ${page===n.id?'text-cblue':'text-muted'}`}
          >
            <span className="text-lg leading-none">{n.icon}</span>
            <span className="truncate w-full text-center px-0.5">{n.label}</span>
          </button>
        ))}
      </nav>
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
          style: { background: '#161b22', border: '1px solid #30363d', color: '#e6edf3', fontSize: 13 },
          success: { style: { borderColor: '#3fb950' } },
          error:   { style: { borderColor: '#f85149' } },
        }}
      />
      <AppContent />
    </>
  )
}
