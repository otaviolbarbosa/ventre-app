-- ============================================================
-- Prenatal Emotional Records
-- Doula-only "Pré-natal Emocional" questionnaire, one row per
-- (professional, pregnancy) pair.
-- ============================================================

CREATE TABLE public.prenatal_emotional_records (
  id                        uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  professional_id           uuid        NOT NULL,
  pregnancy_id              uuid        NOT NULL,

  birth_story               text,
  coping_style               text,
  safety_source              text,
  loss_of_control_feeling    text,
  birth_first_image          text,
  biggest_fear                text,
  preserve_if_different      text,
  woman_reminder              text,

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT prenatal_emotional_records_pkey
    PRIMARY KEY (id),
  CONSTRAINT prenatal_emotional_records_professional_id_fkey
    FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT prenatal_emotional_records_pregnancy_id_fkey
    FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT prenatal_emotional_records_professional_pregnancy_key
    UNIQUE (professional_id, pregnancy_id)
);

GRANT ALL ON TABLE public.prenatal_emotional_records TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- Exclusive to doula professionals who are team members of the
-- pregnancy's patient. Not visible to the patient or to other
-- professional types.
-- ============================================================
ALTER TABLE public.prenatal_emotional_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doula team members can view prenatal emotional records"
  ON public.prenatal_emotional_records FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND professional_type = 'doula')
    AND public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Doula team members can insert their own prenatal emotional records"
  ON public.prenatal_emotional_records FOR INSERT
  WITH CHECK (
    professional_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND professional_type = 'doula')
    AND public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Doula team members can update their own prenatal emotional records"
  ON public.prenatal_emotional_records FOR UPDATE
  USING (
    professional_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND professional_type = 'doula')
    AND public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  )
  WITH CHECK (
    professional_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND professional_type = 'doula')
    AND public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );
