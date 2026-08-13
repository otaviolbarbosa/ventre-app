-- packages/supabase/supabase/migrations/20260807000004_schedule_installment_reminders.sql
CREATE OR REPLACE FUNCTION public.schedule_installment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  installment_record RECORD;
  v_dedup_key text;
BEGIN
  FOR installment_record IN
    SELECT i.id, i.status, b.patient_id
    FROM public.installments i
    JOIN public.billings b ON b.id = i.billing_id
    WHERE (i.status = 'pendente' AND i.due_date - CURRENT_DATE = 3)
       OR i.status = 'atrasado'
  LOOP
    v_dedup_key := CASE
      WHEN installment_record.status = 'atrasado' THEN 'wa_overdue_' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
      ELSE 'wa_due_soon'
    END;

    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'installment_payment_reminder', 'installment', installment_record.id,
        'patient', installment_record.patient_id, 0, v_dedup_key
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_installment_reminders: enqueue_notification failed for installment %: %', installment_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-installment-reminders',
  '0 9 * * *',
  'SELECT public.schedule_installment_reminders()'
);
