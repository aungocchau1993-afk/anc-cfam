-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  PRODUCTION RLS — Multi-tenant Data Isolation                          ║
-- ║  Chạy TỪNG BLOCK trong Supabase Dashboard > SQL Editor                 ║
-- ║  Đọc comment cẩn thận trước khi chạy                                  ║
-- ╚══════════════════════════════════════════════════════════════════════════╝


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 0: KIỂM TRA TRƯỚC KHI CHẠY
-- Chạy để xem bảng nào chưa có user_id
-- ════════════════════════════════════════════════════════════════════════════

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('user_id', 'created_by')
ORDER BY table_name;

-- Kết quả cần có: assumptions, monthly_data, portfolio_holdings, risk_config
-- Nếu thiếu → chạy BLOCK 1


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 1: MIGRATION — Thêm user_id vào 4 bảng singleton đang bị SHARED
-- ⚠️  CRITICAL: 4 bảng này đang cho phép mọi user đọc/ghi chung dữ liệu!
-- ════════════════════════════════════════════════════════════════════════════

-- 1a. assumptions — singleton id=1 dùng chung → chuyển sang per-user
ALTER TABLE assumptions ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1b. monthly_data — UNIQUE(year, month_index) → phải thêm user_id vào unique key
ALTER TABLE monthly_data ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1c. portfolio_holdings — hoàn toàn không có user_id
ALTER TABLE portfolio_holdings ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 1d. risk_config — singleton id=1 dùng chung → chuyển sang per-user
ALTER TABLE risk_config ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 2: SỬA UNIQUE CONSTRAINTS
-- Sau khi thêm user_id, phải cập nhật lại unique keys
-- ════════════════════════════════════════════════════════════════════════════

-- 2a. monthly_data: UNIQUE(year, month_index) → UNIQUE(user_id, year, month_index)
ALTER TABLE monthly_data DROP CONSTRAINT IF EXISTS monthly_data_year_month_index_key;
ALTER TABLE monthly_data
  ADD CONSTRAINT monthly_data_user_year_month_key
  UNIQUE (user_id, year, month_index);

-- 2b. products: UNIQUE(sku) → UNIQUE(user_id, sku)
-- [User A và User B có thể cùng dùng SKU "SP001" mà không xung đột]
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_key;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_sku_unique;
ALTER TABLE products
  ADD CONSTRAINT products_user_sku_key
  UNIQUE (user_id, sku);

-- 2c. customers: upsert by phone → UNIQUE(user_id, phone)
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_key;
ALTER TABLE customers
  ADD CONSTRAINT customers_user_phone_key
  UNIQUE (user_id, phone);

-- 2d. suppliers: upsert by phone → UNIQUE(user_id, phone)
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_phone_key;
ALTER TABLE suppliers
  ADD CONSTRAINT suppliers_user_phone_key
  UNIQUE (user_id, phone);


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 3: XOÁ TẤT CẢ POLICY CŨ (anon policies = NGUY HIỂM)
-- ════════════════════════════════════════════════════════════════════════════

-- assumptions
DROP POLICY IF EXISTS "anon_select_assumptions"  ON assumptions;
DROP POLICY IF EXISTS "anon_insert_assumptions"  ON assumptions;
DROP POLICY IF EXISTS "anon_update_assumptions"  ON assumptions;
DROP POLICY IF EXISTS "anon_delete_assumptions"  ON assumptions;

-- monthly_data
DROP POLICY IF EXISTS "anon_select_monthly"  ON monthly_data;
DROP POLICY IF EXISTS "anon_insert_monthly"  ON monthly_data;
DROP POLICY IF EXISTS "anon_update_monthly"  ON monthly_data;
DROP POLICY IF EXISTS "anon_delete_monthly"  ON monthly_data;

-- portfolio_holdings
DROP POLICY IF EXISTS "anon_select_holdings"  ON portfolio_holdings;
DROP POLICY IF EXISTS "anon_insert_holdings"  ON portfolio_holdings;
DROP POLICY IF EXISTS "anon_update_holdings"  ON portfolio_holdings;
DROP POLICY IF EXISTS "anon_delete_holdings"  ON portfolio_holdings;

-- risk_config
DROP POLICY IF EXISTS "anon_select_risk"  ON risk_config;
DROP POLICY IF EXISTS "anon_insert_risk"  ON risk_config;
DROP POLICY IF EXISTS "anon_update_risk"  ON risk_config;
DROP POLICY IF EXISTS "anon_delete_risk"  ON risk_config;

-- Xoá các policy cũ đã tạo trước đó (nếu có)
DROP POLICY IF EXISTS "suppliers_select"       ON suppliers;
DROP POLICY IF EXISTS "suppliers_insert"       ON suppliers;
DROP POLICY IF EXISTS "suppliers_update"       ON suppliers;
DROP POLICY IF EXISTS "suppliers_delete"       ON suppliers;

DROP POLICY IF EXISTS "products_select"        ON products;
DROP POLICY IF EXISTS "products_insert"        ON products;
DROP POLICY IF EXISTS "products_update"        ON products;
DROP POLICY IF EXISTS "products_delete"        ON products;

DROP POLICY IF EXISTS "orders_select"          ON orders;
DROP POLICY IF EXISTS "orders_insert"          ON orders;
DROP POLICY IF EXISTS "orders_update"          ON orders;
DROP POLICY IF EXISTS "orders_delete"          ON orders;

DROP POLICY IF EXISTS "order_items_select"     ON order_items;
DROP POLICY IF EXISTS "order_items_insert"     ON order_items;
DROP POLICY IF EXISTS "order_items_update"     ON order_items;
DROP POLICY IF EXISTS "order_items_delete"     ON order_items;

DROP POLICY IF EXISTS "customers_select"       ON customers;
DROP POLICY IF EXISTS "customers_insert"       ON customers;
DROP POLICY IF EXISTS "customers_update"       ON customers;
DROP POLICY IF EXISTS "customers_delete"       ON customers;

DROP POLICY IF EXISTS "income_cats_select"     ON income_categories;
DROP POLICY IF EXISTS "income_cats_insert"     ON income_categories;
DROP POLICY IF EXISTS "income_cats_update"     ON income_categories;
DROP POLICY IF EXISTS "income_cats_delete"     ON income_categories;

DROP POLICY IF EXISTS "credit_cards_select"    ON credit_cards;
DROP POLICY IF EXISTS "credit_cards_insert"    ON credit_cards;
DROP POLICY IF EXISTS "credit_cards_update"    ON credit_cards;
DROP POLICY IF EXISTS "credit_cards_delete"    ON credit_cards;

DROP POLICY IF EXISTS "stocktakes_select"      ON stocktakes;
DROP POLICY IF EXISTS "stocktakes_insert"      ON stocktakes;
DROP POLICY IF EXISTS "stocktakes_update"      ON stocktakes;
DROP POLICY IF EXISTS "stocktakes_delete"      ON stocktakes;

DROP POLICY IF EXISTS "stocktake_items_select" ON stocktake_items;
DROP POLICY IF EXISTS "stocktake_items_insert" ON stocktake_items;
DROP POLICY IF EXISTS "stocktake_items_update" ON stocktake_items;

DROP POLICY IF EXISTS "cashbook_select"        ON cashbook_transactions;
DROP POLICY IF EXISTS "cashbook_insert"        ON cashbook_transactions;
DROP POLICY IF EXISTS "cashbook_update"        ON cashbook_transactions;
DROP POLICY IF EXISTS "cashbook_delete"        ON cashbook_transactions;

DROP POLICY IF EXISTS "reward_history_select"  ON reward_history;
DROP POLICY IF EXISTS "reward_history_insert"  ON reward_history;


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 4: BẬT RLS TRÊN TẤT CẢ BẢNG
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE assumptions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_data        ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards        ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktakes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktake_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashbook_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_history      ENABLE ROW LEVEL SECURITY;


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 5: TẠO POLICIES CHUẨN — auth.uid() = user_id
-- Nguyên tắc: mỗi user CHỈ thấy dữ liệu của CHÍNH HỌ
-- ════════════════════════════════════════════════════════════════════════════

-- ── HELPER FUNCTION: kiểm tra user_id qua bảng cha ─────────────────────────
-- Dùng cho order_items, stocktake_items, reward_history (không có user_id trực tiếp)

CREATE OR REPLACE FUNCTION auth_uid_owns_order(oid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders WHERE id = oid AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION auth_uid_owns_stocktake(sid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM stocktakes WHERE id = sid AND created_by = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION auth_uid_owns_customer(cid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers WHERE id = cid AND user_id = auth.uid()
  )
$$;


-- ── 5A. assumptions ──────────────────────────────────────────────────────────

CREATE POLICY "assumptions_select" ON assumptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "assumptions_insert" ON assumptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assumptions_update" ON assumptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assumptions_delete" ON assumptions
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5B. monthly_data ─────────────────────────────────────────────────────────

CREATE POLICY "monthly_data_select" ON monthly_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "monthly_data_insert" ON monthly_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "monthly_data_update" ON monthly_data
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "monthly_data_delete" ON monthly_data
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5C. portfolio_holdings ───────────────────────────────────────────────────

CREATE POLICY "holdings_select" ON portfolio_holdings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "holdings_insert" ON portfolio_holdings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "holdings_update" ON portfolio_holdings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "holdings_delete" ON portfolio_holdings
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5D. risk_config ──────────────────────────────────────────────────────────

CREATE POLICY "risk_config_select" ON risk_config
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "risk_config_insert" ON risk_config
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "risk_config_update" ON risk_config
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "risk_config_delete" ON risk_config
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5E. products ─────────────────────────────────────────────────────────────

CREATE POLICY "products_select" ON products
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "products_insert" ON products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "products_update" ON products
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "products_delete" ON products
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5F. orders ───────────────────────────────────────────────────────────────

CREATE POLICY "orders_select" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders_update" ON orders
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders_delete" ON orders
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5G. order_items — truy cập qua orders (không có user_id trực tiếp) ───────

CREATE POLICY "order_items_select" ON order_items
  FOR SELECT USING (auth_uid_owns_order(order_id));

CREATE POLICY "order_items_insert" ON order_items
  FOR INSERT WITH CHECK (auth_uid_owns_order(order_id));

CREATE POLICY "order_items_update" ON order_items
  FOR UPDATE USING (auth_uid_owns_order(order_id))
  WITH CHECK (auth_uid_owns_order(order_id));

CREATE POLICY "order_items_delete" ON order_items
  FOR DELETE USING (auth_uid_owns_order(order_id));


-- ── 5H. customers ────────────────────────────────────────────────────────────

CREATE POLICY "customers_select" ON customers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "customers_insert" ON customers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "customers_update" ON customers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "customers_delete" ON customers
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5I. suppliers ────────────────────────────────────────────────────────────

CREATE POLICY "suppliers_select" ON suppliers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "suppliers_insert" ON suppliers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "suppliers_update" ON suppliers
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "suppliers_delete" ON suppliers
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5J. income_categories ────────────────────────────────────────────────────

CREATE POLICY "income_cats_select" ON income_categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "income_cats_insert" ON income_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "income_cats_update" ON income_categories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "income_cats_delete" ON income_categories
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5K. credit_cards ─────────────────────────────────────────────────────────

CREATE POLICY "credit_cards_select" ON credit_cards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "credit_cards_insert" ON credit_cards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "credit_cards_update" ON credit_cards
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "credit_cards_delete" ON credit_cards
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5L. stocktakes ───────────────────────────────────────────────────────────

CREATE POLICY "stocktakes_select" ON stocktakes
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "stocktakes_insert" ON stocktakes
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "stocktakes_update" ON stocktakes
  FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);

CREATE POLICY "stocktakes_delete" ON stocktakes
  FOR DELETE USING (auth.uid() = created_by);


-- ── 5M. stocktake_items — truy cập qua stocktakes ────────────────────────────

CREATE POLICY "stocktake_items_select" ON stocktake_items
  FOR SELECT USING (auth_uid_owns_stocktake(stocktake_id));

CREATE POLICY "stocktake_items_insert" ON stocktake_items
  FOR INSERT WITH CHECK (auth_uid_owns_stocktake(stocktake_id));

CREATE POLICY "stocktake_items_update" ON stocktake_items
  FOR UPDATE USING (auth_uid_owns_stocktake(stocktake_id))
  WITH CHECK (auth_uid_owns_stocktake(stocktake_id));

CREATE POLICY "stocktake_items_delete" ON stocktake_items
  FOR DELETE USING (auth_uid_owns_stocktake(stocktake_id));


-- ── 5N. cashbook_transactions ────────────────────────────────────────────────

CREATE POLICY "cashbook_select" ON cashbook_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cashbook_insert" ON cashbook_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cashbook_update" ON cashbook_transactions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cashbook_delete" ON cashbook_transactions
  FOR DELETE USING (auth.uid() = user_id);


-- ── 5O. reward_history — truy cập qua customers ──────────────────────────────

CREATE POLICY "reward_history_select" ON reward_history
  FOR SELECT USING (auth_uid_owns_customer(customer_id));

CREATE POLICY "reward_history_insert" ON reward_history
  FOR INSERT WITH CHECK (auth_uid_owns_customer(customer_id));

CREATE POLICY "reward_history_delete" ON reward_history
  FOR DELETE USING (auth_uid_owns_customer(customer_id));


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 6: KIỂM TRA TỔNG QUAN — xem toàn bộ policies
-- ════════════════════════════════════════════════════════════════════════════

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual AS using_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 7: TEST ISOLATION — CHỨNG MINH User A ≠ User B
-- Chạy sau khi tạo 2 tài khoản test trong app
-- ════════════════════════════════════════════════════════════════════════════

-- Lấy danh sách users để test
SELECT id, email, created_at FROM auth.users ORDER BY created_at LIMIT 10;

-- Giả sử:
--   User A uid = 'aaaa-aaaa-...'
--   User B uid = 'bbbb-bbbb-...'

-- Test 1: Giả lập User A đọc products
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claims = '{"sub":"aaaa-aaaa-aaaa-aaaa","role":"authenticated"}';
SELECT id, user_id, name FROM products;
-- KẾT QUẢ: chỉ thấy products của User A

-- Test 2: Giả lập User B đọc cùng bảng
SET LOCAL request.jwt.claims = '{"sub":"bbbb-bbbb-bbbb-bbbb","role":"authenticated"}';
SELECT id, user_id, name FROM products;
-- KẾT QUẢ: chỉ thấy products của User B — KHÔNG thấy của User A ✅

-- Test 3: Kiểm tra bảng nào chưa bật RLS (NGUY HIỂM nếu có)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- KẾT QUẢ: tất cả cột rowsecurity phải = TRUE


-- ════════════════════════════════════════════════════════════════════════════
-- BLOCK 8: FORCE RLS cho Service Role (defense in depth)
-- Ngay cả service_role key cũng phải tuân theo RLS
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE products            FORCE ROW LEVEL SECURITY;
ALTER TABLE orders              FORCE ROW LEVEL SECURITY;
ALTER TABLE order_items         FORCE ROW LEVEL SECURITY;
ALTER TABLE customers           FORCE ROW LEVEL SECURITY;
ALTER TABLE suppliers           FORCE ROW LEVEL SECURITY;
ALTER TABLE assumptions         FORCE ROW LEVEL SECURITY;
ALTER TABLE monthly_data        FORCE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings  FORCE ROW LEVEL SECURITY;
ALTER TABLE risk_config         FORCE ROW LEVEL SECURITY;
ALTER TABLE cashbook_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE stocktakes          FORCE ROW LEVEL SECURITY;
ALTER TABLE stocktake_items     FORCE ROW LEVEL SECURITY;
ALTER TABLE income_categories   FORCE ROW LEVEL SECURITY;
ALTER TABLE credit_cards        FORCE ROW LEVEL SECURITY;
ALTER TABLE reward_history      FORCE ROW LEVEL SECURITY;
