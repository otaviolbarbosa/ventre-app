-- Contract electronic signature (Phase 1): signature fields, immutability triggers,
-- verification code uniqueness, and immutable patient documents.

-- contracts: signature fields
ALTER TABLE public.contracts
  ADD COLUMN is_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN signed_at timestamptz,
  ADD COLUMN signed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN signed_ip text,
  ADD COLUMN signed_user_agent text,
  ADD COLUMN content_hash text,
  ADD COLUMN verification_code text,
  ADD COLUMN signed_document_id uuid REFERENCES public.patient_documents(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_contracts_verification_code
  ON public.contracts (verification_code)
  WHERE verification_code IS NOT NULL;

-- Immutability: once signed, only is_active/updated_at may change
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
     OR (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
    RAISE EXCEPTION 'Contrato assinado é imutável e não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_signed_contract_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW WHEN (OLD.is_signed = true)
  EXECUTE FUNCTION public.prevent_signed_contract_mutation();

CREATE OR REPLACE FUNCTION public.prevent_signed_contract_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Contrato assinado não pode ser excluído';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_signed_contract_delete
  BEFORE DELETE ON public.contracts
  FOR EACH ROW WHEN (OLD.is_signed = true)
  EXECUTE FUNCTION public.prevent_signed_contract_delete();

-- patient_documents: immutable flag + delete protection
ALTER TABLE public.patient_documents
  ADD COLUMN is_immutable boolean NOT NULL DEFAULT false;

ALTER POLICY "Delete own documents" ON public.patient_documents
  USING (uploaded_by = auth.uid() AND is_immutable IS NOT TRUE);

ALTER POLICY "Enterprise staff can delete enterprise patient documents" ON public.patient_documents
  USING (public.is_enterprise_patient(patient_id) AND is_immutable IS NOT TRUE);

CREATE OR REPLACE FUNCTION public.prevent_immutable_document_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Documento imutável não pode ser excluído';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_immutable_document_delete
  BEFORE DELETE ON public.patient_documents
  FOR EACH ROW WHEN (OLD.is_immutable = true)
  EXECUTE FUNCTION public.prevent_immutable_document_delete();
