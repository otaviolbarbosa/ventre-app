# Implementation Report

**Plan**: `.claude/PRPs/plans/fix-home-cache-and-duplicate-fetches.plan.md`
**Branch**: `dev`
**Date**: 2026-07-25
**Status**: COMPLETE

---

## Summary

Fixed the broken `unstable_cache` memoization in `getCachedHomeData`, made the "Novo Agendamento" patient list fetch lazy (only on first modal open), and added missing cache-tag invalidation to `finishPatientCareAction` so the home screen no longer serves stale data after ending a pregnancy's care.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                        |
| ---------- | --------- | ------ | ----------------------------------------------------------------- |
| Complexity | LOW       | LOW    | Matched — 3 small, well-scoped file edits mirroring existing patterns |
| Confidence | High      | High   | Root cause and patterns were correctly identified; no pivots needed |

No deviations from the plan.

---

## Tasks Completed

| # | Task | File | Status |
| - | ---- | ---- | ------ |
| 1 | Memoize `unstable_cache` per userId in `getCachedHomeData` | `apps/web/src/services/home.ts` | ✅ |
| 2 | Make `fetchAllPatients()` lazy, triggered on first "Novo Agendamento" modal open | `apps/web/src/screens/home-screen.tsx` | ✅ |
| 3 | Add `revalidateTag` calls to `finishPatientCareAction` | `apps/web/src/actions/finish-patient-care-action.ts` | ✅ |

---

## Validation Results

| Check       | Result | Details                                  |
| ----------- | ------ | ----------------------------------------- |
| Type check  | ✅     | `pnpm check-types` — all packages pass    |
| Lint        | ✅     | `biome lint --write --unsafe` — no issues |
| Unit tests  | ⏭️     | No test suite exists for these files      |
| Build       | ⏭️     | Not run (not requested; type-check covers correctness) |
| Manual/UI   | ⏭️     | Not run in this session (no browser access requested) |

---

## Files Changed

| File | Action | Summary |
| ---- | ------ | ------- |
| `apps/web/src/services/home.ts` | UPDATE | Added `userHomeDataCacheFns` Map + `getOrCreateHomeDataCacheFn`, mirroring `home-patients-cache.ts` |
| `apps/web/src/screens/home-screen.tsx` | UPDATE | Removed `fetchAllPatients()` from mount effect; added guarded effect keyed on `showNewAppointment` |
| `apps/web/src/actions/finish-patient-care-action.ts` | UPDATE | Added `revalidateTag` import + calls for `home-patients-{userId}`, `home-data-{userId}`, `enterprise-patients-{enterpriseId}` |

---

## Deviations from Plan

None.

---

## Issues Encountered

None.

---

## Tests Written

None — no automated test suite exists for these files (confirmed per plan's Testing Strategy). Validation relied on `pnpm check-types` and `biome lint`.

---

## Next Steps

- [ ] Manual validation in browser (DevTools Network) per plan's Level 2 steps, if desired before merge
- [ ] Create PR: `gh pr create` (if applicable)
- [ ] Merge when approved
