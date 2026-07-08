-- ============================================================
-- Contracts: stores both base contract templates (is_base_contract = true)
-- and patient-specific contracts (is_base_contract = false).
-- Base contracts have patient_id = NULL and pregnancy_id = NULL.
-- Patient contracts have patient_id and pregnancy_id set.
-- ============================================================

CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  -- Autonomous professional owner (nullable — set when not org-scoped)
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  -- Enterprise owner (nullable — set when org-scoped base contract)
  enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE CASCADE,
  -- Patient link (null for base contracts, set for patient contracts)
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  -- Pregnancy link (null for base contracts)
  pregnancy_id uuid REFERENCES public.pregnancies(id) ON DELETE SET NULL,
  is_base_contract boolean NOT NULL DEFAULT false,
  -- TipTap HTML output
  clauses_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_contracts_patient_id ON public.contracts (patient_id);
CREATE INDEX idx_contracts_pregnancy_id ON public.contracts (pregnancy_id);
CREATE INDEX idx_contracts_user_id_base ON public.contracts (user_id) WHERE is_base_contract = true;
CREATE INDEX idx_contracts_org_id_base ON public.contracts (enterprise_id) WHERE is_base_contract = true;

CREATE TRIGGER handle_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- SELECT: base contracts (own user or org) OR patient contracts (team member or enterprise)
CREATE POLICY "View contracts"
  ON public.contracts FOR SELECT
  USING (
    -- Base contract: own professional
    (is_base_contract = true AND user_id = auth.uid())
    -- Base contract: enterprise manager/secretary
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    -- Patient contract: team member or enterprise patient access
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );

-- INSERT: same gates as SELECT
CREATE POLICY "Create contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );

-- UPDATE
CREATE POLICY "Update contracts"
  ON public.contracts FOR UPDATE
  USING (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  )
  WITH CHECK (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );

-- DELETE
CREATE POLICY "Delete contracts"
  ON public.contracts FOR DELETE
  USING (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );

GRANT ALL ON TABLE public.contracts TO anon, authenticated, service_role;
