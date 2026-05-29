-- ============================================================
-- Fix infinite recursion in user_enterprises RLS
--
-- The "staff_view_enterprise_professionals" policy was querying
-- user_enterprises from within a user_enterprises RLS policy,
-- causing infinite recursion. Any table whose RLS accessed
-- user_enterprises (appointments, billings, etc.) would fail
-- silently with an empty result.
--
-- Fix: wrap the staff enterprise lookup in a SECURITY DEFINER
-- function so it bypasses RLS on user_enterprises.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_staff_enterprise_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ue.enterprise_id
  FROM public.user_enterprises ue
  JOIN public.users u ON u.id = ue.user_id
  WHERE ue.user_id = auth.uid()
    AND u.user_type IN ('manager', 'secretary');
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_enterprise_ids() TO anon, authenticated, service_role;

-- Recreate the policy using the SECURITY DEFINER function
DROP POLICY IF EXISTS "staff_view_enterprise_professionals" ON public.user_enterprises;

CREATE POLICY "staff_view_enterprise_professionals"
  ON public.user_enterprises FOR SELECT TO authenticated
  USING (
    enterprise_id IN (SELECT public.get_staff_enterprise_ids())
  );
