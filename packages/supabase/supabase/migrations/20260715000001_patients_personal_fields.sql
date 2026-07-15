-- ============================================================
-- Patients: Personal Fields
-- Adds identification/civil status fields to the patients table:
-- rg, cpf, marital_status, occupation.
-- Used to populate the "contratante" block of generated contracts.
-- ============================================================

ALTER TABLE public.patients
  ADD COLUMN rg              text,
  ADD COLUMN cpf             text,
  ADD COLUMN marital_status  text
    CHECK (marital_status IN ('solteira', 'casada', 'uniao_estavel', 'divorciada', 'viuva')),
  ADD COLUMN occupation      text;
