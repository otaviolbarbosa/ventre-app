# Billing Push Parity (pré-Fase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a lacuna descoberta ao planejar a Fase 5 (cleanup) do design de WhatsApp: `installments_scheduled_notifications` + o cron `billing-notifications` são hoje a **única** fonte de lembrete de cobrança via push (7d/3d/hoje, paciente + profissionais da equipe) — a cadência WhatsApp da Fase 3 (`schedule_installment_reminders`) só cobre 3 dias antes + atrasado, e só paciente. Sem portar esse push para o pipeline novo (pgmq), a Fase 5 não pode dropar a tabela/cron antigos sem regressão de produto. Este plano faz só a parte aditiva e segura: passa a enfileirar os mesmos lembretes também em `push_notifications` (pgmq), em paralelo ao caminho legado (que continua rodando sem alteração).

**Architecture:** `scheduleBillingNotifications()` (chamada síncrona a partir da action de billing) passa a, além do INSERT já existente em `installments_scheduled_notifications`, chamar `enqueueNotification()` para cada `(parcela, tipo de lembrete, destinatário)` na fila `push_notifications`, com `delaySeconds` calculado a partir do mesmo `scheduledFor` já calculado hoje, e `dedupKey` único por destinatário (necessário porque `notification_queue_index` teria colisão entre profissional e paciente na mesma parcela/tipo sem isso). `cancelInstallmentNotifications()` passa a também chamar `cancel_notifications_for_reference('installment', installmentId)` para cancelar as mensagens pendentes na fila nova. O worker (`process-notification-queues`) ganha um novo `case` em `resolvePushRecipientAndTemplate` para o tipo `billing_reminder`, reaproveitando o template já existente em `templates.ts`. Nada no caminho legado (tabela, cron `billing-notifications`, `getBillingNotificationMessage`) é alterado ou removido — é dual-write puro, seguindo exatamente o padrão já usado em `20260805100007_shadow_write_appointment_reminders.sql`/`20260805100008_shadow_write_dpp_reminders.sql`.

**Tech Stack:** Next.js 15 Route Handler (TypeScript), Supabase RPC (`enqueue_notification`/`cancel_notifications_for_reference`, já existentes desde a Fase 1 — nenhuma migration SQL nova é necessária neste plano).

**Nota de escopo:** Este plano é um pré-requisito descoberto durante o planejamento da "Fase 5" (cleanup) do design original — a Fase 5 propriamente dita (DROP TABLE `scheduled_notifications`/`installments_scheduled_notifications`, remoção da Edge Function `process-notifications` e dos crons legados) **não está neste plano** e só deve ser executada depois que alguém confirmar que `NOTIFICATION_QUEUE_DRY_RUN=false` está ativo em produção e validado por um período — hoje o valor local é `true` e o valor em produção não foi confirmado, o que significa que o worker novo pode estar em modo shadow (sem enviar push de verdade) para `appointment_reminder`/`dpp_approaching` também, não só para billing.

## Global Constraints

- Sem suíte de testes automatizada neste repo (sem `vitest.config`, sem script `test` em `apps/web/package.json`) — mesma situação das Fases 1-4. Verificação via `pnpm check-types` (obrigatório antes de cada commit) e revisão manual do código; se houver stack Supabase local rodando, validar também via `psql`/consulta a `notification_queue_index`.
- Dual-write apenas — não alterar, remover ou desativar nenhuma leitura/escrita existente em `installments_scheduled_notifications` ou o cron `billing-notifications`.
- `enqueueNotification`/`cancel_notifications_for_reference` já existem (Fase 1, `packages/supabase/supabase/migrations/20260805100004_notification_queue_producer_functions.sql`) — nenhuma migration SQL nova é necessária.
- Toda chamada nova a `enqueueNotification`/`cancelNotificationsForReference` deve estar em `try/catch` que só loga (nunca lança) — mesmo contrato de "nunca quebra o fluxo principal" que `scheduleBillingNotifications`/`cancelInstallmentNotifications` já seguem hoje (ambas têm `try/catch` externo com `console.error`).
- `dedup_key` de cada `enqueue_notification` deve ser único por `(notification_type='billing_reminder', reference_type='installment', reference_id=installment.id, queue_name='push_notifications')` — como uma parcela tem múltiplos destinatários (paciente + profissionais da equipe), o `dedup_key` precisa incluir o `userId` (ex.: `due_in_7_days_<userId>`), senão o segundo destinatário sobrescreve o índice do primeiro no `notification_queue_index` (PK inclui `dedup_key`, não `recipient_id`).
- `recipient_type` para esses enqueues é sempre `'user'` (não `'patient'`) — `scheduleBillingNotifications` já resolve `userIds` (paciente via `patients.user_id` + profissionais via `team_members.professional_id`), não IDs de paciente.
- `pnpm check-types` precisa passar antes de cada commit.

---

## File Structure

- Modify: `apps/web/src/lib/notifications/queue.ts` — adiciona `cancelNotificationsForReference()`, wrapper fino sobre a RPC `cancel_notifications_for_reference` (mesmo padrão dos outros wrappers no arquivo).
- Modify: `apps/web/src/lib/billing/notifications.ts` — `scheduleBillingNotifications()` e `cancelInstallmentNotifications()` passam a também enfileirar/cancelar na fila `push_notifications`.
- Modify: `apps/web/app/api/cron/process-notification-queues/route.ts` — `resolvePushRecipientAndTemplate()` ganha um `case` para `notificationType === "billing_reminder"`.

---

## Task 1: Wrapper de cancelamento + dual-write em `scheduleBillingNotifications`/`cancelInstallmentNotifications`

**Files:**
- Modify: `apps/web/src/lib/notifications/queue.ts`
- Modify: `apps/web/src/lib/billing/notifications.ts`

**Interfaces:**
- Consumes: `enqueueNotification(params)` já existente em `apps/web/src/lib/notifications/queue.ts:16-40` — assinatura `{ queueName: QueueName; notificationType: string; referenceType: string; referenceId: string; recipientType: "user" | "patient"; recipientId: string; delaySeconds?: number; dedupKey?: string }` → `Promise<number>`.
- Produces: `cancelNotificationsForReference(referenceType: string, referenceId: string): Promise<number>` — usado na Task 1 por `cancelInstallmentNotifications` e reaproveitável por qualquer código futuro que precise cancelar mensagens pendentes por referência.

- [ ] **Step 1: Adicionar `cancelNotificationsForReference` em `queue.ts`**

Em `apps/web/src/lib/notifications/queue.ts`, logo após a função `deadLetterNotification` (final do arquivo, linha 137), adicionar:

```ts
export async function cancelNotificationsForReference(
  referenceType: string,
  referenceId: string,
): Promise<number> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("cancel_notifications_for_reference", {
    p_reference_type: referenceType,
    p_reference_id: referenceId,
  });

  if (error) throw new Error(`cancelNotificationsForReference failed: ${error.message}`);
  return data as number;
}
```

- [ ] **Step 2: Rodar `pnpm check-types` e confirmar que compila**

Run: `pnpm check-types`
Expected: sem erros novos relacionados a `queue.ts` (a RPC `cancel_notifications_for_reference` já existe no banco desde a Fase 1, então os tipos gerados em `database.types.ts` já a reconhecem).

- [ ] **Step 3: Dual-write em `scheduleBillingNotifications`**

Em `apps/web/src/lib/billing/notifications.ts`, importar o novo helper no topo do arquivo:

```ts
import { enqueueNotification } from "@/lib/notifications/queue";
```

Substituir o loop `for (const installment of installments) { for (const nt of notificationTypes) { ... } }` (linhas 68-87) por:

```ts
for (const installment of installments) {
  for (const nt of notificationTypes) {
    const scheduledFor = dayjs(installment.due_date)
      .subtract(nt.daysBefore, "day")
      .hour(12)
      .minute(0)
      .second(0);

    if (scheduledFor.isBefore(now)) continue;

    for (const userId of userIds) {
      rows.push({
        installment_id: installment.id,
        user_id: userId,
        type: nt.type,
        scheduled_for: scheduledFor.toISOString(),
      });

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
        console.error(
          "[billing-notifications] Failed to enqueue pgmq push notification for installment:",
          installment.id,
          "user:",
          userId,
          err,
        );
      }
    }
  }
}
```

- [ ] **Step 4: Dual-cancel em `cancelInstallmentNotifications`**

Substituir o corpo de `cancelInstallmentNotifications` (linhas 100-114) por:

```ts
export async function cancelInstallmentNotifications(installmentId: string) {
  try {
    const supabaseAdmin = await createServerSupabaseAdmin();
    await supabaseAdmin
      .from("installments_scheduled_notifications")
      .update({ status: "cancelled" })
      .eq("installment_id", installmentId)
      .eq("status", "pending");
  } catch {
    console.error(
      "[billing-notifications] Failed to cancel notifications for installment:",
      installmentId,
    );
  }

  try {
    await cancelNotificationsForReference("installment", installmentId);
  } catch (err) {
    console.error(
      "[billing-notifications] Failed to cancel pgmq push notifications for installment:",
      installmentId,
      err,
    );
  }
}
```

E adicionar `cancelNotificationsForReference` ao import já feito no Step 3:

```ts
import { cancelNotificationsForReference, enqueueNotification } from "@/lib/notifications/queue";
```

- [ ] **Step 5: Rodar `pnpm check-types` e confirmar que compila**

Run: `pnpm check-types`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/notifications/queue.ts apps/web/src/lib/billing/notifications.ts
git commit -m "feat(whatsapp): dual-write billing push reminders to pgmq queue"
```

---

## Task 2: Suporte a `billing_reminder` no worker (`resolvePushRecipientAndTemplate`)

**Files:**
- Modify: `apps/web/app/api/cron/process-notification-queues/route.ts`

**Interfaces:**
- Consumes: `getNotificationTemplate("billing_reminder", { amount, dueDate })` de `apps/web/src/lib/notifications/templates.ts:72-75` — retorna `{ title, body }`. `DequeuedNotification` de `apps/web/src/lib/notifications/queue.ts:5-14` — `{ msgId, readCt, enqueuedAt, notificationType, referenceType, referenceId, recipientType: "user" | "patient", recipientId }`.
- Produces: nada consumido por outra task — este é o ponto final do fluxo (o loop de `GET` já existente em `route.ts:194-274` chama `resolvePushRecipientAndTemplate` e trata `null` como "descarta e segue").

- [ ] **Step 1: Adicionar o `case` de `billing_reminder`**

Em `apps/web/app/api/cron/process-notification-queues/route.ts`, dentro de `resolvePushRecipientAndTemplate` (função que hoje só trata `appointment_reminder` e `dpp_approaching`, linhas 39-126), adicionar antes do `return null;` final (linha 125):

```ts
  if (notification.notificationType === "billing_reminder") {
    const { data: installment, error: installmentError } = await supabaseAdmin
      .from("installments")
      .select("id, amount, due_date, status, billing:billings!installments_billing_id_fkey(description, patient_id)")
      .eq("id", notification.referenceId)
      .maybeSingle();

    if (installmentError) {
      throw new Error(
        `Falha ao buscar parcela ${notification.referenceId}: ${installmentError.message}`,
      );
    }

    if (!installment || installment.status === "pago" || installment.status === "cancelado") {
      return null;
    }

    const billing = installment.billing as unknown as { description: string; patient_id: string };

    const template = getNotificationTemplate("billing_reminder", {
      amount: String(installment.amount),
      dueDate: dayjs(installment.due_date).format("DD/MM/YYYY"),
    });

    return {
      type: "billing_reminder",
      userId: notification.recipientId,
      title: template.title,
      body: template.body,
      url: `/patients/${billing.patient_id}/billing`,
    };
  }
```

Nota: diferente de `appointment_reminder`/`dpp_approaching` (onde `recipientId` é `patients.id` e o `user_id` real é resolvido depois via join), aqui `recipientType` já é `'user'` e `recipientId` já É o `user_id` de destino — não precisa de resolução extra, porque `scheduleBillingNotifications` (Task 1) já enfileira um `enqueue_notification` por destinatário resolvido.

- [ ] **Step 2: Rodar `pnpm check-types` e confirmar que compila**

Run: `pnpm check-types`
Expected: sem erros. Se o Biome reclamar de ordenação de campos/import, rodar `npx biome lint --write --unsafe apps/web/app/api/cron/process-notification-queues/route.ts`.

- [ ] **Step 3: Verificação manual do dry-run (se houver stack Supabase local rodando)**

Se `pnpm supabase status` (ou stack local já ativa) indicar Postgres local disponível:

Run:
```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process-notification-queues | jq
```
Expected: resposta `200` com `dryRun: true` (comportamento padrão local) e sem exceção — confirma que o novo `case` não quebra o loop mesmo sem nenhuma mensagem `billing_reminder` real na fila ainda.

Se não houver stack local disponível, pular este step e confiar em `pnpm check-types` + revisão de código — documentar essa lacuna no PR/commit.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/cron/process-notification-queues/route.ts
git commit -m "feat(whatsapp): resolve billing_reminder push notifications in queue worker"
```

---

## Depois deste plano: o que falta para a Fase 5 (cleanup) de verdade

Não incluído aqui — requer decisão/confirmação fora do escopo deste plano:

1. Confirmar (ou definir) `NOTIFICATION_QUEUE_DRY_RUN=false` em produção (Vercel) e deixar rodando por um período de validação, observando `notification_log` (canal `push`) para os três tipos (`appointment_reminder`, `dpp_approaching`, `billing_reminder`) antes de desligar qualquer pipeline legado.
2. Só depois da validação acima: escrever a migration de cleanup real — `DROP TABLE public.scheduled_notifications`, `DROP TABLE public.installments_scheduled_notifications`, `DROP FUNCTION public.process_scheduled_notifications()`, reescrever `schedule_appointment_reminders()`/`schedule_dpp_reminders()` removendo os blocos `DELETE FROM`/`INSERT INTO scheduled_notifications` (mantendo só os `enqueue_notification`), remover `packages/supabase/supabase/functions/process-notifications/`, remover a rota `apps/web/app/api/cron/billing-notifications/route.ts` e sua entrada em `apps/web/vercel.json`, remover `scheduleBillingNotifications`'s legacy insert e `cancelInstallmentNotifications`'s legacy update (voltando a ser só pgmq), e cancelar os jobs `pg_cron` legados (`process-notifications` jobid 1, `schedule-dpp-reminders` jobid 2) diretamente no banco — esses não estão em nenhuma migration, foram aplicados manualmente.
3. Rodar `pnpm db:types` após a migration de cleanup.
4. **Achado da revisão final deste plano (não é regressão deste diff, mas bloqueia a Fase 5):** o conteúdo do push `billing_reminder` (via `getNotificationTemplate("billing_reminder", ...)`, reaproveitado como o próprio plano instruiu) é menos informativo que `getBillingNotificationMessage` (legado) — sem título por cadência ("Vencimento em 7 dias"/"3 dias"/"Parcela vence hoje"), sem a descrição da cobrança, e a mensagem do dia do vencimento lê "vence em `<hoje>`" em vez de "vence hoje". Antes de desligar o cron `billing-notifications` na Fase 5, ou ampliar `templates.ts`/`getNotificationTemplate` para cobrir esses casos, ou aceitar conscientemente essa degradação de produto.
