CREATE TABLE public.birth_maternal_vitals (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  systolic_bp smallint CHECK (systolic_bp IS NULL OR systolic_bp > 0),
  diastolic_bp smallint CHECK (diastolic_bp IS NULL OR diastolic_bp > 0),
  pulse_bpm smallint CHECK (pulse_bpm IS NULL OR pulse_bpm > 0),
  temperature_celsius numeric(3,1) CHECK (temperature_celsius IS NULL OR temperature_celsius > 0),
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_maternal_vitals_pkey PRIMARY KEY (id),
  CONSTRAINT birth_maternal_vitals_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_maternal_vitals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_maternal_vitals_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_maternal_vitals_patient_id_idx ON public.birth_maternal_vitals (patient_id);
CREATE INDEX birth_maternal_vitals_professional_id_idx ON public.birth_maternal_vitals (professional_id);
CREATE INDEX birth_maternal_vitals_pregnancy_id_measured_at_idx ON public.birth_maternal_vitals (pregnancy_id, measured_at DESC);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_maternal_vitals
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_maternal_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View maternal vitals" ON public.birth_maternal_vitals
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create maternal vitals" ON public.birth_maternal_vitals
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_maternal_vitals TO anon;
GRANT ALL ON TABLE public.birth_maternal_vitals TO authenticated;
GRANT ALL ON TABLE public.birth_maternal_vitals TO service_role;
