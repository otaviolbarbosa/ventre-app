CREATE TABLE public.stripe_payment_link (
  id                     uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  plan_id                uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  frequence              public.subscription_frequence NOT NULL,
  payment_link_url       text NOT NULL,
  stripe_payment_link_id text NOT NULL,
  is_active              boolean NOT NULL DEFAULT true,
  is_primary             boolean NOT NULL DEFAULT false,
  is_priority            boolean NOT NULL DEFAULT false,
  is_limited             boolean NOT NULL DEFAULT false,
  total_subscriptions    integer,
  used_subscription      integer NOT NULL DEFAULT 0,
  amount                 bigint,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stripe_payment_link_pkey PRIMARY KEY (id),
  CONSTRAINT stripe_payment_link_stripe_id_key UNIQUE (stripe_payment_link_id),
  CONSTRAINT stripe_payment_link_limited_requires_total
    CHECK (NOT is_limited OR total_subscriptions IS NOT NULL),
  CONSTRAINT stripe_payment_link_used_not_negative
    CHECK (used_subscription >= 0),
  CONSTRAINT stripe_payment_link_amount_required_for_year
    CHECK (frequence <> 'year' OR amount IS NOT NULL)
);

CREATE INDEX idx_stripe_payment_link_plan_id ON public.stripe_payment_link (plan_id);
CREATE INDEX idx_stripe_payment_link_plan_frequence ON public.stripe_payment_link (plan_id, frequence);

COMMENT ON COLUMN public.stripe_payment_link.amount IS
  'Preço promocional em centavos. Para frequence = month, NULL cai no valor de plans.value (mostra só o preço original). Para frequence = year, é obrigatório pois plans.value não representa preço anual.';
COMMENT ON COLUMN public.stripe_payment_link.total_subscriptions IS
  'Número máximo de assinaturas geráveis por este link. Obrigatório quando is_limited = true.';

ALTER TABLE public.stripe_payment_link ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active payment links"
  ON public.stripe_payment_link
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role has full access to payment links"
  ON public.stripe_payment_link
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON TABLE public.stripe_payment_link TO anon, authenticated;
GRANT ALL ON TABLE public.stripe_payment_link TO service_role;

CREATE TRIGGER handle_stripe_payment_link_updated_at
  BEFORE UPDATE ON public.stripe_payment_link
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
