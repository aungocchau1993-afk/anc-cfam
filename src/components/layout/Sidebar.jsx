import { supabase } from '../../lib/supabase'

const NAV = [
  { id:'dashboard', icon:'📊', label:'Dashboard',       group:'Tổng quan' },
  { id:'assumptions',icon:'⚙️', label:'Giả Định',       group:'Tổng quan' },
  { id:'quarterly',  icon:'📅', label:'Dòng Tiền Quý',  group:'Phân tích' },
  { id:'annual',     icon:'📆', label:'Tổng Hợp Năm',   group:'Phân tích' },
  { id:'monthly',    icon:'📝', label:'Nhập Tháng',     group:'Phân tích' },
  { id:'portfolio',  icon:'🏦', label:'Danh Mục & Rủi Ro', group:'Danh mục' },
  { id:'creditcards',icon:'💳', label:'Thẻ Visa / Tín Dụng', group:'Danh mục' },
  { id:'config',     icon:'🎛️', label:'Cấu Hình',       group:'Danh mục' },
]

const groups = [...new Set(NAV.map(n => n.group))]

export default function Sidebar({ current, onChange }) {
  async function handleLogout() {
    await supabase.auth.signOut()
  }

  return (
    <nav className="w-[220px] bg-surface border-r border-border flex flex-col fixed top-0 left-0 h-screen z-30 overflow-y-auto shrink-0">
      {/* Logo */}
      <div className="px-4 pt-5 pb-3 border-b border-border">
        <h1 className="text-base font-bold text-[#e6edf3] leading-tight">ANC - CFAM</h1>
        <span className="text-[11px] text-muted">Cash Flow & Asset Management</span>
      </div>

      {/* Nav */}
      {groups.map(g => (
        <div key={g} className="px-2 pt-3 pb-1">
          <div className="text-[10px] font-semibold text-muted uppercase tracking-widest px-2 pb-1.5">{g}</div>
          {NAV.filter(n => n.group === g).map(n => (
            <button
              key={n.id}
              onClick={() => onChange(n.id)}
              className={`nav-item w-full text-left mb-0.5 ${current === n.id ? 'nav-active' : ''}`}
            >
              <span className="w-5 text-center text-[15px]">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </div>
      ))}

      <div className="mt-auto px-2 py-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm font-semibold text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 21H5a1 1 0 01-1-1V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Đăng xuất
        </button>
      </div>
    </nav>
  )
}
