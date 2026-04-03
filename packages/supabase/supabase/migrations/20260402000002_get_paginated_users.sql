-- Function that returns paginated users with pagination metadata
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
      id,
      email,
      name,
      user_type,
      professional_type,
      avatar_url,
      phone,
      enterprise_id,
      created_at,
      updated_at
    FROM public.users
    ORDER BY created_at DESC
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
