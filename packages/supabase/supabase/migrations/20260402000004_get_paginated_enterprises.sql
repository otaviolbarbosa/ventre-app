CREATE OR REPLACE FUNCTION public.get_paginated_enterprises(
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

  SELECT COUNT(*) INTO v_total FROM public.enterprises;

  v_total_pages := CEIL(v_total::numeric / size);

  SELECT jsonb_agg(row_to_json(e))
  INTO v_data
  FROM (
    SELECT
      id,
      name,
      legal_name,
      slug,
      cnpj,
      email,
      phone,
      is_active,
      professionals_amount,
      created_at
    FROM public.enterprises
    ORDER BY created_at DESC
    LIMIT size
    OFFSET v_offset
  ) e;

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

GRANT EXECUTE ON FUNCTION public.get_paginated_enterprises(integer, integer) TO anon, authenticated, service_role;
