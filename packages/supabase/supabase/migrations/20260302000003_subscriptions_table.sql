-- Enums
CREATE TYPE public.subscription_frequence AS ENUM ('month', 'quarter', 'semester', 'year');
-- 'canceling' = cancelamento solicitado, acesso mantido até expires_at
-- 'canceled'  = cancelado imediatamente (ex: reembolso) — sem respeitar expires_at
CREATE TYPE public.subscription_status AS ENUM ('active', 'pending', 'canceling', 'canceled', 'expired', 'failed', 'replaced');

-- Table
CREATE TABLE public.subscriptions (
  id                  uuid        NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id             uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan_id             uuid        NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  frequence           public.subscription_frequence NOT NULL,
  subscription_id     text        NOT NULL,
  status              public.subscription_status NOT NULL DEFAULT 'pending',
  cancelation_reason  text,
  paid_at             timestamptz,
  -- fim do período contratado; acesso premium ativo enquanto now() < expires_at E status IN ('active','canceling')
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT subscriptions_pkey PRIMARY KEY (id)
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id  ON public.subscriptions (user_id);
CREATE INDEX idx_subscriptions_plan_id  ON public.subscriptions (plan_id);
CREATE INDEX idx_subscriptions_status   ON public.subscriptions (status);
CREATE INDEX idx_subscriptions_subscription_id  ON public.subscriptions (subscription_id);
CREATE INDEX idx_subscriptions_expires_at ON public.subscriptions (expires_at) WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role has full access"
  ON public.subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;

-- Before creating a new subscription, mark previous active subscriptions as replaced
CREATE OR REPLACE FUNCTION public.replace_active_subscriptions_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = 'replaced',
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND status = 'active';

  RETURN NEW;
END;
$$;

CREATE TRIGGER replace_active_subscriptions_before_insert
  BEFORE INSERT ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.replace_active_subscriptions_before_insert();

-- updated_at trigger
CREATE TRIGGER handle_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
