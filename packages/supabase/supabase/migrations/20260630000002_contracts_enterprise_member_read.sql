-- Allow all enterprise members (not only managers/secretaries) to read
-- the enterprise base contract, so professionals can use it as a template
-- when generating patient contracts.
--
-- INSERT / UPDATE / DELETE on enterprise-scoped base contracts remain
-- restricted to managers and secretaries only.

ALTER POLICY "View contracts" ON public.contracts
  USING (
    -- Base contract: own personal contract
    (is_base_contract = true AND user_id = auth.uid())
    -- Base contract: any enterprise member can read (managers create, everyone uses)
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND enterprise_id IS NOT NULL
    ))
    -- Patient contract: team member or enterprise patient access
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );
