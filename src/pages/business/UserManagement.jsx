import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheck, Plus, Pencil, Trash2, X, Save, LoaderCircle,
  UserRound, Mail, Phone, Building2, ShieldQuestion,
} from 'lucide-react'
import PageHeader from '../../components/ui/PageHeader'
import ModalOverlay from '../../components/ui/ModalOverlay'
import { SkeletonTableBody } from '../../components/ui/Skeleton'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { listUsersWithRoles, updateUser, removeUser } from '../../lib/repositories/userRepository'
import Can from '../../components/permission/Can'
import { PERMISSIONS } from '../../lib/permissions/permissionConstants'

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('vi-VN')
}

const STATUS_CFG = {
  active:   { label: 'Đang hoạt động', cls: 'text-cgreen bg-emerald-50 border-emerald-200' },
  inactive: { label: 'Ngừng hoạt động', cls: 'text-rose-700 bg-rose-50 border-rose-200' },
}

// ── Modal sửa user ────────────────────────────────────────────────────────────
function EditUserModal({ user, roles, onClose, onSaved }) {
  const [fullName, setFullName] = useState(user.fullName || '')
  const [phone,    setPhone]    = useState(user.phone || '')
  const [roleId,   setRoleId]   = useState(user.roleId || '')
  const [status,   setStatus]   = useState(user.status || 'active')
  const [saving,   setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateUser(user.id, {
        fullName: fullName.trim() || null,
        phone:    phone.trim() || null,
        roleId:   roleId || null,
        status,
      })
      toast.success('Đã cập nhật người dùng')
      onSaved(updated)
      onClose()
    } catch (e) {
      toast.error(e.message || 'Không thể cập nhật người dùng')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-white border border-border rounded-2xl w-full max-w-md shadow-cardHover overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 font-bold text-base text-text">
            <ShieldCheck size={18} strokeWidth={2} className="text-cblue" /> Sửa người dùng
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-rose-500 transition-colors flex items-center justify-center">
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3.5">
          <div className="text-[13px] text-muted flex items-center gap-1.5">
            <Mail size={13} strokeWidth={2} /> {user.email}
          </div>

          <div>
            <label className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Họ tên</label>
            <input
              className="input-base w-full"
              value={fullName} onChange={e => setFullName(e.target.value)}
              placeholder="Nhập họ tên"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Số điện thoại</label>
            <input
              className="input-base w-full"
              value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="09xxxxxxxx"
            />
          </div>

          <div>
            <label className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Vai trò</label>
            <select className="input-base w-full" value={roleId} onChange={e => setRoleId(e.target.value)}>
              <option value="">— Chưa gán vai trò —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-1.5">Trạng thái</label>
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button type="button" onClick={() => setStatus('active')}
                className={`flex-1 py-2 text-sm font-bold transition-colors ${status === 'active' ? 'bg-cgreen text-white' : 'bg-surface2 text-muted hover:text-text'}`}>
                Đang hoạt động
              </button>
              <button type="button" onClick={() => setStatus('inactive')}
                className={`flex-1 py-2 text-sm font-bold border-l border-border transition-colors ${status === 'inactive' ? 'bg-rose-500 text-white' : 'bg-surface2 text-muted hover:text-text'}`}>
                Ngừng hoạt động
              </button>
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-muted uppercase tracking-wider block mb-1.5 flex items-center gap-1.5">
              <Building2 size={12} strokeWidth={2.2} /> Chi nhánh
            </label>
            <input disabled value="Chưa có dữ liệu chi nhánh" title="Quản lý đa chi nhánh sẽ có ở sprint sau"
              className="input-base w-full opacity-60 cursor-not-allowed" />
          </div>
        </div>

        <div className="flex gap-3 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-muted text-sm font-bold hover:bg-surface2 transition-colors">
            Huỷ
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-cblue hover:brightness-105 text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-1.5">
            {saving ? <LoaderCircle size={15} strokeWidth={2.2} className="animate-spin" /> : <Save size={15} strokeWidth={2.2} />}
            Lưu thay đổi
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Trang chính ────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const { currentUser } = useCurrentUser()
  const [users,   setUsers]   = useState([])
  const [roles,   setRoles]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [editing, setEditing] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { users: u, roles: r } = await listUsersWithRoles()
      setUsers(u)
      setRoles(r)
    } catch (e) {
      // Bảng profiles/roles có thể chưa được tạo — hiện empty-state thân thiện
      // thay vì crash trang, không ảnh hưởng phần còn lại của app.
      setError(e.message || 'Không tải được danh sách người dùng')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleDelete(user) {
    if (user.id === currentUser?.id) return
    if (!window.confirm(`Xoá hồ sơ của "${user.fullName || user.email}"? Tài khoản đăng nhập vẫn còn, chỉ xoá hồ sơ nghiệp vụ.`)) return
    try {
      await removeUser(user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
      toast.success('Đã xoá người dùng')
    } catch (e) {
      toast.error(e.message || 'Không thể xoá người dùng')
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        icon={ShieldCheck}
        title="Người Dùng"
        subtitle="Quản lý tài khoản, vai trò và trạng thái nhân sự"
        actions={
          <button disabled title="Tạo tài khoản mới thuộc luồng Đăng ký — sẽ bổ sung ở sprint sau"
            className="flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white/10 border border-white/15 text-white/50 text-sm font-semibold cursor-not-allowed">
            <Plus size={16} strokeWidth={2.2} /> Thêm người dùng
          </button>
        }
      />

      <div className="p-6">
        <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-card">
          <div className="px-5 py-3.5 border-b border-border bg-surface2 flex items-center justify-between">
            <div className="text-sm font-bold text-text">Danh sách người dùng</div>
            <span className="tag-blue">{users.length} người dùng</span>
          </div>

          {error ? (
            <div className="flex flex-col items-center justify-center gap-2.5 py-16 text-center px-6">
              <ShieldQuestion size={36} strokeWidth={1.5} className="text-subtle" />
              <div className="font-semibold text-text text-sm">Chưa thể tải danh sách người dùng</div>
              <div className="text-[12px] text-muted max-w-sm">
                Cần chạy migration <code className="font-mono bg-surface2 px-1.5 py-0.5 rounded">profiles_roles_schema.sql</code> trong Supabase SQL Editor trước.
              </div>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-surface2 border-b border-border">
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider">Tên</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider">Email</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider">Vai trò</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider">Chi nhánh</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider">Trạng thái</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-left text-[12px] font-bold text-muted uppercase tracking-wider">Ngày tạo</th>
                    <th className="sticky top-0 z-10 bg-surface2 px-4 py-3 text-center text-[12px] font-bold text-muted uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <SkeletonTableBody rows={6} columns={6} hasImage={false} />
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-muted">
                        <UserRound className="mx-auto mb-2 text-subtle" size={32} />
                        Chưa có người dùng nào
                      </td>
                    </tr>
                  ) : (
                    users.map(u => {
                      const st = STATUS_CFG[u.status] || STATUS_CFG.active
                      const isSelf = u.id === currentUser?.id
                      return (
                        <tr key={u.id} className="hover:bg-surface2 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cblue to-cpurple flex items-center justify-center shrink-0 text-white text-[12px] font-bold">
                                {(u.fullName || u.email).charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-text truncate">{u.fullName || <span className="text-subtle italic">Chưa đặt tên</span>}</div>
                                {isSelf && <div className="text-[11px] text-cblue font-semibold">Bạn</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted">{u.email}</td>
                          <td className="px-4 py-3">
                            {u.roleName
                              ? <span className="tag-blue">{u.roleName}</span>
                              : <span className="text-subtle italic text-[13px]">Chưa gán</span>}
                          </td>
                          <td className="px-4 py-3 text-subtle">—</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-bold ${st.cls}`}>{st.label}</span>
                          </td>
                          <td className="px-4 py-3 text-muted whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <Can permission={PERMISSIONS.USER_UPDATE}>
                                <button onClick={() => setEditing(u)} title="Sửa"
                                  className="w-7 h-7 rounded-md border border-border text-muted hover:border-cblue hover:text-cblue hover:bg-blue-50 transition-colors flex items-center justify-center">
                                  <Pencil size={13} strokeWidth={2} />
                                </button>
                              </Can>
                              <Can permission={PERMISSIONS.USER_DELETE}>
                                <button onClick={() => handleDelete(u)} disabled={isSelf}
                                  title={isSelf ? 'Không thể tự xoá chính mình' : 'Xoá'}
                                  className="w-7 h-7 rounded-md border border-border text-muted hover:border-cred hover:text-cred hover:bg-rose-50 transition-colors flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-muted disabled:hover:bg-transparent">
                                  <Trash2 size={13} strokeWidth={2} />
                                </button>
                              </Can>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {editing && (
        <EditUserModal
          user={editing}
          roles={roles}
          onClose={() => setEditing(null)}
          onSaved={updated => setUsers(prev => prev.map(u => u.id === updated.id
            ? { ...u, ...updated, roleName: roles.find(r => r.id === updated.roleId)?.name ?? null }
            : u))}
        />
      )}
    </div>
  )
}
