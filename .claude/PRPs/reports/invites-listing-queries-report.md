# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/invites-listing-queries.plan.md`
**Source PRD**: `.claude/PRPs/prds/invites-management-screen.prd.md` (Phase 2)
**Branch**: `fix/patient-invite-modal-display`
**Date**: 2026-08-18
**Status**: COMPLETE

---

## Summary

Added three read-only functions to `apps/web/src/services/invite.ts` — `getReceivedInvites`, `getSentTeamInvites`, `getSentPatientInvites` — each returning `{ active, inactive }` buckets, using Phase 1's `status` column plus a real-time `expires_at` double-check (matching `respondToInvite`'s existing safety-net pattern). Two new types (`SentTeamInvite`, `SentPatientInvite`) were added to `apps/web/src/types/index.ts`, and the existing `Invite` type gained a `status` field. No UI, migration, or action files were touched — this is a pure data-layer addition for the upcoming Phase 4 Tabs UI.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                 |
| ---------- | --------- | ------ | -------------------------------------------------------------------------- |
| Complexity | LOW       | LOW    | Matched — three additive functions mirroring an existing, well-understood pattern, no schema/UI changes |
| Confidence | 9/10      | 9/10   | Implementation matched the plan exactly; the one open risk (FK constraint name) was verified against the live schema via Supabase MCP before shipping, as planned |

Implementation matched the plan with no deviations.

---

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Add `status` to `Invite`; add `SentTeamInvite`, `SentPatientInvite` types | `apps/web/src/types/index.ts` | ✅ |
| 2 | Add `getReceivedInvites` (team_invites, recipient, admin client) | `apps/web/src/services/invite.ts` | ✅ |
| 3 | Add `getSentTeamInvites` (team_invites, sender, plain client) | `apps/web/src/services/invite.ts` | ✅ |
| 4 | Add `getSentPatientInvites` (patient_invite_links, sender, plain client) | `apps/web/src/services/invite.ts` | ✅ |

---

## Validation Results

| Check | Result | Details |
|-------|--------|---------|
| Type check | ✅ | `pnpm check-types` — 5/5 packages pass, 0 errors |
| Lint | ✅ | `pnpm exec biome lint` on both changed files — 0 errors, 0 warnings |
| Unit tests | ⏭️ N/A | No test runner configured in this repo for this layer (no `*.test.ts` precedent near `services/`/`actions/`) — documented in plan's Testing Strategy |
| Build | ✅ | `pnpm build --filter=web` — compiled successfully, `/invites` routes present in output |
| DB validation | ✅ | Verified via Supabase MCP: all 3 FK constraint names used in joins (`team_invites_patient_id_fkey`, `team_invites_invited_professional_id_fkey`, `patient_invite_links_patient_id_fkey`) exist in `pg_constraint`; both tables have real rows across multiple `status` values (`pendente`, `usado`, `aceito`, `expirado`, `rejeitado`); smoke-tested the `getSentTeamInvites` join shape directly against live data |

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `apps/web/src/types/index.ts` | UPDATE | +28/-0 |
| `apps/web/src/services/invite.ts` | UPDATE | +129/-1 |

---

## Deviations from Plan

None.

---

## Issues Encountered

- `npx biome lint` from the repo root/apps/web resolved to an unrelated `lint` npm package instead of the workspace Biome binary (npx package-name collision). Resolved by using `pnpm exec biome lint` instead, which correctly resolved the monorepo's pinned Biome version. No code change required.

---

## Tests Written

None — no test runner configured in this repo for this layer (see Validation Results). Manual verification checklist from the plan was instead executed via Supabase MCP against live data (Level 4), confirming FK names and status-value diversity; full manual state-by-state verification (Level 6) is left for whoever wires this into the Phase 4 UI, since these are pure reads with no side effects to break.

---

## Next Steps

- [ ] Review implementation
- [ ] Create PR: `gh pr create` (if applicable)
- [ ] Merge when approved
- [ ] Continue with Phase 3 (resend action for `team_invites`) and/or Phase 4 (Tabs UI), which depends on this phase
