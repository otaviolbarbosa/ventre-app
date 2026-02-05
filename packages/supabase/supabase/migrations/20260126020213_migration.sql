-- Drop the now-redundant "Users can view own profile" policy
-- The "Professionals can view other professionals" policy already includes this condition
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;