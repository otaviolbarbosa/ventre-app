-- ============================================================
-- Patient Obstetric History
-- One-to-one satellite table for patients storing structured
-- boolean flags for prior clinical and surgical history
-- (Antecedentes clínicos obstétricos).
-- ============================================================

CREATE TABLE public.patient_obstetric_history (
  patient_id                uuid        NOT NULL,
  -- Clinical antecedents
  diabetes                  boolean,
  urinary_infection         boolean,
  infertility               boolean,
  breastfeeding_difficulty  boolean,
  cardiopathy               boolean,
  thromboembolism           boolean,
  hypertension              boolean,
  other_clinical            boolean,
  other_clinical_notes      text,
  -- Surgical antecedents
  pelvic_uterine_surgery    boolean,
  prior_surgery             boolean,
  other_surgery_notes       text,

  created_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT patient_obstetric_history_pkey
    PRIMARY KEY (patient_id),
  CONSTRAINT patient_obstetric_history_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
);

GRANT ALL ON TABLE public.patient_obstetric_history TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.patient_obstetric_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view patient obstetric history"
  ON public.patient_obstetric_history FOR SELECT
  USING (
    public.is_team_member(patient_id)
    OR (SELECT user_id FROM public.patients WHERE id = patient_id) = auth.uid()
  );

CREATE POLICY "Team members can insert patient obstetric history"
  ON public.patient_obstetric_history FOR INSERT
  WITH CHECK (public.is_team_member(patient_id));

CREATE POLICY "Team members can update patient obstetric history"
  ON public.patient_obstetric_history FOR UPDATE
  USING  (public.is_team_member(patient_id))
  WITH CHECK (public.is_team_member(patient_id));

CREATE POLICY "Enterprise staff can view enterprise patient obstetric history"
  ON public.patient_obstetric_history FOR SELECT
  USING (public.is_enterprise_patient(patient_id));

CREATE POLICY "Enterprise staff can insert enterprise patient obstetric history"
  ON public.patient_obstetric_history FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise patient obstetric history"
  ON public.patient_obstetric_history FOR UPDATE
  USING  (public.is_enterprise_patient(patient_id))
  WITH CHECK (public.is_enterprise_patient(patient_id));
