-- ============================================================
-- Ultrasounds (Ecografias)
-- Stores structured ultrasound exam records per pregnancy.
-- ============================================================

CREATE TYPE public.doppler_result AS ENUM ('normal', 'abnormal', 'not_performed');

CREATE TABLE public.ultrasounds (
  id                       uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  pregnancy_id             uuid        NOT NULL,

  exam_date                date        NOT NULL,

  -- Gestational age at exam
  gestational_weeks        smallint,
  gestational_days         smallint,

  -- Measurements
  ccn_mm                   numeric,    -- Comprimento Cabeça-Nádega
  fetal_heart_rate_bpm     smallint,   -- Frequência cardíaca fetal
  nuchal_translucency_mm   numeric,    -- Translucência Nucal (TN)
  cervical_length_cm       numeric,    -- Comprimento do colo uterino
  estimated_weight_g       integer,    -- Peso fetal estimado
  amniotic_fluid_index     numeric,    -- Índice de líquido amniótico (CAN/ILA)

  -- Fetal anatomy / markers
  nasal_bone_present       boolean,    -- Osso Nasal (ON)
  placenta_position        text,       -- fúndica, anterior, posterior, etc.
  iugr                     boolean,    -- Restrição de crescimento (CIUR)
  doppler_result           public.doppler_result,

  notes                    text,

  created_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ultrasounds_pkey PRIMARY KEY (id),
  CONSTRAINT ultrasounds_pregnancy_id_fkey
    FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE
);

CREATE INDEX ultrasounds_pregnancy_id_idx ON public.ultrasounds(pregnancy_id);
CREATE INDEX ultrasounds_exam_date_idx    ON public.ultrasounds(exam_date);

GRANT ALL ON TABLE public.ultrasounds TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.ultrasounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view ultrasounds"
  ON public.ultrasounds FOR SELECT
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
    OR (
      SELECT user_id FROM public.patients
      WHERE id = (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    ) = auth.uid()
  );

CREATE POLICY "Team members can insert ultrasounds"
  ON public.ultrasounds FOR INSERT
  WITH CHECK (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Team members can update ultrasounds"
  ON public.ultrasounds FOR UPDATE
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

CREATE POLICY "Enterprise staff can view enterprise ultrasounds"
  ON public.ultrasounds FOR SELECT
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can insert enterprise ultrasounds"
  ON public.ultrasounds FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise ultrasounds"
  ON public.ultrasounds FOR UPDATE
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
