-- ============================================================
-- Substitui policies de billings e appointments
-- por versão direta em enterprise_id (mais eficiente)
-- ============================================================

-- ============================================================
-- billings — substitui policy baseada em is_enterprise_patient
-- ============================================================

DROP POLICY IF EXISTS "Enterprise staff can view enterprise billings" ON public.billings;
DROP POLICY IF EXISTS "Enterprise staff can create enterprise billings" ON public.billings;
DROP POLICY IF EXISTS "Enterprise staff can update enterprise billings" ON public.billings;
DROP POLICY IF EXISTS "Enterprise staff can delete enterprise billings" ON public.billings;

CREATE POLICY "Enterprise staff can view enterprise billings"
  ON public.billings FOR SELECT
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

CREATE POLICY "Enterprise staff can create enterprise billings"
  ON public.billings FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise billings"
  ON public.billings FOR UPDATE
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise billings"
  ON public.billings FOR DELETE
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

-- ============================================================
-- appointments — substitui todas as policies enterprise
-- (inclui as corrigidas nas migrations 20260513000002 e 20260513000004)
-- ============================================================

DROP POLICY IF EXISTS "Enterprise staff can view enterprise appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can create enterprise appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can update enterprise appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can delete enterprise appointments" ON public.appointments;

CREATE POLICY "Enterprise staff can view enterprise appointments"
  ON public.appointments FOR SELECT
  USING (
    (
      patient_id IS NOT NULL
      AND enterprise_id IN (
        SELECT enterprise_id FROM public.users
        WHERE id = auth.uid()
          AND user_type IN ('manager', 'secretary')
          AND enterprise_id IS NOT NULL
      )
    )
    OR (
      patient_id IS NULL
      AND professional_id IN (
        SELECT ue.user_id FROM public.user_enterprises ue
        JOIN public.users staff ON staff.enterprise_id = ue.enterprise_id
        WHERE staff.id = auth.uid()
          AND staff.user_type IN ('manager', 'secretary')
          AND staff.enterprise_id IS NOT NULL
      )
    )
  );

CREATE POLICY "Enterprise staff can create enterprise appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise appointments"
  ON public.appointments FOR UPDATE
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise appointments"
  ON public.appointments FOR DELETE
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );
