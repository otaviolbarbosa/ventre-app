# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/professional-document-registration-phase-2-shared-form-fields.plan.md`
**Branch**: `feature/professional-document-registration-phase-2-shared-form-fields`
**Date**: 2026-07-14
**Status**: PARTIAL (Task 6 manual browser validation not executed — see below)

---

## Summary

Added a shared Zod schema for professional council documents (CRM/RQE/CREFITO/COREN), a reusable `ProfessionalDocumentsFields` component conditioned on `professional_type`, and wired both into `updateProfileAction` and `EditProfileModal` so `users.professional_documents` can now be read and written end-to-end from the existing profile-edit UI.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                 |
| ---------- | --------- | ------ | -------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM | Matched — the only real friction was TS generics for a reusable `useFieldArray` component, not the domain logic. |
| Confidence | (n/a)     | High   | Root design decision (flat optional schema, no discriminated union) held up with no rework needed. |

**Deviations from the plan and why:**
- The plan's suggested prop type `Control<{ professional_documents?: ProfessionalDocumentsInput }>` for `ProfessionalDocumentsFields` did not type-check against `Control<EditProfileInput>` (react-hook-form's `Control` is structurally strict about the full field-values shape). Made the component generic over `TFieldValues extends FieldValues & { professional_documents?: ProfessionalDocumentsInput }` instead — functionally identical, but now correctly reusable across any parent form shape (matches the plan's stated intent).
- `useFieldArray`'s `append({ number: "", uf: "" })` doesn't type-check directly against the zod-enum-derived `uf` literal union (an empty string isn't a valid UF). Cast through `Parameters<typeof append>[0]` at the call site — the value is corrected the instant the user picks a UF from the `Select`, and empty rows are stripped before submit anyway (see normalization below).
- Added client-side normalization (`normalizeProfessionalDocuments` in the modal) not explicitly assigned to a task, but required by the plan's own Edge Case Checklist ("saving with all fields empty must not error"): empty document entries (empty `number`) and empty `rqe` arrays are stripped to `undefined` before calling the action, so an untouched documents section submits `professional_documents: undefined` rather than `{ crm: { number: "", uf: "" } }`, which would otherwise fail zod validation.

---

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Shared Zod schema | `apps/web/src/lib/validations/professional-documents.ts` | ✅ |
| 2 | Shared conditional field component | `apps/web/src/components/shared/professional-documents-fields.tsx` | ✅ |
| 3 | Extend `updateProfileAction` | `apps/web/src/actions/update-profile-action.ts` | ✅ |
| 4 | Wire modal (schema, props, normalization, render) | `apps/web/src/modals/edit-profile-modal.tsx` | ✅ |
| 5 | Pass new props from screen | `apps/web/src/screens/profile-screen.tsx` | ✅ |
| 6 | Manual end-to-end browser verification | — | ⚠️ Not executed (Chrome extension unresponsive; user opted to test manually) |
| 7 | Type-check + lint clean | — | ✅ |

---

## Validation Results

| Check       | Result | Details                                                        |
| ----------- | ------ | --------------------------------------------------------------- |
| Type check  | ✅     | `pnpm check-types` — 0 errors across all packages               |
| Lint        | ✅     | `biome lint --write --unsafe` on all 5 touched files — no issues |
| Unit tests  | N/A    | No existing test infra for actions/modals in this repo (confirmed, matches plan's Testing Strategy note) |
| Build       | ⏭️     | Not run (not requested in plan's Validation Commands; type-check covers compile correctness) |
| Manual/E2E  | ⚠️     | Not performed — browser automation tool was unresponsive (possible pending permission prompt in the Chrome extension). Dev server is already running on `localhost:3000`. |

---

## Files Changed

| File | Action | Notes |
| ---- | ------ | ----- |
| `apps/web/src/lib/validations/professional-documents.ts` | CREATE | Shared schema, hardcoded UF tuple synced with `ESTADOS_BR` |
| `apps/web/src/components/shared/professional-documents-fields.tsx` | CREATE | Generic over parent form's field values |
| `apps/web/src/actions/update-profile-action.ts` | UPDATE | +3 lines: import + schema key + update payload key |
| `apps/web/src/modals/edit-profile-modal.tsx` | UPDATE | +48/-1: new props, merged schema, reset seeding, normalization, render |
| `apps/web/src/screens/profile-screen.tsx` | UPDATE | +2: pass `professionalType`/`professionalDocuments` |

---

## Issues Encountered

- TypeScript generic friction between `react-hook-form`'s `Control<T>` and a schema-derived, more specific `T` for a reusable sub-form component — resolved via generics (see Deviations).
- Chrome browser automation (`mcp__claude-in-chrome__tabs_context_mcp`) did not respond even after switching to the correct connected browser — likely a stuck/pending permission prompt in the extension side panel. Did not retry further; user asked to test manually instead.

---

## Next Steps

- [ ] User to manually verify in browser: open `/profile`, click "Editar Perfil" for a user with `professional_type = obstetra` — fill CRM number+UF, add 2 RQE rows, save, reopen modal to confirm persisted values; repeat quickly for `fisio` (CREFITO+RQE), `enfermeiro` (COREN only, no RQE), and `doula` (no documents section at all).
- [ ] Create PR: `gh pr create` or `/prp-pr`
- [ ] Merge when approved
- [ ] Continue with Phase 3 (onboarding) and/or Phase 4 (banner + deep link), which can run in parallel per the PRD's Parallelism Notes — both depend only on this phase's shared schema/component/action.

### PRD Progress

**PRD**: `.claude/PRPs/prds/professional-document-registration.prd.md`
**Phase Completed**: #2 - Shared form fields

| # | Phase | Status |
|---|-------|--------|
| 1 | Database | complete |
| 2 | Shared form fields | complete |
| 3 | Onboarding | pending |
| 4 | Banner + deep link | pending |

**Next Phase**: Phase 3 (Onboarding) and Phase 4 (Banner + deep link) can now both start (parallel, per PRD notes).

To continue: `/prp-plan .claude/PRPs/prds/professional-document-registration.prd.md`
