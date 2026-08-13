-- Permite múltiplos profissionais backup ilimitados por especialidade;
-- mantém apenas 1 titular por especialidade por gestação (não mais por paciente histórica).
ALTER TABLE public.team_members
  DROP CONSTRAINT team_members_patient_id_professional_type_is_backup_key;

CREATE UNIQUE INDEX team_members_pregnancy_professional_type_primary_unique
  ON public.team_members (pregnancy_id, professional_type)
  WHERE is_backup = false;
