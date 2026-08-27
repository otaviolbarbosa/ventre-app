# Feature: Invite Status Cron & Schema (PRD Phase 1)

## Summary

Add a `status` column to `patient_invite_links` (mirroring the existing `team_invites.status` free-text column), backfill it from the current `used_at`/`expires_at` derivation, and add a daily Vercel Cron route that batch-flips pending invites to `expirado` in both `team_invites` and `patient_invite_links`, mirroring the existing `apps/web/app/api/cron/billing-statuses/route.ts` pattern exactly (plain `supabaseAdmin` `UPDATE`, no queue, no pg_cron/pg_net).

## User Story

As a profissional do parto
I want que convites vencidos sejam automaticamente marcados como expirados
So that eu possa confiar no status exibido na tela de convites sem checagem manual

## Problem Statement

`patient_invite_links` has no `status` column today — status is derived ad hoc from `used_at`/`expires_at` nullability wherever it's read. `team_invites.status` exists but is only updated lazily, inside `respondToInvite`, when a user happens to act on an already-expired invite — there is no background sweep. Neither table has a reliable, queryable "expirado" state, which blocks building the Enviados/Recebidos invites screen (PRD phases 2–4) on top of a consistent status field.

## Solution Statement

1. Migration adds `patient_invite_links.status text NOT NULL DEFAULT 'pendente'`, backfilled via a `CASE` over existing `used_at`/`expires_at`.
2. New route `apps/web/app/api/cron/invite-statuses/route.ts`, copied structurally from `billing-statuses/route.ts`: validates `CRON_SECRET`, then runs two independent `UPDATE ... WHERE status = 'pendente' AND expires_at < now()` statements via `supabaseAdmin`, one per table.
3. `apps/web/vercel.json` gets a second cron entry, scheduled at midnight (`0 0 * * *`), matching the PRD's explicit requirement.
4. `pnpm db:types` regenerates `database.types.ts` after the migration.

## Metadata

| Field            | Value                                                                 |
|------------------|------------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                            |
| Complexity       | LOW                                                                    |
| Systems Affected | Supabase migrations, `apps/web/app/api/cron/*`, `apps/web/vercel.json` |
| Dependencies     | None new — reuses `@ventre/supabase/server`, `next/server`             |
| Estimated Tasks  | 5                                                                      |

---

## UX Design

This phase is backend/data-only — no UI changes ship here (UI is PRD Phase 4). The "UX" transformed is the **reliability of the status field** that later phases will read.

### Before State
```
╔════════════════════════════════════════════════════════════════╗
║  team_invites.status: updated ONLY when a user opens the        ║
║  invite and acts on it (respondToInvite). No background sweep.  ║
║                                                                  ║
║  patient_invite_links: NO status column. Every reader must      ║
║  re-derive status from used_at/expires_at nullability inline.   ║
╚════════════════════════════════════════════════════════════════╝
```

### After State
```
╔════════════════════════════════════════════════════════════════╗
║  Both tables: status is a stored, queryable column.             ║
║  Daily cron (00:00 UTC) flips pending → expirado in batch,      ║
║  via a single UPDATE per table (no per-row processing, no       ║
║  queue). respondToInvite's lazy check remains as a safety net   ║
║  for the gap between cron runs.                                 ║
╚════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `patient_invite_links` reads (future PRD phases) | Status computed inline from `used_at`/`expires_at` | Status read directly from `status` column | Simpler, consistent queries for Phase 2 |
| Any pending invite past `expires_at` | Shows as "pendente" until someone opens it | Flips to "expirado" within 24h automatically | Accurate status without user action |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/app/api/cron/billing-statuses/route.ts` | 1-47 | Exact structure to MIRROR for the new cron route |
| P0 | `apps/web/vercel.json` | 1-8 | Exact JSON shape to extend with a second cron entry |
| P1 | `apps/web/src/services/invite.ts` | 132-153 | Existing lazy-expiration check on `team_invites` — must remain as safety net, unchanged in this phase |
| P1 | `packages/supabase/supabase/migrations/20260814000001_contracts_add_fully_signed_at.sql` | all | Convention: header comment explaining column semantics/write-ownership before `ALTER TABLE` |
| P2 | `packages/supabase/src/types/database.types.ts` | 1140-1181 (`patient_invite_links`), 1899-1911 (`team_invites`) | Current generated types — confirms `status` is absent from one, plain `string` on the other |
| P2 | `apps/web/src/actions/complete-patient-registration-action.ts` | 50-65, 130-155 | Confirms current fields selected/written on `patient_invite_links` — nothing here needs to change in this phase, but the new column must not break these selects (`select()`/`select("*")` usage, if any, should be checked) |

---

## Patterns to Mirror

**CRON_ROUTE (full structure to copy):**
```typescript
// SOURCE: apps/web/app/api/cron/billing-statuses/route.ts:1-47
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const supabaseAdmin = await createServerSupabaseAdmin();
    const today = new Date().toISOString().split("T")[0] as string;

    const { data: overdueInstallments } = await supabaseAdmin
      .from("installments")
      .update({ status: "atrasado" })
      .eq("status", "pendente")
      .lt("due_date", today)
      .select("billing_id");

    // ... per-billing recalculation loop ...

    return NextResponse.json({
      overdue_installments: overdueInstallments?.length ?? 0,
      billings_updated: updated,
    });
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
```

**VERCEL_CRON_CONFIG:**
```json
// SOURCE: apps/web/vercel.json:1-8
{
  "crons": [
    {
      "path": "/api/cron/billing-statuses",
      "schedule": "0 3 * * *"
    }
  ]
}
```

**MIGRATION_ADD_COLUMN (header-comment convention):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260814000001_contracts_add_fully_signed_at.sql:1-6
-- Contract dual signature (Phase 1): parent-level flag set only once BOTH
-- signer roles (professional + patient) have signed. Never written directly
-- by the application — only by the contract_signatures completion trigger
-- and by the one-time backfill for pre-existing signed contracts.
ALTER TABLE public.contracts
  ADD COLUMN fully_signed_at timestamptz;
```

**STATUS_COLUMN_CONVENTION — plain text, not enum:**
```typescript
// SOURCE: packages/supabase/src/types/database.types.ts:1899-1911 (team_invites)
Row: {
  ...
  status: string   // NOT a Postgres enum — app-level literals "pendente" | "aceito" | "rejeitado" | "expirado"
}
```
This resolves the PRD's open question (enum vs text): `team_invites.status` and `installments.status`/`billings.status` are all plain `text`. Follow that dominant convention for `patient_invite_links.status` — do not introduce a new enum type.

**LAZY_CHECK_TO_PRESERVE (do not modify in this phase):**
```typescript
// SOURCE: apps/web/src/services/invite.ts:132-153
if (new Date(invite.expires_at) < new Date()) {
  await supabase.from("team_invites").update({ status: "expirado" }).eq("id", inviteId);
  throw new Error("Convite expirado");
}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `packages/supabase/supabase/migrations/20260821000001_patient_invite_links_add_status.sql` | CREATE | Adds `status` column + backfill |
| `apps/web/app/api/cron/invite-statuses/route.ts` | CREATE | Daily batch expiration for both invite tables |
| `apps/web/vercel.json` | UPDATE | Register the new cron path/schedule |
| `packages/supabase/src/types/database.types.ts` | REGENERATE | Via `pnpm db:types` — do not hand-edit |

---

## NOT Building (Scope Limits)

- No queue/`pgmq` infrastructure — explicitly rejected in the PRD's Decisions Log.
- No changes to `respondToInvite`'s lazy expiration check — it remains as the real-time safety net; this phase only adds the batch sweep.
- No UI changes, no new listing queries/actions — those are PRD Phase 2.
- No reindexing/perf tuning beyond what's needed for the two `UPDATE ... WHERE status = 'pendente' AND expires_at < now()` statements (no new index added unless `EXPLAIN` in validation shows it's needed — table sizes are small enough today that this is unlikely to matter).

---

## Step-by-Step Tasks

### Task 1: CREATE migration `packages/supabase/supabase/migrations/20260821000001_patient_invite_links_add_status.sql`
- **ACTION**: Add `status` column to `patient_invite_links` with backfill
- **IMPLEMENT**:
  ```sql
  -- Explicit status tracking for patient_invite_links, mirroring team_invites.status
  -- (plain text, not enum — see database convention). Backfilled from the existing
  -- used_at/expires_at derivation; maintained going forward by the invite-statuses
  -- cron (apps/web/app/api/cron/invite-statuses) plus real-time checks on read.
  ALTER TABLE public.patient_invite_links
    ADD COLUMN status text NOT NULL DEFAULT 'pendente';

  UPDATE public.patient_invite_links
  SET status = CASE
    WHEN used_at IS NOT NULL THEN 'usado'
    WHEN expires_at < now() THEN 'expirado'
    ELSE 'pendente'
  END;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260814000001_contracts_add_fully_signed_at.sql:1-6` — header comment convention
- **GOTCHA**: Backfill UPDATE must run in the same migration, after the `ADD COLUMN` with `DEFAULT`, so existing rows get a correct historical status instead of all defaulting to `'pendente'`.
- **VALIDATE**: `pnpm db:push` (apply locally/remote per project workflow), then `pnpm db:types`

### Task 2: REGENERATE `packages/supabase/src/types/database.types.ts`
- **ACTION**: Run `pnpm db:types`
- **IMPLEMENT**: N/A — generated output
- **MIRROR**: `packages/supabase/package.json:20` — `supabase gen types typescript --project-id $NEXT_PUBLIC_SUPABASE_PROJECCT_ID > ./src/types/database.types.ts`
- **VALIDATE**: `grep -A 15 '"patient_invite_links"' packages/supabase/src/types/database.types.ts` shows `status: string` in the `Row` type

### Task 3: CREATE `apps/web/app/api/cron/invite-statuses/route.ts`
- **ACTION**: CREATE new cron route
- **IMPLEMENT**:
  ```typescript
  import { createServerSupabaseAdmin } from "@ventre/supabase/server";
  import { NextResponse } from "next/server";

  export async function GET(request: Request) {
    try {
      const cronSecret = process.env.CRON_SECRET;
      const authHeader = request.headers.get("authorization");
      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
      }

      const supabaseAdmin = await createServerSupabaseAdmin();
      const now = new Date().toISOString();

      const { data: expiredTeamInvites } = await supabaseAdmin
        .from("team_invites")
        .update({ status: "expirado" })
        .eq("status", "pendente")
        .lt("expires_at", now)
        .select("id");

      const { data: expiredPatientInvites } = await supabaseAdmin
        .from("patient_invite_links")
        .update({ status: "expirado" })
        .eq("status", "pendente")
        .lt("expires_at", now)
        .select("id");

      return NextResponse.json({
        team_invites_expired: expiredTeamInvites?.length ?? 0,
        patient_invite_links_expired: expiredPatientInvites?.length ?? 0,
      });
    } catch {
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
  }
  ```
- **MIRROR**: `apps/web/app/api/cron/billing-statuses/route.ts:1-47` — exact auth check, client creation, response/error shape
- **IMPORTS**: `import { createServerSupabaseAdmin } from "@ventre/supabase/server"`, `import { NextResponse } from "next/server"`
- **GOTCHA**: Use `expires_at < now` with ISO timestamp comparison (`.lt("expires_at", now)`), not date-only truncation like `billing-statuses` does for `due_date` — `expires_at` is `timestamptz`, not a date column.
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/vercel.json`
- **ACTION**: Add second cron entry
- **IMPLEMENT**:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron/billing-statuses",
        "schedule": "0 3 * * *"
      },
      {
        "path": "/api/cron/invite-statuses",
        "schedule": "0 0 * * *"
      }
    ]
  }
  ```
- **MIRROR**: `apps/web/vercel.json:1-8`
- **GOTCHA**: Schedule is UTC. PRD specifies "meia-noite" (midnight) — `0 0 * * *` is midnight UTC, not local time; confirm this matches the intended timezone with the user if precision matters (existing `billing-statuses` at `0 3 * * *` suggests the team already accepts UTC scheduling).
- **VALIDATE**: `cat apps/web/vercel.json` shows valid JSON with both entries

### Task 5: VERIFY safety-net check still holds for `team_invites`
- **ACTION**: No code change — confirm `respondToInvite` (`apps/web/src/services/invite.ts:132-153`) is untouched and still functions correctly now that `status` can also be flipped by the new cron
- **IMPLEMENT**: N/A
- **GOTCHA**: Since the cron and the lazy check both write `status = "expirado"` under the same `WHERE status = 'pendente'` guard, there's no conflict — whichever runs first wins, the other is a no-op (no rows matched). No code change needed, but worth a manual test (Level 6) to confirm.
- **VALIDATE**: Manual test — see Level 6 below

---

## Testing Strategy

### Unit Tests to Write

No existing unit test suite covers `apps/web/app/api/cron/*` routes (`billing-statuses` has none either) — this repo's convention for cron routes is manual/integration verification, not unit tests. Following that convention, no new unit test file is added in this phase.

### Edge Cases Checklist

- [ ] `patient_invite_links` row with `used_at` set and `expires_at` in the past → backfill must resolve to `'usado'`, not `'expirado'` (test the `CASE` order: `used_at IS NOT NULL` checked first)
- [ ] `patient_invite_links` row with `expires_at` in the future, `used_at` null → backfill resolves to `'pendente'`
- [ ] Cron route hit with missing `CRON_SECRET` env var → 401, not a crash
- [ ] Cron route hit with correct secret but zero eligible rows in either table → 200 with `{ ..._expired: 0 }` for both
- [ ] `team_invites` row already `'expirado'` via lazy check before cron runs → cron's `UPDATE` matches zero rows for it (guarded by `.eq("status", "pendente")`), no duplicate work or error

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
```
**EXPECT**: Exit 0, no errors

### Level 4: DATABASE_VALIDATION
Use Supabase MCP or `pnpm db:push` + manual query to verify:
- [ ] `patient_invite_links.status` column exists, `NOT NULL`, default `'pendente'`
- [ ] Backfilled rows show correct derived status (spot-check a few `used_at`-set rows and a few expired rows)
- [ ] `database.types.ts` regenerated and includes `status: string` on `patient_invite_links`

### Level 6: MANUAL_VALIDATION
1. Locally set `CRON_SECRET` env var, run dev server.
2. `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/invite-statuses` → expect `200` with `{ team_invites_expired, patient_invite_links_expired }` counts.
3. `curl http://localhost:3000/api/cron/invite-statuses` (no header) → expect `401`.
4. Manually insert a `patient_invite_links` row with `expires_at` in the past and `status = 'pendente'`, re-run the curl, confirm the row flips to `'expirado'` and is counted.
5. Confirm an already-`'aceito'`/`'rejeitado'`/`'usado'` row is untouched by the cron (guarded by `.eq("status", "pendente")`).

---

## Acceptance Criteria

- [ ] `patient_invite_links.status` column exists, backfilled correctly, default `'pendente'` for new rows
- [ ] `apps/web/app/api/cron/invite-statuses/route.ts` mirrors `billing-statuses` auth/response conventions exactly
- [ ] `apps/web/vercel.json` schedules the new route at midnight UTC alongside `billing-statuses`
- [ ] `pnpm check-types` passes
- [ ] `respondToInvite`'s lazy check is unchanged and still functions as a safety net
- [ ] Manual curl validation (Level 6) confirms both success and 401 paths

---

## Completion Checklist

- [ ] All 5 tasks completed in order
- [ ] Level 1: `pnpm check-types` passes
- [ ] Level 4: Database validation passes (column, backfill, regenerated types)
- [ ] Level 6: Manual curl validation passes (200 with counts, 401 without secret, correct row-level behavior)
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Backfill `CASE` ordering bug marks a used-but-expired invite as `'expirado'` instead of `'usado'` | LOW | MEDIUM | `used_at IS NOT NULL` checked first in the `CASE`, before `expires_at` — explicit task note (Task 1) and edge case test |
| Midnight UTC vs. intended local timezone mismatch | LOW | LOW | Matches existing `billing-statuses` convention (UTC-scheduled); flagged as a GOTCHA in Task 4 for user confirmation if business-hour precision ever matters |
| New cron route silently never fires because `vercel.json` entry is malformed | LOW | MEDIUM | Level 6 manual curl test validates the route directly; JSON validity checked in Task 4 |
| `patient_invite_links` reads elsewhere in the codebase use `select("*")` and don't expect a new `status` field, causing unexpected downstream typing issues | LOW | LOW | `pnpm check-types` (Level 1) will surface any type mismatches immediately since the column is additive, not breaking |

---

## Notes

- This phase intentionally does not touch any listing/query code (PRD Phase 2) or the `team_invites` resend action (PRD Phase 3) — it only makes `status` a reliable, stored field on both tables so later phases can query it directly instead of re-deriving it.
- The enum-vs-text open question from the PRD is resolved here: plain `text`, matching `team_invites.status` and the codebase's dominant status-column convention (`installments.status`, `billings.status`).
- `used_at`-derived `'usado'` is a new status value not present in `team_invites`' vocabulary (`pendente/aceito/rejeitado/expirado`) — this is expected, since `patient_invite_links` has no accept/reject flow, only "used" (self-registration completed) vs. "pending" vs. "expired".
