-- replace_active_subscriptions_before_insert replaced ANY active subscription for NEW.user_id,
-- including the very row being upserted via sync_checkout_session_to_subscriptions()'s
-- INSERT ... ON CONFLICT (subscription_id) DO UPDATE. On a webhook redelivery for an
-- already-active subscription, this BEFORE INSERT trigger marks that same row 'replaced'
-- before the ON CONFLICT path resolves, and Postgres then refuses to touch it again in the
-- same command ("ON CONFLICT DO UPDATE command cannot affect row a second time"), aborting
-- the whole upsert.
CREATE OR REPLACE FUNCTION public.replace_active_subscriptions_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.subscriptions
  SET status = 'replaced',
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND status = 'active'
    AND subscription_id != NEW.subscription_id;

  RETURN NEW;
END;
$function$;
