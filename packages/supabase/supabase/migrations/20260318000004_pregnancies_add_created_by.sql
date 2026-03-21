-- ============================================================
-- Add created_by to pregnancies
-- Foreign key referencing public.users(id), populated from
-- patients.created_by for existing rows.
-- ============================================================

ALTER TABLE public.pregnancies
  ADD COLUMN created_by uuid
  REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX pregnancies_created_by_idx ON public.pregnancies(created_by);

-- Populate from patients.created_by
UPDATE public.pregnancies preg
SET created_by = (
  SELECT p.created_by
  FROM public.patients p
  WHERE p.id = preg.patient_id
);
