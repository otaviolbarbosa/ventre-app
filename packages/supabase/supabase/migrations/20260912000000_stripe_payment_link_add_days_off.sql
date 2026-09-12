ALTER TABLE public.stripe_payment_link
  ADD COLUMN days_off integer NOT NULL DEFAULT 0;

ALTER TABLE public.stripe_payment_link
  ADD CONSTRAINT stripe_payment_link_days_off_not_negative CHECK (days_off >= 0);

COMMENT ON COLUMN public.stripe_payment_link.days_off IS
  'Dias de teste gratuito concedidos por este link antes da primeira cobrança. 0 = sem período de teste.';
