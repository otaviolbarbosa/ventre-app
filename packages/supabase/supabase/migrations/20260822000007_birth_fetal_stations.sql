CREATE TABLE public.birth_fetal_stations (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  station_lee smallint NOT NULL CHECK (station_lee >= -4 AND station_lee <= 4),
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_fetal_stations_pkey PRIMARY KEY (id),
  CONSTRAINT birth_fetal_stations_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_fetal_stations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_fetal_stations_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_fetal_stations_patient_id_idx ON public.birth_fetal_stations (patient_id);
CREATE INDEX birth_fetal_stations_pregnancy_id_measured_at_idx ON public.birth_fetal_stations (pregnancy_id, measured_at DESC);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_fetal_stations
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_fetal_stations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View fetal stations" ON public.birth_fetal_stations
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create fetal stations" ON public.birth_fetal_stations
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_fetal_stations TO anon;
GRANT ALL ON TABLE public.birth_fetal_stations TO authenticated;
GRANT ALL ON TABLE public.birth_fetal_stations TO service_role;
