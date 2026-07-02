import { useContext } from 'react'
import { CurrentUserContext } from '../context/CurrentUserContext'

/**
 * useCurrentUser() — đọc CurrentUser (Profile + Role + Branch) đã được nạp vào
 * Store sau khi đăng nhập. Không tự fetch — chỉ đọc từ <CurrentUserProvider>.
 *
 * @returns {{ currentUser: import('../types/user').CurrentUser | null, loading: boolean, reload: () => Promise<void> }}
 */
export function useCurrentUser() {
  const ctx = useContext(CurrentUserContext)
  if (!ctx) throw new Error('useCurrentUser() phải dùng bên trong <CurrentUserProvider>')
  return ctx
}
