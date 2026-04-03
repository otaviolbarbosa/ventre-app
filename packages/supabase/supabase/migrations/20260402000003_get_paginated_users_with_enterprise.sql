-- Recreate get_paginated_users including enterprise data via LEFT JOIN
CREATE OR REPLACE FUNCTION public.get_paginated_users(
  page integer DEFAULT 1,
  size integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_total_pages integer;
  v_data jsonb;
BEGIN
  v_offset := (page - 1) * size;

  SELECT COUNT(*) INTO v_total FROM public.users;

  v_total_pages := CEIL(v_total::numeric / size);

  SELECT jsonb_agg(row_to_json(u))
  INTO v_data
  FROM (
    SELECT
      usr.id,
      usr.email,
      usr.name,
      usr.user_type,
      usr.professional_type,
      usr.avatar_url,
      usr.phone,
      usr.enterprise_id,
      usr.created_at,
      usr.updated_at,
      CASE
        WHEN usr.enterprise_id IS NOT NULL THEN
          jsonb_build_object(
            'id',         ent.id,
            'name',       ent.name,
            'slug',       ent.slug,
            'legal_name', ent.legal_name,
            'cnpj',       ent.cnpj
          )
        ELSE NULL
      END AS enterprise
    FROM public.users usr
    LEFT JOIN public.enterprises ent ON ent.id = usr.enterprise_id
    ORDER BY usr.created_at DESC
    LIMIT size
    OFFSET v_offset
  ) u;

  RETURN jsonb_build_object(
    'data', COALESCE(v_data, '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', page,
      'size', size,
      'total_pages', v_total_pages
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_paginated_users(integer, integer) TO anon, authenticated, service_role;