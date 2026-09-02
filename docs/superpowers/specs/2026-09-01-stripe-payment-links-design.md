# Stripe Payment Links para assinatura de planos

## Motivação

Hoje a assinatura de um plano cria uma Stripe Checkout Session dinâmica
(`create-stripe-checkout-session-action.ts`), montando o preço via
`price_data` a partir de `plans.value`. Isso significa que qualquer
promoção (permanente ou temporária) exige alterar o valor do plano no
banco, sem controle de vigência, limite de uso ou coexistência de
múltiplas ofertas para o mesmo plano.

Vamos migrar para o modelo de **Payment Links gerenciados pelo Stripe**:
cada plano passa a ter um ou mais links de pagamento cadastrados
(originais e promocionais), com uma regra de precedência decidindo para
qual link o usuário é redirecionado. O checkout deixa de trafegar
`price_data` dinamicamente sempre que existir um link ativo.

## Estado atual relevante

- `plans` (`packages/supabase/supabase/migrations/20260302000002_plans_rename_type_to_slug.sql`):
  uma linha por combinação plano+frequência (`plus-care-month`,
  `plus-care-quarter`, `plus-care-semester`, `plus-care-year`,
  `complete-care-*`, `basic-care`), cada uma com seu próprio `value`
  (centavos) e `benefits` duplicados.
- `create-stripe-checkout-session-action.ts`: recebe `slug` único
  (ex.: `plus-care-month`), cria a Checkout Session com `price_data` e
  `metadata: { plan_id, user_id, frequence: "month" }` — **`frequence`
  é sempre `"month"` hardcoded**, mesmo em planos anuais (bug
  conhecido).
- `paywall-screen.tsx`: monta o slug como `` `${plan}-${billing}` ``
  (`billing` é o estado do switcher mensal/anual) e chama a action.
  Preços mensal/anual são hardcoded no JSX (`R$79,90` / `R$799,00`).
- `api/stripe/webhook/route.ts`: no `checkout.session.completed`, lê
  `plan_id`/`frequence`/`user_id` (ou `enterprise_id`) de
  `session.metadata`. Não há fluxo de checkout empresarial acessível
  hoje na UI (card "Cuidado Completo" é só `mailto:`), então
  `enterprise_id` é código morto para o fluxo web atual — não é tocado
  por este spec.

## Modelo de dados

### `plans` — duas colunas novas

```sql
ALTER TABLE public.plans
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.plans.is_active IS
  'Somente planos ativos aparecem no paywall e podem ser usados em novos checkouts.';

COMMENT ON COLUMN public.plans.value IS
  'Preço em centavos usado apenas como fallback quando não existe stripe_payment_link ativo para o plano/frequência (Checkout Session dinâmica de contingência).';
```

`value` continua existindo com o papel estreitado de **fallback**
(comentário documenta isso; nenhuma mudança de tipo/constraint).

### Backfill: desativar linhas não-mensais

Migration de dados (mesmo arquivo ou um seguinte): planos deixam de
variar por frequência daqui pra frente — a linha `-month` de cada tier
vira a única ativa, e `stripe_payment_link.frequence` resolve mensal
vs. anual para essa mesma linha. As linhas `-quarter`/`-semester`/`-year`
permanecem no banco (integridade referencial de `subscriptions.plan_id`
histórico) mas saem de circulação:

```sql
UPDATE public.plans
SET is_active = false
WHERE slug LIKE '%-quarter' OR slug LIKE '%-semester' OR slug LIKE '%-year';
```

`basic-care` (sem sufixo) e as linhas `-month` permanecem `is_active = true`.

### Nova tabela `stripe_payment_link`

```sql
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
  amount                 bigint, -- centavos; obrigatório quando frequence = 'year'
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
```

Leitura fica pública (`anon`/`authenticated`) porque o paywall precisa
exibir preços antes do login; toda escrita passa por
`supabaseAdmin` nas actions do admin.

### Função de seleção `get_active_payment_link`

```sql
CREATE OR REPLACE FUNCTION public.get_active_payment_link(
  p_plan_id uuid,
  p_frequence public.subscription_frequence
)
RETURNS public.stripe_payment_link
LANGUAGE sql
STABLE
AS $$
  SELECT *
  FROM public.stripe_payment_link
  WHERE plan_id = p_plan_id
    AND frequence = p_frequence
    AND is_active
    AND NOT (is_limited AND used_subscription >= total_subscriptions)
  ORDER BY is_priority DESC, is_primary DESC, created_at DESC
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_active_payment_link(uuid, public.subscription_frequence)
  TO anon, authenticated, service_role;
```

Retorna `NULL` (row inteira nula) quando nenhum link elegível existe —
esse é o sinal para cair no fallback dinâmico. Um link `is_limited`
que atingiu `used_subscription >= total_subscriptions` é **excluído**
da seleção (não apenas desempatado por último).

### `get_paginated_plans`

Sem mudança de assinatura; passa a incluir `is_active` no
`SELECT` interno (`row_to_json`) para o admin listar/filtrar.

## Fluxo de checkout (`create-stripe-checkout-session-action.ts`)

Schema de entrada muda de `{ slug }` para:

```ts
const schema = z.object({
  slug: z.string().min(1),
  frequence: z.enum(["month", "year"]),
});
```

Lógica:

1. Busca `plans` por `slug` **e `is_active = true`** — se não achar,
   erro "Plano de assinatura não encontrado".
2. Chama `get_active_payment_link(plan.id, frequence)` via RPC.
3. **Link encontrado:** monta a URL final anexando query params ao
   `payment_link_url`:
   `?client_reference_id=<user.id>&prefilled_email=<encodeURIComponent(user.email)>`.
   Retorna essa URL direto — **sem chamar a API do Stripe** nesse
   caminho.
4. **Nenhum link encontrado:** fallback ao comportamento atual —
   `stripe.checkout.sessions.create` com `price_data` usando
   `plan.value` e `recurring.interval` derivado do `frequence` recebido
   (corrige o bug do `"month"` hardcoded, já que agora vem do input
   validado, não mais fixo). Mantém `metadata: { plan_id, user_id,
   frequence, date }` como hoje.
5. Evento PostHog `create_stripe_checkout_session` disparado nos dois
   casos, com `plan_id` e um campo adicional indicando qual caminho foi
   usado (`payment_link` vs `dynamic_fallback`) para observabilidade.

## `paywall-screen.tsx`

- `handleSignPlan`/`proceedToCheckout` passam a receber o **slug
  canônico ativo** (`"plus-care-month"` fixo — não mais construído a
  partir do switcher) e enviam `frequence: billing` separadamente:

  ```ts
  await executeCreateStripeCheckoutSession({
    slug: "plus-care-month",
    frequence: billing, // "month" | "year"
  });
  ```

- Preços exibidos (`R$79,90` / `R$799,00`) deixam de ser hardcoded.
  `app/(dashboard).../paywall/page.tsx` (Server Component) busca, para
  o plano ativo `plus-care-month`, os preços de ambas as frequências:

  ```ts
  const plan = await getActivePlanBySlug("plus-care-month");
  const [monthLink, yearLink] = await Promise.all([
    getActivePaymentLink(plan.id, "month"),
    getActivePaymentLink(plan.id, "year"),
  ]);
  const monthPrice = monthLink?.amount ?? plan.value;
  const yearPrice = yearLink?.amount; // obrigatório quando existe (constraint garante)
  ```

  Passa `monthPrice`/`yearPrice` (ou `null` se algum não estiver
  configurado — nesse caso o switcher desabilita a opção
  correspondente com uma mensagem "indisponível no momento") como props
  para `PaywallScreen`.
- Regra de exibição do "preço original": quando `monthLink` é `NULL`
  ou `monthLink.amount` é `NULL`, mostra apenas `plan.value` sem
  indicação de promoção (mantém a regra original apenas para o caso
  mensal, conforme decidido).

## Webhook (`api/stripe/webhook/route.ts`)

No handler de `checkout.session.completed`:

1. **Resolução de usuário:** `user_id = session.metadata?.user_id ??
   session.client_reference_id`. Sessions originadas de Payment Link
   não têm `metadata` nossa, então caem no `client_reference_id`.
2. **Resolução de plano/frequência:**
   - Se `session.payment_link` (id do Payment Link Stripe) estiver
     presente: busca `stripe_payment_link` por
     `stripe_payment_link_id = session.payment_link` → obtém
     `plan_id` e `frequence` dessa linha.
   - Caso contrário (fallback dinâmico): usa
     `session.metadata.plan_id` / `session.metadata.frequence` como
     hoje.
   - Se nenhuma das duas resolver, mantém o erro 400 atual
     ("Checkout session metadata is missing plan_id or frequence.").
3. **Contagem de uso:** quando `session.payment_link` está presente E
   o `upsert` em `subscriptions` resultou em um **insert novo** (não
   uma atualização de linha já existente pelo mesmo
   `subscription_id` — checar via `select` prévio por
   `subscription_id` antes do upsert, já que o Supabase JS não
   diferencia insert/update em upsert), incrementa
   `stripe_payment_link.used_subscription = used_subscription + 1`
   via `supabaseAdmin.rpc` ou update direto com
   `used_subscription: used_subscription + 1` lido antes. Isso garante
   que reentrega do mesmo evento pelo Stripe (retry) não conte a
   mesma assinatura duas vezes.
4. `handleEnterpriseSubscription`/`handleIndividualSubscription` não
   mudam de assinatura interna, só passam a receber `frequence`
   possivelmente resolvido pela nova fonte.

`customer.subscription.updated`/`.deleted` não mudam.

## Admin (`apps/admin`)

### `plans`

- `planSchema` (`apps/admin/src/actions/plans.ts`): adiciona
  `is_active: z.boolean().default(true)`. `value` permanece
  (`nullable/optional` como hoje), rótulo no formulário atualizado
  para "Valor de fallback (R$)" com texto auxiliar explicando que só
  é usado sem link de pagamento ativo.
- `plan-edit-form.tsx` / `plan-create-form.tsx`: adiciona um
  `Switch`/checkbox "Plano ativo" (`is_active`), mantém campo de
  valor com o novo rótulo.

### `stripe_payment_link` — novo CRUD

Novos arquivos, seguindo o padrão existente de `plans`:

- `apps/admin/src/actions/stripe-payment-links.ts`:
  `getPaymentLinksByPlanAction`, `createPaymentLinkAction`,
  `updatePaymentLinkAction`, `deletePaymentLinkAction` — todas via
  `adminActionClient`/`supabaseAdmin`, schema Zod espelhando as
  colunas da tabela (incluindo o `CHECK` de `amount` obrigatório para
  `frequence = 'year'` refletido como `.superRefine` no Zod para dar
  erro amigável antes de bater no banco).
- `apps/admin/app/(admin)/plans/[id]/_components/plan-payment-links-section.tsx`:
  nova seção na página de edição do plano (`plans/[id]/page.tsx`)
  listando os links do plano (tabela com badges para
  `is_active`/`is_primary`/`is_priority`/`is_limited`,
  `used_subscription/total_subscriptions`) com um form de
  criar/editar (modal ou inline), reaproveitando os componentes
  `Card`/`Input`/`Select`/`Switch` já usados em `plan-edit-form.tsx`.

Fora do escopo desta etapa: criar o Payment Link no Stripe em si (via
Dashboard ou MCP do Stripe) continua manual — o admin só registra a
URL e o `stripe_payment_link_id` já existentes. A criação
automatizada via Stripe MCP fica para uma iteração futura, já que o
MCP do Stripe não está autorizado nesta sessão.

## Idempotência e concorrência

- Upsert de `subscriptions` já usa `onConflict: subscription_id`
  (idempotente para o registro da assinatura em si).
- Incremento de `used_subscription` precisa de proteção adicional
  contra reentrega do webhook (ver passo 3 acima) — condicionado a
  "essa foi a primeira vez que vimos esse `subscription_id`".
- Corrida entre dois usuários simultâneos escolhendo o mesmo link
  quase esgotado: aceitável estourar `used_subscription` por 1 no
  pior caso (mesma limitação que qualquer sistema de contagem
  otimista); não há requisito de lock pessimista aqui.

## Testes

- Migration: roda limpa em ambiente local (`db:push`), `db:types`
  atualizado.
- `get_active_payment_link`: casos via SQL direto — nenhum link,
  1 link ativo, múltiplos ativos com cada combinação de
  `is_priority`/`is_primary`, link `is_limited` esgotado é excluído.
- Checkout action: caso com link ativo (retorna URL com query params
  corretos), caso sem link (fallback com `price_data` e `frequence`
  correta), caso plano `is_active = false` (erro).
- Webhook: evento simulado com `payment_link` presente (resolve
  plano/frequência pela tabela, incrementa uso uma única vez mesmo
  com evento duplicado) e evento do fallback dinâmico (comportamento
  inalterado).
- Manual: fluxo completo no paywall com Stripe test mode, alternando
  o switcher mensal/anual, confirmando preço exibido e redirecionamento
  para a URL correta.

## Fora de escopo

- Fluxo de checkout empresarial (`enterprise_id`) — não é acessível
  pela UI hoje, nenhuma mudança de comportamento planejada.
- Criação/edição de Payment Links diretamente no Stripe via MCP
  (requer autorização do MCP do Stripe; usuário pode autorizar via
  `/mcp` numa sessão interativa).
- Suporte a `quarter`/`semester` no paywall (linhas de plano
  correspondentes ficam desativadas, mas não deletadas).
