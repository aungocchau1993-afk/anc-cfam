-- Bật Realtime cho các bảng cần thiết
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.orders       REPLICA IDENTITY FULL;
ALTER TABLE public.products     REPLICA IDENTITY FULL;

-- Thêm vào publication của Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
