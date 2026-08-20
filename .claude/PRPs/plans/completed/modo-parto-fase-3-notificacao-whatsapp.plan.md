# Feature: Modo Parto — Fase 3: Notificação WhatsApp de Ativação

## Summary

Quando um profissional ativa o Modo Parto para uma gestante, todos os membros da equipe de cuidado (`team_members`) devem receber uma notificação WhatsApp. Como nenhuma fase anterior criou um gatilho de ativação real (Fase 1 só adicionou colunas; a Fase 2 usou `UPDATE` manual via SQL para testar o Realtime), esta fase cria a server action mínima de ativação (`activateBirthModeAction`) e, a partir dela, dispara o fan-out assíncrono via fila `whatsapp_notifications` — reaproveitando exatamente o padrão de loop sobre `team_members` já usado em `apps/web/src/lib/billing/notifications.ts`.

## User Story

Como profissional da equipe de cuidado (doula, enfermeira, médica obstetra)
Eu quero que toda a equipe receba um WhatsApp assim que alguém ativa o Modo Parto para uma paciente minha
Para que eu saiba imediatamente que o parto começou, mesmo sem o app aberto

## Problem Statement

Hoje não existe nenhum caminho de código que ative o Modo Parto (`pregnancies.birth_mode_active`) fora de um `UPDATE` manual via SQL usado no spike de Realtime da Fase 2. Não existe fan-out de notificação nenhum. Ao final desta fase, ativar o Modo Parto deve gravar quem ativou e quando, e enfileirar uma notificação WhatsApp individual para cada membro da equipe, verificável em `notification_log`.

## Solution Statement

1. Criar `activateBirthModeAction` (`apps/web/src/actions/activate-birth-mode-action.ts`), seguindo o padrão de `finish-patient-care-action.ts`: `authActionClient` + Zod schema, `UPDATE public.pregnancies SET birth_mode_active = true, birth_mode_activated_at = now(), birth_mode_activated_by = auth.uid() WHERE id = :pregnancyId`, protegido por RLS `is_team_member` já existente.
2. Criar uma função de fan-out `scheduleBirthModeActivationNotifications(pregnancyId)` em `apps/web/src/lib/notifications/birth-mode.ts`, espelhando `scheduleBillingNotifications` (`apps/web/src/lib/billing/notifications.ts:16-100`): busca `team_members` pelo `patient_id` da gestação, itera e chama `enqueueNotification({ queueName: "whatsapp_notifications", notificationType: "birth_mode_activated", ... })` por profissional, com `dedupKey` por-destinatário (`birth_mode_activated_${pregnancyId}_${userId}`) para não colapsar o fan-out num único envio.
3. Adicionar `"birth_mode_activated"` a `WhatsAppNotificationType`, seu template (nome placeholder, parâmetro `patientName`) em `getWhatsAppTemplate`, e um handler `handleBirthModeActivated` registrado em `WHATSAPP_QUEUE_HANDLERS`, que revalida que `birth_mode_active` ainda é `true` antes de mandar (evita notificar depois que o parto já terminou, caso a mensagem fique presa na fila).
4. Corpo do template deve ser genérico/operacional (sem termos clínicos como "contração", "dilatação" etc.) — só `"Modo Parto ativado para {{1}}. Abra o app para acompanhar."` — por restrição de política do WhatsApp Business sobre conteúdo de saúde em templates.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY                                     |
| Complexity       | LOW — reaproveita 100% da infraestrutura existente  |
| Systems Affected | apps/web (actions, lib/notifications, lib/whatsapp) |
| Dependencies     | Nenhuma nova — `next-safe-action`, `zod`, pgmq (já em uso) |
| Estimated Tasks  | 6                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║   ┌─────────────┐         ┌─────────────┐         ┌─────────────┐         ║
║   │  Ficha da   │ ──────► │  (nenhuma   │ ──────► │  (nada       │         ║
║   │  paciente   │         │  ativação   │         │  acontece)   │         ║
║   └─────────────┘         │  real)      │         └─────────────┘         ║
║                             └─────────────┘                                ║
║   USER_FLOW: Profissional não tem como ativar o Modo Parto pelo app —      ║
║               só existe um `UPDATE` manual via SQL usado no spike técnico. ║
║   PAIN_POINT: Ninguém da equipe é avisado quando o parto começa; sem       ║
║               ferramenta digital, tudo ainda é papel.                     ║
║   DATA_FLOW: Nenhum — não há registro de quem/quando ativou.               ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║   ┌─────────────┐    ┌──────────────────┐    ┌────────────────────────┐   ║
║   │  Profissional│──► │ activateBirthMode │──► │ pregnancies.birth_mode │   ║
║   │  ativa Modo  │    │ Action (server    │    │ _active = true         │   ║
║   │  Parto       │    │ action)           │    │ + activated_by/_at     │   ║
║   └─────────────┘    └──────────────────┘    └───────────┬────────────┘   ║
║                                                             │                ║
║                                                             ▼                ║
║                                          ┌──────────────────────────────┐  ║
║                                          │ scheduleBirthModeActivation  │  ║
║                                          │ Notifications(pregnancyId)   │  ║
║                                          │ loop team_members →          │  ║
║                                          │ enqueueNotification(...)     │  ║
║                                          └──────────────┬───────────────┘  ║
║                                                          ▼                  ║
║                             pgmq `whatsapp_notifications` (N mensagens,     ║
║                             uma por profissional da equipe)                ║
║                                                          ▼                  ║
║                    cron `process-notification-queues` drena a fila,        ║
║                    resolve template, envia via WhatsApp Cloud API,         ║
║                    grava `notification_log` (status sent/failed)           ║
║                                                                             ║
║   USER_FLOW: Ativação grava quem/quando e dispara N notificações           ║
║               assíncronas — uma por profissional da equipe.                ║
║   VALUE_ADD: Toda a equipe é avisada via WhatsApp, sem depender do app     ║
║              estar aberto; rastreável em `notification_log`.               ║
║   DATA_FLOW: pregnancies (mutação) → team_members (leitura) →              ║
║              enqueue_notification × N → pgmq → cron worker → WhatsApp API  ║
║              → notification_log                                            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| (nova) `activateBirthModeAction` | Não existe | Ativa Modo Parto, grava autor/timestamp | Ponto de entrada real para o fluxo (usado pela UI da Fase 4/5) |
| `whatsapp-queue-handlers.ts` | 17 tipos registrados | +1 (`birth_mode_activated`) | Equipe inteira recebe WhatsApp na ativação |
| `notification_log` | Sem registros de Modo Parto | 1 linha por profissional notificado | Rastreabilidade de quem foi avisado e quando |

---

## Mandatory Reading

**CRÍTICO: leia estes arquivos antes de começar qualquer task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/lib/billing/notifications.ts` | 1-100 | Padrão EXATO de fan-out sobre `team_members` a espelhar |
| P0 | `apps/web/src/lib/whatsapp/templates.ts` | 1-192 | Onde adicionar o novo `WhatsAppNotificationType` + template |
| P0 | `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts` | 1-70, 540-579 | Padrão de handler + registro no mapa |
| P1 | `apps/web/src/lib/notifications/queue.ts` | 1-40 | Assinatura de `enqueueNotification` |
| P1 | `apps/web/src/actions/finish-patient-care-action.ts` | 1-83 | Padrão de server action que muta `pregnancies` e dispara WhatsApp |
| P1 | `apps/web/src/lib/safe-action.ts` | all | `authActionClient` — contexto `{ supabase, supabaseAdmin, user, profile }` |
| P2 | `packages/supabase/supabase/migrations/20260822000002_pregnancies_add_birth_mode_state.sql` | all | Colunas exatas de estado do Modo Parto (Fase 1) |
| P2 | `packages/supabase/supabase/migrations/20260313000001_pregnancies_table.sql` | 49-80 | RLS já existente em `pregnancies` (via `is_team_member`) — confirma que a action não precisa de policy nova |
| P2 | `apps/web/app/api/cron/process-notification-queues/route.ts` | 420-490 | Como o handler registrado é consumido pelo worker (dry-run, log, retry) |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [WhatsApp Business Messaging Policy](https://business.whatsapp.com/policy) | Restrição de conteúdo de saúde | Corpo do template não pode mencionar termos clínicos (trabalho de parto, contração, etc.) — manter genérico/operacional |
| [Template fundamentals — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview) | Categorias e aprovação | Template é categoria Utility (transacional); aprovação pode levar até 24h — não bloqueia dev, só produção |

---

## Patterns to Mirror

**FAN_OUT_LOOP (o padrão central desta fase):**
```typescript
// SOURCE: apps/web/src/lib/billing/notifications.ts:42-91
const { data: teamMembers } = await supabaseAdmin
  .from("team_members")
  .select("professional_id")
  .eq("patient_id", billing.patient_id);

const userIds: string[] = [];
for (const tm of teamMembers ?? []) {
  userIds.push(tm.professional_id);
}

for (const userId of userIds) {
  try {
    await enqueueNotification({
      queueName: "push_notifications",
      notificationType: "billing_reminder",
      referenceType: "installment",
      referenceId: installment.id,
      recipientType: "user",
      recipientId: userId,
      delaySeconds: Math.max(scheduledFor.diff(now, "second"), 0),
      dedupKey: `${nt.type}_${userId}`,
    });
  } catch (err) {
    console.error("[billing-notifications] Failed to enqueue ...", installment.id, "user:", userId, err);
  }
}
```

**WHATSAPP_TEMPLATE_ENTRY:**
```typescript
// SOURCE: apps/web/src/lib/whatsapp/templates.ts:83-86
care_finished: () => ({
  name: "care_finished",
  parameters: [params.patientName ?? ""],
}),
```

**WHATSAPP_QUEUE_HANDLER:**
```typescript
// SOURCE: apps/web/src/lib/notifications/whatsapp-queue-handlers.ts:24-47
async function handleAppointmentReminder(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("date, time, status, patient:patients!appointments_patient_id_fkey(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "agendada") return { action: "skip" };

  const patient = appointment.patient as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "", date: appointment.date, time: appointment.time },
  };
}
```

**SERVER_ACTION_MUTATING_PREGNANCIES:**
```typescript
// SOURCE: apps/web/src/actions/finish-patient-care-action.ts:1-29
"use server";

import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  // ...
});

export const finishPatientCareAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { error: updateError } = await supabase
      .from("pregnancies")
      .update({ has_finished: true /* ... */ })
      .eq("patient_id", parsedInput.patientId);

    if (updateError) throw new Error(updateError.message);
    // ...
  });
```

**ENQUEUE_NOTIFICATION_SIGNATURE:**
```typescript
// SOURCE: apps/web/src/lib/notifications/queue.ts:16-40
export async function enqueueNotification(params: {
  queueName: QueueName; // "push_notifications" | "whatsapp_notifications" | "email_notifications"
  notificationType: string;
  referenceType: string;
  referenceId: string;
  recipientType: "user" | "patient" | "invite";
  recipientId: string;
  delaySeconds?: number;
  dedupKey?: string;
}): Promise<number>
```

---

## Files to Change

| File                                                             | Action | Justification                                                            |
| ------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------- |
| `apps/web/src/actions/activate-birth-mode-action.ts`                | CREATE | Gatilho real de ativação do Modo Parto (não existe hoje em código nenhum) |
| `apps/web/src/lib/validations/birth-mode.ts`                        | CREATE | Schema Zod `activateBirthModeSchema`, seguindo convenção de `lib/validations/*` |
| `apps/web/src/lib/notifications/birth-mode.ts`                      | CREATE | `scheduleBirthModeActivationNotifications(pregnancyId)` — fan-out sobre `team_members` |
| `apps/web/src/lib/whatsapp/templates.ts`                            | UPDATE | Adicionar `"birth_mode_activated"` ao `WhatsAppNotificationType` + entrada em `getWhatsAppTemplate` |
| `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts`         | UPDATE | Adicionar `handleBirthModeActivated` + registro em `WHATSAPP_QUEUE_HANDLERS` |

---

## NOT Building (Scope Limits)

- **UI de ativação (botão na ficha da paciente)** — fica para a Fase 4/5; esta fase só entrega a server action que a UI vai chamar.
- **Redirect Realtime / contagem regressiva / barra persistente** — Fase 5.
- **Template aprovado no Meta Business Manager** — o `name` do template continua placeholder (`"birth_mode_activated"`), igual aos outros 17 tipos já no código; aprovação real é processo externo (Fase 0 do PRD).
- **Envio de push notification in-app para esta ativação** — o PRD pede WhatsApp explicitamente; push in-app fica coberto pelo mecanismo Realtime da Fase 5, não pela fila `push_notifications`.
- **Cancelamento de notificações pendentes se o Modo Parto for desativado rapidamente** — não há requisito do cliente para isso; mensagens já enfileiradas (delay 0) são drenadas quase imediatamente pelo cron de 1 min, tornando o cancelamento de baixo valor.

---

## Step-by-Step Tasks

### Task 1: CREATE `apps/web/src/lib/validations/birth-mode.ts`
- **ACTION**: CREATE schema Zod de input da action de ativação
- **IMPLEMENT**:
  ```typescript
  import { z } from "zod";

  export const activateBirthModeSchema = z.object({
    pregnancyId: z.string().uuid("ID da gestação inválido"),
  });

  export type ActivateBirthModeInput = z.infer<typeof activateBirthModeSchema>;
  ```
- **MIRROR**: `apps/web/src/lib/validations/evolution.ts:1-11`
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/lib/whatsapp/templates.ts`
- **ACTION**: Adicionar novo tipo de notificação e template
- **IMPLEMENT**:
  - Adicionar `| "birth_mode_activated"` ao union `WhatsAppNotificationType` (após o grupo "Fase 2 — action-triggered", já que este é disparado por ação do usuário, não por cron)
  - Adicionar entrada no `templates` record dentro de `getWhatsAppTemplate`:
    ```typescript
    birth_mode_activated: () => ({
      name: "birth_mode_activated",
      parameters: [params.patientName ?? ""],
    }),
    ```
- **MIRROR**: `templates.ts:83-86` (`care_finished`) — mesmo shape, só `patientName`
- **GOTCHA**: `WhatsAppTemplateParams` já tem `patientName?: string` (`templates.ts:37`) — não precisa adicionar campo novo
- **GOTCHA**: corpo do template (quando definido no Meta Business Manager) NÃO pode conter termos clínicos (contração, trabalho de parto, etc.) — política do WhatsApp Business restringe conteúdo relacionado a saúde em templates. Deixe isso documentado num comentário próximo à entrada, já que o `name`/conteúdo real só será definido na aprovação Meta.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts`
- **ACTION**: Adicionar handler para `birth_mode_activated`
- **IMPLEMENT**:
  ```typescript
  async function handleBirthModeActivated(
    supabaseAdmin: SupabaseAdmin,
    notification: DequeuedNotification,
  ): Promise<WhatsAppQueueHandlerResult> {
    const { data: pregnancy, error } = await supabaseAdmin
      .from("pregnancies")
      .select("birth_mode_active, patient:patients!pregnancies_patient_id_fkey(name)")
      .eq("id", notification.referenceId)
      .maybeSingle();
    if (error)
      throw new Error(`Falha ao buscar gestação ${notification.referenceId}: ${error.message}`);
    if (!pregnancy || !pregnancy.birth_mode_active) return { action: "skip" };

    const patient = pregnancy.patient as unknown as { name: string } | null;
    return {
      action: "send",
      recipient: recipientOf(notification),
      templateParams: { patientName: patient?.name ?? "" },
    };
  }
  ```
  Registrar no mapa: `birth_mode_activated: handleBirthModeActivated,` em `WHATSAPP_QUEUE_HANDLERS`
- **MIRROR**: `handleAppointmentReminder` (`whatsapp-queue-handlers.ts:24-47`) — mesmo shape: buscar entidade referenciada, validar estado ainda relevante, retornar `skip` ou `send`
- **GOTCHA**: revalidar `birth_mode_active` no handler (não confiar só no enqueue-time) — se o Modo Parto for desativado rapidamente entre ativação e drenagem da fila, a mensagem deve ser pulada, não enviada
- **GOTCHA**: confirme o nome exato da FK de `pregnancies` → `patients` no schema gerado (`packages/supabase/src/types/database.types.ts`) antes de escrever o `select` — use o padrão `patient:patients!<fk_name>(name)` já visto em outras queries do arquivo
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/lib/notifications/birth-mode.ts`
- **ACTION**: CREATE função de fan-out
- **IMPLEMENT**:
  ```typescript
  import { enqueueNotification } from "@/lib/notifications/queue";
  import { createServerSupabaseAdmin } from "@ventre/supabase/server";

  export async function scheduleBirthModeActivationNotifications(pregnancyId: string) {
    try {
      const supabaseAdmin = await createServerSupabaseAdmin();

      const { data: pregnancy } = await supabaseAdmin
        .from("pregnancies")
        .select("patient_id")
        .eq("id", pregnancyId)
        .single();

      if (!pregnancy) return;

      const { data: teamMembers } = await supabaseAdmin
        .from("team_members")
        .select("professional_id")
        .eq("patient_id", pregnancy.patient_id);

      if (!teamMembers?.length) return;

      for (const tm of teamMembers) {
        try {
          await enqueueNotification({
            queueName: "whatsapp_notifications",
            notificationType: "birth_mode_activated",
            referenceType: "pregnancy",
            referenceId: pregnancyId,
            recipientType: "user",
            recipientId: tm.professional_id,
            dedupKey: `birth_mode_activated_${pregnancyId}_${tm.professional_id}`,
          });
        } catch (err) {
          console.error(
            "[birth-mode-notifications] Failed to enqueue whatsapp notification for pregnancy:",
            pregnancyId,
            "user:",
            tm.professional_id,
            err,
          );
        }
      }
    } catch {
      console.error(
        "[birth-mode-notifications] Failed to schedule notifications for pregnancy:",
        pregnancyId,
      );
    }
  }
  ```
- **MIRROR**: `scheduleBillingNotifications` (`apps/web/src/lib/billing/notifications.ts:16-100`) — mesma estrutura de try/catch aninhado (falha de um destinatário não aborta os demais), mesmo padrão de `dedupKey` **por destinatário** (não por evento — ver GOTCHA)
- **IMPORTS**: `import { enqueueNotification } from "@/lib/notifications/queue"`, `import { createServerSupabaseAdmin } from "@ventre/supabase/server"`
- **GOTCHA (crítico, achado na pesquisa externa)**: o `dedupKey` DEVE incluir o `recipientId` (`professional_id`). Um `dedupKey` só por `pregnancyId` faria o mecanismo de dedup colapsar o fan-out inteiro em um único envio, silenciosamente descartando as notificações dos demais profissionais — anti-padrão confirmado contra a implementação atual de `notification_queue_index` (chave única em `(notification_type, reference_type, reference_id, queue_name, dedup_key)`).
- **VALIDATE**: `pnpm check-types`

### Task 5: CREATE `apps/web/src/actions/activate-birth-mode-action.ts`
- **ACTION**: CREATE server action de ativação
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { activateBirthModeSchema } from "@/lib/validations/birth-mode";
  import { scheduleBirthModeActivationNotifications } from "@/lib/notifications/birth-mode";
  import { captureServerEvent } from "@/lib/posthog/server";
  import { authActionClient } from "@/lib/safe-action";
  import { revalidatePath } from "next/cache";

  export const activateBirthModeAction = authActionClient
    .inputSchema(activateBirthModeSchema)
    .action(async ({ parsedInput: { pregnancyId }, ctx: { supabase, user } }) => {
      const { data: pregnancy, error } = await supabase
        .from("pregnancies")
        .update({
          birth_mode_active: true,
          birth_mode_activated_at: new Date().toISOString(),
          birth_mode_activated_by: user.id,
        })
        .eq("id", pregnancyId)
        .select("id, patient_id")
        .single();

      if (error) throw new Error(error.message);

      revalidatePath(`/patients/${pregnancy.patient_id}/profile`);

      scheduleBirthModeActivationNotifications(pregnancyId).catch((err) => {
        console.error("[activate-birth-mode] Failed to schedule WhatsApp notifications", err);
      });

      await captureServerEvent(user.id, "activate_birth_mode", {
        pregnancy_id: pregnancyId,
      });

      return { success: true };
    });
  ```
- **MIRROR**: `deactivatePatientContractAction` (`apps/web/src/actions/deactivate-patient-contract-action.ts`) para o shape geral da action; `finishPatientCareAction` (`finish-patient-care-action.ts:52-57`) para o padrão de disparo de notificação fire-and-forget (`.catch` sem `await` bloqueante)
- **IMPORTS**: `activateBirthModeSchema` de `@/lib/validations/birth-mode`, `scheduleBirthModeActivationNotifications` de `@/lib/notifications/birth-mode`
- **GOTCHA**: use o client `supabase` (anon key, respeita RLS via `is_team_member`), NÃO `supabaseAdmin` — a ativação é uma escrita de time normal, já coberta pela policy "Team members can update pregnancies" (`packages/supabase/supabase/migrations/20260313000001_pregnancies_table.sql:62`); `supabaseAdmin` só entra dentro de `scheduleBirthModeActivationNotifications` para ler `team_members` sem restrição de RLS do chamador
- **GOTCHA**: chame `scheduleBirthModeActivationNotifications` SEM `await` bloqueante (fire-and-forget com `.catch`) — mesmo padrão de `finish-patient-care-action.ts:52-57` — para não atrasar a resposta da action esperando o fan-out inteiro
- **VALIDATE**: `pnpm check-types`

### Task 6: VALIDAÇÃO MANUAL end-to-end
- **ACTION**: Testar o fluxo completo localmente
- **IMPLEMENT**: Chamar `activateBirthModeAction({ pregnancyId })` (via um teste manual/rota de debug temporária, ou diretamente do console de uma paciente de teste com 2+ `team_members`), depois verificar:
  1. `pregnancies.birth_mode_active/activated_at/activated_by` atualizados
  2. Uma linha por profissional aparece na fila `whatsapp_notifications` (verificar via `notification_queue_index` ou aguardar o cron)
  3. Após o cron `process-notification-queues` rodar (ou disparo manual da rota com `NOTIFICATION_QUEUE_DRY_RUN=true` local), `notification_log` recebe uma linha `channel='whatsapp'`, `notification_type='birth_mode_activated'` por profissional
- **VALIDATE**: Consulta SQL manual — `SELECT * FROM notification_log WHERE notification_type = 'birth_mode_activated' ORDER BY created_at DESC;`

---

## Testing Strategy

### Unit Tests to Write

Não há testes unitários pré-existentes para o código de notificação/fila neste repositório (`apps/web/src/lib/notifications` e `apps/web/src/lib/billing` não têm `*.test.ts`). Não introduzir suite nova isoladamente — seguir a convenção atual (validação manual via `notification_log` + `NOTIFICATION_QUEUE_DRY_RUN`).

### Edge Cases Checklist

- [ ] Paciente sem nenhum `team_members` cadastrado → `scheduleBirthModeActivationNotifications` retorna sem erro, sem lançar exceção que afete a action de ativação
- [ ] Gestação já com `birth_mode_active = true` (reativação) → `dedupKey` por destinatário impede duplicata se a mensagem anterior ainda estiver na fila (mesmo `pregnancyId` + `userId`)
- [ ] Modo Parto desativado entre a ativação e a drenagem da fila → `handleBirthModeActivated` deve retornar `{ action: "skip" }` (revalida `birth_mode_active`)
- [ ] Falha ao enfileirar para 1 de N profissionais → não deve impedir o enfileiramento para os demais (try/catch por destinatário)
- [ ] `professional_id` sem telefone/opt-out de WhatsApp → tratado no nível do worker existente (`resolveRecipientPhone`), fora do escopo desta fase

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/actions/activate-birth-mode-action.ts apps/web/src/lib/notifications/birth-mode.ts apps/web/src/lib/validations/birth-mode.ts apps/web/src/lib/whatsapp/templates.ts apps/web/src/lib/notifications/whatsapp-queue-handlers.ts
```
**EXPECT**: Exit 0, sem erros de tipo ou lint

### Level 2: MANUAL_VALIDATION (não há suíte de unit test para este domínio)
Ver Task 6 acima — ativar Modo Parto para paciente de teste com 2+ `team_members` e confirmar `notification_log`.

### Level 3: DATABASE_VALIDATION
Nenhuma migration nova nesta fase (não há alteração de schema — reaproveita colunas da Fase 1 e infraestrutura de fila já existente). Não é necessário `pnpm db:types`.

---

## Acceptance Criteria

- [ ] `activateBirthModeAction` grava `birth_mode_active/activated_at/activated_by` em `pregnancies`
- [ ] Cada `team_members` da paciente recebe uma mensagem individual na fila `whatsapp_notifications` (não apenas uma mensagem colapsada)
- [ ] `notification_log` registra uma linha por profissional após o worker drenar a fila
- [ ] Handler `handleBirthModeActivated` pula o envio se `birth_mode_active` não for mais `true`
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma migration nova necessária (fase é 100% aplicação, sem mudança de schema)

---

## Completion Checklist

- [ ] Tasks 1-6 completas em ordem
- [ ] Level 1 (static analysis) passa
- [ ] Level 2 (validação manual via `notification_log`) confirma fan-out correto
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| --------------------------------------------------------- | ------------ | ------------ | ------------------------------------------------------------- |
| `dedupKey` mal desenhado colapsa fan-out em 1 mensagem só | M | H | `dedupKey` inclui `recipientId` explicitamente (ver Task 4 GOTCHA); testar com 2+ team_members antes de considerar a fase pronta |
| Template WhatsApp ainda não aprovado pela Meta | H (conhecido, fora de controle desta fase) | M | `name` placeholder, igual aos outros 17 tipos já no código — não bloqueia dev/staging, só o envio real em produção |
| Conteúdo do template violar política de saúde do WhatsApp Business | M | H | Corpo do template mantido genérico ("Modo Parto ativado para {{1}}") sem termos clínicos — documentado no código |
| Handler não revalida `birth_mode_active` e envia notificação atrasada após o parto já ter terminado | L | L | `handleBirthModeActivated` sempre revalida o estado atual antes de enviar (padrão idêntico aos outros handlers) |
| Nenhuma action de ativação real existir ainda deixa a Fase 4/5 sem gatilho compartilhado | M | M | Esta fase cria `activateBirthModeAction` como ponto de entrada único, para que Fase 4/5 apenas chamem essa action a partir da UI, sem duplicar a mutação |

---

## Notes

- Esta fase assume a decisão de escopo explícita: a "ativação do Modo Parto" (mutação + trigger) não tinha dono claro entre as fases do PRD original (Fase 1 só criou o schema; Fase 4 é sobre a tela de registro; Fase 5 é sobre o redirect). Como o sucesso da Fase 3 depende de uma ativação real e testável, a action mínima é criada aqui — a Fase 4/5 devem reutilizá-la (não recriar a mutação) quando construírem o botão de ativação na UI.
- Cancelamento automático de notificações pendentes na desativação do Modo Parto foi deixado fora do escopo (ver NOT Building) — se necessário no futuro, seguir o padrão de `cancelInstallmentNotifications` (`billing/notifications.ts:102-118`) com `referenceType: "pregnancy"`.
- O nome exato da constraint FK `pregnancies_patient_id_fkey` usado no handler (Task 3) deve ser confirmado contra `database.types.ts` durante a implementação — outras queries do arquivo usam o padrão `!<fk_name>(coluna)`; se o nome divergir, ajustar antes de rodar `pnpm check-types`.

---

*Generated: 2026-08-20*
*Source PRD: `.claude/PRPs/prds/modo-parto.prd.md` — Phase 3*
