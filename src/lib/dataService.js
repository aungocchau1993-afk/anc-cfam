/**
 * dataService.js — Data Access Layer cho toàn bộ Business Module
 *
 * Mọi component chỉ import từ file này, không gọi supabase trực tiếp.
 * Tất cả hàm đều async, throw Error khi thất bại để caller xử lý.
 */

import {
  supabase,
  isSupabaseConfigured,
  // Products
  loadProducts,
  insertProduct,
  updateProduct,
  deleteProduct,
  upsertProducts,
  uploadProductImage,
  deleteProductImage,
  adjustStock,
  // Orders
  createOrder,
  createImportOrder,
  loadOrdersFiltered,
  loadOrderDetail,
  cancelOrderFull,
  partialReturnItem,
  // Customers
  loadCustomers,
  insertCustomer,
  updateCustomer,
  deleteCustomer,
  upsertCustomers,
  loadCustomerOrders,
  finalizeCustomerAfterOrder,
  updateCustomerDebt,
  setCustomerDebt,
  addRewardPoints,
  redeemPoints,
  loadRewardHistory,
  // Suppliers
  loadSuppliers,
  insertSupplier,
  updateSupplier,
  deleteSupplier,
  upsertSuppliers,
  addSupplierDebt,
  loadSupplierImportOrders,
  // Cashbook
  loadCashbook,
  insertCashbookTx,
  deleteCashbookTx,
  // Stocktake
  loadStocktakes,
  loadStocktakeItems,
  createStocktake,
  completeStocktake,
  // Analytics
  loadCurrentMonthStats,
  loadDailyRevenue,
  loadTopSellingProducts,
  loadTopDebtors,
  loadLowStockProducts,
  loadMonthlyPnl,
} from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// SHOP CONFIG (thay thế localStorage)
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_SHOP_CONFIG = {
  name: 'Cửa hàng của tôi',
  address: '',
  phone: '',
  thankYouNote: 'Cảm ơn quý khách!',
}

export async function getShopConfig() {
  if (!isSupabaseConfigured || !supabase) {
    try { return JSON.parse(localStorage.getItem('shop_config') || 'null') || DEFAULT_SHOP_CONFIG }
    catch { return DEFAULT_SHOP_CONFIG }
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return DEFAULT_SHOP_CONFIG
  const { data, error } = await supabase
    .from('shop_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return data ? { name: data.name, address: data.address, phone: data.phone, thankYouNote: data.thank_you_note } : DEFAULT_SHOP_CONFIG
}

export async function saveShopConfig(cfg) {
  if (!isSupabaseConfigured || !supabase) {
    localStorage.setItem('shop_config', JSON.stringify(cfg))
    return
  }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('shop_config').upsert({
    user_id:        user.id,
    name:           cfg.name,
    address:        cfg.address,
    phone:          cfg.phone,
    thank_you_note: cfg.thankYouNote,
    updated_at:     new Date(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTS
// ─────────────────────────────────────────────────────────────────────────────

export async function getProducts(search = '') {
  return loadProducts(search)
}

export async function addProduct(product) {
  return insertProduct(product)
}

export async function editProduct(id, patch) {
  return updateProduct(id, patch)
}

export async function removeProduct(id) {
  return deleteProduct(id)
}

export async function bulkUpsertProducts(rows) {
  return upsertProducts(rows)
}

export async function uploadImage(file) {
  return uploadProductImage(file)
}

export async function removeImage(url) {
  return deleteProductImage(url)
}

export async function updateStock(productId, delta) {
  return adjustStock(productId, delta)
}

// ─────────────────────────────────────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────────────────────────────────────

export async function addOrder(orderData) {
  return createOrder(orderData)
}

export async function addImportOrder(orderData) {
  return createImportOrder(orderData)
}

export async function getOrders({ from, to, type } = {}) {
  return loadOrdersFiltered({ from, to, type })
}

export async function getOrderDetail(orderId) {
  return loadOrderDetail(orderId)
}

export async function cancelOrder(order) {
  return cancelOrderFull(order)
}

export async function returnOrderItem({ orderId, item, returnQty, order }) {
  return partialReturnItem({ orderId, item, returnQty, order })
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────────────────────

export async function getCustomers(search = '') {
  return loadCustomers(search)
}

export async function addCustomer(customer) {
  return insertCustomer(customer)
}

export async function editCustomer(id, patch) {
  return updateCustomer(id, patch)
}

export async function removeCustomer(id) {
  return deleteCustomer(id)
}

export async function bulkUpsertCustomers(rows) {
  return upsertCustomers(rows)
}

export async function getCustomerOrders(customerId) {
  return loadCustomerOrders(customerId)
}

export async function finalizeAfterSale({ customerId, orderId, orderTotal }) {
  return finalizeCustomerAfterOrder({ customerId, orderId, orderTotal })
}

export async function updateDebt(customerId, delta) {
  return updateCustomerDebt(customerId, delta)
}

export async function resetDebt(customerId, amount) {
  return setCustomerDebt(customerId, amount)
}

export async function addPoints({ customerId, orderId, pointsChange, description }) {
  return addRewardPoints({ customerId, orderId, pointsChange, description })
}

export async function spendPoints({ customerId, points, description }) {
  return redeemPoints({ customerId, points, description })
}

export async function getRewardHistory(customerId) {
  return loadRewardHistory(customerId)
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIERS
// ─────────────────────────────────────────────────────────────────────────────

export async function getSuppliers(search = '') {
  return loadSuppliers(search)
}

export async function addSupplier(supplier) {
  return insertSupplier(supplier)
}

export async function editSupplier(id, patch) {
  return updateSupplier(id, patch)
}

export async function removeSupplier(id) {
  return deleteSupplier(id)
}

export async function bulkUpsertSuppliers(rows) {
  return upsertSuppliers(rows)
}

export async function addDebtToSupplier(supplierId, amount) {
  return addSupplierDebt(supplierId, amount)
}

export async function getSupplierOrders(supplierId, range = {}) {
  return loadSupplierImportOrders(supplierId, range)
}

// ─────────────────────────────────────────────────────────────────────────────
// CASHBOOK
// ─────────────────────────────────────────────────────────────────────────────

export async function getCashbook(range = {}) {
  return loadCashbook(range)
}

export async function addCashbookEntry(tx) {
  return insertCashbookTx(tx)
}

export async function removeCashbookEntry(id) {
  return deleteCashbookTx(id)
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCKTAKE
// ─────────────────────────────────────────────────────────────────────────────

export async function getStocktakes() {
  return loadStocktakes()
}

export async function getStocktakeItems(stocktakeId) {
  return loadStocktakeItems(stocktakeId)
}

export async function startStocktake(notes = '') {
  return createStocktake(notes)
}

export async function finishStocktake(stocktake, items, notes) {
  return completeStocktake(stocktake, items, notes)
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────────────────────

export async function getMonthStats() {
  return loadCurrentMonthStats()
}

export async function getDailyRevenue(days = 7) {
  return loadDailyRevenue(days)
}

export async function getTopProducts(limit = 5) {
  return loadTopSellingProducts(limit)
}

export async function getTopDebtors(limit = 5) {
  return loadTopDebtors(limit)
}

export async function getLowStock(limit = 10) {
  return loadLowStockProducts(limit)
}

export async function getMonthlyPnl(limit = 12) {
  return loadMonthlyPnl(limit)
}

// ─────────────────────────────────────────────────────────────────────────────
// REALTIME — subscribe helpers
// Dùng trong component: const unsub = subscribeProducts(handler)
// Cleanup trong useEffect return: return () => unsub()
// ─────────────────────────────────────────────────────────────────────────────

export function subscribeProducts(onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('realtime:products')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeCustomers(onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('realtime:customers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeOrders(onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('realtime:orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeSuppliers(onChange) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('realtime:suppliers')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, onChange)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
