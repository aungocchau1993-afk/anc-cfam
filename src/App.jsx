import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { AppProvider } from './context/AppContext'
import { isSupabaseConfigured, supabase } from './lib/supabase'
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

function MainLayout() {
  const [page, setPage] = useState('dashboard')

  const PAGES = {
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
        <Sidebar current={page} onChange={setPage} />
      </div>

      {/* Main content */}
      <div className="flex-1 md:ml-[220px] min-h-screen pb-16 md:pb-0">
        <Topbar page={page} />
        <div className="overflow-x-hidden">
          {PAGES[page]}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40 flex">
        {[
          { id:'dashboard',  icon:'📊', label:'Home' },
          { id:'assumptions',icon:'⚙️', label:'Giả Định' },
          { id:'quarterly',  icon:'📅', label:'Quý' },
          { id:'monthly',    icon:'📝', label:'Tháng' },
          { id:'portfolio',  icon:'🏦', label:'Danh Mục' },
          { id:'creditcards',icon:'💳', label:'Thẻ' },
        ].map(n => (
          <button
            key={n.id}
            onClick={() => setPage(n.id)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${page===n.id?'text-cblue':'text-muted'}`}
          >
            <span className="text-lg">{n.icon}</span>
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function AppContent() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setSession(null)
      setLoading(false)
      return
    }

    let mounted = true

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession()
      if (!mounted) return
      if (error) console.error('Failed to get auth session', error)
      setSession(data?.session || null)
      setLoading(false)
    }

    loadSession()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      mounted = false
      authListener.subscription.unsubscribe()
    }
  }, [])

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
