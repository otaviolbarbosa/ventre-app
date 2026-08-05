-- Funções de produção da fila de notificações.
-- enqueue_notification: envia a mensagem para a fila pgmq indicada e registra a
-- entrada em notification_queue_index para permitir cancelamento posterior por
-- referência de negócio (ex.: appointment_id).
-- cancel_notifications_for_reference: localiza todas as mensagens pendentes para
-- uma (reference_type, reference_id) via notification_queue_index, remove cada
-- uma da fila pgmq correspondente e limpa o índice.
-- Chamadas por: lib/notifications/queue.ts (Task 6), schedule_appointment_reminders
-- (Task 10), schedule_dpp_reminders (Task 11).
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_queue_name text,
  p_notification_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_recipient_type text,
  p_recipient_id uuid,
  p_delay_seconds integer DEFAULT 0,
  p_dedup_key text DEFAULT ''
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_msg_id bigint;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'notification_type', p_notification_type,
    'reference_type', p_reference_type,
    'reference_id', p_reference_id,
    'recipient_type', p_recipient_type,
    'recipient_id', p_recipient_id
  );

  SELECT pgmq.send(p_queue_name, v_payload, p_delay_seconds) INTO v_msg_id;

  INSERT INTO public.notification_queue_index
    (notification_type, reference_type, reference_id, queue_name, dedup_key, msg_id)
  VALUES
    (p_notification_type, p_reference_type, p_reference_id, p_queue_name, p_dedup_key, v_msg_id)
  ON CONFLICT (notification_type, reference_type, reference_id, queue_name, dedup_key)
  DO UPDATE SET msg_id = EXCLUDED.msg_id, created_at = now();

  RETURN v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notification TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_notifications_for_reference(
  p_reference_type text,
  p_reference_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT queue_name, msg_id
    FROM public.notification_queue_index
    WHERE reference_type = p_reference_type
      AND reference_id = p_reference_id
  LOOP
    PERFORM pgmq.delete(v_row.queue_name, v_row.msg_id);
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.notification_queue_index
  WHERE reference_type = p_reference_type
    AND reference_id = p_reference_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_notifications_for_reference FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_notifications_for_reference TO service_role;
