import { useState, useEffect } from 'react'
import ModalOverlay from '../ui/ModalOverlay'
import { loadAuditLogs } from '../../lib/supabase'

// ── Nhãn hiển thị thân thiện cho từng field ────────────────────────────────
const FIELD_LABELS = {
  // products
  name:           'Tên hàng',
  sku:            'Mã SKU',
  import_price:   'Giá vốn',
  sell_price:     'Giá bán',
  stock_quantity: 'Tồn kho',
  min_stock:      'Tồn kho tối thiểu',
  unit:           'Đơn vị tính',
  image_url:      'Hình ảnh',
  // orders
  status:         'Trạng thái',
  total_amount:   'Tổng tiền',
  paid_amount:    'Đã thanh toán',
  debt_amount:    'Còn nợ',
  note:           'Ghi chú',
  type:           'Loại đơn',
  order_code:     'Mã đơn',
}

const MONEY_FIELDS = new Set(['import_price','sell_price','total_amount','paid_amount','debt_amount'])
const SKIP_FIELDS  = new Set(['id','user_id','created_at','updated_at','last_used_unit'])

const ACTION_META = {
  INSERT: { label: 'Tạo mới',    bg: 'bg-cgreen/15',  border: 'border-cgreen/30',  dot: 'bg-cgreen',  text: 'text-cgreen'  },
  UPDATE: { label: 'Cập nhật',   bg: 'bg-cblue/10',   border: 'border-cblue/25',   dot: 'bg-cblue',   text: 'text-cblue'   },
  DELETE: { label: 'Đã xoá',     bg: 'bg-cred/10',    border: 'border-cred/25',    dot: 'bg-cred',    text: 'text-cred'    },
}

function fmtVal(field, val) {
  if (val === null || val === undefined || val === '') return '—'
  if (MONEY_FIELDS.has(field)) return Number(val).toLocaleString('vi-VN') + ' ₫'
  if (typeof val === 'boolean') return val ? 'Có' : 'Không'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function fmtTime(iso) {
  const d = new Date(iso)
  return d.toLocaleString('vi-VN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
}

function DiffRow({ field, oldVal, newVal }) {
  const label = FIELD_LABELS[field] || field
  const ov    = fmtVal(field, oldVal)
  const nv    = fmtVal(field, newVal)
  if (ov === nv) return null
  return (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-xs py-1.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 font-medium self-start pt-0.5">{label}</span>
      <div className="rounded px-2 py-1 bg-cred/10 border border-cred/20 text-cred font-mono break-all">{ov}</div>
      <div className="rounded px-2 py-1 bg-cgreen/10 border border-cgreen/20 text-cgreen font-mono break-all">{nv}</div>
    </div>
  )
}

function LogEntry({ log }) {
  const [open, setOpen] = useState(false)
  const meta   = ACTION_META[log.action] || ACTION_META.UPDATE
  const isUpd  = log.action === 'UPDATE'

  // Tính diff các field thay đổi
  const changedFields = isUpd
    ? Object.keys(log.new_data || {}).filter(f => {
        if (SKIP_FIELDS.has(f)) return false
        const ov = (log.old_data || {})[f]
        const nv = (log.new_data || {})[f]
        return JSON.stringify(ov) !== JSON.stringify(nv)
      })
    : []

  return (
    <div className={`rounded-xl border ${meta.border} ${meta.bg} overflow-hidden`}>
      {/* Header hàng */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => isUpd && changedFields.length > 0 && setOpen(o => !o)}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.border} ${meta.text}`}>
          {meta.label}
        </span>
        <span className="text-xs text-slate-400 flex-1">{fmtTime(log.created_at)}</span>
        {isUpd && changedFields.length > 0 && (
          <span className="text-[10px] text-slate-500 mr-1">{changedFields.length} thay đổi</span>
        )}
        {isUpd && changedFields.length > 0 && (
          <svg className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        )}
      </div>

      {/* Chi tiết diff khi expand */}
      {open && isUpd && (
        <div className="px-4 pb-3 border-t border-slate-800/60">
          <div className="grid grid-cols-[120px_1fr_1fr] gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider pt-2 pb-1">
            <span>Trường</span><span className="text-cred">Giá trị cũ</span><span className="text-cgreen">Giá trị mới</span>
          </div>
          {changedFields.map(f => (
            <DiffRow key={f} field={f}
              oldVal={(log.old_data || {})[f]}
              newVal={(log.new_data || {})[f]}
            />
          ))}
        </div>
      )}

      {/* INSERT — hiển thị snapshot */}
      {log.action === 'INSERT' && log.new_data && (
        <div className="px-4 pb-3 border-t border-slate-800/60">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider pt-2 pb-1 font-semibold">Dữ liệu khởi tạo</div>
          {Object.entries(log.new_data)
            .filter(([f]) => !SKIP_FIELDS.has(f) && log.new_data[f] !== null && log.new_data[f] !== '')
            .map(([f, v]) => (
              <div key={f} className="grid grid-cols-[120px_1fr] gap-2 text-xs py-1 border-b border-slate-800 last:border-0">
                <span className="text-slate-400 font-medium">{FIELD_LABELS[f] || f}</span>
                <span className="font-mono text-cgreen break-all">{fmtVal(f, v)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

export default function AuditLogModal({ tableName, recordId, title, onClose }) {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    loadAuditLogs(tableName, recordId).then(data => {
      setLogs(data)
      setLoading(false)
    })
  }, [tableName, recordId])

  return (
    <ModalOverlay onClose={onClose} className="bg-black/80">
      <div className="bg-[#ffffff] border border-slate-700/80 rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div>
            <div className="font-bold text-[#1e293b]">🕒 Lịch sử chỉnh sửa</div>
            {title && <div className="text-xs text-slate-400 mt-0.5">{title}</div>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-cred transition-colors text-lg leading-none">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm gap-2">
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity=".25"/>
                <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Đang tải lịch sử…
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <div className="text-4xl mb-2">📋</div>
              <div className="text-sm">Chưa có lịch sử chỉnh sửa</div>
              <div className="text-xs mt-1 text-slate-600">Trigger sẽ ghi nhận từ lần chỉnh sửa tiếp theo</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {logs.map(log => <LogEntry key={log.id} log={log} />)}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && logs.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-800 shrink-0 flex items-center justify-between">
            <span className="text-xs text-slate-500">{logs.length} mục gần nhất</span>
            <button onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-slate-700 text-slate-400 text-xs hover:text-[#1e293b] transition-colors">
              Đóng
            </button>
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}
