-- Make patient_id nullable so an address can belong to a user directly (without a patient)
ALTER TABLE public.addresses
  ALTER COLUMN patient_id DROP NOT NULL;

-- Enforce One-to-One: one user → one address (partial index allows multiple NULLs)
CREATE UNIQUE INDEX addresses_user_id_unique
  ON public.addresses (user_id)
  WHERE user_id IS NOT NULL;

-- The existing CONSTRAINT addresses_patient_id_unique UNIQUE (patient_id) already
-- enforces One-to-One for patients; PostgreSQL treats NULLs as distinct in UNIQUE
-- constraints, so making patient_id nullable does not break it.
