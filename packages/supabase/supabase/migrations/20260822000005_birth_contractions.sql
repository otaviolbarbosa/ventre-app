CREATE TYPE public.birth_contraction_effectiveness AS ENUM ('efetiva', 'intermediaria', 'nao_efetiva');
-- Efetiva: > 40s | Intermediária: 20-40s | Não efetiva: < 20s

CREATE TABLE public.birth_contractions (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  duration_seconds smallint NOT NULL CHECK (duration_seconds > 0),
  effectiveness public.birth_contraction_effectiveness GENERATED ALWAYS AS (
    CASE
      WHEN duration_seconds > 40 THEN 'efetiva'::public.birth_contraction_effectiveness
      WHEN duration_seconds >= 20 THEN 'intermediaria'::public.birth_contraction_effectiveness
      ELSE 'nao_efetiva'::public.birth_contraction_effectiveness
    END
  ) STORED,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_contractions_pkey PRIMARY KEY (id),
  CONSTRAINT birth_contractions_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_contractions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_contractions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_contractions_patient_id_idx ON public.birth_contractions (patient_id);
CREATE INDEX birth_contractions_pregnancy_id_measured_at_idx ON public.birth_contractions (pregnancy_id, measured_at DESC);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_contractions
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_contractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View contractions" ON public.birth_contractions
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create contractions" ON public.birth_contractions
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_contractions TO anon;
GRANT ALL ON TABLE public.birth_contractions TO authenticated;
GRANT ALL ON TABLE public.birth_contractions TO service_role;
