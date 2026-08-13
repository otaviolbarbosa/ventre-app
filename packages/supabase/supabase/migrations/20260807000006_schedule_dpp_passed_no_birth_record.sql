-- packages/supabase/supabase/migrations/20260807000006_schedule_dpp_passed_no_birth_record.sql
CREATE OR REPLACE FUNCTION public.schedule_dpp_passed_no_birth_record()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patient_record RECORD;
BEGIN
  FOR patient_record IN
    SELECT p.id
    FROM public.patients p
    JOIN LATERAL (
      SELECT preg.due_date, preg.born_at
      FROM public.pregnancies preg
      WHERE preg.patient_id = p.id AND preg.has_finished = false
      ORDER BY preg.created_at DESC
      LIMIT 1
    ) pg ON true
    WHERE pg.due_date IS NOT NULL
      AND pg.due_date < CURRENT_DATE
      AND pg.born_at IS NULL
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'dpp_passed_no_birth_record', 'patient', patient_record.id,
        'patient', patient_record.id, 0,
        'wa_dpp_passed_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_dpp_passed_no_birth_record: enqueue_notification failed for patient %: %', patient_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-dpp-passed-no-birth-record',
  '0 8 * * *',
  'SELECT public.schedule_dpp_passed_no_birth_record()'
);
