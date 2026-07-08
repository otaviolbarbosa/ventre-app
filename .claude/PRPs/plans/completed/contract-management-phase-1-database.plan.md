# Feature: Contract Management — Phase 1: Database

## Summary

Create the `contracts` table in Supabase with full RLS policies, an `updated_at` trigger, and regenerate TypeScript types. The table supports both base contracts (`is_base_contract = true`, `patient_id IS NULL`) and patient-specific contracts (`patient_id IS NOT NULL`, `pregnancy_id IS NOT NULL`). RLS mirrors `patient_documents` for patient contracts and mirrors `enterprise_billing_fees` for base contract enterprise access.

## User Story

As a professional/manager using Ventre,
I want a `contracts` table to persist contract data (base templates and patient-specific contracts),
So that subsequent phases can create, read, update, and delete contracts with correct access control.

## Problem Statement

There is no `contracts` table in the database. Without it, no other phase of the contract management feature can proceed. This phase delivers the pure schema foundation with no application code.

## Solution Statement

Write one SQL migration file (`20260627000001_contracts.sql`) at `packages/supabase/supabase/migrations/`. Run `pnpm db:push` to apply it to Supabase. Run `pnpm db:types` to regenerate `packages/supabase/src/types/database.types.ts`. No application code is touched in this phase.

## Metadata

| Field            | Value |
| ---------------- | ----- |
| Type             | NEW_CAPABILITY |
| Complexity       | LOW |
| Systems Affected | Database (Supabase), `packages/supabase/src/types/database.types.ts` |
| Dependencies     | None — Phase 1 has no predecessors |
| Estimated Tasks  | 3 |

---

## UX Design

### Before State

```
╔══════════════════════════════════════════════════════════╗
║                      BEFORE STATE                         ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Supabase DB                                             ║
║  ┌───────────────────────────────────────────────────┐  ║
║  │  patients  │  pregnancies  │  patient_documents    │  ║
║  │  users     │  enterprises  │  team_members         │  ║
║  │  ...       │  ...          │  ...                  │  ║
║  └───────────────────────────────────────────────────┘  ║
║                  ❌ NO contracts table                    ║
║                                                          ║
║  database.types.ts: no contracts types                   ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

### After State

```
╔══════════════════════════════════════════════════════════╗
║                      AFTER STATE                          ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Supabase DB                                             ║
║  ┌───────────────────────────────────────────────────┐  ║
║  │  patients  │  pregnancies  │  patient_documents    │  ║
║  │  users     │  enterprises  │  team_members         │  ║
║  │  ...       │  ...          │  ✅ contracts         │  ║
║  └───────────────────────────────────────────────────┘  ║
║                                                          ║
║  contracts table:                                        ║
║    id, user_id, enterprise_id, patient_id,            ║
║    pregnancy_id, is_base_contract, clauses_html,        ║
║    created_at, updated_at                               ║
║                                                          ║
║  RLS:                                                    ║
║    base contracts → user_id match OR org match          ║
║    patient contracts → is_team_member OR enterprise     ║
║                                                          ║
║  database.types.ts: Tables['contracts']['Row'] typed    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| Supabase DB | No `contracts` table | `contracts` table with RLS | Phases 3–5 can persist contracts |
| `database.types.ts` | No contracts types | `Tables['contracts']['Row/Insert/Update']` | TypeScript-safe contracts access |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before writing the migration:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `packages/supabase/supabase/migrations/20260626000001_patients_address_jsonb.sql` | 1-45 | Most recent table with FULL RLS pattern (SELECT/INSERT/UPDATE/DELETE + GRANT) — MIRROR exactly |
| P0 | `packages/supabase/supabase/migrations/20260620000001_enterprise_billing_fees.sql` | 1-91 | Enterprise-scoped RLS pattern with `users.enterprise_id` check + `updated_at` trigger — MIRROR for base contract enterprise access |
| P1 | `packages/supabase/supabase/migrations/20260206000000_patient_documents.sql` | 1-59 | `patient_documents` DDL — RLS blueprint for patient-scoped contracts |
| P1 | `packages/supabase/supabase/migrations/20260528000002_fix_is_enterprise_patient.sql` | 1-22 | Current `is_enterprise_patient()` definition — must understand the function before using in RLS |
| P2 | `packages/supabase/src/types/database.types.ts` | 759-806 | `patient_documents` type structure — confirm what the generated `contracts` types will look like |
| P2 | `packages/supabase/package.json` | all | Verify exact `db:push` and `db:types` script commands |

---

## Patterns to Mirror

**TABLE_DDL (from `addresses` migration — most recent clean table):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260626000001_patients_address_jsonb.sql:1-17
CREATE TABLE public.addresses (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  street text,
  ...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT addresses_pkey PRIMARY KEY (id)
);
```

**RLS_FULL_PATTERN (SELECT/INSERT/UPDATE/DELETE + GRANT):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260626000001_patients_address_jsonb.sql:19-45
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view addresses"
  ON public.addresses FOR SELECT
  USING (
    public.is_team_member(patient_id)
    OR public.is_enterprise_patient(patient_id)
    OR (SELECT user_id FROM public.patients WHERE id = patient_id) = auth.uid()
  );

CREATE POLICY "Team members can insert addresses"
  ON public.addresses FOR INSERT
  WITH CHECK (
    public.is_team_member(patient_id)
    OR public.is_enterprise_staff()
  );

CREATE POLICY "Team members can update addresses"
  ON public.addresses FOR UPDATE
  USING  (public.is_team_member(patient_id) OR public.is_enterprise_patient(patient_id))
  WITH CHECK (public.is_team_member(patient_id) OR public.is_enterprise_patient(patient_id));

CREATE POLICY "Team members can delete addresses"
  ON public.addresses FOR DELETE
  USING (public.is_team_member(patient_id) OR public.is_enterprise_patient(patient_id));

GRANT ALL ON TABLE public.addresses TO anon, authenticated, service_role;
```

**UPDATED_AT_TRIGGER (from `enterprise_billing_fees` — most recent usage):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260620000001_enterprise_billing_fees.sql:35-38
CREATE TRIGGER handle_enterprise_billing_fees_updated_at
  BEFORE UPDATE ON public.enterprise_billing_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

**ENTERPRISE_SCOPE_RLS (manager/secretary access by org — from `enterprise_billing_fees`):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260620000001_enterprise_billing_fees.sql:42-52
CREATE POLICY "Staff can view enterprise billing fees"
  ON public.enterprise_billing_fees FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );
```

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `packages/supabase/supabase/migrations/20260627000001_contracts.sql` | CREATE | New migration — contracts table DDL + RLS + trigger |
| `packages/supabase/src/types/database.types.ts` | AUTO-UPDATE (via `pnpm db:types`) | Regenerated after migration is applied |

---

## NOT Building (Scope Limits)

- No application code (server actions, screens, components) — that is Phases 3–5
- No TipTap editor component — that is Phase 2
- No PDF export — that is Phase 5
- No `contract_templates` separate table — single `contracts` table with `is_base_contract` flag (Decision Log in PRD)
- No versionamento (audit history) — explicitly excluded from v1
- No digital signature fields — explicitly out of scope

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

---

### Task 1: CREATE `packages/supabase/supabase/migrations/20260627000001_contracts.sql`

- **ACTION**: Write the SQL migration file from scratch
- **IMPLEMENT**: Full DDL for `contracts` table + RLS (4 operations) + `updated_at` trigger + GRANTs
- **MIRROR**: `20260626000001_patients_address_jsonb.sql` for DDL + RLS structure; `20260620000001_enterprise_billing_fees.sql` for enterprise scope pattern + trigger
- **EXACT SQL TO WRITE**:

```sql
-- ============================================================
-- Contracts: stores both base contract templates (is_base_contract = true)
-- and patient-specific contracts (is_base_contract = false).
-- Base contracts have patient_id = NULL and pregnancy_id = NULL.
-- Patient contracts have patient_id and pregnancy_id set.
-- ============================================================

CREATE TABLE public.contracts (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  -- Autonomous professional owner (nullable — set when not org-scoped)
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  -- Enterprise owner (nullable — set when org-scoped base contract)
  enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE CASCADE,
  -- Patient link (null for base contracts, set for patient contracts)
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  -- Pregnancy link (null for base contracts)
  pregnancy_id uuid REFERENCES public.pregnancies(id) ON DELETE SET NULL,
  is_base_contract boolean NOT NULL DEFAULT false,
  -- TipTap HTML output
  clauses_html text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contracts_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_contracts_patient_id ON public.contracts (patient_id);
CREATE INDEX idx_contracts_pregnancy_id ON public.contracts (pregnancy_id);
CREATE INDEX idx_contracts_user_id_base ON public.contracts (user_id) WHERE is_base_contract = true;
CREATE INDEX idx_contracts_org_id_base ON public.contracts (enterprise_id) WHERE is_base_contract = true;

CREATE TRIGGER handle_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- SELECT: base contracts (own user or org) OR patient contracts (team member or enterprise)
CREATE POLICY "View contracts"
  ON public.contracts FOR SELECT
  USING (
    -- Base contract: own professional
    (is_base_contract = true AND user_id = auth.uid())
    -- Base contract: enterprise manager/secretary
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    -- Patient contract: team member or enterprise patient access
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );

-- INSERT: same gates as SELECT
CREATE POLICY "Create contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );

-- UPDATE
CREATE POLICY "Update contracts"
  ON public.contracts FOR UPDATE
  USING (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  )
  WITH CHECK (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );

-- DELETE
CREATE POLICY "Delete contracts"
  ON public.contracts FOR DELETE
  USING (
    (is_base_contract = true AND user_id = auth.uid())
    OR (is_base_contract = true AND enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NOT NULL AND (
      public.is_team_member(patient_id)
      OR public.is_enterprise_patient(patient_id)
    ))
  );

GRANT ALL ON TABLE public.contracts TO anon, authenticated, service_role;
```

- **GOTCHA 1**: UUID default must be `extensions.uuid_generate_v4()`, NOT `gen_random_uuid()` — see every existing table in the codebase
- **GOTCHA 2**: `enterprise_id` references `enterprises` (not `organizations`) — verify the table name in `database.types.ts`
- **GOTCHA 3**: `pregnancy_id` uses `ON DELETE SET NULL` (not CASCADE) — a deleted pregnancy should not cascade-delete the contract
- **GOTCHA 4**: `clauses_html` defaults to `''` so INSERT without it doesn't fail — Phase 3 will always supply it
- **GOTCHA 5**: The `handle_updated_at()` function already exists in the DB — do NOT redefine it, just create the trigger
- **GOTCHA 6**: `ENABLE ROW LEVEL SECURITY` must come **before** the first `CREATE POLICY` — see all existing migrations
- **VALIDATE**: File must be syntactically valid SQL — review before running db:push

---

### Task 2: Apply migration to Supabase

- **ACTION**: Run db:push from repo root
- **COMMAND**:
```bash
pnpm db:push
```
- **EXPECT**: Output confirms migration `20260627000001_contracts.sql` applied; no errors
- **GOTCHA**: If Supabase CLI is not authenticated, run `supabase login` first or use `SUPABASE_ACCESS_TOKEN` env var
- **IF ERROR**: Check for FK mismatches (e.g., `enterprises` vs actual table name). Fix the migration file and re-run. Do NOT run `db:push` twice for the same migration — it will be a no-op if already applied, but verify output.
- **VALIDATE**: 
```bash
pnpm db:push
# Expect: "Applying migration 20260627000001_contracts.sql... Done"
# Or: "Remote is already up to date" if it was already applied
```

---

### Task 3: Regenerate TypeScript types

- **ACTION**: Run db:types to regenerate `database.types.ts`
- **COMMAND**:
```bash
pnpm db:types
```
- **EXPECT**: `packages/supabase/src/types/database.types.ts` is updated with `contracts` table types
- **VALIDATE** (check the generated file contains):
```typescript
// These should appear in database.types.ts after running pnpm db:types:
// Tables['contracts']['Row'] should have:
//   id: string
//   user_id: string | null
//   enterprise_id: string | null
//   patient_id: string | null
//   pregnancy_id: string | null
//   is_base_contract: boolean
//   clauses_html: string
//   created_at: string
//   updated_at: string
```
```bash
grep -A 20 '"contracts"' packages/supabase/src/types/database.types.ts
# Should return the Row/Insert/Update/Relationships block
```
- **FINAL TYPE CHECK**:
```bash
pnpm check-types
# Expect: exit 0, no TypeScript errors
```

---

## Testing Strategy

### Edge Cases Checklist

- [ ] Base contract with `user_id` set (autonomous professional) — can only be read/written by that user
- [ ] Base contract with `enterprise_id` set — readable by managers/secretaries of that enterprise
- [ ] Base contract with both `user_id` and `enterprise_id` NULL — should never happen; no policy covers this (effectively inaccessible, which is correct)
- [ ] Patient contract with `patient_id` set — accessible to team members and enterprise staff
- [ ] `pregnancy_id` ON DELETE SET NULL — deleting a pregnancy does not delete the contract
- [ ] `patient_id` ON DELETE CASCADE — deleting a patient deletes all their contracts (desired)

### Validation Levels

#### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
```
**EXPECT**: Exit 0

#### Level 4: DATABASE_VALIDATION

Use Supabase MCP (`mcp__supabase__execute_sql`) or the Supabase Dashboard to verify:

```sql
-- Verify table exists with correct columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'contracts'
ORDER BY ordinal_position;
```

Expected columns: `id`, `user_id`, `enterprise_id`, `patient_id`, `pregnancy_id`, `is_base_contract`, `clauses_html`, `created_at`, `updated_at`

```sql
-- Verify RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'contracts' AND relkind = 'r';
-- Expect: relrowsecurity = true
```

```sql
-- Verify policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'contracts';
-- Expect: 4 rows — "View contracts", "Create contracts", "Update contracts", "Delete contracts"
```

```sql
-- Verify trigger exists
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'contracts';
-- Expect: handle_contracts_updated_at
```

```sql
-- Verify indexes exist
SELECT indexname FROM pg_indexes WHERE tablename = 'contracts';
-- Expect: contracts_pkey, idx_contracts_patient_id, idx_contracts_pregnancy_id,
--         idx_contracts_user_id_base, idx_contracts_org_id_base
```

---

## Acceptance Criteria

- [ ] `contracts` table exists in Supabase with all 9 columns
- [ ] RLS enabled with 4 policies (View/Create/Update/Delete)
- [ ] `handle_contracts_updated_at` trigger exists
- [ ] `pnpm db:types` regenerates successfully with `contracts` in `database.types.ts`
- [ ] `pnpm check-types` exits 0

---

## Completion Checklist

- [ ] Task 1 complete: migration file written at `packages/supabase/supabase/migrations/20260627000001_contracts.sql`
- [ ] Task 2 complete: `pnpm db:push` applied successfully
- [ ] Task 3 complete: `pnpm db:types` regenerated, `contracts` appears in types
- [ ] Level 1 validation passes (`pnpm check-types`)
- [ ] Level 4 validation passes (all SQL checks confirm table/RLS/trigger/indexes)
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `enterprises` table not found (wrong name) | LOW | HIGH | Verify in `database.types.ts` before writing migration — search for `"enterprises"` in types file |
| `handle_updated_at()` function not found in DB | LOW | MEDIUM | The function is defined in migration `20260126012100_remote_schema.sql` — it exists; if DB was reset and not replayed, run `pnpm db:push` from scratch |
| `is_enterprise_patient` / `is_team_member` functions missing | LOW | HIGH | Both are defined in existing migrations already applied to remote DB; `pnpm db:push` only applies new migrations |
| RLS policy blocks intended access | MEDIUM | HIGH | Use Supabase Dashboard "SQL Editor" to test policies with `set role authenticated; set request.jwt.claims...` before finalizing |
| `enterprise_id` RLS subquery uses `users.enterprise_id` which may be NULL for some managers | MEDIUM | MEDIUM | The `AND enterprise_id IS NOT NULL` guard in the subquery prevents this; policy simply returns false for those users |

---

## Notes

**Design decision — single table with `is_base_contract` flag**: The PRD explicitly chose this over a separate `contract_templates` table to simplify RLS and queries. The RLS must therefore distinguish between the two modes in every policy.

**`clauses_html DEFAULT ''`**: Allows future server actions to INSERT a contract row first (to get the ID) and then UPDATE `clauses_html` in a two-step flow. Not required by Phase 3 but avoids NOT NULL constraint failures during development.

**`pregnancy_id ON DELETE SET NULL`**: A pregnancy being archived/deleted should not destroy the signed contract. The contract becomes "orphaned" from its pregnancy but remains accessible via `patient_id`.

**Indexes**: The partial indexes (`WHERE is_base_contract = true`) are small but important — they make "get the base contract for this user/org" O(1) instead of a full table scan.

**Next phase**: Phase 2 (RichEditor) can run **in parallel** with this phase — it has no database dependency. Once both Phase 1 and Phase 2 are complete, Phase 3 (Settings Contract) can begin.
