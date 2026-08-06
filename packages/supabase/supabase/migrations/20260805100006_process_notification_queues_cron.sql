-- Função que aciona a rota worker Next.js (/api/cron/process-notification-queues) via pg_net,
-- e job pg_cron que a executa a cada minuto. Segue o mesmo padrão de
-- public.process_scheduled_notifications() (20260209000001_notification_cron.sql), mas chama a
-- rota Next.js da Task 8 em vez da Edge Function.
--
-- Requer as configurações abaixo definidas no projeto (fora deste arquivo, são segredos):
--   ALTER DATABASE postgres SET app.settings.web_app_url = 'https://<seu-dominio>';
--   ALTER DATABASE postgres SET app.settings.cron_secret = '<mesmo valor de CRON_SECRET no Vercel>';
-- Rode esses dois comandos manualmente no SQL Editor do painel Supabase (produção e qualquer
-- ambiente de staging), antes deste cron job disparar pela primeira vez. Até lá, a função apenas
-- registra um RAISE NOTICE e retorna (no-op) — não tenta chamar net.http_get com url/headers nulos.
--
-- *** AVISO IMPORTANTE ANTES DE ARMAR (rodar os dois ALTER DATABASE acima) ***
-- O pipeline legado (scheduled_notifications + pg_cron jobid 1 'process-notifications' +
-- jobid 2 'schedule-dpp-reminders') continua ativo e envia os MESMOS lembretes
-- (appointment_reminder, dpp_approaching) pelo mesmo canal (push). A rota worker chamada
-- por este cron job só envia um push REAL quando a variável de ambiente
-- NOTIFICATION_QUEUE_DRY_RUN estiver explicitamente definida como "false" no ambiente do
-- app deployado (Vercel). Enquanto ela estiver ausente ou "true" (o padrão seguro), o
-- worker roda o pipeline inteiro e grava em notification_log, mas NUNCA chama o envio
-- real via Firebase — não duplica nenhum push. Só defina NOTIFICATION_QUEUE_DRY_RUN=false
-- depois de desligar (ou aceitar duplicar) o pipeline legado.
CREATE OR REPLACE FUNCTION public.process_notification_queues()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_web_app_url text := current_setting('app.settings.web_app_url', true);
  v_cron_secret text := current_setting('app.settings.cron_secret', true);
BEGIN
  IF v_web_app_url IS NULL OR v_cron_secret IS NULL THEN
    RAISE NOTICE 'process_notification_queues: app.settings.web_app_url or app.settings.cron_secret not configured, skipping';
    RETURN;
  END IF;

  PERFORM net.http_get(
    url := v_web_app_url || '/api/cron/process-notification-queues',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_cron_secret)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_notification_queues FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_notification_queues FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_notification_queues TO service_role;

SELECT cron.schedule(
  'process-notification-queues',
  '* * * * *',
  'SELECT public.process_notification_queues()'
);
