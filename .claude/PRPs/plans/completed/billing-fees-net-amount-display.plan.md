# Feature: Visualização do valor líquido (pós-taxas) para o profissional

## Summary

Phase 3 (complete) computes and persists a snapshot of applied fees (`billings.applied_billing_fees`, `AppliedBillingFee[]`) at billing-creation time, but no UI reads it — every billing/installment display component renders only the gross per-professional split. This phase adds a single pure calculation helper (`computeNetAmountCents`) and one shared presentational component (`ProfessionalNetAmount`) that both are wired into the three existing display surfaces (`BillingCard`, `InstallmentCard`, `InstallmentList`) so professionals and managers see gross, fees, and net amounts — without touching any calculation/persistence logic from Phase 3.

## User Story

As a profissional
I want to ver claramente o valor líquido (após taxas) em cada cobrança e parcela
So that eu saiba exatamente quanto vou receber, sem precisar calcular manualmente

## Problem Statement

`billings.applied_billing_fees` is populated on every new billing but is never read by the frontend. Professionals currently see only gross amounts in `BillingCard`, `InstallmentCard`, and `InstallmentList`, with no visibility into fees or net amount — defeating the transparency goal of the whole PRD.

## Solution Statement

Add a pure, testable function `computeNetAmountCents` in `apps/web/src/lib/billing/calculations.ts` that derives net amount + itemized fee breakdown for a given professional and gross amount (handling both billing-level amounts, where gross equals the fee snapshot's `base_amount_cents`, and installment-level amounts, where the fee total must be pro-rated using the same ratio convention already used for `splitted_installment`). Wrap it in one new shared component, `ProfessionalNetAmount`, rendered in two modes: a static summary line (used inside the two card components, which are wrapped in `next/link` — nesting an interactive Radix Accordion trigger inside an `<a>` is invalid HTML and was confirmed via research as a known a11y/touch anti-pattern) and an interactive `Accordion` breakdown (used in `InstallmentList`, which is not link-wrapped, for the itemized fee list).

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                       |
| Complexity       | MEDIUM                                            |
| Systems Affected | Billing display (apps/web), no DB/schema changes  |
| Dependencies     | `@radix-ui/react-accordion` ^1.2.2 (already in `packages/ui`, currently unused) |
| Estimated Tasks  | 7                                                  |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════╗
║  InstallmentCard (professional's own dashboard)                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │ Consulta de pré-natal           [Pendente]                   │  ║
║  │ Maria Silva                                                   │  ║
║  │ R$ 150,00   1 de 1 parcelas                       [PIX]      │  ║
║  │ Venc.: 10/07/2026                                              │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════╝
USER_FLOW: profissional vê R$ 150,00 — não sabe que R$ 15,00 de taxa de
           gateway serão descontados; precisa calcular manualmente.
PAIN_POINT: valor exibido é sempre bruto; nenhuma indicação de taxas.
DATA_FLOW: billings.applied_billing_fees é gravado no banco mas nunca lido
           pelo frontend — fica "morto" no payload.
```

### After State
```
╔═══════════════════════════════════════════════════════════════════╗
║  InstallmentCard (professional's own dashboard)                    ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │ Consulta de pré-natal           [Pendente]                   │  ║
║  │ Maria Silva                                                   │  ║
║  │ R$ 135,00  (−R$ 15,00 taxas)    1 de 1 parcelas    [PIX]     │  ║
║  │ Venc.: 10/07/2026                                              │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
║                                                                     ║
║  InstallmentList (billing detail, not link-wrapped → interactive)  ║
║  ┌─────────────────────────────────────────────────────────────┐  ║
║  │ ① R$ 150,00  [Pendente]            Vencimento: 10/07/2026     │  ║
║  │   ─────────────────────────────────────────────────────────  │  ║
║  │   Maria Silva (Dra.)      [−R$ 15,00]  R$ 135,00      ⌄      │  ║ ◄ click expands
║  │   ┊ Valor bruto                              R$ 150,00       │  ║
║  │   ┊ Taxa de gateway (10%)                    −R$ 15,00       │  ║
║  │   ┊ Valor líquido                            R$ 135,00       │  ║
║  └─────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════╝
USER_FLOW: profissional vê o valor líquido como número principal, com o
           total de taxas visível; pode expandir para ver cada taxa
           individualmente quando há contexto de detalhe (não em cards
           que navegam ao clique).
VALUE_ADD: transparência total sem cálculo manual; sem ambiguidade sobre
           quanto será recebido.
DATA_FLOW: applied_billing_fees flui de billings → (cópia por installment
           via flattenInstallments, ou prop direta no InstallmentList) →
           computeNetAmountCents → ProfessionalNetAmount.
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `installment-card.tsx` headline (solo dashboard, `professionalId` set) | Mostra `displayAmount` bruto | Mostra valor líquido em destaque + "(−R$X taxas)" quando há taxas | Profissional vê quanto vai receber sem calcular |
| `installment-card.tsx` / `billing-card.tsx` breakdown por profissional (staff view) | Lista `profId → valor bruto` | Lista `profId → valor líquido` com badge de taxas totais (sem expandir, está dentro de `<Link>`) | Gestor vê líquido por profissional na lista |
| `installment-list.tsx` breakdown por profissional (billing detail) | Lista `profId → valor bruto` | Accordion: linha resumo (líquido + badge) expande para bruto/taxas/líquido detalhado | Visibilidade total sob demanda, sem poluir a UI |
| `billing-card.tsx` (solo professional viewing own patient billing) | Sem breakdown nenhum (`professionals` undefined → bloco nem renderiza) | Nova linha de resumo do próprio valor líquido (via `professionalId` prop) | Profissional solo também vê seu líquido nessa tela, não só no dashboard |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/lib/billing/calculations.ts` | 1-46 | `AppliedBillingFee` type + `applyBillingFeesToSplit` — exact snapshot shape to consume |
| P0 | `apps/web/src/components/billing/billing-card.tsx` | 1-84 | Full file — pattern to MIRROR for per-professional breakdown + add `professionalId` mode |
| P0 | `apps/web/src/components/billing/installment-card.tsx` | 1-81 | Full file — `displayAmount` logic must change to net; staff breakdown block to replace |
| P0 | `apps/web/src/components/billing/installment-list.tsx` | 1-185 | Full file — not link-wrapped, so this is where the interactive `Accordion` breakdown goes |
| P1 | `apps/web/src/lib/billing/dashboard.ts` | 1-51 | `FlatInstallment` type + `flattenInstallments` — must carry `applied_billing_fees` from parent billing onto each flattened installment |
| P1 | `packages/ui/src/accordion.tsx` | 1-53 | Exact `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent` exports and classNames to reuse as-is |
| P1 | `apps/web/app/(dashboard)/patients/[id]/billing/[billingId]/page.tsx` | 1-184 | Caller of `InstallmentList` — needs to pass `appliedBillingFees={billing.applied_billing_fees}` |
| P1 | `apps/web/app/(dashboard)/patients/[id]/billing/page.tsx` | 1-87 | Caller of `BillingCard` — needs `professionalId` wiring for solo-professional view, via `useAuth().user.id` |
| P2 | `apps/web/src/screens/billing-dashboard-screen.tsx` | ~100-125 | Existing `InstallmentCard` usage with `professionalId={user?.id as string}` — confirms this is the primary day-to-day surface |
| P2 | `packages/supabase/src/types/database.types.ts` | 192-210, 381-397 | `billings.applied_billing_fees: Json` exists; `installments` has NO fee column — confirms net must be derived, never read directly from `installments` |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [Radix Tooltip docs](https://www.radix-ui.com/primitives/docs/components/tooltip) | Open behavior | Confirms Tooltip is hover/focus-only — do NOT use for fee breakdown (touch devices won't open it) |
| [Radix Accordion docs](https://www.radix-ui.com/primitives/docs/components/accordion) | `type="single" collapsible` | Confirms the exact props needed for one collapsible item inline in a card |
| [GitHub radix-ui/primitives#2589](https://github.com/radix-ui/primitives/issues/2589) | Tooltip touch issue | Documents the unfixed touch limitation — justifies choosing Accordion over Tooltip |
| [Sarah Higley — Tooltips in WCAG 2.1](https://sarahmhigley.com/writing/tooltips-in-wcag-21/) | Essential content guidance | "Essential content" (financial breakdown) must not live in hover-only tooltips |

---

## Patterns to Mirror

**CURRENCY_FORMATTING (use as-is, do not duplicate):**
```typescript
// SOURCE: apps/web/src/lib/billing/calculations.ts:101-106
export function formatCurrency(amountInCents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountInCents / 100);
}
```

**FEE_SNAPSHOT_SHAPE (already exists, do not modify — Phase 3 owns this):**
```typescript
// SOURCE: apps/web/src/lib/billing/calculations.ts:10-18
export interface AppliedBillingFee {
  professional_id: string;
  fee_id: string;
  name: string;
  fee_type: "fixed" | "percentage";
  value: number;
  base_amount_cents: number;     // the professional's gross billing-level split
  computed_amount_cents: number; // fee amount in cents, already clamped to [0, base_amount_cents]
}
```

**PRO-RATA ROUNDING CONVENTION (mirror this exact style for installment-level fee proration):**
```typescript
// SOURCE: apps/web/src/services/billing.ts:359-365 (how splitted_installment is derived from splitted_billing)
// Math.round((profAmount / total_amount) * installmentAmount) — same rounding family to follow
// in computeNetAmountCents when grossAmountCents !== base_amount_cents (i.e. installment-level call)
```

**EXISTING DUPLICATED BREAKDOWN BLOCK (the thing being replaced in 3 places — copy structure, swap content):**
```tsx
// SOURCE: apps/web/src/components/billing/billing-card.tsx:51-62 (identical in installment-card.tsx:64-75, installment-list.tsx:139-153)
{professionals && billing.splitted_billing && (
  <div className="mt-2 space-y-0.5 border-t pt-2">
    {Object.entries(billing.splitted_billing as Record<string, number>).map(
      ([profId, amount]) => (
        <div key={profId} className="flex justify-between text-muted-foreground text-xs">
          <span>{professionals[profId] ?? profId}</span>
          <span>{formatCurrency(amount)}</span>
        </div>
      ),
    )}
  </div>
)}
```

**ACCORDION_PRIMITIVE (use exactly these exports, do not modify `packages/ui`):**
```tsx
// SOURCE: packages/ui/src/accordion.tsx:9, 53
const Accordion = AccordionPrimitive.Root;
export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
// Accordion supports type="single" collapsible (confirmed via Radix docs research)
```

**BADGE_VARIANTS (for the "−R$X taxas" indicator):**
```tsx
// SOURCE: apps/web/src/lib/billing/calculations.ts:129-132 — variant union already in use
type StatusConfig = { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" };
// packages/ui badge.tsx also exposes "outline" and "info" — use variant="outline" for the neutral fee badge
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/lib/billing/calculations.ts` | UPDATE | Add pure `computeNetAmountCents` helper — single source of truth for net/fee math, reused by all 3 components |
| `apps/web/src/components/billing/professional-net-amount.tsx` | CREATE | Shared presentational component (static summary or Accordion breakdown) — avoids tripling new fee-display logic across 3 near-identical blocks |
| `apps/web/src/components/billing/billing-card.tsx` | UPDATE | Replace gross breakdown block with `ProfessionalNetAmount` (non-interactive, link-wrapped); add optional `professionalId` prop for solo-professional summary |
| `apps/web/src/components/billing/installment-card.tsx` | UPDATE | `displayAmount` becomes net when `professionalId` set; replace gross breakdown block with `ProfessionalNetAmount` (non-interactive) |
| `apps/web/src/components/billing/installment-list.tsx` | UPDATE | Add `appliedBillingFees` prop; replace gross breakdown block with `ProfessionalNetAmount` (interactive — Accordion, since not link-wrapped) |
| `apps/web/src/lib/billing/dashboard.ts` | UPDATE | `FlatInstallment` gains `applied_billing_fees`; `flattenInstallments` copies it from the parent billing onto each installment |
| `apps/web/app/(dashboard)/patients/[id]/billing/[billingId]/page.tsx` | UPDATE | Pass `appliedBillingFees={billing.applied_billing_fees}` to `InstallmentList` |
| `apps/web/app/(dashboard)/patients/[id]/billing/page.tsx` | UPDATE | Pass `professionalId={!isStaff ? user?.id : undefined}` to `BillingCard` for the solo-professional summary line |

---

## NOT Building (Scope Limits)

- **Dashboard aggregate metrics (`dashboard-metrics.tsx`, `DashboardMetrics`)** — top-tile totals (Recebido/Em Atraso/etc.) stay gross. Recomputing aggregate net totals is a separate, larger change (would need to sum fee snapshots across many billings) and isn't required by the phase's success signal ("profissional consegue ver, sem ambiguidade, quanto vai receber líquido em cada cobrança/parcela" — per-billing/per-installment, not aggregate).
- **Changing `billing.total_amount` / `billing.paid_amount` display** — these represent what the patient is charged/has paid and must stay gross; only each professional's *share* is net of fees.
- **Any change to fee calculation, snapshot persistence, or rounding in `services/billing.ts` / `applyBillingFeesToSplit`** — that's Phase 3, already complete and out of scope here.
- **Per-installment fee snapshot column on `installments`** — Phase 3 deliberately stores the snapshot only on `billings`; this phase derives installment-level net by pro-rating, it does not add a new DB column.

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/lib/billing/calculations.ts`

- **ACTION**: ADD `computeNetAmountCents` pure function (and exported `AppliedFeeLineItem` type) after `applyBillingFeesToSplit` (after line 46)
- **IMPLEMENT**:
  ```typescript
  export interface AppliedFeeLineItem {
    fee_id: string;
    name: string;
    fee_type: "fixed" | "percentage";
    value: number;
    amountCents: number;
  }

  export interface NetAmountResult {
    netAmountCents: number;
    totalFeesCents: number;
    feeLineItems: AppliedFeeLineItem[];
  }

  export function computeNetAmountCents(
    grossAmountCents: number,
    appliedFees: AppliedBillingFee[],
    professionalId: string,
  ): NetAmountResult {
    const professionalFees = appliedFees.filter((fee) => fee.professional_id === professionalId);

    if (professionalFees.length === 0) {
      return { netAmountCents: grossAmountCents, totalFeesCents: 0, feeLineItems: [] };
    }

    const baseAmountCents = professionalFees[0]?.base_amount_cents ?? grossAmountCents;
    const ratio = baseAmountCents === 0 ? 0 : grossAmountCents / baseAmountCents;
    const isBillingLevel = baseAmountCents === grossAmountCents;

    const feeLineItems: AppliedFeeLineItem[] = professionalFees.map((fee) => ({
      fee_id: fee.fee_id,
      name: fee.name,
      fee_type: fee.fee_type,
      value: fee.value,
      amountCents: isBillingLevel
        ? fee.computed_amount_cents
        : Math.round(fee.computed_amount_cents * ratio),
    }));

    const totalFeesCents = feeLineItems.reduce((sum, item) => sum + item.amountCents, 0);

    return {
      netAmountCents: grossAmountCents - totalFeesCents,
      totalFeesCents,
      feeLineItems,
    };
  }
  ```
- **MIRROR**: rounding convention from `apps/web/src/services/billing.ts:359-365` (proportional `Math.round`)
- **GOTCHA**: When `grossAmountCents === baseAmountCents` (billing-level call), use the original `computed_amount_cents` values unmodified — do not re-round them, to avoid off-by-one-cent drift vs. the Phase 3 snapshot. The `isBillingLevel` branch exists specifically for this.
- **GOTCHA**: Guard `baseAmountCents === 0` to avoid `NaN` from division — falls back to `ratio = 0`, producing 0 fees (correct: a zero-base professional split has nothing to take a percentage of).
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/components/billing/professional-net-amount.tsx`

- **ACTION**: CREATE shared presentational component
- **IMPLEMENT**:
  ```tsx
  "use client";

  import {
    type AppliedBillingFee,
    computeNetAmountCents,
    formatCurrency,
  } from "@/lib/billing/calculations";
  import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@ventre/ui/accordion";
  import { Badge } from "@ventre/ui/badge";

  type ProfessionalNetAmountProps = {
    professionalId: string;
    professionalName?: string;
    grossAmountCents: number;
    appliedFees: AppliedBillingFee[];
    interactive?: boolean;
  };

  export function ProfessionalNetAmount({
    professionalId,
    professionalName,
    grossAmountCents,
    appliedFees,
    interactive = true,
  }: ProfessionalNetAmountProps) {
    const { netAmountCents, totalFeesCents, feeLineItems } = computeNetAmountCents(
      grossAmountCents,
      appliedFees,
      professionalId,
    );

    const label = professionalName ?? "Valor líquido";

    if (feeLineItems.length === 0) {
      return (
        <div className="flex justify-between text-muted-foreground text-xs">
          <span>{label}</span>
          <span>{formatCurrency(grossAmountCents)}</span>
        </div>
      );
    }

    const summary = (
      <div className="flex w-full items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="font-normal">
            −{formatCurrency(totalFeesCents)}
          </Badge>
          <span className="font-medium">{formatCurrency(netAmountCents)}</span>
        </span>
      </div>
    );

    if (!interactive) {
      return <div className="py-0.5">{summary}</div>;
    }

    return (
      <Accordion type="single" collapsible>
        <AccordionItem value={professionalId} className="border-none">
          <AccordionTrigger className="py-0.5 hover:no-underline [&>svg]:size-3.5">
            {summary}
          </AccordionTrigger>
          <AccordionContent className="pb-1">
            <div className="space-y-1 pl-2">
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Valor bruto</span>
                <span>{formatCurrency(grossAmountCents)}</span>
              </div>
              {feeLineItems.map((fee) => (
                <div key={fee.fee_id} className="flex justify-between text-muted-foreground text-xs">
                  <span>
                    {fee.name} ({fee.fee_type === "fixed" ? formatCurrency(fee.value) : `${fee.value}%`})
                  </span>
                  <span>−{formatCurrency(fee.amountCents)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1 font-medium text-xs">
                <span>Valor líquido</span>
                <span>{formatCurrency(netAmountCents)}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/billing-fee-card.tsx` for the fixed-vs-percentage value formatting convention (`formatCurrency(value)` for fixed, `${value}%` for percentage)
- **IMPORTS**: `@ventre/ui/accordion`, `@ventre/ui/badge` — confirm these export paths match `packages/ui` package.json exports map (same pattern as existing `@ventre/ui/card`, `@ventre/ui/badge` imports in `billing-card.tsx`/`status-badge.tsx`)
- **GOTCHA**: `interactive={false}` MUST be used everywhere this component is rendered inside a `next/link` (`billing-card.tsx`, `installment-card.tsx`) — a Radix `AccordionTrigger` renders a `<button>`, and nesting `<button>` inside `<a>` is invalid HTML that breaks DOM structure and causes hydration mismatches. Only `installment-list.tsx` (no enclosing `<Link>`) may use the default `interactive={true}`.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/lib/billing/dashboard.ts`

- **ACTION**: ADD `applied_billing_fees` to `FlatInstallment` type and `flattenInstallments` output
- **IMPLEMENT**:
  ```typescript
  import type { Json } from "@ventre/supabase/types"; // add to existing import line if not present

  export type FlatInstallment = Tables<"installments"> & {
    description: string;
    patient_name: string;
    patient_id: string;
    billing_installment_count: number;
    applied_billing_fees: Json;
  };
  ```
  And in `flattenInstallments` (existing function, lines 41-51), add `applied_billing_fees: billing.applied_billing_fees,` to the spread object.
- **MIRROR**: existing denormalization pattern in the same function (`patient_name: billing.patient.name`, etc.)
- **GOTCHA**: `BillingWithInstallments` (the `billings` param type) already includes `applied_billing_fees: Json` since it extends `Tables<"billings">` — no upstream type change needed, just read it.
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/components/billing/billing-card.tsx`

- **ACTION**: REPLACE the gross breakdown block (lines 51-62) with `ProfessionalNetAmount`; ADD optional `professionalId` prop for solo-professional summary
- **IMPLEMENT**:
  ```tsx
  import { ProfessionalNetAmount } from "./professional-net-amount";
  import type { AppliedBillingFee } from "@/lib/billing/calculations";

  // function signature:
  export function BillingCard({
    billing,
    professionals,
    professionalId,
  }: {
    billing: Billing;
    professionals?: Record<string, string>;
    professionalId?: string;
  }) {
    const appliedFees = (billing.applied_billing_fees as unknown as AppliedBillingFee[]) ?? [];
    // ... existing paidCount/progressPercent logic unchanged ...
  ```
  Replace lines 51-62:
  ```tsx
  {professionals && billing.splitted_billing && (
    <div className="mt-2 space-y-0.5 border-t pt-2">
      {Object.entries(billing.splitted_billing as Record<string, number>).map(([profId, amount]) => (
        <ProfessionalNetAmount
          key={profId}
          professionalId={profId}
          professionalName={professionals[profId] ?? profId}
          grossAmountCents={amount}
          appliedFees={appliedFees}
          interactive={false}
        />
      ))}
    </div>
  )}
  {!professionals && professionalId && billing.splitted_billing && (
    <div className="mt-2 border-t pt-2">
      <ProfessionalNetAmount
        professionalId={professionalId}
        grossAmountCents={(billing.splitted_billing as Record<string, number>)[professionalId] ?? 0}
        appliedFees={appliedFees}
        interactive={false}
      />
    </div>
  )}
  ```
- **MIRROR**: existing conditional-rendering gate pattern (`{professionals && billing.splitted_billing && (...)}`)
- **GOTCHA**: `interactive={false}` is mandatory here — this entire card is wrapped in `<Link href={...}>` (line 28)
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/components/billing/installment-card.tsx`

- **ACTION**: Make headline amount net (when `professionalId` set), replace gross breakdown block with `ProfessionalNetAmount`
- **IMPLEMENT**:
  ```tsx
  import { computeNetAmountCents, formatCurrency, type AppliedBillingFee } from "@/lib/billing/calculations";
  import { ProfessionalNetAmount } from "./professional-net-amount";

  type Installment = Tables<"installments"> & {
    description: string;
    patient_name: string;
    patient_id: string;
    applied_billing_fees: Json; // matches FlatInstallment from Task 3
  };

  // inside component:
  const appliedFees = (installment.applied_billing_fees as unknown as AppliedBillingFee[]) ?? [];
  const splitted = installment.splitted_installment as Record<string, number> | null | undefined;
  const grossDisplayAmount =
    professionalId && splitted?.[professionalId] != null ? splitted[professionalId] : installment.amount;
  const { netAmountCents, totalFeesCents } = professionalId
    ? computeNetAmountCents(grossDisplayAmount, appliedFees, professionalId)
    : { netAmountCents: grossDisplayAmount, totalFeesCents: 0 };
  ```
  Headline block (replace line 50):
  ```tsx
  <span className="font-semibold text-lg">{formatCurrency(netAmountCents)}</span>
  {totalFeesCents > 0 && (
    <span className="ml-2 whitespace-nowrap text-muted-foreground text-xs">
      (−{formatCurrency(totalFeesCents)} taxas)
    </span>
  )}
  ```
  Breakdown block (replace lines 64-75):
  ```tsx
  {professionals && installment.splitted_installment && (
    <div className="mt-2 space-y-0.5 border-t pt-2">
      {Object.entries(installment.splitted_installment as Record<string, number>).map(([profId, amount]) => (
        <ProfessionalNetAmount
          key={profId}
          professionalId={profId}
          professionalName={professionals[profId] ?? profId}
          grossAmountCents={amount}
          appliedFees={appliedFees}
          interactive={false}
        />
      ))}
    </div>
  )}
  ```
- **MIRROR**: existing `displayAmount` derivation logic (lines 28-32) — extend it, don't replace the fallback-to-`installment.amount` behavior for the staff multi-professional view
- **GOTCHA**: When `professionalId` is NOT set (staff viewing the aggregate card, no single professional context), keep the headline as the full gross `installment.amount` — fees are per-professional, so there's no single "net" figure for a multi-professional installment's headline. Only show net at the headline level when viewing through one professional's lens.
- **GOTCHA**: `interactive={false}` mandatory — wrapped in `<Link>` (line 34)
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/components/billing/installment-list.tsx`

- **ACTION**: ADD `appliedBillingFees` prop; REPLACE gross breakdown block (lines 139-153) with interactive `ProfessionalNetAmount`
- **IMPLEMENT**:
  ```tsx
  import { type AppliedBillingFee } from "@/lib/billing/calculations";
  import { ProfessionalNetAmount } from "./professional-net-amount";

  type InstallmentListProps = {
    billingId: string;
    installments: Installment[];
    onRecordPayment: (installment: Installment) => void;
    onUpdate: () => void;
    professionals?: Record<string, string>;
    appliedBillingFees?: AppliedBillingFee[];
  };

  export function InstallmentList({
    billingId,
    installments,
    onRecordPayment,
    onUpdate,
    professionals,
    appliedBillingFees = [],
  }: InstallmentListProps) {
  ```
  Replace lines 139-153:
  ```tsx
  {professionals && installment.splitted_installment && (
    <div className="space-y-0.5 border-t pt-2">
      {Object.entries(installment.splitted_installment as Record<string, number>).map(([profId, amount]) => (
        <ProfessionalNetAmount
          key={profId}
          professionalId={profId}
          professionalName={professionals[profId] ?? profId}
          grossAmountCents={amount}
          appliedFees={appliedBillingFees}
        />
      ))}
    </div>
  )}
  ```
- **MIRROR**: same conditional gate as before; `interactive` left at its default `true` since this component is not inside a `<Link>`
- **GOTCHA**: this component receives ONE shared `appliedBillingFees` array for the whole billing (not per-installment) — that's correct, since Phase 3 stores the snapshot at the billing level; `computeNetAmountCents` pro-rates per-call using each installment's own `grossAmountCents`
- **VALIDATE**: `pnpm check-types`

### Task 7: UPDATE caller pages

- **ACTION**: Wire the new props from the two page-level callers
- **IMPLEMENT** in `apps/web/app/(dashboard)/patients/[id]/billing/[billingId]/page.tsx`:
  ```tsx
  <InstallmentList
    billingId={billingId}
    installments={billing.installments}
    onRecordPayment={handleRecordPayment}
    onUpdate={() => fetchBilling({ billingId })}
    professionals={professionalsMap}
    appliedBillingFees={billing.applied_billing_fees as unknown as AppliedBillingFee[]}
  />
  ```
  (add `import type { AppliedBillingFee } from "@/lib/billing/calculations";`)

  **IMPLEMENT** in `apps/web/app/(dashboard)/patients/[id]/billing/page.tsx`:
  ```tsx
  const { isStaff, user } = useAuth();
  // ...
  <BillingCard
    key={billing.id}
    billing={billing}
    professionals={professionalsMap}
    professionalId={!isStaff ? user?.id : undefined}
  />
  ```
- **MIRROR**: existing `professionalId={user?.id as string}` wiring pattern in `apps/web/src/screens/billing-dashboard-screen.tsx`
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/components/billing apps/web/src/lib/billing/calculations.ts apps/web/app/\(dashboard\)/patients`

---

## Testing Strategy

### Unit Tests to Write

No test scaffold currently exists for `calculations.ts` or billing components (confirmed: zero `.test.ts(x)` files matching `billing|installment` in the repo). Given the codebase has no established test runner convention for this area, this phase does not introduce a new test framework. If the user wants coverage, `computeNetAmountCents` is the one pure, side-effect-free function worth unit testing first (deterministic input/output, no mocking needed) — flag this as a follow-up rather than blocking the phase.

### Edge Cases Checklist (manual verification, since no test harness exists)

- [ ] Professional with zero active fees at billing time → net equals gross, no badge/accordion shown (falls into `feeLineItems.length === 0` branch)
- [ ] Professional with one fixed fee — verify `−R$X` matches `fee.value` exactly at billing level
- [ ] Professional with one percentage fee — verify computed amount matches `Math.round(base * value/100)`, clamped to base
- [ ] Professional with multiple fees (fixed + percentage stacked) — verify each line item sums correctly to `totalFeesCents`
- [ ] Installment-level proration — for a 3-parcela billing, sum of the 3 installments' `totalFeesCents` should be close to (may be off by 1-2 cents from, due to independent rounding per installment) the billing-level total; this is an accepted approximation since Phase 3 did not store per-installment fee snapshots
- [ ] `base_amount_cents === 0` (degenerate split) — must not throw/NaN
- [ ] Solo professional viewing patient billing tab (`BillingCard` with `professionalId`, no `professionals` map) — summary line renders
- [ ] Staff viewing multi-professional installment in `InstallmentCard` (no `professionalId`) — headline stays gross total, no false "net" implied for a value that mixes multiple professionals' fees

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, no type errors

### Level 2: LINT

```bash
npx biome lint --write --unsafe apps/web/src/components/billing apps/web/src/lib/billing/calculations.ts
```

**EXPECT**: Exit 0, no warnings (class-sorting auto-fixed if any)

### Level 3: MANUAL_VALIDATION (no automated UI test harness in this repo)

1. As a manager, create a billing fee (e.g. 10% "Taxa de gateway") in `/settings/billing-deductions` (Phase 2 — already built).
2. Create a new billing for a patient with that fee active, single installment.
3. As the professional who owns that billing, open the professional dashboard (`billing-dashboard-screen.tsx`) — confirm the `InstallmentCard` headline shows the net amount with a "(−R$X taxas)" suffix.
4. As a manager/staff, open the same patient's billing detail page — confirm `InstallmentList` shows the collapsed summary (net + badge) and expands on click/tap to show the itemized bruto/taxa/líquido breakdown.
5. As the same manager, open the patient billing list tab (`/patients/[id]/billing`) — confirm `BillingCard` shows the per-professional net breakdown (no expand, just the summary line, since it's inside a `<Link>`).
6. Test on a real mobile device or device emulator with touch (not just mouse) — confirm the Accordion in `InstallmentList` opens on tap.
7. Create a second billing with no active fees — confirm all surfaces fall back to plain gross display (no badge, no accordion) with zero visual regression vs. current behavior.
8. Create a parceled billing (3 installments) with an active fee — confirm each installment in `InstallmentList` shows a sensible (not wildly incorrect) net amount, and that `BillingCard`'s billing-level summary still reflects the full snapshot total.

---

## Acceptance Criteria

- [ ] `computeNetAmountCents` added to `calculations.ts`, pure, no side effects, handles zero-fee and zero-base-amount cases without throwing
- [ ] `ProfessionalNetAmount` component created and used in all 3 display surfaces, with `interactive={false}` everywhere it's nested inside a `next/link`
- [ ] `InstallmentCard` headline shows net amount (not gross) whenever `professionalId` is provided
- [ ] `BillingCard` shows a net-amount summary even for solo professionals (previously showed nothing)
- [ ] `InstallmentList` breakdown is expandable (Accordion) and itemizes each applied fee
- [ ] No regression: billings/installments with zero active fees render identically to current behavior (gross-only)
- [ ] `pnpm check-types` passes
- [ ] Biome lint passes with no new warnings

---

## Completion Checklist

- [ ] All 7 tasks completed in order
- [ ] Each task's `pnpm check-types` validated immediately after
- [ ] Level 1: Static analysis passes
- [ ] Level 2: Lint passes
- [ ] Level 3: Manual validation steps walked through in a running dev server, including a real touch device/emulator for the Accordion
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Nesting Radix `AccordionTrigger` (`<button>`) inside `next/link` (`<a>`) in card components | M (easy to copy-paste the wrong mode) | M — invalid HTML, hydration mismatch warnings, broken click targets | Enforced via explicit `interactive={false}` at both `BillingCard`/`InstallmentCard` call sites (Tasks 4-5); only `InstallmentList` (no enclosing Link) uses the default interactive mode |
| Per-installment fee proration drifting a few cents from the billing-level total across many installments | M | L — cosmetic only, no money actually moves (fees aren't re-charged) since Phase 3 already finalized the real snapshot | Documented as an accepted approximation in Testing Strategy; if exact reconciliation is ever required, it would need a Phase 3 schema change (out of scope here) |
| `applied_billing_fees` cast (`as unknown as AppliedBillingFee[]`) silently breaking if the snapshot shape ever changes | L | M — TypeScript won't catch a JSON shape drift | Same risk already exists in Phase 3's `services/billing.ts:344` cast; not introduced by this phase, just propagated. No new mitigation needed beyond what Phase 3 already accepted |
| Forgetting to update one of the 3 duplicated breakdown blocks, leaving an inconsistent gross-only surface | L | M — partial rollout, confusing for users | Task list explicitly enumerates all 3 components; manual validation step 7 covers cross-surface consistency |

---

## Notes

- This phase deliberately does not touch `services/billing.ts` or `calculations.ts`'s existing fee-computation functions (`applyBillingFeesToSplit`) — Phase 3 owns that logic and it's already correct/complete.
- The choice of Accordion over Tooltip/Popover for the itemized breakdown was validated via external research (Radix docs + community-documented touch-device limitations + WCAG guidance on essential content) — Tooltip would silently fail to open on real mobile hardware despite working in desktop emulation, which is exactly the audience (professionals checking earnings on their phone) most likely to need this feature.
- `dashboard-metrics.tsx` aggregate tiles are intentionally left gross; revisiting them for net totals is a reasonable future iteration but isn't required by this phase's success signal.
