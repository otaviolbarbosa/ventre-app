-- ============================================================
-- Corrige is_enterprise_patient() que ainda referenciava
-- users.enterprise_id (removida em 20260528000001)
-- Agora cruza via user_enterprises
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_enterprise_patient(p_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.user_enterprises ue ON ue.user_id = u.id
    WHERE u.id = auth.uid()
      AND u.user_type IN ('manager', 'secretary')
      AND EXISTS (
        SELECT 1 FROM public.pregnancies preg
        WHERE preg.patient_id = p_patient_id
          AND preg.enterprise_id = ue.enterprise_id
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_enterprise_patient(uuid) TO anon, authenticated, service_role;
