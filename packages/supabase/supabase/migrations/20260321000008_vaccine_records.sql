-- ============================================================
-- Vaccine Records (Vacinas)
-- Tracks vaccination doses per pregnancy.
-- ============================================================

CREATE TYPE public.vaccine_name AS ENUM (
  'covid', 'influenza', 'hepatitis_b', 'dtpa', 'abrysvo', 'rhogam'
);

CREATE TABLE public.vaccine_records (
  id            uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  pregnancy_id  uuid        NOT NULL,

  vaccine_name  public.vaccine_name NOT NULL,
  dose_number   smallint    CHECK (dose_number BETWEEN 1 AND 3),
  applied_date  date,
  status        text        CHECK (status IN ('applied', 'immunized', 'not_applicable')),
  notes         text,

  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT vaccine_records_pkey PRIMARY KEY (id),
  CONSTRAINT vaccine_records_pregnancy_id_fkey
    FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE
);

CREATE INDEX vaccine_records_pregnancy_id_idx ON public.vaccine_records(pregnancy_id);

GRANT ALL ON TABLE public.vaccine_records TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.vaccine_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view vaccine records"
  ON public.vaccine_records FOR SELECT
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
    OR (
      SELECT user_id FROM public.patients
      WHERE id = (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    ) = auth.uid()
  );

CREATE POLICY "Team members can insert vaccine records"
  ON public.vaccine_records FOR INSERT
  WITH CHECK (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Team members can update vaccine records"
  ON public.vaccine_records FOR UPDATE
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

CREATE POLICY "Enterprise staff can view enterprise vaccine records"
  ON public.vaccine_records FOR SELECT
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can insert enterprise vaccine records"
  ON public.vaccine_records FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise vaccine records"
  ON public.vaccine_records FOR UPDATE
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
