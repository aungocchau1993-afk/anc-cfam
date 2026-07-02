/**
 * permissionEngine.js — Lõi kiểm tra quyền, thuần hàm (pure functions), không
 * phụ thuộc React/Supabase. Toàn bộ project CHỈ được gọi can()/cannot() từ
 * đây (trực tiếp hoặc qua usePermission()/<Can>/<AppRoute>) — cấm viết
 * `role === "..."`, `switch(role)`, `if(role)` ở component.
 *
 * "Backend Ready" (mục 13 của spec): engine chỉ nhận vào 1 mảng permissions
 * đã tính sẵn — hôm nay mảng đó do rolePermissions.js tính ở frontend, sau
 * này có thể thay bằng permissions trả về từ Supabase RLS/RPC mà KHÔNG cần
 * sửa can()/cannot() hay bất kỳ component nào đang gọi chúng.
 */

/** @param {string[]} permissions @param {string} permission */
export function hasPermission(permissions, permission) {
  if (!permission) return true
  if (!Array.isArray(permissions)) return false
  return permissions.includes(permission)
}

/** Alias ngắn — dùng trong component: can(permissions, 'inventory.delete'). */
export function can(permissions, permission) {
  return hasPermission(permissions, permission)
}

export function cannot(permissions, permission) {
  return !hasPermission(permissions, permission)
}

/** True nếu có ÍT NHẤT 1 trong danh sách permission — dùng cho Sidebar Guard
 *  (ẩn cả nhóm khi không còn item con nào hiển thị). */
export function hasAnyPermission(permissions, permissionList = []) {
  if (!Array.isArray(permissionList) || permissionList.length === 0) return true
  return permissionList.some(p => hasPermission(permissions, p))
}
