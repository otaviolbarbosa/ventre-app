# Implementation Report

**Plan**: `.claude/PRPs/plans/modo-parto-fase-5-redirect-e-barra.plan.md`
**Source Issue**: N/A (from PRD `.claude/PRPs/prds/modo-parto.prd.md`, Phase 5)
**Branch**: `feature/birth-mode`
**Date**: 2026-08-20
**Status**: PARTIAL (code complete + static validation green; live browser validation blocked by tooling)

---

## Summary

Productionized the Phase 2 `useBirthModeRealtime` spike hook (removed its feature-flag gate) and built `useBirthModeStatus`, a composed hook (Realtime activation detection + 60s polling of `getActiveBirthModePregnancyAction` + a 10s countdown state machine) exposed app-wide via the existing `BirthModeRealtimeProvider`. A single `<BirthModeStatusBar />` component, mounted in the dashboard layout, renders either the countdown-with-cancel state or the persistent "return to Modo Parto" state depending on provider state, and `<MainContent />` reserves top padding when the bar is visible.

---

## Assessment vs Reality

| Metric     | Predicted | Actual   | Reasoning                                                                      |
| ---------- | ----------- | -------- | ------------------------------------------------------------------------------ |
| Complexity | MEDIUM      | MEDIUM   | Matched — the trickiest part (composing realtime + polling + countdown without stale closures) was fully spelled out in the plan's Task 3 code and needed only minor fixes |
| Confidence | 8/10        | 8/10     | Implementation matched the plan almost verbatim; the only surprises were TypeScript strictness (`noUncheckedIndexedAccess`) and unrelated environment/tooling issues, not design gaps |

**Deviations from the plan, and why:**

- `.env.local` no longer contained the `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE` flag by the time Task 2 ran (only `.env.local.example` still had it) — removed it from whichever file actually had it instead of assuming both.
- Task 3's countdown-tick `useEffect` was written with the dependency array `[pendingActivation?.pregnancyId, router]` (as literally specified in the plan) rather than `[pendingActivation, router]` — the plan's summary paragraph also flagged this as the correct choice to avoid recreating the interval every second; kept it as documented in the plan, no actual deviation.
- Task 5 needed one extra guard (`activePregnancies[0]` truthiness check before `.id`) to satisfy `noUncheckedIndexedAccess` in `tsconfig` — not called out explicitly in the plan's code snippet, but consistent with its own "GOTCHA" culture elsewhere in the repo.
- Pre-commit `git status` investigation surfaced that a **concurrent process** had reset and re-committed on this same branch between the planning and implementation sessions, dropping the Phase 5 plan file and PRD status update from history (both were still safe on disk as uncommitted changes). Flagged to the user via `AskUserQuestion`; user chose to proceed without further git surgery, so implementation continued directly on top of current `HEAD` and the remote-sync step (`git pull --rebase origin main`) from Phase 2.3 of the implement skill was skipped as unnecessarily risky given that activity.

---

## Tasks Completed

| #   | Task                                                                 | File                                                                  | Status |
| --- | --------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------ |
| 1   | Remove feature-flag gate from `useBirthModeRealtime`                 | `apps/web/src/hooks/use-birth-mode-realtime.ts`                        | ✅     |
| 2   | Remove `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE` from env files         | `apps/web/.env.local`, `apps/web/.env.local.example`                   | ✅     |
| 3   | Create composed status hook (realtime + polling + countdown)          | `apps/web/src/hooks/use-birth-mode-status.ts`                          | ✅     |
| 4   | Swap provider's internal hook to the new composed hook                 | `apps/web/src/providers/birth-mode-realtime-provider.tsx`              | ✅     |
| 5   | Create the fixed top status bar (two visual states)                   | `apps/web/src/components/shared/birth-mode-status-bar.tsx`             | ✅     |
| 6   | Add conditional top padding to `MainContent` when bar is visible      | `apps/web/src/components/layouts/main-content.tsx`                     | ✅     |
| 7   | Mount `<BirthModeStatusBar />` in the dashboard layout                | `apps/web/app/(dashboard)/layout.tsx`                                  | ✅     |
| 8   | Full static validation (types + lint)                                 | N/A                                                                     | ✅     |

---

## Validation Results

| Check       | Result | Details               |
| ----------- | ------ | ---------------------- |
| Type check  | ✅     | `pnpm check-types` — all 5 packages pass, 0 errors |
| Lint        | ✅     | `npx biome check apps/web/src apps/web/app` — "No issues found" |
| Unit tests  | N/A    | No automated test infrastructure exists in this repo (confirmed in Phases 1-4 as well) |
| Build       | ⏭️     | Not run — repo convention across all prior Modo Parto phases is `check-types`+`biome` as the static gate; no `build` step was in the plan's Validation Commands |
| Browser/Integration | ⚠️ BLOCKED | Chrome extension MCP tool did not respond after 2 attempts (extension connected but unresponsive); a direct `curl` to the already-running dev server (`localhost:3000`, confirmed via `lsof`/`ps` to be a live `next-server` process) also returned "Empty reply from server" on both `/` and `/modo-parto`. Stopped after these attempts per guidance against retry loops — flagging as a manual follow-up rather than continuing to poll a non-responsive dev server. |

---

## Files Changed

| File                                                             | Action | Lines     |
| ------------------------------------------------------------------ | ------ | --------- |
| `apps/web/src/hooks/use-birth-mode-realtime.ts`                    | UPDATE | -1        |
| `apps/web/.env.local`                                              | UPDATE | -4        |
| `apps/web/.env.local.example`                                      | UPDATE | -4        |
| `apps/web/src/hooks/use-birth-mode-status.ts`                      | CREATE | +82       |
| `apps/web/src/providers/birth-mode-realtime-provider.tsx`          | UPDATE | +2/-2     |
| `apps/web/src/components/shared/birth-mode-status-bar.tsx`         | CREATE | +55       |
| `apps/web/src/components/layouts/main-content.tsx`                 | UPDATE | +3/-1     |
| `apps/web/app/(dashboard)/layout.tsx`                              | UPDATE | +2        |

---

## Tests Written

None — no automated test infrastructure exists in this repository (confirmed across all Modo Parto phases). Validation strategy is `pnpm check-types` + `biome check` plus manual/browser verification, per repo convention.

---

## Issues Encountered

1. **Concurrent git activity on the same branch**: between the planning session and this implementation session, another process reset and re-committed on `feature/birth-mode`, dropping the Phase 5 plan file and the PRD's "in-progress" status update from git history (content was preserved on disk as uncommitted changes). Surfaced to the user before proceeding; user chose to continue implementing on current `HEAD` without further git intervention, and the plan's own remote-sync step was skipped as a precaution.
2. **Browser/dev-server validation unavailable**: the Chrome DevTools MCP extension did not respond to `tabs_context_mcp` after two attempts, and a direct `curl` against the confirmed-running dev server on port 3000 returned empty replies on both `/` and `/modo-parto`. This blocked Level 2 (BROWSER_VALIDATION) and the manual edge-case checklist (Level 3) from being run in this session. Static validation (types + lint) is fully green; the manual checklist below should be run by a human (or a follow-up session with working browser tooling) before merge.

---

## Manual Validation Still Needed (not run this session)

From the plan's Edge Cases Checklist — none of these were exercised due to the tooling blocker above:

- [ ] Two browsers, different team members: activation in one shows countdown bar in the other within <2s, auto-redirects after 10s
- [ ] "Cancelar" during countdown stops the timer and transitions to the persistent (no-countdown) bar state
- [ ] "Ir agora" navigates immediately and clears the countdown
- [ ] No countdown/redirect fires if the user is already on `/modo-parto` when the activation event arrives
- [ ] Persistent bar appears when navigating away from `/modo-parto` while Birth Mode is still active
- [ ] Bar never appears for users with no active births on their team, or for non-professional users
- [ ] Reload with Birth Mode already active shows the persistent bar via the initial poll (no reliance on having received the live activation event)
- [ ] Mobile viewport (<640px): bar doesn't overlap content or the bottom nav

---

## Next Steps

- [ ] Re-run browser/manual validation (Level 2/3) once dev server + Chrome tooling are responsive
- [ ] Review implementation
- [ ] Create PR: `gh pr create` (if applicable)
- [ ] Merge when approved
