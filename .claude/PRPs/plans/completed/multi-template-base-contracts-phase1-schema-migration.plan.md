# Feature: Multi-Template Base Contracts — Phase 1: Schema + Migration

## Summary

Add a nullable `name` column to `public.contracts` so each base-contract template can be labeled and distinguished from other templates owned by the same professional/enterprise. This is the foundational, non-breaking schema change that later phases (server actions, UI) build on. No application code changes in this phase — only migration + regenerated types.

## User Story

As a manager or autonomous professional
I want each base contract template I save to have a name
So that I can later tell multiple templates apart in a selector, instead of being limited to one unnamed template per owner

## Problem Statement

`contracts` today has no column to label a base-contract template. `title` exists but is used only as the printed heading on the generated contract document, not as a template identifier — reusing it would conflate document display text with template naming. Without a dedicated `name` column, there is no place to persist a human-readable label per template row.

## Solution Statement

Add `name text NULL` to `public.contracts` via an incremental migration (matching the existing pattern of small, additive migrations already used for this table: `..._contracts_add_title.sql`, `..._contracts_add_city_state.sql`, etc.). Run `pnpm db:push` to apply it to Supabase, then `pnpm db:types` to regenerate `database.types.ts` so the new field is available to TypeScript consumers in later phases.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT (schema)                                                  |
| Complexity       | LOW                                                                    |
| Systems Affected | `packages/supabase` (migrations, generated types)                     |
| Dependencies     | Supabase CLI (project-local, via `pnpm db:push`/`db:types`)            |
| Estimated Tasks  | 2                                                                      |

---

## UX Design

No user-facing change in this phase — purely a schema addition. Existing rows get `name = NULL`; nothing currently reads or writes this column, so no runtime behavior changes.

### Before State
```
contracts table: id, user_id, enterprise_id, patient_id, pregnancy_id,
                 is_base_contract, clauses_html, title, city, state,
                 is_active, is_signed, signed_*, parties_details, ...
                 (no `name` column — templates cannot be labeled)
```

### After State
```
contracts table: ...same columns... + name text NULL
                 (column exists, unused by app code until Phase 2/3/4 read/write it)
```

### Interaction Changes

None — this phase has no UI or action changes. Table only.

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `packages/supabase/supabase/migrations/20260630000001_contracts_add_title.sql` | 1-2 | Exact pattern to MIRROR: single `ALTER TABLE ... ADD COLUMN` migration for this same table |
| P1 | `packages/supabase/supabase/migrations/20260708000001_contracts_add_city_state.sql` | 1-5 | Pattern for adding a NULLable column (no default) with an explanatory comment |
| P1 | `packages/supabase/supabase/migrations/20260627000001_contracts.sql` | 1-36 | Full table definition — confirms no unique/cardinality constraint exists per owner (per PRD's stated feasibility), and where `name` fits alongside `title` |
| P2 | `packages/supabase/src/types/database.types.ts` | 315-338 | Current generated `Row`/`Insert` shape for `contracts` — used to verify `db:types` output after migration |
| P2 | `CLAUDE.md` (repo root) | 5-17 | Confirms `pnpm db:push` / `pnpm db:types` commands and the rule "after writing migrations, always run `pnpm db:types`" |

**External Documentation:** None required — this is a local Postgres/Supabase CLI schema change with no new library usage.

---

## Patterns to Mirror

**MIGRATION_FILE_NAMING:**
```
# SOURCE: packages/supabase/supabase/migrations/ (directory listing)
# Pattern: YYYYMMDDNNNNNN_description.sql, incrementing NNNNNN per same-day migration
# Most recent contracts migration: 20260708000001_contracts_add_city_state.sql
# Most recent migration overall: 20260713000001_add_professional_documents_column.sql
# Today's date (per session context): 2026-07-14 → use 20260714000001_contracts_add_name.sql
```

**NULLABLE_COLUMN_ADD (no default, with comment):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260708000001_contracts_add_city_state.sql:1-5
-- COPY THIS PATTERN:
-- Stores the contract's locality (city/state), used to compose the
-- "Cidade/UF, DD de mês de AAAA." line on the signature block.
ALTER TABLE public.contracts
  ADD COLUMN city text,
  ADD COLUMN state text;
```

**SINGLE NOT-NULL-WITH-DEFAULT ADD (for contrast — NOT used here since `name` must be nullable):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260630000001_contracts_add_title.sql:1-2
ALTER TABLE public.contracts
  ADD COLUMN title text NOT NULL DEFAULT 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS';
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `packages/supabase/supabase/migrations/20260714000001_contracts_add_name.sql` | CREATE | New incremental migration adding nullable `name` column to `contracts`, per PRD Phase 1 scope |
| `packages/supabase/src/types/database.types.ts` | UPDATE (generated) | Regenerated automatically by `pnpm db:types` after push — must reflect new `name` field in `contracts` Row/Insert/Update types |

---

## NOT Building (Scope Limits)

- No backfill of `name` for existing rows — legacy templates stay `NULL`; Phase 3/4 UI is responsible for falling back to `title` in labels (per PRD risk table), not this phase.
- No NOT NULL constraint or default value on `name` — column must stay nullable per PRD ("Nova coluna `name` (nullable)").
- No RLS policy changes — PRD confirms RLS is ownership-based with no cardinality logic, so adding a column requires no policy edits.
- No index on `name` — no query in this phase (or planned in Phase 2) filters/sorts by `name` in a way that requires one; add later if a real query pattern emerges.
- No changes to `save-base-contract-action.ts`, `save-personal-contract-action.ts`, `get-patient-contract-action.ts`, or `services/base-contract.ts` — those are Phase 2 scope.

---

## Step-by-Step Tasks

### Task 1: CREATE `packages/supabase/supabase/migrations/20260714000001_contracts_add_name.sql`

- **ACTION**: CREATE new migration file
- **IMPLEMENT**:
  ```sql
  -- Human-readable label for a base contract template, letting an owner
  -- (professional or enterprise) distinguish between multiple saved templates.
  ALTER TABLE public.contracts
    ADD COLUMN name text;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260708000001_contracts_add_city_state.sql:1-5` — same style: short comment explaining purpose, then a single `ALTER TABLE ... ADD COLUMN` with no default (nullable by omission)
- **GOTCHA**: Do NOT add `NOT NULL` or a `DEFAULT` — PRD explicitly requires `name` to be nullable so existing rows (and any row created without a name) remain valid
- **GOTCHA**: Filename date must not collide with an existing migration; confirm `20260714000001_contracts_add_name.sql` doesn't already exist (latest file as of this plan is `20260713000001_add_professional_documents_column.sql`, so this is safe) — re-check with `ls packages/supabase/supabase/migrations/ | tail -5` immediately before creating, in case other work has landed migrations since this plan was written
- **VALIDATE**: `cat packages/supabase/supabase/migrations/20260714000001_contracts_add_name.sql` — confirm exact SQL matches above, no trailing syntax errors

### Task 2: Apply migration and regenerate types

- **ACTION**: RUN `pnpm db:push` then `pnpm db:types`
- **IMPLEMENT**: No code — these are the project's existing scripts (per root `CLAUDE.md`) that apply pending migrations to the linked Supabase project and regenerate `packages/supabase/src/types/database.types.ts`
- **MIRROR**: `CLAUDE.md:9-11,17` — "After writing migrations, always run `pnpm db:types` to keep `database.types.ts` in sync"
- **GOTCHA**: `pnpm db:push` requires the Supabase CLI to be linked/authenticated to the project already (existing local dev setup) — if it prompts for confirmation of pending migrations, review the diff shown before confirming (it should show only the one `ADD COLUMN name` statement)
- **VALIDATE**: `grep -n "name" packages/supabase/src/types/database.types.ts | grep -A2 -B2 "contracts"` or open the file and confirm the `contracts` `Row`, `Insert`, and `Update` types each now include `name: string | null;` / `name?: string | null;`

---

## Testing Strategy

### Unit Tests to Write

None — this phase has no application logic, only a schema migration. There is nothing to unit test until Phase 2 introduces the create/list/update actions that read/write `name`.

### Edge Cases Checklist

- [ ] Existing `contracts` rows (base and patient contracts) still `SELECT`/`UPDATE` successfully after the migration (column addition is purely additive, non-breaking)
- [ ] New column defaults to `NULL` for all pre-existing rows — confirm via `Level 4` DB check below
- [ ] `database.types.ts` compiles (`pnpm check-types`) with the new optional `name` field present but unused

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0 — no type errors from the regenerated `database.types.ts` (new field is optional/nullable, so no existing code should break)

### Level 2: UNIT_TESTS

N/A — no unit tests apply to this phase (schema-only change).

### Level 3: FULL_SUITE

N/A for this phase — defer to Phase 5's end-to-end validation, which covers the full feature across all phases.

### Level 4: DATABASE_VALIDATION

Use Supabase MCP (`list_tables`, or `execute_sql`) to verify:

- [ ] `contracts` table now has a `name` column of type `text`, nullable
- [ ] No existing rows were mutated beyond the new column appearing as `NULL`
- [ ] No new RLS policies were created/needed (confirm existing 4 policies — View/Create/Update/Delete — are unchanged)

Example check:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'contracts' and column_name = 'name';
-- expect: name | text | YES
```

### Level 5: BROWSER_VALIDATION

N/A — no UI changes in this phase.

### Level 6: MANUAL_VALIDATION

1. After `pnpm db:push`, open Supabase Studio (or run the Level 4 SQL above) and confirm the `contracts` table shows the new `name` column.
2. Run `pnpm db:types` and diff `packages/supabase/src/types/database.types.ts` to confirm only the expected `name` field was added to the `contracts` table types (no unrelated regenerated diffs from other in-flight schema changes).
3. Run `pnpm check-types` across the monorepo to confirm no downstream break.

---

## Acceptance Criteria

- [ ] Migration file `20260714000001_contracts_add_name.sql` exists, adds nullable `name text` to `public.contracts`, no default/NOT NULL
- [ ] `pnpm db:push` applied successfully with no errors
- [ ] `pnpm db:types` regenerated `database.types.ts` reflecting `name: string | null` on `contracts` Row/Insert/Update
- [ ] `pnpm check-types` passes
- [ ] No RLS policy changes made or needed
- [ ] No existing contract rows or functionality affected (additive-only change)

---

## Completion Checklist

- [ ] Task 1 completed and validated
- [ ] Task 2 completed and validated
- [ ] Level 1: `pnpm check-types` passes
- [ ] Level 4: DB validation confirms column exists as nullable text with no other side effects
- [ ] All acceptance criteria met
- [ ] PRD's Phase 1 row updated: Status → `complete`, PRP Plan column linked to this file

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration filename collides with another migration landed concurrently on a different branch | Low | Low | Re-check `ls packages/supabase/supabase/migrations/ | tail -5` immediately before creating the file; bump the date/sequence if needed |
| `pnpm db:push` applies against the wrong (e.g. production) linked Supabase project | Low | High | Confirm `supabase status`/linked project before running `db:push`, per existing team workflow; this is an existing risk for all migrations, not new to this phase |
| Legacy rows show blank `name` once Phase 3/4 UI reads it | Certain (per PRD) | Low (accepted) | Explicitly deferred to Phase 3/4: UI must fall back to `title` when `name` is `NULL` — out of scope for this schema-only phase, but flagged here so it isn't forgotten |

---

## Notes

This phase intentionally has no application-code tasks. The PRD's technical feasibility note confirms there is no database constraint blocking multiple `is_base_contract = true` rows per owner today — the "single template" restriction is purely in application logic (`save-base-contract-action.ts` / `save-personal-contract-action.ts`), which Phase 2 will address. Keeping this phase to "just the column" minimizes risk and unblocks Phase 2 and 3/4 (which can run in parallel per the PRD's parallelism note) as early as possible.
