-- packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_professional_id uuid;
BEGIN
  SELECT p.created_by INTO v_professional_id
  FROM public.installments i
  JOIN public.billings b ON b.id = i.billing_id
  JOIN public.patients p ON p.id = b.patient_id
  WHERE i.id = NEW.installment_id;

  -- Exclui quem acabou de registrar o pagamento da lista de destinatários (spec, seção 5) —
  -- evita autonotificação quando o próprio dono da paciente registra o pagamento.
  IF v_professional_id IS NOT NULL AND v_professional_id IS DISTINCT FROM NEW.registered_by THEN
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'payment_received', 'payment', NEW.id,
        'user', v_professional_id, 0, ''
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_payment_received: enqueue_notification failed for payment %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_received
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_received();
