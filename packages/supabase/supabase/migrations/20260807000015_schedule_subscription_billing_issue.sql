-- packages/supabase/supabase/migrations/20260807000015_schedule_subscription_billing_issue.sql
CREATE OR REPLACE FUNCTION public.schedule_subscription_billing_issue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_record RECORD;
BEGIN
  FOR subscription_record IN
    SELECT id, user_id
    FROM public.subscriptions
    WHERE status = 'failed' AND user_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'subscription_billing_issue', 'subscription', subscription_record.id,
        'user', subscription_record.user_id, 0,
        'wa_subscription_issue_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_subscription_billing_issue: enqueue_notification failed for subscription %: %', subscription_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-subscription-billing-issue',
  '0 12 * * *',
  'SELECT public.schedule_subscription_billing_issue()'
);
