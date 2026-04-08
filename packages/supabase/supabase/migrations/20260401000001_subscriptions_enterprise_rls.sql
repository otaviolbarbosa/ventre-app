-- ============================================================
-- Enterprise RLS Policies for subscriptions
-- ============================================================

-- Enterprise members can view their enterprise's subscription
CREATE POLICY "Enterprise members can view enterprise subscription"
  ON public.subscriptions
  FOR SELECT
  USING (
    enterprise_id IS NOT NULL
    AND enterprise_id = (
      SELECT u.enterprise_id
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.enterprise_id IS NOT NULL
    )
  );

-- Only managers can create enterprise subscriptions
CREATE POLICY "Enterprise managers can create enterprise subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (
    enterprise_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.user_type = 'manager'
        AND u.enterprise_id IS NOT NULL
        AND u.enterprise_id = subscriptions.enterprise_id
    )
  );
