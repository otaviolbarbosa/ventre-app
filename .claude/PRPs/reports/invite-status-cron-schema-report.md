# Implementation Report

**Plan**: `.claude/PRPs/plans/invite-status-cron-schema.plan.md`
**Branch**: `fix/patient-invite-modal-display`
**Date**: 2026-08-18
**Status**: COMPLETE

---

## Summary

Added a `status` column to `patient_invite_links` (mirroring `team_invites.status`, plain text), backfilled it from the existing `used_at`/`expires_at` derivation, and shipped a new Vercel Cron route (`/api/cron/invite-statuses`, midnight UTC) that batch-flips pending invites to `expirado` in both `team_invites` and `patient_invite_links`, mirroring `billing-statuses` exactly.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
|------------|-----------|--------|-----------|
| Complexity | LOW       | LOW    | Matched — the pattern was copied nearly 1:1 from `billing-statuses` |
| Confidence | 9/10      | 9/10   | Plan held up; the only deviation was an infra issue unrelated to the plan's content |

**Deviation from plan (infra, not code):**

- `pnpm db:push` initially applied the migration to the **wrong Supabase project**. The repo's linked CLI project (`supabase/.temp/project-ref`) pointed at `ggpuywxwjaaodzcjtxqb` (**ventre-db-prod**), while the app and project memory both reference `osnpmadayhignmkpoevr` (**ventre-db-dev**). `pnpm db:types` reads from `NEXT_PUBLIC_SUPABASE_PROJECCT_ID` (dev), so the mismatch was caught immediately when the regenerated types didn't show the new column.
- **Resolution**: flagged to the user, who chose to relink the CLI to dev (`supabase link --project-ref osnpmadayhignmkpoevr`) and reapply there, leaving the additive column already present in prod as-is (no functional risk — no app code reads/writes it yet).
- **Follow-up worth flagging separately**: the repo's Supabase CLI link defaults to prod, not dev. This is a standing footgun for future `db:push` runs and is outside this phase's scope to fix, but worth raising with the user.

---

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 1 | CREATE migration (status column + backfill) | `packages/supabase/supabase/migrations/20260821000001_patient_invite_links_add_status.sql` | ✅ |
| 2 | REGENERATE database types | `packages/supabase/src/types/database.types.ts` | ✅ |
| 3 | CREATE cron route | `apps/web/app/api/cron/invite-statuses/route.ts` | ✅ |
| 4 | UPDATE Vercel Cron config | `apps/web/vercel.json` | ✅ |
| 5 | VERIFY `respondToInvite` safety net unchanged | `apps/web/src/services/invite.ts` (no diff) | ✅ |

---

## Validation Results

| Check | Result | Details |
|-------|--------|---------|
| Type check | ✅ | `pnpm check-types` — 5/5 packages passed, 0 errors |
| Lint | ✅ | `biome check` on changed files — no issues |
| Unit tests | N/A | Repo convention: no unit tests for `app/api/cron/*` routes (confirmed `billing-statuses` has none either) |
| Database validation | ✅ | Column confirmed `text NOT NULL DEFAULT 'pendente'`; backfill spot-checked (11 `usado` rows all have `used_at` set, including 4 also past `expires_at` — confirms `CASE` ordering is correct; 7 `pendente`, 0 falsely `expirado`) |
| Manual/integration | ✅ | See below |

**Manual validation (Level 6) — against the user's already-running local dev server:**
1. `curl` without auth header → `401 {"error":"Não autorizado"}` ✅
2. `curl` with correct `CRON_SECRET` → `200 {"team_invites_expired":16,"patient_invite_links_expired":0}` — real pending `team_invites` past expiry got swept ✅
3. Inserted a test `patient_invite_links` row (`status: 'pendente'`, `expires_at` in the past) → re-ran cron → `200 {"team_invites_expired":0,"patient_invite_links_expired":1}`, confirming the new row was flipped and already-expired `team_invites` were not reprocessed (idempotent under `.eq("status","pendente")`) ✅
4. Deleted the test row, confirmed pre-delete `status = 'expirado'` ✅

---

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `packages/supabase/supabase/migrations/20260821000001_patient_invite_links_add_status.sql` | CREATE | +11 |
| `apps/web/app/api/cron/invite-statuses/route.ts` | CREATE | +33 |
| `apps/web/vercel.json` | UPDATE | +4 |
| `packages/supabase/src/types/database.types.ts` | REGENERATE | +3 |

---

## Deviations from Plan

- Infra-only deviation documented above (wrong Supabase project link) — no plan content changed as a result. Migration content, cron route content, and `vercel.json` entry all match the plan exactly as written.

---

## Issues Encountered

- **Supabase CLI linked to prod instead of dev** — caught via the type-regeneration mismatch, confirmed against project memory and `.env.local`, resolved by relinking per explicit user decision. See Assessment vs Reality above.

---

## Tests Written

None — matches existing repo convention for `app/api/cron/*` routes (manual/integration verification only, no unit test file for `billing-statuses` either).

---

## Next Steps

- [ ] Review implementation (migration, cron route, `vercel.json`)
- [ ] Consider raising the prod-linked-CLI footgun as a separate housekeeping item (not part of this PRD)
- [ ] Continue with PRD Phase 2 (listing queries) and Phase 3 (resend action for `team_invites`) — can run in parallel
- [ ] Create PR when ready (`gh pr create` or `/prp-pr`)
