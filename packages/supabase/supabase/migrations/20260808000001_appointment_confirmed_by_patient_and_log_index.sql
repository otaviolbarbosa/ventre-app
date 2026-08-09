-- Fase 4 do design de WhatsApp (Fluxo 4): lookup do webhook inbound. Dado o wamid
-- (context.id) da mensagem que o usuário respondeu, ou o id de status que a Meta está
-- reportando, encontra a linha de notification_log correspondente para descobrir
-- notification_type/reference_type/reference_id e para atualizar o status
-- (sent -> delivered -> read, ou failed).
--
-- Nota: appointments.confirmed_by_patient_at já foi adicionada em
-- 20260710000003_appointments_patient_rls_and_confirm.sql — não recriar aqui.
CREATE INDEX IF NOT EXISTS idx_notification_log_external_message_id
  ON public.notification_log (external_message_id);
