-- Corrective backfill: completePatientRegistrationAction (and its OAuth/link-existing
-- variants) set used_at when an invite is completed, but never set status alongside it,
-- so patient_invite_links.status stayed stuck at 'pendente' for every invite completed
-- since status was introduced (20260821000001_patient_invite_links_add_status.sql).
-- The application code has been fixed to set both fields together going forward; this
-- backfills rows already affected.
UPDATE public.patient_invite_links
SET status = 'usado'
WHERE used_at IS NOT NULL
  AND status <> 'usado';
