-- ============================================================
-- Pregnancy Evolutions
-- Stores prenatal consultation records (Evolução da Gravidez).
-- Each row represents one prenatal visit for a pregnancy.
-- ============================================================

CREATE TYPE public.fetal_presentation AS ENUM ('cephalic', 'pelvic', 'transverse');

CREATE TABLE public.pregnancy_evolutions (
  id                    uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  pregnancy_id          uuid        NOT NULL,

  consultation_date     date        NOT NULL,

  -- Gestational age
  gestational_weeks     smallint,
  gestational_days      smallint,
  ig_source             text        CHECK (ig_source IN ('dum', 'usg')),

  -- Clinical data
  complaint             text,
  weight_kg             numeric,
  bmi                   numeric,
  edema                 boolean,
  systolic_bp           smallint,
  diastolic_bp          smallint,
  uterine_height_cm     numeric,
  fetal_presentation    public.fetal_presentation,
  fetal_heart_rate      smallint,
  fetal_movement        boolean,
  cervical_exam         text,
  exantema              boolean,
  exantema_notes        text,

  -- Conduct
  observations          text,

  -- Professional
  responsible           text,

  created_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pregnancy_evolutions_pkey PRIMARY KEY (id),
  CONSTRAINT pregnancy_evolutions_pregnancy_id_fkey
    FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE
);

CREATE INDEX pregnancy_evolutions_pregnancy_id_idx
  ON public.pregnancy_evolutions(pregnancy_id);

CREATE INDEX pregnancy_evolutions_consultation_date_idx
  ON public.pregnancy_evolutions(consultation_date);

GRANT ALL ON TABLE public.pregnancy_evolutions TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.pregnancy_evolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view pregnancy evolutions"
  ON public.pregnancy_evolutions FOR SELECT
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
    OR (
      SELECT user_id FROM public.patients
      WHERE id = (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    ) = auth.uid()
  );

CREATE POLICY "Team members can insert pregnancy evolutions"
  ON public.pregnancy_evolutions FOR INSERT
  WITH CHECK (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Team members can update pregnancy evolutions"
  ON public.pregnancy_evolutions FOR UPDATE
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  )
  WITH CHECK (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can view enterprise pregnancy evolutions"
  ON public.pregnancy_evolutions FOR SELECT
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can insert enterprise pregnancy evolutions"
  ON public.pregnancy_evolutions FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise pregnancy evolutions"
  ON public.pregnancy_evolutions FOR UPDATE
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  )
  WITH CHECK (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );
