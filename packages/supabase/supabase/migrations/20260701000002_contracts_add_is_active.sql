-- Soft-delete flag for patient contracts (is_base_contract = false).
-- NULL means "not applicable" (base contract templates).
-- true  = contract is active and visible.
-- false = contract was logically deleted by the professional.
ALTER TABLE public.contracts
  ADD COLUMN is_active boolean;

-- Mark all existing patient contracts as active so they remain visible.
UPDATE public.contracts
SET is_active = true
WHERE is_base_contract = false;
