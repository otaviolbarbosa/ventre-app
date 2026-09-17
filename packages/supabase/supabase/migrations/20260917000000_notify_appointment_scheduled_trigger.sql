-- packages/supabase/supabase/migrations/20260917000000_notify_appointment_scheduled_trigger.sql
CREATE OR REPLACE FUNCTION public.notify_appointment_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'agendada' AND NEW.patient_id IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'appointment_scheduled', 'appointment', NEW.id,
        'patient', NEW.patient_id, 0, ''
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_appointment_scheduled: enqueue_notification failed for appointment %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_scheduled
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_appointment_scheduled();
