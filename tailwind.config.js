/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Semantic tokens (LIGHT THEME — Design System 2026) ──────────────
        bg:       '#f5f7fb',   // Content
        surface:  '#ffffff',   // Card — thẻ / panel
        surface2: '#f8fafc',   // bề mặt nâng nhẹ (input, hover)
        border:   '#e5e7eb',   // Border
        text:     '#111827',   // Text — chữ chính (đậm nhất)
        muted:    '#6b7280',   // Secondary — chữ phụ
        // Trước là #94a3b8 (2.56:1 trên trắng — FAIL WCAG AA). subtle được dùng rộng rãi cho
        // caption/sub-value thật (không chỉ placeholder) nên phải đạt AA — đổi sang #64748b
        // (4.76:1 trên trắng, PASS), vẫn phân biệt được với muted nhưng không còn quá nhạt.
        subtle:   '#64748b',   // Muted — chữ ít quan trọng nhất (caption, placeholder)

        // ── Sidebar — LUÔN TỐI, độc lập với content sáng ─────────────────────
        sidebar:       '#0b1220',
        sidebarHover:  '#111c2d',
        sidebarActive: '#1e293b',

        // ── Accent (prefix "c" tránh đụng built-ins) ─────────────────────────
        // Đã darken cgreen/cred/cyellow/cteal so với bản gốc (green-600/red-500/amber-500/teal-600)
        // để đạt contrast ≥4.5:1 với nền trắng — bản gốc chỉ 3.3/3.76/2.15/3.74:1, FAIL WCAG AA
        // khi dùng làm text hoặc nút bg+text-white. cblue/cpurple giữ nguyên vì đã đạt (5.17/5.70:1).
        cgreen:   '#15803d',   // Success (green-700, 5.02:1 trên trắng)
        cred:     '#dc2626',   // Danger  (red-600,   4.83:1 trên trắng)
        cyellow:  '#b45309',   // Warning (amber-700, 5.02:1 trên trắng)
        cblue:    '#2563eb',   // Primary
        cpurple:  '#7c3aed',
        cteal:    '#0f766e',   // (teal-700, 5.47:1 trên trắng)
        accent:   '#2563eb',   // Primary

        // ── Đảo thang slate ────────────────────────────────────────────────
        //  Codebase dùng slate rất nhất quán: số cao = nền tối, số thấp = chữ sáng.
        //  Đảo ngược (50↔950, 100↔900, 200↔800, 300↔700, 400↔600, 500 giữ nguyên)
        //  để toàn bộ class slate-* tự chuyển sang light: nền tối→xám nhạt,
        //  chữ sáng→chữ đậm. Đây là chìa khoá lật theme mà không phải sửa tay.
        slate: {
          50:  '#020617',
          100: '#0f172a',
          200: '#1e293b',
          300: '#334155',
          400: '#475569',
          500: '#64748b',
          600: '#94a3b8',
          700: '#cbd5e1',
          800: '#e2e8f0',
          900: '#f1f5f9',
          950: '#f8fafc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      // ── Type scale chuẩn — dùng text-title/h2/section/caption thay vì
      //    chọn size tùy tiện. text-body trùng text-sm (14px) nên có thể
      //    dùng lẫn cả hai; mọi class size mặc định khác (xs/base/lg...)
      //    vẫn còn nguyên, đây chỉ là EXTEND.
      fontSize: {
        title:   ['32px', { lineHeight: '1.25', fontWeight: '700' }],  // Title — tiêu đề lớn nhất (hiếm dùng)
        page:    ['28px', { lineHeight: '1.3',  fontWeight: '700' }],  // Page — h1 mỗi trang
        h1:      ['28px', { lineHeight: '1.3',  fontWeight: '700' }],  // alias ngữ nghĩa của "page"
        h2:      ['24px', { lineHeight: '1.3',  fontWeight: '700' }],  // giữ lại cho tương thích ngược
        h3:      ['20px', { lineHeight: '1.35', fontWeight: '600' }],
        section: ['22px', { lineHeight: '1.35', fontWeight: '600' }],  // Section — tiêu đề khối
        cardtitle:['18px',{ lineHeight: '1.4',  fontWeight: '600' }],  // Card — tiêu đề trong card
        body:    ['14px', { lineHeight: '1.6',  fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1.5',  fontWeight: '500' }],
      },
      // Bổ sung radius 20px — 8/12/16 đã có sẵn qua rounded-lg/xl/2xl mặc định của Tailwind.
      borderRadius: {
        20: '20px',
      },
      boxShadow: {
        card:     '0 4px 20px rgba(15,23,42,0.06)',    // Card mặc định
        cardHover:'0 10px 30px rgba(15,23,42,0.10)',   // Card hover (translateY -2px)
        glow:     '0 0 0 1px rgba(37,99,235,0.06), 0 0 16px rgba(37,99,235,0.18)', // glow nhẹ cho active state
        soft:     '0 4px 16px -4px rgba(15,23,42,0.08)',
        // sm/md/lg/xl bên dưới đã tồn tại mặc định trong Tailwind (shadow-sm/md/lg/xl) — giữ nguyên, không override.
      },
      // Z-index chuẩn hoá — tránh mỗi component tự chọn z-20/z-40/z-50 tuỳ ý.
      zIndex: {
        sticky:   '20',
        dropdown: '40',
        overlay:  '50',
        modal:    '50',
        toast:    '60',
        tooltip:  '70',
      },
      // Opacity ngữ nghĩa — bổ sung, không đụng thang opacity mặc định (0..100).
      opacity: {
        disabled: '0.4',
      },
      // Duration ngữ nghĩa cho animation (150/200/300ms mặc định của Tailwind vẫn dùng được y nguyên).
      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
      },
      keyframes: {
        fadeIn:   { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn:  { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        slideUp:  { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        fadeIn:  'fadeIn 150ms ease-out',
        scaleIn: 'scaleIn 150ms ease-out',
        slideUp: 'slideUp 200ms ease-out',
      },
    },
  },
  plugins: [
    // Safe-area padding utilities: pt-safe, pb-safe, pl-safe, pr-safe
    function({ addUtilities }) {
      addUtilities({
        '.pt-safe':  { paddingTop:    'env(safe-area-inset-top)' },
        '.pb-safe':  { paddingBottom: 'env(safe-area-inset-bottom)' },
        '.pl-safe':  { paddingLeft:   'env(safe-area-inset-left)' },
        '.pr-safe':  { paddingRight:  'env(safe-area-inset-right)' },
        '.mt-safe':  { marginTop:     'env(safe-area-inset-top)' },
        '.mb-safe':  { marginBottom:  'env(safe-area-inset-bottom)' },
        // min-h đủ cho bottom home indicator
        '.min-h-screen-safe': { minHeight: 'calc(100vh - env(safe-area-inset-bottom))' },
        // Prevent tap highlight on mobile
        '.tap-none': { '-webkit-tap-highlight-color': 'transparent' },
        // Tốt hơn cho input trên iOS
        '.input-ios': { '-webkit-appearance': 'none', 'border-radius': '0' },
      })
    },
  ],
}
