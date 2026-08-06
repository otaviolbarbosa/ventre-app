-- Fix wave (final cross-cutting review): the worker route's whatsapp_notifications peek
-- (dequeueNotifications with qty=1) is a destructive read — it burns read_ct on the head
-- message every minute once Phase 2 adds a producer, without ever acking it. Add a
-- read-only wrapper around pgmq.metrics() so the route can check queue depth without
-- touching message visibility/read_ct.
CREATE OR REPLACE FUNCTION public.notification_queue_length(p_queue_name text)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT queue_length FROM pgmq.metrics(p_queue_name);
$$;

REVOKE ALL ON FUNCTION public.notification_queue_length FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notification_queue_length FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_queue_length TO service_role;
