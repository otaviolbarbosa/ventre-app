-- Function to create user profile in public.users after registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_name text;
  user_professional_type public.professional_type;
BEGIN
  -- Extract name from user metadata
  user_name := NEW.raw_user_meta_data->>'name';
  
  -- Extract and cast professional_type from user metadata
  -- Only set if it's a valid enum value
  IF NEW.raw_user_meta_data->>'professional_type' IN ('obstetra', 'enfermeiro', 'doula') THEN
    user_professional_type := (NEW.raw_user_meta_data->>'professional_type')::public.professional_type;
  ELSE
    user_professional_type := NULL;
  END IF;

  -- Insert the new user profile
  INSERT INTO public.users (id, email, name, user_type, professional_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(user_name, NEW.email), -- Fallback to email if name not provided
    'professional'::public.user_type,
    user_professional_type
  );

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();