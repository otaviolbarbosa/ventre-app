-- Contract dual signature (Phase 8): rename signed_document_id -> original_document_id
-- (the PDF generated when the professional signs, single-stamp) and add
-- finalized_document_id (the "_Finalizado" PDF with both parties' stamps + an
-- appended authentication certificate, generated once both parties have signed).
-- The FK constraint name (contracts_signed_document_id_fkey) is left as-is —
-- renaming a column doesn't rename its constraints, and there's no functional need to.
ALTER TABLE public.contracts RENAME COLUMN signed_document_id TO original_document_id;

ALTER TABLE public.contracts
  ADD COLUMN finalized_document_id uuid REFERENCES public.patient_documents(id) ON DELETE SET NULL;

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
     OR (OLD.original_document_id IS DISTINCT FROM NEW.original_document_id)
     OR (OLD.fully_signed_at IS NOT NULL AND OLD.fully_signed_at IS DISTINCT FROM NEW.fully_signed_at)
     OR (OLD.revoked_at IS NOT NULL AND OLD.revoked_at IS DISTINCT FROM NEW.revoked_at)
     -- finalized_document_id may only transition once, from NULL to a value — set by
     -- sign-contract-as-patient-action.ts right after the completing signature is
     -- recorded, same guarded-single-transition pattern as fully_signed_at/revoked_at
     OR (OLD.finalized_document_id IS NOT NULL AND OLD.finalized_document_id IS DISTINCT FROM NEW.finalized_document_id)
     OR (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
    RAISE EXCEPTION 'Contrato assinado é imutável e não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
