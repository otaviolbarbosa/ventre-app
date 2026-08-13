# Feature: Registro de Documentos Profissionais — Phase 2: Shared Form Fields

## Summary

Add a shared, reusable form-fields piece for professional council documents (CRM/RQE/CREFITO/COREN) that is conditioned on `professional_type`, backed by a single shared Zod schema (client + server), and wire it into `EditProfileModal` + `updateProfileAction` so `professional_documents` can be persisted end-to-end. This is Phase 2 of a 4-phase PRD; Phase 1 (DB column) is complete. Onboarding integration (Phase 3) and the dashboard banner + `?action=edit-profile` deep link (Phase 4) are explicitly out of scope here — but Phase 2 *does* wire the new fields into the existing `EditProfileModal`, since that's the only current home for profile-editing UI and is required to satisfy the phase's own success signal ("testable without onboarding/banner UI").

## User Story

As a profissional de saúde (obstetra, enfermeiro ou fisio)
I want to preencher meu CRM/RQE, COREN ou CREFITO/RQE ao editar meu perfil
So that meus dados de registro profissional fiquem salvos, sem bloquear meu uso da plataforma

## Problem Statement

There is currently no code path that reads or writes the `professional_documents` jsonb column added in Phase 1. `EditProfileModal` and `update-profile-action.ts` only handle `name`/`phone`/`address`, and validation schemas are duplicated (not shared) between client and server.

## Solution Statement

- All document fields are **fully optional at the schema level** — nothing is required, mirroring the PRD's "opcional, não bloqueia" decision. Validation only kicks in *if* a document object is provided: `number` must be non-empty digits, `uf` must be a valid Brazilian state abbreviation.
- One shared Zod schema (`professionalDocumentsSchema`) lives in `apps/web/src/lib/validations/professional-documents.ts`, imported by both `edit-profile-modal.tsx` (client, via `zodResolver`) and `update-profile-action.ts` (server, via `.inputSchema()`), per the project rule that the same schema must be reused, not duplicated.
- A single flat object schema (not `z.discriminatedUnion`) is used — research confirmed `discriminatedUnion` fights `useFieldArray` (auto-injects array keys into non-matching variants, weak TS narrowing on nested error paths). Since none of these fields are conditionally *required* (all optional), there's no need for a union or `superRefine`; conditional *rendering* (which fields are shown) is a pure UI concern driven by a `professionalType` prop on the shared component — not a schema concern.
- A new shared component `ProfessionalDocumentsFields` renders the right fields for the given `professionalType` (CRM+RQE for `obstetra`, CREFITO+RQE for `fisio`, COREN for `enfermeiro`, nothing for `doula`), using `useFieldArray` for the repeatable RQE rows (first such usage in this codebase).
- `updateProfileAction` is extended to accept and persist `professional_documents` on the `users` row, using the same anon/RLS `supabase` client already used for `name`/`phone` (no admin client needed — this is a self-scoped update).

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                        |
| Complexity       | MEDIUM                                             |
| Systems Affected | apps/web (validations, shared components, actions, modals, screens) |
| Dependencies     | zod ~3.24.1, react-hook-form ^7.54.2, @hookform/resolvers ^4.1.0, next-safe-action ^8.1.4 (no new deps) |
| Estimated Tasks  | 7                                                  |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════╗
║                          BEFORE STATE                              ║
╠═══════════════════════════════════════════════════════════════════╣
║  Profile page → "Editar Perfil" button → EditProfileModal          ║
║    ┌────────────┐   ┌──────────────────┐   ┌────────────────────┐ ║
║    │ Nome/Phone │──▶│ Endereço (CEP...) │──▶│ Salvar → users     │ ║
║    └────────────┘   └──────────────────┘   │ (name, phone only) │ ║
║                                             └────────────────────┘ ║
║  USER_FLOW: profissional só pode editar nome/telefone/endereço.    ║
║  PAIN_POINT: nenhum lugar para inserir CRM/RQE/COREN/CREFITO.      ║
║  DATA_FLOW: professional_documents column exists but is never      ║
║              read or written by any code path.                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════╗
║                           AFTER STATE                              ║
╠═══════════════════════════════════════════════════════════════════╣
║  Profile page → "Editar Perfil" → EditProfileModal                 ║
║    ┌────────────┐   ┌──────────────────┐   ┌────────────────────┐ ║
║    │ Nome/Phone │──▶│ Endereço (CEP...) │──▶│ Documentos         │ ║
║    └────────────┘   └──────────────────┘   │ profissionais (NEW)│ ║
║                                             └──────────┬─────────┘ ║
║                                                         ▼           ║
║                                         obstetra: CRM{num,UF} +     ║
║                                                    RQE[] (add/rm)   ║
║                                         fisio: CREFITO{num,UF} +    ║
║                                                RQE[] (add/rm)       ║
║                                         enfermeiro: COREN{num,UF}   ║
║                                         doula: (section hidden)     ║
║                                                         │           ║
║                                                         ▼           ║
║                                    Salvar → users.professional_    ║
║                                    documents (jsonb, all optional)  ║
║  USER_FLOW: profissional pode preencher/editar seus documentos a   ║
║              qualquer momento pelo modal de edição de perfil.      ║
║  VALUE_ADD: dado estruturado disponível para features futuras de   ║
║              emissão de documentos; nada bloqueia o fluxo atual.   ║
║  DATA_FLOW: form (RHF + shared Zod schema) → updateProfileAction   ║
║              → supabase.from("users").update({professional_        ║
║              documents}) scoped by auth.uid() (RLS) → users row.   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User_Action | Impact |
|----------|--------|-------|-------------|--------|
| `edit-profile-modal.tsx` | No documents section | New "Documentos profissionais" section, fields conditioned on `professionalType` prop | Fills CRM/RQE/COREN/CREFITO, clicks "Salvar" | `professional_documents` persisted |
| `profile-screen.tsx` | `EditProfileModal` receives no `professionalType`/`professionalDocuments` | Passes `professionalType={profile.professional_type}` and `professionalDocuments={profile.professional_documents}` | — (automatic) | Modal knows which fields to render and pre-fills existing values |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/actions/update-profile-action.ts` | 1-76 | Exact action pattern to extend — schema, `authActionClient` ctx destructure, update query shape |
| P0 | `apps/web/src/modals/edit-profile-modal.tsx` | 1-352 | Exact form pattern to extend — schema, `useForm`, `form.reset` on `open`, `useAction`/`executeAsync`, FormField usage |
| P0 | `apps/web/src/lib/validations/appointment.ts` | 1-60 | Closest precedent for a shared Zod schema file in `lib/validations/` deriving from a DB enum, with conditional validation via `superRefine` |
| P1 | `apps/web/src/actions/set-professional-type-action.ts` | 1-28 | Pattern for deriving a `professionalTypes` const array from `Tables<"users">["professional_type"]` |
| P1 | `apps/web/src/lib/safe-action.ts` | 1-33 | `authActionClient` context shape: `{ supabase, supabaseAdmin, user, profile }`; confirms `supabase` (anon/RLS) is correct client for self-scoped `users` update |
| P1 | `apps/web/src/lib/constants.ts` | 10-38 | `ESTADOS_BR` — existing UF list to reuse/derive a Zod enum from (do NOT invent a new UF list) |
| P1 | `apps/web/src/utils/team.ts` | 1-8 | `professionalTypeLabels` — existing PT-BR label map per `professional_type`, reuse for section headers |
| P2 | `apps/web/src/screens/profile-screen.tsx` | 1-30, 160-200 | Where `EditProfileModal` is rendered and what props it currently receives from `profile` |
| P2 | `apps/web/app/(dashboard)/profile/page.tsx` | 1-27 | Server Component that fetches `profile` via `getServerAuth()` — confirms `professional_type`/`professional_documents` are already present on `profile` (selects `*`) |
| P2 | `apps/web/src/components/shared/info-item.tsx` | 1-12 | Shared component file convention: kebab-case filename, `"use client"` only if needed, inline prop types |
| P2 | `apps/web/src/components/shared/billing-fee-card.tsx` | 1-48 | Convention reference for a shared component that takes a `Tables<...>` slice as a prop |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [Zod discriminated unions](https://zod.dev/?id=discriminated-unions) | Discriminated unions | Confirms why we are AVOIDING `discriminatedUnion` here (fights `useFieldArray`) — use flat optional object instead |
| [react-hook-form useFieldArray](https://react-hook-form.com/docs/usefieldarray) | Hook signature | Exact `{ fields, append, remove }` API for the RQE repeatable rows |
| [react-hook-form Issue #13010](https://github.com/react-hook-form/react-hook-form/issues/13010) | useFieldArray default injection | `useFieldArray({ name: 'rqe' })` injects `rqe: []` into form values even when unmounted for other variants — mitigate by keeping `rqe` in the schema as always-optional (already the case) and stripping empty arrays server-side before persisting |

---

## Patterns to Mirror

**SHARED VALIDATION FILE (conditional-by-enum precedent):**
```typescript
// SOURCE: apps/web/src/lib/validations/appointment.ts:1-13
import { z } from "zod";
import type { Database } from "@ventre/supabase/types";

type AppointmentType = Database["public"]["Enums"]["appointment_type"];

const appointmentTypes = ["consulta", "encontro"] as const satisfies readonly AppointmentType[];
```

**DB-ENUM-DERIVED CONST ARRAY:**
```typescript
// SOURCE: apps/web/src/actions/set-professional-type-action.ts:9-16
type ProfessionalType = NonNullable<Tables<"users">["professional_type"]>;

const professionalTypes = [
  "obstetra",
  "enfermeiro",
  "doula",
  "fisio",
] as const satisfies readonly ProfessionalType[];
```

**ACTION PATTERN (schema + authActionClient + update):**
```typescript
// SOURCE: apps/web/src/actions/update-profile-action.ts:22-36
export const updateProfileAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user } }) => {
    const { data: profile, error } = await supabase
      .from("users")
      .update({
        name: parsedInput.name.trim(),
        phone: parsedInput.phone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw new Error("Erro ao atualizar perfil");
    // ...
    return { profile };
  });
```

**FORM PATTERN (schema + useForm + reset-on-open + executeAsync):**
```typescript
// SOURCE: apps/web/src/modals/edit-profile-modal.tsx:20-36, 67-102, 121-138
const editProfileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().optional(),
  address: z.object({ /* ... */ }).optional(),
});

const form = useForm<EditProfileInput>({
  resolver: zodResolver(editProfileSchema),
  defaultValues: { /* ... */ },
});

useEffect(() => {
  if (open) {
    form.reset({ /* populate from props */ });
  }
}, [open, name, phone, address, form]);

const { executeAsync: saveProfile } = useAction(updateProfileAction, {
  onSuccess: ({ data }) => { /* toast */ },
});

async function handleSubmit(values: EditProfileInput) {
  const result = await saveProfile(values);
  if (!result?.data?.profile) {
    toast.error(result?.serverError ?? "Erro ao salvar perfil");
    return;
  }
  onSuccess?.(...);
  onOpenChange(false);
}
```

**FORM FIELD JSX (Select with ESTADOS_BR, existing UF pattern to mirror exactly):**
```tsx
// SOURCE: apps/web/src/modals/edit-profile-modal.tsx:237-264
<FormField
  control={form.control}
  name="address.state"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Estado</FormLabel>
      <Select value={field.value ?? undefined} onValueChange={field.onChange}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="UF" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {ESTADOS_BR.map((estado) => (
            <SelectItem key={estado.sigla} value={estado.sigla}>
              {estado.sigla}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**SHARED COMPONENT FILE CONVENTION:**
```typescript
// SOURCE: apps/web/src/components/shared/info-item.tsx:1-3
"use client";

export default function InfoItem({ label, value }: { /* inline props */ }) {
```
Note: `EditProfileModal` itself uses a named export (`export function EditProfileModal`), while `components/shared/*` files observed use `export default function`. Follow the **shared/** convention (default export) for the new `ProfessionalDocumentsFields` component since it lives in `components/shared/`.

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/lib/validations/professional-documents.ts` | CREATE | Shared Zod schema (client + server), UF enum derived from `ESTADOS_BR`, `ProfessionalDocuments` type |
| `apps/web/src/components/shared/professional-documents-fields.tsx` | CREATE | Reusable conditional field-group component (CRM/CREFITO/COREN + RQE `useFieldArray`) |
| `apps/web/src/actions/update-profile-action.ts` | UPDATE | Import shared schema, extend `schema` with `professional_documents`, persist to `users` update |
| `apps/web/src/modals/edit-profile-modal.tsx` | UPDATE | Import shared schema + component, add `professionalType`/`professionalDocuments` props, extend form schema/defaultValues/reset, render `ProfessionalDocumentsFields` |
| `apps/web/src/screens/profile-screen.tsx` | UPDATE | Pass `professionalType={profile.professional_type}` and `professionalDocuments={profile.professional_documents}` to `EditProfileModal` |

---

## NOT Building (Scope Limits)

- Onboarding step integration (`onboarding-screen.tsx`, `set-professional-type-action.ts` extension) — Phase 3.
- Dashboard banner and `?action=edit-profile` auto-open deep link — Phase 4.
- External CFM/COREN/CREFITO verification — out of scope for the whole PRD.
- Public/patient-facing display of these documents — out of scope for the whole PRD.
- Backfill/migration of existing users — explicit PRD decision, none planned.
- Required-field enforcement (e.g. forcing CRM before allowing save) — explicit PRD decision: fully optional.

---

## Step-by-Step Tasks

### Task 1: CREATE `apps/web/src/lib/validations/professional-documents.ts`

- **ACTION**: CREATE shared Zod schema file
- **IMPLEMENT**:
  - `ufSiglas` — `as const satisfies readonly string[]` array derived by mapping `ESTADOS_BR.map(e => e.sigla)` is NOT directly usable inside `z.enum` (needs a literal tuple), so hardcode the tuple of UF codes as `as const` and add a one-line comment noting it must stay in sync with `ESTADOS_BR` in `lib/constants.ts` (no existing sync mechanism to build on).
  - `documentEntrySchema = z.object({ number: z.string().trim().min(1, "Número é obrigatório").regex(/^\d+$/, "Apenas números"), uf: z.enum(ufSiglas, { required_error: "UF é obrigatória" }) })`
  - `professionalDocumentsSchema = z.object({ crm: documentEntrySchema.optional(), crefito: documentEntrySchema.optional(), coren: documentEntrySchema.optional(), rqe: z.array(documentEntrySchema).optional() })` — every top-level key optional, mirrors the PRD's `ProfessionalDocuments` type exactly.
  - `export type ProfessionalDocumentsInput = z.infer<typeof professionalDocumentsSchema>`
- **MIRROR**: `apps/web/src/lib/validations/appointment.ts:1-13` for file structure/imports; `apps/web/src/actions/set-professional-type-action.ts:9-16` for the `as const satisfies` pattern
- **IMPORTS**: `import { z } from "zod"`
- **GOTCHA**: Do NOT use `z.discriminatedUnion` — research confirmed it fights `useFieldArray`'s default-value injection and weakens TS narrowing on nested `rqe.N.number` error paths for no benefit here (nothing is conditionally required, only conditionally *displayed*).
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/components/shared/professional-documents-fields.tsx`

- **ACTION**: CREATE shared conditional field-group component
- **IMPLEMENT**:
  - `"use client"` (uses hooks)
  - Props: `{ control: Control<{ professional_documents?: ProfessionalDocumentsInput }>; professionalType: Tables<"users">["professional_type"] }` (generic enough to plug into any parent form whose schema nests fields under `professional_documents`)
  - Renders a `<div className="space-y-4 pt-2"><p className="font-medium text-sm">Documentos profissionais</p>...</div>` section, mirroring the "Endereço" section header pattern in `edit-profile-modal.tsx:183-184`
  - `professionalType === "obstetra"` → CRM `FormField` (`professional_documents.crm.number`, `professional_documents.crm.uf` via `Select` + `ESTADOS_BR`, mirroring the address UF `FormField` exactly) + RQE list
  - `professionalType === "fisio"` → same but CREFITO instead of CRM, + RQE list
  - `professionalType === "enfermeiro"` → COREN only, no RQE
  - `professionalType === "doula"` or `null` → render nothing (`return null` early, or omit the section)
  - RQE list: `useFieldArray({ control, name: "professional_documents.rqe" })`, render each row as a `number`+`uf` pair with a remove button (`Trash2` icon, mirroring `lucide-react` usage elsewhere), plus an "Adicionar RQE" button (`Plus` icon) calling `append({ number: "", uf: "" })`
- **MIRROR**: `apps/web/src/modals/edit-profile-modal.tsx:237-264` for the UF `Select` FormField pattern; `apps/web/src/components/shared/info-item.tsx:1-3` for file/export convention (default export)
- **IMPORTS**: `import { useFieldArray, type Control } from "react-hook-form"`, `Plus`/`Trash2` from `lucide-react`, `Button`/`Input`/`Select*`/`Form*` from `@ventre/ui/*`
- **GOTCHA**: `useFieldArray` for `rqe` must be called unconditionally at the top of the component (Rules of Hooks) even though it's only rendered for `obstetra`/`fisio` — this matches the RHF gotcha found in research (Issue #13010): calling the hook is safe, just guard the *rendering* of the append/remove UI by `professionalType`.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/actions/update-profile-action.ts`

- **ACTION**: Extend schema and persist `professional_documents`
- **IMPLEMENT**:
  - Replace the inline duplicated schema fields with: `const schema = z.object({ name: ..., phone: ..., address: ..., professional_documents: professionalDocumentsSchema.optional() })` — import `professionalDocumentsSchema` from Task 1 instead of redefining
  - In the `.update({...})` call, add `professional_documents: parsedInput.professional_documents ?? null` — pass through as-is (empty object `{}` from an all-empty form should be normalized to `null` by the caller/schema; keep the action itself simple and trust the shared schema's shape)
  - Do NOT switch `.select()` to explicit columns as part of this task — that's a pre-existing pattern deviation unrelated to this feature; leave it untouched to keep the diff focused
- **MIRROR**: `apps/web/src/actions/update-profile-action.ts:6-34` (existing structure, extend in place)
- **IMPORTS**: `import { professionalDocumentsSchema } from "@/lib/validations/professional-documents"`
- **GOTCHA**: Uses `supabase` (anon/RLS client from `ctx`), not `supabaseAdmin` — this is a self-scoped `.eq("id", user.id)` update, consistent with how `name`/`phone` are already written; do not switch to `supabaseAdmin`.
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/modals/edit-profile-modal.tsx`

- **ACTION**: Wire in professional documents fields
- **IMPLEMENT**:
  - Add props: `professionalType: Tables<"users">["professional_type"]; professionalDocuments?: Tables<"users">["professional_documents"]`
  - Replace the inline `editProfileSchema` with one that merges the existing `name`/`phone`/`address` shape with `professional_documents: professionalDocumentsSchema.optional()` (keep `name`/`phone`/`address` inline as they are today — only add the new key; do not extract those into `lib/validations` as part of this task, that's a separate concern not requested by this phase)
  - Extend `defaultValues` and the `form.reset(...)` call inside the existing `useEffect` (keyed on `open`) to also seed `professional_documents` from the `professionalDocuments` prop (cast/normalize `Json` from Supabase into `ProfessionalDocumentsInput | undefined` — the column is `jsonb`, typed as `Json` in generated types, so narrow it defensively, e.g. `(professionalDocuments as ProfessionalDocumentsInput | null) ?? undefined`)
  - Render `<ProfessionalDocumentsFields control={form.control} professionalType={professionalType} />` after the existing "Endereço" section, before the submit buttons
  - `handleSubmit`/`saveProfile` call needs no change — `values` already includes `professional_documents` since it's now part of the schema
- **MIRROR**: existing schema/`useEffect`/JSX structure in the same file (Task 1's Mandatory Reading)
- **IMPORTS**: `import { ProfessionalDocumentsFields } from "@/components/shared/professional-documents-fields"`, `import { professionalDocumentsSchema, type ProfessionalDocumentsInput } from "@/lib/validations/professional-documents"`
- **GOTCHA**: `Tables<"users">["professional_documents"]` is typed as `Json | null` (generic jsonb) by generated Supabase types, not `ProfessionalDocuments` — there is no DB-level type safety on this column's shape. Cast explicitly at the boundary as noted above; do not assume the type flows through automatically.
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/screens/profile-screen.tsx`

- **ACTION**: Pass new props to `EditProfileModal`
- **IMPLEMENT**: Add `professionalType={profile.professional_type}` and `professionalDocuments={profile.professional_documents}` to the existing `<EditProfileModal ... />` call (around line 188-199)
- **MIRROR**: existing prop-passing pattern in the same call (`name={profileName}`, `address={address}`, etc.)
- **VALIDATE**: `pnpm check-types`

### Task 6: Manual validation — save flow

- **ACTION**: Manually verify end-to-end persistence (no automated test infra observed in this repo for actions/modals — confirm this is still true before skipping; if a test runner exists, prefer it)
- **IMPLEMENT**: Run the dev server, log in as a user with `professional_type = obstetra`, open "Editar Perfil", fill CRM number+UF, add 2 RQE rows, save, confirm toast success and that reopening the modal shows the saved values (via `router.refresh()` re-fetching `profile`)
- **VALIDATE**: Manual browser check; also verify a `doula`-type user sees no documents section at all, and an `enfermeiro`-type user sees only COREN (no RQE)

### Task 7: Full validation pass

- **ACTION**: Run project-wide checks
- **IMPLEMENT**: N/A
- **VALIDATE**: `pnpm check-types` (root) and `npx biome lint --write --unsafe apps/web/src/lib/validations/professional-documents.ts apps/web/src/components/shared/professional-documents-fields.tsx apps/web/src/actions/update-profile-action.ts apps/web/src/modals/edit-profile-modal.tsx apps/web/src/screens/profile-screen.tsx` to fix class-sorting/import-order warnings

---

## Testing Strategy

No existing unit/integration test infrastructure was found for actions or modals in this codebase during exploration (no `*.test.ts` alongside `actions/` or `modals/` was located) — validation for this phase relies on `pnpm check-types`, Biome, and manual browser verification (Task 6). If the user confirms a test runner exists elsewhere in the repo, add:

| Test File | Test Cases | Validates |
|-----------|------------|-----------|
| N/A (none found) | — | — |

### Edge Cases Checklist
- [ ] Saving with all professional-document fields empty → `professional_documents` should not error and should not leave stray empty objects like `{ crm: { number: "", uf: undefined } }` — normalize empty entries to `undefined`/omit before submit if RHF's `useFieldArray` leaves an empty `rqe: []`
- [ ] `professionalType = "doula"` → no documents section rendered, `professional_documents` not touched (stays whatever it was, i.e. still `null`)
- [ ] `professionalType = "enfermeiro"` → only COREN shown, no RQE fields
- [ ] Adding then removing all RQE rows → array ends up empty/omitted, not `[{}]`
- [ ] UF `Select` only offers values from `ESTADOS_BR` siglas — invalid manual input impossible via UI, but schema still validates format server-side (defense in depth per `next-safe-action` re-validation)
- [ ] Re-opening the modal after a save shows persisted values pre-filled (via `form.reset` in the `open` `useEffect`)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
```
**EXPECT**: Exit 0, no type errors across all packages

### Level 2: LINT
```bash
npx biome lint --write --unsafe apps/web/src/lib/validations/professional-documents.ts apps/web/src/components/shared/professional-documents-fields.tsx apps/web/src/actions/update-profile-action.ts apps/web/src/modals/edit-profile-modal.tsx apps/web/src/screens/profile-screen.tsx
```
**EXPECT**: No remaining warnings/errors on touched files

### Level 3: MANUAL_VALIDATION
Per Task 6 — exercise the modal for `obstetra`, `fisio`, `enfermeiro`, and `doula` professional types; confirm `users.professional_documents` is written correctly (spot-check via Supabase dashboard or `execute_sql` on the relevant row) and that RLS is respected (only the logged-in user's own row is updated).

---

## Acceptance Criteria

- [ ] `professionalDocumentsSchema` exists in `apps/web/src/lib/validations/professional-documents.ts` and is imported (not duplicated) by both `update-profile-action.ts` and `edit-profile-modal.tsx`
- [ ] `ProfessionalDocumentsFields` renders the correct field set per `professional_type` (CRM+RQE / CREFITO+RQE / COREN / nothing)
- [ ] RQE rows are addable/removable via `useFieldArray`
- [ ] Saving the modal persists `professional_documents` on the `users` row scoped to `auth.uid()` (RLS-respecting `supabase` client, not admin)
- [ ] All fields remain fully optional — saving with nothing filled in does not error
- [ ] `pnpm check-types` passes
- [ ] No regressions to existing name/phone/address editing flow

---

## Completion Checklist

- [ ] Task 1: shared schema created
- [ ] Task 2: shared field component created
- [ ] Task 3: action extended
- [ ] Task 4: modal wired
- [ ] Task 5: screen passes new props
- [ ] Task 6: manual end-to-end verification across all 4 professional types
- [ ] Task 7: type-check + lint clean

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `useFieldArray` on `rqe` injects stray `rqe: []` into payload for `enfermeiro`/`doula` where it's irrelevant | M | LOW | Schema already treats `rqe` as optional everywhere; normalize empty array to `undefined` before submit if needed — harmless even if sent, since it's optional at every level |
| `professional_documents` typed as generic `Json` from generated Supabase types, no compile-time link to `ProfessionalDocumentsInput` | M | MED | Explicit cast at the modal boundary (Task 4), documented as a known gap — Phase 1's migration did not add a `check` constraint or narrower type, which is consistent with the PRD's "no external validation" scope |
| Hardcoded UF tuple in the new schema can drift from `ESTADOS_BR` in `lib/constants.ts` | L | LOW | Comment added at the tuple definition noting the sync requirement; both lists are short (27 entries) and rarely change |
| No existing test infra to catch regressions automatically | M | MED | Manual validation checklist (Task 6) covers all 4 professional types explicitly |

---

## Notes

- Discriminated-union vs. flat-optional-schema was the key design decision (see Solution Statement) — chosen after explicit research into `useFieldArray` compatibility with `zod ~3.24.1` / `react-hook-form ^7.54.2`. This keeps the schema simple and avoids fighting the RHF/Zod TS-narrowing friction documented in react-hook-form issues #13010 and discussion #13044.
- Phase 3 (onboarding) will need its own new step in `onboarding-screen.tsx` that reuses `ProfessionalDocumentsFields` + `professionalDocumentsSchema` from this phase, likely via a new/extended action (possibly extending `set-professional-type-action.ts` to accept documents in the same call, per the PRD's architecture notes) — not built here.
- Phase 4 (banner + `?action=edit-profile`) will need `professional_type`/`professional_documents` read from a Server Component in `(dashboard)/layout.tsx` and the `?action=edit-profile` query-param handling added to `ProfileScreen`/`EditProfileModal` — not built here, but this phase's prop additions to `EditProfileModal` (`professionalType`, `professionalDocuments`) are exactly what Phase 4 will need to already have in place.
