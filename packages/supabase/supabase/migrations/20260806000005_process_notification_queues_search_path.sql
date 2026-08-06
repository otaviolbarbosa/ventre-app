-- Fix wave (final cross-cutting review): process_notification_queues() is the only new
-- SECURITY DEFINER function in this plan missing an explicit SET search_path. It calls
-- current_setting() (schema-independent) and net.http_get() (schema 'net'), so add
-- 'public, net' to match the pattern used by process_scheduled_notifications()
-- (20260209000001_notification_cron.sql), which this function mirrors.
CREATE OR REPLACE FUNCTION public.process_notification_queues()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_web_app_url text := current_setting('app.settings.web_app_url', true);
  v_cron_secret text := current_setting('app.settings.cron_secret', true);
BEGIN
  IF v_web_app_url IS NULL OR v_cron_secret IS NULL THEN
    RAISE NOTICE 'process_notification_queues: app.settings.web_app_url or app.settings.cron_secret not configured, skipping';
    RETURN;
  END IF;

  PERFORM net.http_get(
    url := v_web_app_url || '/api/cron/process-notification-queues',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_cron_secret)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_notification_queues FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_notification_queues FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_notification_queues TO service_role;
