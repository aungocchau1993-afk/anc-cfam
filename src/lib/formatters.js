// ── Tìm kiếm tiếng Việt không dấu ─────────────────────────────────────────
export function removeVietnameseTones(str) {
  if (str === null || str === undefined) return ''
  let s = String(str)
  s = s.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a')
  s = s.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e')
  s = s.replace(/ì|í|ị|ỉ|ĩ/g, 'i')
  s = s.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o')
  s = s.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u')
  s = s.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y')
  s = s.replace(/đ/g, 'd')
  s = s.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, 'A')
  s = s.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, 'E')
  s = s.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, 'I')
  s = s.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, 'O')
  s = s.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, 'U')
  s = s.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, 'Y')
  s = s.replace(/Đ/g, 'D')
  s = s.normalize('NFD').replace(/[̀-ͯ]/g, '')
  return s.toLowerCase().trim()
}

// Hàm tìm kiếm không dấu — trả về true nếu text khớp query
export function vMatch(text, query) {
  if (!query) return true
  return removeVietnameseTones(text).includes(removeVietnameseTones(query))
}

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
  const s   = String(str)
  const neg = s.trimStart().startsWith('-')
  const n   = parseInt(s.replace(/\./g, '').replace(/[^\d]/g, '')) || 0
  return neg ? -n : n
}

export function formatMoneyLive(raw) {
  const s   = String(raw)
  const neg = s.trimStart().startsWith('-')
  const digits = s.replace(/\./g, '').replace(/[^\d]/g, '')
  if (!digits) return neg ? '-' : ''
  return (neg ? '-' : '') + parseInt(digits).toLocaleString('vi-VN')
}
