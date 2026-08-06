-- Shadow-write dpp reminders to pgmq (Task 11).
--
-- schedule_dpp_reminders() is invoked once a day by pg_cron (job "schedule-dpp-reminders"),
-- scanning all patients with an active pregnancy and enqueuing dpp_approaching reminders at
-- 30/15/7 days before the due date. This is not a row trigger, so there is no pending-message
-- cancellation logic here — the daily run + scheduled_notifications' ON CONFLICT DO NOTHING
-- already prevents duplicate old-path rows, and enqueue_notification's dedup_key gives the
-- same protection on the pgmq side.
--
-- Each new PERFORM public.enqueue_notification(...) call is wrapped in its own nested
-- BEGIN/EXCEPTION/END block (same pattern established and human-approved in Task 10's
-- schedule_appointment_reminders() migration): a nested block creates an implicit savepoint,
-- so a pgmq-side failure is caught, logged via RAISE WARNING, and does not abort the real
-- scheduled_notifications INSERT or the rest of the daily cron run. The existing
-- scheduled_notifications INSERT ... ON CONFLICT DO NOTHING statements are left unguarded and
-- unchanged — they must keep failing loudly, since they are the proven, existing behavior.

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
    -- 30 days before DPP
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
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification (30_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
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

      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, '15_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification (15_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
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

      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, '7_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification (7_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;
