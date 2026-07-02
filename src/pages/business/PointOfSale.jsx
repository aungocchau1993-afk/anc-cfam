import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  getProducts as loadProducts,
  getCustomers as loadCustomers,
  addOrder as createOrder,
  finalizeAfterSale as finalizeCustomerAfterOrder,
  spendPoints as redeemPoints,
  subscribeProducts,
  subscribeCustomers,
} from '../../lib/dataService'
import { calcPointsEarned, productToCamel, customerToCamel } from '../../lib/supabase'
import { formatMoneyLive, parseVNDInput, fmtVNDFull, removeVietnameseTones } from '../../lib/formatters'
import { buildReceiptHtml, printViaIframe, getShopConfig } from '../../lib/printReceipt'
import OcrInvoiceModal from '../../components/business/OcrInvoiceModal'
import useDebounce from '../../hooks/useDebounce'

import AppPOSLayout      from '../../components/pos/AppPOSLayout'
import AppProductArea    from '../../components/pos/AppProductArea'
import AppBillPanel      from '../../components/pos/AppBillPanel'
import RedeemModal       from '../../components/pos/RedeemModal'
import OrderHistoryModal from '../../components/pos/OrderHistoryModal'
import ConfirmOrderModal from '../../components/pos/ConfirmOrderModal'
import PrintConfirmModal from '../../components/pos/PrintConfirmModal'
import { newOrderDetails, composeOrderNote } from '../../components/pos/posUtils'

const VIEW_MODE_KEY = 'anc_pos_view_mode'

// ── Print receipt ─────────────────────────────────────────────────────────

function handlePrintReceipt(data, printMode, onAfterPrint) {
  const shop = getShopConfig()
  const mode = printMode ?? shop.printMode ?? 'thermal'
  printViaIframe(buildReceiptHtml({
    ...data,
    paidAmount: data.paidAmount,
    debtAmount: data.debtAmount,
    isImport:   false,
    printMode:  mode,
  }), onAfterPrint)
}

// ── Multi-tab helpers ──────────────────────────────────────────────────────

let _tabCounter = 1
function newTab(label) {
  return {
    id:            ++_tabCounter,
    label:         label || `Đơn ${_tabCounter}`,
    cart:          [],
    customer:      null,
    note:          '',
    discountValue: '',
    discountType:  'amount',
    paidInput:     '',
    mode:          'sale',
    orderDetails:  newOrderDetails(),
  }
}

// ── Main POS ───────────────────────────────────────────────────────────────

export default function PointOfSale() {
  const [products,  setProducts]  = useState([])
  const [customers, setCustomers] = useState([])
  const [loading,   setLoading]   = useState(true)

  const [search,       setSearch]       = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const searchWrapRef                   = useRef(null)
  const debouncedSearch                 = useDebounce(search, 250)

  // ── Multi-tab state ──────────────────────────────────────────────────────
  const [tabs,        setTabs]       = useState([{ id: 1, label: 'Đơn 1', cart: [], customer: null, note: '', discountValue: '', discountType: 'amount', paidInput: '', mode: 'sale', orderDetails: newOrderDetails() }])
  const [activeTabId, setActiveTabId] = useState(1)
  const activeTabIdRef = useRef(1)
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0]

  // patchTab dùng functional updater + ref để tránh stale closure
  function patchTab(patchOrFn) {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabIdRef.current) return t
      const patch = typeof patchOrFn === 'function' ? patchOrFn(t) : patchOrFn
      return { ...t, ...patch }
    }))
  }

  const cart          = activeTab.cart
  const customer      = activeTab.customer
  const note          = activeTab.note
  const discountValue = activeTab.discountValue
  const discountType  = activeTab.discountType
  const paidInput     = activeTab.paidInput
  const mode          = activeTab.mode || 'sale'
  const orderDetails  = activeTab.orderDetails || newOrderDetails()

  const setCart          = (v) => patchTab(t => ({ cart:          typeof v === 'function' ? v(t.cart)          : v }))
  const setCustomer      = (v) => patchTab(t => ({ customer:      typeof v === 'function' ? v(t.customer)      : v }))
  const setNote          = (v) => patchTab(t => ({ note:          typeof v === 'function' ? v(t.note)          : v }))
  const setDiscountValue = (v) => patchTab(t => ({ discountValue: typeof v === 'function' ? v(t.discountValue) : v }))
  const setDiscountType  = (v) => patchTab(t => ({ discountType:  typeof v === 'function' ? v(t.discountType)  : v }))
  const setPaidInput     = (v) => patchTab(t => ({ paidInput:     typeof v === 'function' ? v(t.paidInput)     : v }))
  const setMode          = (v) => patchTab(t => ({ mode:          typeof v === 'function' ? v(t.mode)          : v }))
  const setOrderDetails  = (v) => patchTab(t => ({ orderDetails:  typeof v === 'function' ? v(t.orderDetails)  : v }))

  // View Mode (Grid/List/Compact) — độc lập với tab, dùng chung toàn app, nhớ qua localStorage
  const [viewMode, setViewModeState] = useState(() => {
    try { return localStorage.getItem(VIEW_MODE_KEY) || 'grid' } catch { return 'grid' }
  })
  function setViewMode(v) {
    setViewModeState(v)
    try { localStorage.setItem(VIEW_MODE_KEY, v) } catch { /* noop */ }
  }

  function addTab() {
    const t = newTab(`Đơn ${tabs.length + 1}`)
    setTabs(prev => [...prev, t])
    setActiveTabId(t.id)
    setSearch('')
  }

  function closeTab(id) {
    if (tabs.length === 1) return // luôn giữ ít nhất 1 tab
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id)
      if (activeTabId === id) setActiveTabId(next[next.length - 1].id)
      return next
    })
  }

  // "Lưu tạm" — đơn hiện tại vẫn được giữ nguyên trong tab của nó (đã là cơ chế
  // "tạm giữ" sẵn có), chỉ cần mở một đơn mới để tiếp tục bán.
  function holdCurrentOrder() {
    if (cart.length === 0) return
    toast.success('Đã lưu tạm đơn hàng — chuyển sang tab khác để xem lại')
    addTab()
  }

  function handleAddCustomerClick() {
    toast.info('Vào tab "Khách Hàng" để thêm khách hàng mới')
  }

  const [paying,         setPaying]         = useState(false)
  const [successData,    setSuccessData]    = useState(null)
  const [showHistory,    setShowHistory]    = useState(false)
  const [showRedeem,     setShowRedeem]     = useState(false)
  const [showPayConfirm, setShowPayConfirm] = useState(false)
  const [showOcr,        setShowOcr]        = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [p, c] = await Promise.all([loadProducts(), loadCustomers()])
      setProducts(p)
      setCustomers(c)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime: patch từng record thay vì reload toàn bộ list (nhanh hơn, không bị lag)
  useEffect(() => {
    const unsubP = subscribeProducts((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload
      setProducts(prev => {
        if (eventType === 'INSERT') return [{ ...productToCamel(newRow) }, ...prev]
        if (eventType === 'DELETE') return prev.filter(p => p.id !== oldRow.id)
        if (eventType === 'UPDATE') return prev.map(p => p.id === newRow.id ? productToCamel(newRow) : p)
        return prev
      })
    })
    const unsubC = subscribeCustomers((payload) => {
      const { eventType, new: newRow, old: oldRow } = payload
      setCustomers(prev => {
        if (eventType === 'INSERT') return [customerToCamel(newRow), ...prev]
        if (eventType === 'DELETE') return prev.filter(c => c.id !== oldRow.id)
        if (eventType === 'UPDATE') {
          const updated = customerToCamel(newRow)
          // Cập nhật luôn customer đang chọn nếu trùng id
          setCustomer(cur => cur?.id === updated.id ? { ...cur, ...updated } : cur)
          return prev.map(c => c.id === updated.id ? updated : c)
        }
        return prev
      })
    })
    return () => { unsubP(); unsubC() }
  }, [])

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleMouseDown(e) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Autocomplete từ debouncedSearch
  const dropdownResults = useMemo(() => {
    const safeList  = Array.isArray(products) ? products : []
    const safeQuery = removeVietnameseTones(debouncedSearch || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return []
    return safeList.filter(p => {
      const name = removeVietnameseTones(p?.name)
      const sku  = removeVietnameseTones(p?.sku)
      return words.every(w => name.includes(w) || sku.includes(w))
    }).sort((a, b) => {
      const nA = removeVietnameseTones(a?.name || '')
      const nB = removeVietnameseTones(b?.name || '')
      const aStarts = nA.startsWith(safeQuery)
      const bStarts = nB.startsWith(safeQuery)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      const aExact = ` ${nA} `.includes(` ${safeQuery} `)
      const bExact = ` ${nB} `.includes(` ${safeQuery} `)
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    }).slice(0, 8)
  }, [products, debouncedSearch])

  useEffect(() => {
    setDropdownOpen(search.trim().length > 0)
  }, [dropdownResults, search])

  // ── Cart logic ──────────────────────────────────────────────────────────

  const addToCart = useCallback((product) => {
    if (product.stockQuantity <= 0) { toast.error('Sản phẩm đã hết hàng'); return }
    setCart(prev => {
      const exists = prev.find(i => i.productId === product.id)
      if (exists) {
        if (exists.quantity >= product.stockQuantity) {
          toast.error(`Chỉ còn ${product.stockQuantity} sp trong kho`)
          return prev
        }
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      }
      return [...prev, {
        productId: product.id,
        name:      product.name,
        sku:       product.sku,
        price:     product.sellPrice,
        cost:      product.importPrice,
        imageUrl:  product.imageUrl ?? null,
        quantity:  1,
        unit:      product.lastUsedUnit ?? product.unit ?? null,
      }]
    })
  }, [])

  const setQty = useCallback((productId, qty) => {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.productId !== productId)); return }
    const product = products.find(p => p.id === productId)
    if (product && qty > product.stockQuantity) { toast.error(`Chỉ còn ${product.stockQuantity} sp`); return }
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products])

  const removeFromCart = useCallback((productId) => {
    setCart(prev => prev.filter(i => i.productId !== productId))
  }, [])

  const editPrice = useCallback((productId, newPrice) => {
    setCart(prev => prev.map(i => i.productId === productId ? { ...i, price: newPrice } : i))
  }, [])

  const clearCart = useCallback(() => {
    setCart([]); setCustomer(null); setNote('')
    setDiscountValue(''); setDiscountType('amount'); setPaidInput('')
    setMode('sale'); setOrderDetails(newOrderDetails())
  }, [])

  // OCR: thêm các items từ modal vào giỏ
  const handleOcrAddItems = useCallback((rows) => {
    rows.forEach(({ product, qty, price }) => {
      if (!product) return
      setCart(prev => {
        const exists = prev.find(i => i.productId === product.id)
        if (exists) {
          return prev.map(i => i.productId === product.id
            ? { ...i, quantity: i.quantity + qty, price }
            : i)
        }
        return [...prev, {
          productId: product.id,
          name:      product.name,
          sku:       product.sku,
          price,
          cost:      product.importPrice,
          imageUrl:  product.imageUrl ?? null,
          quantity:  qty,
          unit:      product.lastUsedUnit ?? product.unit ?? null,
        }]
      })
    })
  }, [])

  // ── Summary ─────────────────────────────────────────────────────────────

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  const discountNum = parseFloat(String(discountValue).replace(/[^0-9.]/g, '')) || 0
  const actualDiscount = discountType === 'percent'
    ? Math.round(subtotal * Math.min(discountNum, 100) / 100)
    : Math.min(discountNum, subtotal)

  const total  = Math.max(0, subtotal - actualDiscount)
  const profit = cart.reduce((s, i) => s + (i.price - i.cost) * i.quantity, 0) - actualDiscount
  const margin = subtotal > 0 ? ((profit / subtotal) * 100).toFixed(1) : 0

  // ── Khách thanh toán & công nợ ───────────────────────────────────────────
  const customerPaid = (() => {
    if (!paidInput.trim()) return total
    const n = parseVNDInput(paidInput)
    return Math.max(0, n)
  })()
  const debtAmount   = Math.max(0, total - customerPaid)
  const changeAmount = Math.max(0, customerPaid - total)

  // ── Kiểm tra hạn mức công nợ ────────────────────────────────────────────
  const creditBlocked = (() => {
    if (!customer) return false
    const limit = customer.creditLimit ?? 0
    if (limit <= 0) return false
    // Chỉ tính phần nợ mới thêm vào, không tính phần thanh toán ngay
    return (customer.currentDebt ?? 0) + debtAmount > limit
  })()

  // ── Filtered products ────────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    const safeList  = Array.isArray(products) ? products : []
    const safeQuery = removeVietnameseTones(search || '')
    const words     = safeQuery.split(' ').filter(Boolean)
    if (!words.length) return safeList
    return safeList.filter(p => {
      const name = removeVietnameseTones(p?.name)
      const sku  = removeVietnameseTones(p?.sku)
      return words.every(w => name.includes(w) || sku.includes(w))
    }).sort((a, b) => {
      const nA = removeVietnameseTones(a?.name || '')
      const nB = removeVietnameseTones(b?.name || '')
      const aStarts = nA.startsWith(safeQuery)
      const bStarts = nB.startsWith(safeQuery)
      if (aStarts && !bStarts) return -1
      if (!aStarts && bStarts) return 1
      const aExact = ` ${nA} `.includes(` ${safeQuery} `)
      const bExact = ` ${nB} `.includes(` ${safeQuery} `)
      if (aExact && !bExact) return -1
      if (!aExact && bExact) return 1
      return 0
    })
  }, [products, search])

  // ── Checkout ─────────────────────────────────────────────────────────────

  async function handlePay() {
    if (cart.length === 0) { toast.error('Giỏ hàng trống'); return }
    setPaying(true)
    try {
      const order = await createOrder({
        customerId:  customer?.id || null,
        items:       cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price, cost: i.cost, unit: i.unit ?? null })),
        note:        mode === 'order' ? composeOrderNote(orderDetails, note) : note,
        discount:    actualDiscount,
        paidAmount:  customerPaid,
        channelId:   mode === 'order' ? (orderDetails.channelId || 'POS') : 'POS',
      })
      // Tồn kho được Realtime tự patch qua subscribeProducts — không cần update local thủ công.
      // Vẫn patch optimistic để UI phản hồi ngay (trước khi Realtime event đến)
      setProducts(prev => prev.map(p => {
        const cartItem = cart.find(i => i.productId === p.id)
        return cartItem ? { ...p, stockQuantity: Math.max(0, p.stockQuantity - cartItem.quantity) } : p
      }))

      // Tích điểm + cập nhật tier nếu có khách
      let loyaltyResult = null
      if (customer?.id) {
        loyaltyResult = await finalizeCustomerAfterOrder({
          customerId: customer.id,
          orderId:    order.id,
          orderTotal: total,
        })
        // Cập nhật local — Realtime customer event cũng sẽ arrive và sync
        const debtAmount = order.debt_amount ?? 0
        setCustomers(prev => prev.map(c =>
          c.id === customer.id ? {
            ...c,
            totalSpent:   loyaltyResult.newSpent,
            vipTier:      loyaltyResult.newTier,
            rewardPoints: loyaltyResult.newPoints,
            currentDebt:  (c.currentDebt ?? 0) + debtAmount,
          } : c
        ))
        setCustomer(prev => prev ? {
          ...prev,
          totalSpent:   loyaltyResult.newSpent,
          vipTier:      loyaltyResult.newTier,
          rewardPoints: loyaltyResult.newPoints,
          currentDebt:  (prev.currentDebt ?? 0) + debtAmount,
        } : prev)
      }
      setSuccessData({ order, items: [...cart], total, profit, customer, discount: actualDiscount, note, pointsEarned: loyaltyResult?.earned ?? 0, paidAmount: customerPaid, debtAmount })
    } catch (e) {
      toast.error(e.message || 'Lỗi thanh toán')
    } finally {
      setPaying(false)
    }
  }

  async function handleRedeem(points, description) {
    if (!customer?.id) return
    const newPoints = await redeemPoints({ customerId: customer.id, points, description })
    setCustomers(prev => prev.map(c => c.id === customer.id ? { ...c, rewardPoints: newPoints } : c))
    setCustomer(prev => prev ? { ...prev, rewardPoints: newPoints } : prev)
  }

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col md:h-[calc(100vh-117px)] md:overflow-hidden bg-bg">
      <AppPOSLayout
        viewMode={viewMode}
        mode={mode}
        left={
          <AppProductArea
            tabs={tabs}
            activeTabId={activeTabId}
            onSelectTab={setActiveTabId}
            onAddTab={addTab}
            onCloseTab={closeTab}
            search={search}
            onSearchChange={v => { setSearch(v); setDropdownOpen(true) }}
            searchWrapRef={searchWrapRef}
            dropdownOpen={dropdownOpen}
            onFocusSearch={() => dropdownResults.length > 0 && setDropdownOpen(true)}
            dropdownResults={dropdownResults}
            cart={cart}
            onPickResult={p => { addToCart(p); setSearch(''); setDropdownOpen(false) }}
            onScanOcr={() => setShowOcr(true)}
            onShowHistory={() => setShowHistory(true)}
            totalCount={products.length}
            filteredCount={filteredProducts.length}
            onClearSearch={() => setSearch('')}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            loading={loading}
            products={filteredProducts}
            onAdd={addToCart}
          />
        }
        right={
          <AppBillPanel
            mode={mode}
            onModeChange={setMode}
            orderDetails={orderDetails}
            onOrderDetailsChange={setOrderDetails}
            customers={customers}
            customer={customer}
            onSelectCustomer={setCustomer}
            onAddCustomer={handleAddCustomerClick}
            onOpenRedeem={() => setShowRedeem(true)}
            cart={cart}
            cartCount={cartCount}
            onQty={setQty}
            onRemove={removeFromCart}
            onPriceEdit={editPrice}
            onClearCart={clearCart}
            checkoutProps={{
              cart, note, onNoteChange: setNote,
              subtotal, discountValue, onDiscountValueChange: setDiscountValue,
              discountType, onDiscountTypeChange: v => { setDiscountType(v); setDiscountValue('') },
              actualDiscount, profit, margin, customer,
              pointsEarned: calcPointsEarned(total),
              total, paidInput, onPaidInputChange: setPaidInput,
              totalStr: total.toLocaleString('vi-VN'),
              debtAmount, changeAmount, creditBlocked, paying,
              onHold: holdCurrentOrder,
              onPay: () => setShowPayConfirm(true),
            }}
          />
        }
      />

      {/* ── Modals ─────────────────────────────────────────────────── */}

      {showOcr && (
        <OcrInvoiceModal
          type="SALE"
          products={products}
          onAddItems={handleOcrAddItems}
          onClose={() => setShowOcr(false)}
        />
      )}

      {showPayConfirm && (
        <ConfirmOrderModal
          cart={cart}
          customer={customer}
          actualDiscount={actualDiscount}
          total={total}
          paying={paying}
          onClose={() => setShowPayConfirm(false)}
          onConfirm={() => { setShowPayConfirm(false); handlePay() }}
        />
      )}

      {showRedeem && customer && (
        <RedeemModal
          customer={customer}
          onRedeem={handleRedeem}
          onClose={() => setShowRedeem(false)}
        />
      )}
      {showHistory && <OrderHistoryModal onClose={() => setShowHistory(false)} />}
      {successData && (
        <PrintConfirmModal
          data={successData}
          onSkip={() => { clearCart(); setSuccessData(null) }}
          onPrint={(mode) => {
            clearCart()
            handlePrintReceipt(successData, mode, () => setSuccessData(null))
          }}
        />
      )}
    </div>
  )
}
