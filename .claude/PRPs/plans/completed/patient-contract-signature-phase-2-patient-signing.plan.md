# Feature: Assinatura pela Gestante + Gate de Campos Ausentes + Autorização do Lado CONTRATADA

## Summary

Fase 1 já entregou o modelo de dados (`contract_signatures`, `contracts.fully_signed_at`, RLS de
leitura da gestante). Esta fase é puramente de camada de aplicação — **nenhuma migration nova é
necessária**. Três entregas: (1) uma nova server action que permite à gestante assinar um
contrato já gerado/assinado pela profissional, reaproveitando a trilha de auditoria
(`contract_signatures`) sem re-renderizar o PDF; (2) uma checagem centralizada que bloqueia
qualquer assinatura enquanto restar `"[não informado]"` no cabeçalho do contrato; (3) uma
validação de autorização na ação de assinatura já existente da profissional, já que hoje
**qualquer** membro da equipe consegue assinar pelo lado CONTRATADA sem checagem nenhuma — bug
confirmado no relatório da Fase 1.

## User Story

Como gestante, quero assinar digitalmente o contrato já preparado pela minha profissional, com
a mesma trilha de auditoria (IP, dispositivo, hora) que já existe para a assinatura dela, para
que o acordo fique formalizado sem eu precisar sair da plataforma.

## Problem Statement

Hoje só a profissional pode assinar (e qualquer membro da equipe pode fazê-lo, mesmo quando o
contrato pertence a uma empresa e deveria ser assinado só pela gestora). A gestante não tem
nenhuma forma de assinar, e nada impede que um contrato com campos "[não informado]" seja
assinado e vire um documento imutável incompleto.

## Solution Statement

Nova ação `signContractAsPatientAction`, menor que a da profissional (a gestante não edita
conteúdo — só consente e assina), que: valida que `profile.user_type === 'patient'` e que
`patients.user_id === user.id` para o `patientId` informado; exige que a profissional já tenha
assinado (`existing.is_signed === true`); bloqueia se `parties_details` ainda tiver
`"[não informado]"`; insere a linha em `contract_signatures` (`signer_role: 'patient'`)
reaproveitando o `verification_code` já gravado em `contracts` (não gera um novo PDF — o PDF
final continua sendo o já produzido no momento da assinatura da profissional, ver Decisions
Log). Um helper `hasUnfilledFields()` centraliza a checagem de campos ausentes, chamado tanto
pela ação da gestante quanto pela ação existente da profissional. A ação da profissional ganha
um bloco de autorização logo após `buildPatientContractParties()` resolver: contrato de
empresa → só `isStaff(profile)`; contrato multi-profissional sem empresa → só
`patients.created_by === user.id`.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | NEW_CAPABILITY (ação da gestante) + ENHANCEMENT (autorização + gate na ação existente) |
| Complexity       | MEDIUM — reaproveita pipeline já validado na Fase 1; não há migration nova |
| Systems Affected | `apps/web/src/actions/`, `apps/web/src/lib/validations/contract.ts`, `apps/web/src/lib/contract-header-text.ts` |
| Dependencies     | `next-safe-action@^8.1.4`, `zod@~3.24.1` (ambos já em uso, sem mudança de versão) |
| Estimated Tasks  | 6                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════╗
║                          BEFORE STATE                              ║
╠═══════════════════════════════════════════════════════════════════╣
║  sign-patient-contract-action.ts (profissional)                    ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │ QUALQUER membro da equipe pode chamar → assina como         │   ║
║  │ signer_role='professional', sem checar se é a pessoa certa  │   ║
║  │ (gestora da empresa / profissional responsável)             │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║         │                                                          ║
║         ▼                                                          ║
║  contrato pode ser assinado mesmo com "[não informado]" no         ║
║  cabeçalho — nenhuma checagem existe                               ║
║                                                                     ║
║  Gestante: NENHUMA ação de assinatura disponível — só a            ║
║  profissional consegue assinar pela plataforma.                    ║
║                                                                     ║
║  PAIN_POINT: autorização ausente + placeholder pode vazar para o   ║
║  PDF imutável assinado + gestante não tem como formalizar sua      ║
║  parte do acordo.                                                  ║
╚═══════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════╗
║                           AFTER STATE                               ║
╠═══════════════════════════════════════════════════════════════════╣
║  sign-patient-contract-action.ts (profissional)                    ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │ buildPatientContractParties() resolve                       │   ║
║  │  → hasUnfilledFields(parties_details)? bloqueia se true      │   ║
║  │  → empresa? isStaff(profile) : patients.created_by===user.id │   ║
║  │    caso contrário: throw (nenhuma escrita acontece)          │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║         │ autorizado                                               ║
║         ▼                                                          ║
║  contracts UPDATE/INSERT → PDF → hash → contract_signatures        ║
║  INSERT (signer_role='professional')  [fluxo já existente]         ║
║                                                                     ║
║  sign-contract-as-patient-action.ts (NOVA)                         ║
║  ┌────────────────────────────────────────────────────────────┐   ║
║  │ profile.user_type==='patient' AND patients.user_id===user.id│   ║
║  │  → existing.is_signed===true? (profissional já assinou)      │   ║
║  │  → hasUnfilledFields(existing.parties_details)? bloqueia      │   ║
║  │  → contract_signatures INSERT (signer_role='patient',        │   ║
║  │    reaproveita verification_code já existente em contracts)  │   ║
║  └────────────────────────────────────────────────────────────┘   ║
║         │                                                           ║
║         ▼                                                           ║
║  Trigger da Fase 1 detecta as duas linhas → contracts.fully_signed_at ║
║  setado automaticamente                                             ║
║                                                                     ║
║  VALUE_ADD: só a pessoa certa assina pelo lado CONTRATADA; nenhum  ║
║  contrato incompleto vira documento assinado; gestante ganha uma   ║
║  ação real de assinatura (UI vem na Fase 5).                       ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

Esta fase também é de camada de aplicação (server actions) — não há UI nova (a UI da gestante
para acionar a assinatura é Fase 5, que depende desta). Nenhuma mudança visível para a
profissional em uso normal (autorização passa quando ela é a pessoa certa); usuárias sem
permissão passam a receber um erro claro em vez de conseguir assinar indevidamente.

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `sign-patient-contract-action.ts` | Qualquer membro da equipe assina pelo CONTRATADA | Só `isStaff` (empresa) ou `patients.created_by` (sem empresa) consegue assinar | Tentativa não autorizada recebe erro claro em vez de assinar indevidamente |
| `sign-patient-contract-action.ts` / nova ação da gestante | Nenhuma checagem de `[não informado]` | Assinatura bloqueada enquanto houver campo pendente | Erro claro em vez de contrato incompleto virar documento imutável |
| (nova) `sign-contract-as-patient-action.ts` | Não existe | Gestante consegue assinar (via chamada de action; UI na Fase 5) | Gestante formaliza sua parte do contrato pela plataforma |

---

## Mandatory Reading

**CRITICAL: Ler estes arquivos antes de iniciar qualquer task.**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/actions/sign-patient-contract-action.ts` | 1-191 (full file, estado atual pós-Fase 1) | Ação a receber autorização + gate; template para a nova ação da gestante |
| P0 | `apps/web/src/lib/contract-header-text.ts` | 1-142 (full file) | Onde `"[não informado]"` é gerado — `na` precisa ser exportado e um helper `hasUnfilledFields()` adicionado aqui |
| P0 | `apps/web/src/lib/contract-parties.ts` | full file | `buildPatientContractParties` — branch empresa vs. autônoma, shape de `ContractHeaderBlocks` |
| P1 | `apps/web/src/lib/access-control.ts` | 1-26 (full file) | `isStaff`/`isManager`/`isSecretary`/`isPatient` — usar exatamente esses helpers, não reimplementar |
| P1 | `apps/web/src/actions/delete-pregnancy-action.ts` | 17-31 | Padrão exato de checagem `created_by === user.id` combinada com `isStaff` |
| P1 | `apps/web/src/actions/register-installment-payment-action.ts` | 16-38 | Padrão de checagem `user_type === 'patient'` + resolução de "dono" via query antes de comparar com `user.id` |
| P1 | `apps/web/src/lib/validations/contract.ts` | 1-66 (full file) | `signPatientContractSchema`/`savePatientContractSchema` — schema novo da gestante é mais enxuto, só `patientId` + `consent` |
| P2 | `apps/web/src/lib/safe-action.ts` | full file | Confirma que `ctx.profile` (`ProfileWithEnterprise`) já traz `user_type` e `enterprise_id` sem query extra |
| P2 | `packages/supabase/src/types/database.types.ts` | região `patients` (Row/Insert/Update) | Confirma `created_by: string` (not null) e `user_id: string \| null` — colunas distintas, não confundir |

**External Documentation**: nenhuma pesquisa externa nova necessária nesta fase — toda a
implementação reaproveita padrões e bibliotecas já em uso no projeto (`next-safe-action@8.1.4`,
`zod@3.24.1`, sem funcionalidade nova dessas libs sendo introduzida). A pesquisa jurídica/legal
(MP 2.200-2/2001) já foi feita e documentada no PRD e no plano da Fase 1.

---

## Patterns to Mirror

**AUTHORIZATION_STAFF_OR_CREATOR (a replicar na ação da profissional):**
```typescript
// SOURCE: apps/web/src/actions/delete-pregnancy-action.ts:17-31
const { data: pregnancy, error: pregnancyError } = await supabase
  .from("pregnancies")
  .select("id, patient:patients(name, created_by)")
  .eq("patient_id", parsedInput.patientId)
  .eq("has_finished", false)
  .single();

if (!pregnancy || pregnancyError) {
  throw new Error("Erro: Gestante não encontrada.");
}

const isCreator = pregnancy?.patient?.created_by === user.id;
if (!isCreator && !isStaff(profile)) {
  throw new Error("Apenas o criador ou um membro da staff pode excluir a gestante");
}
```

**AUTHORIZATION_OWNER_VIA_QUERY (a replicar na ação da gestante):**
```typescript
// SOURCE: apps/web/src/actions/register-installment-payment-action.ts:16-38
if (profile.user_type !== "patient") throw new Error("Apenas pacientes podem registrar pagamentos.");
// ... query para resolver o dono real, depois comparar com user.id
if (!ownerUserId || ownerUserId !== user.id) {
  throw new Error("Você não tem permissão para registrar este pagamento.");
}
```

**ACCESS_CONTROL_HELPERS (usar, não reimplementar):**
```typescript
// SOURCE: apps/web/src/lib/access-control.ts:1-26
export function isManager(profile: UserProfile): boolean {
  return profile?.user_type === "manager";
}
export function isSecretary(profile: UserProfile): boolean {
  return profile?.user_type === "secretary";
}
export function isStaff(profile?: UserProfile): boolean {
  if (!profile) return false;
  return isManager(profile) || isSecretary(profile);
}
```

**ENTERPRISE_VS_AUTONOMOUS_BRANCH (já usado, mesma condição a reaproveitar na autorização):**
```typescript
// SOURCE: apps/web/src/actions/sign-patient-contract-action.ts:74-75
enterprise_id: profile.enterprise_id ?? null,
user_id: profile.enterprise_id ? null : user.id,
```

**CONTRACT_SIGNATURES_INSERT (já existe, reaproveitar o mesmo shape para o papel `patient`):**
```typescript
// SOURCE: apps/web/src/actions/sign-patient-contract-action.ts:158-166 (pós-Fase 1)
const { error: signatureInsertError } = await supabase.from("contract_signatures").insert({
  contract_id: contractId,
  signer_role: "professional",
  signer_id: user.id,
  signed_at: signedAt,
  signed_ip: signedIp,
  signed_user_agent: signedUserAgent,
  verification_code: verificationCode,
});
```

**SCHEMA_STRUCTURE (para o novo schema, menor que o da profissional):**
```typescript
// SOURCE: apps/web/src/lib/validations/contract.ts:59-63
export const signPatientContractSchema = savePatientContractSchema.extend({
  consent: z.literal(true, {
    errorMap: () => ({ message: "É necessário aceitar os termos para assinar" }),
  }),
});
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `apps/web/src/lib/contract-header-text.ts` | UPDATE | Exportar `na` (ou constante equivalente) e adicionar `hasUnfilledFields(blocks: ContractHeaderBlocks): boolean` |
| `apps/web/src/lib/validations/contract.ts` | UPDATE | Adicionar `signContractAsPatientSchema` (`{ patientId: z.string().uuid(), consent: z.literal(true, {...}) }`) |
| `apps/web/src/actions/sign-patient-contract-action.ts` | UPDATE | Inserir bloco de autorização (empresa → `isStaff`; sem empresa → `patients.created_by`) + chamada a `hasUnfilledFields()` antes de persistir |
| `apps/web/src/actions/sign-contract-as-patient-action.ts` | CREATE | Nova ação: autorização de identidade da gestante, exige profissional já assinada, gate de campos ausentes, insere `contract_signatures` (`signer_role: 'patient'`) |

---

## NOT Building (Scope Limits)

- UI para a gestante acionar a assinatura — Fase 5 (home da gestante) consome esta ação, mas não
  é construída aqui.
- Regeneração do PDF final com os dois blocos de assinatura visíveis — o PDF assinado continua
  sendo o gerado no momento da assinatura da profissional (ver Decisions Log); um segundo bloco
  de assinatura visual no documento é um follow-up separado, não desta fase.
- Fluxo de "solicitar alteração" — Fase 3 (pode rodar em paralelo, mas é PR/branch separado).
- Notificações (push/WhatsApp) de "contrato pronto para gestante assinar" — Fase 4.
- Limite de tentativas/rate limiting na assinatura — não mencionado no PRD, fora de escopo.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e validável independentemente.

### Task 1: UPDATE `apps/web/src/lib/contract-header-text.ts`

- **ACTION**: Exportar a constante do placeholder e adicionar o helper de checagem
- **IMPLEMENT**:
  ```typescript
  export const NAO_INFORMADO = "[não informado]"; // substitui o `const na` local, mesmo valor

  export function hasUnfilledFields(blocks: ContractHeaderBlocks): boolean {
    return (
      blocks.contratanteBlock.includes(NAO_INFORMADO) ||
      blocks.contratadaBlock.includes(NAO_INFORMADO) ||
      (blocks.teamMembersBlock?.includes(NAO_INFORMADO) ?? false)
    );
  }
  ```
  Substituir todos os usos internos de `na` por `NAO_INFORMADO` no restante do arquivo (renomear,
  não duplicar a constante).
- **MIRROR**: estilo de export de tipo já usado no arquivo (`export type ContractHeaderBlocks`)
- **GOTCHA**: `teamMembersBlock` é `string | null` (per `ContractHeaderBlocks`, linhas 55-59) —
  usar `?.includes(...) ?? false`, não `.includes` direto (quebraria com `null`).
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/lib/validations/contract.ts`

- **ACTION**: Adicionar schema da ação da gestante
- **IMPLEMENT**:
  ```typescript
  export const signContractAsPatientSchema = z.object({
    patientId: z.string().uuid(),
    consent: z.literal(true, {
      errorMap: () => ({ message: "É necessário aceitar os termos para assinar" }),
    }),
  });
  ```
- **MIRROR**: `signPatientContractSchema` (linhas 59-63) — mesmo padrão de `consent`, mas sem
  estender `savePatientContractSchema` (a gestante não envia `title`/`clauses_html`/`city`/`state`)
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/actions/sign-patient-contract-action.ts` — autorização

- **ACTION**: Inserir checagem de autorização logo após `buildPatientContractParties()` resolver
  (após a linha `if (!patient || !parties_details) throw new Error("Paciente não encontrada");`,
  antes do bloco de UPDATE/INSERT em `contracts`)
- **IMPLEMENT**:
  ```typescript
  import { isStaff } from "@/lib/access-control";
  // ...
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
- **MIRROR**: `apps/web/src/actions/delete-pregnancy-action.ts:17-31` (checagem `created_by` +
  `isStaff`)
- **GOTCHA**: Colocar ANTES de qualquer escrita em `contracts` (a UPDATE/INSERT de conteúdo
  começa logo depois) — autorização deve falhar sem efeito colateral algum. Não reutilizar o
  `patient` já resolvido por `buildPatientContractParties` para essa query, pois aquela função
  não seleciona `created_by` (select restrito a campos de cabeçalho) — fazer uma query separada
  e enxuta, como no exemplo.
- **VALIDATE**: `pnpm check-types`, depois manual: tentar assinar um contrato de empresa como
  profissional comum (não staff) → deve lançar erro; tentar como gestora → deve funcionar.

### Task 4: UPDATE `apps/web/src/actions/sign-patient-contract-action.ts` — gate de campos ausentes

- **ACTION**: Bloquear assinatura se `parties_details` tiver campo `"[não informado]"`
- **IMPLEMENT**: Logo após o bloco de autorização da Task 3 (mesmo ponto do arquivo):
  ```typescript
  import { hasUnfilledFields } from "@/lib/contract-header-text";
  // ...
  if (hasUnfilledFields(parties_details)) {
    throw new Error(
      "Preencha todos os dados obrigatórios antes de assinar o contrato.",
    );
  }
  ```
- **MIRROR**: estilo de guard early-return já usado no arquivo (`if (existing?.is_signed) throw new Error(...)`)
- **GOTCHA**: `parties_details` já está tipado como `ContractHeaderBlocks` neste ponto do arquivo
  (retorno de `buildPatientContractParties`) — sem necessidade de cast.
- **VALIDATE**: `pnpm check-types`, depois manual: tentar assinar um contrato de paciente sem
  CPF/RG preenchido (gera `[não informado]` no `contratanteBlock`) → deve lançar erro.

### Task 5: CREATE `apps/web/src/actions/sign-contract-as-patient-action.ts`

- **ACTION**: Nova ação de assinatura pela gestante
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { hasUnfilledFields } from "@/lib/contract-header-text";
  import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
  import { captureServerEvent } from "@/lib/posthog/server";
  import { authActionClient } from "@/lib/safe-action";
  import { signContractAsPatientSchema } from "@/lib/validations/contract";
  import { revalidatePath } from "next/cache";
  import { headers } from "next/headers";

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

      const { data: existing } = await supabase
        .from("contracts")
        .select("id, is_signed, verification_code, parties_details")
        .eq("patient_id", patientId)
        .eq("is_base_contract", false)
        .eq("is_active", true)
        .maybeSingle();

      if (!existing) throw new Error("Nenhum contrato encontrado para assinar.");
      if (!existing.is_signed) {
        throw new Error("O contrato ainda não foi assinado pela profissional.");
      }

      const { data: alreadySigned } = await supabase
        .from("contract_signatures")
        .select("id")
        .eq("contract_id", existing.id)
        .eq("signer_role", "patient")
        .maybeSingle();

      if (alreadySigned) throw new Error("Você já assinou este contrato.");

      if (hasUnfilledFields(existing.parties_details as ContractHeaderBlocks)) {
        throw new Error("O contrato tem dados pendentes e não pode ser assinado.");
      }

      const h = await headers();
      const signedIp =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
      const signedUserAgent = h.get("user-agent") ?? null;

      const { error: signatureInsertError } = await supabase.from("contract_signatures").insert({
        contract_id: existing.id,
        signer_role: "patient",
        signer_id: user.id,
        signed_ip: signedIp,
        signed_user_agent: signedUserAgent,
        verification_code: existing.verification_code,
      });

      if (signatureInsertError) {
        throw new Error("Erro ao assinar contrato. Tente novamente.");
      }

      revalidatePath(`/patients/${patientId}/profile`);

      await captureServerEvent(user.id, "sign_contract_as_patient", {
        patient_id: patientId,
        contract_id: existing.id,
      });

      return { success: true };
    });
  ```
- **MIRROR**: estrutura geral de `sign-patient-contract-action.ts` (guards early, `authActionClient`,
  `revalidatePath`, `captureServerEvent`); padrão de autorização de
  `register-installment-payment-action.ts:16-38`
- **IMPORTS**: `ContractHeaderBlocks` de `@/lib/contract-header-text` (type import)
- **GOTCHA**: Diferente da ação da profissional, o INSERT em `contract_signatures` **é** tratado
  como erro fatal aqui (`throw`, não só `console.error`) — decisão deliberada: para a gestante,
  essa linha É o próprio ato de assinar (não um registro auxiliar de auditoria sobre uma
  assinatura que já aconteceu por outro caminho como no caso da profissional, onde o `is_signed`
  em `contracts` já é a fonte de verdade principal). Se a INSERT falhar aqui, a gestante não deve
  ver "sucesso" sem ter de fato assinado.
- **VALIDATE**: `pnpm check-types`, depois manual: (a) gestante tenta assinar contrato ainda não
  assinado pela profissional → erro; (b) gestante assina contrato já assinado pela profissional
  → sucesso, linha criada em `contract_signatures`, `contracts.fully_signed_at` passa a não ser
  `NULL` (trigger da Fase 1); (c) gestante tenta assinar de novo → erro "Você já assinou este
  contrato."; (d) outro usuário (não a gestante dona do `patientId`) tenta assinar → erro de
  permissão.

### Task 6: Validação end-to-end da Fase 2

- **ACTION**: Confirmar integração completa com o trigger de conclusão da Fase 1
- **IMPLEMENT**: N/A — checklist manual (via SQL/Supabase MCP, mesmo padrão usado na Fase 1)
- **VALIDATE**:
  1. Profissional autorizada assina (Task 3 não bloqueia) → contrato normalmente assinado,
     `contract_signatures` ganha linha `signer_role='professional'`.
  2. Gestante dona do contrato assina em seguida → `contract_signatures` ganha linha
     `signer_role='patient'` → `contracts.fully_signed_at` passa a ter valor (checar via SQL:
     `SELECT fully_signed_at FROM contracts WHERE id = '<contract_id>'`).
  3. Após `fully_signed_at` setado, tentar `UPDATE` em qualquer coluna protegida do contrato via
     SQL direto → deve continuar bloqueado pelo trigger da Fase 1 (sem regressão).
  4. Profissional não-staff tenta assinar contrato de empresa → bloqueado (Task 3).
  5. Contrato com "[não informado]" no cabeçalho → bloqueado tanto para a profissional quanto
     para a gestante (Task 4 e Task 5).

---

## Testing Strategy

Não há suíte de testes automatizados no repositório para server actions (confirmado na Fase 1) —
validação via `pnpm check-types` + testes manuais/SQL, seguindo o padrão já estabelecido.

### Edge Cases Checklist

- [ ] Profissional membro de equipe (não staff, não `created_by`) tenta assinar contrato sem
      empresa vinculada, mas não é a profissional responsável (`patients.created_by`) — deve
      ser bloqueada mesmo sendo `is_team_member`.
- [ ] Gestante tenta assinar um `patientId` que não é o dela (`patients.user_id !== user.id`) —
      deve ser bloqueada mesmo que de alguma forma tenha o ID correto em mãos.
- [ ] Gestante tenta assinar antes da profissional (`existing.is_signed === false` ou contrato
      inexistente) — deve ser bloqueada com mensagem clara.
- [ ] Dupla assinatura da gestante (clique duplo/retry) — segunda tentativa deve ser bloqueada
      pelo pré-check (`alreadySigned`), não depender só da constraint única do banco.
- [ ] `teamMembersBlock` nulo (sem equipe) não deve quebrar `hasUnfilledFields()`.

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros de tipo.

### Level 2: LINT

```bash
npx biome check apps/web/src/actions/sign-contract-as-patient-action.ts apps/web/src/actions/sign-patient-contract-action.ts apps/web/src/lib/contract-header-text.ts apps/web/src/lib/validations/contract.ts
```

**EXPECT**: Sem issues.

### Level 3: MANUAL_VALIDATION

Checklist da Task 6, executado manualmente (ou via chamadas diretas às actions/SQL) contra o
ambiente de desenvolvimento antes de considerar a fase concluída.

---

## Acceptance Criteria

- [ ] Ação da profissional rejeita assinatura de quem não é `isStaff` (contrato de empresa) nem
      `patients.created_by` (contrato sem empresa)
- [ ] Ação da profissional e nova ação da gestante bloqueiam assinatura enquanto houver
      `"[não informado]"` no cabeçalho
- [ ] Nova ação `signContractAsPatientAction` grava `contract_signatures` (`signer_role: 'patient'`)
      só quando a profissional já assinou, e só para a gestante dona do `patientId`
- [ ] `contracts.fully_signed_at` é setado automaticamente (trigger da Fase 1) quando ambas as
      linhas existirem — validado end-to-end nesta fase, não só isoladamente como na Fase 1
- [ ] `pnpm check-types` e lint passam sem erro

---

## Completion Checklist

- [ ] Tasks 1-6 executadas em ordem
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 2: lint passa
- [ ] Level 3: checklist manual da Task 6 concluído
- [ ] Todos os Acceptance Criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| Autorização nova quebra o fluxo de assinatura de profissionais autônomas legítimas em produção | M | HIGH | Condição espelha exatamente a regra do PRD (`enterprise_id` setado → staff; senão → `created_by`) — para profissional autônoma sem empresa que é a própria criadora da paciente, `created_by === user.id` é o caso comum e já passa. Validar manualmente (Task 3) antes de mergear. |
| `hasUnfilledFields()` falso positivo/negativo por mudança futura no formato dos blocos de texto | L | MED | Checagem por substring simples e centralizada num único helper — qualquer ajuste futuro no formato dos blocos precisa só atualizar esse ponto |
| PDF final não mostra visualmente a assinatura da gestante (decisão desta fase: não regenerar PDF) | M | LOW | Documentado explicitamente em "NOT Building" e no Decisions Log — trilha de auditoria (`contract_signatures`) já registra a assinatura da gestante independente do PDF; representação visual é follow-up |
| Ação da gestante trata falha de INSERT como fatal, diferente da ação da profissional (que só loga) | L | LOW | Decisão deliberada documentada na Task 5 — inconsistência intencional, já que para a gestante essa linha É o ato de assinar, não um registro auxiliar |

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| PDF final ao completar assinatura dupla | Não regenerar — PDF continua sendo o gerado na assinatura da profissional | Regenerar PDF com dois blocos de assinatura ao completar `fully_signed_at` | Escopo do PRD para a Fase 2 é ação/autorização/gate, não menciona re-render de PDF; `contract_signatures` já não tem coluna de hash por assinante (decisão implícita da Fase 1) — manter consistente sem redesenhar o pipeline de PDF nesta fase |
| Falha na gravação de `contract_signatures` | Fatal (`throw`) na ação da gestante; não-fatal (`console.error`) na ação da profissional (já decidido na Fase 1) | Tornar as duas simétricas | Para a profissional, `contracts.is_signed` já é a fonte de verdade e a linha é auditoria auxiliar; para a gestante, a linha em `contract_signatures` É o próprio ato de assinar — não existe "assinatura sem essa linha" |
| Migration nova nesta fase | Nenhuma | Adicionar coluna/índice extra em `contract_signatures` | Schema da Fase 1 já cobre tudo que esta fase precisa (papéis, auditoria, unicidade) |

---

## Notes

Esta fase não mexe em nenhuma migration — é inteiramente camada de aplicação. A Fase 3
(Solicitar alteração) pode continuar rodando em paralelo em outra branch/worktree, já que não
compartilha arquivos com esta fase.

---

*Generated: 2026-08-14*
