# Feature: Solicitar Alteração de Contrato (Phase 3 — patient-contract-signature)

## Summary

Add a `contract_change_requests` table plus two server actions (patient creates a request,
professional resolves it) so the gestante can ask for changes to her pending contract before
signing, using the existing `RichEditor` rich-text component. This is Phase 3 of the
`patient-contract-signature` PRD, built directly on top of the completed Phase 1
(`contract_signatures` dual-signature model) and Phase 2 (patient signing action + missing-field
gate + CONTRATADA authorization). Notifications (Phase 4) and the patient-facing home UI listing
pending/signed contracts (Phase 5) are explicitly out of scope here — this phase only builds the
data model, the two actions, RLS, and a reusable rich-text request dialog + a professional-side
resolve UI slotted into the existing `patient-contract.tsx` readonly view.

## User Story

As a gestante (patient)
I want to request a change to my pending contract before signing it
So that I don't have to sign something with terms I disagree with, or fall back to WhatsApp/email to ask for edits

As a profissional
I want to see change requests my patient made and mark them resolved once I've updated the contract
So that I have a clear, in-platform record of what was asked and confirm I addressed it

## Problem Statement

Today the gestante has no in-platform way to ask for a contract change before signing — she
must use an external channel (WhatsApp, e-mail). There is also no data model in this codebase
for tracking any kind of "request/resolve" workflow tied to a contract.

## Solution Statement

Introduce `contract_change_requests` as a new child table (analogous in shape to
`contract_signatures`, analogous in status-column convention to `patient_invite_links`), with:
- RLS INSERT policy scoped to `requested_by = auth.uid()` (mirrors `contract_signatures`'
  `signer_id = auth.uid()` INSERT policy) plus a same-shape SELECT visibility policy (mirrors the
  `is_team_member` / `is_enterprise_patient` / `patients.user_id = auth.uid()` triad used
  everywhere else on contract-adjacent tables).
- Resolution handled via `supabaseAdmin` in the resolve action after an app-level authorization
  check (mirrors the `patient_invite_links` "service-role UPDATE after app check" pattern) rather
  than a bespoke RLS UPDATE policy — consistent with how this codebase already does professional
  writes on patient-initiated records, and avoids the USING/WITH CHECK reuse gotcha entirely (see
  Patterns section).
- A partial unique index enforcing at most one open (`status = 'pending'`) request per contract,
  preventing duplicate/looping requests without adding process complexity.
- Two `next-safe-action` actions (`createContractChangeRequestAction`,
  `resolveContractChangeRequestAction`) following the exact structure of
  `sign-contract-as-patient-action.ts` / `sign-patient-contract-action.ts`.
- A new `RequestContractChangeDialog` client component wrapping the existing `RichEditor`, and a
  "solicitações de alteração" list wired into `patient-contract.tsx`'s `readonly` mode (the same
  spot the currently-commented-out `signatureInfo` block already occupies) for the professional to
  view and resolve requests.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY                                     |
| Complexity       | MEDIUM                                             |
| Systems Affected | Supabase (migration, RLS), server actions, packages/ui RichEditor consumer, patient-contract.tsx |
| Dependencies     | Zod (existing), next-safe-action (existing), `@ventre/ui/shared/rich-editor` (existing, no new deps) |
| Estimated Tasks  | 8                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  Professional dashboard                                                       ║
║  ┌─────────────────┐   generates/signs   ┌─────────────────┐                  ║
║  │ patient-contract │ ──────────────────► │ contract signed │                  ║
║  │      .tsx        │                     │ (is_signed=true)│                  ║
║  └─────────────────┘                     └────────┬────────┘                  ║
║                                                     │                          ║
║                                                     ▼                          ║
║                                        Gestante has NO in-platform way         ║
║                                        to react — must use WhatsApp/e-mail     ║
║                                        to ask the professional for changes.    ║
║                                                                                ║
║  PAIN_POINT: no `contract_change_requests` table, no action, no UI at all.     ║
║  DATA_FLOW: contracts → contract_signatures only; no request/response loop.   ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  Gestante (via RequestContractChangeDialog, mountable wherever the patient    ║
║  views her pending contract — full home-page slot lands in Phase 5)          ║
║  ┌───────────────────┐  RichEditor msg  ┌────────────────────────┐            ║
║  │ Request change     │ ───────────────► │ createContractChange-  │            ║
║  │ dialog              │                 │ RequestAction           │            ║
║  └───────────────────┘                  └───────────┬────────────┘            ║
║                                                       │ INSERT (status=pending) ║
║                                                       ▼                        ║
║                                          contract_change_requests row          ║
║                                                       │                        ║
║                                                       ▼                        ║
║  Professional dashboard — patient-contract.tsx (readonly mode)                ║
║  ┌────────────────────────┐  resolve   ┌──────────────────────────┐           ║
║  │ Pending change requests │ ─────────► │ resolveContractChange-   │           ║
║  │ list + "Marcar como     │            │ RequestAction (status=   │           ║
║  │ resolvida" button       │            │ resolved, resolved_by)   │           ║
║  └────────────────────────┘            └──────────────────────────┘           ║
║                                                                                ║
║  USER_FLOW: gestante opens dialog → writes rich-text message → submits →      ║
║  row created (blocked from creating a 2nd while one is pending, via partial   ║
║  unique index) → professional sees it in patient-contract.tsx → resolves it.  ║
║  VALUE_ADD: no external channel needed to register a change request; auditable║
║  record of what was asked and when it was addressed.                          ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `patient-contract.tsx` readonly mode | Only signature status + edit/delete/export actions | New "Solicitações de alteração" section listing pending/resolved requests with a resolve button | Professional sees and can act on patient requests without leaving the platform |
| (new) `request-contract-change-dialog.tsx` | Does not exist | Rich-text dialog patients can trigger to submit a change request | Gestante can request changes in-platform (trigger point wired by whichever screen mounts it; full patient contract page ships in Phase 5) |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/actions/sign-contract-as-patient-action.ts` | 1-78 | Exact template for the patient-side `createContractChangeRequestAction`: `authActionClient`, `profile.user_type !== "patient"` guard, `patients.user_id === user.id` ownership check, RLS-respecting `supabase` client for the insert, `revalidatePath`, `captureServerEvent` |
| P0 | `apps/web/src/actions/sign-patient-contract-action.ts` | 49-62 | Exact template for the professional-side dual-branch authorization (`profile.enterprise_id` → `isStaff(profile)`; else `patients.created_by === user.id`) to reuse in `resolveContractChangeRequestAction` |
| P0 | `packages/supabase/supabase/migrations/20260814000002_create_contract_signatures_table.sql` | 1-59 | Migration structure to mirror: role/status CHECK constraint, UNIQUE constraint, RLS SELECT visibility triad, RLS INSERT `= auth.uid()` policy, explicit GRANTs |
| P1 | `packages/supabase/supabase/migrations/20260710000001_patient_invite_links_extend.sql` | 1-30 | Service-role UPDATE policy pattern (`FOR UPDATE TO service_role USING (true) WITH CHECK (true)`) — the resolve action performs its own app-level auth check and writes with `supabaseAdmin`, matching this exact precedent instead of a bespoke RLS UPDATE policy |
| P1 | `apps/web/src/lib/validations/contract.ts` | 1-75 | Zod schema conventions: `isRichTextEmpty()` HTML-strip helper, one file per domain, schema + inferred type exported together — add new schemas here |
| P1 | `packages/ui/src/shared/rich-editor/rich-editor.tsx` | 21-27 | `RichEditorProps` — controlled `content`/`onChange` API, no built-in form/RHF integration |
| P1 | `apps/web/src/components/shared/patient-contract.tsx` | 1-60, 304-384, 448-462 | Import path `@ventre/ui/shared/rich-editor`, `RichEditor` usage example, and the `readonly`-mode block (with the commented-out `signatureInfo` block at 308-321) where the new "solicitações de alteração" section is inserted |
| P2 | `apps/web/src/lib/safe-action.ts` | 1-37 | `authActionClient` context shape: `{ supabase, supabaseAdmin, user, profile }`, `profile.enterprise_id` derivation |
| P2 | `CLAUDE.md` | — | `pnpm db:types` must run after any migration; Supabase clients usage rules |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|-------------|
| [PostgreSQL CREATE POLICY](https://www.postgresql.org/docs/current/sql-createpolicy.html) | USING vs WITH CHECK | If a bespoke RLS UPDATE policy is ever added instead of the service-role approach, note the "USING clause reused as implicit WITH CHECK" gotcha — a `USING (status = 'pending')` policy would also block writing the *new* row to `status = 'resolved'` unless an explicit WITH CHECK is given. This plan avoids the gotcha entirely by using the service-role-write pattern, but it's documented here as the reason that choice was made. |
| DOMPurify (referenced via web research, no fixed doc URL beyond project usage) | HTML sanitization before `dangerouslySetInnerHTML` | `message_html` is raw HTML from `RichEditor`; sanitize before ever rendering it back — see Gotcha below |

---

## Patterns to Mirror

**MIGRATION_TABLE_PATTERN** (status/audit child table, RLS SELECT visibility triad, RLS INSERT ownership):
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260814000002_create_contract_signatures_table.sql:1-32
CREATE TABLE public.contract_signatures (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_role text NOT NULL CHECK (signer_role IN ('professional', 'patient')),
  signer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ...
);

CREATE POLICY "View contract signatures" ON public.contract_signatures FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.contracts
    WHERE contracts.id = contract_signatures.contract_id
    AND (
      public.is_team_member(contracts.patient_id)
      OR public.is_enterprise_patient(contracts.patient_id)
      OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = contracts.patient_id AND patients.user_id = auth.uid())
    )
  )
);

CREATE POLICY "Insert own contract signature" ON public.contract_signatures FOR INSERT WITH CHECK (
  signer_id = auth.uid()
);
```

**SERVICE_ROLE_UPDATE_PATTERN** (professional-side status transition, no bespoke RLS UPDATE policy):
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260710000001_patient_invite_links_extend.sql:23-25
DROP POLICY "Update invite links" ON public.patient_invite_links;
CREATE POLICY "Update invite links" ON public.patient_invite_links
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
```

**PATIENT_ACTION_PATTERN** (auth guard, ownership check, RLS-respecting insert, revalidate, capture event):
```ts
// SOURCE: apps/web/src/actions/sign-contract-as-patient-action.ts:1-78 (full file)
"use server";

export const signContractAsPatientAction = authActionClient
  .inputSchema(signContractAsPatientSchema)
  .action(async ({ parsedInput: { patientId }, ctx: { supabase, user, profile } }) => {
    if (profile.user_type !== "patient") {
      throw new Error("Apenas a gestante pode assinar como paciente.");
    }
    const { data: patientRow } = await supabase
      .from("patients")
      .select("id, user_id")
      .eq("id", patientId)
      .single();
    if (!patientRow || patientRow.user_id !== user.id) {
      throw new Error("Você não tem permissão para assinar este contrato.");
    }
    // ... domain checks, then RLS-respecting insert via `supabase`
    revalidatePath(`/patients/${patientId}/profile`);
    await captureServerEvent(user.id, "sign_contract_as_patient", { patient_id: patientId });
    return { success: true };
  });
```

**PROFESSIONAL_DUAL_BRANCH_AUTH_PATTERN** (enterprise staff vs. non-enterprise creator):
```ts
// SOURCE: apps/web/src/actions/sign-patient-contract-action.ts:49-62
if (profile.enterprise_id) {
  if (!isStaff(profile)) {
    throw new Error("Apenas gestores ou secretárias podem assinar pelo lado CONTRATADA.");
  }
} else {
  const { data: patientRow } = await supabase
    .from("patients")
    .select("created_by")
    .eq("id", patientId)
    .single();
  if (patientRow?.created_by !== user.id) {
    throw new Error("Apenas a profissional responsável pode assinar pelo lado CONTRATADA.");
  }
}
```

**ZOD_SCHEMA_PATTERN** (rich-text emptiness check, schema + type export):
```ts
// SOURCE: apps/web/src/lib/validations/contract.ts:5-16
function isRichTextEmpty(html: string) {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

export const patientContractFormSchema = z.object({
  ...
  clauses_html: z
    .string()
    .refine((html) => !isRichTextEmpty(html), "As cláusulas não podem estar vazias"),
});
```

**RICH_EDITOR_USAGE_PATTERN** (controlled component, manual state + submit-time validation):
```tsx
// SOURCE: apps/web/src/components/shared/patient-contract.tsx:449-461
<RichEditor
  content={clausesHtml}
  onChange={(html) => {
    setClausesHtml(html);
    if (fieldErrors.clausesHtml)
      setFieldErrors((prev) => ({ ...prev, clausesHtml: undefined }));
  }}
  placeholder="Cláusulas do contrato..."
  className={cn(
    "max-h-[400px] min-h-[200px] bg-white",
    fieldErrors.clausesHtml && "border-destructive",
  )}
/>
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `packages/supabase/supabase/migrations/20260815000001_create_contract_change_requests_table.sql` | CREATE | New table, RLS, partial unique index, GRANTs |
| `packages/supabase/src/types/database.types.ts` | UPDATE (generated) | Run `pnpm db:types` after migration — do not hand-edit |
| `apps/web/src/lib/validations/contract-change-request.ts` | CREATE | Zod schemas: `createContractChangeRequestSchema`, `resolveContractChangeRequestSchema` |
| `apps/web/src/actions/create-contract-change-request-action.ts` | CREATE | Patient-side create action |
| `apps/web/src/actions/resolve-contract-change-request-action.ts` | CREATE | Professional-side resolve action |
| `apps/web/src/components/shared/request-contract-change-dialog.tsx` | CREATE | Patient-facing dialog wrapping `RichEditor`, calls create action |
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | Add "Solicitações de alteração" list + resolve button in `readonly` mode, fetch pending/resolved requests for the current contract |
| `apps/web/src/actions/get-patient-contract-action.ts` | UPDATE | Include `contract_change_requests` rows for the active contract in the response payload so `patient-contract.tsx` can render them without a second round trip |

---

## NOT Building (Scope Limits)

- The patient-facing contract view/page itself (where `RequestContractChangeDialog` gets mounted
  for the gestante) — that page ships in **Phase 5** ("Home da gestante — pendências e
  assinados"). This phase builds the dialog component fully functional and ready to mount, but
  does not create a new patient-facing route.
- Push/WhatsApp notifications on request-created / request-resolved — **Phase 4**.
- Revocation/recreation of a contract after a change request on an already-fully-signed contract
  — **Phase 6**. This phase's `contract_change_requests` only applies to contracts still pending
  (professional-unsigned or professional-signed-but-not-patient-signed); nothing here writes to
  `contracts` at all.
- A numeric rate limit / cap on number of requests per contract — the partial unique index (at
  most one *open* request per contract at a time) is sufficient guardrail for v1; a hard count
  cap is unvalidated product policy (see PRD Open Questions) and would be speculative scope.
- Any RLS UPDATE policy — resolution is handled via `supabaseAdmin` after an app-level check,
  matching the `patient_invite_links` precedent, not via a new RLS UPDATE policy.

---

## Step-by-Step Tasks

### Task 1: CREATE migration `packages/supabase/supabase/migrations/20260815000001_create_contract_change_requests_table.sql`

- **ACTION**: CREATE table + RLS + partial unique index + GRANTs
- **IMPLEMENT**:
  ```sql
  CREATE TABLE public.contract_change_requests (
    id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
    patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    requested_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    message_html text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    CONSTRAINT contract_change_requests_resolved_consistency
      CHECK (
        (status = 'pending' AND resolved_at IS NULL AND resolved_by IS NULL)
        OR (status = 'resolved' AND resolved_at IS NOT NULL AND resolved_by IS NOT NULL)
      )
  );

  CREATE INDEX idx_contract_change_requests_contract_id ON public.contract_change_requests (contract_id);

  -- Only one open request per contract at a time
  CREATE UNIQUE INDEX one_pending_change_request_per_contract
    ON public.contract_change_requests (contract_id)
    WHERE status = 'pending';

  ALTER TABLE public.contract_change_requests ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View contract change requests" ON public.contract_change_requests FOR SELECT USING (
    public.is_team_member(patient_id)
    OR public.is_enterprise_patient(patient_id)
    OR EXISTS (SELECT 1 FROM public.patients WHERE patients.id = contract_change_requests.patient_id AND patients.user_id = auth.uid())
  );

  CREATE POLICY "Insert own contract change request" ON public.contract_change_requests FOR INSERT WITH CHECK (
    requested_by = auth.uid()
  );

  CREATE POLICY "Update contract change requests" ON public.contract_change_requests
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);

  GRANT SELECT, INSERT ON TABLE public.contract_change_requests TO authenticated, service_role;
  GRANT UPDATE ON TABLE public.contract_change_requests TO service_role;
  GRANT SELECT ON TABLE public.contract_change_requests TO anon;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260814000002_create_contract_signatures_table.sql:1-59` (table/RLS shape), `20260710000001_patient_invite_links_extend.sql:23-25` (service-role UPDATE policy)
- **GOTCHA**: `status` stays `text` + CHECK, not a native Postgres enum — matches the `contract_signatures.signer_role` / `patient_invite_links.invite_type` convention already used everywhere in this schema. Per web research, this means `pnpm db:types` will type `status` as plain `string`, not a literal union — re-derive the literal union in the Zod schema (`z.enum(['pending', 'resolved'])`) as the app-layer source of truth instead of relying on generated types for narrowing.
- **GOTCHA**: do NOT add a bespoke RLS UPDATE policy scoped by role for the resolve action — `USING`/`WITH CHECK` reuse means a `USING (status = 'pending')` policy would also block the write transitioning `status` to `'resolved'` unless an explicit `WITH CHECK` is added. The service-role UPDATE (matching `patient_invite_links`) sidesteps this; authorization is enforced in the resolve action instead (Task 4).
- **VALIDATE**: `pnpm db:push` applies cleanly against local/remote Supabase; `pnpm db:types` regenerates `database.types.ts` and includes `contract_change_requests` Row/Insert/Update shapes

### Task 2: RUN `pnpm db:types` to regenerate `packages/supabase/src/types/database.types.ts`

- **ACTION**: UPDATE (generated file, do not hand-edit)
- **VALIDATE**: `pnpm check-types` — confirm `contract_change_requests` types are present and no other package breaks

### Task 3: CREATE `apps/web/src/lib/validations/contract-change-request.ts`

- **ACTION**: CREATE Zod schemas for both actions
- **IMPLEMENT**:
  ```ts
  import { z } from "zod";

  function isRichTextEmpty(html: string) {
    return html.replace(/<[^>]*>/g, "").trim().length === 0;
  }

  export const createContractChangeRequestSchema = z.object({
    patientId: z.string().uuid(),
    messageHtml: z
      .string()
      .refine((html) => !isRichTextEmpty(html), "A mensagem não pode estar vazia"),
  });
  export type CreateContractChangeRequestInput = z.infer<typeof createContractChangeRequestSchema>;

  export const resolveContractChangeRequestSchema = z.object({
    requestId: z.string().uuid(),
    patientId: z.string().uuid(),
  });
  export type ResolveContractChangeRequestInput = z.infer<typeof resolveContractChangeRequestSchema>;
  ```
- **MIRROR**: `apps/web/src/lib/validations/contract.ts:5-16, 67-74` — same `isRichTextEmpty` helper (duplicated locally, matching how the existing file keeps its own copy rather than sharing one — no shared util module exists for this today), same schema+type export shape
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/actions/create-contract-change-request-action.ts`

- **ACTION**: CREATE patient-side action
- **IMPLEMENT**:
  ```ts
  "use server";

  import { captureServerEvent } from "@/lib/posthog/server";
  import { authActionClient } from "@/lib/safe-action";
  import { createContractChangeRequestSchema } from "@/lib/validations/contract-change-request";
  import { revalidatePath } from "next/cache";

  export const createContractChangeRequestAction = authActionClient
    .inputSchema(createContractChangeRequestSchema)
    .action(async ({ parsedInput: { patientId, messageHtml }, ctx: { supabase, user, profile } }) => {
      if (profile.user_type !== "patient") {
        throw new Error("Apenas a gestante pode solicitar alteração no contrato.");
      }

      const { data: patientRow } = await supabase
        .from("patients")
        .select("id, user_id")
        .eq("id", patientId)
        .single();

      if (!patientRow || patientRow.user_id !== user.id) {
        throw new Error("Você não tem permissão para solicitar alteração neste contrato.");
      }

      const { data: existing } = await supabase
        .from("contracts")
        .select("id, fully_signed_at")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .eq("is_active", true)
        .maybeSingle();

      if (!existing) throw new Error("Nenhum contrato encontrado.");
      if (existing.fully_signed_at) {
        throw new Error(
          "Este contrato já foi assinado por ambas as partes. Solicite uma revisão pelos canais de revogação.",
        );
      }

      const { error } = await supabase.from("contract_change_requests").insert({
        contract_id: existing.id,
        patient_id: patientId,
        requested_by: user.id,
        message_html: messageHtml,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe uma solicitação de alteração pendente para este contrato.");
        }
        throw new Error("Erro ao enviar solicitação. Tente novamente.");
      }

      revalidatePath(`/patients/${patientId}/profile`);

      await captureServerEvent(user.id, "create_contract_change_request", {
        patient_id: patientId,
        contract_id: existing.id,
      });

      return { success: true };
    });
  ```
- **MIRROR**: `apps/web/src/actions/sign-contract-as-patient-action.ts:1-78` (full structure: guard, ownership check, RLS-respecting insert, revalidate, capture event)
- **GOTCHA**: block requests once `fully_signed_at IS NOT NULL` (contract is immutable per the Phase 1 trigger) — a change request against a fully-signed contract belongs to the Phase 6 revoke-and-recreate flow, not this one. Checking `fully_signed_at` here (rather than `is_signed`) matches how "fully signed and locked" is determined elsewhere in this codebase (see `contracts_rewrite_immutability_and_patient_rls.sql` trigger condition).
- **GOTCHA**: catch Postgres unique-violation error code `23505` (from the partial unique index) and surface a clear Portuguese message instead of the raw DB error — the insert can legitimately race if the patient double-submits.
- **VALIDATE**: `pnpm check-types`

### Task 5: CREATE `apps/web/src/actions/resolve-contract-change-request-action.ts`

- **ACTION**: CREATE professional-side action
- **IMPLEMENT**:
  ```ts
  "use server";

  import { isStaff } from "@/lib/access-control";
  import { captureServerEvent } from "@/lib/posthog/server";
  import { authActionClient } from "@/lib/safe-action";
  import { resolveContractChangeRequestSchema } from "@/lib/validations/contract-change-request";
  import { revalidatePath } from "next/cache";

  export const resolveContractChangeRequestAction = authActionClient
    .inputSchema(resolveContractChangeRequestSchema)
    .action(async ({ parsedInput: { requestId, patientId }, ctx: { supabase, supabaseAdmin, user, profile } }) => {
      if (profile.enterprise_id) {
        if (!isStaff(profile)) {
          throw new Error("Apenas gestores ou secretárias podem resolver solicitações de alteração.");
        }
      } else {
        const { data: patientRow } = await supabase
          .from("patients")
          .select("created_by")
          .eq("id", patientId)
          .single();
        if (patientRow?.created_by !== user.id) {
          throw new Error("Apenas a profissional responsável pode resolver esta solicitação.");
        }
      }

      const { data: existing } = await supabase
        .from("contract_change_requests")
        .select("id, status, patient_id")
        .eq("id", requestId)
        .eq("patient_id", patientId)
        .maybeSingle();

      if (!existing) throw new Error("Solicitação não encontrada.");
      if (existing.status === "resolved") throw new Error("Solicitação já foi resolvida.");

      const { error } = await supabaseAdmin
        .from("contract_change_requests")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq("id", requestId);

      if (error) throw new Error("Erro ao resolver solicitação. Tente novamente.");

      revalidatePath(`/patients/${patientId}/profile`);

      await captureServerEvent(user.id, "resolve_contract_change_request", {
        patient_id: patientId,
        request_id: requestId,
      });

      return { success: true };
    });
  ```
- **MIRROR**: `apps/web/src/actions/sign-patient-contract-action.ts:49-62` (dual-branch authorization), `apps/web/src/actions/deactivate-patient-contract-action.ts` (service-role write after RLS-respecting read + app-level check — same shape as the invite-links UPDATE precedent)
- **GOTCHA**: read the row with the RLS-respecting `supabase` client first (to confirm it exists and belongs to `patientId`) before writing with `supabaseAdmin` — this avoids resolving a request for the wrong contract even though the DB-level UPDATE grant is service-role-only
- **VALIDATE**: `pnpm check-types`

### Task 6: CREATE `apps/web/src/components/shared/request-contract-change-dialog.tsx`

- **ACTION**: CREATE patient-facing dialog component
- **IMPLEMENT**: `"use client"` component taking `patientId: string`, `trigger: React.ReactNode` (or a default "Solicitar alteração" button), local `useState<string>("")` for `messageHtml`, `RichEditor` wired the same way as `patient-contract.tsx:449-461`, submit calls `createContractChangeRequestAction` via `useAction` with `onSuccess`/`onError` toasts (per `safe-actions.md` rule: treat all states), closes dialog and resets state on success
- **MIRROR**: `apps/web/src/components/shared/patient-contract.tsx:449-461` (RichEditor wiring), `ContentModal` usage at `patient-contract.tsx:356-381` (dialog shell, use `Dialog`/`ContentModal` consistent with the responsive Dialog/Sheet convention in CLAUDE.md)
- **IMPORTS**: `import { RichEditor } from "@ventre/ui/shared/rich-editor";`, `import { useAction } from "next-safe-action/hooks";`, `import { createContractChangeRequestAction } from "@/actions/create-contract-change-request-action";`
- **GOTCHA**: this component is built standalone and not yet mounted in any patient-facing route — Phase 5 owns wiring it into the gestante's home. Export it from `components/shared` so Phase 5 can import it directly.
- **VALIDATE**: `pnpm check-types`; manual render check once mounted in a temporary test route, or defer full interaction testing to Phase 5 wiring

### Task 7: UPDATE `apps/web/src/actions/get-patient-contract-action.ts`

- **ACTION**: ADD `contract_change_requests` rows to the returned payload
- **IMPLEMENT**: after resolving `existing` contract id, `select` from `contract_change_requests` where `contract_id = existing.id` ordered by `created_at desc`, include `id, message_html, status, created_at, resolved_at, requested_by` in the return shape
- **MIRROR**: existing read patterns in the same file (RLS-respecting `supabase` client, no `supabaseAdmin` needed for a read)
- **VALIDATE**: `pnpm check-types`

### Task 8: UPDATE `apps/web/src/components/shared/patient-contract.tsx`

- **ACTION**: ADD "Solicitações de alteração" section to `readonly` mode
- **IMPLEMENT**: render the list of `contract_change_requests` (from Task 7's payload) above or below the existing `signatureInfo` block area (lines 304-321), pending ones show the rich-text `message_html` (sanitize before `dangerouslySetInnerHTML` — see Gotcha below) plus a "Marcar como resolvida" button wired to `resolveContractChangeRequestAction` via `useAction`; resolved ones show a muted "Resolvida em {date}" line
- **MIRROR**: existing `useAction` wiring pattern already present in this file for `deactivatePatientContractAction`/`signPatientContractAction`
- **IMPORTS**: `import { resolveContractChangeRequestAction } from "@/actions/resolve-contract-change-request-action";`, DOMPurify (`isomorphic-dompurify` for any server-side render path, or plain `dompurify` since this is a `"use client"` component — confirm which is already a dependency before adding; if neither exists yet, add `dompurify` + `@types/dompurify` to `apps/web/package.json`)
- **GOTCHA**: `message_html` is raw HTML from `RichEditor` (Tiptap). Per web research, sanitize with DOMPurify immediately before `dangerouslySetInnerHTML`, even though Tiptap's own default extensions are unlikely to emit `<script>` — defense-in-depth against any future direct-write bypass. Use an allowlist matching what `RichEditor`'s `StarterKit`/`TextStyleKit`/`TextAlign` extensions actually emit (`p, strong, em, ul, ol, li, br, a`, plus whatever inline style attrs `TextStyleKit` needs) rather than DOMPurify's full default allowlist.
- **VALIDATE**: `pnpm check-types`; manual browser check — professional views a patient's pending change request and resolves it, list updates after `revalidatePath`

---

## Testing Strategy

### Unit Tests to Write

No test harness exists in this repo (`prp-core:codebase-explorer` confirmed zero `*.test.ts`/`*.test.tsx` files under `apps/web/src`). This phase does not introduce one — consistent with the rest of the `patient-contract-signature` feature (Phases 1-2 shipped without tests). Validation is via `pnpm check-types` + manual browser verification per task.

### Edge Cases Checklist

- [ ] Patient tries to submit a second change request while one is still pending → blocked by the partial unique index, surfaced as a clear Portuguese error (not a raw Postgres error)
- [ ] Patient tries to request a change on a contract that's already `fully_signed_at IS NOT NULL` → blocked at the action level with a message pointing to the (future, Phase 6) revoke flow
- [ ] Non-owner patient (`patients.user_id !== auth.uid()`) tries to create a request for someone else's contract → blocked by both the action-level ownership check and the RLS SELECT policy on the underlying `patients`/`contracts` lookups
- [ ] Professional not authorized as CONTRATADA (wrong non-enterprise creator, or enterprise non-staff) tries to resolve → blocked by the dual-branch check, mirroring Phase 2's signing authorization
- [ ] Resolving an already-resolved request → blocked with "Solicitação já foi resolvida."
- [ ] `message_html` containing only empty tags (e.g. `<p></p>`) → blocked by `isRichTextEmpty` Zod refine, both client (dialog submit) and server (action re-validates via the same schema)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/actions/create-contract-change-request-action.ts apps/web/src/actions/resolve-contract-change-request-action.ts apps/web/src/lib/validations/contract-change-request.ts apps/web/src/components/shared/request-contract-change-dialog.tsx apps/web/src/components/shared/patient-contract.tsx
```
**EXPECT**: Exit 0, no errors or warnings

### Level 2: DATABASE_VALIDATION
Use Supabase MCP / `pnpm db:push` + `pnpm db:types` to verify:
- [ ] `contract_change_requests` table created with correct columns and constraints
- [ ] RLS enabled, SELECT/INSERT/UPDATE policies present as specified
- [ ] Partial unique index `one_pending_change_request_per_contract` present
- [ ] `database.types.ts` regenerated and includes the new table's Row/Insert/Update types

### Level 3: MANUAL_VALIDATION
1. As a patient user (`profile.user_type = 'patient'`, `patients.user_id = auth.uid()`), call `createContractChangeRequestAction` (e.g. via a temporary test trigger since the dialog isn't mounted to a route yet) against her own pending contract — expect success and a new row.
2. Repeat immediately — expect the "already pending" error, not a raw DB error.
3. As the responsible professional, open `patient-contract.tsx` readonly view for that patient — expect to see the pending request with its message rendered (sanitized) and a resolve button.
4. Click resolve — expect the row to flip to `resolved`, `resolved_by`/`resolved_at` set, UI updates after `revalidatePath`.
5. As an unrelated professional (not on the patient's team, not the creator), attempt to resolve — expect rejection.

---

## Acceptance Criteria

- [ ] `contract_change_requests` table exists with RLS matching the plan, one open request per contract enforced by a partial unique index
- [ ] Patient can create a change request against her own pending (not-yet-fully-signed) contract; blocked otherwise
- [ ] Authorized professional (enterprise staff or non-enterprise creator) can resolve a pending request; unauthorized users cannot
- [ ] `patient-contract.tsx` readonly mode surfaces pending/resolved requests with sanitized HTML rendering
- [ ] `pnpm check-types` passes with zero errors
- [ ] No regressions to existing contract signing flows (Phase 1/2 behavior unchanged — this phase adds a new table and two new actions, touches no existing signing code path)

---

## Completion Checklist

- [ ] All 8 tasks completed in order
- [ ] Each task validated immediately after completion (`pnpm check-types` at minimum)
- [ ] Level 1: Static analysis passes
- [ ] Level 2: Database validation passes (table, RLS, index, generated types)
- [ ] Level 3: Manual validation walkthrough passes
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| RLS UPDATE policy authored with implicit USING/WITH CHECK reuse blocks the pending→resolved transition | LOW (mitigated by design) | MED | This plan deliberately uses the service-role UPDATE pattern (matching `patient_invite_links`) instead of a bespoke role-conditional RLS UPDATE policy, sidestepping the gotcha entirely |
| Raw `message_html` rendered unsanitized enables stored XSS if a future write path bypasses `RichEditor`'s own safety | MED | MED | Sanitize with DOMPurify immediately before `dangerouslySetInnerHTML` in `patient-contract.tsx`, using a tight allowlist matching `RichEditor`'s actual output tags, not the full default allowlist |
| Patient double-submits and hits the partial unique index race | MED | LOW | Catch Postgres `23505` in the create action and surface a clear message instead of a raw DB error |
| `RequestContractChangeDialog` ships with no mount point until Phase 5 | HIGH (by design) | LOW | Explicitly scoped as intentional in "NOT Building" — component is fully functional and exported, Phase 5 wires it in; does not block this phase's acceptance criteria |
| `status` as `text`+CHECK loses compile-time narrowing in generated `database.types.ts` | HIGH (known tradeoff) | LOW | Zod `z.enum(['pending','resolved'])` in `contract-change-request.ts` is the app-layer source of truth for the literal union, independent of generated types — matches how the rest of the codebase already treats CHECK-constrained `text` status columns |

---

## Notes

- `requested_by` on the new table is always the patient's `user.id` in this phase (only the
  gestante creates requests, per PRD scope) — the column is still named generically
  (`requested_by`, not `patient_user_id`) in case a symmetric "professional requests a
  countersign correction" flow is ever added later, but no such flow is being built now; don't
  add branching logic for a professional-originated request in this phase.
- The gate `hasUnfilledFields()` used by Phase 2's signing actions is intentionally NOT reused
  here — a change request is exactly the mechanism for flagging that something (potentially an
  unfilled field) is wrong before signing, so it should not itself be blocked by the same gate.
- Migration filename uses today's date (`20260815`) per the existing `YYYYMMDDHHmmss`-shaped
  convention seen in the Phase 1 migrations (`20260814000001`-`20260814000005`); confirm no
  collision with any migration landed between plan-writing and implementation time before
  running `pnpm db:push`.
