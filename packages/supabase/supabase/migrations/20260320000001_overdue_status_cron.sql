-- ============================================================
-- Function: mark overdue installments and billings
-- Runs daily at midnight via pg_cron.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_overdue_installments_and_billings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Mark installments as overdue:
  --    due_date has passed and status is still 'pendente'
  UPDATE public.installments
  SET status = 'atrasado', updated_at = now()
  WHERE status = 'pendente'
    AND due_date < CURRENT_DATE;

  -- 2. Mark billings as overdue:
  --    billing is still 'pendente' and has at least one overdue installment
  UPDATE public.billings
  SET status = 'atrasado', updated_at = now()
  WHERE status = 'pendente'
    AND EXISTS (
      SELECT 1
      FROM public.installments i
      WHERE i.billing_id = billings.id
        AND i.status = 'atrasado'
    );
END;
$$;

-- ============================================================
-- pg_cron job: run every day at midnight (UTC)
-- NOTE: if pg_cron is not enabled, run manually in the
--       Supabase Dashboard SQL editor:
--
-- SELECT cron.schedule(
--   'mark-overdue-installments',
--   '0 0 * * *',
--   'SELECT public.mark_overdue_installments_and_billings()'
-- );
-- ============================================================
SELECT cron.schedule(
  'mark-overdue-installments',
  '0 0 * * *',
  'SELECT public.mark_overdue_installments_and_billings()'
);
