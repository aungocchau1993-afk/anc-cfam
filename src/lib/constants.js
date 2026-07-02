export const ALLOCATIONS = {
  'Thận trọng':  { stocks: 25, realestate: 20, gold: 15, crypto: 5,  cash: 35 },
  'Cân bằng':    { stocks: 35, realestate: 25, gold: 10, crypto: 10, cash: 20 },
  'Tăng trưởng': { stocks: 45, realestate: 25, gold: 5,  crypto: 15, cash: 10 },
  'Tùy chỉnh':   null,
}

export const ALLOC_LABELS = {
  stocks:     'Chứng khoán',
  realestate: 'Bất động sản',
  gold:       'Vàng',
  crypto:     'Crypto',
  cash:       'Tiền mặt',
}

// Bảng màu hợp nhất theo token accent của Design System (cblue/cgreen/cyellow/cpurple/cteal)
// — thay cho palette dark-theme cũ (#58a6ff…) để đồng bộ màu với toàn bộ giao diện sáng.
export const ALLOC_COLORS = {
  stocks:     '#2563eb',
  realestate: '#16a34a',
  gold:       '#f59e0b',
  crypto:     '#7c3aed',
  cash:       '#0d9488',
}

export const CATEGORY_CONFIG = {
  stocks: {
    label: 'Chứng Khoán', icon: '📈', color: '#2563eb',
    fields: [
      { key: 'name',   label: 'Mã / Tên CK',    placeholder: 'VNM, HPG, VIC…', wide: true },
      { key: 'qty',    label: 'Số lượng (cp)',   placeholder: '1000' },
      { key: 'amount', label: 'Giá trị (₫)',     placeholder: '50.000.000', money: true },
      { key: 'note',   label: 'Ghi chú',         placeholder: 'Mua 01/2026' },
    ],
    meta: h => [h.qty ? h.qty + ' cp' : '', h.note].filter(Boolean).join(' · '),
  },
  realestate: {
    label: 'Bất Động Sản', icon: '🏠', color: '#16a34a',
    fields: [
      { key: 'name',     label: 'Tên BĐS',          placeholder: 'Chung cư Q7…', wide: true },
      { key: 'location', label: 'Vị trí / Địa chỉ', placeholder: '123 Nguyễn Văn A, Q.7', wide: true },
      { key: 'area',     label: 'Diện tích (m²)',    placeholder: '65' },
      { key: 'amount',   label: 'Giá trị (₫)',       placeholder: '2.000.000.000', money: true },
      { key: 'note',     label: 'Ghi chú',           placeholder: 'Đang cho thuê' },
    ],
    meta: h => [h.location, h.area ? h.area + 'm²' : '', h.note].filter(Boolean).join(' · '),
  },
  gold: {
    label: 'Vàng', icon: '🪙', color: '#f59e0b',
    fields: [
      { key: 'name',   label: 'Loại vàng',       placeholder: 'Vàng SJC, Vàng nhẫn 999.9…', wide: true },
      { key: 'qty',    label: 'Số lượng (lượng)', placeholder: '2.5' },
      { key: 'amount', label: 'Giá trị (₫)',      placeholder: '200.000.000', money: true },
      { key: 'note',   label: 'Ghi chú',          placeholder: 'Mua tại SJC Q.1' },
    ],
    meta: h => [h.qty ? h.qty + ' lượng' : '', h.note].filter(Boolean).join(' · '),
  },
  crypto: {
    label: 'Crypto', icon: '🔗', color: '#7c3aed',
    fields: [
      { key: 'name',   label: 'Đồng coin',       placeholder: 'BTC, ETH, SOL…', wide: true },
      { key: 'qty',    label: 'Số lượng (coin)', placeholder: '0.05' },
      { key: 'amount', label: 'Giá trị (₫)',     placeholder: '30.000.000', money: true },
      { key: 'note',   label: 'Ghi chú / Sàn',  placeholder: 'Binance, ví lạnh' },
    ],
    meta: h => [h.qty ? h.qty + ' coin' : '', h.note].filter(Boolean).join(' · '),
  },
  cash: {
    label: 'Tiền Mặt & Tiết Kiệm', icon: '💵', color: '#0d9488',
    fields: [
      { key: 'name',   label: 'Ngân hàng / Tài khoản', placeholder: 'Vietcombank, Tiết kiệm 6 tháng…', wide: true },
      { key: 'rate',   label: 'Lãi suất (%/năm)',       placeholder: '5.5' },
      { key: 'amount', label: 'Số tiền (₫)',             placeholder: '500.000.000', money: true },
      { key: 'note',   label: 'Ghi chú',                 placeholder: 'Đáo hạn 06/2026' },
    ],
    meta: h => [h.rate ? h.rate + '%/năm' : '', h.note].filter(Boolean).join(' · '),
  },
}

export const DEFAULT_ASSUMPTIONS = {
  initialCash: 1500000000,
  startYear: 2026,
  numQuarters: 20,
  monthlyProfit: 120000000,
  profitGrowthPerYear: 12,
  monthlyLiving: 25000000,
  monthlyHousing: 15000000,
  expenseInflation: 5,
  bankDebt: 800000000,
  bankRate: 11,
  debtRepayPerQuarter: 40000000,
  investRatio: 60,
  investYieldPerYear: 15,
  minCashReserve: 300000000,
}

export const MONTH_NAMES = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5',
  'Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12']
