-- ============================================================
-- Pregnancy Risk Factors
-- One-to-one satellite table for pregnancies storing structured
-- boolean flags for current pregnancy risk factors
-- (Gestação atual — antecedentes e intercorrências).
-- ============================================================

CREATE TABLE public.pregnancy_risk_factors (
  pregnancy_id                  uuid        NOT NULL,

  -- Lifestyle
  smoking                       boolean,
  cigarettes_per_day            smallint,
  alcohol                       boolean,
  other_drugs                   boolean,
  domestic_violence             boolean,

  -- Infections
  hiv_aids                      boolean,
  syphilis                      boolean,
  toxoplasmosis                 boolean,
  urinary_infection             boolean,
  fever                         boolean,

  -- Obstetric conditions
  anemia                        boolean,
  isthmocervical_incompetence   boolean,
  preterm_labor_threat          boolean,
  rh_isoimmunization            boolean,
  oligo_polyhydramnios          boolean,
  premature_membrane_rupture    boolean,
  iugr                          boolean,
  post_term                     boolean,

  -- Maternal conditions
  hypertension                  boolean,
  preeclampsia_eclampsia        boolean,
  cardiopathy                   boolean,
  gestational_diabetes          boolean,
  insulin_use                   boolean,
  hemorrhage_1st_trimester      boolean,
  hemorrhage_2nd_trimester      boolean,
  hemorrhage_3rd_trimester      boolean,
  exantema                      boolean,

  other_notes                   text,

  created_at                    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pregnancy_risk_factors_pkey
    PRIMARY KEY (pregnancy_id),
  CONSTRAINT pregnancy_risk_factors_pregnancy_id_fkey
    FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE
);

GRANT ALL ON TABLE public.pregnancy_risk_factors TO anon, authenticated, service_role;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.pregnancy_risk_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view pregnancy risk factors"
  ON public.pregnancy_risk_factors FOR SELECT
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
    OR (
      SELECT user_id FROM public.patients
      WHERE id = (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    ) = auth.uid()
  );

CREATE POLICY "Team members can insert pregnancy risk factors"
  ON public.pregnancy_risk_factors FOR INSERT
  WITH CHECK (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Team members can update pregnancy risk factors"
  ON public.pregnancy_risk_factors FOR UPDATE
  USING (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  )
  WITH CHECK (
    public.is_team_member(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can view enterprise pregnancy risk factors"
  ON public.pregnancy_risk_factors FOR SELECT
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );

CREATE POLICY "Enterprise staff can insert enterprise pregnancy risk factors"
  ON public.pregnancy_risk_factors FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise pregnancy risk factors"
  ON public.pregnancy_risk_factors FOR UPDATE
  USING (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  )
  WITH CHECK (
    public.is_enterprise_patient(
      (SELECT patient_id FROM public.pregnancies WHERE id = pregnancy_id)
    )
  );
