-- packages/supabase/supabase/migrations/20260810000002_pgmq_only_appointment_dpp_reminders.sql
--
-- Fase 5 (cleanup): remove o caminho scheduled_notifications (INSERT/DELETE) de
-- schedule_appointment_reminders() e schedule_dpp_reminders(), deixando só os
-- enqueue_notification/cancel_notifications_for_reference já em produção desde as
-- Fases 1 e 3. Pré-condição: Task 1 (jobid 1 desagendado) e Task 3 (rota
-- billing-notifications retirada) já aplicadas — nada mais lê scheduled_notifications.

CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'cancelada' THEN
    BEGIN
      PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_appointment_reminders: cancel_notifications_for_reference (cancel branch) failed for appointment %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

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

CREATE OR REPLACE FUNCTION public.schedule_dpp_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patient_record RECORD;
BEGIN
  FOR patient_record IN
    SELECT p.id, p.name, pg.due_date
    FROM public.patients p
    JOIN LATERAL (
      SELECT preg.due_date
      FROM public.pregnancies preg
      WHERE preg.patient_id = p.id
        AND preg.has_finished = false
      ORDER BY preg.created_at DESC
      LIMIT 1
    ) pg ON true
    WHERE pg.due_date IS NOT NULL
      AND pg.due_date >= CURRENT_DATE
  LOOP
    IF patient_record.due_date - CURRENT_DATE = 30 THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, '30_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification push (30_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;

      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, 'wa_30_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification whatsapp (30_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
    END IF;

    IF patient_record.due_date - CURRENT_DATE = 15 THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, '15_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification push (15_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;

      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, 'wa_15_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification whatsapp (15_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
    END IF;

    IF patient_record.due_date - CURRENT_DATE = 7 THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, '7_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification push (7_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;

      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, 'wa_7_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification whatsapp (7_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;
