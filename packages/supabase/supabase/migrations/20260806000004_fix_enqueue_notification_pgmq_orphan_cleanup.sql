-- Fix wave (final cross-cutting review): enqueue_notification's ON CONFLICT DO UPDATE
-- path sends the NEW pgmq message first, then swaps notification_queue_index.msg_id to
-- point at it — but never deletes the OLD pgmq message the index used to point at. That
-- old message stays live in the queue and gets delivered too, duplicating the send.
-- Combined with ack_notification now deleting the index row on success (20260806000001),
-- any re-run of a producer (schedule_dpp_reminders, appointment triggers) after a prior
-- successful send re-enqueues cleanly instead of hitting ON CONFLICT — but a re-run
-- BEFORE the prior message is acked (e.g. two overlapping producer runs) still hits this
-- exact orphaning bug. Fix: capture the existing (queue_name, msg_id) for this key before
-- the upsert, and after the upsert, delete the old pgmq message if it was actually
-- replaced. Guarded in its own BEGIN/EXCEPTION block (same pattern as Tasks 10/11's
-- shadow-writes) so a cleanup failure never blocks the new enqueue.
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
  v_old_msg_id bigint;
  v_old_queue_name text;
BEGIN
  v_payload := jsonb_build_object(
    'notification_type', p_notification_type,
    'reference_type', p_reference_type,
    'reference_id', p_reference_id,
    'recipient_type', p_recipient_type,
    'recipient_id', p_recipient_id
  );

  -- Captura a mensagem pgmq atual para esta chave (se houver) ANTES do upsert, para
  -- podermos limpá-la depois caso o upsert caia no path do ON CONFLICT (substituição).
  SELECT msg_id, queue_name INTO v_old_msg_id, v_old_queue_name
  FROM public.notification_queue_index
  WHERE notification_type = p_notification_type
    AND reference_type = p_reference_type
    AND reference_id = p_reference_id
    AND queue_name = p_queue_name
    AND dedup_key = p_dedup_key;

  SELECT pgmq.send(p_queue_name, v_payload, p_delay_seconds) INTO v_msg_id;

  INSERT INTO public.notification_queue_index
    (notification_type, reference_type, reference_id, queue_name, dedup_key, msg_id)
  VALUES
    (p_notification_type, p_reference_type, p_reference_id, p_queue_name, p_dedup_key, v_msg_id)
  ON CONFLICT (notification_type, reference_type, reference_id, queue_name, dedup_key)
  DO UPDATE SET msg_id = EXCLUDED.msg_id, created_at = now();

  -- Se havia uma mensagem pgmq anterior para esta chave, ela agora está órfã do índice
  -- (que passou a apontar só para v_msg_id) e seria entregue em duplicidade se não for
  -- removida. Falha ao limpar não deve impedir o novo enqueue de ter acontecido.
  IF v_old_msg_id IS NOT NULL AND v_old_msg_id IS DISTINCT FROM v_msg_id THEN
    BEGIN
      PERFORM pgmq.delete(v_old_queue_name, v_old_msg_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'enqueue_notification: failed to delete orphaned pgmq message % on queue % (superseded by %): %',
        v_old_msg_id, v_old_queue_name, v_msg_id, SQLERRM;
    END;
  END IF;

  RETURN v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enqueue_notification FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notification TO service_role;
