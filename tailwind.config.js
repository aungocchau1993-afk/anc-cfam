/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Semantic tokens (LIGHT THEME) ──────────────────────────────────
        bg:       '#f4f6fb',   // nền app (xám rất nhạt)
        surface:  '#ffffff',   // thẻ / sidebar / panel
        surface2: '#f8fafc',   // bề mặt nâng nhẹ (input, hover)
        border:   '#e6eaf0',   // viền nhạt
        muted:    '#64748b',   // chữ phụ
        text:     '#1e293b',   // chữ chính (đậm)

        // ── Accent (prefix "c" tránh đụng built-ins) — đã chỉnh đậm cho nền sáng ─
        cgreen:   '#16a34a',
        cred:     '#dc2626',
        cyellow:  '#d97706',
        cblue:    '#2563eb',
        cpurple:  '#7c3aed',
        cteal:    '#0d9488',
        accent:   '#2563eb',

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
      boxShadow: {
        card: '0 1px 2px 0 rgba(15,23,42,0.04), 0 1px 3px 0 rgba(15,23,42,0.06)',
        soft: '0 4px 16px -4px rgba(15,23,42,0.08)',
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
