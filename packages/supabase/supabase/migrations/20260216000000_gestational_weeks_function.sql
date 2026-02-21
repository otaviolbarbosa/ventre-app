-- Function to calculate gestational weeks from DUM (Data da Última Menstruação)
CREATE OR REPLACE FUNCTION public.gestational_weeks(dum date)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN dum IS NULL THEN NULL
    ELSE FLOOR((CURRENT_DATE - dum) / 7)::integer
  END
$$;

GRANT EXECUTE ON FUNCTION public.gestational_weeks(date) TO anon, authenticated, service_role;
