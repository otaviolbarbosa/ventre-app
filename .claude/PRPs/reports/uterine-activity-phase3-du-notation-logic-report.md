# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/uterine-activity-phase3-du-notation-logic.plan.md`
**Source PRD**: `.claude/PRPs/prds/uterine-activity.prd.md` (Phase 3)
**Branch**: `feat/uterine-activity`
**Date**: 2026-08-31
**Status**: COMPLETE

---

## Summary

Implemented `computeDuNotations`, a pure function that decomposes a batch uterine-activity record into DU notation strings (`DU {count}/10'/{avg}"`), splitting 20/30-minute windows into 10-minute sub-blocks and excluding sub-40s... correction: excluding `<20s` contractions from each block's count/average. Also introduced Vitest as this monorepo's first automated test framework (`apps/web` only), with a `test` task wired into `turbo.json`.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | MEDIUM    | MEDIUM | Matched — the test-infra setup (Vitest, turbo task) was exactly the expected extra weight, no surprises there |
| Confidence | 8/10      | 8/10   | Held overall, but one of the plan's own pre-flagged risks materialized exactly as predicted: the "primeira contração desprezada" test case (flagged in the plan's Risks as inferred from limited examples) turned out to be internally inconsistent with the `<20s` exclusion rule and had to be corrected during implementation, not just accepted on faith |

**Deviations from the plan, with rationale:**

1. **Removed the unused `EFFECTIVE_THRESHOLD_SECONDS` (40) constant** from `birth-mode-uterine-activity-utils.ts`. The plan's own Task 3 GOTCHA flagged this as a likely `noUnusedVariables` lint issue and offered removal as one resolution path. Since the function only needs the 20s threshold (registrable vs. not), the 40s constant was dead code — removed rather than kept for documentation purposes.
2. **Rewrote the "primeira contração desprezada" test case.** The plan's Task 4 test used raw input `[15, 18, 26]` expecting `DU 2/10'/22"` (keeping 18 and 26). Running it revealed a real contradiction: `18` is itself `<20s`, so it cannot survive the same `>=20s` filter that's supposed to explain why the *other* contraction was excluded — the actual implementation correctly returned `DU 1/10'/26"` instead. Re-reading the primary source (`prompts/019-uterine-activity.md:28-41`) directly (not just the earlier exploration agent's paraphrase) confirmed the source example describes **4 separate 10-minute records already aggregated into chart columns** (a Phase 7 concern), not a single record being decomposed by this phase's function — and it never states the excluded duration's actual raw value, only that it exists and is "desprezada." This example cannot be faithfully reproduced as a unit test for `computeDuNotations` without inventing a number, and the number the plan invented (`15`) combined with the doc's stated surviving values (`18`, `26`) is mathematically inconsistent with a single `>=20s` threshold. Fixed by replacing the test with unambiguous synthetic values (`[15, 22, 30]` → `DU 2/10'/26"`) that validate the same exclusion rule without relying on an unreproducible example. Documented this reasoning directly in the test file's inline comment.
3. **Fixed a Vite deprecation warning** in `vitest.config.ts` (`__dirname` → `import.meta.dirname`) — one-line fix in code written in this same phase, not scope creep.
4. **Root `package.json`'s `check-types` script** was changed by the user directly (`turbo run check-types` → `turbo run check-types --filter='!mobile'`) during this session, unrelated to this plan's file list. Left untouched — not part of this phase's scope, and not something I introduced.

---

## Tasks Completed

| # | Task | File | Status |
| - | ---- | ---- | ------ |
| 1 | Install Vitest, add `test` script, create config | `apps/web/package.json`, `apps/web/vitest.config.ts` | ✅ |
| 2 | Add `test` task to Turborepo pipeline | `turbo.json` | ✅ |
| 3 | Implement `computeDuNotations` | `apps/web/src/lib/birth-mode-uterine-activity-utils.ts` | ✅ (with 1 deviation, see above) |
| 4 | Write unit tests covering requirement examples | `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts` | ✅ (with 1 deviation, see above) |

---

## Validation Results

| Check       | Result | Details |
| ----------- | ------ | ------- |
| Type check  | ✅     | `cd apps/web && NODE_OPTIONS="--max-old-space-size=8192" pnpm exec tsc --noEmit` — exit 0, no errors (same pre-existing environment memory issue as Phase 2, unrelated to this code; confirmed present even in isolation from `apps/mobile`) |
| Lint        | ✅     | `biome check` on all 3 new/changed files — 1 formatting auto-fix applied, then 0 issues |
| Unit tests  | ✅     | 6/6 passed (`pnpm test` in `apps/web`, and via `turbo run test` from repo root) |
| Build       | ⏭️     | Not run — plan's validation levels for this phase stop at type-check + unit tests + manual check |
| Turbo pipeline | ✅  | `turbo run test` from root correctly picks up and runs the new `web:test` task |

---

## Files Changed

| File | Action | Lines |
| ---- | ------ | ----- |
| `apps/web/package.json` | UPDATE | +2/-1 (vitest devDependency + `test` script) |
| `apps/web/vitest.config.ts` | CREATE | +11 |
| `turbo.json` | UPDATE | +4 |
| `apps/web/src/lib/birth-mode-uterine-activity-utils.ts` | CREATE | +33 |
| `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts` | CREATE | +50 |
| `pnpm-lock.yaml` | UPDATE | (dependency lock, auto-generated by `pnpm add`) |

---

## Deviations from Plan

See "Assessment vs Reality" above — 3 deviations, all documented with rationale: unused constant removed, one test case corrected after being proven mathematically inconsistent with the source document, and one unrelated Vite deprecation warning fixed inline.

---

## Issues Encountered

- The plan's own Task 4 test case for "primeira contração desprezada" failed on first run. Root-caused by re-reading the primary source document directly instead of trusting a prior paraphrase — the doc describes a multi-record chart-aggregation scenario, not a single-record decomposition, and never specifies the excluded duration's value. Resolved by replacing the test with an unambiguous synthetic case; the underlying implementation (the `>=20s` filter) was correct and unchanged.
- `pnpm check-types` at the monorepo root still crashes with `Abort trap: 6` (exit 134) due to a pre-existing, environment-specific `tsc` native crash in `apps/web` (documented in the Phase 2 report). Confirmed this is unrelated to `apps/mobile` (crash persists even after mobile's own `check-types` script was removed) and unrelated to this phase's code (isolated `tsc --noEmit` run with increased heap in `apps/web` passes clean). User was asked how to address it and chose to leave it as-is for now.

---

## Tests Written

| Test File | Test Cases |
| --------- | ---------- |
| `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts` | 10-min single block; 20-min uneven split (5→3+2); 20-min even split (6→3+3); `<20s` exclusion from count/average; 30-min 3-way split (constructed, not from source doc); all-contractions-excluded edge case (`DU 0/10'/0"`) |

---

## Next Steps

- [ ] Review implementation, especially the corrected "desprezada" test case and its rationale
- [ ] Continue with Phase 4 (Modal de registro) — can run independently, was already unblocked by Phase 2
- [ ] Create PR when ready
