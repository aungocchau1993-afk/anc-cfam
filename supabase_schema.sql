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

-- Enable Row Level Security (tùy chọn nếu có auth)
-- ALTER TABLE assumptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE monthly_data ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE risk_config ENABLE ROW LEVEL SECURITY;
