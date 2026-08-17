# Feature: Notificações da Assinatura de Contrato pela Gestante (Fase 4)

## Summary

Fase 4 do PRD `patient-contract-signature`. Fecha a lacuna de notificação nos três eventos do
fluxo de assinatura dupla de contrato: (1) contrato pronto para assinatura da gestante, (2)
gestante solicita alteração, (3) contrato totalmente assinado por ambas as partes. As Fases 1-3
já implementaram o modelo de dados (`contract_signatures`, `contracts.fully_signed_at`,
`contract_change_requests`) e as ações de assinatura/solicitação — nenhuma delas dispara
notificação hoje, exceto uma que já existe mas usa semântica errada (`contract_signed` enviado
quando a profissional assina, na verdade significa "pronto para você assinar"). Este plano
adiciona WhatsApp + push nos três eventos, reaproveitando os dois mecanismos de notificação já
em produção: envio síncrono fire-and-forget (`sendWhatsAppToUser`, padrão Fase 2) para eventos
disparados por ação do usuário com destinatário já resolvido em memória, e enfileiramento via
`enqueueNotification`/`pg_cron` (padrão Fase 3) para push (que hoje só é resolvido no worker de
fila) e para o evento "totalmente assinado" (que é detectado por um trigger de banco, não pela
ação da aplicação).

## User Story

Como profissional ou gestante, quero ser avisada por push e WhatsApp quando o contrato estiver
pronto para minha assinatura, quando a outra parte solicitar uma alteração, ou quando a
assinatura for concluída por ambas as partes, para não precisar checar a plataforma
ativamente.

## Problem Statement

Hoje, três dos quatro pontos do fluxo de assinatura dupla de contrato terminam sem notificar
ninguém: a assinatura da gestante (`sign-contract-as-patient-action.ts`), a solicitação de
alteração (`create-contract-change-request-action.ts`), e a conclusão da assinatura por ambas
as partes (detectada apenas no trigger `check_contract_fully_signed`, sem side-effect). O único
envio existente (`sign-patient-contract-action.ts:198-202`) usa o tipo `contract_signed`, que é
semanticamente incorreto no momento em que dispara (a gestante ainda não assinou).

## Solution Statement

Adicionar 3 novos `WhatsAppNotificationType` (`contract_ready_for_signature`,
`contract_change_requested`, `contract_fully_signed`) e 3 novos valores no enum Postgres
`notification_type` (mesmos nomes, para push). Trocar o envio equivocado em
`sign-patient-contract-action.ts` por `contract_ready_for_signature` (síncrono, mantém o padrão
já usado) e enfileirar o push correspondente via `enqueueNotification`. Adicionar envio
síncrono de WhatsApp + enqueue de push em `create-contract-change-request-action.ts` para
`contract_change_requested`, destinatário `patients.created_by` (padrão já usado para
"profissional responsável" nas Fases 1-2). Para `contract_fully_signed`, estender a função SQL
`check_contract_fully_signed()` (que já detecta a conclusão via lock de linha) para chamar
`enqueue_notification()` diretamente em PL/pgSQL — mesmo padrão de
`notify_payment_received_trigger.sql` — porque é o único ponto do sistema que sabe, de forma
livre de race condition, quando a segunda assinatura completou o contrato; nenhuma das duas
actions de assinatura tem essa informação de forma confiável sem reconsultar o estado.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                        |
| Complexity       | MEDIUM                                             |
| Systems Affected | apps/web (actions, lib/notifications, lib/whatsapp, cron route), packages/supabase (migrations) |
| Dependencies     | Nenhuma nova — reaproveita `firebase-admin@^13.6.1` (já usa `sendEachForMulticast`, sem gotcha de versão), `pgmq`/`pg_cron` já configurados |
| Estimated Tasks  | 9                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Profissional assina  ──►  sendWhatsAppToUser("contract_signed")             ║
║  (sign-patient-contract-action.ts:198)   [semântica errada: gestante         ║
║                                            ainda não assinou]                 ║
║                                                                               ║
║  Gestante assina  ──►  contract_signatures INSERT ──► trigger seta           ║
║  (sign-contract-as-patient-action.ts)     fully_signed_at ──► (nada)         ║
║                                                                               ║
║  Gestante solicita alteração  ──►  contract_change_requests INSERT ──►       ║
║  (create-contract-change-request-action.ts)              (nada)              ║
║                                                                               ║
║  USER_FLOW: profissional não sabe que a gestante assinou nem que pediu       ║
║  alteração, exceto entrando manualmente na tela do contrato.                 ║
║  PAIN_POINT: 2 de 3 eventos não notificam ninguém; o 1 que notifica usa      ║
║  o tipo/template errado.                                                      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  Profissional assina  ──►  sendWhatsAppToUser("contract_ready_for_signature")║
║                        └─► enqueueNotification(push_notifications,           ║
║                             "contract_ready_for_signature", recipient=patient)║
║                                                                               ║
║  Gestante solicita alteração  ──►  contract_change_requests INSERT           ║
║                               ├─► sendWhatsAppToUser("contract_change_       ║
║                               │    requested", recipient=professional)       ║
║                               └─► enqueueNotification(push_notifications,    ║
║                                    "contract_change_requested",              ║
║                                    recipient=user/professional)              ║
║                                                                               ║
║  Gestante assina  ──►  contract_signatures INSERT ──► trigger seta           ║
║  fully_signed_at ──► PERFORM enqueue_notification(whatsapp+push,             ║
║  "contract_fully_signed", recipient=user/contracts.signed_by)                ║
║                                                                               ║
║  USER_FLOW: cada parte é avisada no momento certo, por push e WhatsApp,      ║
║  sem precisar checar a plataforma.                                            ║
║  VALUE_ADD: profissional sabe imediatamente que precisa agir (contrato       ║
║  pronto p/ formalizar) ou que uma alteração foi pedida; ambas as partes      ║
║  sabem quando o contrato virou definitivo.                                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `sign-patient-contract-action.ts` | Envia `contract_signed` (semântica errada) via WhatsApp | Envia `contract_ready_for_signature` via WhatsApp síncrono + enfileira push | Gestante recebe aviso correto e por 2 canais |
| `create-contract-change-request-action.ts` | Nenhuma notificação | Envia `contract_change_requested` via WhatsApp síncrono + enfileira push para o profissional responsável | Profissional sabe imediatamente que há pedido de alteração |
| `check_contract_fully_signed()` (trigger SQL) | Só seta `fully_signed_at` | Também enfileira `contract_fully_signed` (WhatsApp + push) para `contracts.signed_by` | Profissional sabe que o contrato foi finalizado, sem polling |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/actions/sign-patient-contract-action.ts` | 1-211 | Ação a editar (Task 5) — ver chamada síncrona atual de `sendWhatsAppToUser` a substituir |
| P0 | `apps/web/src/actions/sign-contract-as-patient-action.ts` | 1-78 | Contexto — NÃO editar (a notificação de "fully signed" vem do trigger SQL, não desta action) |
| P0 | `apps/web/src/actions/create-contract-change-request-action.ts` | 1-62 | Ação a editar (Task 6) |
| P0 | `apps/web/src/actions/resolve-contract-change-request-action.ts` | 1-61 | Padrão de resolução "profissional responsável" (`patients.created_by` vs `isStaff`) a mirror |
| P0 | `apps/web/src/lib/notifications/whatsapp-send.ts` | 24-123 | `sendWhatsAppToUser` — nunca lança, sempre loga em `notification_log` |
| P0 | `apps/web/src/lib/whatsapp/templates.ts` | 1-176 | `WhatsAppNotificationType` union + `getWhatsAppTemplate` — MIRROR exatamente para os 3 novos tipos |
| P0 | `apps/web/src/lib/notifications/queue.ts` | 16-40 | `enqueueNotification` — assinatura completa, usar para push |
| P0 | `packages/supabase/supabase/migrations/20260814000003_contract_signatures_completion_trigger.sql` | 1-29 | Trigger a estender (Task 3) — já faz `FOR NO KEY UPDATE` para serializar |
| P0 | `packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql` | 1-29 | Padrão EXATO de `PERFORM enqueue_notification(...)` dentro de trigger PL/pgSQL, com `BEGIN...EXCEPTION WHEN OTHERS` — MIRROR para Task 3 |
| P1 | `packages/supabase/supabase/migrations/20260813000002_patient_invite_link_notifications.sql` | 1-51 | Padrão alternativo de trigger multi-canal (email+whatsapp) — referência para o estilo de comentário/estrutura |
| P1 | `apps/web/app/api/cron/process-notification-queues/route.ts` | 47-188 | `resolvePushRecipientAndTemplate` — MIRROR para adicionar os 3 novos branches (Task 4); ver comentário em `route.ts:199-203` sobre `recipientType: "user"` já carregar o `user_id` real sem indireção |
| P1 | `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts` | 253-272, 559-579 | `handleContractPendingSignature` como MIRROR de handler de fila; `WHATSAPP_QUEUE_HANDLERS` map a estender (Task 4) — necessário só se o push também passar pela fila WhatsApp (não é o caso aqui: WhatsApp dos 2 eventos síncronos usa `sendWhatsAppToUser` direto, não fila) |
| P1 | `apps/web/src/lib/notifications/send.ts` | 5-26, 121-160 | `NotificationType` union (push) e `sendNotificationToTeam` — MIRROR para `NotificationType` (Task 2) |
| P1 | `apps/web/src/lib/notifications/templates.ts` | 1-141 | `getNotificationTemplate` (push) — MIRROR para os 3 novos casos (Task 2) |
| P1 | `packages/supabase/supabase/migrations/20260503000001_push_notification_enum.sql` | 1-9 | Padrão de migração `ALTER TYPE ... ADD VALUE IF NOT EXISTS` — cada valor em statement próprio, fora de bloco transacional combinado com outro DDL (Task 1) |
| P2 | `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts` | 307-330 | `handlePaymentReceived` — exemplo de handler que resolve nome do profissional a partir de `referenceId`, útil se decidirmos enriquecer o corpo do push via fila no futuro (não necessário neste MVP, ver "NOT Building") |
| P2 | `apps/web/src/lib/contract-parties.ts` | 32-72 | Confirma que `buildPatientContractParties` NÃO retorna `patient.user_id` — por isso o push da gestante usa `recipientType: "patient"` (resolvido depois no worker), não envio síncrono direto |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|--------------|
| [WhatsApp Template categorization — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization) | Categories (Utility vs Marketing) | Os 3 novos templates devem ser submetidos como **Utility** no Meta Business Manager (fora do código — processo externo já mencionado no comentário de `templates.ts:54-58`) |
| [WhatsApp Template fundamentals — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) | Parameter formats | Parâmetros posicionais `{{1}}, {{2}}...` sequenciais, sem gap, não podem abrir/fechar o corpo — regra a seguir ao desenhar o texto do template no Business Manager |
| [firebase-admin-node #2277](https://github.com/firebase/firebase-admin-node/issues/2277) | `sendMulticast` removal | Apenas confirmação: `sendMulticastNotification` (`apps/web/src/lib/firebase/admin.ts:36`) já usa `sendEachForMulticast`, não requer mudança — nenhuma ação necessária nesta fase |

---

## Patterns to Mirror

**SQL TRIGGER ENQUEUE (fully_signed):**

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql:1-29
-- COPY THIS PATTERN (adaptar para dois enqueues — whatsapp + push):
BEGIN
  PERFORM public.enqueue_notification(
    'whatsapp_notifications', 'payment_received', 'payment', NEW.id,
    'user', v_professional_id, 0, ''
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_payment_received: enqueue_notification failed for payment %: %', NEW.id, SQLERRM;
END;
```

**SYNC WHATSAPP SEND (action-triggered):**

```typescript
// SOURCE: apps/web/src/actions/sign-patient-contract-action.ts:198-202
// COPY THIS PATTERN:
sendWhatsAppToUser({ recipientType: "patient", recipientId: patientId }, "contract_signed", {
  patientName: patient.name,
}).catch((err) => {
  console.error("[whatsapp] contract_signed send failed", err);
});
```

**WHATSAPP TEMPLATE TYPE REGISTRATION:**

```typescript
// SOURCE: apps/web/src/lib/whatsapp/templates.ts:1-31, 128-131
// COPY THIS PATTERN — adicionar ao union e ao map:
export type WhatsAppNotificationType =
  // ...
  | "contract_pending_signature"
  // ...

contract_pending_signature: () => ({
  name: "contract_pending_signature",
  parameters: [params.patientName ?? ""],
}),
```

**PUSH NOTIFICATION_TYPE REGISTRATION (TS + Postgres enum):**

```typescript
// SOURCE: apps/web/src/lib/notifications/send.ts:5-26
export type NotificationType =
  | "appointment_created"
  // ... adicionar os 3 novos aqui
```

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260503000001_push_notification_enum.sql:1-9
-- COPY THIS PATTERN — um statement por valor, migração própria:
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_ready_for_signature';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_change_requested';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_fully_signed';
```

**PUSH QUEUE RESOLVER BRANCH (recipientType "patient", precisa resolver user_id):**

```typescript
// SOURCE: apps/web/app/api/cron/process-notification-queues/route.ts:84-97 (dpp_approaching, adaptar)
if (notification.notificationType === "dpp_approaching") {
  const { data: patient, error: patientError } = await supabaseAdmin
    .from("patients")
    .select("id, name, user_id")
    .eq("id", notification.referenceId)
    .maybeSingle();

  if (patientError) {
    throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${patientError.message}`);
  }

  if (!patient?.user_id) return null;
  // ...
}
```

**PUSH QUEUE RESOLVER BRANCH (recipientType "user", já é o user_id real):**

```typescript
// SOURCE: apps/web/app/api/cron/process-notification-queues/route.ts:133-183 (billing_reminder, adaptar)
if (notification.notificationType === "billing_reminder") {
  // ... busca dados via referenceId ...
  const template = getNotificationTemplate("billing_reminder", { /* ... */ });
  return {
    type: "billing_reminder",
    userId: notification.recipientId, // recipientType "user" → recipientId JÁ é o user_id
    title: template.title,
    body: template.body,
    url: `/patients/${billing.patient_id}/billing`,
  };
}
```

**"PROFISSIONAL RESPONSÁVEL" LOOKUP (autorização/destinatário):**

```typescript
// SOURCE: apps/web/src/actions/resolve-contract-change-request-action.ts:16-29
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
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `packages/supabase/supabase/migrations/20260816000001_contract_notification_types.sql` | CREATE | Adiciona os 3 valores ao enum Postgres `notification_type` (push) |
| `packages/supabase/supabase/migrations/20260816000002_contract_fully_signed_notification_trigger.sql` | CREATE | Estende `check_contract_fully_signed()` com `enqueue_notification` (whatsapp + push) |
| `apps/web/src/lib/whatsapp/templates.ts` | UPDATE | Adiciona 3 novos `WhatsAppNotificationType` + entradas no map de templates |
| `apps/web/src/lib/notifications/send.ts` | UPDATE | Adiciona 3 novos `NotificationType` (push) |
| `apps/web/src/lib/notifications/templates.ts` | UPDATE | Adiciona 3 novos casos em `getNotificationTemplate` (push) |
| `apps/web/app/api/cron/process-notification-queues/route.ts` | UPDATE | 3 novos branches em `resolvePushRecipientAndTemplate` |
| `apps/web/src/actions/sign-patient-contract-action.ts` | UPDATE | Troca `contract_signed` por `contract_ready_for_signature` (WhatsApp síncrono) + `enqueueNotification` (push) |
| `apps/web/src/actions/create-contract-change-request-action.ts` | UPDATE | Adiciona `sendWhatsAppToUser("contract_change_requested")` + `enqueueNotification` (push) para o profissional responsável |
| `packages/supabase/src/types/database.types.ts` | UPDATE (gerado) | `pnpm db:types` após aplicar as migrações |

---

## NOT Building (Scope Limits)

- Submissão real dos templates no Meta Business Manager — processo externo manual (mesma ressalva já documentada em `templates.ts:54-58`); o código usa nomes placeholder até a aprovação.
- Limite de rodadas de "solicitar alteração" (Open Question do PRD) — fora do escopo desta fase, que só notifica o evento existente.
- Enriquecimento do corpo do push via handler de fila dedicado (como `handlePaymentReceived` faz para WhatsApp) — os 3 novos branches em `resolvePushRecipientAndTemplate` buscam apenas os dados mínimos (nome da paciente/profissional) necessários ao template, sem lógica adicional.
- Deduplicação (`dedupKey`) nos 3 novos `enqueueNotification` — ao contrário do lembrete semanal (`schedule_contract_pending_signature`), estes são eventos pontuais de ação do usuário, não recorrentes; não há necessidade de dedupe.
- Notificação por e-mail — o PRD especifica apenas push + WhatsApp para esta fase.
- Notificar toda a equipe (`sendNotificationToTeam`) em vez de um único profissional responsável — decisão da Fase 1/2 já fixou "profissional responsável" = `patients.created_by` (solo) ou checagem `isStaff` (empresa); este plano mantém consistência usando `patients.created_by` como destinatário único também para notificação (ver Task 6, Risco 1).

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: CREATE `packages/supabase/supabase/migrations/20260816000001_contract_notification_types.sql`

- **ACTION**: Adicionar 3 valores ao enum `notification_type`
- **IMPLEMENT**:
  ```sql
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_ready_for_signature';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_change_requested';
  ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'contract_fully_signed';
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260503000001_push_notification_enum.sql:1-9`
- **GOTCHA**: `ALTER TYPE ... ADD VALUE` não pode rodar na mesma transação que outro DDL que use o novo valor — por isso esta migração fica isolada, e a migração da Task 3 (que referencia esses valores dentro de `enqueue_notification`, uma chamada de função, não DDL) pode vir depois com segurança.
- **VALIDATE**: `pnpm db:push` (aplica a migração); `pnpm db:types` (regenera tipos)

### Task 2: UPDATE `apps/web/src/lib/whatsapp/templates.ts`

- **ACTION**: Adicionar 3 novos tipos ao union `WhatsAppNotificationType` e 3 entradas no map `templates`
- **IMPLEMENT**:
  ```typescript
  // no union, após "contract_signed":
  | "contract_ready_for_signature"
  | "contract_change_requested"
  | "contract_fully_signed"

  // no map de templates:
  contract_ready_for_signature: () => ({
    name: "contract_ready_for_signature",
    parameters: [params.patientName ?? ""],
  }),
  contract_change_requested: () => ({
    name: "contract_change_requested",
    parameters: [params.professionalName ?? "", params.patientName ?? ""],
  }),
  contract_fully_signed: () => ({
    name: "contract_fully_signed",
    parameters: [params.professionalName ?? "", params.patientName ?? ""],
  }),
  ```
- **MIRROR**: `apps/web/src/lib/whatsapp/templates.ts:9` (`contract_signed`), `:88-91` (entrada correspondente)
- **GOTCHA**: `WhatsAppTemplateParams` já tem `patientName?` e `professionalName?` — não precisa adicionar novos campos ao type, só reaproveitar os existentes. Manter o comentário de `templates.ts:54-58` sobre nomes placeholder válido para os 3 novos.
- **VALIDATE**: `pnpm check-types`

### Task 3: CREATE `packages/supabase/supabase/migrations/20260816000002_contract_fully_signed_notification_trigger.sql`

- **ACTION**: Substituir (via `CREATE OR REPLACE FUNCTION`) `check_contract_fully_signed()` para enfileirar notificação quando `fully_signed_at` é setado
- **IMPLEMENT**:
  ```sql
  CREATE OR REPLACE FUNCTION public.check_contract_fully_signed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
  DECLARE
    v_has_professional boolean;
    v_has_patient boolean;
    v_signed_by uuid;
    v_just_completed boolean := false;
  BEGIN
    PERFORM 1 FROM public.contracts WHERE id = NEW.contract_id FOR NO KEY UPDATE;

    SELECT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = NEW.contract_id AND signer_role = 'professional')
      INTO v_has_professional;
    SELECT EXISTS (SELECT 1 FROM public.contract_signatures WHERE contract_id = NEW.contract_id AND signer_role = 'patient')
      INTO v_has_patient;

    IF v_has_professional AND v_has_patient THEN
      UPDATE public.contracts SET fully_signed_at = now()
      WHERE id = NEW.contract_id AND fully_signed_at IS NULL
      RETURNING signed_by INTO v_signed_by;

      v_just_completed := FOUND;
    END IF;

    IF v_just_completed AND v_signed_by IS NOT NULL THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'contract_fully_signed', 'contract', NEW.contract_id,
          'user', v_signed_by, 0, ''
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'check_contract_fully_signed: whatsapp enqueue failed for contract %: %', NEW.contract_id, SQLERRM;
      END;

      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'contract_fully_signed', 'contract', NEW.contract_id,
          'user', v_signed_by, 0, ''
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'check_contract_fully_signed: push enqueue failed for contract %: %', NEW.contract_id, SQLERRM;
      END;
    END IF;

    RETURN NEW;
  END;
  $$;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql:1-29` (padrão `BEGIN...EXCEPTION WHEN OTHERS`, dois enqueues independentes para não deixar falha de um canal bloquear o outro); `packages/supabase/supabase/migrations/20260814000003_contract_signatures_completion_trigger.sql:1-33` (função original a substituir, mesmo lock `FOR NO KEY UPDATE`)
- **GOTCHA**: `UPDATE ... RETURNING signed_by INTO v_signed_by` só popula `v_signed_by` se o `UPDATE` afetou uma linha (guardado por `fully_signed_at IS NULL`) — usar `FOUND` (variável implícita do PL/pgSQL, true se a última instrução afetou ≥1 linha) para distinguir "acabei de completar" de "já estava completo" e evitar enfileirar em toda assinatura subsequente que dispare o trigger por engano. `signed_by` é sempre não-nulo neste ponto porque a profissional assina antes da gestante (`sign-contract-as-patient-action.ts:36-38` bloqueia assinatura da gestante se `!existing.is_signed`).
- **VALIDATE**: `pnpm db:push`; teste manual via `mcp__supabase__execute_sql` — inserir uma assinatura de profissional e depois de gestante no mesmo `contract_id` e conferir `SELECT * FROM pgmq.q_whatsapp_notifications` / `pgmq.q_push_notifications` para a mensagem enfileirada

### Task 4: UPDATE `apps/web/src/lib/notifications/send.ts` e `apps/web/src/lib/notifications/templates.ts`

- **ACTION**: Adicionar 3 novos `NotificationType` (push) e seus templates de título/corpo
- **IMPLEMENT** (`send.ts`, no union `NotificationType`):
  ```typescript
  | "contract_ready_for_signature"
  | "contract_change_requested"
  | "contract_fully_signed"
  ```
- **IMPLEMENT** (`templates.ts`, no map `templates` de `getNotificationTemplate`):
  ```typescript
  contract_ready_for_signature: () => ({
    title: "Contrato pronto para assinatura",
    body: `Seu contrato de acompanhamento está pronto para você assinar.`,
  }),
  contract_change_requested: () => ({
    title: "Alteração solicitada no contrato",
    body: `${params.patientName} solicitou uma alteração no contrato.`,
  }),
  contract_fully_signed: () => ({
    title: "Contrato assinado por ambas as partes",
    body: `O contrato de ${params.patientName} foi assinado por você e pela gestante.`,
  }),
  ```
- **MIRROR**: `apps/web/src/lib/notifications/send.ts:5-26`, `apps/web/src/lib/notifications/templates.ts:24-141` (estrutura `Record<NotificationType, () => NotificationTemplate>`)
- **GOTCHA**: `TemplateParams` já tem `patientName?`/`professionalName?` — reaproveitar, sem adicionar campos novos.
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/app/api/cron/process-notification-queues/route.ts`

- **ACTION**: Adicionar 3 branches em `resolvePushRecipientAndTemplate` para resolver destinatário + template dos novos tipos
- **IMPLEMENT**:
  ```typescript
  if (notification.notificationType === "contract_ready_for_signature") {
    const { data: patient, error } = await supabaseAdmin
      .from("patients")
      .select("id, name, user_id")
      .eq("id", notification.referenceId === notification.referenceId ? notification.recipientId : notification.recipientId) // recipientId = patients.id (recipientType "patient")
      .maybeSingle();
    // simplificar: usar notification.recipientId diretamente (é patients.id neste tipo)
    if (error) throw new Error(`Falha ao buscar gestante: ${error.message}`);
    if (!patient?.user_id) return null;

    const template = getNotificationTemplate("contract_ready_for_signature", {});
    return {
      type: "contract_ready_for_signature",
      userId: patient.user_id,
      title: template.title,
      body: template.body,
      url: `/patients/${patient.id}/profile`,
    };
  }

  if (
    notification.notificationType === "contract_change_requested" ||
    notification.notificationType === "contract_fully_signed"
  ) {
    // recipientType "user" → recipient_id já é o user_id real (mesmo padrão de billing_reminder)
    const { data: contract, error } = await supabaseAdmin
      .from("contracts")
      .select("patient_id, patient:patients(name)")
      .eq("id", notification.referenceId)
      .maybeSingle();
    if (error) throw new Error(`Falha ao buscar contrato ${notification.referenceId}: ${error.message}`);
    if (!contract) return null;

    const patient = contract.patient as unknown as { name: string } | null;
    const template = getNotificationTemplate(notification.notificationType, {
      patientName: patient?.name ?? "",
    });

    return {
      type: notification.notificationType,
      userId: notification.recipientId,
      title: template.title,
      body: template.body,
      url: `/patients/${contract.patient_id}/profile`,
    };
  }
  ```
- **MIRROR**: `apps/web/app/api/cron/process-notification-queues/route.ts:84-97` (branch `recipientType: "patient"`, resolve `user_id`), `:133-183` (branch `recipientType: "user"`, `recipientId` já é `user_id`)
- **GOTCHA**: Escrever o branch de `contract_ready_for_signature` corretamente — o pseudo-código acima tem um `select().eq()` redundante de rascunho; a implementação final deve simplesmente ser `eq("id", notification.recipientId)` (sem a expressão condicional confusa) já que `recipientId` é `patients.id` para este tipo (`recipientType: "patient"`, ver Task 6). Copiar a forma limpa do branch `dpp_approaching` (`route.ts:84-97`) como referência de estilo.
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/actions/sign-patient-contract-action.ts`

- **ACTION**: Substituir o envio de `contract_signed` por `contract_ready_for_signature` (WhatsApp síncrono) e adicionar `enqueueNotification` para push
- **IMPLEMENT**: Trocar o bloco em `sign-patient-contract-action.ts:198-202`:
  ```typescript
  sendWhatsAppToUser(
    { recipientType: "patient", recipientId: patientId },
    "contract_ready_for_signature",
    { patientName: patient.name },
    { referenceType: "contract", referenceId: contractId },
  ).catch((err) => {
    console.error("[whatsapp] contract_ready_for_signature send failed", err);
  });

  enqueueNotification({
    queueName: "push_notifications",
    notificationType: "contract_ready_for_signature",
    referenceType: "contract",
    referenceId: contractId,
    recipientType: "patient",
    recipientId: patientId,
  }).catch((err) => {
    console.error("[push] contract_ready_for_signature enqueue failed", err);
  });
  ```
  Adicionar `import { enqueueNotification } from "@/lib/notifications/queue";` ao topo do arquivo.
- **MIRROR**: Chamada existente em `sign-patient-contract-action.ts:198-202` (mesma posição, após `revalidatePath`); `apps/web/src/lib/billing/notifications.ts:70-91` (padrão de `enqueueNotification` com `.catch` isolado, não bloqueando o retorno da action)
- **GOTCHA**: `contract_signed` (o tipo antigo usado aqui) continua existindo no union `WhatsAppNotificationType` — não removê-lo, pois é usado como nome de referência semântica ainda válida em outros lugares potenciais/templates aprovados; apenas parar de chamá-lo neste ponto específico. Passar a `reference` (`{referenceType: "contract", referenceId: contractId}`) no `sendWhatsAppToUser`, algo que a chamada original omitia (ver comentário em `whatsapp-send.ts:14-18` sobre o propósito de `reference` para webhooks inbound) — trazer esse dado agora que está disponível é consistente com o padrão mais recente de outras chamadas na base.
- **VALIDATE**: `pnpm check-types`

### Task 7: UPDATE `apps/web/src/actions/create-contract-change-request-action.ts`

- **ACTION**: Após inserir `contract_change_requests`, resolver o profissional responsável e notificá-lo (WhatsApp síncrono + push enfileirado)
- **IMPLEMENT**:
  ```typescript
  const { data: patientRow2 } = await supabase
    .from("patients")
    .select("created_by")
    .eq("id", patientId)
    .single();

  if (patientRow2?.created_by) {
    sendWhatsAppToUser(
      { recipientType: "user", recipientId: patientRow2.created_by },
      "contract_change_requested",
      { patientName: patientRow.name ?? "" }, // ver GOTCHA — buscar nome se necessário
      { referenceType: "contract", referenceId: existing.id },
    ).catch((err) => {
      console.error("[whatsapp] contract_change_requested send failed", err);
    });

    enqueueNotification({
      queueName: "push_notifications",
      notificationType: "contract_change_requested",
      referenceType: "contract",
      referenceId: existing.id,
      recipientType: "user",
      recipientId: patientRow2.created_by,
    }).catch((err) => {
      console.error("[push] contract_change_requested enqueue failed", err);
    });
  }
  ```
  Adicionar imports: `sendWhatsAppToUser` de `@/lib/notifications/whatsapp-send`, `enqueueNotification` de `@/lib/notifications/queue`.
- **MIRROR**: `apps/web/src/actions/resolve-contract-change-request-action.ts:16-29` (mesma query `patients.created_by`, mas aqui só para resolver destinatário, não para autorização — a action já validou que quem chama é a própria gestante via `patientRow.user_id !== user.id` em `create-contract-change-request-action.ts:21-23`); `sign-patient-contract-action.ts:198-202` (padrão de chamada síncrona)
- **GOTCHA**: A query existente em `create-contract-change-request-action.ts:15-19` já busca `patients` mas só seleciona `id, user_id` — precisa expandir o select (ou fazer uma segunda query, como no pseudo-código acima) para pegar `created_by` e `name`. Preferir expandir a query original (`select("id, user_id, name, created_by")`) a uma segunda chamada separada — mais barato e consistente com o padrão de outras actions do arquivo. Ajustar o pseudo-código acima para usar uma única query. Este plano assume **apenas o caso solo** (`patients.created_by`) como destinatário, igual à decisão já tomada nas Fases 1-2 para "profissional responsável"; contratos de empresa (`enterprise_id` setado) não têm um destinatário único natural aqui — se `created_by` for nulo/irrelevante nesse caso, o envio simplesmente não dispara (guard `if (patientRow2?.created_by)`), o que é aceitável para o MVP desta fase (ver "NOT Building").
- **VALIDATE**: `pnpm check-types`

### Task 8: Regenerar tipos e rodar validação estática completa

- **ACTION**: Sincronizar `database.types.ts` com as migrações das Tasks 1 e 3, e validar todo o pacote
- **IMPLEMENT**: `pnpm db:types && pnpm check-types`
- **VALIDATE**: Exit 0, sem erros de tipo (em especial: `Enums<"notification_type">` em `send.ts:112` deve aceitar os 3 novos literais sem cast adicional além do já existente)

### Task 9: Validação manual end-to-end (queue dry-run)

- **ACTION**: Exercitar os 3 fluxos localmente com `NOTIFICATION_QUEUE_DRY_RUN` não setado como `"false"` (dry-run default) e conferir `notification_log`
- **IMPLEMENT**: Gerar/assinar um contrato de teste como profissional → conferir `notification_log` linha `contract_ready_for_signature` (channel `whatsapp`, status `sent`/`skipped`) e a fila `pgmq.q_push_notifications` recebendo a mensagem; solicitar alteração como gestante → conferir `notification_log` para `contract_change_requested`; assinar como gestante → conferir enqueue de `contract_fully_signed` nas duas filas via `SELECT * FROM pgmq.q_whatsapp_notifications WHERE message->>'notification_type' = 'contract_fully_signed'`.
- **VALIDATE**: Cada um dos 3 eventos produz exatamente uma linha em `notification_log` (WhatsApp) e uma mensagem na fila `push_notifications` — sem duplicidade, sem exceção não tratada nos logs do servidor Next.js.

---

## Testing Strategy

### Unit Tests to Write

Não há suíte de testes existente para nenhuma das actions/libs de notificação tocadas neste
plano (`sign-patient-contract-action.ts`, `create-contract-change-request-action.ts`,
`sendWhatsAppToUser`, `enqueueNotification`) — confirmado pelo agente de exploração. Este plano
não introduz um padrão de teste novo para não divergir da convenção (ausência) já estabelecida
no restante do domínio de notificações; a validação é via Level 4/6 (banco + manual) abaixo.

### Edge Cases Checklist

- [ ] Profissional assina, mas patient sem telefone cadastrado — `sendWhatsAppToUser` deve logar `skipped: no phone on file` em `notification_log` sem lançar (`whatsapp-send.ts:50-61`)
- [ ] Gestante solicita alteração em contrato de empresa (`enterprise_id` setado) sem `patients.created_by` relevante — guard `if (patientRow2?.created_by)` evita chamada com `recipientId` inválido
- [ ] Duas assinaturas quase simultâneas (profissional e gestante) — o lock `FOR NO KEY UPDATE` em `check_contract_fully_signed()` já serializa; confirmar que o enqueue de `contract_fully_signed` dispara exatamente uma vez (guard `FOUND`/`fully_signed_at IS NULL`)
- [ ] Falha ao enfileirar push (ex: RPC indisponível) não deve bloquear a assinatura nem lançar erro para o usuário — `.catch()` isolado nas actions, `EXCEPTION WHEN OTHERS` no trigger
- [ ] Template WhatsApp ainda não aprovado no Meta Business Manager — `sendWhatsAppTemplateMessage` deve retornar erro capturado por `WhatsAppApiError` e logado como `failed` em `notification_log`, sem quebrar a action (comportamento já garantido por `whatsapp-send.ts:94-121`, nenhuma mudança necessária)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros

### Level 4: DATABASE_VALIDATION

Usar `mcp__supabase__apply_migration` (ou `pnpm db:push`) e depois:

- [ ] Enum `notification_type` contém `contract_ready_for_signature`, `contract_change_requested`, `contract_fully_signed` (`SELECT enum_range(NULL::notification_type)`)
- [ ] `check_contract_fully_signed()` atualizado (`SELECT prosrc FROM pg_proc WHERE proname = 'check_contract_fully_signed'` contém `enqueue_notification`)
- [ ] Inserir duas `contract_signatures` (professional + patient) para um contrato de teste e confirmar 2 mensagens em `pgmq.q_whatsapp_notifications`/`pgmq.q_push_notifications` com `notification_type = 'contract_fully_signed'`

### Level 6: MANUAL_VALIDATION

Ver Task 9 acima — exercitar os 3 fluxos via UI/actions localmente com `NOTIFICATION_QUEUE_DRY_RUN` em dry-run (default) e inspecionar `notification_log` + filas `pgmq`.

---

## Acceptance Criteria

- [ ] `sign-patient-contract-action.ts` envia `contract_ready_for_signature` (não mais `contract_signed`) via WhatsApp síncrono, com `reference` preenchida
- [ ] `sign-patient-contract-action.ts` enfileira push `contract_ready_for_signature` para a gestante
- [ ] `create-contract-change-request-action.ts` notifica o profissional responsável (`patients.created_by`) via WhatsApp + push
- [ ] `check_contract_fully_signed()` enfileira WhatsApp + push para `contracts.signed_by` exatamente uma vez, apenas quando a segunda assinatura completa o contrato
- [ ] `pnpm check-types` passa sem erros
- [ ] `pnpm db:types` sincronizado após as 2 novas migrações
- [ ] Nenhuma falha de notificação (WhatsApp ou push) lança exceção que interrompa a action de assinatura/solicitação correspondente

---

## Completion Checklist

- [ ] Todas as 9 tasks completadas em ordem de dependência
- [ ] Level 1 (static analysis) passa
- [ ] Level 4 (database validation) passa
- [ ] Level 6 (manual validation) passa
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| Templates WhatsApp (`contract_ready_for_signature`, `contract_change_requested`, `contract_fully_signed`) ainda não submetidos/aprovados no Meta Business Manager quando este código for para produção | HIGH | MEDIUM | `sendWhatsAppToUser` já trata falha de template sem lançar (loga `failed` em `notification_log`); nenhuma mudança de código necessária, mas a submissão manual dos 3 templates no Meta Business Manager (categoria Utility, ver research) deve ser feita antes do rollout para o canal WhatsApp funcionar de fato |
| `contract_change_requested` não notifica ninguém em contratos de empresa sem `patients.created_by` claro | MEDIUM | LOW | Escopo explícito do MVP (ver "NOT Building") — guard evita erro, mas aceita-se lacuna de cobertura para o caso empresa nesta fase; pode virar item de fase futura |
| Trigger `check_contract_fully_signed()` sendo `SECURITY DEFINER` e agora chamando `enqueue_notification` — precisa que `enqueue_notification` também seja acessível nesse contexto de execução | LOW | MEDIUM | `notify_payment_received_trigger.sql` já faz exatamente isso (mesma função `SECURITY DEFINER` chamando `PERFORM public.enqueue_notification`) — padrão comprovado, sem risco adicional |
| Reaproveitar `contract_signed` como nome ainda presente no union mas sem call site — pode confundir devs futuros | LOW | LOW | Manter o tipo no union é intencional (não é dead code — é vocabulário de negócio ainda válido, só não usado neste ponto específico); documentado no GOTCHA da Task 6 |

---

## Notes

- A Fase 5 (Home da gestante) e a Fase 6 (Revogação/recriação) podem consumir os mesmos tipos de
  notificação criados aqui (`contract_ready_for_signature`, `contract_fully_signed`) quando
  precisarem sinalizar estado na home — nenhuma mudança adicional prevista neste plano além dos
  3 pontos de disparo já cobertos.
- O `dedupKey` foi deliberadamente omitido nos 3 novos `enqueueNotification` (ver "NOT
  Building") — se no futuro a mesma ação puder ser re-executada rapidamente (ex: duplo-clique
  no botão de assinar), considerar adicionar um `dedupKey` por `contractId`/tipo, seguindo o
  padrão de `wa_contract_pending_<ISO week>` usado no lembrete semanal.
