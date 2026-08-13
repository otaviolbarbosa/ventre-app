# Feature: Multi-Template Base Contracts — Phase 3 (Settings Pages UI)

## Summary

Add multi-template selection UI to the two base-contract settings pages (`/settings/contract` for enterprise/staff, `/profile/settings/contract` for personal/professional). Both pages currently auto-load a single base contract via `.maybeSingle()` fetchers and expose one "Salvar" button that upserts by owner. Phase 2 (already implemented, uncommitted) added a `name` column, plural list-fetchers (`getBaseContracts`, `getPersonalBaseContracts`), and create/update-in-place save actions (`contractId` param). Phase 3 wires that plumbing into the UI: both pages switch from single-row to list-row loading, the screens gain a template-picker `Select`, a "Novo contrato" reset button, and two save actions — "Editar" (update in place) and "Criar novo" (always insert, prompts for a name via a modal).

## User Story

As a manager or autonomous professional
I want to pick from my saved contract templates, start a blank one, or save my edits as a brand-new template
So that I can maintain multiple contract variants without overwriting or losing existing ones

## Problem Statement

Today `ContractSettingsScreen` and `PersonalContractSettingsScreen` receive a single `initialContract` (or `null`) from their `page.tsx` loaders and always save via upsert-by-owner (`contractId: initialContract?.id`). There is no way to see other templates, no way to explicitly create a new one without overwriting, and no reset-to-blank affordance. This must change without touching `patient-contract.tsx` (Phase 4) or the save-action/service internals (Phase 2, already done).

## Solution Statement

Both `page.tsx` route files switch from `getBaseContract()`/`getPersonalBaseContract()` (singular) to `getBaseContracts()`/`getPersonalBaseContracts()` (plural), passing the full list as a `contracts` prop instead of `initialContract`. Both screens add `selectedId: string | null` state, defaulting to `null` (no auto-load — success signal from the PRD). A `Select` dropdown lists templates by `name ?? title`; picking one populates the existing `useState` form fields (title/clausesHtml/city/state) from the matching row. A "Novo contrato" button resets `selectedId` to `null` and clears the form fields to blank defaults. The existing single Save button splits into "Editar" (enabled only when `selectedId` is set; calls the save action with `contractId: selectedId`, omitting `name` so the existing name is preserved server-side) and "Criar novo" (always enabled; opens a new shared modal prompting for a name, then calls the save action with no `contractId`, forcing an insert).

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                        |
| Complexity       | LOW                                                 |
| Systems Affected | apps/web (2 route files, 2 screens, 1 new shared modal component) |
| Dependencies     | No new libraries — reuses `@ventre/ui/select`, `@ventre/ui/form`, `@hookform/resolvers/zod` (^4.1.0), `react-hook-form` (^7.54.2), `zod` (~3.24.1), `next-safe-action` (^8.1.4), all already in `apps/web/package.json` |
| Estimated Tasks  | 6                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  page.tsx (server)                                                             ║
║    getBaseContract() ──── .maybeSingle() ──── ONE row (or null, undefined      ║
║                                                 order if 2+ rows exist today)   ║
║       │                                                                        ║
║       ▼                                                                        ║
║  ContractSettingsScreen                                                        ║
║    initialContract auto-seeds useState(title/clausesHtml/city/state)           ║
║    ┌─────────────────────────────────────────┐                                ║
║    │ [Preview]                [Salvar contrato base] │  ← single button       ║
║    └─────────────────────────────────────────┘                                ║
║    Título: [___________________]                                              ║
║    Cidade: [_____]  Estado: [UF ▾]                                            ║
║    [ RichEditor clauses ]                                                      ║
║                                                                                 ║
║  USER_FLOW: open page → one template (or blank) is already loaded → edit →     ║
║             click Salvar → upsert by owner (contractId always sent if a row    ║
║             existed) → overwrites the only template that owner can have.       ║
║  PAIN_POINT: no way to keep template A while creating template B — saving      ║
║              always overwrites in place once a row exists.                     ║
║  DATA_FLOW: page.tsx → getBaseContract()/getPersonalBaseContract() (single)    ║
║             → screen props → save action (contractId always = existing id)     ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  page.tsx (server)                                                             ║
║    getBaseContracts() ──── ordered list, ALL rows for this owner               ║
║       │                                                                        ║
║       ▼                                                                        ║
║  ContractSettingsScreen                                                        ║
║    contracts: Tables<"contracts">[]  (selectedId starts as null — no auto-load)║
║    ┌─────────────────────────────────────────────────────────┐                ║
║    │ [Preview]                    [Editar*]  [Criar novo]     │  * only if     ║
║    └─────────────────────────────────────────────────────────┘  selectedId    ║
║    Contrato base: [Selecione um contrato existente ▾]  [+ Novo contrato]       ║
║    Título: [___________________]                                              ║
║    Cidade: [_____]  Estado: [UF ▾]                                            ║
║    [ RichEditor clauses ]                                                      ║
║                                                                                 ║
║                          ┌──────────────────────────┐                         ║
║                          │ Modal: "Salvar como novo" │  ◄── Criar novo click   ║
║                          │  Nome: [____________]     │                         ║
║                          │  [Cancelar]  [Salvar]     │                         ║
║                          └──────────────────────────┘                         ║
║                                                                                 ║
║  USER_FLOW: open page → nothing pre-loaded, form is blank → pick a template    ║
║             from the dropdown to load it, OR click "Novo contrato" to stay     ║
║             blank → edit → "Editar" updates the selected template in place     ║
║             (disabled if none selected) → "Criar novo" opens a name-prompt     ║
║             modal and always inserts a new row, never overwriting.             ║
║  VALUE_ADD: multiple named templates coexist; explicit control over            ║
║             update-in-place vs. duplicate-as-new.                              ║
║  DATA_FLOW: page.tsx → getBaseContracts()/getPersonalBaseContracts() (list)    ║
║             → screen props (`contracts`) → dropdown selection loads local      ║
║             form state → save action called with either                       ║
║             { contractId: selectedId } (Editar) or                            ║
║             { contractId: undefined, name } (Criar novo, via modal)            ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `app/(dashboard)/settings/contract/page.tsx` | Loads single contract via `getBaseContract()` | Loads list via `getBaseContracts()` | Enables multi-template picker |
| `app/(dashboard)/profile/settings/contract/page.tsx` | Loads single contract via `getPersonalBaseContract()` | Loads list via `getPersonalBaseContracts()` | Same, personal scope |
| `contract-settings-screen.tsx` / `personal-contract-settings-screen.tsx` | Form pre-seeded with the one existing contract; one "Salvar" button always upserts | Form starts blank; `Select` dropdown + "Novo contrato" reset; "Editar" (update, requires selection) / "Criar novo" (insert, name modal) | No silent overwrite; explicit create vs. edit |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/screens/contract-settings-screen.tsx` | 1-166 | Full current screen to modify — form state, save wiring, preview modal |
| P0 | `apps/web/src/screens/personal-contract-settings-screen.tsx` | 1-143 | Same, personal variant — near-identical structure |
| P0 | `apps/web/src/actions/save-base-contract-action.ts` | 1-51 | Exact current save-action contract: `contractId`/`name` optional, update-branch skips `name` if `undefined`, insert-branch defaults `name ?? title` |
| P0 | `apps/web/src/actions/save-personal-contract-action.ts` | 1-49 | Same, personal variant (has extra `.eq("user_id",...).is("enterprise_id", null)` on update branch) |
| P0 | `apps/web/src/services/base-contract.ts` | 1-120 | `getBaseContracts()`/`getPersonalBaseContracts()` (already implemented, ordered by `created_at` ascending) — DO NOT modify this file |
| P1 | `apps/web/src/lib/validations/contract.ts` | 1-14 | `saveBaseContractSchema` — DO NOT modify; `contractId`/`name` are already optional, reuse as-is |
| P1 | `apps/web/app/(dashboard)/settings/contract/page.tsx` | 1-21 | Current server-component loader to update |
| P1 | `apps/web/app/(dashboard)/profile/settings/contract/page.tsx` | 1-22 | Same, personal variant |
| P1 | `apps/web/src/components/shared/page-header.tsx` | 1-49 | `PageHeader`'s `children` slot is a plain flex row — action buttons go here |
| P2 | `apps/web/src/components/shared/finish-care-modal.tsx` | 1-206 | Pattern to MIRROR for the new "Criar novo" name-prompt modal: `ContentModal` + `react-hook-form` + `zodResolver` + `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage`, two-button footer with `Loader2` spinner |
| P2 | `packages/ui/src/shared/content-modal/content-modal.tsx` | 1-62 | `ContentModal` primitive — `{ open, onOpenChange, title, description?, children, contentClassName? }`, auto Dialog/Sheet responsive switch |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [Radix Select — Issue #1569 / PR #2174](https://github.com/radix-ui/primitives/pull/2174) | "Use `\"\"` value to reset to placeholder" | `<SelectItem value="">` still throws at runtime in `@radix-ui/react-select` 2.1.4 — never render an empty-string item. Since every template `id` is a non-empty UUID, this is naturally avoided; just don't add a manual "none" `SelectItem`. |
| [shadcn-ui/ui#772](https://github.com/shadcn-ui/ui/issues/772) | Controlled value type | Radix `Select` `value` prop wants `string | undefined`, not `null` — coerce with `value={selectedId ?? undefined}`. `onValueChange` always receives a plain `string`. |

---

## Patterns to Mirror

**SCREEN_PROP_SHAPE (current, to be changed):**
```typescript
// SOURCE: apps/web/src/screens/contract-settings-screen.tsx:21-24
type ContractSettingsScreenProps = {
  initialContract: Tables<"contracts"> | null;
  headerData: ContractHeaderData;
};
```
Change to:
```typescript
type ContractSettingsScreenProps = {
  contracts: Tables<"contracts">[];
  headerData: ContractHeaderData;
};
```
(mirror the same change in `PersonalContractSettingsScreenProps`)

**SAVE_BUTTON_WIRING (current, single button):**
```typescript
// SOURCE: apps/web/src/screens/contract-settings-screen.tsx:37-43, 62-78
const { execute: save, isExecuting } = useAction(saveBaseContractAction, {
  onSuccess: () => {
    toast.success("Contrato base salvo com sucesso");
    router.refresh();
  },
  onError: ({ error }) => toast.error(error.serverError ?? "Erro ao salvar contrato"),
});
// ...
<Button
  className="gradient-primary hidden sm:flex"
  disabled={isExecuting}
  onClick={() =>
    save({
      contractId: initialContract?.id,
      name: initialContract?.name ?? title,
      title,
      clauses_html: clausesHtml,
      city,
      state,
    })
  }
>
```
KEEP the `useAction` hook exactly as-is (onSuccess/onError shape). REPLACE the single `onClick` payload with two distinct calls — see Task 2 below.

**SELECT_DROPDOWN (existing UF pattern to mirror for the template picker):**
```typescript
// SOURCE: apps/web/src/screens/contract-settings-screen.tsx:126-138
<Select value={state || undefined} onValueChange={setState}>
  <SelectTrigger id="contract-state">
    <SelectValue placeholder="UF" />
  </SelectTrigger>
  <SelectContent>
    {ESTADOS_BR.map((estado) => (
      <SelectItem key={estado.sigla} value={estado.sigla}>
        {estado.sigla}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```
Import already present in both screens: `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";` — no new import needed.

**MODAL_WITH_FORM (mirror exactly, trimmed to one field):**
```typescript
// SOURCE: apps/web/src/components/shared/finish-care-modal.tsx:1-24, 42-50, 54-72, 74-83, 186-201
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(1, "O nome não pode estar vazio"),
});
type FormValues = z.infer<typeof schema>;

// form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "" } });
// async function onSubmit(values) { onConfirm(values.name); form.reset(); }
// footer: <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
//         <Button type="submit" disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
```
Unlike `FinishCareModal`, this new modal does NOT call a server action itself — it takes an `onConfirm(name: string)` callback so both screens can reuse it while calling their own `saveBaseContractAction`/`savePersonalContractAction`. Keep `isPending` as a prop (`isExecuting` from the screen's `useAction`) rather than deriving it internally.

**PAGE_LOADER (current, single-row):**
```typescript
// SOURCE: apps/web/app/(dashboard)/settings/contract/page.tsx:14-19
const [initialContract, headerData] = await Promise.all([
  getBaseContract(),
  getContractHeaderData(),
]);

return <ContractSettingsScreen initialContract={initialContract} headerData={headerData} />;
```
Change `getBaseContract` → `getBaseContracts` (already exported from `services/base-contract.ts`), rename prop `initialContract` → `contracts`. Mirror the same for the personal page (`getPersonalBaseContract` → `getPersonalBaseContracts`).

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/components/shared/save-new-template-modal.tsx` | CREATE | Shared name-prompt modal reused by both settings screens for "Criar novo" |
| `apps/web/src/screens/contract-settings-screen.tsx` | UPDATE | Add `selectedId` state, template `Select`, "Novo contrato" reset, split save into Editar/Criar novo, wire the new modal |
| `apps/web/src/screens/personal-contract-settings-screen.tsx` | UPDATE | Same, personal variant |
| `apps/web/app/(dashboard)/settings/contract/page.tsx` | UPDATE | Swap `getBaseContract()` → `getBaseContracts()`, prop rename `initialContract` → `contracts` |
| `apps/web/app/(dashboard)/profile/settings/contract/page.tsx` | UPDATE | Swap `getPersonalBaseContract()` → `getPersonalBaseContracts()`, prop rename `initialContract` → `contracts` |

**Explicitly NOT touched** (already correct from Phase 2, verified by reading current code): `apps/web/src/actions/save-base-contract-action.ts`, `apps/web/src/actions/save-personal-contract-action.ts`, `apps/web/src/services/base-contract.ts`, `apps/web/src/lib/validations/contract.ts`, `apps/web/src/actions/create-base-contract-from-patient-action.ts`, `apps/web/src/actions/get-patient-contract-action.ts`, `apps/web/src/components/shared/patient-contract.tsx` (Phase 4 scope).

---

## NOT Building (Scope Limits)

- Grouped dropdown (empresa/pessoal) — that's `patient-contract.tsx`, explicitly Phase 4 per the PRD; these two settings pages are each scoped to a single owner type already.
- Delete/archive of templates — out of scope for the whole PRD (v1).
- Auto-selecting the newly created template after "Criar novo" succeeds — the save action currently returns `{ success: true }` with no created-row id (Phase 2 contract, not touched here). After a successful "Criar novo", the form resets to blank/no-selection (same as clicking "Novo contrato"), and the new template appears in the dropdown after `router.refresh()`. Not auto-selecting it avoids modifying the Phase-2 action's return shape, which is out of this phase's scope.
- Renaming an existing template without duplicating — out of scope for v1 per PRD Decisions Log.
- Any change to `patient-contract.tsx`, `get-patient-contract-action.ts`, `create-base-contract-from-patient-action.ts` — Phase 4 territory, running in parallel.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: CREATE `apps/web/src/components/shared/save-new-template-modal.tsx`

- **ACTION**: CREATE shared name-prompt modal
- **IMPLEMENT**: A `"use client"` component `SaveNewTemplateModal({ open, onOpenChange, isPending, onConfirm }: { open: boolean; onOpenChange: (open: boolean) => void; isPending: boolean; onConfirm: (name: string) => void })`. Single `name: string` Zod field (`z.string().min(1, "O nome não pode estar vazio")`). On submit, call `onConfirm(values.name)`, then `form.reset()`. Do NOT call `onOpenChange(false)` inside the modal itself — let the caller close it from its `onSuccess` handler, since the caller owns the save action's lifecycle (mirrors how `finish-care-modal.tsx` closes on its own `onSuccess`, but here the action lives in the parent screen, not the modal, so the parent must decide when to close after `save()`'s `onSuccess` fires).
- **MIRROR**: `apps/web/src/components/shared/finish-care-modal.tsx:1-24,42-50,54-72,74-83,186-201` — `ContentModal` + `react-hook-form` + `zodResolver` + `Form`/`FormField`/`FormItem`/`FormControl`/`FormMessage`, `Input` for the text field (not `Textarea`), two-button footer with `Loader2` spinner tied to the `isPending` prop
- **IMPORTS**: `import { zodResolver } from "@hookform/resolvers/zod"; import { Button } from "@ventre/ui/button"; import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form"; import { Input } from "@ventre/ui/input"; import { ContentModal } from "@ventre/ui/shared/content-modal"; import { Loader2 } from "lucide-react"; import { useForm } from "react-hook-form"; import { z } from "zod";`
- **GOTCHA**: Since `isPending` is a prop (not derived from an internal `useAction`), the modal has no server error state of its own — errors surface via the parent screen's existing `toast.error` in its `onError` handler. Keep the modal free of any `useAction`/`executeAsync` call.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/app/(dashboard)/settings/contract/page.tsx`

- **ACTION**: UPDATE loader to fetch the list instead of a single row
- **IMPLEMENT**: Replace `getBaseContract` import/call with `getBaseContracts`; rename the destructured variable and the prop passed to `ContractSettingsScreen` from `initialContract` to `contracts`
- **MIRROR**: Existing file structure — only the fetcher name and prop name change, `Promise.all` shape stays identical
- **IMPORTS**: `import { getBaseContracts, getContractHeaderData } from "@/services/base-contract";`
- **GOTCHA**: `getBaseContracts()` already returns `[]` (never `null`) on error/no-user, so no null-check is needed for `contracts` unlike the old `initialContract | null`
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/app/(dashboard)/profile/settings/contract/page.tsx`

- **ACTION**: UPDATE loader to fetch the list instead of a single row
- **IMPLEMENT**: Replace `getPersonalBaseContract` with `getPersonalBaseContracts`; rename prop to `contracts`
- **MIRROR**: Task 2, personal variant
- **IMPORTS**: `import { getPersonalBaseContracts, getPersonalContractHeaderData } from "@/services/base-contract";`
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/screens/contract-settings-screen.tsx`

- **ACTION**: UPDATE screen to support multi-template selection
- **IMPLEMENT**:
  1. Change prop type from `initialContract: Tables<"contracts"> | null` to `contracts: Tables<"contracts">[]`.
  2. Add `const [selectedId, setSelectedId] = useState<string | null>(null);` — form fields (`title`, `clausesHtml`, `city`, `state`) now initialize to blank defaults (`"CONTRATO DE PRESTAÇÃO DE SERVIÇOS"`, `""`, `""`, `""`) instead of reading from a contract, since nothing auto-loads.
  3. Add `const [showSaveNewModal, setShowSaveNewModal] = useState(false);`
  4. Add a `handleSelectTemplate(id: string)` function: find the matching row in `contracts`, `setSelectedId(id)`, and seed `title`/`clausesHtml`/`city`/`state` from it (`contract.city ?? ""`, `contract.state ?? ""`).
  5. Add a `handleNewContract()` function: `setSelectedId(null)` and reset all four fields to their blank defaults.
  6. Render a `Select` dropdown (mirror the UF `Select` pattern) below `PageHeader`, listing `contracts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name ?? c.title}</SelectItem>)`, `value={selectedId ?? undefined}`, `onValueChange={handleSelectTemplate}`, placeholder `"Selecione um contrato existente"`. Next to it, a `Button variant="outline"` "Novo contrato" (icon `Plus` from `lucide-react`) calling `handleNewContract`.
  7. Replace the single "Salvar contrato base" button pair (desktop + mobile-icon variants) with two buttons: "Editar" (`disabled={isExecuting || !selectedId}`, calls `save({ contractId: selectedId, name: undefined, title, clauses_html: clausesHtml, city, state })` — passing `contractId: selectedId` as `string`, safe because the button is disabled when `selectedId` is `null`) and "Criar novo" (`disabled={isExecuting}`, calls `setShowSaveNewModal(true)`).
  8. Render `<SaveNewTemplateModal open={showSaveNewModal} onOpenChange={setShowSaveNewModal} isPending={isExecuting} onConfirm={(name) => save({ contractId: undefined, name, title, clauses_html: clausesHtml, city, state })} />`. In the `useAction`'s existing `onSuccess`, additionally close the modal and reset selection to blank after a create: since `onSuccess` fires for both Editar and Criar novo, and Editar's `contractId` was already set, track which action was in-flight (e.g., a `pendingActionRef` or a simple `useState<"edit" | "create" | null>` set right before each `save()` call) so `onSuccess` only closes the modal and calls `handleNewContract()` when the in-flight action was "create".
- **MIRROR**: `apps/web/src/screens/contract-settings-screen.tsx:126-138` (Select), `apps/web/src/screens/contract-settings-screen.tsx:62-95` (button/save wiring), `apps/web/src/components/shared/finish-care-modal.tsx` (modal usage from parent)
- **IMPORTS**: add `import { SaveNewTemplateModal } from "@/components/shared/save-new-template-modal";` and `import { Plus } from "lucide-react";` (extend existing `lucide-react` import that already has `Eye, Save`)
- **GOTCHA**: Radix `Select` throws at runtime if any `SelectItem` has `value=""` — never happens here since all `contracts[].id` are non-empty UUIDs, but do NOT add a manual "Nenhum" `SelectItem` to represent "no selection"; rely on `SelectValue`'s `placeholder` prop when `value` is `undefined` (i.e. `selectedId ?? undefined`).
- **GOTCHA**: The manager-only check (`profile.user_type !== "manager"`) already lives server-side in `saveBaseContractAction` — no client-side gating needed beyond what already exists (the page-level `isManager(profile)` redirect in `page.tsx`).
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/screens/contract-settings-screen.tsx`

### Task 5: UPDATE `apps/web/src/screens/personal-contract-settings-screen.tsx`

- **ACTION**: UPDATE screen to support multi-template selection (personal variant)
- **IMPLEMENT**: Mirror every change from Task 4, adapted to this file: prop rename to `contracts: Tables<"contracts">[]`, same `selectedId`/`showSaveNewModal` state, same `handleSelectTemplate`/`handleNewContract`, same `Select` + "Novo contrato" row, same "Editar"/"Criar novo" button split calling `savePersonalContractAction` via the existing `save` from `useAction(savePersonalContractAction, ...)`, same `SaveNewTemplateModal` usage. This screen currently has no separate mobile-icon-only button variant (unlike the enterprise screen) — keep that simpler single-row-of-buttons convention, just with three buttons (Preview, Editar, Criar novo) plus the dropdown row below `PageHeader`.
- **MIRROR**: Task 4's implementation of `contract-settings-screen.tsx`, and this file's own existing button/layout conventions (no desktop/mobile duplication)
- **IMPORTS**: same additions as Task 4
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/screens/personal-contract-settings-screen.tsx`

### Task 6: Full validation pass

- **ACTION**: VALIDATE the whole change set together
- **IMPLEMENT**: Run type-check across all packages, lint the full diff, and manually verify both settings pages in the browser
- **VALIDATE**: `pnpm check-types` (repo-wide), then manual browser check per the Testing Strategy below

---

## Testing Strategy

No automated test files exist for any contract-related code in this repo (`apps/web/src/**/*contract*.test.*` returns zero matches) — there is no existing test pattern to follow, and this phase does not introduce one (consistent with the rest of the codebase's contract feature area). Validation is via `pnpm check-types`, Biome lint, and manual browser verification.

### Edge Cases Checklist

- [ ] Owner with zero templates: dropdown shows only the placeholder, empty `SelectContent`, form stays blank, "Editar" disabled, "Criar novo" works and creates the first template
- [ ] Owner with one legacy template that has `name = null` (pre-Phase-1 row): dropdown label falls back to `title` (`c.name ?? c.title`)
- [ ] Owner with 2+ templates: switching the dropdown correctly reloads all four form fields from the newly selected row, discarding unsaved edits to the previous selection (no confirmation prompt — matches the "novo contrato" reset having no confirmation either, per PRD's minimal-v1 scope)
- [ ] Clicking "Novo contrato" while a template is selected clears `selectedId` and blanks the form; "Editar" becomes disabled
- [ ] "Criar novo" from a blank form (no selection) still works — inserts using whatever is currently in the form fields (even the defaults)
- [ ] "Criar novo" modal: empty name submission is blocked client-side by the Zod `min(1)` resolver before any action call
- [ ] After "Criar novo" succeeds: modal closes, toast success, `router.refresh()` repopulates `contracts` with the new row, form resets to blank/no-selection (per NOT Building — no auto-select)
- [ ] After "Editar" succeeds: selection and form stay as-is (no reset), toast success, `router.refresh()` re-fetches the list so the dropdown label reflects any `name` change if it was ever added to that request (currently "Editar" omits `name`, so labels won't drift)
- [ ] Enterprise settings page: non-manager profile still redirected server-side before reaching the screen (unchanged `isManager` gate in `page.tsx`)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, no TypeScript errors across all packages

```bash
npx biome lint --write --unsafe apps/web/src/components/shared/save-new-template-modal.tsx apps/web/src/screens/contract-settings-screen.tsx apps/web/src/screens/personal-contract-settings-screen.tsx "apps/web/app/(dashboard)/settings/contract/page.tsx" "apps/web/app/(dashboard)/profile/settings/contract/page.tsx"
```
**EXPECT**: Exit 0, no lint errors/warnings on the changed files

### Level 2: UNIT_TESTS

Not applicable — no test infrastructure exists for this feature area (see Testing Strategy).

### Level 3: FULL_SUITE

```bash
pnpm check-types
```
**EXPECT**: Exit 0 (this repo has no root-level `pnpm build`/`pnpm test` script invoked by CLAUDE.md's Commands section beyond `check-types`; rely on manual browser validation for behavior)

### Level 4: DATABASE_VALIDATION

Not applicable — no schema changes in this phase (Phase 1 already applied and typed).

### Level 5: BROWSER_VALIDATION

- [ ] `/settings/contract` (as a manager): page loads with blank form and empty-or-populated dropdown depending on existing data; select a template, edit it, click "Editar", confirm toast + persisted change on refresh; click "Novo contrato", fill a different template, click "Criar novo", enter a name, confirm a new row appears in the dropdown after refresh and the original template's content is unchanged
- [ ] `/profile/settings/contract` (as any authenticated user): same flow, personal scope
- [ ] Confirm a non-manager hitting `/settings/contract` still gets redirected to `/home?error=acesso-negado` (unchanged gate, but must not regress)

### Level 6: MANUAL_VALIDATION

1. Seed at least 2 base-contract rows for the same owner via Supabase (one with `name` set, one with `name = null`) and confirm both label correctly in the dropdown.
2. Confirm switching templates never silently loses in-progress edits without the user explicitly choosing the new template (acceptable per scope — no confirm dialog, but reload must be intentional, i.e. triggered only by an explicit dropdown pick or "Novo contrato" click, never automatically).

---

## Acceptance Criteria

- [ ] Both settings pages load with no template pre-selected/pre-loaded
- [ ] Dropdown lists all templates for the current owner, labeled `name ?? title`
- [ ] "Novo contrato" clears selection and blanks the form
- [ ] "Editar" is disabled with no selection, and updates in place (via `contractId`) when enabled
- [ ] "Criar novo" always inserts a new row via the name-prompt modal, never overwrites an existing template
- [ ] `pnpm check-types` passes with no errors
- [ ] Biome lint passes on all changed files
- [ ] No regressions to the existing Preview modal, manager-only gate, or PDF/contract-signing flows downstream (untouched in this phase)

---

## Completion Checklist

- [ ] All 6 tasks completed in order
- [ ] Each task validated immediately after completion
- [ ] Level 1: `pnpm check-types` + Biome lint pass
- [ ] Level 5: Browser validation performed manually for both settings pages
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Legacy rows with `name = null` render a blank dropdown label | High (documented in PRD) | Low | Fallback `c.name ?? c.title` everywhere a label is rendered |
| Tracking which save action ("edit" vs "create") is in-flight to decide whether `onSuccess` should reset the form adds minor state complexity | Medium | Low | Use a simple `useState<"edit" | "create" | null>` set immediately before each `save()` call, read once inside `onSuccess`, reset to `null` at the end |
| Newly created template isn't auto-selected (action returns no id) | Certain (by design, out of scope) | Low | Documented in "NOT Building"; form resets to blank instead, user can immediately re-select the new template from the refreshed dropdown |
| Divergent layouts between the two screens (enterprise has desktop/mobile icon-button duplication, personal doesn't) could cause visual inconsistency if not handled per-file | Medium | Low | Task 4/5 explicitly instruct mirroring each file's own existing responsive convention rather than forcing identical markup |

---

## Notes

Phase 2's save actions were verified by direct code read (not assumed from the PRD's "Technical Approach" section, which was written before Phase 2 landed): `saveBaseContractAction`'s update branch has no explicit owner `.eq()` beyond `id`/`is_base_contract` (relies on RLS via the non-admin `supabase` client), while `savePersonalContractAction`'s update branch adds explicit `.eq("user_id", user.id).is("enterprise_id", null)`. This phase does not touch either action, so this asymmetry is inherited as-is — flagged here only so the implementer doesn't "fix" it as an unrelated drive-by change.

Phase 4 (`patient-contract.tsx`) already has `getPatientContractAction` returning `enterpriseBaseOptions`/`personalBaseOptions` arrays and a stubbed `createBaseContractFromPatientAction`, per the codebase-explorer findings — confirms Phase 4 can proceed in parallel without waiting on this phase.
