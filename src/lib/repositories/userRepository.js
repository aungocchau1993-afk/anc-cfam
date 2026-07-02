/**
 * userRepository.js — Tầng tổng hợp dữ liệu cho trang User Management.
 *
 * Không gọi Supabase trực tiếp — chỉ điều phối profileService + roleService,
 * để UserManagement.jsx (page) không tự viết query.
 */

import { loadUserProfiles, updateProfile, deleteProfile } from '../services/profileService'
import { loadRoles } from '../services/roleService'

/** Danh sách user (đã join role + email) + danh sách role để render dropdown chọn. */
export async function listUsersWithRoles() {
  const [users, roles] = await Promise.all([loadUserProfiles(), loadRoles()])
  return { users, roles }
}

/** Sửa 1 user — nhận patch dạng camelCase (fullName/phone/roleId/branchId/status). */
export async function updateUser(id, patch) {
  return updateProfile(id, patch)
}

/** Xoá profile của 1 user (không đụng tài khoản đăng nhập auth.users). */
export async function removeUser(id) {
  return deleteProfile(id)
}
