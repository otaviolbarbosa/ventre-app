-- ============================================================
-- installments: add splitted_installment, populate proportionally
-- from billings.splitted_billing.
--
-- Format: { "<professional_id>": <installment_professional_amount> }
-- Each professional's share = ROUND(installment.amount * (splitted_billing[prof] / billing.total_amount))
-- ============================================================

-- 1. Add splitted_installment column
ALTER TABLE public.installments
  ADD COLUMN splitted_installment jsonb NOT NULL DEFAULT '{}';

-- 2. Populate from billings.splitted_billing proportionally
--    For each installment, iterate over the billing's splitted_billing entries
--    and assign each professional their proportional share of the installment amount.
--    NULLIF(b.total_amount, 0) guards against division by zero.
UPDATE public.installments i
SET splitted_installment = (
  SELECT jsonb_object_agg(
    kv.key,
    ROUND((kv.value::numeric / NULLIF(b.total_amount, 0)) * i.amount)::bigint
  )
  FROM public.billings b
  JOIN LATERAL jsonb_each_text(b.splitted_billing) AS kv ON true
  WHERE b.id = i.billing_id
);
