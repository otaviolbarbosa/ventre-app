# Feature: Invites Listing Queries (Phase 2 of Invites Management Screen)

## Summary

Add read-side query functions to `apps/web/src/services/invite.ts` that give the upcoming Tabs UI (Phase 4) everything it needs to show **Enviados** (sent) and **Recebidos** (received) invites, each split into an `active` bucket and an `inactive` bucket (expired/rejected/accepted/used). Three new functions cover the three listings the PRD needs: received team invites (extends today's `getMyInvites`), sent team invites (`team_invites.invited_by`), and sent patient invites (`patient_invite_links.created_by`). All three reuse Phase 1's `status` column (already backfilled and kept current by the `invite-statuses` cron) instead of computing expiration lazily, while still treating "not active" defensively (`status !== 'pendente' OR expires_at <= now()`) as a safety net for the race window between cron runs.

## User Story

As a profissional do parto
I want to see every invite I've sent or received — active and inactive — in one place
So that I know whether to wait, act, or resend, without digging through modals or asking support

## Problem Statement

Today only `getMyInvites()` exists, and it returns exclusively **active** received `team_invites` (`status = 'pendente' AND expires_at > now()`). There is no query anywhere in the codebase that lists: (a) received invites that are expired/rejected, (b) any sent `team_invites`, or (c) any sent `patient_invite_links`. The Phase 4 UI cannot be built until these three reads exist.

## Solution Statement

Add three new exported functions to `apps/web/src/services/invite.ts`, following the exact shape/style of the existing `getMyInvites`/`getInviteById` functions (`{ data?, error? }` result objects, `Tables<...>`-based joins, Server Component consumption — no `next-safe-action` action needed since these are reads called directly from a Server Component, matching the current `app/(dashboard)/invites/page.tsx` → `getMyInvites()` → props pattern). Each function fetches all rows scoped to the current user via a single RLS-safe equality filter (`invited_professional_id`, `invited_by`, or `created_by` — never a two-column `.or()`, since sent/received are always single-owner-column queries), orders by `created_at desc`, and partitions the result in JS into `active`/`inactive` using one shared predicate. Two new types (`SentTeamInvite`, `SentPatientInvite`) are added to `apps/web/src/types/index.ts`, and the existing `Invite` type gains a `status` field so the UI can badge/label rows within the `inactive` bucket.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY                                     |
| Complexity       | LOW                                                 |
| Systems Affected | `apps/web/src/services/invite.ts`, `apps/web/src/types/index.ts` |
| Dependencies     | `@supabase/supabase-js` 2.47.0, `@supabase/ssr` 0.5.2 (no new deps) |
| Estimated Tasks  | 4                                                    |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║   ┌─────────────┐      ┌───────────────────┐      ┌─────────────────┐     ║
║   │ /invites    │ ───► │ getMyInvites()      │ ───► │ InvitesScreen    │    ║
║   │ page.tsx    │      │ (services/invite.ts)│      │ (active received │    ║
║   └─────────────┘      └───────────────────┘      │  team_invites)   │     ║
║                                                       └─────────────────┘     ║
║                                                                             ║
║   USER_FLOW: professional opens /invites, sees only pending received      ║
║              team invites; accept/reject removes them from the list.      ║
║   PAIN_POINT: no query exists for sent invites (either table), and        ║
║               expired/rejected received invites vanish with no trace.     ║
║   DATA_FLOW: patients/inviter joined via supabaseAdmin (RLS bypass        ║
║              needed because recipient isn't a team member yet).           ║
║                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║   ┌─────────────┐   ┌─────────────────────────┐                            ║
║   │ /invites    │──►│ getReceivedInvites()      │──► { active, inactive }  ║
║   │ page.tsx    │   │ (team_invites, recipient) │                          ║
║   │ (future     │   └─────────────────────────┘                            ║
║   │  Phase 4)   │   ┌─────────────────────────┐                            ║
║   │             │──►│ getSentTeamInvites()       │──► { active, inactive } ║
║   │             │   │ (team_invites, sender)     │                          ║
║   │             │   └─────────────────────────┘                            ║
║   │             │   ┌─────────────────────────┐                            ║
║   │             │──►│ getSentPatientInvites()    │──► { active, inactive } ║
║   │             │   │ (patient_invite_links)     │                          ║
║   │             │   └─────────────────────────┘                            ║
║                                                                             ║
║   USER_FLOW: (data layer only — Phase 4 wires this into Tabs) three        ║
║              typed, RLS-safe reads are available for any Server            ║
║              Component to consume, each pre-split into active/inactive.   ║
║   VALUE_ADD: Phase 4 can render "Enviados" (2 sections) and "Recebidos"    ║
║              (with an expired/rejected list) without writing any query    ║
║              logic of its own.                                            ║
║   DATA_FLOW: sent listings use the plain (RLS-respecting) client — the    ║
║              sender is always a team member or link-existing invite       ║
║              creator, so `is_team_member`/`created_by = auth.uid()`       ║
║              already grants the needed `patients` join. Received listing  ║
║              keeps using supabaseAdmin, as today.                         ║
║                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `apps/web/src/services/invite.ts` | Only `getMyInvites()` (active received) | + `getReceivedInvites()`, `getSentTeamInvites()`, `getSentPatientInvites()` | Data now exists for Phase 4 to build on — no visible UI change yet |
| `apps/web/src/types/index.ts` | `Invite` has no `status` field | `Invite.status: string`; new `SentTeamInvite`, `SentPatientInvite` types | Enables Phase 4 to badge/filter by status |

This phase ships no UI changes — `app/(dashboard)/invites/page.tsx` and `invites-screen.tsx` are left untouched (Phase 4's job). `getMyInvites` is **not** removed or modified, to avoid breaking the current screen mid-migration.

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/services/invite.ts` | 1-94 | Exact pattern to MIRROR: `SupabaseClient`/`SupabaseAdminClient` type aliases, `Get*Result` return-object convention, named-FK join syntax |
| P0 | `apps/web/src/services/invite.ts` | 132-153 | The expiration double-check pattern (`respondToInvite`) — the `active`/`inactive` predicate in this plan must stay consistent with this logic |
| P1 | `apps/web/src/types/index.ts` | 1-24 | `Invite` type to EXTEND (add `status`), naming convention for new types |
| P1 | `packages/supabase/src/types/database.types.ts` | `patient_invite_links` Row (~1140-1154), `team_invites` Row (~1903-1914) | Exact columns available for `select()` and the type IMPORT source (`Tables<"...">`) |
| P1 | `packages/supabase/supabase/migrations/20260821000001_patient_invite_links_add_status.sql` | 1-13 | `patient_invite_links.status` vocabulary: `pendente` \| `usado` \| `expirado` (no `rejeitado` — this table has no accept/reject flow) |
| P1 | `packages/supabase/supabase/migrations/20260710000001_patient_invite_links_extend.sql` | 21-30 | RLS: SELECT still allows `created_by = auth.uid()`; UPDATE is `service_role`-only (irrelevant here — this phase is read-only) |
| P1 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 294-342 | RLS SELECT policies for `team_invites` (`invited_by = auth.uid() OR invited_professional_id = auth.uid() OR is_team_member(...)`) and `patient_invite_links` |
| P1 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 314 | `patients` SELECT RLS (`is_team_member(id) OR user_id = auth.uid()`) — confirms the plain client can join `patients` for sent listings |
| P2 | `apps/web/app/api/cron/invite-statuses/route.ts` | 1-36 | Confirms the exact `status`/`expires_at` semantics the cron maintains — this plan's `active`/`inactive` split must match |
| P2 | `apps/web/src/actions/get-pending-invites-action.ts` | 1-18 | Reference only (not used here) — shows the parameterless-action convention if a future phase needs one |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|--------------|
| [Supabase JS — Using Filters: or()](https://supabase.com/docs/reference/javascript/using-filters-or) | comma-separated `column.operator.value` syntax | Not directly used (each new query filters on a single owner column), but documents why a two-column `.or()` was considered and rejected — kept here so the next engineer doesn't reach for it unnecessarily |
| [next-safe-action — Action result](https://next-safe-action.dev/docs/concepts/action-result) | output schema is optional | Confirms Server Component + plain async function (no action wrapper) is the correct choice for reads, matching `getMyInvites`'s existing pattern, not `next-safe-action` |

---

## Patterns to Mirror

**RESULT_TYPE_CONVENTION:**
```typescript
// SOURCE: apps/web/src/services/invite.ts:11-19
// COPY THIS PATTERN — every new function returns this shape:
type GetMyInvitesResult = {
  data?: Invite[];
  error?: string;
};
```

**QUERY_WITH_NAMED_FK_JOIN:**
```typescript
// SOURCE: apps/web/src/services/invite.ts:36-46
// COPY THIS PATTERN:
const { data: invites, error } = await supabaseAdmin
  .from("team_invites")
  .select(`
    *,
    patient:patients!team_invites_patient_id_fkey(id, name, pregnancies(due_date, dum)),
    inviter:users!team_invites_invited_by_fkey(id, name, professional_type)
  `)
  .eq("invited_professional_id", user.id)
  .eq("status", "pendente")
  .gt("expires_at", new Date().toISOString())
  .order("created_at", { ascending: false });

if (error) {
  return { error: error.message };
}

return { data: invites as Invite[] };
```

**EXPIRATION_DOUBLE_CHECK (defines the active/inactive predicate):**
```typescript
// SOURCE: apps/web/src/services/invite.ts:150-153
// The cron already flips status to "expirado" daily, but respondToInvite still
// re-checks expires_at in real time as a safety net for the race window.
// Mirror this by NOT trusting "status" alone for the active bucket:
if (new Date(invite.expires_at) < new Date()) {
  await supabase.from("team_invites").update({ status: "expirado" }).eq("id", inviteId);
  throw new Error("Convite expirado");
}
```

**AUTH_USER_LOOKUP:**
```typescript
// SOURCE: apps/web/src/services/invite.ts:22-30
// COPY THIS PATTERN for every new function's opening lines:
const supabase = await createServerSupabaseClient();

const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  return { error: "Usuário não encontrado" };
}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `apps/web/src/services/invite.ts` | UPDATE | Add `getReceivedInvites`, `getSentTeamInvites`, `getSentPatientInvites` |
| `apps/web/src/types/index.ts` | UPDATE | Add `status` to `Invite`; add `SentTeamInvite`, `SentPatientInvite` types |

No migration, no new action file, no UI file touched — this phase is a pure read-layer addition.

---

## NOT Building (Scope Limits)

- No changes to `app/(dashboard)/invites/page.tsx` or `invites-screen.tsx` — wiring the new queries into UI is Phase 4.
- No pagination (`.range()`/`limit`/`offset`) — invite volumes per professional are small; PRD does not request it, and no precedent pattern (`get_filtered_patients`) is reused since that's a paginated SQL function for a much larger table (`patients`), not a fit here.
- No removal or modification of `getMyInvites` — it stays as-is until Phase 4 replaces its call site, avoiding any risk to the currently-shipped received-invites flow.
- No resend action — that's Phase 3 (`team_invites`) and already-existing `sendPatientInviteEmailAction` (`patient_invite_links`).
- No `next-safe-action` action wrapper — these are Server-Component reads, matching the existing `getMyInvites` pattern, not client-triggered mutations.
- No Postgres enum migration for `status` — both tables keep free-text `status`, per the PRD's already-settled Decisions Log.

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/types/index.ts`

- **ACTION**: Add `status` to `Invite`; add two new exported types
- **IMPLEMENT**:
  ```typescript
  export type Invite = {
    id: string;
    status: string; // "pendente" | "aceito" | "rejeitado" | "expirado"
    professional_type: ProfessionalType | null;
    expires_at: string;
    patient: {
      id: string;
      name: string;
      pregnancies: { due_date: string; dum: string | null }[];
    } | null;
    inviter: {
      id: string;
      name: string;
      professional_type: string | null;
    } | null;
  };

  export type SentTeamInvite = {
    id: string;
    status: string; // "pendente" | "aceito" | "rejeitado" | "expirado"
    expires_at: string;
    professional_type: ProfessionalType | null;
    patient: { id: string; name: string } | null;
    invitedProfessional: { id: string; name: string; professional_type: string | null } | null;
  };

  export type SentPatientInvite = {
    id: string;
    status: string; // "pendente" | "usado" | "expirado"
    invite_type: string; // "new_patient" | "link_existing"
    expires_at: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    patient: { id: string; name: string } | null;
  };
  ```
- **MIRROR**: `apps/web/src/types/index.ts:9-23` (existing `Invite` shape/style — hand-shaped join type, not `Tables<>` directly, because these always carry joined `patient`/`inviter` sub-objects)
- **GOTCHA**: Keep `status: string`, not a union literal — both tables use free-text status (confirmed: no Postgres enum), and a union would drift out of sync with the DB. `ProfessionalType` is a project enum, already imported in this file.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/services/invite.ts` — add `getReceivedInvites`

- **ACTION**: ADD new exported function, placed directly after `getMyInvites` (do not modify `getMyInvites` itself)
- **IMPLEMENT**:
  ```typescript
  type GetReceivedInvitesResult = {
    data?: { active: Invite[]; inactive: Invite[] };
    error?: string;
  };

  export async function getReceivedInvites(): Promise<GetReceivedInvitesResult> {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Usuário não encontrado" };
    }

    // Use admin client to bypass RLS — the invited professional is not yet
    // a team member, so RLS on the patients table blocks the JOIN.
    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data: invites, error } = await supabaseAdmin
      .from("team_invites")
      .select(`
        *,
        patient:patients!team_invites_patient_id_fkey(id, name, pregnancies(due_date, dum)),
        inviter:users!team_invites_invited_by_fkey(id, name, professional_type)
      `)
      .eq("invited_professional_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { error: error.message };
    }

    const now = new Date();
    const active: Invite[] = [];
    const inactive: Invite[] = [];

    for (const invite of invites as Invite[]) {
      const isActive = invite.status === "pendente" && new Date(invite.expires_at) > now;
      (isActive ? active : inactive).push(invite);
    }

    return { data: { active, inactive } };
  }
  ```
- **MIRROR**: `apps/web/src/services/invite.ts:21-53` (`getMyInvites`) — same auth/admin-client setup, same named-FK join; the only difference is dropping the `.eq("status","pendente").gt("expires_at",...)` filters (moved to in-JS partitioning) so both buckets come back in one query
- **IMPORTS**: none new — `createServerSupabaseClient`, `createServerSupabaseAdmin` already imported in this file
- **GOTCHA**: Do not trust `status` alone for the active bucket — a `pendente` row can be past `expires_at` in the (small) window before the daily cron runs. Always AND `status === "pendente"` with `expires_at > now`, matching `respondToInvite`'s real-time double-check (`invite.ts:150`).
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/services/invite.ts` — add `getSentTeamInvites`

- **ACTION**: ADD new exported function, placed after `getReceivedInvites`
- **IMPLEMENT**:
  ```typescript
  type GetSentTeamInvitesResult = {
    data?: { active: SentTeamInvite[]; inactive: SentTeamInvite[] };
    error?: string;
  };

  export async function getSentTeamInvites(): Promise<GetSentTeamInvitesResult> {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Usuário não encontrado" };
    }

    // Plain client is sufficient here (unlike getReceivedInvites): sending a
    // team invite requires is_team_member(patient_id) at insert time, so RLS
    // already grants this sender the patients JOIN.
    const { data: invites, error } = await supabase
      .from("team_invites")
      .select(`
        *,
        patient:patients!team_invites_patient_id_fkey(id, name),
        invitedProfessional:users!team_invites_invited_professional_id_fkey(id, name, professional_type)
      `)
      .eq("invited_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { error: error.message };
    }

    const now = new Date();
    const active: SentTeamInvite[] = [];
    const inactive: SentTeamInvite[] = [];

    for (const invite of invites as SentTeamInvite[]) {
      const isActive = invite.status === "pendente" && new Date(invite.expires_at) > now;
      (isActive ? active : inactive).push(invite);
    }

    return { data: { active, inactive } };
  }
  ```
- **MIRROR**: Task 2's structure; join name `team_invites_invited_professional_id_fkey` confirmed in `database.types.ts` Relationships for `team_invites`
- **GOTCHA**: `invited_professional_id` is `null` for link-share invites (created via `createInviteForPatientTeamMember`, no direct target) until someone accepts — `invitedProfessional` will be `null` in that row; the UI (Phase 4) must handle that, not this layer
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/services/invite.ts` — add `getSentPatientInvites`

- **ACTION**: ADD new exported function, placed after `getSentTeamInvites`
- **IMPLEMENT**:
  ```typescript
  type GetSentPatientInvitesResult = {
    data?: { active: SentPatientInvite[]; inactive: SentPatientInvite[] };
    error?: string;
  };

  export async function getSentPatientInvites(): Promise<GetSentPatientInvitesResult> {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Usuário não encontrado" };
    }

    // Plain client is sufficient: SELECT RLS allows created_by = auth.uid();
    // the patients JOIN (link_existing only) is covered by is_team_member,
    // which INSERT already required of this sender.
    const { data: invites, error } = await supabase
      .from("patient_invite_links")
      .select(`
        id, status, invite_type, expires_at, name, email, phone,
        patient:patients!patient_invite_links_patient_id_fkey(id, name)
      `)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return { error: error.message };
    }

    const now = new Date();
    const active: SentPatientInvite[] = [];
    const inactive: SentPatientInvite[] = [];

    for (const invite of invites as SentPatientInvite[]) {
      const isActive = invite.status === "pendente" && new Date(invite.expires_at) > now;
      (isActive ? active : inactive).push(invite);
    }

    return { data: { active, inactive } };
  }
  ```
- **MIRROR**: Task 2/3's structure. Verify the exact FK constraint name via `mcp__supabase__list_tables` or by grepping `database.types.ts` for `patient_invite_links_patient_id_fkey` before using it in the `select()` string — an incorrect FK name fails at query time, not at compile time (Supabase join syntax is a raw string).
- **GOTCHA**: `patient_invite_links.status` vocabulary is `pendente | usado | expirado` — there is **no** `rejeitado` for this table (no accept/reject flow; the patient either uses the link or it expires). Do not reuse `team_invites` status assumptions here.
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

No test runner is configured in this repo (`grep '"test"' package.json` → no match; no `*.test.ts` files exist near `services/` or `actions/`) — there is no existing pattern to mirror. Validation for this phase is type-checking plus manual verification via Supabase (Level 4) and a scratch Server Component or `console.log` in a temporary route (Level 6), covering the states below.

### Manual Verification Checklist (Level 6)

Run against a Supabase branch/local DB, covering the "4 states" the PRD's Phase 2 success signal calls out:

- [ ] `getReceivedInvites()`: one `pendente` + not-expired row → appears in `active`
- [ ] `getReceivedInvites()`: one `pendente` + `expires_at` in the past (pre-cron race window) → appears in `inactive`
- [ ] `getReceivedInvites()`: one `rejeitado` row → appears in `inactive`
- [ ] `getReceivedInvites()`: one `expirado` row (post-cron) → appears in `inactive`
- [ ] `getSentTeamInvites()`: same 4 states as above, scoped by `invited_by`
- [ ] `getSentTeamInvites()`: a link-share invite (`invited_professional_id IS NULL`) does not error, `invitedProfessional` is `null`
- [ ] `getSentPatientInvites()`: `pendente`, `usado`, `expirado` states (no `rejeitado` for this table) both `invite_type` values (`new_patient` has `patient: null`, `link_existing` has `patient` populated)
- [ ] All three functions return `{ error }` (not a throw) when called with no authenticated user (mock/verify via existing `if (!user)` early return)

### Edge Cases Checklist

- [ ] Empty result set (professional has sent/received nothing) → `{ active: [], inactive: [] }`, not an error
- [ ] `patient_invite_links` row with `patient_id = null` (new_patient type) → `patient` field is `null`, no join error
- [ ] `team_invites` row with `invited_professional_id = null` (link-share, unaccepted) → `invitedProfessional` is `null`
- [ ] Row exactly at `expires_at` boundary — confirm `>` (not `>=`) matches `respondToInvite`'s `<` check semantics (invite.ts:150 uses `<`, so `expires_at === now` is treated as expired both there and here)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome lint apps/web/src/services/invite.ts apps/web/src/types/index.ts
```

**EXPECT**: Exit 0, no errors or warnings

### Level 2: UNIT_TESTS

Not applicable — no test runner configured in this repo for this layer (see Testing Strategy).

### Level 3: FULL_SUITE

```bash
pnpm check-types && pnpm build
```

**EXPECT**: All packages type-check, build succeeds

### Level 4: DATABASE_VALIDATION

Use the Supabase MCP (`mcp__supabase__list_tables`, `mcp__supabase__execute_sql`) to:
- [ ] Confirm `patient_invite_links_patient_id_fkey` is the exact constraint name used in Task 4's join (grep `database.types.ts` Relationships block for `patient_invite_links`, or query `information_schema.table_constraints`)
- [ ] Confirm both tables currently have rows in more than one `status` value (seed manually if not, to exercise the manual checklist)

### Level 5: BROWSER_VALIDATION

Not applicable — no UI is shipped in this phase.

### Level 6: MANUAL_VALIDATION

See "Manual Verification Checklist" above — call each function from a temporary Server Component or a scratch script using `createServerSupabaseClient`, log the `{ active, inactive }` result, and confirm bucket membership against seeded rows in each of the 4 states.

---

## Acceptance Criteria

- [ ] `getReceivedInvites`, `getSentTeamInvites`, `getSentPatientInvites` exist in `apps/web/src/services/invite.ts`, each following the `{ data?, error? }` result convention
- [ ] Each function's `active` bucket = `status === "pendente" AND expires_at > now()`; `inactive` = everything else
- [ ] `Invite` type gains `status: string`; `SentTeamInvite` and `SentPatientInvite` types added to `apps/web/src/types/index.ts`
- [ ] `getMyInvites` is unmodified — current `/invites` page continues to work unchanged
- [ ] Level 1 (`pnpm check-types`, `biome lint`) passes with exit 0
- [ ] Manual verification checklist covers all 4 states (pendente-active, pendente-expired-race, rejeitado/usado, expirado) for each of the three functions

---

## Completion Checklist

- [ ] All 4 tasks completed in order (types before service functions that reference them)
- [ ] Each task validated immediately (`pnpm check-types`) after completion
- [ ] Level 1: Static analysis passes
- [ ] Level 3: Full build succeeds
- [ ] Level 4: FK constraint name verified against live schema before shipping Task 4
- [ ] Level 6: Manual checklist executed against seeded data
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| Wrong FK constraint name in `patient_invite_links` join string causes a runtime-only failure (TypeScript won't catch a bad join string) | M | M | Verify exact name via `database.types.ts` Relationships or `mcp__supabase__execute_sql` against `information_schema` before merging Task 4; smoke-test the query manually (Level 4/6) |
| `inactive` bucket silently includes `aceito` rows the PRD's wording ("expirados/rejeitados") didn't explicitly ask for, surprising Phase 4's UI design | M | L | Documented explicitly in this plan's Solution Statement and Task 2 GOTCHA — Phase 4 can filter `inactive` further by `status` if it wants a narrower "expired/rejected only" section; the data layer intentionally returns the superset so no information is lost |
| Sent-listing queries assume the plain (non-admin) client always has RLS access to the `patients` join, but an edge case (e.g. a sender removed from the team after sending) could break this assumption | L | L | RLS SELECT on `patients` is `is_team_member(id) OR user_id = auth.uid()` — if a sender loses team membership, the join returns `null` for `patient` (left join with `patients:...!fkey(...)` degrades gracefully in PostgREST, error only on truly missing FK), not a query error; confirmed via Level 4 checklist |

---

## Notes

- Phase 3 (resend action for `team_invites`) and Phase 4 (Tabs UI) are separate plans. Phase 3 can be implemented in parallel in a separate worktree since it touches only new action files, not `services/invite.ts`.
- The PRD's Open Question about `patient_invite_links.status` being enum vs text was already resolved in Phase 1 (kept as `text`, matching `team_invites`) — this plan follows that precedent, no further decision needed.
- `getMyInvites` is intentionally left in place rather than refactored into `getReceivedInvites` — Phase 4 will decide whether to delete `getMyInvites` once `page.tsx` is rewired, keeping this phase's diff minimal and risk-free to the shipped screen.
