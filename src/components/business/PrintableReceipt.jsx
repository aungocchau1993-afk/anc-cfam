/**
 * PrintableReceipt — component in hóa đơn A5 (148×210mm)
 *
 * Props:
 *   orderData: {
 *     id, order_code, created_at,
 *     customer: { fullName, phone, address, currentDebt },
 *     items: [{ name, quantity, price }],
 *     total_amount, discount_amount, shipping_fee, paid_amount, debt_amount,
 *     note,
 *   }
 *   shopConfig: { name, address, phone, logo, bankName, bankNumber, bankAccount, thankMsg }
 *   printRef: React ref — được truyền vào để react-to-print dùng
 */

import { QRCodeSVG } from 'qrcode.react'

const fmt = n => Math.round(n ?? 0).toLocaleString('vi-VN') + '₫'
const fmtNum = n => Math.round(n ?? 0).toLocaleString('vi-VN')

export default function PrintableReceipt({ orderData, shopConfig, printRef }) {
  if (!orderData) return null

  const shop     = shopConfig ?? {}
  const order    = orderData
  const customer = order.customer ?? {}
  const items    = order.items ?? []

  const code        = (order.order_code || (order.id ?? '').slice(-8) || '??').toUpperCase()
  const createdAt   = new Date(order.created_at || Date.now()).toLocaleString('vi-VN')
  const subtotal    = items.reduce((s, i) => s + (i.price || 0) * (i.quantity || 0), 0)
  const shipping    = order.shipping_fee ?? 0
  const discount    = order.discount_amount ?? 0
  const grandTotal  = order.total_amount ?? Math.max(0, subtotal + shipping - discount)
  const paid        = order.paid_amount ?? grandTotal
  const debt        = order.debt_amount ?? Math.max(0, grandTotal - paid)
  const oldDebt     = customer.currentDebt ?? customer.current_debt ?? 0
  const surplus     = Math.max(0, paid - grandTotal)

  /* QR nội dung: ưu tiên VietQR nếu có ngân hàng, fallback mã đơn */
  const qrValue = shop.bankNumber
    ? `${shop.bankName ?? ''} ${shop.bankNumber} ${shop.bankAccount ?? ''} ${grandTotal} DH${code}`.trim()
    : `Đơn hàng #${code} | ${grandTotal.toLocaleString('vi-VN')}đ`

  return (
    <div ref={printRef} className="receipt-root">

      {/* ── CSS nhúng — chỉ áp dụng bên trong component này ── */}
      <style>{`
        /* Reset khi in */
        @media print {
          body > *:not(.receipt-portal) { display: none !important; }
          .receipt-portal               { display: block !important; }
          @page { size: A5; margin: 10mm; }
        }

        .receipt-root {
          font-family: 'Segoe UI', 'Arial', sans-serif;
          font-size: 11pt;
          color: #111;
          background: #fff;
          width: 128mm;           /* A5 trừ margin 10mm mỗi bên */
          margin: 0 auto;
          padding: 0;
          box-sizing: border-box;
          line-height: 1.45;
        }

        /* ── Header ── */
        .rcp-header {
          text-align: center;
          padding-bottom: 8px;
          border-bottom: 2px solid #111;
          margin-bottom: 10px;
        }
        .rcp-logo {
          max-height: 48px;
          max-width: 110px;
          object-fit: contain;
          display: block;
          margin: 0 auto 5px;
        }
        .rcp-shop-name {
          font-size: 16pt;
          font-weight: 900;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          line-height: 1.2;
        }
        .rcp-shop-sub {
          font-size: 8.5pt;
          color: #555;
          margin-top: 2px;
        }
        .rcp-title {
          font-size: 11pt;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-top: 7px;
          border-top: 1px dashed #aaa;
          padding-top: 5px;
        }

        /* ── Info rows ── */
        .rcp-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2px 14px;
          font-size: 9pt;
          margin-bottom: 10px;
        }
        .rcp-info-row      { display: flex; gap: 4px; }
        .rcp-info-label    { color: #666; white-space: nowrap; flex-shrink: 0; }
        .rcp-info-value    { font-weight: 700; word-break: break-word; }
        .rcp-info-fullrow  { grid-column: 1 / -1; }

        /* ── Divider ── */
        .rcp-dash   { border: none; border-top: 1px dashed #aaa; margin: 7px 0; }
        .rcp-solid  { border: none; border-top: 1.5px solid #111; margin: 7px 0; }

        /* ── Table ── */
        .rcp-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
        }
        .rcp-table thead tr {
          background: #111;
          color: #fff;
        }
        .rcp-table thead th {
          padding: 5px 6px;
          font-size: 8.5pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .rcp-table .th-l { text-align: left; }
        .rcp-table .th-r { text-align: right; }
        .rcp-table .th-c { text-align: center; }
        .rcp-table tbody tr { border-bottom: 1px solid #e0e0e0; }
        .rcp-table tbody tr:nth-child(even) { background: #f8f8f8; }
        .rcp-table tbody td { padding: 5px 6px; vertical-align: middle; }
        .rcp-table .td-r    { text-align: right; white-space: nowrap; }
        .rcp-table .td-c    { text-align: center; }
        .rcp-table .td-bold { font-weight: 700; }

        /* ── Summary ── */
        .rcp-summary {
          width: 62%;
          margin-left: auto;
          font-size: 9.5pt;
          margin-top: 6px;
        }
        .rcp-srow {
          display: flex;
          justify-content: space-between;
          padding: 2.5px 0;
          border-bottom: 1px solid #eee;
        }
        .rcp-srow:last-child { border-bottom: none; }
        .rcp-slabel { color: #555; }
        .rcp-sval   { font-weight: 700; }
        .rcp-total {
          display: flex;
          justify-content: space-between;
          padding: 7px 0 4px;
          font-size: 13.5pt;
          font-weight: 900;
          border-top: 2px solid #111;
          margin-top: 4px;
        }
        .rcp-debt-box {
          border: 1.5px solid #c00;
          border-radius: 4px;
          padding: 4px 8px;
          display: flex;
          justify-content: space-between;
          font-weight: 800;
          color: #c00;
          margin-top: 5px;
          font-size: 9.5pt;
        }
        .rcp-surplus-box {
          border: 1.5px solid #0a7a2e;
          border-radius: 4px;
          padding: 4px 8px;
          display: flex;
          justify-content: space-between;
          font-weight: 800;
          color: #0a7a2e;
          margin-top: 5px;
          font-size: 9.5pt;
        }

        /* ── Footer ── */
        .rcp-footer {
          margin-top: 12px;
          border-top: 1px dashed #aaa;
          padding-top: 10px;
          text-align: center;
          font-size: 8.5pt;
          color: #444;
          line-height: 1.7;
        }
        .rcp-footer-grid {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          justify-content: center;
          margin-bottom: 8px;
        }
        .rcp-qr-label {
          font-size: 7.5pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: #666;
          margin-bottom: 3px;
        }
        .rcp-bank-info {
          font-size: 8pt;
          text-align: left;
          line-height: 1.8;
        }
        .rcp-bank-name { font-weight: 900; font-size: 9pt; color: #111; }
        .rcp-thanks {
          font-size: 10.5pt;
          font-weight: 900;
          color: #111;
          margin-top: 6px;
        }
        .rcp-note {
          font-size: 8pt;
          color: #777;
          margin-top: 2px;
          font-style: italic;
        }

        /* ── Ẩn UI web khi in ── */
        @media print {
          .receipt-root {
            width: 100%;
            margin: 0;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════ */}
      <div className="rcp-header">
        {shop.logo && (
          <img src={shop.logo} alt="logo" className="rcp-logo" />
        )}
        <div className="rcp-shop-name">{shop.name || 'Tên Cửa Hàng'}</div>
        {shop.address && <div className="rcp-shop-sub">📍 {shop.address}</div>}
        {shop.phone   && <div className="rcp-shop-sub">☎ {shop.phone}</div>}
        <div className="rcp-title">Hóa Đơn Bán Hàng</div>
      </div>

      {/* ═══════════════════════════════════════════
          THÔNG TIN ĐƠN
      ═══════════════════════════════════════════ */}
      <div className="rcp-info">
        <div className="rcp-info-row">
          <span className="rcp-info-label">Mã đơn:</span>
          <span className="rcp-info-value" style={{ fontFamily: 'monospace' }}>#{code}</span>
        </div>
        <div className="rcp-info-row">
          <span className="rcp-info-label">Ngày:</span>
          <span className="rcp-info-value">{createdAt}</span>
        </div>
        {(customer.fullName || customer.full_name) && (
          <div className="rcp-info-row rcp-info-fullrow">
            <span className="rcp-info-label">Khách hàng:</span>
            <span className="rcp-info-value">{customer.fullName || customer.full_name}</span>
          </div>
        )}
        {customer.phone && (
          <div className="rcp-info-row">
            <span className="rcp-info-label">SĐT:</span>
            <span className="rcp-info-value">{customer.phone}</span>
          </div>
        )}
        {customer.address && (
          <div className="rcp-info-row rcp-info-fullrow">
            <span className="rcp-info-label">Địa chỉ:</span>
            <span className="rcp-info-value">{customer.address}</span>
          </div>
        )}
        {order.note && (
          <div className="rcp-info-row rcp-info-fullrow">
            <span className="rcp-info-label">Ghi chú:</span>
            <span className="rcp-info-value" style={{ fontStyle: 'italic' }}>{order.note}</span>
          </div>
        )}
      </div>

      <hr className="rcp-solid" />

      {/* ═══════════════════════════════════════════
          BẢNG HÀNG HÓA
      ═══════════════════════════════════════════ */}
      <table className="rcp-table">
        <thead>
          <tr>
            <th className="th-l" style={{ width: '40%' }}>Sản phẩm</th>
            <th className="th-c" style={{ width: '8%' }}>SL</th>
            <th className="th-c" style={{ width: '10%' }}>ĐVT</th>
            <th className="th-r" style={{ width: '20%' }}>Đơn giá</th>
            <th className="th-r" style={{ width: '22%' }}>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => {
            const name    = item.name || item.products?.name || '—'
            const unit    = item.unit ?? item.products?.unit ?? null
            const lineAmt = (item.price || 0) * (item.quantity || 0)
            return (
              <tr key={i}>
                <td>{name}</td>
                <td className="td-c">{fmtNum(item.quantity)}</td>
                <td className="td-c" style={{ color: unit ? '#1a73e8' : '#aaa', fontWeight: unit ? 700 : 400 }}>{unit || '—'}</td>
                <td className="td-r">{fmtNum(item.price)}</td>
                <td className="td-r td-bold">{fmtNum(lineAmt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <hr className="rcp-solid" />

      {/* ═══════════════════════════════════════════
          TỔNG KẾT
      ═══════════════════════════════════════════ */}
      <div className="rcp-summary">
        {(discount > 0 || shipping > 0) && (
          <div className="rcp-srow">
            <span className="rcp-slabel">Tạm tính</span>
            <span className="rcp-sval">{fmt(subtotal)}</span>
          </div>
        )}
        {shipping > 0 && (
          <div className="rcp-srow">
            <span className="rcp-slabel">Phí vận chuyển</span>
            <span className="rcp-sval">+{fmt(shipping)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="rcp-srow">
            <span className="rcp-slabel">Giảm giá</span>
            <span className="rcp-sval" style={{ color: '#c00' }}>−{fmt(discount)}</span>
          </div>
        )}
        {oldDebt > 0 && (
          <div className="rcp-srow">
            <span className="rcp-slabel">Nợ cũ</span>
            <span className="rcp-sval" style={{ color: '#c00' }}>{fmt(oldDebt)}</span>
          </div>
        )}
        <div className="rcp-total">
          <span>TỔNG CỘNG</span>
          <span>{fmt(grandTotal)}</span>
        </div>
        <div className="rcp-srow" style={{ marginTop: 4 }}>
          <span className="rcp-slabel">Khách đã trả</span>
          <span className="rcp-sval" style={{ color: '#0a7a2e' }}>{fmt(paid)}</span>
        </div>
        {debt > 0 && (
          <div className="rcp-debt-box">
            <span>💳 Còn nợ lại</span>
            <span>{fmt(debt)}</span>
          </div>
        )}
        {surplus > 0 && (
          <div className="rcp-surplus-box">
            <span>↩ Tiền thối</span>
            <span>{fmt(surplus)}</span>
          </div>
        )}
        {!debt && !surplus && (
          <div style={{ textAlign: 'right', color: '#0a7a2e', fontWeight: 800, fontSize: '8.5pt', marginTop: 4 }}>
            ✓ Đã thanh toán đủ
          </div>
        )}
      </div>

      <hr className="rcp-dash" style={{ marginTop: 12 }} />

      {/* ═══════════════════════════════════════════
          FOOTER — QR + bank + lời cảm ơn
      ═══════════════════════════════════════════ */}
      <div className="rcp-footer">
        <div className="rcp-footer-grid">
          {/* QR code */}
          <div>
            <div className="rcp-qr-label">
              {shop.bankNumber ? 'Quét QR thanh toán' : 'Mã đơn hàng'}
            </div>
            <QRCodeSVG
              value={qrValue}
              size={90}
              level="M"
              includeMargin={false}
            />
          </div>

          {/* Thông tin ngân hàng */}
          {shop.bankNumber && (
            <div className="rcp-bank-info">
              <div className="rcp-bank-name">{shop.bankName}</div>
              <div>STK: <strong>{shop.bankNumber}</strong></div>
              {shop.bankAccount && <div>Tên TK: <strong>{shop.bankAccount}</strong></div>}
              <div style={{ marginTop: 4 }}>
                Nội dung CK:<br />
                <strong>DH{code}</strong>
              </div>
            </div>
          )}
        </div>

        <div className="rcp-thanks">
          {shop.thankMsg || '🙏 Cảm ơn quý khách! Hẹn gặp lại!'}
        </div>
        <div className="rcp-note">Hàng đã mua không đổi trả sau 24 giờ · {shop.phone}</div>
      </div>

    </div>
  )
}
