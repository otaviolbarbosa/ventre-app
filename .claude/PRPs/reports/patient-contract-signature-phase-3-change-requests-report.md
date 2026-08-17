# Implementation Report

**Plan**: `.claude/PRPs/plans/patient-contract-signature-phase-3-change-requests.plan.md`
**Source Issue**: N/A (PRD-driven: `.claude/PRPs/prds/patient-contract-signature.prd.md`, Phase 3)
**Branch**: `feature/patient-contract-signature-phase-1` (continued — already carried Phases 1-2)
**Date**: 2026-08-15
**Status**: COMPLETE

---

## Summary

Implemented the `contract_change_requests` data model, RLS policies, and two server actions
(`createContractChangeRequestAction`, `resolveContractChangeRequestAction`) that let a gestante
request a change to her pending contract via rich text, and let the responsible professional
resolve that request. Added a reusable `RequestContractChangeDialog` component (not yet mounted
to a route — Phase 5 owns that) and wired a "Solicitações de alteração" list with a resolve
action into `patient-contract.tsx`'s readonly view.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | MEDIUM    | MEDIUM | Matched — nearly every piece mirrored an existing precedent (contract_signatures table shape, patient_invite_links service-role UPDATE, sign-contract-as-patient-action.ts action structure) |
| Confidence | 8/10      | 8/10   | Matched — the one flagged unknown (DOMPurify dependency) needed a deviation, documented below, but didn't change scope or approach |

**If implementation deviated from the plan, explain why:**

- The plan tentatively named `dompurify` (browser-only) as the sanitization library, with a
  known caveat to confirm whether it or an isomorphic equivalent was needed. During
  implementation it became clear `patient-contract.tsx` is a `"use client"` component that Next.js
  still server-renders for the initial HTML, and plain `dompurify`'s CJS build returns
  `isSupported = false` with no `.sanitize()` method when `window` is undefined (Node/SSR) — this
  would have crashed the server render. Switched to `isomorphic-dompurify` (wraps `dompurify` +
  `jsdom` for the Node path) instead, added as the single dependency in `apps/web/package.json`.
  No `@types/dompurify` needed — both packages ship their own types.

---

## Tasks Completed

| #   | Task                                                                 | File                                                                       | Status |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------ |
| 1   | CREATE migration: `contract_change_requests` table + RLS + index    | `packages/supabase/supabase/migrations/20260815000001_create_contract_change_requests_table.sql` | ✅     |
| 2   | RUN `pnpm db:types`                                                  | `packages/supabase/src/types/database.types.ts` (generated)                | ✅     |
| 3   | CREATE Zod schemas                                                   | `apps/web/src/lib/validations/contract-change-request.ts`                  | ✅     |
| 4   | CREATE patient-side create action                                    | `apps/web/src/actions/create-contract-change-request-action.ts`            | ✅     |
| 5   | CREATE professional-side resolve action                              | `apps/web/src/actions/resolve-contract-change-request-action.ts`           | ✅     |
| 6   | CREATE request dialog component                                      | `apps/web/src/components/shared/request-contract-change-dialog.tsx`        | ✅     |
| 7   | UPDATE `get-patient-contract-action.ts` to include change requests   | `apps/web/src/actions/get-patient-contract-action.ts`                      | ✅     |
| 8   | UPDATE `patient-contract.tsx` — resolve UI + sanitized rendering     | `apps/web/src/components/shared/patient-contract.tsx`                      | ✅     |

---

## Validation Results

| Check       | Result | Details                                                                 |
| ----------- | ------ | ------------------------------------------------------------------------ |
| Type check  | ✅     | `pnpm check-types` — 5/5 packages pass, zero errors                     |
| Lint        | ✅     | `biome lint --write --unsafe` on all changed files — no issues found    |
| Unit tests  | ⏭️     | N/A — no test harness exists in this repo (confirmed during planning)   |
| Build       | ✅     | `pnpm --filter web build` — compiled successfully, all 63 routes built  |
| Database    | ✅     | Migration applied via `pnpm db:push`; RLS policies and partial unique index verified directly against the live schema (see below) |
| Advisors    | ✅     | `mcp__supabase__get_advisors(security)` — zero findings referencing `contract_change_requests` |

**RLS policies verified via `pg_policies` against the live database:**
- `Insert own contract change request` (INSERT, `public`) — `with_check: requested_by = auth.uid()`
- `Update contract change requests` (UPDATE, `service_role`) — `using: true`, `with_check: true`
- `View contract change requests` (SELECT, `public`) — `is_team_member(patient_id) OR is_enterprise_patient(patient_id) OR patients.user_id = auth.uid()`

**Indexes verified:**
- `idx_contract_change_requests_contract_id` (btree, `contract_id`)
- `one_pending_change_request_per_contract` (unique, `contract_id` WHERE `status = 'pending'`)

---

## Files Changed

| File                                                                              | Action | Lines     |
| ------------------------------------------------------------------------------------ | ------ | --------- |
| `packages/supabase/supabase/migrations/20260815000001_create_contract_change_requests_table.sql` | CREATE | +50       |
| `packages/supabase/src/types/database.types.ts`                                  | UPDATE (generated) | +65 |
| `apps/web/src/lib/validations/contract-change-request.ts`                        | CREATE | +18       |
| `apps/web/src/actions/create-contract-change-request-action.ts`                  | CREATE | +59       |
| `apps/web/src/actions/resolve-contract-change-request-action.ts`                 | CREATE | +57       |
| `apps/web/src/components/shared/request-contract-change-dialog.tsx`              | CREATE | +75       |
| `apps/web/src/actions/get-patient-contract-action.ts`                            | UPDATE | +18       |
| `apps/web/src/components/shared/patient-contract.tsx`                            | UPDATE | +67       |
| `apps/web/package.json`                                                          | UPDATE | +1 (`isomorphic-dompurify`) |
| `pnpm-lock.yaml`                                                                  | UPDATE (generated) | +329     |

---

## Deviations from Plan

- Swapped `dompurify` for `isomorphic-dompurify` (see Assessment vs Reality above) — same
  sanitization guarantee, avoids an SSR crash in the `"use client"` component that still renders
  server-side on first load. No `@types/dompurify` added, since neither package needs it.
- `RequestContractChangeDialog`'s `trigger` prop was simplified from an arbitrary `ReactNode` to a
  `triggerLabel: string` default-rendered as a `Button` — the original plan's sketch wrapped an
  arbitrary trigger node in a `<div onClick>`, which is both an accessibility anti-pattern (a
  non-interactive element as a click target) and unnecessary, since the codebase's `Button`
  component has no `asChild`/`Slot` support to compose a custom trigger element safely. This
  keeps the component simpler without losing functionality Phase 5 will need.

---

## Issues Encountered

None beyond the DOMPurify SSR issue documented above, resolved before it reached a build/runtime
failure.

---

## Tests Written

None — no test harness exists in this repository (confirmed zero `*.test.ts`/`*.test.tsx` files
under `apps/web/src` during the planning phase). Consistent with how Phases 1-2 of this same PRD
shipped. Validation relied on type-check, lint, build, and direct database inspection via the
Supabase MCP (RLS policies, indexes, and security advisors all confirmed against the live schema).

---

## Next Steps

- [ ] Review implementation
- [ ] Create PR: `gh pr create` (if applicable)
- [ ] Merge when approved
- [ ] Continue with Phase 4 (Notifications) or Phase 5 (Home da gestante) — Phase 5 will mount
      `RequestContractChangeDialog` into a real patient-facing route; Phase 4 will wire
      `enqueueNotification`/`sendWhatsAppToUser` calls into both new actions
