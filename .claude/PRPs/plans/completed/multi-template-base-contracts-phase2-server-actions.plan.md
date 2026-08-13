# Feature: Multi-Template Base Contracts — Phase 2 (Server Actions: Save/List)

## Summary

Refactor the two base-contract save actions (`saveBaseContractAction`, `savePersonalContractAction`) from implicit "select-existing-by-owner-then-upsert" (which enforces one row per owner) to explicit create-vs-update via an optional `contractId` param, add a `name` field to identify templates, add list/by-id read functions that return arrays instead of `.maybeSingle()`, and add a new action for saving a template from within the patient-contract flow (always personal, never enterprise). No DB schema changes (Phase 1 already added `contracts.name`, complete). No new UI (dropdowns, grouped selectors) — that is Phase 3/4 scope. The two existing settings screens get a minimal, mechanical patch to their `save()` calls so the app keeps compiling and behaving exactly as today (single-template update-in-place) until Phase 3 wires the real picker UI.

## User Story

As a manager or autonomous professional
I want the save/list server actions to support multiple named base contract templates per owner
So that later UI phases (3, 4) can let me create, list, and update several templates without losing previous ones

## Problem Statement

`save-base-contract-action.ts` and `save-personal-contract-action.ts` do `select id (maybeSingle) → update if found, else insert`, scoped only by owner (`enterprise_id` or `user_id`). This makes it structurally impossible to have more than one base-contract row per owner, even though nothing in the DB schema or RLS enforces that — it's pure application logic. `get-patient-contract-action.ts` and `services/base-contract.ts` mirror this with `.maybeSingle()` reads. This phase removes the one-row assumption from the write/read logic while keeping the two currently-live settings screens working unchanged.

## Solution Statement

- Add `contractId` (optional) and `name` (optional on update, defaulted from `title` on create) to `saveBaseContractSchema`, shared by both save actions.
- Change both save actions: `contractId` present → `update` that exact row (ownership re-asserted via `.eq(...)` filters, defense-in-depth on top of RLS); `contractId` absent → always `insert` a new row (never look up an existing row by owner).
- Add a new `createBaseContractFromPatientAction` that always inserts with `user_id = user.id`, `enterprise_id = null` — the "save as new template from patient-contract.tsx" action Phase 4 will wire up.
- Add `getBaseContracts()`, `getPersonalBaseContracts()` (arrays, ordered by `created_at`) and `getBaseContractById(id)` to `services/base-contract.ts`, additive alongside the existing singular `getBaseContract()`/`getPersonalBaseContract()` (left untouched — still used by the two page.tsx files until Phase 3 replaces them).
- Add `enterpriseBaseOptions`/`personalBaseOptions` arrays to `getPatientContractAction`'s return value, computed from non-`.maybeSingle()` queries ordered by `created_at`. Keep the existing legacy scalar fields (`enterpriseBase`, `personalBase`, `baseContractHtml`, `baseTitle`) derived from the first array item, so `patient-contract.tsx` keeps working unchanged until Phase 4.
- Patch the two settings screens' `save()` call sites to pass `contractId: initialContract?.id` and `name: initialContract?.name ?? title` — a mechanical compile/behavior-preserving fix, not the Phase 3 UI work.

## Metadata

| Field | Value |
|---|---|
| Type | ENHANCEMENT |
| Complexity | LOW |
| Systems Affected | apps/web server actions, apps/web services, apps/web validations, 2 client screens (mechanical patch only) |
| Dependencies | next-safe-action ^8.1.4, zod ~3.24.1, @supabase/supabase-js ^2.47.0 (all already in use, no version changes) |
| Estimated Tasks | 9 |

---

## UX Design

This phase ships no new UI. The two existing settings screens continue to render and behave identically (single template, update-in-place, no template picker). The only observable-if-tested difference is at the data layer: it is now *possible* to create additional rows by calling the actions with `contractId` omitted — but nothing in the current UI does that yet.

### Before State
```
╔═══════════════════════════════════════════════════════════════════╗
║  /settings/contract (Server Component)                              ║
║    getBaseContract() -- .maybeSingle(), assumes 0-or-1 row          ║
║        │                                                             ║
║        ▼                                                             ║
║  ContractSettingsScreen (initialContract: Tables<"contracts"> | null)║
║    save({ title, clauses_html, city, state })  -- no id, no name    ║
║        │                                                             ║
║        ▼                                                             ║
║  saveBaseContractAction                                              ║
║    select id by owner scope (maybeSingle) → update or insert        ║
║    -- can NEVER produce more than 1 row per owner                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════╗
║  /settings/contract (unchanged in this phase)                        ║
║    getBaseContract() -- still singular, still works                 ║
║        │                                                             ║
║        ▼                                                             ║
║  ContractSettingsScreen (unchanged UI)                               ║
║    save({ title, clauses_html, city, state,                         ║
║           contractId: initialContract?.id,       ◄── new, mechanical║
║           name: initialContract?.name ?? title }) ◄── new, mechanical║
║        │                                                             ║
║        ▼                                                             ║
║  saveBaseContractAction                                              ║
║    if contractId → update that row (id + ownership filters)         ║
║    else → always insert a new row                                   ║
║                                                                       ║
║  NEW: getBaseContracts() / getPersonalBaseContracts() / by-id        ║
║  NEW: createBaseContractFromPatientAction (unused until Phase 4)     ║
║  NEW: getPatientContractAction returns enterpriseBaseOptions[] /     ║
║        personalBaseOptions[] alongside legacy singular fields        ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|---|---|---|---|
| `/settings/contract`, `/profile/settings/contract` | Save always updates the single existing row | Save updates the same row (id now passed explicitly) — behaviorally identical | None (invisible) |
| `patient-contract.tsx` | Reads `enterpriseBase`/`personalBase`/legacy fields | Same fields still present and correct; new `*Options` arrays available but unused | None (invisible) |
| Nowhere yet | — | `createBaseContractFromPatientAction` exists but has no caller | None (invisible; wired in Phase 4) |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|---|---|---|---|
| P0 | `apps/web/src/actions/save-base-contract-action.ts` | 1-64 | Full current logic to replace |
| P0 | `apps/web/src/actions/save-personal-contract-action.ts` | 1-44 | Full current logic to replace |
| P0 | `apps/web/src/lib/validations/contract.ts` | 1-36 | Schema to extend; mirror `DEFAULT_TITLE` pattern |
| P0 | `apps/web/src/actions/get-patient-contract-action.ts` | 1-175 | Full current logic; only additive changes allowed |
| P0 | `apps/web/src/services/base-contract.ts` | 1-153 | Existing singular functions to leave untouched; pattern for new plural ones |
| P1 | `apps/web/src/actions/deactivate-patient-contract-action.ts` | 1-21 | Reference pattern for `contractId`-scoped mutation + inline `z.object` (do NOT use inline schema here — this repo mostly centralizes schemas in `validations/contract.ts`, follow that instead) |
| P1 | `apps/web/src/lib/safe-action.ts` | 1-37 | `authActionClient` ctx shape: `{ supabase, supabaseAdmin, user, profile }` |
| P1 | `apps/web/src/screens/contract-settings-screen.tsx` | 37-77 | Exact `save()` call site to patch |
| P1 | `apps/web/src/screens/personal-contract-settings-screen.tsx` | 39-63 | Exact `save()` call site to patch |
| P2 | `packages/supabase/supabase/migrations/20260627000001_contracts.sql` | 34-121 | RLS policies — confirm ownership is enforced at the RLS layer for UPDATE/INSERT/DELETE, so app-level `.eq()` filters are defense-in-depth, not the sole guard |
| P2 | `packages/supabase/supabase/migrations/20260714000001_contracts_add_name.sql` | 1-4 | Confirms `name text NULL` already exists (Phase 1, complete) |

No external documentation needed — this phase uses only patterns already established in the codebase (next-safe-action `authActionClient`, Zod schemas, Supabase query builder). No new libraries, no version changes.

---

## Patterns to Mirror

**ACTION_STRUCTURE:**
```typescript
// SOURCE: apps/web/src/actions/save-base-contract-action.ts:1-9
"use server";

import { authActionClient } from "@/lib/safe-action";
import { saveBaseContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const saveBaseContractAction = authActionClient
  .inputSchema(saveBaseContractSchema)
  .action(async ({ parsedInput: { ... }, ctx: { supabase, profile, user } }) => {
```

**CONTRACTID_SCOPED_UPDATE (target shape, from a different action):**
```typescript
// SOURCE: apps/web/src/actions/deactivate-patient-contract-action.ts:7-20
export const deactivatePatientContractAction = authActionClient
  .inputSchema(z.object({ contractId: z.string().uuid(), patientId: z.string().uuid() }))
  .action(async ({ parsedInput: { contractId, patientId }, ctx: { supabase } }) => {
    const { error } = await supabase
      .from("contracts")
      .update({ is_active: false })
      .eq("id", contractId)
      .eq("is_base_contract", false);
    if (error) throw new Error(error.message);
    revalidatePath(`/patients/${patientId}/profile`);
    return { success: true };
  });
```

**ZOD_SCHEMA_WITH_DEFAULT:**
```typescript
// SOURCE: apps/web/src/lib/validations/contract.ts:1-10
const DEFAULT_TITLE = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS";

export const saveBaseContractSchema = z.object({
  title: z.string().min(1, "O título não pode estar vazio").default(DEFAULT_TITLE),
  clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
  city: z.string().optional(),
  state: z.string().optional(),
});
```

**SERVICE_SINGLE_ROW_QUERY (to mirror for the new plural versions):**
```typescript
// SOURCE: apps/web/src/services/base-contract.ts:27-49
export async function getBaseContract(): Promise<Tables<"contracts"> | null> {
  const { profile, user } = await getServerAuth();
  if (!user) return null;

  const supabaseAdmin = await createServerSupabaseAdmin();

  let query = supabaseAdmin.from("contracts").select("*").eq("is_base_contract", true);

  if (profile?.enterprise_id) {
    query = query.eq("enterprise_id", profile.enterprise_id);
  } else {
    query = query.eq("user_id", user.id).is("enterprise_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[getBaseContract]", error.message);
    return null;
  }

  return data;
}
```

**AUTHACTIONCLIENT_CTX:**
```typescript
// SOURCE: apps/web/src/lib/safe-action.ts:9-37
export const authActionClient = actionClient.use(async ({ next }) => {
  // ... resolves supabase (RLS-respecting), user, profile (with enterprise_id), supabaseAdmin
  return next({ ctx: { supabase, supabaseAdmin, user, profile } });
});
```

**SCREEN_SAVE_CALL (patch target):**
```typescript
// SOURCE: apps/web/src/screens/contract-settings-screen.tsx:62-69
<Button
  className="gradient-primary hidden sm:flex"
  disabled={isExecuting}
  onClick={() => save({ title, clauses_html: clausesHtml, city, state })}
>
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `apps/web/src/lib/validations/contract.ts` | UPDATE | Add `contractId`/`name` to `saveBaseContractSchema`; add `createBaseContractFromPatientSchema` |
| `apps/web/src/actions/save-base-contract-action.ts` | UPDATE | Replace select-then-upsert with explicit create/update-by-id |
| `apps/web/src/actions/save-personal-contract-action.ts` | UPDATE | Same, personal scope |
| `apps/web/src/actions/create-base-contract-from-patient-action.ts` | CREATE | New "save as new personal template" action for Phase 4 to call |
| `apps/web/src/services/base-contract.ts` | UPDATE | Add `getBaseContracts`, `getPersonalBaseContracts`, `getBaseContractById`; leave existing singular functions untouched |
| `apps/web/src/actions/get-patient-contract-action.ts` | UPDATE | Add `enterpriseBaseOptions`/`personalBaseOptions` arrays; keep legacy fields derived from first item |
| `apps/web/src/screens/contract-settings-screen.tsx` | UPDATE | Mechanical patch: pass `contractId`/`name` in `save()` call |
| `apps/web/src/screens/personal-contract-settings-screen.tsx` | UPDATE | Mechanical patch: pass `contractId`/`name` in `save()` call |

---

## NOT Building (Scope Limits)

- No dropdown/picker UI, no "novo contrato"/"Editar"/"Criar novo" buttons — Phase 3.
- No grouped selector or "salvar como novo contrato base" modal in `patient-contract.tsx` — Phase 4.
- No removal of `no-base`/`choose-base`/`no-contract` states in `patient-contract.tsx` — Phase 4.
- No removal of the legacy singular `getBaseContract`/`getPersonalBaseContract` functions or the legacy `enterpriseBase`/`personalBase`/`baseContractHtml`/`baseTitle` fields — kept for backward compatibility until Phases 3/4 migrate their consumers.
- No template deletion/archiving, no usage indicators, no rename-without-duplicate — out of v1 scope per PRD.
- No wiring of `createBaseContractFromPatientAction` into any UI — it is created and independently testable this phase, called starting Phase 4.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: UPDATE `apps/web/src/lib/validations/contract.ts`

- **ACTION**: Extend `saveBaseContractSchema`; add `createBaseContractFromPatientSchema`
- **IMPLEMENT**:
  ```typescript
  export const saveBaseContractSchema = z.object({
    contractId: z.string().uuid().optional(),
    name: z.string().min(1, "O nome não pode estar vazio").optional(),
    title: z.string().min(1, "O título não pode estar vazio").default(DEFAULT_TITLE),
    clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
    city: z.string().optional(),
    state: z.string().optional(),
  });

  export const createBaseContractFromPatientSchema = z.object({
    patientId: z.string().uuid(),
    name: z.string().min(1, "O nome do contrato não pode estar vazio"),
    title: z.string().min(1, "O título não pode estar vazio").default(DEFAULT_TITLE),
    clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
    city: z.string().optional(),
    state: z.string().optional(),
  });
  export type CreateBaseContractFromPatientInput = z.infer<typeof createBaseContractFromPatientSchema>;
  ```
- **MIRROR**: `apps/web/src/lib/validations/contract.ts:5-12` (existing `saveBaseContractSchema` + type export pattern)
- **GOTCHA**: `name` is `.optional()` on `saveBaseContractSchema` (update path may not change the name; create path defaults to `title` server-side in the action, not in the schema) — `createBaseContractFromPatientSchema.name` is required (no default), per PRD "name obrigatório ao criar novo" for the patient-contract flow specifically.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/actions/save-base-contract-action.ts`

- **ACTION**: Replace select-then-upsert with explicit `contractId` branch
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { authActionClient } from "@/lib/safe-action";
  import { saveBaseContractSchema } from "@/lib/validations/contract";
  import { revalidatePath } from "next/cache";

  export const saveBaseContractAction = authActionClient
    .inputSchema(saveBaseContractSchema)
    .action(
      async ({
        parsedInput: { contractId, name, title, clauses_html, city, state },
        ctx: { supabase, profile, user },
      }) => {
        if (profile.user_type !== "manager") {
          throw new Error("Apenas gestores podem configurar o contrato base.");
        }

        if (contractId) {
          const { error } = await supabase
            .from("contracts")
            .update({
              title,
              clauses_html,
              city: city ?? null,
              state: state ?? null,
              ...(name !== undefined ? { name } : {}),
            })
            .eq("id", contractId)
            .eq("is_base_contract", true);

          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("contracts").insert({
            is_base_contract: true,
            title,
            clauses_html,
            city: city ?? null,
            state: state ?? null,
            name: name ?? title,
            enterprise_id: profile.enterprise_id ?? null,
            user_id: profile.enterprise_id ? null : user.id,
          });

          if (error) throw new Error(error.message);
        }

        revalidatePath("/settings/contract");
        return { success: true };
      },
    );
  ```
- **MIRROR**: existing file structure (`apps/web/src/actions/save-base-contract-action.ts:1-9`); `.eq("is_base_contract", true)` defensive filter pattern from `deactivate-patient-contract-action.ts:13-14`
- **IMPORTS**: unchanged (`authActionClient`, `saveBaseContractSchema`, `revalidatePath`)
- **GOTCHA**: Do NOT re-add the `enterprise_id`/`user_id` `.eq()` filter on the update branch beyond `.eq("id", contractId).eq("is_base_contract", true)` — RLS (`packages/supabase/supabase/migrations/20260627000001_contracts.sql:75-100`, "Update contracts" policy) already scopes UPDATE to rows the current user owns (`user_id = auth.uid()` or `enterprise_id IN (their enterprise)`), so an extra owner filter would be redundant, not a safety gap. The manager-only gate stays purely application-level (line 14-16), matching current behavior — RLS permits `manager` or `secretary` to update enterprise rows, but this action intentionally restricts to `manager` only, same as today.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/actions/save-personal-contract-action.ts`

- **ACTION**: Replace select-then-upsert with explicit `contractId` branch (personal scope, no manager gate)
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { authActionClient } from "@/lib/safe-action";
  import { saveBaseContractSchema } from "@/lib/validations/contract";
  import { revalidatePath } from "next/cache";

  export const savePersonalContractAction = authActionClient
    .inputSchema(saveBaseContractSchema)
    .action(
      async ({
        parsedInput: { contractId, name, title, clauses_html, city, state },
        ctx: { supabase, user },
      }) => {
        if (contractId) {
          const { error } = await supabase
            .from("contracts")
            .update({
              title,
              clauses_html,
              city: city ?? null,
              state: state ?? null,
              ...(name !== undefined ? { name } : {}),
            })
            .eq("id", contractId)
            .eq("is_base_contract", true)
            .eq("user_id", user.id)
            .is("enterprise_id", null);

          if (error) throw new Error(error.message);
        } else {
          const { error } = await supabase.from("contracts").insert({
            is_base_contract: true,
            title,
            clauses_html,
            city: city ?? null,
            state: state ?? null,
            name: name ?? title,
            user_id: user.id,
            enterprise_id: null,
          });

          if (error) throw new Error(error.message);
        }

        revalidatePath("/profile/settings/contract");
        return { success: true };
      },
    );
  ```
- **MIRROR**: Task 2's shape; existing file `apps/web/src/actions/save-personal-contract-action.ts:1-9`
- **GOTCHA**: Keep the explicit `.eq("user_id", user.id).is("enterprise_id", null)` filters on the update here (unlike Task 2) since this action has no `profile.enterprise_id` branch to reason about — it's always personal-scoped, so the extra filters cost nothing and match the existing personal-scope query shape used elsewhere in this file.
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/actions/create-base-contract-from-patient-action.ts`

- **ACTION**: New action — always inserts a personal base template, never enterprise
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { authActionClient } from "@/lib/safe-action";
  import { createBaseContractFromPatientSchema } from "@/lib/validations/contract";
  import { revalidatePath } from "next/cache";

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
- **MIRROR**: `apps/web/src/actions/deactivate-patient-contract-action.ts:1-20` (patientId-scoped revalidatePath pattern); insert shape from Task 3's else-branch
- **GOTCHA**: Always `user_id: user.id, enterprise_id: null` — per PRD explicit requirement, this action must NEVER write `enterprise_id`, even for enterprise-affiliated professionals using a company template as a starting point. No manager gate — any authenticated professional can save their own personal template.
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/services/base-contract.ts`

- **ACTION**: Add three new exported functions; leave `getBaseContract`/`getPersonalBaseContract`/`getContractHeaderData`/`getPersonalContractHeaderData` untouched
- **IMPLEMENT**: Insert after the existing `getPersonalBaseContract`/`getBaseContract` functions (before the `TeamMember` type at line 51):
  ```typescript
  export async function getPersonalBaseContracts(): Promise<Tables<"contracts">[]> {
    const { user } = await getServerAuth();
    if (!user) return [];

    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("is_base_contract", true)
      .eq("user_id", user.id)
      .is("enterprise_id", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[getPersonalBaseContracts]", error.message);
      return [];
    }

    return data ?? [];
  }

  export async function getBaseContracts(): Promise<Tables<"contracts">[]> {
    const { profile, user } = await getServerAuth();
    if (!user) return [];

    const supabaseAdmin = await createServerSupabaseAdmin();

    let query = supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("is_base_contract", true)
      .order("created_at", { ascending: true });

    if (profile?.enterprise_id) {
      query = query.eq("enterprise_id", profile.enterprise_id);
    } else {
      query = query.eq("user_id", user.id).is("enterprise_id", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[getBaseContracts]", error.message);
      return [];
    }

    return data ?? [];
  }

  export async function getBaseContractById(id: string): Promise<Tables<"contracts"> | null> {
    const supabaseAdmin = await createServerSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("contracts")
      .select("*")
      .eq("id", id)
      .eq("is_base_contract", true)
      .maybeSingle();

    if (error) {
      console.error("[getBaseContractById]", error.message);
      return null;
    }

    return data;
  }
  ```
- **MIRROR**: `apps/web/src/services/base-contract.ts:5-49` (existing singular functions — same `getServerAuth()` + `createServerSupabaseAdmin()` + `console.error` prefix pattern)
- **IMPORTS**: none new — `getServerAuth`, `createServerSupabaseAdmin`, `Tables` already imported at the top of the file
- **GOTCHA**: `getBaseContractById` intentionally does NOT re-check `enterprise_id`/`user_id` ownership — it relies on the RLS SELECT policy (`packages/supabase/supabase/migrations/20260627000001_contracts.sql:37-53`) via `supabaseAdmin`... **wait**: `supabaseAdmin` uses the service-role key and BYPASSES RLS (per `CLAUDE.md`: "service_role key, bypasses RLS"). Since this function takes a bare `id` with no caller-supplied ownership scope, any authenticated caller could fetch ANY base contract by guessing/enumerating a UUID. Only call `getBaseContractById` from a context that has already validated the id came from that owner's own `getBaseContracts()`/`getPersonalBaseContracts()` list (e.g., populating a "currently selected template" dropdown in Phase 3, where the id was one of the options rendered to that same user) — never expose it to arbitrary user-supplied ids from an untrusted input. Do not add ownership params in this phase (PRD doesn't request it and Phase 3/4 controls how it's called) but leave this exact caveat as a comment above the function:
  ```typescript
  // Uses supabaseAdmin (bypasses RLS) — only call with an id sourced from
  // getBaseContracts()/getPersonalBaseContracts() for the same owner, never
  // from unvalidated user input.
  export async function getBaseContractById(id: string): Promise<Tables<"contracts"> | null> {
  ```
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/actions/get-patient-contract-action.ts`

- **ACTION**: Add `enterpriseBaseOptions`/`personalBaseOptions` arrays; derive legacy scalar fields from the first array item instead of separate `.maybeSingle()` queries
- **IMPLEMENT**: Replace lines 47-75 (the personal/enterprise base fetch + legacy field derivation) with:
  ```typescript
  type BaseContractOption = {
    id: string;
    html: string;
    title: string;
    name: string | null;
    city: string | null;
    state: string | null;
  };

  // Fetch personal base contracts (always by user_id, enterprise_id = null)
  const { data: personalBaseRows } = await supabase
    .from("contracts")
    .select("id, clauses_html, title, name, city, state")
    .eq("is_base_contract", true)
    .eq("user_id", user.id)
    .is("enterprise_id", null)
    .order("created_at", { ascending: true });

  const personalBaseOptions: BaseContractOption[] = (personalBaseRows ?? []).map((row) => ({
    id: row.id,
    html: row.clauses_html,
    title: row.title,
    name: row.name,
    city: row.city,
    state: row.state,
  }));

  // Fetch enterprise base contracts when applicable
  let enterpriseBaseOptions: BaseContractOption[] = [];
  if (profile.enterprise_id) {
    const { data: enterpriseBaseRows } = await supabase
      .from("contracts")
      .select("id, clauses_html, title, name, city, state")
      .eq("is_base_contract", true)
      .eq("enterprise_id", profile.enterprise_id)
      .order("created_at", { ascending: true });

    enterpriseBaseOptions = (enterpriseBaseRows ?? []).map((row) => ({
      id: row.id,
      html: row.clauses_html,
      title: row.title,
      name: row.name,
      city: row.city,
      state: row.state,
    }));
  }

  // Legacy singular fields — first template in creation order, prefer enterprise.
  // Kept for patient-contract.tsx (Phase 4 migrates it to the *Options arrays).
  const enterpriseBase = enterpriseBaseOptions[0] ?? null;
  const personalBase = personalBaseOptions[0] ?? null;
  const baseContractHtml = enterpriseBase?.html ?? personalBase?.html ?? null;
  const baseTitle = enterpriseBase?.title ?? personalBase?.title ?? null;
  ```
  Then in the final return object (lines 146-172), keep `enterpriseBase`/`personalBase` exactly as before (now sourced from the variables above, same `{ html, title, city, state }` shape — drop the `id`/`name` keys from what's spread into the legacy fields so their shape is unchanged) and add the two new arrays:
  ```typescript
  return {
    contract,
    signedByName,
    savedParties,
    baseContractHtml,
    baseTitle,
    headerBlocks,
    personalHeaderBlocks,
    patientName: patient?.name ?? null,
    contratadaName,
    enterpriseBase: enterpriseBase
      ? { html: enterpriseBase.html, title: enterpriseBase.title, city: enterpriseBase.city, state: enterpriseBase.state }
      : null,
    personalBase: personalBase
      ? { html: personalBase.html, title: personalBase.title, city: personalBase.city, state: personalBase.state }
      : null,
    enterpriseBaseOptions,
    personalBaseOptions,
  };
  ```
- **MIRROR**: existing query/return shape in the same file, lines 47-75 and 146-172
- **GOTCHA**: This changes 2 queries with `.maybeSingle()` into 2 queries without it (returning arrays) — the row shape selected (`id, clauses_html, title, name, city, state`) grows by `id` and `name` compared to today's `clauses_html, title, city, state`; both are needed for Phase 3/4's dropdown labels (`name ?? title` fallback) and update-in-place (`id`). No other code in this file reads `enterpriseBase`/`personalBase` besides the final return, so the type narrowing above is safe.
- **VALIDATE**: `pnpm check-types`

### Task 7: UPDATE `apps/web/src/screens/contract-settings-screen.tsx`

- **ACTION**: Mechanical patch — pass `contractId`/`name` through both `save()` call sites so behavior is unchanged (still updates the single existing row) and the file compiles against the new schema
- **IMPLEMENT**: Replace both occurrences of `onClick={() => save({ title, clauses_html: clausesHtml, city, state })}` (lines 65 and 74) with:
  ```typescript
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
  ```
- **MIRROR**: existing call sites at `apps/web/src/screens/contract-settings-screen.tsx:65,74`
- **GOTCHA**: This is intentionally NOT the Phase 3 UI redesign (no dropdown, no "Criar novo" button) — it's the minimum change needed so this screen keeps compiling and behaving exactly as today. `initialContract?.id` being `undefined` when there's no existing row correctly triggers the insert branch in the action, matching today's "insert if none exists" behavior.
- **VALIDATE**: `pnpm check-types`

### Task 8: UPDATE `apps/web/src/screens/personal-contract-settings-screen.tsx`

- **ACTION**: Same mechanical patch as Task 7, personal scope
- **IMPLEMENT**: Replace `onClick={() => save({ title, clauses_html: clausesHtml, city, state })}` (line 59) with:
  ```typescript
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
  ```
- **MIRROR**: `apps/web/src/screens/personal-contract-settings-screen.tsx:59`
- **VALIDATE**: `pnpm check-types`

### Task 9: Full validation pass

- **ACTION**: Run project-wide checks and manual smoke test
- **VALIDATE**: `pnpm check-types` (all packages, exit 0); manually exercise `/settings/contract` and `/profile/settings/contract` in the browser — save should behave identically to before (single template, update-in-place); confirm no console/toast errors.

---

## Testing Strategy

No existing test suite covers contract actions/services (confirmed via repo-wide search — no `*.test.ts`/`*.spec.ts` referencing `contract`). This phase does not introduce one, consistent with the codebase's current state; correctness is validated via `pnpm check-types` and manual exercising of the two settings screens (Task 9) plus ad hoc verification that repeated saves without `contractId` (e.g., via direct action invocation in a scratch script, or once Phase 3/4 UI exists) produce multiple rows rather than overwriting.

### Edge Cases Checklist

- [ ] Save with `contractId` pointing to a row belonging to a *different* owner → RLS blocks the update (0 rows affected), Supabase returns no error but no-op; acceptable per existing RLS-reliance pattern in this codebase (not introduced by this phase).
- [ ] Save with no `contractId` and no existing rows → inserts first row (unchanged from today).
- [ ] Save with no `contractId` and rows already exist → inserts an *additional* row (new behavior — by design, exercised by Phase 3/4, not by the patched settings screens which always pass `contractId` when `initialContract` exists).
- [ ] `name` omitted on create → defaults to `title` server-side.
- [ ] `getBaseContractById` called with an id not owned by the current caller → returns the row anyway (service-role bypasses RLS) — documented caveat, not to be called with untrusted ids in this phase.
- [ ] Legacy `name: null` rows (pre-Phase-1 data) → `name` field is `null` in `*Options` arrays; label fallback (`name ?? title`) is a Phase 3/4 UI concern, not this phase's.

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, no errors across all packages

### Level 2: UNIT_TESTS

N/A — no test suite exists for contract code; not introduced this phase (matches Phase 1's precedent).

### Level 3: FULL_SUITE

```bash
pnpm check-types && npx biome lint --write --unsafe apps/web/src/actions/save-base-contract-action.ts apps/web/src/actions/save-personal-contract-action.ts apps/web/src/actions/create-base-contract-from-patient-action.ts apps/web/src/actions/get-patient-contract-action.ts apps/web/src/services/base-contract.ts apps/web/src/lib/validations/contract.ts apps/web/src/screens/contract-settings-screen.tsx apps/web/src/screens/personal-contract-settings-screen.tsx
```

**EXPECT**: Exit 0, no lint errors, formatting normalized

### Level 4: DATABASE_VALIDATION

Not applicable — no schema changes in this phase (Phase 1 already shipped and verified `name text` column).

### Level 5: BROWSER_VALIDATION

- [ ] `/settings/contract` (as a manager): load page, edit title/clauses, click "Salvar contrato base" → toast success, `router.refresh()`, content persists on reload. Confirm no duplicate row created (re-save updates, doesn't insert) — spot-check via Supabase table editor or `mcp__supabase__execute_sql` if available.
- [ ] `/profile/settings/contract` (as an autonomous professional): same check.
- [ ] Open a patient's contract tab (`patient-contract.tsx`) and confirm it still loads/shows the base contract as before — no regression from the `get-patient-contract-action.ts` changes.

### Level 6: MANUAL_VALIDATION

1. As a manager with an existing enterprise base contract, edit and save twice — confirm via DB that the row count for that `enterprise_id` stays at 1 (not 2).
2. As an autonomous professional with no existing personal base contract, save once — confirm exactly 1 row is inserted with `name` equal to the entered `title`.
3. Directly invoke `createBaseContractFromPatientAction` (e.g., via a temporary test call or `next-safe-action` devtools if available) with a `name`, confirm it inserts with `user_id` set and `enterprise_id` null, regardless of the caller's enterprise membership.

---

## Acceptance Criteria

- [ ] `saveBaseContractAction`/`savePersonalContractAction` support explicit create (no `contractId`) and update-in-place (`contractId` present)
- [ ] Both actions accept and persist `name` on create/update
- [ ] `createBaseContractFromPatientAction` exists, always writes `user_id`/`enterprise_id: null`
- [ ] `getBaseContracts()`, `getPersonalBaseContracts()`, `getBaseContractById()` exist and return correct shapes
- [ ] `getPatientContractAction` returns `enterpriseBaseOptions`/`personalBaseOptions` arrays alongside unchanged legacy fields
- [ ] `pnpm check-types` passes with exit 0
- [ ] Existing settings screens behave identically to pre-phase (manual browser check)
- [ ] No regressions in `patient-contract.tsx`'s existing base-contract loading behavior

---

## Completion Checklist

- [ ] All 9 tasks completed in order
- [ ] Each task validated immediately (`pnpm check-types`)
- [ ] Level 1: Static analysis passes
- [ ] Level 3: Lint passes on all touched files
- [ ] Level 5: Browser validation of both settings screens + patient-contract tab
- [ ] Level 6: Manual DB row-count checks
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Removing the select-by-owner lookup means any *future* UI that calls save actions without `contractId` will insert instead of update | High (by design) | Medium | Documented explicitly in Task 7/8 GOTCHAs and NOT_BUILDING; the two live screens are patched in this phase to always pass `contractId` when a row exists, so current behavior is unaffected. Phase 3/4 own the intentional multi-insert UX. |
| `getBaseContractById` uses `supabaseAdmin` (bypasses RLS) with a bare `id` param — could be misused later to fetch another owner's template | Low (no caller yet) | Medium | Inline code comment added (Task 5); no caller wired in this phase; Phase 3 implementer must source ids only from that owner's own list query. |
| Legacy singular fields (`enterpriseBase`/`personalBase`) in `get-patient-contract-action.ts` become ambiguous once multiple templates exist (picks first by `created_at`) | Medium (post Phase 4 launch) | Low | Acceptable — legacy fields are transitional scaffolding removed when Phase 4 migrates `patient-contract.tsx` to the `*Options` arrays; documented in code comment. |
| RLS UPDATE policy permits `manager` OR `secretary` for enterprise rows, but this action's app-level gate only allows `manager` | None (pre-existing, unchanged) | N/A | Not introduced by this phase — identical gate as today (`profile.user_type !== "manager"` check retained verbatim). |

---

## Notes

- Phase 3 (Settings pages UI) and Phase 4 (Patient-contract UI) both depend only on this phase and can run in parallel per the PRD's parallelism note.
- The `.eq("is_base_contract", true)` defensive filter on updates (beyond `.eq("id", contractId)`) is cheap insurance against ever accidentally flipping a patient contract's fields via a mistyped id — mirrors the existing `deactivate-patient-contract-action.ts` convention of filtering by `is_base_contract` alongside `id`.
- No `unique` constraint was added to the DB in Phase 1 and none is planned — multiplicity is enforced (or rather, no longer enforced) purely at the application layer, consistent with the PRD's stated technical approach.

---

*Generated: 2026-07-14*
