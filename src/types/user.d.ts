// Chuẩn hoá kiểu dữ liệu Role / Profile / CurrentUser (Sprint 1).
//
// Dự án ANC-CFAM hiện là JavaScript thuần (không có TypeScript compiler/tsconfig).
// File .d.ts này KHÔNG được build/biên dịch — nó chỉ là ambient type declaration
// dùng cho gợi ý IDE (IntelliSense) khi hover/import trong các file .js/.jsx qua
// JSDoc (`@type {import('../types/user').Profile}`), không thay đổi build pipeline.

/** Vai trò hệ thống — đọc từ bảng `roles`, KHÔNG hardcode trong React. */
export interface Role {
  id: string
  code: string          // 'SUPER_ADMIN' | 'OWNER' | 'MANAGER' | 'CASHIER' | 'WAREHOUSE' | 'SALE' | 'ACCOUNTANT' | 'DEVELOPER'
  name: string
  description: string | null
  isSystem: boolean
  createdAt: string
}

/** Hồ sơ nghiệp vụ — bảng `profiles`, tách khỏi auth.users. */
export interface Profile {
  id: string
  authUserId: string
  fullName: string | null
  phone: string | null
  avatarUrl: string | null
  branchId: string | null   // chưa có bảng branches ở Sprint 1
  roleId: string | null
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

/** Bản ghi phẳng của view `user_profiles` (profile + role + email). */
export interface UserProfileRow extends Profile {
  email: string
  roleCode: string | null
  roleName: string | null
}

/** Shape nạp vào Store sau khi login — dùng bởi useCurrentUser(). */
export interface CurrentUser {
  id: string           // profiles.id
  authUserId: string
  name: string
  email: string
  role: Role | null
  branchId: string | null
  avatar: string | null
  status: 'active' | 'inactive'
}
