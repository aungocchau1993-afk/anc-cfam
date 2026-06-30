import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtVNDFull } from '../../lib/formatters'
import { toast } from 'sonner'
import ModalOverlay from '../../components/ui/ModalOverlay'

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtN  = n  => Math.round(n ?? 0).toLocaleString('vi-VN')
const fmtD  = iso => iso ? new Date(iso).toLocaleDateString('vi-VN') : '—'
const fmtDT = iso => iso ? new Date(iso).toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'

function workHours(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null
  const diff = (new Date(checkOut) - new Date(checkIn)) / 3600000
  return diff > 0 ? diff.toFixed(1) + 'h' : null
}

function thisMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

function todayDate() {
  return new Date().toISOString().slice(0,10)
}

// ── Sub-components ─────────────────────────────────────────────────────────

// Badge trạng thái ứng tiền
function AdvanceBadge({ status }) {
  const cfg = {
    pending:  { cls: 'bg-cyellow/15 border-cyellow/40 text-cyellow',  label: 'Chờ duyệt' },
    approved: { cls: 'bg-cgreen/15  border-cgreen/40  text-cgreen',   label: 'Đã duyệt'  },
    rejected: { cls: 'bg-cred/15    border-cred/40    text-cred',     label: 'Từ chối'   },
  }[status] || { cls: 'border-slate-600 text-slate-400', label: status }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
}

// Badge trạng thái bảng lương
function SalaryBadge({ status }) {
  const cfg = {
    draft:     { cls: 'bg-slate-700 border-slate-600 text-slate-300', label: 'Nháp'     },
    confirmed: { cls: 'bg-cblue/15  border-cblue/40  text-cblue',    label: 'Đã xác nhận' },
    paid:      { cls: 'bg-cgreen/15 border-cgreen/40 text-cgreen',   label: 'Đã chi'   },
  }[status] || { cls: 'border-slate-600 text-slate-400', label: status }
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
}

// Modal thêm / sửa nhân viên
function StaffModal({ staff, onClose, onSaved }) {
  const isEdit = !!staff?.id
  const [form, setForm] = useState({
    name:            staff?.name            ?? '',
    phone:           staff?.phone           ?? '',
    position:        staff?.position        ?? '',
    base_salary:     staff?.base_salary     ?? '',
    commission_rate: staff?.commission_rate != null ? (staff.commission_rate * 100) : '',
    joined_at:       staff?.joined_at       ?? todayDate(),
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên nhân viên'); return }
    setSaving(true)
    const row = {
      name:            form.name.trim(),
      phone:           form.phone.trim() || null,
      position:        form.position.trim() || null,
      base_salary:     Number(form.base_salary) || 0,
      commission_rate: (Number(form.commission_rate) || 0) / 100,
      joined_at:       form.joined_at || todayDate(),
    }
    const { error } = isEdit
      ? await supabase.from('staff').update(row).eq('id', staff.id)
      : await supabase.from('staff').insert(row)
    setSaving(false)
    if (error) { toast.error('Lỗi lưu: ' + error.message); return }
    toast.success(isEdit ? 'Đã cập nhật nhân viên' : 'Thêm nhân viên thành công')
    onSaved()
    onClose()
  }

  const iCls = 'w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-base text-[#1e293b] outline-none focus:border-cblue placeholder:text-slate-600 min-h-[52px] rounded-xl'
  const lCls = 'text-xs text-slate-400 font-semibold mb-1'

  return (
    <ModalOverlay onClose={onClose} className="bg-black/80">
      <div className="bg-[#ffffff] border border-slate-700 rounded-2xl w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold text-[#1e293b]">{isEdit ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên mới'}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-cred transition-colors text-lg">×</button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <div className={lCls}>Họ tên *</div>
              <input className={iCls} placeholder="Nguyễn Văn A" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div>
              <div className={lCls}>Số điện thoại</div>
              <input className={iCls} placeholder="0901..." value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
            </div>
            <div>
              <div className={lCls}>Chức vụ</div>
              <input className={iCls} placeholder="Nhân viên bán hàng" value={form.position} onChange={e => setForm(f => ({...f, position: e.target.value}))} />
            </div>
            <div>
              <div className={lCls}>Lương cứng (₫/tháng)</div>
              <input className={iCls} type="number" placeholder="5000000" value={form.base_salary} onChange={e => setForm(f => ({...f, base_salary: e.target.value}))} />
            </div>
            <div>
              <div className={lCls}>Hoa hồng doanh thu (%)</div>
              <input className={iCls} type="number" step="0.1" placeholder="2.5" value={form.commission_rate} onChange={e => setForm(f => ({...f, commission_rate: e.target.value}))} />
            </div>
            <div>
              <div className={lCls}>Ngày vào làm</div>
              <input className={iCls} type="date" value={form.joined_at} onChange={e => setForm(f => ({...f, joined_at: e.target.value}))} />
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800 transition-colors">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-xl bg-cblue text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-50">
            {saving ? 'Đang lưu…' : (isEdit ? 'Cập nhật' : 'Thêm mới')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// Modal tạo phiếu ứng tiền
function AdvanceModal({ staffList, onClose, onSaved }) {
  const [form, setForm] = useState({ staff_id: '', amount: '', reason: '' })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.staff_id) { toast.error('Chọn nhân viên'); return }
    if (!Number(form.amount)) { toast.error('Nhập số tiền ứng'); return }
    setSaving(true)
    const { error } = await supabase.from('advances').insert({
      staff_id: form.staff_id,
      amount:   Number(form.amount),
      reason:   form.reason.trim() || null,
      status:   'pending',
    })
    setSaving(false)
    if (error) { toast.error('Lỗi: ' + error.message); return }
    toast.success('Đã tạo phiếu ứng tiền')
    onSaved(); onClose()
  }

  const iCls = 'w-full rounded-lg bg-slate-900 border border-slate-700 px-4 py-3 text-base text-[#1e293b] outline-none focus:border-cblue min-h-[52px] rounded-xl'

  return (
    <ModalOverlay onClose={onClose} className="bg-black/80">
      <div className="bg-[#ffffff] border border-slate-700 rounded-2xl w-full max-w-sm mx-4 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold text-[#1e293b]">Tạo phiếu ứng tiền</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-cred text-lg">×</button>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div>
            <div className="text-xs text-slate-400 font-semibold mb-1">Nhân viên *</div>
            <select className={iCls} value={form.staff_id} onChange={e => setForm(f => ({...f, staff_id: e.target.value}))}>
              <option value="">-- Chọn nhân viên --</option>
              {staffList.filter(s => s.is_active).map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.position ? ` · ${s.position}` : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold mb-1">Số tiền ứng (₫) *</div>
            <input className={iCls} type="number" placeholder="500000" value={form.amount} onChange={e => setForm(f => ({...f, amount: e.target.value}))} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-semibold mb-1">Lý do</div>
            <input className={iCls} placeholder="Tiền nhà, tiền xe…" value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))} />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 text-sm hover:bg-slate-800">Hủy</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 rounded-xl bg-cyellow text-[#ffffff] text-sm font-black hover:brightness-110 disabled:opacity-50">
            {saving ? 'Đang tạo…' : 'Tạo phiếu'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Tab: Tổng Quan ─────────────────────────────────────────────────────────

function TabOverview({ staffList, attendanceToday, pendingAdvances, onGoTab }) {
  const checkedIn = attendanceToday.filter(a => a.check_in && !a.check_out)
  const checkedOut = attendanceToday.filter(a => a.check_in && a.check_out)

  return (
    <div className="flex flex-col gap-4">
      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng NV',     value: staffList.filter(s=>s.is_active).length, icon: '👥', color: 'text-cblue',   border: 'border-cblue/25'  },
          { label: 'Đang làm',    value: checkedIn.length,                         icon: '🟢', color: 'text-cgreen',  border: 'border-cgreen/25' },
          { label: 'Đã về',       value: checkedOut.length,                        icon: '🏠', color: 'text-slate-300',border: 'border-slate-700' },
          { label: 'Ứng tiền chờ',value: pendingAdvances.length,                  icon: '⏳', color: 'text-cyellow', border: 'border-cyellow/25'},
        ].map(m => (
          <div key={m.label} className={`bg-[#ffffff] border ${m.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
            <span className="text-xl">{m.icon}</span>
            <div>
              <div className={`text-2xl font-black tabular-nums ${m.color}`}>{m.value}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Đang làm việc hôm nay */}
        <div className="bg-[#ffffff] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-200">🟢 Đang làm việc hôm nay</span>
            <button onClick={() => onGoTab('attendance')} className="text-xs text-cblue hover:underline">Xem tất cả</button>
          </div>
          {checkedIn.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">Chưa có nhân viên check-in</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {checkedIn.map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-[#1e293b]">{a.staff?.name}</div>
                    <div className="text-xs text-slate-500">{a.staff?.position || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-cgreen font-mono">Check-in {fmtDT(a.check_in)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ứng tiền chờ duyệt */}
        <div className="bg-[#ffffff] border border-slate-800 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <span className="font-semibold text-sm text-slate-200">⏳ Ứng tiền chờ duyệt</span>
            <button onClick={() => onGoTab('advances')} className="text-xs text-cblue hover:underline">Xem tất cả</button>
          </div>
          {pendingAdvances.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-sm">Không có phiếu chờ duyệt</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {pendingAdvances.slice(0,5).map(a => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-[#1e293b]">{a.staff?.name}</div>
                    <div className="text-xs text-slate-500">{a.reason || '—'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-cyellow tabular-nums">{fmtN(a.amount)} ₫</div>
                    <div className="text-[10px] text-slate-500">{fmtD(a.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Tab: Nhân Viên ─────────────────────────────────────────────────────────

function TabStaff({ staffList, onReload }) {
  const [editStaff, setEditStaff] = useState(null)
  const [showAdd,   setShowAdd]   = useState(false)

  async function toggleActive(s) {
    const { error } = await supabase.from('staff').update({ is_active: !s.is_active }).eq('id', s.id)
    if (error) toast.error(error.message)
    else { toast.success(s.is_active ? 'Đã vô hiệu hóa' : 'Đã kích hoạt'); onReload() }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">{staffList.filter(s=>s.is_active).length} nhân viên đang hoạt động</span>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cblue text-white text-sm font-bold hover:brightness-110 transition-all">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Thêm nhân viên
        </button>
      </div>

      <div className="bg-[#ffffff] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                {['Nhân viên', 'Điện thoại', 'Chức vụ', 'Lương cứng', 'Hoa hồng', 'Ngày vào', 'Trạng thái', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffList.length === 0 ? (
                <tr><td colSpan={8} className="py-16 text-center text-slate-500 text-sm">Chưa có nhân viên nào</td></tr>
              ) : staffList.map(s => (
                <tr key={s.id} className={`border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-sm text-[#1e293b]">{s.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{s.id.slice(-8).toUpperCase()}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-400">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{s.position || '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-cgreen tabular-nums">{fmtN(s.base_salary)} ₫</td>
                  <td className="px-4 py-3 text-sm text-cpurple tabular-nums">{((s.commission_rate || 0)*100).toFixed(1)}%</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{fmtD(s.joined_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.is_active ? 'bg-cgreen/15 border-cgreen/40 text-cgreen' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                      {s.is_active ? 'Hoạt động' : 'Nghỉ'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditStaff(s)} className="text-xs text-cblue hover:underline">Sửa</button>
                      <button onClick={() => toggleActive(s)} className={`text-xs hover:underline ${s.is_active ? 'text-cred' : 'text-cgreen'}`}>
                        {s.is_active ? 'Vô hiệu' : 'Kích hoạt'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd    && <StaffModal onClose={() => setShowAdd(false)} onSaved={onReload} />}
      {editStaff  && <StaffModal staff={editStaff} onClose={() => setEditStaff(null)} onSaved={onReload} />}
    </div>
  )
}

// ── Tab: Chấm Công ─────────────────────────────────────────────────────────

function TabAttendance({ staffList }) {
  const [date,       setDate]       = useState(todayDate())
  const [attendance, setAttendance] = useState([])
  const [loading,    setLoading]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('*, staff(name, position)')
      .eq('work_date', date)
      .order('check_in', { ascending: true })
    setAttendance(data || [])
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  async function handleCheckIn(staffId) {
    const existing = attendance.find(a => a.staff_id === staffId)
    if (existing) {
      // Check-out
      const { error } = await supabase.from('attendance').update({ check_out: new Date().toISOString() }).eq('id', existing.id)
      if (error) { toast.error(error.message); return }
      toast.success('Check-out thành công')
    } else {
      // Check-in
      const { error } = await supabase.from('attendance').insert({ staff_id: staffId, work_date: date, check_in: new Date().toISOString() })
      if (error) { toast.error(error.message); return }
      toast.success('Check-in thành công')
    }
    load()
  }

  const activeStaff = staffList.filter(s => s.is_active)

  return (
    <div className="flex flex-col gap-4">
      {/* Date picker + stats */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">Ngày</span>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-[#1e293b] outline-none focus:border-cblue" />
        </div>
        <button onClick={() => setDate(todayDate())} className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 hover:border-cblue hover:text-cblue transition-all">Hôm nay</button>
        <div className="flex gap-2 ml-auto text-xs text-slate-500">
          <span className="text-cgreen font-bold">{attendance.filter(a=>a.check_in&&!a.check_out).length} đang làm</span>
          <span>·</span>
          <span className="text-slate-400">{attendance.filter(a=>a.check_in&&a.check_out).length} đã về</span>
        </div>
      </div>

      {/* Quick check-in panel cho ngày hôm nay */}
      {date === todayDate() && (
        <div className="bg-[#ffffff] border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">Check-in / Check-out nhanh</div>
          <div className="flex flex-wrap gap-2">
            {activeStaff.map(s => {
              const rec = attendance.find(a => a.staff_id === s.id)
              const checkedIn  = rec?.check_in && !rec?.check_out
              const checkedOut = rec?.check_in && rec?.check_out
              return (
                <button key={s.id} onClick={() => handleCheckIn(s.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    checkedOut  ? 'bg-slate-800/60 border-slate-700 text-slate-500 cursor-default' :
                    checkedIn   ? 'bg-cred/15 border-cred/40 text-cred hover:bg-cred/25' :
                                  'bg-cgreen/15 border-cgreen/40 text-cgreen hover:bg-cgreen/25'
                  }`}
                  disabled={checkedOut}
                >
                  <span>{checkedOut ? '✅' : checkedIn ? '🔴' : '🟢'}</span>
                  <span>{s.name}</span>
                  <span className="text-[10px] opacity-70">{checkedOut ? 'Đã về' : checkedIn ? 'Check-out' : 'Check-in'}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Bảng chấm công */}
      <div className="bg-[#ffffff] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="font-semibold text-sm text-slate-200">Bảng chấm công ngày {new Date(date).toLocaleDateString('vi-VN')}</span>
          {loading && <span className="text-xs text-slate-500">Đang tải…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                {['Nhân viên', 'Chức vụ', 'Giờ vào', 'Giờ ra', 'Số giờ', 'Ghi chú'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500 text-sm">Chưa có dữ liệu chấm công ngày này</td></tr>
              ) : attendance.map(a => (
                <tr key={a.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-[#1e293b]">{a.staff?.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-400">{a.staff?.position || '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-cgreen">{a.check_in ? new Date(a.check_in).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-400">{a.check_out ? new Date(a.check_out).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : <span className="text-cyellow text-xs">Chưa ra</span>}</td>
                  <td className="px-4 py-3 text-sm font-bold text-cblue">{workHours(a.check_in, a.check_out) || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{a.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Ứng Tiền ──────────────────────────────────────────────────────────

function TabAdvances({ staffList, pendingAdvances, onReload }) {
  const [showAdd,  setShowAdd]  = useState(false)
  const [filter,   setFilter]   = useState('all') // 'all' | 'pending' | 'approved' | 'rejected'
  const [advances, setAdvances] = useState([])
  const [loading,  setLoading]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('advances').select('*, staff(name, position)').order('created_at', { ascending: false })
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setAdvances(data || [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleApprove(id) {
    const { error } = await supabase.from('advances').update({ status: 'approved', approved_at: new Date().toISOString() }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Đã duyệt phiếu ứng tiền')
    load(); onReload()
  }

  async function handleReject(id) {
    const { error } = await supabase.from('advances').update({ status: 'rejected' }).eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Đã từ chối phiếu ứng tiền')
    load(); onReload()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-1.5">
          {[['all','Tất cả'],['pending','Chờ duyệt'],['approved','Đã duyệt'],['rejected','Từ chối']].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                filter === v ? 'bg-cblue/20 border-cblue text-cblue' : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-cblue/50'
              }`}>{l}{v==='pending' && pendingAdvances.length > 0 ? ` (${pendingAdvances.length})` : ''}</button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyellow text-[#ffffff] text-sm font-black hover:brightness-110 transition-all">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
          Tạo phiếu ứng
        </button>
      </div>

      <div className="bg-[#ffffff] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-800/50">
                {['Nhân viên', 'Số tiền', 'Lý do', 'Ngày tạo', 'Trạng thái', 'Hành động'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500 text-sm">Đang tải…</td></tr>
              ) : advances.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500 text-sm">Không có phiếu ứng tiền</td></tr>
              ) : advances.map(a => (
                <tr key={a.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-semibold text-[#1e293b]">{a.staff?.name}</div>
                    <div className="text-xs text-slate-500">{a.staff?.position || '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-black text-cyellow tabular-nums">{fmtN(a.amount)} ₫</td>
                  <td className="px-4 py-3 text-sm text-slate-400 max-w-[160px] truncate">{a.reason || '—'}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDT(a.created_at)}</td>
                  <td className="px-4 py-3"><AdvanceBadge status={a.status} /></td>
                  <td className="px-4 py-3">
                    {a.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleApprove(a.id)} className="px-2.5 py-1 rounded-lg bg-cgreen/15 border border-cgreen/40 text-cgreen text-xs font-bold hover:bg-cgreen/25 transition-all">Duyệt</button>
                        <button onClick={() => handleReject(a.id)}  className="px-2.5 py-1 rounded-lg bg-cred/15   border border-cred/40   text-cred   text-xs font-bold hover:bg-cred/25   transition-all">Từ chối</button>
                      </div>
                    ) : <span className="text-xs text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && <AdvanceModal staffList={staffList} onClose={() => setShowAdd(false)} onSaved={load} />}
    </div>
  )
}

// ── Tab: Bảng Lương ────────────────────────────────────────────────────────

function TabPayroll({ staffList }) {
  const [month,    setMonth]    = useState(thisMonth())
  const [results,  setResults]  = useState([])
  const [records,  setRecords]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [calcing,  setCalcing]  = useState(false)

  const loadRecords = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('salary_records')
      .select('*, staff(name, position)')
      .eq('month', month)
      .order('created_at', { ascending: true })
    setRecords(data || [])
    setLoading(false)
  }, [month])

  useEffect(() => { loadRecords() }, [loadRecords])

  async function handleCalculate() {
    const active = staffList.filter(s => s.is_active)
    if (!active.length) { toast.error('Chưa có nhân viên nào'); return }
    setCalcing(true)
    const calcs = []
    for (const s of active) {
      const { data, error } = await supabase.rpc('calculate_monthly_salary', { p_staff_id: s.id, p_month: month })
      if (!error && data && !data.error) calcs.push(data)
    }
    setResults(calcs)
    setCalcing(false)
    if (!calcs.length) toast.error('Không tính được lương (kiểm tra RPC trong Supabase)')
  }

  async function handleConfirm(calc) {
    const { error } = await supabase.from('salary_records').upsert({
      staff_id:          calc.staff_id,
      month,
      base_salary:       calc.base_salary,
      commission_amount: calc.commission,
      advance_deduction: calc.advance_deduction,
      total_salary:      calc.total_salary,
      status:            'confirmed',
    }, { onConflict: 'staff_id,month' })
    if (error) { toast.error(error.message); return }
    toast.success(`Đã xác nhận lương cho ${calc.staff_name}`)
    loadRecords()
  }

  async function handleMarkPaid(rec) {
    const { error } = await supabase.from('salary_records').update({ status: 'paid', paid_amount: rec.total_salary }).eq('id', rec.id)
    if (error) { toast.error(error.message); return }
    toast.success('Đã đánh dấu đã chi lương')
    loadRecords()
  }

  const displayData = records.length > 0 ? records : []

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold">Tháng</span>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-1.5 text-sm text-[#1e293b] outline-none focus:border-cblue" />
        </div>
        <button onClick={handleCalculate} disabled={calcing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cpurple/20 border border-cpurple/40 text-cpurple text-sm font-bold hover:bg-cpurple/30 transition-all disabled:opacity-50">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M9 7h6M9 12h6M9 17h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2"/></svg>
          {calcing ? 'Đang tính…' : 'Tính lương'}
        </button>
      </div>

      {/* Preview kết quả tính lương mới */}
      {results.length > 0 && (
        <div className="bg-[#ffffff] border border-cpurple/30 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-cpurple/20 bg-cpurple/5">
            <span className="font-semibold text-sm text-cpurple">✨ Kết quả tính lương tháng {month}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  {['Nhân viên', 'Lương cứng', 'Hoa hồng', 'Khấu trừ ứng', 'THỰC NHẬN', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.staff_id} className="border-b border-slate-800/60 last:border-0">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-[#1e293b]">{r.staff_name}</div>
                      <div className="text-xs text-slate-500">{r.position || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-300 tabular-nums">{fmtN(r.base_salary)} ₫</td>
                    <td className="px-4 py-3 text-sm font-mono text-cgreen tabular-nums">+{fmtN(r.commission)} ₫</td>
                    <td className="px-4 py-3 text-sm font-mono text-cred tabular-nums">{r.advance_deduction > 0 ? `-${fmtN(r.advance_deduction)} ₫` : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-base font-black text-cblue tabular-nums">{fmtN(r.total_salary)} ₫</span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleConfirm(r)}
                        className="px-3 py-1 rounded-lg bg-cblue/15 border border-cblue/40 text-cblue text-xs font-bold hover:bg-cblue/25 transition-all">
                        Xác nhận
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
            <span>Doanh thu tháng · {results[0] ? `${fmtN(results[0].total_orders)} ₫` : '—'}</span>
            <span className="font-bold text-slate-300">Tổng chi lương: {fmtN(results.reduce((s,r)=>s+r.total_salary,0))} ₫</span>
          </div>
        </div>
      )}

      {/* Bảng lương đã xác nhận */}
      <div className="bg-[#ffffff] border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800">
          <span className="font-semibold text-sm text-slate-200">Bảng lương đã xác nhận — tháng {month}</span>
        </div>
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Đang tải…</div>
        ) : displayData.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">Chưa có bảng lương nào — nhấn "Tính lương" để tạo</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  {['Nhân viên', 'Lương cứng', 'Hoa hồng', 'Khấu trừ', 'Thực nhận', 'Trạng thái', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayData.map(rec => (
                  <tr key={rec.id} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-[#1e293b]">{rec.staff?.name}</div>
                      <div className="text-xs text-slate-500">{rec.staff?.position || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-300 tabular-nums">{fmtN(rec.base_salary)} ₫</td>
                    <td className="px-4 py-3 text-sm font-mono text-cgreen tabular-nums">+{fmtN(rec.commission_amount)} ₫</td>
                    <td className="px-4 py-3 text-sm font-mono text-cred tabular-nums">{rec.advance_deduction > 0 ? `-${fmtN(rec.advance_deduction)} ₫` : '—'}</td>
                    <td className="px-4 py-3"><span className="text-base font-black text-cblue tabular-nums">{fmtN(rec.total_salary)} ₫</span></td>
                    <td className="px-4 py-3"><SalaryBadge status={rec.status} /></td>
                    <td className="px-4 py-3">
                      {rec.status === 'confirmed' && (
                        <button onClick={() => handleMarkPaid(rec)}
                          className="px-3 py-1 rounded-lg bg-cgreen/15 border border-cgreen/40 text-cgreen text-xs font-bold hover:bg-cgreen/25 transition-all">
                          Đánh dấu đã chi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main HRM Page ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',    icon: '📊', label: 'Tổng Quan'  },
  { id: 'staff',       icon: '👥', label: 'Nhân Viên'  },
  { id: 'attendance',  icon: '🕐', label: 'Chấm Công'  },
  { id: 'advances',    icon: '💸', label: 'Ứng Tiền'   },
  { id: 'payroll',     icon: '💰', label: 'Bảng Lương' },
]

export default function HRM() {
  const [tab,              setTab]              = useState('overview')
  const [staffList,        setStaffList]        = useState([])
  const [attendanceToday,  setAttendanceToday]  = useState([])
  const [pendingAdvances,  setPendingAdvances]  = useState([])
  const realtimeRef = useRef(null)

  const loadStaff = useCallback(async () => {
    const { data } = await supabase.from('staff').select('*').order('name')
    setStaffList(data || [])
  }, [])

  const loadAttendanceToday = useCallback(async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*, staff(name, position)')
      .eq('work_date', todayDate())
    setAttendanceToday(data || [])
  }, [])

  const loadPendingAdvances = useCallback(async () => {
    const { data } = await supabase
      .from('advances')
      .select('*, staff(name, position)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    setPendingAdvances(data || [])
  }, [])

  function reloadAll() {
    loadStaff()
    loadAttendanceToday()
    loadPendingAdvances()
  }

  useEffect(() => {
    reloadAll()

    // Realtime: lắng nghe phiếu ứng tiền mới
    realtimeRef.current = supabase
      .channel('hrm-advances')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'advances' }, payload => {
        loadPendingAdvances()
        if (payload.eventType === 'INSERT') {
          toast('💸 Có phiếu ứng tiền mới chờ duyệt!', { icon: '⏳' })
        }
      })
      .subscribe()

    return () => { realtimeRef.current?.unsubscribe() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendingCount = pendingAdvances.length

  return (
    <div className="p-4 sm:p-6 w-full flex flex-col gap-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#1e293b]">👔 Quản lý Nhân sự</h1>
        <p className="text-xs text-slate-500 mt-0.5">Chấm công · Ứng tiền · Tính lương tự động</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all relative ${
              tab === t.id
                ? 'bg-[#ffffff] border border-slate-700 text-[#1e293b] shadow-sm'
                : 'text-slate-500 hover:text-slate-300'
            }`}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'advances' && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-cyellow text-[#ffffff] text-[9px] font-black flex items-center justify-center px-1">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview'   && <TabOverview   staffList={staffList} attendanceToday={attendanceToday} pendingAdvances={pendingAdvances} onGoTab={setTab} />}
      {tab === 'staff'      && <TabStaff      staffList={staffList} onReload={loadStaff} />}
      {tab === 'attendance' && <TabAttendance staffList={staffList} />}
      {tab === 'advances'   && <TabAdvances   staffList={staffList} pendingAdvances={pendingAdvances} onReload={loadPendingAdvances} />}
      {tab === 'payroll'    && <TabPayroll    staffList={staffList} />}
    </div>
  )
}
