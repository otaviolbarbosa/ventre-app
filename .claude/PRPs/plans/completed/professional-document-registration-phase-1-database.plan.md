# Feature: Registro de Documentos Profissionais — Phase 1: Database

## Summary

Add a nullable `professional_documents jsonb` column to the `users` table via a Supabase migration, then regenerate `database.types.ts` so `Tables<"users">["professional_documents"]` is available to the rest of the codebase. This is a pure schema change — no app code, no forms, no actions. It unblocks Phase 2 (shared form fields + action) of the parent PRD.

## User Story

As a platform engineer
I want a `professional_documents` column on `users`, typed and available in generated TS types
So that Phase 2 can build the shared Zod schema + persistence action on top of a real, typed column

## Problem Statement

`users` currently has no place to store CRM/RQE/COREN/CREFITO registration numbers for `obstetra`/`enfermeiro`/`fisio` professionals. Nothing downstream (forms, actions, banner) can be built until this column exists and is reflected in `database.types.ts`.

## Solution Statement

Add one migration file that does `ALTER TABLE public.users ADD COLUMN professional_documents jsonb;` (nullable, no default, no CHECK constraint — matches this codebase's existing jsonb precedent of leaving shape validation to app-level Zod). Run `pnpm db:push` then `pnpm db:types` to sync. No RLS policy changes needed — existing row-level policies on `users` already cover all columns.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY (schema only)                       |
| Complexity       | LOW                                                 |
| Systems Affected | `packages/supabase` (migrations, generated types)   |
| Dependencies     | Supabase CLI `^2.72.8` (already in repo)            |
| Estimated Tasks  | 3                                                   |

---

## UX Design

Not applicable — this phase has no user-facing surface. UX changes belong to Phases 3 (onboarding) and 4 (banner + modal).

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 195-207 | Current `users` table definition — the column is added here |
| P0 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 48-54, 304-328 | `professional_type` enum + all 4 existing RLS policies on `users` — confirms no new policy needed |
| P1 | `packages/supabase/supabase/migrations/20260530000001_add_fisioterapeuta_professional_type.sql` | all | Pattern for a small, single-purpose `ALTER` migration on this exact table's enum |
| P1 | `packages/supabase/supabase/migrations/20260501000001_activity_logs.sql` | 9 | Precedent for declaring a bare nullable/defaulted jsonb column with no CHECK constraint |
| P2 | `packages/supabase/package.json` | 10-16 | Exact `db:push` / `db:types` command bodies |
| P2 | `packages/supabase/scripts/with-env.cjs` | 1-10 | How `db:types` resolves `NEXT_PUBLIC_SUPABASE_PROJECCT_ID` from `apps/web/.env.local` |

**External Documentation:** none needed — this is a standard `ALTER TABLE ADD COLUMN` on Postgres/Supabase, no new library or API involved.

---

## Patterns to Mirror

**MIGRATION_FILE_NAMING:**
```
// SOURCE: packages/supabase/supabase/migrations/ (ls, most recent entries)
// Format: YYYYMMDD + 6-digit sequence counter (NOT a real HHMMSS timestamp)
20260708000001_contracts_add_city_state.sql
20260706000001_contract_signature.sql
20260701000002_contracts_add_is_active.sql
```
Today's date is 2026-07-13 and no migration with that date prefix exists yet, so the new file uses counter `000001`:
```
20260713000001_add_professional_documents_column.sql
```

**BARE_NULLABLE_JSONB_COLUMN (no CHECK constraint, no default — column is optional/nullable by design per PRD):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260530000001_add_fisioterapeuta_professional_type.sql
-- COPY THIS STYLE (single-purpose ALTER, no surrounding noise):
ALTER TYPE "public"."professional_type" ADD VALUE IF NOT EXISTS 'fisio';
```
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260501000001_activity_logs.sql:9 (jsonb declaration style)
-- metadata jsonb NOT NULL DEFAULT '{}'::jsonb   <- this precedent uses NOT NULL + default
-- Our column is intentionally nullable with NO default (PRD: "Coluna nullable — null significa 'não preenchido'")
```

**MIGRATION TO WRITE:**
```sql
-- packages/supabase/supabase/migrations/20260713000001_add_professional_documents_column.sql
ALTER TABLE "public"."users"
  ADD COLUMN "professional_documents" "jsonb";
```
No `DEFAULT`, no `NOT NULL`, no `CHECK` — matches PRD's explicit nullable/no-validation requirement and the "Won't Building" scope item (no external validation, app-level Zod only, deferred to Phase 2).

**RLS — NO CHANGE NEEDED:**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260126012100_remote_schema.sql:304-328
-- These 4 policies are row-level (auth.uid() = id / user_type check), not column-scoped.
-- Adding a column requires ZERO new policy statements.
CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));
CREATE POLICY "Users can view own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "id"));
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `packages/supabase/supabase/migrations/20260713000001_add_professional_documents_column.sql` | CREATE | New migration adding the nullable jsonb column |
| `packages/supabase/src/types/database.types.ts` | UPDATE (generated) | Regenerated by `pnpm db:types` — must NOT be hand-edited |

---

## NOT Building (Scope Limits)

- No TS `ProfessionalDocuments` interface, no Zod schema — that's Phase 2 (`Shared form fields`). This phase only makes the raw `Json | null` column exist and appear in generated types.
- No CHECK constraint enforcing the `{ crm?, crefito?, coren?, rqe? }` shape at the DB level — codebase precedent (confirmed via grep, zero hits for `jsonb_typeof`/`jsonb_matches_schema`/`CHECK...jsonb` across all migrations) is to validate jsonb shape purely at the app layer (Zod), not in Postgres.
- No RLS policy changes — existing row-level policies on `users` already cover the new column for both SELECT and UPDATE.
- No backfill — per PRD Decisions Log, existing professionals simply have `professional_documents = NULL` until they fill it in via banner/onboarding.
- No column-level read restriction for the "Professionals can view other professionals" SELECT policy (which would let any professional read another's `professional_documents`, same as it already exposes `phone`/`name` today) — that's a pre-existing repo-wide pattern (row-level, not column-level, RLS), out of scope to change here and not requested by the PRD.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: CREATE `packages/supabase/supabase/migrations/20260713000001_add_professional_documents_column.sql`

- **ACTION**: CREATE new migration file
- **IMPLEMENT**:
  ```sql
  ALTER TABLE "public"."users"
    ADD COLUMN "professional_documents" "jsonb";
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260530000001_add_fisioterapeuta_professional_type.sql` — single-statement, no-comment ALTER migration style
- **GOTCHA**: Do not add `NOT NULL` or a `DEFAULT` — PRD explicitly requires nullable = "not filled in" semantics. Do not add a CHECK constraint — no precedent in this codebase for jsonb shape validation at the DB level; shape validation belongs to Phase 2's Zod schema.
- **VALIDATE**: `cat packages/supabase/supabase/migrations/20260713000001_add_professional_documents_column.sql` — confirm exact SQL, no typos in column/table names (must be `professional_documents`, not `professional_document`)

### Task 2: Apply migration to the linked Supabase project

- **ACTION**: RUN `pnpm db:push`
- **IMPLEMENT**: Applies all pending local migrations (including the new file) to whatever project is linked in the local Supabase CLI state
- **MIRROR**: `packages/supabase/package.json:11` — `"db:push": "supabase db push"`
- **GOTCHA**: This targets the CLI-linked remote project, not a purely local stack — confirm with the user which project is linked before running if there's any ambiguity (staging vs production), since `db:push` has no explicit `--project-id` flag guarding against the wrong target.
- **VALIDATE**: Command exits 0 with output showing the new migration applied (e.g. `Applying migration 20260713000001_add_professional_documents_column.sql...`)

### Task 3: Regenerate TypeScript types

- **ACTION**: RUN `pnpm db:types`
- **IMPLEMENT**: Regenerates `packages/supabase/src/types/database.types.ts` from the live schema
- **MIRROR**: `packages/supabase/package.json:14` — `"db:types": "node scripts/with-env.cjs supabase gen types typescript --project-id $NEXT_PUBLIC_SUPABASE_PROJECCT_ID > ./src/types/database.types.ts"`
- **GOTCHA**: Requires `NEXT_PUBLIC_SUPABASE_PROJECCT_ID` in `apps/web/.env.local` (loaded via `packages/supabase/scripts/with-env.cjs:5`) — if that file/var is missing, the command fails with an empty `--project-id`.
- **VALIDATE**: `grep -n "professional_documents" packages/supabase/src/types/database.types.ts` — should show it typed as `Json | null` in the `users` table's `Row`/`Insert`/`Update` shapes (three occurrences)

---

## Testing Strategy

### Unit Tests to Write

None — this is a schema-only migration with no application logic to unit test.

### Edge Cases Checklist

- [ ] Column is nullable (no `NOT NULL`) — verify via `\d users` in `psql` or the generated type showing `professional_documents: Json | null` (not just `Json`)
- [ ] No default value applied — new rows get `NULL`, not `'{}'`
- [ ] Existing rows in `users` get `NULL` for the new column (implicit with `ADD COLUMN` + no default, no backfill needed per PRD)
- [ ] `pnpm check-types` across the monorepo still passes after regenerating types (confirms no other code broke from the additive column)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0 — the additive `Json | null` column should not break any existing `Tables<"users">` consumer (all current usage sites either widen with `&`, narrow with `Pick`/index access, or pass the object through — see Mandatory Reading).

### Level 4: DATABASE_VALIDATION

Use Supabase MCP (or `psql`) to verify:
- [ ] `professional_documents` column exists on `public.users`, type `jsonb`, nullable
- [ ] No new RLS policies were created and none of the 4 existing policies on `users` were modified
- [ ] `grep -n "professional_documents" packages/supabase/src/types/database.types.ts` shows it in `users["Row"]`, `["Insert"]`, `["Update"]`

### Level 6: MANUAL_VALIDATION

1. `pnpm db:push` completes without error
2. `pnpm db:types` completes without error and the diff to `database.types.ts` only adds `professional_documents: Json | null` in the three `users` shapes (Row/Insert/Update) — no unrelated diff
3. `pnpm check-types` passes

---

## Acceptance Criteria

- [ ] Migration file `20260713000001_add_professional_documents_column.sql` exists and contains exactly the single `ALTER TABLE` statement
- [ ] `pnpm db:push` applied successfully
- [ ] `pnpm db:types` regenerated `database.types.ts` with `professional_documents: Json | null` present in `users` Row/Insert/Update
- [ ] `pnpm check-types` passes with no new errors
- [ ] No RLS policy files changed
- [ ] No backfill performed (existing rows remain `NULL`)

---

## Completion Checklist

- [ ] Task 1 completed and validated
- [ ] Task 2 completed and validated
- [ ] Task 3 completed and validated
- [ ] Level 1: `pnpm check-types` passes
- [ ] Level 4: Database validation passes (column exists, correctly typed, nullable, no policy changes)
- [ ] Level 6: Manual validation steps confirmed
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `db:push` targets the wrong linked Supabase project (staging vs prod) | L | HIGH | Confirm linked project before running; `db:push`/`db:pull` have no explicit `--project-id` guard in this repo's scripts, unlike `db:types`/`db:functions:deploy` |
| `professional_documents` read cross-professional via the existing "Professionals can view other professionals" SELECT policy | M | LOW | Pre-existing repo-wide pattern (row-level RLS already exposes `phone`, `name`, etc. the same way) — explicitly out of scope for this PRD/phase, not a regression introduced here |
| Missing `NEXT_PUBLIC_SUPABASE_PROJECCT_ID` in `apps/web/.env.local` breaks `db:types` | L | LOW | Command fails loudly with an empty `--project-id`; easy to diagnose, no silent failure |

---

## Notes

- The PRD's Research Summary mentions `20260626000001_patients_address_jsonb.sql` as jsonb precedent, but that migration actually does the **opposite** — it normalizes `patients` address fields OUT of the table into a separate `addresses` table, with no jsonb column anywhere in it. The real jsonb precedents in this codebase are `20260209000000_push_notifications.sql` (`device_info`, `data`, `payload` — all `jsonb DEFAULT '{}'`) and `20260501000001_activity_logs.sql` (`metadata jsonb NOT NULL DEFAULT '{}'::jsonb`) and `20260319000001_billings_splitted_billing.sql` (`splitted_billing jsonb NOT NULL DEFAULT '{}'` with CHECK constraints on key counts). None of these match our case exactly since ours is nullable with no default — this is intentional per the PRD ("Coluna nullable — null significa 'não preenchido'"), not an oversight.
- Phase 2 will introduce the hand-written `ProfessionalDocuments` TS type (mirroring the existing `PatientAddress` pattern at `apps/web/src/types/index.ts:36-58`, which layers a manual interface over a generated `Json` column) and the Zod schema — intentionally not part of this phase.
