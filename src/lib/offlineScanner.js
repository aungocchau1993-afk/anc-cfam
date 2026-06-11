import { createWorker } from 'tesseract.js'

// ── Worker singleton ───────────────────────────────────────────────────────
// Khởi tạo 1 lần, tái sử dụng cho mọi lần quét để tiết kiệm thời gian load

let _worker   = null
let _loading  = false
let _callbacks = []

async function getWorker(onProgress) {
  if (_worker) return _worker

  // Nếu đang load → đợi
  if (_loading) {
    return new Promise(resolve => _callbacks.push(resolve))
  }

  _loading = true
  onProgress?.({ status: 'loading-language', progress: 0 })

  const w = await createWorker('vie', 1, {
    // Web worker mode (mặc định) → không block UI thread
    logger: m => {
      if (m.status === 'loading tesseract core') onProgress?.({ status: 'loading-core',     progress: Math.round(m.progress * 100) })
      if (m.status === 'loading language traineddata') onProgress?.({ status: 'loading-lang', progress: Math.round(m.progress * 100) })
      if (m.status === 'recognizing text') onProgress?.({ status: 'recognizing',   progress: Math.round(m.progress * 100) })
    },
  })

  _worker  = w
  _loading = false
  _callbacks.forEach(cb => cb(w))
  _callbacks = []
  return w
}

// ── Image preprocessing ────────────────────────────────────────────────────
// Grayscale + contrast + threshold để tăng độ chính xác OCR

function preprocessImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      // Scale up nhỏ hơn 1200px chiều rộng để Tesseract nhận tốt hơn
      const scale  = img.width < 1200 ? Math.min(2, 1200 / img.width) : 1
      const W = Math.round(img.width  * scale)
      const H = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, W, H)

      const imgData = ctx.getImageData(0, 0, W, H)
      const d = imgData.data

      // Contrast factor (giá trị 80 là tốt cho hóa đơn)
      const contrast = 80
      const factor   = (259 * (contrast + 255)) / (255 * (259 - contrast))

      for (let i = 0; i < d.length; i += 4) {
        // Grayscale (luma)
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
        // Tăng tương phản
        const c    = Math.max(0, Math.min(255, factor * (gray - 128) + 128))
        // Ngưỡng (threshold) → nhị phân hóa
        const bw   = c > 145 ? 255 : 0
        d[i] = d[i + 1] = d[i + 2] = bw
        d[i + 3] = 255
      }

      ctx.putImageData(imgData, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob(blob => resolve(blob), 'image/png')
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được ảnh')) }
    img.src = url
  })
}

// ── Vietnamese money parser ────────────────────────────────────────────────

function parseMoney(str) {
  if (!str) return 0
  // "1.234.567" hoặc "1,234,567" hoặc "1234567"
  return parseInt(str.replace(/[.,\s]/g, ''), 10) || 0
}

// ── Regex-based field extractor ────────────────────────────────────────────

function extractFields(text) {
  // ── MST (Mã số thuế) ──
  // Format: 10 chữ số hoặc 10-3 chữ số
  const mstMatch = text.match(
    /(?:mã\s*số\s*thuế|m\s*s\s*t|tax\s*(?:code|id))[:\s]*([0-9]{10}(?:-[0-9]{3})?)/i
  ) ?? text.match(/\b([0-9]{10}(?:-[0-9]{3})?)\b/)
  const tax_code = mstMatch?.[1] ?? null

  // ── Tổng tiền ──
  const totalMatch = text.match(
    /(?:tổng\s*(?:cộng|tiền|thanh\s*toán|số\s*tiền)|thành\s*tiền|total\s*amount|total)[:\s]*([\d.,]+)/i
  ) ?? text.match(
    /(?:cộng\s*tiền\s*hàng|tiền\s*thanh\s*toán)[:\s]*([\d.,]+)/i
  )
  const total_amount = totalMatch ? parseMoney(totalMatch[1]) : 0

  // ── Tiền thuế VAT ──
  const vatMatch = text.match(
    /(?:tiền\s*thuế|thuế\s*gtgt|vat|tax\s*amount)[:\s]*([\d.,]+)/i
  )
  const tax_amount = vatMatch ? parseMoney(vatMatch[1]) : 0

  // ── Ngày hóa đơn ──
  // Dạng: "ngày 15 tháng 3 năm 2024" hoặc "15/03/2024" hoặc "15-03-2024"
  let invoice_date = null
  const dmy1 = text.match(
    /ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4})/i
  )
  if (dmy1) {
    const [, d, m, y] = dmy1
    invoice_date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  } else {
    const dmy2 = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (dmy2) {
      const [, d, m, y] = dmy2
      invoice_date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
  }

  // ── Số hóa đơn ──
  const invoiceNoMatch = text.match(
    /(?:số\s*(?:hóa\s*đơn|h\s*đ)|invoice\s*(?:no|number|#))[:\s]*([A-Z0-9\/\-]+)/i
  )
  const invoice_no = invoiceNoMatch?.[1] ?? null

  // ── Tên công ty / nhà cung cấp ──
  const companyMatch = text.match(
    /(?:công\s*ty\s*(?:tnhh|cổ\s*phần|cp|hd)?|cty\s*(?:tnhh|cp)?|company)[^\n]*/i
  )
  const supplier_name = companyMatch?.[0]?.trim().slice(0, 80) ?? null

  // ── Cố gắng extract items từ dạng bảng ──
  // Nhận dạng dòng dạng: "Tên SP   SL   Đơn giá   Thành tiền"
  const items = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3)
  for (const line of lines) {
    // Pattern: text + số lượng + giá (3+ cột số)
    const cols = line.match(/^(.+?)\s{2,}(\d+)\s{2,}([\d.,]+)\s{2,}([\d.,]+)\s*$/)
    if (cols) {
      items.push({
        name:     cols[1].trim(),
        quantity: parseInt(cols[2]) || 1,
        price:    parseMoney(cols[3]),
      })
      continue
    }
    // Pattern đơn giản hơn: text + số + số
    const cols2 = line.match(/^(.{4,40}?)\s+(\d{1,4})\s+([\d.,]{5,})\s*$/)
    if (cols2 && parseMoney(cols2[3]) >= 1000) {
      items.push({
        name:     cols2[1].trim(),
        quantity: parseInt(cols2[2]) || 1,
        price:    parseMoney(cols2[3]),
      })
    }
  }

  return { tax_code, total_amount, tax_amount, invoice_date, invoice_no, supplier_name, items }
}

// ── Main export ────────────────────────────────────────────────────────────

export async function offlineScanInvoice(file, onProgress) {
  // 1. Tiền xử lý ảnh
  onProgress?.({ status: 'preprocessing', progress: 0 })
  const processedBlob = await preprocessImage(file)

  // 2. Lấy worker (tải language data lần đầu ~4MB, cached sau đó)
  const worker = await getWorker(onProgress)

  // 3. OCR
  onProgress?.({ status: 'recognizing', progress: 0 })
  const { data } = await worker.recognize(processedBlob)

  // 4. Tính confidence trung bình
  const avgConfidence = data.words?.length
    ? Math.round(data.words.reduce((s, w) => s + w.confidence, 0) / data.words.length)
    : data.confidence ?? 0

  const lowConfidence = avgConfidence < 70

  // 5. Extract fields bằng regex
  const fields = extractFields(data.text)

  return {
    _source:       'OFFLINE',
    _confidence:   avgConfidence,
    _lowConfidence: lowConfidence,
    _rawText:      data.text,
    ...fields,
    // Tương thích shape AI output
    customer_name: null,
  }
}

// Giải phóng worker khi cần (gọi khi đóng app)
export async function terminateOfflineWorker() {
  if (_worker) {
    await _worker.terminate()
    _worker  = null
    _loading = false
  }
}
