-- Contract revocation (Phase 6): timestamp + actor for revoking a fully-signed
-- contract. Never written directly except by revoke-contract-action.ts, and
-- only once — mirrors the fully_signed_at guarded transition below.
ALTER TABLE public.contracts
  ADD COLUMN revoked_at timestamptz,
  ADD COLUMN revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

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
     OR (OLD.fully_signed_at IS NOT NULL AND OLD.fully_signed_at IS DISTINCT FROM NEW.fully_signed_at)
     OR (OLD.revoked_at IS NOT NULL AND OLD.revoked_at IS DISTINCT FROM NEW.revoked_at)
     OR (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
    RAISE EXCEPTION 'Contrato assinado é imutável e não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
