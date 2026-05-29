-- ============================================================
-- Reescrita das funções helper de RLS
-- is_enterprise_staff() — SEM MUDANÇA (mantém users.enterprise_id para staff)
-- is_same_enterprise()  — reescreve para usar user_enterprises
-- is_enterprise_patient() — reescreve para ancorar em pregnancies.enterprise_id
-- ============================================================

-- is_same_enterprise: agora cruza staff.enterprise_id com user_enterprises
-- (em vez de fazer self-join em users.enterprise_id)
CREATE OR REPLACE FUNCTION public.is_same_enterprise(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users staff
    JOIN public.user_enterprises ue ON ue.enterprise_id = staff.enterprise_id
    WHERE staff.id = auth.uid()
      AND staff.user_type IN ('manager', 'secretary')
      AND staff.enterprise_id IS NOT NULL
      AND ue.user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_same_enterprise(uuid) TO anon, authenticated, service_role;

-- is_enterprise_patient: agora ancora em pregnancies.enterprise_id
-- Não depende mais do criador do paciente (patients.created_by → users.enterprise_id)
CREATE OR REPLACE FUNCTION public.is_enterprise_patient(p_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users staff
    WHERE staff.id = auth.uid()
      AND staff.user_type IN ('manager', 'secretary')
      AND staff.enterprise_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pregnancies preg
        WHERE preg.patient_id = p_patient_id
          AND preg.enterprise_id = staff.enterprise_id
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_enterprise_patient(uuid) TO anon, authenticated, service_role;
