/**
 * roleService.js — Data access cho bảng `roles` (Sprint 1: nền tảng Role).
 *
 * Role được seed sẵn trong DB (xem supabase/migrations/profiles_roles_schema.sql),
 * KHÔNG hardcode danh sách role trong React — luôn đọc từ đây.
 */

import { supabase } from '../supabase'

/** @returns {import('../../types/user').Role} */
function roleToCamel(row) {
  return {
    id:          row.id,
    code:        row.code,
    name:        row.name,
    description: row.description,
    isSystem:    row.is_system ?? true,
    createdAt:   row.created_at,
  }
}

/** Lấy toàn bộ role hệ thống, sắp theo tên. */
export async function loadRoles() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return (data || []).map(roleToCamel)
}

/** Lấy 1 role theo id — dùng khi cần resolve role của 1 profile đơn lẻ. */
export async function getRoleById(roleId) {
  if (!supabase || !roleId) return null
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .eq('id', roleId)
    .maybeSingle()
  if (error) throw error
  return data ? roleToCamel(data) : null
}
