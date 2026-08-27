# Feature: Resend Team Invite Action (Phase 3 of Invites Management Screen)

## Summary

Add a `resendTeamInviteAction` server action that lets a professional (the sender, `invited_by`) revive a `team_invites` row they sent — resetting `status` to `pendente` and pushing `expires_at` 4 days out — so the Phase 4 UI can offer a "Reenviar" button next to any sent team invite. The action extends the row **in place** (no new row, no email) rather than creating a fresh invite: this avoids orphaning `activity_log`/PostHog references to the original `invite_id`, keeps `getSentTeamInvites()`'s active/inactive partition correct with zero extra logic, and matches the codebase's only two other `team_invites` mutation entry points (`respondToInvite`, the expiry cron), both of which are in-place `UPDATE`s via `supabaseAdmin`. No email template exists for `team_invites` (unlike `patient_invite_links`, which has `sendPatientInviteEmailAction`); the invited professional already gets an in-app/push notification and a shareable `/invites/[id]` link, so "resend" server-side is purely a data mutation — Phase 4's UI reuses the existing copy-link/WhatsApp share pattern already built for `invite-professional-modal.tsx`, no new email infra needed for this MVP.

## User Story

As a profissional do parto quem enviou um convite de equipe
I want to reenviar um convite pendente/expirado/rejeitado a partir da tela de invites
So that eu não precise recriar o convite do zero quando o profissional convidado não respondeu a tempo

## Problem Statement

`team_invites` has no resend capability today — once a sent invite expires or is rejected, the sender's only option is to create a brand-new invite via `invite-professional-direct-action.ts` or `createInviteForPatientTeamMember`, both of which are gated by a "pending invite already exists" dedupe check that only prevents *duplicate active* invites, not the reactivation of an old one. `patient_invite_links` has an email-based resend (`sendPatientInviteEmailAction`); `team_invites` has no equivalent path at all.

## Solution Statement

Add `resendTeamInvite(supabase, supabaseAdmin, userId, inviteId)` to `apps/web/src/services/invite.ts`, following the exact `respondToInvite` delegation pattern (thin action → service function). The service function:
1. Fetches the invite via the **plain** `supabase` client filtered on `.eq("id", inviteId).eq("invited_by", userId)` — RLS's existing `"View team invites"` SELECT policy (`invited_by = auth.uid()`) makes this both the authorization check *and* the fetch in one query; a miss means either the invite doesn't exist or isn't owned by this user, and both cases return the same generic "not found" error (no existence leak).
2. Blocks resend when `status === "aceito"` (already accepted — nothing to resend) with a clear Portuguese error.
3. Updates the row via `supabaseAdmin` (required — the UPDATE RLS policy only allows the *recipient*, `invited_professional_id = auth.uid()`, to write, matching the existing pattern in `respondToInvite` and the expiry cron): `status: "pendente"`, `expires_at: dayjs().add(4, "days").toISOString()`.

`resendTeamInviteAction` (new file `apps/web/src/actions/resend-team-invite-action.ts`) wraps this with the standard `authActionClient` + Zod `inviteId` schema + `insertActivityLog` (enterprise-gated) + `captureServerEvent("resend_team_invite", ...)` skeleton, mirroring `respond-invite-action.ts` line-for-line.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY                                     |
| Complexity       | LOW                                                 |
| Systems Affected | `apps/web/src/services/invite.ts`, `apps/web/src/actions/` (new file) |
| Dependencies     | `next-safe-action` 8.1.4, `zod` 3.24.1, `dayjs` (already a dep, no version pin needed — no new deps) |
| Estimated Tasks  | 2                                                    |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║   ┌──────────────────┐    ┌───────────────────────┐                       ║
║   │ invite-           │──►│ team_invites row       │                      ║
║   │ professional-     │   │ status='pendente'       │                      ║
║   │ direct-action.ts  │   │ expires_at=+4 days      │                      ║
║   └──────────────────┘    └───────────────────────┘                       ║
║                                    │                                        ║
║                                    ▼ (4 days pass, no response)             ║
║                            ┌───────────────────────┐                       ║
║                            │ cron: status='expirado' │                     ║
║                            └───────────────────────┘                       ║
║                                    │                                        ║
║                                    ▼                                        ║
║                            ┌───────────────────────┐                       ║
║                            │ DEAD END — sender must  │                     ║
║                            │ recreate invite from     │                     ║
║                            │ scratch (patient page)   │                     ║
║                            └───────────────────────┘                       ║
║                                                                             ║
║   USER_FLOW: sender invites a professional; if it expires or is           ║
║              rejected, there is no in-place way to try again — they       ║
║              must navigate back to the patient's team page and repeat     ║
║              the entire invite-creation flow.                             ║
║   PAIN_POINT: no resend action exists for team_invites at all             ║
║              (getSentTeamInvites already returns these as "inactive").    ║
║                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║   ┌───────────────────────┐   ┌───────────────────────────┐  ┌─────────┐  ║
║   │ team_invites row       │──►│ resendTeamInviteAction     │─►│ same row │ ║
║   │ status='expirado' OR   │   │ (apps/web/src/actions/     │  │ id,      │ ║
║   │ 'rejeitado' (inactive) │   │  resend-team-invite-       │  │ status=  │ ║
║   │                        │   │  action.ts)                │  │'pendente'│ ║
║   └───────────────────────┘   └───────────────────────────┘  │ expires_ │  ║
║                                        │                       │ at=+4d  │  ║
║                                        ▼                       └─────────┘  ║
║                                ┌───────────────────────┐                   ║
║                                │ verifies invited_by =  │                   ║
║                                │ user.id via RLS SELECT │                   ║
║                                │ (supabase, not admin)  │                   ║
║                                └───────────────────────┘                   ║
║                                        │                                    ║
║                                        ▼                                    ║
║                                ┌───────────────────────┐                   ║
║                                │ UPDATE via supabaseAdmin│                  ║
║                                │ (UPDATE RLS = recipient  │                  ║
║                                │  only, sender needs admin)│                 ║
║                                └───────────────────────┘                   ║
║                                                                             ║
║   USER_FLOW: (data layer only — Phase 4 wires a "Reenviar" button to      ║
║              this action) the same invite row is revived in place,       ║
║              immediately reappearing in getSentTeamInvites()'s active     ║
║              bucket with a fresh 4-day window.                            ║
║   VALUE_ADD: no new invite/id is created — activity log and analytics    ║
║              history for the original invite stay intact and             ║
║              contiguous; Phase 4 can reopen the existing copy-link/      ║
║              WhatsApp share UI (already built in                          ║
║              invite-professional-modal.tsx) against the same invite id.  ║
║   DATA_FLOW: plain client for the ownership-checked read (RLS does the   ║
║              auth check for free), supabaseAdmin only for the write,     ║
║              exactly mirroring respondToInvite's admin-write pattern.    ║
║                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `apps/web/src/services/invite.ts` | No resend capability | `resendTeamInvite()` extends `expires_at`/resets `status` in place | Data now exists for Phase 4 to wire a "Reenviar" button |
| `apps/web/src/actions/resend-team-invite-action.ts` (new) | N/A | `resendTeamInviteAction` — thin wrapper, activity log + analytics | Enables client-side `useAction(resendTeamInviteAction)` in Phase 4 |

This phase ships no UI — no button, no modal, no screen change. `invites-screen.tsx` and `invite-professional-modal.tsx` are untouched.

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/actions/respond-invite-action.ts` | 1-57 | Exact skeleton to MIRROR: thin action delegating to a service function, `insertActivityLog` gated by `profile.enterprise_id`, unconditional `captureServerEvent`, `z.string().uuid("ID do convite inválido")` |
| P0 | `apps/web/src/services/invite.ts` | 267-355 (`respondToInvite`) | The service-function pattern to MIRROR: fetch → validate → `supabaseAdmin` write; also the file's existing `dayjs`/type imports to reuse |
| P0 | `apps/web/src/actions/invite-professional-direct-action.ts` | 1-77 | Confirms `dayjs().add(4, "days").toISOString()` is the established `team_invites` expiry duration — MUST match, not invent a different window |
| P1 | `apps/web/src/types/index.ts` | 26-33 (`SentTeamInvite`) | Confirms `id`/`expires_at`/`status` are already exposed to the client from `getSentTeamInvites()` — the action's input/output contract |
| P1 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 296-334 | RLS: INSERT `is_team_member(patient_id)`; UPDATE `invited_professional_id = auth.uid()` (recipient-only — confirms `supabaseAdmin` is required for the write); SELECT `is_team_member(...) OR invited_professional_id = auth.uid() OR invited_by = auth.uid()` (confirms plain client works for the ownership-checked fetch) |
| P1 | `packages/supabase/supabase/migrations/20260503000002_push_notification_triggers.sql` | 188-214 (`notify_on_team_invite`) | `AFTER INSERT` trigger — confirms an in-place `UPDATE` does **not** re-fire the "invite received" push notification; this plan does not add one (out of scope, see NOT Building) |
| P2 | `apps/web/src/lib/activity-log.ts` | 16-25 (`InsertActivityLogParams`) | Exact param shape for `insertActivityLog` call |
| P2 | `apps/web/app/api/cron/invite-statuses/route.ts` | 15-20 | Confirms the `supabaseAdmin.from("team_invites").update(...)` shape/style already established for admin-side writes to this table |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|--------------|
| [next-safe-action — Instance methods](https://next-safe-action.dev/docs/define-actions/instance-methods) | `.inputSchema()` | Confirms `.inputSchema()` (not `.schema()`) is the current v8 API — matches what `respond-invite-action.ts` and `invite-professional-direct-action.ts` already use in this codebase, no version drift to worry about |

---

## Patterns to Mirror

**THIN_ACTION_DELEGATING_TO_SERVICE:**
```typescript
// SOURCE: apps/web/src/actions/respond-invite-action.ts:1-23
// COPY THIS PATTERN:
"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { respondToInvite } from "@/services/invite";
import { z } from "zod";

const schema = z.object({
  inviteId: z.string().uuid("ID do convite inválido"),
});

export const respondInviteAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const result = await respondToInvite(/* ... */);
    // ...
  });
```

**SERVICE_FUNCTION_FETCH_VALIDATE_ADMIN_WRITE:**
```typescript
// SOURCE: apps/web/src/services/invite.ts:267-320 (respondToInvite)
// COPY THIS PATTERN — fetch, validate, admin-write, return:
const { data: invite, error: inviteError } = await supabaseAdmin
  .from("team_invites")
  .select()
  .eq("id", inviteId)
  .eq("status", "pendente")
  .single();

if (inviteError || !invite) {
  throw new Error("Convite não encontrado");
}
// ... validation ...
await supabaseAdmin.from("team_invites").update({ status: "expirado" }).eq("id", inviteId);
```

**EXPIRY_DURATION_CONSTANT:**
```typescript
// SOURCE: apps/web/src/actions/invite-professional-direct-action.ts:40
// COPY THIS EXACT DURATION — do not invent a different window:
expires_at: dayjs().add(4, "days").toISOString(),
```

**ACTIVITY_LOG_AND_ANALYTICS_TAIL:**
```typescript
// SOURCE: apps/web/src/actions/respond-invite-action.ts:25-56
// COPY THIS PATTERN — enterprise-gated activity log, unconditional analytics event:
if (profile.enterprise_id && result.patientId) {
  const { data: patient } = await supabase
    .from("patients")
    .select("name")
    .eq("id", result.patientId)
    .single();

  insertActivityLog({
    supabaseAdmin,
    actionName: "Convite reenviado",
    description: patient ? `Convite de equipe reenviado para cuidar de ${patient.name}` : "Convite de equipe reenviado",
    actionType: "team",
    userId: user.id,
    enterpriseId: profile.enterprise_id,
    patientId: result.patientId,
    metadata: { invite_id: parsedInput.inviteId },
  });
}

await captureServerEvent(user.id, "resend_team_invite", {
  invite_id: parsedInput.inviteId,
});
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `apps/web/src/services/invite.ts` | UPDATE | Add `resendTeamInvite(supabase, supabaseAdmin, userId, inviteId)` |
| `apps/web/src/actions/resend-team-invite-action.ts` | CREATE | Thin `authActionClient` wrapper, mirrors `respond-invite-action.ts` |

No migration, no UI file touched, no email template — this phase is a pure mutation-layer addition.

---

## NOT Building (Scope Limits)

- No new `team_invites` row on resend — the existing row is updated in place (see Solution Statement for why: preserves `activity_log`/analytics history, keeps `getSentTeamInvites()` correct with zero extra logic).
- No email-based resend — unlike `patient_invite_links`, `team_invites` has no recipient email column (the recipient is an existing platform user, `invited_professional_id`); building a new email template is unnecessary complexity the PRD doesn't require. Phase 4's UI reuses the existing copy-link/WhatsApp share affordance already built for invite creation.
- No push notification on resend — `notify_on_team_invite()` only fires on `INSERT`; deliberately not adding a second trigger/manual notification call for this MVP (not requested by the PRD, and the invited professional can still see the invite reappear in their `/invites` list on next visit).
- No cooldown/rate-limit on repeated resends — confirmed via codebase-analyst trace: no anti-spam pattern exists anywhere in this codebase to mirror, and the PRD does not request one.
- No UI (button, modal, screen wiring) — that's Phase 4, which depends on this phase.
- No resend for `patient_invite_links` — already covered by the existing `sendPatientInviteEmailAction`; out of scope for this phase per the PRD's phase split.

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/services/invite.ts` — add `resendTeamInvite`

- **ACTION**: ADD new exported function, placed directly after `respondToInvite` (end of file)
- **IMPLEMENT**:
  ```typescript
  export async function resendTeamInvite(
    supabase: SupabaseClient,
    supabaseAdmin: SupabaseAdminClient,
    userId: string,
    inviteId: string,
  ) {
    const { data: invite, error: inviteError } = await supabase
      .from("team_invites")
      .select("id, status, patient_id")
      .eq("id", inviteId)
      .eq("invited_by", userId)
      .single();

    if (inviteError || !invite) {
      throw new Error("Convite não encontrado");
    }

    if (invite.status === "aceito") {
      throw new Error("Este convite já foi aceito");
    }

    const newExpiresAt = dayjs().add(4, "days").toISOString();

    const { error: updateError } = await supabaseAdmin
      .from("team_invites")
      .update({ status: "pendente", expires_at: newExpiresAt })
      .eq("id", inviteId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return { patientId: invite.patient_id, expiresAt: newExpiresAt };
  }
  ```
- **MIRROR**: `apps/web/src/services/invite.ts:267-355` (`respondToInvite`) — same `(supabase, supabaseAdmin, ...)` parameter order, same fetch/validate/admin-write/return shape
- **IMPORTS**: none new — `dayjs` already imported at the top of this file (line 3)
- **GOTCHA**: Fetch via the **plain** `supabase` client with `.eq("invited_by", userId)`, not `supabaseAdmin` — this makes RLS do the ownership check for free (a non-owner's request returns no row, indistinguishable from "doesn't exist"). Only the UPDATE needs `supabaseAdmin`, because `team_invites`'s UPDATE RLS policy (`invited_professional_id = auth.uid()`) only allows the *recipient*, not the sender, to write — see `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql:322`.
- **GOTCHA**: Do not gate on `.eq("status", "pendente")` in the fetch (unlike `respondToInvite`) — this function's entire purpose is to resend `expirado`/`rejeitado` (inactive) invites, not just pending ones. Only block `status === "aceito"`.
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/actions/resend-team-invite-action.ts`

- **ACTION**: CREATE new action file
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { insertActivityLog } from "@/lib/activity-log";
  import { captureServerEvent } from "@/lib/posthog/server";
  import { authActionClient } from "@/lib/safe-action";
  import { resendTeamInvite } from "@/services/invite";
  import { z } from "zod";

  const schema = z.object({
    inviteId: z.string().uuid("ID do convite inválido"),
  });

  export const resendTeamInviteAction = authActionClient
    .inputSchema(schema)
    .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
      const result = await resendTeamInvite(supabase, supabaseAdmin, user.id, parsedInput.inviteId);

      if (profile.enterprise_id && result.patientId) {
        const { data: patient } = await supabase
          .from("patients")
          .select("name")
          .eq("id", result.patientId)
          .single();

        insertActivityLog({
          supabaseAdmin,
          actionName: "Convite reenviado",
          description: patient
            ? `Convite de equipe reenviado para cuidar de ${patient.name}`
            : "Convite de equipe reenviado",
          actionType: "team",
          userId: user.id,
          enterpriseId: profile.enterprise_id,
          patientId: result.patientId,
          metadata: { invite_id: parsedInput.inviteId },
        });
      }

      await captureServerEvent(user.id, "resend_team_invite", {
        invite_id: parsedInput.inviteId,
      });

      return { success: true, expiresAt: result.expiresAt };
    });
  ```
- **MIRROR**: `apps/web/src/actions/respond-invite-action.ts:1-57` — identical shape (imports, schema declaration, ctx destructuring, activity-log gate, analytics tail, return shape)
- **IMPORTS**: `insertActivityLog` from `@/lib/activity-log`, `captureServerEvent` from `@/lib/posthog/server`, `authActionClient` from `@/lib/safe-action`, `resendTeamInvite` from `@/services/invite` (new export from Task 1), `z` from `zod`
- **GOTCHA**: Return `expiresAt` (not the full invite row) — Phase 4's UI only needs to know the new expiry to update local state optimistically, matching the minimal-payload convention of `respondInviteAction`'s `{ success: true, patientId }` return
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

No test runner is configured in this repo (confirmed in Phase 2's plan — no `*.test.ts` files exist near `services/`/`actions/`). Validation is type-checking plus manual verification via Supabase MCP (Level 4) and a scratch call (Level 6).

### Manual Verification Checklist (Level 6)

- [ ] Resend a `pendente` invite (not yet expired) → `status` stays `pendente`, `expires_at` moves 4 days further out
- [ ] Resend an `expirado` invite → `status` flips back to `pendente`, `expires_at` is 4 days from now, row reappears in `getSentTeamInvites()`'s `active` bucket
- [ ] Resend a `rejeitado` invite → same as above (status resets to `pendente`)
- [ ] Attempt to resend an `aceito` invite → throws "Este convite já foi aceito", no DB write occurs
- [ ] Attempt to resend an invite sent by a *different* user (`invited_by !== user.id`) → throws "Convite não encontrado" (ownership check via RLS blocks the read)
- [ ] Attempt to resend a nonexistent `inviteId` (random UUID) → throws "Convite não encontrado"
- [ ] Confirm `activity_logs` row is inserted only when `profile.enterprise_id` is set (non-enterprise professional resending → no activity log row, no error)
- [ ] Confirm no new row is created in `team_invites` (row count for that patient/professional pair unchanged before/after resend)

### Edge Cases Checklist

- [ ] Resending twice in a row (no cooldown) → both succeed, `expires_at` reflects the second call's timestamp — acceptable per NOT Building (no anti-spam requested)
- [ ] Resend a link-share invite (`invited_professional_id IS NULL`, created via `createInviteForPatientTeamMember`) — still resendable, since the fetch filters on `invited_by`, not `invited_professional_id`

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
pnpm exec biome lint apps/web/src/services/invite.ts apps/web/src/actions/resend-team-invite-action.ts
```

**EXPECT**: Exit 0, no errors or warnings

### Level 2: UNIT_TESTS

Not applicable — no test runner configured in this repo for this layer.

### Level 3: FULL_SUITE

```bash
pnpm check-types && pnpm build --filter=web
```

**EXPECT**: Type-check passes, build succeeds

### Level 4: DATABASE_VALIDATION

Use the Supabase MCP (`mcp__supabase__execute_sql`) to:
- [ ] Confirm the UPDATE RLS policy on `team_invites` is still `invited_professional_id = auth.uid()` (recipient-only) — i.e. confirm the plan's assumption that `supabaseAdmin` is required for this write hasn't changed
- [ ] After a manual test resend, confirm exactly one row changed (`status`, `expires_at`) and no new row was inserted

### Level 5: BROWSER_VALIDATION

Not applicable — no UI is shipped in this phase.

### Level 6: MANUAL_VALIDATION

See "Manual Verification Checklist" above — call `resendTeamInviteAction` from a temporary script or via a manually-triggered `next-safe-action` invocation against seeded rows in each of the 4 states (`pendente`, `expirado`, `rejeitado`, `aceito`).

---

## Acceptance Criteria

- [ ] `resendTeamInvite` exists in `apps/web/src/services/invite.ts`, following the `(supabase, supabaseAdmin, ...)` parameter convention
- [ ] `resendTeamInviteAction` exists in `apps/web/src/actions/resend-team-invite-action.ts`, following the `authActionClient` + `insertActivityLog`/`captureServerEvent` tail convention
- [ ] Resend always extends `expires_at` by exactly 4 days from the call time (matching `team_invites`'s existing creation-time duration) and resets `status` to `pendente`
- [ ] Resend is blocked (throws) only when `status === "aceito"` — `pendente`, `expirado`, and `rejeitado` are all resendable
- [ ] Ownership is enforced via the RLS-respecting `supabase` client fetch (`invited_by = user.id`), not by trusting client input
- [ ] No new `team_invites` row is ever created by this action — always an in-place UPDATE
- [ ] Level 1 (`pnpm check-types`, `biome lint`) passes with exit 0
- [ ] Manual verification checklist covers all states (pendente, expirado, rejeitado, aceito, wrong-owner, nonexistent-id)

---

## Completion Checklist

- [ ] Both tasks completed in order (service function before the action that imports it)
- [ ] Each task validated immediately (`pnpm check-types`) after completion
- [ ] Level 1: Static analysis passes
- [ ] Level 3: Full build succeeds
- [ ] Level 4: RLS assumption re-verified against live schema; single-row-changed confirmed
- [ ] Level 6: Manual checklist executed against seeded data
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| A sender resends an invite the recipient is mid-way through accepting (race between resend's `UPDATE ... SET status='pendente'` and `respondToInvite`'s accept path also writing `status`) | L | L | Both writes are single-row `UPDATE`s guarded by Postgres's default row-level locking; worst case is a last-write-wins on `status`, which is the same race that already exists between the expiry cron and `respondToInvite` today (documented, accepted risk pattern in this codebase) |
| Reviving an `aceito`-adjacent invite could let a sender re-invite a professional whose `professional_type` slot is already filled on that patient's team, only to have Phase 4's later "accept" attempt fail with `respondToInvite`'s `existingMember` check | L | L | This is existing, correct behavior — `respondToInvite`'s accept path already re-validates `existingMember` at accept time regardless of how the invite got back to `pendente`; not a new failure mode introduced by this phase |
| Phase 4 UI might expect a full invite object back (e.g. to re-render `expires_at` without a refetch) but this action only returns `{ success, expiresAt }` | L | L | Documented explicitly in Task 2's GOTCHA and the Solution Statement; Phase 4 can destructure `expiresAt` directly since it already receives the row's `id` from the button it clicked, or add `.select()` to the update if a fuller payload turns out to be needed — cheap to extend later, not a blocker now |

---

## Notes

- Phase 4 (Tabs UI) depends on both this phase and Phase 2 (already complete) — once this lands, Phase 4 is fully unblocked.
- The PRD's Phase 3 open decision ("reabre modal de compartilhamento ou envia e-mail") is resolved here as **neither, at the data layer** — this phase only mutates the row; Phase 4 decides how to surface the refreshed invite (most likely reopening the existing copy-link/WhatsApp share UI already built in `invite-professional-modal.tsx`, per the Solution Statement).
- This phase can be implemented in parallel with nothing else remaining — Phase 2 is done, so Phase 3 is the sole remaining blocker for Phase 4. No further worktree parallelism opportunity exists in this PRD.
