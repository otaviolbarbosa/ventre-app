-- Create a SECURITY DEFINER function to check if current user is a professional
-- This bypasses RLS to avoid the recursive dependency issue
CREATE OR REPLACE FUNCTION public.is_professional()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND user_type = 'professional'::public.user_type
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_professional() TO authenticated;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Professionals can view other professionals" ON public.users;

-- Recreate the policy using the SECURITY DEFINER function
CREATE POLICY "Professionals can view other professionals" 
ON public.users 
FOR SELECT 
USING (
  auth.uid() = id  -- Can always view own profile
  OR public.is_professional()  -- Professionals can view all users
);