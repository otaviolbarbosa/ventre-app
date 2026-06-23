# Implementation Report

**Plan**: `.claude/PRPs/plans/billing-fees-automatic-application.plan.md`
**Branch**: `feature/billing-fees-schema-foundation`
**Date**: 2026-06-22
**Status**: COMPLETE

---

## Summary

Implemented automatic application of enterprise billing fees on `createBilling`. A new pure function `applyBillingFeesToSplit` computes a per-professional × per-active-fee snapshot (fixed or percentage, independently calculated over each professional's gross split, clamped at zero, round-half-up). A new service function `getActiveEnterpriseBillingFees` fetches only active fees via the admin client (required because RLS restricts reads to manager/secretary, but billing creation also happens for non-staff professionals). `createBilling` now calls both and persists the result into `billings.applied_billing_fees`. Gross `total_amount` / `splitted_billing` are untouched.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | MEDIUM    | MEDIUM | Matched — three small, well-scoped edits, no new files or migrations needed |
| Confidence | High (plan very prescriptive) | High | Implementation followed the plan almost verbatim |

**Deviation from plan**: The plan's insert snippet didn't account for `applied_billing_fees` typing against the generated `Json` Supabase type — `AppliedBillingFee[]` (interface) isn't structurally assignable to `Json` because interfaces lack an index signature. Added `as unknown as Json` cast on the insert call (`apps/web/src/services/billing.ts`) and imported `Json` from `@ventre/supabase/types`. This is the standard pattern in this codebase for jsonb columns with shaped TS types.

---

## Tasks Completed

| # | Task | File | Status |
| - | ---- | ---- | ------ |
| 1 | Add types + `applyBillingFeesToSplit` | `apps/web/src/lib/billing/calculations.ts` | ✅ |
| 2 | Add `getActiveEnterpriseBillingFees(supabaseAdmin, enterpriseId)` | `apps/web/src/services/enterprise-billing-fees.ts` | ✅ |
| 3 | Wire fee lookup + snapshot into `createBilling` insert | `apps/web/src/services/billing.ts` | ✅ |
| 4 | Confirm `database.types.ts` already has the column | `packages/supabase/src/types/database.types.ts` | ✅ (pre-existing diff from prior phase, no regeneration needed) |
| 5 | Manual end-to-end validation | N/A | ⏭️ Not run (no live Supabase Studio session in this conversation) — logic verified instead via standalone script covering all edge cases below |

---

## Validation Results

| Check       | Result | Details |
| ----------- | ------ | ------- |
| Type check  | ✅ | `pnpm check-types` — exit 0, all packages |
| Lint        | ✅ | `biome lint --write --unsafe` on the 3 changed files — no issues |
| Unit tests  | N/A | No test framework in this monorepo (confirmed — plan's Testing Strategy explicitly scopes this out); logic verified via ad-hoc Node script instead (see below) |
| Build       | N/A | Not run — `pnpm check-types` covers the next typegen + tsc pass used elsewhere in this repo's workflow |
| Manual edge-case verification | ✅ | Ran `applyBillingFeesToSplit` standalone against: no fees, inactive fee, fixed fee > base (clamped to base, not negative), and multi-professional + mixed fixed/percentage fees (each independently computed, not cascaded) |

---

## Files Changed

| File | Action | Lines |
| ---- | ------ | ----- |
| `apps/web/src/lib/billing/calculations.ts` | UPDATE | +41/-1 |
| `apps/web/src/services/enterprise-billing-fees.ts` | UPDATE | +17 |
| `apps/web/src/services/billing.ts` | UPDATE | +9/-1 |

---

## Deviations from Plan

- Added `as unknown as Json` cast (and `Json` import) on the `applied_billing_fees` insert field — required by TypeScript because the documented `AppliedBillingFee` interface has no index signature and isn't structurally assignable to the generated `Json` union type. Not mentioned in the plan's snippet but necessary for `pnpm check-types` to pass.

---

## Issues Encountered

- Initial `pnpm check-types` failed with a Supabase insert overload mismatch (`AppliedBillingFee[]` not assignable to `Json`). Fixed via the cast described above.

---

## Tests Written

None — no automated test framework exists in this monorepo (confirmed in plan's Testing Strategy section). Verified `applyBillingFeesToSplit` behavior manually via a standalone Node script covering: empty fee list, all-inactive fees, fixed-fee-exceeds-base clamping, and multi-professional/multi-fee-type independent (non-cascaded) calculation — all matched expected output.

---

## Next Steps

- [ ] Manual end-to-end UI validation (Task 5): create active fixed + percentage fees for a test enterprise via the Phase 2 settings UI, create a billing (single and multi-installment, multi-professional split), inspect `applied_billing_fees` on the created row via Supabase Studio/MCP.
- [ ] Review implementation
- [ ] Create PR: `gh pr create` (if applicable) — note this branch (`feature/billing-fees-schema-foundation`) also contains prior-phase uncommitted/untracked work (settings UI, CRUD actions, migration) that should be committed/reviewed together or split out before opening a PR.
