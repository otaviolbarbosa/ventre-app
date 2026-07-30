# Feature: PostHog Analytics Integration

## Summary

Integrate PostHog product analytics into `apps/web` (Next.js 16.1, App Router, React 19). Install `posthog-js` (client) and `posthog-node` (server), initialize a client-side singleton via `instrumentation-client.ts`, mount a `PostHogProvider` in the existing provider tree, capture `$pageview` on every client-side route change via a `usePathname`/`useSearchParams` component, and add server-side `posthog.capture()` calls to every mutating server action in `apps/web/src/actions/` (including `complete-registration-action.ts` for signup), using the authenticated user's id as `distinctId`.

## User Story

As a product/growth stakeholder
I want every page view and every meaningful user action (signup, patient CRUD, billing, appointments, etc.) tracked in PostHog
So that we can analyze funnels, retention, and feature usage across the app

## Problem Statement

The app currently has zero analytics instrumentation — `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`/`NEXT_PUBLIC_POSTHOG_HOST` exist in `.env.local` but nothing consumes them, no `posthog-js`/`posthog-node` deps are installed, and no page view or server action is tracked anywhere in the codebase (verified via full-tree grep).

## Solution Statement

Add PostHog's classic (stable) Next.js App Router integration: `instrumentation-client.ts` for client init, a `PosthogProvider` component slotted into the existing `Providers` composition tree (`apps/web/src/providers/index.tsx`), a `Suspense`-wrapped pageview-capture component that fires on every `pathname`/`searchParams` change (covers all pages automatically — no per-page edits needed), a `posthog-node` singleton helper for server-side capture, and a mechanical sweep adding one `posthog.capture()` call to every mutating action file in `apps/web/src/actions/`.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                        |
| Complexity       | MEDIUM                                                                 |
| Systems Affected | `apps/web` root layout/providers, `apps/web/next.config.js`, `apps/web/src/actions/*` (62 files), `apps/web/src/lib` |
| Dependencies     | `posthog-js` (client SDK), `posthog-node` (server SDK)                |
| Estimated Tasks  | 9 (8 setup/infra tasks + 1 mechanical batch sweep over 62 action files) |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════╗
║  User navigates app, submits forms, signs up                   ║
║  → No event is ever recorded anywhere                          ║
║  → Product team has no visibility into usage or funnels         ║
╚═══════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════╗
║  User navigates app (route change)                             ║
║    → PostHogPageView captures $pageview { $current_url }        ║
║  User submits signup / creates patient / cancels subscription…  ║
║    → server action captures a named event, distinctId = user.id ║
║  → PostHog dashboard shows pageviews + product funnels          ║
╚═══════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| Every route change (all pages, via root layout) | No tracking | `$pageview` captured client-side | None visible — background telemetry |
| `complete-registration-action.ts` | Signup succeeds silently | `signup_completed` (name: `complete_registration`) captured server-side | None visible |
| All mutating actions in `src/actions/` | Mutation succeeds silently | Named event captured server-side | None visible |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/app/layout.tsx` | 61-83 | Single root layout — only place `<Providers>` is mounted for every route |
| P0 | `apps/web/src/providers/index.tsx` | 1-25 | Provider composition pattern to extend |
| P1 | `apps/web/src/providers/pwa-provider.tsx` | 19-54 | `useEffect`-for-browser-API idiom to mirror for PostHog init/mount |
| P1 | `apps/web/src/lib/safe-action.ts` | 1-37 | `authActionClient` ctx shape — `ctx.user.id` is the `distinctId` source |
| P1 | `apps/web/src/actions/complete-registration-action.ts` | 1-91 | Signup flow — capture insertion point after `signUpData.user.id` is known |
| P2 | `apps/web/src/actions/add-patient-action.ts` | 11-77 | Pattern for "side-effect after main mutation, before return" (mirrors `updateTag`/`insertActivityLog` call site) |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [PostHog Next.js docs](https://posthog.com/docs/libraries/next-js) | Add PostHog to your Next.js app | `instrumentation-client.ts` init pattern, manual pageview capture with `Suspense` |
| [PostHog Node.js SDK reference](https://posthog.com/docs/references/posthog-node) | Server-side capture | Singleton client, `flushAt`/`flushInterval`, `shutdown()` requirement in serverless contexts |

**Key gotchas from research:**
- `posthog-js` 2026 default (`defaults: '<date>'`) auto-captures SPA pageviews — we explicitly set `capture_pageview: false` because the user wants the manual `posthog.capture('$pageview', { $current_url: url })` call.
- `useSearchParams()` forces the segment out of static rendering unless wrapped in `<Suspense>` — omitting this causes a Next.js build error.
- `posthog-node` in Server Actions (serverless): without `flushAt: 1, flushInterval: 0` + `await posthog.shutdown()` (or `flush()`), the function can return before the batched HTTP call completes and the event is silently dropped.
- Env var names already match official docs (`NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, `NEXT_PUBLIC_POSTHOG_HOST`) — do **not** rename to `NEXT_PUBLIC_POSTHOG_KEY` (that belongs to the separate, pre-release `@posthog/next` package).

---

## Patterns to Mirror

**PROVIDER_COMPOSITION** (source: `apps/web/src/providers/index.tsx:1-25`):
```tsx
"use client";
import { ConfirmationModalProvider } from "@ventre/ui/contexts/confirmation-modal-provider";
import { Toaster } from "@ventre/ui/sonner";
import { PwaInstallBanner } from "@/components/shared/pwa-install-banner";
import { AuthProvider } from "./auth-provider";
import { NotificationsProvider } from "./notifications-provider";
import { PwaProvider } from "./pwa-provider";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <NotificationsProvider>
          <PwaProvider>
            <ConfirmationModalProvider>{children}</ConfirmationModalProvider>
            <PwaInstallBanner />
            <Toaster />
          </PwaProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

**BROWSER_EFFECT_INIT** (source: `apps/web/src/providers/pwa-provider.tsx:19-54`):
```tsx
useEffect(() => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
}, []);
```
→ Mirror this exact one-effect-on-mount shape for `posthog.init(...)`.

**SAFE_ACTION_CTX** (source: `apps/web/src/lib/safe-action.ts:9-37`):
```ts
export const authActionClient = actionClient.use(async ({ next }) => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  // ...
  return next({ ctx: { supabase, supabaseAdmin, user, profile } });
});
```
→ `ctx.user.id` is the `distinctId` for every `authActionClient`-based action.

**ACTION_MUTATION_THEN_SIDE_EFFECT** (source: `apps/web/src/actions/add-patient-action.ts`, `updateTag`/`insertActivityLog` call site) — capture calls go in the same spot: after the core mutation succeeds, before `return`.

**SIGNUP_ACTION** (source: `apps/web/src/actions/complete-registration-action.ts:52-89`, full relevant excerpt):
```ts
const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
  email: finalEmail,
  password,
  options: { data: { name: finalName, professional_type: invite.professional_type } },
});
if (signUpError || !signUpData.user) throw new Error(signUpError?.message ?? "Erro ao criar conta.");

// ...updates users row, links enterprise...

await (supabaseAdmin as any)
  .from("registration_invites")
  .update({ completed_at: new Date().toISOString() })
  .eq("id", inviteId);

return { email: finalEmail };
```
→ Capture `complete_registration` right after `signUpData.user.id` is known and all downstream writes succeed (immediately before `return`), using `signUpData.user.id` as `distinctId` (this action uses plain `actionClient`, no `ctx.user`).

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/package.json` | UPDATE | Add `posthog-js`, `posthog-node` deps |
| `apps/web/instrumentation-client.ts` | CREATE | Client-side PostHog init (module load, per Next 15.3+/16 convention) |
| `apps/web/src/providers/posthog-provider.tsx` | CREATE | `PostHogProvider` (from `posthog-js/react`) wrapper, mirrors `pwa-provider.tsx` shape |
| `apps/web/src/components/shared/posthog-pageview.tsx` | CREATE | `Suspense`-wrapped `usePathname`/`useSearchParams` component that calls `posthog.capture('$pageview', { $current_url: url })` |
| `apps/web/src/providers/index.tsx` | UPDATE | Mount `PosthogProvider` as outermost wrapper (so any provider/component can later call `usePostHog()`) |
| `apps/web/src/lib/posthog/server.ts` | CREATE | `posthog-node` singleton + `captureServerEvent` helper with `shutdown()` |
| `apps/web/src/actions/complete-registration-action.ts` | UPDATE | Capture `complete_registration` after successful signup |
| `apps/web/src/actions/*.ts` (61 remaining mutating action files, see Task 9 table) | UPDATE | Capture one named event per action after successful mutation |

---

## NOT Building (Scope Limits)

- **Reverse-proxy `/ingest` rewrites in `next.config.js`** — PostHog recommends this for ad-blocker resilience, but it wasn't requested and adds config-level risk (trailing-slash behavior, region-specific asset hosts). Can be added later without touching any capture call sites.
- **`posthog.identify()` calls** (tying anonymous pre-login events to the logged-in user) — not requested; `AuthProvider` would be the natural place to add this later.
- **Feature flags / session replay / surveys** — out of scope, this is pageview + event capture only.
- **Route Handlers (`app/api/**/route.ts`)** — user asked specifically for pages + `src/actions/`; route handlers are not touched.
- **`@posthog/next` (pre-release unified package)** — using stable `posthog-js` + `posthog-node` instead, per research findings.

---

## Step-by-Step Tasks

### Task 1: Install dependencies

- **ACTION**: Add `posthog-js` and `posthog-node` to `apps/web/package.json`
- **COMMAND**: `pnpm --filter web add posthog-js posthog-node`
- **VALIDATE**: `grep -E '"posthog-(js|node)"' apps/web/package.json` shows both

### Task 2: CREATE `apps/web/instrumentation-client.ts`

- **ACTION**: Initialize the `posthog-js` client singleton at module load
- **IMPLEMENT**:
```ts
import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  capture_pageview: false, // manual $pageview capture — see posthog-pageview.tsx
  person_profiles: "identified_only",
});
```
- **GOTCHA**: Do NOT also call `posthog.init` inside a provider `useEffect` — this file is the single init point (Next 16 loads `instrumentation-client.ts` once, client-side, before hydration).
- **VALIDATE**: `pnpm check-types` from repo root

### Task 3: CREATE `apps/web/src/components/shared/posthog-pageview.tsx`

- **ACTION**: Capture `$pageview` on every route change
- **IMPLEMENT**:
```tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import posthog from "posthog-js";

function PostHogPageViewInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    if (searchParams.toString()) url += `?${searchParams.toString()}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PosthogPageView() {
  return (
    <Suspense fallback={null}>
      <PostHogPageViewInner />
    </Suspense>
  );
}
```
- **MIRROR**: `apps/web/src/providers/pwa-provider.tsx:19-54` — single `useEffect` on dependency change
- **GOTCHA**: `useSearchParams()` requires the `Suspense` boundary or `next build` fails
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/providers/posthog-provider.tsx`

- **ACTION**: Wrap children in `PostHogProvider` context and mount the pageview component
- **IMPLEMENT**:
```tsx
"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { PosthogPageView } from "@/components/shared/posthog-pageview";

export function PosthogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PostHogProvider client={posthog}>
      <PosthogPageView />
      {children}
    </PostHogProvider>
  );
}
```
- **MIRROR**: `apps/web/src/providers/notifications-provider.tsx` — thin wrapper shape
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/providers/index.tsx`

- **ACTION**: Mount `PosthogProvider` as the outermost wrapper
- **IMPLEMENT**:
```tsx
"use client";

import { ConfirmationModalProvider } from "@ventre/ui/contexts/confirmation-modal-provider";
import { Toaster } from "@ventre/ui/sonner";
import { PwaInstallBanner } from "@/components/shared/pwa-install-banner";
import { AuthProvider } from "./auth-provider";
import { NotificationsProvider } from "./notifications-provider";
import { PosthogProvider } from "./posthog-provider";
import { PwaProvider } from "./pwa-provider";
import { ThemeProvider } from "./theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PosthogProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
        <AuthProvider>
          <NotificationsProvider>
            <PwaProvider>
              <ConfirmationModalProvider>{children}</ConfirmationModalProvider>
              <PwaInstallBanner />
              <Toaster />
            </PwaProvider>
          </NotificationsProvider>
        </AuthProvider>
      </ThemeProvider>
    </PosthogProvider>
  );
}
```
- **GOTCHA**: Keep import order alphabetical (Biome `organizeImports`) — `PosthogProvider` sorts between `NotificationsProvider` and `PwaProvider`
- **VALIDATE**: `pnpm check-types && npx biome check apps/web/src/providers/index.tsx`

### Task 6: CREATE `apps/web/src/lib/posthog/server.ts`

- **ACTION**: Server-side `posthog-node` singleton + capture helper for use inside Server Actions
- **IMPLEMENT**:
```ts
import { PostHog } from "posthog-node";

let client: PostHog | null = null;

function getPosthogServerClient(): PostHog {
  if (!client) {
    client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
) {
  const posthog = getPosthogServerClient();
  posthog.capture({ distinctId, event, properties });
  await posthog.shutdown();
}
```
- **GOTCHA**: `flushAt: 1, flushInterval: 0` + `await captureServerEvent(...)` (which calls `shutdown()`) is required in serverless Server Actions — without it the event can be dropped when the function returns.
- **IMPORTS**: `import { PostHog } from "posthog-node"`
- **VALIDATE**: `pnpm check-types`

### Task 7: UPDATE `apps/web/src/actions/complete-registration-action.ts` (signup event)

- **ACTION**: Capture `complete_registration` after signup fully succeeds
- **IMPLEMENT**: Add import `import { captureServerEvent } from "@/lib/posthog/server";` at top. Insert immediately before the final `return { email: finalEmail };` (after the `registration_invites` update):
```ts
await captureServerEvent(signUpData.user.id, "complete_registration", {
  professional_type: invite.professional_type,
  enterprise_id: invite.enterprise_id,
});

return { email: finalEmail };
```
- **MIRROR**: Task 6's `captureServerEvent` signature
- **VALIDATE**: `pnpm check-types`; manually run the registration flow locally and confirm the event appears in PostHog's Activity/Live events view

### Task 8: UPDATE `apps/web/src/actions/add-patient-action.ts` (reference mutating-action instrumentation)

- **ACTION**: Capture `add_patient` after the core mutation succeeds, at the same call site as the existing `updateTag`/`insertActivityLog` side effects
- **IMPLEMENT**: Add `import { captureServerEvent } from "@/lib/posthog/server";`, then after the mutation and before `return`:
```ts
await captureServerEvent(user.id, "add_patient", { patient_id: patient.id });
```
(adjust the exact returned identifier name to match what the action actually returns — read the file before editing)
- **MIRROR**: Task 7 pattern; `ctx.user.id` from `authActionClient`
- **VALIDATE**: `pnpm check-types`

### Task 9: UPDATE all remaining mutating actions in `apps/web/src/actions/` (mechanical sweep)

- **ACTION**: Apply the exact same pattern as Task 8 to every remaining mutating action file
- **SCOPE**: All files in `apps/web/src/actions/` **except**:
  - Every `get-*-action.ts` file (read-only, 22 files)
  - `search-users-action.ts`, `search-professionals-action.ts` (read-only search)
  - `lookup-cep-action.ts` (external address lookup, not a mutation)
  - `invalidate-user-cache-action.ts` (internal cache invalidation, not a user-facing event)
  - `index.ts` (barrel file)
  - `complete-registration-action.ts` and `add-patient-action.ts` (already done in Tasks 7–8)
- **EVENT NAMING RULE**: event name = the action file's basename with `-action.ts` stripped and hyphens replaced with underscores. Examples: `update-profile-action.ts` → `update_profile`; `cancel-subscription-action.ts` → `cancel_subscription`; `create-stripe-checkout-session-action.ts` → `create_stripe_checkout_session`.
- **DISTINCT_ID SOURCE**: For every action built on `authActionClient`, use `ctx.user.id` (destructure `user` from `ctx` if not already destructured). All remaining actions in this sweep use `authActionClient` (only `complete-registration-action.ts` is pre-auth, already handled in Task 7).
- **INSERTION POINT**: After the action's core mutation(s) succeed (same point as any existing `revalidatePath`/`updateTag`/`insertActivityLog` call), before the `return` statement. For actions with multiple conditional mutation branches (e.g. `update-patient-action.ts`), capture once at the end covering the overall action, not once per branch.
- **PROPERTIES**: Keep minimal — pass the primary entity id(s) relevant to the action (e.g. `{ patient_id }`, `{ appointment_id }`, `{ invoice_id }`) when trivially available from `parsedInput` or the mutation result; do not add properties that require extra queries.
- **FULL FILE LIST** (61 files):
```
upsert-risk-factors-action.ts        → upsert_risk_factors
disconnect-google-calendar-action.ts → disconnect_google_calendar
cancel-subscription-action.ts        → cancel_subscription
respond-invite-action.ts             → respond_invite
finish-patient-care-action.ts        → finish_patient_care
save-personal-contract-action.ts     → save_personal_contract
delete-other-exam-action.ts          → delete_other_exam
unsubscribe-notifications-action.ts  → unsubscribe_notifications
update-ultrasound-action.ts          → update_ultrasound
upsert-vaccine-record-action.ts      → upsert_vaccine_record
delete-lab-exam-action.ts            → delete_lab_exam
add-backup-professional-action.ts    → add_backup_professional
add-enterprise-professional-action.ts→ add_enterprise_professional
add-patients-to-professional-action.ts → add_patients_to_professional
deactivate-patient-contract-action.ts→ deactivate_patient_contract
update-pregnancy-evolution-action.ts → update_pregnancy_evolution
update-patient-action.ts             → update_patient
set-professional-documents-action.ts → set_professional_documents
remove-backup-professional-action.ts → remove_backup_professional
delete-ultrasound-action.ts          → delete_ultrasound
update-appointment-action.ts         → update_appointment
remove-enterprise-professional-action.ts → remove_enterprise_professional
update-notification-settings-action.ts → update_notification_settings
invalidate-user-cache-action.ts      → SKIP (excluded)
upsert-patient-prenatal-fields-action.ts → upsert_patient_prenatal_fields
delete-pregnancy-evolution-action.ts → delete_pregnancy_evolution
set-professional-type-action.ts      → set_professional_type
create-evolution-action.ts           → create_evolution
update-other-exam-action.ts          → update_other_exam
save-base-contract-action.ts         → save_base_contract
add-other-exam-action.ts             → add_other_exam
create-base-contract-from-patient-action.ts → create_base_contract_from_patient
save-installment-link-action.ts      → save_installment_link
update-profile-action.ts             → update_profile
invite-professional-direct-action.ts → invite_professional_direct
join-enterprise-action.ts            → join_enterprise
create-billing-fee-action.ts         → create_billing_fee
upsert-obstetric-history-action.ts   → upsert_obstetric_history
update-lab-exam-action.ts            → update_lab_exam
leave-team-action.ts                 → leave_team
add-pregnancy-evolution-action.ts    → add_pregnancy_evolution
add-lab-exam-action.ts               → add_lab_exam
subscribe-notifications-action.ts    → subscribe_notifications
delete-pregnancy-action.ts           → delete_pregnancy
set-user-type-action.ts              → set_user_type
update-billing-action.ts             → update_billing
create-stripe-checkout-session-action.ts → create_stripe_checkout_session
cancel-day-appointments-action.ts    → cancel_day_appointments
update-billing-fee-action.ts         → update_billing_fee
add-ultrasound-action.ts             → add_ultrasound
add-billing-action.ts                → add_billing
sign-patient-contract-action.ts      → sign_patient_contract
add-professional-to-team-action.ts   → add_professional_to_team
request-enterprise-action.ts         → request_enterprise
add-appointment-action.ts            → add_appointment
add-new-professional-action.ts       → add_new_professional
delete-document-action.ts            → delete_document
mark-notifications-read-action.ts    → mark_notifications_read
toggle-billing-fee-active-action.ts  → toggle_billing_fee_active
```
(60 instrumented + `invalidate-user-cache-action.ts` explicitly skipped, listed for completeness)
- **VALIDATE**:
  - `pnpm check-types` (must pass with zero errors across all 60 edited files)
  - `grep -rL "captureServerEvent" apps/web/src/actions/*.ts | grep -vE '^apps/web/src/actions/(get-|search-users|search-professionals|lookup-cep|invalidate-user-cache|index)' ` → should return empty (every non-excluded action file now imports/uses `captureServerEvent`)
  - `npx biome check --write apps/web/src/actions/` (fix import ordering/formatting introduced by the sweep)

---

## Testing Strategy

### Manual Validation (no existing test suite covers server actions or providers)

| Check | How |
|-------|-----|
| Pageview fires on navigation | `pnpm dev`, open PostHog "Activity" (Live events) or browser Network tab filtered to `i.posthog.com`, navigate between 2+ routes, confirm one `$pageview` event per navigation with correct `$current_url` |
| Suspense boundary doesn't break build | `pnpm --filter web build` completes without the "`useSearchParams()` should be wrapped in a suspense boundary" error |
| Signup event fires | Complete a registration invite flow locally, confirm `complete_registration` event appears in PostHog with the new user's id as distinct_id |
| Sample mutating action fires | Trigger `add-patient-action.ts` (add a patient via UI), confirm `add_patient` event appears |
| No event on read-only actions | Trigger a `get-patients-action.ts` call (load patients list), confirm no event fires for it |
| Type safety | `pnpm check-types` passes with zero errors |

### Edge Cases Checklist
- [ ] Missing/undefined `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` at build time doesn't crash `instrumentation-client.ts` (env var is present in `.env.local`, but confirm no crash if a preview env lacks it — acceptable to let `posthog.init` no-op/log rather than throw, per posthog-js default behavior)
- [ ] Actions that early-return without mutating (e.g. `create-invite-action.ts`'s "reuse existing pending invite" path) should be checked case-by-case — capturing on that path fires a duplicate `create_invite` event for a no-op; acceptable given properties still reflect the correct patient/invite, but note in code review if it becomes noisy
- [ ] `posthog.capture` calls must not throw and break the action if PostHog is unreachable — `posthog-node`'s `.capture()` is fire-and-forget (buffers internally); only `shutdown()` could theoretically throw on network failure — wrap `captureServerEvent`'s body in this awareness (not required to try/catch per project's error-handling conventions, since a capture failure must never block the actual mutation user-facing result — verify `posthog-node`'s `shutdown()` doesn't throw on network errors during manual testing)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
npx biome check apps/web
```
**EXPECT**: Exit 0, no errors

### Level 2: BUILD
```bash
pnpm --filter web build
```
**EXPECT**: Build succeeds, no Suspense-boundary error for `useSearchParams`

### Level 3: MANUAL_VALIDATION
Run `pnpm dev`, exercise: navigation across ≥3 routes, the registration/signup flow, and 2–3 sample mutating actions (e.g. add patient, update profile). Confirm all expected events appear in PostHog's Live Events view with correct `distinctId` and properties.

---

## Acceptance Criteria

- [ ] `posthog-js` and `posthog-node` installed in `apps/web/package.json`
- [ ] `instrumentation-client.ts` initializes PostHog once at module load with `capture_pageview: false`
- [ ] `PosthogProvider` mounted in `apps/web/src/providers/index.tsx`, wrapping the existing provider tree
- [ ] Every client-side route change fires exactly one `$pageview` event with `$current_url`, covering all pages app-wide (verified via the single root-layout mount point, not per-page edits)
- [ ] `complete-registration-action.ts` captures `complete_registration` after a fully successful signup
- [ ] All 60 non-excluded mutating actions in `apps/web/src/actions/` capture a named event after their mutation succeeds, using `ctx.user.id` (or `signUpData.user.id` for the pre-auth signup action) as `distinctId`
- [ ] Read-only (`get-*`, `search-*`) and non-event (`lookup-cep`, `invalidate-user-cache`) actions are NOT instrumented
- [ ] `pnpm check-types` and `pnpm --filter web build` both pass

---

## Completion Checklist

- [ ] Tasks 1–9 completed in order
- [ ] Level 1 (static analysis) passes
- [ ] Level 2 (build) passes
- [ ] Level 3 (manual validation) confirms events in PostHog Live Events

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 61-file mechanical sweep introduces inconsistent `ctx.user` destructuring (some actions may not currently destructure `user` from `ctx`) | MED | LOW | Read each file before editing (per Task 9 instructions); add `user` to the existing destructure rather than re-fetching |
| `captureServerEvent`'s `shutdown()` adds latency to every mutating action (creates+tears down a client per call since `flushAt:1`) | MED | LOW | Acceptable for this app's traffic volume; documented as a deliberate serverless-safety tradeoff, not a bug |
| Duplicate events on actions with early-return no-op paths (e.g. `create-invite-action.ts` reusing a pending invite) | LOW | LOW | Documented in Testing Strategy edge cases; not blocking for initial rollout |
| Biome import-order violations across 62 edited files | HIGH | LOW | Task 9's validation step runs `npx biome check --write` on the actions directory as the last step |

---

## Notes

- `posthog.identify()` (linking anonymous pre-login activity to the authenticated user) is intentionally NOT implemented here — natural follow-up in `AuthProvider` once this base instrumentation lands.
- The reverse-proxy `/ingest` rewrite (ad-blocker resilience) is a good follow-up but was excluded to keep this change focused on what was explicitly requested.
- Event names follow a flat `snake_case` convention derived mechanically from action file names for consistency and to keep this sweep reviewable; a future pass could align naming with PostHog's `object_verb` idiom if desired.
