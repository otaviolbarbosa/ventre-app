-- Fix wave (final cross-cutting review of Phase 3): the 11 new schedule_* producer
-- functions and 2 new row-trigger functions introduced by this branch (Tasks 8/9/10/
-- 11/12/13/14/16/17/19/20 and 15/18) were created without an explicit REVOKE, so they
-- inherited Postgres' default EXECUTE grant to PUBLIC (anon + authenticated). The
-- schedule_* functions are producers meant to be invoked exclusively by pg_cron
-- (elevated privileges, unaffected by this revoke); leaving them public would let any
-- authenticated (or anonymous) caller trigger notification/reminder fan-out on demand.
-- The 2 trigger functions (RETURNS trigger) can't be called via PostgREST RPC directly,
-- but there's no reason to leave them world-executable either — same pattern applied
-- for defense-in-depth, matching 20260806000003 and 20260806000004.
--
-- Separately, the Supabase linter (function_search_path_mutable) flags all 15 of these
-- SECURITY DEFINER functions (the 13 below, plus the 2 pre-existing functions modified
-- by this branch via CREATE OR REPLACE — schedule_appointment_reminders, Task 6, and
-- schedule_dpp_reminders, Task 7) for missing an explicit search_path. Sibling functions
-- in this codebase (e.g. enqueue_notification, notify_on_* triggers) already set this.
-- ALTER FUNCTION ... SET is non-destructive and doesn't require touching bodies.

REVOKE ALL ON FUNCTION public.schedule_appointment_unconfirmed() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_appointment_unconfirmed() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_appointment_unconfirmed() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_contract_pending_signature() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_contract_pending_signature() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_contract_pending_signature() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_daily_agenda_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_daily_agenda_summary() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_daily_agenda_summary() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_dpp_passed_no_birth_record() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_dpp_passed_no_birth_record() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_dpp_passed_no_birth_record() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_installment_overdue_professional() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_installment_overdue_professional() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_installment_overdue_professional() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_installment_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_installment_reminders() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_installment_reminders() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_installment_under_review_stalled() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_installment_under_review_stalled() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_installment_under_review_stalled() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_monthly_billing_report() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_monthly_billing_report() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_monthly_billing_report() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_prenatal_followup_gap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_prenatal_followup_gap() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_prenatal_followup_gap() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_subscription_billing_issue() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_subscription_billing_issue() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_subscription_billing_issue() TO service_role;

REVOKE ALL ON FUNCTION public.schedule_team_invite_pending() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_team_invite_pending() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_team_invite_pending() TO service_role;

REVOKE ALL ON FUNCTION public.notify_payment_received() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_payment_received() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_payment_received() TO service_role;

REVOKE ALL ON FUNCTION public.notify_appointment_last_minute_cancel() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_appointment_last_minute_cancel() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_appointment_last_minute_cancel() TO service_role;

-- SET search_path = public for all 15 SECURITY DEFINER functions touched by Phase 3
-- (the 13 above, plus 2 pre-existing functions modified via CREATE OR REPLACE in this
-- branch that never had search_path set either).
ALTER FUNCTION public.schedule_appointment_unconfirmed() SET search_path = public;
ALTER FUNCTION public.schedule_contract_pending_signature() SET search_path = public;
ALTER FUNCTION public.schedule_daily_agenda_summary() SET search_path = public;
ALTER FUNCTION public.schedule_dpp_passed_no_birth_record() SET search_path = public;
ALTER FUNCTION public.schedule_installment_overdue_professional() SET search_path = public;
ALTER FUNCTION public.schedule_installment_reminders() SET search_path = public;
ALTER FUNCTION public.schedule_installment_under_review_stalled() SET search_path = public;
ALTER FUNCTION public.schedule_monthly_billing_report() SET search_path = public;
ALTER FUNCTION public.schedule_prenatal_followup_gap() SET search_path = public;
ALTER FUNCTION public.schedule_subscription_billing_issue() SET search_path = public;
ALTER FUNCTION public.schedule_team_invite_pending() SET search_path = public;
ALTER FUNCTION public.notify_payment_received() SET search_path = public;
ALTER FUNCTION public.notify_appointment_last_minute_cancel() SET search_path = public;
ALTER FUNCTION public.schedule_appointment_reminders() SET search_path = public;
ALTER FUNCTION public.schedule_dpp_reminders() SET search_path = public;
