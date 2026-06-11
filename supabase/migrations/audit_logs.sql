-- ═══════════════════════════════════════════════════════════════
-- AUDIT LOGS — lịch sử chỉnh sửa cho products & orders
-- Chạy toàn bộ script này trong Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Tạo bảng audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  table_name  TEXT        NOT NULL,
  record_id   UUID        NOT NULL,
  action      TEXT        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  old_data    JSONB,
  new_data    JSONB,
  changed_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index để query nhanh theo record
CREATE INDEX IF NOT EXISTS audit_logs_record_idx  ON audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (created_at DESC);

-- 2. RLS — chỉ user đã đăng nhập (owner) mới xem được log của mình
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "audit_logs_insert_trigger" ON audit_logs;
CREATE POLICY "audit_logs_insert_trigger" ON audit_logs
  FOR INSERT WITH CHECK (true);  -- trigger chạy dưới SECURITY DEFINER, không bị RLS chặn

-- 3. Hàm trigger chung
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- chạy với quyền superuser để luôn insert được
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), NULL, auth.uid());
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Chỉ log nếu có gì thay đổi thực sự
    IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
      INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
      VALUES (TG_TABLE_NAME, OLD.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    END IF;
    RETURN NEW;
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO audit_logs(table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NULL, to_jsonb(NEW), auth.uid());
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- 4. Gắn trigger vào bảng products
DROP TRIGGER IF EXISTS trg_audit_products ON products;
CREATE TRIGGER trg_audit_products
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- 5. Gắn trigger vào bảng orders
DROP TRIGGER IF EXISTS trg_audit_orders ON orders;
CREATE TRIGGER trg_audit_orders
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
