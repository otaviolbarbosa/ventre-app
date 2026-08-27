CREATE TYPE public.birth_amniotic_fluid_type AS ENUM ('intacto', 'com_sangue', 'claro', 'com_meconio');

CREATE TABLE public.birth_amniotic_fluid_records (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  fluid_type public.birth_amniotic_fluid_type NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_amniotic_fluid_records_pkey PRIMARY KEY (id),
  CONSTRAINT birth_amniotic_fluid_records_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_amniotic_fluid_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_amniotic_fluid_records_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_amniotic_fluid_records_patient_id_idx ON public.birth_amniotic_fluid_records (patient_id);
CREATE INDEX birth_amniotic_fluid_records_pregnancy_id_idx ON public.birth_amniotic_fluid_records (pregnancy_id);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_amniotic_fluid_records
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_amniotic_fluid_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View amniotic fluid records" ON public.birth_amniotic_fluid_records
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create amniotic fluid records" ON public.birth_amniotic_fluid_records
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_amniotic_fluid_records TO anon;
GRANT ALL ON TABLE public.birth_amniotic_fluid_records TO authenticated;
GRANT ALL ON TABLE public.birth_amniotic_fluid_records TO service_role;
