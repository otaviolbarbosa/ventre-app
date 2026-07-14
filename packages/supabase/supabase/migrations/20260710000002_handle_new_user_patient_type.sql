-- Fix handle_new_user to respect user_type metadata so patient self-registration
-- signups are created as user_type='patient' instead of always 'professional'.
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
  user_name := NEW.raw_user_meta_data->>'name';

  IF NEW.raw_user_meta_data->>'user_type' = 'patient' THEN
    INSERT INTO public.users (id, email, name, user_type, professional_type)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(user_name, NEW.email),
      'patient'::public.user_type,
      NULL
    );
  ELSE
    IF NEW.raw_user_meta_data->>'professional_type' IN ('obstetra', 'enfermeiro', 'doula') THEN
      user_professional_type := (NEW.raw_user_meta_data->>'professional_type')::public.professional_type;
    ELSE
      user_professional_type := NULL;
    END IF;

    INSERT INTO public.users (id, email, name, user_type, professional_type)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(user_name, NEW.email),
      'professional'::public.user_type,
      user_professional_type
    );
  END IF;

  RETURN NEW;
END;
$$;
