/**
 * Channel Adapters — Mỗi sàn TMĐT có 1 adapter riêng với cùng interface.
 * Thêm sàn mới: tạo class mới extends BaseAdapter, đăng ký trong ADAPTERS.
 *
 * Interface bắt buộc:
 *   - validateConfig(config)       → { ok, errors[] }
 *   - buildAuthHeaders(config, path, params) → Headers object
 *   - syncInventory(config, items) → { success, updated, errors[] }
 *   - syncPrice(config, items)     → { success, updated, errors[] }
 *   - fetchOrders(config, since)   → Order[]
 *   - verifyWebhook(config, req)   → boolean
 */

// ── Base ─────────────────────────────────────────────────────────────────────
class BaseAdapter {
  name = 'base'

  validateConfig(_config) {
    return { ok: false, errors: ['Adapter chưa implement validateConfig'] }
  }

  async syncInventory(_config, _items) {
    return { success: false, updated: 0, errors: ['Chưa implement'] }
  }

  async syncPrice(_config, _items) {
    return { success: false, updated: 0, errors: ['Chưa implement'] }
  }

  async fetchOrders(_config, _since) {
    return []
  }

  verifyWebhook(_config, _payload, _signature) {
    return false
  }
}

// ── Shopee Adapter ────────────────────────────────────────────────────────────
// Tài liệu: https://open.shopee.com/documents
// Auth: HMAC-SHA256(partner_id + api_path + timestamp + partner_key)
class ShopeeAdapter extends BaseAdapter {
  name = 'SHOPEE'
  BASE_URL = 'https://partner.shopeemobile.com/api/v2'

  validateConfig(config) {
    const errors = []
    if (!config.partner_id)  errors.push('Thiếu Partner ID')
    if (!config.partner_key) errors.push('Thiếu Partner Key')
    if (!config.shop_id)     errors.push('Thiếu Shop ID')
    if (!config.access_token) errors.push('Thiếu Access Token (lấy từ OAuth flow)')
    return { ok: errors.length === 0, errors }
  }

  // Shopee dùng HMAC-SHA256 — phải chạy phía server (Edge Function)
  // Client chỉ gửi request tới Edge Function, Edge Function ký và gọi Shopee
  _buildSignaturePayload(partnerId, apiPath, timestamp, accessToken, shopId) {
    return `${partnerId}${apiPath}${timestamp}${accessToken}${shopId}`
  }

  // Gọi qua proxy Edge Function để không lộ secret phía client
  async _callEdgeFunction(action, config, body) {
    const res = await fetch('/api/channel-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'SHOPEE', action, config, body }),
    })
    if (!res.ok) throw new Error(`Edge Function error: ${res.status}`)
    return res.json()
  }

  async syncInventory(config, items) {
    // items: [{ platform_sku, qty }]
    const { ok, errors } = this.validateConfig(config)
    if (!ok) return { success: false, updated: 0, errors }

    try {
      const result = await this._callEdgeFunction('sync_inventory', config, {
        item_list: items.map(i => ({
          item_id:  i.platform_product_id,
          model_list: [{ model_id: 0, normal_stock: i.qty }],
        })),
      })
      return { success: true, updated: result.updated ?? items.length, errors: [] }
    } catch (e) {
      return { success: false, updated: 0, errors: [e.message] }
    }
  }

  async syncPrice(config, items) {
    // items: [{ platform_sku, platform_product_id, price }]
    const { ok, errors } = this.validateConfig(config)
    if (!ok) return { success: false, updated: 0, errors }

    try {
      const result = await this._callEdgeFunction('sync_price', config, {
        item_list: items.map(i => ({
          item_id:    i.platform_product_id,
          model_list: [{ model_id: 0, original_price: i.price }],
        })),
      })
      return { success: true, updated: result.updated ?? items.length, errors: [] }
    } catch (e) {
      return { success: false, updated: 0, errors: [e.message] }
    }
  }

  async fetchOrders(config, since) {
    const { ok, errors } = this.validateConfig(config)
    if (!ok) throw new Error(errors.join(', '))

    const result = await this._callEdgeFunction('fetch_orders', config, {
      time_from: Math.floor(new Date(since).getTime() / 1000),
      time_to:   Math.floor(Date.now() / 1000),
    })
    return (result.orders || []).map(o => ({
      external_order_id: o.order_sn,
      channel_id:        'SHOPEE',
      channel_status:    o.order_status,
      customer_name:     o.recipient_address?.name,
      total_amount:      o.total_amount,
      items:             (o.item_list || []).map(i => ({
        platform_sku: i.item_sku,
        qty:          i.model_quantity_purchased,
        price:        i.model_discounted_price,
      })),
    }))
  }

  verifyWebhook(config, payload, signature) {
    // Verification phải làm phía Edge Function (cần partner_key)
    // Đây là placeholder — Edge Function sẽ verify trước khi forward
    return !!signature
  }
}

// ── Lazada Adapter ────────────────────────────────────────────────────────────
// Tài liệu: https://open.lazada.com/apps/doc
// Auth: HMAC-SHA256(app_key + sorted_params + app_secret)
class LazadaAdapter extends BaseAdapter {
  name = 'LAZADA'
  BASE_URL = 'https://api.lazada.vn/rest'

  validateConfig(config) {
    const errors = []
    if (!config.app_key)      errors.push('Thiếu App Key')
    if (!config.app_secret)   errors.push('Thiếu App Secret')
    if (!config.access_token) errors.push('Thiếu Access Token (lấy từ OAuth)')
    return { ok: errors.length === 0, errors }
  }

  async _callEdgeFunction(action, config, body) {
    const res = await fetch('/api/channel-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'LAZADA', action, config, body }),
    })
    if (!res.ok) throw new Error(`Edge Function error: ${res.status}`)
    return res.json()
  }

  async syncInventory(config, items) {
    const { ok, errors } = this.validateConfig(config)
    if (!ok) return { success: false, updated: 0, errors }

    try {
      const result = await this._callEdgeFunction('sync_inventory', config, {
        payload: items.map(i => ({
          skuId:    i.platform_product_id,
          quantity: i.qty,
        })),
      })
      return { success: true, updated: result.updated ?? items.length, errors: [] }
    } catch (e) {
      return { success: false, updated: 0, errors: [e.message] }
    }
  }

  async syncPrice(config, items) {
    const { ok, errors } = this.validateConfig(config)
    if (!ok) return { success: false, updated: 0, errors }

    try {
      const result = await this._callEdgeFunction('sync_price', config, {
        payload: items.map(i => ({
          skuId: i.platform_product_id,
          price: i.price,
        })),
      })
      return { success: true, updated: result.updated ?? items.length, errors: [] }
    } catch (e) {
      return { success: false, updated: 0, errors: [e.message] }
    }
  }

  async fetchOrders(config, since) {
    const { ok, errors } = this.validateConfig(config)
    if (!ok) throw new Error(errors.join(', '))

    const result = await this._callEdgeFunction('fetch_orders', config, {
      created_after: new Date(since).toISOString(),
    })
    return (result.orders || []).map(o => ({
      external_order_id: o.order_id,
      channel_id:        'LAZADA',
      channel_status:    o.statuses?.[0],
      customer_name:     o.address_billing?.first_name,
      total_amount:      o.price,
      items:             (o.items || []).map(i => ({
        platform_sku: i.sku,
        qty:          i.qty,
        price:        i.paid_price,
      })),
    }))
  }
}

// ── TikTok Shop Adapter ───────────────────────────────────────────────────────
// Tài liệu: https://partner.tiktokshop.com/docv2
class TikTokAdapter extends BaseAdapter {
  name = 'TIKTOK'

  validateConfig(config) {
    const errors = []
    if (!config.app_key)      errors.push('Thiếu App Key')
    if (!config.app_secret)   errors.push('Thiếu App Secret')
    if (!config.access_token) errors.push('Thiếu Access Token')
    if (!config.shop_id)      errors.push('Thiếu Shop ID')
    return { ok: errors.length === 0, errors }
  }

  async _callEdgeFunction(action, config, body) {
    const res = await fetch('/api/channel-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'TIKTOK', action, config, body }),
    })
    if (!res.ok) throw new Error(`Edge Function error: ${res.status}`)
    return res.json()
  }

  async syncInventory(config, items) {
    const { ok, errors } = this.validateConfig(config)
    if (!ok) return { success: false, updated: 0, errors }

    try {
      const result = await this._callEdgeFunction('sync_inventory', config, { items })
      return { success: true, updated: result.updated ?? items.length, errors: [] }
    } catch (e) {
      return { success: false, updated: 0, errors: [e.message] }
    }
  }

  async syncPrice(config, items) {
    const { ok, errors } = this.validateConfig(config)
    if (!ok) return { success: false, updated: 0, errors }

    try {
      const result = await this._callEdgeFunction('sync_price', config, { items })
      return { success: true, updated: result.updated ?? items.length, errors: [] }
    } catch (e) {
      return { success: false, updated: 0, errors: [e.message] }
    }
  }

  async fetchOrders(config, since) {
    const result = await this._callEdgeFunction('fetch_orders', config, { since })
    return (result.orders || []).map(o => ({
      external_order_id: o.id,
      channel_id:        'TIKTOK',
      channel_status:    o.status,
      customer_name:     o.recipient_address?.name,
      total_amount:      o.payment?.total_amount,
      items:             (o.line_items || []).map(i => ({
        platform_sku: i.seller_sku,
        qty:          i.quantity,
        price:        i.sale_price,
      })),
    }))
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────
export const ADAPTERS = {
  SHOPEE:  new ShopeeAdapter(),
  LAZADA:  new LazadaAdapter(),
  TIKTOK:  new TikTokAdapter(),
  // Thêm sàn mới: WEBSITE: new WebsiteAdapter()
}

export function getAdapter(channelId) {
  return ADAPTERS[channelId] ?? null
}

// Config fields UI meta — dùng để render form nhập API key
export const CHANNEL_CONFIG_FIELDS = {
  SHOPEE: [
    { key: 'partner_id',   label: 'Partner ID',    type: 'text',     hint: 'Lấy từ Shopee Open Platform → My Apps' },
    { key: 'partner_key',  label: 'Partner Key',   type: 'password', hint: 'Secret key của app' },
    { key: 'shop_id',      label: 'Shop ID',       type: 'text',     hint: 'ID cửa hàng Shopee của bạn' },
    { key: 'access_token', label: 'Access Token',  type: 'password', hint: 'Token OAuth — tạo từ link authorize bên dưới' },
  ],
  LAZADA: [
    { key: 'app_key',      label: 'App Key',       type: 'text',     hint: 'Lấy từ Lazada Open Platform → My Apps' },
    { key: 'app_secret',   label: 'App Secret',    type: 'password', hint: 'Secret key của app' },
    { key: 'access_token', label: 'Access Token',  type: 'password', hint: 'Token OAuth — cần authorize qua Lazada' },
  ],
  TIKTOK: [
    { key: 'app_key',      label: 'App Key',       type: 'text',     hint: 'Lấy từ TikTok Shop Partner Center' },
    { key: 'app_secret',   label: 'App Secret',    type: 'password', hint: 'Secret key của app' },
    { key: 'shop_id',      label: 'Shop ID',       type: 'text',     hint: 'ID shop TikTok của bạn' },
    { key: 'access_token', label: 'Access Token',  type: 'password', hint: 'Token sau khi authorize' },
  ],
  WEBSITE: [
    { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', hint: 'Secret để verify webhook từ website' },
    { key: 'api_url',        label: 'API Base URL',   type: 'text',     hint: 'VD: https://myshop.com/api' },
    { key: 'api_key',        label: 'API Key',        type: 'password', hint: 'API key của website' },
  ],
}

export const OAUTH_URLS = {
  SHOPEE: (partnerId, redirectUri) =>
    `https://partner.shopeemobile.com/api/v2/shop/auth_partner?partner_id=${partnerId}&redirect=${encodeURIComponent(redirectUri)}&timestamp=${Math.floor(Date.now()/1000)}`,
  LAZADA: (appKey, redirectUri) =>
    `https://auth.lazada.com/oauth/authorize?response_type=code&force_auth=true&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${appKey}`,
  TIKTOK: (appKey, redirectUri) =>
    `https://auth.tiktok-shops.com/oauth/authorize?app_key=${appKey}&redirect_uri=${encodeURIComponent(redirectUri)}&state=anc-cfam`,
}
