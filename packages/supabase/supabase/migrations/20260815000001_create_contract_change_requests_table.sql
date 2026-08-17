-- Contract change requests (Phase 3): lets the patient request a change to
-- her pending contract before signing. Resolution is performed via
-- service_role after an app-level authorization check (mirrors
-- patient_invite_links), not via a bespoke role-conditional RLS UPDATE
-- policy — avoids the USING/WITH CHECK implicit-reuse gotcha that would
-- otherwise block the pending -> resolved transition.
CREATE TABLE public.contract_change_requests (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  message_html text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT contract_change_requests_resolved_consistency
    CHECK (
      (status = 'pending' AND resolved_at IS NULL AND resolved_by IS NULL)
      OR (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
    )
);

CREATE INDEX idx_contract_change_requests_contract_id ON public.contract_change_requests (contract_id);

-- Only one open request per contract at a time
CREATE UNIQUE INDEX one_pending_change_request_per_contract
  ON public.contract_change_requests (contract_id)
  WHERE status = 'pending';

ALTER TABLE public.contract_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View contract change requests" ON public.contract_change_requests FOR SELECT USING (
  public.is_team_member(patient_id)
  OR public.is_enterprise_patient(patient_id)
  OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = contract_change_requests.patient_id AND patients.user_id = auth.uid())
);

CREATE POLICY "Insert own contract change request" ON public.contract_change_requests FOR INSERT WITH CHECK (
  requested_by = auth.uid()
);

CREATE POLICY "Update contract change requests" ON public.contract_change_requests
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

GRANT SELECT, INSERT ON TABLE public.contract_change_requests TO authenticated, service_role;
GRANT UPDATE ON TABLE public.contract_change_requests TO service_role;
GRANT SELECT ON TABLE public.contract_change_requests TO anon;
