# Feature: Contract Management — Phase 4: Patient Contract

## Summary

Add an "Contrato" accordion section to the patient profile page, allowing professionals to generate a personalized contract per pregnancy based on the organization's base contract. The component fetches the existing patient contract (or the base contract HTML for pre-population) in a single action call, renders a TipTap RichEditor in editing mode, and saves the contract linked to `patient_id` and `pregnancy_id`. Phase 3 infrastructure (table, RLS, base contract actions, RichEditor) is fully reused — Phase 4 adds only the patient-facing layer on top.

## User Story

As a profissional obstétrica
I want to gerar e editar um contrato para cada gestante a partir do meu contrato base
So that eu possa formalizar o serviço em menos de 2 minutos sem sair do sistema ou repetir informações já cadastradas

## Problem Statement

Professionals who have completed base contract setup (Phase 3) cannot yet generate a per-patient contract. The patient profile page has no "Contrato" section. Without this, the base contract serves no purpose — professionals still reach for Word/Google Docs.

## Solution Statement

Add a new `AccordionItem value="contrato"` to the existing `Accordion` in `patients/[id]/profile/page.tsx`. The inner `PatientContract` component fetches both the existing patient contract and the base contract clauses in one action call, then presents the appropriate UI state: warning if no base contract exists, "Gerar contrato" button if no patient contract yet, or a RichEditor in edit mode showing the existing patient contract. A single `savePatientContractAction` handles both create (insert) and update (update WHERE patient_id) via upsert logic matching `saveBaseContractAction`.

## Metadata

| Field            | Value |
| ---------------- | ----- |
| Type             | NEW_CAPABILITY |
| Complexity       | MEDIUM |
| Systems Affected | Patient Profile UI, Server Actions, Database (contracts table) |
| Dependencies     | Phase 1 (DB), Phase 2 (RichEditor), Phase 3 (base contract) — all complete |
| Estimated Tasks  | 5 |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Patient Profile (/patients/[id]/profile)                                     ║
║                                                                               ║
║  ┌─────────────────────────────────────────┐                                  ║
║  │ ▼ Informações da Gestante               │                                  ║
║  ├─────────────────────────────────────────┤                                  ║
║  │ ▼ Documentos                            │                                  ║
║  ├─────────────────────────────────────────┤                                  ║
║  │ ▼ Evolução da Paciente                  │                                  ║
║  └─────────────────────────────────────────┘                                  ║
║                                                                               ║
║  USER_FLOW: Professional finds no contract section → opens Word → copies      ║
║             patient data manually → prints/emails                             ║
║  PAIN_POINT: Contract workflow is entirely outside the system                 ║
║  DATA_FLOW: No data from Ventre flows into contract documents                 ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Patient Profile (/patients/[id]/profile)                                     ║
║                                                                               ║
║  ┌─────────────────────────────────────────────────────────────┐              ║
║  │ ▼ Informações da Gestante                                   │              ║
║  ├─────────────────────────────────────────────────────────────┤              ║
║  │ ▼ Documentos                                                │              ║
║  ├─────────────────────────────────────────────────────────────┤              ║
║  │ ▼ Evolução da Paciente                                      │              ║
║  ├─────────────────────────────────────────────────────────────┤              ║
║  │ ▼ Contrato                          ◄── NEW ACCORDION ITEM  │              ║
║  │   ┌─────────────────────────────────────────────────────┐   │              ║
║  │   │  State A: No base contract configured               │   │              ║
║  │   │  ⚠ Configure contrato base em Configurações        │   │              ║
║  │   └─────────────────────────────────────────────────────┘   │              ║
║  │   State B: Base contract exists, no patient contract yet     │              ║
║  │   ┌─────────────────────────────────────────────────────┐   │              ║
║  │   │  [Gerar contrato]  ← button                         │   │              ║
║  │   └─────────────────────────────────────────────────────┘   │              ║
║  │   State C: Generating (base clauses loaded, editing)         │              ║
║  │   ┌─────────────────────────────────────────────────────┐   │              ║
║  │   │  ┌─────────────────────────────────────────────┐    │   │              ║
║  │   │  │ RichEditor (pre-populated with base clauses)│    │   │              ║
║  │   │  └─────────────────────────────────────────────┘    │   │              ║
║  │   │  [Salvar contrato]  [Cancelar]                       │   │              ║
║  │   └─────────────────────────────────────────────────────┘   │              ║
║  │   State D: Patient contract exists                           │              ║
║  │   ┌─────────────────────────────────────────────────────┐   │              ║
║  │   │  ┌─────────────────────────────────────────────┐    │   │              ║
║  │   │  │ RichEditor (disabled=false, existing clauses)│   │   │              ║
║  │   │  └─────────────────────────────────────────────┘    │   │              ║
║  │   │  [Salvar alterações]                                 │   │              ║
║  │   └─────────────────────────────────────────────────────┘   │              ║
║  └─────────────────────────────────────────────────────────────┘              ║
║                                                                               ║
║  DATA_FLOW: getPatientContractAction({ patientId })                           ║
║    → { contract: Row | null, baseContractHtml: string | null }               ║
║    → RichEditor(content=clauses_html)                                        ║
║    → savePatientContractAction({ patientId, pregnancyId, clauses_html })     ║
║    → INSERT/UPDATE contracts WHERE patient_id = patientId                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `patients/[id]/profile/page.tsx` | 3 accordion items (informacoes, documentos, evolucao) | 4 accordion items (+contrato) | Contract section visible in patient profile |
| `PatientContract` (new) | Does not exist | Manages contract lifecycle (no-contract → generating → saved) | Can generate/edit patient contract without leaving the system |
| `contracts` table | Only base contracts (is_base_contract=true) | Also patient contracts (patient_id + pregnancy_id set) | Data persisted per patient, linked to pregnancy |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `apps/web/src/actions/save-base-contract-action.ts` | 1-52 | MIRROR EXACTLY — upsert pattern, authActionClient, enterprise/user branching |
| P0 | `apps/web/src/screens/contract-settings-screen.tsx` | 1-125 | MIRROR — RichEditor usage, useAction, state management pattern |
| P0 | `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx` | 1-163 | WHERE to insert accordion item + pregnancy extraction |
| P1 | `apps/web/src/services/base-contract.ts` | 1-107 | getBaseContract query pattern to mirror in action |
| P1 | `apps/web/src/lib/validations/contract.ts` | 1-7 | EXTEND this file with new schemas |
| P1 | `apps/web/src/components/shared/patient-documents.tsx` | all | Component shape to mirror (receives patientId: string only) |
| P2 | `apps/web/src/actions/upsert-patient-prenatal-fields-action.ts` | all | Schema pattern for patientId + pregnancyId inputs |
| P2 | `packages/supabase/src/types/database.types.ts` | 317-381 | Exact contracts Row/Insert types |
| P2 | `apps/web/src/lib/safe-action.ts` | 1-40 | ctx shape: { supabase, supabaseAdmin, user, profile } |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [TipTap setContent docs](https://tiptap.dev/docs/editor/api/commands/content/set-content) | setContent command | `content` prop is init-only; async population requires `editor.commands.setContent()` |
| [TipTap persistence guide](https://tiptap.dev/docs/editor/core-concepts/persistence) | Async DB fetch pattern | Canonical pattern for loading content from server |

---

## Patterns to Mirror

**ACTION_SCHEMA_PATTERN:**
```typescript
// SOURCE: apps/web/src/actions/upsert-patient-prenatal-fields-action.ts:8-16
// COPY THIS PATTERN for actions that need patientId + pregnancyId:
const schema = z.object({
  patientId: z.string().uuid(),
  pregnancyId: z.string().uuid().nullable().optional(),
  clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
})
```

**UPSERT_PATTERN:**
```typescript
// SOURCE: apps/web/src/actions/save-base-contract-action.ts:14-48
// COPY THIS PATTERN for patient contract upsert:
let existingId: string | null = null

const { data: existing } = await supabase
  .from("contracts")
  .select("id")
  .eq("patient_id", patientId)
  .eq("is_base_contract", false)
  .maybeSingle()
existingId = existing?.id ?? null

if (existingId) {
  const { error } = await supabase.from("contracts").update({ clauses_html }).eq("id", existingId)
  if (error) throw new Error(error.message)
} else {
  const { error } = await supabase.from("contracts").insert({
    is_base_contract: false,
    clauses_html,
    patient_id: patientId,
    pregnancy_id: pregnancyId ?? null,
    enterprise_id: profile.enterprise_id ?? null,
    user_id: profile.enterprise_id ? null : user.id,
  })
  if (error) throw new Error(error.message)
}
```

**BASE_CONTRACT_FETCH_PATTERN:**
```typescript
// SOURCE: apps/web/src/services/base-contract.ts:5-27
// MIRROR for fetching base contract clauses in action context:
const { data: base } = await supabase
  .from("contracts")
  .select("clauses_html")
  .eq("is_base_contract", true)
  .eq(profile.enterprise_id ? "enterprise_id" : "user_id",
      profile.enterprise_id ?? user.id)
  .maybeSingle()
```

**RICH_EDITOR_USAGE:**
```typescript
// SOURCE: apps/web/src/screens/contract-settings-screen.tsx:54-59
// COPY THIS PATTERN exactly:
import { RichEditor } from "@ventre/ui/shared/rich-editor"

const [clausesHtml, setClausesHtml] = useState(initialValue)

<RichEditor
  content={clausesHtml}
  onChange={setClausesHtml}
  placeholder="Escreva as cláusulas do contrato..."
  className="min-h-[400px]"
/>
```

**ACCORDION_ITEM_PATTERN:**
```tsx
// SOURCE: apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:89-96
// COPY THIS PATTERN exactly for new accordion item:
<AccordionItem value="contrato">
  <AccordionTrigger className="font-poppins font-semibold text-base">
    Contrato
  </AccordionTrigger>
  <AccordionContent>
    <PatientContract patientId={patient.id} pregnancyId={pregnancy?.id ?? null} />
  </AccordionContent>
</AccordionItem>
```

**COMPONENT_STRUCTURE_PATTERN:**
```tsx
// SOURCE: apps/web/src/components/shared/patient-documents.tsx
// MIRROR: self-contained component that receives only patientId as prop
// handles all fetching internally via useAction / useEffect
export default function PatientContract({
  patientId,
  pregnancyId,
}: {
  patientId: string
  pregnancyId: string | null | undefined
}) { ... }
```

**TIPTAP_ASYNC_CONTENT_PATTERN:**
```typescript
// SOURCE: Web research — TipTap v2 content prop is init-only
// PATTERN: Mount RichEditor only after content is available
// Use conditional rendering (not setContent) to avoid TipTap async population complexity:
//
// When component fetches data → show spinner
// When data arrives → render RichEditor with content={clausesHtml}
// Key insight: never change clausesHtml after editor mounts (avoid setContent edge cases)
// Instead: use a `key` prop on RichEditor to force remount if content changes externally
//
// For the "Gerar contrato" flow:
// 1. Data arrives (baseContractHtml available from initial fetch)
// 2. User clicks "Gerar" → set mode='generating' + init clausesHtml=baseContractHtml
// 3. RichEditor mounts with content=clausesHtml (sync at mount time, no async needed)
```

**ERROR_HANDLING_PATTERN:**
```typescript
// SOURCE: apps/web/src/actions/save-base-contract-action.ts:36-48
// COPY THIS PATTERN:
const { error } = await supabase.from("contracts").update({ ... }).eq("id", existingId)
if (error) throw new Error(error.message)
```

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `apps/web/src/lib/validations/contract.ts` | UPDATE | Add `getPatientContractSchema` and `savePatientContractSchema` |
| `apps/web/src/actions/get-patient-contract-action.ts` | CREATE | Fetch patient contract + base contract clauses in one call |
| `apps/web/src/actions/save-patient-contract-action.ts` | CREATE | Upsert patient contract (insert or update WHERE patient_id) |
| `apps/web/src/components/shared/patient-contract.tsx` | CREATE | Self-contained component for patient contract accordion content |
| `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx` | UPDATE | Extract `pregnancy`, import `PatientContract`, add accordion item |

---

## NOT Building (Scope Limits)

Per PRD and Phase 4 scope:

- **PDF export** — Phase 5 only; "Exportar PDF" button will be added in Phase 5, not here
- **Header preview in patient context** — the CONTRATANTE block (patient data) is shown in Phase 5's PDF, not in Phase 4's editor view
- **Contract delete** — no delete button in Phase 4; user can clear/overwrite by editing
- **Read-only view mode** — always show the RichEditor in editable mode (simpler, Phase 5 can add read-only preview)
- **"Usar contrato base" vs "Editar a partir do base" choice** — simplify: always pre-populate from base (one button "Gerar contrato"), user can then freely edit before saving

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

---

### Task 1: UPDATE `apps/web/src/lib/validations/contract.ts`

- **ACTION**: ADD two new Zod schemas below the existing `saveBaseContractSchema`
- **IMPLEMENT**:
  ```typescript
  export const getPatientContractSchema = z.object({
    patientId: z.string().uuid(),
  })

  export const savePatientContractSchema = z.object({
    patientId: z.string().uuid(),
    pregnancyId: z.string().uuid().nullable().optional(),
    clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
  })

  export type SavePatientContractInput = z.infer<typeof savePatientContractSchema>
  ```
- **MIRROR**: `apps/web/src/lib/validations/contract.ts:1-7` — same `z.object()` style, same file
- **IMPORTS**: no new imports needed (already imports `z` from `"zod"`)
- **GOTCHA**: Keep `saveBaseContractSchema` and its type intact — other files import them
- **VALIDATE**: `pnpm check-types`

---

### Task 2: CREATE `apps/web/src/actions/get-patient-contract-action.ts`

- **ACTION**: CREATE server action that returns both the existing patient contract AND base contract HTML in one call
- **IMPLEMENT**:
  ```typescript
  "use server"

  import { authActionClient } from "@/lib/safe-action"
  import { getPatientContractSchema } from "@/lib/validations/contract"
  import type { Tables } from "@ventre/supabase/types"

  export const getPatientContractAction = authActionClient
    .inputSchema(getPatientContractSchema)
    .action(async ({ parsedInput: { patientId }, ctx: { supabase, user, profile } }) => {
      // Fetch existing patient contract
      const { data: contract } = await supabase
        .from("contracts")
        .select("*")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .maybeSingle()

      // Fetch base contract clauses for pre-population
      let baseContractHtml: string | null = null
      if (profile.enterprise_id) {
        const { data: base } = await supabase
          .from("contracts")
          .select("clauses_html")
          .eq("is_base_contract", true)
          .eq("enterprise_id", profile.enterprise_id)
          .maybeSingle()
        baseContractHtml = base?.clauses_html ?? null
      } else {
        const { data: base } = await supabase
          .from("contracts")
          .select("clauses_html")
          .eq("is_base_contract", true)
          .eq("user_id", user.id)
          .is("enterprise_id", null)
          .maybeSingle()
        baseContractHtml = base?.clauses_html ?? null
      }

      return {
        contract: contract ?? null,
        baseContractHtml,
      }
    })
  ```
- **MIRROR**: `apps/web/src/actions/save-base-contract-action.ts:16-32` — enterprise/user branching; `apps/web/src/services/base-contract.ts:12-17` — base contract query
- **IMPORTS**: `"use server"`, `authActionClient`, schema, `Tables` type
- **GOTCHA**: Use `supabase` (RLS client, not admin) — RLS on contracts already handles `is_team_member(patient_id)` access. Do NOT use `supabaseAdmin` here.
- **GOTCHA**: Return type — `contract` is `Tables<"contracts"> | null`, `baseContractHtml` is `string | null`
- **VALIDATE**: `pnpm check-types`

---

### Task 3: CREATE `apps/web/src/actions/save-patient-contract-action.ts`

- **ACTION**: CREATE server action that upserts a patient contract (insert or update)
- **IMPLEMENT**:
  ```typescript
  "use server"

  import { authActionClient } from "@/lib/safe-action"
  import { savePatientContractSchema } from "@/lib/validations/contract"
  import { revalidatePath } from "next/cache"

  export const savePatientContractAction = authActionClient
    .inputSchema(savePatientContractSchema)
    .action(async ({ parsedInput: { patientId, pregnancyId, clauses_html }, ctx: { supabase, user, profile } }) => {
      // Check if patient contract already exists
      const { data: existing } = await supabase
        .from("contracts")
        .select("id")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .maybeSingle()

      if (existing?.id) {
        const { error } = await supabase
          .from("contracts")
          .update({ clauses_html })
          .eq("id", existing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from("contracts")
          .insert({
            is_base_contract: false,
            clauses_html,
            patient_id: patientId,
            pregnancy_id: pregnancyId ?? null,
            enterprise_id: profile.enterprise_id ?? null,
            user_id: profile.enterprise_id ? null : user.id,
          })
        if (error) throw new Error(error.message)
      }

      revalidatePath(`/patients/${patientId}/profile`)
      return { success: true }
    })
  ```
- **MIRROR**: `apps/web/src/actions/save-base-contract-action.ts:14-50` — EXACTLY the same upsert structure; only difference is querying by `patient_id` instead of `is_base_contract`
- **IMPORTS**: `"use server"`, `authActionClient`, schema, `revalidatePath`
- **GOTCHA**: Use `supabase` (RLS client) — RLS `is_team_member(patient_id)` covers INSERT/UPDATE for patient contracts
- **GOTCHA**: Only update `clauses_html` on update (do NOT update `patient_id`, `pregnancy_id`, `enterprise_id` — those are immutable after creation)
- **GOTCHA**: `revalidatePath` must match the patient profile route pattern
- **VALIDATE**: `pnpm check-types`

---

### Task 4: CREATE `apps/web/src/components/shared/patient-contract.tsx`

- **ACTION**: CREATE self-contained component managing all states of the patient contract accordion
- **IMPLEMENT** the following state machine:
  - `loading` — initial fetch in progress → show spinner
  - `no-base` — `baseContractHtml === null` → show warning linking to `/settings/contract`
  - `no-contract` — `contract === null && baseContractHtml !== null` → show "Gerar contrato" button
  - `editing` — (triggered by "Gerar" click or when contract exists) → show RichEditor + Save button
- **KEY PATTERN**: Use **conditional rendering** (not `setContent`) to avoid TipTap async population issues. Only render `<RichEditor>` after `clausesHtml` is set from the fetched data. This ensures `content` prop is synchronous at mount time.
- **FULL IMPLEMENTATION**:
  ```tsx
  "use client"

  import { getPatientContractAction } from "@/actions/get-patient-contract-action"
  import { savePatientContractAction } from "@/actions/save-patient-contract-action"
  import { Button } from "@ventre/ui/button"
  import { RichEditor } from "@ventre/ui/shared/rich-editor"
  import { FileText } from "lucide-react"
  import { useAction } from "next-safe-action/hooks"
  import Link from "next/link"
  import { useEffect, useState } from "react"
  import { toast } from "sonner"

  type Mode = "loading" | "no-base" | "no-contract" | "editing"

  export default function PatientContract({
    patientId,
    pregnancyId,
  }: {
    patientId: string
    pregnancyId: string | null | undefined
  }) {
    const [mode, setMode] = useState<Mode>("loading")
    const [clausesHtml, setClausesHtml] = useState("")

    const { execute: fetchContract } = useAction(getPatientContractAction, {
      onSuccess: ({ data }) => {
        if (data?.contract) {
          setClausesHtml(data.contract.clauses_html)
          setMode("editing")
        } else if (data?.baseContractHtml) {
          setMode("no-contract")
        } else {
          setMode("no-base")
        }
      },
      onError: () => setMode("no-base"),
    })

    const { execute: saveContract, isExecuting: isSaving } = useAction(savePatientContractAction, {
      onSuccess: () => toast.success("Contrato salvo com sucesso"),
      onError: ({ error }) => toast.error(error.serverError ?? "Erro ao salvar contrato"),
    })

    useEffect(() => {
      fetchContract({ patientId })
    }, [patientId])

    // Store baseContractHtml for when user clicks "Gerar"
    const [baseHtml, setBaseHtml] = useState<string | null>(null)
    const { execute: refetch } = useAction(getPatientContractAction, {
      onSuccess: ({ data }) => setBaseHtml(data?.baseContractHtml ?? null),
    })

    // NOTE: Simpler approach — refetch handled in single useEffect above.
    // baseHtml stored via separate state updated in fetchContract onSuccess.
    // See implementation note below.

    if (mode === "loading") {
      return (
        <div className="flex items-center gap-2 py-6 text-muted-foreground text-sm">
          <span>Carregando contrato...</span>
        </div>
      )
    }

    if (mode === "no-base") {
      return (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p>Nenhum contrato base configurado.</p>
          <Link href="/settings/contract" className="mt-1 underline">
            Configurar contrato base →
          </Link>
        </div>
      )
    }

    if (mode === "no-contract") {
      return (
        <div className="flex flex-col items-start gap-3 py-4">
          <p className="text-muted-foreground text-sm">
            Nenhum contrato gerado para esta gestante ainda.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setClausesHtml(baseHtml ?? "")
              setMode("editing")
            }}
          >
            <FileText className="mr-2 size-4" />
            Gerar contrato
          </Button>
        </div>
      )
    }

    return (
      <div className="space-y-4 pt-2">
        <RichEditor
          content={clausesHtml}
          onChange={setClausesHtml}
          placeholder="Cláusulas do contrato..."
          className="min-h-[400px]"
        />
        <div className="flex justify-end">
          <Button
            className="gradient-primary"
            disabled={isSaving}
            onClick={() =>
              saveContract({
                patientId,
                pregnancyId: pregnancyId ?? null,
                clauses_html: clausesHtml,
              })
            }
          >
            {isSaving ? "Salvando..." : "Salvar contrato"}
          </Button>
        </div>
      </div>
    )
  }
  ```
- **IMPLEMENTATION NOTE on state management**: The `fetchContract` `onSuccess` handler needs to store both `mode` and `baseHtml`. Refactor into a single `useAction` call:
  ```tsx
  // Correct pattern — single useAction, store baseHtml in state:
  const [baseHtml, setBaseHtml] = useState<string | null>(null)

  const { execute: fetchContract } = useAction(getPatientContractAction, {
    onSuccess: ({ data }) => {
      if (data?.baseContractHtml) setBaseHtml(data.baseContractHtml)
      if (data?.contract) {
        setClausesHtml(data.contract.clauses_html)
        setMode("editing")
      } else if (data?.baseContractHtml) {
        setMode("no-contract")
      } else {
        setMode("no-base")
      }
    },
    onError: () => setMode("no-base"),
  })
  ```
- **MIRROR**: `apps/web/src/components/shared/patient-documents.tsx` — component shape (receives `patientId`); `apps/web/src/screens/contract-settings-screen.tsx:22-33` — `useAction` pattern with `onSuccess`/`onError`
- **IMPORTS**:
  - `"use client"` directive at top
  - `{ RichEditor } from "@ventre/ui/shared/rich-editor"`
  - `{ Button } from "@ventre/ui/button"`
  - `{ FileText } from "lucide-react"`
  - `{ useAction } from "next-safe-action/hooks"`
  - `{ toast } from "sonner"`
  - `Link from "next/link"`
  - `{ useEffect, useState } from "react"`
- **TIPTAP GOTCHA**: The `content` prop on `RichEditor` is init-only (TipTap `useEditor` reads it once). By using conditional rendering (`mode === "editing"` gates the RichEditor), the editor mounts only AFTER `clausesHtml` is populated — making the content synchronous at mount. No `setContent()` imperative calls needed.
- **GOTCHA**: `pregnancyId` may be `null` for patients without an active pregnancy — pass `pregnancyId ?? null` to the action
- **VALIDATE**: `pnpm check-types` — all TypeScript must compile; confirm `RichEditorProps` matches usage

---

### Task 5: UPDATE `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx`

- **ACTION**: ADD `pregnancy` extraction + import `PatientContract` + add accordion item between `"documentos"` and `"evolucao"`
- **CHANGES**:
  1. Add import at top (with other shared component imports, line ~9):
     ```typescript
     import PatientContract from "@/components/shared/patient-contract"
     ```
  2. After line 36 (`const patient = result.data?.patient`), add:
     ```typescript
     const pregnancy = result.data?.pregnancy
     ```
  3. After the `"documentos"` AccordionItem (after line 96), add:
     ```tsx
     <AccordionItem value="contrato">
       <AccordionTrigger className="font-poppins font-semibold text-base">
         Contrato
       </AccordionTrigger>
       <AccordionContent>
         <PatientContract patientId={patient.id} pregnancyId={pregnancy?.id ?? null} />
       </AccordionContent>
     </AccordionItem>
     ```
- **MIRROR**: `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:89-96` — EXACT same AccordionItem structure as "documentos"
- **GOTCHA**: `pregnancy` is already returned by `getPatientAction` — it's in `result.data?.pregnancy`. No action changes needed.
- **GOTCHA**: The accordion item goes between "documentos" and "evolucao" — not at the end — to follow the logical flow (patient info → documents → contract → evolution)
- **GOTCHA**: Biome may warn about import ordering — run `npx biome lint --write --unsafe apps/web/app/(dashboard)/patients/[id]/profile/page.tsx` after editing
- **VALIDATE**: `pnpm check-types` — confirm no TypeScript errors on the profile page

---

## Testing Strategy

### Manual Testing (Level 6)

**Scenario 1: No base contract configured**
1. Log in as a professional with NO base contract saved
2. Navigate to any patient profile → open "Contrato" accordion
3. Expected: amber warning with link to `/settings/contract`

**Scenario 2: Base contract exists, no patient contract yet**
1. Ensure base contract is saved via `/settings/contract`
2. Navigate to any patient profile → open "Contrato" accordion
3. Expected: "Gerar contrato" button visible
4. Click "Gerar contrato"
5. Expected: RichEditor appears, pre-populated with base contract HTML
6. Edit a clause → click "Salvar contrato"
7. Expected: toast "Contrato salvo com sucesso"
8. Refresh the page → open "Contrato" accordion again
9. Expected: RichEditor shows the saved patient contract (not base)

**Scenario 3: Patient contract already exists**
1. Patient that already has a saved contract (from Scenario 2)
2. Open "Contrato" accordion
3. Expected: RichEditor immediately shows saved patient clauses (no "Gerar" button)
4. Edit → Save → Refresh → verify edits persisted

**Scenario 4: Autonomous user (no enterprise)**
1. Log in as a professional WITHOUT an enterprise
2. Repeat scenarios above
3. Expected: Same behavior; RLS satisfies via `user_id = auth.uid()`

**Scenario 5: Patient without a pregnancy**
1. Open "Contrato" for a patient where `pregnancy` is null/undefined
2. Save a contract → confirm `pregnancy_id = null` in DB (check via Supabase)
3. No error should occur

### Edge Cases Checklist

- [ ] `baseContractHtml` is null (no base contract) → shows warning, not error
- [ ] `contract` is null + `baseContractHtml` is null → shows warning state
- [ ] `pregnancyId` is null → `savePatientContractAction` accepts it (`nullable().optional()`)
- [ ] Two saves in a row → second save does UPDATE not INSERT (check via supabase `upsert check`)
- [ ] Empty clauses_html → blocked by Zod `min(1)` before reaching the action

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, no TypeScript errors across all packages

```bash
npx biome lint --write --unsafe apps/web/src/components/shared/patient-contract.tsx
npx biome lint --write --unsafe apps/web/app/(dashboard)/patients/[id]/profile/page.tsx
```

**EXPECT**: Biome fixes class ordering warnings automatically

### Level 2: UNIT_TESTS

No automated tests in this project (no test framework configured). Skip to Level 6 manual validation.

### Level 3: FULL BUILD

```bash
pnpm check-types
```

**EXPECT**: Exit 0

### Level 4: DATABASE_VALIDATION

Verify via Supabase MCP after saving a patient contract:

```sql
SELECT id, patient_id, pregnancy_id, is_base_contract, enterprise_id, user_id,
       length(clauses_html) as html_length, created_at
FROM contracts
WHERE is_base_contract = false
ORDER BY created_at DESC
LIMIT 5;
```

- [ ] `is_base_contract = false`
- [ ] `patient_id` matches the patient
- [ ] `pregnancy_id` matches pregnancy (or is NULL for patients without pregnancy)
- [ ] `clauses_html` is not empty
- [ ] Either `enterprise_id` OR `user_id` is set (not both)

### Level 5: BROWSER_VALIDATION

1. Open patient profile at `/patients/[id]/profile`
2. Click "Contrato" accordion → verify it opens without errors
3. Verify all 4 states render correctly (see manual testing above)
4. Check browser console for no unhandled errors
5. Verify RichEditor toolbar is functional (bold, italic, lists)

---

## Acceptance Criteria

- [ ] "Contrato" accordion item visible in patient profile
- [ ] State machine works: loading → no-base | no-contract | editing
- [ ] RichEditor pre-populated with base contract HTML when generating new contract
- [ ] Existing patient contract loads directly into editor (no "Gerar" step)
- [ ] `savePatientContractAction` creates record on first save, updates on subsequent saves
- [ ] `patient_id` and `pregnancy_id` correctly set in DB
- [ ] Toast notifications on success/error
- [ ] `pnpm check-types` passes with exit 0

---

## Completion Checklist

- [ ] Task 1: `validations/contract.ts` updated with 2 new schemas
- [ ] Task 2: `get-patient-contract-action.ts` created and type-checks
- [ ] Task 3: `save-patient-contract-action.ts` created and type-checks
- [ ] Task 4: `patient-contract.tsx` created — all 4 states implemented
- [ ] Task 5: `profile/page.tsx` updated — pregnancy extracted, accordion item added
- [ ] Level 1: `pnpm check-types` passes
- [ ] Level 4: Database validation confirms correct inserts
- [ ] Level 5: Browser validation — all states render, save/load round-trip works
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| TipTap `content` prop not reactive after async fetch | HIGH | HIGH | Use conditional rendering — mount RichEditor only after `clausesHtml` is set; never update it externally. Documented with TipTap setContent source. |
| `pregnancy` is null for some patients | MEDIUM | MEDIUM | `pregnancyId: string \| null \| undefined` in component props; schema has `.nullable().optional()`; DB column allows NULL |
| RLS blocks patient contract query | MEDIUM | HIGH | `is_team_member(patient_id)` policy covers SELECT/INSERT/UPDATE — same as `patient_documents`. If blocked, switch to `supabaseAdmin` in `getPatientContractAction` only (not save). |
| Biome class sorting warnings | LOW | LOW | Run `npx biome lint --write --unsafe` after writing component — already standard practice per CLAUDE.md |
| Base contract not found for autonomous user | MEDIUM | MEDIUM | The `no-base` state handles this gracefully with a link to `/settings/contract` |

---

## Notes

**Why one combined action (`getPatientContractAction` returns both `contract` and `baseContractHtml`):**
Fetching them separately would require either: (a) two sequential actions on mount, or (b) complex state coordination. Combining them gives the component everything it needs in one round-trip, and the `baseContractHtml` is already available when the user clicks "Gerar contrato" (no second loading state).

**Why no "Use base as-is" vs "Edit before saving" choice:**
The PRD's Phase 4 originally mentioned this choice, but simplifying to always show the editor (pre-populated with base HTML) removes a decision point without losing any capability — the user can save immediately without editing if they want "use as-is".

**TipTap conditional rendering vs setContent:**
The research confirmed that `content` prop is init-only in TipTap v2. Using conditional rendering (gate the `<RichEditor>` behind `mode === "editing"`) means the editor always mounts with the correct `content` synchronously — no `useEffect` + `setContent` complexity. The `useRef` guard pattern (from research) is only needed when you must call `setContent` imperatively; we avoid this entirely.

**Phase 5 preparation:**
The `PatientContract` component's "Salvar contrato" button area should reserve space for a future "Exportar PDF" button (Phase 5 will add it alongside the save button). Consider a `flex gap-2` layout for the action buttons row.
