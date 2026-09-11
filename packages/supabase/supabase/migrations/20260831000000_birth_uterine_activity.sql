CREATE TABLE public.birth_uterine_activity (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  interval_minutes smallint NOT NULL CHECK (interval_minutes IN (10, 20, 30)),
  contraction_count smallint NOT NULL CHECK (
    contraction_count >= 0 AND contraction_count <= (interval_minutes / 10) * 6
  ),
  durations_seconds smallint[] NOT NULL CHECK (0 < ALL (durations_seconds)),
  du_notations text[] NOT NULL,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_uterine_activity_pkey PRIMARY KEY (id),
  CONSTRAINT birth_uterine_activity_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_uterine_activity_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_uterine_activity_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE,
  CONSTRAINT birth_uterine_activity_durations_length_matches_count CHECK (
    COALESCE(array_length(durations_seconds, 1), 0) = contraction_count
  )
);

CREATE INDEX birth_uterine_activity_patient_id_idx ON public.birth_uterine_activity (patient_id);
CREATE INDEX birth_uterine_activity_professional_id_idx ON public.birth_uterine_activity (professional_id);
CREATE INDEX birth_uterine_activity_pregnancy_id_measured_at_idx ON public.birth_uterine_activity (pregnancy_id, measured_at DESC);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_uterine_activity
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_uterine_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View uterine activity" ON public.birth_uterine_activity
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create uterine activity" ON public.birth_uterine_activity
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_uterine_activity TO anon;
GRANT ALL ON TABLE public.birth_uterine_activity TO authenticated;
GRANT ALL ON TABLE public.birth_uterine_activity TO service_role;
