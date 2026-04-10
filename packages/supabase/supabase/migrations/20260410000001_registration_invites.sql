-- Registration invites sent by enterprise staff to new professionals
CREATE TABLE public.registration_invites (
  id                uuid           PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name              text           NOT NULL,
  email             text           NOT NULL,
  phone             text           NOT NULL,
  professional_type public.professional_type NOT NULL,
  invited_by        uuid           NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enterprise_id     uuid           NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  expired_at        timestamptz    NOT NULL DEFAULT (now() + interval '7 days'),
  completed_at      timestamptz,
  created_at        timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX registration_invites_email_enterprise_idx
  ON public.registration_invites (email, enterprise_id)
  WHERE completed_at IS NULL;

ALTER TABLE public.registration_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_invites"
  ON public.registration_invites FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "staff_select_own_enterprise_invites"
  ON public.registration_invites FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

GRANT SELECT ON public.registration_invites TO authenticated;
GRANT ALL   ON public.registration_invites TO service_role;
