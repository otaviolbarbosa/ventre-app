DROP POLICY "Insert own contract signature" ON public.contract_signatures;

CREATE POLICY "Insert own contract signature" ON public.contract_signatures FOR INSERT WITH CHECK (
  signer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_signatures.contract_id
      AND contracts.is_base_contract = false
      AND contracts.status = 'active'
      AND (
        (signer_role = 'patient' AND EXISTS (
          SELECT 1 FROM public.patients
          WHERE patients.id = contracts.patient_id AND patients.user_id = auth.uid()
        ))
        OR (signer_role = 'professional' AND (
          public.is_team_member(contracts.patient_id)
          OR public.is_enterprise_patient(contracts.patient_id)
        ))
      )
  )
);
