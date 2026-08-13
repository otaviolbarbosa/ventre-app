-- packages/supabase/supabase/migrations/20260807000001_whatsapp_appointment_reminder_cadence.sql
--
-- Estende schedule_appointment_reminders() (shadow-write de 20260805100007) para também
-- enfileirar lembretes WhatsApp em D-3/D-1/dia da consulta (cadência própria da Fase 3,
-- distinta da cadência de push de 1 dia/1 hora). Todo o corpo da função é reescrito porque
-- CREATE OR REPLACE FUNCTION exige a definição completa — nenhuma lógica de push ou de
-- scheduled_notifications é alterada, só acrescentada a seção final de WhatsApp.
CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'cancelada' THEN
    DELETE FROM public.scheduled_notifications
    WHERE reference_id = NEW.id AND reference_type = 'appointment' AND processed_at IS NULL;
    BEGIN
      PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_appointment_reminders: cancel_notifications_for_reference (cancel branch) failed for appointment %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  DELETE FROM public.scheduled_notifications
  WHERE reference_id = NEW.id AND reference_type = 'appointment' AND processed_at IS NULL;
  BEGIN
    PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'schedule_appointment_reminders: cancel_notifications_for_reference (reschedule branch) failed for appointment %: %', NEW.id, SQLERRM;
  END;

  IF NEW.status = 'agendada' THEN
    DECLARE
      appointment_datetime timestamptz;
      day_of_target timestamptz;
    BEGIN
      appointment_datetime := (NEW.date::text || ' ' || NEW.time::text)::timestamptz;

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
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification push (1_day) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;

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
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification push (1_hour) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;

      -- WhatsApp: cadência própria D-3 / D-1 / dia da consulta (spec Fase 3, Fluxo 2).
      IF appointment_datetime - INTERVAL '3 days' > now() THEN
        BEGIN
          PERFORM public.enqueue_notification(
            'whatsapp_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '3 days' - now()))::integer, 0),
            'wa_3_days'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification whatsapp (3_days) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;

      IF appointment_datetime - INTERVAL '1 day' > now() THEN
        BEGIN
          PERFORM public.enqueue_notification(
            'whatsapp_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '1 day' - now()))::integer, 0),
            'wa_1_day'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification whatsapp (1_day) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;

      day_of_target := (NEW.date::text || ' 08:00:00')::timestamptz;
      IF day_of_target > now() AND day_of_target < appointment_datetime THEN
        BEGIN
          PERFORM public.enqueue_notification(
            'whatsapp_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (day_of_target - now()))::integer, 0),
            'wa_day_of'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification whatsapp (day_of) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;
