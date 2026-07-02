/**
 * profileService.js — Data access cho bảng `profiles` (Sprint 1: nền tảng User).
 *
 * QUAN TRỌNG: file này KHÔNG bao giờ đọc/ghi auth.users. Nó chỉ thao tác trên
 * bảng public.profiles (đã tách khỏi Supabase Auth) và join phụ qua view
 * public.user_profiles cho mục đích hiển thị (email).
 */

import { supabase } from '../supabase'

/** @returns {import('../../types/user').Profile} */
function profileToCamel(row) {
  if (!row) return null
  return {
    id:         row.id,
    authUserId: row.auth_user_id,
    fullName:   row.full_name,
    phone:      row.phone,
    avatarUrl:  row.avatar_url,
    branchId:   row.branch_id,
    roleId:     row.role_id,
    status:     row.status ?? 'active',
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
  }
}

/** @returns {import('../../types/user').UserProfileRow} */
function userProfileRowToCamel(row) {
  return {
    ...profileToCamel(row),
    email:    row.email,
    roleCode: row.role_code,
    roleName: row.role_name,
  }
}

function profileToSnake(patch) {
  const out = {}
  if ('fullName'  in patch) out.full_name  = patch.fullName || null
  if ('phone'     in patch) out.phone      = patch.phone || null
  if ('avatarUrl' in patch) out.avatar_url = patch.avatarUrl || null
  if ('branchId'  in patch) out.branch_id  = patch.branchId || null
  if ('roleId'    in patch) out.role_id    = patch.roleId || null
  if ('status'    in patch) out.status     = patch.status || 'active'
  return out
}

/** Lấy profile theo auth_user_id (1 auth user = 1 profile). */
export async function loadProfileByAuthUserId(authUserId) {
  if (!supabase || !authUserId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  if (error) throw error
  return profileToCamel(data)
}

/**
 * Lấy profile của 1 auth user — nếu chưa có (lần đăng nhập đầu tiên sau khi
 * migration được chạy) thì tự tạo với giá trị mặc định. Không đụng auth.users,
 * không cần trigger DB — toàn bộ xử lý ở application layer.
 */
export async function getOrCreateProfile(authUserId, defaults = {}) {
  if (!supabase || !authUserId) return null

  const existing = await loadProfileByAuthUserId(authUserId)
  if (existing) return existing

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      auth_user_id: authUserId,
      full_name:    defaults.fullName ?? null,
      avatar_url:   defaults.avatarUrl ?? null,
      status:       'active',
    })
    .select()
    .single()
  if (error) throw error
  return profileToCamel(data)
}

/** Danh sách toàn bộ user cho trang User Management (join role + email). */
export async function loadUserProfiles() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(userProfileRowToCamel)
}

/** Sửa profile — full_name/phone/avatar_url/branch_id/role_id/status. */
export async function updateProfile(id, patch) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .update(profileToSnake(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return profileToCamel(data)
}

/** Xoá profile (KHÔNG xoá auth.users — tài khoản đăng nhập vẫn còn nguyên). */
export async function deleteProfile(id) {
  if (!supabase) return
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) throw error
}
