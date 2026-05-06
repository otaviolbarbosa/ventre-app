-- Fix call_send_notification: remove dependency on app.settings (requires superuser).
-- Reads both the Supabase URL and service role key from Vault, keeping each environment
-- (staging, production) fully independent without hardcoded values.
--
-- PREREQUISITE: before running pnpm db:push, add both secrets once per environment
-- via SQL Editor:
--   SELECT vault.create_secret('<your-supabase-url>', 'supabase_url', 'Supabase project URL used by triggers to call edge functions');
--   SELECT vault.create_secret('<your-service-role-key>', 'supabase_service_role_key', 'Service role key used by triggers to call edge functions');

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
    url     := v_supabase_url || '/functions/v1/send-notification',
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
