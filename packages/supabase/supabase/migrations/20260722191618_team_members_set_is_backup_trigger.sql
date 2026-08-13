-- Define automaticamente is_backup ao inserir em team_members:
-- se já existe titular (is_backup = false) para a mesma especialidade
-- na gestação, o novo membro entra como backup; caso contrário, como titular.
CREATE OR REPLACE FUNCTION public.set_team_member_is_backup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE pregnancy_id = NEW.pregnancy_id
      AND professional_type = NEW.professional_type
      AND is_backup = false
  ) THEN
    NEW.is_backup := true;
  ELSE
    NEW.is_backup := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER team_members_set_is_backup
  BEFORE INSERT ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.set_team_member_is_backup();
