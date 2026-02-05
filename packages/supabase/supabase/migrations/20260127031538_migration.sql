-- Function to sync auth.users updates to public.users
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name text;
  user_picture text;
  user_phone text;
BEGIN
  -- Extract name from user metadata (supports both 'name' and 'full_name' from Google OAuth)
  user_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Extract picture/avatar from user metadata
  user_picture := COALESCE(
    NEW.raw_user_meta_data->>'picture',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Extract phone from user metadata or auth.users phone field
  user_phone := COALESCE(
    NEW.raw_user_meta_data->>'phone',
    NEW.phone
  );

  -- Update the user profile only if there are changes
  UPDATE public.users
  SET
    email = NEW.email,
    name = COALESCE(user_name, name),
    avatar_url = COALESCE(user_picture, avatar_url),
    phone = COALESCE(user_phone, phone),
    updated_at = NOW()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Create trigger for user updates
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_update();