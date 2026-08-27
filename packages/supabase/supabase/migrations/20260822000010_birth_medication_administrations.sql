CREATE TYPE public.birth_medication_type AS ENUM ('fluidos_intravenosos', 'ocitocina', 'analgesia', 'outros');

CREATE TABLE public.birth_medication_administrations (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  medication_type public.birth_medication_type NOT NULL,
  other_birth_medication_type text,
  notes text,
  administered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_medication_administrations_pkey PRIMARY KEY (id),
  CONSTRAINT birth_medication_administrations_other_type_check CHECK (
    medication_type <> 'outros' OR other_birth_medication_type IS NOT NULL
  ),
  CONSTRAINT birth_medication_administrations_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_medication_administrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_medication_administrations_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_medication_administrations_patient_id_idx ON public.birth_medication_administrations (patient_id);
CREATE INDEX birth_medication_administrations_pregnancy_id_idx ON public.birth_medication_administrations (pregnancy_id);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_medication_administrations
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_medication_administrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View medication administrations" ON public.birth_medication_administrations
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create medication administrations" ON public.birth_medication_administrations
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_medication_administrations TO anon;
GRANT ALL ON TABLE public.birth_medication_administrations TO authenticated;
GRANT ALL ON TABLE public.birth_medication_administrations TO service_role;
