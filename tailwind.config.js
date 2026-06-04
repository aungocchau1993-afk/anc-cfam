/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#0d1117',
        surface:  '#161b22',
        surface2: '#1e2530',
        border:   '#30363d',
        muted:    '#8b949e',
        // prefix "c" để tránh conflict với Tailwind built-ins (text, bg, border...)
        cgreen:   '#3fb950',
        cred:     '#f85149',
        cyellow:  '#d29922',
        cblue:    '#58a6ff',
        cpurple:  '#bc8cff',
        cteal:    '#39c5cf',
        accent:   '#1f6feb',
        // màu chữ chính — dùng trực tiếp thay vì qua Tailwind class
        // '#e6edf3' → đặt trong body CSS
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Cascadia Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
