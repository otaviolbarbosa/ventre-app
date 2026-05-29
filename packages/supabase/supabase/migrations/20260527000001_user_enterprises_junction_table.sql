-- ============================================================
-- Junction table: profissionais em múltiplas empresas
-- Migra de users.enterprise_id (1:1) para user_enterprises (N:N)
-- ============================================================

CREATE TABLE public.user_enterprises (
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, enterprise_id)
);

CREATE INDEX user_enterprises_enterprise_id_idx ON public.user_enterprises(enterprise_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.user_enterprises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_user_enterprises"
  ON public.user_enterprises FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Profissional vê suas próprias empresas
CREATE POLICY "professional_view_own_enterprises"
  ON public.user_enterprises FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Staff vê profissionais da sua empresa
CREATE POLICY "staff_view_enterprise_professionals"
  ON public.user_enterprises FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

-- ============================================================
-- Backfill: preserva relações existentes de profissionais
-- ============================================================
INSERT INTO public.user_enterprises (user_id, enterprise_id, joined_at)
SELECT id, enterprise_id, COALESCE(created_at, now())
FROM public.users
WHERE enterprise_id IS NOT NULL
  AND user_type = 'professional';

-- ============================================================
-- Zera users.enterprise_id APENAS para profissionais
-- (managers e secretaries mantêm o campo)
-- ============================================================
UPDATE public.users
SET enterprise_id = NULL
WHERE user_type = 'professional'
  AND enterprise_id IS NOT NULL;
