import jsQR from 'jsqr'
import { supabase } from './supabase'

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY

// ── Storage upload ─────────────────────────────────────────────────────────
// Lưu ảnh vào invoices/sales/<userId>/<ts>.ext hoặc invoices/purchases/...

export async function uploadInvoiceImage(file, userId, type = 'SALE') {
  if (!supabase || !userId) return null
  const folder = type === 'PURCHASE' ? 'purchases' : 'sales'
  const ext    = file.name.split('.').pop().toLowerCase()
  const path   = `${folder}/${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('invoices')
    .upload(path, file, { contentType: file.type })
  if (error) console.warn('Upload invoice failed:', error.message)
  return path
}

// ── QR Code Scanner ────────────────────────────────────────────────────────
// Đọc QR từ file ảnh bằng jsQR, parse định dạng hóa đơn điện tử Tổng cục Thuế

function fileToImageData(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, img.width, img.height))
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh')) }
    img.src = url
  })
}

// Parse QR hóa đơn điện tử theo Thông tư 78/2021/TT-BTC
// Định dạng pipe-separated: loại|giao_dịch|ký_hiệu_mẫu|ký_hiệu_hđ|số_hđ|ngày|mst_bán|tiền_chưa_thuế|thuế_suất|tiền_thuế|tổng|mst_mua?
// Hoặc URL: https://hoadondientu.gdt.gov.vn?nbmst=...&shdon=...&nlap=...&tgtttbso=...
function parseVietnamInvoiceQR(qrText) {
  const text = (qrText || '').trim()

  // Thử parse URL của cổng Tổng cục Thuế
  if (text.startsWith('http')) {
    try {
      const url    = new URL(text)
      const params = url.searchParams
      const date   = params.get('nlap') || params.get('tdlap') || null
      return {
        _source:       'QR',
        tax_code:      params.get('nbmst') || null,
        invoice_no:    params.get('shdon') || null,
        invoice_serial:params.get('khhdon') || null,
        invoice_date:  date ? date.slice(0, 10) : null,
        total_amount:  parseInt(params.get('tgtttbso') || params.get('tgttt') || '0') || 0,
        tax_amount:    parseInt(params.get('tgtthue') || '0') || 0,
        buyer_tax:     params.get('nmmst') || null,
        qr_url:        text,
        items:         [],
      }
    } catch { /* fallthrough */ }
  }

  // Thử parse pipe-separated (định dạng phổ biến trên hóa đơn in)
  const parts = text.split('|')
  if (parts.length >= 6) {
    const rawDate = parts[5] || ''
    // Ngày có thể là "2024-03-15T10:30:00" hoặc "15/03/2024"
    let invoiceDate = null
    if (rawDate.includes('T')) invoiceDate = rawDate.slice(0, 10)
    else if (rawDate.includes('/')) {
      const [d, m, y] = rawDate.split('/')
      invoiceDate = `${y}-${m?.padStart(2,'0')}-${d?.padStart(2,'0')}`
    } else invoiceDate = rawDate.slice(0, 10) || null

    return {
      _source:        'QR',
      invoice_type:   parts[0] || null,
      invoice_serial: parts[3] || null,
      invoice_no:     parts[4] || null,
      invoice_date:   invoiceDate,
      tax_code:       parts[6] || null,
      subtotal:       parseInt(parts[7]) || 0,
      tax_rate:       parts[8] || null,
      tax_amount:     parseInt(parts[9]) || 0,
      total_amount:   parseInt(parts[10]) || 0,
      buyer_tax:      parts[11] || null,
      qr_raw:         text,
      items:          [],
    }
  }

  return null
}

// Xuất hàm chính: đọc QR từ file ảnh
// Trả về { qrData, fallbackToAI }
// qrData = null nếu không tìm thấy QR → fallbackToAI = true
export async function scanQRCode(file) {
  try {
    const imageData = await fileToImageData(file)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (!code?.data) {
      // Thử lại với ảnh đảo màu (một số QR in nền tối)
      const code2 = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'onlyInvert',
      })
      if (!code2?.data) return { qrData: null, fallbackToAI: true }
      const parsed = parseVietnamInvoiceQR(code2.data)
      if (!parsed) return { qrData: null, fallbackToAI: true }
      return { qrData: parsed, fallbackToAI: false }
    }

    const parsed = parseVietnamInvoiceQR(code.data)
    if (!parsed) return { qrData: null, fallbackToAI: true }
    return { qrData: parsed, fallbackToAI: false }
  } catch (err) {
    console.warn('QR scan error:', err)
    return { qrData: null, fallbackToAI: true }
  }
}

// ── Prompt factory ─────────────────────────────────────────────────────────

function buildPrompt(type) {
  if (type === 'PURCHASE') {
    return `Phân tích hóa đơn mua hàng / phiếu nhập kho trong ảnh.
Trả về JSON thuần (không dùng markdown code block):
{
  "supplier_name": "tên nhà cung cấp nếu có, null nếu không rõ",
  "invoice_date": "ngày hóa đơn dạng YYYY-MM-DD nếu có, null nếu không",
  "due_date": "ngày đáo hạn thanh toán dạng YYYY-MM-DD nếu có, null nếu không",
  "total_amount": tổng tiền phải trả dạng số nguyên (VND),
  "paid_amount": số tiền đã trả trước (nếu có, mặc định 0),
  "items": [
    { "name": "tên sản phẩm", "quantity": số lượng, "price": đơn giá nhập dạng số nguyên }
  ]
}
Nếu trường nào không đọc được, dùng null hoặc 0. Chỉ trả về JSON.`
  }
  // SALE
  return `Phân tích hóa đơn bán hàng trong ảnh.
Trả về JSON thuần (không dùng markdown code block):
{
  "customer_name": "tên khách hàng nếu có, null nếu không rõ",
  "total_amount": tổng tiền dạng số nguyên (VND),
  "items": [
    { "name": "tên sản phẩm", "quantity": số lượng, "price": đơn giá dạng số nguyên }
  ]
}
Nếu trường nào không đọc được, dùng null hoặc 0. Chỉ trả về JSON.`
}

// ── Gemini API call ────────────────────────────────────────────────────────

export async function scanInvoice(file, type = 'SALE') {
  if (!GEMINI_KEY) throw new Error('Chưa cấu hình VITE_GEMINI_API_KEY trong .env.local')

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: buildPrompt(type) },
            { inlineData: { mimeType: file.type, data: base64 } },
          ]
        }],
        generationConfig: {
          temperature:    0.1,
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Gemini lỗi HTTP ${res.status}`)
  }

  const data = await res.json()

  // gemini-2.5-flash có thể trả nhiều parts (thinking + text), lấy tất cả text
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const raw   = parts.map(p => p.text ?? '').join('')

  // Strip markdown fences
  let clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  // Tìm JSON object đầu tiên trong response (bỏ qua text thừa trước/sau)
  const start = clean.indexOf('{')
  const end   = clean.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.slice(start, end + 1)
  }

  try {
    return JSON.parse(clean)
  } catch {
    console.error('Gemini raw response:', raw)
    throw new Error('AI trả về dữ liệu không hợp lệ, vui lòng thử lại.')
  }
}
