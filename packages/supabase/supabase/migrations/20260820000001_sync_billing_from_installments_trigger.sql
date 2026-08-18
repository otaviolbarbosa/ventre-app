-- Keep billings.paid_amount / billings.status in sync with their installments
-- automatically, instead of relying on every write path (professional direct
-- payment route, patient payment confirmation action, ...) to recompute and
-- persist it manually. Mirrors the aggregation previously duplicated in
-- app/api/installments/[id]/payments/route.ts.
CREATE OR REPLACE FUNCTION public.sync_billing_from_installments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_billing_id uuid;
  v_paid_amount bigint;
  v_status public.billing_status;
BEGIN
  v_billing_id := NEW.billing_id;

  -- Serialize concurrent installment updates for the same billing.
  PERFORM 1 FROM public.billings WHERE id = v_billing_id FOR NO KEY UPDATE;

  SELECT
    COALESCE(SUM(paid_amount), 0),
    CASE
      WHEN bool_and(status = 'pago') THEN 'pago'::public.billing_status
      WHEN bool_and(status = 'cancelado') THEN 'cancelado'::public.billing_status
      WHEN bool_or(status = 'atrasado') THEN 'atrasado'::public.billing_status
      ELSE 'pendente'::public.billing_status
    END
  INTO v_paid_amount, v_status
  FROM public.installments
  WHERE billing_id = v_billing_id;

  UPDATE public.billings
  SET paid_amount = v_paid_amount, status = v_status
  WHERE id = v_billing_id
    AND (paid_amount IS DISTINCT FROM v_paid_amount OR status IS DISTINCT FROM v_status);

  RETURN NEW;
END;
$$;

CREATE TRIGGER installments_sync_billing
  AFTER INSERT OR UPDATE OF status, paid_amount ON public.installments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_billing_from_installments();
