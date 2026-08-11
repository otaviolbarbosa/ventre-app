CREATE OR REPLACE FUNCTION public.schedule_installment_under_review_stalled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  installment_record RECORD;
BEGIN
  FOR installment_record IN
    SELECT i.id, b.patient_id
    FROM public.installments i
    JOIN public.billings b ON b.id = i.billing_id
    WHERE i.status = 'em_analise'
      AND EXISTS (
        SELECT 1 FROM public.payments pm
        WHERE pm.installment_id = i.id
          AND pm.paid_at < now() - INTERVAL '3 days'
      )
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'installment_under_review_stalled', 'installment', installment_record.id,
        'patient', installment_record.patient_id, 0,
        'wa_stalled_' || to_char(now(), 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_installment_under_review_stalled: enqueue_notification failed for installment %: %', installment_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-installment-under-review-stalled',
  '0 10 * * *',
  'SELECT public.schedule_installment_under_review_stalled()'
);
