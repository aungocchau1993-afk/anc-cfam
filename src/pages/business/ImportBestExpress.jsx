import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { X, PenLine, FileSpreadsheet, Truck, Package, PackagePlus, Gift, FolderOpen, ChevronRight, CheckCircle2, XCircle, AlertTriangle, CreditCard } from 'lucide-react'
import ModalOverlay from '../../components/ui/ModalOverlay'
import { createImportOrder, loadSuppliers, loadProducts } from '../../lib/supabase'
import { formatMoneyLive, parseVNDInput, fmtVNDFull } from '../../lib/formatters'

// ── Config ─────────────────────────────────────────────────────────────────

const FUZZY_THRESHOLD = 40
const FUZZY_HIGH      = 85
const QTY_TOLERANCE   = 0.02

const BRAND_KEYWORDS = [
  'pediasure', 'pedia',
  'similac', 'simila', 'similar',
  'ensure', 'glucerna', 'grow', 'enfagrow', 'enfamil', 'enfamilk', 'enfamama',
  'nan', 'optipro', 'friso', 'frisolac', 'vinamilk', 'optimum', 'dielac', 'meiji', 'blackmore',
  'huggies', 'hugies', 'bobby', 'abbott', 'nestle',
  'colosiq', 'alpha lipid', 'nutifood',
  'aptamil', 'ap', 'aptam',
  'colosbaby', 'colos', 'baby',
  'th true milk', 'th', 'true milk',
  'milo', 'kun',
  'hikid', 'glico', 'morinaga', 'yoko', 'yokogold', 'growplus', 'grow plus',
  'colosopt', 'pediabest', 'kabrita', 'physiolac', 'bellamy', 'a2',
  'pampers', 'moony', 'merries'
]

const SUB_BRAND_KEYWORDS = [
  'gold vigor', 'gold', 'vigor', 'total protection', 'total comfort',
  'eye q', 'eyeq', 'sua nuoc', 'sua bot', 'isomil', 'iq plus',
]

const PROD_COLS  = ['Thông tin hàng hóa', 'Thong tin hang hoa', 'Tên hàng', 'Ten hang', 'Sản phẩm', 'San pham', 'Product', 'Hàng hóa', 'Hang hoa', 'Goods Info', 'Tên sản phẩm', 'Ten san pham', 'name', 'Tên hàng hóa', 'Ten hang hoa', 'Mặt hàng', 'Mat hang', 'Item', 'Description', 'Nội dung', 'Noi dung']
const PRICE_COLS = ['Số tiền COD', 'So tien COD', 'Thành tiền', 'Thanh tien', 'Giá', 'Gia', 'Tổng tiền', 'Tong tien', 'Total', 'Amount', 'COD', 'cod', 'Tiền thu hộ', 'Tien thu ho', 'Giá nhập', 'Gia nhap', 'Đơn giá', 'Don gia', 'Price', 'Unit Price', 'Tiền hàng', 'Tien hang', 'Số tiền', 'So tien', 'Tổng', 'Tong']
const QTY_COLS   = ['Số lượng', 'So luong', 'SL', 'Qty', 'Quantity', 'qty', 'SL nhập', 'SL Nhập']

// ── Pure helpers ───────────────────────────────────────────────────────────

function normalizeForMatch(str) {
  if (!str) return ''
  return String(str)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s.+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Làm sạch tên NCC: loại bỏ tag quảng cáo, tặng kèm, giá, số lượng x giá...
function cleanSupplierName(raw) {
  if (!raw) return ''
  let t = String(raw)
  // Cắt phần lặp sau dấu | (BEST Express hay cắt đôi chuỗi)
  t = t.split('|')[0]
  // Xóa [Tặng X gói dùng thử] — phải xóa trước khi xóa các tag khác
  t = t.replace(/\[[^\]]*[Tt]ặng[^\]]*\]/gi, '')
  t = t.replace(/\[[^\]]*[Tt]ang[^\]]*\]/gi, '')
  // Xóa các tag quảng cáo dạng [CHỈ 20H ...] [DEAL ...] ...
  // Xóa tất cả [tag] trong ngoặc vuông (bao gồm [CHỈ 20H...], [DEAL...], v.v)
  t = t.replace(/\[(?:CH[IỈ]|DEAL|SALE|FLASH|GI[AÁ]|SLCH|MUA)[^\]]*\]/gi, '')
  // Ahamove: xóa tag mô tả ở đầu chuỗi dạng "(Phù hợp cho trẻ sinh mổ) Tên SP"
  t = t.replace(/^\s*\([^)]{5,200}\)\s*/g, '')
  // Xóa ngoặc tròn dài (>30 ký tự) bất kỳ vị trí — thường là quảng cáo/mô tả
  t = t.replace(/\([^)]{30,200}\)/g, '')
  // Xóa số thứ tự [1] [2] cuối chuỗi
  t = t.replace(/\[\d+\]\|?/g, ' ')
  t = t.replace(/\*{3,}/g, ' ')
  // Xóa "X × giá" dạng "2x300.000đ"
  t = t.replace(/\d+\s*[xX×]\s*[\d,.\s]+[đdĐD]?/g, '')
  // Xóa số tiền
  t = t.replace(/[\d,.]+\s*(?:đ|d|VND|VNĐ|vnđ)\b/gi, '')
  // ── FIX: Xóa promo trong ngoặc tròn (an toàn, greedy bên trong parens) ──
  t = t.replace(/\((?:KM|Khuyen mai|Khuyến mãi|Tang kem|Tặng kèm|Quà tặng|Free|Miễn phí|Giảm giá|Sale|Combo|mẫu mới|mau moi|CHỈ|DEAL|GIÁ TỐT|MUA NGAY|SLCH)[^)]*\)/gi, '')
  // ── FIX: Xóa keyword promo đầu chuỗi (chỉ xóa keyword, giữ lại tên SP) ──
  t = t.replace(/^(?:KM|Khuyen mai|Khuyến mãi|Tang kem|Tặng kèm|Quà tặng|Free|Miễn phí|Giảm giá|Sale|Combo|mẫu mới|mau moi|CHỈ|DEAL|GIÁ TỐT|MUA NGAY|SLCH)\s*[:：\-–—]?\s*/gi, '')
  t = t.replace(/\(\s*\)/g, '').replace(/\[\s*\]/g, '')
  t = t.replace(/\s{2,}/g, ' ').trim()
  t = t.replace(/^[,;|/\s]+|[,;|/\s]+$/g, '')
  return t
}

// ── Inline [Tặng ...] extraction ──────────────────────────────────────────
// Đọc tất cả [Tặng X gói dùng thử] nằm trong cùng một cell sản phẩm
// Ví dụ: "[Tặng 02 gói dùng thử] 1 lon Pediasure 800g"
//   → main = "1 lon Pediasure 800g"
//   → bonuses = [{ qty: 2, description: "gói dùng thử" }]

function extractInlineTang(rawName) {
  const bonuses = []
  // Match [Tặng 02 gói dùng thử] hoặc [Tặng gói dùng thử]
  const re = /\[Tặng\s+(?:(\d+)\s+)?([^\]]+)\]/gi
  let m
  while ((m = re.exec(rawName)) !== null) {
    bonuses.push({
      qty:         parseInt(m[1]) || 1,
      description: m[2].trim(),
    })
  }
  return bonuses
}

function extractBrands(normalized) {
  const words = normalized.split(/\s+/)
  return BRAND_KEYWORDS.filter(brand =>
    // Exact include: "similac" trong text
    normalized.includes(brand) ||
    // Prefix match 2 chiều:
    //   "simila" (text) → match "similac" (keyword): brand.startsWith(word)
    //   "similac" (text) → match "simila" (keyword): word.startsWith(brand)
    words.some(word => word.length >= 5 && (
      brand.startsWith(word) || word.startsWith(brand)
    ))
  )
}

function extractSubBrands(normalized) {
  const found = []
  const sorted = [...SUB_BRAND_KEYWORDS].sort((a, b) => b.length - a.length)
  for (const sb of sorted) {
    const re = new RegExp('(?:^|\\s)' + sb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)')
    if (re.test(normalized)) found.push(sb)
  }
  if (/(?:^|\s)nuoc(?:\s|$)/.test(normalized) || normalized.includes('sua nuoc')) {
    if (!found.includes('sua nuoc')) found.push('sua nuoc')
  }
  if (/(?:^|\s)bot(?:\s|$)/.test(normalized) || normalized.includes('sua bot')) {
    if (!found.includes('sua bot')) found.push('sua bot')
  }
  return found
}

function extractSpecs(text) {
  if (!text) return []
  const cleanText = String(text).toLowerCase()
  const specs = []
  let m
  // FIX: thêm \b (word boundary) sau unit để tránh "1 lon" → "1 l"
  const re = /(\d+(?:[.,]\d+)?)\s*(ml|kg|g|l)\b/gi
  while ((m = re.exec(cleanText)) !== null) {
    const num = parseFloat(m[1].replace(',', '.'))
    const unit = m[2].toLowerCase()
    // Bỏ qua spec quá nhỏ (< 10) nếu unit = g/ml — tránh false match "1g", "2g"
    if ((unit === 'g' || unit === 'ml') && num < 10) continue
    specs.push({ num, unit, grams: unit === 'kg' ? num * 1000 : unit === 'l' ? num * 1000 : num })
  }
  return specs
}

function extractStages(text) {
  const normalized = normalizeForMatch(text)
  const stages = new Set()
  
  // Match "1+", "2+", "3+", "0+" first
  const plusRe = /\b(\d)\+/gi
  let m
  while ((m = plusRe.exec(normalized)) !== null) {
    stages.add(m[1] + '+')
  }
  
  // Match "so 1", "so 2", etc. but ONLY if not followed by "+"
  const soRe = /\b(?:so|stage)\s*(\d)(?!\+)\b/gi
  while ((m = soRe.exec(normalized)) !== null) {
    stages.add(m[1])
  }
  
  // Match stand-alone numbers 1, 2, 3, 4 that represent stages (not followed by "+", and not quantities or unit weights)
  const numRe = /\b([1234])(?!\+)\b/g
  while ((m = numRe.exec(normalized)) !== null) {
    const num = m[1]
    const index = m.index
    const rest = normalized.substring(index + num.length).trim()
    const firstWord = rest.split(/\s+/)[0]
    const cleanWord = firstWord.replace(/^\d+/, '')
    if (!['g', 'ml', 'kg', 'l', 'chai', 'lon', 'hop', 'goi', 'thung', 'k', 'vnd', 'd', 'dong', 'usd', 'h', 'ngay', 'thang', 'nam'].includes(cleanWord)) {
      stages.add(num)
    }
  }
  
  return Array.from(stages)
}

function extractPackaging(text) {
  const normalized = normalizeForMatch(text)
  if (normalized.includes('thung') || normalized.includes('combo') || normalized.includes('box') || normalized.includes('carton') || /\b(x24|x48|24\s*chai|48\s*hop|24\s*hop|12\s*hop|12\s*chai|x12|x36)\b/.test(normalized)) {
    return 'bulk'
  }
  if (normalized.includes('loc') || /\b(x4|x6|4\s*hop|6\s*hop|4\s*chai|6\s*chai)\b/.test(normalized)) {
    return 'pack'
  }
  return 'single'
}

function fuzzyScore(supplierText, productName) {
  if (!supplierText || !productName) return 0
  const na = normalizeForMatch(supplierText)
  const nb = normalizeForMatch(productName)
  if (na === nb) return 100

  // 1. Chặn đứng lệch Stage (Độ tuổi)
  const stagesA = extractStages(supplierText)
  const stagesB = extractStages(productName)
  if (stagesA.length > 0 && stagesB.length > 0) {
    const hasOverlap = stagesA.some(sa => {
      // Coi các ký hiệu sữa sơ sinh (0, 0+, 1) là tương thích với nhau
      const newbornA = sa === '0' || sa === '0+' || sa === '1'
      if (newbornA) {
        return stagesB.some(sb => sb === '0' || sb === '0+' || sb === '1')
      }
      return stagesB.includes(sa)
    })
    if (!hasOverlap) return 0 // Hard block lệch stage
  }

  // 1.5 Chặn đứng lệch sữa bầu (mom/mama/mum/bầu) và sữa em bé
  const maternalKeywords = ['mom', 'mama', 'mum', 'bau', 'me', 'mẹ', 'mang thai', 'anmum', 'frisomum']
  const isMaternalA = maternalKeywords.some(kw => na.includes(kw))
  const isMaternalB = maternalKeywords.some(kw => nb.includes(kw))
  if (isMaternalA !== isMaternalB) return 0 // Hard block lệch nhóm sữa bầu

  // 2. Chặn đứng lệch Quy cách đóng gói (Thùng vs Lốc vs Chai lẻ)
  const packA = extractPackaging(supplierText)
  const packB = extractPackaging(productName)
  if (packA !== packB) return 0 // Hard block lệch packaging

  // 3. Khớp brand
  const brandsA = extractBrands(na), brandsB = extractBrands(nb)
  let brandMatch = false, brandMismatch = false
  if (brandsA.length > 0 && brandsB.length > 0) {
    brandMatch = brandsA.some(b => brandsB.includes(b))
    if (!brandMatch) brandMismatch = true
  }
  if (brandMismatch) return 0

  // 4. Khớp spec (trọng lượng/thể tích)
  const specsA = extractSpecs(supplierText), specsB = extractSpecs(productName)
  let specMatch = false, specMismatch = false
  const gramsA = specsA.filter(s => s.grams).map(s => s.grams)
  const gramsB = specsB.filter(s => s.grams).map(s => s.grams)
  if (gramsA.length > 0 && gramsB.length > 0) {
    // Tolerance 15% để khớp 800g với 850g/900g trong logs Best Express
    specMatch = gramsA.some(ga => gramsB.some(gb => Math.abs(ga - gb) / Math.max(ga, gb) < 0.15))
    if (!specMatch) return 0 // Hard block lệch spec
  }

  const subA = extractSubBrands(na), subB = extractSubBrands(nb)
  let subBrandMatch = false, subBrandMismatch = false
  if (subA.length > 0 || subB.length > 0) {
    const formA = subA.includes('sua nuoc') ? 'nuoc' : subA.includes('sua bot') ? 'bot' : null
    const formB = subB.includes('sua nuoc') ? 'nuoc' : subB.includes('sua bot') ? 'bot' : null
    if (formA && formB && formA !== formB) return 0

    const specSubA = subA.filter(s => !['sua nuoc', 'sua bot'].includes(s))
    const specSubB = subB.filter(s => !['sua nuoc', 'sua bot'].includes(s))
    if (specSubA.length > 0 && specSubB.length > 0) {
      subBrandMatch = specSubA.some(s => specSubB.includes(s))
      if (!subBrandMatch) {
        const hvA = specSubA.includes('gold vigor'), hvB = specSubB.includes('gold vigor')
        if (hvA !== hvB) subBrandMismatch = true
      }
    } else if (specSubA.length > 0 || specSubB.length > 0) {
      // Một bên có sub-brand cụ thể, một bên không -> lệch nhẹ (tránh nhận nhầm dòng đặc chủng khi Excel là dòng thường)
      subBrandMismatch = true
    }
  }

  const tokA = na.split(/\s+/).filter(t => t.length > 1)
  const tokB = nb.split(/\s+/).filter(t => t.length > 1)
  const setA = new Set(tokA), setB = new Set(tokB)
  const intersection = [...setA].filter(x => setB.has(x))
  const union = new Set([...setA, ...setB])
  const tokenOverlap = union.size > 0 ? intersection.length / union.size : 0

  let score = 0
  if (brandMatch)        score += 35
  if (specMatch)         score += 25
  else if (specMismatch) score -= 15
  if (subBrandMismatch)     score -= 15
  else if (subBrandMatch)   score += 10
  score += Math.round(tokenOverlap * 40)

  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length)
    const longer  = Math.max(na.length, nb.length)
    score = Math.max(score, Math.round(shorter / longer * 100))
  }

  return Math.max(0, Math.min(100, score))
}

// Hàm hỗ trợ khôi phục các segment thô bị cắt cụt (truncation) do giới hạn độ dài của đơn vị vận chuyển
function reconstructSegment(seg, rowSegments = [], allSegments = []) {
  if (!seg) return ''
  const cleanSeg = normalizeForMatch(cleanSupplierName(seg))
  if (cleanSeg.length < 15) return seg

  // Nếu đã có spec (trọng lượng/dung tích), không cần dựng lại
  const specs = extractSpecs(cleanSupplierName(seg))
  if (specs.length > 0) return seg

  const words = cleanSeg.split(/\s+/)
  if (words.length <= 3) return seg
  
  // Khớp tiền tố không tính từ cuối cùng bị cắt (ví dụ "dạ" thay vì "dạng")
  const prefixWords = words.slice(0, -1).join(' ')
  
  function getPromoPart(s) {
    if (!s) return ''
    const matches = s.match(/\[[^\]]+\]/g)
    if (!matches) return ''
    const promos = matches.filter(m => !/^\[\d+\]$/.test(m))
    return promos.map(p => normalizeForMatch(p)).join('|')
  }

  function findMatchInList(candidates) {
    let bestMatch = null
    let bestHasSamePromo = false
    const originalPromo = getPromoPart(seg)

    for (const candidate of candidates) {
      if (candidate === seg) continue
      const cleanCand = normalizeForMatch(cleanSupplierName(candidate))
      
      // Candidate sạch phải dài hơn segment sạch, và bắt đầu bằng tiền tố sạch của segment
      if (cleanCand.length > cleanSeg.length && cleanCand.startsWith(prefixWords)) {
        const candidatePromo = getPromoPart(candidate)
        const hasSamePromo = (originalPromo && candidatePromo && originalPromo === candidatePromo)

        if (!bestMatch) {
          bestMatch = candidate
          bestHasSamePromo = hasSamePromo
        } else {
          // Tiêu chí lựa chọn:
          // 1. Ưu tiên trùng khớp Promo tag (cùng số lượng quà tặng, vd [Tặng 02 gói...])
          // 2. Nếu trạng thái trùng promo giống nhau, chọn chuỗi dài nhất
          if (hasSamePromo && !bestHasSamePromo) {
            bestMatch = candidate
            bestHasSamePromo = true
          } else if (hasSamePromo === bestHasSamePromo) {
            if (cleanCand.length > normalizeForMatch(cleanSupplierName(bestMatch)).length) {
              bestMatch = candidate
            }
          }
        }
      }
    }
    return bestMatch
  }

  // 1. Tìm kiếm trong các segment cùng dòng trước
  const sameRowMatch = findMatchInList(rowSegments)
  if (sameRowMatch) {
    return sameRowMatch
  }

  // 2. Tìm kiếm trong các segment của toàn bộ file
  const fileMatch = findMatchInList(allSegments)
  if (fileMatch) {
    const cleanFileMatch = cleanSupplierName(fileMatch)
    const cleanOriginal = cleanSupplierName(seg)
    if (cleanOriginal && cleanFileMatch) {
      return seg.replace(cleanOriginal, cleanFileMatch)
    }
  }

  return seg
}

function findBestMatch(supplierName, products) {
  const cleaned = cleanSupplierName(supplierName)
  
  // 1. Khớp chính xác mã SKU (nếu supplierName trùng khớp hoàn toàn SKU của sản phẩm)
  const cleanedUpper = String(supplierName).trim().toUpperCase()
  const skuMatch = products.find(p => p.sku && p.sku.trim().toUpperCase() === cleanedUpper)
  if (skuMatch) return { product: skuMatch, score: 100 }

  // 2. Khớp chính xác tên sản phẩm (đã chuẩn hóa)
  const normalizedSupplierName = normalizeForMatch(cleaned || supplierName)
  const exactMatch = products.find(p => normalizeForMatch(p.name) === normalizedSupplierName)
  if (exactMatch) return { product: exactMatch, score: 100 }

  // 3. Khớp fuzzy (độ tương đồng)
  let bestProduct = null, bestScore = 0
  for (const p of products) {
    const score = Math.max(fuzzyScore(cleaned, p.name), fuzzyScore(supplierName, p.name))
    if (score > bestScore) { bestScore = score; bestProduct = p }
  }
  return bestScore >= FUZZY_THRESHOLD && bestProduct ? { product: bestProduct, score: bestScore } : null
}

function findBonusProduct(description, brand, products) {
  const attempts = []
  if (brand) {
    attempts.push(`${description} ${brand}`)  // "gói dùng thử pediasure"
    attempts.push(`${brand} ${description}`)  // "pediasure gói dùng thử"
    attempts.push(`goi ${brand}`)             // "goi pediasure" — fallback
  }
  attempts.push(description)
  for (const q of attempts) {
    const m = findBestMatch(q, products)
    if (m) {
      // Bảo vệ: KHÔNG khớp các lon/thùng sữa lớn (>150g) cho mô tả dạng "gói"
      if (normalizeForMatch(description).includes('goi') && extractSpecs(m.product.name)[0]?.grams > 150) {
        continue
      }
      return m
    }
  }
  return null
}

function parseSupplierMoney(raw) {
  if (raw == null) return 0
  if (typeof raw === 'number') return raw
  let t = String(raw).replace(/[^\d.,\-]/g, '')
  if (!t) return 0
  if (t.includes('.') && t.includes(',')) {
    t = t.lastIndexOf('.') > t.lastIndexOf(',') ? t.replace(/,/g, '') : t.replace(/\./g, '').replace(',', '.')
  } else if (t.includes(',')) {
    const parts = t.split(',')
    t = (parts.length > 2 || parts[parts.length - 1]?.length === 3) ? t.replace(/,/g, '') : t.replace(',', '.')
  } else if (t.includes('.')) {
    const parts = t.split('.')
    if (parts.length > 2 || parts[parts.length - 1]?.length === 3) t = t.replace(/\./g, '')
  }
  return parseFloat(t) || 0
}


// ══════════════════════════════════════════════════════════════════════════
// ImportMethodModal
// ══════════════════════════════════════════════════════════════════════════

export function ImportMethodModal({ onManual, onExcel, onBest, onClose }) {
  const options = [
    {
      key: 'manual', icon: PenLine, bg: 'bg-cgreen/10 border-cgreen/30',
      title: 'Nhập kho thủ công',
      desc: 'Tìm kiếm sản phẩm, nhập số lượng và giá nhập cho từng mặt hàng. Phù hợp khi nhập ít sản phẩm.',
      onClick: onManual,
    },
    {
      key: 'excel', icon: FileSpreadsheet, bg: 'bg-cblue/10 border-cblue/30',
      title: 'Nhập kho bằng file Excel',
      desc: 'Tải lên file Excel chứa danh sách sản phẩm cần nhập kho. Phù hợp khi nhập số lượng lớn cùng lúc.',
      tags: ['Mã hàng (SKU)', 'Số lượng', 'Giá nhập'],
      onClick: onExcel,
    },
    {
      key: 'best', icon: Truck, bg: 'bg-orange-50 border-orange-200',
      title: 'Nhập từ file NCC / Đơn Vị Vận Chuyển',
      desc: 'Đọc file CSV/Excel từ nhà cung cấp hoặc đơn vị vận chuyển. Tự động nhận diện sản phẩm, tách [Tặng X gói...] thành dòng hàng tặng kèm riêng.',
      tags: ['Fuzzy Match', 'Tách [Tặng ...]', 'Cảnh báo chênh lệch'],
      tagColor: 'bg-orange-100 text-orange-600 border-orange-200',
      onClick: onBest,
    },
  ]

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus size={18} strokeWidth={2} className="text-cblue" />
            <div>
              <div className="text-lg font-bold text-text">Nhập Kho</div>
              <div className="text-xs text-muted mt-0.5">Chọn phương thức nhập kho bạn muốn sử dụng</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center shrink-0"><X size={15} strokeWidth={2.2} /></button>
        </div>

        <div className="p-4 flex flex-col gap-3">
          {options.map(opt => (
            <button key={opt.key} onClick={opt.onClick}
              className={`flex items-start gap-4 p-4 rounded-xl border ${opt.bg} hover:shadow-cardHover text-left transition-all group`}>
              <opt.icon size={22} strokeWidth={2} className="text-text mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-text text-sm">{opt.title}</div>
                <div className="text-xs text-muted mt-1 leading-relaxed">{opt.desc}</div>
                {opt.tags && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {opt.tags.map(tag => (
                      <span key={tag} className={`text-[12px] px-2 py-0.5 rounded-full border ${opt.tagColor || 'bg-surface2 text-muted border-border'}`}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <ChevronRight size={16} strokeWidth={2} className="text-muted group-hover:text-text mt-2 shrink-0" />
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-border text-muted text-sm hover:text-text hover:border-subtle transition-all">Huỷ</button>
        </div>
      </div>
    </ModalOverlay>
  )
}


// ══════════════════════════════════════════════════════════════════════════
// ImportBestExpressModal
// ══════════════════════════════════════════════════════════════════════════

export function ImportBestExpressModal({ products = [], onImported, onClose }) {
  const [dbProducts,       setDbProducts]       = useState(products)
  const [cart,             setCart]             = useState([])
  const [warnings,         setWarnings]         = useState([])
  const [unmatchedRows,    setUnmatchedRows]    = useState([])
  const [fileName,         setFileName]         = useState('')
  const [step,             setStep]             = useState('upload')
  const [suppliersList,    setSuppliersList]    = useState([])
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [notes,            setNotes]            = useState('')
  const [saving,           setSaving]           = useState(false)
  const [paidInput,        setPaidInput]        = useState('')
  const [showConfirm,      setShowConfirm]      = useState(false)
  const [showWarnings,     setShowWarnings]     = useState(false)
  const [dragOver,         setDragOver]         = useState(false)
  const fileInputRef = useRef(null)

  const iCls = 'input-base min-h-[52px]'

  useEffect(() => {
    loadSuppliers().then(s => setSuppliersList(s || [])).catch(() => {})
    loadProducts('').then(p => setDbProducts(p || [])).catch(() => {})
  }, [])

  // ── Universal Ahamove/NCC parser ─────────────────────────────────────────
  //
  // Hỗ trợ 2 kiểu file Ahamove đã phân tích:
  //
  // [Kiểu A] ahavamove.xlsx — KHÔNG có header row, data bắt đầu từ row 1
  //   Col0: mã AHMRT...   Col1: địa chỉ   Col2: tên KH   Col3: SĐT
  //   Col4: chuỗi SP      Col5: tổng COD
  //   Chuỗi SP: "(tag) Tên SP - 489000.00, (tag) Tên SP - 489000.00, ..."
  //
  // [Kiểu B] testtt....xlsx — Header ở ROW 2 (row 1 = formula tổng), data từ row 3
  //   Col0: SĐT   Col1: AHMRT...   Col2: chuỗi SP   Col3: COD   Col4: địa chỉ
  //   Chuỗi SP: "[CHỈ 20H...] Tên SP - 950000.00, [CHỈ 20H...] Tên SP - 950000.00"
  //
  // Logic parse sản phẩm:
  //   Chuỗi "A - giá, A - giá, B - giá" → đếm số lần lặp mỗi (tên+giá) = qty
  //   "A" xuất hiện 5 lần → qty=5, unitPrice=giá, productName=A (đã clean tag)

  // Đọc raw sheet dưới dạng mảng 2D để tránh mất dữ liệu khi không có header
  function parseSheetRaw(sheet) {
    // Trả về [{rowIdx, cells: [val, val, ...]}]
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
    return raw.map((cells, idx) => ({ rowIdx: idx, cells }))
  }

  // Tìm row header — chỉ nhận diện là header khi row đó thực sự là label:
  //   ✅ Header: tất cả cell ngắn (<50 ký tự), không có AHMRT, không có product string
  //   ❌ Data:  có AHMRT code, có địa chỉ dài, có product string "Tên - giá, ..."
  // Nếu không tìm thấy → return -1 → toàn bộ rows đều là data (file không có header)
  function findHeaderRow(rows) {
    for (const row of rows.slice(0, 5)) {
      const textCells = row.cells.filter(c => c && typeof c === 'string' && c.trim().length > 0)
      if (textCells.length < 2) continue  // Row rỗng hoặc chỉ số → bỏ qua

      // ❌ Nếu có AHMRT code → đây là data row chứ không phải header
      if (textCells.some(c => /^AHMRT/i.test(c.trim()))) continue

      // ❌ Nếu có product string "Tên - giá" lặp ≥ 2 lần → data row
      if (textCells.some(c => (c.match(/ - [\d.]+/g) || []).length >= 2)) continue

      // ❌ Nếu có cell dài hơn 50 ký tự (địa chỉ, mô tả sản phẩm) → data row
      if (textCells.some(c => c.trim().length > 50)) continue

      // ✅ Tất cả cell ngắn, không phải data đặc biệt → đây là header row
      return row.rowIdx
    }
    return -1  // Không có header → TẤT CẢ rows đều là data
  }

  // Tìm index cột chứa chuỗi sản phẩm "Tên - giá, Tên - giá"
  function findProductCol(dataRows) {
    const SCORE_MIN = 3
    const colScores = {}
    for (const row of dataRows.slice(0, 10)) {
      row.cells.forEach((cell, ci) => {
        const s = String(cell || '')
        const count = (s.match(/ - [\d.]+/g) || []).length
        colScores[ci] = (colScores[ci] || 0) + count
      })
    }
    const best = Object.entries(colScores).sort((a, b) => b[1] - a[1])[0]
    return (best && best[1] >= SCORE_MIN) ? parseInt(best[0]) : -1
  }

  // Tìm index cột mã vận đơn (AHMRT.../alphanumeric dài 8-25 ký tự, không phải số thuần)
  function findOrderCodeColIdx(dataRows, colCount) {
    const RE = /^AHMRT[0-9A-Z]+$/i
    for (let ci = 0; ci < colCount; ci++) {
      const vals = dataRows.slice(0, 8).map(r => String(r.cells[ci] || '').trim())
      if (vals.filter(v => RE.test(v)).length >= 2) return ci
      // Fallback: alphanumeric 8-25 chars
      if (vals.filter(v => /^[A-Z0-9]{8,25}$/i.test(v) && !/^\d+$/.test(v)).length >= 3) return ci
    }
    return -1
  }

  // Tìm cột tổng tiền COD
  // Priority 1: cột mà raw cell là NUMBER thực sự (Excel lưu số) — tránh nhầm text
  // Priority 2: cột string thuần số (không có chữ cái) — loại AHMRT code, tên SP, địa chỉ
  function findTotalColIdx(dataRows, colCount, excludeColIdx = -1) {
    // Pass 1: native number cells (typeof === 'number') — very reliable
    for (let ci = 0; ci < colCount; ci++) {
      if (ci === excludeColIdx) continue
      const isSdt = dataRows.slice(0, 3).some(r => /^0\d{9,10}$/.test(String(r.cells[ci] || '')))
      if (isSdt) continue
      const nativeNums = dataRows.slice(0, 8)
        .map(r => r.cells[ci])
        .filter(v => typeof v === 'number' && v >= 50000 && v < 100000000)
      if (nativeNums.length >= 3) return ci
    }
    // Pass 2: string cells that look purely numeric (no letters → not AHMRT, not product names)
    for (let ci = 0; ci < colCount; ci++) {
      if (ci === excludeColIdx) continue
      const isSdt = dataRows.slice(0, 3).some(r => /^0\d{9,10}$/.test(String(r.cells[ci] || '')))
      if (isSdt) continue
      const vals = dataRows.slice(0, 8).map(r => {
        const v = r.cells[ci]
        if (typeof v === 'number') return v
        const s = String(v || '').trim()
        if (/[a-zA-Z]/i.test(s)) return 0  // Bỏ qua ô có chữ cái (AHMRT, tên SP, địa chỉ)
        const n = parseFloat(s.replace(/[^0-9.]/g, ''))
        return isNaN(n) ? 0 : n
      })
      if (vals.filter(v => v >= 50000 && v < 100000000).length >= 3) return ci
    }
    return -1
  }

  // Parse chuỗi SP Ahamove: "Tên - giá, Tên - giá" → [{name, price, qty}]
  // Bỏ qua tag quảng cáo [CHỈ 20H...], (Phù hợp...) ở đầu
  function parseAhamoveProductString(raw) {
    if (!raw || typeof raw !== 'string') return []

    // Tách từng entry theo pattern: phần sau dấu phẩy mà bắt đầu bằng text (không phải số)
    // Dùng negative lookbehind: tách ở ", " chỉ khi đứng trước nó không phải số
    // Pattern thực tế: "Tên rất dài - 489000.00, Tên rất dài - 489000.00"
    // → split tại mọi ", " mà đứng TRƯỚC là ký tự không phải chữ số
    const parts = raw.split(/,\s*(?=[^\d])/)

    const acc = {}
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue

      // Match "(...bất cứ thứ gì...) - <số>" hoặc "[...] ... - <số>"
      // Lấy phần CUỐi: " - <số>" là giá, phần trước là tên (có thể có tags)
      const priceMatch = trimmed.match(/^([\s\S]+?)\s*-\s*([\d.,]+)\s*$/)
      if (!priceMatch) continue

      const rawName = priceMatch[1].trim()
      const price   = parseFloat(priceMatch[2].replace(/,/g, '')) || 0

      // Clean tên: bỏ tags [CHỈ 20H...], (Phù hợp...) ở đầu
      const cleanedName = cleanSupplierName(rawName)
      if (!cleanedName) continue

      // Key để gom: normalize tên + giá
      const key = `${normalizeForMatch(cleanedName)}|${price}`
      if (acc[key]) {
        acc[key].qty++
      } else {
        acc[key] = { name: cleanedName, rawName, price, qty: 1 }
      }
    }
    return Object.values(acc)
  }

  // Detect xem file có phải Ahamove không (có cột SP gộp " - giá, ...")
  function isAhamoveFormat(rows) {
    const allCells = rows.slice(0, 10).flatMap(r => r.cells)
    return allCells.some(c => {
      const s = String(c || '')
      return (s.match(/ - [\d.]+/g) || []).length >= 2
    })
  }

  function handleFile(file) {
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onerror = () => toast.error('Lỗi đọc file!')
    reader.onload = (event) => {
      try {
        const data     = new Uint8Array(event.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet    = workbook.Sheets[workbook.SheetNames[0]]

        // ── Đọc raw để phân tích cấu trúc ───────────────────────────────
        const allRows = parseSheetRaw(sheet)
        const nonEmptyRows = allRows.filter(r => r.cells.some(c => c !== null && c !== ''))
        if (!nonEmptyRows.length) { toast.error('File không có dữ liệu!'); return }

        const colCount = Math.max(...nonEmptyRows.map(r => r.cells.length))

        // ── Phát hiện Ahamove format ─────────────────────────────────────
        if (isAhamoveFormat(nonEmptyRows)) {
          console.log('[ImportNCC] Detected: Ahamove format 🛵')
          return handleAhamoveFile(nonEmptyRows, colCount)
        }

        // ── Fallback: Best Express / Generic ────────────────────────────
        console.log('[ImportNCC] Detected: Best/Generic format 🚚')
        return handleBestFile(sheet)

      } catch (err) {
        console.error('[ImportNCC] Parse error:', err)
        toast.error('Không đọc được file: ' + (err.message || ''))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // ── Xử lý file Ahamove (cả 2 kiểu A và B) ──────────────────────────────
  function handleAhamoveFile(nonEmptyRows, colCount) {
    const headerRowIdx = findHeaderRow(nonEmptyRows)
    const dataRows = headerRowIdx >= 0
      ? nonEmptyRows.filter(r => r.rowIdx > headerRowIdx)
      : nonEmptyRows

    if (!dataRows.length) { toast.error('File không có dữ liệu sau header!'); return }

    const productColIdx   = findProductCol(dataRows)
    const orderCodeColIdx = findOrderCodeColIdx(dataRows, colCount)
    const totalColIdx     = findTotalColIdx(dataRows, colCount, orderCodeColIdx)

    console.log(`[Ahamove] headerRow=${headerRowIdx} | productCol=${productColIdx} | orderCodeCol=${orderCodeColIdx} | totalCol=${totalColIdx}`)

    if (productColIdx < 0) {
      toast.error('Không tìm thấy cột sản phẩm trong file! Hãy kiểm tra định dạng file Ahamove.')
      return
    }

    // Tách COD theo tỷ lệ giá trị các sản phẩm từ chuỗi sản phẩm để có giá thực tế
    const flatRows = []
    for (const row of dataRows) {
      const productStr = String(row.cells[productColIdx] || '').trim()
      if (!productStr || productStr.length < 5) continue

      const orderCode = orderCodeColIdx >= 0 ? String(row.cells[orderCodeColIdx] || '').trim() : ''
      const totalCOD  = totalColIdx >= 0
        ? (typeof row.cells[totalColIdx] === 'number'
            ? row.cells[totalColIdx]
            : parseSupplierMoney(row.cells[totalColIdx]))
        : 0

      const items = parseAhamoveProductString(productStr)
      if (items.length === 0) continue

      const totalTextValue = items.reduce((s, it) => s + it.price * it.qty, 0)
      for (const item of items) {
        let unitPrice = item.price
        if (totalCOD > 0) {
          if (totalTextValue > 0) {
            const proportion = (item.price * item.qty) / totalTextValue
            unitPrice = item.qty > 0 ? Math.round((totalCOD * proportion) / item.qty) : item.price
          } else {
            const totalQty = items.reduce((s, it) => s + it.qty, 0)
            unitPrice = totalQty > 0 ? Math.round(totalCOD / totalQty) : totalCOD
          }
        }
        flatRows.push({
          orderCode,
          productName: item.name,
          qty:         item.qty,
          unitPrice,
          totalCOD,
          rawName:     item.rawName,
        })
      }
    }

    console.log(`[Ahamove] Parsed ${flatRows.length} product rows from ${dataRows.length} data rows`)
    processFlatRows(flatRows, '🛵 Ahamove')
  }

  // ── Xử lý file Best Express / Generic ──────────────────────────────────
  // Hỗ trợ song song:
  // 1. File hóa đơn NCC (mỗi dòng 1 sản phẩm, có cột Số lượng & Đơn giá riêng biệt)
  // 2. File vận đơn Best Express (chuỗi SP "TênSP[1]|TênSP[2]|", COD là tổng tiền đơn hàng)
  function handleBestFile(sheet) {
    let jsonData = XLSX.utils.sheet_to_json(sheet)
    if (!jsonData?.length) { toast.error('File không có dữ liệu!'); return }

    const rawHeaders = Object.keys(jsonData[0] || {})
    if (rawHeaders.some(h => h.startsWith('__EMPTY')) && jsonData.length > 1) {
      const realHeaderRow = jsonData[0]
      const remap = {}
      for (const [fakeKey, realHeader] of Object.entries(realHeaderRow)) {
        if (typeof realHeader === 'string' && realHeader.trim()) remap[fakeKey] = realHeader.trim()
      }
      jsonData = jsonData.slice(1).map(row => {
        const newRow = {}
        for (const [fakeKey, val] of Object.entries(row)) newRow[remap[fakeKey] || fakeKey] = val
        return newRow
      })
    }

    if (!jsonData?.length) { toast.error('File không có dữ liệu sau khi xử lý!'); return }

    const headers = Object.keys(jsonData[0] || {})
    const headerMap = {}
    headers.forEach(k => { headerMap[normalizeForMatch(k)] = k })

    function pick(row, keys) {
      for (const k of keys) {
        const v = row[k]
        if (v !== undefined && v !== null && v !== '') return v
        const origKey = headerMap[normalizeForMatch(k)]
        if (origKey) {
          const v2 = row[origKey]
          if (v2 !== undefined && v2 !== null && v2 !== '') return v2
        }
      }
      return null
    }

    let effectiveProdCol = null
    for (const k of PROD_COLS) {
      if (pick(jsonData[0], [k]) != null) { effectiveProdCol = k; break }
    }
    if (!effectiveProdCol) {
      const textCols = headers.filter(h =>
        jsonData.slice(0, 5).some(row => {
          const v = row[h]
          return typeof v === 'string' && v.trim().length > 5 && !/^\d+$/.test(v.trim())
        })
      )
      let bestCol = null, bestCount = 0
      for (const col of textCols) {
        let matchCount = 0
        for (const row of jsonData.slice(0, 10)) {
          if (findBestMatch(String(row[col] ?? '').trim(), dbProducts)) matchCount++
        }
        if (matchCount > bestCount) { bestCount = matchCount; bestCol = col }
      }
      if (bestCol && bestCount > 0) effectiveProdCol = bestCol
    }
    if (!effectiveProdCol) {
      toast.error('Không tìm thấy cột sản phẩm! Cột hiện có: ' + headers.join(', '))
      return
    }

    // Thu thập tất cả các segment thô từ toàn bộ các dòng trong file để tìm mẫu đầy đủ không bị cắt cụt
    const allSegments = []
    for (const row of jsonData) {
      const rawName = String(row[effectiveProdCol] ?? pick(row, PROD_COLS) ?? '').trim()
      if (!rawName) continue
      const segments = rawName.split('|').map(s => s.trim()).filter(s => s.length > 3)
      allSegments.push(...segments)
    }

    // Parse "TênSP (tag)[1]|TênSP[2]|TênKhác[1]|" → [{name, qty}]
    function parseBestProductString(raw) {
      if (!raw || typeof raw !== 'string') return []
      const segments = raw.split('|').map(s => s.trim()).filter(s => s.length > 3)
      if (segments.length === 0) return []

      const cleaned = segments.map(seg => {
        let s = seg
        // Xóa promo tags nhưng GIỮ [Tặng...] cho extractInlineTang xử lý sau
        s = s.replace(/\[(?:CH[IỈ]|DEAL|SALE|FLASH|GI[AÁ]|SLCH|MUA)[^\]]*\]/gi, '')
        s = s.replace(/\[\d+\]/g, '')  // Xóa [1] [2] [3]
        s = s.replace(/^\s*\d+\s+(?:lon|hộp|hop|gói|goi|thùng|thung)\s+/i, '')
        return s.trim()
      }).filter(s => s.length > 3)

      if (cleaned.length === 0) return []

      const groups = {}
      for (const name of cleaned) {
        const key = normalizeForMatch(name).substring(0, 40)
        if (!groups[key]) groups[key] = { name, qty: 0 }
        groups[key].qty++
      }
      return Object.values(groups)
    }

    const flatRows = []
    for (const [i, row] of jsonData.entries()) {
      const rawName   = String(row[effectiveProdCol] ?? pick(row, PROD_COLS) ?? '').trim()
      if (!rawName) continue

      const orderCode = String(pick(row, ['Mã vận đơn', 'Ma van don', 'Order Code', 'Mã đơn', 'Ma don', 'Số đặt hàng']) || i).trim()
      
      const rowQtyVal   = pick(row, QTY_COLS)
      const rowQty      = rowQtyVal != null ? parseFloat(String(rowQtyVal).replace(/,/g, '.')) : null
      
      const rowPriceVal = pick(row, PRICE_COLS)
      const rowPrice    = rowPriceVal != null ? parseSupplierMoney(rowPriceVal) : null

      const isStandardSupplierRow = rowQty !== null && !isNaN(rowQty) && rowQty > 0 && !rawName.includes('|')

      if (isStandardSupplierRow) {
        let unitPrice = rowPrice
        const unitPriceVal = pick(row, ['Đơn giá', 'Don gia', 'Giá nhập', 'Gia nhap', 'Price', 'Unit Price', 'Giá', 'Gia'])
        if (unitPriceVal != null) {
          unitPrice = parseSupplierMoney(unitPriceVal)
        } else if (rowPrice != null && rowQty > 0) {
          unitPrice = Math.round(rowPrice / rowQty)
        }

        flatRows.push({
          orderCode,
          productName: rawName,
          qty:         rowQty,
          unitPrice:   unitPrice ?? 0,
          totalCOD:    rowPrice ?? 0,
          rawName
        })
      } else {
        const rowCOD = rowPrice || 0
        
        // Dựng lại các segment bị cắt cụt do giới hạn ký tự của DVVC
        const rawSegments = rawName.split('|').map(s => s.trim()).filter(s => s.length > 3)
        const reconstructedSegments = rawSegments.map(s => reconstructSegment(s, rawSegments, allSegments))
        const joinedReconstructed = reconstructedSegments.join('|')
        
        const items = parseBestProductString(joinedReconstructed)

        if (items.length === 0) {
          flatRows.push({ orderCode, productName: rawName, qty: 1, unitPrice: rowCOD, totalCOD: rowCOD, rawName })
          continue
        }

        if (items.length === 1) {
          const qty       = items[0].qty
          const unitPrice = qty > 0 && rowCOD > 0 ? Math.round(rowCOD / qty) : rowCOD
          flatRows.push({ orderCode, productName: items[0].name, qty, unitPrice, totalCOD: rowCOD, rawName: items[0].name })
        } else {
          const matchedItems = items.map(item => {
            const clean = cleanSupplierName(item.name)
            const m = findBestMatch(clean, dbProducts) || findBestMatch(item.name, dbProducts)
            return { ...item, dbPrice: m?.product?.importPrice || 0 }
          })
          const totalDbValue = matchedItems.reduce((s, it) => s + it.dbPrice * it.qty, 0)

          for (const item of matchedItems) {
            let unitPrice = item.dbPrice  // fallback
            if (rowCOD > 0) {
              if (totalDbValue > 0) {
                const proportion = (item.dbPrice * item.qty) / totalDbValue
                unitPrice = item.qty > 0 ? Math.round((rowCOD * proportion) / item.qty) : item.dbPrice
              } else {
                const totalQty = matchedItems.reduce((s, it) => s + it.qty, 0)
                unitPrice = totalQty > 0 ? Math.round(rowCOD / totalQty) : rowCOD
              }
            }
            flatRows.push({ orderCode, productName: item.name, qty: item.qty, unitPrice, totalCOD: rowCOD, rawName: item.name })
          }
        }
      }
    }

    processFlatRows(flatRows, '🚚 Best Express')
  }

  // ── Bước cuối: fuzzy match flatRows → cart ──────────────────────────────
  function processFlatRows(flatRows, formatLabel) {
    if (flatRows.length === 0) {
      toast.error('Không tìm thấy sản phẩm nào trong file!')
      return
    }

    console.group(`[ImportNCC] ${formatLabel} — ${flatRows.length} rows → fuzzy matching...`)

    const matched   = []
    const unmatched = []
    const warns     = []
    const seenIds   = new Set()

    for (const [i, row] of flatRows.entries()) {
      const rawName = row.productName
      if (!rawName) continue

      const rowNum        = i + 2
      let supplierPrice   = row.unitPrice || 0
      const supplierQty   = row.qty

      const inlineBonuses = extractInlineTang(rawName)
      const cleanedName   = cleanSupplierName(rawName)
      const match         = findBestMatch(cleanedName, dbProducts)
                         || findBestMatch(rawName, dbProducts)
                         || findBestMatch(row.rawName || rawName, dbProducts)

      console.log(`[Row ${rowNum}] "${rawName.substring(0, 70)}" → ${match ? `✅ ${match.product.name} (${match.score}pts) qty=${supplierQty}` : '❌'}`)

      if (!match) {
        // Top 3 debug
        const top3 = dbProducts.map(p => ({ name: p.name, score: Math.max(fuzzyScore(cleanedName, p.name), fuzzyScore(rawName, p.name)) })).sort((a, b) => b.score - a.score).slice(0, 3)
        console.log(`  Top3:`, top3.map(c => `${c.name}(${c.score})`).join(', '))
        unmatched.push({ rowNum, name: cleanedName || rawName, price: supplierPrice, reason: 'Không tìm thấy SP khớp' })
        continue
      }

      const { product, score } = match
      const dbUnitPrice = product.importPrice || 0

      // Ưu tiên qty đã đếm từ chuỗi SP; nếu không có thì tính từ giá
      let resolvedQty = supplierQty && supplierQty > 0
        ? supplierQty
        : (supplierPrice > 0 && dbUnitPrice > 0
            ? Math.max(1, Math.round(supplierPrice / dbUnitPrice))
            : 1)

      // Tính tổng giá trị hàng tặng kèm trên mỗi đơn vị sản phẩm chính
      let giftValuePerMain = 0
      const brand = extractBrands(normalizeForMatch(product.name))[0] || ''
      const bonusItemsToProcess = []

      if (inlineBonuses.length > 0) {
        for (const tang of inlineBonuses) {
          const bonusMatch = findBonusProduct(tang.description, brand, dbProducts)
          if (bonusMatch) {
            const bp = bonusMatch.product
            const bonusDbPrice = bp.importPrice || 0
            giftValuePerMain += bonusDbPrice * tang.qty
            bonusItemsToProcess.push({ bp, bonusMatch, tang })
          } else {
            unmatched.push({ rowNum, name: `🎁 ${tang.qty} ${tang.description}`, price: 0, reason: 'Tặng kèm — không tìm thấy SP' })
          }
        }
      }

      // Tự động nhận diện số lượng (implied quantity) từ tổng giá tiền (COD) và giá vốn (sản phẩm chính + quà tặng)
      const singleUnitCost = dbUnitPrice + giftValuePerMain
      if (singleUnitCost > 0) {
        const tempPrice = supplierPrice * resolvedQty
        const impliedQty = Math.round(tempPrice / singleUnitCost)
        if (impliedQty >= 1) {
          resolvedQty = impliedQty
          supplierPrice = Math.round(tempPrice / impliedQty)
        }
      }

      const totalSupplierPriceForMain = supplierPrice * resolvedQty
      const rowBonusValueTotal = giftValuePerMain * resolvedQty
      const adjustedSupplierPriceTotal = Math.max(0, totalSupplierPriceForMain - rowBonusValueTotal)

      if (seenIds.has(product.id)) {
        const existing = matched.find(m => m.productId === product.id && !m.isBonus)
        if (existing) {
          existing.qty += resolvedQty
          existing.supplierPriceTotal = (existing.supplierPriceTotal || 0) + adjustedSupplierPriceTotal
        }
      } else {
        seenIds.add(product.id)
        matched.push({
          productId:          product.id,
          name:               product.name,
          sku:                product.sku,
          imageUrl:           product.imageUrl ?? null,
          currentStock:       product.stockQuantity ?? 0,
          qty:                resolvedQty,
          unitPrice:          '',
          dbUnitPrice,
          unit:               product.unit || null,
          matchScore:         score,
          supplierName:       cleanedName,
          supplierPriceTotal: adjustedSupplierPriceTotal,
          warning:            null,
          orderCode:          row.orderCode || null,
        })
      }

      // Xử lý các sản phẩm tặng kèm (bonuses) đưa vào cart
      for (const b of bonusItemsToProcess) {
        const bonusQty = b.tang.qty * resolvedQty
        const existingBonus = matched.find(m => m.productId === b.bp.id && m.isBonus)
        const bonusDbPrice = b.bp.importPrice || 0
        if (existingBonus) {
          existingBonus.qty += bonusQty
          existingBonus.supplierPriceTotal = (existingBonus.supplierPriceTotal || 0) + (bonusDbPrice * bonusQty)
        } else {
          matched.push({
            productId: b.bp.id, name: b.bp.name, sku: b.bp.sku, imageUrl: b.bp.imageUrl ?? null,
            currentStock: b.bp.stockQuantity ?? 0, qty: bonusQty,
            unitPrice: '',
            dbUnitPrice: bonusDbPrice, unit: b.bp.unit || null,
            matchScore: b.bonusMatch.score, supplierName: `🎁 ${b.tang.qty} ${b.tang.description} × ${resolvedQty}`,
            supplierPriceTotal: bonusDbPrice * bonusQty, warning: null, isBonus: true,
          })
        }
      }
    }

    console.groupEnd()

    // ── Tính giá nhập ────────────────────────────────────────────────────
    // ƯU TIÊN 1: Giá từ Excel (supplierPriceTotal / qty) — đây là giá thật
    // ƯU TIÊN 2: Giá DB (dbUnitPrice) — chỉ dùng khi Excel không có giá
    //            (ví dụ: hàng tặng kèm, bonus items)
    for (const item of matched) {
      const totalSupplier = item.supplierPriceTotal || 0
      const avgPrice = item.qty > 0 && totalSupplier > 0
        ? Math.round(totalSupplier / item.qty)   // Ưu tiên 1: giá Excel
        : item.dbUnitPrice || 0                   // Ưu tiên 2: giá DB
      item.unitPrice = avgPrice > 0 ? avgPrice.toLocaleString('vi-VN') : ''
      // Cảnh báo nếu giá Excel lệch > 2% so với giá DB
      if (!item.isBonus && avgPrice > 0 && item.dbUnitPrice > 0) {
        const deviation = Math.abs(avgPrice - item.dbUnitPrice) / item.dbUnitPrice
        if (deviation > QTY_TOLERANCE) {
          item.warning = `Giá TB: ${avgPrice.toLocaleString('vi-VN')}₫ vs Giá gốc: ${item.dbUnitPrice.toLocaleString('vi-VN')}₫ (chênh ${(deviation * 100).toFixed(1)}%)`
          warns.push({ rowNum: '-', supplierName: item.supplierName, matchedName: item.name, supplierPrice: totalSupplier, unitPrice: avgPrice, quantity: item.qty, warning: item.warning, score: item.matchScore })
        }
      }
    }

    setCart(matched)
    setUnmatchedRows(unmatched)
    setWarnings(warns)
    setStep('preview')

    if (matched.length === 0) {
      toast.error('Không tìm thấy sản phẩm nào khớp!')
    } else {
      const bonusCount = matched.filter(m => m.isBonus).length
      const parts = [`${formatLabel} · ${matched.length} sản phẩm`]
      if (bonusCount > 0)       parts.push(`${bonusCount} tặng kèm`)
      if (unmatched.length > 0) parts.push(`${unmatched.length} không khớp`)
      if (warns.length > 0)     parts.push(`${warns.length} cảnh báo`)
      toast.success(parts.join(' · '))
    }
  }



  // ── Cart handlers ───────────────────────────────────────────────────────

  function updateQty(idx, val) {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, qty: Math.max(1, parseInt(val) || 1) } : item))
  }
  function updatePrice(idx, val) {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, unitPrice: val } : item))
  }
  function removeItem(idx) {
    setCart(prev => prev.filter((_, i) => i !== idx))
  }

  const grandTotal = cart.reduce((s, item) => {
    const price = typeof item.unitPrice === 'string' ? parseVNDInput(item.unitPrice) : (item.unitPrice || 0)
    return s + price * item.qty
  }, 0)

  const paidAmt    = paidInput ? parseVNDInput(paidInput) : grandTotal
  const newDebtAmt = Math.max(0, grandTotal - paidAmt)

  async function handleSubmit() {
    if (saving) return
    setSaving(true)
    try {
      const items = cart.map(item => ({
        productId:    item.productId,
        qty:          item.qty,
        importPrice:  typeof item.unitPrice === 'string' ? parseVNDInput(item.unitPrice) : (item.unitPrice || 0),
        currentStock: item.currentStock,
        unit:         item.unit ?? null,
      }))
      await createImportOrder({
        items,
        supplierId: selectedSupplier || null,
        note:       notes || `Nhập từ file: ${fileName}`,
        paidAmount: paidAmt,
      })
      toast.success(`✅ Đã nhập ${cart.length} sản phẩm thành công!`)
      onImported?.()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo đơn nhập!')
    } finally {
      setSaving(false)
      setShowConfirm(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <ModalOverlay onClose={onClose}>
        <div className="bg-surface border border-border rounded-2xl w-full max-w-7xl shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

          {/* Header */}
          <div className="shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck size={18} strokeWidth={2} className="text-orange-500 shrink-0" />
              <span className="text-lg font-bold text-text">Nhập từ NCC / Đơn Vị Vận Chuyển</span>
              {fileName && <span className="text-xs text-muted ml-2">— {fileName}</span>}
              {step === 'preview' && (
                <div className="text-xs text-muted mt-0.5">{cart.length} sản phẩm nhận diện — kiểm tra và xác nhận</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {step === 'preview' && (
                <button onClick={() => { setStep('upload'); setCart([]); setFileName('') }}
                  className="text-xs text-muted hover:text-text border border-border rounded-lg px-3 py-1.5 transition-colors">← Chọn file khác</button>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-lg bg-surface2 border border-border text-muted hover:text-cred transition-colors flex items-center justify-center shrink-0"><X size={15} strokeWidth={2.2} /></button>
            </div>
          </div>

          {/* Upload step */}
          {step === 'upload' && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 gap-4">
              <div
                className={`w-full max-w-md border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
                  ${dragOver ? 'border-orange-400 bg-orange-50' : 'border-border hover:border-orange-300 hover:bg-surface2'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]) }}
                onClick={() => fileInputRef.current?.click()}
              >
                <FolderOpen size={40} strokeWidth={1.5} className="mx-auto mb-3 text-subtle" />
                <div className="font-bold text-text">Kéo thả file vào đây</div>
                <div className="text-xs text-muted mt-1">hoặc click để chọn file (.xlsx, .xls, .csv)</div>
                <div className="text-[12px] text-subtle mt-3 leading-relaxed">
                  Dòng chứa <span className="text-orange-500 font-bold">[Tặng X gói...]</span> sẽ tự tách thành sản phẩm chính + hàng tặng kèm
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => handleFile(e.target.files?.[0])} />
            </div>
          )}

          {/* Preview step */}
          {step === 'preview' && (
            <>
              {/* Stats bar */}
              <div className="shrink-0 px-6 py-2 border-b border-slate-800 flex flex-wrap gap-2">
                {(() => {
                  const mainCount  = cart.filter(m => !m.isBonus).length
                  const bonusCount = cart.filter(m => m.isBonus).length
                  return (
                    <>
                      {mainCount > 0 && (
                        <span className="text-xs px-3 py-1 rounded-full bg-cgreen/10 text-cgreen border border-cgreen/30 flex items-center gap-1">
                          <CheckCircle2 size={12} strokeWidth={2.4} /> {mainCount} sản phẩm
                        </span>
                      )}
                      {bonusCount > 0 && (
                        <span className="text-xs px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 flex items-center gap-1">
                          <Gift size={12} strokeWidth={2.4} /> {bonusCount} hàng tặng kèm
                        </span>
                      )}
                    </>
                  )
                })()}
                {unmatchedRows.length > 0 && (
                  <span className="text-xs px-3 py-1 rounded-full bg-cred/10 text-cred border border-cred/30 flex items-center gap-1">
                    <XCircle size={12} strokeWidth={2.4} /> {unmatchedRows.length} không khớp
                  </span>
                )}
                {warnings.length > 0 && (
                  <button onClick={() => setShowWarnings(!showWarnings)}
                    className="text-xs px-3 py-1 rounded-full bg-cyellow/10 text-cyellow border border-cyellow/30 hover:brightness-95 transition-all flex items-center gap-1">
                    <AlertTriangle size={12} strokeWidth={2.4} /> {warnings.length} cảnh báo → xem chi tiết
                  </button>
                )}
              </div>

              {/* Warnings panel */}
              {showWarnings && warnings.length > 0 && (
                <div className="shrink-0 px-6 py-2 border-b border-slate-800 max-h-40 overflow-y-auto">
                  {warnings.map((w, i) => (
                    <div key={i} className="text-xs text-cyellow bg-cyellow/5 rounded-lg px-3 py-2 mb-1 border border-cyellow/20">
                      <span className="font-bold">Dòng {w.rowNum}:</span> {w.warning}
                    </div>
                  ))}
                </div>
              )}

              {/* Unmatched rows */}
              {unmatchedRows.length > 0 && (
                <div className="shrink-0 px-6 py-2 border-b border-slate-800 max-h-28 overflow-y-auto">
                  {unmatchedRows.map((u, i) => (
                    <div key={i} className="text-xs text-cred bg-cred/5 rounded-lg px-3 py-1.5 mb-1 border border-cred/20">
                      <span className="font-bold">Dòng {u.rowNum}:</span>{' '}
                      {u.name.substring(0, 80)} — <span className="text-orange-600">{u.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cart table */}
              <div className="flex-1 overflow-auto px-6 py-3">
                {cart.length > 0 && (
                  <table className="w-full text-[16px]">
                    <thead>
                      <tr className="text-[12px] uppercase text-muted tracking-wide font-semibold border-b-2 border-border">
                        <th className="text-left pb-3 font-semibold">Sản phẩm</th>
                        <th className="text-center pb-3 font-semibold w-20">Match</th>
                        <th className="text-center pb-3 font-semibold w-20">Tồn kho</th>
                        <th className="text-center pb-3 font-semibold w-24">SL nhập</th>
                        <th className="text-center pb-3 font-semibold w-16">ĐVT</th>
                        <th className="text-right pb-3 font-semibold w-36">Giá nhập (₫)</th>
                        <th className="text-right pb-3 font-semibold w-36">Thành tiền</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cart.map((item, idx) => {
                        const price    = typeof item.unitPrice === 'string' ? parseVNDInput(item.unitPrice) : (item.unitPrice || 0)
                        const total    = price * item.qty
                        const scoreCls = item.matchScore >= FUZZY_HIGH ? 'text-cgreen' : item.matchScore >= 60 ? 'text-cyellow' : 'text-orange-600'
                        return (
                          <tr key={idx} className={`hover:bg-surface2 transition-colors ${item.isBonus ? 'bg-orange-50/50' : ''}`}>
                            <td className="py-3.5">
                              <div className="flex items-center gap-2.5">
                                {item.imageUrl
                                  ? <img src={item.imageUrl} className="w-11 h-11 rounded-lg object-cover border border-border shrink-0" alt="" />
                                  : <div className={`w-11 h-11 rounded-lg border flex items-center justify-center shrink-0 ${item.isBonus ? 'bg-orange-50 border-orange-200 text-orange-500' : 'bg-surface2 border-border text-muted'}`}>
                                      {item.isBonus ? <Gift size={16} strokeWidth={2} /> : <Package size={16} strokeWidth={2} />}
                                    </div>
                                }
                                <div className="min-w-0">
                                  <div className="font-semibold text-text truncate text-[14px] flex items-center">
                                    {item.isBonus && <Gift size={12} strokeWidth={2.4} className="text-orange-500 mr-1 shrink-0" />}
                                    {item.name}
                                  </div>
                                  <div className="text-xs text-muted truncate">{item.sku}</div>
                                  {item.supplierName && (
                                    <div className="text-xs text-subtle truncate">
                                      ← {item.supplierName.length > 50 ? item.supplierName.substring(0, 50) + '…' : item.supplierName}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="text-center">
                              <span className={`text-[14px] font-bold ${scoreCls}`}>{item.matchScore}%</span>
                              {item.warning && <AlertTriangle size={12} strokeWidth={2.4} className="text-orange-500 mx-auto mt-0.5" />}
                            </td>
                            <td className="text-center text-[14px] text-muted">{item.currentStock}</td>
                            <td className="text-center">
                              <input type="number" min="1" value={item.qty} onChange={e => updateQty(idx, e.target.value)}
                                className="w-16 input-sm px-2 py-1.5 text-center text-[14px]" />
                            </td>
                            <td className="text-center text-xs text-muted font-medium">{item.unit || '—'}</td>
                            <td className="text-right">
                              <input type="text" value={item.unitPrice} onChange={e => updatePrice(idx, formatMoneyLive(e.target.value))}
                                className={`w-32 input-sm px-2 py-1.5 text-right text-[14px] font-mono ${item.isBonus ? 'border-orange-300 focus:border-orange-400' : ''}`} />
                            </td>
                            <td className="text-right text-[14px] font-mono font-bold tabular-nums">
                              <span className={item.isBonus ? 'text-orange-600' : 'text-text'}>{fmtVNDFull(total)}</span>
                            </td>
                            <td className="pl-2">
                              <button onClick={() => removeItem(idx)} className="text-subtle hover:text-cred transition-colors flex items-center justify-center"><X size={14} strokeWidth={2.2} /></button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              {cart.length > 0 && (
                <div className="shrink-0 border-t border-border px-6 py-4 flex flex-col gap-3 bg-surface2">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1">
                      <label className="text-[12px] text-muted font-semibold uppercase tracking-wider block mb-1">Nhà cung cấp</label>
                      <select className={iCls + ' cursor-pointer'} value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)}>
                        <option value="">— Không chọn —</option>
                        {suppliersList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[12px] text-muted font-semibold uppercase tracking-wider block mb-1">Ghi chú</label>
                      <input className={iCls} placeholder="Ghi chú phiếu nhập…" value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border pt-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted">Tổng tiền nhập</span>
                      <span className="font-black text-base tabular-nums text-text">{fmtVNDFull(grandTotal)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted shrink-0 w-[108px]">Số tiền thanh toán</span>
                      <input type="text" inputMode="numeric"
                        placeholder={grandTotal.toLocaleString('vi-VN')}
                        value={paidInput}
                        onChange={e => setPaidInput(formatMoneyLive(e.target.value))}
                        onFocus={e => { if (!paidInput) setPaidInput(grandTotal.toLocaleString('vi-VN')); e.target.select() }}
                        onBlur={() => { if (!paidInput || parseVNDInput(paidInput) >= grandTotal) setPaidInput('') }}
                        className="flex-1 min-w-0 input-base text-right font-mono font-bold focus:border-cgreen focus:ring-cgreen/10" />
                    </div>
                    {newDebtAmt > 0 && (
                      <div className="flex justify-between items-center rounded-lg bg-cred/10 border border-cred/25 px-3 py-2">
                        <span className="text-xs font-bold text-cred flex items-center gap-1"><CreditCard size={12} strokeWidth={2.4} /> Còn nợ NCC</span>
                        <span className="font-mono font-black text-sm text-cred tabular-nums">{fmtVNDFull(newDebtAmt)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-muted">
                      <span className="text-cblue font-bold">{cart.filter(i => !i.isBonus).length}</span> sản phẩm
                      {cart.filter(i => i.isBonus).length > 0 && (
                        <> · <span className="text-orange-600 font-bold">{cart.filter(i => i.isBonus).length}</span> tặng kèm</>
                      )}
                      {warnings.length > 0 && <span className="text-cyellow ml-1 inline-flex items-center gap-0.5">· {warnings.length} <AlertTriangle size={11} strokeWidth={2.4} /></span>}
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-border text-muted text-sm hover:text-text transition-colors">Huỷ</button>
                      <button onClick={() => setShowConfirm(true)}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl bg-cgreen hover:brightness-110 text-white text-sm font-bold transition-all shadow-lg shadow-cgreen/20">
                        <Package size={15} strokeWidth={2.2} /> Xác nhận nhập {cart.length} sản phẩm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </ModalOverlay>

      {/* Confirm dialog */}
      {showConfirm && (
        <ModalOverlay onClose={() => setShowConfirm(false)}>
          <div className="bg-surface border border-border rounded-2xl max-w-sm shadow-2xl p-6 flex flex-col gap-4">
            <div className="font-bold text-text">Xác nhận nhập kho?</div>
            <div className="text-sm text-muted">
              {cart.filter(i => !i.isBonus).length} sản phẩm chính
              {cart.filter(i => i.isBonus).length > 0 && ` · ${cart.filter(i => i.isBonus).length} hàng tặng kèm`}
              {' · '}Tổng {fmtVNDFull(grandTotal)}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowConfirm(false)} className="btn-ghost px-4 py-3 text-base">Huỷ</button>
              <button onClick={handleSubmit} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cgreen text-white text-sm font-bold hover:brightness-110 transition-all disabled:opacity-60">
                {saving ? 'Đang lưu…' : <><CheckCircle2 size={15} strokeWidth={2.2} /> Xác nhận</>}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  )
}
