-- ============================================================
-- Patients: Prenatal Fields
-- Adds prenatal-related columns to the patients table:
-- partner info, blood type, height, allergies, personal notes,
-- and structured family history flags.
-- ============================================================

CREATE TYPE public.blood_type AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');

ALTER TABLE public.patients
  ADD COLUMN partner_name               text,
  ADD COLUMN blood_type                 public.blood_type,
  ADD COLUMN height_cm                  numeric,
  ADD COLUMN allergies                  text[],
  ADD COLUMN personal_notes             text,
  ADD COLUMN family_history_diabetes    boolean,
  ADD COLUMN family_history_hypertension boolean,
  ADD COLUMN family_history_twin        boolean,
  ADD COLUMN family_history_others      text;
