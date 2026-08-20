CREATE TABLE public.birth_fetal_heart_rates (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  bpm smallint NOT NULL CHECK (bpm > 0 AND bpm < 300),
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_fetal_heart_rates_pkey PRIMARY KEY (id),
  CONSTRAINT birth_fetal_heart_rates_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_fetal_heart_rates_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_fetal_heart_rates_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_fetal_heart_rates_patient_id_idx ON public.birth_fetal_heart_rates (patient_id);
CREATE INDEX birth_fetal_heart_rates_pregnancy_id_measured_at_idx ON public.birth_fetal_heart_rates (pregnancy_id, measured_at DESC);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_fetal_heart_rates
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_fetal_heart_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View fetal heart rates" ON public.birth_fetal_heart_rates
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create fetal heart rates" ON public.birth_fetal_heart_rates
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_fetal_heart_rates TO anon;
GRANT ALL ON TABLE public.birth_fetal_heart_rates TO authenticated;
GRANT ALL ON TABLE public.birth_fetal_heart_rates TO service_role;
