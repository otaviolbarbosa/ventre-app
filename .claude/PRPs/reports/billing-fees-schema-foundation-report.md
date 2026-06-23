# Implementation Report

**Plan**: `.claude/PRPs/plans/billing-fees-schema-foundation.plan.md`
**Branch**: `feature/billing-fees-schema-foundation`
**Date**: 2026-06-22
**Status**: COMPLETE

---

## Summary

Created the schema foundation (Phase 1 of 4) for the billing fees/taxes/discounts feature: a new `enterprise_billing_fees` table (enterprise-scoped, manager-only writes, staff reads) and a new `applied_billing_fees jsonb` snapshot column on `billings`. No CRUD, calculation logic, or UI was built — strictly schema, as scoped.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | LOW       | LOW    | Matched — pure DDL migration, no app code changes needed |
| Confidence | High (implied) | High | Migration applied cleanly on first attempt; CHECK constraints and RLS behaved exactly as designed |

**Deviations from plan:**
- The branching strategy in the plan's Phase 2 assumed working from a clean `{base-branch}`. The actual git state had `feat/prenatal-card-improvements` checked out with many unrelated unpushed commits, and the migration directory on `main` lacked the most recent migrations the plan's Mandatory Reading referenced (e.g. `20260619000001_pregnancy_evolutions_created_by.sql`). Branched `feature/billing-fees-schema-foundation` off `feat/prenatal-card-improvements` instead of `main` so the referenced precedent migrations and `created_by` FK pattern were available.
- `pnpm db:types` (root script) failed because `packages/supabase/package.json` does not have a script literally named `types` — only `db:types`. Ran `pnpm --filter @ventre/supabase db:types` directly instead. Root `package.json`'s `db:types` alias (`pnpm --filter @ventre/supabase types`) appears to be a pre-existing bug, out of scope for this plan.
- The generated `database.types.ts` had a stray first line (`◇ injected env (23) from ... [www.dotenvx.com]`) leaking from `dotenvx`'s stdout into the redirected output, which broke `tsc`. Stripped the line manually. Pre-existing script issue (`scripts/with-env.cjs`), unrelated to schema changes — not fixed at the script level since out of scope.

---

## Tasks Completed

| # | Task | File | Status |
| - | ---- | ---- | ------ |
| 1 | CREATE migration (enum, table, indexes, trigger, RLS, grants, ALTER billings) | `packages/supabase/supabase/migrations/20260620000001_enterprise_billing_fees.sql` | ✅ |
| 2 | Regenerate types | `packages/supabase/src/types/database.types.ts` | ✅ |
| 3 | Type-check monorepo | N/A | ✅ |

---

## Validation Results

| Check | Result | Details |
| ----- | ------ | ------- |
| `pnpm db:push` | ✅ | Migration `20260620000001_enterprise_billing_fees.sql` applied to remote Supabase project without errors |
| `pnpm --filter @ventre/supabase db:types` | ✅ | `database.types.ts` regenerated; contains `enterprise_billing_fees` table types and `billings.applied_billing_fees: Json` |
| `pnpm check-types` | ✅ | Exit 0 across all 6 packages (`@ventre/supabase`, `@ventre/ui`, `admin`, `docs`, `web`, `@ventre/typescript-config`) |
| Database validation (Supabase MCP) | ✅ | See Edge Cases below |

### Database Validation Details

- ✅ `enterprise_billing_fees` table created with RLS enabled (`relrowsecurity = true`)
- ✅ `billing_fee_type` enum created with values `fixed`, `percentage`
- ✅ 4 policies present: `Staff can view enterprise billing fees` (SELECT/authenticated), `Managers can create enterprise billing fees` (INSERT/authenticated), `Managers can update enterprise billing fees` (UPDATE/authenticated), `service_role_manage_enterprise_billing_fees` (ALL/service_role)
- ✅ Indexes `idx_enterprise_billing_fees_enterprise_id`, `idx_enterprise_billing_fees_enterprise_active` created
- ✅ Trigger `handle_enterprise_billing_fees_updated_at` created
- ✅ `billings.applied_billing_fees` exists: `jsonb`, `NOT NULL`, default `'[]'::jsonb`
- ✅ All 31 existing `billings` rows retroactively received `applied_billing_fees = '[]'`
- ✅ No new Supabase security advisories introduced by `enterprise_billing_fees` (checked via `get_advisors`)

### Edge Cases Checklist

- [x] `fee_type = 'percentage'`, `value = 0` → CHECK violation (correctly rejected)
- [x] `fee_type = 'percentage'`, `value = 100.001` → CHECK violation (correctly rejected)
- [x] `fee_type = 'fixed'`, `value = 0` → CHECK violation (correctly rejected)
- [x] `fee_type = 'fixed'`, `value = 1500` → inserted successfully, then cleaned up
- [ ] `secretary` blocked from INSERT — not tested live (requires per-user auth context); RLS policy inline condition (`user_type = 'manager'`) is correct by inspection and verified present
- [ ] cross-enterprise manager blocked — not tested live for the same reason; RLS scoping condition verified present by inspection
- [x] existing `billings` rows backfilled with `applied_billing_fees = '[]'` (31/31 confirmed via count query)

---

## Files Changed

| File | Action | Lines |
| ---- | ------ | ----- |
| `packages/supabase/supabase/migrations/20260620000001_enterprise_billing_fees.sql` | CREATE | +101 |
| `packages/supabase/src/types/database.types.ts` | UPDATE (generated) | +56 |

---

## Issues Encountered

- `pnpm db:types` root alias is broken (calls a non-existent `types` script in `packages/supabase`); worked around with `pnpm --filter @ventre/supabase db:types`. Recommend fixing the root script separately.
- `scripts/with-env.cjs` (or the underlying `dotenvx` invocation) leaks a banner line to stdout that gets captured into the generated `database.types.ts`, breaking `tsc`. Stripped manually this run; recommend redirecting that banner to stderr in a follow-up.

---

## Next Steps

- [ ] Review implementation
- [ ] Create PR
- [ ] Merge when approved
- [ ] Continue with Phase 2 (CRUD/actions/UI) per `.claude/PRPs/prds/billing-fees-taxes-discounts.prd.md`
