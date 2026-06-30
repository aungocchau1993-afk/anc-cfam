-- Chạy file này trong Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS assumptions (
  id INT PRIMARY KEY DEFAULT 1,
  initial_cash BIGINT DEFAULT 1500000000,
  start_year INT DEFAULT 2026,
  num_quarters INT DEFAULT 20,
  monthly_profit BIGINT DEFAULT 120000000,
  profit_growth_per_year DECIMAL DEFAULT 12,
  monthly_living BIGINT DEFAULT 25000000,
  monthly_housing BIGINT DEFAULT 15000000,
  expense_inflation DECIMAL DEFAULT 5,
  bank_debt BIGINT DEFAULT 800000000,
  bank_rate DECIMAL DEFAULT 11,
  debt_repay_per_quarter BIGINT DEFAULT 40000000,
  invest_ratio DECIMAL DEFAULT 60,
  invest_yield_per_year DECIMAL DEFAULT 15,
  min_cash_reserve BIGINT DEFAULT 300000000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INT NOT NULL,
  month_index INT NOT NULL,
  income BIGINT DEFAULT 0,
  living BIGINT DEFAULT 0,
  housing BIGINT DEFAULT 0,
  debt_repay BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month_index)
);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT,
  location TEXT,
  qty TEXT,
  area TEXT,
  rate TEXT,
  amount BIGINT DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_config (
  id INT PRIMARY KEY DEFAULT 1,
  risk_profile TEXT DEFAULT 'Cân bằng',
  deviation_threshold DECIMAL DEFAULT 5,
  custom_stocks DECIMAL DEFAULT 35,
  custom_realestate DECIMAL DEFAULT 25,
  custom_gold DECIMAL DEFAULT 10,
  custom_crypto DECIMAL DEFAULT 10,
  custom_cash DECIMAL DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  import_price BIGINT DEFAULT 0,
  sell_price BIGINT DEFAULT 0,
  stock_quantity INT DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sku)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  type TEXT DEFAULT 'export',           -- 'export' = bán hàng, 'import' = nhập kho
  order_code TEXT,                       -- Mã đơn hiển thị
  total_amount BIGINT DEFAULT 0,
  profit BIGINT DEFAULT 0,
  discount BIGINT DEFAULT 0,
  note TEXT,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════
-- MIGRATION: Chạy các lệnh này nếu bảng đã tồn tại trước đó
-- ═══════════════════════════════════════════════════════════
ALTER TABLE orders ADD COLUMN IF NOT EXISTS type        TEXT DEFAULT 'export';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code  TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount BIGINT DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS debt_amount BIGINT DEFAULT 0;

ALTER TABLE products ADD COLUMN IF NOT EXISTS min_stock   INT DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url   TEXT;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit  BIGINT DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS current_debt   BIGINT DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS reward_points  INT    DEFAULT 0;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS vip_tier       TEXT   DEFAULT 'MEMBER';

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS returned_quantity INT DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cost BIGINT DEFAULT 0;

-- Bật Realtime cho orders (cần thiết cho live sync NCC drawer)
-- Chạy trong Supabase Dashboard > Database > Replication > Source > Add tables:
-- Thêm bảng "orders" vào supabase_realtime publication.
-- Hoặc chạy SQL sau:
ALTER PUBLICATION supabase_realtime ADD TABLE orders;

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  quantity INT DEFAULT 1,
  price BIGINT DEFAULT 0,
  cost BIGINT DEFAULT 0,
  returned_quantity INT DEFAULT 0
);

-- Migration nếu bảng đã tồn tại:
-- ALTER TABLE order_items ADD COLUMN IF NOT EXISTS returned_quantity INT DEFAULT 0;
-- orders.status mới: 'partially_returned'

CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  total_spent BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS income_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT,
  card_holder TEXT,
  card_number_last4 TEXT,
  credit_limit BIGINT DEFAULT 0,
  used_amount BIGINT DEFAULT 0,
  statement_amount BIGINT DEFAULT 0,
  statement_date INT,
  due_date INT,
  has_statement BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Thêm UNIQUE constraint cho sku nếu bảng đã tồn tại mà chưa có:
-- ALTER TABLE products ADD CONSTRAINT products_sku_unique UNIQUE (sku);

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  address      TEXT,
  debt         BIGINT DEFAULT 0,
  note         TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (tùy chọn nếu có auth)
-- ALTER TABLE assumptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE monthly_data ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE risk_config ENABLE ROW LEVEL SECURITY;

-- Migration: Chạy lệnh này trên Supabase Dashboard > SQL Editor để cập nhật cột mới
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS has_statement BOOLEAN DEFAULT false;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS statement_amount BIGINT DEFAULT 0;
ALTER TABLE credit_cards ADD COLUMN IF NOT EXISTS card_number_full TEXT;


