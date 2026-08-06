-- Log de auditoria de notificações enviadas (push e whatsapp).
-- Registrado por enqueue/consumo do worker: uma linha por tentativa de envio,
-- incluindo status final (sent/delivered/read/failed/dead_letter) e motivo de erro.
-- Consumida por dead_letter_notification (Task 5) e pela rota worker (Task 8).
CREATE TYPE public.notification_channel AS ENUM ('push', 'whatsapp');
CREATE TYPE public.notification_log_status AS ENUM ('sent', 'delivered', 'read', 'failed', 'dead_letter');

CREATE TABLE public.notification_log (
  id                   uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  channel              public.notification_channel NOT NULL,
  notification_type    text NOT NULL,
  reference_type       text,
  reference_id         uuid,
  recipient_type       text NOT NULL,
  recipient_id         uuid NOT NULL,
  external_message_id  text,
  status               public.notification_log_status NOT NULL,
  error_reason         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_recipient ON public.notification_log(recipient_type, recipient_id);
CREATE INDEX idx_notification_log_reference ON public.notification_log(reference_type, reference_id);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages notification log"
  ON public.notification_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
