import { useState, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/SupabaseContext'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { usePermission } from '../../hooks/usePermission'
import { getRoutePermission } from '../../lib/permissions/routePermissions'
import { PERMISSIONS } from '../../lib/permissions/permissionConstants'
import {
  Layers, ChevronDown, Camera, LogOut, Loader2,
  Store, Landmark, Users, Cog,
  LayoutDashboard, ShoppingCart, Package, Receipt, ClipboardList,
  Wallet, TrendingUp, LayoutGrid, SlidersHorizontal, CalendarRange, CalendarDays,
  NotebookPen, PieChart, CreditCard, Building2, Globe,
  UserCog, History, Settings, Settings2, Trash2, ShieldCheck,
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════
//  CẤU HÌNH 4 NHÓM ĐIỀU HƯỚNG — Business / Finance / CRM / System
//  Mỗi item tự khai báo kind: 'tab' (sub-tab trong BusinessModule)
//  hoặc 'page' (trang cấp App.jsx) — chỉ là cấu hình hiển thị,
//  không thay đổi hành vi điều hướng thực tế (onChange/onBizTabChange).
// ═══════════════════════════════════════════════════════════

const GROUPS = [
  {
    id: 'business', icon: Store, label: 'Business',
    items: [
      { kind: 'tab', tab: 'analytics', icon: LayoutDashboard, label: 'Tổng Quan' },
      { kind: 'tab', tab: 'pos',       icon: ShoppingCart,    label: 'Bán Hàng' },
      { kind: 'tab', tab: 'products',  icon: Package,         label: 'Hàng Hóa' },
      { kind: 'tab', tab: 'orders',    icon: Receipt,         label: 'Đơn Hàng' },
      { kind: 'tab', tab: 'stocktake', icon: ClipboardList,   label: 'Kiểm Kho' },
    ],
  },
  {
    id: 'finance', icon: Landmark, label: 'Finance',
    items: [
      { kind: 'tab',  tab: 'cashbook',     icon: Wallet,           label: 'Sổ Quỹ' },
      { kind: 'tab',  tab: 'report',       icon: TrendingUp,       label: 'Báo Cáo' },
      { kind: 'page', page: 'dashboard',   icon: LayoutGrid,       label: 'Dashboard' },
      { kind: 'page', page: 'assumptions', icon: SlidersHorizontal,label: 'Giả Định' },
      { kind: 'page', page: 'quarterly',   icon: CalendarRange,    label: 'Dòng Tiền Quý' },
      { kind: 'page', page: 'annual',      icon: CalendarDays,     label: 'Tổng Hợp Năm' },
      { kind: 'page', page: 'monthly',     icon: NotebookPen,      label: 'Nhập Tháng' },
      { kind: 'page', page: 'portfolio',   icon: PieChart,         label: 'Danh Mục & Rủi Ro' },
      { kind: 'page', page: 'creditcards', icon: CreditCard,       label: 'Thẻ Visa / Tín Dụng' },
    ],
  },
  {
    id: 'crm', icon: Users, label: 'CRM',
    items: [
      { kind: 'tab', tab: 'customers', icon: Users,     label: 'Khách Hàng' },
      { kind: 'tab', tab: 'suppliers', icon: Building2, label: 'Nhà Cung Cấp' },
      { kind: 'tab', tab: 'channels',  icon: Globe,     label: 'Đa Kênh' },
    ],
  },
  {
    id: 'system', icon: Cog, label: 'System',
    items: [
      { kind: 'tab',  tab: 'hrm',         icon: UserCog,     label: 'Nhân Sự' },
      { kind: 'tab',  tab: 'users',       icon: ShieldCheck, label: 'Người Dùng' },
      { kind: 'tab',  tab: 'activitylog', icon: History,     label: 'Nhật Ký' },
      { kind: 'tab',  tab: 'settings',    icon: Settings,    label: 'Cài Đặt' },
      { kind: 'page', page: 'config',     icon: Settings2, label: 'Cấu Hình' },
      { kind: 'tab',  tab: 'admin',       icon: Trash2,    label: 'Xóa Dữ Liệu' },
    ],
  },
]

// Danh sách phẳng tất cả điểm điều hướng, kèm tên nhóm — dùng cho ô tìm kiếm
// toàn hệ thống ở Topbar (chỉ đọc lại metadata hiển thị, không thêm logic mới).
export const NAV_INDEX = GROUPS.flatMap(g => g.items.map(item => ({ ...item, group: g.label })))

// ── Sidebar Component ────────────────────────────────────────────────────

export default function Sidebar({ current, currentBizTab, onChange, onBizTabChange }) {
  const [open,         setOpen]         = useState({ business: true, finance: true, crm: true, system: true })
  const [uploading,    setUploading]    = useState(false)
  const [avatarUrl,    setAvatarUrl]    = useState(null)  // override sau khi upload
  const fileInputRef = useRef(null)
  const { user } = useAuth()
  const { currentUser } = useCurrentUser()
  const { can }         = usePermission()

  // Sidebar Guard — lọc theo Permission Engine, KHÔNG hardcode role. Item
  // không có permission tương ứng trong routePermissions.js coi như public.
  // Nhóm nào rỗng sau khi lọc thì ẩn luôn cả header nhóm.
  const visibleGroups = useMemo(() => {
    return GROUPS
      .map(group => ({
        ...group,
        items: group.items.filter(item => can(getRoutePermission(item.tab || item.page))),
      }))
      .filter(group => group.items.length > 0)
  }, [can])

  const toggleGroup = id => setOpen(prev => ({ ...prev, [id]: !prev[id] }))

  function isItemActive(item) {
    return item.kind === 'tab'
      ? current === 'business' && currentBizTab === item.tab
      : current === item.page
  }

  function handleItemClick(item) {
    if (item.kind === 'tab') {
      onChange('business')
      onBizTabChange?.(item.tab)
    } else {
      onChange(item.page)
    }
  }

  async function handleLogout() {
    if (supabase) await supabase.auth.signOut()
  }

  // Lấy thông tin user — role đọc từ CurrentUser (bảng roles thật), không còn
  // đọc user_metadata.role (giá trị trang trí cũ, không liên quan Permission Engine).
  const email    = user?.email ?? ''
  const meta     = user?.user_metadata ?? {}
  const role     = currentUser?.role?.name ?? 'Chưa gán vai trò'
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

  return (
    <nav className="w-[260px] bg-sidebar flex flex-col fixed top-0 left-0 h-screen z-30 overflow-y-auto shrink-0"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingLeft: 'env(safe-area-inset-left)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* ── Logo ───────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 pt-7 pb-6 shrink-0">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-400 to-cblue flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/25">
          <Layers size={22} strokeWidth={2.2} className="text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[16px] font-bold text-white leading-tight tracking-tight truncate">ANC-CFAM</h1>
          <span className="text-[12px] text-white/50 truncate block mt-0.5">Cash Flow & Asset Management</span>
        </div>
      </div>
      <div className="h-px bg-white/[0.07] mx-5 mb-4 shrink-0" />

      {/* ── Groups ─────────────────────────────────────────── */}
      <div className="flex-1 px-3 pb-4 overflow-y-auto">
        {visibleGroups.map((group, gi) => {
          const isOpen    = open[group.id]
          const GroupIcon = group.icon

          return (
            <div key={group.id} className={gi > 0 ? 'mt-5' : ''}>

              {/* ── Group label (không phải nav item, chỉ phân nhóm) ── */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2.5 px-3 h-8 rounded-lg text-left transition-colors duration-150 text-white/50 hover:text-white/70"
              >
                <GroupIcon size={13} strokeWidth={2.2} className="shrink-0" />
                <span className="flex-1 text-[12px] font-bold uppercase tracking-widest truncate">{group.label}</span>
                <ChevronDown
                  size={12} strokeWidth={2.4}
                  className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* ── Sub-items ── */}
              {isOpen && (
                <div className="flex flex-col gap-1 mt-1.5">
                  {group.items.map(item => {
                    const active   = isItemActive(item)
                    const ItemIcon = item.icon

                    return (
                      <button
                        key={item.tab || item.page}
                        onClick={() => handleItemClick(item)}
                        className={`group relative w-full flex items-center gap-3 h-10 rounded-xl border-l-4 pl-3 pr-3 text-left text-[14px] transition-all duration-150 active:scale-[0.98] ${
                          active
                            ? 'bg-gradient-to-r from-cblue/25 via-cblue/10 to-transparent border-cblue text-white font-semibold shadow-glow'
                            : 'border-transparent text-white/50 font-medium hover:bg-sidebarHover hover:text-white/90'
                        }`}
                      >
                        <ItemIcon
                          size={16} strokeWidth={2}
                          className={`shrink-0 transition-colors ${active ? 'text-cblue' : 'text-white/50 group-hover:text-white/80'}`}
                        />
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
      <div className="shrink-0 border-t border-white/[0.07]">

        {/* User card */}
        {user && (
          <div className="px-4 py-4 flex items-center gap-3">
            {/* Avatar — click để đổi ảnh */}
            <div
              onClick={() => fileInputRef.current?.click()}
              title="Click để đổi ảnh đại diện"
              className="relative w-9 h-9 rounded-full shrink-0 cursor-pointer group"
            >
              {currentAvatar ? (
                <img
                  src={currentAvatar}
                  alt="avatar"
                  className="w-9 h-9 rounded-full object-cover border border-white/15"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cblue to-cpurple flex items-center justify-center">
                  <span className="text-[12px] font-bold text-white">{initials}</span>
                </div>
              )}
              {/* Overlay khi hover hoặc uploading */}
              <div className={`absolute inset-0 rounded-full bg-black/60 flex items-center justify-center transition-opacity ${uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {uploading
                  ? <Loader2 size={14} strokeWidth={2.5} className="text-white animate-spin" />
                  : <Camera size={14} strokeWidth={2} className="text-white" />
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
                <div className="text-[12px] font-semibold text-white truncate leading-tight">{fullName}</div>
              )}
              <div className="text-[12px] text-white/50 truncate leading-tight mt-0.5">{email}</div>
              <div className="mt-1">
                <span className={`text-[12px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide ${
                  can(PERMISSIONS.SYSTEM_SETTING)
                    ? 'bg-amber-400/15 text-amber-400'
                    : currentUser?.role
                    ? 'bg-cblue/15 text-blue-300'
                    : 'bg-white/10 text-white/40'
                }`}>
                  {role}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 h-10 px-3 rounded-xl text-left text-[14px] font-medium text-white/50 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
          >
            <LogOut size={16} strokeWidth={2} className="shrink-0" />
            Đăng xuất
          </button>
        </div>
      </div>
    </nav>
  )
}
