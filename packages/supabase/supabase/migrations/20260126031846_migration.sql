-- Drop function with cascade to remove dependent policies
DROP FUNCTION IF EXISTS public.is_professional() CASCADE;

-- Recreate the function with explicit settings
CREATE OR REPLACE FUNCTION public.is_professional()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND user_type = 'professional'::public.user_type
  );
$$;

-- Ensure proper ownership and permissions
ALTER FUNCTION public.is_professional() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.is_professional() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_professional() TO anon;

-- Recreate the users SELECT policy
CREATE POLICY "Professionals can view other professionals" 
ON public.users 
FOR SELECT 
USING (
  auth.uid() = id
  OR public.is_professional()
);

-- Recreate the patients INSERT policy
CREATE POLICY "Professionals can create patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (public.is_professional());