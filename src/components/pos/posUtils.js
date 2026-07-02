export function stockBadge(qty) {
  if (qty <= 0)  return { label: 'Hết', cls: 'text-rose-700 bg-rose-50 border-rose-200' }
  if (qty <= 10) return { label: `${qty}`, cls: 'text-amber-700 bg-amber-50 border-amber-200' }
  return { label: `${qty}`, cls: 'text-cgreen bg-emerald-50 border-emerald-200' }
}

// Đồng bộ id với bảng `channels` (seed trong supabase/omnichannel.sql) — dùng để
// wire thật vào createOrder({ channelId }), không phải dữ liệu giả.
export const SALE_CHANNELS = [
  { id: 'POS',     name: 'Bán tại quầy' },
  { id: 'SHOPEE',  name: 'Shopee' },
  { id: 'LAZADA',  name: 'Lazada' },
  { id: 'TIKTOK',  name: 'TikTok Shop' },
  { id: 'WEBSITE', name: 'Website riêng' },
]

export const DELIVERY_METHODS = [
  { id: 'pickup',   label: 'Khách tự đến lấy' },
  { id: 'delivery', label: 'Giao hàng tận nơi' },
  { id: 'partner',  label: 'Đối tác vận chuyển' },
]

export function newOrderDetails() {
  return {
    receiverName:    '',
    receiverPhone:   '',
    deliveryAddress: '',
    deliveryDate:    '',
    deliveryMethod:  'delivery',
    vatEnabled:      false,
    vatRate:         '8',
    deposit:         '',
    staffName:       '',
    channelId:       'POS',
    internalNote:    '',
  }
}

// Gộp các trường Order Mode (chưa có cột riêng trong bảng `orders`) vào chung
// field `note` sẵn có — dữ liệu vẫn được lưu thật & xem lại được trong chi tiết
// đơn, thay vì thêm cột DB mới (đúng ràng buộc "không sửa Database/API").
export function composeOrderNote(details, customerNote) {
  if (!details) return customerNote || ''
  const lines = []
  if (details.receiverName)    lines.push(`Người nhận: ${details.receiverName}`)
  if (details.receiverPhone)   lines.push(`SĐT giao: ${details.receiverPhone}`)
  if (details.deliveryAddress) lines.push(`Địa chỉ giao: ${details.deliveryAddress}`)
  if (details.deliveryDate)    lines.push(`Ngày giao: ${details.deliveryDate}`)
  if (details.deliveryMethod) {
    const m = DELIVERY_METHODS.find(x => x.id === details.deliveryMethod)
    if (m) lines.push(`PT giao: ${m.label}`)
  }
  if (details.vatEnabled)      lines.push(`VAT: ${details.vatRate || 0}%`)
  if (details.deposit)         lines.push(`Đặt cọc: ${details.deposit}`)
  if (details.staffName)       lines.push(`NV phụ trách: ${details.staffName}`)
  if (details.internalNote)    lines.push(`Ghi chú nội bộ: ${details.internalNote}`)

  const orderBlock = lines.length ? `[ĐƠN ĐẶT HÀNG]\n${lines.join('\n')}` : ''
  return [orderBlock, customerNote].filter(Boolean).join('\n')
}
