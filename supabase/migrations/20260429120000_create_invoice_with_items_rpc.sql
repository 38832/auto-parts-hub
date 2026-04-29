-- RPC used by billing flow in some deployed clients.
-- Keeps compatibility with clients calling /rest/v1/rpc/create_invoice_with_items.

CREATE OR REPLACE FUNCTION public.create_invoice_with_items(
  p_customer_id uuid DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_customer_gstin text DEFAULT NULL,
  p_subtotal numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_gst_amount numeric DEFAULT 0,
  p_total numeric DEFAULT 0,
  p_paid_amount numeric DEFAULT 0,
  p_credit_amount numeric DEFAULT 0,
  p_payment_mode public.payment_mode DEFAULT 'cash',
  p_notes text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.invoices;
  v_item jsonb;
BEGIN
  INSERT INTO public.invoices (
    customer_id, customer_name, customer_phone, customer_gstin,
    subtotal, discount, gst_amount, total,
    paid_amount, credit_amount, payment_mode, notes, created_by
  ) VALUES (
    p_customer_id, COALESCE(NULLIF(p_customer_name, ''), 'Walk-in'), p_customer_phone, p_customer_gstin,
    COALESCE(p_subtotal, 0), COALESCE(p_discount, 0), COALESCE(p_gst_amount, 0), COALESCE(p_total, 0),
    COALESCE(p_paid_amount, 0), COALESCE(p_credit_amount, 0), COALESCE(p_payment_mode, 'cash'), p_notes,
    auth.uid()
  )
  RETURNING * INTO v_invoice;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    INSERT INTO public.invoice_items (
      invoice_id, product_id, part_number, part_name,
      quantity, unit_price, gst_rate, line_total
    ) VALUES (
      v_invoice.id,
      NULLIF(v_item->>'product_id', '')::uuid,
      COALESCE(v_item->>'part_number', ''),
      COALESCE(v_item->>'part_name', ''),
      COALESCE((v_item->>'quantity')::int, 0),
      COALESCE((v_item->>'unit_price')::numeric, 0),
      COALESCE((v_item->>'gst_rate')::numeric, 0),
      COALESCE((v_item->>'line_total')::numeric, 0)
    );
  END LOOP;

  RETURN v_invoice;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_invoice_with_items(
  uuid, text, text, text, numeric, numeric, numeric, numeric, numeric, numeric, public.payment_mode, text, jsonb
) TO authenticated;
