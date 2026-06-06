-- ============================================================
-- RLS Policies tạm thời cho role anon (chưa có Authentication)
-- Cho phép SELECT, INSERT, UPDATE, DELETE công khai
-- Chạy file này trong Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- ── Bảng: assumptions ────────────────────────────────────────
ALTER TABLE assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_assumptions"  ON assumptions FOR SELECT USING (true);
CREATE POLICY "anon_insert_assumptions"  ON assumptions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_assumptions"  ON assumptions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_assumptions"  ON assumptions FOR DELETE USING (true);

-- ── Bảng: monthly_data ───────────────────────────────────────
ALTER TABLE monthly_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_monthly"  ON monthly_data FOR SELECT USING (true);
CREATE POLICY "anon_insert_monthly"  ON monthly_data FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_monthly"  ON monthly_data FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_monthly"  ON monthly_data FOR DELETE USING (true);

-- ── Bảng: portfolio_holdings ─────────────────────────────────
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_holdings"  ON portfolio_holdings FOR SELECT USING (true);
CREATE POLICY "anon_insert_holdings"  ON portfolio_holdings FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_holdings"  ON portfolio_holdings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_holdings"  ON portfolio_holdings FOR DELETE USING (true);

-- ── Bảng: risk_config ────────────────────────────────────────
ALTER TABLE risk_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_risk"  ON risk_config FOR SELECT USING (true);
CREATE POLICY "anon_insert_risk"  ON risk_config FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_risk"  ON risk_config FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anon_delete_risk"  ON risk_config FOR DELETE USING (true);

-- ── Bảng: suppliers ──────────────────────────────────────────
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_select" ON suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "suppliers_insert" ON suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suppliers_update" ON suppliers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "suppliers_delete" ON suppliers FOR DELETE USING (auth.uid() = user_id);

-- ── Bảng: products ───────────────────────────────────────────
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_select" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_update" ON products FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "products_delete" ON products FOR DELETE USING (auth.uid() = user_id);

-- ── Bảng: orders ─────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders_select" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (auth.uid() = user_id);

-- ── Bảng: order_items ────────────────────────────────────────
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items_select" ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));
CREATE POLICY "order_items_insert" ON order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));
CREATE POLICY "order_items_update" ON order_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));
CREATE POLICY "order_items_delete" ON order_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_id AND orders.user_id = auth.uid()));

-- ── Bảng: customers ──────────────────────────────────────────
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "customers_insert" ON customers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customers_update" ON customers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "customers_delete" ON customers FOR DELETE USING (auth.uid() = user_id);

-- ── Bảng: income_categories ──────────────────────────────────
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_cats_select" ON income_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "income_cats_insert" ON income_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "income_cats_update" ON income_categories FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "income_cats_delete" ON income_categories FOR DELETE USING (auth.uid() = user_id);

-- ── Bảng: credit_cards ───────────────────────────────────────
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_cards_select" ON credit_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "credit_cards_insert" ON credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credit_cards_update" ON credit_cards FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credit_cards_delete" ON credit_cards FOR DELETE USING (auth.uid() = user_id);

-- ── Bảng: stocktakes ─────────────────────────────────────────
ALTER TABLE stocktakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stocktakes_select" ON stocktakes FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "stocktakes_insert" ON stocktakes FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "stocktakes_update" ON stocktakes FOR UPDATE USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "stocktakes_delete" ON stocktakes FOR DELETE USING (auth.uid() = created_by);

-- ── Bảng: stocktake_items ────────────────────────────────────
ALTER TABLE stocktake_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stocktake_items_select" ON stocktake_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM stocktakes WHERE stocktakes.id = stocktake_id AND stocktakes.created_by = auth.uid()));
CREATE POLICY "stocktake_items_insert" ON stocktake_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM stocktakes WHERE stocktakes.id = stocktake_id AND stocktakes.created_by = auth.uid()));
CREATE POLICY "stocktake_items_update" ON stocktake_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM stocktakes WHERE stocktakes.id = stocktake_id AND stocktakes.created_by = auth.uid()));

-- ── Bảng: cashbook_transactions ──────────────────────────────
ALTER TABLE cashbook_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cashbook_select" ON cashbook_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cashbook_insert" ON cashbook_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cashbook_update" ON cashbook_transactions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cashbook_delete" ON cashbook_transactions FOR DELETE USING (auth.uid() = user_id);

-- ── Bảng: reward_history ─────────────────────────────────────
ALTER TABLE reward_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reward_history_select" ON reward_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM customers WHERE customers.id = customer_id AND customers.user_id = auth.uid()));
CREATE POLICY "reward_history_insert" ON reward_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM customers WHERE customers.id = customer_id AND customers.user_id = auth.uid()));
