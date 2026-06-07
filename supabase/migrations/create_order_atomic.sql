-- ═══════════════════════════════════════════════════════════════════════════
-- ATOMIC ORDER TRANSACTION — chạy toàn bộ trong 1 giao dịch PostgreSQL
-- Nếu bất kỳ bước nào lỗi → rollback toàn bộ, không trừ kho nửa chừng
--
-- Cách dùng:
--   SELECT * FROM create_order_atomic('{...}'::jsonb);
--
-- Input JSON:
-- {
--   "user_id":     "uuid",
--   "customer_id": "uuid|null",
--   "items": [
--     { "product_id": "uuid", "quantity": 2, "price": 50000, "cost": 30000 }
--   ],
--   "total_amount": 100000,
--   "paid_amount":  80000,
--   "debt_amount":  20000,
--   "profit":       40000,
--   "note":         "ghi chú"
-- }
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION create_order_atomic(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_id      uuid;
  v_order_code    text;
  v_item          jsonb;
  v_product_id    uuid;
  v_qty_ordered   int;
  v_stock_current int;
  v_product_name  text;
  v_result        jsonb;
BEGIN

  -- ── Bước 1: Kiểm tra tồn kho từng sản phẩm ────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_product_id  := (v_item->>'product_id')::uuid;
    v_qty_ordered := (v_item->>'quantity')::int;

    SELECT stock_quantity, name
      INTO v_stock_current, v_product_name
      FROM products
      WHERE id = v_product_id
      FOR UPDATE;  -- Lock row để tránh race condition

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sản phẩm ID % không tồn tại', v_product_id
        USING ERRCODE = 'P0001';
    END IF;

    IF v_stock_current < v_qty_ordered THEN
      RAISE EXCEPTION 'Sản phẩm "%" không đủ tồn kho (còn %, cần %)',
        v_product_name, v_stock_current, v_qty_ordered
        USING ERRCODE = 'P0002';
    END IF;
  END LOOP;

  -- ── Bước 2: Trừ tồn kho (sau khi đã verify đủ hàng) ──────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_product_id  := (v_item->>'product_id')::uuid;
    v_qty_ordered := (v_item->>'quantity')::int;

    UPDATE products
      SET stock_quantity = stock_quantity - v_qty_ordered,
          updated_at     = now()
      WHERE id = v_product_id;
  END LOOP;

  -- ── Bước 3: Tạo đơn hàng ─────────────────────────────────────────────
  -- Sinh order_code tự động nếu cột tồn tại
  BEGIN
    SELECT 'DH' || TO_CHAR(now(), 'YYMMDD') ||
           LPAD(( SELECT COUNT(*) + 1 FROM orders
                  WHERE created_at::date = CURRENT_DATE )::text, 4, '0')
      INTO v_order_code;
  EXCEPTION WHEN OTHERS THEN
    v_order_code := NULL;
  END;

  INSERT INTO orders (
    user_id, customer_id, total_amount, paid_amount, debt_amount,
    profit, note, status, order_code
  )
  VALUES (
    (payload->>'user_id')::uuid,
    NULLIF(payload->>'customer_id', 'null')::uuid,
    (payload->>'total_amount')::numeric,
    (payload->>'paid_amount')::numeric,
    (payload->>'debt_amount')::numeric,
    (payload->>'profit')::numeric,
    payload->>'note',
    'completed',
    v_order_code
  )
  RETURNING id INTO v_order_id;

  -- ── Bước 4: Thêm order_items ─────────────────────────────────────────
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    INSERT INTO order_items (order_id, product_id, quantity, price, cost)
    VALUES (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'price')::numeric,
      (v_item->>'cost')::numeric
    );
  END LOOP;

  -- ── Bước 5: Cập nhật công nợ khách hàng ──────────────────────────────
  IF (payload->>'customer_id') IS NOT NULL
     AND (payload->>'customer_id') != 'null'
     AND (payload->>'debt_amount')::numeric > 0
  THEN
    UPDATE customers
      SET current_debt = COALESCE(current_debt, 0) + (payload->>'debt_amount')::numeric,
          updated_at   = now()
      WHERE id = (payload->>'customer_id')::uuid;
  END IF;

  -- ── Trả về kết quả ───────────────────────────────────────────────────
  SELECT row_to_json(o)::jsonb INTO v_result
    FROM (
      SELECT id, order_code, total_amount, paid_amount, debt_amount,
             profit, note, status, created_at, customer_id, user_id
        FROM orders WHERE id = v_order_id
    ) o;

  RETURN v_result || jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    -- Bất kỳ lỗi nào → PostgreSQL tự rollback toàn bộ transaction
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;

-- Grant quyền cho anon và authenticated
GRANT EXECUTE ON FUNCTION create_order_atomic(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION create_order_atomic(jsonb) TO anon;
