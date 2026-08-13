# Feature: Registro de Documentos Profissionais — Phase 3 (Onboarding)

## Summary

Add an optional, non-blocking step to the professional onboarding flow (`apps/web/src/screens/onboarding-screen.tsx`) that lets professionals (`obstetra`, `fisio`, `enfermeiro`) fill in their council documents (CRM/RQE, CREFITO/RQE, COREN) immediately after picking their professional-type card. The step reuses the shared `ProfessionalDocumentsFields` component and `professionalDocumentsSchema` built in Phase 2. `doula` has no council documents and skips this step entirely, going straight to `/home` as it does today.

## User Story

As a profissional de saúde (obstetra, enfermeira ou fisioterapeuta) me cadastrando na plataforma
I want to poder informar meu CRM/RQE, COREN ou CREFITO/RQE logo após escolher minha especialidade, sem ser obrigada a isso
So that eu possa completar meu cadastro rapidamente e preencher meus dados de registro profissional no meu tempo

## Problem Statement

Today, `setProfessionalTypeAction` writes `professional_type` and immediately calls `redirect("/home")` server-side — there is no point in the onboarding flow where a professional can enter council document numbers. Phase 2 built the shared schema/component/action to persist `professional_documents`, but nothing in onboarding calls it yet.

## Solution Statement

1. Remove the server-side `redirect("/home")` from `setProfessionalTypeAction` so the client `useAction` call resolves normally on success instead of hard-navigating away.
2. In `onboarding-screen.tsx`, track the just-selected `professional_type` in local state. On successful type save: if the type is `doula`, redirect client-side to `/home` immediately (matches current behavior, no documents step needed). Otherwise render a new "documents" step with `ProfessionalDocumentsFields`, a "Pular" (skip) action, and a "Salvar e continuar" (save) action.
3. Add a new dedicated server action `setProfessionalDocumentsAction` (mirrors `update-profile-action.ts`'s handling of `professional_documents`, but scoped to onboarding: writes `professional_documents` only if provided, then always `redirect("/home")`). Both "Pular" and "Salvar e continuar" call this one action — skip sends no `professional_documents`, save sends the normalized form values.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                            |
| Complexity       | MEDIUM                                                                |
| Systems Affected | `apps/web/src/screens/onboarding-screen.tsx`, `apps/web/src/actions/` |
| Dependencies     | `react-hook-form` (existing), `next-safe-action` (existing), `zod` (existing) |
| Estimated Tasks  | 5                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════╗
║ Selecionar perfil → Selecionar especialidade → [server redirect /home] ║
║                                                                         ║
║  USER_FLOW: click card ("Obstetra") → executeProfessionalType({type})  ║
║             → server writes professional_type → redirect("/home")     ║
║  PAIN_POINT: no point to enter CRM/RQE/COREN/CREFITO exists anywhere   ║
║              in onboarding — professional lands on /home with         ║
║              professional_documents = null forever (until banner,     ║
║              Phase 4, or manual profile edit)                         ║
║  DATA_FLOW: users.professional_type set; professional_documents       ║
║             untouched (stays null)                                    ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════╗
║ Selecionar perfil → Selecionar especialidade → [documents step] → /home║
║                                                                         ║
║  USER_FLOW (obstetra/fisio/enfermeiro):                               ║
║    click card → executeProfessionalType({type}) resolves (no redirect)║
║    → documentsStep state set to chosen type → renders CRM/RQE (or     ║
║    CREFITO/RQE or COREN) form + "Pular" / "Salvar e continuar"        ║
║    → either button calls setProfessionalDocumentsAction → server      ║
║    writes professional_documents (if any) → redirect("/home")        ║
║                                                                         ║
║  USER_FLOW (doula): click card → executeProfessionalType resolves →   ║
║    client immediately router.push("/home") — unchanged UX, no step    ║
║                                                                         ║
║  VALUE_ADD: professionals can register council documents inline,      ║
║             without leaving onboarding or hunting for it in /profile  ║
║  DATA_FLOW: users.professional_type set (unchanged); then             ║
║             users.professional_documents set in a second, separate    ║
║             write if the user filled anything in                      ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                          | Before                                  | After                                                             | User Impact                                    |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| `onboarding-screen.tsx` (professional-type branch) | Clicking a card redirects straight to `/home` | Clicking a card (obstetra/fisio/enfermeiro) reveals a documents step; doula still redirects straight away | Professional can register CRM/RQE/COREN/CREFITO inline, or skip |
| `set-professional-type-action.ts` | Redirects server-side after write        | Just writes `professional_type`, no redirect — caller decides next step | No visible change unless documents step follows |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/actions/set-professional-type-action.ts` | 1-27 | The redirect to remove |
| P0 | `apps/web/src/screens/onboarding-screen.tsx` | 93-181, 281-322 | Exact state/branch to extend |
| P0 | `apps/web/src/components/shared/professional-documents-fields.tsx` | 1-155 | Component to reuse as-is (generic `Control<TFieldValues>`) |
| P0 | `apps/web/src/lib/validations/professional-documents.ts` | 1-51 | Schema to reuse as-is |
| P1 | `apps/web/src/modals/edit-profile-modal.tsx` | 67-90, 104-180 | Normalization pattern (`normalizeProfessionalDocuments`) to mirror |
| P1 | `apps/web/src/actions/update-profile-action.ts` | 1-40 | How `professional_documents` is persisted today (pattern for new action) |
| P2 | `apps/web/src/lib/safe-action.ts` | 1-37 | Confirms `authActionClient` ctx already guarantees a `users` row exists (write is always UPDATE) |
| P2 | `app/(dashboard)/onboarding/page.tsx` | 1-18 | Completion gate — confirms it only checks `professional_type`, unaffected by this change |

No external documentation needed — this phase is 100% internal (existing libs, no new dependencies, no API changes).

---

## Patterns to Mirror

**SERVER_ACTION_WITH_REDIRECT** (existing convention: action itself calls `redirect()`):
```typescript
// SOURCE: apps/web/src/actions/set-professional-type-action.ts:22-27
export const setProfessionalTypeAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    await setProfessionalType(supabase, user.id, parsedInput.type);
    redirect("/home");
  });
```

**PROFESSIONAL_DOCUMENTS_PERSISTENCE** (existing pattern from Phase 2, RLS-scoped client, `.eq("id", user.id)`):
```typescript
// SOURCE: apps/web/src/actions/update-profile-action.ts:26-37
.action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user } }) => {
    const { data: profile, error } = await supabase
      .from("users")
      .update({
        name: parsedInput.name.trim(),
        phone: parsedInput.phone?.trim() || null,
        professional_documents: parsedInput.professional_documents ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw new Error("Erro ao atualizar perfil");
```

**NORMALIZATION_BEFORE_SUBMIT** (strips empty document rows so an untouched section submits `undefined`, not empty-string objects that fail Zod):
```typescript
// SOURCE: apps/web/src/modals/edit-profile-modal.tsx:67-90
function normalizeDocumentEntry<T extends { number: string; uf: string } | undefined>(
  entry: T,
): T | undefined {
  if (!entry || !entry.number.trim()) return undefined;
  return entry;
}

function normalizeProfessionalDocuments(
  documents: ProfessionalDocumentsInput | undefined,
): ProfessionalDocumentsInput | undefined {
  if (!documents) return undefined;

  const rqe = documents.rqe?.filter((entry) => entry.number.trim().length > 0);

  const normalized: ProfessionalDocumentsInput = {
    crm: normalizeDocumentEntry(documents.crm),
    crefito: normalizeDocumentEntry(documents.crefito),
    coren: normalizeDocumentEntry(documents.coren),
    rqe: rqe && rqe.length > 0 ? rqe : undefined,
  };

  const hasData = Object.values(normalized).some((v) => v !== undefined);
  return hasData ? normalized : undefined;
}
```

**SHARED_FIELDS_COMPONENT_USAGE**:
```typescript
// SOURCE: apps/web/src/modals/edit-profile-modal.tsx:368
<ProfessionalDocumentsFields control={form.control} professionalType={professionalType} />
```

**SECONDARY_TEXT_BUTTON** (the closest existing precedent for a "skip"-style low-emphasis action — reuse this exact visual treatment for "Pular"):
```typescript
// SOURCE: apps/web/src/screens/onboarding-screen.tsx:313-319
<button
  type="button"
  onClick={() => setSelectedRole(null)}
  className="mt-6 text-muted-foreground text-sm underline-offset-4 hover:underline"
>
  Voltar
</button>
```

**MULTI_FORM_IN_ONE_SCREEN** (precedent for adding a second `useForm` instance alongside `enterpriseForm` in the same component):
```typescript
// SOURCE: apps/web/src/screens/onboarding-screen.tsx:104-122
const enterpriseForm = useForm<RequestEnterpriseInput>({
  resolver: zodResolver(requestEnterpriseSchema),
  defaultValues: { name: "", legal_name: "", cnpj: "", ... },
});
```

**ACTION_HOOK_WITH_ONSUCCESS** (existing pattern for `useAction` with callbacks, used for `lookupCepAction`):
```typescript
// SOURCE: apps/web/src/modals/edit-profile-modal.tsx:143-156
const { execute: lookupCep, status: cepStatus } = useAction(lookupCepAction, {
  onSuccess: ({ data }) => { ... },
  onError: () => { toast.error("CEP não encontrado"); ... },
});
```

---

## Files to Change

| File                                                                 | Action | Justification                                                                 |
| ---------------------------------------------------------------------| ------ | -------------------------------------------------------------------------------|
| `apps/web/src/actions/set-professional-type-action.ts`               | UPDATE | Remove `redirect("/home")` so the client controls what happens next          |
| `apps/web/src/actions/set-professional-documents-action.ts`          | CREATE | New action: persist `professional_documents` (if provided) then redirect home |
| `apps/web/src/screens/onboarding-screen.tsx`                         | UPDATE | Add documents-step state, doula fast-path redirect, new render branch, form   |

---

## NOT Building (Scope Limits)

- Blocking onboarding completion on documents being filled — explicitly opt-in/skippable per PRD.
- A step for `doula` — it has no council document type; keeps existing immediate-redirect behavior.
- Any change to `update-profile-action.ts` or `EditProfileModal` — those already work from Phase 2, untouched here.
- The dashboard banner and `?action=edit-profile` deep link — that is Phase 4, tracked and executed separately (can run in parallel).
- External validation of CRM/COREN/CREFITO numbers — out of scope for the whole PRD.

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/actions/set-professional-type-action.ts`

- **ACTION**: Remove the `redirect("/home")` call and the now-unused `redirect` import.
- **IMPLEMENT**: The action becomes:
  ```typescript
  export const setProfessionalTypeAction = authActionClient
    .inputSchema(schema)
    .action(async ({ parsedInput, ctx: { supabase, user } }) => {
      await setProfessionalType(supabase, user.id, parsedInput.type);
    });
  ```
- **MIRROR**: `apps/web/src/actions/set-user-type-action.ts` — the sibling action that already omits `redirect()` and lets the caller orchestrate what happens next.
- **GOTCHA**: Do not add a return value beyond what's needed — `useAction`'s `onSuccess` in Task 3 only needs to know the call succeeded, it already has `type` from the closure.
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/actions/set-professional-documents-action.ts`

- **ACTION**: New server action dedicated to the onboarding documents step.
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { authActionClient } from "@/lib/safe-action";
  import { professionalDocumentsSchema } from "@/lib/validations/professional-documents";
  import { redirect } from "next/navigation";
  import { z } from "zod";

  const schema = z.object({
    professional_documents: professionalDocumentsSchema.optional(),
  });

  export const setProfessionalDocumentsAction = authActionClient
    .inputSchema(schema)
    .action(async ({ parsedInput, ctx: { supabase, user } }) => {
      if (parsedInput.professional_documents) {
        const { error } = await supabase
          .from("users")
          .update({
            professional_documents: parsedInput.professional_documents,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        if (error) throw new Error("Erro ao salvar documentos profissionais");
      }

      redirect("/home");
    });
  ```
- **MIRROR**: `apps/web/src/actions/update-profile-action.ts:26-37` for the update shape; `apps/web/src/actions/set-professional-type-action.ts` (pre-Task-1) for the "action calls `redirect()`" convention.
- **IMPORTS**: `authActionClient` from `@/lib/safe-action`, `professionalDocumentsSchema` from `@/lib/validations/professional-documents`.
- **GOTCHA**: Skip ("Pular") and Save both call this same action — skip simply omits `professional_documents` from the payload, which short-circuits the `if` and goes straight to `redirect("/home")`. Do not create a second action for skip.
- **GOTCHA**: Use the RLS-scoped `supabase` client (not `supabaseAdmin`) — matches `update-profile-action.ts`'s existing pattern for this same column.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/screens/onboarding-screen.tsx`

- **ACTION**: Add the documents step to the professional onboarding branch.
- **IMPLEMENT**:
  1. Import `useRouter` from `next/navigation`, `setProfessionalDocumentsAction` from `@/actions/set-professional-documents-action`, `ProfessionalDocumentsFields` from `@/components/shared/professional-documents-fields`, `professionalDocumentsSchema` + `ProfessionalDocumentsInput` from `@/lib/validations/professional-documents`.
  2. Add state: `const [documentsStep, setDocumentsStep] = useState<ProfessionalType | null>(null);` and `const router = useRouter();`.
  3. Add a new form instance:
     ```typescript
     const documentsForm = useForm<{ professional_documents?: ProfessionalDocumentsInput }>({
       resolver: zodResolver(z.object({ professional_documents: professionalDocumentsSchema.optional() })),
       defaultValues: { professional_documents: undefined },
     });
     ```
  4. Change the `useAction(setProfessionalTypeAction)` call to add callbacks:
     ```typescript
     const { execute: executeProfessionalType, status: professionalTypeStatus } = useAction(
       setProfessionalTypeAction,
       {
         onSuccess: () => {
           if (pendingProfessionalType === "doula") {
             router.push("/home");
           } else if (pendingProfessionalType) {
             setDocumentsStep(pendingProfessionalType);
           }
         },
         onError: ({ error }) => {
           toast.error(error.serverError ?? "Erro ao selecionar especialidade.");
         },
       },
     );
     ```
     Since `execute()` doesn't expose the submitted input inside `onSuccess`, track the pending selection in a ref/state set right before calling execute: add `const [pendingProfessionalType, setPendingProfessionalType] = useState<ProfessionalType | null>(null);` and set it inside `handleProfessionalTypeSelect` before calling `executeProfessionalType`.
  5. Update `handleProfessionalTypeSelect`:
     ```typescript
     function handleProfessionalTypeSelect(type: ProfessionalType) {
       setPendingProfessionalType(type);
       executeProfessionalType({ type });
     }
     ```
  6. Add `useAction(setProfessionalDocumentsAction)` with normalization mirrored from `edit-profile-modal.tsx` (copy `normalizeDocumentEntry`/`normalizeProfessionalDocuments` verbatim into this file — no shared util exists yet, matches Phase 2's own precedent of not extracting one).
  7. Add a new render branch, inserted after the `selectedRole === "professional"` branch and gated on `documentsStep !== null`:
     ```tsx
     if (documentsStep) {
       return (
         <div className="flex h-full flex-col items-center justify-center px-4">
           <div className="mb-8 text-center">
             <h1 className="font-poppins font-semibold text-2xl tracking-tight">
               Documentos profissionais
             </h1>
             <p className="mt-2 text-muted-foreground text-sm">
               Opcional — você pode preencher isso depois no seu perfil
             </p>
           </div>

           <Form {...documentsForm}>
             <form
               onSubmit={documentsForm.handleSubmit((values) =>
                 executeDocuments({
                   professional_documents: normalizeProfessionalDocuments(values.professional_documents),
                 }),
               )}
               className="flex w-full max-w-sm flex-col gap-4"
             >
               <ProfessionalDocumentsFields control={documentsForm.control} professionalType={documentsStep} />

               <div className="mt-4 flex gap-3">
                 <Button
                   type="button"
                   variant="outline"
                   className="flex-1"
                   disabled={isDocumentsPending}
                   onClick={() => executeDocuments({ professional_documents: undefined })}
                 >
                   Pular
                 </Button>
                 <Button type="submit" className="flex-1" disabled={isDocumentsPending}>
                   {isDocumentsPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar e continuar"}
                 </Button>
               </div>
             </form>
           </Form>
         </div>
       );
     }
     ```
  8. Add `documentsStatus === "executing"` to a new `isDocumentsPending` boolean (do not fold into the shared `isPending` used by the professional-type-card branch — that branch is already unmounted once `documentsStep` is set).
- **MIRROR**: `apps/web/src/modals/edit-profile-modal.tsx:368` (`ProfessionalDocumentsFields` usage), `apps/web/src/screens/onboarding-screen.tsx:104-122` (second `useForm` in same component), `apps/web/src/screens/onboarding-screen.tsx:313-319` (secondary button style — reuse for "Pular", or use the `outline` `Button` variant as shown above, whichever renders more consistently with the surrounding `Button`/`Card` usage in this same branch).
- **IMPORTS**: `useRouter` from `next/navigation`; `setProfessionalDocumentsAction` from `@/actions/set-professional-documents-action`; `ProfessionalDocumentsFields` (default export) from `@/components/shared/professional-documents-fields`; `professionalDocumentsSchema`, `type ProfessionalDocumentsInput` from `@/lib/validations/professional-documents`.
- **GOTCHA**: `redirect()` inside `setProfessionalDocumentsAction` throws a Next.js redirect signal — do not wrap the `executeDocuments` calls in a way that swallows it (matches existing `useAction` usage elsewhere in this file, no special handling needed, `next-safe-action` + `next/navigation` already cooperate on this via the existing `setProfessionalTypeAction`/`joinEnterpriseAction` precedent).
- **GOTCHA**: `doula` must never reach `documentsStep` — verify `pendingProfessionalType === "doula"` check happens before the `else if`, not after.
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/screens/onboarding-screen.tsx apps/web/src/actions/set-professional-type-action.ts apps/web/src/actions/set-professional-documents-action.ts`

### Task 4: Type-check and lint the whole workspace

- **ACTION**: Confirm no regressions elsewhere.
- **VALIDATE**: `pnpm check-types`
- **EXPECT**: Exit 0, no errors.

### Task 5: Manual browser validation

- **ACTION**: Start dev server, walk through the flow for each professional type.
- **STEPS**:
  1. Sign up / reset a test user to `user_type = professional`, `professional_type = null`.
  2. Go to `/onboarding`, choose "Profissional" → "Obstetra". Confirm the documents step renders (CRM + RQE fields, "Pular" and "Salvar e continuar" buttons), fill CRM number + UF, add one RQE row, click "Salvar e continuar" → confirm redirect to `/home` and `professional_documents` persisted (check via Supabase or by opening `/profile` edit modal afterward).
  3. Repeat for "Fisioterapeuta" (CREFITO + RQE) and "Enfermeira" (COREN only, no RQE section) — confirm conditional rendering matches `professional_type`.
  4. Repeat once more but click "Pular" instead of saving — confirm redirect to `/home` and `professional_documents` remains `null`.
  5. Choose "Doula" — confirm it redirects straight to `/home` with **no** documents step shown.
  6. Confirm re-visiting `/onboarding` after completion still redirects to `/home` immediately (existing gate in `app/(dashboard)/onboarding/page.tsx`, unaffected by this change).

---

## Testing Strategy

### Unit Tests to Write

No test infrastructure exists for actions/screens in this repo (confirmed in Phase 2's report — matches this phase). No new unit tests required; rely on type-check + manual validation, consistent with project precedent.

### Edge Cases Checklist

- [ ] Doula selection never shows the documents step
- [ ] Skipping does not send an empty `{ crm: { number: "", uf: "" } }` payload (validated via `normalizeProfessionalDocuments` returning `undefined`)
- [ ] Saving with only an RQE row filled (no CRM) still validates (all fields in `professionalDocumentsSchema` are optional)
- [ ] Double-click / rapid resubmission on "Salvar e continuar" is guarded by `isDocumentsPending` disabling both buttons
- [ ] Network/server error while saving type (Task 1) surfaces a toast instead of silently failing (new `onError` callback)
- [ ] Network/server error while saving documents (Task 3) — note `setProfessionalDocumentsAction` always redirects even on missing/invalid documents object because zod validates before the action body runs; a genuine DB error still throws before `redirect()`, so add an `onError` toast for `executeDocuments` too, mirroring the pattern in Task 1

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/screens/onboarding-screen.tsx apps/web/src/actions/set-professional-type-action.ts apps/web/src/actions/set-professional-documents-action.ts
```

**EXPECT**: Exit 0, no errors or warnings

### Level 2: UNIT_TESTS

N/A — no test infra in this repo for actions/screens (confirmed precedent from Phase 2).

### Level 3: FULL_SUITE

```bash
pnpm check-types
```

**EXPECT**: 0 errors across all packages

### Level 4: DATABASE_VALIDATION

Not applicable — no schema changes in this phase (column already exists from Phase 1).

### Level 5: BROWSER_VALIDATION

See Task 5 above — exercise all 4 professional types (obstetra, fisio, enfermeiro, doula) through the onboarding flow, both saving and skipping.

### Level 6: MANUAL_VALIDATION

Covered by Task 5.

---

## Acceptance Criteria

- [ ] Obstetra/fisio/enfermeiro selections reveal an optional documents step before redirecting to `/home`
- [ ] Doula selection redirects straight to `/home`, unchanged from current behavior
- [ ] "Pular" redirects to `/home` without writing `professional_documents`
- [ ] "Salvar e continuar" persists normalized `professional_documents` and redirects to `/home`
- [ ] `pnpm check-types` passes with 0 errors
- [ ] Biome lint clean on all 3 touched/created files
- [ ] No regression to the manager/secretary onboarding branches (untouched by this change)

---

## Completion Checklist

- [ ] Task 1: `redirect()` removed from `setProfessionalTypeAction`
- [ ] Task 2: `setProfessionalDocumentsAction` created
- [ ] Task 3: `onboarding-screen.tsx` documents step wired, doula fast-path preserved
- [ ] Task 4: Level 1 static analysis passes
- [ ] Task 5: Manual browser validation for all 4 professional types (save + skip paths)
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ----------- |
| Removing `redirect()` from `setProfessionalTypeAction` silently breaks some other caller that relied on the redirect | LOW | MED | Grepped: `setProfessionalTypeAction` is only invoked from `onboarding-screen.tsx:180` — single call site, confirmed by codebase-explorer agent |
| `executeDocuments`'s `redirect()` throwing inside a `useAction` callback chain behaves unexpectedly (e.g., toast fires before redirect, or vice versa) | LOW | LOW | Matches exactly the existing `setProfessionalTypeAction`/`joinEnterpriseAction` convention already proven to work in this codebase — no new mechanism introduced |
| Two `useForm` instances plus existing `enterpriseForm` in one component increases file complexity/size (already 706 lines) | MED | LOW | Accepted — matches existing precedent of multiple forms per branch in this same file; a future refactor to split branches into sub-components is out of scope here |

---

## Notes

- This phase and Phase 4 (banner + deep link) can run in parallel per the PRD's Parallelism Notes — both depend only on Phase 2's shared schema/component/action, which is complete. Phase 4 touches `(dashboard)/layout.tsx` and `edit-profile-modal.tsx`/`profile-screen.tsx`; this phase only touches onboarding files, so there is no file overlap.
- No new library or schema is introduced — this is pure UI/action wiring reusing everything Phase 2 already built.
