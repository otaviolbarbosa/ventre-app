-- Contract dual signature (Fase 4): extend check_contract_fully_signed() to enqueue
-- WhatsApp + push notifications for contracts.signed_by (the professional) exactly once,
-- when the second signature (patient's) completes the contract. Uses FOUND (guarded by
-- fully_signed_at IS NULL) to distinguish "just completed" from "already complete", so a
-- trigger re-fire on a subsequent unrelated insert never double-enqueues.
CREATE OR REPLACE FUNCTION public.check_contract_fully_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_professional boolean;
  v_has_patient boolean;
  v_signed_by uuid;
  v_just_completed boolean := false;
BEGIN
  PERFORM 1 FROM public.contracts WHERE id = NEW.contract_id FOR NO KEY UPDATE;

  SELECT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = NEW.contract_id AND signer_role = 'professional')
    INTO v_has_professional;
  SELECT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = NEW.contract_id AND signer_role = 'patient')
    INTO v_has_patient;

  IF v_has_professional AND v_has_patient THEN
    UPDATE public.contracts SET fully_signed_at = now()
    WHERE id = NEW.contract_id AND fully_signed_at IS NULL
    RETURNING signed_by INTO v_signed_by;

    v_just_completed := FOUND;
  END IF;

  IF v_just_completed AND v_signed_by IS NOT NULL THEN
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'contract_fully_signed', 'contract', NEW.contract_id,
        'user', v_signed_by, 0, ''
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'check_contract_fully_signed: whatsapp enqueue failed for contract %: %', NEW.contract_id, SQLERRM;
    END;

    BEGIN
      PERFORM public.enqueue_notification(
        'push_notifications', 'contract_fully_signed', 'contract', NEW.contract_id,
        'user', v_signed_by, 0, ''
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'check_contract_fully_signed: push enqueue failed for contract %: %', NEW.contract_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;
