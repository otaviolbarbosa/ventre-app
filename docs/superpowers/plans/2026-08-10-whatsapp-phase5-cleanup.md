# WhatsApp Integration — Fase 5 (Cleanup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a Fase 5 do design (`docs/superpowers/specs/2026-08-05-whatsapp-integration-design.md`): aposentar as duas pipelines de notificação legadas (push via `scheduled_notifications`/Edge Function `process-notifications`, e push de cobrança via `installments_scheduled_notifications`/cron `billing-notifications`) agora que o worker novo (`process-notification-queues`) está confirmado rodando com `NOTIFICATION_QUEUE_DRY_RUN=false` em produção — sem perder nenhuma notificação em trânsito e sem duplicar envios durante a transição.

**Architecture:** Nada de arquitetura nova. É puramente subtração: os triggers/cron Postgres passam a escrever só no pgmq (removendo o `INSERT`/`DELETE` no caminho `scheduled_notifications`, que hoje já é redundante — o pgmq é a fonte de verdade desde a Fase 1); a rota/cron de cobrança legada é removida porque `scheduleBillingNotifications` já faz dual-write no pgmq desde o plano "Billing Push Parity"; e as tabelas/função/Edge Function legadas são derrubadas depois que nada mais as referencia. Um achado de auditoria de produção (ver "Achado urgente" abaixo) reordena a primeira tarefa deste plano para antes de qualquer outra coisa.

**Tech Stack:** Migrations SQL (Postgres/Supabase, `pg_cron`), Next.js 15 Route Handlers (TypeScript), `apps/web/vercel.json` (Vercel Cron).

## Achado urgente (motiva a ordem das tarefas)

Consultei o banco de produção diretamente (`cron.job`, `notification_log`, `list_edge_functions`) antes de escrever este plano:

- `NOTIFICATION_QUEUE_DRY_RUN` está de fato `false` em produção (confirmado pelo usuário) — o worker novo (`process-notification-queues`, `pg_cron` jobid 6, roda a cada minuto) já envia push/WhatsApp reais.
- O `pg_cron` jobid 1 (`process-notifications`, a cada 5 min) **continua ativo** e chama `process_scheduled_notifications()` → Edge Function `process-notifications`, que está com `status: "ACTIVE"` no projeto e envia FCM de verdade (não é um shell vazio).
- `scheduleBillingNotifications()` já faz dual-write (legado `installments_scheduled_notifications` + pgmq `push_notifications`) desde o plano "Billing Push Parity" já mesclado — então o cron Vercel `billing-notifications` (`apps/web/vercel.json`, `0 12 * * *`) também está lendo e enviando os mesmos lembretes de cobrança que o worker novo já envia.

**Ou seja: com o dry-run desligado, `appointment_reminder`/`dpp_approaching` (via jobid 1) e `billing_reminder` (via cron `billing-notifications`) estão sendo enviados EM DOBRO agora mesmo** — uma vez pelo pipeline legado, uma vez pelo pipeline novo. Isso não é uma preocupação teórica de "antes de dropar tabelas" — é uma duplicação de envio real acontecendo em produção neste momento. Por isso a Tarefa 1 (desagendar o `pg_cron` jobid 1) vem antes de qualquer outra coisa neste plano, inclusive antes do ajuste de copy do template.

## Global Constraints

- Sem suíte de testes automatizada neste repo (mesma situação das fases anteriores) — verificação via `pnpm check-types` (obrigatório antes de cada commit) e consultas SQL diretas via MCP Supabase para confirmar o estado do banco depois de cada migration aplicada.
- Toda migration usa `IF EXISTS`/checagem de existência antes de `DROP`/`cron.unschedule` — este ambiente já teve migrations aplicadas fora de controle de versão (os `pg_cron` jobs legados nunca foram criados por uma migration, foram criados manualmente no dashboard, conforme o comentário em `20260209000001_notification_cron.sql`), então não é seguro assumir que o estado do banco bate 100% com o histórico de migrations do repo.
- `pnpm db:types` deve rodar depois de qualquer migration que altere schema (`DROP TABLE`/`DROP TYPE`/`DROP FUNCTION`), por instrução do `CLAUDE.md` do repo.
- Nenhuma migration desta fase deve tocar em `notifications`, `notification_settings`, `push_subscriptions` ou no enum `public.notification_type` — essas continuam em uso pelo histórico de notificações e pelas preferências do usuário; só `scheduled_notifications`, `installments_scheduled_notifications`, `process_scheduled_notifications()` e o enum `installments_notification_type` (exclusivo da tabela derrubada) saem.
- Aplicar migrations no projeto Supabase é uma ação que afeta o banco remoto compartilhado — antes de rodar `pnpm db:push` (ou aplicar via MCP), confirme explicitamente com o usuário, mesmo que este plano já tenha sido aprovado.
- Undeploy/exclusão da Edge Function `process-notifications` do lado do Supabase (o artefato hospedado, não o código no repo) é uma ação destrutiva sobre infraestrutura externa e **não está automatizada neste plano** — fica como passo manual final, documentado na Tarefa 6, para o usuário executar quando quiser.

---

## File Structure

- Create: `packages/supabase/supabase/migrations/20260810000001_unschedule_legacy_process_notifications_cron.sql` — desagenda o `pg_cron` jobid 1.
- Modify: `apps/web/src/lib/notifications/templates.ts` — `billing_reminder` ganha copy por cadência (paridade com o legado `getBillingNotificationMessage`).
- Modify: `apps/web/app/api/cron/process-notification-queues/route.ts` — `resolvePushRecipientAndTemplate` calcula a cadência (`due_in_7_days`/`due_in_3_days`/`due_today`/`overdue`) a partir do estado atual da parcela e passa pro template.
- Delete: `apps/web/app/api/cron/billing-notifications/route.ts` — rota do cron legado de cobrança.
- Modify: `apps/web/vercel.json` — remove a entrada `billing-notifications`.
- Modify: `apps/web/src/lib/billing/notifications.ts` — remove o caminho de escrita legado (`installments_scheduled_notifications`) de `scheduleBillingNotifications`/`cancelInstallmentNotifications`; remove `getBillingNotificationMessage` (código morto após a Tarefa 3); troca o tipo derivado de `Database["public"]["Enums"]["installments_notification_type"]` por um union literal local (o enum sai do banco na Tarefa 5).
- Create: `packages/supabase/supabase/migrations/20260810000002_pgmq_only_appointment_dpp_reminders.sql` — reescreve `schedule_appointment_reminders()`/`schedule_dpp_reminders()` sem o caminho `scheduled_notifications`.
- Create: `packages/supabase/supabase/migrations/20260810000003_drop_legacy_notification_tables.sql` — `DROP FUNCTION process_scheduled_notifications()`, `DROP TABLE scheduled_notifications`, `DROP TABLE installments_scheduled_notifications`, `DROP TYPE installments_notification_type`.
- Delete: `packages/supabase/supabase/functions/process-notifications/` — código-fonte da Edge Function legada (o artefato hospedado no Supabase precisa de undeploy manual separado, ver Tarefa 6).
- Modify: `packages/supabase/src/types/database.types.ts` — regenerado via `pnpm db:types` (não editado à mão).

---

## Task 1: Desagendar o `pg_cron` jobid 1 (`process-notifications`) — para a duplicação de envio agora

**Files:**
- Create: `packages/supabase/supabase/migrations/20260810000001_unschedule_legacy_process_notifications_cron.sql`

**Interfaces:**
- Consumes: nada (migration standalone).
- Produces: nada consumido por outra tarefa — efeito é só no estado do `pg_cron`, verificado por consulta SQL direta.

- [ ] **Step 1: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260810000001_unschedule_legacy_process_notifications_cron.sql
--
-- Fase 5 (cleanup): o pg_cron jobid 1 ("process-notifications", a cada 5 min) chama
-- process_scheduled_notifications() -> Edge Function process-notifications -> FCM real.
-- Com NOTIFICATION_QUEUE_DRY_RUN=false confirmado em produção, o worker novo
-- (process-notification-queues, jobid 6, a cada 1 min) já envia os MESMOS lembretes
-- (appointment_reminder / dpp_approaching) via pgmq. Manter os dois pipelines ativos ao
-- mesmo tempo duplica o envio real para o usuário final. Este job nunca foi criado por
-- uma migration (aplicado manualmente via dashboard, ver comentário em
-- 20260209000001_notification_cron.sql) — por isso o guard de existência abaixo, em vez
-- de um DROP/unschedule incondicional.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-notifications') THEN
    PERFORM cron.unschedule('process-notifications');
  END IF;
END $$;
```

- [ ] **Step 2: Aplicar a migration no projeto (confirmar com o usuário antes)**

Run: `pnpm db:push` (ou aplicar via MCP `apply_migration` se preferir não sair do fluxo do agente)
Expected: sem erro; `pg_cron` jobid 1 não existe mais.

- [ ] **Step 3: Verificar via SQL que o job sumiu**

Run (via MCP `execute_sql` ou `psql`):
```sql
SELECT jobid, jobname, active FROM cron.job WHERE jobname = 'process-notifications';
```
Expected: 0 linhas.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/supabase/migrations/20260810000001_unschedule_legacy_process_notifications_cron.sql
git commit -m "fix(whatsapp): unschedule legacy process-notifications pg_cron job to stop duplicate push sends"
```

---

## Task 2: Paridade de copy no template `billing_reminder`

**Files:**
- Modify: `apps/web/src/lib/notifications/templates.ts`
- Modify: `apps/web/app/api/cron/process-notification-queues/route.ts`

**Interfaces:**
- Consumes: `TemplateParams` existente em `apps/web/src/lib/notifications/templates.ts:9-21`.
- Produces: `TemplateParams.billingReminderType?: "due_in_7_days" | "due_in_3_days" | "due_today" | "overdue"` — novo campo opcional, consumido só pelo `case` de `billing_reminder` em `resolvePushRecipientAndTemplate` (`route.ts`). Nenhuma outra tarefa depende deste tipo.

- [ ] **Step 1: Adicionar o campo em `TemplateParams` e reescrever o template `billing_reminder`**

Em `apps/web/src/lib/notifications/templates.ts`, adicionar ao `type TemplateParams` (depois de `installmentNumber?: number;`, linha 19):

```ts
  billingReminderType?: "due_in_7_days" | "due_in_3_days" | "due_today" | "overdue";
```

Substituir a entrada `billing_reminder` (linhas 72-75) por:

```ts
    billing_reminder: () => {
      const formattedAmount = formatCurrency(Number(params.amount) ?? 0);
      const formattedDate = params.dueDate ?? "";
      const description = params.description ?? "";

      const messages: Record<
        NonNullable<TemplateParams["billingReminderType"]>,
        NotificationTemplate
      > = {
        due_in_7_days: {
          title: "Vencimento em 7 dias",
          body: `Parcela de ${formattedAmount} (${description}) vence em ${formattedDate}.`,
        },
        due_in_3_days: {
          title: "Vencimento em 3 dias",
          body: `Parcela de ${formattedAmount} (${description}) vence em ${formattedDate}.`,
        },
        due_today: {
          title: "Parcela vence hoje",
          body: `Parcela de ${formattedAmount} (${description}) vence hoje (${formattedDate}).`,
        },
        overdue: {
          title: "Parcela em atraso",
          body: `Parcela de ${formattedAmount} (${description}) venceu em ${formattedDate}.`,
        },
      };

      return messages[params.billingReminderType ?? "due_in_7_days"];
    },
```

- [ ] **Step 2: Calcular a cadência no worker e passar `description`/`billingReminderType`**

Em `apps/web/app/api/cron/process-notification-queues/route.ts`, dentro do bloco `if (notification.notificationType === "billing_reminder")` (linhas 125-157), trocar o `select` (linha 128) para incluir `description`:

```ts
      .select(
        "amount, due_date, status, billing:billings!installments_billing_id_fkey(patient_id, description)",
      )
```

E trocar o corpo de `billing.patient_id`/`getNotificationTemplate` (linhas 142-156) por:

```ts
    const billing = installment.billing as unknown as {
      patient_id: string;
      description: string;
    } | null;
    if (!billing?.patient_id) return null;

    const today = dayjs().startOf("day");
    const dueDate = dayjs(installment.due_date).startOf("day");
    const diffDays = dueDate.diff(today, "day");

    const billingReminderType: "due_in_7_days" | "due_in_3_days" | "due_today" | "overdue" =
      installment.status === "atrasado" || diffDays < 0
        ? "overdue"
        : diffDays <= 0
          ? "due_today"
          : diffDays <= 3
            ? "due_in_3_days"
            : "due_in_7_days";

    const template = getNotificationTemplate("billing_reminder", {
      amount: String(installment.amount),
      dueDate: dueDate.format("DD/MM/YYYY"),
      description: billing.description,
      billingReminderType,
    });

    return {
      type: "billing_reminder",
      userId: notification.recipientId,
      title: template.title,
      body: template.body,
      url: `/patients/${billing.patient_id}/billing`,
    };
```

Nota: a cadência é recalculada a partir do estado atual da parcela (`due_date`/`status`), não confiando no `dedup_key` usado no enqueue (`due_in_7_days_<userId>` etc.) — mesma regra de "o worker busca dado fresco na hora de enviar" já seguida pelos outros handlers deste arquivo.

- [ ] **Step 3: Rodar `pnpm check-types`**

Run: `pnpm check-types`
Expected: sem erros. Se o Biome reclamar de formatação/ordenação, rodar `npx biome lint --write --unsafe apps/web/src/lib/notifications/templates.ts apps/web/app/api/cron/process-notification-queues/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/notifications/templates.ts apps/web/app/api/cron/process-notification-queues/route.ts
git commit -m "fix(whatsapp): match legacy per-cadence copy for billing_reminder push template"
```

---

## Task 3: Retirar a pipeline legada de push de cobrança (rota, cron Vercel, dual-write)

**Files:**
- Delete: `apps/web/app/api/cron/billing-notifications/route.ts`
- Modify: `apps/web/vercel.json`
- Modify: `apps/web/src/lib/billing/notifications.ts`

**Interfaces:**
- Consumes: `enqueueNotification`/`cancelNotificationsForReference` já existentes (`apps/web/src/lib/notifications/queue.ts`) — inalterados.
- Produces: `scheduleBillingNotifications(billingId: string): Promise<void>` e `cancelInstallmentNotifications(installmentId: string): Promise<void>` mantêm a mesma assinatura pública — só o corpo interno muda (para de escrever em `installments_scheduled_notifications`). Nenhum outro arquivo precisa mudar a forma de chamá-las.

- [ ] **Step 1: Apagar a rota do cron legado**

```bash
rm apps/web/app/api/cron/billing-notifications/route.ts
```

- [ ] **Step 2: Remover a entrada do `vercel.json`**

Em `apps/web/vercel.json`, remover o objeto `{ "path": "/api/cron/billing-notifications", "schedule": "0 12 * * *" }`, mantendo `billing-statuses` intacto:

```json
{
  "crons": [
    {
      "path": "/api/cron/billing-statuses",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- [ ] **Step 3: Remover o caminho de escrita legado em `scheduleBillingNotifications`**

Em `apps/web/src/lib/billing/notifications.ts`, trocar a linha 7 (`type InstallmentsNotificationType = Database["public"]["Enums"]["installments_notification_type"];`) por um union literal local — o enum do banco sai na Tarefa 5, então não pode mais ser derivado de `Database`:

```ts
type InstallmentsNotificationType = "due_in_7_days" | "due_in_3_days" | "due_today";
```

Remover o import agora não usado de `Database` (linha 4, `import type { Database } from "@ventre/supabase/types";`) — checar antes se `Database` ainda é referenciado em outro ponto do arquivo (não é, depois desta tarefa).

Substituir o corpo de `scheduleBillingNotifications` (do `const now = dayjs();` na linha 65 até o fechamento do `try`, linha 146) por:

```ts
    const now = dayjs();

    for (const installment of installments) {
      for (const nt of notificationTypes) {
        const scheduledFor = dayjs(installment.due_date)
          .subtract(nt.daysBefore, "day")
          .hour(12)
          .minute(0)
          .second(0);

        if (scheduledFor.isBefore(now)) continue;

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
  } catch {
    console.error(
      "[billing-notifications] Failed to schedule notifications for billing:",
      billingId,
    );
  }
}
```

(Isso remove o array `rows`, o `INSERT INTO installments_scheduled_notifications` e o comentário sobre ordenar o insert legado antes do pgmq — não fazem mais sentido sem o caminho legado.)

- [ ] **Step 4: Remover o caminho de escrita legado em `cancelInstallmentNotifications`**

Substituir a função inteira (linhas 149-181) por:

```ts
export async function cancelInstallmentNotifications(installmentId: string) {
  try {
    // cancel_notifications_for_reference filtra só por (reference_type, reference_id) — não
    // por queue_name ou notification_type — então cancela mensagens pendentes em TODAS as
    // filas/tipos desta parcela: não só o billing_reminder de push, mas também os lembretes
    // WhatsApp da Fase 3 (installment_payment_reminder / installment_under_review_stalled /
    // installment_overdue_professional), que também usam reference_type = "installment".
    // Intencional: uma parcela paga/cancelada não deve receber lembrete em nenhum canal.
    await cancelNotificationsForReference("installment", installmentId);
  } catch (err) {
    console.error(
      "[billing-notifications] Failed to cancel pgmq notifications for installment:",
      installmentId,
      err,
    );
  }
}
```

- [ ] **Step 5: Remover `getBillingNotificationMessage` (código morto)**

Apagar a função `getBillingNotificationMessage` e o `type NotificationMessage` (linhas 9-12 e 183-212) — nada mais os referencia depois que a rota `billing-notifications` foi apagada no Step 1. Remover também o import de `formatCurrency` no topo do arquivo se ele deixar de ser usado (checar — `getBillingNotificationMessage` era o único consumidor).

- [ ] **Step 6: Rodar `pnpm check-types`**

Run: `pnpm check-types`
Expected: sem erros — nenhum arquivo fora de `notifications.ts` importava `getBillingNotificationMessage` além da rota já apagada (confirmado por grep antes de escrever este plano).

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/cron/billing-notifications apps/web/vercel.json apps/web/src/lib/billing/notifications.ts
git commit -m "fix(whatsapp): retire legacy billing push reminder pipeline (route, cron, dual-write)"
```

---

## Task 4: `scheduled_notifications` deixa de ser escrita — triggers ficam só-pgmq

**Files:**
- Create: `packages/supabase/supabase/migrations/20260810000002_pgmq_only_appointment_dpp_reminders.sql`

**Interfaces:**
- Consumes: `enqueue_notification`/`cancel_notifications_for_reference` (RPCs já existentes desde a Fase 1).
- Produces: nada consumido por outra tarefa — a assinatura de `schedule_appointment_reminders()` (trigger) e `schedule_dpp_reminders()` (chamada por `pg_cron` jobid 2, que **não** é tocado por este plano) não muda.

- [ ] **Step 1: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260810000002_pgmq_only_appointment_dpp_reminders.sql
--
-- Fase 5 (cleanup): remove o caminho scheduled_notifications (INSERT/DELETE) de
-- schedule_appointment_reminders() e schedule_dpp_reminders(), deixando só os
-- enqueue_notification/cancel_notifications_for_reference já em produção desde as
-- Fases 1 e 3. Pré-condição: Task 1 (jobid 1 desagendado) e Task 3 (rota
-- billing-notifications retirada) já aplicadas — nada mais lê scheduled_notifications.

CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'cancelada' THEN
    BEGIN
      PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_appointment_reminders: cancel_notifications_for_reference (cancel branch) failed for appointment %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'schedule_appointment_reminders: cancel_notifications_for_reference (reschedule branch) failed for appointment %: %', NEW.id, SQLERRM;
  END;

  IF NEW.status = 'agendada' THEN
    DECLARE
      appointment_datetime timestamptz;
      day_of_target timestamptz;
    BEGIN
      appointment_datetime := (NEW.date::text || ' ' || NEW.time::text)::timestamptz;

      IF appointment_datetime - INTERVAL '1 day' > now() THEN
        BEGIN
          PERFORM public.enqueue_notification(
            'push_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '1 day' - now()))::integer, 0),
            '1_day'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification push (1_day) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;

      IF appointment_datetime - INTERVAL '1 hour' > now() THEN
        BEGIN
          PERFORM public.enqueue_notification(
            'push_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '1 hour' - now()))::integer, 0),
            '1_hour'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification push (1_hour) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;

      IF appointment_datetime - INTERVAL '3 days' > now() THEN
        BEGIN
          PERFORM public.enqueue_notification(
            'whatsapp_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '3 days' - now()))::integer, 0),
            'wa_3_days'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification whatsapp (3_days) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;

      IF appointment_datetime - INTERVAL '1 day' > now() THEN
        BEGIN
          PERFORM public.enqueue_notification(
            'whatsapp_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '1 day' - now()))::integer, 0),
            'wa_1_day'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification whatsapp (1_day) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;

      day_of_target := (NEW.date::text || ' 08:00:00')::timestamptz;
      IF day_of_target > now() AND day_of_target < appointment_datetime THEN
        BEGIN
          PERFORM public.enqueue_notification(
            'whatsapp_notifications', 'appointment_reminder', 'appointment', NEW.id,
            'patient', NEW.patient_id,
            GREATEST(extract(epoch FROM (day_of_target - now()))::integer, 0),
            'wa_day_of'
          );
        EXCEPTION WHEN OTHERS THEN
          RAISE WARNING 'schedule_appointment_reminders: enqueue_notification whatsapp (day_of) failed for appointment %: %', NEW.id, SQLERRM;
        END;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_dpp_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patient_record RECORD;
BEGIN
  FOR patient_record IN
    SELECT p.id, p.name, pg.due_date
    FROM public.patients p
    JOIN LATERAL (
      SELECT preg.due_date
      FROM public.pregnancies preg
      WHERE preg.patient_id = p.id
        AND preg.has_finished = false
      ORDER BY preg.created_at DESC
      LIMIT 1
    ) pg ON true
    WHERE pg.due_date IS NOT NULL
      AND pg.due_date >= CURRENT_DATE
  LOOP
    IF patient_record.due_date - CURRENT_DATE = 30 THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, '30_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification push (30_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;

      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, 'wa_30_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification whatsapp (30_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
    END IF;

    IF patient_record.due_date - CURRENT_DATE = 15 THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, '15_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification push (15_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;

      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, 'wa_15_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification whatsapp (15_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
    END IF;

    IF patient_record.due_date - CURRENT_DATE = 7 THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, '7_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification push (7_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;

      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'dpp_approaching', 'patient', patient_record.id,
          'patient', patient_record.id, 0, 'wa_7_days'
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'schedule_dpp_reminders: enqueue_notification whatsapp (7_days) failed for patient %: %', patient_record.id, SQLERRM;
      END;
    END IF;
  END LOOP;
END;
$$;
```

- [ ] **Step 2: Aplicar a migration (confirmar com o usuário antes)**

Run: `pnpm db:push`
Expected: sem erro.

- [ ] **Step 3: Verificar manualmente**

Run (via MCP `execute_sql`):
```sql
SELECT pg_get_functiondef('public.schedule_appointment_reminders'::regproc);
SELECT pg_get_functiondef('public.schedule_dpp_reminders'::regproc);
```
Expected: nenhuma das duas definições contém mais `scheduled_notifications`.

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/supabase/migrations/20260810000002_pgmq_only_appointment_dpp_reminders.sql
git commit -m "fix(whatsapp): make appointment/dpp reminder triggers pgmq-only"
```

---

## Task 5: Derrubar os objetos legados no banco

**Files:**
- Create: `packages/supabase/supabase/migrations/20260810000003_drop_legacy_notification_tables.sql`

**Interfaces:**
- Consumes: nenhuma escrita ativa em `scheduled_notifications`/`installments_scheduled_notifications` (garantido pelas Tasks 1, 3 e 4 já aplicadas).
- Produces: nada — fim da cadeia de dependência desta fase.

**Pré-condição (checar antes de rodar):** Tasks 1, 3 e 4 já aplicadas no banco (não só commitadas) — confirmar com `SELECT jobid FROM cron.job WHERE jobname = 'process-notifications';` (deve retornar 0 linhas) antes de prosseguir.

- [ ] **Step 1: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260810000003_drop_legacy_notification_tables.sql
--
-- Fase 5 (cleanup), passo final: nada mais escreve ou lê scheduled_notifications /
-- installments_scheduled_notifications (Tasks 1, 3 e 4 já aplicadas). Deriva os objetos
-- legados. installments_notification_type só era usado pela coluna
-- installments_scheduled_notifications.type — sai junto. notification_type (enum) NÃO sai:
-- ainda é usado por notifications.type e notification_settings, que continuam em produção.

DROP FUNCTION IF EXISTS public.process_scheduled_notifications();
DROP TABLE IF EXISTS public.scheduled_notifications;
DROP TABLE IF EXISTS public.installments_scheduled_notifications;
DROP TYPE IF EXISTS public.installments_notification_type;
```

- [ ] **Step 2: Aplicar a migration (confirmar com o usuário antes — é destrutivo)**

Run: `pnpm db:push`
Expected: sem erro.

- [ ] **Step 3: Verificar**

Run (via MCP `execute_sql`):
```sql
SELECT to_regclass('public.scheduled_notifications') AS t1,
       to_regclass('public.installments_scheduled_notifications') AS t2,
       to_regproc('public.process_scheduled_notifications') AS f1,
       to_regtype('public.installments_notification_type') AS ty1;
```
Expected: todas as 4 colunas `NULL`.

- [ ] **Step 4: Regenerar tipos**

Run: `pnpm db:types`
Expected: `packages/supabase/src/types/database.types.ts` atualizado, sem mais `scheduled_notifications`/`installments_scheduled_notifications`/`installments_notification_type`.

- [ ] **Step 5: Rodar `pnpm check-types` no monorepo inteiro**

Run: `pnpm check-types`
Expected: sem erros — nenhum arquivo TS deveria mais referenciar os tipos derrubados (checado pelas Tasks 2 e 3, que já trocaram para unions locais).

- [ ] **Step 6: Commit**

```bash
git add packages/supabase/supabase/migrations/20260810000003_drop_legacy_notification_tables.sql packages/supabase/src/types/database.types.ts
git commit -m "fix(whatsapp): drop legacy scheduled_notifications/installments_scheduled_notifications tables"
```

---

## Task 6: Remover a Edge Function legada do repositório

**Files:**
- Delete: `packages/supabase/supabase/functions/process-notifications/`

**Interfaces:**
- Consumes: nada (Tasks 1 e 5 já garantiram que nada no banco chama esta função).
- Produces: nada.

- [ ] **Step 1: Apagar o diretório**

```bash
rm -rf packages/supabase/supabase/functions/process-notifications
```

- [ ] **Step 2: Commit**

```bash
git add packages/supabase/supabase/functions/process-notifications
git commit -m "chore(whatsapp): remove legacy process-notifications edge function source"
```

- [ ] **Step 3: Passo manual (fora deste plano, não automatizado) — reportar ao usuário**

O código-fonte saiu do repo, mas o artefato **hospedado** no Supabase (`process-notifications`, `status: ACTIVE`, sem mais nenhum `pg_cron` chamando-o desde a Task 1) continua deployado até alguém rodar o undeploy manualmente. Isso é uma ação destrutiva sobre infraestrutura externa e não está incluída neste plano — ao final da execução, avisar o usuário que ele pode remover a function via `supabase functions delete process-notifications` (ou pelo dashboard) quando quiser, sem pressa, já que ela está inofensiva (não é mais chamada por ninguém).

---

## Resumo da ordem de execução

1. Task 1 — para a duplicação de envio real de `appointment_reminder`/`dpp_approaching` (urgente).
2. Task 2 — paridade de copy do `billing_reminder` (pré-requisito de qualidade antes de desligar o legado).
3. Task 3 — para a duplicação de envio real de `billing_reminder` (rota + cron Vercel + dual-write).
4. Task 4 — triggers ficam pgmq-only.
5. Task 5 — dropa tabelas/função/enum legados.
6. Task 6 — remove código-fonte da Edge Function do repo; undeploy do artefato fica como passo manual do usuário.
