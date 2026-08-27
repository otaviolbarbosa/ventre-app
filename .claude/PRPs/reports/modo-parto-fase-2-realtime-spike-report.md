# Implementation Report

**Plan**: `.claude/PRPs/plans/modo-parto-fase-2-realtime-spike.plan.md`
**Source PRD**: `.claude/PRPs/prds/modo-parto.prd.md` — Phase 2
**Branch**: `feature/birth-mode`
**Date**: 2026-08-20
**Status**: COMPLETE

---

## Summary

Implemented the Realtime infrastructure for Modo Parto Phase 2: `pregnancies` is now in the `supabase_realtime` publication with `REPLICA IDENTITY FULL`, local Realtime is enabled, and a `useBirthModeRealtime` hook + `BirthModeRealtimeProvider` are wired into the provider tree, gated behind `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE`. All code-level tasks (1–6) were completed and validated automatically. Task 7 — the manual runbook proving <2s latency, RLS enforcement, and reconnection after a real network drop — was run interactively with the user (two live professional accounts, Supabase Studio, DevTools) after this agent's autonomous run, since it inherently requires a human operator. All three success criteria passed.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | HIGH | HIGH — confirmed | Greenfield Realtime, no existing convention; codebase research anticipated this correctly. |
| Confidence | 7/10 | Code-level: high; Runbook: unverified | All code tasks matched the plan exactly with zero deviation in shape. The plan's own flagged risk — RLS/`SECURITY DEFINER` behavior under Realtime's per-subscriber evaluation — is genuinely unverified, since it requires the manual runbook. |

**Note**: `apps/web/.env.local.example` was initially gitignored/untracked (`apps/web/.gitignore` had a blanket `.env*` rule), so Task 6's edit wouldn't have appeared in the diff. This was fixed during the runbook session by adding `!.env.local.example` to `apps/web/.gitignore`, un-ignoring the example file so it's tracked going forward — Task 6's documentation now ships with the PR.

---

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 1 | CREATE migration: add `pregnancies` to `supabase_realtime` publication + `REPLICA IDENTITY FULL` | `packages/supabase/supabase/migrations/20260822000012_pregnancies_realtime_publication.sql` | ✅ Applied via `pnpm db:push`, verified via SQL |
| 2 | UPDATE local Realtime config | `packages/supabase/supabase/config.toml` | ✅ |
| 3 | CREATE Realtime subscription hook | `apps/web/src/hooks/use-birth-mode-realtime.ts` | ✅ |
| 4 | CREATE Context + Provider | `apps/web/src/providers/birth-mode-realtime-provider.tsx` | ✅ |
| 5 | UPDATE provider composition | `apps/web/src/providers/index.tsx` | ✅ |
| 6 | DOCUMENT spike flag | `apps/web/.env.local.example` (untracked, local-only) | ✅ (see deviation note) |
| 7 | RUN manual validation runbook | — | ✅ Run interactively with the user post-implementation |

---

## Validation Results

| Check | Result | Details |
| ----- | ------ | ------- |
| Type check | ✅ | `pnpm check-types` — 5/5 packages pass, 0 errors |
| Lint (biome, scoped to changed files) | ✅ | `npx biome check` on all 3 touched/new TS files — no issues |
| Database validation | ✅ | `pregnancies` confirmed in `pg_publication_tables` for `supabase_realtime`; `relreplident = 'f'` confirmed via `execute_sql` |
| Types regeneration | ✅ | `pnpm db:types` run — no diff (expected; publication/replica identity don't change the type shape) |
| Dev server smoke test | ✅ | `pnpm --filter web dev` boots clean on `https://localhost:3000`, `GET /` → 200, no runtime errors referencing the new provider/hook in server logs |
| Manual runbook — latency | ✅ | ~1s observed, well under the 2s target |
| Manual runbook — RLS negative case | ✅ | Non-team-member (Browser B) received nothing; team member (Browser A) received the event — confirms `is_team_member`'s `SECURITY DEFINER` policy is correctly evaluated by Realtime per-subscriber |
| Manual runbook — reconnection | ✅ | DevTools "Offline" throttling did not reliably kill the WebSocket (documented gotcha, see Issues Encountered); a real OS-level Wi-Fi toggle did — client logged repeated `CHANNEL_ERROR`, then `SUBSCRIBED` again without a page reload, and a fresh activation event was received afterward, proving the manual resubscribe logic (not just the socket) recovered |

---

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `packages/supabase/supabase/migrations/20260822000012_pregnancies_realtime_publication.sql` | CREATE | Applied to the connected Supabase project |
| `packages/supabase/supabase/config.toml` | UPDATE | `[realtime] enabled = true` |
| `apps/web/src/hooks/use-birth-mode-realtime.ts` | CREATE | Hook with manual resubscribe on `CHANNEL_ERROR`/`TIMED_OUT`/`CLOSED` |
| `apps/web/src/providers/birth-mode-realtime-provider.tsx` | CREATE | Context + Provider, mirrors `notifications-provider.tsx` |
| `apps/web/src/providers/index.tsx` | UPDATE | `BirthModeRealtimeProvider` nested inside `AuthProvider` |
| `apps/web/.env.local.example` | CREATE (now tracked) | Documents `NEXT_PUBLIC_BIRTH_MODE_REALTIME_SPIKE` |
| `apps/web/.gitignore` | UPDATE | `!.env.local.example` — un-ignores the example file so it's tracked |
| `.claude/PRPs/prds/modo-parto.prd.md` | UPDATE | Phase 2 status |

---

## Deviations from Plan

- `apps/web/.gitignore` was updated to un-ignore `.env.local.example` (see Note above) — a small scope addition beyond the plan's file list, needed so Task 6's documentation actually ships in the PR.
- Added `console.debug("[birth-mode-realtime] ...")` logging in `use-birth-mode-realtime.ts` (status transitions + received activations) that wasn't in the original plan. It was needed to make the manual runbook observable at all (no UI exists yet — that's Fase 5), and it only fires when the spike flag is on, so it carries no cost in production. Left in place since it will remain useful for debugging until the hook is promoted/replaced in Fase 5.
- No other deviations. Every file, pattern, and naming choice matches the plan's "Patterns to Mirror" and "Files to Change" sections exactly.

---

## Issues Encountered

- `pnpm lint` at the repo root failed with an unrelated `ESLint`/`eslint not found` error — this is pre-existing tooling noise unrelated to these changes (the root `lint` script is `biome lint .`; the error trace suggests some other wrapper is intercepting it in this environment). Worked around by running `npx biome check` directly on the changed files, which passed cleanly. Not introduced by this implementation — flagging for the team to investigate separately if it also reproduces for them.
- During manual testing, `console.debug` output was initially invisible because Chrome DevTools filters "Verbose"-level logs out of the Console by default — resolved by enabling that filter level.
- A stale Serwist service worker registration (left over from a prior non-dev session) was intercepting requests in the test browser and serving a cached bundle, even though `next.config.js` disables SW builds in development (`disable: process.env.NODE_ENV === "development"`). Dev mode doesn't unregister a pre-existing SW — it just stops building new ones. Resolved by unregistering the SW and clearing site storage via DevTools → Application. This is a pre-existing environment gotcha, not something introduced by this implementation, but worth documenting since it will trip up the next person testing locally too.
- Chrome DevTools' "Offline" network throttling did not reliably kill the already-open Realtime WebSocket — no `CHANNEL_ERROR`/`TIMED_OUT` appeared even after waiting. A real OS-level network drop (toggling Wi-Fi off/on) did trigger it reliably. Worth noting in case this phase's convention is reused for testing in Fase 5: DevTools throttling alone is not a reliable way to validate reconnection behavior for this stack.

---

## Tests Written

None. The repository has no test infrastructure (no `vitest.config.*`/`jest.config.*`/`*.test.ts*` anywhere), and adding one was explicitly out of scope per the plan's "NOT Building" section.

---

## Next Steps

- [x] Run the Task 7 manual runbook — done, all criteria passed.
- [x] Flip PRD Phase 2 status to `complete` — done.
- [ ] Review implementation, then `gh pr create` when ready.
- [ ] Continue with Phase 3 (WhatsApp notification) and/or Phase 6 (finish-care-modal extension) — both unblocked. Phase 4 (`/modo-parto` screen) and Phase 5 (redirect + persistent bar) are now also unblocked, since this phase is complete.
