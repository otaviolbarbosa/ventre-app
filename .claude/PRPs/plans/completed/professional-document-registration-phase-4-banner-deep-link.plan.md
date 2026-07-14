# Feature: Professional Document Registration — Phase 4: Banner + Deep Link

## Summary

Add a persistent dashboard banner that tells professionals (`obstetra`, `enfermeiro`, `fisio`) they haven't filled their council registration numbers (`professional_documents`), and wire a `/profile?action=edit-profile` deep link that auto-opens `EditProfileModal` so the banner's CTA lands the user directly in the edit form. This is the last phase of the `professional-document-registration` PRD — Phases 1–3 (migration, shared form fields + action, onboarding step) are already complete.

## User Story

As a médica/enfermeira/fisioterapeuta cadastrada na plataforma que pulou o preenchimento dos dados de conselho no onboarding
I want to ver um aviso persistente no dashboard me lembrando de completar meus dados profissionais, e ser levada direto ao formulário ao clicar
So that eu não esqueço de preencher um dado exigido legalmente para o exercício da minha profissão

## Problem Statement

Professionals who skip the onboarding step (or existing professionals registered before this feature) have `professional_documents = null` with no further prompt anywhere in the app. Without a banner + deep link, this data will never get collected organically.

## Solution Statement

Make `app/(dashboard)/layout.tsx` fetch the current user's profile (`getServerAuth()`, already `cache()`-wrapped and already invoked once per request by other routes, so this is a free re-read) and derive a boolean "needs professional documents" flag. Pass that flag (plus `professional_type`) to a new small Server Component wrapper — `ProfessionalDocumentsBanner` — that renders nothing when the flag is false, or a fixed banner linking to `/profile?action=edit-profile` when true. On `/profile`, `ProfileScreen` reads the `action` search param on mount, opens `EditProfileModal`, and strips the param via `router.replace`, mirroring the existing `FlashMessage` precedent exactly.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY (final phase of an in-progress PRD) |
| Complexity       | LOW                                                 |
| Systems Affected | `apps/web` (dashboard layout, profile screen, shared components, lib) |
| Dependencies     | next@16.1.0, react@19.2.0, next-safe-action@8.1.4 (no new deps) |
| Estimated Tasks  | 6                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║ Dashboard (any route)                                                     ║
║  Sidebar | MainContent(children) | BottomNav | NotificationPermissionPrompt║
║                                                                            ║
║  USER_FLOW: professional with professional_documents = null navigates the ║
║  dashboard and sees nothing indicating missing data.                      ║
║  PAIN_POINT: no reminder exists; data may never get filled.               ║
╚═══════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════╗
║ /profile                                                                  ║
║  "Editar Perfil" button → useState(false) → click → modal opens manually  ║
║  PAIN_POINT: no way to land directly on the edit form via URL.            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║ Dashboard (any route, obstetra/enfermeiro/fisio with docs missing)        ║
║  Sidebar | MainContent(children) | BottomNav                             ║
║                    ▼                                                     ║
║           ┌─────────────────────────────┐                                ║
║           │ ProfessionalDocumentsBanner │ ◄── new, server-flag driven    ║
║           │ "Complete seus dados         │                                ║
║           │  profissionais" → link       │                                ║
║           └─────────────────────────────┘                                ║
║           NotificationPermissionPrompt                                    ║
║                                                                            ║
║  USER_FLOW: professional sees banner on every dashboard page until saved. ║
║  VALUE_ADD: legally-required data eventually gets collected.              ║
╚═══════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════╗
║ /profile?action=edit-profile  (arrived via banner click)                 ║
║  ProfileScreen mounts → useEffect reads "action" param → setIsEditModalOpen║
║  (true) → EditProfileModal opens automatically → router.replace strips    ║
║  the param → user fills CRM/RQE/COREN/CREFITO → saves → router.refresh()  ║
║  re-runs layout fetch → banner disappears on next render.                 ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `app/(dashboard)/layout.tsx` | Static tree, no user fetch | Async, fetches profile via `getServerAuth()`, renders conditional banner | Professionals see a persistent reminder |
| `/profile` (`ProfileScreen`) | Modal only opens via button click | Modal also auto-opens when `?action=edit-profile` is present | Banner CTA lands directly in the form |

---

## Mandatory Reading

**CRITICAL: Read these before starting any task.**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/app/(dashboard)/layout.tsx` | 1-23 | File to convert from sync to async Server Component |
| P0 | `apps/web/src/lib/server-auth.ts` | 1-62 | `getServerAuth()` — the `cache()`-wrapped fetch to reuse; already returns `profile.professional_type` and `profile.professional_documents` via `select("*")` |
| P0 | `apps/web/src/components/shared/flash-message.tsx` | 1-29 | Exact pattern to mirror for `?action=` read + strip in a client component |
| P0 | `apps/web/src/screens/profile-screen.tsx` | 1-238 | Where the deep-link `useEffect` and `useSearchParams` must be added; existing `isEditModalOpen` state to hook into |
| P1 | `apps/web/src/modals/edit-profile-modal.tsx` | 56-65 | `EditProfileModalProps` contract — confirms no changes needed to the modal itself |
| P1 | `apps/web/src/lib/validations/professional-documents.ts` | 1-51 | `professionalDocumentsSchema` shape — defines what counts as "filled" per document key |
| P1 | `apps/web/src/components/shared/notification-permission-prompt.tsx` | 1-70 | Visual/markup pattern for a fixed banner (styling reference only — do NOT reuse its dismiss/localStorage logic) |
| P2 | `apps/web/src/types/index.ts` | 1-10 | `ProfessionalType` union |

No external documentation changes needed — `useSearchParams`/Suspense and `router.refresh()` semantics are unchanged in Next.js 16.1.0 / React 19.2.0 versus the existing `FlashMessage` precedent (confirmed via research: https://nextjs.org/docs/app/api-reference/functions/use-search-params, https://nextjs.org/docs/app/api-reference/functions/use-router).

---

## Patterns to Mirror

**QUERY-PARAM READ + STRIP (mirror exactly, adapt to open a modal instead of a toast):**
```tsx
// SOURCE: apps/web/src/components/shared/flash-message.tsx:1-29
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export function FlashMessage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const error = searchParams.get("error");
    if (!error) return;
    const message = ERROR_MESSAGES[error] ?? "Ocorreu um erro inesperado.";
    toast.error(message);
    const url = new URL(window.location.href);
    url.searchParams.delete("error");
    router.replace(url.pathname + (url.search || ""));
  }, [searchParams, router]);

  return null;
}
```

**SERVER FETCH IN A LAYOUT (mirror `getServerAuth()` call site pattern):**
```tsx
// SOURCE: apps/web/app/(dashboard)/profile/page.tsx:1-27 (analogous call site)
export default async function ProfilePage() {
  const { profile, user } = await getServerAuth();
  if (!profile || !user) redirect("/login");
  // ...
}
```

**SERVER → CLIENT PROP PASS-THROUGH (mirror `ProfilePage → ProfileScreen`):**
```tsx
// SOURCE: apps/web/app/(dashboard)/profile/page.tsx:24
<ProfileScreen profile={profile} address={addressData} />
```

**BANNER VISUAL STYLE (mirror markup/classes only, not the dismiss logic):**
```tsx
// SOURCE: apps/web/src/components/shared/notification-permission-prompt.tsx (fixed positioning, rounded card, icon + text + CTA)
<div className="fixed inset-x-4 bottom-20 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm">
  <div className="flex items-start gap-3 rounded-lg border bg-white p-4 shadow-lg">
    {/* icon, text, CTA button */}
  </div>
</div>
```
Note: Phase 4's banner has no dismiss button and no localStorage cooldown — it is purely driven by the server-computed `hasFilledDocuments` boolean (per Decisions Log: "Persistente, sem dismiss, até preencher").

**`professional_documents` SCHEMA (defines "filled" check):**
```ts
// SOURCE: apps/web/src/lib/validations/professional-documents.ts:43-48
export const professionalDocumentsSchema = z.object({
  crm: documentEntrySchema.optional(),
  crefito: documentEntrySchema.optional(),
  coren: documentEntrySchema.optional(),
  rqe: z.array(documentEntrySchema).optional(),
});
```

**`EditProfileModal` PROP CONTRACT (no changes needed, cite to confirm):**
```ts
// SOURCE: apps/web/src/modals/edit-profile-modal.tsx:56-65
type EditProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  phone: string;
  address?: Address | null;
  professionalType: ProfessionalType | null;
  professionalDocuments?: Json | null;
  onSuccess?: (name: string, phone: string) => void;
};
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/lib/professional-documents.ts` | CREATE | Shared helper to determine which council-key is required per `professional_type` and whether it's filled — used by the layout to compute the banner flag; keeps the "what counts as filled" logic in one place instead of duplicating it inline in the layout |
| `apps/web/app/(dashboard)/layout.tsx` | UPDATE | Make async, call `getServerAuth()`, compute the flag, render `<ProfessionalDocumentsBanner />` |
| `apps/web/src/components/shared/professional-documents-banner.tsx` | CREATE | New banner component (Server Component; no client state needed since it's purely prop-driven and renders a plain `<Link>`) |
| `apps/web/src/screens/profile-screen.tsx` | UPDATE | Add `useSearchParams()` + `useEffect` to auto-open `EditProfileModal` on `?action=edit-profile`, strip the param via `router.replace` |
| `apps/web/app/(dashboard)/profile/page.tsx` | (no change expected) | Confirm during Task 4 that no Suspense wrapping is needed — page is already dynamic (calls `getServerAuth()`/cookies), so `useSearchParams` in a descendant client component won't trigger a static-render CSR bailout; verify with `next build` in validation |

---

## NOT Building (Scope Limits)

- No dismiss/cooldown behavior for the banner — explicit PRD decision: persistent until filled.
- No backfill or migration of existing professionals' data.
- No changes to `EditProfileModal`, `ProfessionalDocumentsFields`, or the Zod schema — Phase 2/3 already wired these correctly; Phase 4 only adds a trigger path (`?action=edit-profile`) and a nudge (banner).
- No external CFM/COREN/CREFITO validation.
- No banner/document display for `doula` or patients — `professional-documents.ts` helper only returns `true` for `obstetra`/`enfermeiro`/`fisio`.

---

## Step-by-Step Tasks

Execute in order.

### Task 1: CREATE `apps/web/src/lib/professional-documents.ts`

- **ACTION**: CREATE helper module
- **IMPLEMENT**:
  ```ts
  import type { ProfessionalType } from "@/types";
  import type { Json } from "@ventre/supabase/types";

  const REQUIRED_DOCUMENT_KEY: Partial<Record<ProfessionalType, "crm" | "crefito" | "coren">> = {
    obstetra: "crm",
    fisio: "crefito",
    enfermeiro: "coren",
  };

  export function needsProfessionalDocuments(
    professionalType: ProfessionalType | null,
    professionalDocuments: Json | null,
  ): boolean {
    if (!professionalType) return false;
    const requiredKey = REQUIRED_DOCUMENT_KEY[professionalType];
    if (!requiredKey) return false; // doula, or unknown type
    const documents = professionalDocuments as Record<string, unknown> | null;
    return !documents?.[requiredKey];
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/professional-documents-fields.tsx` — reuses the same `professionalType !== ...` gating logic for which types have documents at all
- **GOTCHA**: `professional_documents` is typed `Json | null` (`Tables<"users">["professional_documents"]`) — cast defensively, don't assume shape; only check the single required key per type (RQE is "Should", optional, not part of the "filled" check per PRD MoSCoW table)
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/components/shared/professional-documents-banner.tsx`

- **ACTION**: CREATE banner component
- **IMPLEMENT**: Plain (non-`"use client"`) component — no interactivity needed beyond a `<Link>`, so it can render inside the async Server Component layout directly without its own client boundary.
  ```tsx
  import Link from "next/link";
  import { FileWarning } from "lucide-react";

  export function ProfessionalDocumentsBanner() {
    return (
      <div className="fixed inset-x-4 bottom-20 z-50 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm">
        <Link
          href="/profile?action=edit-profile"
          className="flex items-start gap-3 rounded-lg border bg-white p-4 shadow-lg"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <FileWarning className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">Complete seus dados profissionais</p>
            <p className="mt-1 text-gray-500 text-xs">
              Cadastre seu número de conselho para poder emitir documentos oficiais no futuro.
            </p>
          </div>
        </Link>
      </div>
    );
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/notification-permission-prompt.tsx` for the fixed-position/card markup and Tailwind classes (icon circle, `text-sm`/`text-xs` hierarchy)
- **IMPORTS**: `lucide-react` icon (any professional/document-relevant icon already available in the dependency — `FileWarning` is illustrative; confirm it's exported by the installed `lucide-react` version during implementation, swap for another icon like `AlertCircle` if not)
- **GOTCHA**: Entire card is a `<Link>` (not a `<button>` inside a `<div>`) since its only action is navigation — simpler than `NotificationPermissionPrompt`'s two-button layout, no dismiss affordance per PRD decision
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/app/(dashboard)/layout.tsx`

- **ACTION**: Convert to `async`, fetch profile, conditionally render banner
- **IMPLEMENT**:
  ```tsx
  import BottomNav from "@/components/layouts/bottom-nav";
  import { MainContent } from "@/components/layouts/main-content";
  import { Sidebar } from "@/components/layouts/sidebar";
  import { FlashMessage } from "@/components/shared/flash-message";
  import { NotificationPermissionPrompt } from "@/components/shared/notification-permission-prompt";
  import { ProfessionalDocumentsBanner } from "@/components/shared/professional-documents-banner";
  import { getServerAuth } from "@/lib/server-auth";
  import { needsProfessionalDocuments } from "@/lib/professional-documents";
  import type { ProfessionalType } from "@/types";
  import { Suspense } from "react";

  export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { profile } = await getServerAuth();
    const showProfessionalDocumentsBanner = needsProfessionalDocuments(
      (profile?.professional_type as ProfessionalType | null) ?? null,
      profile?.professional_documents ?? null,
    );

    return (
      <div className="flex-1">
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <MainContent>{children}</MainContent>
        </div>
        <BottomNav />
        <NotificationPermissionPrompt />
        {showProfessionalDocumentsBanner && <ProfessionalDocumentsBanner />}
        <Suspense>
          <FlashMessage />
        </Suspense>
      </div>
    );
  }
  ```
- **MIRROR**: `apps/web/app/(dashboard)/profile/page.tsx:7-8` for the `getServerAuth()` call site
- **IMPORTS**: `getServerAuth` from `@/lib/server-auth`, `needsProfessionalDocuments` from `@/lib/professional-documents` (Task 1)
- **GOTCHA**: `getServerAuth()` is `cache()`-wrapped, so this second call within the same request (pages under this layout already call it, e.g. `ProfilePage`) is deduped and adds no extra Supabase round-trip — do not create a separate/parallel fetch
- **GOTCHA**: If `profile` is `null` (unauthenticated edge case — shouldn't normally reach this layout, but be defensive since `getServerAuth()` can return `profile: null`), `needsProfessionalDocuments` must handle `null` safely (already does, per Task 1 signature)
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/screens/profile-screen.tsx`

- **ACTION**: Add deep-link auto-open behavior
- **IMPLEMENT**: Add `useSearchParams` import, read `action` param in a `useEffect`, open the modal, then strip the param:
  ```tsx
  "use client";

  import { useRouter, useSearchParams } from "next/navigation";
  import { useEffect, useRef, useState } from "react";
  // ...existing imports

  export default function ProfileScreen({ profile, address }: ProfileScreenProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    // ...existing state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
      if (searchParams.get("action") !== "edit-profile") return;
      setIsEditModalOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      router.replace(url.pathname + (url.search || ""));
    }, [searchParams, router]);

    // ...rest unchanged
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/flash-message.tsx:11-24` — identical read-act-strip shape, adapted to set modal state instead of firing a toast
- **GOTCHA**: `ProfileScreen` is rendered by `app/(dashboard)/profile/page.tsx`, which is already a dynamic route (calls `getServerAuth()` → cookies), so it is not statically prerendered — `useSearchParams` here will not trigger the `missing-suspense-with-csr-bailout` production-build error that requires a `<Suspense>` boundary (that rule only applies to routes that would otherwise be static). Confirm this holds during Task 6's `pnpm build` (or equivalent) validation; if the build reports the bailout warning for this route, wrap the `<ProfileScreen />` render in `app/(dashboard)/profile/page.tsx` with `<Suspense>` as a fallback fix.
- **GOTCHA**: Effect must check the specific param value and no-op once absent (as shown) to avoid the classic `router.replace`-in-`useEffect` re-render loop — same guard `FlashMessage` already relies on.
- **VALIDATE**: `pnpm check-types`

### Task 5: Manual verification of the "filled" check against real data shapes

- **ACTION**: No code change — validate `needsProfessionalDocuments` against the actual shapes Phase 2/3 write
- **IMPLEMENT**: Confirm via Supabase (e.g. `mcp__supabase__execute_sql` or local query) that a professional who filled CRM via onboarding has `professional_documents.crm = { number, uf }` (truthy object) and one who skipped has `professional_documents = null` — both must resolve correctly through `needsProfessionalDocuments`
- **VALIDATE**: Manual check — no automated test framework exists in this repo for this kind of check (confirm via `apps/web/package.json` scripts if a test runner exists before skipping; if none exists, this stays a manual DB spot-check)

### Task 6: Full validation pass

- **ACTION**: Run repo-wide checks
- **VALIDATE**: `pnpm check-types` (root) — must pass with no errors across `apps/web`
- **VALIDATE**: `npx biome lint --write --unsafe apps/web/src/lib/professional-documents.ts apps/web/src/components/shared/professional-documents-banner.tsx apps/web/app/\(dashboard\)/layout.tsx apps/web/src/screens/profile-screen.tsx` — fix any class-sorting/import-order warnings
- **VALIDATE**: `pnpm --filter web build` (or equivalent) — confirms no `missing-suspense-with-csr-bailout` for `/profile` per Task 4's gotcha

---

## Testing Strategy

No existing unit/integration test suite covers `apps/web` screens or layouts (confirmed no test runner found for this app during Phase 2/3 codebase exploration — verify this is still true before skipping tests; if a runner exists, add a small unit test for `needsProfessionalDocuments` covering the edge cases below). Otherwise, rely on manual/browser validation.

### Edge Cases Checklist

- [ ] `professional_type = null` (shouldn't normally happen for a logged-in professional, but defend against it) → banner never shows
- [ ] `professional_type = "doula"` → banner never shows (doula out of scope)
- [ ] `professional_type = "obstetra"`, `professional_documents = null` → banner shows
- [ ] `professional_type = "obstetra"`, `professional_documents = { crm: { number: "123", uf: "SP" } }` → banner hidden
- [ ] `professional_type = "obstetra"`, `professional_documents = { rqe: [...] }` (RQE filled but no CRM — shouldn't be possible via the form, but defend against manual DB edits) → banner still shows (CRM is required key)
- [ ] `professional_type = "enfermeiro"`, `professional_documents = { coren: {...} }` → banner hidden
- [ ] `professional_type = "fisio"`, `professional_documents = { crefito: {...} }` → banner hidden
- [ ] Navigating to `/profile?action=edit-profile` directly (no prior banner click) → modal still auto-opens
- [ ] Saving via the modal after deep-link open → `router.refresh()` fires → banner disappears on the next dashboard page view
- [ ] Clicking "Editar Perfil" button manually (no query param) → unaffected, works as before

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
```
**EXPECT**: Exit 0, no errors.

### Level 2: LINT
```bash
npx biome lint --write --unsafe apps/web/src/lib/professional-documents.ts apps/web/src/components/shared/professional-documents-banner.tsx "apps/web/app/(dashboard)/layout.tsx" apps/web/src/screens/profile-screen.tsx
```
**EXPECT**: Exit 0, no unresolved warnings.

### Level 3: BUILD
```bash
pnpm --filter web build
```
**EXPECT**: Build succeeds; no `missing-suspense-with-csr-bailout` message for `/profile`.

### Level 4: DATABASE_VALIDATION
Use Supabase MCP (`list_tables` / `execute_sql`) to confirm:
- [ ] `users.professional_documents` is queryable and already populated for at least one test professional (from Phase 3 onboarding testing)

### Level 5: BROWSER_VALIDATION
Using Chrome MCP or manual browser testing, logged in as a test professional with `professional_documents = null`:
- [ ] Banner appears on any dashboard page (e.g. `/home`)
- [ ] Clicking the banner navigates to `/profile?action=edit-profile` and `EditProfileModal` opens automatically
- [ ] URL is stripped back to `/profile` after the effect runs
- [ ] Filling and saving CRM/COREN/CREFITO closes the modal, and navigating back to `/home` no longer shows the banner
- [ ] Logged in as a `doula` or as a patient — banner never appears

### Level 6: MANUAL_VALIDATION
- [ ] Confirm banner does not overlap/clash visually with `NotificationPermissionPrompt` when both are eligible to render simultaneously (both use `fixed bottom-... right-...` positioning — check for stacking/overlap on mobile viewport widths)

---

## Acceptance Criteria

- [ ] Professionals (obstetra/enfermeiro/fisio) missing their required document see a persistent banner on every dashboard page
- [ ] Banner never appears for doula, patients, or professionals who already filled their required document
- [ ] Clicking the banner opens `/profile` with `EditProfileModal` already open
- [ ] Direct navigation to `/profile?action=edit-profile` also auto-opens the modal
- [ ] Saving the form makes the banner disappear on next navigation (via existing `router.refresh()` call in `ProfileScreen`)
- [ ] `pnpm check-types`, lint, and build all pass with no regressions

---

## Completion Checklist

- [ ] Task 1–4 implemented in order
- [ ] Task 5 manual data-shape check done
- [ ] Task 6 full validation pass green
- [ ] Level 1-3 validation commands pass
- [ ] Level 4-6 manual/browser checks done
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Banner and `NotificationPermissionPrompt` visually collide (both fixed-position, bottom-of-screen) | M | L | Position `ProfessionalDocumentsBanner` above `NotificationPermissionPrompt` (e.g. adjust `bottom-*` offset) or stack them; verify visually in Level 6 |
| `useSearchParams` in `ProfileScreen` triggers CSR-bailout build warning if the route is ever made static in the future | L | L | Documented gotcha in Task 4; fallback is wrapping `<ProfileScreen>` in `<Suspense>` from the page |
| `professional_documents` manually edited in DB to a shape that doesn't match `professionalDocumentsSchema` | L | L | `needsProfessionalDocuments` only checks for presence of the required key, not full schema validity — defensive by design |

---

## Notes

This closes out the `professional-document-registration` PRD (all 4 phases complete after this). No new external dependencies, no schema changes, no changes to `EditProfileModal`/`ProfessionalDocumentsFields`/`set-professional-documents-action.ts` — Phase 4 is purely a nudge (banner) + navigation convenience (deep link) layered on top of already-working persistence logic from Phases 1–3.

*Generated: 2026-07-14*
