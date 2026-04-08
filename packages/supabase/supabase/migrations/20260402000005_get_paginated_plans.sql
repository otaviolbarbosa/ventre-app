CREATE OR REPLACE FUNCTION public.get_paginated_plans(
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

  SELECT COUNT(*) INTO v_total FROM public.plans;

  v_total_pages := CEIL(v_total::numeric / size);

  SELECT jsonb_agg(row_to_json(p))
  INTO v_data
  FROM (
    SELECT
      id,
      name,
      slug,
      description,
      type,
      value,
      benefits
    FROM public.plans
    ORDER BY value ASC
    LIMIT size
    OFFSET v_offset
  ) p;

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

GRANT EXECUTE ON FUNCTION public.get_paginated_plans(integer, integer) TO anon, authenticated, service_role;
