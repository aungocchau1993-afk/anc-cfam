// ── Shared receipt print utility ──────────────────────────────────────────
// Dùng iframe ẩn để không block React state / UI thread

const SHOP_KEY = 'anc_shop_config'

export function getShopConfig() {
  try {
    const raw = localStorage.getItem(SHOP_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { name: 'Tên Cửa Hàng', address: '123 Đường ABC, Quận X, TP.HCM', phone: '0901 234 567' }
}

export function saveShopConfig(cfg) {
  localStorage.setItem(SHOP_KEY, JSON.stringify(cfg))
}

/**
 * buildReceiptHtml
 * @param {object} params
 * @param {object}  params.order
 * @param {object}  params.customer        — { fullName, full_name, name, phone }
 * @param {Array}   params.items           — [{ name, quantity, price, cost }]
 * @param {number}  params.total           — tổng tiền đơn
 * @param {number}  [params.discount]      — giảm giá (chỉ áp dụng đơn bán)
 * @param {string}  [params.note]
 * @param {number}  [params.paidAmount]    — số tiền đã thanh toán
 * @param {number}  [params.debtAmount]    — số tiền còn nợ (>0) hoặc trả dư (<0)
 * @param {boolean} [params.isImport]      — true = phiếu nhập kho
 * @param {string}  [params.partnerLabel]  — nhãn đối tác (VD: "Nhà cung cấp")
 */
export function buildReceiptHtml({
  order, customer, items, total,
  discount = 0, note = '',
  paidAmount, debtAmount,
  isImport = false,
  partnerLabel,
}) {
  const shop        = getShopConfig()
  const code        = (order?.order_code || order?.id?.slice(-8) || '????????').toUpperCase()
  const now         = new Date(order?.created_at || Date.now()).toLocaleString('vi-VN')
  const fmtNum      = n => Math.round(n ?? 0).toLocaleString('vi-VN')
  const subtotal    = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0)
  const partnerName = customer?.fullName || customer?.full_name || customer?.name || null
  const grandTotal  = total ?? Math.max(0, subtotal - discount)
  const profit      = items.reduce((s, i) => s + ((i.price || 0) - (i.cost || 0)) * (i.quantity || 0), 0) - discount

  // Tính paid/debt
  const paid        = paidAmount !== undefined ? paidAmount : grandTotal
  const debt        = debtAmount !== undefined ? debtAmount : Math.max(0, grandTotal - paid)
  const surplus     = Math.max(0, paid - grandTotal)
  const showPayment = paid !== grandTotal || debt > 0 || surplus > 0

  const invoiceTitle   = isImport ? '── Phiếu Nhập Kho ──' : '── Hóa Đơn Bán Hàng ──'
  const partnerLabelTx = partnerLabel ?? (isImport ? 'Nhà cung cấp:' : 'Khách hàng:')

  const rows = items.map((i, idx) => {
    const name    = i.name || i.products?.name || '—'
    const lineAmt = (i.price || 0) * (i.quantity || 0)
    return `
    <tr class="${idx % 2 === 1 ? 'alt' : ''}">
      <td class="td-name">${name}</td>
      <td class="td-center">${i.quantity}</td>
      <td class="td-right">${fmtNum(i.price)}</td>
      <td class="td-right td-bold">${fmtNum(lineAmt)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<title>Hóa đơn #${code}</title>
<style>
  /* ── Reset ─────────────────────────────── */
  * { margin:0; padding:0; box-sizing:border-box; }

  /* ── Page: A5 ngang (148mm x 210mm) ───── */
  @page {
    size: A5 portrait;
    margin: 10mm 12mm;
  }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11.5pt;
    color: #1a1a1a;
    background: #fff;
    width: 100%;
  }

  /* ── Header ────────────────────────────── */
  .header {
    text-align: center;
    padding-bottom: 10px;
    border-bottom: 2px solid #1a1a1a;
    margin-bottom: 12px;
  }
  .shop-name {
    font-size: 20pt;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .shop-sub {
    font-size: 9.5pt;
    color: #555;
    margin-top: 2px;
  }
  .invoice-title {
    font-size: 13pt;
    font-weight: 700;
    letter-spacing: 2px;
    margin-top: 8px;
    text-transform: uppercase;
  }

  /* ── Info grid ─────────────────────────── */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 16px;
    margin-bottom: 12px;
    font-size: 10.5pt;
  }
  .info-row { display: flex; gap: 5px; }
  .info-label { color: #666; white-space: nowrap; }
  .info-value { font-weight: 600; }

  /* ── Divider ───────────────────────────── */
  .divider {
    border: none;
    border-top: 1.5px dashed #aaa;
    margin: 10px 0;
  }
  .divider-solid {
    border: none;
    border-top: 1.5px solid #1a1a1a;
    margin: 10px 0;
  }

  /* ── Table ─────────────────────────────── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 4px;
  }
  thead tr {
    background: #1a1a1a;
    color: #fff;
  }
  thead th {
    padding: 6px 8px;
    font-size: 10pt;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .th-name  { text-align: left; }
  .th-right { text-align: right; }
  .th-center{ text-align: center; }

  tbody tr { border-bottom: 1px solid #e8e8e8; }
  tbody tr.alt { background: #f8f8f8; }

  .td-name {
    padding: 7px 8px;
    font-size: 10.5pt;
    vertical-align: middle;
  }
  .td-center {
    text-align: center;
    padding: 7px 6px;
    font-size: 10.5pt;
    white-space: nowrap;
  }
  .td-right {
    text-align: right;
    padding: 7px 8px;
    font-size: 10.5pt;
    white-space: nowrap;
  }
  .td-bold { font-weight: 600; }

  /* ── Summary ───────────────────────────── */
  .summary {
    width: 55%;
    margin-left: auto;
    margin-top: 8px;
    font-size: 10.5pt;
  }
  .sum-row {
    display: flex;
    justify-content: space-between;
    padding: 3px 0;
    border-bottom: 1px solid #eee;
  }
  .sum-row:last-child { border-bottom: none; }
  .sum-label { color: #555; }
  .sum-value { font-weight: 600; }
  .sum-total {
    display: flex;
    justify-content: space-between;
    padding: 8px 0 4px;
    font-size: 14pt;
    font-weight: 800;
    border-top: 2px solid #1a1a1a;
    margin-top: 4px;
  }

  /* ── Footer ────────────────────────────── */
  .footer {
    text-align: center;
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1.5px dashed #aaa;
    font-size: 10pt;
    color: #555;
    line-height: 1.7;
  }
  .footer-thanks {
    font-size: 12pt;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 3px;
  }
  .badge {
    display: inline-block;
    background: #1a1a1a;
    color: #fff;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 9pt;
    margin-top: 6px;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="shop-name">${shop.name}</div>
    <div class="shop-sub">Địa chỉ: ${shop.address} &nbsp;|&nbsp; SĐT: ${shop.phone}</div>
    <div class="invoice-title">${invoiceTitle}</div>
  </div>

  <!-- INFO -->
  <div class="info-grid">
    <div class="info-row">
      <span class="info-label">Mã đơn:</span>
      <span class="info-value">#${code}</span>
    </div>
    <div class="info-row">
      <span class="info-label">Ngày:</span>
      <span class="info-value">${now}</span>
    </div>
    ${partnerName ? `
    <div class="info-row">
      <span class="info-label">${partnerLabelTx}</span>
      <span class="info-value">${partnerName}</span>
    </div>` : ''}
    ${customer?.phone ? `
    <div class="info-row">
      <span class="info-label">Điện thoại:</span>
      <span class="info-value">${customer.phone}</span>
    </div>` : ''}
    ${note ? `
    <div class="info-row" style="grid-column:1/-1">
      <span class="info-label">Ghi chú:</span>
      <span class="info-value">${note}</span>
    </div>` : ''}
  </div>

  <!-- TABLE -->
  <table>
    <thead>
      <tr>
        <th class="th-name">Sản phẩm</th>
        <th class="th-center">SL</th>
        <th class="th-right">Đơn giá (₫)</th>
        <th class="th-right">Thành tiền (₫)</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- SUMMARY -->
  <div class="summary">
    ${subtotal !== grandTotal || discount > 0 ? `
    <div class="sum-row">
      <span class="sum-label">Tạm tính</span>
      <span class="sum-value">${fmtNum(subtotal)} ₫</span>
    </div>` : ''}
    ${discount > 0 ? `
    <div class="sum-row">
      <span class="sum-label">Giảm giá</span>
      <span class="sum-value" style="color:#dc2626">− ${fmtNum(discount)} ₫</span>
    </div>` : ''}
    <div class="sum-total">
      <span>${isImport ? 'TỔNG TIỀN NHẬP' : 'TỔNG CỘNG'}</span>
      <span>${fmtNum(grandTotal)} ₫</span>
    </div>
    ${showPayment ? `
    <div style="margin-top:6px;border-top:1px dashed #ccc;padding-top:6px;">
      <div class="sum-row">
        <span class="sum-label">${isImport ? 'Đã trả NCC' : 'Khách đã trả'}</span>
        <span class="sum-value" style="color:#16a34a">${fmtNum(paid)} ₫</span>
      </div>
      ${debt > 0 ? `
      <div class="sum-row" style="background:#fef2f2;padding:4px 6px;border-radius:4px;margin-top:3px;">
        <span class="sum-label" style="color:#dc2626;font-weight:700">${isImport ? '⚠ Còn nợ NCC' : '⚠ Còn nợ lại'}</span>
        <span class="sum-value" style="color:#dc2626;font-weight:800">${fmtNum(debt)} ₫</span>
      </div>` : ''}
      ${surplus > 0 ? `
      <div class="sum-row" style="background:#f0fdf4;padding:4px 6px;border-radius:4px;margin-top:3px;">
        <span class="sum-label" style="color:#16a34a;font-weight:700">${isImport ? '✓ NCC nợ ta' : '✓ Tiền thừa trả lại'}</span>
        <span class="sum-value" style="color:#16a34a;font-weight:800">${fmtNum(surplus)} ₫</span>
      </div>` : ''}
      ${!debt && !surplus ? `
      <div class="sum-row">
        <span class="sum-label" style="color:#16a34a">✓ Đã thanh toán đủ</span>
        <span></span>
      </div>` : ''}
    </div>` : ''}
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="footer-thanks">${isImport ? '📦 Phiếu nhập kho đã được ghi nhận' : '🙏 Cảm ơn quý khách đã mua hàng!'}</div>
    ${!isImport ? '<div>Hàng đã mua không được đổi trả sau 24 giờ.</div>' : ''}
    <div>Mọi thắc mắc vui lòng liên hệ SĐT: <strong>${shop.phone}</strong></div>
    <div class="badge">Business OS · ${new Date().toLocaleDateString('vi-VN')}</div>
  </div>

</body>
</html>`
}

export function printViaIframe(html) {
  setTimeout(() => {
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:0'
    document.body.appendChild(frame)
    frame.contentWindow.document.write(html)
    frame.contentWindow.document.close()
    frame.onload = () => {
      try {
        frame.contentWindow.focus()
        frame.contentWindow.print()
      } catch (e) {
        console.warn('[Print iframe]', e)
      }
      setTimeout(() => {
        if (document.body.contains(frame)) document.body.removeChild(frame)
      }, 1500)
    }
  }, 300)
}
