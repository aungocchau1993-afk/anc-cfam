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
