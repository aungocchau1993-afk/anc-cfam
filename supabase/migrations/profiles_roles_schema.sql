-- ═══════════════════════════════════════════════════════════════════════════
-- SPRINT 1 — Nền tảng User & Role (tách Authentication / Authorization)
--
-- Supabase Auth (auth.users) CHỈ dùng để đăng nhập. Role/Profile được quản lý
-- riêng trong 2 bảng public.profiles / public.roles bên dưới.
--
-- PHẠM VI SPRINT 1 — chỉ tạo bảng + seed dữ liệu:
--   ❌ KHÔNG bật Row Level Security (RLS) trên profiles/roles
--   ❌ KHÔNG tạo Permission/Policy
--   ❌ KHÔNG thêm Middleware
--   ❌ KHÔNG sửa auth.users (không thêm cột, không thêm trigger lên auth.users)
-- → Các mục trên để dành cho sprint sau.
--
-- ⚠ TRƯỚC KHI LÊN PRODUCTION: bắt buộc phải bật RLS + policy phù hợp cho
--   profiles/roles, vì hiện tại bất kỳ ai có anon/authenticated key đều đọc/ghi
--   được 2 bảng này (kể cả email người dùng qua view user_profiles bên dưới).
--
-- Chạy 1 lần trong Supabase Dashboard → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────
-- 1. roles — danh sách vai trò hệ thống (đọc từ DB, KHÔNG hardcode trong React)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,       -- 'SUPER_ADMIN', 'OWNER', ...
  name        TEXT NOT NULL,              -- Tên hiển thị tiếng Việt
  description TEXT,
  is_system   BOOLEAN DEFAULT true,       -- role dựng sẵn, không cho xoá ở UI
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (code, name, description, is_system) VALUES
  ('SUPER_ADMIN', 'Super Admin',        'Toàn quyền hệ thống',                       true),
  ('OWNER',       'Chủ cửa hàng',       'Chủ sở hữu doanh nghiệp',                   true),
  ('MANAGER',     'Quản lý',            'Quản lý vận hành cửa hàng',                 true),
  ('CASHIER',     'Thu ngân',           'Bán hàng tại quầy (POS)',                   true),
  ('WAREHOUSE',   'Thủ kho',            'Quản lý kho, kiểm kho',                     true),
  ('SALE',        'Nhân viên bán hàng', 'Kinh doanh, chăm sóc khách hàng',           true),
  ('ACCOUNTANT',  'Kế toán',            'Sổ quỹ, báo cáo tài chính',                 true),
  ('DEVELOPER',   'Developer',          'Kỹ thuật / vận hành hệ thống',              true)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. profiles — hồ sơ nghiệp vụ của user, tách khỏi auth.users
--    auth_user_id liên kết auth.users.id (1 auth user = 1 profile)
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name    TEXT,
  phone        TEXT,
  avatar_url   TEXT,
  -- Chưa có bảng branches ở Sprint 1 (không nằm trong phạm vi yêu cầu) — để
  -- UUID trần, không FK, sẵn sàng gắn REFERENCES branches(id) ở sprint sau.
  branch_id    UUID,
  role_id      UUID REFERENCES public.roles(id) ON DELETE SET NULL,
  status       TEXT DEFAULT 'active',    -- 'active' | 'inactive'
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profiles_auth_user_id_idx ON public.profiles (auth_user_id);
CREATE INDEX IF NOT EXISTS profiles_role_id_idx       ON public.profiles (role_id);

-- Tự cập nhật updated_at mỗi khi sửa profile
CREATE OR REPLACE FUNCTION public.set_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_profiles_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- 3. user_profiles — VIEW read-only ghép profiles + roles + email từ
--    auth.users, phục vụ trang User Management. CHỈ ĐỌC — không sửa/thêm cột
--    vào auth.users, đúng ràng buộc "giữ nguyên auth.users".
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.user_profiles AS
SELECT
  p.id,
  p.auth_user_id,
  u.email,
  p.full_name,
  p.phone,
  p.avatar_url,
  p.branch_id,
  p.role_id,
  r.code        AS role_code,
  r.name        AS role_name,
  p.status,
  p.created_at,
  p.updated_at
FROM public.profiles p
JOIN auth.users u   ON u.id = p.auth_user_id
LEFT JOIN public.roles r ON r.id = p.role_id;
