# Fase 3 — Mensagens Trigger/Cron-Based (WhatsApp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estender o worker `process-notification-queues` para consumir de verdade a fila `whatsapp_notifications` (hoje só monitorada, nunca drenada), e ligar as 15 mensagens trigger/cron da spec (8 de paciente + 7 de profissional) — 2 estendendo triggers existentes (`schedule_appointment_reminders`, `schedule_dpp_reminders`, já em shadow-write para push), 11 em funções cron novas (scan periódico), e 2 em triggers de linha novos (`payments`, `appointments`).

**Architecture:** O worker ganha um segundo loop de consumo (mesmo padrão do loop de push: `dequeue → resolve → template → send → log → ack/retry/dead-letter`), dirigido por uma tabela de despacho `WHATSAPP_QUEUE_HANDLERS: Record<WhatsAppNotificationType, Handler>` — cada handler busca dados frescos pelo `reference_id` (nunca confia no payload enfileirado), revalida a condição de negócio (ex.: consulta ainda `agendada`) e devolve destinatário + parâmetros de template, ou `skip`. Como o `sendWhatsAppToUser()` da Fase 2 nunca lança erro (contrato certo para o caminho síncrono das actions), o worker precisa de uma variante que **lança** em falha real da API da Meta — `sendWhatsAppTemplateFromQueue()` — para poder classificar erro e decidir entre `requeue_with_backoff` e `dead_letter_notification`, igual ao loop de push já faz com `classifyPushError`. No lado do Postgres, cada função de enfileiramento chama `enqueue_notification('whatsapp_notifications', ...)` com uma `dedup_key` própria (nunca reaproveitando a chave do push) para não colidir no índice `notification_queue_index`.

**Tech Stack:** Next.js 15 Route Handler (TypeScript), PL/pgSQL (`SECURITY DEFINER` functions + `pg_cron`), Supabase (Postgres local via `db:reset`).

**Nota de desvio do spec:** a seção 5 da spec lista 9 funções cron novas por nome, mas não nomeia uma função para "parcela vencendo/vencida" (paciente) nem para "problema na cobrança da assinatura da plataforma" (profissional) — ambas mensagens estão descritas em prosa (seção "Os três caminhos" e Fluxo 3) mas ausentes da lista de função da seção 5. Este plano adiciona `schedule_installment_reminders()` e `schedule_subscription_billing_issue()` para cobrir essas duas, seguindo o mesmo padrão scan-cron das outras 9 — sem isso, 2 das 15 mensagens da Fase 3 ficariam sem produtor. Mesmo padrão de desvio documentado da Fase 2 (achado que muda o plano sem mudar a spec).

## Global Constraints

- Sem suíte de testes automatizada — mesma decisão das Fases 1/2. Verificação via `npx tsx` para módulos TS puros, `psql` + `curl` no worker para os produtores SQL.
- Templates da Meta ainda não aprovados (Fase 0 pendente) — nomes em `lib/whatsapp/templates.ts` continuam placeholders; só o `name` muda quando a Fase 0 concluir.
- `DRY_RUN` do worker (`NOTIFICATION_QUEUE_DRY_RUN`) já existe e se aplica igualmente ao novo loop de WhatsApp — nenhuma tarefa deste plano deve contornar esse gate; o loop de WhatsApp só chama a Meta de verdade quando `NOTIFICATION_QUEUE_DRY_RUN === "false"`.
- `sendWhatsAppTemplateFromQueue()` (novo, Task 2) é uma função **separada** de `sendWhatsAppToUser()` (Fase 2) — não altere o contrato "nunca lança" de `sendWhatsAppToUser()`, que continua em uso pelas 9 mensagens action-triggered da Fase 2.
- Toda função de enfileiramento (trigger ou cron) chama `enqueue_notification()` dentro de um bloco `BEGIN ... EXCEPTION WHEN OTHERS ... END` aninhado (mesmo padrão de `20260805100007`/`20260805100008`) — uma falha ao enfileirar nunca deve abortar o restante do scan/trigger.
- `dedup_key` de cada nova chamada `enqueue_notification` deve ser única por `(notification_type, reference_type, reference_id, queue_name)` e nunca reaproveitar uma chave já usada para push (ex.: `'1_day'`) — reaproveitar colidiria no índice `notification_queue_index` e apagaria a mensagem de push pendente.
- Nome de migration: `YYYYMMDDHHMMSS_descricao_em_snake_case.sql`, em `packages/supabase/supabase/migrations/`; próximo timestamp livre é `20260807000001` (a migration mais recente é `20260806100001_whatsapp_opt_out_columns.sql`).
- Depois de qualquer migration, rodar `pnpm db:types` antes de escrever/ajustar código TypeScript dependente.
- `pnpm check-types` precisa passar antes de cada commit.
- Ambiente local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; `pnpm --filter @ventre/supabase db:reset` aplica todas as migrations do zero.
- Novas funções cron (`schedule_*`) não recebem `REVOKE`/`GRANT` explícito — seguem o precedente de `schedule_dpp_reminders`/`schedule_appointment_reminders` (só as funções RPC chamadas via `supabase.rpc()` do lado do app, como `enqueue_notification`, precisam de `REVOKE ... GRANT service_role`).
- `cron.schedule(...)` roda diretamente dentro da migration (mesmo padrão de `20260805100006_process_notification_queues_cron.sql`), não como comentário/instrução manual.

---

## File Structure

**TypeScript modificado:**
- `apps/web/src/lib/notifications/errors.ts` — adiciona `classifyWhatsAppError`
- `apps/web/src/lib/notifications/whatsapp-send.ts` — exporta `resolveRecipientPhone` (deixa de ser privada)
- `apps/web/src/lib/whatsapp/templates.ts` — adiciona os 15 novos `WhatsAppNotificationType` + templates
- `apps/web/app/api/cron/process-notification-queues/route.ts` — adiciona o loop de consumo de `whatsapp_notifications`

**TypeScript novo:**
- `apps/web/src/lib/notifications/whatsapp-queue-send.ts` — `sendWhatsAppTemplateFromQueue()` (variante que lança erro, para uso exclusivo do worker)
- `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts` — `WHATSAPP_QUEUE_HANDLERS`, um handler por tipo de mensagem trigger/cron

**Migrations novas** (`packages/supabase/supabase/migrations/`):
- `20260807000001_whatsapp_appointment_reminder_cadence.sql` — estende `schedule_appointment_reminders()` (D-3/D-1/dia)
- `20260807000002_whatsapp_dpp_reminder_cadence.sql` — estende `schedule_dpp_reminders()` (30/15/7 dias)
- `20260807000003_schedule_appointment_unconfirmed.sql`
- `20260807000004_schedule_installment_reminders.sql`
- `20260807000005_schedule_installment_under_review_stalled.sql`
- `20260807000006_schedule_dpp_passed_no_birth_record.sql`
- `20260807000007_schedule_prenatal_followup_gap.sql`
- `20260807000008_schedule_contract_pending_signature.sql`
- `20260807000009_schedule_daily_agenda_summary.sql`
- `20260807000010_notify_payment_received_trigger.sql`
- `20260807000011_schedule_monthly_billing_report.sql`
- `20260807000012_schedule_installment_overdue_professional.sql`
- `20260807000013_notify_appointment_last_minute_cancel_trigger.sql`
- `20260807000014_schedule_team_invite_pending.sql`
- `20260807000015_schedule_subscription_billing_issue.sql`

---

### Task 1: Classificador de erro WhatsApp (`lib/notifications/errors.ts`)

**Files:**
- Modify: `apps/web/src/lib/notifications/errors.ts`

**Interfaces:**
- Consome: nada novo.
- Produz: `export function classifyWhatsAppError(error: { code?: string; message?: string }): NotificationErrorClassification`. Consumida pelo worker (Task 5).

- [ ] **Step 1: Escrever o script de verificação (falha por função inexistente)**

Salve como `/tmp/verify-whatsapp-error-classifier.ts` na raiz de `apps/web`:

```ts
import { classifyWhatsAppError } from "@/lib/notifications/errors";

console.assert(
  classifyWhatsAppError({ code: "131030" }) === "permanent",
  "invalid recipient number should be permanent",
);
console.assert(
  classifyWhatsAppError({ code: "131026" }) === "permanent",
  "undeliverable should be permanent",
);
console.assert(
  classifyWhatsAppError({ code: "132001" }) === "permanent",
  "template not approved should be permanent",
);
console.assert(
  classifyWhatsAppError({ code: "131009" }) === "permanent",
  "param mismatch should be permanent",
);
console.assert(
  classifyWhatsAppError({ code: "not_configured" }) === "permanent",
  "missing credentials should be permanent",
);
console.assert(
  classifyWhatsAppError({ code: "429" }) === "retryable",
  "rate limit should be retryable",
);
console.assert(
  classifyWhatsAppError({ code: "network_error" }) === "retryable",
  "network error should be retryable",
);
console.assert(
  classifyWhatsAppError({}) === "retryable",
  "unknown/missing code should default to retryable",
);

console.log("PASS");
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-error-classifier.ts
```

Esperado: `TypeError: classifyWhatsAppError is not a function` (o módulo existe, mas a função ainda não).

- [ ] **Step 3: Adicionar `classifyWhatsAppError` a `errors.ts`**

Acrescente ao final de `apps/web/src/lib/notifications/errors.ts`:

```ts
// Códigos de erro da Meta Cloud API (WhatsApp Business Platform). Ver seção "Classificação de
// erro da Meta" da spec: 131030/131026 = dado do destinatário (permanente), 132001/131009 =
// configuração de template (permanente), "not_configured" = credenciais ausentes (permanente,
// nunca deve ser retentado — é erro de configuração do ambiente, não de mensagem individual).
const PERMANENT_WHATSAPP_ERROR_CODES = new Set([
  "131030",
  "131026",
  "132001",
  "131009",
  "not_configured",
]);

export function classifyWhatsAppError(error: {
  code?: string;
  message?: string;
}): NotificationErrorClassification {
  if (error.code && PERMANENT_WHATSAPP_ERROR_CODES.has(error.code)) {
    return "permanent";
  }
  return "retryable";
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-error-classifier.ts
```

Esperado: `PASS`.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/notifications/errors.ts
git commit -m "feat(whatsapp): add classifyWhatsAppError for queue worker retry/dead-letter"
```

---

### Task 2: Sender para a fila (`lib/notifications/whatsapp-queue-send.ts`)

**Files:**
- Modify: `apps/web/src/lib/notifications/whatsapp-send.ts` (exportar `resolveRecipientPhone`)
- Create: `apps/web/src/lib/notifications/whatsapp-queue-send.ts`

**Interfaces:**
- Consome: `resolveRecipientPhone` (exportada de `whatsapp-send.ts`), `normalizePhoneToE164`, `sendWhatsAppTemplateMessage`/`WhatsAppApiError`, `getWhatsAppTemplate`.
- Produz:
  ```ts
  export type WhatsAppQueueRecipient = { recipientType: "patient" | "user"; recipientId: string };

  export type WhatsAppQueueSendResult =
    | { outcome: "sent"; externalMessageId: string }
    | { outcome: "skipped"; reason: string };

  export async function sendWhatsAppTemplateFromQueue(
    supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
    recipient: WhatsAppQueueRecipient,
    notificationType: WhatsAppNotificationType,
    templateParams: Parameters<typeof getWhatsAppTemplate>[1],
  ): Promise<WhatsAppQueueSendResult>;
  ```
  Diferente de `sendWhatsAppToUser` (Fase 2): **lança** `WhatsAppApiError`/`Error` em vez de capturar — o worker (Task 5) precisa do erro real para classificar retry vs. dead-letter. Consumida pelo worker.

- [ ] **Step 1: Exportar `resolveRecipientPhone`**

Em `apps/web/src/lib/notifications/whatsapp-send.ts`, altere a assinatura da função privada para exportada (mantendo o corpo idêntico):

```ts
export async function resolveRecipientPhone(
  supabaseAdmin: SupabaseAdmin,
  recipient: WhatsAppRecipient,
): Promise<{ phone: string | null; whatsappEnabled: boolean }> {
```

- [ ] **Step 2: Escrever o script de verificação (falha por falta do módulo novo)**

Salve como `/tmp/verify-whatsapp-queue-send.ts` na raiz de `apps/web`:

```ts
import { sendWhatsAppTemplateFromQueue } from "@/lib/notifications/whatsapp-queue-send";
import { WhatsAppApiError } from "@/lib/whatsapp/client";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { randomUUID } from "node:crypto";

async function main() {
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_SYSTEM_USER_TOKEN;

  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: professional } = await supabaseAdmin
    .from("users")
    .insert({
      id: randomUUID(),
      email: `queue-send-test-${Date.now()}@example.com`,
      name: "Profissional Teste Queue",
      user_type: "profissional",
    })
    .select("id")
    .single();
  if (!professional) throw new Error("failed to create test professional");

  const { data: optedOutPatient } = await supabaseAdmin
    .from("patients")
    .insert({
      name: "Paciente Opt-Out Queue",
      email: `opt-out-queue-${Date.now()}@example.com`,
      phone: "(11) 99999-0000",
      date_of_birth: "1990-01-01",
      created_by: professional.id,
      whatsapp_enabled: false,
    })
    .select("id")
    .single();
  if (!optedOutPatient) throw new Error("failed to create opted-out test patient");

  const skippedResult = await sendWhatsAppTemplateFromQueue(
    supabaseAdmin,
    { recipientType: "patient", recipientId: optedOutPatient.id },
    "patient_welcome",
    { patientName: "Paciente Opt-Out Queue" },
  );
  console.assert(
    skippedResult.outcome === "skipped",
    `expected outcome "skipped", got "${skippedResult.outcome}"`,
  );

  const { data: enabledPatient } = await supabaseAdmin
    .from("patients")
    .insert({
      name: "Paciente Ativa Queue",
      email: `enabled-queue-${Date.now()}@example.com`,
      phone: "(11) 98888-0000",
      date_of_birth: "1990-01-01",
      created_by: professional.id,
      whatsapp_enabled: true,
    })
    .select("id")
    .single();
  if (!enabledPatient) throw new Error("failed to create opted-in test patient");

  // Sem credenciais da Meta configuradas, deve LANÇAR (não engolir o erro) — esse é o
  // diferencial deste sender em relação a sendWhatsAppToUser (Fase 2).
  try {
    await sendWhatsAppTemplateFromQueue(
      supabaseAdmin,
      { recipientType: "patient", recipientId: enabledPatient.id },
      "patient_welcome",
      { patientName: "Paciente Ativa Queue" },
    );
    console.assert(false, "should have thrown when credentials are missing");
  } catch (err) {
    console.assert(err instanceof WhatsAppApiError, "should throw WhatsAppApiError, not swallow it");
    console.assert(
      (err as WhatsAppApiError).code === "not_configured",
      `expected code "not_configured", got "${(err as WhatsAppApiError).code}"`,
    );
  }

  await supabaseAdmin.from("patients").delete().in("id", [optedOutPatient.id, enabledPatient.id]);
  await supabaseAdmin.from("users").delete().eq("id", professional.id);

  console.log("PASS");
}

main();
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-queue-send.ts
```

Esperado: erro de módulo não encontrado (`Cannot find module '@/lib/notifications/whatsapp-queue-send'`).

- [ ] **Step 4: Escrever `whatsapp-queue-send.ts`**

```ts
// apps/web/src/lib/notifications/whatsapp-queue-send.ts
import { resolveRecipientPhone } from "@/lib/notifications/whatsapp-send";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp/client";
import { normalizePhoneToE164 } from "@/lib/whatsapp/phone";
import { getWhatsAppTemplate, type WhatsAppNotificationType } from "@/lib/whatsapp/templates";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export type WhatsAppQueueRecipient = { recipientType: "patient" | "user"; recipientId: string };

export type WhatsAppQueueSendResult =
  | { outcome: "sent"; externalMessageId: string }
  | { outcome: "skipped"; reason: string };

type WhatsAppTemplateParams = Parameters<typeof getWhatsAppTemplate>[1];
type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

// Irmã de sendWhatsAppToUser (lib/notifications/whatsapp-send.ts) para uso exclusivo do worker
// de fila: mesma resolução de destinatário/opt-out/telefone/template, mas LANÇA em falha real da
// API da Meta em vez de engolir — o worker precisa do erro para classificar retry vs.
// dead-letter (ver lib/notifications/errors.ts:classifyWhatsAppError).
export async function sendWhatsAppTemplateFromQueue(
  supabaseAdmin: SupabaseAdmin,
  recipient: WhatsAppQueueRecipient,
  notificationType: WhatsAppNotificationType,
  templateParams: WhatsAppTemplateParams,
): Promise<WhatsAppQueueSendResult> {
  const { phone, whatsappEnabled } = await resolveRecipientPhone(supabaseAdmin, recipient);

  if (!whatsappEnabled) {
    return { outcome: "skipped", reason: "skipped: opt-out" };
  }

  if (!phone) {
    return { outcome: "skipped", reason: "skipped: no phone on file" };
  }

  const normalizedPhone = normalizePhoneToE164(phone);
  if (!normalizedPhone) {
    return { outcome: "skipped", reason: "skipped: invalid phone format" };
  }

  const template = getWhatsAppTemplate(notificationType, templateParams);

  const { externalMessageId } = await sendWhatsAppTemplateMessage({
    to: normalizedPhone,
    templateName: template.name,
    parameters: template.parameters,
  });

  return { outcome: "sent", externalMessageId };
}
```

- [ ] **Step 5: Rodar a verificação de novo**

```bash
pnpm --filter @ventre/supabase dev
cd apps/web && npx tsx /tmp/verify-whatsapp-queue-send.ts
```

Esperado: `PASS`.

- [ ] **Step 6: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/notifications/whatsapp-send.ts apps/web/src/lib/notifications/whatsapp-queue-send.ts
git commit -m "feat(whatsapp): add sendWhatsAppTemplateFromQueue for the queue worker"
```

---

### Task 3: Extensão dos templates (`lib/whatsapp/templates.ts`)

**Files:**
- Modify: `apps/web/src/lib/whatsapp/templates.ts`

**Interfaces:**
- Produz: 15 novos valores em `WhatsAppNotificationType` (total 24, combinando com os 9 da Fase 2) + entradas correspondentes em `getWhatsAppTemplate`. Consumida pelos handlers do worker (Task 4).

Os 15 novos tipos, com o parâmetro posicional escolhido para cada um (mesma convenção da Fase 2 — `?? ""` para string ausente, `String(n ?? "")` para número ausente):

| Tipo | Parâmetros posicionais |
|---|---|
| `appointment_reminder` | `[patientName, date, time]` |
| `appointment_unconfirmed` | `[patientName, date, time]` |
| `installment_payment_reminder` | `[patientName, dueDate, status]` (`status`: `"vencendo"` \| `"vencida"`) |
| `installment_under_review_stalled` | `[patientName]` |
| `dpp_approaching` | `[patientName, daysUntilDpp]` |
| `dpp_passed_no_birth_record` | `[patientName]` |
| `prenatal_followup_gap` | `[patientName, gapDays]` |
| `contract_pending_signature` | `[patientName]` |
| `daily_agenda_summary` | `[professionalName, appointmentCount]` |
| `payment_received` | `[professionalName, patientName, amount]` |
| `monthly_billing_report` | `[professionalName, month, amount]` |
| `installment_overdue_professional` | `[professionalName, patientName]` |
| `appointment_last_minute_cancel` | `[professionalName, patientName, date, time]` |
| `team_invite_pending` | `[professionalName]` |
| `subscription_billing_issue` | `[professionalName]` |

- [ ] **Step 1: Escrever o script de verificação (falha por tipo/entrada inexistente)**

Salve como `/tmp/verify-whatsapp-templates-phase3.ts` na raiz de `apps/web`:

```ts
import { getWhatsAppTemplate } from "@/lib/whatsapp/templates";

const reminder = getWhatsAppTemplate("appointment_reminder", {
  patientName: "Maria",
  date: "10/03/2026",
  time: "14:00",
});
console.assert(reminder.name === "appointment_reminder", "template name should match type");
console.assert(
  JSON.stringify(reminder.parameters) === JSON.stringify(["Maria", "10/03/2026", "14:00"]),
  `unexpected parameters: ${JSON.stringify(reminder.parameters)}`,
);

const installmentReminder = getWhatsAppTemplate("installment_payment_reminder", {
  patientName: "Maria",
  dueDate: "15/03/2026",
  status: "vencendo",
});
console.assert(
  JSON.stringify(installmentReminder.parameters) ===
    JSON.stringify(["Maria", "15/03/2026", "vencendo"]),
  `unexpected parameters: ${JSON.stringify(installmentReminder.parameters)}`,
);

const dppApproaching = getWhatsAppTemplate("dpp_approaching", {
  patientName: "Maria",
  daysUntilDpp: 30,
});
console.assert(
  JSON.stringify(dppApproaching.parameters) === JSON.stringify(["Maria", "30"]),
  `unexpected parameters: ${JSON.stringify(dppApproaching.parameters)}`,
);

const dailyAgenda = getWhatsAppTemplate("daily_agenda_summary", {
  professionalName: "Dra. Ana",
  appointmentCount: 5,
});
console.assert(
  JSON.stringify(dailyAgenda.parameters) === JSON.stringify(["Dra. Ana", "5"]),
  `unexpected parameters: ${JSON.stringify(dailyAgenda.parameters)}`,
);

const paymentReceived = getWhatsAppTemplate("payment_received", {
  professionalName: "Dra. Ana",
  patientName: "Maria",
  amount: "150.00",
});
console.assert(
  JSON.stringify(paymentReceived.parameters) === JSON.stringify(["Dra. Ana", "Maria", "150.00"]),
  `unexpected parameters: ${JSON.stringify(paymentReceived.parameters)}`,
);

// Parâmetro numérico ausente vira string vazia, nunca "undefined".
const missingCount = getWhatsAppTemplate("daily_agenda_summary", { professionalName: "Dra. Ana" });
console.assert(
  missingCount.parameters[1] === "",
  `expected empty string for missing count, got "${missingCount.parameters[1]}"`,
);

// Os 9 tipos da Fase 2 continuam funcionando (não podem ter sido removidos/quebrados).
const scheduled = getWhatsAppTemplate("appointment_scheduled", {
  patientName: "Maria",
  date: "10/03/2026",
  time: "14:00",
});
console.assert(
  JSON.stringify(scheduled.parameters) === JSON.stringify(["Maria", "10/03/2026", "14:00"]),
  "Phase 2 appointment_scheduled template should be unchanged",
);

console.log("PASS");
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-templates-phase3.ts
```

Esperado: erro de compilação/runtime (`"appointment_reminder"` não é um `WhatsAppNotificationType` válido / `templates[type]` é `undefined`).

- [ ] **Step 3: Substituir o conteúdo de `templates.ts`**

```ts
// apps/web/src/lib/whatsapp/templates.ts

export type WhatsAppNotificationType =
  // Fase 2 — action-triggered
  | "appointment_scheduled"
  | "appointment_updated"
  | "appointment_cancelled"
  | "patient_welcome"
  | "care_finished"
  | "installment_payment_link"
  | "contract_signed"
  | "billing_status_updated"
  | "vaccine_record_updated"
  // Fase 3 — trigger/cron-based (paciente)
  | "appointment_reminder"
  | "appointment_unconfirmed"
  | "installment_payment_reminder"
  | "installment_under_review_stalled"
  | "dpp_approaching"
  | "dpp_passed_no_birth_record"
  | "prenatal_followup_gap"
  | "contract_pending_signature"
  // Fase 3 — trigger/cron-based (profissional)
  | "daily_agenda_summary"
  | "payment_received"
  | "monthly_billing_report"
  | "installment_overdue_professional"
  | "appointment_last_minute_cancel"
  | "team_invite_pending"
  | "subscription_billing_issue";

type WhatsAppTemplateParams = {
  patientName?: string;
  professionalName?: string;
  date?: string;
  time?: string;
  status?: string;
  paymentLink?: string;
  dueDate?: string;
  daysUntilDpp?: number;
  gapDays?: number;
  appointmentCount?: number;
  amount?: string;
  month?: string;
};

type WhatsAppTemplate = {
  name: string;
  parameters: string[];
};

// Os nomes abaixo são placeholders de negócio — a submissão real dos templates no Meta
// Business Manager (Fase 0 da spec, processo externo) ainda não aconteceu. Quando os
// templates forem aprovados, troque só o valor de `name` de cada entrada pelo nome real
// aprovado; a ordem/quantidade de `parameters` já reflete os placeholders posicionais
// ({{1}}, {{2}}...) que cada corpo de mensagem vai usar.
export function getWhatsAppTemplate(
  type: WhatsAppNotificationType,
  params: WhatsAppTemplateParams,
): WhatsAppTemplate {
  const templates: Record<WhatsAppNotificationType, () => WhatsAppTemplate> = {
    appointment_scheduled: () => ({
      name: "appointment_scheduled",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
    }),
    appointment_updated: () => ({
      name: "appointment_updated",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
    }),
    appointment_cancelled: () => ({
      name: "appointment_cancelled",
      parameters: [params.patientName ?? "", params.date ?? ""],
    }),
    patient_welcome: () => ({
      name: "patient_welcome",
      parameters: [params.patientName ?? ""],
    }),
    care_finished: () => ({
      name: "care_finished",
      parameters: [params.patientName ?? ""],
    }),
    installment_payment_link: () => ({
      name: "installment_payment_link",
      parameters: [params.patientName ?? "", params.paymentLink ?? ""],
    }),
    contract_signed: () => ({
      name: "contract_signed",
      parameters: [params.patientName ?? ""],
    }),
    billing_status_updated: () => ({
      name: "billing_status_updated",
      parameters: [params.patientName ?? "", params.status ?? ""],
    }),
    vaccine_record_updated: () => ({
      name: "vaccine_record_updated",
      parameters: [params.patientName ?? ""],
    }),
    appointment_reminder: () => ({
      name: "appointment_reminder",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
    }),
    appointment_unconfirmed: () => ({
      name: "appointment_unconfirmed",
      parameters: [params.patientName ?? "", params.date ?? "", params.time ?? ""],
    }),
    installment_payment_reminder: () => ({
      name: "installment_payment_reminder",
      parameters: [params.patientName ?? "", params.dueDate ?? "", params.status ?? ""],
    }),
    installment_under_review_stalled: () => ({
      name: "installment_under_review_stalled",
      parameters: [params.patientName ?? ""],
    }),
    dpp_approaching: () => ({
      name: "dpp_approaching",
      parameters: [params.patientName ?? "", String(params.daysUntilDpp ?? "")],
    }),
    dpp_passed_no_birth_record: () => ({
      name: "dpp_passed_no_birth_record",
      parameters: [params.patientName ?? ""],
    }),
    prenatal_followup_gap: () => ({
      name: "prenatal_followup_gap",
      parameters: [params.patientName ?? "", String(params.gapDays ?? "")],
    }),
    contract_pending_signature: () => ({
      name: "contract_pending_signature",
      parameters: [params.patientName ?? ""],
    }),
    daily_agenda_summary: () => ({
      name: "daily_agenda_summary",
      parameters: [params.professionalName ?? "", String(params.appointmentCount ?? "")],
    }),
    payment_received: () => ({
      name: "payment_received",
      parameters: [params.professionalName ?? "", params.patientName ?? "", params.amount ?? ""],
    }),
    monthly_billing_report: () => ({
      name: "monthly_billing_report",
      parameters: [params.professionalName ?? "", params.month ?? "", params.amount ?? ""],
    }),
    installment_overdue_professional: () => ({
      name: "installment_overdue_professional",
      parameters: [params.professionalName ?? "", params.patientName ?? ""],
    }),
    appointment_last_minute_cancel: () => ({
      name: "appointment_last_minute_cancel",
      parameters: [
        params.professionalName ?? "",
        params.patientName ?? "",
        params.date ?? "",
        params.time ?? "",
      ],
    }),
    team_invite_pending: () => ({
      name: "team_invite_pending",
      parameters: [params.professionalName ?? ""],
    }),
    subscription_billing_issue: () => ({
      name: "subscription_billing_issue",
      parameters: [params.professionalName ?? ""],
    }),
  };

  return templates[type]();
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-templates-phase3.ts
```

Esperado: `PASS`.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/whatsapp/templates.ts
git commit -m "feat(whatsapp): add template registry entries for the 15 trigger/cron messages"
```

---

### Task 4: Handlers de despacho da fila (`lib/notifications/whatsapp-queue-handlers.ts`)

**Files:**
- Create: `apps/web/src/lib/notifications/whatsapp-queue-handlers.ts`

**Interfaces:**
- Consome: `DequeuedNotification` (de `queue.ts`), `WhatsAppQueueRecipient` (Task 2), `getWhatsAppTemplate`/`WhatsAppNotificationType` (Task 3), `dayjs` (`@/lib/dayjs`, já usado pelo worker hoje).
- Produz:
  ```ts
  export type WhatsAppQueueHandlerResult =
    | { action: "send"; recipient: WhatsAppQueueRecipient; templateParams: Parameters<typeof getWhatsAppTemplate>[1] }
    | { action: "skip" };

  export type WhatsAppQueueHandler = (
    supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
    notification: DequeuedNotification,
  ) => Promise<WhatsAppQueueHandlerResult>;

  export const WHATSAPP_QUEUE_HANDLERS: Partial<Record<WhatsAppNotificationType, WhatsAppQueueHandler>>;
  ```
  Consumida pelo worker (Task 5). `notification.recipientType`/`recipientId` já vêm resolvidos do produtor (SQL) — os handlers só revalidam a condição de negócio via `reference_id` e buscam os campos que faltam para o template (nome, data etc.), nunca reconstroem o destinatário.

- [ ] **Step 1: Escrever o script de verificação (falha por falta do módulo)**

Salve como `/tmp/verify-whatsapp-queue-handlers.ts` na raiz de `apps/web`:

```ts
import { WHATSAPP_QUEUE_HANDLERS } from "@/lib/notifications/whatsapp-queue-handlers";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { randomUUID } from "node:crypto";

const EXPECTED_TYPES = [
  "appointment_reminder",
  "appointment_unconfirmed",
  "installment_payment_reminder",
  "installment_under_review_stalled",
  "dpp_approaching",
  "dpp_passed_no_birth_record",
  "prenatal_followup_gap",
  "contract_pending_signature",
  "daily_agenda_summary",
  "payment_received",
  "monthly_billing_report",
  "installment_overdue_professional",
  "appointment_last_minute_cancel",
  "team_invite_pending",
  "subscription_billing_issue",
];

async function main() {
  // Estrutural: os 15 tipos da Fase 3 têm handler registrado.
  for (const type of EXPECTED_TYPES) {
    console.assert(
      typeof WHATSAPP_QUEUE_HANDLERS[type as keyof typeof WHATSAPP_QUEUE_HANDLERS] === "function",
      `missing handler for "${type}"`,
    );
  }

  // Comportamental: appointment_reminder deve pular quando a consulta não está mais "agendada",
  // e deve mandar enviar quando está — prova que o handler busca dado fresco pelo reference_id
  // (não confia em nada do payload enfileirado) e revalida a condição de negócio.
  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: professional } = await supabaseAdmin
    .from("users")
    .insert({
      id: randomUUID(),
      email: `queue-handlers-test-${Date.now()}@example.com`,
      name: "Profissional Teste Handlers",
      user_type: "profissional",
    })
    .select("id")
    .single();
  if (!professional) throw new Error("failed to create test professional");

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .insert({
      name: "Paciente Handlers",
      email: `patient-handlers-${Date.now()}@example.com`,
      phone: "(11) 97777-0000",
      date_of_birth: "1990-01-01",
      created_by: professional.id,
    })
    .select("id")
    .single();
  if (!patient) throw new Error("failed to create test patient");

  const { data: cancelledAppointment } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_id: patient.id,
      professional_id: professional.id,
      date: "2026-12-01",
      time: "10:00:00",
      status: "cancelada",
      type: "consulta",
    })
    .select("id")
    .single();
  if (!cancelledAppointment) throw new Error("failed to create cancelled test appointment");

  const skipResult = await WHATSAPP_QUEUE_HANDLERS.appointment_reminder!(supabaseAdmin, {
    msgId: 1,
    readCt: 0,
    enqueuedAt: new Date().toISOString(),
    notificationType: "appointment_reminder",
    referenceType: "appointment",
    referenceId: cancelledAppointment.id,
    recipientType: "patient",
    recipientId: patient.id,
  });
  console.assert(skipResult.action === "skip", `expected skip for cancelled appointment, got "${skipResult.action}"`);

  const { data: scheduledAppointment } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_id: patient.id,
      professional_id: professional.id,
      date: "2026-12-01",
      time: "10:00:00",
      status: "agendada",
      type: "consulta",
    })
    .select("id")
    .single();
  if (!scheduledAppointment) throw new Error("failed to create scheduled test appointment");

  const sendResult = await WHATSAPP_QUEUE_HANDLERS.appointment_reminder!(supabaseAdmin, {
    msgId: 2,
    readCt: 0,
    enqueuedAt: new Date().toISOString(),
    notificationType: "appointment_reminder",
    referenceType: "appointment",
    referenceId: scheduledAppointment.id,
    recipientType: "patient",
    recipientId: patient.id,
  });
  console.assert(sendResult.action === "send", `expected send for scheduled appointment, got "${sendResult.action}"`);
  if (sendResult.action === "send") {
    console.assert(
      sendResult.templateParams.patientName === "Paciente Handlers",
      `expected patientName "Paciente Handlers", got "${sendResult.templateParams.patientName}"`,
    );
  }

  await supabaseAdmin.from("appointments").delete().in("id", [cancelledAppointment.id, scheduledAppointment.id]);
  await supabaseAdmin.from("patients").delete().eq("id", patient.id);
  await supabaseAdmin.from("users").delete().eq("id", professional.id);

  console.log("PASS");
}

main();
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-queue-handlers.ts
```

Esperado: erro de módulo não encontrado.

- [ ] **Step 3: Escrever `whatsapp-queue-handlers.ts`**

```ts
// apps/web/src/lib/notifications/whatsapp-queue-handlers.ts
import { dayjs } from "@/lib/dayjs";
import type { DequeuedNotification } from "@/lib/notifications/queue";
import type { WhatsAppQueueRecipient } from "@/lib/notifications/whatsapp-queue-send";
import { getWhatsAppTemplate, type WhatsAppNotificationType } from "@/lib/whatsapp/templates";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;
type WhatsAppTemplateParams = Parameters<typeof getWhatsAppTemplate>[1];

export type WhatsAppQueueHandlerResult =
  | { action: "send"; recipient: WhatsAppQueueRecipient; templateParams: WhatsAppTemplateParams }
  | { action: "skip" };

export type WhatsAppQueueHandler = (
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
) => Promise<WhatsAppQueueHandlerResult>;

function recipientOf(notification: DequeuedNotification): WhatsAppQueueRecipient {
  return { recipientType: notification.recipientType, recipientId: notification.recipientId };
}

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

async function handleAppointmentUnconfirmed(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("date, time, status, confirmed_by_patient_at, patient:patients!appointments_patient_id_fkey(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "agendada" || appointment.confirmed_by_patient_at) {
    return { action: "skip" };
  }

  const patient = appointment.patient as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "", date: appointment.date, time: appointment.time },
  };
}

async function handleInstallmentPaymentReminder(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("due_date, status, billing:billings(patient:patients(name))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || (installment.status !== "pendente" && installment.status !== "atrasado")) {
    return { action: "skip" };
  }

  const patient = (installment.billing as unknown as { patient: { name: string } | null } | null)?.patient;
  const status = installment.status === "atrasado" ? "vencida" : "vencendo";
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "", dueDate: installment.due_date, status },
  };
}

async function handleInstallmentUnderReviewStalled(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("status, billing:billings(patient:patients(name))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || installment.status !== "em_analise") return { action: "skip" };

  const patient = (installment.billing as unknown as { patient: { name: string } | null } | null)?.patient;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "" },
  };
}

async function handleDppApproaching(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
  if (!patient) return { action: "skip" };

  const { data: pregnancy, error: pregnancyError } = await supabaseAdmin
    .from("pregnancies")
    .select("due_date")
    .eq("patient_id", notification.referenceId)
    .eq("has_finished", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pregnancyError) {
    throw new Error(`Falha ao buscar gestação de ${notification.referenceId}: ${pregnancyError.message}`);
  }
  if (!pregnancy?.due_date) return { action: "skip" };

  const daysUntilDpp = dayjs(pregnancy.due_date).startOf("day").diff(dayjs().startOf("day"), "day");
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient.name, daysUntilDpp },
  };
}

async function handleDppPassedNoBirthRecord(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
  if (!patient) return { action: "skip" };

  const { data: pregnancy, error: pregnancyError } = await supabaseAdmin
    .from("pregnancies")
    .select("due_date, has_finished, born_at")
    .eq("patient_id", notification.referenceId)
    .eq("has_finished", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pregnancyError) {
    throw new Error(`Falha ao buscar gestação de ${notification.referenceId}: ${pregnancyError.message}`);
  }
  if (!pregnancy?.due_date || pregnancy.born_at || !dayjs(pregnancy.due_date).isBefore(dayjs(), "day")) {
    return { action: "skip" };
  }

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient.name },
  };
}

async function handlePrenatalFollowupGap(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: patient, error } = await supabaseAdmin
    .from("patients")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar gestante ${notification.referenceId}: ${error.message}`);
  if (!patient) return { action: "skip" };

  const { data: lastVisit } = await supabaseAdmin
    .from("appointments")
    .select("date")
    .eq("patient_id", notification.referenceId)
    .eq("status", "realizada")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastVisit) return { action: "skip" };

  const { count: upcomingCount } = await supabaseAdmin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", notification.referenceId)
    .eq("status", "agendada")
    .gte("date", dayjs().format("YYYY-MM-DD"));
  if ((upcomingCount ?? 0) > 0) return { action: "skip" };

  const gapDays = dayjs().startOf("day").diff(dayjs(lastVisit.date).startOf("day"), "day");
  if (gapDays < 45) return { action: "skip" };

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient.name, gapDays },
  };
}

async function handleContractPendingSignature(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: contract, error } = await supabaseAdmin
    .from("contracts")
    .select("is_signed, is_active, patient:patients(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar contrato ${notification.referenceId}: ${error.message}`);
  if (!contract || contract.is_signed || !contract.is_active) return { action: "skip" };

  const patient = contract.patient as unknown as { name: string } | null;
  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { patientName: patient?.name ?? "" },
  };
}

async function handleDailyAgendaSummary(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: professional, error } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar profissional ${notification.referenceId}: ${error.message}`);
  if (!professional) return { action: "skip" };

  const { count } = await supabaseAdmin
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", notification.referenceId)
    .eq("status", "agendada")
    .eq("date", dayjs().format("YYYY-MM-DD"));
  if (!count) return { action: "skip" };

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional.name, appointmentCount: count },
  };
}

async function handlePaymentReceived(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("paid_amount, installment:installments(billing:billings(patient:patients(name)))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar pagamento ${notification.referenceId}: ${error.message}`);
  if (!payment) return { action: "skip" };

  const patient = (
    payment.installment as unknown as {
      billing: { patient: { name: string } | null } | null;
    } | null
  )?.billing?.patient;
  if (!patient) return { action: "skip" };

  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      patientName: patient.name,
      amount: String(payment.paid_amount),
    },
  };
}

async function handleMonthlyBillingReport(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: professional, error } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar profissional ${notification.referenceId}: ${error.message}`);
  if (!professional) return { action: "skip" };

  const monthStart = dayjs().subtract(1, "month").startOf("month");
  const monthEnd = dayjs().subtract(1, "month").endOf("month");

  const { data: billings } = await supabaseAdmin
    .from("billings")
    .select("paid_amount, patient:patients!inner(created_by)")
    .eq("patient.created_by", notification.referenceId)
    .gte("created_at", monthStart.toISOString())
    .lte("created_at", monthEnd.toISOString());

  const total = (billings ?? []).reduce((sum, b) => sum + (b.paid_amount ?? 0), 0);
  if (total === 0) return { action: "skip" };

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional.name,
      month: monthStart.format("MM/YYYY"),
      amount: String(total),
    },
  };
}

async function handleInstallmentOverdueProfessional(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: installment, error } = await supabaseAdmin
    .from("installments")
    .select("status, billing:billings(patient:patients(name))")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar parcela ${notification.referenceId}: ${error.message}`);
  if (!installment || installment.status !== "atrasado") return { action: "skip" };

  const patient = (installment.billing as unknown as { patient: { name: string } | null } | null)?.patient;
  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional?.name ?? "", patientName: patient?.name ?? "" },
  };
}

async function handleAppointmentLastMinuteCancel(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("date, time, status, patient:patients!appointments_patient_id_fkey(name)")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar consulta ${notification.referenceId}: ${error.message}`);
  if (!appointment || appointment.status !== "cancelada") return { action: "skip" };

  const patient = appointment.patient as unknown as { name: string } | null;
  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", notification.recipientId)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: {
      professionalName: professional?.name ?? "",
      patientName: patient?.name ?? "",
      date: appointment.date,
      time: appointment.time,
    },
  };
}

async function handleTeamInvitePending(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: invite, error } = await supabaseAdmin
    .from("team_invites")
    .select("status, invited_professional_id")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar convite ${notification.referenceId}: ${error.message}`);
  if (!invite || invite.status !== "pending" || !invite.invited_professional_id) return { action: "skip" };

  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", invite.invited_professional_id)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional?.name ?? "" },
  };
}

async function handleSubscriptionBillingIssue(
  supabaseAdmin: SupabaseAdmin,
  notification: DequeuedNotification,
): Promise<WhatsAppQueueHandlerResult> {
  const { data: subscription, error } = await supabaseAdmin
    .from("subscriptions")
    .select("status, user_id")
    .eq("id", notification.referenceId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar assinatura ${notification.referenceId}: ${error.message}`);
  if (!subscription || !subscription.user_id || subscription.status !== "failed") return { action: "skip" };

  const { data: professional } = await supabaseAdmin
    .from("users")
    .select("name")
    .eq("id", subscription.user_id)
    .maybeSingle();

  return {
    action: "send",
    recipient: recipientOf(notification),
    templateParams: { professionalName: professional?.name ?? "" },
  };
}

export const WHATSAPP_QUEUE_HANDLERS: Partial<Record<WhatsAppNotificationType, WhatsAppQueueHandler>> = {
  appointment_reminder: handleAppointmentReminder,
  appointment_unconfirmed: handleAppointmentUnconfirmed,
  installment_payment_reminder: handleInstallmentPaymentReminder,
  installment_under_review_stalled: handleInstallmentUnderReviewStalled,
  dpp_approaching: handleDppApproaching,
  dpp_passed_no_birth_record: handleDppPassedNoBirthRecord,
  prenatal_followup_gap: handlePrenatalFollowupGap,
  contract_pending_signature: handleContractPendingSignature,
  daily_agenda_summary: handleDailyAgendaSummary,
  payment_received: handlePaymentReceived,
  monthly_billing_report: handleMonthlyBillingReport,
  installment_overdue_professional: handleInstallmentOverdueProfessional,
  appointment_last_minute_cancel: handleAppointmentLastMinuteCancel,
  team_invite_pending: handleTeamInvitePending,
  subscription_billing_issue: handleSubscriptionBillingIssue,
};
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
pnpm --filter @ventre/supabase dev
cd apps/web && npx tsx /tmp/verify-whatsapp-queue-handlers.ts
```

Esperado: `PASS`.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/notifications/whatsapp-queue-handlers.ts
git commit -m "feat(whatsapp): add per-type queue handlers for the 15 trigger/cron messages"
```

---

### Task 5: Worker — consumir `whatsapp_notifications` de verdade

**Files:**
- Modify: `apps/web/app/api/cron/process-notification-queues/route.ts`

**Interfaces:**
- Consome: `classifyWhatsAppError` (Task 1), `sendWhatsAppTemplateFromQueue` (Task 2), `WHATSAPP_QUEUE_HANDLERS` (Task 4), `WhatsAppNotificationType` (Task 3), `WhatsAppApiError` (`@/lib/whatsapp/client`).
- Produz: resposta JSON do `GET` passa a incluir `whatsapp: { sent, skipped, failed }` em vez de `whatsapp: { pending }`.

- [ ] **Step 1: Ajustar os imports**

No topo de `apps/web/app/api/cron/process-notification-queues/route.ts`, troque:

```ts
import { classifyPushError } from "@/lib/notifications/errors";
import { getNotificationTemplate } from "@/lib/notifications/templates";
import {
  ackNotification,
  deadLetterNotification,
  dequeueNotifications,
  getQueueLength,
  requeueWithBackoff,
  type DequeuedNotification,
} from "@/lib/notifications/queue";
import { type NotificationType, sendNotificationToUser } from "@/lib/notifications/send";
```

por:

```ts
import { classifyPushError, classifyWhatsAppError } from "@/lib/notifications/errors";
import { getNotificationTemplate } from "@/lib/notifications/templates";
import {
  ackNotification,
  deadLetterNotification,
  dequeueNotifications,
  requeueWithBackoff,
  type DequeuedNotification,
} from "@/lib/notifications/queue";
import { type NotificationType, sendNotificationToUser } from "@/lib/notifications/send";
import { WHATSAPP_QUEUE_HANDLERS } from "@/lib/notifications/whatsapp-queue-handlers";
import { sendWhatsAppTemplateFromQueue } from "@/lib/notifications/whatsapp-queue-send";
import { WhatsAppApiError } from "@/lib/whatsapp/client";
import type { WhatsAppNotificationType } from "@/lib/whatsapp/templates";
```

(`getQueueLength` sai da lista — o peek não destrutivo é substituído pelo dequeue real.)

- [ ] **Step 2: Adicionar o helper de log do WhatsApp**

Logo após a função `insertNotificationLog` existente, adicione:

```ts
async function insertWhatsAppQueueLog(
  supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
  notification: DequeuedNotification,
  status: "sent" | "failed",
  errorReason: string | null,
  externalMessageId?: string,
) {
  const { error } = await supabaseAdmin.from("notification_log").insert({
    channel: "whatsapp",
    notification_type: notification.notificationType,
    reference_type: notification.referenceType,
    reference_id: notification.referenceId,
    recipient_type: notification.recipientType,
    recipient_id: notification.recipientId,
    status,
    error_reason: errorReason,
    external_message_id: externalMessageId ?? null,
  });

  if (error) {
    console.error("[process-notification-queues] failed to write whatsapp notification_log row:", error);
  }
}
```

- [ ] **Step 3: Substituir o bloco final (peek de whatsapp + response) pelo loop de consumo real**

Troque:

```ts
  // Fase 1: fila de whatsapp existe mas ainda não tem remetente — só confirma o tamanho
  // da fila sem consumir mensagens (pgmq.metrics via notification_queue_length), em vez
  // de um dequeue destrutivo que queimaria read_ct na mensagem da cabeça sem nunca dar ack.
  const whatsappPending = await getQueueLength("whatsapp_notifications");

  return NextResponse.json({
    push: { sent: pushSent, skipped: pushSkipped, failed: pushFailed },
    whatsapp: { pending: whatsappPending },
    dryRun: DRY_RUN,
  });
}
```

por:

```ts
  let whatsappSent = 0;
  let whatsappSkipped = 0;
  let whatsappFailed = 0;

  const whatsappMessages = await dequeueNotifications("whatsapp_notifications", 20, 60);

  for (const notification of whatsappMessages) {
    try {
      const handler =
        WHATSAPP_QUEUE_HANDLERS[notification.notificationType as WhatsAppNotificationType];

      if (!handler) {
        // Tipo desconhecido (ex.: mensagem de uma versão futura/antiga do worker) — descarta
        // sem tentar reenviar, não é um erro retentável.
        await ackNotification("whatsapp_notifications", notification.msgId);
        whatsappSkipped++;
        continue;
      }

      const resolved = await handler(supabaseAdmin, notification);

      if (resolved.action === "skip") {
        await insertWhatsAppQueueLog(
          supabaseAdmin,
          notification,
          "failed",
          "skipped: condition no longer valid",
        );
        await ackNotification("whatsapp_notifications", notification.msgId);
        whatsappSkipped++;
        continue;
      }

      if (DRY_RUN) {
        await insertWhatsAppQueueLog(supabaseAdmin, notification, "sent", "dry_run (send skipped)");
        await ackNotification("whatsapp_notifications", notification.msgId);
        whatsappSent++;
        continue;
      }

      const sendResult = await sendWhatsAppTemplateFromQueue(
        supabaseAdmin,
        resolved.recipient,
        notification.notificationType as WhatsAppNotificationType,
        resolved.templateParams,
      );

      if (sendResult.outcome === "skipped") {
        await insertWhatsAppQueueLog(supabaseAdmin, notification, "failed", sendResult.reason);
        await ackNotification("whatsapp_notifications", notification.msgId);
        whatsappSkipped++;
        continue;
      }

      await insertWhatsAppQueueLog(
        supabaseAdmin,
        notification,
        "sent",
        null,
        sendResult.externalMessageId,
      );
      await ackNotification("whatsapp_notifications", notification.msgId);
      whatsappSent++;
    } catch (err) {
      const classification = classifyWhatsAppError(
        err instanceof WhatsAppApiError
          ? { code: err.code, message: err.message }
          : { message: err instanceof Error ? err.message : String(err) },
      );
      const reason = err instanceof Error ? err.message : "unknown error";

      try {
        if (classification === "permanent" || notification.readCt >= MAX_ATTEMPTS) {
          await deadLetterNotification({
            queueName: "whatsapp_notifications",
            msgId: notification.msgId,
            channel: "whatsapp",
            notificationType: notification.notificationType,
            referenceType: notification.referenceType,
            referenceId: notification.referenceId,
            recipientType: notification.recipientType,
            recipientId: notification.recipientId,
            reason,
          });
        } else {
          await requeueWithBackoff("whatsapp_notifications", notification.msgId, notification.readCt);
        }
      } catch (cleanupErr) {
        console.error(
          `[process-notification-queues] failed to dead-letter/requeue whatsapp msgId=${notification.msgId}:`,
          cleanupErr,
        );
      }
      whatsappFailed++;
    }
  }

  return NextResponse.json({
    push: { sent: pushSent, skipped: pushSkipped, failed: pushFailed },
    whatsapp: { sent: whatsappSent, skipped: whatsappSkipped, failed: whatsappFailed },
    dryRun: DRY_RUN,
  });
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 5: Verificação manual — worker roda sem erro mesmo com filas vazias**

```bash
pnpm --filter @ventre/supabase dev
pnpm --filter web dev
```

Em outro terminal:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process-notification-queues | jq
```

Esperado: JSON com `whatsapp: { sent: 0, skipped: 0, failed: 0 }` (ou não-zero se já houver mensagens de testes anteriores), `dryRun: true`, sem erro 500.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/cron/process-notification-queues/route.ts
git commit -m "feat(whatsapp): consume whatsapp_notifications queue in the cron worker"
```

---

### Task 6: Estender `schedule_appointment_reminders()` — cadência WhatsApp D-3/D-1/dia

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000001_whatsapp_appointment_reminder_cadence.sql`

**Interfaces:**
- Consome: `enqueue_notification` (já existe, Fase 1).
- Produz: 3 novas mensagens em `whatsapp_notifications` por consulta agendada (`appointment_reminder`, `dedup_key` `'wa_3_days'`/`'wa_1_day'`/`'wa_day_of'`). Consumida pelo handler `handleAppointmentReminder` (Task 4).

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-whatsapp-appointment-cadence.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-wa-cadence@example.com', 'Profissional Verify', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Cadence', 'verify-wa-cadence-patient@example.com', '(11) 90000-0000', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.appointments (patient_id, professional_id, date, time, status, type)
  VALUES (v_patient_id, v_professional_id, CURRENT_DATE + 10, '10:00:00', 'agendada', 'consulta')
  RETURNING id INTO v_appointment_id;

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'appointment'
    AND reference_id = v_appointment_id
    AND queue_name = 'whatsapp_notifications'
    AND dedup_key IN ('wa_3_days', 'wa_1_day', 'wa_day_of');

  DELETE FROM public.appointments WHERE id = v_appointment_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 3, format('expected 3 whatsapp reminder entries, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-whatsapp-appointment-cadence.sql
```

Esperado: `ASSERT` falha (`expected 3 whatsapp reminder entries, got 0`) — a função ainda só enfileira push.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000001_whatsapp_appointment_reminder_cadence.sql
--
-- Estende schedule_appointment_reminders() (shadow-write de 20260805100007) para também
-- enfileirar lembretes WhatsApp em D-3/D-1/dia da consulta (cadência própria da Fase 3,
-- distinta da cadência de push de 1 dia/1 hora). Todo o corpo da função é reescrito porque
-- CREATE OR REPLACE FUNCTION exige a definição completa — nenhuma lógica de push ou de
-- scheduled_notifications é alterada, só acrescentada a seção final de WhatsApp.
CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'cancelada' THEN
    DELETE FROM public.scheduled_notifications
    WHERE reference_id = NEW.id AND reference_type = 'appointment' AND processed_at IS NULL;
    BEGIN
      PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_appointment_reminders: cancel_notifications_for_reference (cancel branch) failed for appointment %: %', NEW.id, SQLERRM;
    END;
    RETURN NEW;
  END IF;

  DELETE FROM public.scheduled_notifications
  WHERE reference_id = NEW.id AND reference_type = 'appointment' AND processed_at IS NULL;
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
        INSERT INTO public.scheduled_notifications
          (notification_type, reference_id, reference_type, scheduled_for, payload)
        VALUES
          ('appointment_reminder', NEW.id, 'appointment',
           appointment_datetime - INTERVAL '1 day',
           jsonb_build_object('patient_id', NEW.patient_id, 'professional_id', NEW.professional_id, 'reminder_type', '1_day'))
        ON CONFLICT DO NOTHING;

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
        INSERT INTO public.scheduled_notifications
          (notification_type, reference_id, reference_type, scheduled_for, payload)
        VALUES
          ('appointment_reminder', NEW.id, 'appointment',
           appointment_datetime - INTERVAL '1 hour',
           jsonb_build_object('patient_id', NEW.patient_id, 'professional_id', NEW.professional_id, 'reminder_type', '1_hour'))
        ON CONFLICT DO NOTHING;

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

      -- WhatsApp: cadência própria D-3 / D-1 / dia da consulta (spec Fase 3, Fluxo 2).
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
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-whatsapp-appointment-cadence.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000001_whatsapp_appointment_reminder_cadence.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add D-3/D-1/day-of whatsapp cadence to appointment reminders"
```

---

### Task 7: Estender `schedule_dpp_reminders()` — WhatsApp 30/15/7 dias

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000002_whatsapp_dpp_reminder_cadence.sql`

**Interfaces:**
- Consome: `enqueue_notification`.
- Produz: mensagens `dpp_approaching` em `whatsapp_notifications` (`dedup_key` `'wa_30_days'`/`'wa_15_days'`/`'wa_7_days'`). Consumida por `handleDppApproaching` (Task 4).

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-whatsapp-dpp-cadence.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_pregnancy_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-wa-dpp@example.com', 'Profissional Verify DPP', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify DPP', 'verify-wa-dpp-patient@example.com', '(11) 90000-0001', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.pregnancies (patient_id, due_date, has_finished, created_by)
  VALUES (v_patient_id, CURRENT_DATE + 30, false, v_professional_id)
  RETURNING id INTO v_pregnancy_id;

  PERFORM public.schedule_dpp_reminders();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'patient'
    AND reference_id = v_patient_id
    AND queue_name = 'whatsapp_notifications'
    AND dedup_key = 'wa_30_days';

  DELETE FROM public.pregnancies WHERE id = v_pregnancy_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp dpp_approaching (30 days) entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-whatsapp-dpp-cadence.sql
```

Esperado: `ASSERT` falha (`got 0`).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000002_whatsapp_dpp_reminder_cadence.sql
--
-- Estende schedule_dpp_reminders() (shadow-write de 20260805100008) para também enfileirar em
-- whatsapp_notifications, espelhando exatamente as janelas de 30/15/7 dias já usadas para push.
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
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 30))
      ON CONFLICT DO NOTHING;

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
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 15))
      ON CONFLICT DO NOTHING;

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
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 7))
      ON CONFLICT DO NOTHING;

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

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-whatsapp-dpp-cadence.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000002_whatsapp_dpp_reminder_cadence.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add whatsapp enqueue to dpp reminder cadence"
```

---

### Task 8: `schedule_appointment_unconfirmed()` — consulta sem confirmação na véspera

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000003_schedule_appointment_unconfirmed.sql`

**Interfaces:**
- Produz: função `schedule_appointment_unconfirmed() RETURNS void` + `cron.schedule('schedule-appointment-unconfirmed', '0 18 * * *', ...)`. Enfileira `appointment_unconfirmed` em `whatsapp_notifications` para consultas de amanhã ainda não confirmadas. Consumida por `handleAppointmentUnconfirmed` (Task 4).

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-appointment-unconfirmed.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-unconfirmed@example.com', 'Profissional Verify Unconfirmed', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Unconfirmed', 'verify-unconfirmed-patient@example.com', '(11) 90000-0002', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.appointments (patient_id, professional_id, date, time, status, type)
  VALUES (v_patient_id, v_professional_id, CURRENT_DATE + 1, '10:00:00', 'agendada', 'consulta')
  RETURNING id INTO v_appointment_id;

  PERFORM public.schedule_appointment_unconfirmed();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'appointment'
    AND reference_id = v_appointment_id
    AND queue_name = 'whatsapp_notifications'
    AND dedup_key = 'wa_unconfirmed';

  DELETE FROM public.appointments WHERE id = v_appointment_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp appointment_unconfirmed entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-appointment-unconfirmed.sql
```

Esperado: erro `function public.schedule_appointment_unconfirmed() does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000003_schedule_appointment_unconfirmed.sql
CREATE OR REPLACE FUNCTION public.schedule_appointment_unconfirmed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  appointment_record RECORD;
BEGIN
  FOR appointment_record IN
    SELECT id, patient_id
    FROM public.appointments
    WHERE date = CURRENT_DATE + 1
      AND status = 'agendada'
      AND confirmed_by_patient_at IS NULL
      AND patient_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'appointment_unconfirmed', 'appointment', appointment_record.id,
        'patient', appointment_record.patient_id, 0, 'wa_unconfirmed'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_appointment_unconfirmed: enqueue_notification failed for appointment %: %', appointment_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-appointment-unconfirmed',
  '0 18 * * *',
  'SELECT public.schedule_appointment_unconfirmed()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-appointment-unconfirmed.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000003_schedule_appointment_unconfirmed.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_appointment_unconfirmed cron"
```

---

### Task 9: `schedule_installment_reminders()` — parcela vencendo/vencida (paciente)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000004_schedule_installment_reminders.sql`

**Interfaces:**
- Produz: função `schedule_installment_reminders() RETURNS void` + `cron.schedule('schedule-installment-reminders', '0 9 * * *', ...)`. Enfileira `installment_payment_reminder`. Consumida por `handleInstallmentPaymentReminder`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-installment-reminders.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_billing_id uuid;
  v_installment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-installment-reminder@example.com', 'Profissional Verify Installment', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Installment', 'verify-installment-patient@example.com', '(11) 90000-0003', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.billings (patient_id, description, payment_method, total_amount)
  VALUES (v_patient_id, 'Verify billing', 'pix', 100)
  RETURNING id INTO v_billing_id;

  INSERT INTO public.installments (billing_id, due_date, amount, installment_number, status)
  VALUES (v_billing_id, CURRENT_DATE + 3, 100, 1, 'pendente')
  RETURNING id INTO v_installment_id;

  PERFORM public.schedule_installment_reminders();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'installment'
    AND reference_id = v_installment_id
    AND queue_name = 'whatsapp_notifications'
    AND dedup_key = 'wa_due_soon';

  DELETE FROM public.installments WHERE id = v_installment_id;
  DELETE FROM public.billings WHERE id = v_billing_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp installment_payment_reminder entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-installment-reminders.sql
```

Esperado: erro `function public.schedule_installment_reminders() does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000004_schedule_installment_reminders.sql
CREATE OR REPLACE FUNCTION public.schedule_installment_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  installment_record RECORD;
  v_dedup_key text;
BEGIN
  FOR installment_record IN
    SELECT i.id, i.status, b.patient_id
    FROM public.installments i
    JOIN public.billings b ON b.id = i.billing_id
    WHERE (i.status = 'pendente' AND i.due_date - CURRENT_DATE = 3)
       OR i.status = 'atrasado'
  LOOP
    v_dedup_key := CASE
      WHEN installment_record.status = 'atrasado' THEN 'wa_overdue_' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
      ELSE 'wa_due_soon'
    END;

    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'installment_payment_reminder', 'installment', installment_record.id,
        'patient', installment_record.patient_id, 0, v_dedup_key
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_installment_reminders: enqueue_notification failed for installment %: %', installment_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-installment-reminders',
  '0 9 * * *',
  'SELECT public.schedule_installment_reminders()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-installment-reminders.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000004_schedule_installment_reminders.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_installment_reminders cron (due soon / overdue)"
```

---

### Task 10: `schedule_installment_under_review_stalled()` — pagamento em análise parado

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000005_schedule_installment_under_review_stalled.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-installment-under-review-stalled', '0 10 * * *', ...)`. Consumida por `handleInstallmentUnderReviewStalled`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-installment-under-review-stalled.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_billing_id uuid;
  v_installment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-stalled@example.com', 'Profissional Verify Stalled', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Stalled', 'verify-stalled-patient@example.com', '(11) 90000-0004', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.billings (patient_id, description, payment_method, total_amount)
  VALUES (v_patient_id, 'Verify billing stalled', 'pix', 100)
  RETURNING id INTO v_billing_id;

  INSERT INTO public.installments (billing_id, due_date, amount, installment_number, status)
  VALUES (v_billing_id, CURRENT_DATE - 5, 100, 1, 'em_analise')
  RETURNING id INTO v_installment_id;

  INSERT INTO public.payments (installment_id, paid_amount, paid_at, payment_method, registered_by)
  VALUES (v_installment_id, 100, now() - INTERVAL '4 days', 'pix', v_professional_id);

  PERFORM public.schedule_installment_under_review_stalled();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'installment'
    AND reference_id = v_installment_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.payments WHERE installment_id = v_installment_id;
  DELETE FROM public.installments WHERE id = v_installment_id;
  DELETE FROM public.billings WHERE id = v_billing_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp installment_under_review_stalled entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-installment-under-review-stalled.sql
```

Esperado: erro `function ... does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000005_schedule_installment_under_review_stalled.sql
CREATE OR REPLACE FUNCTION public.schedule_installment_under_review_stalled()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  installment_record RECORD;
BEGIN
  FOR installment_record IN
    SELECT i.id, b.patient_id
    FROM public.installments i
    JOIN public.billings b ON b.id = i.billing_id
    WHERE i.status = 'em_analise'
      AND EXISTS (
        SELECT 1 FROM public.payments pm
        WHERE pm.installment_id = i.id
          AND pm.paid_at < now() - INTERVAL '3 days'
      )
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'installment_under_review_stalled', 'installment', installment_record.id,
        'patient', installment_record.patient_id, 0,
        'wa_stalled_' || to_char(now(), 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_installment_under_review_stalled: enqueue_notification failed for installment %: %', installment_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-installment-under-review-stalled',
  '0 10 * * *',
  'SELECT public.schedule_installment_under_review_stalled()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-installment-under-review-stalled.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000005_schedule_installment_under_review_stalled.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_installment_under_review_stalled cron"
```

---

### Task 11: `schedule_dpp_passed_no_birth_record()` — DPP passada sem registro de nascimento

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000006_schedule_dpp_passed_no_birth_record.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-dpp-passed-no-birth-record', '0 8 * * *', ...)`. Consumida por `handleDppPassedNoBirthRecord`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-dpp-passed-no-birth-record.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_pregnancy_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-dpp-passed@example.com', 'Profissional Verify DPP Passed', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify DPP Passed', 'verify-dpp-passed-patient@example.com', '(11) 90000-0005', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.pregnancies (patient_id, due_date, has_finished, born_at, created_by)
  VALUES (v_patient_id, CURRENT_DATE - 3, false, NULL, v_professional_id)
  RETURNING id INTO v_pregnancy_id;

  PERFORM public.schedule_dpp_passed_no_birth_record();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'patient'
    AND reference_id = v_patient_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.pregnancies WHERE id = v_pregnancy_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp dpp_passed_no_birth_record entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-dpp-passed-no-birth-record.sql
```

Esperado: erro `function ... does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000006_schedule_dpp_passed_no_birth_record.sql
CREATE OR REPLACE FUNCTION public.schedule_dpp_passed_no_birth_record()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patient_record RECORD;
BEGIN
  FOR patient_record IN
    SELECT p.id
    FROM public.patients p
    JOIN LATERAL (
      SELECT preg.due_date, preg.born_at
      FROM public.pregnancies preg
      WHERE preg.patient_id = p.id AND preg.has_finished = false
      ORDER BY preg.created_at DESC
      LIMIT 1
    ) pg ON true
    WHERE pg.due_date IS NOT NULL
      AND pg.due_date < CURRENT_DATE
      AND pg.born_at IS NULL
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'dpp_passed_no_birth_record', 'patient', patient_record.id,
        'patient', patient_record.id, 0,
        'wa_dpp_passed_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_dpp_passed_no_birth_record: enqueue_notification failed for patient %: %', patient_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-dpp-passed-no-birth-record',
  '0 8 * * *',
  'SELECT public.schedule_dpp_passed_no_birth_record()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-dpp-passed-no-birth-record.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000006_schedule_dpp_passed_no_birth_record.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_dpp_passed_no_birth_record cron"
```

---

### Task 12: `schedule_prenatal_followup_gap()` — gap de retorno do pré-natal

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000007_schedule_prenatal_followup_gap.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-prenatal-followup-gap', '0 9 * * *', ...)`. Consumida por `handlePrenatalFollowupGap`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-prenatal-followup-gap.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_pregnancy_id uuid;
  v_appointment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-followup-gap@example.com', 'Profissional Verify Gap', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Gap', 'verify-followup-gap-patient@example.com', '(11) 90000-0006', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.pregnancies (patient_id, due_date, has_finished, created_by)
  VALUES (v_patient_id, CURRENT_DATE + 60, false, v_professional_id)
  RETURNING id INTO v_pregnancy_id;

  INSERT INTO public.appointments (patient_id, professional_id, date, time, status, type)
  VALUES (v_patient_id, v_professional_id, CURRENT_DATE - 50, '10:00:00', 'realizada', 'consulta')
  RETURNING id INTO v_appointment_id;

  PERFORM public.schedule_prenatal_followup_gap();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'patient'
    AND reference_id = v_patient_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.appointments WHERE id = v_appointment_id;
  DELETE FROM public.pregnancies WHERE id = v_pregnancy_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp prenatal_followup_gap entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-prenatal-followup-gap.sql
```

Esperado: erro `function ... does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000007_schedule_prenatal_followup_gap.sql
CREATE OR REPLACE FUNCTION public.schedule_prenatal_followup_gap()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  patient_record RECORD;
BEGIN
  FOR patient_record IN
    SELECT p.id
    FROM public.patients p
    JOIN LATERAL (
      SELECT preg.has_finished
      FROM public.pregnancies preg
      WHERE preg.patient_id = p.id AND preg.has_finished = false
      ORDER BY preg.created_at DESC
      LIMIT 1
    ) pg ON true
    WHERE (
      SELECT MAX(a.date) FROM public.appointments a
      WHERE a.patient_id = p.id AND a.status = 'realizada'
    ) <= CURRENT_DATE - 45
    AND NOT EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.patient_id = p.id AND a.status = 'agendada' AND a.date >= CURRENT_DATE
    )
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'prenatal_followup_gap', 'patient', patient_record.id,
        'patient', patient_record.id, 0,
        'wa_followup_gap_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_prenatal_followup_gap: enqueue_notification failed for patient %: %', patient_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-prenatal-followup-gap',
  '0 9 * * *',
  'SELECT public.schedule_prenatal_followup_gap()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-prenatal-followup-gap.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000007_schedule_prenatal_followup_gap.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_prenatal_followup_gap cron"
```

---

### Task 13: `schedule_contract_pending_signature()` — contrato pendente de assinatura

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000008_schedule_contract_pending_signature.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-contract-pending-signature', '0 9 * * *', ...)`. Consumida por `handleContractPendingSignature`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-contract-pending-signature.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_contract_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-contract-pending@example.com', 'Profissional Verify Contract', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Contract', 'verify-contract-pending-patient@example.com', '(11) 90000-0007', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.contracts (patient_id, user_id, title, clauses_html, is_signed, is_active, created_at)
  VALUES (v_patient_id, v_professional_id, 'Contrato Verify', '<p>teste</p>', false, true, now() - INTERVAL '4 days')
  RETURNING id INTO v_contract_id;

  PERFORM public.schedule_contract_pending_signature();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'contract'
    AND reference_id = v_contract_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.contracts WHERE id = v_contract_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp contract_pending_signature entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-contract-pending-signature.sql
```

Esperado: erro `function ... does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000008_schedule_contract_pending_signature.sql
CREATE OR REPLACE FUNCTION public.schedule_contract_pending_signature()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  contract_record RECORD;
BEGIN
  FOR contract_record IN
    SELECT id, patient_id
    FROM public.contracts
    WHERE is_signed = false
      AND is_active = true
      AND patient_id IS NOT NULL
      AND created_at <= now() - INTERVAL '3 days'
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'contract_pending_signature', 'contract', contract_record.id,
        'patient', contract_record.patient_id, 0,
        'wa_contract_pending_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_contract_pending_signature: enqueue_notification failed for contract %: %', contract_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-contract-pending-signature',
  '0 9 * * *',
  'SELECT public.schedule_contract_pending_signature()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-contract-pending-signature.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000008_schedule_contract_pending_signature.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_contract_pending_signature cron"
```

---

### Task 14: `schedule_daily_agenda_summary()` — resumo diário da agenda (profissional)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000009_schedule_daily_agenda_summary.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-daily-agenda-summary', '0 7 * * *', ...)`. Consumida por `handleDailyAgendaSummary`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-daily-agenda-summary.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-daily-agenda@example.com', 'Profissional Verify Agenda', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Agenda', 'verify-daily-agenda-patient@example.com', '(11) 90000-0008', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.appointments (patient_id, professional_id, date, time, status, type)
  VALUES (v_patient_id, v_professional_id, CURRENT_DATE, '10:00:00', 'agendada', 'consulta')
  RETURNING id INTO v_appointment_id;

  PERFORM public.schedule_daily_agenda_summary();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'user'
    AND reference_id = v_professional_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.appointments WHERE id = v_appointment_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp daily_agenda_summary entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-daily-agenda-summary.sql
```

Esperado: erro `function ... does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000009_schedule_daily_agenda_summary.sql
CREATE OR REPLACE FUNCTION public.schedule_daily_agenda_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  professional_record RECORD;
BEGIN
  FOR professional_record IN
    SELECT professional_id, count(*) AS appointment_count
    FROM public.appointments
    WHERE date = CURRENT_DATE AND status = 'agendada' AND professional_id IS NOT NULL
    GROUP BY professional_id
    HAVING count(*) > 0
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'daily_agenda_summary', 'user', professional_record.professional_id,
        'user', professional_record.professional_id, 0,
        'wa_daily_agenda_' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_daily_agenda_summary: enqueue_notification failed for professional %: %', professional_record.professional_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-daily-agenda-summary',
  '0 7 * * *',
  'SELECT public.schedule_daily_agenda_summary()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-daily-agenda-summary.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000009_schedule_daily_agenda_summary.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_daily_agenda_summary cron"
```

---

### Task 15: `on_payment_received` — pagamento recebido (profissional)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql`

**Interfaces:**
- Produz: função `notify_payment_received() RETURNS trigger` + `TRIGGER on_payment_received AFTER INSERT ON public.payments`. Exclui `payments.registered_by` da lista de destinatários (spec, seção 5). Consumida por `handlePaymentReceived`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-notify-payment-received.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_other_user_id uuid;
  v_patient_id uuid;
  v_billing_id uuid;
  v_installment_id uuid;
  v_payment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-payment-received-owner@example.com', 'Profissional Dono', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-payment-received-registrant@example.com', 'Profissional Registrante', 'professional')
  RETURNING id INTO v_other_user_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Payment', 'verify-payment-received-patient@example.com', '(11) 90000-0009', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.billings (patient_id, description, payment_method, total_amount)
  VALUES (v_patient_id, 'Verify billing payment', 'pix', 100)
  RETURNING id INTO v_billing_id;

  INSERT INTO public.installments (billing_id, due_date, amount, installment_number, status)
  VALUES (v_billing_id, CURRENT_DATE, 100, 1, 'pendente')
  RETURNING id INTO v_installment_id;

  INSERT INTO public.payments (installment_id, paid_amount, paid_at, payment_method, registered_by)
  VALUES (v_installment_id, 100, now(), 'pix', v_other_user_id)
  RETURNING id INTO v_payment_id;

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'payment'
    AND reference_id = v_payment_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.payments WHERE id = v_payment_id;
  DELETE FROM public.installments WHERE id = v_installment_id;
  DELETE FROM public.billings WHERE id = v_billing_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id IN (v_professional_id, v_other_user_id);

  ASSERT v_wa_count = 1, format('expected 1 whatsapp payment_received entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-notify-payment-received.sql
```

Esperado: `ASSERT` falha (`got 0`) — sem o trigger, nada é enfileirado.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_professional_id uuid;
BEGIN
  SELECT p.created_by INTO v_professional_id
  FROM public.installments i
  JOIN public.billings b ON b.id = i.billing_id
  JOIN public.patients p ON p.id = b.patient_id
  WHERE i.id = NEW.installment_id;

  -- Exclui quem acabou de registrar o pagamento da lista de destinatários (spec, seção 5) —
  -- evita autonotificação quando o próprio dono da paciente registra o pagamento.
  IF v_professional_id IS NOT NULL AND v_professional_id IS DISTINCT FROM NEW.registered_by THEN
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'payment_received', 'payment', NEW.id,
        'user', v_professional_id, 0, ''
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_payment_received: enqueue_notification failed for payment %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_payment_received
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_received();
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-notify-payment-received.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000010_notify_payment_received_trigger.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add on_payment_received trigger"
```

---

### Task 16: `schedule_monthly_billing_report()` — relatório mensal de faturamento (profissional)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000011_schedule_monthly_billing_report.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-monthly-billing-report', '0 8 1 * *', ...)`. Consumida por `handleMonthlyBillingReport`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-monthly-billing-report.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_billing_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-monthly-report@example.com', 'Profissional Verify Report', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Report', 'verify-monthly-report-patient@example.com', '(11) 90000-0010', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.billings (patient_id, description, payment_method, total_amount, paid_amount, created_at)
  VALUES (v_patient_id, 'Verify monthly billing', 'pix', 200, 200, date_trunc('month', CURRENT_DATE - INTERVAL '1 month') + INTERVAL '5 days')
  RETURNING id INTO v_billing_id;

  PERFORM public.schedule_monthly_billing_report();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'user'
    AND reference_id = v_professional_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.billings WHERE id = v_billing_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp monthly_billing_report entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-monthly-billing-report.sql
```

Esperado: erro `function ... does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000011_schedule_monthly_billing_report.sql
CREATE OR REPLACE FUNCTION public.schedule_monthly_billing_report()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  professional_record RECORD;
BEGIN
  FOR professional_record IN
    SELECT p.created_by AS professional_id
    FROM public.billings b
    JOIN public.patients p ON p.id = b.patient_id
    WHERE b.created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
      AND b.created_at < date_trunc('month', CURRENT_DATE)
      AND p.created_by IS NOT NULL
    GROUP BY p.created_by
    HAVING sum(b.paid_amount) > 0
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'monthly_billing_report', 'user', professional_record.professional_id,
        'user', professional_record.professional_id, 0,
        'wa_monthly_report_' || to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYY-MM')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_monthly_billing_report: enqueue_notification failed for professional %: %', professional_record.professional_id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-monthly-billing-report',
  '0 8 1 * *',
  'SELECT public.schedule_monthly_billing_report()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-monthly-billing-report.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000011_schedule_monthly_billing_report.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_monthly_billing_report cron"
```

---

### Task 17: `schedule_installment_overdue_professional()` — parcela de paciente atrasada (profissional)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000012_schedule_installment_overdue_professional.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-installment-overdue-professional', '0 10 * * *', ...)`. Consumida por `handleInstallmentOverdueProfessional`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-installment-overdue-professional.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_billing_id uuid;
  v_installment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-overdue-professional@example.com', 'Profissional Verify Overdue', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Overdue Professional', 'verify-overdue-professional-patient@example.com', '(11) 90000-0011', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.billings (patient_id, description, payment_method, total_amount)
  VALUES (v_patient_id, 'Verify overdue billing', 'pix', 100)
  RETURNING id INTO v_billing_id;

  INSERT INTO public.installments (billing_id, due_date, amount, installment_number, status)
  VALUES (v_billing_id, CURRENT_DATE - 10, 100, 1, 'atrasado')
  RETURNING id INTO v_installment_id;

  PERFORM public.schedule_installment_overdue_professional();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'installment'
    AND reference_id = v_installment_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.installments WHERE id = v_installment_id;
  DELETE FROM public.billings WHERE id = v_billing_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp installment_overdue_professional entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-installment-overdue-professional.sql
```

Esperado: erro `function ... does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000012_schedule_installment_overdue_professional.sql
CREATE OR REPLACE FUNCTION public.schedule_installment_overdue_professional()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  installment_record RECORD;
BEGIN
  FOR installment_record IN
    SELECT i.id, p.created_by AS professional_id
    FROM public.installments i
    JOIN public.billings b ON b.id = i.billing_id
    JOIN public.patients p ON p.id = b.patient_id
    WHERE i.status = 'atrasado' AND p.created_by IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'installment_overdue_professional', 'installment', installment_record.id,
        'user', installment_record.professional_id, 0,
        'wa_overdue_prof_' || to_char(CURRENT_DATE, 'YYYY-MM-DD')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_installment_overdue_professional: enqueue_notification failed for installment %: %', installment_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-installment-overdue-professional',
  '0 10 * * *',
  'SELECT public.schedule_installment_overdue_professional()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-installment-overdue-professional.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000012_schedule_installment_overdue_professional.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_installment_overdue_professional cron"
```

---

### Task 18: `on_appointment_last_minute_cancel` — cancelamento de última hora (profissional)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000013_notify_appointment_last_minute_cancel_trigger.sql`

**Interfaces:**
- Produz: função `notify_appointment_last_minute_cancel() RETURNS trigger` + `TRIGGER on_appointment_last_minute_cancel AFTER UPDATE ON public.appointments`. Consumida por `handleAppointmentLastMinuteCancel`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-notify-appointment-last-minute-cancel.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
  v_appointment_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-last-minute-cancel@example.com', 'Profissional Verify Cancel', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Cancel', 'verify-last-minute-cancel-patient@example.com', '(11) 90000-0012', '1990-01-01', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.appointments (patient_id, professional_id, date, time, status, type)
  VALUES (v_patient_id, v_professional_id, CURRENT_DATE, (now() + INTERVAL '3 hours')::time, 'agendada', 'consulta')
  RETURNING id INTO v_appointment_id;

  -- schedule_appointment_reminders (trigger existente) já dispara nesse UPDATE também — o
  -- teste checa especificamente o dedup_key vazio '' de on_appointment_last_minute_cancel,
  -- que nunca colide com os dedup_key ('wa_3_days' etc.) do trigger de lembrete.
  UPDATE public.appointments SET status = 'cancelada' WHERE id = v_appointment_id;

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'appointment'
    AND reference_id = v_appointment_id
    AND queue_name = 'whatsapp_notifications'
    AND notification_type = 'appointment_last_minute_cancel';

  DELETE FROM public.appointments WHERE id = v_appointment_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp appointment_last_minute_cancel entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-notify-appointment-last-minute-cancel.sql
```

Esperado: `ASSERT` falha (`got 0`).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000013_notify_appointment_last_minute_cancel_trigger.sql
CREATE OR REPLACE FUNCTION public.notify_appointment_last_minute_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  appointment_datetime timestamptz;
BEGIN
  IF NEW.status = 'cancelada' AND OLD.status = 'agendada' AND NEW.professional_id IS NOT NULL THEN
    appointment_datetime := (NEW.date::text || ' ' || NEW.time::text)::timestamptz;

    IF appointment_datetime > now() AND appointment_datetime - now() <= INTERVAL '24 hours' THEN
      BEGIN
        PERFORM public.enqueue_notification(
          'whatsapp_notifications', 'appointment_last_minute_cancel', 'appointment', NEW.id,
          'user', NEW.professional_id, 0, ''
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_appointment_last_minute_cancel: enqueue_notification failed for appointment %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_appointment_last_minute_cancel
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_appointment_last_minute_cancel();
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-notify-appointment-last-minute-cancel.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000013_notify_appointment_last_minute_cancel_trigger.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add on_appointment_last_minute_cancel trigger"
```

---

### Task 19: `schedule_team_invite_pending()` — convite de equipe pendente (profissional)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000014_schedule_team_invite_pending.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-team-invite-pending', '0 11 * * *', ...)`. Consumida por `handleTeamInvitePending`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-team-invite-pending.sql`:

```sql
DO $$
DECLARE
  v_inviter_id uuid;
  v_invited_id uuid;
  v_patient_id uuid;
  v_invite_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-invite-owner@example.com', 'Profissional Convidante', 'professional')
  RETURNING id INTO v_inviter_id;

  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-invite-invited@example.com', 'Profissional Convidado', 'professional')
  RETURNING id INTO v_invited_id;

  INSERT INTO public.patients (name, email, phone, date_of_birth, created_by)
  VALUES ('Paciente Verify Invite', 'verify-invite-patient@example.com', '(11) 90000-0013', '1990-01-01', v_inviter_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.team_invites (patient_id, invited_by, invited_professional_id, status, expires_at, created_at)
  VALUES (v_patient_id, v_inviter_id, v_invited_id, 'pending', now() + INTERVAL '5 days', now() - INTERVAL '3 days')
  RETURNING id INTO v_invite_id;

  PERFORM public.schedule_team_invite_pending();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'team_invite'
    AND reference_id = v_invite_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.team_invites WHERE id = v_invite_id;
  DELETE FROM public.patients WHERE id = v_patient_id;
  DELETE FROM public.users WHERE id IN (v_inviter_id, v_invited_id);

  ASSERT v_wa_count = 1, format('expected 1 whatsapp team_invite_pending entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-team-invite-pending.sql
```

Esperado: erro `function ... does not exist`.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000014_schedule_team_invite_pending.sql
CREATE OR REPLACE FUNCTION public.schedule_team_invite_pending()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  invite_record RECORD;
BEGIN
  FOR invite_record IN
    SELECT id, invited_professional_id
    FROM public.team_invites
    WHERE status = 'pending'
      AND invited_professional_id IS NOT NULL
      AND expires_at > now()
      AND created_at <= now() - INTERVAL '2 days'
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'team_invite_pending', 'team_invite', invite_record.id,
        'user', invite_record.invited_professional_id, 0,
        'wa_team_invite_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_team_invite_pending: enqueue_notification failed for invite %: %', invite_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-team-invite-pending',
  '0 11 * * *',
  'SELECT public.schedule_team_invite_pending()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-team-invite-pending.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000014_schedule_team_invite_pending.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_team_invite_pending cron"
```

---

### Task 20: `schedule_subscription_billing_issue()` — problema na cobrança da assinatura (profissional)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260807000015_schedule_subscription_billing_issue.sql`

**Interfaces:**
- Produz: função + `cron.schedule('schedule-subscription-billing-issue', '0 12 * * *', ...)`. Consumida por `handleSubscriptionBillingIssue`.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify-schedule-subscription-billing-issue.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_subscription_id uuid;
  v_wa_count integer;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'verify-subscription-issue@example.com', 'Profissional Verify Subscription', 'professional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.subscriptions (user_id, plan_id, subscription_id, frequence, status)
  VALUES (v_professional_id, 'verify-plan', 'verify-sub-' || gen_random_uuid()::text, 'monthly', 'failed')
  RETURNING id INTO v_subscription_id;

  PERFORM public.schedule_subscription_billing_issue();

  SELECT count(*) INTO v_wa_count
  FROM public.notification_queue_index
  WHERE reference_type = 'subscription'
    AND reference_id = v_subscription_id
    AND queue_name = 'whatsapp_notifications';

  DELETE FROM public.subscriptions WHERE id = v_subscription_id;
  DELETE FROM public.users WHERE id = v_professional_id;

  ASSERT v_wa_count = 1, format('expected 1 whatsapp subscription_billing_issue entry, got %s', v_wa_count);
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-subscription-billing-issue.sql
```

Esperado: erro `function ... does not exist` (se `subscription_frequence` local não tiver o valor `'monthly'`, ajuste para um valor válido do enum antes de rodar — confira com `\dT+ subscription_frequence` no `psql`).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260807000015_schedule_subscription_billing_issue.sql
CREATE OR REPLACE FUNCTION public.schedule_subscription_billing_issue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_record RECORD;
BEGIN
  FOR subscription_record IN
    SELECT id, user_id
    FROM public.subscriptions
    WHERE status = 'failed' AND user_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.enqueue_notification(
        'whatsapp_notifications', 'subscription_billing_issue', 'subscription', subscription_record.id,
        'user', subscription_record.user_id, 0,
        'wa_subscription_issue_' || to_char(CURRENT_DATE, 'IYYY-IW')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'schedule_subscription_billing_issue: enqueue_notification failed for subscription %: %', subscription_record.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'schedule-subscription-billing-issue',
  '0 12 * * *',
  'SELECT public.schedule_subscription_billing_issue()'
);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify-schedule-subscription-billing-issue.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260807000015_schedule_subscription_billing_issue.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add schedule_subscription_billing_issue cron"
```

---

## Verificação final de integração (após Task 20)

- [ ] Rodar `pnpm check-types` na raiz do monorepo e confirmar zero erros.
- [ ] Com o worker no ar (`pnpm --filter web dev`), rodar `curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process-notification-queues | jq` e confirmar `whatsapp.sent`/`whatsapp.skipped`/`whatsapp.failed` presentes e sem erro 500, mesmo com filas vazias.
- [ ] `psql` — conferir que os 11 novos `cron.schedule(...)` desta fase (Tasks 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 20 — as Tasks 15/18 são triggers de linha e não usam `pg_cron`) aparecem em `SELECT jobname, schedule FROM cron.job ORDER BY jobname;`.

## O que fica fora deste plano (fases futuras, spec já documenta)

- Webhook inbound para quick-reply e atualização de status de mensagem (Fase 4 da spec) — inclui a confirmação de presença que zeraria `appointments.confirmed_by_patient_at`, hoje só lido por `handleAppointmentUnconfirmed`, nunca escrito por este plano.
- Trocar os nomes placeholder de `lib/whatsapp/templates.ts` pelos nomes reais aprovados no Meta Business Manager, assim que a Fase 0 concluir.
- Circuit breaker por template (3 falhas de configuração seguidas pausam o tipo) — a spec descreve esse comportamento na seção "Tratamento de erros", mas não está coberto por nenhuma fase nomeada; requer estado persistente (contagem de falhas por `notification_type`) que nenhuma tabela atual guarda — decidir separadamente se entra na Fase 3, 4 ou como hardening pós-lançamento.
- Rate limiting de mensagens/segundo da Meta dentro do loop do worker (spec, seção "Worker") — hoje o loop despacha até 20 mensagens por invocação sem throttling explícito; como o worker roda a cada minuto e a Meta tem limites por segundo, isso pode ser necessário antes de desarmar o `DRY_RUN` em produção, mas não é tratado aqui.
- Corte do pipeline antigo (Fase 5) — `scheduled_notifications`, `installments_scheduled_notifications`, Edge Function `process-notifications`, cron de billing do `vercel.json` — só depois de operação estável com `NOTIFICATION_QUEUE_DRY_RUN=false`.
