-- packages/supabase/supabase/migrations/20260807000011_schedule_monthly_billing_report.sql
CREATE OR REPLACE FUNCTION public.schedule_monthly_billing_report()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  professional_record RECORD;
BEGIN
  FOR professional_record IN
    SELECT p.created_by AS professional_id
    FROM public.billings b
    JOIN public.patients p ON p.id = b.patient_id
    WHERE b.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
      AND b.created_at < date_trunc('month', CURRENT_DATE)
      AND p.created_by IS NOT NULL
    GROUP BY p.created_by
    HAVING sum(b.paid_amount) > 0
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'monthly_billing_report', 'user', professional_record.professional_id,
        'user', professional_record.professional_id, 0,
        'wa_monthly_report_' || to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_monthly_billing_report: enqueue_notification failed for professional %: %', professional_record.professional_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-monthly-billing-report',
  '0 8 1 * *',
  'SELECT public.schedule_monthly_billing_report()'
);
