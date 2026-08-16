# Implementation Report

**Plan**: `@.claude/PRPs/plans/patient-contract-signature-phase-7-pdf-preview.plan.md`
**Branch**: `feature/patient-contract-signature`
**Date**: 2026-08-15
**Status**: COMPLETE (Level 1–3 automated validation passed; Level 5/6 browser walkthrough not run — see Issues Encountered)

---

## Summary

Replaced the HTML/CSS contract simulation in `contract-settings-screen.tsx`,
`personal-contract-settings-screen.tsx`, and `patient-contract.tsx` (preview modal + readonly
mode) with a real PDF rendered via `react-pdf` (client-side) fed by the exact same
`renderContractPdfBuffer()` pipeline used for the signed document. Draft previews are generated
on demand through a new `previewContractPdfAction` that never touches Storage/DB; the already-
signed case reuses the existing `getDocumentDownloadUrlAction`. `contract-signature-preview.tsx`
was deleted since the real PDF now renders the signature footer itself.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                 |
| ---------- | --------- | ------ | -------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM | Matched — worker asset path resolution was the only non-trivial gotcha    |
| Confidence | High (implied by plan detail) | High | Root causes/patterns identified in the plan were all accurate |

**Deviation from plan**: `apps/web/proxy.ts`'s middleware matcher excluded image extensions
(`svg|png|jpg|jpeg|gif|webp`) from auth-gating but not `.mjs`, so `GET /pdf.worker.min.mjs` was
307-redirecting to `/login?redirectTo=...` for any request without a valid session cookie
(confirmed via `curl`). Added `mjs` to the matcher's negative-lookahead extension list, mirroring
the existing image exclusion. Not called out in the original plan/Mandatory Reading, but directly
blocks the pdf.js worker from loading in any context where the browser doesn't attach cookies to
the classic-Worker script fetch.

**Post-implementation follow-up (user-requested)**: the draft/on-the-fly PDF preview
(`previewContractPdfAction`) originally omitted the signature footer entirely, since
`renderContractPdfBuffer`'s `signature` param was left `undefined` for unsigned drafts — matching
the real signed-PDF behavior but losing the footer the old HTML simulation always showed. Added an
optional `signaturePreview` input (`city`, `state`, `contratanteName`, `contratadaName`) to the
action; when present it builds a `signature` object (locality line via the existing
`buildSignatureLocalityLine`, blank `signedByName`/`verificationCode`/etc. since the PDF template's
stamp overlay is commented out and never renders them anyway) so the draft preview shows the
locality line + blank signature lines + party names "as if already finalized." Wired into all
three preview call sites: `patient-contract.tsx` (both the editing-mode preview modal and the
readonly-but-unsigned case — restored the `patientName`/`contratadaName` state that had been
removed as dead code, since it's needed again here) and both template screens (placeholder
`"[Nome da gestante]"` for CONTRATANTE, enterprise/autonomous name for CONTRATADA, matching the
old `ContractPreview` components' placeholder text).

---

## Tasks Completed

| #   | Task                                                                 | File                                                                 | Status |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------- | ------ |
| 1   | Add `react-pdf` dependency                                          | `apps/web/package.json`                                             | ✅     |
| 2   | Copy pdf.js worker to `public/` on dev/build                        | `apps/web/package.json`, `apps/web/scripts/copy-pdf-worker.mjs`, `apps/web/.gitignore` | ✅     |
| 3   | `previewContractPdfAction` (render draft PDF without persisting)    | `apps/web/src/actions/preview-contract-pdf-action.ts`               | ✅     |
| 4   | `PdfViewer` client component                                        | `apps/web/src/components/shared/pdf-viewer.tsx`                     | ✅     |
| 5   | Wire `PdfViewer` into `patient-contract.tsx` (preview modal + readonly) | `apps/web/src/components/shared/patient-contract.tsx`            | ✅     |
| 6   | Wire `PdfViewer` into both contract settings screens                | `apps/web/src/screens/contract-settings-screen.tsx`, `apps/web/src/screens/personal-contract-settings-screen.tsx` | ✅ |
| 7   | Delete `contract-signature-preview.tsx` after confirming no callers | `apps/web/src/components/shared/contract-signature-preview.tsx`     | ✅     |
| 8   | Static validation + worker-serving fix                              | `apps/web/proxy.ts`                                                  | ✅ (Level 1/3 automated; Level 5/6 not exercised — see below) |

---

## Validation Results

| Check                          | Result | Details                                                              |
| ------------------------------- | ------ | ---------------------------------------------------------------------- |
| Type check (`pnpm check-types`) | ✅     | No errors                                                             |
| Lint (`biome check`)            | ✅     | 0 errors after auto-format on touched files                          |
| Build (`pnpm build`, webpack)   | ✅     | Compiled successfully; `public/pdf.worker.min.mjs` present pre-build |
| Worker served as static asset  | ✅     | `curl https://localhost:3000/pdf.worker.min.mjs` → `200 application/javascript` after the proxy.ts matcher fix (was `307` before) |
| Browser walkthrough (Level 5/6) | ⏭️ Not run | No test credentials available in this environment — see Issues Encountered |

---

## Files Changed

| File                                                                 | Action | Notes |
| ----------------------------------------------------------------------- | ------ | ----- |
| `apps/web/package.json`                                             | UPDATE | `react-pdf@^10.4.1` dep + `copy-pdf-worker`/`predev`/`prebuild` scripts |
| `apps/web/scripts/copy-pdf-worker.mjs`                              | CREATE | Resolves pdfjs-dist's worker via `require.resolve` relative to react-pdf's install dir (pnpm-hoisting-agnostic) |
| `apps/web/.gitignore`                                               | UPDATE | Ignore generated `public/pdf.worker.min.mjs` |
| `apps/web/src/actions/preview-contract-pdf-action.ts`               | CREATE | Renders draft PDF from in-memory header/title/clauses, no persistence; optional `signaturePreview` input adds a signature footer to the draft render |
| `apps/web/src/components/shared/pdf-viewer.tsx`                     | CREATE | `react-pdf` viewer, `{ url }` or `{ base64 }` source |
| `apps/web/src/components/shared/patient-contract.tsx`               | UPDATE | Preview modal + readonly mode now render real PDFs; simplified `ContractDocument` to editing-mode-only header wrapper; removed now-dead `patientName`/`contratadaName` state |
| `apps/web/src/screens/contract-settings-screen.tsx`                 | UPDATE | Preview button generates real PDF from placeholder header blocks; removed local `ContractPreview` |
| `apps/web/src/screens/personal-contract-settings-screen.tsx`        | UPDATE | Same change as above |
| `apps/web/src/components/shared/contract-signature-preview.tsx`     | DELETE | No remaining callers after Tasks 5–6 |
| `apps/web/proxy.ts`                                                 | UPDATE | Excluded `.mjs` from the auth middleware matcher so `/pdf.worker.min.mjs` isn't 307-redirected |

---

## Deviations from Plan

- `apps/web/proxy.ts` middleware matcher fix (see Assessment vs Reality) — required for the
  worker to actually load; not anticipated by the plan.

---

## Issues Encountered

- No test/login credentials were available in this sandboxed environment, so the Level 5/6
  manual browser checklist (open each of the three preview surfaces, confirm real PDF renders,
  confirm no worker-version console errors, repeat under `pnpm build && pnpm start`) was not
  exercised end-to-end. What **was** verified: `pnpm check-types`, `pnpm build` (webpack), and
  that `/pdf.worker.min.mjs` is reachable with `200` (not `307`) from a running `pnpm dev` server.
  **Recommend a manual pass before merging**: open a patient contract (editing + readonly/signed),
  and both `/settings/contract` and `/profile/settings/contract` template screens, confirming the
  PDF renders and the browser console shows no `pdfjs` worker-version mismatch.

---

## Tests Written

None — matches the plan's Testing Strategy (no existing test suite for these components/actions;
validation is via type-check + build + manual browser check).

---

## Next Steps

- [ ] Manual browser QA per "Issues Encountered" above (dev **and** `build && start`)
- [ ] Review implementation
- [ ] Create PR: `gh pr create` (if applicable)
- [ ] Merge when approved
