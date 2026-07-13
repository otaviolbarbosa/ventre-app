-- Extend patient_invite_links to support self-registration invites (invite_type='new_patient')
-- in addition to the existing link-existing-patient flow (invite_type='link_existing').

ALTER TABLE public.patient_invite_links
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '7 days');

ALTER TABLE public.patient_invite_links
  ADD COLUMN invite_type   text NOT NULL DEFAULT 'link_existing'
    CHECK (invite_type IN ('new_patient', 'link_existing')),
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE CASCADE,
  ADD COLUMN name          text,
  ADD COLUMN email         text,
  ADD COLUMN phone         text,
  ADD COLUMN metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD CONSTRAINT patient_invite_links_link_existing_requires_patient
    CHECK (invite_type = 'new_patient' OR patient_id IS NOT NULL);

ALTER TABLE public.patient_invite_links DROP CONSTRAINT patient_invite_links_token_key;
ALTER TABLE public.patient_invite_links DROP COLUMN token;

DROP POLICY "Create invite links" ON public.patient_invite_links;
CREATE POLICY "Create invite links" ON public.patient_invite_links
  FOR INSERT WITH CHECK (
    (invite_type = 'link_existing' AND public.is_team_member(patient_id))
    OR (invite_type = 'new_patient' AND patient_id IS NULL AND created_by = auth.uid())
  );

DROP POLICY "Update invite links" ON public.patient_invite_links;
CREATE POLICY "Update invite links" ON public.patient_invite_links
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
