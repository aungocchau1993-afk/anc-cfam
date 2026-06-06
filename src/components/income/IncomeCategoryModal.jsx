import { useState } from 'react'
import { toast } from 'sonner'
import { useApp } from '../../context/AppContext'

function EditRow({ cat, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName]       = useState(cat.name)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    if (!name.trim() || name.trim() === cat.name) { setEditing(false); return }
    setLoading(true)
    try {
      await onSave(cat.id, name.trim())
      toast.success(`Đã đổi tên thành "${name.trim()}"`)
      setEditing(false)
    } catch (e) {
      toast.error(e.message || 'Lỗi cập nhật')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Xoá danh mục "${cat.name}"?\nDữ liệu đã nhập vẫn được giữ nhưng sẽ không hiển thị.`)) return
    setLoading(true)
    try {
      await onDelete(cat.id)
      toast.success(`Đã xoá "${cat.name}"`)
    } catch (e) {
      toast.error(e.message || 'Lỗi xoá')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border/50 last:border-0 group">
      <div className="w-5 h-5 rounded bg-cblue/10 flex items-center justify-center shrink-0">
        <span className="text-cblue text-[10px] font-bold">#</span>
      </div>

      {editing ? (
        <input
          autoFocus
          className="flex-1 bg-surface2 border border-cblue rounded-md px-2.5 py-1.5 text-sm text-[#e6edf3] outline-none focus:border-cblue"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
          disabled={loading}
        />
      ) : (
        <span className="flex-1 text-sm text-[#e6edf3]">{cat.name}</span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {editing ? (
          <>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-2.5 py-1 rounded-md bg-cgreen/15 border border-cgreen/30 text-cgreen text-xs font-bold hover:bg-cgreen/25 transition-colors disabled:opacity-50"
            >
              {loading ? '…' : 'Lưu'}
            </button>
            <button
              onClick={() => { setEditing(false); setName(cat.name) }}
              className="px-2.5 py-1 rounded-md bg-surface2 border border-border text-muted text-xs hover:text-[#e6edf3] transition-colors"
            >
              Huỷ
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setEditing(true)}
              title="Đổi tên"
              className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:border-cblue hover:text-cblue hover:bg-cblue/10 transition-colors flex items-center justify-center"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              title="Xoá"
              className="w-7 h-7 rounded-md border border-slate-700 text-slate-400 hover:border-cred hover:text-cred hover:bg-cred/10 transition-colors flex items-center justify-center disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <path d="M9 3h6m-8 5h10m-9 0l.6 12h6.8L16 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function IncomeCategoryModal({ onClose }) {
  const { state, actions } = useApp()
  const cats = state.incomeCategories
  const [newName, setNewName]   = useState('')
  const [adding, setAdding]     = useState(false)

  async function handleAdd() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setAdding(true)
    try {
      await actions.addIncomeCategory(trimmed)
      toast.success(`Đã thêm danh mục "${trimmed}"`)
      setNewName('')
    } catch (e) {
      toast.error(e.message || 'Lỗi thêm danh mục')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <div className="font-bold text-base">⚙️ Danh mục Thu nhập</div>
            <div className="text-xs text-muted mt-0.5">Thêm, sửa tên hoặc xoá danh mục</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors text-sm"
          >×</button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {cats.length === 0 ? (
            <div className="text-center py-8 text-muted text-sm">
              Chưa có danh mục nào. Thêm danh mục bên dưới.
            </div>
          ) : (
            cats.map(cat => (
              <EditRow
                key={cat.id}
                cat={cat}
                onSave={actions.updateIncomeCategory}
                onDelete={actions.removeIncomeCategory}
              />
            ))
          )}
        </div>

        {/* Add new */}
        <div className="px-5 py-4 border-t border-border bg-surface2 rounded-b-2xl shrink-0">
          <div className="text-[11px] text-muted font-semibold uppercase tracking-wide mb-2">+ Thêm danh mục mới</div>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-[#e6edf3] placeholder:text-slate-600 outline-none focus:border-cblue transition-all"
              placeholder="VD: Lương thưởng, Cho thuê..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              disabled={adding}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !newName.trim()}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {adding ? '…' : 'Thêm'}
            </button>
          </div>
          <div className="text-[11px] text-slate-600 mt-2">
            💡 Nhấn Enter để thêm nhanh · Hover vào danh mục để sửa/xoá
          </div>
        </div>
      </div>
    </div>
  )
}
