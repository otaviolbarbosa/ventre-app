ALTER TABLE team_members
  DROP CONSTRAINT team_members_patient_id_professional_type_key;

ALTER TABLE team_members
  ADD CONSTRAINT team_members_patient_id_professional_type_is_backup_key
  UNIQUE (patient_id, professional_type, is_backup);
