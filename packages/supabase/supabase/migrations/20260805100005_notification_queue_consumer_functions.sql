-- Funções de consumo da fila de notificações.
-- dequeue_notifications: lê até p_qty mensagens visíveis da fila pgmq indicada,
-- tornando-as invisíveis por p_vt segundos (visibility timeout) para outros consumidores.
-- ack_notification: remove definitivamente a mensagem da fila após processamento bem-sucedido.
-- requeue_with_backoff: em caso de falha retentável, aplica backoff exponencial (60s * 2^read_ct,
-- limitado a 3600s) via pgmq.set_vt, mantendo a mensagem na fila para nova tentativa.
-- dead_letter_notification: arquiva a mensagem (pgmq.archive) após falha permanente e registra
-- a ocorrência em notification_log com status 'dead_letter'.
-- Chamadas por: lib/notifications/queue.ts (Task 6) e pela rota worker (Task 8).
CREATE OR REPLACE FUNCTION public.dequeue_notifications(
  p_queue_name text,
  p_qty integer DEFAULT 20,
  p_vt integer DEFAULT 60
) RETURNS TABLE (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  message jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT msg_id, read_ct, enqueued_at, message
  FROM pgmq.read(p_queue_name, p_vt, p_qty);
$$;

REVOKE ALL ON FUNCTION public.dequeue_notifications FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dequeue_notifications FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dequeue_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.ack_notification(p_queue_name text, p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT pgmq.delete(p_queue_name, p_msg_id);
$$;

REVOKE ALL ON FUNCTION public.ack_notification FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ack_notification FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_notification TO service_role;

CREATE OR REPLACE FUNCTION public.requeue_with_backoff(
  p_queue_name text,
  p_msg_id bigint,
  p_read_ct integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_backoff_seconds integer;
BEGIN
  v_backoff_seconds := LEAST((60 * POWER(2, p_read_ct))::integer, 3600);
  PERFORM pgmq.set_vt(p_queue_name, p_msg_id, v_backoff_seconds);
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_with_backoff FROM PUBLIC;
REVOKE ALL ON FUNCTION public.requeue_with_backoff FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_with_backoff TO service_role;

CREATE OR REPLACE FUNCTION public.dead_letter_notification(
  p_queue_name text,
  p_msg_id bigint,
  p_channel public.notification_channel,
  p_notification_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_recipient_type text,
  p_recipient_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  PERFORM pgmq.archive(p_queue_name, p_msg_id);

  INSERT INTO public.notification_log
    (channel, notification_type, reference_type, reference_id,
     recipient_type, recipient_id, status, error_reason)
  VALUES
    (p_channel, p_notification_type, p_reference_type, p_reference_id,
     p_recipient_type, p_recipient_id, 'dead_letter', p_reason);
END;
$$;

REVOKE ALL ON FUNCTION public.dead_letter_notification FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dead_letter_notification FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dead_letter_notification TO service_role;
