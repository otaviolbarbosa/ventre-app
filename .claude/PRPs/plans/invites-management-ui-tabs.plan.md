# Feature: Invites Management Screen — UI (Tabs + Sections)

## Summary

Rewrite `apps/web/src/screens/invites-screen.tsx` and `apps/web/app/(dashboard)/invites/page.tsx` to be the central invites hub described in the PRD: a `Tabs` component with **Recebidos** (default, preserves today's accept/reject flow) and **Enviados** (new — two sections: Gestantes / `patient_invite_links`, and Profissionais / `team_invites`). Each of the three listings splits into an "ativos" list and a collapsed-below "expirados/rejeitados" list, using the `{ active, inactive }` shape already returned by Phase 2's `getReceivedInvites`/`getSentTeamInvites`/`getSentPatientInvites`. "Reenviar" wires up Phase 3's `resendTeamInviteAction` (team) and the existing `sendPatientInviteEmailAction` (patient) — the latter needs a small extension (this plan's Task 2) because today it only re-sends an email without reviving an expired link, which would ship a "Reenviar" button that doesn't actually fix expired patient invites.

## User Story

As a profissional do parto
I want to see every invite I've sent or received, active and expired/rejected, in one screen with a working "Reenviar" action
So that I know whether to wait, act, or resend, without digging through modals or asking support

## Problem Statement

`invites-screen.tsx` today only renders active received `team_invites` with accept/reject. There is no UI for sent invites of either type, no visibility into expired/rejected invites, and no resend affordance anywhere in the UI (even though the underlying resend actions/queries now exist from Phases 2–3).

## Solution Statement

Two-tab client screen (`Tabs` from `@ventre/ui/tabs`, uncontrolled, `defaultValue="received"`, mirroring `users-screen.tsx`'s exact usage). `page.tsx` fetches all three listings in parallel via `Promise.all` and passes them as props (Server Component → Client Component prop pattern, matching the existing `getMyInvites()` → `InvitesScreen` wiring, and `billing-deductions-screen.tsx`'s prop-fed-list precedent). Three new small presentational card components (`received-invite-card.tsx`, `sent-team-invite-card.tsx`, `sent-patient-invite-card.tsx`) live in `apps/web/src/components/shared/`, alongside a new `invite-status-badge.tsx` that maps both status vocabularies (`pendente|aceito|rejeitado|expirado` for team, `pendente|usado|expirado` for patient) to `Badge` variants, mirroring the `getStatusConfig`/`StatusBadge` billing pattern. Per the external-research pass, active/inactive within each section render as **two plain stacked lists** (not nested `Tabs`) — avoids a second ARIA tablist for no interactive benefit, since there's nothing to keyboard-navigate between two static lists. Mutations follow the codebase's two established conventions: Recebidos accept/reject keeps its proven local-`useState`-filter pattern (a pure removal, low risk, don't touch what works); Enviados resend (which *moves* an item from inactive→active rather than removing it) uses `router.refresh()` in `onSuccess`, matching `billing-deductions-screen.tsx`'s precedent for exactly this "let the Server Component refetch be the source of truth" situation — confirmed by the next-safe-action research pass as the more idiomatic choice over hand-reconstructing server state client-side.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY (UI) |
| Complexity       | MEDIUM |
| Systems Affected | `apps/web/src/screens/invites-screen.tsx`, `apps/web/app/(dashboard)/invites/page.tsx`, `apps/web/src/components/shared/`, `apps/web/src/modals/`, `apps/web/src/actions/send-patient-invite-email-action.ts`, `apps/web/src/services/invite.ts` |
| Dependencies     | `@radix-ui/react-tabs` 1.1.2 (no new deps), `next-safe-action` 8.1.4, `dayjs` 1.11.13 |
| Estimated Tasks  | 9 |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║   ┌─────────────┐         ┌───────────────────┐        ┌─────────────────┐    ║
║   │ /invites    │ ──────► │ getMyInvites()      │ ────► │ InvitesScreen    │   ║
║   │ page.tsx    │         │ (active received     │       │ flat list, no    │   ║
║   └─────────────┘         │  team_invites only)  │       │ tabs, accept/    │   ║
║                            └───────────────────┘        │ reject only      │   ║
║                                                            └─────────────────┘   ║
║                                                                                 ║
║   USER_FLOW: professional opens /invites, sees only pending received          ║
║              team invites; accept/reject removes them from the list.          ║
║   PAIN_POINT: no visibility of sent invites (either table), no way to see     ║
║               or act on expired/rejected invites, no resend anywhere.         ║
║   DATA_FLOW: page.tsx → getMyInvites() → useState(initialInvites) →           ║
║              respondInviteAction → local .filter() removes the row.           ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  page.tsx: Promise.all([getReceivedInvites(), getSentTeamInvites(),           ║
║            getSentPatientInvites()]) ──► InvitesScreen(props)                 ║
║                                                                                 ║
║  ┌─────────────────────────────────────────────────────────────────────┐      ║
║  │ Tabs: [ Recebidos (default) ]  [ Enviados ]                          │      ║
║  ├─────────────────────────────────────────────────────────────────────┤      ║
║  │ RECEBIDOS                        │  ENVIADOS                        │      ║
║  │  Ativos (Aceitar/Recusar)        │   ── Gestantes ──                │      ║
║  │  ─ expirados/rejeitados ─         │    Ativos (Reenviar)             │      ║
║  │   (dimmed cards, status badge)   │    ─ expirados/usados ─          │      ║
║  │                                   │     (Reenviar)                   │      ║
║  │                                   │   ── Profissionais ──            │      ║
║  │                                   │    Ativos (Reenviar)             │      ║
║  │                                   │    ─ expirados/rejeitados ─      │      ║
║  │                                   │     (Reenviar → share modal)     │      ║
║  └─────────────────────────────────────────────────────────────────────┘      ║
║                                                                                 ║
║   USER_FLOW: professional sees Recebidos by default (existing accept/         ║
║              reject flow, now also showing expired/rejected below, dimmed,    ║
║              no actions); switches to Enviados to see everything they've      ║
║              sent, split by type and by active/inactive, with a working       ║
║              "Reenviar" on every non-terminal (not aceito/usado) invite.      ║
║   VALUE_ADD: full lifecycle visibility + self-service resend, no support      ║
║              needed to know "did this invite land."                          ║
║   DATA_FLOW: accept/reject → respondInviteAction → local .filter() (as        ║
║              today). Resend (team) → resendTeamInviteAction → router.refresh  ║
║              → share modal reopens with the resent invite id. Resend          ║
║              (patient) → sendPatientInviteEmailAction (now also revives       ║
║              status/expires_at) → router.refresh() → toast.                   ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `app/(dashboard)/invites/page.tsx` | Fetches only `getMyInvites()` | Fetches `getReceivedInvites`, `getSentTeamInvites`, `getSentPatientInvites` in parallel | All 3 listings available to the screen |
| `invites-screen.tsx` | Flat list, no tabs | `Tabs` (Recebidos/Enviados), 3 sections, active+inactive split | Full invite lifecycle visible |
| `send-patient-invite-email-action.ts` | Resend never revives an expired link | Resets `status`→`pendente` + extends `expires_at` (+7 days) before sending, when not already `pendente` | "Reenviar" on an expired patient invite actually produces a working link |
| (new) `resend-team-invite-modal.tsx` | N/A | Copy-link/WhatsApp share reopened after a team-invite resend | Sender gets a fresh, shareable link immediately |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/screens/users-screen.tsx` | 1-160 | Exact `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` usage to MIRROR (uncontrolled, `defaultValue`, count badges, `EmptyState` per tab) |
| P0 | `apps/web/src/screens/invites-screen.tsx` | 1-145 | Current screen to REPLACE — preserve the accept/reject `handleAction`/`processingId`/toast pattern exactly for the Recebidos tab |
| P0 | `apps/web/src/services/invite.ts` | 55-229 | `getReceivedInvites`, `getSentTeamInvites`, `getSentPatientInvites` — exact `{ active, inactive }` return shapes to consume |
| P0 | `apps/web/src/types/index.ts` | 9-44 | `Invite`, `SentTeamInvite`, `SentPatientInvite` — exact fields available per card |
| P1 | `apps/web/src/components/shared/pending-invite-card.tsx` | 1-46 | Dimmed/`opacity-60` card styling to MIRROR for inactive-list cards |
| P1 | `apps/web/src/lib/billing/calculations.ts` | 255-270 | `getStatusConfig`/`statusConfigs` pattern to MIRROR for `invite-status-badge.tsx` |
| P1 | `apps/web/src/components/billing/status-badge.tsx` | 1-11 | Thin `Badge`-wrapping component pattern to MIRROR |
| P1 | `packages/ui/src/badge.tsx` | 6-27 | Available `Badge` variants: `default\|info\|secondary\|success\|warning\|destructive\|outline` |
| P1 | `apps/web/src/modals/patient-invite-share-modal.tsx` | 1-100 | Template for the new `resend-team-invite-modal.tsx` (copy-link/WhatsApp `ContentModal` pattern) — team version drops the "Enviar por e-mail" button (no email column on `team_invites`) |
| P1 | `apps/web/src/actions/resend-team-invite-action.ts` | 1-45 | Exact input/output (`{ inviteId }` → `{ success, expiresAt }`) to wire into the new modal |
| P1 | `apps/web/src/actions/send-patient-invite-email-action.ts` | 1-39 | File to EXTEND (Task 2) — current behavior sends email but never revives `status`/`expires_at` |
| P1 | `apps/web/src/screens/billing-deductions-screen.tsx` | 19-34 | `router.refresh()`-after-`onSuccess` pattern to MIRROR for resend mutations |
| P2 | `apps/web/src/actions/create-patient-invite-action.ts` | 44-57 | Confirms `patient_invite_links` has no app-level `expires_at` on insert — relies on the DB `DEFAULT (now() + interval '7 days')` (see below), so the resend extension must set `expires_at` explicitly to match |
| P2 | `packages/supabase/supabase/migrations/20260710000001_patient_invite_links_extend.sql` | 1-13 | Confirms `expires_at DEFAULT (now() + interval '7 days')` — the duration Task 2's resend extension must reuse (7 days, NOT the 4-day team duration) |
| P2 | `apps/web/src/components/shared/empty-state.tsx` | 1-21 | `EmptyState({icon, title, description, children})` props |
| P2 | `apps/web/src/components/shared/page-header.tsx` | 1-69 | `PageHeader` — `children` renders as right-aligned actions next to title (not needed here, but confirms no tab-switcher slot exists in the header itself) |
| P2 | `apps/web/src/utils/team.ts` | full | `professionalTypeLabels: Record<string,string>` for professional-type display |
| P2 | `apps/web/app/(dashboard)/invites/[id]/page.tsx` | 1-18 | Confirms `getPendingInviteById` (separate function, untouched) still backs the `/invites/[id]` detail route — no change needed there |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|--------------|
| [Radix Primitives — Tabs](https://www.radix-ui.com/primitives/docs/components/tabs) | API / accessibility | Confirms nesting is mechanically safe (separate context per `Tabs.Root`) but NOT officially documented — informed the decision to use plain stacked sections instead of nested `Tabs` for active/inactive, avoiding a second ARIA tablist with no interactive benefit |
| [next-safe-action — useAction hook](https://next-safe-action.dev/docs/execute-actions/hooks/useaction) | `onSuccess`/`onError` | Confirms `useAction` does not mutate state itself — the choice between local-filter and `router.refresh()` is a project convention, not a library mandate; this plan picks `router.refresh()` for resend (a *move*, not a removal) per the codebase's own `billing-deductions-screen.tsx` precedent |
| [dayjs — GitHub issue #1271](https://github.com/iamkun/dayjs/issues/1271) | DST + `.add(days)` | `.add(N, 'days')` can drift across DST boundaries; irrelevant in practice (Brazil has no DST since 2019) but confirms `expires_at` should be computed once server-side and only ever diffed (never re-added) on the client for "expira em" display — already the case in `invite-details-screen.tsx`'s `dayjs(invite.expires_at).format(...)`, no change needed |

---

## Patterns to Mirror

**TABS_USAGE (uncontrolled, count badges):**
```tsx
// SOURCE: apps/web/src/screens/users-screen.tsx:84-102
<Tabs defaultValue="received" className="mt-4">
  <TabsList className="mb-4 w-full max-w-xs">
    <TabsTrigger value="received">
      Recebidos
      {receivedActiveCount > 0 && (
        <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
          {receivedActiveCount}
        </span>
      )}
    </TabsTrigger>
    <TabsTrigger value="sent">Enviados</TabsTrigger>
  </TabsList>
  <TabsContent value="received">{/* ... */}</TabsContent>
  <TabsContent value="sent">{/* ... */}</TabsContent>
</Tabs>
```

**STATUS_BADGE_CONFIG (mirror billing's getStatusConfig):**
```ts
// SOURCE: apps/web/src/lib/billing/calculations.ts:255-270
// COPY THIS PATTERN for apps/web/src/components/shared/invite-status-badge.tsx:
type InviteStatusConfig = { label: string; variant: "warning" | "success" | "destructive" | "secondary" };

const inviteStatusConfigs: Record<string, InviteStatusConfig> = {
  pendente: { label: "Pendente", variant: "warning" },
  aceito: { label: "Aceito", variant: "success" },
  usado: { label: "Usado", variant: "success" },
  rejeitado: { label: "Recusado", variant: "destructive" },
  expirado: { label: "Expirado", variant: "secondary" },
};

export function getInviteStatusConfig(status: string): InviteStatusConfig {
  return inviteStatusConfigs[status] ?? { label: status, variant: "secondary" };
}
```

**DIMMED_INACTIVE_CARD (mirror pending-invite-card.tsx):**
```tsx
// SOURCE: apps/web/src/components/shared/pending-invite-card.tsx:21
<Card className={isActive ? undefined : "opacity-60"}>
```

**ACCEPT_REJECT_LOCAL_FILTER (unchanged, preserve exactly for Recebidos):**
```tsx
// SOURCE: apps/web/src/screens/invites-screen.tsx:29-58
async function handleAction(inviteId: string, action: "accept" | "reject") {
  setProcessingId(inviteId);
  const result = await executeAsync({ inviteId, action });
  if (result?.serverError) {
    toast.error(result.serverError);
    setProcessingId(null);
    return;
  }
  // ...success toasts...
  setReceivedActive(receivedActive.filter((i) => i.id !== inviteId));
  setProcessingId(null);
}
```

**RESEND_MOVE_VIA_ROUTER_REFRESH (mirror billing-deductions-screen.tsx):**
```tsx
// SOURCE: apps/web/src/screens/billing-deductions-screen.tsx:28-34
const router = useRouter();
const { execute: executeResend, isExecuting } = useAction(resendTeamInviteAction, {
  onSuccess: () => {
    toast.success("Convite reenviado!");
    router.refresh();
  },
  onError: ({ error }) => toast.error(error.serverError ?? "Erro ao reenviar convite"),
});
```

**SHARE_MODAL_TEMPLATE (mirror patient-invite-share-modal.tsx, drop email button):**
```tsx
// SOURCE: apps/web/src/modals/patient-invite-share-modal.tsx:1-100
// New file apps/web/src/modals/resend-team-invite-modal.tsx follows this shape:
// - props: { inviteId: string; patientName: string; isOpen: boolean; setIsOpen: (open: boolean) => void }
// - getInviteUrl() => `${window.location.origin}/invites/${inviteId}` (matches
//   invite-professional-modal.tsx:113-116's existing team-invite link shape)
// - handleCopyLink / handleShareWhatsApp identical structure, CustomIcon icon="whatsapp"
// - NO "Enviar por e-mail" button — team_invites has no email column
```

**THIN_ACTION_TAIL_TO_EXTEND (send-patient-invite-email-action.ts, Task 2):**
```ts
// SOURCE: apps/web/src/actions/resend-team-invite-action.ts:16 (the pattern to mirror
// inside send-patient-invite-email-action.ts's existing fetch, not a new file)
import dayjs from "dayjs";
// after fetching `invite` and validating `invite.email` exists:
if (invite.status !== "pendente") {
  const { error: reviveError } = await ctx.supabaseAdmin
    .from("patient_invite_links")
    .update({ status: "pendente", expires_at: dayjs().add(7, "days").toISOString() })
    .eq("id", invite.id);
  if (reviveError) throw new Error(reviveError.message);
}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `apps/web/app/(dashboard)/invites/page.tsx` | UPDATE | Fetch all 3 listings in parallel, drop `getMyInvites()` |
| `apps/web/src/services/invite.ts` | UPDATE | Remove `getMyInvites` — confirmed zero other call sites (grep), becomes dead code once `page.tsx` is rewired |
| `apps/web/src/screens/invites-screen.tsx` | REWRITE | Tabs, 3 sections, active/inactive split |
| `apps/web/src/components/shared/invite-status-badge.tsx` | CREATE | Status→Badge mapping for both invite status vocabularies |
| `apps/web/src/components/shared/received-invite-card.tsx` | CREATE | Recebidos card (extracted from current inline JSX) — active variant has Aceitar/Recusar, inactive is read-only+dimmed |
| `apps/web/src/components/shared/sent-team-invite-card.tsx` | CREATE | Enviados → Profissionais card — Reenviar button (hidden when `status === "aceito"`) |
| `apps/web/src/components/shared/sent-patient-invite-card.tsx` | CREATE | Enviados → Gestantes card — Reenviar button (hidden when `status === "usado"` or `email` is null) |
| `apps/web/src/modals/resend-team-invite-modal.tsx` | CREATE | Copy-link/WhatsApp share UI reopened after a team-invite resend |
| `apps/web/src/actions/send-patient-invite-email-action.ts` | UPDATE | Revive `status`/`expires_at` before sending when invite isn't already `pendente` (Task 2) |

---

## NOT Building (Scope Limits)

- No nested `Tabs` for active/inactive within a section — plain stacked lists, per the Radix research finding (no keyboard-navigable content between two static lists, avoids a second ARIA tablist).
- No pagination on any of the three lists — Phase 2 already decided this (small per-professional volumes); not revisited here.
- No push notification / email trigger on team-invite resend — `resendTeamInvite` already made this call in Phase 3; the UI just surfaces the existing copy-link/WhatsApp share affordance.
- No cooldown/rate-limit UI on repeated resends — Phase 3 confirmed no anti-spam pattern exists anywhere in the codebase to mirror; not introduced here either.
- No new email template for `team_invites` — confirmed out of scope by Phase 3's plan; the resend modal only offers copy-link/WhatsApp.
- No change to `/invites/[id]` detail route or `getPendingInviteById` — untouched, confirmed via Mandatory Reading.
- No optimistic UI (`useOptimisticAction`) — the research pass confirmed `router.refresh()` is the better fit here (server-confirmed `expires_at`/`status`, not client-guessed), and it matches the existing `billing-deductions-screen.tsx` convention.

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/services/invite.ts` — remove `getMyInvites`

- **ACTION**: DELETE the `getMyInvites` function (lines 21-53) and its `GetMyInvitesResult` type (lines 11-14)
- **VERIFY FIRST**: `grep -rn "getMyInvites" apps/web/` returns only `page.tsx` (already confirmed) — if any other match appears, stop and keep the function
- **GOTCHA**: Do not remove `getReceivedInvites`, `getInviteById`, `getPendingInviteById`, `getSentTeamInvites`, `getSentPatientInvites`, `createInviteForPatientTeamMember`, `respondToInvite`, `resendTeamInvite` — only the now-fully-superseded `getMyInvites`
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/actions/send-patient-invite-email-action.ts` — revive expired invites on resend

- **ACTION**: Add a revive step before `sendPatientInvite(...)` is called, only when `invite.status !== "pendente"`
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { authActionClient } from "@/lib/safe-action";
  import { sendPatientInvite } from "@/lib/emails/send-patient-invite";
  import dayjs from "dayjs";
  import { z } from "zod";

  const sendPatientInviteEmailSchema = z.object({
    inviteId: z.string().uuid(),
  });

  export const sendPatientInviteEmailAction = authActionClient
    .inputSchema(sendPatientInviteEmailSchema)
    .action(async ({ parsedInput, ctx: { supabaseAdmin } }) => {
      const { data: invite, error } = await supabaseAdmin
        .from("patient_invite_links")
        .select("id, status, name, email, enterprise_id, enterprises(name)")
        .eq("id", parsedInput.inviteId)
        .single();

      if (error || !invite) {
        throw new Error("Convite não encontrado.");
      }

      if (!invite.email) {
        throw new Error("Este convite não possui e-mail cadastrado.");
      }

      if (invite.status === "usado") {
        throw new Error("Este convite já foi utilizado.");
      }

      if (invite.status !== "pendente") {
        const { error: reviveError } = await supabaseAdmin
          .from("patient_invite_links")
          .update({ status: "pendente", expires_at: dayjs().add(7, "days").toISOString() })
          .eq("id", invite.id);

        if (reviveError) {
          throw new Error(reviveError.message);
        }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const inviteLink = `${appUrl}/patient-registration?piid=${invite.id}`;

      await sendPatientInvite({
        to: invite.email,
        name: invite.name ?? "Gestante",
        enterpriseName: invite.enterprises?.name,
        inviteLink,
      });

      return { success: true };
    });
  ```
- **MIRROR**: `apps/web/src/services/invite.ts:374-376` (`resendTeamInvite`'s `status === "aceito"` block) for the analogous `status === "usado"` block here
- **IMPORTS**: add `dayjs` (already a project dependency, no new install)
- **GOTCHA**: Use **7 days**, not team invites' 4 days — `patient_invite_links.expires_at` DB default is `now() + interval '7 days'` (`packages/supabase/supabase/migrations/20260710000001_patient_invite_links_extend.sql:5`); reusing the 4-day duration here would be an inconsistent, invented window
- **GOTCHA**: Only revive when `status !== "pendente"` — resending an already-active invite should just re-send the same email without touching `expires_at` (matches `resendTeamInvite`'s spirit of only needing to act on non-active invites, though team's version is unconditional since it's cheap; here we avoid needlessly shortening/moving a still-valid window)
- **VALIDATE**: `pnpm check-types && pnpm exec biome lint apps/web/src/actions/send-patient-invite-email-action.ts`

### Task 3: CREATE `apps/web/src/components/shared/invite-status-badge.tsx`

- **ACTION**: CREATE new shared component
- **IMPLEMENT**: (see STATUS_BADGE_CONFIG pattern above) — export both `getInviteStatusConfig(status: string)` and `InviteStatusBadge({ status }: { status: string })`
- **MIRROR**: `apps/web/src/components/billing/status-badge.tsx:1-11` + `apps/web/src/lib/billing/calculations.ts:255-270`
- **IMPORTS**: `Badge` from `@ventre/ui/badge`
- **GOTCHA**: `status` is `string`, not a literal union (per `apps/web/src/types/index.ts` — both tables use free-text status), so the config map must have a fallback branch (`?? { label: status, variant: "secondary" }`), not a TS-exhaustive switch
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/components/shared/received-invite-card.tsx`

- **ACTION**: CREATE new component, extracting the existing inline card JSX from `invites-screen.tsx:79-138`
- **IMPLEMENT**:
  ```tsx
  "use client";

  import { InviteStatusBadge } from "@/components/shared/invite-status-badge";
  import { calculateGestationalAge } from "@/lib/gestational-age";
  import type { Invite } from "@/types";
  import { professionalTypeLabels } from "@/utils/team";
  import { Button } from "@ventre/ui/button";
  import { Card, CardContent } from "@ventre/ui/card";
  import dayjs from "dayjs";
  import { Baby, Calendar } from "lucide-react";

  type ReceivedInviteCardProps = {
    invite: Invite;
    isActive: boolean;
    processing: boolean;
    onAccept: () => void;
    onReject: () => void;
  };

  export function ReceivedInviteCard({
    invite,
    isActive,
    processing,
    onAccept,
    onReject,
  }: ReceivedInviteCardProps) {
    const gestationalAge = calculateGestationalAge(invite.patient?.pregnancies?.[0]?.dum ?? null);

    return (
      <Card className={isActive ? undefined : "opacity-60"}>
        <CardContent className="space-y-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <div>
                Enviado por: <span className="font-semibold">{invite.inviter?.name}</span>
              </div>
              <InviteStatusBadge status={invite.status} />
            </div>
            <div>
              Gestante: <span className="font-semibold">{invite.patient?.name}</span>
            </div>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1 text-muted-foreground text-sm sm:gap-4">
              {invite.patient?.pregnancies?.[0]?.dum && (
                <div className="flex items-center gap-1">
                  <Baby className="h-4 w-4" />
                  <span>
                    {gestationalAge?.weeks} semanas{" "}
                    {gestationalAge?.days ? `e ${gestationalAge.days} dias` : null}
                  </span>
                </div>
              )}
              {invite.patient?.pregnancies?.[0]?.due_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>DPP: {dayjs(invite.patient.pregnancies[0].due_date).format("DD/MM/YYYY")}</span>
                </div>
              )}
              <span>Expira em {dayjs(invite.expires_at).format("DD/MM/YYYY")}</span>
            </div>
            {isActive && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={onReject} disabled={processing} className="flex-1">
                  Recusar
                </Button>
                <Button onClick={onAccept} disabled={processing} className="gradient-primary flex-1">
                  Aceitar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  ```
- **MIRROR**: `apps/web/src/screens/invites-screen.tsx:79-138` (JSX being extracted, unchanged), `apps/web/src/components/shared/pending-invite-card.tsx:21` (`opacity-60` for inactive)
- **VALIDATE**: `pnpm check-types`

### Task 5: CREATE `apps/web/src/components/shared/sent-team-invite-card.tsx`

- **ACTION**: CREATE new component
- **IMPLEMENT**:
  ```tsx
  "use client";

  import { InviteStatusBadge } from "@/components/shared/invite-status-badge";
  import type { SentTeamInvite } from "@/types";
  import { professionalTypeLabels } from "@/utils/team";
  import { Button } from "@ventre/ui/button";
  import { Card, CardContent } from "@ventre/ui/card";
  import dayjs from "dayjs";
  import { Loader2, Send } from "lucide-react";

  type SentTeamInviteCardProps = {
    invite: SentTeamInvite;
    isActive: boolean;
    resending: boolean;
    onResend: () => void;
  };

  export function SentTeamInviteCard({ invite, isActive, resending, onResend }: SentTeamInviteCardProps) {
    const canResend = invite.status !== "aceito";

    return (
      <Card className={isActive ? undefined : "opacity-60"}>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <div className="space-y-1 text-sm">
              <div>
                Paciente: <span className="font-semibold">{invite.patient?.name ?? "—"}</span>
              </div>
              <div>
                Profissional:{" "}
                <span className="font-semibold">
                  {invite.invitedProfessional?.name ?? "Convite por link (aguardando)"}
                </span>
                {invite.invitedProfessional?.professional_type && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {professionalTypeLabels[invite.invitedProfessional.professional_type] ??
                      invite.invitedProfessional.professional_type}
                  </span>
                )}
              </div>
            </div>
            <InviteStatusBadge status={invite.status} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground text-sm">
              Expira em {dayjs(invite.expires_at).format("DD/MM/YYYY")}
            </span>
            {canResend && (
              <Button variant="outline" size="sm" disabled={resending} onClick={onResend}>
                {resending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Reenviar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/pending-invite-card.tsx` structure (`opacity-60`, `Badge`), `apps/web/src/utils/team.ts` for `professionalTypeLabels`
- **GOTCHA**: `invite.invitedProfessional` is `null` for link-share invites not yet accepted (Phase 2 GOTCHA, `invite.ts:166`) — always render a fallback string, never assume it's populated
- **VALIDATE**: `pnpm check-types`

### Task 6: CREATE `apps/web/src/components/shared/sent-patient-invite-card.tsx`

- **ACTION**: CREATE new component
- **IMPLEMENT**:
  ```tsx
  "use client";

  import { InviteStatusBadge } from "@/components/shared/invite-status-badge";
  import type { SentPatientInvite } from "@/types";
  import { Button } from "@ventre/ui/button";
  import { Card, CardContent } from "@ventre/ui/card";
  import dayjs from "dayjs";
  import { Loader2, Send } from "lucide-react";

  type SentPatientInviteCardProps = {
    invite: SentPatientInvite;
    isActive: boolean;
    resending: boolean;
    onResend: () => void;
  };

  export function SentPatientInviteCard({
    invite,
    isActive,
    resending,
    onResend,
  }: SentPatientInviteCardProps) {
    const canResend = invite.status !== "usado" && !!invite.email;

    return (
      <Card className={isActive ? undefined : "opacity-60"}>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <div className="space-y-1 text-sm">
              <div>
                Gestante:{" "}
                <span className="font-semibold">
                  {invite.patient?.name ?? invite.name ?? "—"}
                </span>
              </div>
              {invite.email && <div className="text-muted-foreground">{invite.email}</div>}
            </div>
            <InviteStatusBadge status={invite.status} />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground text-sm">
              Expira em {dayjs(invite.expires_at).format("DD/MM/YYYY")}
            </span>
            {canResend && (
              <Button variant="outline" size="sm" disabled={resending} onClick={onResend}>
                {resending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Reenviar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
  ```
- **MIRROR**: Same structure as Task 5's card
- **GOTCHA**: `invite_type === "new_patient"` invites have `patient: null` (no linked patient row yet — the patient doesn't exist until they register); always fall back to `invite.name`
- **GOTCHA**: Hide/disable Reenviar when `!invite.email` — `sendPatientInviteEmailAction` throws server-side if there's no email, but the UI should not offer a button that will always fail
- **VALIDATE**: `pnpm check-types`

### Task 7: CREATE `apps/web/src/modals/resend-team-invite-modal.tsx`

- **ACTION**: CREATE new modal, adapted from `patient-invite-share-modal.tsx` (see SHARE_MODAL_TEMPLATE pattern above)
- **IMPLEMENT**:
  ```tsx
  "use client";

  import CustomIcon from "@/components/shared/custom-icon";
  import { Button } from "@ventre/ui/button";
  import { ContentModal } from "@ventre/ui/shared/content-modal";
  import { Check, Copy } from "lucide-react";
  import { useState } from "react";
  import { toast } from "sonner";

  type ResendTeamInviteModalProps = {
    inviteId: string;
    patientName: string;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
  };

  export default function ResendTeamInviteModal({
    inviteId,
    patientName,
    isOpen,
    setIsOpen,
  }: ResendTeamInviteModalProps) {
    const [isCopied, setIsCopied] = useState(false);

    function handleCloseModal() {
      setIsOpen(false);
      setIsCopied(false);
    }

    function getInviteUrl() {
      if (typeof window === "undefined") return "";
      return `${window.location.origin}/invites/${inviteId}`;
    }

    async function handleCopyLink() {
      await navigator.clipboard.writeText(getInviteUrl());
      setIsCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setIsCopied(false), 2000);
    }

    function handleShareWhatsApp() {
      const message = `Olá! Estou te convidando para participar da uma equipe de cuidado de ${patientName} no VentreApp. Acesse o link para ver o convite: ${getInviteUrl()}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
    }

    return (
      <ContentModal open={isOpen} onOpenChange={handleCloseModal} title="Convite reenviado">
        <div className="space-y-4 pt-2">
          <p className="text-muted-foreground text-sm">
            O convite foi reativado. Compartilhe o link novamente com a profissional.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopyLink}>
              {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {isCopied ? "Copiado!" : "Copiar link"}
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleShareWhatsApp}>
              <CustomIcon icon="whatsapp" className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>
      </ContentModal>
    );
  }
  ```
- **MIRROR**: `apps/web/src/modals/patient-invite-share-modal.tsx:1-100` structurally; link shape from `apps/web/src/modals/invite-professional-modal.tsx:113-116` (`${origin}/invites/${inviteId}`)
- **GOTCHA**: No "Enviar por e-mail" button — unlike `patient_invite_links`, `team_invites` has no email column for the invitee (confirmed in Phase 3's plan Solution Statement)
- **VALIDATE**: `pnpm check-types`

### Task 8: UPDATE `apps/web/app/(dashboard)/invites/page.tsx`

- **ACTION**: REPLACE content to fetch all 3 listings in parallel
- **IMPLEMENT**:
  ```tsx
  "use server";
  import InvitesScreen from "@/screens/invites-screen";
  import { getReceivedInvites, getSentPatientInvites, getSentTeamInvites } from "@/services/invite";

  export default async function InvitesPage() {
    const [received, sentTeam, sentPatient] = await Promise.all([
      getReceivedInvites(),
      getSentTeamInvites(),
      getSentPatientInvites(),
    ]);

    return (
      <InvitesScreen
        received={received.data ?? { active: [], inactive: [] }}
        sentTeam={sentTeam.data ?? { active: [], inactive: [] }}
        sentPatient={sentPatient.data ?? { active: [], inactive: [] }}
      />
    );
  }
  ```
- **MIRROR**: `apps/web/app/(dashboard)/invites/page.tsx:1-9` (existing structure/style), `Promise.all` pattern already used in `patient-team-screen.tsx`-adjacent server fetches for parallel independent queries
- **GOTCHA**: Each of the 3 service functions already returns `{ error }` on auth failure — this route doesn't currently handle a top-level auth-required redirect (matches existing behavior, unchanged), so falling back to `{ active: [], inactive: [] }` on error keeps the page rendering (with empty states) rather than crashing
- **VALIDATE**: `pnpm check-types`

### Task 9: REWRITE `apps/web/src/screens/invites-screen.tsx`

- **ACTION**: Full rewrite — `Tabs` (Recebidos default / Enviados), 3 sections using Tasks 3-7's components
- **IMPLEMENT**:
  ```tsx
  "use client";

  import { respondInviteAction } from "@/actions/respond-invite-action";
  import { resendTeamInviteAction } from "@/actions/resend-team-invite-action";
  import { sendPatientInviteEmailAction } from "@/actions/send-patient-invite-email-action";
  import { Header } from "@/components/layouts/header";
  import { EmptyState } from "@/components/shared/empty-state";
  import { PageHeader } from "@/components/shared/page-header";
  import { ReceivedInviteCard } from "@/components/shared/received-invite-card";
  import { SentPatientInviteCard } from "@/components/shared/sent-patient-invite-card";
  import { SentTeamInviteCard } from "@/components/shared/sent-team-invite-card";
  import ResendTeamInviteModal from "@/modals/resend-team-invite-modal";
  import type { Invite, SentPatientInvite, SentTeamInvite } from "@/types";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventre/ui/tabs";
  import { Baby, Mail, UserPlus } from "lucide-react";
  import { useAction } from "next-safe-action/hooks";
  import { useRouter, redirect } from "next/navigation";
  import { useState } from "react";
  import { toast } from "sonner";

  type InviteBucket<T> = { active: T[]; inactive: T[] };

  type InvitesScreenProps = {
    received: InviteBucket<Invite>;
    sentTeam: InviteBucket<SentTeamInvite>;
    sentPatient: InviteBucket<SentPatientInvite>;
  };

  export default function InvitesScreen({ received, sentTeam, sentPatient }: InvitesScreenProps) {
    const router = useRouter();

    // Recebidos — unchanged local-filter pattern
    const [receivedActive, setReceivedActive] = useState<Invite[]>(received.active);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const { executeAsync: executeRespond } = useAction(respondInviteAction);

    async function handleRespond(inviteId: string, action: "accept" | "reject") {
      setProcessingId(inviteId);
      const result = await executeRespond({ inviteId, action });

      if (result?.serverError) {
        toast.error(result.serverError);
        setProcessingId(null);
        return;
      }

      if (action === "accept") {
        const invite = receivedActive.find((i) => i.id === inviteId);
        toast.success("Convite aceito!", {
          action: invite?.patient
            ? {
                label: `Ver perfil de ${invite.patient.name.split(" ")[0]}`,
                onClick: () => redirect(`/patients/${invite.patient?.id}`),
              }
            : undefined,
        });
      } else {
        toast.success("Convite rejeitado");
      }

      setReceivedActive(receivedActive.filter((i) => i.id !== inviteId));
      setProcessingId(null);
    }

    // Enviados — resend via router.refresh()
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [shareModalInvite, setShareModalInvite] = useState<SentTeamInvite | null>(null);

    const { executeAsync: executeResendTeam } = useAction(resendTeamInviteAction);
    const { executeAsync: executeResendPatient } = useAction(sendPatientInviteEmailAction);

    async function handleResendTeam(invite: SentTeamInvite) {
      setResendingId(invite.id);
      const result = await executeResendTeam({ inviteId: invite.id });
      setResendingId(null);

      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }

      toast.success("Convite reenviado!");
      setShareModalInvite(invite);
      router.refresh();
    }

    async function handleResendPatient(inviteId: string) {
      setResendingId(inviteId);
      const result = await executeResendPatient({ inviteId });
      setResendingId(null);

      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }

      toast.success("Convite reenviado por e-mail!");
      router.refresh();
    }

    return (
      <div>
        <Header title="Convites" />
        <div className="p-4 pt-0 md:p-6 md:pt-0">
          <PageHeader description="Gerencie convites enviados e recebidos" />

          <Tabs defaultValue="received" className="mt-4">
            <TabsList className="mb-4 w-full max-w-xs">
              <TabsTrigger value="received">
                Recebidos
                {receivedActive.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary text-xs">
                    {receivedActive.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="sent">Enviados</TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="space-y-6">
              {receivedActive.length === 0 && received.inactive.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="Nenhum convite pendente"
                  description="Você não tem convites pendentes para participar de equipes."
                />
              ) : (
                <>
                  {receivedActive.length > 0 && (
                    <div className="space-y-4">
                      {receivedActive.map((invite) => (
                        <ReceivedInviteCard
                          key={invite.id}
                          invite={invite}
                          isActive
                          processing={processingId === invite.id}
                          onAccept={() => handleRespond(invite.id, "accept")}
                          onReject={() => handleRespond(invite.id, "reject")}
                        />
                      ))}
                    </div>
                  )}
                  {received.inactive.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-medium text-muted-foreground text-sm">
                        Expirados e recusados
                      </h3>
                      {received.inactive.map((invite) => (
                        <ReceivedInviteCard
                          key={invite.id}
                          invite={invite}
                          isActive={false}
                          processing={false}
                          onAccept={() => {}}
                          onReject={() => {}}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="sent" className="space-y-8">
              <section className="space-y-4">
                <h2 className="font-semibold text-lg">Gestantes</h2>
                {sentPatient.active.length === 0 && sentPatient.inactive.length === 0 ? (
                  <EmptyState
                    icon={Baby}
                    title="Nenhum convite enviado"
                    description="Convites para gestantes se autocadastrarem aparecerão aqui."
                  />
                ) : (
                  <>
                    <div className="space-y-4">
                      {sentPatient.active.map((invite) => (
                        <SentPatientInviteCard
                          key={invite.id}
                          invite={invite}
                          isActive
                          resending={resendingId === invite.id}
                          onResend={() => handleResendPatient(invite.id)}
                        />
                      ))}
                    </div>
                    {sentPatient.inactive.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-medium text-muted-foreground text-sm">
                          Expirados e usados
                        </h3>
                        {sentPatient.inactive.map((invite) => (
                          <SentPatientInviteCard
                            key={invite.id}
                            invite={invite}
                            isActive={false}
                            resending={resendingId === invite.id}
                            onResend={() => handleResendPatient(invite.id)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className="space-y-4">
                <h2 className="font-semibold text-lg">Profissionais</h2>
                {sentTeam.active.length === 0 && sentTeam.inactive.length === 0 ? (
                  <EmptyState
                    icon={UserPlus}
                    title="Nenhum convite enviado"
                    description="Convites para profissionais integrarem equipes de cuidado aparecerão aqui."
                  />
                ) : (
                  <>
                    <div className="space-y-4">
                      {sentTeam.active.map((invite) => (
                        <SentTeamInviteCard
                          key={invite.id}
                          invite={invite}
                          isActive
                          resending={resendingId === invite.id}
                          onResend={() => handleResendTeam(invite)}
                        />
                      ))}
                    </div>
                    {sentTeam.inactive.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="font-medium text-muted-foreground text-sm">
                          Expirados e recusados
                        </h3>
                        {sentTeam.inactive.map((invite) => (
                          <SentTeamInviteCard
                            key={invite.id}
                            invite={invite}
                            isActive={false}
                            resending={resendingId === invite.id}
                            onResend={() => handleResendTeam(invite)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </section>
            </TabsContent>
          </Tabs>
        </div>

        {shareModalInvite && (
          <ResendTeamInviteModal
            inviteId={shareModalInvite.id}
            patientName={shareModalInvite.patient?.name ?? "a paciente"}
            isOpen={!!shareModalInvite}
            setIsOpen={(open) => !open && setShareModalInvite(null)}
          />
        )}
      </div>
    );
  }
  ```
- **MIRROR**: `apps/web/src/screens/users-screen.tsx:84-156` (Tabs structure), original `invites-screen.tsx:29-58` (accept/reject logic, unchanged)
- **IMPORTS**: `redirect` from `next/navigation` for the toast action callback (existing pattern, unchanged from before); `useRouter` also from `next/navigation` for `router.refresh()`
- **GOTCHA**: `received.inactive`/`sentTeam.inactive`/`sentPatient.inactive` are **not** re-synced from props after a `router.refresh()` the way `receivedActive` local state would be — because they're read directly from props (`received.inactive`, not a `useState` mirror), a Server Component re-render via `router.refresh()` naturally updates them. Only `receivedActive` needs local `useState` because accept/reject uses the filter-not-refresh pattern; don't add unnecessary `useState` mirrors for the other two buckets.
- **GOTCHA**: `handleResendTeam` opens the share modal using the invite object captured **before** `router.refresh()` — `shareModalInvite.id` doesn't change on resend (same row, in-place update), so this is safe and doesn't need to wait for the refreshed props
- **VALIDATE**: `pnpm check-types && pnpm exec biome lint --write apps/web/src/screens/invites-screen.tsx`

---

## Testing Strategy

No test runner is configured in this repo (confirmed by Phases 2/3's plans — no `*.test.ts` files exist near `screens/`/`actions/`). Validation is type-checking, Biome, and browser validation (Level 5/6).

### Edge Cases Checklist

- [ ] Received: 0 active + 0 inactive → single `EmptyState`, no section headers
- [ ] Received: 0 active + N inactive → no active list, "Expirados e recusados" header + dimmed cards, no accept/reject buttons anywhere
- [ ] Sent (Gestantes): `invite_type = "new_patient"` row (`patient: null`) renders `invite.name` as the display name, no crash
- [ ] Sent (Gestantes): row with `email: null` — Reenviar button hidden/absent
- [ ] Sent (Gestantes): resend an `expirado` invite → toast success, `router.refresh()` fires, row reappears under "active" after refresh with a new `expires_at` (server-side verified via Task 2)
- [ ] Sent (Profissionais): `invitedProfessional: null` (link-share, unaccepted) → fallback text renders, no crash
- [ ] Sent (Profissionais): resend an `expirado`/`rejeitado` invite → toast, share modal opens with copy-link/WhatsApp, `router.refresh()` fires
- [ ] Sent (Profissionais): `status === "aceito"` → Reenviar button absent
- [ ] Tab switch (Recebidos ↔ Enviados) preserves each tab's local state (no remount-driven data loss) — Radix `Tabs` keeps both `TabsContent` trees mounted-but-hidden by default only if `forceMount` is used; confirm actual mount behavior doesn't reset `resendingId`/`processingId` mid-action (unlikely given these are short-lived scalars, but verify no console warnings)
- [ ] Mobile viewport (`<640px`): `ResendTeamInviteModal` renders as a bottom Sheet (via `ContentModal`), not a centered Dialog

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/screens/invites-screen.tsx apps/web/src/components/shared/invite-status-badge.tsx apps/web/src/components/shared/received-invite-card.tsx apps/web/src/components/shared/sent-team-invite-card.tsx apps/web/src/components/shared/sent-patient-invite-card.tsx apps/web/src/modals/resend-team-invite-modal.tsx apps/web/app/\(dashboard\)/invites/page.tsx apps/web/src/actions/send-patient-invite-email-action.ts apps/web/src/services/invite.ts
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

Not applicable — no schema changes in this phase (Phase 1 already shipped `patient_invite_links.status`).

### Level 5: BROWSER_VALIDATION

Use Browser MCP or manual testing against a dev server (`pnpm dev --filter=web`), logged in as a professional with a mix of seeded invite states:

- [ ] `/invites` loads, defaults to Recebidos tab
- [ ] Recebidos: accept an invite → success toast, card disappears, "Ver perfil" toast action navigates correctly
- [ ] Recebidos: reject an invite → success toast, card disappears
- [ ] Enviados tab: both sections (Gestantes/Profissionais) render with correct counts, active above inactive
- [ ] Enviados → Gestantes: click Reenviar on an expired invite → toast, page refreshes, invite now shows under active with new expiry
- [ ] Enviados → Profissionais: click Reenviar → toast, share modal opens, copy-link works (clipboard), WhatsApp button opens `wa.me` in a new tab
- [ ] Resize to mobile width mid-session → `ResendTeamInviteModal` becomes a bottom sheet
- [ ] Empty-state professional (no invites of any kind) sees 3 distinct `EmptyState`s (one per section/tab), no errors

### Level 6: MANUAL_VALIDATION

Seed at least one row per status per table (`team_invites`: pendente/aceito/rejeitado/expirado; `patient_invite_links`: pendente/usado/expirado, one with `email: null`) via `mcp__supabase__execute_sql` on a branch/local DB, then walk the Level 5 checklist against that seeded data.

---

## Acceptance Criteria

- [ ] `/invites` shows a `Tabs` with Recebidos (default) and Enviados
- [ ] Enviados has two sections (Gestantes, Profissionais), each split active/inactive
- [ ] Every sent invite (except `aceito`/`usado`) has a working Reenviar button
- [ ] Reenviar on an expired `team_invites` row resets it to `pendente` with a new 4-day `expires_at` and opens a share modal
- [ ] Reenviar on an expired `patient_invite_links` row resets it to `pendente` with a new 7-day `expires_at` and re-sends the email
- [ ] Recebidos accept/reject behavior is unchanged from today (same toasts, same local-filter removal)
- [ ] Expired/rejected invites render dimmed, in a separate list below active ones, in every section
- [ ] `getMyInvites` is removed with zero remaining references
- [ ] Level 1 (`pnpm check-types`, `biome lint`) passes with exit 0
- [ ] Level 3 (`pnpm build`) succeeds
- [ ] Level 5 browser checklist passes on both desktop and mobile viewport widths

---

## Completion Checklist

- [ ] All 9 tasks completed in order (services/actions before components before the screen that imports them)
- [ ] Each task validated immediately (`pnpm check-types`) after completion
- [ ] Level 1: Static analysis passes
- [ ] Level 3: Full build succeeds
- [ ] Level 5: Browser validation checklist executed (desktop + mobile)
- [ ] Level 6: Manual checklist executed against seeded data covering all status combinations
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| `sendPatientInviteEmailAction`'s new revive logic (Task 2) is the only behavior change to an already-shipped action — could regress the existing "resend an active invite" flow if the `status !== "pendente"` branch has a bug | L | M | The branch is a no-op for `status === "pendente"` (the common case), isolating risk to the previously-broken expired-resend path only; validated via Level 5/6 checklists covering both cases explicitly |
| `router.refresh()` after a resend re-fetches all 3 listings server-side, which could feel slower than the instant local-filter used for accept/reject | M | L | Acceptable per the research pass's recommendation (server as source of truth for a *move*, not a removal); if perceived latency becomes a real complaint post-launch, `useOptimisticAction` is a documented upgrade path, not a rewrite |
| Two ARIA ordering/ "Gestantes"/"Profissionais" `<h2>` sections inside a single `TabsContent` is a slightly unusual heading hierarchy (no `TabsList` between them) | L | L | Matches the PRD's explicit "duas seções" wording; not a nested-Tabs pattern, so no additional ARIA `tablist` semantics are introduced — plain `<section>`/`<h2>` is standard document structure |
| Removing `getMyInvites` (Task 1) could break an untracked caller (e.g., a script, a Storybook file, an integration test) not caught by the `grep` | L | L | `grep -rn` was already run and returned only `page.tsx`; re-run immediately before Task 1's deletion as the task's own first step, per its VERIFY FIRST instruction |

---

## Notes

- This is the final phase of the PRD (`.claude/PRPs/prds/invites-management-screen.prd.md`) — completing it fulfills the "MVP completo" scope described there (both tabs, both sections, resend, cron-driven expiration).
- The PRD's Open Question about default tab ("provavelmente Recebidos") is resolved here as **Recebidos**, matching the PRD's own stated rationale (existing, more actionable flow) — no further validation needed before implementation, though it remains flagged in the PRD as something to revisit post-launch based on real usage.
- Task 2's extension to `sendPatientInviteEmailAction` was not anticipated by Phase 3's plan (which scoped resend work to `team_invites` only, treating the existing action as sufficient for patient invites) — this plan's research surfaced that the existing action doesn't actually work for the expired case, which Phase 4's UI would otherwise expose as a visible bug (a "Reenviar" button that resends a dead link). This is the one place this plan reopens an "already complete" phase's file, and it's called out explicitly for that reason.

---

*Generated: 2026-08-18*
