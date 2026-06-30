// Test fuzzy matching for Ensure product
const BRAND_KEYWORDS = ['pediasure', 'similac', 'ensure', 'glucerna', 'grow', 'enfagrow', 'enfamil', 'enfamilk', 'enfamama', 'nan', 'optipro', 'friso', 'vinamilk', 'optimum', 'dielac', 'meiji', 'blackmore', 'huggies', 'hugies', 'bobby', 'abbott', 'nestle', 'colosiq', 'alpha lipid', 'nutifood'];
const SUB_BRAND_KEYWORDS = ['gold vigor', 'gold', 'vigor', 'total protection', 'total comfort', 'eye q', 'eyeq', 'sua nuoc', 'sua bot', 'isomil', 'iq plus'];
const FUZZY_THRESHOLD = 40;
const FUZZY_HIGH = 85;

function normalizeForMatch(str) {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9\s.+]/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractBrands(n) { return BRAND_KEYWORDS.filter(b => n.includes(b)); }

function extractSubBrands(normalized) {
  const found = [];
  const sorted = [...SUB_BRAND_KEYWORDS].sort((a, b) => b.length - a.length);
  for (const sb of sorted) {
    const escaped = sb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|\\s)' + escaped + '(?:\\s|$)');
    if (re.test(normalized)) found.push(sb);
  }
  if (/(?:^|\s)nuoc(?:\s|$)/.test(normalized) || normalized.includes('sua nuoc')) {
    if (!found.includes('sua nuoc')) found.push('sua nuoc');
  }
  if (/(?:^|\s)bot(?:\s|$)/.test(normalized) || normalized.includes('sua bot')) {
    if (!found.includes('sua bot')) found.push('sua bot');
  }
  return found;
}

function extractSpecs(text) {
  const normalized = normalizeForMatch(text);
  const specs = [];
  let m;
  const re = /(\d+(?:[.,]\d+)?)\s*(ml|g|kg|l)/gi;
  while ((m = re.exec(normalized)) !== null) {
    const num = parseFloat(m[1].replace(',', '.'));
    const unit = m[2].toLowerCase();
    specs.push({ num, unit, grams: unit === 'kg' ? num * 1000 : num });
  }
  const stageRe = /(\d)\+/gi;
  while ((m = stageRe.exec(normalized)) !== null) {
    specs.push({ stage: m[1] + '+' });
  }
  return specs;
}

function fuzzyScore(supplierText, productName) {
  if (!supplierText || !productName) return 0;
  const na = normalizeForMatch(supplierText);
  const nb = normalizeForMatch(productName);
  if (na === nb) return 100;

  const brandsA = extractBrands(na), brandsB = extractBrands(nb);
  let brandMatch = false, brandMismatch = false;
  if (brandsA.length > 0 && brandsB.length > 0) {
    brandMatch = brandsA.some(b => brandsB.includes(b));
    if (!brandMatch) brandMismatch = true;
  }
  if (brandMismatch) return 0;

  const specsA = extractSpecs(supplierText), specsB = extractSpecs(productName);
  let specMatch = false, specMismatch = false;
  const gramsA = specsA.filter(s => s.grams).map(s => s.grams);
  const gramsB = specsB.filter(s => s.grams).map(s => s.grams);
  if (gramsA.length > 0 && gramsB.length > 0) {
    specMatch = gramsA.some(ga => gramsB.some(gb => Math.abs(ga - gb) / Math.max(ga, gb) < 0.15));
    if (!specMatch) specMismatch = true;
  }
  const stagesA = specsA.filter(s => s.stage).map(s => s.stage);
  const stagesB = specsB.filter(s => s.stage).map(s => s.stage);
  let stageMatch = false, stageMismatch = false;
  if (stagesA.length > 0 && stagesB.length > 0) {
    stageMatch = stagesA.some(sa => stagesB.includes(sa));
    if (!stageMatch) stageMismatch = true;
  }

  const subA = extractSubBrands(na), subB = extractSubBrands(nb);
  let subBrandMatch = false, subBrandMismatch = false;
  if (subA.length > 0 || subB.length > 0) {
    const formA = subA.includes('sua nuoc') ? 'nuoc' : subA.includes('sua bot') ? 'bot' : null;
    const formB = subB.includes('sua nuoc') ? 'nuoc' : subB.includes('sua bot') ? 'bot' : null;
    if (formA && formB && formA !== formB) return 0;

    const specSubA = subA.filter(s => !['sua nuoc', 'sua bot'].includes(s));
    const specSubB = subB.filter(s => !['sua nuoc', 'sua bot'].includes(s));
    if (specSubA.length > 0 && specSubB.length > 0) {
      subBrandMatch = specSubA.some(s => specSubB.includes(s));
      if (!subBrandMatch) {
        const hvA = specSubA.includes('gold vigor'), hvB = specSubB.includes('gold vigor');
        if (hvA !== hvB) subBrandMismatch = true;
      }
    } else if (specSubA.length > 0 || specSubB.length > 0) {
      subBrandMismatch = true;
    }
  }

  const tokA = na.split(/\s+/).filter(t => t.length > 1);
  const tokB = nb.split(/\s+/).filter(t => t.length > 1);
  const setA = new Set(tokA), setB = new Set(tokB);
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  const tokenOverlap = union.size > 0 ? intersection.length / union.size : 0;

  let score = 0;
  if (brandMatch)        score += 35;
  if (specMatch)         score += 25;
  else if (specMismatch) score -= 15;
  if (stageMatch)           score += 15;
  else if (stageMismatch)   score -= 20;
  if (subBrandMismatch)     score -= 25;
  else if (subBrandMatch)   score += 10;
  score += Math.round(tokenOverlap * 40);

  if (na.includes(nb) || nb.includes(na)) {
    const shorter = Math.min(na.length, nb.length);
    const longer  = Math.max(na.length, nb.length);
    score = Math.max(score, Math.round(shorter / longer * 100));
  }

  return Math.max(0, Math.min(100, score));
}

// ===================== TEST =====================

// The cleaned supplier name
const supplierName = '1 lon Sữa bột Ensure Gold hương Vani 800g';
const supplierNorm = normalizeForMatch(supplierName);
console.log('Supplier:', supplierName);
console.log('Normalized:', supplierNorm);
console.log('Brands:', extractBrands(supplierNorm));
console.log('SubBrands:', extractSubBrands(supplierNorm));
console.log('Specs:', extractSpecs(supplierName));
console.log();

// Test against possible DB names
const testProducts = [
  'Ensure Gold 800g',
  'Sữa bột Ensure Gold 850g',
  'Ensure Gold HMB Vani 800g',
  'Abbott Ensure Gold 400g',
  'Sữa Ensure Gold hương Vani 800g',
  'PediaSure 800g',
  'Ensure Gold 850g Hương Vani',
  'Sữa Ensure Gold HMB 850g',
  'Ensure 400g',
];

console.log('=== FUZZY SCORES ===');
for (const pName of testProducts) {
  const score = fuzzyScore(supplierName, pName);
  const pNorm = normalizeForMatch(pName);
  console.log(`  ${score >= FUZZY_HIGH ? '✅' : score >= FUZZY_THRESHOLD ? '⚠️' : '❌'} ${score.toString().padStart(3)} pts | "${pName}" (norm: "${pNorm}")`);
  console.log(`       brands=${JSON.stringify(extractBrands(pNorm))} subBrands=${JSON.stringify(extractSubBrands(pNorm))} specs=${JSON.stringify(extractSpecs(pName).map(s=>s.grams+'g'))}`);
}
