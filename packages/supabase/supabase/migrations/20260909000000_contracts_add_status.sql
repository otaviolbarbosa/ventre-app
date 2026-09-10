-- 1. New column
ALTER TABLE public.contracts ADD COLUMN status text;

-- 2. Backfill from the current is_active tri-state
UPDATE public.contracts
SET status = CASE
  WHEN is_base_contract THEN NULL
  WHEN is_active = true THEN 'active'
  WHEN is_active = false THEN 'revoked'
END;

-- 3. Status is only meaningful for patient contracts, and only these 3 values
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check
  CHECK (
    (is_base_contract = true AND status IS NULL)
    OR (is_base_contract = false AND status IN ('draft', 'active', 'revoked'))
  );

-- 4. At most one live (draft or active) contract per patient
CREATE UNIQUE INDEX one_live_contract_per_patient
  ON public.contracts (patient_id)
  WHERE is_base_contract = false AND status IN ('draft', 'active');

COMMENT ON COLUMN public.contracts.status IS
  'Lifecycle of a patient contract: draft (professional still writing, no PDF, visible to patient for comments only), active (generated, may or may not be signed yet), revoked (soft-deleted or formally revoked — see revoked_at to tell the two apart). NULL only for base-contract templates (is_base_contract = true).';

-- 5. Drop the column it replaces
ALTER TABLE public.contracts DROP COLUMN is_active;
