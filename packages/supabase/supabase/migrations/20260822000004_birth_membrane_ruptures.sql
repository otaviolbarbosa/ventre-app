CREATE TABLE public.birth_membrane_ruptures (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_membrane_ruptures_pkey PRIMARY KEY (id),
  CONSTRAINT birth_membrane_ruptures_pregnancy_id_key UNIQUE (pregnancy_id),
  CONSTRAINT birth_membrane_ruptures_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_membrane_ruptures_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_membrane_ruptures_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_membrane_ruptures_patient_id_idx ON public.birth_membrane_ruptures (patient_id);
CREATE INDEX birth_membrane_ruptures_pregnancy_id_idx ON public.birth_membrane_ruptures (pregnancy_id);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_membrane_ruptures
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_membrane_ruptures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View membrane ruptures" ON public.birth_membrane_ruptures
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create membrane ruptures" ON public.birth_membrane_ruptures
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_membrane_ruptures TO anon;
GRANT ALL ON TABLE public.birth_membrane_ruptures TO authenticated;
GRANT ALL ON TABLE public.birth_membrane_ruptures TO service_role;
