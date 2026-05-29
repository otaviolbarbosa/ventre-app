-- ============================================================
-- Remove users.enterprise_id
-- Managers e secretaries migram para user_enterprises (N:N)
-- ============================================================

-- 1. Backfill: managers/secretaries que ainda têm enterprise_id
INSERT INTO public.user_enterprises (user_id, enterprise_id, joined_at)
SELECT id, enterprise_id, COALESCE(created_at, now())
FROM public.users
WHERE enterprise_id IS NOT NULL
  AND user_type IN ('manager', 'secretary')
ON CONFLICT (user_id, enterprise_id) DO NOTHING;

-- ============================================================
-- 2. is_enterprise_staff: não depende mais de users.enterprise_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_enterprise_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_enterprises ue ON ue.user_id = u.id
    WHERE u.id = auth.uid()
      AND u.user_type IN ('manager', 'secretary')
  );
$$;

-- ============================================================
-- 3. is_same_enterprise: usa user_enterprises nos dois lados
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_same_enterprise(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_enterprises staff_ue
    JOIN public.users staff ON staff.id = staff_ue.user_id
    JOIN public.user_enterprises target_ue ON target_ue.enterprise_id = staff_ue.enterprise_id
    WHERE staff_ue.user_id = auth.uid()
      AND staff.user_type IN ('manager', 'secretary')
      AND target_ue.user_id = p_user_id
  );
$$;

-- ============================================================
-- 4. user_enterprises: policy staff → usa user_enterprises
-- ============================================================
DROP POLICY IF EXISTS "staff_view_enterprise_professionals" ON public.user_enterprises;

CREATE POLICY "staff_view_enterprise_professionals"
  ON public.user_enterprises FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  );

-- ============================================================
-- 5. billings: policies substituídas
-- ============================================================
DROP POLICY IF EXISTS "Enterprise staff can view enterprise billings" ON public.billings;
DROP POLICY IF EXISTS "Enterprise staff can update enterprise billings" ON public.billings;
DROP POLICY IF EXISTS "Enterprise staff can delete enterprise billings" ON public.billings;

CREATE POLICY "Enterprise staff can view enterprise billings"
  ON public.billings FOR SELECT
  USING (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  );

CREATE POLICY "Enterprise staff can update enterprise billings"
  ON public.billings FOR UPDATE
  USING (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise billings"
  ON public.billings FOR DELETE
  USING (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  );

-- ============================================================
-- 6. appointments: policies substituídas
-- ============================================================
DROP POLICY IF EXISTS "Enterprise staff can view enterprise appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can update enterprise appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can delete enterprise appointments" ON public.appointments;

CREATE POLICY "Enterprise staff can view enterprise appointments"
  ON public.appointments FOR SELECT
  USING (
    (
      patient_id IS NOT NULL
      AND enterprise_id IN (
        SELECT ue.enterprise_id
        FROM public.user_enterprises ue
        JOIN public.users u ON u.id = ue.user_id
        WHERE ue.user_id = auth.uid()
          AND u.user_type IN ('manager', 'secretary')
      )
    )
    OR (
      patient_id IS NULL
      AND professional_id IN (
        SELECT prof_ue.user_id
        FROM public.user_enterprises prof_ue
        JOIN public.user_enterprises staff_ue ON staff_ue.enterprise_id = prof_ue.enterprise_id
        JOIN public.users staff ON staff.id = staff_ue.user_id
        WHERE staff_ue.user_id = auth.uid()
          AND staff.user_type IN ('manager', 'secretary')
      )
    )
  );

CREATE POLICY "Enterprise staff can update enterprise appointments"
  ON public.appointments FOR UPDATE
  USING (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise appointments"
  ON public.appointments FOR DELETE
  USING (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  );

-- ============================================================
-- 7. get_paginated_users: retorna enterprises via subquery
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_paginated_users(
  page integer DEFAULT 1,
  size integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_total_pages integer;
  v_data jsonb;
BEGIN
  v_offset := (page - 1) * size;

  SELECT COUNT(*) INTO v_total FROM public.users;

  v_total_pages := CEIL(v_total::numeric / size);

  SELECT jsonb_agg(row_to_json(u))
  INTO v_data
  FROM (
    SELECT
      usr.id,
      usr.email,
      usr.name,
      usr.user_type,
      usr.professional_type,
      usr.avatar_url,
      usr.phone,
      usr.created_at,
      usr.updated_at,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id',         ent.id,
          'name',       ent.name,
          'slug',       ent.slug,
          'legal_name', ent.legal_name,
          'cnpj',       ent.cnpj
        ))
        FROM public.user_enterprises ue
        JOIN public.enterprises ent ON ent.id = ue.enterprise_id
        WHERE ue.user_id = usr.id
      ) AS enterprises
    FROM public.users usr
    ORDER BY usr.created_at DESC
    LIMIT size
    OFFSET v_offset
  ) u;

  RETURN jsonb_build_object(
    'data', COALESCE(v_data, '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', page,
      'size', size,
      'total_pages', v_total_pages
    )
  );
END;
$$;

-- ============================================================
-- 8. subscriptions: policies substituídas
-- ============================================================
DROP POLICY IF EXISTS "Enterprise members can view enterprise subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Enterprise managers can create enterprise subscriptions" ON public.subscriptions;

CREATE POLICY "Enterprise members can view enterprise subscription"
  ON public.subscriptions FOR SELECT
  USING (
    enterprise_id IS NOT NULL
    AND enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      WHERE ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Enterprise managers can create enterprise subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (
    enterprise_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type = 'manager'
        AND ue.enterprise_id = subscriptions.enterprise_id
    )
  );

-- ============================================================
-- 9. registration_invites: policy substituída
-- ============================================================
DROP POLICY IF EXISTS "staff_select_own_enterprise_invites" ON public.registration_invites;

CREATE POLICY "staff_select_own_enterprise_invites"
  ON public.registration_invites FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  );

-- ============================================================
-- 10. activity_logs: policy substituída
-- ============================================================
DROP POLICY IF EXISTS "staff_select_enterprise_activity_logs" ON public.activity_logs;

CREATE POLICY "staff_select_enterprise_activity_logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT ue.enterprise_id
      FROM public.user_enterprises ue
      JOIN public.users u ON u.id = ue.user_id
      WHERE ue.user_id = auth.uid()
        AND u.user_type IN ('manager', 'secretary')
    )
  );

-- ============================================================
-- 11. Drop da coluna
-- ============================================================
ALTER TABLE public.users DROP COLUMN enterprise_id;
