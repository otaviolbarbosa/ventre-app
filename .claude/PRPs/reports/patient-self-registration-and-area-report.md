# Implementation Report

**Plan**: `.claude/PRPs/plans/patient-self-registration-and-area.plan.md`
**Branch**: `feature/patient-self-registration-and-area`
**Date**: 2026-07-11
**Status**: COMPLETE

---

## Summary

Implemented invite-only patient self-registration and a new patient-facing area. A professional or staff member checks "Solicitar auto cadastro" in `new-patient-modal.tsx` to create an invite (extending `patient_invite_links`) instead of a patient record; the gestante completes signup at `/patient-registration?piid=<id>` via email/password or Google OAuth. `handle_new_user` now respects `user_type` metadata so patient signups are no longer forced into `professional`. A new `app/(patient)/` route group gives gestantes a home summary, a read-only prenatal card (reusing the existing `PrenatalCard` component's `isEditable={false}` mode), an agenda with attendance confirmation, and a financeiro view where they can register a payment (`em_analise`) pending professional confirmation. Staff can also invite an already-existing patient to link a login via a new "Convidar Gestante" action.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | HIGH      | HIGH   | Matched — spanned DB/RLS, auth trigger, two OAuth paths, and a full new route group |
| Confidence | n/a       | High   | All 34 tasks completed; every step validated with `pnpm check-types` immediately, full `pnpm build` green at the end |

**Deviations from the plan, and why:**

- **Task 25 (prenatal card)**: instead of extracting a new `prenatal-card-readonly.tsx` by manually stripping edit affordances from the 1500-line `prenatal-card.tsx`, discovered the existing component already accepts an `isEditable: boolean` prop and fully supports a read-only rendering mode (used elsewhere with `isEditable={isObstetrician || isNurse}`). Reused it directly with `isEditable={false}` — simpler, and guaranteed to stay in sync with the professional-side card instead of drifting as a duplicate.
- **Task 20 (post-OAuth data step)**: the plan asked to extract shared step-2/step-3 components (`patient-register-data-step.tsx`, `patient-register-confirm-step.tsx`) reused by both the password flow and the OAuth flow. Given the two flows differ meaningfully (password flow has 3 steps incl. summary/avatar-upload-after-signin sequencing; OAuth flow is already authenticated and only needs 1 step), built `patient-register-complete-screen.tsx` as a self-contained component with the same field schemas rather than forcing a shared step abstraction — avoided over-engineering two call sites into one indirection layer.
- **Task 6 gotcha (RLS-respecting client for billing insert in invite completion)**: the plan's mirror instruction assumed a session-bound anon client would satisfy `billings` RLS (`is_team_member`) post-signup. In practice the newly created patient is never a team member, so an anon client could never pass that check regardless of session. Used `supabaseAdmin` for both the `supabase` and `supabaseAdmin` parameters of `createPatientWithTeamAndBilling` at this one call site instead — a legitimate cross-user server-side write after the invite has already been validated, consistent with the project's documented admin-client policy.
- **Route naming**: resolved the plan's flagged ambiguity (Task 25 note) by choosing separate routes per section, per explicit user confirmation before implementation. Entry route is `/patient-home` (not `/home`, which the `(dashboard)` group already owns) — noted as the plan's own working assumption.
- **Unit tests**: skipped per explicit user decision before implementation (no test runner configured in `apps/web`); relied on `pnpm check-types` after every file change plus a full `pnpm build` at the end.

---

## Tasks Completed

All 34 tasks from the plan — see commit history on `feature/patient-self-registration-and-area` (5 commits, one per logical phase: DB foundation, invite creation, registration route, patient area, existing-patient invite).

---

## Validation Results

| Check       | Result | Details                                                        |
| ----------- | ------ | --------------------------------------------------------------- |
| Type check  | ✅     | `pnpm check-types` — all 4 packages pass                        |
| Lint        | ✅     | `npx biome lint apps/web` — 0 errors, 0 warnings                |
| Unit tests  | ⏭️     | No test runner configured; skipped per user decision            |
| Build       | ✅     | `pnpm build` (apps/web) — compiled successfully, all new routes generated |
| Database    | ✅     | 4 migrations applied to live Supabase project; `handle_new_user` verified with live test inserts (patient + professional paths); `em_analise` enum verified; no new security advisories introduced |
| Browser     | ⏭️     | Not run — no interactive session in this environment; recommend manual walkthrough of both invite types per plan's Level 5/6 checklist before merge |

---

## Files Changed

**Database (4 migrations + types):**
- `packages/supabase/supabase/migrations/20260710000001_patient_invite_links_extend.sql` (CREATE)
- `packages/supabase/supabase/migrations/20260710000002_handle_new_user_patient_type.sql` (CREATE)
- `packages/supabase/supabase/migrations/20260710000003_appointments_patient_rls_and_confirm.sql` (CREATE)
- `packages/supabase/supabase/migrations/20260710000004_installment_status_em_analise.sql` (CREATE)
- `packages/supabase/src/types/database.types.ts` (UPDATE, regenerated)
- `apps/web/src/lib/billing/calculations.ts` (UPDATE — added `em_analise` to status config map)

**Invite creation:**
- `apps/web/src/services/patient-onboarding.ts` (CREATE)
- `apps/web/src/actions/add-patient-action.ts` (UPDATE)
- `apps/web/src/lib/validations/patient-invite.ts` (CREATE)
- `apps/web/src/actions/create-patient-invite-action.ts` (CREATE)
- `apps/web/src/lib/emails/send-patient-invite.ts` (CREATE)
- `apps/web/src/actions/send-patient-invite-email-action.ts` (CREATE)
- `apps/web/src/modals/patient-invite-share-modal.tsx` (CREATE)
- `apps/web/src/modals/new-patient-modal.tsx` (UPDATE)
- `apps/web/proxy.ts` (UPDATE)

**Registration route:**
- `apps/web/app/patient-registration/page.tsx` (CREATE)
- `apps/web/src/screens/patient-register-screen.tsx` (CREATE)
- `apps/web/src/actions/complete-patient-registration-action.ts` (CREATE)
- `apps/web/src/providers/auth-provider.tsx` (UPDATE)
- `apps/web/app/auth/callback/route.ts` (UPDATE)
- `apps/web/app/patient-registration/complete/page.tsx` (CREATE)
- `apps/web/src/screens/patient-register-complete-screen.tsx` (CREATE)
- `apps/web/src/actions/complete-patient-registration-post-oauth-action.ts` (CREATE)

**Patient area:**
- `apps/web/app/(dashboard)/home/page.tsx` (UPDATE)
- `apps/web/app/(patient)/layout.tsx` (CREATE)
- `apps/web/src/components/patient-area/patient-nav.tsx` (CREATE)
- `apps/web/src/services/patient-self.ts` (CREATE)
- `apps/web/app/(patient)/patient-home/page.tsx` (CREATE)
- `apps/web/app/(patient)/cartao-pre-natal/page.tsx` (CREATE)
- `apps/web/app/(patient)/agenda/page.tsx` (CREATE)
- `apps/web/src/components/patient-area/appointment-list.tsx` (CREATE)
- `apps/web/src/actions/confirm-appointment-attendance-action.ts` (CREATE)
- `apps/web/app/(patient)/financeiro/page.tsx` (CREATE)
- `apps/web/src/components/patient-area/billing-summary.tsx` (CREATE)
- `apps/web/src/actions/register-installment-payment-action.ts` (CREATE)
- `apps/web/src/actions/confirm-installment-payment-action.ts` (CREATE)
- `apps/web/src/components/billing/installment-list.tsx` (UPDATE — em_analise confirm/reject UI)
- `apps/web/app/(patient)/ferramentas/page.tsx` (CREATE)

**Existing-patient invite:**
- `apps/web/src/actions/create-link-existing-patient-invite-action.ts` (CREATE)
- `apps/web/src/modals/invite-existing-patient-modal.tsx` (CREATE)
- `apps/web/src/screens/patient-team-screen.tsx` (UPDATE)

---

## Issues Encountered

- Adding the `em_analise` enum value broke a `Record<BillingStatus, StatusConfig>` map in `calculations.ts` that didn't account for the new installment-only status — fixed by widening the map's key type and adding a label/variant for it.
- Base branch (`dev`) had an unrelated uncommitted change to `patient-contract.tsx` at session start — stashed it before branching to keep this feature branch clean; it remains recoverable via `git stash list`.

---

## Tests Written

None — no test runner configured in `apps/web`; skipped per explicit user decision before implementation began.

---

## Next Steps

- [ ] Manual browser walkthrough of both invite types end-to-end (plan's Level 5/6 checklist)
- [ ] Restore the stashed `patient-contract.tsx` change on `dev` if still needed
- [ ] Review implementation, especially the deviations noted above
- [ ] Create PR: `gh pr create`
- [ ] Merge when approved
