ALTER TABLE public.plans
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.plans.is_active IS
  'Somente planos ativos aparecem no paywall e podem ser usados em novos checkouts.';

COMMENT ON COLUMN public.plans.value IS
  'Preço em centavos usado apenas como fallback quando não existe stripe_payment_link ativo para o plano/frequência (Checkout Session dinâmica de contingência).';

-- Planos deixam de variar por frequência: a linha "-month" de cada tier
-- vira a única ativa; stripe_payment_link.frequence resolve mensal vs.
-- anual para essa mesma linha. Linhas "-quarter"/"-semester"/"-year"
-- ficam desativadas mas permanecem no banco (FK de subscriptions.plan_id
-- histórico).
UPDATE public.plans
SET is_active = false
WHERE slug LIKE '%-quarter' OR slug LIKE '%-semester' OR slug LIKE '%-year';
