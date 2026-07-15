# Implementation Report

**Plan**: `@.claude/PRPs/plans/contract-signature-phase-3-verification.plan.md`
**Branch**: `dev`
**Date**: 2026-07-07
**Status**: COMPLETE

---

## Summary

Implemented the public contract verification flow: a `POST /api/check/[codigo]` Route Handler
that recomputes SHA-256 over an uploaded PDF and compares it against the stored `content_hash`
for the matching `verification_code`, and a public `/check/[codigo]` page with drag-and-drop
upload and success/failure states. This makes the verification link stamped on signed contract
PDFs (Phase 2) resolve to a working page instead of a 404.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning                                                                 |
| ---------- | --------- | ------ | --------------------------------------------------------------------------- |
| Complexity | MEDIUM    | MEDIUM | Matched — two files, mirrored existing patterns exactly                    |
| Confidence | High      | High   | Root cause and patterns were correct; one undocumented issue found (below) |

**Deviation from plan**: `apps/web/proxy.ts` (the Next.js middleware) already contained a
`"/check/:codigo"` entry in its `publicRoutes` list, but the match is done with
`pathname.startsWith(route)` — a literal string comparison, not a path-pattern matcher. Since
`":codigo"` is never a real path segment, `"/check/TESTCODE123".startsWith("/check/:codigo")` is
always `false`, so every request to the public verification page and its API route was being
redirected to `/login`. This wasn't in the plan's "Files to Change" list (the plan predates this
stale entry, likely added speculatively in an earlier phase). Fixed by changing the entries to
`"/check/"` and adding `"/api/check/"`, both matched with `startsWith`, consistent with how every
other entry in that list works.

---

## Tasks Completed

| # | Task | File | Status |
| - | ---- | ---- | ------ |
| 1 | CREATE Route Handler | `apps/web/app/api/check/[codigo]/route.ts` | ✅ |
| 2 | CREATE public verification page | `apps/web/app/check/[codigo]/page.tsx` | ✅ |
| — | FIX stale proxy public-route entry (deviation) | `apps/web/proxy.ts` | ✅ |

---

## Validation Results

| Check       | Result | Details                                                              |
| ----------- | ------ | --------------------------------------------------------------------- |
| Type check  | ✅     | `pnpm check-types` — no errors                                       |
| Lint        | ✅     | `biome lint --write --unsafe` — "No issues found" on both new files  |
| Build       | ✅     | `pnpm --filter web build` — `/check/[codigo]` and `/api/check/[codigo]` both appear as dynamic (`ƒ`) routes |
| Browser     | ✅     | Manual `curl` smoke tests against `pnpm --filter web dev` (see below) |

### Manual browser/curl validation performed

- `GET /check/TESTCODE123` → `200 OK` (previously `307` to `/login` before the proxy fix)
- `POST /api/check/TESTCODE123` with no file → `400 { error: "Nenhum arquivo enviado" }`
- `POST /api/check/TESTCODE123` with a non-PDF file (`text/plain`) → `400 { error: "Envie um arquivo PDF" }`
- `POST /api/check/TESTCODE123` with a fake PDF (wrong/nonexistent code) → `200 { valid: false }` — uniform failure response, no distinction between "code not found" and "hash mismatch"

Not performed (requires a real signed contract + downloaded PDF in a live Supabase environment):
genuine-PDF success path, tampered-PDF rejection, full incognito-window pass. The route logic
mirrors `sign-patient-contract-action.ts`'s hash algorithm exactly and was verified via code
inspection; the `{valid:false}` uniform-failure path was verified live.

---

## Files Changed

| File | Action | Lines |
| ---- | ------ | ----- |
| `apps/web/app/api/check/[codigo]/route.ts` | CREATE | +59 |
| `apps/web/app/check/[codigo]/page.tsx` | CREATE | +224 |
| `apps/web/proxy.ts` | UPDATE (deviation, not in original plan) | +1/-1 |

---

## Deviations from Plan

- Fixed a pre-existing bug in `apps/web/proxy.ts` where the public-route matcher for `/check/:codigo`
  never actually matched any real request path, silently redirecting all verification traffic to
  `/login`. Not part of the plan's file list, but required for the feature's core acceptance
  criterion ("`/check/[codigo]` renders publicly with no login required") to hold.

---

## Issues Encountered

None beyond the proxy routing issue above, which was root-caused and fixed.

---

## Tests Written

No unit test runner exists in this repo (per plan's Testing Strategy). Verification relied on
type-checking, build output, and manual `curl`-based endpoint testing against a local dev server,
as specified in the plan's Level 3 validation.

---

## Next Steps

- [ ] Review implementation
- [ ] End-to-end test with a real signed contract PDF against a live Supabase project
- [ ] Create PR: `gh pr create` (if applicable)
