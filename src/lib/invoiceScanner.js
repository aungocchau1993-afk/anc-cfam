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
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
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
