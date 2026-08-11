CREATE OR REPLACE FUNCTION public.schedule_contract_pending_signature()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  contract_record RECORD;
BEGIN
  FOR contract_record IN
    SELECT id, patient_id
    FROM public.contracts
    WHERE is_signed = false
      AND is_active = true
      AND patient_id IS NOT NULL
      AND created_at <= now() - INTERVAL '3 days'
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'contract_pending_signature', 'contract', contract_record.id,
        'patient', contract_record.patient_id, 0,
        'wa_contract_pending_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_contract_pending_signature: enqueue_notification failed for contract %: %', contract_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-contract-pending-signature',
  '0 9 * * *',
  'SELECT public.schedule_contract_pending_signature()'
);
