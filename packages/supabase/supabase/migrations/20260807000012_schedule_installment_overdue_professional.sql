-- packages/supabase/supabase/migrations/20260807000012_schedule_installment_overdue_professional.sql
CREATE OR REPLACE FUNCTION public.schedule_installment_overdue_professional()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  installment_record RECORD;
BEGIN
  FOR installment_record IN
    SELECT i.id, p.created_by AS professional_id
    FROM public.installments i
    JOIN public.billings b ON b.id = i.billing_id
    JOIN public.patients p ON p.id = b.patient_id
    WHERE i.status = 'atrasado' AND p.created_by IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'installment_overdue_professional', 'installment', installment_record.id,
        'user', installment_record.professional_id, 0,
        'wa_overdue_prof_' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_installment_overdue_professional: enqueue_notification failed for installment %: %', installment_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-installment-overdue-professional',
  '0 10 * * *',
  'SELECT public.schedule_installment_overdue_professional()'
);
