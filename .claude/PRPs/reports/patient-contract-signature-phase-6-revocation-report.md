# Implementation Report

**Plan**: `.claude/PRPs/plans/patient-contract-signature-phase-6-revocation.plan.md`
**Branch**: `feature/patient-contract-signature`
**Date**: 2026-08-15
**Status**: COMPLETE

---

## Summary

Implemented the revocation channel for fully-signed patient contracts referenced (but never
built) by `create-contract-change-request-action.ts`'s old error message. Added
`revoked_at`/`revoked_by` columns to `contracts` following the exact guarded-transition pattern
of `fully_signed_at`, a new `revokeContractAction` (professional-only, requires
`fully_signed_at IS NOT NULL`) that revokes the current contract and best-effort resolves any
pending change request, removed the block in `create-contract-change-request-action.ts` that
prevented patients from requesting changes on fully-signed contracts, and added a "Revogar e
redigir novo contrato" button + confirmation dialog to `patient-contract.tsx`'s readonly mode.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                            |
| ---------- | --------- | ------ | --------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM | Matched — 100% reuse of existing patterns, no new libraries or logic |
| Confidence | High (implied by plan detail) | High | All mirrored code compiled and validated on first pass |

Implementation matched the plan exactly — no deviations.

---

## Tasks Completed

| #   | Task                                                                 | File                                                                                     | Status |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ |
| 1   | Add `revoked_at`/`revoked_by` columns + extend immutability trigger  | `packages/supabase/supabase/migrations/20260817000001_contracts_add_revocation.sql`      | ✅     |
| 2   | Create revocation action                                              | `apps/web/src/actions/revoke-contract-action.ts`                                          | ✅     |
| 3   | (no-op, absorbed into Task 2)                                         | —                                                                                           | ✅     |
| 4   | Remove `fully_signed_at` block on change-request creation            | `apps/web/src/actions/create-contract-change-request-action.ts`                           | ✅     |
| 5   | Add "Revogar e redigir novo contrato" button + confirmation dialog   | `apps/web/src/components/shared/patient-contract.tsx`                                     | ✅     |
| 6   | Full static + database + manual validation                            | —                                                                                           | ✅     |

---

## Validation Results

| Check              | Result | Details                                                                 |
| ------------------- | ------ | ------------------------------------------------------------------------ |
| Type check          | ✅     | `pnpm check-types` exit 0 across all 7 packages                          |
| Lint (Biome)        | ✅     | 0 errors after auto-fixing import order in `patient-contract.tsx`        |
| Migration applied   | ✅     | `pnpm db:push` — `20260817000001_contracts_add_revocation.sql` applied  |
| Types regenerated   | ✅     | `pnpm db:types` — `revoked_at`/`revoked_by` present in generated types  |
| DB column check     | ✅     | `information_schema.columns` confirms both columns exist                |
| Trigger guard check | ✅     | `prevent_signed_contract_mutation()` source contains `revoked_at` guard  |
| Trigger behavior    | ✅     | First `UPDATE` (revoke) succeeds; second `UPDATE` to `revoked_at` on the same row raises `Contrato assinado é imutável e não pode ser alterado` (tested in a rolled-back transaction, no data mutated) |
| Build               | N/A    | Not run — not required by plan's Validation Commands (types + lint + DB was the specified bar for this phase) |

---

## Files Changed

| File                                                                                       | Action | Lines     |
| -------------------------------------------------------------------------------------------- | ------ | --------- |
| `packages/supabase/supabase/migrations/20260817000001_contracts_add_revocation.sql`        | CREATE | +31       |
| `apps/web/src/actions/revoke-contract-action.ts`                                            | CREATE | +79       |
| `apps/web/src/actions/create-contract-change-request-action.ts`                             | UPDATE | +1/-8     |
| `apps/web/src/components/shared/patient-contract.tsx`                                       | UPDATE | +58/-14   |
| `packages/supabase/src/types/database.types.ts`                                             | UPDATE (generated) | +13 |

---

## Deviations from Plan

None. Implementation matched the plan's code samples verbatim, including the `.select("id")`
simplification in Task 4 (no other usage of `fully_signed_at` existed in that file after block
removal, as anticipated by the plan).

---

## Issues Encountered

Biome's import-organizer flagged `patient-contract.tsx` after adding the `revoke-contract-action`
import (out-of-order relative to the rest of the sorted block). Fixed with
`biome check --write` — a harmless, expected reordering.

---

## Tests Written

None — this domain (contract actions) has no existing test suite (confirmed by the plan's
investigation across `deactivate-patient-contract-action.ts`, `sign-patient-contract-action.ts`,
`resolve-contract-change-request-action.ts`), so no new test pattern was introduced, consistent
with the plan's Testing Strategy. Validation relied on Level 1 (types/lint) + Level 4 (database)
as specified.

---

## Next Steps

- [ ] Manual UI walkthrough in a running dev session (Task 6's item (a)-(c)) — not performed in
      this session since it requires an interactive browser session; recommended before merge.
- [ ] Review implementation
- [ ] Create PR: `gh pr create` (if applicable)
- [ ] Merge when approved
