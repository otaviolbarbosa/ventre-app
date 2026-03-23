-- ============================================================
-- Other Exams (Outros Exames)
-- Free-text records for exams not covered by the structured
-- ultrasounds or lab_exam_results tables (e.g. CTG, NST, etc.).
-- ============================================================

CREATE TABLE public.other_exams (
  id            uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  pregnancy_id  uuid        NOT NULL,

  exam_date     date        NOT NULL,
  description   text        NOT NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT other_exams_pkey PRIMARY KEY (id),
  CONSTRAINT other_exams_pregnancy_id_fkey
    FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE
);

CREATE INDEX other_exams_pregnancy_id_idx ON public.other_exams(pregnancy_id);

GRANT ALL ON TABLE public.other_exams TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.other_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view other exams"
  ON public.other_exams FOR SELECT
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
    OR (
      SELECT user_id FROM public.patients
      WHERE id = (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    ) = auth.uid()
  );

CREATE POLICY "Team members can insert other exams"
  ON public.other_exams FOR INSERT
  WITH CHECK (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Team members can update other exams"
  ON public.other_exams FOR UPDATE
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

CREATE POLICY "Enterprise staff can view enterprise other exams"
  ON public.other_exams FOR SELECT
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can insert enterprise other exams"
  ON public.other_exams FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise other exams"
  ON public.other_exams FOR UPDATE
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
