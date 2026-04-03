CREATE OR REPLACE FUNCTION public.get_paginated_subscriptions(
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

  SELECT COUNT(*) INTO v_total FROM public.subscriptions;

  v_total_pages := CEIL(v_total::numeric / size);

  SELECT jsonb_agg(row_to_json(s))
  INTO v_data
  FROM (
    SELECT
      sub.id,
      sub.status,
      sub.frequence,
      sub.expires_at,
      sub.paid_at,
      sub.created_at,
      sub.user_id,
      sub.enterprise_id,
      sub.plan_id,
      p.name  AS plan_name,
      u.name  AS user_name,
      u.email AS user_email
    FROM public.subscriptions sub
    LEFT JOIN public.plans p ON p.id = sub.plan_id
    LEFT JOIN public.users u ON u.id = sub.user_id
    ORDER BY sub.created_at DESC
    LIMIT size
    OFFSET v_offset
  ) s;

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

GRANT EXECUTE ON FUNCTION public.get_paginated_subscriptions(integer, integer) TO anon, authenticated, service_role;
