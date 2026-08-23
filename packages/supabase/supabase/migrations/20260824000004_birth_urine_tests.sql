CREATE TYPE public.birth_urine_dipstick_level AS ENUM ('ausente', 'tracos', 'uma_cruz', 'duas_cruzes', 'tres_cruzes');

CREATE TABLE public.birth_urine_tests (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  protein_level public.birth_urine_dipstick_level,
  ketone_level public.birth_urine_dipstick_level,
  volume_ml numeric(6,1) CHECK (volume_ml IS NULL OR volume_ml >= 0),
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_urine_tests_pkey PRIMARY KEY (id),
  CONSTRAINT birth_urine_tests_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_urine_tests_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_urine_tests_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_urine_tests_patient_id_idx ON public.birth_urine_tests (patient_id);
CREATE INDEX birth_urine_tests_professional_id_idx ON public.birth_urine_tests (professional_id);
CREATE INDEX birth_urine_tests_pregnancy_id_measured_at_idx ON public.birth_urine_tests (pregnancy_id, measured_at DESC);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_urine_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_urine_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View urine tests" ON public.birth_urine_tests
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create urine tests" ON public.birth_urine_tests
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_urine_tests TO anon;
GRANT ALL ON TABLE public.birth_urine_tests TO authenticated;
GRANT ALL ON TABLE public.birth_urine_tests TO service_role;
