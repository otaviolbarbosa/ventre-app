-- Função que aciona a rota worker Next.js (/api/cron/process-notification-queues) via pg_net,
-- e job pg_cron que a executa a cada minuto. Segue o mesmo padrão de
-- public.process_scheduled_notifications() (20260209000001_notification_cron.sql), mas chama a
-- rota Next.js da Task 8 em vez da Edge Function.
--
-- Requer as configurações abaixo definidas no projeto (fora deste arquivo, são segredos):
--   ALTER DATABASE postgres SET app.settings.web_app_url = 'https://<seu-dominio>';
--   ALTER DATABASE postgres SET app.settings.cron_secret = '<mesmo valor de CRON_SECRET no Vercel>';
-- Rode esses dois comandos manualmente no SQL Editor do painel Supabase (produção e qualquer
-- ambiente de staging), antes deste cron job disparar pela primeira vez. Até lá, a função executa
-- sem erro mas o header Authorization fica incompleto e a chamada HTTP não autentica na rota.
CREATE OR REPLACE FUNCTION public.process_notification_queues()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_get(
    url := current_setting('app.settings.web_app_url', true) || '/api/cron/process-notification-queues',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    )
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
