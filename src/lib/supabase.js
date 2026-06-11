import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const isSupabaseConfigured = url.startsWith('https://') && key.length > 10

export const supabase = isSupabaseConfigured
  ? createClient(url, key)
  : null

const ASSUMPTION_FIELDS = {
  initialCash: 'initial_cash',
  startYear: 'start_year',
  numQuarters: 'num_quarters',
  monthlyProfit: 'monthly_profit',
  profitGrowthPerYear: 'profit_growth_per_year',
  monthlyLiving: 'monthly_living',
  monthlyHousing: 'monthly_housing',
  expenseInflation: 'expense_inflation',
  bankDebt: 'bank_debt',
  bankRate: 'bank_rate',
  debtRepayPerQuarter: 'debt_repay_per_quarter',
  investRatio: 'invest_ratio',
  investYieldPerYear: 'invest_yield_per_year',
  minCashReserve: 'min_cash_reserve',
}

const RISK_FIELDS = {
  riskProfile: 'risk_profile',
  deviationThreshold: 'deviation_threshold',
}

const CUSTOM_ALLOC_FIELDS = {
  stocks: 'custom_stocks',
  realestate: 'custom_realestate',
  gold: 'custom_gold',
  crypto: 'custom_crypto',
  cash: 'custom_cash',
}

function toSnakeRow(camelData, fieldMap) {
  return Object.entries(fieldMap).reduce((row, [camelKey, snakeKey]) => {
    if (camelData?.[camelKey] !== undefined) row[snakeKey] = camelData[camelKey]
    return row
  }, {})
}

function toCamelRow(snakeData, fieldMap) {
  return Object.entries(fieldMap).reduce((row, [camelKey, snakeKey]) => {
    if (snakeData?.[snakeKey] !== undefined && snakeData?.[snakeKey] !== null) row[camelKey] = snakeData[snakeKey]
    return row
  }, {})
}

function assumptionsToSnake(assumptions) {
  return toSnakeRow(assumptions, ASSUMPTION_FIELDS)
}

function assumptionsToCamel(row) {
  if (!row) return null
  return toCamelRow(row, ASSUMPTION_FIELDS)
}

function riskConfigToSnake(config) {
  const row = toSnakeRow(config, RISK_FIELDS)
  if (config?.customAllocation) {
    Object.assign(row, toSnakeRow(config.customAllocation, CUSTOM_ALLOC_FIELDS))
  }
  return row
}

function riskConfigToCamel(row) {
  if (!row) return null
  const base = toCamelRow(row, RISK_FIELDS)
  const customAllocation = toCamelRow(row, CUSTOM_ALLOC_FIELDS)
  return Object.keys(customAllocation).length
    ? { ...base, customAllocation }
    : base
}

export async function loadAssumptions() {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('assumptions')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return assumptionsToCamel(data)
}

export async function saveAssumptions(assumptions) {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('assumptions').upsert({
    user_id: user.id,
    ...assumptionsToSnake(assumptions),
    updated_at: new Date(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

export async function loadMonthlyData() {
  if (!supabase) return null
  const { data, error } = await supabase.from('monthly_data').select('*')
  if (error) throw error
  if (!data) return null

  const result = {}
  for (const row of data) {
    if (!result[row.year]) {
      result[row.year] = Array(12).fill(null).map(() => ({
        income: 0, incomeDetails: {},
        living: 0, housing: 0, debtRepay: 0,
      }))
    }
    const incomeDetails = row.income_details || {}
    const detailSum = Object.values(incomeDetails).reduce((s, v) => s + (Number(v) || 0), 0)
    result[row.year][row.month_index] = {
      income:        detailSum > 0 ? detailSum : (row.income ?? 0),
      incomeDetails,
      living:        row.living     ?? 0,
      housing:       row.housing    ?? 0,
      debtRepay:     row.debt_repay ?? 0,
    }
  }
  return result
}

export async function saveMonthRow(year, monthIndex, data) {
  if (!supabase) return { error: null }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Not authenticated') }
  const incomeDetails = data.incomeDetails || {}
  const detailSum = Object.values(incomeDetails).reduce((s, v) => s + (Number(v) || 0), 0)
  const income    = detailSum > 0 ? detailSum : (data.income ?? 0)
  const { error } = await supabase.from('monthly_data').upsert({
    user_id:        user.id,
    year,
    month_index:    monthIndex,
    income,
    income_details: incomeDetails,
    living:         data.living    ?? 0,
    housing:        data.housing   ?? 0,
    debt_repay:     data.debtRepay ?? 0,
    updated_at:     new Date(),
  }, { onConflict: 'user_id,year,month_index' })
  return { error }
}

export async function loadPortfolioHoldings() {
  if (!supabase) return null
  const { data, error } = await supabase.from('portfolio_holdings').select('*').order('created_at')
  if (error) throw error
  if (!data) return null

  const result = { stocks:[], realestate:[], gold:[], crypto:[], cash:[] }
  for (const row of data) {
    if (result[row.category]) result[row.category].push({ id: row.id, ...row })
  }
  return result
}

export async function insertHolding(category, item) {
  if (!supabase) return item
  const { data, error } = await supabase.from('portfolio_holdings').insert({ category, ...item }).select().single()
  if (error) throw error
  return data
}

export async function deleteHolding(id) {
  if (!supabase) return
  const { error } = await supabase.from('portfolio_holdings').delete().eq('id', id)
  if (error) throw error
}

export async function loadRiskConfig() {
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('risk_config')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) throw error
  return riskConfigToCamel(data)
}

export async function saveRiskConfig(config) {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { error } = await supabase.from('risk_config').upsert({
    user_id: user.id,
    ...riskConfigToSnake(config),
    updated_at: new Date(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

// ── Products ───────────────────────────────────────────────────────────────

export function productToCamel(row) {
  if (!row) return null
  return {
    id:            row.id,
    sku:           row.sku,
    name:          row.name,
    importPrice:   row.import_price,
    sellPrice:     row.sell_price,
    stockQuantity: row.stock_quantity,
    minStock:      row.min_stock ?? 5,
    imageUrl:      row.image_url ?? null,
    unit:          row.unit ?? null,
    lastUsedUnit:  row.last_used_unit ?? null,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  }
}

function productToSnake(p) {
  const row = {}
  if (p.sku           !== undefined) row.sku            = p.sku
  if (p.name          !== undefined) row.name           = p.name
  if (p.importPrice   !== undefined) row.import_price   = p.importPrice   ?? 0
  if (p.sellPrice     !== undefined) row.sell_price     = p.sellPrice     ?? 0
  if (p.stockQuantity !== undefined) row.stock_quantity = p.stockQuantity ?? 0
  if (p.minStock      !== undefined) row.min_stock      = p.minStock      ?? 5
  if (p.imageUrl      !== undefined) row.image_url      = p.imageUrl
  if (p.unit          !== undefined) row.unit           = p.unit          ?? null
  if (p.lastUsedUnit  !== undefined) row.last_used_unit = p.lastUsedUnit  ?? null
  return row
}

// Ghi nhớ đơn vị vừa dùng cho từng sản phẩm (fire-and-forget, không block luồng chính)
async function _saveLastUsedUnits(items) {
  if (!supabase) return
  const toUpdate = items.filter(i => i.productId && i.unit)
  if (!toUpdate.length) return
  await Promise.all(
    toUpdate.map(i =>
      supabase.from('products')
        .update({ last_used_unit: i.unit })
        .eq('id', i.productId)
    )
  )
}

export async function uploadProductImage(file) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const ext  = file.name.split('.').pop()
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadProductImageBlob(sku, blob, ext = 'jpg') {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const safeSku = String(sku).replace(/[^a-zA-Z0-9_-]/g, '_')
  const path    = `${safeSku}_${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

export async function deleteProductImage(url) {
  if (!supabase || !url) return
  const path = url.split('/product-images/').at(-1)
  if (!path) return
  await supabase.storage.from('product-images').remove([path])
}

export async function loadProducts(search = '') {
  if (!supabase) return []
  let query = supabase.from('products').select('*').order('created_at', { ascending: false })
  if (search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,sku.ilike.%${search.trim()}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(productToCamel)
}

export async function insertProduct(product) {
  if (!supabase) return { ...product, id: crypto.randomUUID() }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('products')
    .insert({ user_id: user.id, ...productToSnake(product) })
    .select()
    .single()
  if (error) throw error
  return productToCamel(data)
}

export async function updateProduct(id, patch) {
  if (!supabase) return
  const { data, error } = await supabase
    .from('products')
    .update(productToSnake(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return productToCamel(data)
}

export async function deleteProduct(id) {
  if (!supabase) return
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

export async function upsertProducts(rows) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const { data: { user } } = await supabase.auth.getUser()
  const payload = rows.map(r => ({ user_id: user.id, ...productToSnake(r), sku: r.sku }))
  const { data, error } = await supabase
    .from('products')
    .upsert(payload, { onConflict: 'sku' })
    .select()
  if (error) throw error
  return (data || []).map(productToCamel)
}

export async function adjustStock(id, delta) {
  if (!supabase) return
  const { error } = await supabase.rpc('adjust_stock', { p_id: id, p_delta: delta })
    .throwOnError()
  // fallback nếu không có RPC
  if (error) {
    const { data: cur } = await supabase.from('products').select('stock_quantity').eq('id', id).single()
    const newQty = Math.max(0, (cur?.stock_quantity || 0) + delta)
    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', id)
  }
}

// ── Orders / POS ──────────────────────────────────────────────────────────

export async function createOrder({ customerId, items, note, discount = 0, paidAmount }) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const { data: { user } } = await supabase.auth.getUser()

  const subtotal    = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const totalAmount = Math.max(0, subtotal - discount)
  const profit      = items.reduce((s, i) => s + (i.price - i.cost) * i.quantity, 0) - discount
  const paid        = paidAmount !== undefined ? Math.min(Math.max(0, paidAmount), totalAmount) : totalAmount
  const debt        = Math.max(0, totalAmount - paid)

  // ── Thử gọi RPC atomic (kiểm tra kho + trừ kho + tạo đơn + ghi nợ trong 1 transaction)
  const payload = {
    user_id:      user.id,
    customer_id:  customerId || null,
    items:        items.map(i => ({
      product_id: i.productId,
      quantity:   i.quantity,
      price:      i.price,
      cost:       i.cost ?? 0,
    })),
    total_amount: totalAmount,
    paid_amount:  paid,
    debt_amount:  debt,
    profit,
    note:         note || null,
  }

  const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_order_atomic', { payload })

  if (!rpcErr && rpcResult) {
    _saveLastUsedUnits(items)
    return { ...rpcResult, paid_amount: paid, debt_amount: debt }
  }

  // ── Fallback: RPC chưa được tạo trên DB → dùng luồng cũ (multi-query)
  if (rpcErr?.code === 'PGRST202' || rpcErr?.message?.includes('create_order_atomic')) {
    console.warn('[createOrder] RPC create_order_atomic chưa được tạo — dùng fallback. Hãy chạy migration SQL.')
    return _createOrderFallback({ user, customerId, items, note, totalAmount, paid, debt, profit })
  }

  // Lỗi thực sự từ RPC (ví dụ: không đủ kho) → throw để hiện toast lỗi
  throw new Error(rpcErr?.message || 'Lỗi tạo đơn hàng')
}

// Fallback multi-query (dùng khi RPC chưa được deploy lên DB)
async function _createOrderFallback({ user, customerId, items, note, totalAmount, paid, debt, profit }) {
  let order
  const basePayload = {
    user_id:      user.id,
    customer_id:  customerId || null,
    total_amount: totalAmount,
    profit,
    note:         note || null,
    status:       'completed',
  }

  const { data: orderFull, error: errFull } = await supabase
    .from('orders').insert({ ...basePayload, paid_amount: paid, debt_amount: debt }).select().single()

  if (errFull) {
    if (errFull.code === '42703') {
      const { data: orderFallback, error: errFallback } = await supabase
        .from('orders').insert(basePayload).select().single()
      if (errFallback) throw errFallback
      order = orderFallback
    } else {
      throw errFull
    }
  } else {
    order = orderFull
  }

  const { error: itemsErr } = await supabase.from('order_items').insert(
    items.map(i => ({ order_id: order.id, product_id: i.productId, quantity: i.quantity, price: i.price, cost: i.cost, unit: i.unit ?? null }))
  )
  if (itemsErr) throw itemsErr

  for (const item of items) {
    const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.productId).single()
    const newQty = Math.max(0, (prod?.stock_quantity || 0) - item.quantity)
    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', item.productId)
  }

  if (customerId && debt > 0) {
    try {
      const { data: cust } = await supabase.from('customers').select('current_debt').eq('id', customerId).single()
      await supabase.from('customers').update({ current_debt: Math.max(0, (cust?.current_debt || 0) + debt) }).eq('id', customerId)
    } catch (e) {
      console.warn('[createOrder] current_debt update failed:', e.message)
    }
  }

  _saveLastUsedUnits(items)
  return { ...order, paid_amount: paid, debt_amount: debt }
}

export async function loadOrders(limit = 50) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(full_name, phone), order_items(*, products(name, sku, unit))')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}

// ── Orders (unified) ──────────────────────────────────────────────────────

export async function loadOrdersFiltered({ from, to, type } = {}) {
  if (!supabase) return []
  let q = supabase
    .from('orders')
    .select(`
      id, type, order_code, total_amount, paid_amount, debt_amount, profit, note, status, created_at,
      customer_id, supplier_id,
      customers(id, full_name, phone),
      suppliers(id, name, phone),
      order_items(id, quantity, price, cost, unit, product_id, products(name, sku, unit))
    `)
    .order('created_at', { ascending: false })

  if (from) q = q.gte('created_at', from.toISOString())
  if (to)   q = q.lte('created_at', to.toISOString())
  if (type && type !== 'all') q = q.eq('type', type)

  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function loadOrderDetail(orderId) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id, type, order_code, total_amount, paid_amount, debt_amount, profit, note, status, created_at,
      customer_id, supplier_id,
      customers(id, full_name, phone),
      suppliers(id, name, phone),
      order_items(id, quantity, price, cost, unit, product_id, returned_quantity, products(name, sku, unit))
    `)
    .eq('id', orderId)
    .single()
  if (error) throw error
  return data
}

// Hủy toàn bộ đơn — có tính đến returned_quantity đã trả trước đó
export async function cancelOrderFull(order) {
  if (!supabase) return
  const items = order.order_items || []

  // 1. Đổi status → cancelled
  const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
  if (error) throw error

  // 2. Hoàn kho phần chưa trả
  for (const item of items) {
    if (!item.product_id) continue
    const unreturned = (item.quantity || 0) - (item.returned_quantity || 0)
    if (unreturned <= 0) continue
    const { data: prod } = await supabase
      .from('products').select('stock_quantity').eq('id', item.product_id).single()
    const current = prod?.stock_quantity ?? 0
    const newQty  = order.type === 'import'
      ? Math.max(0, current - unreturned)
      : current + unreturned
    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', item.product_id)
  }

  // 3. Hoàn công nợ/chi tiêu phần còn lại của đơn
  const remaining = order.total_amount || 0
  if (order.type === 'export' && order.customer_id && remaining > 0) {
    const { data: c } = await supabase.from('customers').select('total_spent').eq('id', order.customer_id).single()
    await supabase.from('customers').update({ total_spent: Math.max(0, (c?.total_spent??0) - remaining) }).eq('id', order.customer_id)
  }
  if (order.type === 'import' && order.supplier_id && remaining > 0) {
    const { data: s } = await supabase.from('suppliers').select('debt').eq('id', order.supplier_id).single()
    await supabase.from('suppliers').update({ debt: (s?.debt??0) - remaining }).eq('id', order.supplier_id)
  }
}

// Trả một phần sản phẩm trong đơn
export async function partialReturnItem({ orderId, item, returnQty, order }) {
  if (!supabase) return
  const newReturned  = (item.returned_quantity || 0) + returnQty
  const refundAmount = returnQty * (item.price || 0)

  // 1. Cập nhật returned_quantity trên order_item
  await supabase.from('order_items')
    .update({ returned_quantity: newReturned })
    .eq('id', item.id)

  // 2. Hoàn kho
  if (item.product_id) {
    const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single()
    const current = prod?.stock_quantity ?? 0
    const newQty  = order.type === 'import'
      ? Math.max(0, current - returnQty)
      : current + returnQty
    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', item.product_id)
  }

  // 3. Trừ tiền khỏi tổng đơn
  const newTotal = Math.max(0, (order.total_amount || 0) - refundAmount)
  await supabase.from('orders').update({ total_amount: newTotal }).eq('id', orderId)

  // 4. Trừ công nợ / chi tiêu
  if (order.type === 'export' && order.customer_id && refundAmount > 0) {
    const { data: c } = await supabase.from('customers').select('total_spent').eq('id', order.customer_id).single()
    await supabase.from('customers').update({ total_spent: Math.max(0, (c?.total_spent??0) - refundAmount) }).eq('id', order.customer_id)
  }
  if (order.type === 'import' && order.supplier_id && refundAmount > 0) {
    const { data: s } = await supabase.from('suppliers').select('debt').eq('id', order.supplier_id).single()
    await supabase.from('suppliers').update({ debt: (s?.debt??0) - refundAmount }).eq('id', order.supplier_id)
  }

  // 5. Tự động cập nhật status
  const allItems = order.order_items || []
  // Re-fetch để có returned_quantity mới nhất
  const { data: updatedItems } = await supabase
    .from('order_items').select('quantity, returned_quantity').eq('order_id', orderId)
  const fullyReturned = (updatedItems || []).every(i => (i.returned_quantity||0) >= (i.quantity||0))
  const newStatus = fullyReturned ? 'cancelled' : 'partially_returned'
  await supabase.from('orders').update({ status: newStatus }).eq('id', orderId)
}

export async function cancelOrderRollback(order) {
  if (!supabase) return
  const items = order.order_items || []

  // 1. Cập nhật status → cancelled
  const { error: cancelErr } = await supabase
    .from('orders').update({ status: 'cancelled' }).eq('id', order.id)
  if (cancelErr) throw cancelErr

  // 2. Hoàn tồn kho từng sản phẩm
  for (const item of items) {
    if (!item.product_id) continue
    const { data: prod } = await supabase
      .from('products').select('stock_quantity').eq('id', item.product_id).single()
    const current = prod?.stock_quantity ?? 0
    // export → bán ra → hoàn lại: +qty   /   import → nhập vào → trừ đi: -qty
    const newQty = order.type === 'import'
      ? Math.max(0, current - item.quantity)
      : current + item.quantity
    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', item.product_id)
  }

  // 3. Hoàn công nợ / chi tiêu đối tác
  if (order.type === 'export' && order.customer_id) {
    const { data: cust } = await supabase
      .from('customers').select('total_spent').eq('id', order.customer_id).single()
    const newSpent = Math.max(0, (cust?.total_spent ?? 0) - order.total_amount)
    await supabase.from('customers').update({ total_spent: newSpent }).eq('id', order.customer_id)
  }
  if (order.type === 'import' && order.supplier_id) {
    const { data: sup } = await supabase
      .from('suppliers').select('debt').eq('id', order.supplier_id).single()
    const newDebt = (sup?.debt ?? 0) - order.total_amount
    await supabase.from('suppliers').update({ debt: newDebt }).eq('id', order.supplier_id)
  }
}

// Trả về Map<customerId, debtAmount> — tổng nợ PHÁT SINH trong khoảng ngày
export async function loadCustomerDebts(from, to) {
  if (!supabase) return {}
  const { data, error } = await supabase
    .from('orders')
    .select('customer_id, debt_amount')
    .eq('status', 'completed')
    .eq('type', 'export')
    .not('customer_id', 'is', null)
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
  if (error) throw error
  const map = {}
  for (const row of data || []) {
    const d = Number(row.debt_amount) || 0
    if (d > 0) map[row.customer_id] = (map[row.customer_id] || 0) + d
  }
  return map
}

export async function loadSupplierImportOrders(supplierId, { from, to } = {}) {
  if (!supabase || !supplierId) return []
  let q = supabase
    .from('orders')
    .select(`
      id, type, order_code, total_amount, paid_amount, debt_amount, profit, note, status, created_at,
      order_items(id, quantity, price, cost, unit, returned_quantity, product_id, products(name, sku, unit))
    `)
    .eq('supplier_id', supplierId)
    .eq('type', 'import')
    .order('created_at', { ascending: false })
  if (from) q = q.gte('created_at', from.toISOString())
  if (to)   q = q.lte('created_at', to.toISOString())
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function loadOrdersByDateRange(from, to) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(full_name, phone), order_items(quantity, price, cost, products(name, sku, unit))')
    .gte('created_at', from.toISOString())
    .lte('created_at', to.toISOString())
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Tính COGS chuẩn từ order_items ─────────────────────────────────────────
// COGS = SUM(cost * quantity) — giá vốn thực từ giá nhập
export function computeOrderCOGS(order) {
  return (order.order_items || []).reduce(
    (s, i) => s + (Number(i.cost) || 0) * (Number(i.quantity) || 0), 0
  )
}

// Revenue thực nhận = paid_amount (nếu có), fallback total_amount
export function computeOrderRevenue(order) {
  return order.paid_amount != null ? Number(order.paid_amount) : Number(order.total_amount || 0)
}

export async function cancelOrder(id) {
  if (!supabase) return
  const { error } = await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id)
  if (error) throw error
}

// Tạo đơn nhập kho — sinh order record + order_items + cộng tồn kho + ghi nợ NCC
export async function createImportOrder({ supplierId, items, note, paidAmount }) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const { data: { user } } = await supabase.auth.getUser()

  const totalAmount = items.reduce((s, i) => s + (i.importPrice || 0) * i.qty, 0)
  const paid        = paidAmount !== undefined ? Math.max(0, paidAmount) : totalAmount
  // debtDelta > 0 → ta nợ NCC, debtDelta < 0 → NCC nợ ta (trả dư)
  const debtDelta   = totalAmount - paid

  // 1. Tạo đơn (thử với paid/debt columns, fallback nếu chưa migrate)
  const basePayload = {
    user_id:      user.id,
    supplier_id:  supplierId || null,
    type:         'import',
    total_amount: totalAmount,
    profit:       -paid,       // chi phí thực tế đã trả
    note:         note || null,
    status:       'completed',
  }
  const fullPayload = { ...basePayload, paid_amount: paid, debt_amount: Math.max(0, debtDelta) }

  let order
  const { data: orderFull, error: errFull } = await supabase
    .from('orders').insert(fullPayload).select().single()

  if (errFull) {
    if (errFull.message?.includes('paid_amount') || errFull.message?.includes('debt_amount') || errFull.code === '42703') {
      console.warn('[createImportOrder] paid/debt columns missing — run migration SQL')
      const { data: orderFallback, error: errFallback } = await supabase
        .from('orders').insert(basePayload).select().single()
      if (errFallback) throw errFallback
      order = orderFallback
    } else {
      throw errFull
    }
  } else {
    order = orderFull
  }

  // 2. Thêm order_items
  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from('order_items').insert(
      items.map(i => ({
        order_id:   order.id,
        product_id: i.productId,
        quantity:   i.qty,
        price:      i.importPrice || 0,
        cost:       i.importPrice || 0,
        unit:       i.unit ?? null,
      }))
    )
    if (itemsErr) throw itemsErr
  }

  // 3. Cộng tồn kho + cập nhật giá nhập
  for (const item of items) {
    const newQty = (item.currentStock || 0) + item.qty
    const patch  = { stock_quantity: newQty }
    if ((item.importPrice || 0) > 0) patch.import_price = item.importPrice
    await supabase.from('products').update(patch).eq('id', item.productId)
  }

  // 4. Cập nhật công nợ NCC:
  //    debtDelta > 0 → cộng nợ vào NCC
  //    debtDelta < 0 → trả dư → trừ bớt nợ (hoặc NCC nợ ta nếu đã hết nợ)
  //    debtDelta = 0 → không thay đổi nợ
  if (supplierId && debtDelta !== 0) {
    await addSupplierDebt(supplierId, debtDelta)
  }

  _saveLastUsedUnits(items.map(i => ({ productId: i.productId, unit: i.unit ?? null })))
  return { ...order, paid_amount: paid, debt_amount: Math.max(0, debtDelta) }
}

// ── Customers ─────────────────────────────────────────────────────────────

export function customerToCamel(row) {
  if (!row) return null
  return {
    id:           row.id,
    fullName:     row.full_name,
    phone:        row.phone,
    address:      row.address,
    totalSpent:   row.total_spent   ?? 0,
    creditLimit:  row.credit_limit  ?? 0,
    currentDebt:  row.current_debt  ?? 0,
    rewardPoints: row.reward_points ?? 0,
    vipTier:      row.vip_tier      ?? 'MEMBER',
    createdAt:    row.created_at,
    updatedAt:    row.updated_at,
  }
}

function customerToSnake(c) {
  return {
    full_name:    c.fullName,
    phone:        c.phone    || null,
    address:      c.address  || null,
    total_spent:  c.totalSpent  ?? 0,
    credit_limit: c.creditLimit ?? 0,
  }
}

// ── Loyalty helpers ────────────────────────────────────────────────────────

export function calcVipTier(totalSpent) {
  if (totalSpent >= 100_000_000) return 'PLATINUM'
  if (totalSpent >= 50_000_000)  return 'GOLD'
  if (totalSpent >= 10_000_000)  return 'SILVER'
  return 'MEMBER'
}

export function calcPointsEarned(orderTotal) {
  return Math.floor(orderTotal / 100_000)
}

export async function addRewardPoints({ customerId, orderId = null, pointsChange, description }) {
  if (!supabase || !customerId) return
  // 1. Ghi lịch sử
  await supabase.from('reward_history').insert({
    customer_id:   customerId,
    order_id:      orderId,
    points_change: pointsChange,
    description,
  })
  // 2. Cập nhật tổng điểm
  const { data } = await supabase
    .from('customers').select('reward_points').eq('id', customerId).single()
  const newPoints = Math.max(0, (data?.reward_points ?? 0) + pointsChange)
  await supabase.from('customers').update({ reward_points: newPoints }).eq('id', customerId)
  return newPoints
}

export async function finalizeCustomerAfterOrder({ customerId, orderId, orderTotal }) {
  if (!supabase || !customerId) return
  // 1. Lấy total_spent hiện tại
  const { data } = await supabase
    .from('customers').select('total_spent, reward_points').eq('id', customerId).single()
  const newSpent  = (data?.total_spent ?? 0) + orderTotal
  const newTier   = calcVipTier(newSpent)
  const earned    = calcPointsEarned(orderTotal)
  const newPoints = (data?.reward_points ?? 0) + earned
  // 2. Cập nhật total_spent + vip_tier + reward_points
  await supabase.from('customers').update({
    total_spent:   newSpent,
    vip_tier:      newTier,
    reward_points: newPoints,
  }).eq('id', customerId)
  // 3. Ghi reward_history nếu có điểm
  if (earned > 0) {
    await supabase.from('reward_history').insert({
      customer_id:   customerId,
      order_id:      orderId,
      points_change: earned,
      description:   `Tích điểm đơn hàng — ${orderTotal.toLocaleString('vi-VN')}₫`,
    })
  }
  return { newSpent, newTier, newPoints, earned }
}

export async function redeemPoints({ customerId, points, description }) {
  if (!supabase || !customerId || points <= 0) return
  const { data } = await supabase
    .from('customers').select('reward_points').eq('id', customerId).single()
  const current = data?.reward_points ?? 0
  if (points > current) throw new Error('Không đủ điểm để đổi quà')
  await supabase.from('customers').update({ reward_points: current - points }).eq('id', customerId)
  await supabase.from('reward_history').insert({
    customer_id:   customerId,
    points_change: -points,
    description:   description || 'Đổi điểm lấy quà',
  })
  return current - points
}

export async function loadRewardHistory(customerId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('reward_history')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return data || []
}

export async function loadCustomers(search = '') {
  if (!supabase) return []
  let query = supabase.from('customers').select('*').order('total_spent', { ascending: false })
  if (search.trim()) {
    query = query.or(`full_name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(customerToCamel)
}

export async function insertCustomer(customer) {
  if (!supabase) return { ...customer, id: crypto.randomUUID(), totalSpent: 0 }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('customers')
    .insert({ user_id: user.id, ...customerToSnake(customer) })
    .select()
    .single()
  if (error) throw error
  return customerToCamel(data)
}

export async function updateCustomer(id, patch) {
  if (!supabase) return
  const { data, error } = await supabase
    .from('customers')
    .update(customerToSnake(patch))
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return customerToCamel(data)
}

export async function deleteCustomer(id) {
  if (!supabase) return
  const { error } = await supabase.from('customers').delete().eq('id', id)
  if (error) throw error
}

export async function upsertCustomers(rows) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const { data: { user } } = await supabase.auth.getUser()
  const payload = rows.map(r => ({
    user_id:     user.id,
    full_name:   r.fullName,
    phone:       r.phone || null,
    address:     r.address || null,
    total_spent: r.totalSpent ?? 0,
  }))
  const { data, error } = await supabase
    .from('customers')
    .upsert(payload, { onConflict: 'phone' })
    .select()
  if (error) throw error
  return (data || []).map(customerToCamel)
}

export async function loadCustomerOrders(customerId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*, products(name, sku, unit))')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Suppliers ─────────────────────────────────────────────────────────────

function supplierToCamel(row) {
  if (!row) return null
  return {
    id:        row.id,
    name:      row.name,
    phone:     row.phone,
    address:   row.address,
    debt:      row.debt ?? 0,
    note:      row.note ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function supplierToSnake(s) {
  return {
    name:    s.name,
    phone:   s.phone   || null,
    address: s.address || null,
    debt:    s.debt    ?? 0,
    note:    s.note    || null,
  }
}

export async function loadSuppliers(search = '') {
  if (!supabase) return []
  let query = supabase.from('suppliers').select('*').order('name')
  if (search.trim()) {
    query = query.or(`name.ilike.%${search.trim()}%,phone.ilike.%${search.trim()}%`)
  }
  const { data, error } = await query
  if (error) throw error
  return (data || []).map(supplierToCamel)
}

export async function insertSupplier(supplier) {
  if (!supabase) return { ...supplier, id: crypto.randomUUID() }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('suppliers')
    .insert({ user_id: user.id, ...supplierToSnake(supplier) })
    .select().single()
  if (error) throw error
  return supplierToCamel(data)
}

export async function updateSupplier(id, patch) {
  if (!supabase) return
  const { data, error } = await supabase
    .from('suppliers')
    .update({ ...supplierToSnake(patch), updated_at: new Date() })
    .eq('id', id)
    .select().single()
  if (error) throw error
  return supplierToCamel(data)
}

export async function deleteSupplier(id) {
  if (!supabase) return
  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) throw error
}

// Trả về Map<supplierId, { totalAmount, paidAmount, debtAmount }> trong khoảng ngày
export async function loadSupplierDebtsByPeriod(from, to) {
  if (!supabase) return {}
  let q = supabase
    .from('orders')
    .select('supplier_id, total_amount, paid_amount, debt_amount')
    .eq('status', 'completed')
    .eq('type', 'import')
    .not('supplier_id', 'is', null)
  if (from) q = q.gte('created_at', from.toISOString())
  if (to)   q = q.lte('created_at', to.toISOString())
  const { data, error } = await q
  if (error) throw error
  const map = {}
  for (const row of data || []) {
    const id = row.supplier_id
    if (!map[id]) map[id] = { totalAmount: 0, paidAmount: 0, debtAmount: 0 }
    map[id].totalAmount += Number(row.total_amount) || 0
    map[id].paidAmount  += Number(row.paid_amount)  || 0
    map[id].debtAmount  += Number(row.debt_amount)  || 0
  }
  return map
}

export async function addSupplierDebt(supplierId, amount) {
  if (!supabase || !supplierId || !amount) return
  const { data, error: fetchErr } = await supabase
    .from('suppliers').select('debt').eq('id', supplierId).single()
  if (fetchErr) throw fetchErr
  const newDebt = (data?.debt ?? 0) + amount
  const { error } = await supabase
    .from('suppliers').update({ debt: newDebt }).eq('id', supplierId)
  if (error) throw error
}

export async function upsertSuppliers(rows) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const { data: { user } } = await supabase.auth.getUser()
  const payload = rows.map(r => ({
    user_id: user.id,
    name:    r.name,
    phone:   r.phone    || null,
    address: r.address  || null,
    debt:    r.debt     ?? 0,
    note:    r.note     || null,
  }))
  const { data, error } = await supabase
    .from('suppliers')
    .upsert(payload, { onConflict: 'phone' })
    .select()
  if (error) throw error
  return (data || []).map(supplierToCamel)
}

// ── Income Categories ──────────────────────────────────────────────────────

export async function loadIncomeCategories() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('income_categories')
    .select('*')
    .order('created_at')
  if (error) throw error
  return (data || []).map(r => ({ id: r.id, name: r.name, createdAt: r.created_at }))
}

export async function insertIncomeCategory(name) {
  if (!supabase) return { id: crypto.randomUUID(), name, createdAt: new Date().toISOString() }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('income_categories')
    .insert({ user_id: user.id, name })
    .select()
    .single()
  if (error) throw error
  return { id: data.id, name: data.name, createdAt: data.created_at }
}

export async function updateIncomeCategory(id, name) {
  if (!supabase) return
  const { error } = await supabase
    .from('income_categories')
    .update({ name })
    .eq('id', id)
  if (error) throw error
}

export async function deleteIncomeCategory(id) {
  if (!supabase) return
  const { error } = await supabase
    .from('income_categories')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Credit Cards ───────────────────────────────────────────────────────────

function ccToSnake(card) {
  return {
    bank_name:          card.bankName,
    card_holder:        card.cardHolder,
    card_number_last4:  card.cardNumberLast4,
    credit_limit:       card.creditLimit ?? 0,
    used_amount:        card.usedAmount ?? 0,
    statement_date:     card.statementDate,
    due_date:           card.dueDate,
  }
}

function ccToCamel(row) {
  if (!row) return null
  return {
    id:               row.id,
    userId:           row.user_id,
    bankName:         row.bank_name,
    cardHolder:       row.card_holder,
    cardNumberLast4:  row.card_number_last4,
    creditLimit:      row.credit_limit,
    usedAmount:       row.used_amount,
    statementDate:    row.statement_date,
    dueDate:          row.due_date,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

export async function loadCreditCards() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('credit_cards')
    .select('*')
    .order('created_at')
  if (error) throw error
  return (data || []).map(ccToCamel)
}

export async function insertCreditCard(card) {
  if (!supabase) return { ...card, id: crypto.randomUUID() }
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('credit_cards')
    .insert({ user_id: user.id, ...ccToSnake(card) })
    .select()
    .single()
  if (error) throw error
  return ccToCamel(data)
}

export async function updateCreditCard(id, patch) {
  if (!supabase) return
  const { error } = await supabase
    .from('credit_cards')
    .update(ccToSnake(patch))
    .eq('id', id)
  if (error) throw error
}

export async function deleteCreditCard(id) {
  if (!supabase) return
  const { error } = await supabase
    .from('credit_cards')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Stocktakes ─────────────────────────────────────────────────────────────

export async function loadStocktakes() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('stocktakes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function loadStocktakeItems(stocktakeId) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('stocktake_items')
    .select('*, products(name, sku, unit)')
    .eq('stocktake_id', stocktakeId)
    .order('variance', { ascending: true })
  if (error) throw error
  return (data || []).map(r => ({
    id:         r.id,
    productId:  r.product_id,
    name:       r.products?.name ?? '—',
    sku:        r.products?.sku  ?? '—',
    systemQty:  r.system_qty,
    actualQty:  r.actual_qty,
    variance:   r.variance,
  }))
}

export async function createStocktake(notes = '') {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('stocktakes')
    .insert({ created_by: user.id, status: 'draft', notes })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveStocktakeItems(stocktakeId, items) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const rows = items.map(i => ({
    stocktake_id: stocktakeId,
    product_id:   i.productId,
    system_qty:   i.systemQty,
    actual_qty:   i.actualQty,
  }))
  const { error } = await supabase.from('stocktake_items').insert(rows)
  if (error) throw error
}

export async function completeStocktake(stocktake, items, notes) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')

  // 1. Lưu items
  await saveStocktakeItems(stocktake.id, items)

  // 2. Cập nhật status + notes
  const { error: stErr } = await supabase
    .from('stocktakes')
    .update({ status: 'completed', notes })
    .eq('id', stocktake.id)
  if (stErr) throw stErr

  // 3. Cập nhật stock_quantity từng sản phẩm theo actual_qty
  for (const item of items) {
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: item.actualQty })
      .eq('id', item.productId)
    if (error) throw error
  }
}

// ── Cashbook ───────────────────────────────────────────────────────────────

export async function loadCashbook({ from, to } = {}) {
  if (!supabase) return []
  let q = supabase
    .from('cashbook_transactions')
    .select('*')
    .order('created_at', { ascending: false })
  if (from) q = q.gte('created_at', from)
  if (to)   q = q.lte('created_at', to)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function insertCashbookTx(tx) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('cashbook_transactions')
    .insert({
      user_id:          user.id,
      transaction_type: tx.type,
      amount:           tx.amount,
      category:         tx.category,
      notes:            tx.notes || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCashbookTx(id) {
  if (!supabase) return
  const { error } = await supabase
    .from('cashbook_transactions')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Customer debt helpers ──────────────────────────────────────────────────

export async function updateCustomerDebt(customerId, delta) {
  if (!supabase || !customerId) return
  const { data, error: fetchErr } = await supabase
    .from('customers').select('current_debt').eq('id', customerId).single()
  if (fetchErr) throw fetchErr
  const newDebt = Math.max(0, (data?.current_debt ?? 0) + delta)
  const { error } = await supabase
    .from('customers').update({ current_debt: newDebt }).eq('id', customerId)
  if (error) throw error
  return newDebt
}

export async function setCustomerDebt(customerId, amount) {
  if (!supabase || !customerId) return
  const { error } = await supabase
    .from('customers').update({ current_debt: Math.max(0, amount) }).eq('id', customerId)
  if (error) throw error
}

// ── Analytics ──────────────────────────────────────────────────────────────

export async function loadMonthlyPnl(limit = 12) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('monthly_pnl_summary')
    .select('*')
    .limit(limit)
  if (error) throw error
  return data || []
}

export async function loadDailyRevenue(days = 7) {
  if (!supabase) return []
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  from.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('orders')
    .select('created_at, total_amount, profit')
    .eq('status', 'completed')
    .gte('created_at', from.toISOString())
    .order('created_at')
  if (error) throw error

  // Khởi tạo map N ngày gần nhất
  const map = {}
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    const key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
    map[key] = { revenue: 0, profit: 0 }
  }
  for (const row of data || []) {
    const d   = new Date(row.created_at)
    const key = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
    if (map[key]) {
      map[key].revenue += Number(row.total_amount) || 0
      map[key].profit  += Number(row.profit)        || 0
    }
  }
  return Object.entries(map).map(([date, v]) => ({ date, ...v }))
}

export async function loadTopSellingProducts(limit = 5) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, quantity, price, cost, products(name, sku, unit)')
  if (error) throw error

  const map = {}
  for (const item of data || []) {
    const id = item.product_id
    if (!id) continue
    if (!map[id]) map[id] = {
      productId: id,
      name:      item.products?.name ?? '—',
      sku:       item.products?.sku  ?? '—',
      totalQty:  0,
      totalRevenue: 0,
      totalProfit:  0,
    }
    map[id].totalQty      += Number(item.quantity) || 0
    map[id].totalRevenue  += (Number(item.price) || 0) * (Number(item.quantity) || 0)
    map[id].totalProfit   += ((Number(item.price) || 0) - (Number(item.cost) || 0)) * (Number(item.quantity) || 0)
  }
  return Object.values(map)
    .sort((a, b) => b.totalQty - a.totalQty)
    .slice(0, limit)
}

export async function loadTopDebtors(limit = 5) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, phone, current_debt, credit_limit')
    .gt('current_debt', 0)
    .order('current_debt', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []).map(r => ({
    id:          r.id,
    fullName:    r.full_name,
    phone:       r.phone,
    currentDebt: r.current_debt,
    creditLimit: r.credit_limit,
  }))
}

export async function loadLowStockProducts(limit = 10) {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, stock_quantity, min_stock')
    .order('stock_quantity')
    .limit(50)
  if (error) throw error
  return (data || [])
    .filter(p => p.stock_quantity <= (p.min_stock ?? 5))
    .slice(0, limit)
    .map(p => ({
      id:           p.id,
      sku:          p.sku,
      name:         p.name,
      stockQuantity:p.stock_quantity,
      minStock:     p.min_stock ?? 5,
    }))
}

export async function loadCurrentMonthStats() {
  if (!supabase) return null

  const now    = new Date()
  const from   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const to     = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

  // Query trực tiếp từ orders + order_items để tính COGS chuẩn xác
  const [ordersRes, cashRes, debtRes] = await Promise.all([
    supabase
      .from('orders')
      .select('total_amount, paid_amount, profit, type, order_items(cost, quantity)')
      .eq('status', 'completed')
      .gte('created_at', from)
      .lte('created_at', to),
    supabase
      .from('cashbook_transactions')
      .select('transaction_type, amount')
      .gte('created_at', from)
      .lte('created_at', to),
    supabase
      .from('customers')
      .select('current_debt')
      .gt('current_debt', 0),
  ])

  const orders = ordersRes.data || []
  const cash   = cashRes.data   || []

  // Chỉ lấy đơn xuất hàng (bán)
  const exportOrders = orders.filter(o => o.type !== 'import')

  // Doanh thu = tiền thực nhận (paid_amount), fallback total_amount nếu chưa migrate
  const totalRevenue = exportOrders.reduce((s, o) => {
    const rev = o.paid_amount != null ? Number(o.paid_amount) : Number(o.total_amount || 0)
    return s + rev
  }, 0)

  // COGS = SUM(cost * quantity) từ order_items — giá vốn thực tế
  const totalCOGS = exportOrders.reduce((s, o) => {
    const cogs = (o.order_items || []).reduce(
      (cs, i) => cs + (Number(i.cost) || 0) * (Number(i.quantity) || 0), 0
    )
    return s + cogs
  }, 0)

  // Lãi gộp = Doanh thu - Giá vốn
  const grossProfit = totalRevenue - totalCOGS

  // Sổ quỹ: THU/CHI ngoài đơn hàng
  const totalThu  = cash.filter(t => t.transaction_type === 'THU').reduce((s, t) => s + Number(t.amount), 0)
  const totalChi  = cash.filter(t => t.transaction_type === 'CHI').reduce((s, t) => s + Number(t.amount), 0)
  const totalOpex = totalChi
  const netProfit = grossProfit - totalOpex + totalThu

  const totalDebt = (debtRes.data || []).reduce((s, c) => s + Number(c.current_debt), 0)

  return { totalRevenue, totalCOGS, grossProfit, totalOpex, netProfit, totalDebt }
}

// ── Inventory Intelligence: velocity 30 ngày ──────────────────────────────

export async function loadInventoryIntelligence(limit = 12) {
  if (!supabase) return []

  const from30 = new Date()
  from30.setDate(from30.getDate() - 30)

  // Lấy song song: danh sách sản phẩm + doanh số 30 ngày qua
  const [productsRes, salesRes] = await Promise.all([
    supabase.from('products').select('id, sku, name, stock_quantity'),
    supabase
      .from('order_items')
      .select('product_id, quantity, orders!inner(type, status, created_at)')
      .eq('orders.type', 'export')
      .eq('orders.status', 'completed')
      .gte('orders.created_at', from30.toISOString()),
  ])

  if (productsRes.error) throw productsRes.error

  // Tổng số lượng bán ra 30 ngày theo product_id
  const salesMap = {}
  for (const item of salesRes.data || []) {
    const id = item.product_id
    if (id) salesMap[id] = (salesMap[id] || 0) + (Number(item.quantity) || 0)
  }

  // Ngưỡng "best-seller": bán nhiều hơn trung bình toàn danh mục
  const allSales = Object.values(salesMap)
  const avgSales = allSales.length ? allSales.reduce((s, v) => s + v, 0) / allSales.length : 0

  return (productsRes.data || [])
    .map(p => {
      const qty30   = salesMap[p.id] || 0
      const avgDaily = qty30 / 30
      const daysLeft = avgDaily > 0 ? Math.round(p.stock_quantity / avgDaily) : null

      // Phân loại tồn kho
      let label, labelCls
      if (qty30 > avgSales * 1.5 && qty30 > 0) {
        label = '🔥 Best-seller'; labelCls = 'bg-cgreen/15 text-cgreen border-cgreen/30'
      } else if (p.stock_quantity > qty30 * 3 && p.stock_quantity > 5) {
        label = '📦 Tồn đọng';   labelCls = 'bg-cyellow/15 text-cyellow border-cyellow/30'
      } else if (daysLeft !== null && daysLeft <= 7) {
        label = '⚡ Sắp hết';    labelCls = 'bg-cred/15 text-cred border-cred/30'
      } else {
        label = '✅ Bình thường'; labelCls = 'bg-slate-700/40 text-slate-400 border-slate-600/40'
      }

      return { id: p.id, sku: p.sku, name: p.name, stock: p.stock_quantity, qty30, avgDaily: +avgDaily.toFixed(1), daysLeft, label, labelCls }
    })
    .sort((a, b) => b.qty30 - a.qty30)
    .slice(0, limit)
}

// ── Cashflow Forecast: nợ phải trả + cảnh báo tài chính ─────────────────

export async function loadCashflowForecast() {
  if (!supabase) return { totalPayable: 0, recentRevenue7d: 0, supplierDebts: [], warning: false }

  const from7 = new Date()
  from7.setDate(from7.getDate() - 7)

  const [supRes, revenueRes] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name, current_debt')
      .gt('current_debt', 0)
      .order('current_debt', { ascending: false }),
    supabase
      .from('orders')
      .select('paid_amount, total_amount')
      .eq('type', 'export')
      .eq('status', 'completed')
      .gte('created_at', from7.toISOString()),
  ])

  const suppliers       = supRes.data || []
  const totalPayable    = suppliers.reduce((s, r) => s + (Number(r.current_debt) || 0), 0)
  const recentRevenue7d = (revenueRes.data || [])
    .reduce((s, o) => s + (Number(o.paid_amount ?? o.total_amount) || 0), 0)

  // Cảnh báo nếu nợ nhà cung cấp > doanh thu 7 ngày gần nhất
  const warning = totalPayable > 0 && totalPayable > recentRevenue7d

  return {
    totalPayable,
    recentRevenue7d,
    warning,
    supplierDebts: suppliers.slice(0, 6).map(s => ({ id: s.id, name: s.name, debt: s.current_debt })),
  }
}

// ── Audit Logs ─────────────────────────────────────────────────────────────

export async function loadAuditLogs(tableName, recordId, limit = 50) {
  if (!supabase || !recordId) return []
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id, action, old_data, new_data, changed_by, created_at')
    .eq('table_name', tableName)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.warn('[audit_logs]', error.message); return [] }
  return data || []
}

export async function loadAuditLogsDashboard({
  from, to,
  actions = [],       // ['INSERT','UPDATE','DELETE']
  tables  = [],       // ['products','orders']
  search  = '',
  page    = 0,
  pageSize = 30,
} = {}) {
  if (!supabase) return { data: [], count: 0 }

  let q = supabase
    .from('audit_logs')
    .select('id, table_name, record_id, action, old_data, new_data, changed_by, created_at', { count: 'exact' })

  if (from)           q = q.gte('created_at', from)
  if (to)             q = q.lte('created_at', to)
  if (actions.length) q = q.in('action', actions)
  if (tables.length)  q = q.in('table_name', tables)

  // Tìm kiếm trong new_data / old_data (tên sản phẩm, mã đơn)
  if (search.trim()) {
    const s = search.trim()
    q = q.or(`new_data->name.ilike.%${s}%,old_data->name.ilike.%${s}%,new_data->order_code.ilike.%${s}%,old_data->order_code.ilike.%${s}%,new_data->sku.ilike.%${s}%`)
  }

  q = q
    .order('created_at', { ascending: false })
    .range(page * pageSize, (page + 1) * pageSize - 1)

  const { data, error, count } = await q
  if (error) { console.warn('[audit_dashboard]', error.message); return { data: [], count: 0 } }
  return { data: data || [], count: count ?? 0 }
}

