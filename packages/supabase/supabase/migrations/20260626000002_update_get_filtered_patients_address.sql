DROP FUNCTION IF EXISTS public.get_filtered_patients(uuid[], text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_filtered_patients(
  patient_ids uuid[],
  filter_type text DEFAULT 'all'::text,
  search_query text DEFAULT ''::text,
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
  address jsonb,
  observations text,
  created_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  dum date,
  has_finished boolean,
  born_at date,
  delivery_method delivery_method,
  total_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
AS $function$
  SELECT
    p.id, p.user_id, p.name, p.email, p.phone, p.date_of_birth,
    pg.due_date,
    CASE WHEN addr.id IS NOT NULL THEN
      jsonb_strip_nulls(jsonb_build_object(
        'street',       addr.street,
        'number',       addr.number,
        'complement',   addr.complement,
        'neighborhood', addr.neighborhood,
        'city',         addr.city,
        'state',        addr.state,
        'zipcode',      addr.zipcode
      ))
    ELSE NULL END AS address,
    pg.observations,
    p.created_by, p.created_at, p.updated_at,
    pg.dum,
    pg.has_finished,
    pg.born_at,
    pg.delivery_method,
    COUNT(*) OVER() AS total_count
  FROM public.patients p
  JOIN LATERAL (
    SELECT preg.*
    FROM public.pregnancies preg
    WHERE preg.patient_id = p.id
    ORDER BY preg.created_at DESC
    LIMIT 1
  ) pg ON true
  LEFT JOIN public.addresses addr ON addr.patient_id = p.id
  WHERE p.id = ANY(patient_ids)
    AND (
      search_query = ''
      OR p.name ILIKE '%' || search_query || '%'
    )
    AND pg.has_finished = (filter_type = 'finished')
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_filtered_patients(uuid[], text, text, integer, integer) TO anon, authenticated, service_role;
