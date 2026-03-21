-- ============================================================
-- billings: make installment_interval and first_due_date
-- nullable; add installments_dates date array.
-- ============================================================

-- 1. Drop NOT NULL constraints
ALTER TABLE public.billings
  ALTER COLUMN installment_interval DROP NOT NULL,
  ALTER COLUMN installment_interval SET DEFAULT NULL;

-- first_due_date is not a column on billings (it lives only in the
-- insert flow / validations), so no change needed for it in DB.
-- installments_dates stores the resolved due dates per installment.

-- 2. Add installments_dates
ALTER TABLE public.billings
  ADD COLUMN installments_dates date[];
