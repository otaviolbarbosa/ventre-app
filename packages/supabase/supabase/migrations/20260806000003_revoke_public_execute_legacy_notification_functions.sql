-- Fix wave (final cross-cutting review): schedule_dpp_reminders() e
-- process_scheduled_notifications() são funções SECURITY DEFINER pré-existentes,
-- chamadas exclusivamente por pg_cron (jobs 'schedule-dpp-reminders' e
-- 'process-notifications'), mas ainda estavam com EXECUTE liberado para anon e
-- authenticated (privilégio padrão do Postgres para funções sem REVOKE explícito).
-- schedule_dpp_reminders() virou um produtor real de fila em 20260805100008
-- (shadow-write), então deixá-la publicamente executável por qualquer usuário
-- autenticado (ou anônimo) permitiria disparar reenvios de lembretes de DPP sob
-- demanda. pg_cron não é afetado por este revoke — ele roda com privilégios
-- elevados, não como anon/authenticated.
REVOKE ALL ON FUNCTION public.schedule_dpp_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_dpp_reminders() TO service_role;

REVOKE ALL ON FUNCTION public.process_scheduled_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_scheduled_notifications() TO service_role;
