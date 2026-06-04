# ANC - CFAM · Cash Flow & Asset Management

## 🚀 Chạy local (3 bước)

```bash
# 1. Vào thư mục project
cd "E:\03. Coder\03. test\anc-cfam"

# 2. Cài dependencies
npm install

# 3. Chạy dev server
npm run dev
```
Mở trình duyệt: **http://localhost:5173**

Trên iPhone cùng mạng WiFi: **http://<IP-máy-tính>:5173**

---

## ☁️ Kết nối Supabase (tùy chọn)

### Bước 1 — Tạo project
1. Vào [supabase.com](https://supabase.com) → New Project
2. Settings → API → Copy **URL** và **anon key**

### Bước 2 — Tạo bảng
1. Vào Supabase Dashboard → SQL Editor
2. Paste nội dung file `supabase_schema.sql` → Run

### Bước 3 — Cấu hình
Mở file `.env.local`, điền thông tin:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxx...
```
Restart `npm run dev` — topbar sẽ hiển thị **☁ Supabase** thay vì 💾 Local.

---

## 🌐 Deploy lên Netlify (có link xem trên iPhone bất kỳ đâu)

```bash
# Build production
npm run build

# Kéo thả thư mục dist/ vào netlify.com/drop
# → Nhận link public ngay lập tức
```

Hoặc dùng Netlify CLI:
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

---

## 📁 Cấu trúc project

```
src/
├── context/AppContext.jsx    # Global state + actions
├── lib/
│   ├── calculations.js       # Tính dòng tiền, danh mục
│   ├── formatters.js         # Format VNĐ
│   ├── constants.js          # Cấu hình danh mục, tỷ lệ
│   └── supabase.js           # Supabase client + queries
├── components/
│   ├── layout/               # Sidebar, Topbar
│   ├── ui/                   # KPICard, MoneyInput
│   ├── charts/               # Chart.js wrappers
│   └── portfolio/            # PortfolioModal
├── pages/                    # 7 pages chính
└── App.jsx                   # Router đơn giản
```

## 🛠️ Stack

| | Công nghệ |
|---|---|
| UI Framework | React 18 |
| Build Tool | Vite 5 |
| Styling | Tailwind CSS 3 |
| Charts | Chart.js + react-chartjs-2 |
| Database | Supabase (PostgreSQL) |
| Storage | localStorage (fallback khi chưa có Supabase) |
