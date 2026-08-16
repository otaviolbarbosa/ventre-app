-- Contract dual signature (Phase 1): after each signature row is inserted,
-- check whether both roles (professional + patient) now exist for the
-- contract and, if so, flip contracts.fully_signed_at exactly once.
-- Locks the parent row (FOR NO KEY UPDATE) to serialize two near-simultaneous
-- signature inserts for the same contract_id, so neither transaction misses
-- the other's just-committed row.
CREATE OR REPLACE FUNCTION public.check_contract_fully_signed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_professional boolean;
  v_has_patient boolean;
BEGIN
  PERFORM 1 FROM public.contracts WHERE id = NEW.contract_id FOR NO KEY UPDATE;

  SELECT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = NEW.contract_id AND signer_role = 'professional')
    INTO v_has_professional;
  SELECT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = NEW.contract_id AND signer_role = 'patient')
    INTO v_has_patient;

  IF v_has_professional AND v_has_patient THEN
    UPDATE public.contracts SET fully_signed_at = now() WHERE id = NEW.contract_id AND fully_signed_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER contract_signatures_check_completion
  AFTER INSERT ON public.contract_signatures
  FOR EACH ROW EXECUTE FUNCTION public.check_contract_fully_signed();
