-- packages/supabase/supabase/migrations/20260807000013_notify_appointment_last_minute_cancel_trigger.sql
CREATE OR REPLACE FUNCTION public.notify_appointment_last_minute_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  appointment_datetime timestamptz;
BEGIN
  IF NEW.status = 'cancelada' AND OLD.status = 'agendada' AND NEW.professional_id IS NOT NULL THEN
    appointment_datetime := (NEW.date::text || ' ' || NEW.time::text)::timestamptz;

    IF appointment_datetime > now() AND appointment_datetime - now() <= INTERVAL '24 hours' THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'appointment_last_minute_cancel', 'appointment', NEW.id,
          'user', NEW.professional_id, 0, ''
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_appointment_last_minute_cancel: enqueue_notification failed for appointment %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_last_minute_cancel
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_appointment_last_minute_cancel();
