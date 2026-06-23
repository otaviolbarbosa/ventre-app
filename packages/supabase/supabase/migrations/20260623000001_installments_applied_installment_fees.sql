-- Add applied_installment_fees snapshot column to installments, mirroring
-- billings.applied_billing_fees but scoped to each installment's own
-- splitted_installment amounts.
ALTER TABLE public.installments
  ADD COLUMN applied_installment_fees jsonb NOT NULL DEFAULT '[]';

COMMENT ON COLUMN public.installments.applied_installment_fees IS
  'Snapshot of billing fees prorated to this installment. Shape: [{ professional_id, fee_id, name, fee_type, value, base_amount_cents, computed_amount_cents }]. base_amount_cents comes from splitted_installment; computed_amount_cents is the matching billings.applied_billing_fees entry prorated by (installment.amount / billing.total_amount).';

-- Backfill installments belonging to billings that already have fees applied.
WITH installment_fees AS (
  SELECT
    i.id AS installment_id,
    jsonb_agg(
      jsonb_build_object(
        'professional_id', elem->>'professional_id',
        'fee_id', elem->>'fee_id',
        'name', elem->>'name',
        'fee_type', elem->>'fee_type',
        'value', (elem->>'value')::numeric,
        'base_amount_cents', base_cents,
        'computed_amount_cents',
          COALESCE(
            LEAST(
              ROUND(
                (elem->>'computed_amount_cents')::numeric
                * (i.amount::numeric / NULLIF(b.total_amount, 0))
              ),
              base_cents
            ),
            0
          )
      )
    ) AS fees
  FROM public.installments i
  JOIN public.billings b ON b.id = i.billing_id
  CROSS JOIN LATERAL jsonb_array_elements(b.applied_billing_fees) AS elem
  CROSS JOIN LATERAL (
    SELECT (i.splitted_installment->>(elem->>'professional_id'))::bigint AS base_cents
  ) bc
  WHERE jsonb_array_length(b.applied_billing_fees) > 0
    AND i.splitted_installment ? (elem->>'professional_id')
  GROUP BY i.id
)
UPDATE public.installments i
SET applied_installment_fees = installment_fees.fees
FROM installment_fees
WHERE installment_fees.installment_id = i.id;
