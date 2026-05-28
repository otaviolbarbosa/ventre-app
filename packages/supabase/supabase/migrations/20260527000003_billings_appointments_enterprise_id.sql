-- ============================================================
-- billings.enterprise_id e appointments.enterprise_id
-- Isola cobranças e agendamentos por empresa sem JOINs longos
-- NOTA: billings não tem professional_id (usa splitted_billing jsonb)
-- ============================================================

-- ============================================================
-- billings.enterprise_id
-- ============================================================

ALTER TABLE public.billings
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX idx_billings_enterprise_id ON public.billings(enterprise_id);

-- ============================================================
-- appointments.enterprise_id
-- ============================================================

ALTER TABLE public.appointments
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX idx_appointments_enterprise_id ON public.appointments(enterprise_id);

-- ============================================================
-- Backfill billings: via patient_id → pregnancy mais recente com enterprise_id
-- (billings não tem professional_id — usa splitted_billing jsonb)
-- ============================================================
UPDATE public.billings b
SET enterprise_id = preg.enterprise_id
FROM (
  SELECT DISTINCT ON (patient_id) patient_id, enterprise_id
  FROM public.pregnancies
  WHERE enterprise_id IS NOT NULL
  ORDER BY patient_id, created_at DESC
) preg
WHERE preg.patient_id = b.patient_id
  AND b.enterprise_id IS NULL;

-- ============================================================
-- Backfill appointments: via team_members → pregnancy → enterprise
-- ============================================================
UPDATE public.appointments a
SET enterprise_id = preg.enterprise_id
FROM public.pregnancies preg,
     public.team_members tm
WHERE tm.patient_id = a.patient_id
  AND tm.professional_id = a.professional_id
  AND tm.pregnancy_id = preg.id
  AND a.enterprise_id IS NULL
  AND preg.enterprise_id IS NOT NULL;

-- Fallback appointments: sem team_member vinculado → via user_enterprises
UPDATE public.appointments a
SET enterprise_id = ue.enterprise_id
FROM public.user_enterprises ue
WHERE ue.user_id = a.professional_id
  AND a.enterprise_id IS NULL;
