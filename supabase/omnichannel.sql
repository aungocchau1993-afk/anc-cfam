-- ═══════════════════════════════════════════════════════════════
-- OMNICHANNEL FOUNDATION — Chạy trong Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- 1. Bảng kênh bán hàng (thêm kênh mới chỉ cần INSERT 1 row)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.channels (
  id          text primary key,           -- 'POS' | 'SHOPEE' | 'LAZADA' | 'TIKTOK' | 'WEBSITE'
  name        text        not null,
  icon        text        default '🏪',
  color       text        default '#3fb950',
  is_active   boolean     not null default true,
  api_config  jsonb       not null default '{}', -- lưu api_key, shop_id, etc.
  created_at  timestamptz not null default now()
);

alter table public.channels enable row level security;
create policy "Authenticated manage channels" on public.channels
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Seed dữ liệu kênh ban đầu
insert into public.channels (id, name, icon, color) values
  ('POS',     'Bán tại quầy',  '🏪', '#3fb950'),
  ('SHOPEE',  'Shopee',        '🛒', '#f85149'),
  ('LAZADA',  'Lazada',        '📦', '#bc8cff'),
  ('TIKTOK',  'TikTok Shop',   '🎵', '#58a6ff'),
  ('WEBSITE', 'Website riêng', '🌐', '#e3b341')
on conflict (id) do nothing;


-- 2. Mở rộng bảng orders — thêm kênh & mã đơn ngoài
-- ─────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists channel_id          text references public.channels(id) default 'POS',
  add column if not exists external_order_id   text,   -- mã đơn trên sàn
  add column if not exists channel_status      text,   -- trạng thái trên sàn
  add column if not exists shipping_carrier    text,   -- đơn vị giao hàng
  add column if not exists tracking_number     text;   -- mã vận đơn

create index if not exists orders_channel_id_idx on public.orders (channel_id);
create index if not exists orders_created_at_idx on public.orders (created_at desc);


-- 3. Tồn kho theo kênh (channel_inventory)
--    total stock vẫn ở products.stock_quantity
--    bảng này lưu qty được phân bổ / đang giữ cho từng kênh
-- ─────────────────────────────────────────────────────────────
create table if not exists public.channel_inventory (
  id           uuid        primary key default gen_random_uuid(),
  product_id   uuid        not null references public.products(id) on delete cascade,
  channel_id   text        not null references public.channels(id),
  listed_qty   int         not null default 0,   -- số lượng đang list trên kênh
  reserved_qty int         not null default 0,   -- đang chờ xử lý / giữ
  updated_at   timestamptz not null default now(),
  unique (product_id, channel_id)
);

alter table public.channel_inventory enable row level security;
create policy "Authenticated manage channel_inventory" on public.channel_inventory
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table public.channel_inventory replica identity full;
alter publication supabase_realtime add table public.channel_inventory;


-- 4. Mapping SKU sàn ↔ SKU nội bộ
--    Thêm kênh mới chỉ cần thêm rows, không đổi schema
-- ─────────────────────────────────────────────────────────────
create table if not exists public.channel_sku_mappings (
  id                  uuid        primary key default gen_random_uuid(),
  product_id          uuid        not null references public.products(id) on delete cascade,
  channel_id          text        not null references public.channels(id),
  platform_sku        text        not null,     -- SKU trên sàn
  platform_product_id text,                     -- ID sản phẩm trên sàn
  platform_name       text,                     -- Tên hiển thị trên sàn
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (channel_id, platform_sku)
);

alter table public.channel_sku_mappings enable row level security;
create policy "Authenticated manage sku_mappings" on public.channel_sku_mappings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');


-- 5. Lịch sử đồng bộ (sync logs)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.channel_sync_logs (
  id            uuid        primary key default gen_random_uuid(),
  channel_id    text        references public.channels(id),
  sync_type     text        not null,   -- 'inventory' | 'price' | 'orders'
  status        text        not null,   -- 'success' | 'error' | 'partial'
  synced_count  int         default 0,
  message       text,
  created_at    timestamptz not null default now()
);

alter table public.channel_sync_logs enable row level security;
create policy "Authenticated manage sync_logs" on public.channel_sync_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');


-- 6. RPC: Atomic stock deduction khi bán (đảm bảo không bán âm)
-- ─────────────────────────────────────────────────────────────
create or replace function public.deduct_stock_atomic(
  p_items jsonb   -- [{ product_id, qty }]
)
returns void
language plpgsql
as $$
declare
  item jsonb;
  current_qty int;
begin
  for item in select * from jsonb_array_elements(p_items)
  loop
    select stock_quantity into current_qty
    from public.products
    where id = (item->>'product_id')::uuid
    for update;  -- row-level lock

    if current_qty < (item->>'qty')::int then
      raise exception 'Không đủ tồn kho cho sản phẩm %', item->>'product_id';
    end if;

    update public.products
    set stock_quantity = stock_quantity - (item->>'qty')::int,
        updated_at     = now()
    where id = (item->>'product_id')::uuid;
  end loop;
end;
$$;
