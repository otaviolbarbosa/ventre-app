-- Explicit status tracking for patient_invite_links, mirroring team_invites.status
-- (plain text, not enum — see database convention). Backfilled from the existing
-- used_at/expires_at derivation; maintained going forward by the invite-statuses
-- cron (apps/web/app/api/cron/invite-statuses) plus real-time checks on read.
ALTER TABLE public.patient_invite_links
  ADD COLUMN status text NOT NULL DEFAULT 'pendente';

UPDATE public.patient_invite_links
SET status = CASE
  WHEN used_at IS NOT NULL THEN 'usado'
  WHEN expires_at < now() THEN 'expirado'
  ELSE 'pendente'
END;
