import { usePermission } from '../../hooks/usePermission'

/**
 * <Can permission="inventory.delete"><Button>Xoá</Button></Can>
 *
 * Ẩn HOÀN TOÀN children nếu không có quyền (không render, không disable) —
 * đúng yêu cầu Button/Action/Feature Guard. Dùng `anyOf` khi cần permission
 * OR nhiều quyền (vd Sidebar group: hiện nếu có ít nhất 1 quyền con).
 *
 * Không viết `role === "..."` trong component — luôn qua <Can>/usePermission().
 */
export default function Can({ permission, anyOf, fallback = null, children }) {
  const { can, canAny } = usePermission()
  const allowed = anyOf ? canAny(anyOf) : can(permission)
  return allowed ? children : fallback
}

// Alias theo đúng tên nêu trong spec ("<PermissionGuard>") — cùng 1 component,
// tránh 2 nơi định nghĩa logic guard khác nhau.
export const PermissionGuard = Can
