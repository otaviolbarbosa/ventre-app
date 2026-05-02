CREATE TABLE public.activity_logs (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  action_name   text        NOT NULL,
  description   text        NOT NULL,
  action_type   text        NOT NULL,
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  patient_id    uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  enterprise_id uuid        NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_logs_enterprise_id_created_at_idx
  ON public.activity_logs (enterprise_id, created_at DESC);

CREATE INDEX activity_logs_user_id_idx
  ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_activity_logs"
  ON public.activity_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "staff_select_enterprise_activity_logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL   ON public.activity_logs TO service_role;
