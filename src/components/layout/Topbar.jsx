import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import { useAuth } from '../../context/SupabaseContext'
import { isDevEnv, showTechInfo, APP_ENV } from '../../lib/env'
import { usePermission } from '../../hooks/usePermission'
import { getRoutePermission } from '../../lib/permissions/routePermissions'
import NotificationBell from '../ui/NotificationBell'
import { NAV_INDEX } from './Sidebar'
import {
  Building2, Cloud, CloudOff, ChevronDown, LogOut, Search, X, SearchX,
  Store, LayoutGrid, SlidersHorizontal, CalendarRange, CalendarDays,
  NotebookPen, PieChart, CreditCard, Settings2,
  User, Settings, KeyRound, Keyboard, HelpCircle, FlaskConical,
} from 'lucide-react'

const APP_VERSION = '1.01'

const PAGES = {
  business:    { icon: Store,             label: 'Kinh Doanh' },
  dashboard:   { icon: LayoutGrid,        label: 'Dashboard' },
  assumptions: { icon: SlidersHorizontal, label: 'Giả Định' },
  quarterly:   { icon: CalendarRange,     label: 'Dòng Tiền Quý' },
  annual:      { icon: CalendarDays,      label: 'Tổng Hợp Năm' },
  monthly:     { icon: NotebookPen,       label: 'Nhập Tháng' },
  portfolio:   { icon: PieChart,          label: 'Danh Mục & Rủi Ro' },
  creditcards: { icon: CreditCard,        label: 'Thẻ Visa / Tín Dụng' },
  config:      { icon: Settings2,         label: 'Cấu Hình' },
}

// ── Global search (tìm kiếm toàn hệ thống, Ctrl/⌘+K) ────────────────────────
// Điều hướng bằng đúng 2 callback đã tồn tại (onNavigate cho tab-business,
// onNavigatePage cho trang cấp App.jsx) — không thêm route/state mới.
function GlobalSearch({ onNavigate, onNavigatePage }) {
  const [query, setQuery] = useState('')
  const [open,  setOpen]  = useState(false)
  const wrapRef  = useRef(null)
  const inputRef = useRef(null)
  const { can }  = usePermission()

  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClick)
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [])

  const q       = query.trim().toLowerCase()
  // Action Guard cho Global Search — không gợi ý điều hướng tới nơi CurrentUser
  // không có quyền, đọc Permission Engine qua usePermission(), không tự so role.
  const q_results = q ? NAV_INDEX.filter(item => item.label.toLowerCase().includes(q)) : []
  const results   = q_results.filter(item => can(getRoutePermission(item.tab || item.page))).slice(0, 8)
  const grouped = results.reduce((acc, item) => {
    (acc[item.group] ??= []).push(item)
    return acc
  }, {})

  function handleSelect(item) {
    if (item.kind === 'tab') onNavigate?.(item.tab)
    else onNavigatePage?.(item.page)
    setQuery('')
    setOpen(false)
    inputRef.current?.blur()
  }

  return (
    <div ref={wrapRef} className="hidden md:block relative flex-1 max-w-md">
      <Search size={16} strokeWidth={2} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Tìm kiếm trong hệ thống…"
        className="input-sm w-full pl-10 pr-14 bg-surface2 border-transparent text-gray-900 placeholder:text-gray-400 focus:bg-white"
      />
      {query ? (
        <button
          onClick={() => { setQuery(''); inputRef.current?.focus() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cred transition-colors"
        >
          <X size={14} strokeWidth={2.2} />
        </button>
      ) : (
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] font-semibold text-gray-400 bg-white border border-gray-200 rounded-md px-1.5 py-0.5 pointer-events-none">
          Ctrl K
        </kbd>
      )}

      {open && q && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg z-40 overflow-hidden max-h-96 overflow-y-auto">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
              <SearchX size={26} strokeWidth={1.5} className="text-gray-400" />
              <div className="text-[14px] font-semibold text-gray-500">Không tìm thấy kết quả cho "{query}"</div>
              <div className="text-[12px] text-gray-500">Hãy thử từ khóa khác</div>
            </div>
          ) : (
            Object.entries(grouped).map(([groupLabel, items]) => (
              <div key={groupLabel}>
                <div className="px-4 pt-2.5 pb-1 text-[12px] font-bold uppercase tracking-wider text-gray-400">{groupLabel}</div>
                {items.map(item => {
                  const ItemIcon = item.icon
                  return (
                    <button
                      key={`${item.kind}-${item.tab || item.page}`}
                      onMouseDown={e => { e.preventDefault(); handleSelect(item) }}
                      className="w-full flex items-center gap-2.5 px-4 h-10 text-left text-[14px] font-medium text-gray-900 hover:bg-blue-50 transition-colors border-b border-gray-200 last:border-0"
                    >
                      <ItemIcon size={15} strokeWidth={2} className="text-gray-500 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ── 1 dòng trong dropdown user — wired (onClick thật) hoặc placeholder (disabled) ──
function MenuItem({ icon: Icon, label, onClick, disabled, danger }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? 'Sắp ra mắt' : undefined}
      className={`w-full flex items-center gap-2.5 px-4 h-10 text-left text-[14px] font-medium transition-colors ${
        disabled
          ? 'text-slate-300 cursor-not-allowed'
          : danger
          ? 'text-rose-700 hover:bg-rose-50'
          : 'text-text hover:bg-surface2'
      }`}
    >
      <Icon size={15} strokeWidth={2} className="shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {disabled && <span className="shrink-0 text-[12px] text-slate-300">Sắp có</span>}
    </button>
  )
}

// ── User menu — avatar + dropdown đầy đủ (Hồ sơ/Cài đặt/Đổi mật khẩu/Phím tắt/
// Trợ giúp/Đăng xuất). Mọi thông tin phụ (workspace, vai trò) chuyển vào đây
// thay vì chiếm chỗ trên Topbar chính — đúng chuẩn Enterprise (Linear/Vercel/Notion).
function UserMenu({ onNavigate }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!user) return null

  const email    = user.email ?? ''
  const meta     = user.user_metadata ?? {}
  const fullName = meta.full_name ?? meta.name ?? ''
  const role     = meta.role ?? 'Admin' // giống hệt fallback đang dùng ở Sidebar.jsx
  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email.slice(0, 2).toUpperCase()

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut()
  }

  // Tái dùng đúng luồng "Quên mật khẩu" đã có ở Login.jsx (resetPasswordForEmail) —
  // không thêm API/Auth flow mới.
  async function handleChangePassword() {
    setOpen(false)
    if (!supabase || !email) return
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      toast.success('Đã gửi email đặt lại mật khẩu — kiểm tra hộp thư của bạn')
    } catch (e) {
      toast.error(e.message || 'Không thể gửi email đặt lại mật khẩu')
    }
  }

  // "Cài đặt" đã tồn tại sẵn (business tab 'settings' → ShopSettings.jsx) — chỉ điều
  // hướng bằng đúng callback onNavigate đã có, không thêm route mới.
  function handleSettings() {
    setOpen(false)
    onNavigate?.('settings')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-xl hover:bg-surface2 transition-colors"
      >
        {meta.avatar_url ? (
          <img src={meta.avatar_url} alt="avatar" className="w-7 h-7 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cblue to-cpurple flex items-center justify-center shrink-0">
            <span className="text-[12px] font-bold text-white">{initials}</span>
          </div>
        )}
        <ChevronDown size={14} strokeWidth={2.2} className={`text-slate-500 transition-transform hidden sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-border rounded-2xl shadow-card z-50 overflow-hidden">
          {/* Avatar + tên + vai trò */}
          <div className="px-4 py-3.5 border-b border-border flex items-center gap-3">
            {meta.avatar_url ? (
              <img src={meta.avatar_url} alt="avatar" className="w-10 h-10 rounded-full object-cover border border-border shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cblue to-cpurple flex items-center justify-center shrink-0">
                <span className="text-[13px] font-bold text-white">{initials}</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              {fullName && <div className="text-[14px] font-semibold text-text truncate">{fullName}</div>}
              <div className="text-[12px] text-muted truncate">{email}</div>
              <span className="inline-block mt-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide bg-cblue/10 text-cblue">
                {role}
              </span>
            </div>
          </div>

          {/* Workspace */}
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-[13px] text-muted">
            <Building2 size={14} strokeWidth={2} className="text-subtle shrink-0" />
            ANC Retail
          </div>

          {/* Menu chính */}
          <div className="py-1.5 border-b border-border">
            <MenuItem icon={User}       label="Hồ sơ"          disabled />
            <MenuItem icon={Settings}   label="Cài đặt"        onClick={handleSettings} />
            <MenuItem icon={KeyRound}   label="Đổi mật khẩu"   onClick={handleChangePassword} />
            <MenuItem icon={Keyboard}   label="Phím tắt"       disabled />
            <MenuItem icon={HelpCircle} label="Trợ giúp"       disabled />
          </div>

          {/* Đăng xuất */}
          <div className="py-1.5">
            <MenuItem icon={LogOut} label="Đăng xuất" danger onClick={handleLogout} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function Topbar({ page, onNavigate, onNavigatePage }) {
  const meta = PAGES[page]
  const PageIcon = meta?.icon ?? LayoutGrid

  return (
    <div
      className="h-[72px] bg-white border-b border-border flex items-center justify-between gap-4 px-6 sticky top-0 z-20"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2.5 min-w-0 shrink-0">
        <span className="w-8 h-8 rounded-lg bg-cblue/10 text-cblue flex items-center justify-center shrink-0">
          <PageIcon size={16} strokeWidth={2.1} />
        </span>
        <span className="font-semibold text-[16px] text-text truncate">{meta?.label ?? page}</span>
      </div>

      {/* ── Search toàn hệ thống ── */}
      <GlobalSearch onNavigate={onNavigate} onNavigatePage={onNavigatePage} />

      {/* ── Right cluster ── */}
      <div className="flex items-center gap-2.5 shrink-0">

        {/* Cụm thông tin kỹ thuật — CHỈ hiện ở dev/staging, ẩn hoàn toàn ở production
            (khách hàng không được thấy Supabase/API/Version). */}
        {showTechInfo && (
          <>
            <div className={`hidden md:flex items-center gap-1.5 h-9 px-2.5 rounded-xl text-[12px] font-bold border uppercase tracking-wide ${
              isDevEnv
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`} title="Chỉ hiển thị ở môi trường thử nghiệm">
              <FlaskConical size={13} strokeWidth={2.1} />
              {APP_ENV}
            </div>

            <div className={`hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold border ${
              isSupabaseConfigured
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {isSupabaseConfigured ? <Cloud size={14} strokeWidth={2.1} /> : <CloudOff size={14} strokeWidth={2.1} />}
              {isSupabaseConfigured ? 'Supabase' : 'Local'}
            </div>

            {isDevEnv && (
              <div className="hidden lg:block h-9 px-3 rounded-xl bg-surface2 border border-border text-[12px] font-semibold text-slate-500 flex items-center">
                v{APP_VERSION}
              </div>
            )}
          </>
        )}

        {/* Notification */}
        <NotificationBell onNavigate={onNavigate} />

        <div className="w-px h-6 bg-border mx-0.5 hidden sm:block" />

        {/* User — mọi thông tin phụ (workspace/vai trò/version) nằm trong dropdown này */}
        <UserMenu onNavigate={onNavigate} />
      </div>
    </div>
  )
}
