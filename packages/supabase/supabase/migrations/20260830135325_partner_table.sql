-- ============================================================
-- Partner (Parceria)
-- One-to-one satellite table for patients storing the partner's
-- own profile data (Acompanhamento da Parceria). Distinct from
-- patients.partner_name, which stays as the simple display name.
-- ============================================================

CREATE TABLE public.partner (
  patient_id                     uuid        NOT NULL,
  full_name                      text,
  preferred_name                 text,
  birth_date                     date,
  gender_identity                text,
  traditional_community          boolean,
  traditional_community_types    text[],
  traditional_community_other    text,
  race_color                     text,
  has_disability                 boolean,
  disability_types               text[],
  disability_other               text,
  education_level                text,
  family_history_diabetes        boolean,
  family_history_hypertension    boolean,
  family_history_twin_pregnancy  boolean,
  family_history_other           text,

  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT partner_pkey
    PRIMARY KEY (patient_id),
  CONSTRAINT partner_patient_id_fkey
    FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
);

GRANT ALL ON TABLE public.partner TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.partner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view partner"
  ON public.partner FOR SELECT
  USING (
    public.is_team_member(patient_id)
    OR (SELECT user_id FROM public.patients WHERE id = patient_id) = auth.uid()
  );

CREATE POLICY "Team members can insert partner"
  ON public.partner FOR INSERT
  WITH CHECK (public.is_team_member(patient_id));

CREATE POLICY "Team members can update partner"
  ON public.partner FOR UPDATE
  USING  (public.is_team_member(patient_id))
  WITH CHECK (public.is_team_member(patient_id));

CREATE POLICY "Enterprise staff can view enterprise partner"
  ON public.partner FOR SELECT
  USING (public.is_enterprise_patient(patient_id));

CREATE POLICY "Enterprise staff can insert enterprise partner"
  ON public.partner FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise partner"
  ON public.partner FOR UPDATE
  USING  (public.is_enterprise_patient(patient_id))
  WITH CHECK (public.is_enterprise_patient(patient_id));
