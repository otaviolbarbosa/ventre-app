# Feature: Multi-Template Base Contracts — Phase 4 (Patient-Contract UI)

## Summary

`patient-contract.tsx` currently forces a linear, singular-base-contract flow (`no-base` → `choose-base`/`no-contract` → `editing`/`readonly`) built for a world where each owner had exactly one base contract. Phase 2 already changed `getPatientContractAction` to return `enterpriseBaseOptions`/`personalBaseOptions` arrays (plural) alongside legacy singular fields kept only for this component's transition. This phase finishes the migration: collapse `no-base`/`choose-base`/`no-contract` into a single `select` mode with a grouped dropdown (Contratos da empresa / Meus contratos pessoais) + "Novo contrato" button, add a "Salvar como novo contrato base" modal (always personal, reusing the Phase 3 `SaveNewTemplateModal`), and delete the "contrato base não configurado" messaging entirely.

## User Story

As a manager or autonomous professional generating a patient's contract
I want to pick from any of my named base-contract templates (or start blank) right from the patient's contract tab
So that I don't hit a dead-end message when no single default template is configured, and I don't lose other templates by working from one

## Problem Statement

`patient-contract.tsx` only reads the first template per owner type (`enterpriseBase`/`personalBase`, legacy singular fields) and has three now-obsolete states (`no-base`, `choose-base`, `no-contract`) that assumed at most one template per owner existed. With Phase 1–3 shipping multi-template support, this is the last screen still on the old single-template mental model, and it still shows "Contrato base não configurado" even when templates exist elsewhere.

## Solution Statement

Replace `Mode = "loading" | "no-base" | "no-contract" | "choose-base" | "editing" | "readonly"` with `Mode = "loading" | "select" | "editing" | "readonly"`. The `select` mode renders a grouped `Select` (using `enterpriseBaseOptions`/`personalBaseOptions` from the action, both already returned by Phase 2) plus a "Novo contrato" button that clears the form. In `editing` mode, add a "Salvar como novo" button that opens the existing `SaveNewTemplateModal` and calls a new wiring of `createBaseContractFromPatientAction` (already implemented in Phase 2, unused until now).

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                        |
| Complexity       | LOW                                                 |
| Systems Affected | `apps/web/src/components/shared/patient-contract.tsx` (frontend only) |
| Dependencies     | None new — reuses `@ventre/ui/select` (`SelectGroup`/`SelectLabel` already exported, unused elsewhere in the app), existing `createBaseContractFromPatientAction`, existing `SaveNewTemplateModal` |
| Estimated Tasks  | 4                                                   |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌──────────────┐   0 options   ┌─────────────────────────────┐             ║
║   │ Patient tab  │ ─────────────►│ "Contrato base não           │             ║
║   │ "Contrato"   │                │  configurado" + link out    │  DEAD END   ║
║   └──────────────┘                └─────────────────────────────┘             ║
║          │                                                                    ║
║          │ 1 option (legacy: enterpriseBase ?? personalBase, first row only)  ║
║          ▼                                                                    ║
║   ┌─────────────────────────────┐                                            ║
║   │ "Gerar contrato" button     │──► editing (base auto-picked, no choice)   ║
║   └─────────────────────────────┘                                            ║
║          │                                                                    ║
║          │ 2 options (both types present)                                    ║
║          ▼                                                                    ║
║   ┌─────────────────────────────┐                                            ║
║   │ 2 buttons: "Contrato da     │──► editing                                 ║
║   │ empresa" / "Meu contrato    │                                            ║
║   │ pessoal"                    │                                            ║
║   └─────────────────────────────┘                                            ║
║                                                                               ║
║   USER_FLOW: dead-ended at 0 templates; at 1 template, no way to see/pick a  ║
║   different one even if others exist for the same owner; at "2 options" only ║
║   the FIRST template per owner type is ever visible (options.length caps at 2)║
║   PAIN_POINT: cannot reach 2nd+ template of same owner type from this screen ║
║   DATA_FLOW: getPatientContractAction → enterpriseBase/personalBase (legacy  ║
║   singular, first row per owner) → baseOptions[] (max 2 entries)             ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌──────────────┐                ┌─────────────────────────────┐             ║
║   │ Patient tab  │ ──────────────►│ mode="select":                │             ║
║   │ "Contrato"   │                │  [Grouped Select ▾] [+Novo]  │             ║
║   └──────────────┘                │  - Contratos da empresa      │             ║
║                                    │  - Meus contratos pessoais   │             ║
║                                    │  (groups omitted if empty;   │             ║
║                                    │   works fine with 0 options) │             ║
║                                    └─────────────────────────────┘             ║
║                                             │                                  ║
║                     pick a template ────────┤──── click "Novo contrato"       ║
║                     (any of N per owner)     │      (blank form)               ║
║                                             ▼                                  ║
║                                    ┌─────────────────────────────┐             ║
║                                    │ mode="editing"                │             ║
║                                    │ [Cancelar][Preview]           │             ║
║                                    │ [Salvar como novo] ◄── NEW    │             ║
║                                    │ [Gerar contrato]               │             ║
║                                    └─────────────────────────────┘             ║
║                                             │                                  ║
║                                "Salvar como novo" → SaveNewTemplateModal      ║
║                                → createBaseContractFromPatientAction          ║
║                                (always user_id, enterprise_id=null)           ║
║                                                                               ║
║   USER_FLOW: single unified entry point regardless of template count;        ║
║   every template of every owner type is reachable; can start blank anytime;  ║
║   can save current edits as a brand-new personal template without leaving    ║
║   the patient's contract tab                                                 ║
║   VALUE_ADD: no dead end, no hidden templates, no forced overwrite           ║
║   DATA_FLOW: getPatientContractAction → enterpriseBaseOptions[] +            ║
║   personalBaseOptions[] (already returned since Phase 2) → grouped Select    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `patient-contract.tsx` — 0 templates | "Contrato base não configurado" + link away | `select` mode, empty groups, "Novo contrato" still works | Can start a contract immediately, no dead end |
| `patient-contract.tsx` — templates available | Only first template per owner type reachable | All templates reachable via grouped dropdown | No hidden templates |
| `patient-contract.tsx` — editing mode | No way to persist edits as a new template | "Salvar como novo" button + modal | Can save a variant without leaving the patient screen |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/components/shared/patient-contract.tsx` | 1–531 | File being modified — full context, all modes |
| P0 | `apps/web/src/actions/get-patient-contract-action.ts` | 46–99, 170–198 | `enterpriseBaseOptions`/`personalBaseOptions` shape to consume; legacy fields to stop reading |
| P0 | `apps/web/src/actions/create-base-contract-from-patient-action.ts` | 1–30 | Action to wire — already complete, no changes needed |
| P1 | `apps/web/src/components/shared/save-new-template-modal.tsx` | 1–83 | Modal to reuse as-is — `onConfirm(name)` callback pattern |
| P1 | `apps/web/src/screens/contract-settings-screen.tsx` | 29–75, 138–160, 229–244 | Reference pattern: `Select` + "Novo contrato" button + `SaveNewTemplateModal` wiring (non-grouped variant of the same idea) |
| P2 | `packages/ui/src/select.tsx` | 141–152 | Confirms `SelectGroup`/`SelectLabel` are exported and available (currently unused elsewhere in the app — first grouped usage) |

**External Documentation:** None — pure internal UI refactor using already-adopted libraries (Radix Select via `@ventre/ui/select`, `next-safe-action` hooks). No new packages, no version-sensitive APIs.

---

## Patterns to Mirror

**SELECT + NEW-BUTTON PATTERN (non-grouped reference):**
```tsx
// SOURCE: apps/web/src/screens/contract-settings-screen.tsx:138-160
<div className="mb-4 flex items-end gap-2">
  <div className="flex-1 space-y-1.5">
    <label htmlFor="contract-template" className="font-medium text-sm">
      Contrato base
    </label>
    <Select value={selectedId ?? undefined} onValueChange={handleSelectTemplate}>
      <SelectTrigger id="contract-template">
        <SelectValue placeholder="Selecione um contrato existente" />
      </SelectTrigger>
      <SelectContent>
        {contracts.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name ?? c.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  <Button type="button" variant="outline" onClick={handleNewContract}>
    <Plus className="size-4" />
    <span className="ml-1">Novo contrato</span>
  </Button>
</div>
```

**SAVE-NEW-MODAL WIRING PATTERN:**
```tsx
// SOURCE: apps/web/src/screens/contract-settings-screen.tsx:229-244
<SaveNewTemplateModal
  open={showSaveNewModal}
  onOpenChange={setShowSaveNewModal}
  isPending={isExecuting}
  onConfirm={(name) => {
    pendingActionRef.current = "create";
    save({
      contractId: undefined,
      name,
      title,
      clauses_html: clausesHtml,
      city,
      state,
    });
  }}
/>
```

**SELECT EXPORTS (grouping support already present, unused so far):**
```tsx
// SOURCE: packages/ui/src/select.tsx:141-152
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
```

**ACTION RETURN SHAPE TO CONSUME:**
```ts
// SOURCE: apps/web/src/actions/get-patient-contract-action.ts:47-54, 196-197
type BaseContractOption = {
  id: string;
  html: string;
  title: string;
  name: string | null;
  city: string | null;
  state: string | null;
};
// returned as: enterpriseBaseOptions: BaseContractOption[], personalBaseOptions: BaseContractOption[]
```

**createBaseContractFromPatientAction (already implemented, Phase 2 — no changes):**
```ts
// SOURCE: apps/web/src/actions/create-base-contract-from-patient-action.ts:7-30
export const createBaseContractFromPatientAction = authActionClient
  .inputSchema(createBaseContractFromPatientSchema)
  .action(
    async ({
      parsedInput: { patientId, name, title, clauses_html, city, state },
      ctx: { supabase, user },
    }) => {
      const { error } = await supabase.from("contracts").insert({
        is_base_contract: true,
        name,
        title,
        clauses_html,
        city: city ?? null,
        state: state ?? null,
        user_id: user.id,
        enterprise_id: null,
      });
      if (error) throw new Error(error.message);
      revalidatePath(`/patients/${patientId}/profile`);
      return { success: true };
    },
  );
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | Collapse `no-base`/`choose-base`/`no-contract` into `select`; add grouped dropdown; add "Salvar como novo" flow; drop legacy singular fields and now-unused imports |

No other files change. Everything this phase needs from the backend (`enterpriseBaseOptions`, `personalBaseOptions`, `createBaseContractFromPatientAction`) and from shared UI (`SaveNewTemplateModal`) already exists from Phases 2–3.

---

## NOT Building (Scope Limits)

- Removing the legacy `enterpriseBase`/`personalBase`/`baseContractHtml`/`baseTitle` fields from `get-patient-contract-action.ts` — out of scope for this phase; nothing else reads them after this change (verified via grep), but deleting server-side fields is not required for the UI to work and is not part of the PRD's Phase 4 scope. Leave them as harmless dead fields for now.
- Any change to `createBaseContractFromPatientAction`, `getPatientContractAction`, or `SaveNewTemplateModal` — all already correct per Phase 2/3 reports.
- Deletion/archival of templates, template usage indicators, renaming without duplication — explicitly out of v1 per PRD.
- Making "salvar como novo" write to `enterprise_id` — PRD explicitly requires it always be personal (`user_id`, `enterprise_id: null`); the existing action already enforces this.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: UPDATE `patient-contract.tsx` — imports and type/state cleanup

- **ACTION**: MODIFY imports and top-of-component state declarations
- **IMPLEMENT**:
  - Add imports: `createBaseContractFromPatientAction` from `@/actions/create-base-contract-from-patient-action`; `SaveNewTemplateModal` from `@/components/shared/save-new-template-modal`; `Plus` and `Save` from `lucide-react` (extend the existing `lucide-react` import line).
  - Remove now-unused imports: `isManager` from `@/lib/access-control`, `useAuth` from `@/hooks/use-auth`, `Link` from `next/link`, `FileText` from `lucide-react` (verified via grep that these are used only inside the `no-base`/`choose-base`/`no-contract` blocks being deleted).
  - Change `type Mode = "loading" | "no-base" | "no-contract" | "choose-base" | "editing" | "readonly"` to `type Mode = "loading" | "select" | "editing" | "readonly"`.
  - Replace `type BaseOption = { html; title; label; city; state }` with:
    ```ts
    type BaseTemplate = {
      id: string;
      html: string;
      title: string;
      name: string | null;
      city: string | null;
      state: string | null;
    };
    ```
  - Replace `const [baseHtml, setBaseHtml] = useState<string | null>(null);`, `const [baseTitle, setBaseTitle] = useState<string | null>(null);`, `const [baseOptions, setBaseOptions] = useState<BaseOption[]>([]);` with:
    ```ts
    const [enterpriseOptions, setEnterpriseOptions] = useState<BaseTemplate[]>([]);
    const [personalOptions, setPersonalOptions] = useState<BaseTemplate[]>([]);
    const [showSaveNewModal, setShowSaveNewModal] = useState(false);
    ```
  - Remove `const { profile } = useAuth();` (line 77 in current file).
- **MIRROR**: `apps/web/src/screens/contract-settings-screen.tsx:25-27` for `useState` naming style
- **GOTCHA**: `enterpriseHeaderBlocks`/`personalHeaderBlocks` state (lines 63-68) stay untouched — still needed to pick the correct header when a template is selected
- **VALIDATE**: `pnpm check-types` (will still fail until Tasks 2-3 update usages — acceptable mid-task state, just don't stop here)

### Task 2: UPDATE `patient-contract.tsx` — `fetchContract` onSuccess and onError

- **ACTION**: MODIFY the `useAction(getPatientContractAction, {...})` block
- **IMPLEMENT**: Replace the `baseOptions`-building block (current lines 89-112) with:
  ```ts
  setEnterpriseOptions(data?.enterpriseBaseOptions ?? []);
  setPersonalOptions(data?.personalBaseOptions ?? []);
  ```
  (Drop the `options` array, the `label` construction, and the legacy `baseContractHtml`/`baseTitle` fallback reads entirely — they are no longer used by this component.)

  Replace the final mode-selection branch (current lines 133-139):
  ```ts
  // before
  } else if (options.length > 1) {
    setMode("choose-base");
  } else if (options.length === 1) {
    setMode("no-contract");
  } else {
    setMode("no-base");
  }
  // after
  } else {
    setMode("select");
  }
  ```
  Change `onError: () => setMode("no-base")` to `onError: () => setMode("select")`.
- **MIRROR**: Existing `if (data?.contract) { ... setMode("readonly"); }` branch stays unchanged — only the `else` arm collapses.
- **GOTCHA**: `data?.enterpriseBaseOptions`/`data?.personalBaseOptions` are already typed via the server action's inferred return type (Phase 2) — no manual casting needed, structurally compatible with `BaseTemplate[]`.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `patient-contract.tsx` — replace `no-base`/`choose-base`/`no-contract` render blocks with `select` mode

- **ACTION**: DELETE the three `if (mode === "...")` blocks (current lines 214-292: `no-base`, `choose-base`, `no-contract`) and REPLACE with a single `select` block
- **IMPLEMENT**:
  ```tsx
  if (mode === "select") {
    return (
      <div className="flex flex-col items-start gap-3 py-4">
        <p className="text-muted-foreground text-sm">
          {enterpriseOptions.length + personalOptions.length > 0
            ? "Escolha um contrato base para esta gestante, ou comece um contrato do zero."
            : "Nenhum contrato base configurado ainda. Comece um contrato do zero."}
        </p>
        <div className="flex w-full max-w-md items-end gap-2">
          <div className="flex-1 space-y-1.5">
            <Select onValueChange={handleSelectBaseTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um contrato base" />
              </SelectTrigger>
              <SelectContent>
                {enterpriseOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Contratos da empresa</SelectLabel>
                    {enterpriseOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name ?? opt.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {personalOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Meus contratos pessoais</SelectLabel>
                    {personalOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name ?? opt.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="outline" onClick={handleNewContract}>
            <Plus className="mr-2 size-4" />
            Novo contrato
          </Button>
        </div>
      </div>
    );
  }
  ```
  Add the two handler functions above the `if (mode === "loading")` block:
  ```ts
  function handleSelectBaseTemplate(id: string) {
    const enterpriseMatch = enterpriseOptions.find((o) => o.id === id);
    const match = enterpriseMatch ?? personalOptions.find((o) => o.id === id);
    if (!match) return;
    setTitle(match.title);
    setClausesHtml(match.html);
    setCity(match.city ?? "");
    setState(match.state ?? "");
    setHeaderBlocks(enterpriseMatch ? enterpriseHeaderBlocks : personalHeaderBlocks);
    setMode("editing");
  }

  function handleNewContract() {
    setTitle("CONTRATO DE PRESTAÇÃO DE SERVIÇOS");
    setClausesHtml("");
    setCity("");
    setState("");
    setHeaderBlocks(enterpriseHeaderBlocks);
    setMode("editing");
  }
  ```
- **IMPORTS**: Add `SelectGroup`, `SelectLabel` to the existing `@ventre/ui/select` import line (currently imports `Select, SelectContent, SelectItem, SelectTrigger, SelectValue`).
- **MIRROR**: `apps/web/src/screens/contract-settings-screen.tsx:143-154` for the `Select`/`SelectTrigger`/`SelectContent` shape; grouping is new syntax but uses the same exported primitives (`packages/ui/src/select.tsx:141-152`).
- **GOTCHA**: `enterpriseHeaderBlocks` here means "the account's own default header" (enterprise-type if the profile has `enterprise_id`, autonomous-type otherwise) — it is NOT literally scoped to "enterprise-owned templates" in a semantic sense, it is the pre-existing state variable name from Phase 2/the original code (`data.headerBlocks` mirrored into it). Follow the existing naming, do not rename — renaming is out of scope and would touch unrelated code.
- **GOTCHA**: IDs are UUIDs (`extensions.uuid_generate_v4()` per `CLAUDE.md`), so using raw `opt.id` as the `Select` item `value` without a group prefix is safe — no collision risk between the two groups.
- **VALIDATE**: `pnpm check-types` — should now pass with 0 remaining references to `no-base`/`choose-base`/`no-contract`/`baseOptions`/`baseHtml`/`baseTitle`

### Task 4: UPDATE `patient-contract.tsx` — editing-mode "Salvar como novo" button, modal wiring, and cancel-target fix

- **ACTION**: MODIFY the `editing`-mode return block (current lines 371-530) and the `readonly`-mode "Excluir contrato" success handler
- **IMPLEMENT**:
  1. In the editing-mode button row (current lines 423-462), add a new button between "Preview" and "Gerar contrato":
     ```tsx
     <Button variant="outline" disabled={isSigning} onClick={() => setShowSaveNewModal(true)}>
       <Save className="mr-2 size-4" />
       Salvar como novo
     </Button>
     ```
  2. Fix the "Cancelar" button's `onClick` (current lines 427-435) — replace the `baseOptions.length`-based ternary with:
     ```tsx
     onClick={() => setMode(contractExists ? "readonly" : "select")}
     ```
  3. Add the `useAction` hook for `createBaseContractFromPatientAction` near the other `useAction` calls (after `deactivateContract`, ~line 172):
     ```ts
     const { execute: createBaseFromPatient, isExecuting: isCreatingTemplate } = useAction(
       createBaseContractFromPatientAction,
       {
         onSuccess: () => {
           toast.success("Modelo salvo com sucesso");
           setShowSaveNewModal(false);
         },
         onError: ({ error }) => toast.error(error.serverError ?? "Erro ao salvar modelo"),
       },
     );
     ```
     Do NOT call `fetchContract` on success — doing so would re-evaluate `mode` from the fetched (still-nonexistent) patient contract and kick the user out of `editing` back to `select`, discarding in-progress edits. The newly created template simply won't appear in the dropdown until the tab is revisited, which is acceptable (matches the PRD's flow — user continues generating the current patient's contract normally after saving a copy).
  4. Render `<SaveNewTemplateModal />` alongside the existing `ContentModal`s at the end of the editing-mode JSX (after the `isPreviewOpen` modal, before the closing `</>`):
     ```tsx
     <SaveNewTemplateModal
       open={showSaveNewModal}
       onOpenChange={setShowSaveNewModal}
       isPending={isCreatingTemplate}
       onConfirm={(name) =>
         createBaseFromPatient({
           patientId,
           name,
           title,
           clauses_html: clausesHtml,
           city,
           state,
         })
       }
     />
     ```
  5. In the `readonly`-mode `deactivateContract` `onSuccess` (current line 168), replace `setMode(baseOptions.length > 1 ? "choose-base" : "no-contract")` with `setMode("select")`.
- **MIRROR**: `apps/web/src/screens/contract-settings-screen.tsx:229-244` for the modal wiring pattern; `apps/web/src/components/shared/save-new-template-modal.tsx` for the `onConfirm(name)` contract (unchanged, no modifications needed to the modal itself)
- **GOTCHA**: `SaveNewTemplateModal`'s internal form uses `zodResolver` + `react-hook-form` and calls `form.reset()` after `onConfirm` — no extra reset needed in `patient-contract.tsx`.
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/components/shared/patient-contract.tsx`

---

## Testing Strategy

### Unit Tests to Write

None — no test infrastructure exists for this feature area, consistent with Phases 1–3 (per their reports: "No test suite exists for contract code").

### Edge Cases Checklist

- [ ] Patient with 0 base templates of either type → `select` mode shows both-empty message + "Novo contrato" still works
- [ ] Patient's owner has only enterprise templates (personal empty) → dropdown shows only "Contratos da empresa" group
- [ ] Patient's owner has only personal templates (enterprise empty, e.g. autonomous professional) → dropdown shows only "Meus contratos pessoais" group
- [ ] Patient's owner has 2+ templates of the same type → all are individually selectable (this is the core bug being fixed — previously capped at 1 per type)
- [ ] Selecting an enterprise template sets `headerBlocks` to the enterprise/default header; selecting a personal template sets it to the team-personal header
- [ ] "Salvar como novo" from a template that started as an *enterprise* template still inserts with `user_id`/`enterprise_id: null` (verified by reading the untouched `createBaseContractFromPatientAction` — always personal regardless of origin)
- [ ] Legacy data: templates with `name = null` fall back to `title` in the dropdown label (`opt.name ?? opt.title`)
- [ ] Existing patient contract (already generated) still opens straight to `readonly` — `select` mode is only reached when no contract exists yet
- [ ] "Excluir contrato" from `readonly` returns to `select` (not a dead-end), regardless of how many templates exist
- [ ] Signed contract PDF export flow (`handleExportPdf`) is untouched and still works — no changes to that function in this phase

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, no errors across all packages — specifically no lingering references to `no-base`, `choose-base`, `no-contract`, `BaseOption`, `baseOptions`, `baseHtml`, `baseTitle`, `isManager`, `useAuth`, `FileText`, `Link` in `patient-contract.tsx`

```bash
npx biome lint --write --unsafe apps/web/src/components/shared/patient-contract.tsx
```

**EXPECT**: Exit 0 — fixes class-sorting/import-order automatically; flags any remaining unused imports

### Level 2: UNIT_TESTS

N/A — no test suite exists for this file or feature area.

### Level 3: FULL_SUITE

```bash
pnpm check-types
```

**EXPECT**: Same as Level 1 (no separate build step is part of this repo's standard validation per `CLAUDE.md`)

### Level 4: DATABASE_VALIDATION

N/A — no schema changes in this phase (Phase 1 already shipped the `name` column).

### Level 5: BROWSER_VALIDATION

Use Browser MCP (or manual dev-server check) to verify:

- [ ] Open a patient with no base templates configured → `select` mode renders with empty-state message, no "Contrato base não configurado" text appears anywhere
- [ ] Open a patient whose owner (enterprise or personal) has 2+ base templates → both appear individually in the correctly-grouped dropdown, not just the first one
- [ ] Select a template → form populates with its `title`/`clauses_html`/`city`/`state`, header block matches template type (enterprise vs personal)
- [ ] Click "Novo contrato" → form clears to blank defaults
- [ ] In `editing` mode, click "Salvar como novo" → modal opens, submitting a name creates a new personal template (verify via `/profile/settings/contract` dropdown afterward) without leaving the patient's contract tab or losing current edits
- [ ] Click "Cancelar" while editing an unsaved contract → returns to `select` mode (not a dead-end)
- [ ] Generate and sign a contract normally end-to-end (unaffected `signContract` flow) → still reaches `readonly` mode with PDF export working

### Level 6: MANUAL_VALIDATION

1. As a manager (enterprise-scoped), configure 2 named templates in `/settings/contract`, then open a patient's contract tab and confirm both are selectable.
2. As an autonomous professional, configure 2 named templates in `/profile/settings/contract`, then open a patient's contract tab and confirm both are selectable, and that the enterprise group is absent (not shown as empty group, simply omitted).
3. Confirm a patient contract created before this phase (existing signed/unsigned row) still opens directly to the correct mode (`readonly` if signed/exists) without regression.

---

## Acceptance Criteria

- [ ] `no-base`, `choose-base`, `no-contract` modes and their render blocks are fully removed from `patient-contract.tsx`
- [ ] All templates from `enterpriseBaseOptions`/`personalBaseOptions` are individually reachable via a grouped dropdown (not capped at one per owner type)
- [ ] "Contrato base não configurado" message no longer appears anywhere in the component
- [ ] "Novo contrato" button clears the form and enters `editing` mode from any state with 0+ templates
- [ ] "Salvar como novo" button in `editing` mode opens `SaveNewTemplateModal` and successfully creates a new personal template via `createBaseContractFromPatientAction` without disrupting the current in-progress edit
- [ ] `pnpm check-types` passes with 0 errors
- [ ] Biome lint passes with 0 errors/warnings on the changed file
- [ ] No regressions to `signContract`, `deactivateContract`, or `handleExportPdf` flows (all untouched by this phase)

---

## Completion Checklist

- [ ] Task 1: imports/types/state cleaned up
- [ ] Task 2: `fetchContract` onSuccess/onError updated
- [ ] Task 3: `select` mode replaces `no-base`/`choose-base`/`no-contract`
- [ ] Task 4: "Salvar como novo" wired, cancel-target fixed, delete-contract mode target fixed
- [ ] Level 1: `pnpm check-types` passes
- [ ] Level 1: Biome lint passes
- [ ] Level 5: Browser validation of all listed scenarios
- [ ] Level 6: Manual multi-template validation as both manager and autonomous professional
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Removing unused imports (`isManager`, `useAuth`, `Link`, `FileText`) breaks something relying on a side effect of `useAuth()` | Low | Low | Verified via grep that `profile` (the only value destructured from `useAuth()`) is used exclusively inside the deleted `no-base` block; `useAuth` has no side effects beyond returning auth state |
| Calling `fetchContract` after "Salvar como novo" would silently discard in-progress edits by re-evaluating `mode` | Medium (easy mistake to make) | Medium | Explicitly documented in Task 4 — do not call `fetchContract` on `createBaseFromPatient` success |
| Grouped `Select` is new usage of `SelectGroup`/`SelectLabel` in this codebase (first occurrence) | Low | Low | Components are already exported and Radix-backed (`packages/ui/src/select.tsx:141-152`); standard shadcn primitives, no custom styling required beyond what's already themed |
| Legacy rows with `name = null` render blank in the dropdown | High (certain for pre-Phase-1 data) | Low | `opt.name ?? opt.title` fallback, same pattern already used in `contract-settings-screen.tsx:150` |

---

## Notes

- This phase does not touch the server action layer at all — Phase 2's `getPatientContractAction`, `createBaseContractFromPatientAction`, and Phase 3's `SaveNewTemplateModal` are consumed as-is.
- The legacy `enterpriseBase`/`personalBase`/`baseContractHtml`/`baseTitle` fields remain in `get-patient-contract-action.ts`'s return type after this phase (intentionally, per NOT Building) since deleting server-side dead fields is not required for the UI fix and risks scope creep into files this phase doesn't need to touch.
- Phase 5 (end-to-end validation) depends on this phase and Phase 3 both being complete — both are now done after this phase ships.
