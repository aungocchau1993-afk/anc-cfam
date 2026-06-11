-- ================================================================
-- HRM Module Schema — chạy trong Supabase SQL Editor
-- Tạo: staff, attendance, advances, salary_records + RPC tính lương
-- ================================================================

-- ── 1. Bảng nhân viên ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  phone           text,
  position        text,                         -- chức vụ / vị trí
  base_salary     numeric(12,0) NOT NULL DEFAULT 0,
  commission_rate numeric(6,4)  NOT NULL DEFAULT 0, -- 0.05 = 5%
  is_active       boolean     NOT NULL DEFAULT true,
  joined_at       date        DEFAULT CURRENT_DATE,
  created_at      timestamptz DEFAULT now()
);

-- ── 2. Bảng chấm công ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_date     date        NOT NULL DEFAULT CURRENT_DATE,
  check_in      timestamptz,
  check_out     timestamptz,
  check_in_lat  numeric(10,7),
  check_in_lng  numeric(10,7),
  note          text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(staff_id, work_date)
);

-- ── 3. Bảng ứng tiền ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advances (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  amount      numeric(12,0) NOT NULL CHECK (amount > 0),
  reason      text,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected')),
  approved_at timestamptz,
  created_at  timestamptz DEFAULT now()
);

-- ── 4. Bảng bảng lương ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS salary_records (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id          uuid          NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  month             text          NOT NULL,   -- format: 'YYYY-MM'
  base_salary       numeric(12,0) DEFAULT 0,
  commission_amount numeric(12,0) DEFAULT 0,
  advance_deduction numeric(12,0) DEFAULT 0,
  bonus             numeric(12,0) DEFAULT 0,
  total_salary      numeric(12,0) DEFAULT 0,  -- tính thủ công khi upsert
  paid_amount       numeric(12,0) DEFAULT 0,
  status            text          DEFAULT 'draft'
                                  CHECK (status IN ('draft','confirmed','paid')),
  note              text,
  created_at        timestamptz   DEFAULT now(),
  UNIQUE(staff_id, month)
);

-- ── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance(staff_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_advances_status       ON advances(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_salary_month          ON salary_records(month DESC, staff_id);

-- ── RLS ─────────────────────────────────────────────────────────
ALTER TABLE staff          ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE advances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records ENABLE ROW LEVEL SECURITY;

-- Authenticated users có toàn quyền (admin app)
DROP POLICY IF EXISTS "hrm_staff_all"    ON staff;
DROP POLICY IF EXISTS "hrm_attend_all"   ON attendance;
DROP POLICY IF EXISTS "hrm_advance_all"  ON advances;
DROP POLICY IF EXISTS "hrm_salary_all"   ON salary_records;

CREATE POLICY "hrm_staff_all"    ON staff          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hrm_attend_all"   ON attendance     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hrm_advance_all"  ON advances       FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "hrm_salary_all"   ON salary_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── RPC: Tính lương tháng cho một nhân viên ─────────────────────
-- Công thức: Lương cứng + (Doanh thu tháng × commission_rate) - Tổng ứng tháng
CREATE OR REPLACE FUNCTION calculate_monthly_salary(p_staff_id uuid, p_month text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff          record;
  v_total_orders   numeric := 0;
  v_commission     numeric := 0;
  v_advance_deduct numeric := 0;
BEGIN
  SELECT * INTO v_staff FROM staff WHERE id = p_staff_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Nhân viên không tồn tại');
  END IF;

  -- Doanh thu đơn hàng trong tháng (từ bảng orders hiện có)
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_orders
  FROM orders
  WHERE to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') = p_month;

  v_commission := FLOOR(v_total_orders * v_staff.commission_rate);

  -- Tổng tiền đã ứng (đã duyệt) trong tháng
  SELECT COALESCE(SUM(amount), 0)
  INTO v_advance_deduct
  FROM advances
  WHERE staff_id = p_staff_id
    AND status   = 'approved'
    AND to_char(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') = p_month;

  RETURN jsonb_build_object(
    'staff_id',          p_staff_id,
    'staff_name',        v_staff.name,
    'position',          v_staff.position,
    'month',             p_month,
    'base_salary',       v_staff.base_salary,
    'commission_rate',   v_staff.commission_rate,
    'total_orders',      v_total_orders,
    'commission',        v_commission,
    'advance_deduction', v_advance_deduct,
    'total_salary',      GREATEST(0, v_staff.base_salary + v_commission - v_advance_deduct)
  );
END;
$$;
