-- Fix call_send_notification: update edge function URL to ventre-send-notification.

CREATE OR REPLACE FUNCTION public.call_send_notification(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url     text;
  v_service_role_key text;
BEGIN
  SELECT decrypted_secret INTO v_supabase_url
    FROM vault.decrypted_secrets
   WHERE name = 'supabase_url'
   LIMIT 1;

  SELECT decrypted_secret INTO v_service_role_key
    FROM vault.decrypted_secrets
   WHERE name = 'supabase_service_role_key'
   LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_role_key IS NULL THEN
    RETURN; -- secrets not configured yet, skip silently
  END IF;

  PERFORM net.http_post(
    url     := v_supabase_url || '/functions/v1/ventre-send-notification',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_service_role_key
               ),
    body    := p_payload
  );
EXCEPTION WHEN OTHERS THEN
  NULL; -- fire-and-forget: never fail the originating transaction
END;
$$;
