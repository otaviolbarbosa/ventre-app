-- Scheduled notification triggers and cron functions

-- ============================================
-- 1. Trigger: auto-schedule appointment reminders
-- ============================================
CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- On cancel: remove pending scheduled notifications
  IF NEW.status = 'cancelada' THEN
    DELETE FROM public.scheduled_notifications
    WHERE reference_id = NEW.id
      AND reference_type = 'appointment'
      AND processed_at IS NULL;
    RETURN NEW;
  END IF;

  -- Remove old pending notifications for this appointment (in case of reschedule)
  DELETE FROM public.scheduled_notifications
  WHERE reference_id = NEW.id
    AND reference_type = 'appointment'
    AND processed_at IS NULL;

  -- Only schedule for future appointments with status 'agendada'
  IF NEW.status = 'agendada' THEN
    DECLARE
      appointment_datetime timestamptz;
    BEGIN
      appointment_datetime := (NEW.date::text || ' ' || NEW.time::text)::timestamptz;

      -- Schedule 1 day before (if appointment is > 1 day away)
      IF appointment_datetime - INTERVAL '1 day' > now() THEN
        INSERT INTO public.scheduled_notifications
          (notification_type, reference_id, reference_type, scheduled_for, payload)
        VALUES
          ('appointment_reminder', NEW.id, 'appointment',
           appointment_datetime - INTERVAL '1 day',
           jsonb_build_object('patient_id', NEW.patient_id, 'professional_id', NEW.professional_id, 'reminder_type', '1_day'))
        ON CONFLICT DO NOTHING;
      END IF;

      -- Schedule 1 hour before (if appointment is > 1 hour away)
      IF appointment_datetime - INTERVAL '1 hour' > now() THEN
        INSERT INTO public.scheduled_notifications
          (notification_type, reference_id, reference_type, scheduled_for, payload)
        VALUES
          ('appointment_reminder', NEW.id, 'appointment',
           appointment_datetime - INTERVAL '1 hour',
           jsonb_build_object('patient_id', NEW.patient_id, 'professional_id', NEW.professional_id, 'reminder_type', '1_hour'))
        ON CONFLICT DO NOTHING;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_change_schedule_reminders
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.schedule_appointment_reminders();

-- ============================================
-- 2. Function: schedule DPP reminders (daily cron)
-- ============================================
CREATE OR REPLACE FUNCTION public.schedule_dpp_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patient_record RECORD;
BEGIN
  FOR patient_record IN
    SELECT id, name, due_date
    FROM public.patients
    WHERE due_date IS NOT NULL
      AND due_date >= CURRENT_DATE
  LOOP
    -- 30 days before DPP
    IF patient_record.due_date - CURRENT_DATE = 30 THEN
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 30))
      ON CONFLICT DO NOTHING;
    END IF;

    -- 15 days before DPP
    IF patient_record.due_date - CURRENT_DATE = 15 THEN
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 15))
      ON CONFLICT DO NOTHING;
    END IF;

    -- 7 days before DPP
    IF patient_record.due_date - CURRENT_DATE = 7 THEN
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 7))
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ============================================
-- 3. Function: process scheduled notifications
--    (calls Edge Function via pg_net or marks for processing)
-- ============================================
CREATE OR REPLACE FUNCTION public.process_scheduled_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This function uses pg_net to call the Edge Function
  -- which processes notifications that are due
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- NOTE: pg_cron jobs must be created via the Supabase Dashboard SQL editor:
-- SELECT cron.schedule('process-notifications', '*/5 * * * *', 'SELECT public.process_scheduled_notifications()');
-- SELECT cron.schedule('schedule-dpp-reminders', '0 8 * * *', 'SELECT public.schedule_dpp_reminders()');
