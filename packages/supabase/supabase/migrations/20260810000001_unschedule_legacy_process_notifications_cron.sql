-- packages/supabase/supabase/migrations/20260810000001_unschedule_legacy_process_notifications_cron.sql
--
-- Fase 5 (cleanup): o pg_cron jobid 1 ("process-notifications", a cada 5 min) chama
-- process_scheduled_notifications() -> Edge Function process-notifications -> FCM real.
-- Com NOTIFICATION_QUEUE_DRY_RUN=false confirmado em produção, o worker novo
-- (process-notification-queues, jobid 6, a cada 1 min) já envia os MESMOS lembretes
-- (appointment_reminder / dpp_approaching) via pgmq. Manter os dois pipelines ativos ao
-- mesmo tempo duplica o envio real para o usuário final. Este job nunca foi criado por
-- uma migration (aplicado manualmente via dashboard, ver comentário em
-- 20260209000001_notification_cron.sql) — por isso o guard de existência abaixo, em vez
-- de um DROP/unschedule incondicional.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notifications') THEN
    PERFORM cron.unschedule('process-notifications');
  END IF;
END $$;
