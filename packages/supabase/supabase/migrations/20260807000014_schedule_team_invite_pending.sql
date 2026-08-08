-- packages/supabase/supabase/migrations/20260807000014_schedule_team_invite_pending.sql
CREATE OR REPLACE FUNCTION public.schedule_team_invite_pending()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  FOR invite_record IN
    SELECT id, invited_professional_id
    FROM public.team_invites
    WHERE status = 'pending'
      AND invited_professional_id IS NOT NULL
      AND expires_at > now()
      AND created_at <= now() - INTERVAL '2 days'
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'team_invite_pending', 'team_invite', invite_record.id,
        'user', invite_record.invited_professional_id, 0,
        'wa_team_invite_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_team_invite_pending: enqueue_notification failed for invite %: %', invite_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-team-invite-pending',
  '0 11 * * *',
  'SELECT public.schedule_team_invite_pending()'
);
