# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/uterine-activity-phase4-registration-modal.plan.md`
**Source PRD**: `.claude/PRPs/prds/uterine-activity.prd.md` (Phase 4)
**Branch**: `feat/uterine-activity`
**Date**: 2026-08-31
**Status**: COMPLETE (with a significant, user-approved deviation — see below)

---

## Summary

Implemented `AddBirthUterineActivityModal`, a standalone batch-registration modal with a live DU-notation preview, built on top of the data layer completed in Phases 1–3. During implementation, a pre-existing, repo-wide TypeScript bug surfaced (`react-hook-form`/`@hookform/resolvers` type incompatibility causing "excessively deep" instantiation errors and `tsc` crashes on every form in the app) and was fixed with explicit user approval, since it was blocking reliable type-check validation for this and every other phase.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | MEDIUM    | MEDIUM (modal itself) / HIGH (including the dependency fix) | The modal implementation matched the plan almost exactly. The unplanned dependency investigation and 8-file cleanup was substantial additional work, done with explicit user sign-off rather than silently expanding scope |
| Confidence | 8/10      | 8/10 (modal) | Modal code matches the plan 1:1. The one thing not verified in this session is live browser interaction (Level 5) — deferred, documented below, not claimed as done |

**Deviation from plan, with rationale:**

The plan called for `tsc --noEmit` validation using a memory-flag workaround (`NODE_OPTIONS="--max-old-space-size=8192"`), inherited from Phases 2–3, which had attributed `tsc` crashes to a local environment memory limit. During this phase, the user pointed out a concrete TypeScript error (`Type instantiation is excessively deep and possibly infinite`) on the **unmodified** sibling file `add-birth-contraction-modal.tsx`. Investigation (via `mcp__ide__getDiagnostics`, `git show` on prior commits, and `pnpm view` for package versions) revealed the true root cause: `react-hook-form@7.71.1` was locked in `pnpm-lock.yaml` since before Phase 3, paired with an incompatible `@hookform/resolvers@4.1.3` — RHF's 7.55+ `Resolver` type gained a third generic parameter that `@hookform/resolvers` v4's `zodResolver` doesn't correctly satisfy. This was never a memory problem; it was a genuine type error that also happened to overwhelm `tsc`'s native stack in some cases (matching the crash signatures documented in Phases 2–3's reports). It affected **every** `zodResolver`+`useForm` call in the entire `apps/web` app, not just birth-mode modals.

With explicit user approval (`AskUserQuestion`), fixed by:
1. Upgrading `@hookform/resolvers` to `^5.9.1` (matches RHF 7.x's newer `Resolver` signature).
2. Upgrading `zod` to `^3.25.0` (peer-dependency requirement of `@hookform/resolvers@5.x`, still zod 3.x — no major-version jump).
3. Removing explicit `useForm<ExplicitType>()` generics in 7 files where the underlying schema has a `.default()`-valued field, letting TypeScript infer input/output types correctly from the resolver (the officially-recommended pattern for schemas with defaults):
   - `apps/web/src/screens/onboarding-screen.tsx`
   - `apps/web/src/components/shared/finish-care-modal.tsx`
   - `apps/web/src/components/shared/patient-evolution.tsx`
   - `apps/web/src/modals/edit-patient-modal.tsx`
   - `apps/web/src/modals/edit-vaccine-record-modal.tsx`
   - `apps/web/src/modals/new-billing-modal.tsx`
   - `apps/web/src/modals/new-patient-modal.tsx`
4. Fixing 3 follow-on `number | undefined` narrowing issues in `new-billing-modal.tsx` and `new-patient-modal.tsx` that surfaced once the resolver's true (correctly-optional) input type for `installment_count` (a field with `.default(1)`) was no longer masked by the broken v4 typing — coalesced with `?? 1`, matching the schema's own default semantics.

Also reverted an earlier, incorrect hypothesis: I initially (wrongly) attributed the error to my own new `birthUterineActivitySchema`'s double `.refine()` chain and "fixed" it by collapsing to `.superRefine()`. That change is harmless and kept (slightly less type nesting, functionally identical validation), but it was **not** the actual fix — verified empirically once the dependency bump alone made both my new schema and the untouched sibling file's schema pass cleanly.

**Result**: `pnpm exec tsc --noEmit` now completes with **zero errors and zero crashes** across the entire `apps/web` project — for the first time across all four phases of this feature.

---

## Tasks Completed

| # | Task | File | Status |
| - | ---- | ---- | ------ |
| 1 | CREATE `AddBirthUterineActivityModal` | `apps/web/src/modals/add-birth-uterine-activity-modal.tsx` | ✅ |
| — | Simplify `birthUterineActivitySchema` validation (initially thought to be the fix; kept as a harmless simplification) | `apps/web/src/lib/validations/birth-mode.ts` | ✅ |
| — | Fix pre-existing `react-hook-form`/`@hookform/resolvers` incompatibility (user-approved, out-of-plan) | `apps/web/package.json`, `pnpm-lock.yaml` | ✅ |
| — | Remove explicit `useForm<T>` generics broken by the correct v5 resolver typing (user-approved cleanup) | 7 files listed above | ✅ |
| — | Fix `installment_count` optional-narrowing fallout | `new-billing-modal.tsx`, `new-patient-modal.tsx` | ✅ |

---

## Validation Results

| Check       | Result | Details |
| ----------- | ------ | ------- |
| Type check  | ✅     | `pnpm exec tsc --noEmit` — 0 errors, 0 crashes, full `apps/web` project, no memory flag needed |
| Lint        | ✅     | `biome check` on all changed files — 1 pre-existing formatting drift in `finish-care-modal.tsx` auto-fixed, then 0 issues |
| Unit tests  | ✅     | Phase 3's Vitest suite still passes 6/6 after the dependency bump |
| Build       | ⏭️     | Not run — plan's validation levels for this phase stop at type-check + manual/browser |
| Level 5 (Browser) | ⏭️ **NOT DONE** | See "Issues Encountered" — deliberately deferred, documented below rather than claimed |
| Level 6 (Manual)  | ⏭️ **NOT DONE** | Same as above |

---

## Files Changed

| File | Action | Lines |
| ---- | ------ | ----- |
| `apps/web/src/modals/add-birth-uterine-activity-modal.tsx` | CREATE | +251 |
| `apps/web/src/lib/validations/birth-mode.ts` | UPDATE | +14/-8 |
| `apps/web/package.json` | UPDATE | +2/-2 (dependency versions) |
| `pnpm-lock.yaml` | UPDATE | +100 (dependency resolution) |
| `apps/web/src/screens/onboarding-screen.tsx` | UPDATE | +1/-1 |
| `apps/web/src/components/shared/finish-care-modal.tsx` | UPDATE | +1/-16 (1 generic removal + pre-existing formatter drift) |
| `apps/web/src/components/shared/patient-evolution.tsx` | UPDATE | +1/-1 |
| `apps/web/src/modals/edit-patient-modal.tsx` | UPDATE | +1/-1 |
| `apps/web/src/modals/edit-vaccine-record-modal.tsx` | UPDATE | +1/-1 |
| `apps/web/src/modals/new-billing-modal.tsx` | UPDATE | +3/-3 |
| `apps/web/src/modals/new-patient-modal.tsx` | UPDATE | +2/-1 |
| `.claude/PRPs/prds/uterine-activity.prd.md` | UPDATE | +1/-1 |

---

## Deviations from Plan

See "Assessment vs Reality" above for the full account. Summary: the plan's own validation-command workaround (memory flag) turned out to be masking a real, pre-existing, repo-wide bug rather than a genuine memory limitation. Fixing it required a dependency bump and a 7-file cleanup, all done with explicit user approval via two `AskUserQuestion` checkpoints before proceeding.

---

## Issues Encountered

1. **Misdiagnosed root cause initially.** First assumed my new `birthUterineActivitySchema`'s double `.refine()` was the cause of the "excessively deep" error and "fixed" it with `.superRefine()`. Verified via `mcp__ide__getDiagnostics` that this was wrong — the same error appeared on an untouched sibling file. Corrected course rather than declaring victory on the wrong fix.
2. **Dependency bump revealed 5 more affected files** beyond the one the user initially pointed at. Paused and asked before fixing all of them, rather than silently expanding scope.
3. **Level 5/6 (browser/manual validation) not performed.** The plan requires mounting the modal in a temporary harness (since it's deliberately not wired into any button in this phase) to exercise the edge-case checklist (dynamic duration fields, live notation updates, responsive Dialog/Sheet, submission flow). This was not done in this session — flagging honestly rather than claiming it passed. **This is the main outstanding item before this phase can be considered fully verified.**

---

## Tests Written

None for the modal itself (matches the plan's Testing Strategy — no component-test convention exists in this repo). Phase 3's existing Vitest suite (`birth-mode-uterine-activity-utils.test.ts`) was re-run and still passes 6/6 after the dependency changes.

---

## Next Steps

- [ ] **Perform Level 5/6 manual browser validation** — mount `AddBirthUterineActivityModal` temporarily (e.g. a throwaway debug route) and run through the plan's Edge Cases Checklist before considering this phase's UI verified end-to-end
- [ ] Review implementation, especially the dependency-bump fallout (7 files touched outside the original plan)
- [ ] Continue with Phase 5 (flag toggle + wiring into `birth-mode-register-buttons.tsx`) or Phase 6 (timeline aggregation, can run in parallel)
- [ ] Create PR when ready — call out the `@hookform/resolvers`/`zod` bump prominently in the PR description, since it's a repo-wide dependency change riding along with a feature branch
