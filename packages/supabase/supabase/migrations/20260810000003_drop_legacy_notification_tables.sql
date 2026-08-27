-- packages/supabase/supabase/migrations/20260810000003_drop_legacy_notification_tables.sql
--
-- Fase 5 (cleanup), passo final: nada mais escreve ou lê scheduled_notifications /
-- installments_scheduled_notifications (Tasks 1, 3 e 4 já aplicadas). Derruba os objetos
-- legados. installments_notification_type e installments_notification_status só eram
-- usados pelas colunas installments_scheduled_notifications.type e .status — saem junto.
-- notification_type (enum) NÃO sai: ainda é usado por notifications.type e
-- notification_settings, que continuam em produção.

DROP FUNCTION IF EXISTS public.process_scheduled_notifications();
DROP TABLE IF EXISTS public.scheduled_notifications;
DROP TABLE IF EXISTS public.installments_scheduled_notifications;
DROP TYPE IF EXISTS public.installments_notification_type;
DROP TYPE IF EXISTS public.installments_notification_status;
