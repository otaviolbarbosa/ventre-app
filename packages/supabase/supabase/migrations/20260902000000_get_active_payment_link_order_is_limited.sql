CREATE OR REPLACE FUNCTION public.get_active_payment_link(
  p_plan_id uuid,
  p_frequence public.subscription_frequence
)
RETURNS public.stripe_payment_link
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.stripe_payment_link
  WHERE plan_id = p_plan_id
    AND frequence = p_frequence
    AND is_active
    AND NOT (is_limited AND used_subscription >= total_subscriptions)
  ORDER BY is_priority DESC, is_limited DESC, is_primary DESC, created_at DESC
  LIMIT 1
$$;
