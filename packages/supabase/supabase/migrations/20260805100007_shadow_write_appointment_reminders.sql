-- Shadow-write appointment reminders into the new pgmq-based notification queue,
-- alongside the existing scheduled_notifications path (which is left completely
-- unchanged). This is additive only: no old statement/condition is modified.
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
    BEGIN
      PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_appointment_reminders: cancel_notifications_for_reference (cancel branch) failed for appointment %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  -- Remove old pending notifications for this appointment (in case of reschedule)
  DELETE FROM public.scheduled_notifications
  WHERE reference_id = NEW.id
    AND reference_type = 'appointment'
    AND processed_at IS NULL;
  BEGIN
    PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'schedule_appointment_reminders: cancel_notifications_for_reference (reschedule branch) failed for appointment %: %', NEW.id, SQLERRM;
  END;

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

        BEGIN
          PERFORM public.enqueue_notification(
            'push_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '1 day' - now()))::integer, 0),
            '1_day'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification (1_day) failed for appointment %: %', NEW.id, SQLERRM;
        END;
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

        BEGIN
          PERFORM public.enqueue_notification(
            'push_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '1 hour' - now()))::integer, 0),
            '1_hour'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification (1_hour) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;
