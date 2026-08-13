-- packages/supabase/supabase/migrations/20260807000007_schedule_prenatal_followup_gap.sql
CREATE OR REPLACE FUNCTION public.schedule_prenatal_followup_gap()
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
      SELECT preg.has_finished
      FROM public.pregnancies preg
      WHERE preg.patient_id = p.id AND preg.has_finished = false
      ORDER BY preg.created_at DESC
      LIMIT 1
    ) pg ON true
    WHERE (
      SELECT MAX(a.date) FROM public.appointments a
      WHERE a.patient_id = p.id AND a.status = 'realizada'
    ) <= CURRENT_DATE - 45
    AND NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.patient_id = p.id AND a.status = 'agendada' AND a.date >= CURRENT_DATE
    )
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'prenatal_followup_gap', 'patient', patient_record.id,
        'patient', patient_record.id, 0,
        'wa_followup_gap_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_prenatal_followup_gap: enqueue_notification failed for patient %: %', patient_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-prenatal-followup-gap',
  '0 9 * * *',
  'SELECT public.schedule_prenatal_followup_gap()'
);
