-- Corrige ack_notification: ela só removia a mensagem do pgmq, nunca a linha
-- correspondente em notification_queue_index. Toda notificação processada com
-- sucesso (o caminho feliz — a grande maioria das mensagens) deixava uma linha
-- órfã permanente em notification_queue_index apontando para um msg_id que já
-- não existe mais no pgmq. Só cancel_notifications_for_reference (reagendamento/
-- cancelamento) limpava o índice, e apenas para mensagens ainda não processadas.
--
-- msg_id é uma coluna simples em notification_queue_index (não faz parte da PK,
-- que é notification_type/reference_type/reference_id/queue_name/dedup_key), então
-- basta filtrar por queue_name + msg_id — não é necessário conhecer a PK completa.
CREATE OR REPLACE FUNCTION public.ack_notification(p_queue_name text, p_msg_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_deleted boolean;
BEGIN
  v_deleted := pgmq.delete(p_queue_name, p_msg_id);

  IF v_deleted THEN
    DELETE FROM public.notification_queue_index
    WHERE queue_name = p_queue_name AND msg_id = p_msg_id;
  END IF;

  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.ack_notification FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ack_notification FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ack_notification TO service_role;
