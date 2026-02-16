-- Drop old function and recreate with pagination support
DROP FUNCTION IF EXISTS public.get_filtered_patients(uuid[], text, text);

-- Function that returns paginated patients with total count
CREATE OR REPLACE FUNCTION public.get_filtered_patients(
  patient_ids uuid[],
  filter_type text DEFAULT 'all',
  search_query text DEFAULT '',
  page_limit integer DEFAULT 10,
  page_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  name text,
  email text,
  phone text,
  date_of_birth date,
  due_date date,
  address text,
  observations text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  dum date,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.id, p.user_id, p.name, p.email, p.phone, p.date_of_birth,
    p.due_date, p.address, p.observations,
    p.created_by, p.created_at, p.updated_at, p.dum,
    COUNT(*) OVER() AS total_count
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
    p.due_date ASC
  LIMIT page_limit
  OFFSET page_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_patients(uuid[], text, text, integer, integer) TO anon, authenticated, service_role;
