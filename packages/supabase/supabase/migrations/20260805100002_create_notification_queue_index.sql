-- Índice de mensagens pendentes por referência de negócio (ex.: appointment_id).
-- Permite que enqueue_notification/cancel_notifications_for_reference (Task 4)
-- localizem e cancelem uma mensagem específica na fila sem varrer o pgmq inteiro.
-- dedup_key existe porque uma mesma (notification_type, reference_type, reference_id)
-- pode ter mais de uma mensagem pendente simultânea (ex.: lembrete de 1 dia e de 1 hora
-- para a mesma consulta) — sem isso, o segundo INSERT sobrescreveria o índice do primeiro.
CREATE TABLE public.notification_queue_index (
  notification_type text NOT NULL,
  reference_type     text NOT NULL,
  reference_id       uuid NOT NULL,
  queue_name         text NOT NULL,
  dedup_key          text NOT NULL DEFAULT '',
  msg_id             bigint NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_type, reference_type, reference_id, queue_name, dedup_key)
);

CREATE INDEX idx_notification_queue_index_reference
  ON public.notification_queue_index(reference_type, reference_id);

ALTER TABLE public.notification_queue_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages notification queue index"
  ON public.notification_queue_index
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
