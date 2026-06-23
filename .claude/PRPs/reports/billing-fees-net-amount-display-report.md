# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/billing-fees-net-amount-display.plan.md`
**Source PRD**: `.claude/PRPs/prds/billing-fees-taxes-discounts.prd.md` (Phase 4)
**Branch**: `feature/billing-fees-schema-foundation`
**Date**: 2026-06-22
**Status**: COMPLETE

---

## Summary

Added a pure `computeNetAmountCents` helper to `calculations.ts` and a shared `ProfessionalNetAmount` component that renders gross/fees/net for a professional, either as a static summary line (inside `next/link`-wrapped cards) or as an interactive Accordion breakdown (in `InstallmentList`, which is not link-wrapped). Wired it into `BillingCard`, `InstallmentCard`, and `InstallmentList`, including propagating `applied_billing_fees` through `flattenInstallments` and the two billing page callers.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | MEDIUM    | MEDIUM | Matched — all 7 tasks were mechanical given Phase 3's existing snapshot shape |
| Confidence | n/a       | High   | No deviations needed; existing patterns (breakdown blocks, exports map, Accordion primitive) matched plan assumptions exactly |

No deviations from the plan.

---

## Tasks Completed

| #   | Task                                                          | File                                                                                  | Status |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------ |
| 1   | Add `computeNetAmountCents` + `AppliedFeeLineItem`/`NetAmountResult` | `apps/web/src/lib/billing/calculations.ts`                                            | ✅     |
| 2   | Create `ProfessionalNetAmount` component                      | `apps/web/src/components/billing/professional-net-amount.tsx`                          | ✅     |
| 3   | Carry `applied_billing_fees` onto `FlatInstallment`            | `apps/web/src/lib/billing/dashboard.ts`                                                | ✅     |
| 4   | Replace breakdown block + add `professionalId` summary         | `apps/web/src/components/billing/billing-card.tsx`                                     | ✅     |
| 5   | Net headline + replace breakdown block                         | `apps/web/src/components/billing/installment-card.tsx`                                 | ✅     |
| 6   | Add `appliedBillingFees` prop + interactive Accordion breakdown | `apps/web/src/components/billing/installment-list.tsx`                                 | ✅     |
| 7   | Wire props from page-level callers                             | `app/(dashboard)/patients/[id]/billing/page.tsx`, `.../[billingId]/page.tsx`           | ✅     |

---

## Validation Results

| Check       | Result | Details                                                                 |
| ----------- | ------ | ------------------------------------------------------------------------ |
| Type check  | ✅     | `pnpm check-types` — 0 errors across all packages                       |
| Lint        | ✅     | `biome check --write --unsafe` on all changed files — 0 errors          |
| Unit tests  | ⏭️     | No test scaffold exists for `calculations.ts`/billing components (confirmed pre-existing, per plan's Testing Strategy) |
| Build       | ⏭️     | Not run separately — `next typegen` succeeded as part of check-types     |
| Manual UI walkthrough | ⏭️ NOT PERFORMED | No browser-automation tool was available in this session (no Chrome MCP / computer-use loaded). Static analysis and lint are clean, but the Level 3 manual validation steps (fee badge rendering, Accordion expand on tap, mobile touch test) from the plan were **not** executed. Recommend the user walk through the dev server manually before merging. |

---

## Files Changed

| File                                                                                     | Action | Notes                                                  |
| ------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------- |
| `apps/web/src/lib/billing/calculations.ts`                                                | UPDATE | +`computeNetAmountCents`, `AppliedFeeLineItem`, `NetAmountResult` |
| `apps/web/src/components/billing/professional-net-amount.tsx`                              | CREATE | New shared component                                    |
| `apps/web/src/components/billing/billing-card.tsx`                                         | UPDATE | `professionalId` prop, net breakdown via `ProfessionalNetAmount` |
| `apps/web/src/components/billing/installment-card.tsx`                                     | UPDATE | Net headline, net breakdown                              |
| `apps/web/src/components/billing/installment-list.tsx`                                     | UPDATE | `appliedBillingFees` prop, interactive Accordion          |
| `apps/web/src/lib/billing/dashboard.ts`                                                    | UPDATE | `FlatInstallment.applied_billing_fees`                    |
| `apps/web/app/(dashboard)/patients/[id]/billing/[billingId]/page.tsx`                      | UPDATE | Passes `appliedBillingFees` to `InstallmentList`           |
| `apps/web/app/(dashboard)/patients/[id]/billing/page.tsx`                                  | UPDATE | Passes `professionalId` to `BillingCard` for solo professionals |

---

## Deviations from Plan

None.

---

## Issues Encountered

- `npx biome` was intercepted by an RTK shell hook and failed with unrelated npm errors; worked around by invoking `./node_modules/.bin/biome` directly. Not a code issue, just a local tooling quirk in this environment.

---

## Tests Written

None — matches the plan's explicit scope decision (no existing test harness for this area; flagged as a follow-up, not blocking).

---

## Next Steps

- [ ] Manually walk through the Level 3 validation steps from the plan in a running browser (including mobile/touch emulation for the Accordion in `InstallmentList`)
- [ ] Create PR: `gh pr create` or `/prp-pr`
- [ ] Merge when approved

### PRD Progress

**PRD**: `.claude/PRPs/prds/billing-fees-taxes-discounts.prd.md`
**Phase Completed**: #4 - Visualização do valor líquido para o profissional

All 4 phases of the PRD are now marked complete.
