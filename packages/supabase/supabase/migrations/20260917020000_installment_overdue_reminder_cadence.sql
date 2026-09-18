-- installment_payment_reminder é um lembrete ANTES do vencimento (não de atraso): dispara
-- 3 dias antes e no próprio dia do vencimento, às 8h. Substitui o disparo diário enquanto
-- 'atrasado' (removido daqui — cobrança de parcela já atrasada com o paciente não é mais
-- responsabilidade deste tipo de notificação).
--
-- installment_overdue_professional continua como decidido antes: dispara em 1, 7 e 30 dias
-- de atraso, e depois a cada múltiplo de 30 (60, 90, 120...) enquanto a parcela seguir
-- atrasada. Motivação original: com o worker da fila (process_notification_queues, ver
-- 20260917010000_process_notification_queues_use_vault.sql) fora do ar por semanas, o
-- disparo diário empilhou ~2000 mensagens em produção — uma por parcela atrasada, por dia,
-- nunca consumida.
--
-- dedup_key: 'wa_due_soon_3d' e 'wa_due_today' são chaves distintas para os dois disparos
-- do mesmo installment (evita que o upsert de uma sobrescreva a mensagem pendente da outra
-- caso ambas ainda não tenham sido consumidas quando a segunda for enfileirada).
--
-- O "> 0" antes do "% 30 = 0" em schedule_installment_overdue_professional evita disparar
-- no dia exato do vencimento (dias_atraso = 0 também satisfaz "múltiplo de 30"). Na prática
-- isso nunca aconteceria hoje, já que mark_overdue_installments_and_billings só marca
-- 'atrasado' quando due_date < CURRENT_DATE — mas a condição não deve depender dessa
-- invariante de outra função para estar correta.
CREATE OR REPLACE FUNCTION public.schedule_installment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  installment_record RECORD;
  v_dedup_key text;
BEGIN
  FOR installment_record IN
    SELECT i.id, b.patient_id, (i.due_date - CURRENT_DATE) AS days_until_due
    FROM public.installments i
    JOIN public.billings b ON b.id = i.billing_id
    WHERE i.status = 'pendente' AND (i.due_date - CURRENT_DATE) IN (0, 3)
  LOOP
    v_dedup_key := CASE
      WHEN installment_record.days_until_due = 0 THEN 'wa_due_today'
      ELSE 'wa_due_soon_3d'
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

-- Job movido de 09:00 para 08:00 para atender o requisito "no dia do vencimento, às 8h" —
-- a mensagem de 3 dias antes não tem horário exigido, então roda junto sem problema.
SELECT cron.schedule(
  'schedule-installment-reminders',
  '0 8 * * *',
  'SELECT public.schedule_installment_reminders()'
);

CREATE OR REPLACE FUNCTION public.schedule_installment_overdue_professional()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  installment_record RECORD;
BEGIN
  FOR installment_record IN
    SELECT i.id, p.created_by AS professional_id
    FROM public.installments i
    JOIN public.billings b ON b.id = i.billing_id
    JOIN public.patients p ON p.id = b.patient_id
    WHERE i.status = 'atrasado'
      AND p.created_by IS NOT NULL
      AND (
        (CURRENT_DATE - i.due_date) IN (1, 7)
        OR ((CURRENT_DATE - i.due_date) > 0 AND (CURRENT_DATE - i.due_date) % 30 = 0)
      )
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
