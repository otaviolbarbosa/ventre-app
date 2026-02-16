-- Drop old function signature and recreate with search_query parameter
DROP FUNCTION IF EXISTS public.get_filtered_patients(uuid[], text);

CREATE OR REPLACE FUNCTION public.get_filtered_patients(
  patient_ids uuid[],
  filter_type text DEFAULT 'all',
  search_query text DEFAULT ''
)
RETURNS SETOF public.patients
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT p.*
  FROM public.patients p
  WHERE p.id = ANY(patient_ids)
    AND (
      search_query = ''
      OR p.name ILIKE '%' || search_query || '%'
    )
    AND (
      filter_type = 'all'
      OR filter_type = 'recent'
      OR (filter_type = 'trim1' AND public.gestational_weeks(p.dum) < 13)
      OR (filter_type = 'trim2' AND public.gestational_weeks(p.dum) >= 13 AND public.gestational_weeks(p.dum) < 26)
      OR (filter_type = 'trim3' AND public.gestational_weeks(p.dum) >= 26)
      OR (filter_type = 'final' AND public.gestational_weeks(p.dum) >= 37)
    )
  ORDER BY
    CASE WHEN filter_type = 'recent' THEN p.created_at END DESC,
    p.due_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_patients(uuid[], text, text) TO anon, authenticated, service_role;
