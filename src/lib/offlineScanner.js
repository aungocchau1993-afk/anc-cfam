import { createWorker, PSM } from 'tesseract.js'

// ── Worker singleton ───────────────────────────────────────────────────────

let _worker    = null
let _loading   = false
let _callbacks = []

async function getWorker(onProgress) {
  if (_worker) return _worker
  if (_loading) return new Promise(resolve => _callbacks.push(resolve))

  _loading = true
  onProgress?.({ status: 'loading-language', progress: 0 })

  const w = await createWorker('vie', 1, {
    logger: m => {
      if (m.status === 'loading tesseract core')         onProgress?.({ status: 'loading-core', progress: Math.round(m.progress * 100) })
      if (m.status === 'loading language traineddata')   onProgress?.({ status: 'loading-lang', progress: Math.round(m.progress * 100) })
      if (m.status === 'recognizing text')               onProgress?.({ status: 'recognizing',  progress: Math.round(m.progress * 100) })
    },
  })

  // PSM 6 = Single uniform block — tốt hơn cho layout hóa đơn
  await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })

  _worker  = w
  _loading = false
  _callbacks.forEach(cb => cb(w))
  _callbacks = []
  return w
}

// ── Image preprocessing ────────────────────────────────────────────────────
// Chiến lược: scale lên lớn + grayscale + contrast sigmoid + sharpen kernel
// KHÔNG dùng binary threshold — Tesseract hoạt động tốt hơn với grayscale

function applySharpKernel(data, width, height) {
  // 3×3 unsharp mask: [0,-1,0,-1,5,-1,0,-1,0]
  const src = new Uint8ClampedArray(data)
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let acc = 0
      let ki  = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4
          acc += src[idx] * kernel[ki++]
        }
      }
      const idx = (y * width + x) * 4
      const v   = Math.max(0, Math.min(255, acc))
      data[idx] = data[idx + 1] = data[idx + 2] = v
    }
  }
}

// Sigmoid contrast: kéo shadows xuống, highlights lên — giữ được chi tiết chữ
function sigmoidContrast(v, gain = 8, cutoff = 0.5) {
  const norm = v / 255
  const sig  = 1 / (1 + Math.exp(-gain * (norm - cutoff)))
  // Normalize về [0,1] dựa trên endpoint
  const lo = 1 / (1 + Math.exp(gain * cutoff))
  const hi = 1 / (1 + Math.exp(-gain * (1 - cutoff)))
  return Math.round(((sig - lo) / (hi - lo)) * 255)
}

export function preprocessImageToBlob(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      // Scale: target ít nhất 2400px chiều rộng — Tesseract nhận tốt hơn
      const targetW = 2400
      const scale   = img.width < targetW ? targetW / img.width : 1
      const W = Math.round(img.width  * scale)
      const H = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width  = W
      canvas.height = H
      const ctx = canvas.getContext('2d')

      // Dùng imageSmoothingQuality cao khi scale up
      ctx.imageSmoothingEnabled  = true
      ctx.imageSmoothingQuality  = 'high'
      ctx.drawImage(img, 0, 0, W, H)

      const imgData = ctx.getImageData(0, 0, W, H)
      const d       = imgData.data

      // Pass 1: Grayscale + Sigmoid contrast
      for (let i = 0; i < d.length; i += 4) {
        const gray = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])
        const c    = sigmoidContrast(gray, 7, 0.5)
        d[i] = d[i + 1] = d[i + 2] = c
        d[i + 3] = 255
      }

      // Pass 2: Sharpen để chữ rõ hơn (đặc biệt hữu ích sau scale up)
      applySharpKernel(d, W, H)

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
  return parseInt(str.replace(/[.,\s]/g, ''), 10) || 0
}

// ── Regex-based field extractor ────────────────────────────────────────────
// Lưu ý: Tesseract hay nhầm dấu thanh → dùng pattern loose + cả không dấu

function extractFields(text) {
  const t = text || ''

  // ── MST ── (số thuần, ít bị ảnh hưởng bởi dấu thanh)
  const mstMatch = t.match(
    /(?:mã\s*s[ôo]\s*thu[eế]|m[^\w\s]{0,3}s[^\w\s]{0,3}t|tax\s*(?:code|id))[:\s]*([0-9]{10}(?:-[0-9]{3})?)/i
  ) ?? t.match(/\b([0-9]{10}(?:-[0-9]{3})?)\b/)
  const tax_code = mstMatch?.[1] ?? null

  // ── Tổng tiền ── (cũng tìm dạng không dấu Tesseract hay xuất ra)
  const totalPatterns = [
    /(?:t[oô]ng\s*c[oô]ng|tong\s*cong|t[oô]ng\s*ti[eề]n|thanh\s*to[aá]n)[:\s]*([\d.,]+)/i,
    /(?:th[aà]nh\s*ti[eề]n|total)[:\s]*([\d.,]+)/i,
    /(?:c[oô]ng\s*ti[eề]n|ti[eề]n\s*thanh)[:\s]*([\d.,]+)/i,
  ]
  let total_amount = 0
  for (const pat of totalPatterns) {
    const m = t.match(pat)
    if (m) { total_amount = parseMoney(m[1]); break }
  }

  // ── Tiền thuế ──
  const vatMatch = t.match(
    /(?:ti[eề]n\s*thu[eế]|thu[eế]\s*(?:gtgt|vat)|vat)[:\s]*([\d.,]+)/i
  )
  const tax_amount = vatMatch ? parseMoney(vatMatch[1]) : 0

  // ── Ngày ──
  let invoice_date = null
  const dmy1 = t.match(/ng[aà]y\s*(\d{1,2})\s*th[aá]ng\s*(\d{1,2})\s*n[aă]m\s*(\d{4})/i)
  if (dmy1) {
    const [, d, m, y] = dmy1
    invoice_date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  } else {
    const dmy2 = t.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
    if (dmy2) {
      const [, d, m, y] = dmy2
      invoice_date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
    }
  }

  // ── Số HĐ ──
  const invoiceNoMatch = t.match(
    /(?:s[oô]\s*(?:h[oó][aá]\s*[dđ][oơ]n|h[^\w]{0,2}[dđ])|invoice\s*(?:no|number|#))[:\s]*([A-Z0-9\/\-]{3,20})/i
  )
  const invoice_no = invoiceNoMatch?.[1]?.trim() ?? null

  // ── Nhà cung cấp ──
  const companyMatch = t.match(
    /(?:c[oô]ng\s*ty|cty\s*(?:tnhh|cp)|company)[^\n]{2,60}/i
  )
  const supplier_name = companyMatch?.[0]?.trim().slice(0, 80) ?? null

  // ── Items: nhận bảng hóa đơn ──
  // Tesseract với PSM 6 thường giữ cấu trúc dòng tốt hơn
  const items = []
  const lines = t.split('\n').map(l => l.trim()).filter(l => l.length > 4)
  for (const line of lines) {
    // 4 cột: Tên | SL | Đơn giá | Thành tiền
    const c4 = line.match(/^(.+?)\s{2,}(\d{1,5})\s{2,}([\d.,]{4,})\s{2,}([\d.,]{4,})\s*$/)
    if (c4) {
      const price = parseMoney(c4[3])
      if (price >= 1000) {
        items.push({ name: c4[1].trim(), quantity: parseInt(c4[2]) || 1, price })
        continue
      }
    }
    // 3 cột: Tên | SL | Thành tiền
    const c3 = line.match(/^(.{4,50}?)\s{2,}(\d{1,5})\s{2,}([\d.,]{5,})\s*$/)
    if (c3 && parseMoney(c3[3]) >= 1000) {
      items.push({ name: c3[1].trim(), quantity: parseInt(c3[2]) || 1, price: parseMoney(c3[3]) })
    }
  }

  return { tax_code, total_amount, tax_amount, invoice_date, invoice_no, supplier_name, items }
}

// ── Main export ────────────────────────────────────────────────────────────

export async function offlineScanInvoice(file, onProgress) {
  onProgress?.({ status: 'preprocessing', progress: 0 })
  const processedBlob = await preprocessImageToBlob(file)

  const worker = await getWorker(onProgress)

  onProgress?.({ status: 'recognizing', progress: 0 })
  const { data } = await worker.recognize(processedBlob)

  const avgConfidence = data.words?.length
    ? Math.round(data.words.reduce((s, w) => s + w.confidence, 0) / data.words.length)
    : data.confidence ?? 0

  const fields = extractFields(data.text)

  return {
    _source:        'OFFLINE',
    _confidence:    avgConfidence,
    _lowConfidence: avgConfidence < 70,
    _rawText:       data.text,
    ...fields,
    customer_name:  null,
  }
}

export async function terminateOfflineWorker() {
  if (_worker) {
    await _worker.terminate()
    _worker  = null
    _loading = false
  }
}
