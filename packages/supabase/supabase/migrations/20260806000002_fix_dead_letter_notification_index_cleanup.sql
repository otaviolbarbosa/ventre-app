-- Corrige dead_letter_notification: mesmo gap de ack_notification (corrigido em
-- 20260806000001) — arquivava a mensagem no pgmq e registrava a falha em
-- notification_log, mas nunca removia a linha correspondente em
-- notification_queue_index, deixando uma linha órfã permanente para toda
-- notificação com falha definitiva (dead letter).
--
-- msg_id é uma coluna simples em notification_queue_index (não faz parte da PK,
-- que é notification_type/reference_type/reference_id/queue_name/dedup_key), então
-- basta filtrar por queue_name + msg_id — mesmo padrão usado na correção de
-- ack_notification.
CREATE OR REPLACE FUNCTION public.dead_letter_notification(p_queue_name text, p_msg_id bigint, p_channel notification_channel, p_notification_type text, p_reference_type text, p_reference_id uuid, p_recipient_type text, p_recipient_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq'
AS $function$
BEGIN
  PERFORM pgmq.archive(p_queue_name, p_msg_id);

  DELETE FROM public.notification_queue_index
  WHERE queue_name = p_queue_name AND msg_id = p_msg_id;

  INSERT INTO public.notification_log
    (channel, notification_type, reference_type, reference_id,
     recipient_type, recipient_id, status, error_reason)
  VALUES
    (p_channel, p_notification_type, p_reference_type, p_reference_id,
     p_recipient_type, p_recipient_id, 'dead_letter', p_reason);
END;
$function$;

REVOKE ALL ON FUNCTION public.dead_letter_notification FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dead_letter_notification FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dead_letter_notification TO service_role;
