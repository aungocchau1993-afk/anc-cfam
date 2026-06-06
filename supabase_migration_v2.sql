-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRATION V2 — Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Bảng shop_config (thay thế localStorage) ───────────────────────────
CREATE TABLE IF NOT EXISTS shop_config (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name           TEXT DEFAULT 'Cửa hàng của tôi',
  address        TEXT DEFAULT '',
  phone          TEXT DEFAULT '',
  thank_you_note TEXT DEFAULT 'Cảm ơn quý khách!',
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Bảng reward_history (điểm tích lũy khách hàng) ─────────────────────
CREATE TABLE IF NOT EXISTS reward_history (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE,
  order_id       UUID REFERENCES orders(id)    ON DELETE SET NULL,
  points_change  INT NOT NULL,
  description    TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Thêm cột còn thiếu vào bảng hiện có ────────────────────────────────
ALTER TABLE assumptions  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE monthly_data ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE monthly_data ADD COLUMN IF NOT EXISTS income_details JSONB DEFAULT '{}';
ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE risk_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 4. Bật Realtime cho tất cả bảng business ──────────────────────────────
-- Dùng DO block để bỏ qua lỗi "already member" nếu bảng đã được thêm trước đó
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE products;   EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE orders;     EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE customers;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE suppliers;  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE shop_config; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- Đảm bảo mỗi user chỉ đọc/ghi dữ liệu của chính họ
-- ═══════════════════════════════════════════════════════════════════════════

-- Bật RLS trên tất cả bảng
ALTER TABLE assumptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_data       ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_config        ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashbook_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktakes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktake_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_config        ENABLE ROW LEVEL SECURITY;

-- ── Xoá policy cũ nếu cần chạy lại ──────────────────────────────────────
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── assumptions ───────────────────────────────────────────────────────────
CREATE POLICY "assumptions: own rows only"
  ON assumptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── monthly_data ──────────────────────────────────────────────────────────
CREATE POLICY "monthly_data: own rows only"
  ON monthly_data FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── portfolio_holdings ────────────────────────────────────────────────────
CREATE POLICY "portfolio_holdings: own rows only"
  ON portfolio_holdings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── risk_config ───────────────────────────────────────────────────────────
CREATE POLICY "risk_config: own rows only"
  ON risk_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── income_categories ─────────────────────────────────────────────────────
CREATE POLICY "income_categories: own rows only"
  ON income_categories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── credit_cards ──────────────────────────────────────────────────────────
CREATE POLICY "credit_cards: own rows only"
  ON credit_cards FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── products ──────────────────────────────────────────────────────────────
CREATE POLICY "products: own rows only"
  ON products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── orders ────────────────────────────────────────────────────────────────
CREATE POLICY "orders: own rows only"
  ON orders FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── order_items — không có user_id, bảo vệ qua orders ────────────────────
CREATE POLICY "order_items: chỉ qua orders của mình"
  ON order_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- ── customers ─────────────────────────────────────────────────────────────
CREATE POLICY "customers: own rows only"
  ON customers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── suppliers ─────────────────────────────────────────────────────────────
CREATE POLICY "suppliers: own rows only"
  ON suppliers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── cashbook_transactions ─────────────────────────────────────────────────
CREATE POLICY "cashbook: own rows only"
  ON cashbook_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── stocktakes — dùng created_by thay user_id ────────────────────────────
CREATE POLICY "stocktakes: own rows only"
  ON stocktakes FOR ALL
  USING (auth.uid() = created_by);

-- ── stocktake_items — bảo vệ qua stocktakes ──────────────────────────────
CREATE POLICY "stocktake_items: chỉ qua stocktakes của mình"
  ON stocktake_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM stocktakes
      WHERE stocktakes.id = stocktake_items.stocktake_id
        AND stocktakes.created_by = auth.uid()
    )
  );

-- ── reward_history — bảo vệ qua customers ────────────────────────────────
CREATE POLICY "reward_history: chỉ qua customers của mình"
  ON reward_history FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = reward_history.customer_id
        AND customers.user_id = auth.uid()
    )
  );

-- ── shop_config ───────────────────────────────────────────────────────────
CREATE POLICY "shop_config: own rows only"
  ON shop_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Hàm RPC adjust_stock (chạy dưới quyền DB, bypass RLS an toàn) ─────────
CREATE OR REPLACE FUNCTION adjust_stock(p_id UUID, p_delta INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE products
  SET stock_quantity = GREATEST(0, stock_quantity + p_delta),
      updated_at = NOW()
  WHERE id = p_id
    AND user_id = auth.uid();
END;
$$;
