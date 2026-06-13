
-- 1. Unique constraint on subscription_id for upsert support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_subscription_id_key'
      AND conrelid = 'public.subscriptions'::regclass
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_subscription_id_key UNIQUE (subscription_id);
  END IF;
END $$;

-- 2. Trigger function: checkout session → public.subscriptions
CREATE OR REPLACE FUNCTION stripe.sync_checkout_session_to_subscriptions()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_id       UUID;
  v_user_id       UUID;
  v_enterprise_id UUID;
  v_frequence     public.subscription_frequence;
  v_subscription_id TEXT;
  v_paid_at       TIMESTAMPTZ;
  v_expires_at    TIMESTAMPTZ;
BEGIN
  IF NEW.mode != 'subscription' THEN RETURN NEW; END IF;
  IF (NEW._raw_data->>'payment_status') != 'paid' THEN RETURN NEW; END IF;
  IF NEW.subscription IS NULL THEN RETURN NEW; END IF;

  v_plan_id         := NULLIF(NEW.metadata->>'plan_id', '')::UUID;
  v_user_id         := NULLIF(NEW.metadata->>'user_id', '')::UUID;
  v_enterprise_id   := NULLIF(NEW.metadata->>'enterprise_id', '')::UUID;
  v_frequence       := NULLIF(NEW.metadata->>'frequence', '')::public.subscription_frequence;
  v_subscription_id := NEW.subscription;
  v_paid_at         := to_timestamp((NEW._raw_data->>'created')::BIGINT);

  IF v_plan_id IS NULL OR v_frequence IS NULL THEN RETURN NEW; END IF;

  -- Get expires_at from stripe.subscriptions (may be NULL if not yet synced)
  SELECT to_timestamp(
           ((s._raw_data->'items'->'data'->0)->>'current_period_end')::BIGINT
         )
  INTO v_expires_at
  FROM stripe.subscriptions s
  WHERE s.id = v_subscription_id;

  -- Replace any existing active/pending subscription for this owner
  IF v_user_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET status = 'replaced', updated_at = NOW()
    WHERE user_id = v_user_id
      AND status IN ('active', 'pending')
      AND subscription_id != v_subscription_id;
  END IF;

  IF v_enterprise_id IS NOT NULL THEN
    UPDATE public.subscriptions
    SET status = 'replaced', updated_at = NOW()
    WHERE enterprise_id = v_enterprise_id
      AND status IN ('active', 'pending')
      AND subscription_id != v_subscription_id;
  END IF;

  INSERT INTO public.subscriptions (
    subscription_id, plan_id, frequence, user_id, enterprise_id,
    status, paid_at, expires_at
  ) VALUES (
    v_subscription_id, v_plan_id, v_frequence, v_user_id, v_enterprise_id,
    'active', v_paid_at, v_expires_at
  )
  ON CONFLICT (subscription_id) DO UPDATE SET
    status     = 'active',
    expires_at = COALESCE(EXCLUDED.expires_at, public.subscriptions.expires_at),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_checkout_session_to_subscriptions ON stripe.checkout_sessions;
CREATE TRIGGER sync_checkout_session_to_subscriptions
AFTER INSERT OR UPDATE ON stripe.checkout_sessions
FOR EACH ROW EXECUTE FUNCTION stripe.sync_checkout_session_to_subscriptions();

-- 3. Trigger function: stripe.subscriptions → public.subscriptions
CREATE OR REPLACE FUNCTION stripe.sync_subscription_status_to_public()
RETURNS TRIGGER AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_expires_at := to_timestamp(
    ((NEW._raw_data->'items'->'data'->0)->>'current_period_end')::BIGINT
  );

  -- On INSERT: backfill expires_at if checkout was already processed
  IF TG_OP = 'INSERT' THEN
    UPDATE public.subscriptions
    SET expires_at = COALESCE(v_expires_at, expires_at), updated_at = NOW()
    WHERE subscription_id = NEW.id AND expires_at IS NULL;
    RETURN NEW;
  END IF;

  -- On UPDATE: keep expires_at in sync
  IF v_expires_at IS NOT NULL THEN
    UPDATE public.subscriptions
    SET expires_at = v_expires_at, updated_at = NOW()
    WHERE subscription_id = NEW.id
      AND status NOT IN ('canceled', 'replaced');
  END IF;

  -- Handle cancel_at_period_end transition
  IF NEW.cancel_at_period_end = true
     AND (OLD.cancel_at_period_end IS DISTINCT FROM true) THEN
    UPDATE public.subscriptions
    SET
      status     = 'canceling',
      expires_at = CASE
                     WHEN NEW.cancel_at IS NOT NULL AND NEW.cancel_at > 0
                     THEN to_timestamp(NEW.cancel_at)
                     ELSE COALESCE(v_expires_at, expires_at)
                   END,
      updated_at = NOW()
    WHERE subscription_id = NEW.id;
  END IF;

  -- Handle full cancellation
  IF NEW.status = 'canceled' AND OLD.status IS DISTINCT FROM 'canceled' THEN
    UPDATE public.subscriptions
    SET status = 'canceled', updated_at = NOW()
    WHERE subscription_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS sync_subscription_status_to_public ON stripe.subscriptions;
CREATE TRIGGER sync_subscription_status_to_public
AFTER INSERT OR UPDATE ON stripe.subscriptions
FOR EACH ROW EXECUTE FUNCTION stripe.sync_subscription_status_to_public();
