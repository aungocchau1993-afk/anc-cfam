export function fmtVND(n) {
  if (n == null || isNaN(n)) return '—'
  const abs = Math.abs(n)
  let s
  if (abs >= 1e9) s = (abs / 1e9).toFixed(2) + ' tỷ'
  else if (abs >= 1e6) s = (abs / 1e6).toFixed(0) + ' tr'
  else s = abs.toLocaleString('vi-VN')
  return (n < 0 ? '-' : '') + s
}

export function fmtVNDFull(n) {
  if (n == null || isNaN(n)) return '—'
  return (n < 0 ? '-' : '') + Math.round(Math.abs(n)).toLocaleString('vi-VN') + ' ₫'
}

export function fmtPct(n) {
  return (n ?? 0).toFixed(1) + '%'
}

export function parseVNDInput(str) {
  return parseInt(String(str).replace(/\./g, '').replace(/[^\d]/g, '')) || 0
}

export function formatMoneyLive(raw) {
  const digits = String(raw).replace(/\./g, '').replace(/[^\d]/g, '')
  if (!digits) return ''
  return parseInt(digits).toLocaleString('vi-VN')
}
