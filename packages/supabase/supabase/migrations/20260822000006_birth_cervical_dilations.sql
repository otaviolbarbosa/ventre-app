CREATE TABLE public.birth_cervical_dilations (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  dilation_cm numeric(3,1) NOT NULL CHECK (dilation_cm >= 0 AND dilation_cm <= 10),
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_cervical_dilations_pkey PRIMARY KEY (id),
  CONSTRAINT birth_cervical_dilations_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_cervical_dilations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_cervical_dilations_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_cervical_dilations_patient_id_idx ON public.birth_cervical_dilations (patient_id);
CREATE INDEX birth_cervical_dilations_pregnancy_id_measured_at_idx ON public.birth_cervical_dilations (pregnancy_id, measured_at DESC);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_cervical_dilations
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_cervical_dilations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View cervical dilations" ON public.birth_cervical_dilations
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create cervical dilations" ON public.birth_cervical_dilations
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_cervical_dilations TO anon;
GRANT ALL ON TABLE public.birth_cervical_dilations TO authenticated;
GRANT ALL ON TABLE public.birth_cervical_dilations TO service_role;
