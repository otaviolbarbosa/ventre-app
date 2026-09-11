# Stripe Payment Links para Assinatura de Planos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dynamic Stripe Checkout Session (built from `plans.value` via `price_data`) with Stripe-managed Payment Links, selected per plan+frequency by a precedence rule, with usage synced back through the webhook.

**Architecture:** A new `stripe_payment_link` table (N rows per plan, one `frequence` each) plus a `get_active_payment_link(plan_id, frequence)` SQL function picks the winning link. The checkout action redirects straight to that link's URL (with `client_reference_id`/`prefilled_email` query params) when one exists, falling back to today's dynamic Checkout Session otherwise. The webhook resolves `plan_id`/`frequence` from the Payment Link (instead of our own metadata) and increments `used_subscription` atomically. Admin gets CRUD for the new table plus an `is_active` toggle on `plans`.

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres + RLS), `next-safe-action`, Zod, Stripe SDK, Vitest.

**Spec:** [docs/superpowers/specs/2026-09-01-stripe-payment-links-design.md](../specs/2026-09-01-stripe-payment-links-design.md)

## Global Constraints

- All new user-facing strings in the admin UI and any web-facing copy: **Portuguese (pt-BR)**.
- Server actions use `next-safe-action` via `authActionClient` (web) / `adminActionClient` (admin) — never call Supabase directly from client components.
- Every Supabase query must handle `error` explicitly (throw, never silently swallow) per repo convention.
- After any migration, run `pnpm db:types` to keep `packages/supabase/src/types/database.types.ts` in sync — required before code that references new columns/tables will type-check.
- `stripe_payment_link.amount` is nullable **only** when `frequence = 'month'` (falls back to `plans.value`); it is **required** when `frequence = 'year'` — enforced by a DB `CHECK` and mirrored in the Zod schema for a friendly error.
- A `stripe_payment_link` with `is_limited = true` and `used_subscription >= total_subscriptions` is **excluded** from selection entirely (not just deprioritized).
- `used_subscription` only ever increments (webhook), never decrements.

---

## File Structure

**Database (`packages/supabase/supabase/migrations/`):**
- `20260901000000_plans_add_is_active.sql` — new column + backfill.
- `20260901000001_stripe_payment_link_table.sql` — new table, indexes, RLS, trigger.
- `20260901000002_payment_link_functions.sql` — `get_active_payment_link`, `increment_payment_link_usage`.
- `20260901000003_get_paginated_plans_add_is_active.sql` — updated RPC.

**Web app (`apps/web`):**
- `src/lib/stripe-payment-link-redirect.ts` (new) — pure URL-building helper.
- `src/lib/webhook-checkout-source.ts` (new) — pure resolution logic for the webhook.
- `src/actions/create-stripe-checkout-session-action.ts` (modify) — branch on payment link vs fallback.
- `app/(public)/paywall/page.tsx` (modify) — fetch prices server-side.
- `src/screens/paywall-screen.tsx` (modify) — accept prices as props, send `slug` + `frequence`.
- `app/api/stripe/webhook/route.ts` (modify) — resolve plan/frequence from payment link, sync usage.

**Admin app (`apps/admin`):**
- `src/actions/plans.ts` (modify) — `is_active` in schema/actions.
- `app/(admin)/plans/[id]/_components/plan-edit-form.tsx` (modify) — `is_active` checkbox, relabel `value`.
- `app/(admin)/plans/new/_components/plan-create-form.tsx` (modify) — `is_active` checkbox.
- `app/(admin)/plans/_components/plans-table.tsx` (modify) — "Ativo" column.
- `app/(admin)/plans/[id]/page.tsx` (modify) — fetch + render payment links section.
- `src/actions/stripe-payment-links.ts` (new) — CRUD actions.
- `app/(admin)/plans/[id]/_components/plan-payment-links-section.tsx` (new) — list + create/edit UI.

---

### Task 1: Migration — `plans.is_active`

**Files:**
- Create: `packages/supabase/supabase/migrations/20260901000000_plans_add_is_active.sql`

**Interfaces:**
- Produces: `public.plans.is_active boolean NOT NULL DEFAULT true`, used by Task 8 (checkout action), Task 10 (paywall page), Task 11 (admin plan actions/forms).

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
pnpm db:push
```

Verify (via Supabase Studio SQL editor, `psql`, or the Supabase MCP `execute_sql` tool if available):

```sql
SELECT slug, is_active FROM public.plans ORDER BY slug;
```

Expected: `basic-care` and every `*-month` slug have `is_active = true`; every `*-quarter`, `*-semester`, `*-year` slug has `is_active = false`.

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/supabase/migrations/20260901000000_plans_add_is_active.sql
git commit -m "feat(db): add plans.is_active and deactivate non-monthly plan rows"
```

---

### Task 2: Migration — `stripe_payment_link` table

**Files:**
- Create: `packages/supabase/supabase/migrations/20260901000001_stripe_payment_link_table.sql`

**Interfaces:**
- Consumes: `public.plans(id)` (Task 1's table, unchanged shape otherwise), `public.subscription_frequence` enum (from `20260302000003_subscriptions_table.sql`), `public.handle_updated_at()` trigger function (already exists in the repo — reused, e.g., by `subscriptions`).
- Produces: `public.stripe_payment_link` table with columns `id, plan_id, frequence, payment_link_url, stripe_payment_link_id, is_active, is_primary, is_priority, is_limited, total_subscriptions, used_subscription, amount, created_at, updated_at` — consumed by Task 3 (functions), Task 8 (checkout action), Task 9 (webhook), Task 12/13 (admin CRUD + UI).

- [ ] **Step 1: Write the migration**

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
```

- [ ] **Step 2: Apply and verify**

Run: `pnpm db:push`

Verify the constraint behaves as expected:

```sql
-- should fail (year requires amount)
INSERT INTO public.stripe_payment_link (plan_id, frequence, payment_link_url, stripe_payment_link_id)
VALUES ((SELECT id FROM public.plans WHERE slug = 'plus-care-month'), 'year', 'https://buy.stripe.com/test_year', 'plink_test_year_no_amount');

-- should succeed
INSERT INTO public.stripe_payment_link (plan_id, frequence, payment_link_url, stripe_payment_link_id, amount)
VALUES ((SELECT id FROM public.plans WHERE slug = 'plus-care-month'), 'year', 'https://buy.stripe.com/test_year', 'plink_test_year', 79900);

-- clean up test rows
DELETE FROM public.stripe_payment_link WHERE stripe_payment_link_id IN ('plink_test_year_no_amount', 'plink_test_year');
```

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/supabase/migrations/20260901000001_stripe_payment_link_table.sql
git commit -m "feat(db): add stripe_payment_link table with RLS"
```

---

### Task 3: Migration — selection + usage-increment functions

**Files:**
- Create: `packages/supabase/supabase/migrations/20260901000002_payment_link_functions.sql`

**Interfaces:**
- Consumes: `public.stripe_payment_link` (Task 2).
- Produces: `public.get_active_payment_link(p_plan_id uuid, p_frequence public.subscription_frequence) RETURNS public.stripe_payment_link` (consumed by Task 8, Task 10), `public.increment_payment_link_usage(p_payment_link_id uuid) RETURNS void` (consumed by Task 9).

- [ ] **Step 1: Write the migration**

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

CREATE OR REPLACE FUNCTION public.increment_payment_link_usage(p_payment_link_id uuid)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.stripe_payment_link
  SET used_subscription = used_subscription + 1
  WHERE id = p_payment_link_id;
$$;

GRANT EXECUTE ON FUNCTION public.increment_payment_link_usage(uuid) TO service_role;
```

- [ ] **Step 2: Apply and verify**

Run: `pnpm db:push`

Verify the precedence rule with throwaway data:

```sql
-- setup: two active links for the same plan+frequence
WITH p AS (SELECT id FROM public.plans WHERE slug = 'plus-care-month')
INSERT INTO public.stripe_payment_link (plan_id, frequence, payment_link_url, stripe_payment_link_id, is_priority)
SELECT id, 'month', 'https://buy.stripe.com/test_a', 'plink_test_a', false FROM p;

WITH p AS (SELECT id FROM public.plans WHERE slug = 'plus-care-month')
INSERT INTO public.stripe_payment_link (plan_id, frequence, payment_link_url, stripe_payment_link_id, is_priority)
SELECT id, 'month', 'https://buy.stripe.com/test_b', 'plink_test_b', true FROM p;

-- expect plink_test_b (is_priority wins)
SELECT stripe_payment_link_id FROM public.get_active_payment_link(
  (SELECT id FROM public.plans WHERE slug = 'plus-care-month'), 'month'
);

-- exhaust plink_test_b, expect fallback to plink_test_a
UPDATE public.stripe_payment_link SET is_limited = true, total_subscriptions = 1, used_subscription = 1
WHERE stripe_payment_link_id = 'plink_test_b';

SELECT stripe_payment_link_id FROM public.get_active_payment_link(
  (SELECT id FROM public.plans WHERE slug = 'plus-care-month'), 'month'
);

-- test increment
SELECT used_subscription FROM public.stripe_payment_link WHERE stripe_payment_link_id = 'plink_test_a';
SELECT public.increment_payment_link_usage(
  (SELECT id FROM public.stripe_payment_link WHERE stripe_payment_link_id = 'plink_test_a')
);
SELECT used_subscription FROM public.stripe_payment_link WHERE stripe_payment_link_id = 'plink_test_a'; -- expect +1

-- clean up
DELETE FROM public.stripe_payment_link WHERE stripe_payment_link_id IN ('plink_test_a', 'plink_test_b');
```

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/supabase/migrations/20260901000002_payment_link_functions.sql
git commit -m "feat(db): add payment link selection and usage-increment functions"
```

---

### Task 4: Migration — `get_paginated_plans` includes `is_active`

**Files:**
- Modify (via new migration, functions aren't edited in place): Create `packages/supabase/supabase/migrations/20260901000003_get_paginated_plans_add_is_active.sql`

**Interfaces:**
- Consumes: `public.plans.is_active` (Task 1).
- Produces: same RPC name/signature `get_paginated_plans(page, size)`, now returning `is_active` per row — consumed by Task 11 (`plans-table.tsx`).

- [ ] **Step 1: Write the migration**

```sql
CREATE OR REPLACE FUNCTION public.get_paginated_plans(
  page integer DEFAULT 1,
  size integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_total_pages integer;
  v_data jsonb;
BEGIN
  v_offset := (page - 1) * size;

  SELECT COUNT(*) INTO v_total FROM public.plans;

  v_total_pages := CEIL(v_total::numeric / size);

  SELECT jsonb_agg(row_to_json(p))
  INTO v_data
  FROM (
    SELECT
      id,
      name,
      slug,
      description,
      type,
      value,
      benefits,
      is_active
    FROM public.plans
    ORDER BY value ASC
    LIMIT size
    OFFSET v_offset
  ) p;

  RETURN jsonb_build_object(
    'data', COALESCE(v_data, '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', page,
      'size', size,
      'total_pages', v_total_pages
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_paginated_plans(integer, integer) TO anon, authenticated, service_role;
```

- [ ] **Step 2: Apply and verify**

Run: `pnpm db:push`, then:

```sql
SELECT public.get_paginated_plans(1, 10);
```

Expected: each object in `data` includes an `is_active` boolean field.

- [ ] **Step 3: Commit**

```bash
git add packages/supabase/supabase/migrations/20260901000003_get_paginated_plans_add_is_active.sql
git commit -m "feat(db): include is_active in get_paginated_plans"
```

---

### Task 5: Regenerate TypeScript types

**Files:**
- Modify: `packages/supabase/src/types/database.types.ts` (generated, not hand-edited)

**Interfaces:**
- Consumes: the full DB schema after Tasks 1–4.
- Produces: `Tables<"plans">` including `is_active`; `Tables<"stripe_payment_link">`; RPC signatures for `get_active_payment_link` / `increment_payment_link_usage` / `get_paginated_plans` — consumed by every subsequent web/admin task.

- [ ] **Step 1: Regenerate**

```bash
pnpm db:types
```

- [ ] **Step 2: Verify the new types exist**

```bash
grep -n "stripe_payment_link" packages/supabase/src/types/database.types.ts | head -5
grep -n "is_active" packages/supabase/src/types/database.types.ts | head -5
grep -n "get_active_payment_link\|increment_payment_link_usage" packages/supabase/src/types/database.types.ts
```

Expected: all four `grep`s return matches.

- [ ] **Step 3: Type-check the whole repo**

```bash
pnpm check-types
```

Expected: passes (or fails only on pre-existing unrelated errors — confirm by checking `git stash` diff if unsure).

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/src/types/database.types.ts
git commit -m "chore(db): regenerate types for stripe_payment_link and plans.is_active"
```

---

### Task 6: Pure helper — payment link redirect URL

**Files:**
- Create: `apps/web/src/lib/stripe-payment-link-redirect.ts`
- Test: `apps/web/src/lib/stripe-payment-link-redirect.test.ts`

**Interfaces:**
- Produces: `buildPaymentLinkRedirectUrl(input: { paymentLinkUrl: string; userId: string; email: string }): string` — consumed by Task 8.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildPaymentLinkRedirectUrl } from "./stripe-payment-link-redirect";

describe("buildPaymentLinkRedirectUrl", () => {
  it("appends client_reference_id and prefilled_email to a bare payment link", () => {
    const url = buildPaymentLinkRedirectUrl({
      paymentLinkUrl: "https://buy.stripe.com/test_abc123",
      userId: "user-1",
      email: "maria@example.com",
    });

    expect(url).toBe(
      "https://buy.stripe.com/test_abc123?client_reference_id=user-1&prefilled_email=maria%40example.com",
    );
  });

  it("preserves existing query params on the payment link", () => {
    const url = buildPaymentLinkRedirectUrl({
      paymentLinkUrl: "https://buy.stripe.com/test_abc123?locale=pt-BR",
      userId: "user-2",
      email: "joao@example.com",
    });

    expect(url).toBe(
      "https://buy.stripe.com/test_abc123?locale=pt-BR&client_reference_id=user-2&prefilled_email=joao%40example.com",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/stripe-payment-link-redirect.test.ts`
Expected: FAIL — `Cannot find module './stripe-payment-link-redirect'`

- [ ] **Step 3: Write minimal implementation**

```ts
export function buildPaymentLinkRedirectUrl({
  paymentLinkUrl,
  userId,
  email,
}: {
  paymentLinkUrl: string;
  userId: string;
  email: string;
}): string {
  const url = new URL(paymentLinkUrl);
  url.searchParams.set("client_reference_id", userId);
  url.searchParams.set("prefilled_email", email);
  return url.toString();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/stripe-payment-link-redirect.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/stripe-payment-link-redirect.ts apps/web/src/lib/stripe-payment-link-redirect.test.ts
git commit -m "feat(web): add payment link redirect URL helper"
```

---

### Task 7: Pure helper — webhook checkout source resolution

**Files:**
- Create: `apps/web/src/lib/webhook-checkout-source.ts`
- Test: `apps/web/src/lib/webhook-checkout-source.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type ResolvedCheckoutSource = {
    userId: string | null;
    enterpriseId: string | null;
    planId: string;
    frequence: "month" | "quarter" | "semester" | "year";
  };

  function resolveCheckoutSource(input: {
    metadata: { user_id?: string; enterprise_id?: string; plan_id?: string; frequence?: string };
    clientReferenceId: string | null;
    paymentLinkPlan: { planId: string; frequence: string } | null;
  }): ResolvedCheckoutSource | null
  ```
  Consumed by Task 9 (webhook route).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { resolveCheckoutSource } from "./webhook-checkout-source";

describe("resolveCheckoutSource", () => {
  it("resolves plan/frequence from the payment link when session.payment_link matched one", () => {
    const result = resolveCheckoutSource({
      metadata: {},
      clientReferenceId: "user-123",
      paymentLinkPlan: { planId: "plan-abc", frequence: "year" },
    });

    expect(result).toEqual({
      userId: "user-123",
      enterpriseId: null,
      planId: "plan-abc",
      frequence: "year",
    });
  });

  it("falls back to metadata when there is no payment link (dynamic checkout path)", () => {
    const result = resolveCheckoutSource({
      metadata: { user_id: "user-456", plan_id: "plan-def", frequence: "month" },
      clientReferenceId: null,
      paymentLinkPlan: null,
    });

    expect(result).toEqual({
      userId: "user-456",
      enterpriseId: null,
      planId: "plan-def",
      frequence: "month",
    });
  });

  it("prefers metadata.user_id over client_reference_id when both are present", () => {
    const result = resolveCheckoutSource({
      metadata: { user_id: "user-from-metadata" },
      clientReferenceId: "user-from-client-ref",
      paymentLinkPlan: { planId: "plan-abc", frequence: "month" },
    });

    expect(result?.userId).toBe("user-from-metadata");
  });

  it("resolves enterprise_id from metadata regardless of payment link presence", () => {
    const result = resolveCheckoutSource({
      metadata: { enterprise_id: "ent-1", plan_id: "plan-def", frequence: "month" },
      clientReferenceId: null,
      paymentLinkPlan: null,
    });

    expect(result?.enterpriseId).toBe("ent-1");
    expect(result?.userId).toBeNull();
  });

  it("returns null when neither a payment link nor metadata plan_id/frequence resolve", () => {
    const result = resolveCheckoutSource({
      metadata: {},
      clientReferenceId: "user-123",
      paymentLinkPlan: null,
    });

    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/lib/webhook-checkout-source.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```ts
type SubscriptionFrequence = "month" | "quarter" | "semester" | "year";

type ResolvedCheckoutSource = {
  userId: string | null;
  enterpriseId: string | null;
  planId: string;
  frequence: SubscriptionFrequence;
};

export function resolveCheckoutSource({
  metadata,
  clientReferenceId,
  paymentLinkPlan,
}: {
  metadata: { user_id?: string; enterprise_id?: string; plan_id?: string; frequence?: string };
  clientReferenceId: string | null;
  paymentLinkPlan: { planId: string; frequence: string } | null;
}): ResolvedCheckoutSource | null {
  const planId = paymentLinkPlan?.planId ?? metadata.plan_id;
  const frequence = paymentLinkPlan?.frequence ?? metadata.frequence;

  if (!planId || !frequence) return null;

  const userId = metadata.user_id ?? clientReferenceId ?? null;
  const enterpriseId = metadata.enterprise_id ?? null;

  return {
    userId,
    enterpriseId,
    planId,
    frequence: frequence as SubscriptionFrequence,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/lib/webhook-checkout-source.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/webhook-checkout-source.ts apps/web/src/lib/webhook-checkout-source.test.ts
git commit -m "feat(web): add webhook checkout source resolution helper"
```

---

### Task 8: Checkout action — payment link redirect + fixed fallback

**Files:**
- Modify: `apps/web/src/actions/create-stripe-checkout-session-action.ts`

**Interfaces:**
- Consumes: `buildPaymentLinkRedirectUrl` (Task 6), `public.get_active_payment_link` RPC (Task 3), `plans.is_active` (Task 1).
- Produces: action input shape `{ slug: string; frequence: "month" | "year" }` (was `{ slug: string }`) — consumed by Task 10 (`paywall-screen.tsx`). Return type unchanged: `string` (the redirect URL).

- [ ] **Step 1: Replace the action**

Full new contents of `apps/web/src/actions/create-stripe-checkout-session-action.ts`:

```ts
"use server";

import { dayjs } from "@/lib/dayjs";
import { captureServerEvent } from "@/lib/posthog/server";
import { buildPaymentLinkRedirectUrl } from "@/lib/stripe-payment-link-redirect";
import { authActionClient } from "@/lib/safe-action";
import type { Database } from "@ventre/supabase/types";
import Stripe from "stripe";
import { z } from "zod";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

const schema = z.object({
  slug: z.string().min(1, "Escolha um plano para fazer assinatura"),
  frequence: z.enum(["month", "year"]),
});

type StripePaymentLink = Database["public"]["Tables"]["stripe_payment_link"]["Row"];

export const createStripeCheckoutSessionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    if (!STRIPE_SECRET_KEY) {
      throw new Error("Erro ao inicializar gateway de pagamento");
    }

    const { data: plan, error } = await supabase
      .from("plans")
      .select()
      .eq("slug", parsedInput.slug)
      .eq("is_active", true)
      .single();

    if (!plan || error) {
      throw new Error("Plano de assinatura não encontrado");
    }

    const { data: paymentLink } = await supabase.rpc("get_active_payment_link", {
      p_plan_id: plan.id,
      p_frequence: parsedInput.frequence,
    });

    const activeLink = (paymentLink as StripePaymentLink | null) ?? null;

    if (activeLink) {
      const redirectUrl = buildPaymentLinkRedirectUrl({
        paymentLinkUrl: activeLink.payment_link_url,
        userId: user.id,
        email: user.email,
      });

      await captureServerEvent(user.id, "create_stripe_checkout_session", {
        plan_id: plan.id,
        source: "payment_link",
      });

      return redirectUrl;
    }

    if (plan.value === null) {
      throw new Error("Plano de assinatura inválido para pagamento");
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2026-02-25.clover",
    });

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer_email: user.email,
      payment_method_types: ["card", "boleto"],
      mode: "subscription",
      success_url: `${APP_URL}/payment-confirmation`,
      cancel_url: `${APP_URL}/paywall`,
      locale: "pt-BR",
      metadata: {
        date: dayjs().toISOString(),
        plan_id: plan.id,
        frequence: parsedInput.frequence,
        user_id: user.id,
      },
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: plan.value,
            product_data: {
              name: plan.name,
              ...(plan.description ? { description: plan.description } : {}),
            },
            recurring: {
              interval: parsedInput.frequence === "year" ? "year" : "month",
            },
          },
          quantity: 1,
        },
      ],
    };

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    await captureServerEvent(user.id, "create_stripe_checkout_session", {
      plan_id: plan.id,
      source: "dynamic_fallback",
    });

    return checkoutSession.url;
  });
```

- [ ] **Step 2: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors (fix any signature mismatch against the actual generated `Database` type from Task 5 — e.g. if the RPC return type isn't a nullable single row, adjust the cast accordingly).

- [ ] **Step 3: Manual verification checklist** (no existing test harness mocks Supabase/Stripe for server actions in this repo — verify manually against a local Supabase + Stripe test mode)

  - With an active `stripe_payment_link` row for `plus-care-month` + `frequence=month`: calling the action with `{ slug: "plus-care-month", frequence: "month" }` returns a URL starting with the link's `payment_link_url` and containing `client_reference_id`/`prefilled_email` query params for the logged-in user.
  - With no active payment link for `plus-care-month` + `frequence=year`: the action creates a dynamic Checkout Session with `recurring.interval: "year"` and `metadata.frequence: "year"` (previously always `"month"` — confirm the fix).
  - Calling with a `slug` whose plan has `is_active = false`: throws "Plano de assinatura não encontrado".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/create-stripe-checkout-session-action.ts
git commit -m "feat(web): redirect to Stripe payment links when available, fix hardcoded frequence in fallback"
```

---

### Task 9: Webhook — resolve plan/frequence from payment link, sync usage

**Files:**
- Modify: `apps/web/app/api/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `resolveCheckoutSource` (Task 7), `public.increment_payment_link_usage` RPC (Task 3).
- Produces: no change to the route's external contract (still `POST` returning `{ received: true }` or an error JSON) — this task only changes internals.

- [ ] **Step 1: Update the `checkout.session.completed` branch**

Replace lines 59–126 of `apps/web/app/api/stripe/webhook/route.ts` (the `if (event.type === "checkout.session.completed")` block) with:

```ts
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      let paymentLinkPlan: { planId: string; frequence: string } | null = null;
      if (session.payment_link) {
        const paymentLinkId =
          typeof session.payment_link === "string" ? session.payment_link : session.payment_link.id;

        const { data: linkRow, error: linkError } = await supabaseAdmin
          .from("stripe_payment_link")
          .select("plan_id, frequence")
          .eq("stripe_payment_link_id", paymentLinkId)
          .maybeSingle();

        if (linkError) throw new Error(`Failed to fetch payment link: ${linkError.message}`);
        if (linkRow) paymentLinkPlan = { planId: linkRow.plan_id, frequence: linkRow.frequence };
      }

      const resolved = resolveCheckoutSource({
        metadata: {
          user_id: session.metadata?.user_id,
          enterprise_id: session.metadata?.enterprise_id,
          plan_id: session.metadata?.plan_id,
          frequence: session.metadata?.frequence,
        },
        clientReferenceId: session.client_reference_id,
        paymentLinkPlan,
      });

      if (!resolved) {
        return NextResponse.json(
          { error: "Checkout session metadata is missing plan_id or frequence." },
          { status: 400 },
        );
      }

      const { data: plan, error: planError } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("id", resolved.planId)
        .maybeSingle();
      if (planError) throw new Error(`Failed to fetch plan: ${planError.message}`);
      if (!plan) {
        return NextResponse.json(
          { error: "Plan not found for checkout session." },
          { status: 404 },
        );
      }

      const subscriptionId = session.subscription as string;
      const paidAt = dayjs.unix(session.created).toISOString();

      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      const firstItem = stripeSubscription.items.data[0];

      if (!firstItem) throw new Error("Subscription has no items");

      const expiresAt = dayjs.unix(firstItem.current_period_end).toISOString();
      const status = session.payment_status === "paid" ? "active" : "pending";

      const { data: existingSubscription } = await supabaseAdmin
        .from("subscriptions")
        .select("id")
        .eq("subscription_id", subscriptionId)
        .maybeSingle();
      const isNewSubscription = !existingSubscription;

      if (resolved.enterpriseId) {
        await handleEnterpriseSubscription({
          supabaseAdmin,
          enterpriseId: resolved.enterpriseId,
          planId: plan.id,
          frequence: resolved.frequence as SubscriptionFrequence,
          subscriptionId,
          status,
          paidAt,
          expiresAt,
        });
      } else if (resolved.userId) {
        await handleIndividualSubscription({
          supabaseAdmin,
          userId: resolved.userId,
          planId: plan.id,
          frequence: resolved.frequence as SubscriptionFrequence,
          subscriptionId,
          status,
          paidAt,
          expiresAt,
        });
      } else {
        return NextResponse.json(
          { error: "Checkout session metadata is missing enterprise_id or user_id." },
          { status: 400 },
        );
      }

      if (paymentLinkPlan && session.payment_link && isNewSubscription) {
        const paymentLinkId =
          typeof session.payment_link === "string" ? session.payment_link : session.payment_link.id;

        const { data: linkRow, error: linkLookupError } = await supabaseAdmin
          .from("stripe_payment_link")
          .select("id")
          .eq("stripe_payment_link_id", paymentLinkId)
          .maybeSingle();
        if (linkLookupError)
          throw new Error(`Failed to look up payment link for usage sync: ${linkLookupError.message}`);

        if (linkRow) {
          const { error: incrementError } = await supabaseAdmin.rpc("increment_payment_link_usage", {
            p_payment_link_id: linkRow.id,
          });
          if (incrementError)
            throw new Error(`Failed to increment payment link usage: ${incrementError.message}`);
        }
      }
    }
```

- [ ] **Step 2: Add the import**

At the top of the file, add:

```ts
import { resolveCheckoutSource } from "@/lib/webhook-checkout-source";
```

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification checklist** (Stripe CLI `stripe trigger checkout.session.completed` against local webhook, or Stripe test-mode dashboard)

  - A `checkout.session.completed` event whose session has `payment_link` set to a `stripe_payment_link_id` already in the DB: `subscriptions` row gets the `plan_id`/`frequence` from that payment link's plan, and `stripe_payment_link.used_subscription` increments by exactly 1.
  - Re-delivering the **same** event (Stripe's "Resend" in the dashboard, or replaying the same payload): `used_subscription` does **not** increment again (guarded by `isNewSubscription`).
  - A session with no `payment_link` (dynamic fallback path) and `metadata.plan_id`/`frequence` set: behaves exactly as before this change.
  - A session with neither a matching payment link nor metadata: webhook returns 400 as before.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/stripe/webhook/route.ts
git commit -m "feat(web): resolve plan/frequence from payment links in webhook, sync usage count"
```

---

### Task 10: Paywall — dynamic prices, canonical slug + frequence

**Files:**
- Modify: `apps/web/app/(public)/paywall/page.tsx`
- Modify: `apps/web/src/screens/paywall-screen.tsx`

**Interfaces:**
- Consumes: `public.get_active_payment_link` RPC (Task 3), action input shape from Task 8 (`{ slug, frequence }`).
- Produces: `PaywallScreen` now takes props `{ monthPrice: number; yearPrice: number | null }` — no other file consumes this component today, so no further ripple.

- [ ] **Step 1: Update the page to fetch prices server-side**

Full new contents of `apps/web/app/(public)/paywall/page.tsx`:

```tsx
import { createServerSupabaseClient } from "@ventre/supabase/server";
import PaywallScreen from "@/screens/paywall-screen";

const PREMIUM_PLAN_SLUG = "plus-care-month";

export default async function PaywallPage() {
  const supabase = await createServerSupabaseClient();

  const { data: plan, error: planError } = await supabase
    .from("plans")
    .select("id, value")
    .eq("slug", PREMIUM_PLAN_SLUG)
    .eq("is_active", true)
    .maybeSingle();

  if (planError) throw new Error(planError.message);

  let monthPrice = plan?.value ?? null;
  let yearPrice: number | null = null;

  if (plan) {
    const [{ data: monthLink }, { data: yearLink }] = await Promise.all([
      supabase.rpc("get_active_payment_link", { p_plan_id: plan.id, p_frequence: "month" }),
      supabase.rpc("get_active_payment_link", { p_plan_id: plan.id, p_frequence: "year" }),
    ]);

    if (monthLink?.amount != null) monthPrice = monthLink.amount;
    if (yearLink?.amount != null) yearPrice = yearLink.amount;
  }

  return <PaywallScreen monthPrice={monthPrice} yearPrice={yearPrice} />;
}
```

- [ ] **Step 2: Update `PaywallScreen` to accept and use the prices, and send `frequence`**

In `apps/web/src/screens/paywall-screen.tsx`:

1. Change the component signature:

```tsx
export default function PaywallScreen({
  monthPrice,
  yearPrice,
}: {
  monthPrice: number | null;
  yearPrice: number | null;
}) {
```

2. Replace `proceedToCheckout`'s body (currently builds `slug: \`${plan}-${billing}\``) with:

```tsx
  const proceedToCheckout = async (plan: string) => {
    setIsLoadingCheckout(true);
    try {
      const {
        data: checkoutSessionUrl,
        serverError,
        validationErrors,
      } = await executeCreateStripeCheckoutSession({
        slug: `${plan}-month`,
        frequence: billing,
      });

      if (validationErrors) {
        toast.error(validationErrors._errors?.[0] ?? "Erro de validação nos dados de pagamento.");
        return;
      }

      if (serverError || !checkoutSessionUrl) {
        toast.error(serverError ?? "Erro na criação da sessão de pagamento.");
        return;
      }

      window.location.assign(checkoutSessionUrl);
    } finally {
      setIsLoadingCheckout(false);
    }
  };
```

3. Replace the hardcoded price block (the `isAnnual ? <>R$799,00...</> : <>R$79,90...</>` JSX) with values derived from props. Add this helper near the top of the file (module scope, outside the component):

```tsx
function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
```

Then replace the price JSX block with:

```tsx
              <div className="mb-6">
                {isAnnual ? (
                  yearPrice != null ? (
                    <>
                      <span className="font-bold font-poppins text-4xl text-primary">
                        {formatBRL(yearPrice)}
                      </span>
                      <p className="mt-1 text-muted-foreground text-xs">
                        por ano · {formatBRL(Math.round(yearPrice / 12))}/mês
                      </p>
                    </>
                  ) : (
                    <span className="font-poppins text-muted-foreground text-sm">
                      Plano anual indisponível no momento
                    </span>
                  )
                ) : monthPrice != null ? (
                  <>
                    <span className="font-bold font-poppins text-4xl text-primary">
                      {formatBRL(monthPrice)}
                    </span>
                    <p className="mt-1 text-muted-foreground text-xs">por mês</p>
                  </>
                ) : (
                  <span className="font-poppins text-muted-foreground text-sm">
                    Plano indisponível no momento
                  </span>
                )}
              </div>
```

Note: the previous "Economize R$159,80 no ano" line depended on a hardcoded comparison and is dropped here — it can't be derived correctly without also knowing whether the annual price is a promo vs. the plan's own reference price, which is out of scope per the spec's simplified display rule.

4. Disable the "Assinar" button when the selected billing cycle has no price:

```tsx
              <Button
                className="gradient-primary mt-8 w-full"
                onClick={() => handleSignPlan("plus-care")}
                disabled={isLoadingCheckout || (isAnnual ? yearPrice == null : monthPrice == null)}
              >
```

- [ ] **Step 3: Type-check**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification** (start the dev server, open `/paywall`)

  - With a `stripe_payment_link` row seeded for `plus-care-month`/month and one for year: page shows those `amount`s (not the old hardcoded `R$79,90`/`R$799,00`).
  - With no payment link at all: page shows `plans.value` for month, and "Plano anual indisponível no momento" for year (since there's no `plans.value` equivalent for year), with the "Assinar" button disabled while on the annual toggle.
  - Clicking "Assinar" while on the annual toggle with a year price configured redirects correctly (network tab shows the redirect URL from Task 8).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(public\)/paywall/page.tsx apps/web/src/screens/paywall-screen.tsx
git commit -m "feat(web): show payment-link-driven prices on paywall, send frequence to checkout"
```

---

### Task 11: Admin — `plans.is_active` in schema, forms, table

**Files:**
- Modify: `apps/admin/src/actions/plans.ts`
- Modify: `apps/admin/app/(admin)/plans/[id]/_components/plan-edit-form.tsx`
- Modify: `apps/admin/app/(admin)/plans/new/_components/plan-create-form.tsx`
- Modify: `apps/admin/app/(admin)/plans/_components/plans-table.tsx`
- Modify: `apps/admin/app/(admin)/plans/[id]/page.tsx`

**Interfaces:**
- Consumes: `plans.is_active` (Task 1), `get_paginated_plans` with `is_active` (Task 4).
- Produces: no new exports consumed elsewhere in this plan — this task is self-contained UI/schema work.

- [ ] **Step 1: Add `is_active` to the Zod schema**

In `apps/admin/src/actions/plans.ts`, update `planSchema`:

```ts
const planSchema = z.object({
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  slug: z.string().min(2, "Slug deve ter ao menos 2 caracteres"),
  description: z.string().nullable().optional(),
  type: z.enum(["free", "premium", "enterprise"]),
  value: z.number().min(0).nullable().optional(),
  benefits: z.array(z.string()).optional(),
  is_active: z.boolean().default(true),
});
```

No other change needed in this file — `createPlanAction`/`updatePlanAction` already spread `parsedInput` into the insert/update payload.

- [ ] **Step 2: Add the checkbox to `plan-edit-form.tsx`**

In `apps/admin/app/(admin)/plans/[id]/_components/plan-edit-form.tsx`:

1. Update the `Plan` type at the top:

```ts
type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  type: string;
  value: number | null;
  benefits: string[];
  is_active: boolean;
};
```

2. Add the import: `import { Checkbox } from "@ventre/ui/checkbox";`

3. Add state: `const [isActive, setIsActive] = useState(plan.is_active);`

4. In `handleSubmit`, add `is_active: isActive,` to the `executeUpdate(...)` call.

5. Relabel the value field and add the checkbox — replace the "Valor (R$)" block:

```tsx
              <div className="space-y-1">
                <Label>Valor de fallback (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-muted-foreground text-xs">
                  Usado só quando não há link de pagamento ativo para o plano.
                </p>
              </div>
```

6. Add a new field right after the benefits `Textarea` (before the action buttons row):

```tsx
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label htmlFor="is-active">Plano ativo (visível no paywall)</Label>
            </div>
```

- [ ] **Step 3: Add the checkbox to `plan-create-form.tsx`**

In `apps/admin/app/(admin)/plans/new/_components/plan-create-form.tsx`:

1. Add the import: `import { Checkbox } from "@ventre/ui/checkbox";`
2. Add state: `const [isActive, setIsActive] = useState(true);`
3. In `handleSubmit`, add `is_active: isActive,` to the `execute(...)` call.
4. Relabel the value field the same way as Step 2.5 above.
5. Add the same checkbox block as Step 2.6 above.

- [ ] **Step 4: Add the checkbox in `page.tsx`'s select**

In `apps/admin/app/(admin)/plans/[id]/page.tsx`, update the `.select(...)` call:

```ts
    .select("id, name, slug, description, type, value, benefits, is_active")
```

- [ ] **Step 5: Add an "Ativo" column to `plans-table.tsx`**

In `apps/admin/app/(admin)/plans/_components/plans-table.tsx`, add a column entry right after `"Tipo"`:

```tsx
          {
            label: "Ativo",
            name: "is_active",
            callback: (plan) => (
              <Badge variant={plan.is_active ? "default" : "outline"}>
                {plan.is_active ? "Ativo" : "Inativo"}
              </Badge>
            ),
          },
```

- [ ] **Step 6: Type-check**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manual verification**

  - `/plans` list shows "Ativo"/"Inativo" badges matching the DB backfill from Task 1 (the `*-month` and `basic-care` rows show "Ativo", the deactivated `*-quarter`/`*-semester`/`*-year` rows show "Inativo").
  - Editing a plan, unchecking "Plano ativo", saving: the row flips to "Inativo" in the list and disappears from the (Task 10) paywall query.
  - Creating a new plan leaves "Plano ativo" checked by default.

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/actions/plans.ts apps/admin/app/\(admin\)/plans
git commit -m "feat(admin): manage plans.is_active in forms, table, and schema"
```

---

### Task 12: Admin — `stripe_payment_link` CRUD actions

**Files:**
- Create: `apps/admin/src/actions/stripe-payment-links.ts`

**Interfaces:**
- Consumes: `Tables<"stripe_payment_link">` (Task 5).
- Produces: `getPaymentLinksByPlanAction({ planId })`, `createPaymentLinkAction(input)`, `updatePaymentLinkAction(input)`, `deletePaymentLinkAction({ id })` — consumed by Task 13.

- [ ] **Step 1: Write the actions file**

```ts
"use server";

import { adminActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const frequenceEnum = z.enum(["month", "quarter", "semester", "year"]);

const basePaymentLinkSchema = z.object({
  plan_id: z.string().uuid(),
  frequence: frequenceEnum,
  payment_link_url: z.string().url("Informe uma URL válida"),
  stripe_payment_link_id: z.string().min(1, "Informe o ID do payment link no Stripe"),
  is_active: z.boolean().default(true),
  is_primary: z.boolean().default(false),
  is_priority: z.boolean().default(false),
  is_limited: z.boolean().default(false),
  total_subscriptions: z.number().int().min(1).nullable().optional(),
  amount: z.number().int().min(0).nullable().optional(),
});

const paymentLinkSchema = basePaymentLinkSchema
  .refine((data) => !data.is_limited || data.total_subscriptions != null, {
    message: "Informe o total de assinaturas quando o link tiver uso limitado",
    path: ["total_subscriptions"],
  })
  .refine((data) => data.frequence !== "year" || data.amount != null, {
    message: "Informe o valor (amount) para links de frequência anual",
    path: ["amount"],
  });

const updatePaymentLinkSchema = basePaymentLinkSchema
  .extend({ id: z.string().uuid() })
  .refine((data) => !data.is_limited || data.total_subscriptions != null, {
    message: "Informe o total de assinaturas quando o link tiver uso limitado",
    path: ["total_subscriptions"],
  })
  .refine((data) => data.frequence !== "year" || data.amount != null, {
    message: "Informe o valor (amount) para links de frequência anual",
    path: ["amount"],
  });

const byPlanSchema = z.object({ plan_id: z.string().uuid() });
const byIdSchema = z.object({ id: z.string().uuid() });

export const getPaymentLinksByPlanAction = adminActionClient
  .schema(byPlanSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { data, error } = await ctx.supabaseAdmin
      .from("stripe_payment_link")
      .select()
      .eq("plan_id", parsedInput.plan_id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  });

export const createPaymentLinkAction = adminActionClient
  .schema(paymentLinkSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { error } = await ctx.supabaseAdmin.from("stripe_payment_link").insert(parsedInput);

    if (error) throw new Error(error.message);

    revalidatePath(`/plans/${parsedInput.plan_id}`);
    return { success: true };
  });

export const updatePaymentLinkAction = adminActionClient
  .schema(updatePaymentLinkSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...data } = parsedInput;

    const { error } = await ctx.supabaseAdmin.from("stripe_payment_link").update(data).eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath(`/plans/${parsedInput.plan_id}`);
    return { success: true };
  });

export const deletePaymentLinkAction = adminActionClient
  .schema(byIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { error } = await ctx.supabaseAdmin
      .from("stripe_payment_link")
      .delete()
      .eq("id", parsedInput.id);

    if (error) throw new Error(error.message);

    revalidatePath("/plans");
    return { success: true };
  });
```

- [ ] **Step 2: Type-check**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: no new errors (if `ctx.supabaseAdmin.from("stripe_payment_link")` doesn't type-check, re-run `pnpm db:types` from the repo root — Task 5 must have completed against a DB that already has the migrations from Tasks 1–4 applied).

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/actions/stripe-payment-links.ts
git commit -m "feat(admin): add CRUD actions for stripe_payment_link"
```

---

### Task 13: Admin — payment links UI section

**Files:**
- Create: `apps/admin/app/(admin)/plans/[id]/_components/plan-payment-links-section.tsx`
- Modify: `apps/admin/app/(admin)/plans/[id]/page.tsx`

**Interfaces:**
- Consumes: `getPaymentLinksByPlanAction`, `createPaymentLinkAction`, `updatePaymentLinkAction`, `deletePaymentLinkAction` (Task 12).
- Produces: `<PlanPaymentLinksSection planId={string} />` — consumed only by `page.tsx` in this task.

- [ ] **Step 1: Write the section component**

```tsx
"use client";

import {
  createPaymentLinkAction,
  deletePaymentLinkAction,
  getPaymentLinksByPlanAction,
  updatePaymentLinkAction,
} from "@/actions/stripe-payment-links";
import type { Tables } from "@ventre/supabase/types";
import { Badge } from "@ventre/ui/badge";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import { Checkbox } from "@ventre/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ventre/ui/dialog";
import { Input } from "@ventre/ui/input";
import { Label } from "@ventre/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ventre/ui/table";
import { useAction } from "next-safe-action/hooks";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PaymentLink = Tables<"stripe_payment_link">;

const frequenceLabels: Record<string, string> = {
  month: "Mensal",
  quarter: "Trimestral",
  semester: "Semestral",
  year: "Anual",
};

type FormState = {
  frequence: "month" | "quarter" | "semester" | "year";
  payment_link_url: string;
  stripe_payment_link_id: string;
  is_active: boolean;
  is_primary: boolean;
  is_priority: boolean;
  is_limited: boolean;
  total_subscriptions: string;
  amount: string;
};

const emptyForm: FormState = {
  frequence: "month",
  payment_link_url: "",
  stripe_payment_link_id: "",
  is_active: true,
  is_primary: false,
  is_priority: false,
  is_limited: false,
  total_subscriptions: "",
  amount: "",
};

export function PlanPaymentLinksSection({ planId }: { planId: string }) {
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { execute: loadLinks } = useAction(getPaymentLinksByPlanAction, {
    onSuccess: ({ data }) => setLinks(data ?? []),
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao carregar links de pagamento"),
  });

  useEffect(() => {
    loadLinks({ plan_id: planId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const { execute: createLink, isExecuting: isCreating } = useAction(createPaymentLinkAction, {
    onSuccess: () => {
      toast.success("Link de pagamento criado!");
      setIsDialogOpen(false);
      loadLinks({ plan_id: planId });
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao criar link de pagamento"),
  });

  const { execute: updateLink, isExecuting: isUpdating } = useAction(updatePaymentLinkAction, {
    onSuccess: () => {
      toast.success("Link de pagamento atualizado!");
      setIsDialogOpen(false);
      loadLinks({ plan_id: planId });
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao atualizar link de pagamento"),
  });

  const { execute: deleteLink } = useAction(deletePaymentLinkAction, {
    onSuccess: () => {
      toast.success("Link de pagamento excluído!");
      loadLinks({ plan_id: planId });
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao excluir link de pagamento"),
  });

  function openCreateDialog() {
    setEditingId(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  }

  function openEditDialog(link: PaymentLink) {
    setEditingId(link.id);
    setForm({
      frequence: link.frequence,
      payment_link_url: link.payment_link_url,
      stripe_payment_link_id: link.stripe_payment_link_id,
      is_active: link.is_active,
      is_primary: link.is_primary,
      is_priority: link.is_priority,
      is_limited: link.is_limited,
      total_subscriptions: link.total_subscriptions != null ? String(link.total_subscriptions) : "",
      amount: link.amount != null ? String(link.amount) : "",
    });
    setIsDialogOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      plan_id: planId,
      frequence: form.frequence,
      payment_link_url: form.payment_link_url,
      stripe_payment_link_id: form.stripe_payment_link_id,
      is_active: form.is_active,
      is_primary: form.is_primary,
      is_priority: form.is_priority,
      is_limited: form.is_limited,
      total_subscriptions: form.total_subscriptions !== "" ? Number(form.total_subscriptions) : null,
      amount: form.amount !== "" ? Number(form.amount) : null,
    };

    if (editingId) {
      updateLink({ id: editingId, ...payload });
    } else {
      createLink(payload);
    }
  }

  function handleDelete(id: string) {
    if (!window.confirm("Tem certeza que deseja excluir este link de pagamento?")) return;
    deleteLink({ id });
  }

  return (
    <Card className="mt-6">
      <CardContent className="pt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-lg">Links de pagamento</h2>
          <Button type="button" onClick={openCreateDialog}>
            Novo link
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Frequência</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead>Stripe ID</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.map((link) => (
              <TableRow key={link.id}>
                <TableCell>{frequenceLabels[link.frequence] ?? link.frequence}</TableCell>
                <TableCell className="space-x-1">
                  <Badge variant={link.is_active ? "default" : "outline"}>
                    {link.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  {link.is_primary && <Badge variant="outline">Primário</Badge>}
                  {link.is_priority && <Badge variant="outline">Prioridade</Badge>}
                </TableCell>
                <TableCell>
                  {link.amount != null ? (link.amount / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }) : "—"}
                </TableCell>
                <TableCell>
                  {link.is_limited ? `${link.used_subscription}/${link.total_subscriptions}` : "Ilimitado"}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground text-xs">
                  {link.stripe_payment_link_id}
                </TableCell>
                <TableCell className="space-x-3 text-right">
                  <button
                    type="button"
                    className="text-primary text-sm hover:underline"
                    onClick={() => openEditDialog(link)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-destructive text-sm hover:underline"
                    onClick={() => handleDelete(link.id)}
                  >
                    Excluir
                  </button>
                </TableCell>
              </TableRow>
            ))}
            {links.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Nenhum link de pagamento cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar link de pagamento" : "Novo link de pagamento"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label>Frequência *</Label>
              <Select
                value={form.frequence}
                onValueChange={(v) => setForm((f) => ({ ...f, frequence: v as FormState["frequence"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Mensal</SelectItem>
                  <SelectItem value="quarter">Trimestral</SelectItem>
                  <SelectItem value="semester">Semestral</SelectItem>
                  <SelectItem value="year">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>URL do payment link *</Label>
              <Input
                value={form.payment_link_url}
                onChange={(e) => setForm((f) => ({ ...f, payment_link_url: e.target.value }))}
                placeholder="https://buy.stripe.com/..."
                required
              />
            </div>

            <div className="space-y-1">
              <Label>ID do payment link no Stripe *</Label>
              <Input
                value={form.stripe_payment_link_id}
                onChange={(e) => setForm((f) => ({ ...f, stripe_payment_link_id: e.target.value }))}
                placeholder="plink_..."
                required
              />
            </div>

            <div className="space-y-1">
              <Label>Valor promocional em centavos (obrigatório para anual)</Label>
              <Input
                type="number"
                min={0}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="9000"
              />
            </div>

            <div className="space-y-1">
              <Label>Total de assinaturas (se limitado)</Label>
              <Input
                type="number"
                min={1}
                value={form.total_subscriptions}
                onChange={(e) => setForm((f) => ({ ...f, total_subscriptions: e.target.value }))}
                placeholder="20"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pl-active"
                  checked={form.is_active}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c === true }))}
                />
                <Label htmlFor="pl-active">Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pl-primary"
                  checked={form.is_primary}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_primary: c === true }))}
                />
                <Label htmlFor="pl-primary">Primário</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pl-priority"
                  checked={form.is_priority}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_priority: c === true }))}
                />
                <Label htmlFor="pl-priority">Prioridade</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="pl-limited"
                  checked={form.is_limited}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, is_limited: c === true }))}
                />
                <Label htmlFor="pl-limited">Uso limitado</Label>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {isCreating || isUpdating ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
```

- [ ] **Step 2: Wire it into the plan detail page**

In `apps/admin/app/(admin)/plans/[id]/page.tsx`, add the import and render call:

```tsx
import { PlanPaymentLinksSection } from "./_components/plan-payment-links-section";
```

```tsx
      <PlanEditForm plan={plan} />
      <PlanPaymentLinksSection planId={id} />
```

- [ ] **Step 3: Type-check**

Run: `cd apps/admin && npx tsc --noEmit`
Expected: no new errors. If `@ventre/ui/table` or `@ventre/ui/dialog` exports differ from the names used here, check `packages/ui/src/table.tsx` and `packages/ui/src/dialog.tsx` and adjust the imports to match the actual exported names.

- [ ] **Step 4: Manual verification**

  - Open `/plans/<id>` for `plus-care-month`: "Links de pagamento" section renders (empty state visible with no rows).
  - Click "Novo link", fill in `frequence=year` and leave "Valor promocional" blank, submit: see the server-side validation error surfaced as a toast ("Informe o valor (amount) para links de frequência anual").
  - Fill in a valid year link with an amount, submit: appears in the table with the correct badges and formatted currency.
  - Check "Uso limitado" without a "Total de assinaturas": validation error surfaces.
  - Edit an existing link, toggle "Ativo" off, save: badge flips to "Inativo" and (per Task 8/10) it's excluded from `get_active_payment_link`.
  - Delete a link: disappears from the table.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/\(admin\)/plans/\[id\]
git commit -m "feat(admin): add payment links management UI to plan detail page"
```

---

## Self-Review Notes

- **Spec coverage:** every spec section maps to a task — data model (Tasks 1–3), `get_paginated_plans` (Task 4), types (Task 5), checkout flow (Tasks 6, 8), paywall (Task 10), webhook (Tasks 7, 9), admin (Tasks 11–13). The spec's "Fora de escopo" items (enterprise checkout, Stripe-side link creation, quarter/semester paywall support) are intentionally not tasked.
- **Type consistency:** `resolveCheckoutSource`'s return shape (`userId`, `enterpriseId`, `planId`, `frequence`) is used identically in Task 9's webhook rewrite. `buildPaymentLinkRedirectUrl`'s parameter names (`paymentLinkUrl`, `userId`, `email`) match its Task 8 call site. The checkout action's new input shape (`{ slug, frequence }`) matches exactly what Task 10's `paywall-screen.tsx` sends.
- **No placeholders:** every step has literal code or an exact verification query/command — no "add validation" or "similar to Task N" placeholders remain.
