import { useMemo } from 'react'
import { useCurrentUser } from './useCurrentUser'
import { can as canFn, cannot as cannotFn, hasAnyPermission } from '../lib/permissions/permissionEngine'

/**
 * usePermission() — CỔNG DUY NHẤT để component kiểm tra quyền.
 *
 * const { can, cannot, permissions, role } = usePermission()
 * if (can(PERMISSIONS.INVENTORY_DELETE)) { ... }   // hoặc dùng <Can>/<AppRoute>
 *
 * Không tự so sánh role trong component — luôn qua can()/cannot() ở đây.
 */
export function usePermission() {
  const { currentUser, loading } = useCurrentUser()
  const permissions = currentUser?.permissions ?? []

  return useMemo(() => ({
    permissions,
    role: currentUser?.role ?? null,
    loading,
    can:    permission => canFn(permissions, permission),
    cannot: permission => cannotFn(permissions, permission),
    canAny: permissionList => hasAnyPermission(permissions, permissionList),
  }), [permissions, currentUser?.role, loading])
}
