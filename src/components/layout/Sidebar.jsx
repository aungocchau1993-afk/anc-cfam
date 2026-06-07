import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/SupabaseContext'

// ═══════════════════════════════════════════════════════════
//  CẤU HÌNH 2 NHÓM CHÍNH — Thêm tab mới chỉ cần thêm vào đây
// ═══════════════════════════════════════════════════════════

const GROUPS = [
  {
    id:          'business',
    icon:        '🏪',
    label:       'Kinh Doanh',
    desc:        'POS · Kho · CRM · Báo Cáo',
    accent:      '#3fb950',        // cgreen
    colorCls:    'text-emerald-400',
    activeBgCls: 'bg-emerald-500/12 border-emerald-500/25',
    headerCls:   'hover:bg-emerald-500/8 border-emerald-500/20',
    dotCls:      'bg-emerald-400',
    // Các tab con — tab = id tab trong BusinessModule
    items: [
      { tab: 'analytics', icon: '📊', label: 'Dashboard KPI' },
      { tab: 'pos',       icon: '🛒', label: 'Bán Hàng' },
      { tab: 'products',  icon: '📦', label: 'Hàng Hóa' },
      { tab: 'customers', icon: '👥', label: 'Khách Hàng' },
      { tab: 'orders',    icon: '🧾', label: 'Đơn Hàng' },
      { tab: 'suppliers', icon: '🏢', label: 'Nhà Cung Cấp' },
      { tab: 'cashbook',  icon: '💵', label: 'Sổ Quỹ' },
      { tab: 'stocktake', icon: '🗂️', label: 'Kiểm Kho' },
      { tab: 'report',    icon: '📈', label: 'Báo Cáo P&L' },
      { tab: 'settings',  icon: '⚙️', label: 'Cài Đặt' },
      { tab: 'admin',     icon: '🗑️', label: 'Xóa Dữ Liệu' },
    ],
  },
  {
    id:          'cashflow',
    icon:        '💼',
    label:       'Quản Trị Dòng Tiền',
    desc:        'KPI · Dự báo · Đầu tư',
    accent:      '#58a6ff',        // cblue
    colorCls:    'text-blue-400',
    activeBgCls: 'bg-blue-500/12 border-blue-500/25',
    headerCls:   'hover:bg-blue-500/8 border-blue-500/20',
    dotCls:      'bg-blue-400',
    // page = id trang trong App.jsx (PAGES object)
    items: [
      { page: 'dashboard',   icon: '📊', label: 'Dashboard' },
      { page: 'assumptions', icon: '⚙️', label: 'Giả Định' },
      { page: 'quarterly',   icon: '📅', label: 'Dòng Tiền Quý' },
      { page: 'annual',      icon: '📆', label: 'Tổng Hợp Năm' },
      { page: 'monthly',     icon: '📝', label: 'Nhập Tháng' },
      { page: 'portfolio',   icon: '🏦', label: 'Danh Mục & Rủi Ro' },
      { page: 'creditcards', icon: '💳', label: 'Thẻ Visa / Tín Dụng' },
      { page: 'config',      icon: '🎛️', label: 'Cấu Hình' },
    ],
  },
]

// ── Sidebar Component ────────────────────────────────────────────────────

export default function Sidebar({ current, currentBizTab, onChange, onBizTabChange }) {
  const [open,         setOpen]         = useState({ business: true, cashflow: true })
  const [uploading,    setUploading]    = useState(false)
  const [avatarUrl,    setAvatarUrl]    = useState(null)  // override sau khi upload
  const fileInputRef = useRef(null)
  const { user } = useAuth()

  const toggleGroup = id => setOpen(prev => ({ ...prev, [id]: !prev[id] }))

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut()
  }

  // Lấy thông tin user
  const email    = user?.email ?? ''
  const meta     = user?.user_metadata ?? {}
  const role     = meta.role ?? 'Admin'
  const fullName = meta.full_name ?? meta.name ?? ''
  const initials = fullName
    ? fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : email.slice(0, 2).toUpperCase()
  // Dùng state override nếu vừa upload, fallback về user_metadata
  const currentAvatar = avatarUrl ?? meta.avatar_url ?? null

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !supabase) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('product-images')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      const url = data.publicUrl
      // Lưu vào user_metadata
      const { error: updErr } = await supabase.auth.updateUser({ data: { avatar_url: url } })
      if (updErr) throw updErr
      setAvatarUrl(url)
    } catch (err) {
      console.error('Upload avatar lỗi:', err)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  // Kiểm tra group nào đang active để highlight header
  function isGroupActive(group) {
    if (group.id === 'business') return current === 'business'
    return group.items.some(item => item.page === current)
  }

  return (
    <nav className="w-[220px] bg-surface border-r border-border flex flex-col fixed top-0 left-0 h-screen z-30 overflow-y-auto shrink-0">

      {/* ── Logo ───────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4 border-b border-border shrink-0">
        <h1 className="text-base font-black text-[#e6edf3] leading-tight tracking-tight">ANC - CFAM</h1>
        <span className="text-[10px] text-muted">Cash Flow & Asset Management</span>
      </div>

      {/* ── Groups ─────────────────────────────────────────── */}
      <div className="flex-1 py-2 overflow-y-auto">
        {GROUPS.map(group => {
          const isActive = isGroupActive(group)
          const isOpen   = open[group.id]

          return (
            <div key={group.id} className="px-2 mb-1">

              {/* ── Group Header (accordion toggle) ── */}
              <button
                onClick={() => toggleGroup(group.id)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border
                  text-left transition-all duration-150 mb-1
                  ${isActive
                    ? `${group.activeBgCls} ${group.colorCls}`
                    : `border-transparent text-muted ${group.headerCls}`
                  }
                `}
              >
                {/* Icon lớn */}
                <span className="text-[18px] leading-none shrink-0">{group.icon}</span>

                {/* Label + desc */}
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-black truncate ${isActive ? group.colorCls : 'text-slate-300'}`}>
                    {group.label}
                  </div>
                  <div className="text-[9px] text-slate-600 truncate font-medium mt-0.5">
                    {group.desc}
                  </div>
                </div>

                {/* Chevron */}
                <svg
                  className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${isActive ? group.colorCls : 'text-slate-600'}`}
                  viewBox="0 0 24 24" fill="none"
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>

              {/* ── Sub-items ── */}
              {isOpen && (
                <div className="flex flex-col gap-0.5 pl-2 mb-1">
                  {group.items.map(item => {
                    // Kiểm tra active tùy theo loại nhóm
                    const isItemActive = group.id === 'business'
                      ? current === 'business' && currentBizTab === item.tab
                      : current === item.page

                    return (
                      <button
                        key={item.tab || item.page}
                        onClick={() => {
                          if (group.id === 'business') {
                            onChange('business')
                            onBizTabChange?.(item.tab)
                          } else {
                            onChange(item.page)
                          }
                        }}
                        className={`
                          w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg
                          text-left text-xs font-medium transition-all duration-100
                          ${isItemActive
                            ? `${group.activeBgCls} ${group.colorCls} font-semibold`
                            : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                          }
                        `}
                      >
                        {/* Active dot */}
                        {isItemActive
                          ? <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${group.dotCls}`} />
                          : <span className="w-1.5 h-1.5 shrink-0" />
                        }
                        <span className="text-[13px] leading-none shrink-0">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── User Info + Logout ─────────────────────────────── */}
      <div className="shrink-0 border-t border-border">

        {/* User card */}
        {user && (
          <div className="px-3 py-3 flex items-center gap-2.5">
            {/* Avatar — click để đổi ảnh */}
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Click để đổi ảnh đại diện"
              className="relative w-8 h-8 rounded-full shrink-0 cursor-pointer group"
            >
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="avatar"
                  className="w-8 h-8 rounded-full object-cover border border-slate-600"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cblue/70 to-cpurple/70 border border-slate-600 flex items-center justify-center">
                  <span className="text-[11px] font-black text-white">{initials}</span>
                </div>
              )}
              {/* Overlay khi hover hoặc uploading */}
              <div className={`absolute inset-0 rounded-full bg-black/60 flex items-center justify-center transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {uploading
                  ? <svg className="w-3.5 h-3.5 text-white animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" strokeDasharray="28" strokeDashoffset="10"/></svg>
                  : <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                }
              </div>
            </div>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />

            {/* Info */}
            <div className="flex-1 min-w-0">
              {fullName && (
                <div className="text-[11px] font-bold text-[#e6edf3] truncate leading-tight">{fullName}</div>
              )}
              <div className="text-[10px] text-slate-500 truncate leading-tight">{email}</div>
              <div className="mt-0.5">
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full border ${
                  role.toLowerCase() === 'admin'
                    ? 'bg-cyellow/15 text-cyellow border-cyellow/30'
                    : 'bg-cblue/15 text-cblue border-cblue/30'
                }`}>
                  {role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="px-2 pb-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <path d="M15 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 12H9"       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 21H5a1 1 0 01-1-1V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  )
}
