# Feature: Revogação e Recriação de Contrato Pós-Assinatura Completa (Fase 6)

## Summary

Fase 6 do PRD `patient-contract-signature`. Hoje, uma vez que `contracts.fully_signed_at` é
setado (ambas as partes assinaram), não existe nenhum caminho para mudar o contrato — a única
ação que tentaria isso, `create-contract-change-request-action.ts`, lança um erro citando
"canais de revogação" que não existem no código. Este plano implementa esse canal: uma nova
ação `revoke-contract-action.ts` (profissional-only, mesma autorização já usada para assinar
pelo lado CONTRATADA) que marca o contrato vigente como revogado — via um par de colunas novas
`revoked_at`/`revoked_by` que seguem exatamente o mesmo padrão de "transição única guardada"
já usado por `fully_signed_at` — sem apagar nada (o registro permanece consultável para
auditoria). Como `is_active` já não é bloqueado pelo trigger de imutabilidade mesmo em
contratos totalmente assinados (achado confirmado pelos dois agentes de exploração), a
"recriação" não precisa de lógica nova: o próprio fluxo de criação já existente
(`sign-patient-contract-action.ts`) já tem uma branch de `INSERT` que dispara automaticamente
assim que não há mais nenhum contrato `is_active = true` para aquele paciente — bastando a UI
da profissional (`patient-contract.tsx`) resetar para o modo "select" após a revogação. Também
remove o bloqueio equivocado em `create-contract-change-request-action.ts`, que hoje impede a
gestante de sequer registrar uma solicitação de alteração num contrato totalmente assinado.

## User Story

Como profissional, quero poder revogar um contrato já assinado por ambas as partes e redigir um
novo do zero quando eu ou a gestante identificarmos a necessidade de mudança, para não ficar
presa a um contrato desatualizado sem alternativa dentro da plataforma.

## Problem Statement

`create-contract-change-request-action.ts:34-38` lança
`"Este contrato já foi assinado por ambas as partes. Solicite uma revisão pelos canais de
revogação."` sempre que `existing.fully_signed_at` está setado — bloqueando completamente
qualquer solicitação de alteração da gestante nesse estado, e referenciando um "canal de
revogação" que não existe em nenhum lugar do código (confirmado por busca no repositório
inteiro pelos dois agentes de exploração). Não há também nenhuma UI ou ação para a profissional
revogar um contrato totalmente assinado.

## Solution Statement

Adicionar `revoked_at timestamptz` e `revoked_by uuid REFERENCES users(id)` a `contracts`,
seguindo o padrão de transição única já usado por `fully_signed_at` (`UPDATE ... WHERE
revoked_at IS NULL`, mais uma linha de guarda equivalente em
`prevent_signed_contract_mutation()` para travar `revoked_at` depois do primeiro write — mesma
forma da linha já existente para `fully_signed_at`). Criar
`revoke-contract-action.ts`, mirror de `deactivate-patient-contract-action.ts` mas restrito a
contratos `fully_signed_at IS NOT NULL` e com a mesma checagem de autorização de
`sign-patient-contract-action.ts` (isStaff para empresa, `patients.created_by` para autônoma).
A ação seta `is_active = false, revoked_at = now(), revoked_by = user.id` no contrato vigente e
resolve, best-effort, qualquer `contract_change_requests` pendente vinculada a ele. Como
`is_active = false` já é suficiente para que o contrato revogado saia de todos os caminhos de
leitura que filtram por `is_active = true`
(`get-patient-contract-action.ts`, `sign-patient-contract-action.ts`), a criação do novo
contrato reaproveita o ciclo já existente sem nenhuma mudança de lógica — só é preciso resetar
a UI de `patient-contract.tsx` de volta ao modo `"select"` após a revogação, para que a
profissional redija o novo contrato pelo fluxo já validado nas Fases 1-3. Por fim, remover o
bloqueio em `create-contract-change-request-action.ts` para que a gestante também possa
registrar uma solicitação de alteração mesmo com o contrato totalmente assinado — o índice
único parcial `one_pending_change_request_per_contract` já impede duplicidade, e a nova ação de
revogação resolve solicitações pendentes ao revogar, então não há risco de "solicitação órfã".

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                        |
| Complexity       | MEDIUM                                             |
| Systems Affected | apps/web (nova action, `patient-contract.tsx`, ação de change-request existente), packages/supabase (migração) |
| Dependencies     | Nenhuma nova — reaproveita 100% de código/padrões já em produção (`sign-patient-contract-action.ts`, `deactivate-patient-contract-action.ts`, `resolve-contract-change-request-action.ts`). Sem pesquisa externa necessária. |
| Estimated Tasks  | 6                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Contrato com fully_signed_at setado (ambas as partes assinaram)             ║
║                                                                               ║
║  Gestante tenta solicitar alteração                                          ║
║    └─► createContractChangeRequestAction ──► throw "Solicite uma revisão     ║
║         pelos canais de revogação" [canal não existe] ──► BLOQUEADO          ║
║                                                                               ║
║  Profissional em patient-contract.tsx (mode="readonly")                      ║
║    └─► só pode "Editar contrato" (se ainda não assinado) ou "Excluir         ║
║         contrato" (deactivatePatientContractAction, sem checar               ║
║         fully_signed_at) — nenhuma opção de "revogar e redigir novo"         ║
║         com semântica de auditoria própria                                    ║
║                                                                               ║
║  USER_FLOW: contrato totalmente assinado é permanente, sem caminho para      ║
║  mudança dentro da plataforma.                                                ║
║  PAIN_POINT: mensagem de erro referencia um fluxo inexistente.                ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Gestante solicita alteração (mesmo com fully_signed_at setado)              ║
║    └─► createContractChangeRequestAction ──► contract_change_requests        ║
║         INSERT (bloqueio removido) ──► profissional é notificada (Fase 4)    ║
║                                                                               ║
║  Profissional em patient-contract.tsx (mode="readonly", fully signed)        ║
║    └─► [Revogar e redigir novo contrato] ──► revokeContractAction            ║
║         ├─► contracts: is_active=false, revoked_at=now(), revoked_by=user   ║
║         └─► contract_change_requests pendentes: status="resolved"            ║
║    └─► UI reseta para mode="select" ──► profissional redige contrato novo    ║
║         pelo fluxo já existente (signPatientContractAction, branch INSERT    ║
║         dispara automaticamente pois não há mais contrato is_active=true)    ║
║                                                                               ║
║  USER_FLOW: contrato totalmente assinado pode ser revogado com auditoria     ║
║  preservada, e um novo contrato é redigido pelo mesmo ciclo já validado.      ║
║  VALUE_ADD: "canal de revogação" citado no erro antigo agora existe de fato. ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `create-contract-change-request-action.ts` | Lança erro quando `fully_signed_at` setado | Aceita a solicitação normalmente | Gestante pode sinalizar necessidade de mudança mesmo pós-assinatura |
| `patient-contract.tsx` (mode `readonly`, contrato totalmente assinado) | Só "Editar" (indisponível se assinado) ou "Excluir" (sem semântica de revogação) | Novo botão "Revogar e redigir novo contrato" | Profissional tem um caminho explícito e auditável para reiniciar o ciclo |
| `contracts` (tabela) | Sem conceito de revogação | `revoked_at`/`revoked_by` — mesma transição única guardada de `fully_signed_at` | Contrato revogado permanece consultável, nunca apagado |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `packages/supabase/supabase/migrations/20260814000004_contracts_rewrite_immutability_and_patient_rls.sql` | 5-39 | Trigger a estender (Task 1) — MIRROR exato da linha de guarda de `fully_signed_at` (linha 27) para `revoked_at` |
| P0 | `packages/supabase/supabase/migrations/20260814000001_contracts_add_fully_signed_at.sql` | 1-9 | MIRROR da migração de coluna — comentário "never written directly by the application" documenta o padrão de transição única |
| P0 | `apps/web/src/actions/deactivate-patient-contract-action.ts` | 1-27 | MIRROR estrutural mais próximo para `revoke-contract-action.ts` (Task 2) — mas note que este NÃO checa `fully_signed_at`; a nova ação precisa dessa checagem adicional |
| P0 | `apps/web/src/actions/sign-patient-contract-action.ts` | 32-38, 49-62 | MIRROR da checagem de autorização (isStaff/`patients.created_by`) a copiar para `revoke-contract-action.ts`; linhas 32-38 confirmam que a query `is_active=true` já é compatível com o fluxo de revogar+recriar sem nenhuma mudança adicional |
| P0 | `apps/web/src/actions/create-contract-change-request-action.ts` | 1-63 | Ação a editar (Task 4) — remover o bloco de `throw` nas linhas 34-38 |
| P0 | `apps/web/src/actions/resolve-contract-change-request-action.ts` | 1-61 | MIRROR para resolver `contract_change_requests` pendentes dentro da nova ação (Task 2) — usa `supabaseAdmin` por causa da política `service_role`-only |
| P1 | `apps/web/src/components/shared/patient-contract.tsx` | 74, 176-188, 400-445 | Componente a editar (Task 5) — MIRROR exato do padrão "Excluir contrato" (`deactivateContract` + `ContentModal` de confirmação) para o novo botão de revogação |
| P1 | `packages/supabase/supabase/migrations/20260814000003_contract_signatures_completion_trigger.sql` | 7-29 | Referência do padrão "transição única guardada por `WHERE ... IS NULL`" já usado no domínio |
| P1 | `packages/supabase/supabase/migrations/20260706000001_contract_signature.sql` | 45-62 | `prevent_signed_contract_delete` — confirma que contratos nunca são apagados fisicamente; a revogação não interage com esse trigger |
| P2 | `packages/supabase/supabase/migrations/20260815000001_create_contract_change_requests_table.sql` | 1-30 | Índice único parcial `one_pending_change_request_per_contract` — confirma que remover o bloqueio da Task 4 não introduz risco de solicitação duplicada |

**External Documentation**: nenhuma — feature construída inteiramente com padrões já em
produção neste repositório, sem biblioteca nova.

---

## Patterns to Mirror

**MIGRAÇÃO — COLUNA DE TRANSIÇÃO ÚNICA:**

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260814000001_contracts_add_fully_signed_at.sql:1-9
-- COPY THIS PATTERN:
-- Contract dual signature (Phase 1): timestamp for when BOTH signatures
-- (professional + patient) exist for a contract. Never written directly by
-- the application — only by the contract_signatures completion trigger.
ALTER TABLE public.contracts
  ADD COLUMN fully_signed_at timestamptz;
```

**TRIGGER — GUARDA DE TRANSIÇÃO ÚNICA (linha a adicionar):**

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260814000004_contracts_rewrite_immutability_and_patient_rls.sql:27
-- COPY THIS PATTERN (adaptar coluna):
OR (OLD.fully_signed_at IS NOT NULL AND OLD.fully_signed_at IS DISTINCT FROM NEW.fully_signed_at)
```

**AÇÃO DE MUTAÇÃO SIMPLES (DEACTIVATE, mirror estrutural):**

```typescript
// SOURCE: apps/web/src/actions/deactivate-patient-contract-action.ts:1-27
// COPY THIS PATTERN:
"use server";

import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export const deactivatePatientContractAction = authActionClient
  .inputSchema(z.object({ contractId: z.string().uuid(), patientId: z.string().uuid() }))
  .action(async ({ parsedInput: { contractId, patientId }, ctx: { supabase, user } }) => {
    const { error } = await supabase
      .from("contracts")
      .update({ is_active: false })
      .eq("id", contractId)
      .eq("is_base_contract", false);

    if (error) throw new Error(error.message);

    revalidatePath(`/patients/${patientId}/profile`);

    await captureServerEvent(user.id, "deactivate_patient_contract", {
      contract_id: contractId,
      patient_id: patientId,
    });

    return { success: true };
  });
```

**AUTORIZAÇÃO — LADO CONTRATADA (a reaproveitar):**

```typescript
// SOURCE: apps/web/src/actions/sign-patient-contract-action.ts:49-62
// COPY THIS PATTERN:
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

**RESOLUÇÃO DE CHANGE REQUEST VIA ADMIN (mirror para resolver pendências ao revogar):**

```typescript
// SOURCE: apps/web/src/actions/resolve-contract-change-request-action.ts:41-48
// COPY THIS PATTERN:
const { error } = await supabaseAdmin
  .from("contract_change_requests")
  .update({
    status: "resolved",
    resolved_at: new Date().toISOString(),
    resolved_by: user.id,
  })
  .eq("id", requestId);
```

**UI — BOTÃO + DIÁLOGO DE CONFIRMAÇÃO (mirror exato de "Excluir contrato"):**

```tsx
// SOURCE: apps/web/src/components/shared/patient-contract.tsx:176-188, 400-445
// COPY THIS PATTERN (adaptar para revokeContract):
const { execute: deactivateContract, isExecuting: isDeactivating } = useAction(
  deactivatePatientContractAction,
  {
    onSuccess: () => {
      toast.success("Contrato excluído");
      setContractId("");
      setContractExists(false);
      setSavedParties(null);
      setSignatureInfo(null);
      setIsDeleteConfirmOpen(false);
      setMode("select");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao excluir contrato"),
  },
);

// ... JSX ...
<ContentModal
  open={isDeleteConfirmOpen}
  onOpenChange={setIsDeleteConfirmOpen}
  title="Excluir contrato"
  description="O contrato não será apagado permanentemente. Você poderá gerar um novo contrato para esta gestante a qualquer momento."
  contentClassName="sm:max-w-[420px]"
>
  {/* ...botões Cancelar/Confirmar exclusão... */}
</ContentModal>
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `packages/supabase/supabase/migrations/20260817000001_contracts_add_revocation.sql` | CREATE | Adiciona `revoked_at`/`revoked_by` + guarda no trigger de imutabilidade |
| `apps/web/src/actions/revoke-contract-action.ts` | CREATE | Nova ação de revogação (profissional-only, contrato totalmente assinado) |
| `apps/web/src/actions/create-contract-change-request-action.ts` | UPDATE | Remove o bloqueio de `fully_signed_at` |
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | Novo botão + diálogo "Revogar e redigir novo contrato" no modo `readonly` |
| `apps/web/src/lib/validations/contract.ts` | UPDATE (se aplicável) | Schema de input da nova ação, se não reaproveitar um `z.object` inline (ver Task 2) |
| `packages/supabase/src/types/database.types.ts` | UPDATE (gerado) | `pnpm db:types` após a migração |

---

## NOT Building (Scope Limits)

- Coluna de vínculo `superseded_by_contract_id` linkando o contrato revogado ao novo — o PRD só
  exige que o revogado "permaneça consultável" (auditoria por `patient_id` + `created_at` já
  resolve isso sem coluna extra); pode ser adicionado depois sem migração destrutiva se a
  necessidade surgir.
- Motivo de revogação (`revoke_reason` como texto livre) — não mencionado no PRD; a
  `contract_change_requests` resolvida (Task 2) já serve como registro do motivo quando a
  revogação partiu de uma solicitação de alteração.
- Limite de revogações por contrato/patient — fora de escopo, mesma decisão já tomada para
  "rodadas de solicitação de alteração" na Fase 3 (Open Question do PRD, não resolvida ali
  nem aqui).
- Notificação de "contrato revogado" — a Fase 4 já cobre `contract_ready_for_signature`,
  `contract_change_requested`, `contract_fully_signed`; adicionar uma notificação específica de
  revogação ficaria mais natural como extensão da Fase 4 (mesmos registries de tipo), não desta
  fase. Ver Notes.
- Atualização da Fase 5 (badge "Revogado" na lista de contratos da home da gestante) — a Fase 5
  já retorna todos os contratos não-base (incluindo revogados) via `getMyContracts()`, então
  nenhuma mudança de query é necessária ali; um badge visual distinto para `revoked_at IS NOT
  NULL` é uma melhoria de UI que pode ser adicionada independentemente, sem acoplar esta fase à
  Fase 5.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: CREATE `packages/supabase/supabase/migrations/20260817000001_contracts_add_revocation.sql`

- **ACTION**: Adicionar colunas de revogação e estender o trigger de imutabilidade
- **IMPLEMENT**:
  ```sql
  -- Contract revocation (Phase 6): timestamp + actor for revoking a fully-signed
  -- contract. Never written directly except by revoke-contract-action.ts, and
  -- only once — mirrors the fully_signed_at guarded transition below.
  ALTER TABLE public.contracts
    ADD COLUMN revoked_at timestamptz,
    ADD COLUMN revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

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
       OR (OLD.fully_signed_at IS NOT NULL AND OLD.fully_signed_at IS DISTINCT FROM NEW.fully_signed_at)
       OR (OLD.revoked_at IS NOT NULL AND OLD.revoked_at IS DISTINCT FROM NEW.revoked_at)
       OR (OLD.created_at IS DISTINCT FROM NEW.created_at) THEN
      RAISE EXCEPTION 'Contrato assinado é imutável e não pode ser alterado';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260814000004_contracts_rewrite_immutability_and_patient_rls.sql:5-33` (função inteira, só a linha nova é adicionada — não precisa recriar o `CREATE TRIGGER`, pois `CREATE OR REPLACE FUNCTION` já atualiza o corpo sem precisar redefinir o gatilho que a referencia)
- **GOTCHA**: A linha nova é tecnicamente defensiva, não estritamente necessária — o agente de análise confirmou que sem ela o trigger simplesmente não erra numa segunda escrita em `revoked_at` (porque nenhuma outra coluna listada muda), mas também não bloqueia. Adicionar a guarda de qualquer forma mantém consistência com o padrão já estabelecido para `fully_signed_at` e previne uma revogação acidental duas vezes (ex: duplo clique) de sobrescrever `revoked_at`/`revoked_by` silenciosamente. Não é necessário alterar `prevent_signed_contract_delete` (`20260706000001_contract_signature.sql:45-62`) — contratos revogados continuam nunca sendo apagados fisicamente, mesmo comportamento de antes.
- **VALIDATE**: `pnpm db:push`; `pnpm db:types`

### Task 2: CREATE `apps/web/src/actions/revoke-contract-action.ts`

- **ACTION**: Nova ação — revoga o contrato vigente totalmente assinado e resolve pendências de alteração
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { isStaff } from "@/lib/access-control";
  import { captureServerEvent } from "@/lib/posthog/server";
  import { authActionClient } from "@/lib/safe-action";
  import { revalidatePath } from "next/cache";
  import { z } from "zod";

  export const revokeContractAction = authActionClient
    .inputSchema(z.object({ contractId: z.string().uuid(), patientId: z.string().uuid() }))
    .action(
      async ({
        parsedInput: { contractId, patientId },
        ctx: { supabase, supabaseAdmin, user, profile },
      }) => {
        const { data: existing } = await supabase
          .from("contracts")
          .select("id, fully_signed_at")
          .eq("id", contractId)
          .eq("patient_id", patientId)
          .eq("is_base_contract", false)
          .eq("is_active", true)
          .maybeSingle();

        if (!existing) throw new Error("Contrato não encontrado.");
        if (!existing.fully_signed_at) {
          throw new Error("Só é possível revogar contratos assinados por ambas as partes.");
        }

        if (profile.enterprise_id) {
          if (!isStaff(profile)) {
            throw new Error("Apenas gestores ou secretárias podem revogar o contrato.");
          }
        } else {
          const { data: patientRow } = await supabase
            .from("patients")
            .select("created_by")
            .eq("id", patientId)
            .single();
          if (patientRow?.created_by !== user.id) {
            throw new Error("Apenas a profissional responsável pode revogar o contrato.");
          }
        }

        const { error } = await supabase
          .from("contracts")
          .update({
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
          })
          .eq("id", contractId)
          .is("revoked_at", null);

        if (error) throw new Error("Erro ao revogar contrato. Tente novamente.");

        const { error: resolveError } = await supabaseAdmin
          .from("contract_change_requests")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            resolved_by: user.id,
          })
          .eq("contract_id", contractId)
          .eq("status", "pending");

        if (resolveError) {
          console.error(
            "[revokeContractAction] failed to resolve pending change requests",
            resolveError,
          );
        }

        revalidatePath(`/patients/${patientId}/profile`);
        revalidatePath("/home");

        await captureServerEvent(user.id, "revoke_contract", {
          patient_id: patientId,
          contract_id: contractId,
        });

        return { success: true };
      },
    );
  ```
- **MIRROR**: `apps/web/src/actions/deactivate-patient-contract-action.ts:1-27` (estrutura geral), `apps/web/src/actions/sign-patient-contract-action.ts:49-62` (bloco de autorização, copiado verbatim), `apps/web/src/actions/resolve-contract-change-request-action.ts:41-48` (resolução via `supabaseAdmin`)
- **GOTCHA**: O `.is("revoked_at", null)` no `UPDATE` é o guard de transição única no lado da aplicação (redundante com o trigger da Task 1, mas mantém o padrão de "cinturão e suspensórios" já visto em `check_contract_fully_signed()`). A resolução de `contract_change_requests` pendentes é best-effort (só `console.error`, não `throw`) — mirror exato da assimetria já usada em `sign-patient-contract-action.ts:189-194` para o insert de `contract_signatures`: uma falha aqui não deve impedir a revogação em si de ter sucesso, já que a revogação (não a resolução da pendência) é a operação crítica desta ação. Usar `revalidatePath("/home")` adicionalmente porque a Fase 5 já lê contratos na home da gestante — sem essa revalidação, a gestante veria o contrato revogado ainda listado como pendente até o próximo carregamento natural da página.
- **VALIDATE**: `pnpm check-types`

### Task 3: (sem arquivo de schema dedicado)

Este item foi absorvido pela Task 2 — o `z.object({ contractId, patientId })` inline segue o
mesmo padrão de `deactivate-patient-contract-action.ts:9`, que também não usa um schema
importado de `@/lib/validations/contract.ts`. Nenhum arquivo de validação novo é necessário.

### Task 4: UPDATE `apps/web/src/actions/create-contract-change-request-action.ts`

- **ACTION**: Remover o bloqueio de `fully_signed_at`
- **IMPLEMENT**: Remover o bloco:
  ```typescript
  if (existing.fully_signed_at) {
    throw new Error(
      "Este contrato já foi assinado por ambas as partes. Solicite uma revisão pelos canais de revogação.",
    );
  }
  ```
  A query em `:25-31` já seleciona `fully_signed_at` — se nenhuma outra parte do arquivo o usa após a remoção, ajustar o `.select("id, fully_signed_at")` para `.select("id")` (verificar antes de editar; se não houver outro uso, simplificar o select).
- **MIRROR**: N/A — remoção pontual, sem novo padrão a seguir
- **GOTCHA**: O índice único parcial `one_pending_change_request_per_contract` (`packages/supabase/supabase/migrations/20260815000001_create_contract_change_requests_table.sql:27-29`) já impede duas solicitações pendentes simultâneas para o mesmo `contract_id`, independentemente de `fully_signed_at` — então remover este bloqueio não introduz risco de duplicidade. Se a profissional revogar o contrato enquanto há uma solicitação pendente, `revoke-contract-action.ts` (Task 2) já a resolve automaticamente, liberando o índice antes que o próximo contrato (com `contract_id` novo) sequer precise dele.
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/components/shared/patient-contract.tsx`

- **ACTION**: Adicionar botão + diálogo de confirmação "Revogar e redigir novo contrato" no modo `readonly`, visível apenas quando o contrato está totalmente assinado
- **IMPLEMENT**:
  1. Importar a nova ação: `import { revokeContractAction } from "@/actions/revoke-contract-action";`
  2. Adicionar estado: `const [isRevokeConfirmOpen, setIsRevokeConfirmOpen] = useState(false);` e `const [fullySignedAt, setFullySignedAt] = useState<string | null>(null);`
  3. Em `fetchContract`'s `onSuccess` (mesmo bloco que já seta `setSignatureInfo`, linhas ~106-116), adicionar `setFullySignedAt(data.contract.fully_signed_at ?? null);`
  4. Adicionar o hook de ação (mirror de `deactivateContract`):
     ```typescript
     const { execute: revokeContract, isExecuting: isRevoking } = useAction(revokeContractAction, {
       onSuccess: () => {
         toast.success("Contrato revogado. Redija o novo contrato abaixo.");
         setContractId("");
         setContractExists(false);
         setSavedParties(null);
         setSignatureInfo(null);
         setFullySignedAt(null);
         setIsRevokeConfirmOpen(false);
         setMode("select");
       },
       onError: ({ error }) => toast.error(error.serverError ?? "Erro ao revogar contrato"),
     });
     ```
  5. No JSX do modo `readonly` (próximo ao botão "Excluir contrato", `:400-419`), adicionar condicionalmente:
     ```tsx
     {fullySignedAt && (
       <Button variant="outline" onClick={() => setIsRevokeConfirmOpen(true)}>
         Revogar e redigir novo contrato
       </Button>
     )}
     ```
  6. Adicionar um segundo `ContentModal` (mirror do de exclusão, `:422-445`):
     ```tsx
     <ContentModal
       open={isRevokeConfirmOpen}
       onOpenChange={setIsRevokeConfirmOpen}
       title="Revogar contrato"
       description="O contrato atual será marcado como revogado (permanece consultável para auditoria) e você poderá redigir um novo contrato do zero."
       contentClassName="sm:max-w-[420px]"
     >
       <div className="flex justify-end gap-2 pt-2">
         <Button variant="ghost" disabled={isRevoking} onClick={() => setIsRevokeConfirmOpen(false)}>
           Cancelar
         </Button>
         <Button
           variant="destructive"
           disabled={isRevoking}
           onClick={() => {
             if (contractId) revokeContract({ contractId, patientId });
           }}
         >
           {isRevoking ? "Revogando..." : "Confirmar revogação"}
         </Button>
       </div>
     </ContentModal>
     ```
- **MIRROR**: `apps/web/src/components/shared/patient-contract.tsx:176-188` (hook `deactivateContract`), `:400-419` (botão condicional), `:422-445` (`ContentModal` de confirmação)
- **GOTCHA**: O botão só aparece quando `fullySignedAt` está preenchido — um contrato assinado só pela profissional (`is_signed=true, fully_signed_at=null`) continua só podendo ser excluído (`deactivateContract`), não revogado; são semânticas diferentes (excluir = descartar rascunho/contrato nunca finalizado; revogar = invalidar um contrato juridicamente completo, com timestamp/autor de auditoria). Depois de `setMode("select")`, o componente já tem a lógica existente de `ContractSelector` para redigir um novo contrato (o mesmo caminho usado quando a profissional nunca teve contrato algum) — nenhuma mudança adicional necessária nesse componente.
- **VALIDATE**: `pnpm check-types`

### Task 6: Validação estática completa e manual

- **ACTION**: `pnpm check-types` no monorepo + fluxo manual completo
- **IMPLEMENT**: `pnpm check-types`; depois, com um contrato de teste totalmente assinado (`fully_signed_at` setado): (a) confirmar que a gestante consegue registrar uma solicitação de alteração sem erro; (b) confirmar que o botão "Revogar e redigir novo contrato" aparece para a profissional e, ao confirmar, o contrato antigo passa a ter `is_active=false, revoked_at` preenchido e a solicitação pendente (se houver) passa a `status='resolved'`; (c) confirmar que a UI volta para o modo de seleção/edição e a profissional consegue redigir e assinar um contrato novo normalmente, e que esse novo contrato aparece corretamente tanto em `patient-contract.tsx` quanto (se a Fase 5 já estiver implementada) na home da gestante.
- **VALIDATE**: Exit 0 em `check-types`; fluxo manual completo sem erro no console do navegador nem no servidor Next.js; `SELECT is_active, revoked_at, revoked_by FROM contracts WHERE id = '<id-antigo>'` confirma os valores esperados

---

## Testing Strategy

### Unit Tests to Write

Não há suíte de testes existente para nenhuma action de contrato neste repositório (confirmado
pelos dois agentes de exploração para `deactivate-patient-contract-action.ts`,
`sign-patient-contract-action.ts`, `resolve-contract-change-request-action.ts`) — este plano
não introduz um padrão de teste novo, mantendo consistência com o restante do domínio.
Validação via Level 1 (types) e Level 4/6 (banco + manual) abaixo.

### Edge Cases Checklist

- [ ] Tentar revogar um contrato que ainda não foi totalmente assinado (`fully_signed_at IS NULL`) — `revoke-contract-action.ts` lança "Só é possível revogar contratos assinados por ambas as partes."
- [ ] Tentar revogar duas vezes seguidas (ex: duplo clique) — segunda chamada não encontra linha para atualizar (`is("revoked_at", null)` já não bate) e, dependendo da race, ou o `UPDATE` afeta 0 linhas silenciosamente (sem erro, ação idempotente) ou o trigger da Task 1 bloqueia — ambos os comportamentos são aceitáveis e não corrompem o estado
- [ ] Revogar um contrato sem nenhuma solicitação de alteração pendente — o `UPDATE` em `contract_change_requests` simplesmente não afeta nenhuma linha, sem erro
- [ ] Autorização: profissional comum tentando revogar contrato de empresa (deveria falhar, mesma regra de `sign-patient-contract-action.ts`); profissional não-responsável tentando revogar contrato solo de outra profissional (deveria falhar via checagem de `patients.created_by`)
- [ ] Gestante solicita alteração após o contrato ser revogado, mas antes de haver um contrato novo — `existing` na query de `create-contract-change-request-action.ts` (filtrada por `is_active=true`) não encontra nenhum contrato, lança "Nenhum contrato encontrado." (comportamento já existente, sem mudança necessária)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros

### Level 4: DATABASE_VALIDATION

Usar `mcp__supabase__apply_migration` (ou `pnpm db:push`) e depois:

- [ ] `contracts` tem as colunas `revoked_at`, `revoked_by`
- [ ] `prevent_signed_contract_mutation()` inclui a nova linha de guarda (`SELECT prosrc FROM pg_proc WHERE proname = 'prevent_signed_contract_mutation'` contém `revoked_at`)
- [ ] Revogar um contrato de teste via SQL direto (`UPDATE contracts SET is_active=false, revoked_at=now(), revoked_by='<uuid>' WHERE id='<id>'`) sucede; uma segunda tentativa de `UPDATE ... SET revoked_at = now() + interval '1 hour'` na mesma linha é bloqueada pelo trigger com a mensagem "Contrato assinado é imutável e não pode ser alterado"

### Level 6: MANUAL_VALIDATION

Ver Task 6.

---

## Acceptance Criteria

- [ ] `revoke-contract-action.ts` só permite revogar contratos com `fully_signed_at` setado, com a mesma checagem de autorização já usada para assinar pelo lado CONTRATADA
- [ ] Contrato revogado nunca é apagado — permanece consultável com `is_active=false, revoked_at, revoked_by` preenchidos
- [ ] `create-contract-change-request-action.ts` não bloqueia mais solicitações em contratos totalmente assinados
- [ ] `patient-contract.tsx` oferece um caminho claro de "Revogar e redigir novo contrato" quando o contrato está totalmente assinado, e reseta corretamente para o fluxo de criação existente
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma mudança necessária em `sign-patient-contract-action.ts`, `get-patient-contract-action.ts` ou RLS — a query já filtrada por `is_active=true` naturalmente ignora contratos revogados

---

## Completion Checklist

- [ ] Todas as 6 tasks completadas em ordem de dependência (Task 3 é um no-op documentado)
- [ ] Level 1 (static analysis) passa
- [ ] Level 4 (database validation) passa
- [ ] Level 6 (manual validation) passa
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| Duas profissionais da mesma empresa tentam revogar o mesmo contrato quase simultaneamente | LOW | LOW | O guard `.is("revoked_at", null)` no `UPDATE` faz a segunda chamada afetar 0 linhas sem erro visível ao usuário — comportamento aceitável (idempotente), mesmo padrão de tolerância a race já usado em `check_contract_fully_signed()` |
| Remover o bloqueio de `create-contract-change-request-action.ts` sem revogar o contrato em seguida deixa uma solicitação pendente "esquecida" indefinidamente | MEDIUM | LOW | Já é o comportamento aceito para solicitações pré-assinatura-completa hoje (Fase 3) — nenhuma mudança de risco introduzida; a Fase 4 (notificações) já avisa a profissional quando uma solicitação é criada |
| `pnpm db:types` desatualizado após a migração, causando erro de tipo em `revoked_at`/`revoked_by` | LOW | LOW | Task 1 já inclui `pnpm db:types` na validação; `check-types` (Task 6) pega qualquer divergência antes de considerar a fase concluída |

---

## Notes

- A Fase 4 (notificações, plano já gerado em
  `patient-contract-signature-phase-4-notifications.plan.md`) pode querer adicionar um tipo
  `contract_revoked` no futuro, seguindo exatamente o mesmo registry (`WhatsAppNotificationType`,
  `NotificationType`, migração de enum) documentado naquele plano — não incluído aqui para não
  duplicar ou acoplar as duas fases.
- A Fase 5 (home da gestante, plano já gerado em
  `patient-contract-signature-phase-5-patient-home.plan.md`) já retorna contratos revogados na
  lista (sem filtro de `is_active`) — um badge "Revogado" distinto de "Assinado" é uma melhoria
  de UI futura, não uma correção necessária desta fase.
