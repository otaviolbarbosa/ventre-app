# Feature: Assinatura Eletrônica de Contratos — Fase 1 (Núcleo de assinatura)

## Context

**Source PRD**: `.claude/PRPs/prds/contract-signature.prd.md` — Phase 1 of 3 (Phases 2 "selo" and 3 "verificação pública" depend on this one).

Today the "Gerar e assinar" button in `patient-contract.tsx` only saves a draft (`savePatientContractAction`) — no consent, no hash, no immutability, no audit trail. This exposes the CONTRATADA to legal risk: a contested contract has no technical defense. Phase 1 delivers the legal core of an advanced electronic signature (Lei 14.063/2020 art. 4º): mandatory consent modal → final PDF render → SHA-256 hash → unique verification code → immutability at app + DB (trigger) level → IP/user-agent audit trail.

**User decision (this session)**: single "Gerar e assinar" button only — no separate "Salvar rascunho" button. The sign action persists the content as part of signing. `savePatientContractAction` becomes unused and is deleted (its logic moves to a shared helper + the sign action).

## Summary

Add a `signPatientContractAction` that (after a consent modal) saves the contract content, renders the final PDF via the existing `@react-pdf/renderer` pipeline, computes SHA-256 over the buffer, generates a unique 10-char verification code, uploads the PDF as an **immutable** `patient_documents` row, and stamps the `contracts` row with signature fields (`is_signed`, `signed_at`, `signed_by`, `signed_ip`, `signed_user_agent`, `content_hash`, `verification_code`, `signed_document_id`). A DB migration adds the columns, a partial unique index, and immutability triggers. UI hides "Editar contrato" post-signature and reuses the signed PDF on download.

## User Story

As a profissional autônoma (ou secretária/admin de clínica),
I want to assinar eletronicamente o contrato da paciente com consentimento explícito, hash e trilha de auditoria,
So that o documento assinado seja imutável e juridicamente defensável sem depender de ferramenta externa.

## Metadata

| Field | Value |
|---|---|
| Type | NEW_CAPABILITY |
| Complexity | MEDIUM-HIGH |
| Systems Affected | contracts table, patient_documents table + bucket, patient-contract UI, PDF route, server actions |
| Dependencies | next 16.1.0, next-safe-action ^8.1.4, @react-pdf/renderer 4.5.1, zod ~3.24.1, @supabase/supabase-js ^2.47.0 — **no new deps** |
| Estimated Tasks | 10 |

---

## UX Design

### Before State
```
[editing mode] ── "Gerar e assinar" ──► savePatientContractAction (draft save only)
                                            └─► contracts UPDATE/INSERT (title, clauses_html, parties_details)
[readonly mode] ─ "Editar contrato" always visible; content editable forever
                ─ "Baixar contrato" ──► POST /api/.../contract/pdf → NEW PDF rendered every click
PAIN: no consent, no hash, no immutability, "signed" contract fully editable, each download is a different PDF
```

### After State
```
[editing mode] ── "Gerar e assinar" ──► ContentModal (consentimento, checkbox obrigatório)
                                            └─ "Confirmar e assinar" ──► signPatientContractAction
                                                 1. valida não-assinado
                                                 2. monta parties_details (helper compartilhado)
                                                 3. upsert contracts (title, clauses_html, parties_details)
                                                 4. renderiza PDF final (renderToBuffer)
                                                 5. SHA-256(buffer) → content_hash
                                                 6. gera verification_code (retry em 23505)
                                                 7. upload patient_documents { is_immutable: true }
                                                 8. UPDATE contracts { is_signed, signed_at, signed_by,
                                                    signed_ip, signed_user_agent, content_hash,
                                                    verification_code, signed_document_id }
[readonly mode, signed] ─ "Editar contrato" HIDDEN; badge "Assinado eletronicamente em {data} · Código {code}"
                        ─ "Baixar contrato" ──► getDocumentDownloadUrlAction(signed_document_id) → SAME signed PDF
                        ─ "Excluir contrato" (soft delete) still allowed — trigger permits is_active change
DB: BEFORE UPDATE/DELETE triggers block any content change or hard delete of signed rows, even via direct SQL
```

### Interaction Changes
| Location | Before | After | User Impact |
|---|---|---|---|
| `patient-contract.tsx` editing | Button saves draft | Button opens consent modal → signs | Signing is explicit, consented, final |
| `patient-contract.tsx` readonly | Edit always available | Edit hidden when `is_signed` | Signed content locked |
| `patient-contract.tsx` download | Re-renders new PDF | Signed → reuses `signed_document_id` PDF | Hash-stable document |
| `delete-document-action.ts` | Deletes any own doc | Immutable doc → clear pt-BR error | Signed PDF undeletable |

---

## Mandatory Reading (before implementing)

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `apps/web/src/actions/save-patient-contract-action.ts` | all | Logic to extract into helper + absorb into sign action (then DELETE this file) |
| P0 | `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | 87-143 | Render/upload/rollback pipeline to extract into `contract-pdf.ts` |
| P0 | `apps/web/src/components/shared/patient-contract.tsx` | 100-108, 230-288, 313-347 | Save hook, readonly buttons, editing buttons, delete-modal pattern to mirror for consent |
| P1 | `apps/web/src/lib/safe-action.ts` | 9-37 | `authActionClient` ctx: `{ supabase, supabaseAdmin, user, profile }` |
| P1 | `packages/supabase/supabase/migrations/20260627000001_contracts.sql` | all | contracts schema + existing `handle_contracts_updated_at` trigger |
| P1 | `packages/supabase/supabase/migrations/20260206000000_patient_documents.sql` | 48-55 | `"Delete own documents"` policy to ALTER |
| P1 | `packages/supabase/supabase/migrations/20260308000001_enterprise_staff_rls_policies.sql` | 201-204 | Second DELETE policy to ALTER |
| P2 | `apps/web/src/actions/get-document-download-url-action.ts` | all | Pattern for signed-doc download reuse |
| P2 | `apps/web/src/actions/delete-document-action.ts` | all | Delete path to guard |
| P2 | `apps/web/src/lib/validations/contract.ts` | all | Where to add `signPatientContractSchema` |

**External docs / research findings:**
- [Next.js `headers()`](https://nextjs.org/docs/app/api-reference/functions/headers) — **async in Next 16, must `await headers()`**. Call it directly inside the action body (correct async context). IP: `h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip")`; UA: `h.get("user-agent")`. No parsed-UA helper in Node runtime — store raw string.
- [react-pdf #2536/#2813](https://github.com/diegomura/react-pdf/issues/2813) — **PDF output is NOT byte-deterministic** (creationDate + internal Document ID). Therefore: hash the buffer ONCE at sign time, store it, **never re-render to verify**. The uploaded buffer is the single source of truth.
- [Node crypto](https://nodejs.org/api/crypto.html) — `createHash("sha256").update(buffer).digest("hex")`; use `randomInt(0, alphabet.length)` per char (bias-free), NOT `randomBytes % n`.
- [Postgres triggers](https://www.postgresql.org/docs/current/plpgsql-trigger.html) — `WHEN (OLD.is_signed = true)` scopes the trigger; `IS DISTINCT FROM` for null-safe column comparison.
- [Partial unique index](https://www.postgresql.org/docs/current/indexes-partial.html) — `WHERE verification_code IS NOT NULL`; retry on Supabase `error.code === "23505"` (bounded, 5 attempts).
- [ALTER POLICY](https://www.postgresql.org/docs/current/sql-alterpolicy.html) — can change `USING` in place; DELETE policies only have `USING`.

---

## Patterns to Mirror

**ACTION_STRUCTURE** (`save-patient-contract-action.ts:16-22`):
```ts
export const savePatientContractAction = authActionClient
  .inputSchema(savePatientContractSchema)
  .action(async ({ parsedInput: { patientId, pregnancyId, title, clauses_html },
                   ctx: { supabase, supabaseAdmin, user, profile } }) => { ... });
```

**CONSENT_MODAL** — mirror delete-confirm modal (`patient-contract.tsx:260-285`): `ContentModal` + footer `flex justify-end gap-2 pt-2`, ghost "Cancelar" + primary action button with `isExecuting` label swap. Checkbox: `Checkbox` from `@ventre/ui/checkbox` + `Label` from `@ventre/ui/label`.

**UPSERT** (`save-patient-contract-action.ts:81-108`): select existing active non-base contract by patient → UPDATE or INSERT with `user_id: profile.enterprise_id ? null : user.id`, `enterprise_id: profile.enterprise_id ?? null`.

**RENDER+UPLOAD+ROLLBACK** (`route.ts:89-133`): `renderToBuffer(React.createElement(ContractPdfDocument, { data: {...headerBlocks, title, clausesHtml} }))`; filename `CONTRATO_${NAME}_${YYYY-MM-DD}.pdf`; path `contracts/${patientId}/${Date.now()}_${fileName}`; `supabaseAdmin.storage` upload; `supabase.from("patient_documents").insert(...)`; on insert error remove the storage object.

**MIGRATION_STYLE**: `packages/supabase/supabase/migrations/YYYYMMDDHHMMSS_description.sql`, small/single-purpose, quoted identifiers optional (recent files use unquoted); RLS altered via `ALTER POLICY ... USING (...)` (see `20260630000002`).

**ERROR/TOAST**: `throw new Error("mensagem pt-BR")` → `toast.error(error.serverError ?? "fallback")`; `revalidatePath(\`/patients/${patientId}/profile\`)` after mutation.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `packages/supabase/supabase/migrations/20260706000001_contract_signature.sql` | CREATE | Columns, index, triggers, policy updates |
| `packages/supabase/src/types/database.types.ts` | REGEN | `pnpm db:types` after `pnpm db:push` |
| `apps/web/src/lib/validations/contract.ts` | UPDATE | Add `signPatientContractSchema` |
| `apps/web/src/lib/contract-parties.ts` | CREATE | Shared `buildPatientContractParties` (extracted from save action) |
| `apps/web/src/lib/contract-pdf.ts` | CREATE | Shared render/filename/upload helpers (extracted from PDF route) |
| `apps/web/src/lib/verification-code.ts` | CREATE | `generateVerificationCode()` |
| `apps/web/src/actions/sign-patient-contract-action.ts` | CREATE | The signature action |
| `apps/web/src/actions/save-patient-contract-action.ts` | DELETE | Logic absorbed by helper + sign action (only importer is patient-contract.tsx) |
| `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | UPDATE | Use shared helpers; short-circuit to signed PDF when signed |
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | Consent modal, signed-state UI, download reuse |
| `apps/web/src/actions/delete-document-action.ts` | UPDATE | Guard immutable docs with clear error |

## NOT Building (scope limits)

- Selo visual no PDF / preview (Phase 2) e rota `/check/[codigo]` (Phase 3).
- Assinatura da paciente, ICP-Brasil, integrações terceiras (PRD Won't).
- Botão "Salvar rascunho" separado (decisão do usuário: só "Gerar e assinar").
- Esconder o botão de excluir na lista de Documentos para docs imutáveis (o guard fica na action; UI polish fora de escopo).
- Refatorar o fallback legacy de `parties_details` do PDF route (`getContractHeaderData` path) — permanece como está; serve apenas contratos pré-`parties_details`.

---

## Step-by-Step Tasks

### Task 1: CREATE migration `packages/supabase/supabase/migrations/20260706000001_contract_signature.sql`

- **IMPLEMENT**:
```sql
-- contracts: signature fields
ALTER TABLE public.contracts
  ADD COLUMN is_signed boolean NOT NULL DEFAULT false,
  ADD COLUMN signed_at timestamptz,
  ADD COLUMN signed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN signed_ip text,
  ADD COLUMN signed_user_agent text,
  ADD COLUMN content_hash text,
  ADD COLUMN verification_code text,
  ADD COLUMN signed_document_id uuid REFERENCES public.patient_documents(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_contracts_verification_code
  ON public.contracts (verification_code)
  WHERE verification_code IS NOT NULL;

-- Immutability: once signed, only is_active/updated_at may change
CREATE OR REPLACE FUNCTION public.prevent_signed_contract_mutation()
RETURNS trigger AS $$
BEGIN
  IF (OLD.title IS DISTINCT FROM NEW.title)
     OR (OLD.clauses_html IS DISTINCT FROM NEW.clauses_html)
     OR (OLD.parties_details IS DISTINCT FROM NEW.parties_details)
     OR (OLD.patient_id IS DISTINCT FROM NEW.patient_id)
     OR (OLD.pregnancy_id IS DISTINCT FROM NEW.pregnancy_id)
     OR (OLD.user_id IS DISTINCT FROM NEW.user_id)
     OR (OLD.enterprise_id IS DISTINCT FROM NEW.enterprise_id)
     OR (OLD.is_base_contract IS DISTINCT FROM NEW.is_base_contract)
     OR (OLD.is_signed IS DISTINCT FROM NEW.is_signed)
     OR (OLD.signed_at IS DISTINCT FROM NEW.signed_at)
     OR (OLD.signed_by IS DISTINCT FROM NEW.signed_by)
     OR (OLD.signed_ip IS DISTINCT FROM NEW.signed_ip)
     OR (OLD.signed_user_agent IS DISTINCT FROM NEW.signed_user_agent)
     OR (OLD.content_hash IS DISTINCT FROM NEW.content_hash)
     OR (OLD.verification_code IS DISTINCT FROM NEW.verification_code)
     OR (OLD.signed_document_id IS DISTINCT FROM NEW.signed_document_id)
     OR (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
    RAISE EXCEPTION 'Contrato assinado é imutável e não pode ser alterado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_signed_contract_update
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW WHEN (OLD.is_signed = true)
  EXECUTE FUNCTION public.prevent_signed_contract_mutation();

CREATE OR REPLACE FUNCTION public.prevent_signed_contract_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Contrato assinado não pode ser excluído';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_signed_contract_delete
  BEFORE DELETE ON public.contracts
  FOR EACH ROW WHEN (OLD.is_signed = true)
  EXECUTE FUNCTION public.prevent_signed_contract_delete();

-- patient_documents: immutable flag + delete protection
ALTER TABLE public.patient_documents
  ADD COLUMN is_immutable boolean NOT NULL DEFAULT false;

ALTER POLICY "Delete own documents" ON public.patient_documents
  USING (uploaded_by = auth.uid() AND is_immutable IS NOT TRUE);

ALTER POLICY "Enterprise staff can delete enterprise patient documents" ON public.patient_documents
  USING (public.is_enterprise_patient(patient_id) AND is_immutable IS NOT TRUE);

CREATE OR REPLACE FUNCTION public.prevent_immutable_document_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Documento imutável não pode ser excluído';
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_immutable_document_delete
  BEFORE DELETE ON public.patient_documents
  FOR EACH ROW WHEN (OLD.is_immutable = true)
  EXECUTE FUNCTION public.prevent_immutable_document_delete();
```
- **GOTCHA 1**: the existing `handle_contracts_updated_at` trigger changes `updated_at` — the mutation trigger intentionally does NOT compare `updated_at`/`is_active`, so soft-delete (`is_active=false`) still works on signed contracts (PRD risk mitigation).
- **GOTCHA 2**: the signing UPDATE itself transitions `is_signed false→true`; `WHEN (OLD.is_signed = true)` means it passes untouched.
- **GOTCHA 3**: sign-action compensation (Task 6) must flip `is_immutable=false` via `supabaseAdmin` before deleting an orphaned doc — the DELETE trigger blocks even service_role. No UPDATE trigger on `patient_documents` (no UPDATE RLS policy exists, so regular users can't flip the flag; only trusted server code can).
- **VALIDATE**: `pnpm db:push` then `pnpm db:types` (regenerates `database.types.ts` — commit it), then `pnpm check-types`.

### Task 2: UPDATE `apps/web/src/lib/validations/contract.ts`

- **IMPLEMENT**:
```ts
export const signPatientContractSchema = savePatientContractSchema.extend({
  consent: z.literal(true, {
    errorMap: () => ({ message: "É necessário aceitar os termos para assinar" }),
  }),
});
export type SignPatientContractInput = z.infer<typeof signPatientContractSchema>;
```
- **VALIDATE**: `pnpm check-types`

### Task 3: CREATE `apps/web/src/lib/contract-parties.ts`

- **IMPLEMENT**: extract `save-patient-contract-action.ts:23-79` verbatim into:
```ts
export async function buildPatientContractParties(
  { supabase, supabaseAdmin, profile }: /* ctx subset from authActionClient */,
  { patientId, pregnancyId }: { patientId: string; pregnancyId: string | null },
): Promise<{ patient: PatientRow | null; parties_details: ContractHeaderBlocks | null }>
```
  Includes the `Promise.all` fetch (patients / pregnancies / team_members), the `TeamMember` mapping, and the enterprise-vs-autonomous `buildContractHeaderBlocks` branch. Keep the comment "Build parties_details server-side — never sourced from client input".
- **MIRROR**: exact code from `save-patient-contract-action.ts:23-79`; type ctx with the `ProfileWithEnterprise` shape from `safe-action.ts`.
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/lib/contract-pdf.ts`

- **IMPLEMENT**: extract from `route.ts:87-133`:
  - `sanitizeClausesHtml(html)` — the `font-family` regex strip (`route.ts:87`)
  - `renderContractPdfBuffer({ headerBlocks, title, clausesHtml })` → `renderToBuffer(React.createElement(ContractPdfDocument, ...))` (`route.ts:89-93`)
  - `buildContractPdfFileName(patientName)` — NFD-normalize/strip logic (`route.ts:95-101`)
  - `uploadContractPdf({ supabase, supabaseAdmin, patientId, userId, fileName, buffer, isImmutable })` — builds `contracts/${patientId}/${Date.now()}_${fileName}` path, uploads (`upsert: false`), inserts `patient_documents` row **including `is_immutable: isImmutable`**, removes storage object on insert failure, returns the document row (`route.ts:103-133`).
- **GOTCHA**: this module imports `@react-pdf/renderer`/React — server-only; it is only imported by the server action and the route handler (both server contexts). Do not import it from client components.
- **VALIDATE**: `pnpm check-types`

### Task 5: CREATE `apps/web/src/lib/verification-code.ts`

- **IMPLEMENT**:
```ts
import { randomInt } from "node:crypto";
// Sem 0/O/1/I para evitar ambiguidade visual
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function generateVerificationCode(length = 10): string {
  let code = "";
  for (let i = 0; i < length; i++) code += ALPHABET[randomInt(0, ALPHABET.length)];
  return code;
}
```
- **GOTCHA**: `randomInt` (rejection sampling) — never `randomBytes % n` (modulo bias).
- **VALIDATE**: `pnpm check-types`

### Task 6: CREATE `apps/web/src/actions/sign-patient-contract-action.ts`

- **IMPLEMENT** (`authActionClient.inputSchema(signPatientContractSchema).action(...)`):
  1. Fetch active contract (`patient_id`, `is_base_contract=false`, `is_active=true`, `.maybeSingle()`); if `existing?.is_signed` → `throw new Error("Este contrato já foi assinado")`.
  2. `buildPatientContractParties(...)`; if no patient → `throw new Error("Paciente não encontrada")`.
  3. Upsert the contract content (same UPDATE/INSERT as old save action, `save-patient-contract-action.ts:89-108`), capturing `contractId` (INSERT needs `.select("id").single()`).
  4. `const buffer = await renderContractPdfBuffer({ headerBlocks: parties_details, title, clausesHtml: sanitizeClausesHtml(clauses_html) })`.
  5. `const contentHash = createHash("sha256").update(buffer).digest("hex")` (`node:crypto`).
  6. `const h = await headers()` (from `next/headers` — **await, Next 16**); `signedIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null`; `signedUserAgent = h.get("user-agent") ?? null`.
  7. `const document = await uploadContractPdf({ ..., isImmutable: true })`.
  8. Retry loop (max 5): `code = generateVerificationCode()`; UPDATE `contracts` by `contractId` with `{ is_signed: true, signed_at: new Date().toISOString(), signed_by: user.id, signed_ip, signed_user_agent, content_hash: contentHash, verification_code: code, signed_document_id: document.id }`. On `error.code === "23505"` regenerate and retry; on other error or retry exhaustion → **compensate**: `supabaseAdmin.from("patient_documents").update({ is_immutable: false }).eq("id", document.id)` → delete the row → `supabaseAdmin.storage.remove([storagePath])`, then `throw new Error(...)`.
  9. `revalidatePath(\`/patients/${patientId}/profile\`)`; return `{ success: true }`.
- **MIRROR**: action shell from `save-patient-contract-action.ts:16-22`; pt-BR errors.
- **GOTCHA**: hash computed once here, stored forever — never recomputed from a re-render (react-pdf is non-deterministic). `headers()` called directly in the action body (correct async context).
- **VALIDATE**: `pnpm check-types && npx biome check apps/web/src/actions/sign-patient-contract-action.ts`

### Task 7: UPDATE `apps/web/app/api/patients/[id]/contract/pdf/route.ts`

- **IMPLEMENT**:
  - Early return after fetching the contract: if `contract.is_signed && contract.signed_document_id` → fetch that `patient_documents` row's `storage_path`, `createSignedUrl(path, 300)`, return `{ document, signedUrl }` **without re-rendering** (guarantees the downloaded PDF always matches `content_hash`).
  - Replace inline sanitize/render/filename/upload blocks (lines 87-133) with the Task 4 helpers, passing `isImmutable: false` for regular exports.
- **VALIDATE**: `pnpm check-types`

### Task 8: UPDATE `apps/web/src/components/shared/patient-contract.tsx`

- **IMPLEMENT**:
  - Replace `savePatientContractAction` import/hook with `signPatientContractAction`; delete the old action file (`apps/web/src/actions/save-patient-contract-action.ts`) — only this component imports it.
  - New state: `isConsentOpen`, `consentChecked`, plus signed info captured in `fetchContract.onSuccess` from `data.contract` (`is_signed`, `signed_at`, `verification_code`, `signed_document_id`).
  - Editing mode: "Gerar e assinar" now `onClick={() => setIsConsentOpen(true)}`. New `ContentModal` (mirror delete modal, `patient-contract.tsx:260-285`): title "Assinar contrato eletronicamente", description explaining hash/immutability, a `Checkbox` (`@ventre/ui/checkbox`) + `Label` with consent text (e.g. "Declaro que li o contrato e concordo em assiná-lo eletronicamente. Após a assinatura, o conteúdo não poderá mais ser alterado."), confirm button disabled until checked → `signContract({ patientId, pregnancyId: pregnancyId ?? null, title, clauses_html: clausesHtml, consent: true })`; label swap `"Assinando..."`.
  - `onSuccess`: `toast.success("Contrato assinado com sucesso")`, close modal, `fetchContract({ patientId })` (existing reload pattern, lines 100-108).
  - Readonly mode, signed: hide "Editar contrato"; render a signature badge above/below the document, e.g. `Assinado eletronicamente em {formatted signed_at} · Código {verification_code}` (pt-BR date format; keep visual simple — Phase 2 does the stamp). Keep "Excluir contrato" (soft delete still allowed).
  - `handleExportPdf`: if signed with `signed_document_id` → `const res = await getDocumentDownloadUrlActionExecuteAsync({ documentId })` via `useAction`/`executeAsync` (mirror `get-document-download-url-action.ts` consumer pattern) and `window.open(url)`; else keep the POST-route path (route also short-circuits, belt-and-suspenders).
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/components/shared/patient-contract.tsx`

### Task 9: UPDATE `apps/web/src/actions/delete-document-action.ts`

- **IMPLEMENT**: add `is_immutable` to the select (line 16); before deleting: `if (document.is_immutable) throw new Error("Este documento é imutável e não pode ser excluído (contrato assinado eletronicamente)")`.
- **VALIDATE**: `pnpm check-types`

### Task 10: Full validation + DB verification

- `pnpm check-types` (all packages), `npx biome check apps/web`
- Supabase MCP (`execute_sql`) verification:
  - `UPDATE contracts SET clauses_html = 'x' WHERE is_signed = true LIMIT 1` → must RAISE.
  - `UPDATE contracts SET is_active = false WHERE is_signed = true` → must succeed.
  - `DELETE FROM patient_documents WHERE is_immutable = true` → must RAISE.
  - Confirm `idx_contracts_verification_code` exists.
- Browser manual flow (see Validation Commands).

---

## Testing Strategy

No test framework exists in the repo (confirmed — no test script/config anywhere), consistent with all 5 previous contract phases shipping without unit tests. Validation is: type-check + Biome + SQL-level trigger assertions + end-to-end browser flow.

### Edge Cases Checklist
- [ ] Sign attempt on already-signed contract → "Este contrato já foi assinado"
- [ ] Consent unchecked → confirm button disabled (and schema rejects `consent !== true`)
- [ ] `verification_code` collision → retried transparently (unique index + 23505 loop)
- [ ] Contracts UPDATE fails mid-sign → uploaded PDF/doc row compensated (unflag → delete → storage remove)
- [ ] Soft-delete of signed contract → allowed; hard delete/edit via SQL → blocked by trigger
- [ ] Signed PDF download always returns the identical stored file (never re-rendered)
- [ ] Delete immutable document via UI action → clear pt-BR error
- [ ] Missing `x-forwarded-for` locally → `signed_ip` null, signing still succeeds

## Validation Commands

1. **STATIC**: `pnpm check-types && npx biome check apps/web` → exit 0
2. **DB**: `pnpm db:push && pnpm db:types && pnpm check-types` → types regenerated, no drift
3. **SQL assertions**: via Supabase MCP `execute_sql` (Task 10 list)
4. **BROWSER (manual/Chrome MCP)**: login → paciente → Contrato → editar → "Gerar e assinar" → modal exige checkbox → confirmar → badge "Assinado eletronicamente…" aparece, "Editar contrato" some → "Baixar contrato" abre o MESMO PDF (repetir download, comparar) → em Documentos, excluir o PDF do contrato → erro claro → "Excluir contrato" (soft) ainda funciona

## Acceptance Criteria

- [ ] Consent modal (checkbox obrigatório) precede a assinatura
- [ ] `contracts` persiste `is_signed, signed_at, signed_by, signed_ip, signed_user_agent, content_hash (sha256 hex), verification_code (10 chars), signed_document_id`
- [ ] Contrato assinado: UPDATE de conteúdo e DELETE bloqueados por trigger mesmo via SQL direto; `is_active` continua mutável
- [ ] PDF assinado: `patient_documents.is_immutable = true`, não deletável (policy + trigger + action guard)
- [ ] Download pós-assinatura reutiliza o documento assinado (nunca re-renderiza)
- [ ] "Editar contrato" oculto pós-assinatura; strings em pt-BR; padrões existentes espelhados
- [ ] `save-patient-contract-action.ts` removido sem referências órfãs

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Compensation path blocked by immutable-doc trigger | M | M | Unflag `is_immutable` via service_role before delete (Task 6 step 8); no UPDATE policy exists for regular users |
| Hard-delete of a patient with signed contract now fails (FK cascade hits BEFORE DELETE triggers) | L | L | Intentional: legal retention favors blocking; patients are soft-finished in this app. Documented here; revisit if patient hard-delete is ever needed |
| `x-forwarded-for` absent/spoofed | M | L | Store nullable raw value; audit-trail only, never used for authz |
| `verification_code` collision | L | L | Partial unique index + 5-attempt retry on 23505 |
| Non-deterministic PDF breaking future verification | — | — | Designed out: hash computed once over the stored buffer; Phase 3 verifies uploads against stored hash, never re-renders |

## Notes

- Phase 1 deliberately renders the PDF **without** the visual stamp (Phase 2 adds it to `contract-pdf-document.tsx`). The stored hash covers the Phase-1 PDF; contracts signed before Phase 2 simply have no stamp — hash validity is unaffected.
- Phases 2 and 3 can run in parallel worktrees after this phase (no file overlap: Phase 2 → `contract-pdf-document.tsx`/preview; Phase 3 → new `app/check/[codigo]/`).
- **Confidence Score: 8/10** for one-pass implementation — all patterns extracted from real code, migration SQL fully drafted, main uncertainty is minor UI polish of the signed badge and the exact `ProfileWithEnterprise` typing on the extracted helper.
