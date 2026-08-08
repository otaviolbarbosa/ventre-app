-- Fase 4 do design de WhatsApp (Fluxo 4): marca quando a paciente confirma presença via
-- botão de quick-reply no WhatsApp. Nullable — a maioria das consultas nunca recebe uma
-- confirmação explícita (paciente não usa WhatsApp, ou simplesmente não toca no botão).
ALTER TABLE public.appointments
  ADD COLUMN confirmed_by_patient_at timestamptz;

-- Lookup do webhook inbound: dado o wamid (context.id) da mensagem que o usuário respondeu,
-- ou o id de status que a Meta está reportando, encontra a linha de notification_log
-- correspondente para descobrir notification_type/reference_type/reference_id e para
-- atualizar o status (sent -> delivered -> read, ou failed).
CREATE INDEX idx_notification_log_external_message_id
  ON public.notification_log (external_message_id);
