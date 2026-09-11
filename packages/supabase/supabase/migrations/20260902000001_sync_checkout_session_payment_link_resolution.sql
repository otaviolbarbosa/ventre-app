-- Payment-link-driven checkouts don't carry our custom metadata (plan_id/frequence/user_id) —
-- Stripe Payment Links only forward client_reference_id and prefilled_email as URL params, not
-- metadata. This left sync_checkout_session_to_subscriptions() bailing out early for every
-- payment-link checkout (v_plan_id/v_frequence stayed NULL), so public.subscriptions was never
-- populated and stripe_payment_link.used_subscription was never incremented. This mirrors the
-- payment-link resolution + anti-spoofing + usage-increment logic that already exists in
-- apps/web/app/api/stripe/webhook/route.ts, since the stripe-sync-engine Edge Function (not that
-- Next.js route) is the webhook endpoint actually enabled in Stripe.
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
  v_payment_link_stripe_id TEXT;
  v_payment_link_id UUID;
  v_resolved_email TEXT;
  v_paying_email    TEXT;
  v_is_new_subscription BOOLEAN;
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

  v_payment_link_stripe_id := NULLIF(NEW._raw_data->>'payment_link', '');

  -- Resolve plan/frequence (and the payment link row) when the checkout came from a payment
  -- link instead of our dynamic-fallback checkout session (which sets metadata explicitly).
  IF (v_plan_id IS NULL OR v_frequence IS NULL) AND v_payment_link_stripe_id IS NOT NULL THEN
    SELECT spl.id, spl.plan_id, spl.frequence
    INTO v_payment_link_id, v_plan_id, v_frequence
    FROM public.stripe_payment_link spl
    WHERE spl.stripe_payment_link_id = v_payment_link_stripe_id;
  END IF;

  -- Payment links can't carry custom metadata — fall back to client_reference_id for the user.
  IF v_user_id IS NULL AND v_enterprise_id IS NULL THEN
    v_user_id := NULLIF(NEW.client_reference_id, '')::UUID;
  END IF;

  IF v_plan_id IS NULL OR v_frequence IS NULL THEN RETURN NEW; END IF;
  IF v_user_id IS NULL AND v_enterprise_id IS NULL THEN RETURN NEW; END IF;

  -- Anti-spoofing: client_reference_id is a client-editable URL param on payment-link checkouts,
  -- so confirm the account it names actually matches who paid before attributing the subscription.
  IF v_payment_link_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    SELECT email INTO v_resolved_email FROM public.users WHERE id = v_user_id;
    v_paying_email := NEW._raw_data->'customer_details'->>'email';

    IF v_resolved_email IS NOT NULL AND v_paying_email IS NOT NULL
       AND lower(v_resolved_email) != lower(v_paying_email) THEN
      RAISE WARNING 'sync_checkout_session_to_subscriptions: email mismatch for checkout % (user %, resolved %, paying %)',
        NEW.id, v_user_id, v_resolved_email, v_paying_email;
      RETURN NEW;
    END IF;
  END IF;

  v_is_new_subscription := NOT EXISTS (
    SELECT 1 FROM public.subscriptions WHERE subscription_id = v_subscription_id
  );

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

  IF v_is_new_subscription AND v_payment_link_id IS NOT NULL THEN
    PERFORM public.increment_payment_link_usage(v_payment_link_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
