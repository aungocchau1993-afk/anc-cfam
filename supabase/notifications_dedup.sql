-- Run in Supabase SQL Editor
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedup_key text;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedup_key ON public.notifications (dedup_key) WHERE dedup_key IS NOT NULL;
