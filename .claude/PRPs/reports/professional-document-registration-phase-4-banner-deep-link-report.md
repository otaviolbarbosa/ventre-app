# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/professional-document-registration-phase-4-banner-deep-link.plan.md`
**Branch**: `feature/professional-document-registration-phase-4-banner-deep-link`
**Date**: 2026-07-14
**Status**: PARTIAL (code complete, static/DB validation done; browser QA not executed)

---

## Summary

Added a persistent dashboard banner (`ProfessionalDocumentsBanner`) that nudges obstetra/enfermeiro/fisio professionals who haven't filled their required council document to complete it, linking to `/profile?action=edit-profile`. `ProfileScreen` now reads that query param on mount, auto-opens `EditProfileModal`, and strips the param — mirroring the existing `FlashMessage` pattern. This closes out all 4 phases of the `professional-document-registration` PRD.

Before starting, found Phase 3 (onboarding step) was code-complete but uncommitted on the working branch — committed it first as a separate commit to keep history clean, then branched off for Phase 4.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | LOW       | LOW    | Matched — pure additive Server Component + one `useEffect`, no schema/dependency changes |
| Confidence | (not scored in plan) | HIGH | All mandatory-reading assumptions (file line ranges, `getServerAuth()` cache behavior, `FlashMessage` pattern) held true |

**Deviation from plan**: Offset the banner's fixed position higher (`bottom-36`/`sm:bottom-20` instead of `bottom-20`/`sm:bottom-4`) to avoid stacking directly on top of `NotificationPermissionPrompt`, which uses the same fixed bottom-right positioning — addresses the plan's own risk note (visual collision) proactively rather than deferring to manual QA.

---

## Tasks Completed

| # | Task | File | Status |
| --- | ------------------ | ---------- | ------ |
| 1 | CREATE `needsProfessionalDocuments` helper | `apps/web/src/lib/professional-documents.ts` | ✅ |
| 2 | CREATE `ProfessionalDocumentsBanner` | `apps/web/src/components/shared/professional-documents-banner.tsx` | ✅ |
| 3 | UPDATE dashboard layout (async, fetch profile, conditional banner) | `apps/web/app/(dashboard)/layout.tsx` | ✅ |
| 4 | UPDATE `ProfileScreen` deep-link auto-open | `apps/web/src/screens/profile-screen.tsx` | ✅ |
| 5 | Manual DB data-shape check | — | ✅ (see below) |
| 6 | Full validation pass | — | ✅ |

---

## Validation Results

| Check       | Result | Details |
| ----------- | ------ | ------- |
| Type check  | ✅     | `pnpm check-types` — 0 errors across all packages |
| Lint        | ✅     | `npx biome lint --write --unsafe` on the 4 touched files — "No issues found" |
| Unit tests  | N/A    | No test infra for actions/screens/layouts in this repo (confirmed Phase 2/3 precedent) |
| Build       | ✅     | `pnpm --filter web build` completed; no `missing-suspense-with-csr-bailout` warning for `/profile` |
| DB spot-check | ✅   | See below |
| Browser QA  | ⏭️     | Not executed this session — no test account credentials with `professional_type` set and `professional_documents = null` reachable via browser automation in this session |

**DB spot-check details**: Queried `public.users` via Supabase MCP. Every existing obstetra/fisio/enfermeiro row currently has `professional_documents = null` (no professional has completed the form yet in this database), so the "filled" branch couldn't be checked against a live row. Verified it instead by reading `set-professional-documents-action.ts:16-22`, which writes `parsedInput.professional_documents` directly per `professionalDocumentsSchema` (e.g. `{ crm: { number, uf } }`) — this is exactly the truthy-object shape `needsProfessionalDocuments` checks for, so the logic is sound even though no row exists yet to confirm end-to-end.

---

## Files Changed

| File       | Action | Lines     |
| ---------- | ------ | --------- |
| `apps/web/src/lib/professional-documents.ts` | CREATE | +17 |
| `apps/web/src/components/shared/professional-documents-banner.tsx` | CREATE | +22 |
| `apps/web/app/(dashboard)/layout.tsx` | UPDATE | +13/-3 |
| `apps/web/src/screens/profile-screen.tsx` | UPDATE | +11/-2 |

---

## Deviations from Plan

- Banner vertical offset adjusted (`bottom-36`/`sm:bottom-20`) to avoid overlapping `NotificationPermissionPrompt`. See Assessment section above.

---

## Issues Encountered

- Found Phase 3 work uncommitted on the branch at session start; committed it separately (`Complete Phase 3: onboarding professional documents step`) before creating the Phase 4 branch, to avoid mixing phases in one diff.
- No existing DB rows with filled `professional_documents` to validate the "hide banner" branch end-to-end against live data — mitigated via code-level verification (see Validation Results).

---

## Tests Written

None — no test runner exists for `apps/web` screens/layouts/actions in this repo (consistent with Phase 2/3 precedent).

---

## Next Steps

- [ ] Manual/browser validation (Level 5 in the plan): log in as a professional with `professional_documents = null`, confirm banner appears on `/home`, click-through opens `/profile?action=edit-profile` with modal auto-open, URL strips back to `/profile`, and banner disappears after saving.
- [ ] Review implementation
- [ ] Create PR: `gh pr create`
- [ ] All 4 phases of `professional-document-registration` PRD now complete
