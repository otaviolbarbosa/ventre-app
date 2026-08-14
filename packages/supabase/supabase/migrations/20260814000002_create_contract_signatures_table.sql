-- Contract dual signature (Phase 1): child table holding one signature row
-- per signer role (professional | patient), each with its own audit trail
-- (IP, user-agent, timestamp, verification code). Each row is immutable
-- once inserted.
CREATE TABLE public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_role text NOT NULL CHECK (signer_role IN ('professional', 'patient')),
  signer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signed_ip text,
  signed_user_agent text,
  verification_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contract_signatures_contract_id_signer_role_key UNIQUE (contract_id, signer_role)
);

CREATE INDEX idx_contract_signatures_contract_id ON public.contract_signatures (contract_id);

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View contract signatures" ON public.contract_signatures FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_signatures.contract_id
    AND (
      public.is_team_member(contracts.patient_id)
      OR public.is_enterprise_patient(contracts.patient_id)
      OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = contracts.patient_id AND patients.user_id = auth.uid())
    )
  )
);

CREATE POLICY "Insert own contract signature" ON public.contract_signatures FOR INSERT WITH CHECK (
  signer_id = auth.uid()
);

-- No UPDATE/DELETE policy: RLS denies by default for authenticated/anon.
-- Trigger below blocks even service_role, same belt-and-suspenders pattern
-- as patient_documents.is_immutable / prevent_immutable_document_delete.
CREATE OR REPLACE FUNCTION public.prevent_contract_signature_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Assinatura de contrato é imutável e não pode ser alterada';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_contract_signature_update
  BEFORE UPDATE ON public.contract_signatures
  FOR EACH ROW EXECUTE FUNCTION public.prevent_contract_signature_mutation();

CREATE TRIGGER prevent_contract_signature_delete
  BEFORE DELETE ON public.contract_signatures
  FOR EACH ROW EXECUTE FUNCTION public.prevent_contract_signature_mutation();

GRANT SELECT, INSERT ON TABLE public.contract_signatures TO authenticated, service_role;
GRANT SELECT ON TABLE public.contract_signatures TO anon;
