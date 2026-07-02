import { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { Bell, Package, ShoppingBag, Info, ArrowRight } from 'lucide-react'

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtRelTime(iso) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Vừa xong'
  if (mins < 60)  return `${mins} phút trước`
  if (hours < 24) return `${hours} giờ trước`
  return `${days} ngày trước`
}

const TYPE_CONFIG = {
  order: { icon: ShoppingBag, color: 'text-cblue',   bg: 'bg-cblue/10',   border: 'border-cblue/20',   label: 'Đơn hàng',  nav: 'orders'   },
  stock: { icon: Package,     color: 'text-cyellow', bg: 'bg-cyellow/10', border: 'border-cyellow/20', label: 'Tồn kho',   nav: 'products' },
  info:  { icon: Info,        color: 'text-cgreen',  bg: 'bg-cgreen/10',  border: 'border-cgreen/20',  label: 'Thông tin', nav: null       },
}

const LOW_STOCK_THRESHOLD = 10

// ── Component ────────────────────────────────────────────────────────────────
export default function NotificationBell({ onNavigate }) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const [open,          setOpen]          = useState(false)
  const [loading,       setLoading]       = useState(false)
  const panelRef   = useRef(null)
  const mountedRef = useRef(true)

  // Sync unreadCount mỗi khi notifications thay đổi
  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.is_read).length)
  }, [notifications])

  // ── Load ban đầu từ DB ────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!supabase) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (data && mountedRef.current) setNotifications(data)
  }, [])

  // ── Upsert thông báo — dùng dedup_key để chặn duplicate ──────────────────
  const pushNotification = useCallback(async ({ type, message, meta = {}, dedupKey }) => {
    if (!supabase) return
    const key = dedupKey || `${type}_${Date.now()}`

    // Optimistic: thêm vào local state ngay lập tức
    const tempId = `temp_${key}`
    setNotifications(prev => {
      if (prev.some(n => n.dedup_key === key || n.id === tempId)) return prev
      return [{
        id: tempId, type, message, meta,
        dedup_key: key, is_read: false,
        created_at: new Date().toISOString(),
      }, ...prev]
    })

    // Persist vào DB — upsert với dedup_key, ignore nếu đã tồn tại
    const { data } = await supabase
      .from('notifications')
      .upsert({ type, message, meta, dedup_key: key }, { onConflict: 'dedup_key', ignoreDuplicates: true })
      .select()
      .single()

    // Thay thế temp record bằng record thật từ DB
    if (data && mountedRef.current) {
      setNotifications(prev => prev.map(n => n.id === tempId ? data : n))
    }
  }, [])

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return
    mountedRef.current = true
    loadNotifications()

    // 1. Đơn hàng mới
    const orderCh = supabase
      .channel('bell-orders')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row  = payload.new
        const name = row.customer_name || 'Khách lẻ'
        const amt  = Number(row.total_amount || 0).toLocaleString('vi-VN')
        const msg  = `Đơn mới từ ${name} — ${amt}đ`
        pushNotification({
          type: 'order', message: msg,
          meta: { order_id: row.id, customer_name: name, total: row.total_amount },
          dedupKey: `order_${row.id}`,
        })
        toast.info(msg, { icon: '🛍️', duration: 4000 })
      })
      .subscribe()

    // 2. Tồn kho sắp hết / hết hàng
    const stockCh = supabase
      .channel('bell-stock')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, (payload) => {
        const row     = payload.new
        const prev    = payload.old
        const qty     = row.stock_quantity ?? 0
        const prevQty = prev?.stock_quantity ?? qty + 1
        if (qty <= LOW_STOCK_THRESHOLD && prevQty > LOW_STOCK_THRESHOLD) {
          const msg = qty <= 0
            ? `Hết hàng: ${row.name}`
            : `Sắp hết: ${row.name} (còn ${qty} ${row.unit || 'sp'})`
          pushNotification({
            type: 'stock', message: msg,
            meta: { product_id: row.id, product_name: row.name, qty },
            dedupKey: `stock_${row.id}_${qty}`,
          })
          toast.warning(msg, { icon: qty <= 0 ? '🚨' : '⚠️', duration: 5000 })
        }
      })
      .subscribe()

    // 3. Lắng nghe bảng notifications — event-driven, KHÔNG reload toàn bộ
    const notifCh = supabase
      .channel('bell-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        if (!mountedRef.current) return
        const n = payload.new
        setNotifications(prev => {
          // Bỏ qua nếu đã có (từ optimistic update hoặc dedup)
          if (prev.some(x => x.id === n.id || (n.dedup_key && x.dedup_key === n.dedup_key))) return prev
          return [n, ...prev]
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, (payload) => {
        if (!mountedRef.current) return
        setNotifications(prev => prev.map(x => x.id === payload.new.id ? payload.new : x))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, (payload) => {
        if (!mountedRef.current) return
        setNotifications(prev => prev.filter(x => x.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      mountedRef.current = false
      supabase.removeChannel(orderCh)
      supabase.removeChannel(stockCh)
      supabase.removeChannel(notifCh)
    }
  }, [loadNotifications, pushNotification])

  // ── Khi mở panel → tự động mark tất cả là đã đọc ───────────────────────
  useEffect(() => {
    if (!open || !supabase) return
    const unreadIds = notifications
      .filter(n => !n.is_read && !String(n.id).startsWith('temp_'))
      .map(n => n.id)
    // Cập nhật local state ngay lập tức
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    // Persist DB (không cần await — fire and forget)
    if (unreadIds.length) {
      supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Đóng khi click ngoài ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // ── Actions ───────────────────────────────────────────────────────────────
  async function markRead(id) {
    // Luôn cập nhật local state ngay lập tức (kể cả temp ID)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    // Chỉ gọi DB nếu đã có UUID thật
    if (!supabase || String(id).startsWith('temp_')) return
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  async function markAllRead() {
    if (!supabase) return
    setLoading(true)
    const ids = notifications.filter(n => !n.is_read && !n.id.startsWith?.('temp_')).map(n => n.id)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    if (ids.length) await supabase.from('notifications').update({ is_read: true }).in('id', ids)
    setLoading(false)
  }

  async function clearAll() {
    if (!supabase) return
    setLoading(true)
    setNotifications([])
    await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    setLoading(false)
  }

  // ── Click vào thông báo → mark read + navigate ────────────────────────────
  async function handleNotifClick(n) {
    if (!n.is_read) await markRead(n.id)
    const cfg = TYPE_CONFIG[n.type]
    if (cfg?.nav && onNavigate) {
      onNavigate(cfg.nav)
      setOpen(false)
    }
  }

  if (!isSupabaseConfigured) return null

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Bell button ── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
          open ? 'bg-surface2 text-text' : 'text-slate-500 hover:text-text hover:bg-surface2'
        }`}
        title="Thông báo"
      >
        <Bell size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-cred text-white text-[12px] font-bold leading-none animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-[380px] max-h-[500px] flex flex-col bg-white border border-border rounded-2xl shadow-card z-[100]">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={15} strokeWidth={2} className="text-slate-400" />
              <span className="font-semibold text-sm text-text">Thông báo</span>
              {unreadCount > 0 && (
                <span className="text-[12px] font-bold bg-cred/15 text-cred border border-cred/25 px-1.5 py-0.5 rounded-full">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} disabled={loading}
                  className="text-[12px] text-cblue hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
                  Đọc tất cả
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} disabled={loading}
                  className="text-[12px] text-slate-500 hover:text-cred px-2 py-1 rounded-lg hover:bg-surface2 transition-colors">
                  Xóa hết
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-400">
                <Bell size={36} strokeWidth={1.5} className="opacity-30" />
                <span className="text-sm">Chưa có thông báo nào</span>
              </div>
            ) : (
              notifications.map(n => {
                const cfg  = TYPE_CONFIG[n.type] || TYPE_CONFIG.info
                const Icon = cfg.icon
                const canNav = !!cfg.nav && !!onNavigate
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={`group flex gap-3 px-4 py-3 border-b border-border last:border-0 transition-colors ${
                      canNav ? 'cursor-pointer' : ''
                    } ${n.is_read ? 'opacity-55' : 'bg-blue-50/40'} hover:bg-surface2`}
                  >
                    {/* Type icon */}
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${cfg.bg} ${cfg.border} mt-0.5`}>
                      <Icon size={15} strokeWidth={2} className={cfg.color} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[14px] leading-snug ${n.is_read ? 'text-slate-400' : 'text-text'}`}>
                          {n.message}
                        </p>
                        {!n.is_read && <span className="shrink-0 w-2 h-2 rounded-full bg-cblue mt-1.5" />}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[12px] text-slate-400">{fmtRelTime(n.created_at)}</span>
                        <span className={`text-[12px] font-medium px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        {canNav && (
                          <span className={`ml-auto flex items-center gap-0.5 text-[12px] ${cfg.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
                            {n.type === 'order'  && 'Xem đơn hàng'}
                            {n.type === 'stock'  && 'Xem hàng hóa'}
                            {n.type === 'info'   && 'Chi tiết'}
                            <ArrowRight size={12} strokeWidth={2.2} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-border shrink-0">
              <p className="text-[12px] text-slate-400 text-center">
                {notifications.length} thông báo · Realtime · Tự xóa sau 30 ngày
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
