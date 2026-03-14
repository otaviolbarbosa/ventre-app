-- Replace single address field with structured address fields on patients table
ALTER TABLE public.patients
  DROP COLUMN IF EXISTS address,
  ADD COLUMN street text,
  ADD COLUMN number text,
  ADD COLUMN complement text,
  ADD COLUMN neighborhood text,
  ADD COLUMN city text,
  ADD COLUMN state text,
  ADD COLUMN zipcode text;

-- Recreate get_filtered_patients to use new address fields instead of address,
-- preserving the JOIN LATERAL with pregnancies introduced in 20260313000001.
DROP FUNCTION IF EXISTS public.get_filtered_patients(uuid[], text, text, integer, integer);

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
  street text,
  neighborhood text,
  complement text,
  number text,
  city text,
  state text,
  zipcode text,
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
    pg.due_date,
    p.street, p.neighborhood, p.complement, p.number, p.city, p.state, p.zipcode,
    pg.observations,
    p.created_by, p.created_at, p.updated_at, pg.dum,
    COUNT(*) OVER() AS total_count
  FROM public.patients p
  JOIN LATERAL (
    SELECT preg.*
    FROM public.pregnancies preg
    WHERE preg.patient_id = p.id
    ORDER BY preg.created_at DESC
    LIMIT 1
  ) pg ON true
  WHERE p.id = ANY(patient_ids)
    AND (
      search_query = ''
      OR p.name ILIKE '%' || search_query || '%'
    )
    AND (pg.has_finished = false OR filter_type = 'finished')
    AND (
      filter_type = 'all'
      OR filter_type = 'recent'
      OR filter_type = 'finished'
      OR (filter_type = 'trim1' AND public.gestational_weeks(pg.dum) < 13)
      OR (filter_type = 'trim2' AND public.gestational_weeks(pg.dum) >= 13 AND public.gestational_weeks(pg.dum) < 26)
      OR (filter_type = 'trim3' AND public.gestational_weeks(pg.dum) >= 26)
      OR (filter_type = 'final' AND public.gestational_weeks(pg.dum) >= 37)
    )
  ORDER BY
    CASE WHEN filter_type = 'recent'   THEN p.created_at END DESC,
    CASE WHEN filter_type = 'finished' THEN pg.born_at   END DESC NULLS LAST,
    pg.due_date ASC
  LIMIT page_limit
  OFFSET page_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_filtered_patients(uuid[], text, text, integer, integer) TO anon, authenticated, service_role;
