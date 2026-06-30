// Test sub-brand matching + bonus extraction
const BRAND_KEYWORDS = ['pediasure','similac','ensure','glucerna','grow','enfagrow','enfamil','meiji','nan','friso','dielac','abbott','nestle','vinamilk','optimum','huggies','bobby','blackmore','colosiq','nutifood'];
const SUB_BRAND_KEYWORDS = ['gold vigor','gold','vigor','total protection','total comfort','iq','eye q','eyeq','nuoc','bot','ba','isomil'];

function normalizeForMatch(str) {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\u0111/gi,'d').toLowerCase().replace(/[^a-z0-9\s.+]/g,' ').replace(/\s+/g,' ').trim();
}

function extractBrands(n) { return BRAND_KEYWORDS.filter(b => n.includes(b)); }

function extractSubBrands(n) {
  const sorted = [...SUB_BRAND_KEYWORDS].sort((a,b)=>b.length-a.length);
  return sorted.filter(sb => n.includes(sb));
}

function extractSpecs(text) {
  const n = normalizeForMatch(text); const specs = []; let m;
  const re = /(\d+(?:[.,]\d+)?)\s*(ml|g|kg|l)/gi;
  while ((m = re.exec(n)) !== null) {
    const num = parseFloat(m[1].replace(',','.')); const unit = m[2].toLowerCase();
    const grams = unit === 'kg' ? num * 1000 : num; specs.push({num,unit,grams});
  }
  const stageRe = /(\d)\+/gi;
  while ((m = stageRe.exec(n)) !== null) { specs.push({ stage: m[1] + '+' }); }
  return specs;
}

function fuzzyScore(a, b) {
  const na = normalizeForMatch(a), nb = normalizeForMatch(b);
  if (na === nb) return 100;

  const bA = extractBrands(na), bB = extractBrands(nb);
  let brandMatch = false, brandMismatch = false;
  if (bA.length > 0 && bB.length > 0) { brandMatch = bA.some(x => bB.includes(x)); if (!brandMatch) brandMismatch = true; }
  if (brandMismatch) return 0;

  const sA = extractSpecs(a), sB = extractSpecs(b);
  let specM = false, specMM = false, stageM = false, stageMM = false;
  const gA = sA.filter(s => s.grams).map(s => s.grams), gB = sB.filter(s => s.grams).map(s => s.grams);
  if (gA.length > 0 && gB.length > 0) { specM = gA.some(ga => gB.some(gb => Math.abs(ga - gb) / Math.max(ga, gb) < 0.15)); if (!specM) specMM = true; }
  const stA = sA.filter(s => s.stage).map(s => s.stage), stB = sB.filter(s => s.stage).map(s => s.stage);
  if (stA.length > 0 && stB.length > 0) { stageM = stA.some(sa => stB.includes(sa)); if (!stageM) stageMM = true; }

  // Sub-brand
  const subA = extractSubBrands(na), subB = extractSubBrands(nb);
  let subBrandMatch = false, subBrandMismatch = false;
  if (subA.length > 0 || subB.length > 0) {
    const formA = subA.includes('nuoc') ? 'nuoc' : subA.includes('bot') ? 'bot' : null;
    const formB = subB.includes('nuoc') ? 'nuoc' : subB.includes('bot') ? 'bot' : null;
    if (formA && formB && formA !== formB) subBrandMismatch = true;
    const specSubA = subA.filter(s => !['nuoc','bot'].includes(s));
    const specSubB = subB.filter(s => !['nuoc','bot'].includes(s));
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
  if (subBrandMismatch) {
    const formA = subA.includes('nuoc') ? 'nuoc' : subA.includes('bot') ? 'bot' : null;
    const formB = subB.includes('nuoc') ? 'nuoc' : subB.includes('bot') ? 'bot' : null;
    if (formA && formB && formA !== formB) return 0;
  }

  const tokA = na.split(/\s+/).filter(t => t.length > 1);
  const tokB = nb.split(/\s+/).filter(t => t.length > 1);
  const setA = new Set(tokA), setB = new Set(tokB);
  const inter = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  const tokOvl = union.size > 0 ? inter.length / union.size : 0;

  let score = 0;
  if (brandMatch) score += 35;
  if (specM) score += 25; else if (specMM) score -= 15;
  if (stageM) score += 15; else if (stageMM) score -= 20;
  if (subBrandMismatch) score -= 25; else if (subBrandMatch) score += 10;
  score += Math.round(tokOvl * 40);
  return Math.max(0, Math.min(100, score));
}

// === TEST CASES ===
console.log('\n=== TEST 1: Ensure nuoc vs Ensure Gold Vigor ===');
const ensureTests = [
  ['Thung 24 Chai Sua Nuoc Ensure Abbott Huong Vani 237ml', 'Sua nuoc Ensure Gold Vigor 237ml'],
  ['Thung 24 Chai Sua Nuoc Ensure Abbott Huong Vani 237ml', 'Thung 24 chai Sua nuoc Ensure Abbott Huong Vani 237ml'],
  ['Thung 24 Chai Sua Nuoc Ensure Abbott Huong Vani 237ml', 'Sua bot nguoi lon Abbott Ensure gold huong vani 800g'],
];
ensureTests.forEach(([a, b]) => {
  console.log(`  "${a.substring(0,50)}" vs "${b.substring(0,50)}"`);
  console.log(`    SubBrands A: ${extractSubBrands(normalizeForMatch(a))}`);
  console.log(`    SubBrands B: ${extractSubBrands(normalizeForMatch(b))}`);
  console.log(`    Score: ${fuzzyScore(a, b)}`);
});

console.log('\n=== TEST 2: Bonus extraction ===');
const bonusTests = [
  '[Tang 02 goi dung thu] 1 lon PediaSure 1-10 tuoi dang bot huong Vani 800g',
  '[Tang 04 goi dung thu] 1 lon PediaSure 1-10 tuoi dang bot 1.6kg',
  'Sua bot Similac 1+ 1.6kg (no bonus)',
];
const goiRe = /[Tt][a\u00e1\u0103\u1eb7][n\u1e47]g\s*(\d+)\s*[Gg][o\u00f3][i\u00ed]\s*(?:d[u\u00f9\u01b0][n\u1e47]g\s*th[u\u1eed]|sample|d\u00f9ng th\u1eed)/gi;
bonusTests.forEach(t => {
  goiRe.lastIndex = 0;
  const m = goiRe.exec(t);
  console.log(`  "${t.substring(0,60)}"`);
  console.log(`    Bonus: ${m ? m[1] + ' goi' : 'none'}`);
});
