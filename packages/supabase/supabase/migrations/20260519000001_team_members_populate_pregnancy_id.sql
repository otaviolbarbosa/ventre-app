-- Populate pregnancy_id from the most recent pregnancy for each patient
UPDATE public.team_members tm
SET pregnancy_id = (
  SELECT preg.id
  FROM public.pregnancies preg
  WHERE preg.patient_id = tm.patient_id
  ORDER BY preg.created_at DESC
  LIMIT 1
)
WHERE tm.pregnancy_id IS NULL;

-- Abort if any row still lacks a pregnancy
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.team_members WHERE pregnancy_id IS NULL) THEN
    RAISE EXCEPTION 'team_members rows without pregnancy_id found — cannot proceed';
  END IF;
END $$;

-- Make pregnancy_id NOT NULL
ALTER TABLE public.team_members
  ALTER COLUMN pregnancy_id SET NOT NULL;

-- Composite index for common access patterns
CREATE INDEX idx_team_members_lookup
  ON public.team_members (id, professional_id, patient_id, pregnancy_id);
