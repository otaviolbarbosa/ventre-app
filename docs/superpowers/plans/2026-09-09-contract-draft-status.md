# Contract Draft Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a professional persist a contract draft (title/city/state/clauses) before the gestante/team header data is complete, visible to the gestante (who can request changes) but not signable or finalizable until the professional generates the contract normally.

**Architecture:** Replace `contracts.is_active` (nullable tri-state boolean) with `contracts.status text` (`'draft' | 'active' | 'revoked'`, `NULL` only for base-contract templates). A new `save-contract-draft-action` upserts a `status='draft'` row without requiring complete party data or generating a PDF. The existing "Gerar contrato" action (`sign-patient-contract-action.ts`) now finds and finalizes an existing draft (transitioning it to `status='active'`) instead of always creating a fresh row. Every query/action that today filters `is_active=true` is updated to filter by `status`, and the two patient-facing components (`ContractDetail`, `ContractList`) gain a draft-specific render path (raw clauses HTML, no PDF, no sign button, change-request still available).

**Tech Stack:** Next.js 15 (App Router), Supabase (Postgres + RLS), `next-safe-action`, Zod, React 19, Vitest.

**Spec:** [docs/superpowers/specs/2026-09-09-contract-draft-status-design.md](../specs/2026-09-09-contract-draft-status-design.md)

## Global Constraints

- No backwards-compatibility shims: `is_active` is removed outright, not kept alongside `status`.
- No autosave — draft saving is a manual, explicit action only.
- Drafts never generate a PDF and never snapshot `parties_details` — only "Gerar contrato" does that.
- Reediting an already-generated (`active`) contract after revoking signatures stays `status='active'` — it must never drop back to `draft`.
- No new `canceled` status — "excluir"/"revogar" both write `status='revoked'`, distinguished by `revoked_at` exactly as `is_active=false` was today.
- All new/changed server code must ship with tests per this repo's convention (`apps/web`, Vitest, mocks for `@ventre/supabase/server`).
- Run `npx biome check --write <file>` and `cd apps/web && npx tsc --noEmit -p .` after each task before committing.

---

## Task 1: Database migration — `status` column

**Files:**
- Create: `packages/supabase/supabase/migrations/20260909000000_contracts_add_status.sql`
- Modify (regenerated, not hand-edited): `packages/supabase/src/types/database.types.ts`

**Interfaces:**
- Produces: `contracts.status: 'draft' | 'active' | 'revoked' | null` (Postgres `text`, checked by constraint; nullable only when `is_base_contract = true`). Every later task assumes this column exists and `is_active` no longer does.

> **This task changes the shared Supabase project's schema.** Applying it (`pnpm db:push`) is not something to run unattended — confirm with the user before pushing, the same way you would confirm any other change to shared infrastructure. Everything after this task (type regeneration, and every action/UI change) depends on the migration having actually been applied to the database the app points at.

- [ ] **Step 1: Write the migration file**

```sql
-- 1. New column
ALTER TABLE public.contracts ADD COLUMN status text;

-- 2. Backfill from the current is_active tri-state
UPDATE public.contracts
SET status = CASE
  WHEN is_base_contract THEN NULL
  WHEN is_active = true THEN 'active'
  WHEN is_active = false THEN 'revoked'
END;

-- 3. Status is only meaningful for patient contracts, and only these 3 values
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_status_check
  CHECK (
    (is_base_contract = true AND status IS NULL)
    OR (is_base_contract = false AND status IN ('draft', 'active', 'revoked'))
  );

-- 4. At most one live (draft or active) contract per patient
CREATE UNIQUE INDEX one_live_contract_per_patient
  ON public.contracts (patient_id)
  WHERE is_base_contract = false AND status IN ('draft', 'active');

COMMENT ON COLUMN public.contracts.status IS
  'Lifecycle of a patient contract: draft (professional still writing, no PDF, visible to patient for comments only), active (generated, may or may not be signed yet), revoked (soft-deleted or formally revoked — see revoked_at to tell the two apart). NULL only for base-contract templates (is_base_contract = true).';

-- 5. Drop the column it replaces
ALTER TABLE public.contracts DROP COLUMN is_active;
```

- [ ] **Step 2: Ask the user to confirm applying the migration, then apply it**

Tell the user: "This migration changes the shared `contracts` table (drops `is_active`, adds `status`) on the Supabase project this app points at. Ready for me to run `pnpm db:push`?" Only run the command below after they confirm:

```bash
pnpm db:push
```

- [ ] **Step 3: Regenerate TypeScript types**

```bash
pnpm db:types
```

Confirm the diff in `packages/supabase/src/types/database.types.ts` shows `contracts.is_active` removed and `contracts.status: string | null` added. Do not hand-edit this file.

- [ ] **Step 4: Type-check the whole repo to see the fallout**

```bash
cd apps/web && npx tsc --noEmit -p .
```

Expected: a list of type errors in every file that still references `contracts.is_active` (the files covered by Tasks 3–6 below). This is expected at this point — it's the map for the remaining tasks. Do not fix them in this task.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260909000000_contracts_add_status.sql packages/supabase/src/types/database.types.ts
git commit -m "$(cat <<'EOF'
feat(db): replace contracts.is_active with a draft/active/revoked status

Lays the groundwork for persisting contract drafts before party data
is complete — is_active's tri-state (null/true/false) becomes an
explicit status column with a real draft state.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `save-contract-draft-action` (new)

**Files:**
- Create: `apps/web/src/actions/save-contract-draft-action.ts`
- Test: `apps/web/src/actions/save-contract-draft-action.test.ts`

**Interfaces:**
- Consumes: `savePatientContractSchema` from `@/lib/validations/contract` (already exists — `{ patientId: string uuid, pregnancyId?: string uuid | null, title: string (default), clauses_html: string (min 1), city?: string, state?: string }`). `authActionClient` from `@/lib/safe-action` (`ctx: { supabase, user, profile }`).
- Produces: `saveContractDraftAction` — a `next-safe-action` action. On success returns `{ contractId: string }`. Consumed by Task 7 (`patient-contract.tsx`).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/actions/save-contract-draft-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, existingContract, insertResult, updateResult } = vi.hoisted(
  () => ({
    authUser: { id: "professional-1" },
    profileRow: {
      data: { id: "professional-1", name: "Dra. Ana", enterprise_id: null } as Record<
        string,
        unknown
      > | null,
      error: null as { message: string } | null,
    },
    ueRow: {
      data: null as { enterprise_id: string } | null,
      error: null as { message: string } | null,
    },
    existingContract: {
      data: null as { id: string; status: string } | null,
      error: null as { message: string } | null,
    },
    insertResult: {
      data: { id: "new-contract-1" } as { id: string } | null,
      error: null as { message: string; code?: string } | null,
    },
    updateResult: {
      data: null as unknown,
      error: null as { message: string } | null,
    },
  }),
);

function makeContractsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(existingContract)),
    single: vi.fn(() => Promise.resolve(insertResult)),
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "contracts") return makeContractsBuilder();
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

import { saveContractDraftAction } from "./save-contract-draft-action";

const PATIENT_ID = "11111111-1111-1111-1111-111111111111";

describe("saveContractDraftAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    existingContract.data = null;
    existingContract.error = null;
    insertResult.data = { id: "new-contract-1" };
    insertResult.error = null;
    updateResult.data = null;
    updateResult.error = null;
  });

  it("creates a new draft when the patient has no existing contract", async () => {
    const res = await saveContractDraftAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula 1</p>",
      city: "",
      state: "",
    });

    expect(res?.data?.contractId).toBe("new-contract-1");
    expect(res?.serverError).toBeUndefined();
  });

  it("updates an existing draft in place", async () => {
    existingContract.data = { id: "draft-1", status: "draft" };

    const res = await saveContractDraftAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "Título atualizado",
      clauses_html: "<p>Cláusula editada</p>",
      city: "",
      state: "",
    });

    expect(res?.data?.contractId).toBe("draft-1");
    expect(res?.serverError).toBeUndefined();
  });

  it("rejects saving a draft over an already-generated contract", async () => {
    existingContract.data = { id: "active-1", status: "active" };

    const res = await saveContractDraftAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "Título",
      clauses_html: "<p>Cláusula</p>",
      city: "",
      state: "",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toContain("já foi gerado");
  });

  it("surfaces a friendly error on a unique-constraint race", async () => {
    insertResult.data = null;
    insertResult.error = { message: "duplicate key value violates unique constraint", code: "23505" };

    const res = await saveContractDraftAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "Título",
      clauses_html: "<p>Cláusula</p>",
      city: "",
      state: "",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toContain("Já existe um contrato");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/web && npx vitest run src/actions/save-contract-draft-action.test.ts
```

Expected: FAIL — `Cannot find module './save-contract-draft-action'`.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/actions/save-contract-draft-action.ts
"use server";

import { authActionClient } from "@/lib/safe-action";
import { savePatientContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const saveContractDraftAction = authActionClient
  .inputSchema(savePatientContractSchema)
  .action(
    async ({
      parsedInput: { patientId, pregnancyId, title, clauses_html, city, state },
      ctx: { supabase, user, profile },
    }) => {
      const { data: existing } = await supabase
        .from("contracts")
        .select("id, status")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .in("status", ["draft", "active"])
        .maybeSingle();

      if (existing?.status === "active") {
        throw new Error(
          "Este contrato já foi gerado — use 'Editar contrato' em vez de salvar rascunho.",
        );
      }

      let contractId: string;

      if (existing?.id) {
        const { error } = await supabase
          .from("contracts")
          .update({ title, clauses_html, city: city ?? null, state: state ?? null })
          .eq("id", existing.id);
        if (error) throw new Error("Erro ao salvar rascunho. Tente novamente.");
        contractId = existing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("contracts")
          .insert({
            is_base_contract: false,
            status: "draft",
            title,
            clauses_html,
            city: city ?? null,
            state: state ?? null,
            patient_id: patientId,
            pregnancy_id: pregnancyId ?? null,
            enterprise_id: profile.enterprise_id ?? null,
            user_id: profile.enterprise_id ? null : user.id,
          })
          .select("id")
          .single();

        if (error?.code === "23505") {
          throw new Error("Já existe um contrato em andamento para esta gestante.");
        }
        if (error || !inserted) throw new Error(error?.message ?? "Erro ao salvar rascunho.");
        contractId = inserted.id;
      }

      revalidatePath(`/patients/${patientId}/profile`);
      revalidatePath("/home");

      return { contractId };
    },
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/web && npx vitest run src/actions/save-contract-draft-action.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Type-check and lint**

```bash
npx biome check --write apps/web/src/actions/save-contract-draft-action.ts apps/web/src/actions/save-contract-draft-action.test.ts
cd apps/web && npx tsc --noEmit -p .
```

Expected: no new errors from this file (pre-existing errors from Task 1's fallout in other files are still expected — untouched until their own tasks).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/actions/save-contract-draft-action.ts apps/web/src/actions/save-contract-draft-action.test.ts
git commit -m "$(cat <<'EOF'
feat(contracts): add save-contract-draft-action

Lets a professional persist a contract draft (title/clauses/city/
state) without requiring complete party data or generating a PDF —
the gap that used to risk losing all drafted content.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `sign-patient-contract-action.ts` — finalize drafts

**Files:**
- Modify: `apps/web/src/actions/sign-patient-contract-action.ts:33-39,108-196`
- Test: `apps/web/src/actions/sign-patient-contract-action.test.ts`

**Interfaces:**
- Consumes: same `signPatientContractSchema` input as today. No signature change.
- Produces: no change to the action's return shape (`{ success: true }`). Behavioral change only: the existing-row lookup now matches `status IN ('draft', 'active')` instead of `is_active = true`, and every write path sets `status: 'active'` instead of `is_active: true` (or `status: 'revoked'` instead of `is_active: false` in the revoke-and-recreate branch).

- [ ] **Step 1: Write the failing test**

This test mocks every heavy dependency (`parties`, PDF rendering/upload, finalization, verification code, notifications, PostHog) so it isolates the status transition being changed in this task.

```typescript
// apps/web/src/actions/sign-patient-contract-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authUser,
  profileRow,
  ueRow,
  existingContract,
  signatureRows,
  insertResult,
  updateResult,
  patientRow,
} = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: {
      id: "professional-1",
      name: "Dra. Ana",
      enterprise_id: null,
    } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: { data: null as { enterprise_id: string } | null, error: null as unknown },
  existingContract: {
    data: null as {
      id: string;
      is_signed: boolean;
      fully_signed_at: string | null;
      title: string;
      clauses_html: string;
      city: string | null;
      state: string | null;
    } | null,
    error: null as unknown,
  },
  signatureRows: { data: [] as { id: string }[], error: null as unknown },
  insertResult: {
    data: { id: "new-contract-1" } as { id: string } | null,
    error: null as unknown,
  },
  updateResult: { data: null as unknown, error: null as unknown },
  patientRow: {
    data: { created_by: "professional-1" } as { created_by: string } | null,
    error: null as unknown,
  },
}));

function makeContractsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(existingContract)),
    single: vi.fn(() => Promise.resolve(insertResult)),
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "contracts") return makeContractsBuilder();
      if (table === "contract_signatures") return makeQueryBuilder(signatureRows);
      if (table === "patients") return makeQueryBuilder(patientRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      if (table === "contracts") return makeQueryBuilder({ data: null, error: null });
      if (table === "contract_change_requests") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

vi.mock("@/lib/contract-parties", () => ({
  buildPatientContractParties: vi.fn(async () => ({
    patient: { name: "Maria", email: "maria@example.com", cpf: "000" },
    parties_details: { contratanteBlock: "x", contratadaBlock: "y", teamMembersBlock: null },
    contratadaName: "Dra. Ana",
  })),
}));
vi.mock("@/lib/contract-header-text", () => ({ hasUnfilledFields: vi.fn(() => false) }));
vi.mock("@/lib/contract-pdf", () => ({
  buildContractPdfFileName: vi.fn(() => "contrato.pdf"),
  renderContractPdfBuffer: vi.fn(async () => Buffer.from("pdf")),
  sanitizeClausesHtml: vi.fn((html: string) => html),
  uploadContractPdf: vi.fn(async () => ({
    document: { id: "doc-1" },
    storagePath: "path/doc-1",
  })),
}));
vi.mock("@/lib/contract-signature-text", () => ({
  buildSignatureLocalityLine: vi.fn(() => "São Paulo, 09 de setembro de 2026"),
}));
vi.mock("@/lib/contract-finalization", () => ({ generateFinalizedContractPdf: vi.fn(async () => {}) }));
vi.mock("@/lib/verification-code", () => ({ generateVerificationCode: vi.fn(() => "ABC123") }));
vi.mock("@/lib/notifications/queue", () => ({ enqueueNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/whatsapp-send", () => ({ sendWhatsAppToUser: vi.fn(async () => {}) }));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/access-control", () => ({ isStaff: vi.fn(() => false) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));

import { signPatientContractAction } from "./sign-patient-contract-action";

const PATIENT_ID = "11111111-1111-1111-1111-111111111111";

describe("signPatientContractAction — draft finalization", () => {
  beforeEach(() => {
    ueRow.data = null;
    existingContract.data = null;
    signatureRows.data = [];
    insertResult.data = { id: "new-contract-1" };
    updateResult.data = null;
    updateResult.error = null;
    patientRow.data = { created_by: "professional-1" };
  });

  it("finds and finalizes an existing draft, updating it in place to status active", async () => {
    existingContract.data = {
      id: "draft-1",
      is_signed: false,
      fully_signed_at: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula</p>",
      city: null,
      state: null,
    };

    const res = await signPatientContractAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula</p>",
      city: "São Paulo",
      state: "SP",
      consent: false,
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });

  it("creates a fresh active contract when there is no existing draft", async () => {
    const res = await signPatientContractAction({
      patientId: PATIENT_ID,
      pregnancyId: null,
      title: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      clauses_html: "<p>Cláusula</p>",
      city: "São Paulo",
      state: "SP",
      consent: true,
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run src/actions/sign-patient-contract-action.test.ts
```

Expected: FAIL — the current code still filters `.eq("is_active", true)`, which no longer exists on the (already-migrated, per Task 1) table, and the insert/update payloads still write `is_active` — with the DB migration applied these calls will error, but since this is a mocked unit test the more relevant failure is: the mock's `existingContract` (keyed only by the `maybeSingle` promise) never gets consulted through an `is_active` filter path that no longer makes semantic sense once Task 1 lands — run it and confirm it fails against the **current** (pre-Task-3) source so the test is proven meaningful; if it unexpectedly passes, inspect the mock before proceeding.

- [ ] **Step 3: Update the implementation**

In `apps/web/src/actions/sign-patient-contract-action.ts`:

Replace the lookup (lines 33-39):

```typescript
      const { data: existing } = await supabase
        .from("contracts")
        .select("id, is_signed, fully_signed_at, title, clauses_html, city, state")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .in("status", ["draft", "active"])
        .maybeSingle();
```

Replace the revoke-and-recreate branch's revoke update (lines 115-123):

```typescript
        const { error: revokeError } = await supabase
          .from("contracts")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
          })
          .eq("id", existing.id)
          .is("revoked_at", null);
```

Replace that branch's insert (lines 144-160), changing only `is_active: true` to `status: "active"`:

```typescript
        const { data: inserted, error } = await supabase
          .from("contracts")
          .insert({
            is_base_contract: false,
            status: "active",
            title,
            clauses_html,
            parties_details,
            city: city ?? null,
            state: state ?? null,
            patient_id: patientId,
            pregnancy_id: pregnancyId ?? null,
            enterprise_id: profile.enterprise_id ?? null,
            user_id: profile.enterprise_id ? null : user.id,
          })
          .select("id")
          .single();
```

Replace the update-in-place branch (lines 163-175) — this is the branch a fresh draft with unchanged content takes, so it must now flip `status` to `active`:

```typescript
      } else if (existing?.id) {
        const { error } = await supabase
          .from("contracts")
          .update({
            status: "active",
            title,
            clauses_html,
            parties_details,
            city: city ?? null,
            state: state ?? null,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
        contractId = existing.id;
```

Replace the no-existing-row insert (lines 176-196), changing only `is_active: true` to `status: "active"`:

```typescript
      } else {
        const { data: inserted, error } = await supabase
          .from("contracts")
          .insert({
            is_base_contract: false,
            status: "active",
            title,
            clauses_html,
            parties_details,
            city: city ?? null,
            state: state ?? null,
            patient_id: patientId,
            pregnancy_id: pregnancyId ?? null,
            enterprise_id: profile.enterprise_id ?? null,
            user_id: profile.enterprise_id ? null : user.id,
          })
          .select("id")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Erro ao salvar contrato");
        contractId = inserted.id;
      }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run src/actions/sign-patient-contract-action.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Type-check and lint**

```bash
npx biome check --write apps/web/src/actions/sign-patient-contract-action.ts apps/web/src/actions/sign-patient-contract-action.test.ts
cd apps/web && npx tsc --noEmit -p .
```

Expected: the errors on this file from Task 1's fallout are gone.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/actions/sign-patient-contract-action.ts apps/web/src/actions/sign-patient-contract-action.test.ts
git commit -m "$(cat <<'EOF'
feat(contracts): finalize existing drafts in sign-patient-contract-action

Gerar contrato now finds a draft/active row (not just active) and
always writes status='active' on success, so a saved draft gets
finalized in place instead of creating a duplicate row.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Status writes in deactivate/revoke actions

**Files:**
- Modify: `apps/web/src/actions/deactivate-patient-contract-action.ts:11-15`
- Modify: `apps/web/src/actions/revoke-contract-action.ts:16-23,58-66`
- Modify: `apps/web/src/actions/revoke-contract-signatures-action.ts:16-25,60-68,89-103`
- Test: `apps/web/src/actions/deactivate-patient-contract-action.test.ts`
- Test: `apps/web/src/actions/revoke-contract-action.test.ts`
- Test: `apps/web/src/actions/revoke-contract-signatures-action.test.ts`

**Interfaces:**
- No input/output signature changes to any of the three actions — behavioral only (`is_active` writes/filters become `status` writes/filters).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/actions/deactivate-patient-contract-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, updateResult } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: { data: { id: "professional-1" } as Record<string, unknown> | null, error: null },
  ueRow: { data: null as { enterprise_id: string } | null, error: null },
  updateResult: { data: null as unknown, error: null as { message: string } | null },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "contracts") return makeQueryBuilder(updateResult);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));

import { deactivatePatientContractAction } from "./deactivate-patient-contract-action";

describe("deactivatePatientContractAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    updateResult.data = null;
    updateResult.error = null;
  });

  it("marks the contract as revoked", async () => {
    const res = await deactivatePatientContractAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });

  it("surfaces a server error when the update fails", async () => {
    updateResult.error = { message: "new row violates row-level security policy" };

    const res = await deactivatePatientContractAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
```

```typescript
// apps/web/src/actions/revoke-contract-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, existingContract, patientRow, updateResult } = vi.hoisted(
  () => ({
    authUser: { id: "professional-1" },
    profileRow: {
      data: { id: "professional-1", enterprise_id: null } as Record<string, unknown> | null,
      error: null,
    },
    ueRow: { data: null as { enterprise_id: string } | null, error: null },
    existingContract: {
      data: { id: "contract-1", fully_signed_at: "2026-09-01T00:00:00.000Z" } as {
        id: string;
        fully_signed_at: string | null;
      } | null,
      error: null as unknown,
    },
    patientRow: { data: { created_by: "professional-1" } as { created_by: string } | null, error: null },
    updateResult: { data: null as unknown, error: null as { message: string } | null },
  }),
);

function makeContractsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(existingContract)),
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "contracts") return makeContractsBuilder();
      if (table === "patients") return makeQueryBuilder(patientRow);
      if (table === "team_members") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      if (table === "contract_change_requests") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/access-control", () => ({ isStaff: vi.fn(() => false) }));

import { revokeContractAction } from "./revoke-contract-action";

describe("revokeContractAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    existingContract.data = { id: "contract-1", fully_signed_at: "2026-09-01T00:00:00.000Z" };
    patientRow.data = { created_by: "professional-1" };
    updateResult.data = null;
    updateResult.error = null;
  });

  it("revokes a fully signed contract", async () => {
    const res = await revokeContractAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });

  it("rejects revoking a contract that isn't fully signed", async () => {
    existingContract.data = { id: "contract-1", fully_signed_at: null };

    const res = await revokeContractAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toContain("assinados por ambas as partes");
  });
});
```

```typescript
// apps/web/src/actions/revoke-contract-signatures-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, existingContract, patientRow, insertResult, updateResult } =
  vi.hoisted(() => ({
    authUser: { id: "professional-1" },
    profileRow: {
      data: { id: "professional-1", enterprise_id: null } as Record<string, unknown> | null,
      error: null,
    },
    ueRow: { data: null as { enterprise_id: string } | null, error: null },
    existingContract: {
      data: {
        id: "contract-1",
        is_signed: true,
        fully_signed_at: null,
        title: "CONTRATO",
        clauses_html: "<p>x</p>",
        parties_details: { contratanteBlock: "a", contratadaBlock: "b", teamMembersBlock: null },
        city: null,
        state: null,
        pregnancy_id: null,
        enterprise_id: null,
        user_id: "professional-1",
      } as Record<string, unknown> | null,
      error: null as unknown,
    },
    patientRow: { data: { created_by: "professional-1" } as { created_by: string } | null, error: null },
    insertResult: { data: { id: "new-contract-1" } as { id: string } | null, error: null as unknown },
    updateResult: { data: null as unknown, error: null as unknown },
  }));

function makeContractsBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(existingContract)),
    single: vi.fn(() => Promise.resolve(insertResult)),
    then: (resolve: (v: unknown) => unknown) => resolve(updateResult),
  };
  return builder;
}

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "contracts") return makeContractsBuilder();
      if (table === "patients") return makeQueryBuilder(patientRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      if (table === "contract_change_requests") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/access-control", () => ({ isStaff: vi.fn(() => false) }));

import { revokeContractSignaturesAction } from "./revoke-contract-signatures-action";

describe("revokeContractSignaturesAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    existingContract.data = {
      id: "contract-1",
      is_signed: true,
      fully_signed_at: null,
      title: "CONTRATO",
      clauses_html: "<p>x</p>",
      parties_details: { contratanteBlock: "a", contratadaBlock: "b", teamMembersBlock: null },
      city: null,
      state: null,
      pregnancy_id: null,
      enterprise_id: null,
      user_id: "professional-1",
    };
    patientRow.data = { created_by: "professional-1" };
    insertResult.data = { id: "new-contract-1" };
    updateResult.data = null;
    updateResult.error = null;
  });

  it("revokes the signed contract and recreates it as active", async () => {
    const res = await revokeContractSignaturesAction({
      contractId: "11111111-1111-1111-1111-111111111111",
      patientId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.contractId).toBe("new-contract-1");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/web && npx vitest run src/actions/deactivate-patient-contract-action.test.ts src/actions/revoke-contract-action.test.ts src/actions/revoke-contract-signatures-action.test.ts
```

Expected: FAIL (files still reference `is_active`, mismatched against the mocks above which model the post-migration shape).

- [ ] **Step 3: Update the implementations**

In `apps/web/src/actions/deactivate-patient-contract-action.ts`, replace the update call:

```typescript
    const { error } = await supabase
      .from("contracts")
      .update({ status: "revoked" })
      .eq("id", contractId)
      .eq("is_base_contract", false);
```

In `apps/web/src/actions/revoke-contract-action.ts`, replace the lookup filter (line 22):

```typescript
        .eq("status", "active")
```

and the update payload (lines 60-64):

```typescript
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
        })
```

In `apps/web/src/actions/revoke-contract-signatures-action.ts`, replace the lookup filter (line 24):

```typescript
        .eq("status", "active")
```

the revoke update (lines 60-66):

```typescript
      const { error: revokeError } = await supabase
        .from("contracts")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
        })
        .eq("id", existing.id)
        .is("revoked_at", null);
```

and the recreate insert (line 93), changing only `is_active: true` to `status: "active"`:

```typescript
      const { data: inserted, error } = await supabase
        .from("contracts")
        .insert({
          is_base_contract: false,
          status: "active",
          title: existing.title,
          clauses_html: existing.clauses_html,
          parties_details: existing.parties_details,
          city: existing.city,
          state: existing.state,
          patient_id: patientId,
          pregnancy_id: existing.pregnancy_id,
          enterprise_id: existing.enterprise_id,
          user_id: existing.user_id,
        })
        .select("id")
        .single();
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/web && npx vitest run src/actions/deactivate-patient-contract-action.test.ts src/actions/revoke-contract-action.test.ts src/actions/revoke-contract-signatures-action.test.ts
```

Expected: PASS (2 + 2 + 1 = 5 tests).

- [ ] **Step 5: Type-check and lint**

```bash
npx biome check --write apps/web/src/actions/deactivate-patient-contract-action.ts apps/web/src/actions/deactivate-patient-contract-action.test.ts apps/web/src/actions/revoke-contract-action.ts apps/web/src/actions/revoke-contract-action.test.ts apps/web/src/actions/revoke-contract-signatures-action.ts apps/web/src/actions/revoke-contract-signatures-action.test.ts
cd apps/web && npx tsc --noEmit -p .
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/actions/deactivate-patient-contract-action.ts apps/web/src/actions/deactivate-patient-contract-action.test.ts apps/web/src/actions/revoke-contract-action.ts apps/web/src/actions/revoke-contract-action.test.ts apps/web/src/actions/revoke-contract-signatures-action.ts apps/web/src/actions/revoke-contract-signatures-action.test.ts
git commit -m "$(cat <<'EOF'
refactor(contracts): migrate deactivate/revoke actions to status column

Replaces is_active writes/filters with status='revoked'/'active' in
the three actions behind "Excluir contrato", "Revogar e redigir
novo" and "Editar contrato assinado".

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Query filters + draft-signing guard

**Files:**
- Modify: `apps/web/src/actions/get-patient-contract-action.ts:38`
- Modify: `apps/web/src/actions/create-contract-change-request-action.ts:32`
- Modify: `apps/web/src/actions/sign-contract-as-patient-action.ts:31-39`
- Test: `apps/web/src/actions/create-contract-change-request-action.test.ts`
- Test: `apps/web/src/actions/sign-contract-as-patient-action.test.ts`

**Interfaces:**
- No signature changes. `sign-contract-as-patient-action.ts` gains a new thrown error path (`status === "draft"`) — this is what Task 8's UI relies on never actually surfacing (the sign button is hidden for drafts), but it is the defense-in-depth the spec calls for.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/actions/create-contract-change-request-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, patientRow, existingContract, insertResult } = vi.hoisted(() => ({
  authUser: { id: "patient-user-1" },
  patientRow: {
    data: {
      id: "patient-1",
      user_id: "patient-user-1",
      name: "Maria",
      created_by: "professional-1",
    } as Record<string, unknown> | null,
    error: null as unknown,
  },
  existingContract: {
    data: { id: "contract-1" } as { id: string } | null,
    error: null as unknown,
  },
  insertResult: { data: null as unknown, error: null as { message: string; code?: string } | null },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder({ data: { user_type: "patient" }, error: null });
      if (table === "patients") return makeQueryBuilder(patientRow);
      if (table === "contracts") return makeQueryBuilder(existingContract);
      if (table === "contract_change_requests") return makeQueryBuilder(insertResult);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/queue", () => ({ enqueueNotification: vi.fn(async () => {}) }));
vi.mock("@/lib/notifications/whatsapp-send", () => ({ sendWhatsAppToUser: vi.fn(async () => {}) }));

import { createContractChangeRequestAction } from "./create-contract-change-request-action";

describe("createContractChangeRequestAction", () => {
  beforeEach(() => {
    patientRow.data = {
      id: "patient-1",
      user_id: "patient-user-1",
      name: "Maria",
      created_by: "professional-1",
    };
    existingContract.data = { id: "contract-1" };
    insertResult.data = null;
    insertResult.error = null;
  });

  it("accepts a change request against a draft contract", async () => {
    const res = await createContractChangeRequestAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      messageHtml: "<p>Poderiam revisar a cláusula 3?</p>",
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });

  it("rejects when no draft or active contract exists", async () => {
    existingContract.data = null;

    const res = await createContractChangeRequestAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      messageHtml: "<p>Texto</p>",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toContain("Nenhum contrato encontrado");
  });
});
```

```typescript
// apps/web/src/actions/sign-contract-as-patient-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, patientRow, existingContract, signatureRows } = vi.hoisted(() => ({
  authUser: { id: "patient-user-1" },
  patientRow: {
    data: {
      id: "patient-1",
      user_id: "patient-user-1",
      name: "Maria",
      email: "maria@example.com",
      cpf: "000",
    } as Record<string, unknown> | null,
    error: null as unknown,
  },
  existingContract: {
    data: {
      id: "contract-1",
      is_signed: true,
      verification_code: "ABC123",
      parties_details: { contratanteBlock: "a", contratadaBlock: "b", teamMembersBlock: null },
      title: "CONTRATO",
      clauses_html: "<p>x</p>",
      city: null,
      state: null,
      enterprise_id: null,
      signed_at: "2026-09-01T00:00:00.000Z",
      signed_by: "professional-1",
      content_hash: "hash",
      original_document_id: "doc-1",
      status: "active",
    } as Record<string, unknown> | null,
    error: null as unknown,
  },
  signatureRows: { data: null as { id: string } | null, error: null as unknown },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (resolve: (v: unknown) => unknown) => resolve(result),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder({ data: { user_type: "patient" }, error: null });
      if (table === "patients") return makeQueryBuilder(patientRow);
      if (table === "contracts") return makeQueryBuilder(existingContract);
      if (table === "contract_signatures") return makeQueryBuilder(signatureRows);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder({ data: null, error: null });
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));
vi.mock("@/lib/contract-header-text", () => ({ hasUnfilledFields: vi.fn(() => false) }));
vi.mock("@/lib/contract-finalization", () => ({ generateFinalizedContractPdf: vi.fn(async () => {}) }));
vi.mock("@/lib/posthog/server", () => ({ captureServerEvent: vi.fn(async () => {}) }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Map()) }));

import { signContractAsPatientAction } from "./sign-contract-as-patient-action";

describe("signContractAsPatientAction", () => {
  beforeEach(() => {
    patientRow.data = {
      id: "patient-1",
      user_id: "patient-user-1",
      name: "Maria",
      email: "maria@example.com",
      cpf: "000",
    };
    existingContract.data = {
      id: "contract-1",
      is_signed: true,
      verification_code: "ABC123",
      parties_details: { contratanteBlock: "a", contratadaBlock: "b", teamMembersBlock: null },
      title: "CONTRATO",
      clauses_html: "<p>x</p>",
      city: null,
      state: null,
      enterprise_id: null,
      signed_at: "2026-09-01T00:00:00.000Z",
      signed_by: "professional-1",
      content_hash: "hash",
      original_document_id: "doc-1",
      status: "active",
    };
    signatureRows.data = null;
  });

  it("signs an active contract", async () => {
    const res = await signContractAsPatientAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      consent: true,
    });

    expect(res?.serverError).toBeUndefined();
    expect(res?.data?.success).toBe(true);
  });

  it("rejects signing a draft contract", async () => {
    existingContract.data = {
      ...(existingContract.data as Record<string, unknown>),
      status: "draft",
    };

    const res = await signContractAsPatientAction({
      patientId: "11111111-1111-1111-1111-111111111111",
      consent: true,
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toContain("rascunho");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd apps/web && npx vitest run src/actions/create-contract-change-request-action.test.ts src/actions/sign-contract-as-patient-action.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Update the implementations**

In `apps/web/src/actions/get-patient-contract-action.ts`, replace line 38:

```typescript
          .in("status", ["draft", "active"])
```

In `apps/web/src/actions/create-contract-change-request-action.ts`, replace line 32:

```typescript
      .in("status", ["draft", "active"])
```

In `apps/web/src/actions/sign-contract-as-patient-action.ts`, replace the select+filter (lines 29-37):

```typescript
      const { data: existing } = await supabase
        .from("contracts")
        .select(
          "id, status, is_signed, verification_code, parties_details, title, clauses_html, city, state, enterprise_id, signed_at, signed_by, content_hash, original_document_id",
        )
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .in("status", ["draft", "active"])
        .maybeSingle();

      if (!existing) throw new Error("Nenhum contrato encontrado para assinar.");
      if (existing.status === "draft") {
        throw new Error("Este contrato ainda é um rascunho e não pode ser assinado.");
      }
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd apps/web && npx vitest run src/actions/create-contract-change-request-action.test.ts src/actions/sign-contract-as-patient-action.test.ts
```

Expected: PASS (2 + 2 = 4 tests).

- [ ] **Step 5: Type-check and lint**

```bash
npx biome check --write apps/web/src/actions/get-patient-contract-action.ts apps/web/src/actions/create-contract-change-request-action.ts apps/web/src/actions/create-contract-change-request-action.test.ts apps/web/src/actions/sign-contract-as-patient-action.ts apps/web/src/actions/sign-contract-as-patient-action.test.ts
cd apps/web && npx tsc --noEmit -p .
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/actions/get-patient-contract-action.ts apps/web/src/actions/create-contract-change-request-action.ts apps/web/src/actions/create-contract-change-request-action.test.ts apps/web/src/actions/sign-contract-as-patient-action.ts apps/web/src/actions/sign-contract-as-patient-action.test.ts
git commit -m "$(cat <<'EOF'
feat(contracts): allow change requests on drafts, block signing them

get-patient-contract-action and create-contract-change-request-action
now match status IN (draft, active) instead of is_active=true — the
gestante can comment on a draft. sign-contract-as-patient-action
gains an explicit draft-status guard as defense in depth alongside
the UI hiding the sign button for drafts.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Patient-self service + WhatsApp reminder filter

**Files:**
- Modify: `apps/web/src/services/patient-self.ts:167,210`
- Modify: `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts:389,394-405`
- Test: `apps/web/src/lib/notifications/whatsapp-queue-handlers.test.ts`

**Interfaces:**
- `patient-self.ts`: no signature changes — `getMyContracts`/`getMyContractById` still return `ContractListItem`/`ContractListItem | null`, now including `status` as part of the `select("*")` spread.
- `whatsapp-queue-handlers.ts`: `handleContractPendingSignature` changes from a private (non-exported) function to `export async function handleContractPendingSignature(...)` — needed so the new test can import it directly. No other exports of this file change.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/lib/notifications/whatsapp-queue-handlers.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { dayjs } from "@/lib/dayjs";

const { contractRow } = vi.hoisted(() => ({
  contractRow: {
    data: null as {
      is_signed: boolean;
      status: string;
      created_at: string;
      patient: { name: string; created_by: string } | null;
    } | null,
    error: null as { message: string } | null,
  },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

import { handleContractPendingSignature } from "./whatsapp-queue-handlers";

describe("handleContractPendingSignature", () => {
  const supabaseAdmin = {
    from: vi.fn((table: string) => {
      if (table === "contracts") return makeQueryBuilder(contractRow);
      throw new Error(`unexpected table: ${table}`);
    }),
  } as unknown as Parameters<typeof handleContractPendingSignature>[0];

  const oldEnoughCreatedAt = dayjs().subtract(4, "day").toISOString();

  beforeEach(() => {
    contractRow.data = {
      is_signed: false,
      status: "active",
      created_at: oldEnoughCreatedAt,
      patient: { name: "Maria", created_by: "professional-1" },
    };
    contractRow.error = null;
  });

  it("skips a draft contract even if old and unsigned", async () => {
    contractRow.data = { ...(contractRow.data as NonNullable<typeof contractRow.data>), status: "draft" };

    const result = await handleContractPendingSignature(supabaseAdmin, {
      referenceId: "contract-1",
    } as Parameters<typeof handleContractPendingSignature>[1]);

    expect(result.action).toBe("skip");
  });

  it("does not skip an old, unsigned, active contract solely due to status", async () => {
    const result = await handleContractPendingSignature(supabaseAdmin, {
      referenceId: "contract-1",
    } as Parameters<typeof handleContractPendingSignature>[1]);

    expect(result.action).not.toBe("skip");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd apps/web && npx vitest run src/lib/notifications/whatsapp-queue-handlers.test.ts
```

Expected: FAIL — `handleContractPendingSignature` is not exported yet.

- [ ] **Step 3: Update the implementations**

In `apps/web/src/services/patient-self.ts`, replace line 167 (`getMyContracts`):

```typescript
    .in("status", ["draft", "active"])
```

and line 210 (`getMyContractById`):

```typescript
    .in("status", ["draft", "active"])
```

In `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts`, change the function declaration on line 389 from `async function` to `export async function`, and replace the query + condition (lines 394-405):

```typescript
  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select("is_signed, status, created_at, patient:patients(name, created_by)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error)
    throw new Error(`Falha ao buscar contrato ${notification.referenceId}: ${error.message}`);
  if (
    !contract ||
    contract.is_signed ||
    contract.status !== "active" ||
    dayjs().diff(dayjs(contract.created_at), "day") < 3
  ) {
    return { action: "skip" };
  }
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd apps/web && npx vitest run src/lib/notifications/whatsapp-queue-handlers.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Type-check and lint**

```bash
npx biome check --write apps/web/src/services/patient-self.ts apps/web/src/lib/notifications/whatsapp-queue-handlers.ts apps/web/src/lib/notifications/whatsapp-queue-handlers.test.ts
cd apps/web && npx tsc --noEmit -p .
```

Expected: zero remaining errors from Task 1's fallout — every `is_active` reference on `contracts` has now been migrated.

```bash
grep -rn "is_active" apps/web/src --include="*.ts" --include="*.tsx" | grep -v "billing\|push_subscriptions\|plans"
```

Expected: no output (or only genuinely unrelated tables, double-check any hit by hand).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/services/patient-self.ts apps/web/src/lib/notifications/whatsapp-queue-handlers.ts apps/web/src/lib/notifications/whatsapp-queue-handlers.test.ts
git commit -m "$(cat <<'EOF'
feat(contracts): surface drafts to the gestante, exclude them from reminders

getMyContracts/getMyContractById now include draft contracts so
they're visible in the patient portal. The WhatsApp
"sign your contract" reminder now explicitly requires status=active,
so it never nags about a contract that isn't signable yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Professional UI — "Salvar rascunho"

**Files:**
- Modify: `apps/web/src/components/shared/patient-contract.tsx`

**Interfaces:**
- Consumes: `saveContractDraftAction` from `@/actions/save-contract-draft-action` (Task 2).
- Produces: no exported interface change — this is a leaf client component.

- [ ] **Step 1: Add `contractStatus` state and populate it from `fetchContract`**

Add a new state near the other contract-lifecycle state (after `contractExists`, around line 141):

```typescript
  const [contractStatus, setContractStatus] = useState<"draft" | "active" | null>(null);
```

In `fetchContract`'s `onSuccess` (around lines 220-244), set it alongside the other per-contract state, and clear it in the `else` branch:

```typescript
        if (data?.contract) {
          setContractId(data.contract.id);
          setTitle(data.contract.title);
          setClausesHtml(data.contract.clauses_html);
          setCity(data.contract.city ?? "");
          setState(data.contract.state ?? "");
          setContractStatus(data.contract.status as "draft" | "active");
          if (data.savedParties) setSavedParties(data.savedParties);
          setOriginalDocumentId(data.contract.original_document_id);
          setSignatureInfo(
            data.contract.is_signed
              ? {
                  signedAt: data.contract.signed_at,
                  verificationCode: data.contract.verification_code,
                  finalizedDocumentId: data.contract.finalized_document_id,
                  signedByName: data.signedByName ?? null,
                }
              : null,
          );
          setFullySignedAt(data.contract.fully_signed_at ?? null);
          setContractExists(true);
          setMode("readonly");
        } else {
          setOriginalDocumentId(null);
          setContractStatus(null);
          setMode("select");
        }
```

Also reset it to `null` in the `deactivateContract` and `revokeContract` `onSuccess` handlers (both already reset `contractId`/`contractExists`/etc. — add `setContractStatus(null);` to each, right after `setSignatureInfo(null);`).

- [ ] **Step 2: Add the `saveContractDraftAction` hook and handler**

Add the import at the top with the other action imports (alphabetically, after `resolveContractChangeRequestAction`):

```typescript
import { saveContractDraftAction } from "@/actions/save-contract-draft-action";
```

Add the hook near `signContractAsync` (after it, around line 281):

```typescript
  const { execute: saveDraft, isExecuting: isSavingDraft } = useAction(saveContractDraftAction, {
    onSuccess: () => {
      toast.success("Rascunho salvo. A gestante já pode visualizá-lo.");
      fetchContract({ patientId });
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao salvar rascunho"),
  });

  const handleSaveDraft = () => {
    saveDraft({
      patientId,
      pregnancyId: pregnancyId ?? null,
      title,
      clauses_html: clausesHtml,
      city,
      state,
    });
  };
```

- [ ] **Step 3: Add the "Salvar rascunho" button to the editing-mode footer**

In the editing-mode button row (around line 933), add the new button as the first one, before "Cancelar" — deliberately **not** gated by `activeIncompleteParties`:

```tsx
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={isSavingDraft} onClick={handleSaveDraft}>
            {isSavingDraft ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button variant="ghost" disabled={isSigning} onClick={handleCancelContractForm}>
            Cancelar
          </Button>
```

(Leave every other button in that row unchanged.)

- [ ] **Step 4: Adjust the readonly-mode view for drafts**

Add a neutral draft banner right after the (already-commented-out) signed banner block, before the `changeRequests.length > 0` block (around line 661-662):

```tsx
          {contractStatus === "draft" && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-sm">
              <span>Rascunho — visível para a gestante, mas ainda não pode ser assinado.</span>
            </div>
          )}
```

Hide "Assinar digitalmente" for drafts — change the condition on the button (around line 741):

```tsx
              {!signatureInfo && !fullySignedAt && contractStatus !== "draft" && (
                <Button className="gradient-primary" onClick={() => setIsSignConfirmOpen(true)}>
                  Assinar digitalmente
                </Button>
              )}
```

Relabel "Excluir contrato" for drafts (around line 707-714):

```tsx
            {!fullySignedAt && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setIsDeleteConfirmOpen(true)}
              >
                <Trash2 className="size-4" />
                {contractStatus === "draft" ? "Descartar rascunho" : "Excluir contrato"}
              </Button>
            )}
```

- [ ] **Step 5: Type-check and lint**

```bash
npx biome check --write apps/web/src/components/shared/patient-contract.tsx
cd apps/web && npx tsc --noEmit -p .
```

- [ ] **Step 6: Manual verification**

Start the dev server (`preview_start` with the `web` launch config), log in as a professional with a patient that has incomplete party data, open the contract tab, write some clauses text, and:
1. Click "Salvar rascunho" — confirm the toast, and that the view reloads into the readonly draft banner without ever showing the "Dados incompletos" modal.
2. Confirm "Assinar digitalmente" is not shown, and "Excluir contrato" now reads "Descartar rascunho".
3. Click "Editar contrato", confirm the previously-saved title/clauses/city/state are pre-filled.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/shared/patient-contract.tsx
git commit -m "$(cat <<'EOF'
feat(contracts): add "Salvar rascunho" to the professional's editor

The button saves title/clauses/city/state as a draft regardless of
incomplete party data, and the readonly view now distinguishes a
saved draft (no sign button, "Descartar rascunho" label) from a
generated contract.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Patient UI — draft view in `ContractDetail`

**Files:**
- Modify: `apps/web/src/components/patient-area/contract-detail.tsx`

**Interfaces:**
- Consumes: `contract.status` (now present on `ContractListItem` per Task 1's regenerated types).
- No exported interface change.

- [ ] **Step 1: Add the `isDraft` flag and short-circuit the PDF-loading effect**

Add near `isFullySigned`/`isPartiallySigned` (line 45-47):

```typescript
  const isDraft = contract.status === "draft";
```

At the very start of `loadPdf()` inside the `useEffect` (before the `if (isFullySigned)` check, around line 84):

```typescript
    async function loadPdf() {
      setPdfError(null);

      // A draft never has a PDF (no header/parties snapshot yet) — it's rendered
      // as raw clauses HTML below instead.
      if (isDraft) return;

```

Add `isDraft` to the effect's dependency array (line 138):

```typescript
  }, [contract.id, isFullySigned, contract.finalized_document_id, contract.original_document_id, isDraft]);
```

- [ ] **Step 2: Render clauses HTML directly for drafts**

Replace the PDF-or-placeholder block (lines 180-188):

```tsx
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isDraft ? (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 text-sm">
              <Clock className="size-4 shrink-0" />
              <span>
                Sua profissional está preparando o contrato. Você já pode revisar o texto e
                enviar comentários, mas a assinatura só estará disponível quando o contrato for
                finalizado.
              </span>
            </div>
            <h2 className="mb-2 font-semibold text-[#433831]">{contract.title}</h2>
            <div
              className="prose-sm"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitizado via sanitizeMessageHtml
              dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(contract.clauses_html) }}
            />
          </div>
        ) : pdfSource ? (
          <PdfViewer source={pdfSource} />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-muted-foreground text-sm">
            {pdfError ?? "Carregando documento..."}
          </div>
        )}
      </div>
```

- [ ] **Step 3: Hide the sign button for drafts, keep the change-request dialog**

Replace the action row (lines 207-218):

```tsx
      {!isFullySigned && !hasPendingChangeRequest && !contract.patientSigned && (
        <div className="flex shrink-0 flex-row justify-end gap-2">
          <RequestContractChangeDialog patientId={contract.patient_id as string} />
          {!isDraft && (
            <Button
              disabled={isExecuting}
              className="flex-1 sm:flex-none"
              onClick={() => setIsSignConfirmOpen(true)}
            >
              Assinar contrato
            </Button>
          )}
        </div>
      )}
```

- [ ] **Step 4: Type-check and lint**

```bash
npx biome check --write apps/web/src/components/patient-area/contract-detail.tsx
cd apps/web && npx tsc --noEmit -p .
```

- [ ] **Step 5: Manual verification**

As the gestante account for the patient from Task 7's manual check, open `/contrato/[id]` for the just-saved draft: confirm the amber banner and raw clauses text render (no PDF viewer attempt), the "Assinar contrato" button is absent, and "Solicitar alteração" still opens and submits successfully.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/patient-area/contract-detail.tsx
git commit -m "$(cat <<'EOF'
feat(patient-portal): render contract drafts as plain text, hide signing

A draft contract has no PDF or party snapshot yet, so ContractDetail
now renders its clauses_html directly with a "still being prepared"
banner, and hides the sign button while keeping the change-request
dialog available.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Patient UI — draft badge in `ContractList`

**Files:**
- Modify: `apps/web/src/components/patient-area/contract-list.tsx:73-96`

**Interfaces:** No exported interface change.

- [ ] **Step 1: Replace the signature-status column with a draft badge when applicable**

Replace lines 73-96:

```tsx
                <div className="flex items-start justify-end gap-1.5 sm:shrink-0 sm:gap-4">
                  {pendingRequest && (
                    <Badge
                      variant="outline"
                      className="w-fit cursor-pointer border-blue-400/40 text-blue-700"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedRequest(pendingRequest);
                      }}
                    >
                      <MessageSquareText className="mr-1 h-3 w-3" />
                      Alteração solicitada
                    </Badge>
                  )}
                  {contract.status === "draft" ? (
                    <Badge
                      variant="outline"
                      className="w-fit border-amber-500 bg-amber-500 text-white"
                    >
                      Rascunho
                    </Badge>
                  ) : (
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="pr-2 font-medium text-sm">Assinaturas</span>
                      <SignatureStatusBadge label="Minha" signed={contract.patientSigned} />
                      <SignatureStatusBadge
                        label="Empresa/Profissional"
                        signed={contract.is_signed}
                      />
                    </div>
                  )}
                </div>
```

- [ ] **Step 2: Type-check and lint**

```bash
npx biome check --write apps/web/src/components/patient-area/contract-list.tsx
cd apps/web && npx tsc --noEmit -p .
```

- [ ] **Step 3: Manual verification**

Log back in as the gestante and open the home page: confirm the draft contract now appears in the list (it was previously excluded by `is_active=true`) with a "Rascunho" badge instead of the two signature badges, and that clicking it opens the Task 8 draft view.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/patient-area/contract-list.tsx
git commit -m "$(cat <<'EOF'
feat(patient-portal): show a Rascunho badge for draft contracts in the list

Replaces the two signature-status badges (which don't apply yet)
with a single neutral "Rascunho" badge for contracts still in draft.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Final check

- [ ] Run the full web test suite and full type-check once more before calling this done:

```bash
cd apps/web && npx vitest run
cd apps/web && npx tsc --noEmit -p .
cd /Users/otaviobarbosa/dev/nascere && npx biome check .
```

Expected: all green. If any pre-existing (unrelated) test or lint failure shows up, report it rather than fixing it silently — per this repo's testing convention, a pre-existing failure that this change didn't cause needs the developer's judgment call, not a silent patch.
