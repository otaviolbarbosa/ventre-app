# Feature: Multi-Template Base Contracts — Phase 5: End-to-End Validation

## Summary

Phases 1–4 (schema migration, server actions, settings UI, patient-contract UI) are implemented and each individually type-checked/linted clean. This phase is **not a code-writing phase** — it is a manual + browser validation pass to confirm the three touched surfaces (`/settings/contract`, `/profile/settings/contract`, patient-contract tab) work end-to-end together, including legacy-data edge cases (`name IS NULL`), before opening a PR.

## User Story

As a manager or autonomous professional
I want to create, edit, and select between multiple named base contract templates, and generate a patient contract from any of them
So that I can confirm the multi-template feature works correctly before it ships

## Problem Statement

No integration/browser validation has been run yet (each phase report lists it under "Next Steps, not performed"). Type-checking confirms the code compiles, but does not confirm: dropdowns populate correctly, create vs. edit vs. save-as-new write the correct rows, legacy `name IS NULL` rows render a sane fallback label, and the patient-contract sign/PDF flow still works after the `no-base`/`choose-base`/`no-contract` mode collapse.

## Solution Statement

Run a scripted manual QA pass across both settings screens and the patient-contract component, as both an **enterprise staff/manager** account and an **autonomous professional** account, verifying each acceptance scenario below via the browser (Chrome MCP) against local dev (`pnpm dev` in `apps/web`). Use Supabase MCP / `execute_sql` for read-only checks of resulting rows when a claim can't be fully verified visually (e.g., confirming `enterprise_id`/`user_id` on a newly created row).

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT (validation only, no new capability)   |
| Complexity       | LOW                                                 |
| Systems Affected | `apps/web` settings screens, patient-contract UI, contracts server actions |
| Dependencies     | None new — validates Phases 1–4                    |
| Estimated Tasks  | 4 (setup, enterprise flow, personal flow, patient-contract flow) |

---

## Current Implementation (ground truth, read directly from code)

| File | Role |
|------|------|
| `apps/web/src/screens/contract-settings-screen.tsx:29-247` | `/settings/contract` — enterprise base templates. `contracts` prop pre-fetched server-side, `Select` (ungrouped) at :143-154 keyed by `c.id`, label `c.name ?? c.title`. "Editar" button (:94-112) calls `save({ contractId: selectedId, name: undefined, ... })`. "Criar novo" button (:132-135) opens `SaveNewTemplateModal`, `onConfirm` (:233-243) calls `save({ contractId: undefined, name, ... })`. "Novo contrato" (:156-159) calls `handleNewContract()` which just resets local state (:43-49) — does not delete/touch any row. |
| `apps/web/src/screens/personal-contract-settings-screen.tsx` | `/profile/settings/contract` — same pattern, scoped to `saved-personal-contract-action.ts`, autonomous professional's personal templates. |
| `apps/web/src/actions/save-base-contract-action.ts` | Enterprise save action — create (no `contractId`) vs. update (`contractId` present). |
| `apps/web/src/actions/save-personal-contract-action.ts` | Personal save action — same create/update split, scoped `user_id` + `enterprise_id IS NULL`. |
| `apps/web/src/actions/create-base-contract-from-patient-action.ts` | "Salvar como novo" from patient-contract — always inserts with `user_id = user.id`, `enterprise_id = null`, `is_base_contract = true`. |
| `apps/web/src/actions/get-patient-contract-action.ts:56-99` | Returns `enterpriseBaseOptions` (only if `profile.enterprise_id` set) and `personalBaseOptions` (always, scoped to `user_id` + `enterprise_id IS NULL`), each row mapped with `name: row.name` (nullable). |
| `apps/web/src/components/shared/patient-contract.tsx:33,197-270` | `Mode = "loading" \| "select" \| "editing" \| "readonly"`. `select` mode (:226-271) shows grouped `Select` — "Contratos da empresa" group only rendered `if (enterpriseOptions.length > 0)` (:241), "Meus contratos pessoais" only `if (personalOptions.length > 0)` (:251); label is `opt.name ?? opt.title` (:246, :256). "Novo contrato" button (:264-267) calls `handleNewContract()` (:209-216), resets fields, uses `enterpriseHeaderBlocks` for header (not personal) regardless of professional type. "Salvar como novo" only appears in `editing` mode (:414-417), opens `SaveNewTemplateModal`, wired to `createBaseFromPatient` (:154-163) → `createBaseContractFromPatientAction`. |

**Key fallback already implemented**: label rendering is `opt.name ?? opt.title` in all three dropdowns — legacy rows with `name IS NULL` fall back to `title`, not a blank string. This satisfies PRD risk row "Dados legados sem `name` aparecendo em branco" — verify visually rather than re-implement.

---

## NOT Building / NOT Changing

- No code changes are expected during this phase. If a bug is found, log it as a finding — do not silently patch without flagging it to the user first, since fixes belong to a follow-up task, not folded invisibly into "validation."
- Not testing delete/archive of templates — explicitly out of scope per PRD ("Won't" list).
- Not testing template-usage indicators or renaming — explicitly out of scope per PRD.
- Not writing automated tests — no test infra exists for this feature area (confirmed in Phase 1–4 reports); this phase is manual/browser only.

---

## Validation Scenarios (execute in order)

### Task 1: Setup

- **ACTION**: Start dev server and confirm two test accounts are available: one enterprise staff/manager (`profile.enterprise_id` set) and one autonomous professional (`profile.enterprise_id IS NULL`, `user_type = professional`).
- **RUN**: `pnpm dev` (from repo root or `apps/web`)
- **VALIDATE**: App loads at `http://localhost:3000`, login works for both test accounts.
- **GOTCHA**: If no autonomous-professional test account exists, this phase cannot verify the personal-only dropdown branch (`enterpriseOptions.length === 0` case in patient-contract.tsx:241) — flag to user rather than skipping silently.

### Task 2: `/settings/contract` (enterprise) — as manager/staff

Navigate to `/settings/contract`. For each step, confirm via UI and (where noted) via `execute_sql` against the `contracts` table.

1. **Empty state**: If no enterprise templates exist yet, dropdown placeholder shows "Selecione um contrato existente", "Editar" button is disabled (`disabled={isExecuting || !selectedId}`, contract-settings-screen.tsx:96).
2. **Create first template**: Fill title/city/state/clauses, click "Criar novo" → `SaveNewTemplateModal` → enter name "Template Parto Hospitalar" → confirm. Expect: toast "Contrato base salvo com sucesso", modal closes, form resets to blank (`handleNewContract()` called in `onSuccess` when `pendingActionRef.current === "create"`, :64-67), `router.refresh()` runs.
3. **Verify row**: `select id, name, title, enterprise_id, user_id, is_base_contract from contracts where is_base_contract = true and enterprise_id is not null order by created_at desc limit 1;` → confirm `name = 'Template Parto Hospitalar'`, `enterprise_id` matches the manager's enterprise, `user_id` is null or the creator (per existing schema convention — verify against migration, not assumed).
4. **Create second template**: Repeat with a different name, e.g. "Template Parto Domiciliar". Confirm dropdown now lists both, sorted by `created_at ascending` (contract-settings-screen prop order comes from server fetch — verify oldest-first).
5. **Select + edit in-place**: Select "Template Parto Hospitalar" from dropdown → form populates (title/city/state/clauses match what was saved) → change a clause → click "Editar". Expect: toast success, **same row id updates** (verify via SQL: `updated_at` changed, `id` unchanged, row count for enterprise still 2, not 3).
6. **Select + save as new (duplicate)**: Select "Template Parto Domiciliar" → edit a clause → click "Criar novo" → name it "Template Parto Domiciliar v2" → confirm. Expect: a **third** row is inserted (not an update of the domiciliar template), original "Template Parto Domiciliar" row content unchanged.
7. **"Novo contrato" button**: With a template selected and edited in the form, click "Novo contrato" (Plus icon). Expect: form clears to `DEFAULT_TITLE` blank state, `selectedId` becomes `null`, "Editar" button becomes disabled again — and critically, **no row was touched** (nothing persisted merely by clicking this button).
8. **Preview**: Click "Preview" (Eye icon) with a template loaded — confirm the `ContractPreview` modal renders with placeholders for CONTRATANTE/EQUIPE CONTRATADA and real CONTRATADA block for the enterprise.

### Task 3: `/profile/settings/contract` (personal) — as autonomous professional

Repeat the same 8 sub-steps as Task 2, but on `/profile/settings/contract`, using `savePersonalContractAction`. Additionally:

9. **Cross-scope isolation check**: Confirm templates created here do NOT appear in the enterprise manager's `/settings/contract` dropdown, and vice versa (query: personal rows have `enterprise_id IS NULL`, `user_id = <professional's id>`; enterprise rows have `enterprise_id = <enterprise id>`).

### Task 4: Patient-contract tab (`patient-contract.tsx`) — both account types

Navigate to an existing patient's contract tab (patient with no active `is_base_contract=false` contract yet, so `mode` starts at `select`).

10. **Grouped select, empty groups suppressed**: As the autonomous professional (no `enterprise_id`), confirm the "Contratos da empresa" `SelectGroup` is entirely absent from the dropdown (not rendered as an empty group) — per :241 conditional. As the manager, confirm both groups render when both have templates, with correct labels ("Contratos da empresa" / "Meus contratos pessoais").
11. **No pre-load**: Confirm the tab does NOT auto-select or pre-populate any template on load — user lands on the `select` screen with an empty `Select` (per PRD Phase 4 success signal).
12. **Select a template → editing mode**: Pick an enterprise template (as manager) → confirm `mode` becomes `editing`, fields populate from the selected option, `headerBlocks` shows the enterprise-derived header (`enterpriseHeaderBlocks`, since `enterpriseMatch` truthy at :198-199).
13. **Select a personal template → editing mode**: Pick a personal template → confirm `headerBlocks` switches to `personalHeaderBlocks` (team-members-as-individuals header, per :161-164 in get-patient-contract-action.ts).
14. **"Novo contrato" from select mode**: Click "Novo contrato" (:264-267) → confirm blank editing form, header defaults to `enterpriseHeaderBlocks` (:214) regardless of account type — note this as expected-per-code behavior, not a bug, unless it visibly breaks for autonomous professionals with no enterprise (verify `enterpriseHeaderBlocks` is not null/broken for them — trace back to :89, only set when `data?.headerBlocks` truthy, which for autonomous professional comes from the `"autonomous"` branch in get-patient-contract-action.ts:147-157, so it should still be populated correctly. Flag if UI shows a broken/empty header for this account type.)
15. **"Salvar como novo" from editing mode**: With a template loaded (or blank + new content), click "Salvar como novo" → `SaveNewTemplateModal` → enter name → confirm. Expect: `createBaseContractFromPatientAction` inserts a new row with `user_id = <current user>`, `enterprise_id = null` — **even if the manager started from an enterprise template**. Verify via SQL this never writes `enterprise_id`.
16. **Sign/generate contract**: From `editing` mode, click "Gerar contrato" → confirm `signPatientContractAction` fires, `mode` becomes `readonly` after `fetchContract` reload, signature info displays if signed.
17. **Readonly → edit → cancel**: From `readonly` mode with an unsigned contract, click "Editar contrato" → `mode` becomes `editing` → click "Cancelar" → confirm it returns to `readonly` (not `select`), per :406 `setMode(contractExists ? "readonly" : "select")`.
18. **Delete contract**: From `readonly`, click "Excluir contrato" → confirm modal → confirm `mode` returns to `select` after deactivation (not stuck on `readonly`).
19. **PDF export**: Click "Baixar contrato" in `readonly` mode, both unsigned (regenerates via `/api/patients/[id]/contract/pdf`) and signed (reuses `signed_document_id` via `getDocumentDownloadUrlAction`) — confirm both produce a valid PDF/download URL.

---

## Validation Commands

### Level 1: STATIC_ANALYSIS (already passing per Phase 1-4 reports — re-run to confirm no regressions from any fix applied during this phase)

```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/components/shared/patient-contract.tsx apps/web/src/screens/contract-settings-screen.tsx apps/web/src/screens/personal-contract-settings-screen.tsx
```
**EXPECT**: Exit 0, no errors.

### Level 5: BROWSER_VALIDATION

Use the `claude-in-chrome` MCP tools against local dev server. Execute Task 2, 3, 4 scenarios above. Capture a screenshot or note per scenario that fails.

### Level 6: MANUAL_VALIDATION (Supabase MCP read checks)

Use `mcp__supabase__execute_sql` (read-only `select` statements only) to confirm row counts/ownership after each create/edit/save-as-new step, per the SQL hints embedded in Task 2/3/4 above.

---

## Acceptance Criteria

- [ ] All 19 scenarios in Tasks 2–4 pass as described, for both an enterprise manager and an autonomous professional account
- [ ] No row is ever created/updated unexpectedly (verified via SQL spot-checks) — "Novo contrato" buttons never persist by themselves
- [ ] "Salvar como novo" from `patient-contract.tsx` never writes `enterprise_id`, even when started from an enterprise template
- [ ] Legacy `name IS NULL` rows (if any exist in the dev DB) render their `title` as the dropdown label, not a blank entry
- [ ] Sign, cancel-back-to-readonly, delete, and PDF export flows all still work after the mode collapse
- [ ] `pnpm check-types` and biome lint remain clean
- [ ] Any bug found is reported to the user as a finding, not silently patched

---

## Completion Checklist

- [ ] Task 1: Setup — dev server running, both account types available
- [ ] Task 2: Enterprise settings flow validated (8 sub-steps)
- [ ] Task 3: Personal settings flow validated (9 sub-steps incl. isolation check)
- [ ] Task 4: Patient-contract flow validated (10 sub-steps)
- [ ] Level 1 static analysis re-confirmed clean
- [ ] Findings (if any) reported to user before any fix is applied
- [ ] PRD's Implementation Phases table updated: Phase 5 status → `complete`

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| No autonomous-professional test account exists locally | Medium | Blocks Task 3 and part of Task 4 | Flag to user before starting; ask them to provision one or accept partial coverage |
| Dev DB has no legacy `name IS NULL` rows to exercise the fallback | Medium | Can't visually confirm fallback label | Either seed one manually via SQL (`update contracts set name = null where id = '<test row>'`, then revert) or accept static-code confirmation (already read at patient-contract.tsx:246,256 and contract-settings-screen.tsx:150) as sufficient |
| A real bug is found | Low-Medium | Blocks PR | Report to user with reproduction steps; do not silently fix without confirming scope with user first |

---

## Notes

This plan intentionally has no "Files to Change" or "Patterns to Mirror" sections in the usual PRP sense — Phase 5 is a QA pass over already-implemented code, not a code-authoring task. If validation surfaces a genuine defect, that becomes a new small follow-up plan (or a direct fix approved by the user), not an in-place amendment to this validation plan.
