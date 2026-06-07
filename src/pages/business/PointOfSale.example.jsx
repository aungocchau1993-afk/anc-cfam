/**
 * PointOfSale.example.jsx
 *
 * Ví dụ minh hoạ cách dùng dataService.js trong một component:
 * - Loading state khi fetch data
 * - Realtime tự động reload khi máy khác thay đổi
 * - Gọi addOrder() thay vì gọi supabase trực tiếp
 *
 * File này chỉ là tài liệu tham khảo — KHÔNG phải file chạy thật.
 * File thật là PointOfSale.jsx.
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  getProducts,
  getCustomers,
  addOrder,
  finalizeAfterSale,
  subscribeProducts,   // ← realtime
  subscribeCustomers,  // ← realtime
} from '../../lib/dataService'

// ── Loading skeleton component ────────────────────────────────────────────

function ProductSkeleton() {
  return (
    <div className="animate-pulse grid grid-cols-2 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 bg-surface rounded-lg border border-border" />
      ))}
    </div>
  )
}

// ── Component chính ───────────────────────────────────────────────────────

export default function PointOfSaleExample() {
  const [products,  setProducts]  = useState([])
  const [customers, setCustomers] = useState([])
  const [cart,      setCart]      = useState([])

  // Loading states riêng biệt cho từng loại data
  const [loadingProducts,  setLoadingProducts]  = useState(true)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [submitting,       setSubmitting]       = useState(false)

  // ── Fetch ban đầu ──────────────────────────────────────────────────────

  const fetchProducts = useCallback(async () => {
    try {
      const data = await getProducts()
      setProducts(data)
    } catch (e) {
      toast.error('Không tải được sản phẩm: ' + e.message)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  const fetchCustomers = useCallback(async () => {
    try {
      const data = await getCustomers()
      setCustomers(data)
    } catch (e) {
      toast.error('Không tải được khách hàng: ' + e.message)
    } finally {
      setLoadingCustomers(false)
    }
  }, [])

  useEffect(() => {
    fetchProducts()
    fetchCustomers()
  }, [fetchProducts, fetchCustomers])

  // ── Realtime subscriptions ─────────────────────────────────────────────
  // Khi máy B thêm/sửa/xoá sản phẩm → máy A tự reload, không cần F5

  useEffect(() => {
    const unsubProducts  = subscribeProducts(() => fetchProducts())
    const unsubCustomers = subscribeCustomers(() => fetchCustomers())
    return () => {
      unsubProducts()
      unsubCustomers()
    }
  }, [fetchProducts, fetchCustomers])

  // ── Tạo đơn hàng ──────────────────────────────────────────────────────

  async function handleCheckout({ customerId, discount, paidAmount }) {
    if (cart.length === 0) { toast.error('Giỏ hàng trống'); return }

    setSubmitting(true)
    try {
      const items = cart.map(c => ({
        productId: c.id,
        quantity:  c.qty,
        price:     c.sellPrice,
        cost:      c.importPrice,
      }))

      const order = await addOrder({ customerId, items, discount, paidAmount })

      if (customerId) {
        const orderTotal = items.reduce((s, i) => s + i.price * i.quantity, 0) - (discount || 0)
        await finalizeAfterSale({ customerId, orderId: order.id, orderTotal })
      }

      setCart([])
      toast.success('Đơn hàng tạo thành công!')
    } catch (e) {
      toast.error('Lỗi tạo đơn: ' + e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex gap-4 p-4">

      {/* Danh sách sản phẩm */}
      <div className="flex-1">
        <h2 className="text-sm font-semibold text-muted mb-3">Sản phẩm</h2>
        {loadingProducts ? (
          <ProductSkeleton />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {products.map(p => (
              <button
                key={p.id}
                disabled={p.stockQuantity <= 0}
                onClick={() => setCart(prev => {
                  const existing = prev.find(c => c.id === p.id)
                  if (existing) return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c)
                  return [...prev, { ...p, qty: 1 }]
                })}
                className="p-3 rounded-lg border border-border bg-surface text-left disabled:opacity-40"
              >
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-cgreen">{p.sellPrice?.toLocaleString('vi-VN')}₫</p>
                <p className="text-[10px] text-muted">Tồn: {p.stockQuantity}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Giỏ hàng + thanh toán */}
      <div className="w-72 flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted">Giỏ hàng</h2>

        {cart.length === 0 ? (
          <p className="text-xs text-muted text-center py-8">Chưa có sản phẩm</p>
        ) : (
          <>
            {cart.map(item => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="truncate">{item.name} x{item.qty}</span>
                <span className="text-cgreen shrink-0 ml-2">
                  {(item.sellPrice * item.qty).toLocaleString('vi-VN')}₫
                </span>
              </div>
            ))}

            <button
              disabled={submitting}
              onClick={() => handleCheckout({ customerId: null, discount: 0, paidAmount: undefined })}
              className="mt-auto w-full py-2.5 rounded-lg bg-cblue text-white font-semibold text-sm
                         disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </span>
              ) : 'Thanh toán'}
            </button>
          </>
        )}

        {/* Khách hàng — loading inline */}
        <div className="mt-4">
          <h3 className="text-xs text-muted mb-2">Khách hàng</h3>
          {loadingCustomers ? (
            <div className="h-8 bg-surface animate-pulse rounded" />
          ) : (
            <select className="w-full input-base text-sm">
              <option value="">Khách lẻ</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </select>
          )}
        </div>
      </div>

    </div>
  )
}

/**
 * ═══════════════════════════════════════════════════════
 * PATTERN TÓM TẮT — áp dụng cho mọi component khác
 * ═══════════════════════════════════════════════════════
 *
 * 1. FETCH DATA
 *    const [data, setData] = useState([])
 *    const [loading, setLoading] = useState(true)
 *    useEffect(() => { fetchData() }, [])
 *
 * 2. LOADING UI
 *    if (loading) return <Skeleton />
 *    // hoặc hiện skeleton inline bên trong layout
 *
 * 3. REALTIME
 *    useEffect(() => {
 *      const unsub = subscribeProducts(() => fetchData())
 *      return unsub  // cleanup khi unmount
 *    }, [])
 *
 * 4. WRITE DATA
 *    setSubmitting(true)
 *    try { await addOrder(data); toast.success('OK') }
 *    catch (e) { toast.error(e.message) }
 *    finally { setSubmitting(false) }
 *
 * 5. IMPORT TỪ dataService, KHÔNG import từ supabase trực tiếp
 *    import { getProducts, addOrder } from '../../lib/dataService'
 */
