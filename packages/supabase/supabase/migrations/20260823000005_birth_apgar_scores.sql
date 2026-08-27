CREATE TABLE public.birth_apgar_scores (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  minute smallint NOT NULL CHECK (minute IN (1, 5, 10, 15, 20)),
  appearance smallint NOT NULL CHECK (appearance BETWEEN 0 AND 2),
  pulse smallint NOT NULL CHECK (pulse BETWEEN 0 AND 2),
  grimace smallint NOT NULL CHECK (grimace BETWEEN 0 AND 2),
  activity smallint NOT NULL CHECK (activity BETWEEN 0 AND 2),
  respiration smallint NOT NULL CHECK (respiration BETWEEN 0 AND 2),
  total smallint GENERATED ALWAYS AS (appearance + pulse + grimace + activity + respiration) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_apgar_scores_pkey PRIMARY KEY (id),
  CONSTRAINT birth_apgar_scores_pregnancy_id_minute_key UNIQUE (pregnancy_id, minute),
  CONSTRAINT birth_apgar_scores_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_apgar_scores_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_apgar_scores_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_apgar_scores_patient_id_idx ON public.birth_apgar_scores (patient_id);
CREATE INDEX birth_apgar_scores_pregnancy_id_idx ON public.birth_apgar_scores (pregnancy_id);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_apgar_scores
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_apgar_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View apgar scores" ON public.birth_apgar_scores
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create apgar scores" ON public.birth_apgar_scores
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_apgar_scores TO anon;
GRANT ALL ON TABLE public.birth_apgar_scores TO authenticated;
GRANT ALL ON TABLE public.birth_apgar_scores TO service_role;
