-- packages/supabase/supabase/migrations/20260807000009_schedule_daily_agenda_summary.sql
CREATE OR REPLACE FUNCTION public.schedule_daily_agenda_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  professional_record RECORD;
BEGIN
  FOR professional_record IN
    SELECT professional_id, count(*) AS appointment_count
    FROM public.appointments
    WHERE date = CURRENT_DATE AND status = 'agendada' AND professional_id IS NOT NULL
    GROUP BY professional_id
    HAVING count(*) > 0
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'daily_agenda_summary', 'user', professional_record.professional_id,
        'user', professional_record.professional_id, 0,
        'wa_daily_agenda_' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_daily_agenda_summary: enqueue_notification failed for professional %: %', professional_record.professional_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-daily-agenda-summary',
  '0 7 * * *',
  'SELECT public.schedule_daily_agenda_summary()'
);
