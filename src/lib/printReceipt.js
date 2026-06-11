// ── Shared receipt print utility ──────────────────────────────────────────
// Hỗ trợ 2 mode: 'thermal' (80mm) và 'a4' (A5 portrait)
// QR sinh từ api.qrserver.com — không cần cài library

const SHOP_KEY = 'anc_shop_config'

const DEFAULTS = {
  name:       'Tên Cửa Hàng',
  address:    '123 Đường ABC, Quận X, TP.HCM',
  phone:      '0901 234 567',
  logo:       '',          // URL ảnh logo (để trống = ẩn)
  bankName:   '',          // Tên ngân hàng (VD: Vietcombank)
  bankNumber: '',          // Số tài khoản / VietQR
  bankAccount:'',          // Tên chủ tài khoản
  thankMsg:   'Cảm ơn quý khách! Hẹn gặp lại 🙏',
  printMode:  'thermal',   // 'thermal' | 'a4'
}

export function getShopConfig() {
  try {
    const raw = localStorage.getItem(SHOP_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {}
  return { ...DEFAULTS }
}

export function saveShopConfig(cfg) {
  localStorage.setItem(SHOP_KEY, JSON.stringify(cfg))
}

// QR code ảnh từ qrserver.com (không cần internet nếu đã cache)
function qrImg(data, size = 120) {
  const enc = encodeURIComponent(data)
  return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${enc}&margin=4&format=svg" width="${size}" height="${size}" alt="QR" style="display:block" />`
}

// Format số tiền
const fmtN = n => Math.round(n ?? 0).toLocaleString('vi-VN')

// ─────────────────────────────────────────────────────────────────────────────
// Thermal 80mm template
// ─────────────────────────────────────────────────────────────────────────────

function buildThermalHtml({
  shop, code, now, partnerName, partnerLabelTx, invoiceTitle,
  items, subtotal, grandTotal, discount,
  paid, debt, surplus, showPayment,
  note, isImport, pointsEarned,
}) {
  const rows = items.map(i => {
    const name    = i.name || i.products?.name || '—'
    const unit    = i.unit ?? i.products?.unit ?? null
    const lineAmt = (i.price || 0) * (i.quantity || 0)
    return `
    <tr>
      <td class="td-name">${name}</td>
      <td class="td-c">${i.quantity}${unit ? `<br/><span style="font-size:7pt;color:#1a73e8;font-weight:700">${unit}</span>` : ''}</td>
      <td class="td-r">${fmtN(i.price)}</td>
      <td class="td-r td-b">${fmtN(lineAmt)}</td>
    </tr>`
  }).join('')

  const bankQr = shop.bankName && shop.bankNumber
    ? `<div class="section" style="text-align:center">
        <div class="label">Thanh toán QR</div>
        ${qrImg(`${shop.bankName} ${shop.bankNumber} ${shop.bankAccount || ''}`, 100)}
        <div style="font-size:7pt;margin-top:3px">${shop.bankName} · ${shop.bankNumber}${shop.bankAccount ? ` · ${shop.bankAccount}` : ''}</div>
       </div>`
    : ''

  const logoHtml = shop.logo
    ? `<img src="${shop.logo}" class="logo" alt="logo" />`
    : ''

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<title>HĐ #${code}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  /* ── Khổ giấy nhiệt 80mm ── */
  @page {
    size: 80mm auto;
    margin: 2mm 3mm;
  }
  body {
    font-family: 'Arial Narrow', Arial, 'Helvetica Neue', sans-serif;
    font-size: 9pt;
    color: #000;
    background: #fff;
    width: 74mm;
  }

  /* ── Header ── */
  .header { text-align:center; padding-bottom:6px; border-bottom:1px solid #000; margin-bottom:6px; }
  .logo   { max-width:60mm; max-height:18mm; margin:0 auto 4px; display:block; object-fit:contain; }
  .shop   { font-size:12pt; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; }
  .sub    { font-size:7.5pt; color:#333; margin-top:1px; line-height:1.4; }
  .title  { font-size:9pt; font-weight:800; letter-spacing:2px; margin-top:5px; text-transform:uppercase; }

  /* ── Info ── */
  .info   { margin-bottom:5px; font-size:8pt; }
  .irow   { display:flex; justify-content:space-between; padding:1px 0; }
  .ilabel { color:#555; flex-shrink:0; margin-right:4px; }
  .ival   { font-weight:700; text-align:right; }

  /* ── Divider ── */
  .dash   { border:none; border-top:1px dashed #888; margin:5px 0; }
  .solid  { border:none; border-top:1px solid #000; margin:5px 0; }

  /* ── Table ── */
  table   { width:100%; border-collapse:collapse; font-size:8pt; }
  thead tr { border-bottom:1px solid #000; }
  thead th { padding:3px 2px; font-size:7.5pt; font-weight:800; text-transform:uppercase; letter-spacing:0.3px; }
  .th-l   { text-align:left; }
  .th-r   { text-align:right; }
  .th-c   { text-align:center; }
  tbody tr { border-bottom:1px dotted #ccc; }
  .td-name{ padding:3px 2px; vertical-align:top; max-width:30mm; word-break:break-word; }
  .td-c   { text-align:center; padding:3px 2px; white-space:nowrap; }
  .td-r   { text-align:right; padding:3px 2px; white-space:nowrap; }
  .td-b   { font-weight:700; }

  /* ── Summary ── */
  .sumbox { margin-top:4px; font-size:8.5pt; }
  .srow   { display:flex; justify-content:space-between; padding:2px 0; }
  .slabel { color:#555; }
  .sval   { font-weight:700; }
  .stotal { display:flex; justify-content:space-between; padding:5px 0 3px; font-size:11pt; font-weight:900; border-top:1px solid #000; margin-top:3px; }

  .debt-box {
    margin-top:4px; padding:3px 5px; border:1px solid #000;
    border-radius:2px; display:flex; justify-content:space-between;
    font-weight:800;
  }
  .surplus-box {
    margin-top:4px; padding:3px 5px; border:1px dashed #000;
    border-radius:2px; display:flex; justify-content:space-between;
    font-weight:800;
  }

  /* ── Section ── */
  .section { margin-top:5px; text-align:center; }
  .label   { font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#555; margin-bottom:2px; }

  /* ── Footer ── */
  .footer { text-align:center; margin-top:6px; padding-top:5px; border-top:1px dashed #888; font-size:7.5pt; color:#333; line-height:1.6; }
  .thanks { font-size:9.5pt; font-weight:900; color:#000; margin-bottom:2px; }

  /* ── Kiosk: ẩn mọi UI khi in ── */
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  ${logoHtml}
  <div class="shop">${shop.name}</div>
  <div class="sub">${shop.address}</div>
  <div class="sub">☎ ${shop.phone}</div>
  <div class="title">${invoiceTitle}</div>
</div>

<!-- INFO -->
<div class="info">
  <div class="irow"><span class="ilabel">Mã đơn</span><span class="ival">#${code}</span></div>
  <div class="irow"><span class="ilabel">Ngày</span><span class="ival">${now}</span></div>
  ${partnerName ? `<div class="irow"><span class="ilabel">${partnerLabelTx}</span><span class="ival">${partnerName}</span></div>` : ''}
  ${note ? `<div class="irow"><span class="ilabel">Ghi chú</span><span class="ival">${note}</span></div>` : ''}
</div>

<hr class="dash"/>

<!-- TABLE -->
<table>
  <thead><tr>
    <th class="th-l">Sản phẩm</th>
    <th class="th-c">SL</th>
    <th class="th-r">Giá</th>
    <th class="th-r">T.Tiền</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<hr class="solid"/>

<!-- SUMMARY -->
<div class="sumbox">
  ${subtotal !== grandTotal || discount > 0 ? `
  <div class="srow"><span class="slabel">Tạm tính</span><span class="sval">${fmtN(subtotal)}₫</span></div>` : ''}
  ${discount > 0 ? `
  <div class="srow"><span class="slabel">Giảm giá</span><span class="sval">−${fmtN(discount)}₫</span></div>` : ''}
  <div class="stotal">
    <span>${isImport ? 'TỔNG NHẬP' : 'TỔNG CỘNG'}</span>
    <span>${fmtN(grandTotal)}₫</span>
  </div>
  ${showPayment ? `
  <div class="srow" style="margin-top:3px"><span class="slabel">${isImport ? 'Đã trả NCC' : 'Khách trả'}</span><span class="sval">${fmtN(paid)}₫</span></div>
  ${debt > 0 ? `<div class="debt-box">⚠ ${isImport ? 'Còn nợ NCC' : 'Còn nợ lại'}<span>${fmtN(debt)}₫</span></div>` : ''}
  ${surplus > 0 ? `<div class="surplus-box">↩ Trả lại<span>${fmtN(surplus)}₫</span></div>` : ''}
  ${!debt && !surplus ? `<div class="srow"><span style="font-weight:800">✓ Đã thanh toán đủ</span><span></span></div>` : ''}
  ` : ''}
  ${pointsEarned > 0 ? `<div class="srow" style="margin-top:2px"><span class="slabel">Điểm tích lũy</span><span class="sval">+${pointsEarned} ★</span></div>` : ''}
</div>

<hr class="dash"/>

<!-- QR MÃ ĐƠN -->
<div class="section">
  <div class="label">Mã đơn hàng</div>
  ${qrImg(code, 80)}
  <div style="font-size:7pt;margin-top:2px;font-family:monospace">#${code}</div>
</div>

<!-- QR THANH TOÁN -->
${bankQr}

<!-- FOOTER -->
<div class="footer">
  <div class="thanks">${shop.thankMsg || 'Cảm ơn quý khách! 🙏'}</div>
  ${!isImport ? '<div>Đổi trả trong vòng 24 giờ kể từ khi mua.</div>' : ''}
  <div>☎ ${shop.phone}</div>
</div>

</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// A4/A5 template (giữ lại cho in đơn nhập kho / in lại từ Orders page)
// ─────────────────────────────────────────────────────────────────────────────

function buildA4Html({
  shop, code, now, partnerName, partnerLabelTx, invoiceTitle,
  items, subtotal, grandTotal, discount,
  paid, debt, surplus, showPayment,
  note, isImport, pointsEarned,
}) {
  const rows = items.map((i, idx) => {
    const name    = i.name || i.products?.name || '—'
    const unit    = i.unit ?? i.products?.unit ?? null
    const lineAmt = (i.price || 0) * (i.quantity || 0)
    return `
    <tr class="${idx % 2 === 1 ? 'alt' : ''}">
      <td class="td-name">${name}</td>
      <td class="td-center">${i.quantity}</td>
      <td class="td-center" style="color:${unit ? '#1a73e8' : '#999'};font-weight:${unit ? '700' : '400'}">${unit || '—'}</td>
      <td class="td-right">${fmtN(i.price)}</td>
      <td class="td-right td-bold">${fmtN(lineAmt)}</td>
    </tr>`
  }).join('')

  const bankQr = shop.bankName && shop.bankNumber
    ? `<div style="text-align:center;margin-top:12px">
        <div style="font-size:9pt;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Thanh toán QR</div>
        ${qrImg(`${shop.bankName} ${shop.bankNumber} ${shop.bankAccount || ''}`, 110)}
        <div style="font-size:8.5pt;margin-top:4px;color:#555">${shop.bankName} · ${shop.bankNumber}${shop.bankAccount ? ` · ${shop.bankAccount}` : ''}</div>
       </div>`
    : ''

  const logoHtml = shop.logo
    ? `<img src="${shop.logo}" style="max-height:50px;max-width:120px;object-fit:contain;display:block;margin:0 auto 6px" alt="logo" />`
    : ''

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<title>Hóa đơn #${code}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: A5 portrait; margin: 10mm 12mm; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:11.5pt; color:#1a1a1a; background:#fff; width:100%; }
  .header { text-align:center; padding-bottom:10px; border-bottom:2px solid #1a1a1a; margin-bottom:12px; }
  .shop-name { font-size:20pt; font-weight:800; letter-spacing:1px; text-transform:uppercase; }
  .shop-sub  { font-size:9.5pt; color:#555; margin-top:2px; }
  .invoice-title { font-size:13pt; font-weight:700; letter-spacing:2px; margin-top:8px; text-transform:uppercase; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:3px 16px; margin-bottom:12px; font-size:10.5pt; }
  .info-row  { display:flex; gap:5px; }
  .info-label{ color:#666; white-space:nowrap; }
  .info-value{ font-weight:600; }
  .divider   { border:none; border-top:1.5px dashed #aaa; margin:10px 0; }
  .divider-solid { border:none; border-top:1.5px solid #1a1a1a; margin:10px 0; }
  table { width:100%; border-collapse:collapse; margin-bottom:4px; }
  thead tr { background:#1a1a1a; color:#fff; }
  thead th { padding:6px 8px; font-size:10pt; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; }
  .th-name { text-align:left; } .th-right { text-align:right; } .th-center { text-align:center; }
  tbody tr { border-bottom:1px solid #e8e8e8; }
  tbody tr.alt { background:#f8f8f8; }
  .td-name   { padding:7px 8px; font-size:10.5pt; vertical-align:middle; }
  .td-center { text-align:center; padding:7px 6px; font-size:10.5pt; white-space:nowrap; }
  .td-right  { text-align:right; padding:7px 8px; font-size:10.5pt; white-space:nowrap; }
  .td-bold   { font-weight:600; }
  .summary   { width:55%; margin-left:auto; margin-top:8px; font-size:10.5pt; }
  .sum-row   { display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px solid #eee; }
  .sum-row:last-child { border-bottom:none; }
  .sum-label { color:#555; } .sum-value { font-weight:600; }
  .sum-total { display:flex; justify-content:space-between; padding:8px 0 4px; font-size:14pt; font-weight:800; border-top:2px solid #1a1a1a; margin-top:4px; }
  .footer    { text-align:center; margin-top:16px; padding-top:10px; border-top:1.5px dashed #aaa; font-size:10pt; color:#555; line-height:1.7; }
  .footer-thanks { font-size:12pt; font-weight:700; color:#1a1a1a; margin-bottom:3px; }
  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div class="shop-name">${shop.name}</div>
    <div class="shop-sub">Địa chỉ: ${shop.address} &nbsp;|&nbsp; SĐT: ${shop.phone}</div>
    <div class="invoice-title">${invoiceTitle}</div>
  </div>
  <div class="info-grid">
    <div class="info-row"><span class="info-label">Mã đơn:</span><span class="info-value">#${code}</span></div>
    <div class="info-row"><span class="info-label">Ngày:</span><span class="info-value">${now}</span></div>
    ${partnerName ? `<div class="info-row"><span class="info-label">${partnerLabelTx}</span><span class="info-value">${partnerName}</span></div>` : ''}
    ${note ? `<div class="info-row" style="grid-column:1/-1"><span class="info-label">Ghi chú:</span><span class="info-value">${note}</span></div>` : ''}
  </div>
  <table>
    <thead><tr>
      <th class="th-name">Sản phẩm</th><th class="th-center">SL</th><th class="th-center">ĐVT</th>
      <th class="th-right">Đơn giá (₫)</th><th class="th-right">Thành tiền (₫)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="summary">
    ${subtotal !== grandTotal || discount > 0 ? `<div class="sum-row"><span class="sum-label">Tạm tính</span><span class="sum-value">${fmtN(subtotal)} ₫</span></div>` : ''}
    ${discount > 0 ? `<div class="sum-row"><span class="sum-label">Giảm giá</span><span class="sum-value" style="color:#dc2626">− ${fmtN(discount)} ₫</span></div>` : ''}
    <div class="sum-total"><span>${isImport ? 'TỔNG TIỀN NHẬP' : 'TỔNG CỘNG'}</span><span>${fmtN(grandTotal)} ₫</span></div>
    ${showPayment ? `
    <div style="margin-top:6px;border-top:1px dashed #ccc;padding-top:6px;">
      <div class="sum-row"><span class="sum-label">${isImport ? 'Đã trả NCC' : 'Khách đã trả'}</span><span class="sum-value" style="color:#16a34a">${fmtN(paid)} ₫</span></div>
      ${debt > 0 ? `<div class="sum-row" style="background:#fef2f2;padding:4px 6px;border-radius:4px;margin-top:3px;"><span style="color:#dc2626;font-weight:700">⚠ Còn nợ lại</span><span style="color:#dc2626;font-weight:800">${fmtN(debt)} ₫</span></div>` : ''}
      ${surplus > 0 ? `<div class="sum-row" style="background:#f0fdf4;padding:4px 6px;border-radius:4px;margin-top:3px;"><span style="color:#16a34a;font-weight:700">✓ Trả lại</span><span style="color:#16a34a;font-weight:800">${fmtN(surplus)} ₫</span></div>` : ''}
      ${!debt && !surplus ? `<div class="sum-row"><span style="color:#16a34a">✓ Đã thanh toán đủ</span><span></span></div>` : ''}
    </div>` : ''}
    ${pointsEarned > 0 ? `<div class="sum-row" style="margin-top:4px"><span class="sum-label">Điểm tích lũy</span><span class="sum-value">+${pointsEarned} ★</span></div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-thanks">${isImport ? '📦 Phiếu nhập kho đã ghi nhận' : (shop.thankMsg || '🙏 Cảm ơn quý khách đã mua hàng!')}</div>
    ${!isImport ? '<div>Hàng đã mua không được đổi trả sau 24 giờ.</div>' : ''}
    <div>Mọi thắc mắc vui lòng liên hệ: <strong>${shop.phone}</strong></div>
    ${bankQr}
  </div>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * buildReceiptHtml — sinh HTML hóa đơn
 * @param {object} params
 * @param {string} [params.printMode] — 'thermal' (80mm) | 'a4' — mặc định lấy từ shopConfig
 */
export function buildReceiptHtml({
  order, customer, items, total,
  discount = 0, note = '',
  paidAmount, debtAmount,
  isImport = false,
  partnerLabel,
  pointsEarned = 0,
  printMode,
}) {
  const shop        = getShopConfig()
  const mode        = printMode ?? shop.printMode ?? 'thermal'
  const code        = (order?.order_code || order?.id?.slice(-8) || '????????').toUpperCase()
  const now         = new Date(order?.created_at || Date.now()).toLocaleString('vi-VN')
  const subtotal    = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0)
  const partnerName = customer?.fullName || customer?.full_name || customer?.name || null
  const grandTotal  = total ?? Math.max(0, subtotal - discount)
  const paid        = paidAmount !== undefined ? paidAmount : grandTotal
  const debt        = debtAmount !== undefined ? debtAmount : Math.max(0, grandTotal - paid)
  const surplus     = Math.max(0, paid - grandTotal)
  const showPayment = paid !== grandTotal || debt > 0 || surplus > 0
  const invoiceTitle    = isImport ? (mode === 'thermal' ? 'PHIẾU NHẬP KHO' : '── Phiếu Nhập Kho ──') : (mode === 'thermal' ? 'HÓA ĐƠN BÁN HÀNG' : '── Hóa Đơn Bán Hàng ──')
  const partnerLabelTx  = partnerLabel ?? (isImport ? 'NCC:' : 'Khách:')

  const ctx = { shop, code, now, partnerName, partnerLabelTx, invoiceTitle, items, subtotal, grandTotal, discount, paid, debt, surplus, showPayment, note, isImport, pointsEarned }
  return mode === 'thermal' ? buildThermalHtml(ctx) : buildA4Html(ctx)
}

// ─────────────────────────────────────────────────────────────────────────────
// printViaIframe — in qua iframe ẩn (không block UI)
// ─────────────────────────────────────────────────────────────────────────────

export function printViaIframe(html) {
  setTimeout(() => {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:0;opacity:0'
    document.body.appendChild(frame)
    const doc = frame.contentWindow.document
    doc.open(); doc.write(html); doc.close()
    frame.onload = () => {
      try {
        frame.contentWindow.focus()
        frame.contentWindow.print()
      } catch (e) {
        console.warn('[Print]', e)
      }
      setTimeout(() => document.body.contains(frame) && document.body.removeChild(frame), 2000)
    }
  }, 200)
}
