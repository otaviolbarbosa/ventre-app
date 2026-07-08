# Implementation Report

**Plan**: `.claude/PRPs/plans/contract-management-phase-5-pdf-export.plan.md`
**Branch**: `dev`
**Date**: 2026-06-27
**Status**: COMPLETE

---

## Summary

Implemented end-to-end PDF export for patient contracts. Added an "Exportar PDF" button to the `PatientContract` component that calls a new Route Handler `POST /api/patients/[id]/contract/pdf`, which generates a PDF with a formatted header (CONTRATANTE/CONTRATADA/EQUIPE CONTRATADA) plus TipTap-generated HTML clauses, uploads it to the `patient_documents` Supabase Storage bucket, inserts a `patient_documents` record, and returns a signed URL that opens in a new tab.

---

## Tasks Completed

| # | Task | File | Status |
|---|------|------|--------|
| 1 | Install @react-pdf/renderer@4.5.1 + react-pdf-html | `apps/web/package.json` | ✅ |
| 2 | Download Inter-Regular.ttf + Inter-Bold.ttf | `apps/web/public/fonts/` | ✅ |
| 3 | Create contract-header-text.ts utility | `apps/web/src/lib/contract-header-text.ts` | ✅ |
| 4 | Create contract-pdf-document.tsx React PDF component | `apps/web/src/components/shared/contract-pdf-document.tsx` | ✅ |
| 5 | Create POST route handler for PDF generation | `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | ✅ |
| 6 | Add "Exportar PDF" button to PatientContract component | `apps/web/src/components/shared/patient-contract.tsx` | ✅ |

---

## Validation Results

| Check | Result | Details |
|-------|--------|---------|
| Type check | ✅ | No errors (pnpm check-types) |
| Build | ✅ | Next.js build successful, route listed in output |

---

## Files Changed

| File | Action | Notes |
|------|--------|-------|
| `apps/web/package.json` | UPDATE | Added @react-pdf/renderer@4.5.1, react-pdf-html |
| `apps/web/public/fonts/Inter-Regular.ttf` | CREATE | 664KB static TTF from rsms/inter v3.19 |
| `apps/web/public/fonts/Inter-Bold.ttf` | CREATE | 698KB static TTF from rsms/inter v3.19 |
| `apps/web/src/lib/contract-header-text.ts` | CREATE | Pure utility: buildContractHeaderBlocks() |
| `apps/web/src/components/shared/contract-pdf-document.tsx` | CREATE | React PDF document with Inter font + Html clause renderer |
| `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | CREATE | POST handler: auth → fetch → generate → upload → insert → signedUrl |
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | Added isExporting state, handleExportPdf, "Exportar PDF" button |

---

## Deviations from Plan

1. **Font source**: Google Fonts repository didn't have static TTF files at the expected path (`ofl/inter/static/`). Used rsms/inter v3.19 GitHub release ZIP instead — same Inter font, same quality.
2. **renderToBuffer type cast**: Added `as React.ReactElement<DocumentProps>` cast because `React.createElement(ContractPdfDocument, ...)` returns `FunctionComponentElement` which TypeScript couldn't directly assign to `ReactElement<DocumentProps>`. This is a safe cast since `ContractPdfDocument` renders a `<Document>` element.
3. **@fontsource/inter dev dep**: Temporarily installed to check font availability, removed when WOFF/WOFF2-only files were found. Final solution used Inter v3.19 TTF static files.

---

## Issues Encountered

- GitHub raw URLs for the google/fonts repository's static Inter TTF files returned 404 (the files don't exist in that path in the current repo state). Resolved by downloading from the rsms/inter releases archive.
- Initial curl downloads from github.com returned HTML pages rather than binary TTF files. Fixed by using raw.githubusercontent.com, which also returned 404, then switched to the official release ZIP.

---

## Next Steps

- [ ] Browser test: navigate to a patient with a saved contract, click "Exportar PDF", verify PDF opens in new tab
- [ ] Verify PDF appears in patient's Documentos accordion
- [ ] Check Portuguese characters (ã, ç, é) render correctly in the PDF
- [ ] Create PR: `gh pr create` or `/prp-pr`
