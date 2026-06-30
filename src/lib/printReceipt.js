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
  bankQrImage:'',          // Ảnh QR upload từ máy (base64)
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

// ── Bank code lookup → VietQR short code ──────────────────────────────────
const BANK_CODES = {
  'mb':         'MB',  'mbbank':   'MB',  'mb bank':    'MB',  '970422': 'MB',
  'vcb':        'VCB', 'vietcombank':'VCB','970436':     'VCB',
  'tcb':        'TCB', 'techcombank':'TCB','970407':     'TCB',
  'acb':        'ACB', '970416':   'ACB',
  'bidv':       'BIDV','970418':   'BIDV',
  'agribank':   'AGR', '970405':   'AGR',
  'vpb':        'VPB', 'vpbank':   'VPB', '970432':     'VPB',
  'tpb':        'TPB', 'tpbank':   'TPB', '970423':     'TPB',
  'vib':        'VIB', '970441':   'VIB',
  'msb':        'MSB', 'maritime': 'MSB', '970426':     'MSB',
  'ocb':        'OCB', '970448':   'OCB',
  'hdb':        'HDB', 'hdbank':   'HDB', '970437':     'HDB',
  'shb':        'SHB', '970443':   'SHB',
  'exim':       'EIB', 'eximbank': 'EIB', '970431':     'EIB',
  'sacom':      'STB', 'sacombank':'STB', '970403':     'STB',
  'seab':       'SEAB','seabank':  'SEAB','970440':     'SEAB',
  'abbank':     'ABB', '970425':   'ABB',
  'nam a':      'NAB', 'namabank': 'NAB', '970428':     'NAB',
  'lpbank':     'LPB', 'lien viet':'LPB', '970449':     'LPB',
  'vietinbank': 'ICB', 'viettin':  'ICB', '970415':     'ICB',
  'pvcombank':  'PVCB','pvcom':    'PVCB','970412':     'PVCB',
  'ncb':        'NCB', '970419':   'NCB',
  'scb':        'SCB', '970429':   'SCB',
  'dongabank':  'DAB', 'dong a':   'DAB', '970406':     'DAB',
}

function getBankVietQrCode(bankName) {
  if (!bankName) return null
  return BANK_CODES[bankName.toLowerCase().trim()] ?? null
}

// Sinh URL ảnh VietQR chuẩn (quét được qua app ngân hàng)
function vietQrUrl(shop) {
  const code = getBankVietQrCode(shop.bankName)
  if (!code || !shop.bankNumber) return null
  const name = encodeURIComponent((shop.bankAccount || '').toUpperCase())
  return `https://img.vietqr.io/image/${code}-${shop.bankNumber}-qr_only.png?accountName=${name}`
}

// Fallback: QR từ qrserver.com (text QR, không phải VietQR chuẩn)
function qrImg(data, size = 120) {
  const enc = encodeURIComponent(data)
  return `<img src="https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${enc}&margin=4&format=svg" width="${size}" height="${size}" alt="QR" style="display:block" />`
}

// Sinh thẻ <img> QR ngân hàng — ưu tiên VietQR, fallback qrserver
function bankQrImg(shop, size = 120, style = '') {
  const url = vietQrUrl(shop)
  if (url) return `<img src="${url}" width="${size}" height="${size}" alt="QR" style="display:block;${style}" />`
  if (shop.bankName && shop.bankNumber)
    return qrImg(`${shop.bankName} ${shop.bankNumber} ${shop.bankAccount || ''}`, size)
  return ''
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

  const bankQr = shop.bankName || shop.bankNumber
    ? `<div class="section" style="text-align:center">
        <div class="label">Thanh toán chuyển khoản</div>
        ${bankQrImg(shop, 130, 'margin:4px auto')}
        <div style="font-size:7pt;margin-top:3px">${[shop.bankName, shop.bankNumber, shop.bankAccount].filter(Boolean).join(' · ')}</div>
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
  ${note && !isImport ? `<div class="irow"><span class="ilabel">Ghi chú</span><span class="ival">${note}</span></div>` : ''}
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
      <td class="td-center dvt">${unit || '—'}</td>
      <td class="td-right">${fmtN(i.price)}</td>
      <td class="td-right td-bold">${fmtN(lineAmt)}</td>
    </tr>`
  }).join('')

  const hasBankInfo = shop.bankName || shop.bankNumber
  const bankQrHtml = hasBankInfo ? (() => {
    const qrSrc = vietQrUrl(shop)
    const qrBlock = qrSrc
      ? `<img src="${qrSrc}" class="qr-img" alt="QR" />`
      : bankQrImg(shop, 140)
    return `
    <div class="bank-block">
      <div class="bank-label">THANH TOÁN CHUYỂN KHOẢN</div>
      <div class="bank-inner">
        ${qrBlock ? `<div class="qr-wrap">${qrBlock}</div>` : ''}
        <div class="bank-info">
          ${shop.bankName   ? `<div><span class="bi-label">Ngân hàng</span><span class="bi-val">${shop.bankName}</span></div>` : ''}
          ${shop.bankNumber ? `<div><span class="bi-label">Số TK</span><span class="bi-val bi-acc">${shop.bankNumber}</span></div>` : ''}
          ${shop.bankAccount? `<div><span class="bi-label">Chủ TK</span><span class="bi-val">${shop.bankAccount}</span></div>` : ''}
        </div>
      </div>
    </div>`
  })() : ''

  const logoHtml = shop.logo
    ? `<img src="${shop.logo}" class="logo" alt="logo" />`
    : ''

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<title>Hóa đơn #${code}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  @page { size: A5 portrait; margin: 6mm 10mm 6mm; }
  body { font-family:'Segoe UI',Arial,sans-serif; font-size:10.5pt; color:#1a1a1a; background:#fff; }

  /* ── HEADER ── */
  .header { text-align:center; padding-bottom:6px; border-bottom:2px solid #1a1a1a; margin-bottom:7px; }
  .logo   { max-height:44px; max-width:110px; object-fit:contain; display:block; margin:0 auto 4px; }
  .shop-name { font-size:17pt; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; line-height:1.15; }
  .shop-sub  { font-size:8.5pt; color:#666; font-style:italic; margin-top:3px; line-height:1.4; }
  .invoice-title { display:inline-block; font-size:11pt; font-weight:700; letter-spacing:2px;
                   text-transform:uppercase; margin-top:5px; padding:2px 14px;
                   border-top:1px solid #bbb; border-bottom:1px solid #bbb; }

  /* ── META INFO ── */
  .meta { display:flex; justify-content:space-between; align-items:flex-start;
          gap:8px; margin-bottom:7px; font-size:9.5pt; }
  .meta-col { display:flex; flex-direction:column; gap:2px; }
  .meta-row { display:flex; gap:5px; }
  .meta-label { color:#777; white-space:nowrap; }
  .meta-value { font-weight:600; }

  /* ── TABLE ── */
  table { width:100%; border-collapse:collapse; margin-bottom:4px; }
  thead tr { background:#1a1a1a; color:#fff; }
  thead th { padding:5px 7px; font-size:9pt; font-weight:700; text-transform:uppercase; letter-spacing:0.4px; }
  .th-left   { text-align:left; }
  .th-center { text-align:center; }
  .th-right  { text-align:right; }
  tbody tr { border-bottom:1px solid #ddd; }
  tbody tr.alt { background:#f7f7f7; }
  tbody tr:last-child { border-bottom:2px solid #bbb; }
  .td-name   { padding:5px 7px; font-size:9.5pt; vertical-align:middle; line-height:1.35; }
  .td-center { text-align:center; padding:5px 5px; font-size:9.5pt; white-space:nowrap; }
  .td-right  { text-align:right; padding:5px 7px; font-size:9.5pt; white-space:nowrap; }
  .td-bold   { font-weight:700; }
  .dvt       { color:#1a73e8; font-weight:700; font-size:8.5pt; }

  /* ── SUMMARY ── */
  .summary-wrap { display:flex; justify-content:flex-end; margin-top:4px; }
  .summary { width:58%; font-size:9.5pt; }
  .sum-row  { display:flex; justify-content:space-between; padding:2.5px 0;
              border-bottom:1px solid #ebebeb; }
  .sum-row:last-child { border-bottom:none; }
  .sum-label { color:#555; }
  .sum-value { font-weight:600; }
  .sum-total { display:flex; justify-content:space-between; align-items:baseline;
               padding:5px 0 4px; font-size:13pt; font-weight:900;
               border-top:2.5px solid #1a1a1a; border-bottom:2.5px solid #1a1a1a;
               margin-top:3px; }
  .sum-total span:last-child { color:#c0392b; }

  /* ── FOOTER ── */
  .footer { margin-top:8px; padding-top:6px; border-top:1.5px dashed #bbb;
            font-size:9pt; color:#555; text-align:center; line-height:1.55; }
  .footer-thanks { font-size:10.5pt; font-weight:700; color:#1a1a1a; margin-bottom:2px; }

  /* ── BANK / QR ── */
  .bank-block { margin-top:7px; padding:6px 8px; border:1px solid #ddd;
                border-radius:6px; break-inside:avoid; page-break-inside:avoid; }
  .bank-label { font-size:7.5pt; font-weight:700; color:#777; text-transform:uppercase;
                letter-spacing:1px; text-align:center; margin-bottom:5px; }
  .bank-inner { display:flex; align-items:center; gap:10px; }
  .qr-wrap    { flex-shrink:0; }
  .qr-img     { width:140px; height:140px; object-fit:contain; display:block;
                border:1px solid #ddd; border-radius:4px; padding:4px; background:#fff; image-rendering:crisp-edges; }
  .bank-info  { display:flex; flex-direction:column; gap:3px; font-size:9pt; }
  .bank-info > div { display:flex; gap:6px; align-items:baseline; }
  .bi-label   { color:#888; white-space:nowrap; font-size:8pt; min-width:52px; }
  .bi-val     { font-weight:600; color:#1a1a1a; }
  .bi-acc     { font-size:10pt; font-weight:800; color:#1a73e8; letter-spacing:0.5px; }

  @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>

<div class="header">
  ${logoHtml}
  <div class="shop-name">${shop.name}</div>
  <div class="shop-sub">Địa chỉ: ${shop.address} &nbsp;|&nbsp; SĐT: ${shop.phone}</div>
  <div class="invoice-title">— ${invoiceTitle} —</div>
</div>

<div class="meta">
  <div class="meta-col">
    <div class="meta-row"><span class="meta-label">Mã đơn:</span><span class="meta-value">#${code}</span></div>
    ${partnerName ? `<div class="meta-row"><span class="meta-label">${partnerLabelTx}</span><span class="meta-value">${partnerName}</span></div>` : ''}
    ${note && !isImport ? `<div class="meta-row"><span class="meta-label">Ghi chú:</span><span class="meta-value">${note}</span></div>` : ''}
  </div>
  <div class="meta-col" style="text-align:right;align-items:flex-end">
    <div class="meta-row"><span class="meta-label">Ngày:</span><span class="meta-value">${now}</span></div>
  </div>
</div>

<table>
  <thead><tr>
    <th class="th-left" style="width:40%">Sản phẩm</th>
    <th class="th-center" style="width:8%">SL</th>
    <th class="th-center" style="width:10%">ĐVT</th>
    <th class="th-right" style="width:20%">Đơn giá (₫)</th>
    <th class="th-right" style="width:22%">Thành tiền (₫)</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="summary-wrap">
  <div class="summary">
    ${subtotal !== grandTotal || discount > 0 ? `<div class="sum-row"><span class="sum-label">Tạm tính</span><span class="sum-value">${fmtN(subtotal)} ₫</span></div>` : ''}
    ${discount > 0 ? `<div class="sum-row"><span class="sum-label">Giảm giá</span><span class="sum-value" style="color:#dc2626">− ${fmtN(discount)} ₫</span></div>` : ''}
    <div class="sum-total">
      <span>${isImport ? 'TỔNG TIỀN NHẬP' : 'TỔNG CỘNG'}</span>
      <span>${fmtN(grandTotal)} ₫</span>
    </div>
    ${showPayment ? `
    <div style="margin-top:5px;padding-top:5px;border-top:1px dashed #ccc;">
      <div class="sum-row"><span class="sum-label">${isImport ? 'Đã trả NCC' : 'Khách đã trả'}</span><span class="sum-value" style="color:#16a34a">${fmtN(paid)} ₫</span></div>
      ${debt > 0    ? `<div class="sum-row" style="color:#dc2626"><span style="font-weight:700">⚠ Còn nợ lại</span><span style="font-weight:800">${fmtN(debt)} ₫</span></div>` : ''}
      ${surplus > 0 ? `<div class="sum-row" style="color:#16a34a"><span style="font-weight:700">✓ Tiền thừa</span><span style="font-weight:800">${fmtN(surplus)} ₫</span></div>` : ''}
      ${!debt && !surplus ? `<div class="sum-row"><span style="color:#16a34a">✓ Đã thanh toán đủ</span><span></span></div>` : ''}
    </div>` : ''}
    ${pointsEarned > 0 ? `<div class="sum-row" style="margin-top:3px"><span class="sum-label">Điểm tích lũy</span><span class="sum-value">+${pointsEarned} ★</span></div>` : ''}
  </div>
</div>

<div class="footer">
  <div class="footer-thanks">${isImport ? '📦 Phiếu nhập kho đã ghi nhận' : (shop.thankMsg || '🙏 Cảm ơn quý khách đã mua hàng!')}</div>
  ${!isImport ? '<div>Hàng đã mua không được đổi trả sau 24 giờ.</div>' : ''}
  <div>Mọi thắc mắc vui lòng liên hệ: <strong>${shop.phone}</strong></div>
  ${bankQrHtml}
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

export function printViaIframe(html, onAfterPrint) {
  setTimeout(() => {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:800px;height:600px;border:0;opacity:0'
    document.body.appendChild(frame)
    const doc = frame.contentWindow.document
    doc.open(); doc.write(html); doc.close()

    const cleanup = () => {
      document.body.contains(frame) && document.body.removeChild(frame)
    }

    const doPrint = () => {
      let done = false
      const finish = () => {
        if (done) return
        done = true
        try { frame.contentWindow?.removeEventListener('afterprint', onAfter) } catch {}
        window.removeEventListener('afterprint', onAfter)
        mql.removeEventListener('change', onMqlChange)
        clearTimeout(fallbackTimer)
        setTimeout(() => { cleanup(); onAfterPrint?.() }, 80)
      }

      // ── Cách 1: matchMedia('print') — hoạt động tốt nhất trên Chrome với iframe
      const mql = window.matchMedia('print')
      let printOpened = false
      const onMqlChange = (e) => {
        if (e.matches) { printOpened = true }           // dialog vừa mở
        else if (printOpened)  { finish() }             // dialog vừa đóng
      }
      mql.addEventListener('change', onMqlChange)

      // ── Cách 2: afterprint event — Firefox + một số browser khác
      const onAfter = () => finish()
      try { frame.contentWindow.addEventListener('afterprint', onAfter) } catch {}
      window.addEventListener('afterprint', onAfter, { once: true })

      // ── In
      try {
        frame.contentWindow.focus()
        frame.contentWindow.print()
      } catch (e) {
        console.warn('[Print]', e)
      }

      // ── Fallback cứng sau 10s
      const fallbackTimer = setTimeout(finish, 10000)
    }

    // Đợi tất cả ảnh (logo, QR...) load xong trước khi in
    // Guard: doPrint chỉ được gọi đúng 1 lần
    let printTriggered = false
    const safeDoPrint = () => {
      if (printTriggered) return
      printTriggered = true
      doPrint()
    }

    const imgs = Array.from(frame.contentDocument.images)
    if (imgs.length === 0) {
      safeDoPrint()
    } else {
      let loaded = 0
      const onImgDone = () => { if (++loaded >= imgs.length) safeDoPrint() }
      imgs.forEach(img => {
        if (img.complete) onImgDone()
        else { img.onload = onImgDone; img.onerror = onImgDone }
      })
      // Fallback timeout 4s nếu ảnh lâu load
      setTimeout(safeDoPrint, 4000)
    }
  }, 200)
}
