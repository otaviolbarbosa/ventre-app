-- Fix wave (final cross-cutting review): notification_log.updated_at has no BEFORE
-- UPDATE trigger, so it never changes from created_at even when a row is later updated
-- (e.g. status transitions). Apply the repo's existing reusable trigger function
-- public.handle_updated_at() (see 20260126012100_remote_schema.sql), already used by
-- subscriptions/pregnancies/billing tables, for consistency.
CREATE TRIGGER handle_notification_log_updated_at
  BEFORE UPDATE ON public.notification_log
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
