/**
 * Channel Sync Service — orchestrator dùng adapters để đồng bộ
 * tồn kho, giá, và kéo đơn hàng từ các sàn TMĐT về Supabase.
 */

import { supabase } from './supabase'
import { getAdapter } from './channelAdapters'

// ── Helpers ───────────────────────────────────────────────────────────────────
async function writeLog({ channelId, syncType, status, syncedCount = 0, message = '' }) {
  if (!supabase) return
  await supabase.from('channel_sync_logs').insert({
    channel_id:   channelId,
    sync_type:    syncType,
    status,
    synced_count: syncedCount,
    message,
  })
}

// ── Load API config của channel từ DB ─────────────────────────────────────────
export async function loadChannelConfig(channelId) {
  if (!supabase) return null
  const { data } = await supabase
    .from('channels')
    .select('api_config, is_active')
    .eq('id', channelId)
    .single()
  return data?.api_config ?? null
}

// ── Save API config vào DB ────────────────────────────────────────────────────
export async function saveChannelConfig(channelId, config) {
  if (!supabase) throw new Error('Supabase chưa cấu hình')
  const { error } = await supabase
    .from('channels')
    .update({ api_config: config })
    .eq('id', channelId)
  if (error) throw error
}

// ── Đồng bộ tồn kho lên 1 kênh ───────────────────────────────────────────────
export async function syncInventoryToChannel(channelId) {
  const adapter = getAdapter(channelId)
  if (!adapter) throw new Error(`Không có adapter cho kênh ${channelId}`)

  const config = await loadChannelConfig(channelId)
  const { ok, errors } = adapter.validateConfig(config || {})
  if (!ok) {
    await writeLog({ channelId, syncType: 'inventory', status: 'error', message: errors.join(', ') })
    throw new Error(`Cấu hình API chưa đủ: ${errors.join(', ')}`)
  }

  // Lấy danh sách sản phẩm có SKU mapping cho kênh này
  const { data: mappings } = await supabase
    .from('channel_sku_mappings')
    .select('platform_sku, platform_product_id, products(id, stock_quantity)')
    .eq('channel_id', channelId)

  if (!mappings?.length) {
    await writeLog({ channelId, syncType: 'inventory', status: 'partial', message: 'Không có SKU mapping nào' })
    return { updated: 0 }
  }

  const items = mappings.map(m => ({
    platform_sku:        m.platform_sku,
    platform_product_id: m.platform_product_id,
    qty:                 m.products?.stock_quantity ?? 0,
  }))

  const result = await adapter.syncInventory(config, items)

  await writeLog({
    channelId,
    syncType:    'inventory',
    status:      result.success ? 'success' : 'error',
    syncedCount: result.updated,
    message:     result.errors?.join(', ') || `Đã sync ${result.updated} sản phẩm`,
  })

  // Cập nhật updated_at trong channel_inventory
  if (result.success) {
    for (const m of mappings) {
      await supabase
        .from('channel_inventory')
        .upsert({
          product_id: m.products?.id,
          channel_id: channelId,
          listed_qty: m.products?.stock_quantity ?? 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'product_id,channel_id' })
    }
  }

  return result
}

// ── Đồng bộ giá lên 1 kênh ───────────────────────────────────────────────────
export async function syncPriceToChannel(channelId) {
  const adapter = getAdapter(channelId)
  if (!adapter) throw new Error(`Không có adapter cho kênh ${channelId}`)

  const config = await loadChannelConfig(channelId)
  const { ok, errors } = adapter.validateConfig(config || {})
  if (!ok) {
    await writeLog({ channelId, syncType: 'price', status: 'error', message: errors.join(', ') })
    throw new Error(`Cấu hình API chưa đủ: ${errors.join(', ')}`)
  }

  const { data: mappings } = await supabase
    .from('channel_sku_mappings')
    .select('platform_sku, platform_product_id, products(sell_price)')
    .eq('channel_id', channelId)

  if (!mappings?.length) return { updated: 0 }

  const items = mappings.map(m => ({
    platform_sku:        m.platform_sku,
    platform_product_id: m.platform_product_id,
    price:               m.products?.sell_price ?? 0,
  }))

  const result = await adapter.syncPrice(config, items)

  await writeLog({
    channelId,
    syncType:    'price',
    status:      result.success ? 'success' : 'error',
    syncedCount: result.updated,
    message:     result.errors?.join(', ') || `Đã sync giá ${result.updated} sản phẩm`,
  })

  return result
}

// ── Kéo đơn hàng từ sàn về Supabase ─────────────────────────────────────────
export async function pullOrdersFromChannel(channelId, since) {
  const adapter = getAdapter(channelId)
  if (!adapter) throw new Error(`Không có adapter cho kênh ${channelId}`)

  const config = await loadChannelConfig(channelId)
  const { ok, errors } = adapter.validateConfig(config || {})
  if (!ok) throw new Error(errors.join(', '))

  const sinceDate = since || new Date(Date.now() - 7 * 86400000).toISOString()
  const orders = await adapter.fetchOrders(config, sinceDate)

  let imported = 0
  for (const o of orders) {
    // Resolve internal product IDs từ SKU mapping
    const items = []
    for (const item of (o.items || [])) {
      const { data: mapping } = await supabase
        .from('channel_sku_mappings')
        .select('product_id, products(sell_price)')
        .eq('channel_id', channelId)
        .eq('platform_sku', item.platform_sku)
        .single()

      if (mapping) {
        items.push({
          product_id: mapping.product_id,
          quantity:   item.qty,
          price:      item.price ?? mapping.products?.sell_price ?? 0,
          cost:       0, // cập nhật sau từ products.import_price
        })
      }
    }

    // Upsert đơn — tránh duplicate dùng external_order_id
    const { error } = await supabase
      .from('orders')
      .upsert({
        channel_id:        channelId,
        external_order_id: o.external_order_id,
        channel_status:    o.channel_status,
        customer_name:     o.customer_name,
        total_amount:      o.total_amount,
        status:            'completed',
        note:              `[${channelId}] ${o.external_order_id}`,
      }, { onConflict: 'external_order_id', ignoreDuplicates: true })

    if (!error) imported++
  }

  await writeLog({
    channelId,
    syncType:    'orders',
    status:      'success',
    syncedCount: imported,
    message:     `Kéo về ${orders.length} đơn, import ${imported} đơn mới`,
  })

  return { total: orders.length, imported }
}

// ── Đồng bộ toàn bộ (inventory + orders) cho 1 kênh ─────────────────────────
export async function syncChannel(channelId) {
  const results = {}

  try {
    results.inventory = await syncInventoryToChannel(channelId)
  } catch (e) {
    results.inventory = { error: e.message }
  }

  try {
    results.orders = await pullOrdersFromChannel(channelId)
  } catch (e) {
    results.orders = { error: e.message }
  }

  return results
}

// ── Đồng bộ tất cả kênh active ───────────────────────────────────────────────
export async function syncAllChannels() {
  if (!supabase) return {}

  const { data: channels } = await supabase
    .from('channels')
    .select('id')
    .eq('is_active', true)
    .neq('id', 'POS') // POS không cần sync

  const results = {}
  for (const ch of (channels || [])) {
    results[ch.id] = await syncChannel(ch.id)
  }
  return results
}
