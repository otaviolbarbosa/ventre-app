-- ============================================================
-- Lab Exam Results (Exames Laboratoriais)
-- Flexible one-row-per-exam model supporting multiple collection
-- dates. Covers all standard prenatal exams plus free-text extras.
--
-- Standard exam names:
--   ABO-RH, Hemoglobina/Hematócrito, Plaquetas, Glicemia de Jejum,
--   TOTG, Sífilis, VDRL, HIV/Anti HIV, Hepatite B (HBsAg),
--   Hepatite C, Toxoplasmose, Rubéola, Coombs Indireto,
--   CMV, Ferritina, TSH/T4L, HTLV1e2, Vitamina D,
--   Urina-EAS, Urocultura, Eletroforese de Hemoglobina
-- ============================================================

CREATE TYPE public.hemoglobin_electrophoresis_result AS ENUM (
  'AA', 'AS', 'AC', 'SS', 'SC',
  'other_heterozygous', 'other_homozygous'
);

CREATE TABLE public.lab_exam_results (
  id               uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  pregnancy_id     uuid        NOT NULL,

  exam_date        date        NOT NULL,
  exam_name        text        NOT NULL,
  result_text      text,       -- NR, negativo, imune, susceptível, IgG+ IgM-...
  result_numeric   numeric,    -- when a numeric value is present
  unit             text,       -- mg/dL, µUI/mL, 10³/µL...

  -- Special structured field for Eletroforese de Hemoglobina
  hemoglobin_electrophoresis public.hemoglobin_electrophoresis_result,

  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lab_exam_results_pkey PRIMARY KEY (id),
  CONSTRAINT lab_exam_results_pregnancy_id_fkey
    FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE
);

CREATE INDEX lab_exam_results_pregnancy_id_idx
  ON public.lab_exam_results(pregnancy_id);

CREATE INDEX lab_exam_results_pregnancy_date_name_idx
  ON public.lab_exam_results(pregnancy_id, exam_date, exam_name);

GRANT ALL ON TABLE public.lab_exam_results TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.lab_exam_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view lab exam results"
  ON public.lab_exam_results FOR SELECT
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
    OR (
      SELECT user_id FROM public.patients
      WHERE id = (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    ) = auth.uid()
  );

CREATE POLICY "Team members can insert lab exam results"
  ON public.lab_exam_results FOR INSERT
  WITH CHECK (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Team members can update lab exam results"
  ON public.lab_exam_results FOR UPDATE
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

CREATE POLICY "Enterprise staff can view enterprise lab exam results"
  ON public.lab_exam_results FOR SELECT
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can insert enterprise lab exam results"
  ON public.lab_exam_results FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise lab exam results"
  ON public.lab_exam_results FOR UPDATE
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
