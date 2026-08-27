CREATE INDEX IF NOT EXISTS team_members_patient_id_professional_id_idx
  ON public.team_members (patient_id, professional_id);
