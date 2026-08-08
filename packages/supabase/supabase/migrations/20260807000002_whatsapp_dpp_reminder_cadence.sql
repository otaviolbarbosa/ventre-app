-- packages/supabase/supabase/migrations/20260807000002_whatsapp_dpp_reminder_cadence.sql
--
-- Estende schedule_dpp_reminders() (shadow-write de 20260805100008) para também enfileirar em
-- whatsapp_notifications, espelhando exatamente as janelas de 30/15/7 dias já usadas para push.
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
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 30))
      ON CONFLICT DO NOTHING;

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
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 15))
      ON CONFLICT DO NOTHING;

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
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 7))
      ON CONFLICT DO NOTHING;

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
