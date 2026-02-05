-- Drop the problematic policy that has recursive RLS dependency
DROP POLICY IF EXISTS "Professionals can create patients" ON public.patients;

-- Recreate using the SECURITY DEFINER function that bypasses RLS
CREATE POLICY "Professionals can create patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (public.is_professional());