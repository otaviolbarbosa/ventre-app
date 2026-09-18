-- Suporte ao cancelamento de agendamento feito pela própria paciente (via botão na agenda
-- ou link direto do WhatsApp). cancelled_by_patient_at espelha confirmed_by_patient_at e
-- existe para distinguir "cancelado pela paciente" de "cancelado pela profissional" — a
-- trigger de notificação da profissional (a ser implementada depois) só deve disparar
-- quando este campo estiver preenchido.
ALTER TABLE public.appointments
  ADD COLUMN cancellation_reason text,
  ADD COLUMN reschedule_requested boolean NOT NULL DEFAULT false,
  ADD COLUMN cancelled_by_patient_at timestamptz;
