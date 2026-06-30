-- Run this in Supabase SQL Editor
create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  type        text        not null default 'info',  -- 'order' | 'stock' | 'info'
  message     text        not null,
  is_read     boolean     not null default false,
  meta        jsonb,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "Authenticated users can manage notifications"
  on public.notifications for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Optional: auto-clean notifications older than 30 days
-- (run as a scheduled function or manually)
-- delete from notifications where created_at < now() - interval '30 days';
