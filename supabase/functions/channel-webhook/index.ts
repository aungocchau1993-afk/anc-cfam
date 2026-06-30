/**
 * Supabase Edge Function: channel-webhook
 *
 * Có 2 nhiệm vụ:
 * 1. Nhận webhook từ Shopee/Lazada/TikTok khi có đơn mới
 * 2. Proxy sync requests từ client (ký HMAC phía server để bảo mật)
 *
 * Deploy: supabase functions deploy channel-webhook
 * URL:    https://<project>.supabase.co/functions/v1/channel-webhook
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shopee-signature, x-lazada-signature',
}

// ── Crypto helpers ─────────────────────────────────────────────────────────────
async function hmacSHA256(key: string, data: string): Promise<string> {
  const enc     = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig     = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Shopee webhook verification ───────────────────────────────────────────────
async function verifyShopeeWebhook(req: Request, body: string, partnerKey: string): Promise<boolean> {
  const signature = req.headers.get('Authorization') || ''
  const url       = req.url
  const expected  = await hmacSHA256(partnerKey, `${url}|${body}`)
  return signature === expected
}

// ── Shopee API proxy (ký request phía server) ─────────────────────────────────
async function proxyShopee(action: string, config: Record<string, string>, body: unknown) {
  const { partner_id, partner_key, shop_id, access_token } = config
  const timestamp = Math.floor(Date.now() / 1000)

  const API_PATHS: Record<string, string> = {
    sync_inventory: '/api/v2/product/update_stock',
    sync_price:     '/api/v2/product/update_price',
    fetch_orders:   '/api/v2/order/get_order_list',
  }

  const path = API_PATHS[action]
  if (!path) throw new Error(`Unknown Shopee action: ${action}`)

  const sigPayload = `${partner_id}${path}${timestamp}${access_token}${shop_id}`
  const sign = await hmacSHA256(partner_key, sigPayload)

  const url = `https://partner.shopeemobile.com${path}?partner_id=${partner_id}&timestamp=${timestamp}&access_token=${access_token}&shop_id=${shop_id}&sign=${sign}`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  return res.json()
}

// ── Lazada API proxy ──────────────────────────────────────────────────────────
async function proxyLazada(action: string, config: Record<string, string>, body: unknown) {
  const { app_key, app_secret, access_token } = config
  const timestamp = Date.now().toString()

  const API_PATHS: Record<string, string> = {
    sync_inventory: '/products/update',
    sync_price:     '/products/price/update',
    fetch_orders:   '/orders/get',
  }

  const path = API_PATHS[action]
  if (!path) throw new Error(`Unknown Lazada action: ${action}`)

  // Lazada signature: sort params + HMAC
  const params: Record<string, string> = {
    app_key,
    access_token,
    timestamp,
    sign_method: 'sha256',
  }
  const sortedStr = Object.keys(params).sort().map(k => `${k}${params[k]}`).join('')
  const sign = await hmacSHA256(app_secret, path + sortedStr)

  const qs = new URLSearchParams({ ...params, sign }).toString()
  const url = `https://api.lazada.vn/rest${path}?${qs}`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  return res.json()
}

// ── TikTok API proxy ──────────────────────────────────────────────────────────
async function proxyTikTok(action: string, config: Record<string, string>, body: unknown) {
  const { app_key, app_secret, access_token, shop_id } = config
  const timestamp = Math.floor(Date.now() / 1000).toString()

  const API_PATHS: Record<string, string> = {
    sync_inventory: '/product/202309/products/inventory',
    sync_price:     '/product/202309/products/prices',
    fetch_orders:   '/order/202309/orders/search',
  }

  const path = API_PATHS[action]
  if (!path) throw new Error(`Unknown TikTok action: ${action}`)

  // TikTok signature
  const params = { app_key, timestamp, shop_id }
  const sortedStr = Object.entries(params).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}${v}`).join('')
  const sign = await hmacSHA256(app_secret, `${app_secret}${path}${sortedStr}${app_secret}`)

  const qs = new URLSearchParams({ ...params, sign, access_token }).toString()
  const url = `https://open-api.tiktokglobalshop.com${path}?${qs}`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-tts-access-token': access_token },
    body:    JSON.stringify(body),
  })
  return res.json()
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const sb = createClient(supabaseUrl, supabaseKey)

  const url = new URL(req.url)

  try {
    // ── Route 1: /channel-webhook/webhook — nhận từ sàn ──────────────────
    if (url.pathname.endsWith('/webhook')) {
      const platform = url.searchParams.get('platform')?.toUpperCase()
      const rawBody  = await req.text()
      const payload  = JSON.parse(rawBody)

      // Lấy config từ DB để verify
      const { data: ch } = await sb.from('channels').select('api_config').eq('id', platform).single()
      const config = ch?.api_config || {}

      let verified = false
      if (platform === 'SHOPEE') {
        verified = await verifyShopeeWebhook(req, rawBody, config.partner_key || '')
      } else {
        // Lazada & TikTok: verify từ signature header
        verified = true // TODO: implement per-platform
      }

      if (!verified) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: corsHeaders })
      }

      // Push đơn hàng vào notifications để app biết
      await sb.from('notifications').insert({
        type:      'order',
        message:   `Đơn mới từ ${platform}: ${payload.ordersn || payload.order_id || payload.id}`,
        meta:      { platform, payload },
        dedup_key: `webhook_${platform}_${payload.ordersn || payload.order_id || payload.id || Date.now()}`,
      })

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    // ── Route 2: /channel-webhook/sync — proxy từ client ─────────────────
    if (url.pathname.endsWith('/sync')) {
      const { platform, action, config, body } = await req.json()

      let result
      if (platform === 'SHOPEE') result = await proxyShopee(action, config, body)
      else if (platform === 'LAZADA') result = await proxyLazada(action, config, body)
      else if (platform === 'TIKTOK') result = await proxyTikTok(action, config, body)
      else throw new Error(`Platform không được hỗ trợ: ${platform}`)

      return new Response(JSON.stringify(result), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ error: 'Route không tìm thấy' }), { status: 404, headers: corsHeaders })

  } catch (e) {
    console.error('[channel-webhook]', e)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders })
  }
})
