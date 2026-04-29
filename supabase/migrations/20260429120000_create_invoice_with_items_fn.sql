CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
  p_customer_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_gstin text,
  p_subtotal numeric,
  p_discount numeric,
  p_gst_amount numeric,
  p_total numeric,
  p_paid_amount numeric,
  p_payment_mode public.payment_mode,
  p_notes text,
  p_items jsonb
)
RETURNS TABLE(invoice_id uuid, invoice_number text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_amount numeric(12,2);
  v_invoice_id uuid;
  v_invoice_number text;
  v_item jsonb;
  v_product_id uuid;
  v_quantity int;
  v_stock int;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Invoice must contain at least one item' USING ERRCODE = 'P0001';
  END IF;

  IF p_payment_mode = 'credit' AND p_customer_id IS NULL THEN
    RAISE EXCEPTION 'Credit invoices require a selected customer' USING ERRCODE = 'P0001';
  END IF;

  IF p_paid_amount < 0 OR p_total < 0 OR p_subtotal < 0 OR p_gst_amount < 0 OR p_discount < 0 THEN
    RAISE EXCEPTION 'Invoice totals cannot be negative' USING ERRCODE = 'P0001';
  END IF;

  IF p_paid_amount > p_total THEN
    RAISE EXCEPTION 'Paid amount cannot exceed invoice total' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    IF v_product_id IS NULL OR v_quantity IS NULL THEN
      RAISE EXCEPTION 'Each item must include product_id and quantity' USING ERRCODE = 'P0001';
    END IF;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Item quantity must be greater than zero' USING ERRCODE = 'P0001';
    END IF;

    SELECT stock_quantity
      INTO v_stock
      FROM public.products
     WHERE id = v_product_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % does not exist', v_product_id USING ERRCODE = 'P0001';
    END IF;

    IF v_stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product % (available %, requested %)', v_product_id, v_stock, v_quantity USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  v_credit_amount := GREATEST(0, p_total - p_paid_amount);

  INSERT INTO public.invoices (
    customer_id, customer_name, customer_phone, customer_gstin,
    subtotal, discount, gst_amount, total,
    paid_amount, credit_amount, payment_mode,
    notes, created_by
  ) VALUES (
    p_customer_id,
    COALESCE(NULLIF(trim(p_customer_name), ''), 'Walk-in'),
    NULLIF(trim(p_customer_phone), ''),
    NULLIF(trim(p_customer_gstin), ''),
    p_subtotal, p_discount, p_gst_amount, p_total,
    p_paid_amount, v_credit_amount, p_payment_mode,
    NULLIF(trim(p_notes), ''), auth.uid()
  )
  RETURNING id, invoice_number INTO v_invoice_id, v_invoice_number;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    INSERT INTO public.invoice_items (
      invoice_id, product_id, part_number, part_name,
      quantity, unit_price, gst_rate, line_total
    ) VALUES (
      v_invoice_id,
      v_product_id,
      v_item->>'part_number',
      v_item->>'part_name',
      v_quantity,
      (v_item->>'unit_price')::numeric,
      (v_item->>'gst_rate')::numeric,
      (v_item->>'line_total')::numeric
    );

    UPDATE public.products
       SET stock_quantity = stock_quantity - v_quantity,
           updated_at = now()
     WHERE id = v_product_id;

    INSERT INTO public.stock_movements (
      product_id, movement_type, quantity,
      reference_type, reference_id, created_by
    ) VALUES (
      v_product_id, 'out', v_quantity,
      'invoice', v_invoice_id, auth.uid()
    );
  END LOOP;

  IF p_payment_mode = 'credit' AND v_credit_amount > 0 THEN
    UPDATE public.customers
       SET credit_balance = credit_balance + v_credit_amount,
           updated_at = now()
     WHERE id = p_customer_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected customer does not exist' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN QUERY SELECT v_invoice_id, v_invoice_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invoice_with_items(
  uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, public.payment_mode, text, jsonb
) TO authenticated;
