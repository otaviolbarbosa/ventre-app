# Implementation Report

**Plan**: `.claude/PRPs/plans/patient-contract-signature-phase-5-patient-home.plan.md`
**Branch**: `feature/patient-contract-signature`
**Date**: 2026-08-15
**Status**: COMPLETE

---

## Summary

Added a "Contratos" section to the gestante home screen (pending vs signed, mirror of the
existing appointment/billing list pattern) and a new `/contrato/[id]` route where the gestante
can read the contract, sign it, or request a change — wiring up the previously-orphaned
`signContractAsPatientAction`, `createContractChangeRequestAction`, and
`RequestContractChangeDialog`.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | MEDIUM    | MEDIUM | Matched — pure UI wiring over existing services/actions, no new migrations |
| Confidence | High (implied by fully-worked code samples) | High, with one real bug found | Plan's code samples were accurate except one import path that broke the client bundle |

**Deviations from plan:**

- `sanitizeClausesHtml` was imported by the plan's `contract-detail.tsx` sample from
  `@/lib/contract-pdf`. That module is explicitly commented "Server-only module: imports
  @react-pdf/renderer. Never import from client components" — importing it into the `"use
  client"` `contract-detail.tsx` broke the production build (`UnhandledSchemeError: node:path`).
  Fixed by extracting `sanitizeClausesHtml` into a new client-safe module
  `apps/web/src/lib/contract-html.ts`, with `contract-pdf.ts` now re-exporting it for existing
  server-side callers (`sign-patient-contract-action.ts`, the contract PDF API route).
- `signContractAsPatientSchema` requires `consent: z.literal(true)` in addition to `patientId` —
  the plan's `execute({ patientId })` call for the "Assinar contrato" button would have failed
  validation. Added `consent: true` to the call, since the button click itself is the explicit
  consent action (MVP scope, no separate checkbox per plan's scope limits).

---

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Add `getMyContracts`/`getMyContractById` | `apps/web/src/services/patient-self.ts` | ✅ |
| 2 | Create contract list component | `apps/web/src/components/patient-area/contract-list.tsx` | ✅ |
| 3 | Add contracts section to home screen | `apps/web/src/screens/patient-home-screen.tsx` | ✅ |
| 4 | Fetch contracts in home page | `apps/web/app/(dashboard)/home/page.tsx` | ✅ |
| 5 | Create `/contrato/[id]` route + detail component | `apps/web/app/(patient)/contrato/[id]/page.tsx`, `apps/web/src/components/patient-area/contract-detail.tsx` | ✅ |
| 6 | Revalidate `/home` + `/contrato/[id]` | `apps/web/src/actions/sign-contract-as-patient-action.ts` | ✅ |
| 7 | Revalidate `/home` + `/contrato/[id]` | `apps/web/src/actions/create-contract-change-request-action.ts` | ✅ |
| 8 | Full static validation + build | — | ✅ |

---

## Validation Results

| Check       | Result | Details               |
| ----------- | ------ | ---------------------- |
| Type check  | ✅     | `pnpm check-types` — 0 errors, all 7 packages |
| Lint        | ✅     | `biome lint` — no issues on changed files |
| Build       | ✅     | `pnpm --filter web build` — compiles, `/contrato/[id]` registered as dynamic route |
| Manual/browser | ⏭️ | Not run in this session — no test gestante session available; recommend before merge |

---

## Files Changed

| File | Action |
| ---- | ------ |
| `apps/web/src/services/patient-self.ts` | UPDATE — `getMyContracts`, `getMyContractById` |
| `apps/web/src/components/patient-area/contract-list.tsx` | CREATE |
| `apps/web/src/components/patient-area/contract-detail.tsx` | CREATE |
| `apps/web/src/screens/patient-home-screen.tsx` | UPDATE |
| `apps/web/app/(dashboard)/home/page.tsx` | UPDATE |
| `apps/web/app/(patient)/contrato/[id]/page.tsx` | CREATE |
| `apps/web/src/lib/contract-html.ts` | CREATE — extracted client-safe `sanitizeClausesHtml` |
| `apps/web/src/lib/contract-pdf.ts` | UPDATE — re-exports `sanitizeClausesHtml` from new module |
| `apps/web/src/actions/sign-contract-as-patient-action.ts` | UPDATE — extra `revalidatePath` calls |
| `apps/web/src/actions/create-contract-change-request-action.ts` | UPDATE — extra `revalidatePath` calls |

---

## Issues Encountered

- Build failure from the client/server module boundary bug described above — resolved by
  extracting the sanitize function (see Deviations).

---

## Next Steps

- [ ] Manual browser validation with a test gestante account (Level 5/6 in the plan) — sign a
      contract end-to-end and confirm home + `/contrato/[id]` reflect state after
      `router.refresh()`
- [ ] Create PR
