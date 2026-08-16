-- Contract dual signature (Phase 1): extend the immutability trigger to
-- also lock once fully_signed_at is set (union with the existing
-- is_signed = true condition — strictly additive, never removes the
-- existing lock), and give patients SELECT access to their own contracts.
CREATE OR REPLACE FUNCTION public.prevent_signed_contract_mutation()
RETURNS trigger AS $$
BEGIN
  IF (OLD.title IS DISTINCT FROM NEW.title)
     OR (OLD.clauses_html IS DISTINCT FROM NEW.clauses_html)
     OR (OLD.parties_details IS DISTINCT FROM NEW.parties_details)
     OR (OLD.patient_id IS DISTINCT FROM NEW.patient_id)
     OR (OLD.pregnancy_id IS DISTINCT FROM NEW.pregnancy_id)
     OR (OLD.user_id IS DISTINCT FROM NEW.user_id)
     OR (OLD.enterprise_id IS DISTINCT FROM NEW.enterprise_id)
     OR (OLD.is_base_contract IS DISTINCT FROM NEW.is_base_contract)
     OR (OLD.is_signed IS DISTINCT FROM NEW.is_signed)
     OR (OLD.signed_at IS DISTINCT FROM NEW.signed_at)
     OR (OLD.signed_by IS DISTINCT FROM NEW.signed_by)
     OR (OLD.signed_ip IS DISTINCT FROM NEW.signed_ip)
     OR (OLD.signed_user_agent IS DISTINCT FROM NEW.signed_user_agent)
     OR (OLD.content_hash IS DISTINCT FROM NEW.content_hash)
     OR (OLD.verification_code IS DISTINCT FROM NEW.verification_code)
     OR (OLD.signed_document_id IS DISTINCT FROM NEW.signed_document_id)
     -- fully_signed_at may only transition once, from NULL to a value (set
     -- by the contract_signatures completion trigger or by the historical
     -- backfill) — once it's set, further changes are blocked like everything else
     OR (OLD.fully_signed_at IS NOT NULL AND OLD.fully_signed_at IS DISTINCT FROM NEW.fully_signed_at)
     OR (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
    RAISE EXCEPTION 'Contrato assinado é imutável e não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER prevent_signed_contract_update ON public.contracts;
CREATE TRIGGER prevent_signed_contract_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW WHEN (OLD.is_signed = true OR OLD.fully_signed_at IS NOT NULL)
  EXECUTE FUNCTION public.prevent_signed_contract_mutation();

DROP POLICY "View contracts" ON public.contracts;
CREATE POLICY "View contracts" ON public.contracts FOR SELECT USING (
  (is_base_contract = true AND user_id = auth.uid())
  OR (is_base_contract = true AND enterprise_id IN (
    SELECT enterprise_id FROM public.users
    WHERE id = auth.uid() AND enterprise_id IS NOT NULL
  ))
  OR (patient_id IS NOT NULL AND (
    public.is_team_member(patient_id)
    OR public.is_enterprise_patient(patient_id)
    OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = contracts.patient_id AND patients.user_id = auth.uid())
  ))
);
