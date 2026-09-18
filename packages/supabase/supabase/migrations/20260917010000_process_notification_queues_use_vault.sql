-- app.settings.web_app_url / app.settings.cron_secret (usados pela versão anterior desta função,
-- 20260805100006_process_notification_queues_cron.sql) exigem ALTER DATABASE ... SET, que o
-- Supabase bloqueia por segurança mesmo para o role postgres do projeto — por isso essa função
-- nunca chegou a disparar em nenhum ambiente. Troca para o Supabase Vault, mesmo padrão já usado
-- por public.call_send_notification (20260505000001_fix_call_send_notification.sql).
--
-- Antes deste cron job disparar de verdade, rode manualmente (SQL Editor do painel Supabase,
-- por ambiente — os valores NÃO vão em migration/git):
--   SELECT vault.create_secret('https://<seu-dominio>', 'notification_queue_web_app_url', 'URL pública do app.web usada pelo cron de filas de notificação');
--   SELECT vault.create_secret('<mesmo valor de CRON_SECRET no Vercel>', 'notification_queue_cron_secret', 'Secret usado para autenticar /api/cron/process-notification-queues');
-- Até lá, a função apenas registra um RAISE NOTICE e retorna (no-op).
CREATE OR REPLACE FUNCTION public.process_notification_queues()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_web_app_url text;
  v_cron_secret text;
BEGIN
  SELECT decrypted_secret INTO v_web_app_url
    FROM vault.decrypted_secrets
   WHERE name = 'notification_queue_web_app_url'
   LIMIT 1;

  SELECT decrypted_secret INTO v_cron_secret
    FROM vault.decrypted_secrets
   WHERE name = 'notification_queue_cron_secret'
   LIMIT 1;

  IF v_web_app_url IS NULL OR v_cron_secret IS NULL THEN
    RAISE NOTICE 'process_notification_queues: vault secrets notification_queue_web_app_url/notification_queue_cron_secret not configured, skipping';
    RETURN;
  END IF;

  -- net.http_get default timeout é 5000ms; a rota processa até 20 mensagens por fila
  -- (push/whatsapp/email) fazendo chamadas reais à API do WhatsApp, o que já foi observado
  -- levando 10-30s. Sem isso, o pg_cron (roda a cada minuto) timeoutava antes da rota
  -- terminar e o worker nunca progredia de fato, mesmo com os secrets do Vault corretos.
  PERFORM net.http_get(
    url := v_web_app_url || '/api/cron/process-notification-queues',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_cron_secret),
    timeout_milliseconds := 55000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_notification_queues FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_notification_queues FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_notification_queues TO service_role;
