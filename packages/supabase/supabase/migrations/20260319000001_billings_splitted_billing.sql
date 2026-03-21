-- ============================================================
-- billings: add splitted_billing, populate from professional_id,
-- drop professional_id FK, index and column.
-- ============================================================

-- 1. Add splitted_billing column
ALTER TABLE public.billings
  ADD COLUMN splitted_billing jsonb NOT NULL DEFAULT '{}';

-- 2. Populate from existing professional_id + total_amount
--    Result format: { "<professional_id>": <total_amount> }
UPDATE public.billings
SET splitted_billing = jsonb_build_object(professional_id::text, total_amount);

-- 3. Drop RLS policies that reference professional_id
DROP POLICY IF EXISTS "Professional can update own billings" ON public.billings;
DROP POLICY IF EXISTS "Professional can delete own billings" ON public.billings;

-- 4. Drop index on professional_id
DROP INDEX IF EXISTS idx_billings_professional_id;

-- 5. Drop FK constraint and column
ALTER TABLE public.billings
  DROP CONSTRAINT billings_professional_id_fkey,
  DROP COLUMN professional_id;

-- 6. New policies using splitted_billing
--    A professional can update/delete only if she is the sole entry in splitted_billing.
CREATE POLICY "Professional can update own sole billings"
  ON public.billings
  FOR UPDATE
  USING (
    (SELECT count(*) FROM jsonb_object_keys(splitted_billing)) = 1
    AND splitted_billing ? auth.uid()::text
  )
  WITH CHECK (
    (SELECT count(*) FROM jsonb_object_keys(splitted_billing)) = 1
    AND splitted_billing ? auth.uid()::text
  );

CREATE POLICY "Professional can delete own sole billings"
  ON public.billings
  FOR DELETE
  USING (
    (SELECT count(*) FROM jsonb_object_keys(splitted_billing)) = 1
    AND splitted_billing ? auth.uid()::text
  );
