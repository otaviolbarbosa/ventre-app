-- packages/supabase/supabase/migrations/20260807000003_schedule_appointment_unconfirmed.sql
CREATE OR REPLACE FUNCTION public.schedule_appointment_unconfirmed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  appointment_record RECORD;
BEGIN
  FOR appointment_record IN
    SELECT id, patient_id
    FROM public.appointments
    WHERE date = CURRENT_DATE + 1
      AND status = 'agendada'
      AND confirmed_by_patient_at IS NULL
      AND patient_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'appointment_unconfirmed', 'appointment', appointment_record.id,
        'patient', appointment_record.patient_id, 0, 'wa_unconfirmed'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_appointment_unconfirmed: enqueue_notification failed for appointment %: %', appointment_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-appointment-unconfirmed',
  '0 18 * * *',
  'SELECT public.schedule_appointment_unconfirmed()'
);
