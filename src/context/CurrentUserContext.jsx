import { createContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './SupabaseContext'
import { getOrCreateProfile } from '../lib/services/profileService'
import { getRoleById } from '../lib/services/roleService'
import { getPermissionsForRole } from '../lib/permissions/rolePermissions'

// Sprint 1 — tách Authorization khỏi Authentication: sau khi Supabase Auth xác
// nhận session (useAuth), context này tự nạp Profile + Role (từ DB, KHÔNG
// hardcode) vào Store dưới dạng CurrentUser. KHÔNG đụng session/JWT hiện có —
// chỉ đọc thêm dữ liệu nghiệp vụ song song.
//
// Sprint 1.5 — bổ sung `permissions` (tính từ role.code qua rolePermissions.js,
// KHÔNG hardcode trong component) và `profile`/`branch` lồng nhau đúng shape
// CurrentUser {id, profile, role, branch, permissions} theo Permission
// Architecture. Các field tiện dụng cũ (name/email/avatar/status/branchId)
// được giữ nguyên ở top-level để không phá vỡ code đang gọi currentUser.xxx.
export const CurrentUserContext = createContext(null)

export function CurrentUserProvider({ children }) {
  const { user } = useAuth()
  const [currentUser, setCurrentUser] = useState(null)
  const [loading,     setLoading]     = useState(true)

  const reload = useCallback(async () => {
    if (!user) { setCurrentUser(null); setLoading(false); return }
    setLoading(true)
    try {
      const meta = user.user_metadata ?? {}
      const profile = await getOrCreateProfile(user.id, {
        fullName:  meta.full_name ?? meta.name ?? null,
        avatarUrl: meta.avatar_url ?? null,
      })
      const role        = profile?.roleId ? await getRoleById(profile.roleId) : null
      const permissions = getPermissionsForRole(role?.code)

      setCurrentUser(profile ? {
        id:         profile.id,
        authUserId: profile.authUserId,
        profile: {
          id:         profile.id,
          authUserId: profile.authUserId,
          fullName:   profile.fullName,
          phone:      profile.phone,
          avatarUrl:  profile.avatarUrl,
          status:     profile.status,
          createdAt:  profile.createdAt,
          updatedAt:  profile.updatedAt,
        },
        role,
        branch:      profile.branchId ? { id: profile.branchId } : null,
        branchId:    profile.branchId,
        permissions,
        // Field tiện dụng — giữ nguyên để không phá vỡ nơi đang dùng trực tiếp
        name:   profile.fullName || meta.full_name || meta.name || user.email,
        email:  user.email,
        avatar: profile.avatarUrl || meta.avatar_url || null,
        status: profile.status,
      } : null)
    } catch (e) {
      // Bảng profiles/roles có thể chưa được tạo (chưa chạy migration) — không
      // để lỗi này làm sập app, Authentication vẫn hoạt động bình thường.
      console.error('[CurrentUserContext] Không tải được Profile/Role:', e.message)
      setCurrentUser(null)
    } finally {
      setLoading(false)
    }
  // Chỉ phụ thuộc user?.id (không phải cả object `user`) — onAuthStateChange
  // có thể phát ra session mới (refresh token...) với cùng 1 user, tránh
  // load lại Profile/Role không cần thiết mỗi lần đó.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => { reload() }, [reload])

  return (
    <CurrentUserContext.Provider value={{ currentUser, loading, reload }}>
      {children}
    </CurrentUserContext.Provider>
  )
}
