# Fase 4 — Webhook Inbound (WhatsApp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a rota `app/api/whatsapp/webhook/route.ts` que recebe callbacks da Meta Cloud API — handshake de verificação (`GET`), atualizações de status de mensagem (`sent`/`delivered`/`read`/`failed`) e cliques em botão de quick-reply (`POST`) — e liga o único fluxo de negócio concretamente especificado na spec (Fluxo 4): confirmar presença do paciente numa consulta.

**Architecture:** A rota valida `X-Hub-Signature-256` (HMAC-SHA256 com `WHATSAPP_APP_SECRET`, comparação em tempo constante) antes de tocar no corpo da requisição. Depois de validar a assinatura, a rota **sempre responde `200`** — mesmo diante de anomalias de negócio (mensagem não encontrada, tipo de botão desconhecido) — só logando o problema, para não disparar reenvio agressivo da Meta (padrão já descrito na spec). Duas peças novas de lógica: (1) `updateNotificationLogStatus()` — dado o `external_message_id` (wamid) e o novo status, localiza a linha mais recente em `notification_log` e atualiza `status`/`error_reason`; (2) `WHATSAPP_INBOUND_BUTTON_HANDLERS` — tabela de despacho por `button.payload` (o identificador de botão que o app definiu ao submeter o template no Business Manager), análoga a `WHATSAPP_QUEUE_HANDLERS` da Fase 3: cada handler recebe `reference_type`/`reference_id` (lidos de `notification_log` via o `context.id` da mensagem original) e aplica a mutação de negócio.

**Tech Stack:** Next.js 15 Route Handler (TypeScript), Zod (parsing do payload externo da Meta), `node:crypto` (HMAC nativo, sem dependência nova), PL/pgSQL (uma migration simples de schema).

**Nota de desvio do spec:** a introdução da spec cita "confirmar presença, aceitar convite, etc." como exemplos de quick-reply, mas apenas "confirmar presença" tem um fluxo de dados completo especificado (Fluxo 4, seção "Fluxo de dados"). "Aceitar convite" reaproveitaria `respondToInvite()` (`apps/web/src/services/invite.ts`), que hoje exige um `profile` autenticado e dispara `insertActivityLog`/`captureServerEvent` amarrados a esse contexto de sessão — não há uma variante dessa função pensada para ser chamada por um webhook anônimo do lado do servidor. Modelar esse bypass de auth é uma decisão de design própria (que perfil "age" quando quem aceita é a Meta, e não uma sessão logada) que a spec não resolve. Este plano implementa só "confirmar presença" — o único caso com contrato de dados definido — e deixa "aceitar convite" (e qualquer outro botão futuro) para adicionar depois, seguindo o mesmo padrão de `WHATSAPP_INBOUND_BUTTON_HANDLERS` (é só registrar mais uma entrada na tabela). Mesmo padrão de desvio documentado das Fases 2/3 (achado que muda o escopo do plano sem mudar a spec).

## Global Constraints

- Sem suíte de testes automatizada — mesma decisão das Fases 1/2/3. Verificação via `npx tsx` para módulos TS puros, `curl` contra o dev server para a rota HTTP.
- Templates da Meta ainda não aprovados (Fase 0 pendente) — o `payload` dos botões de quick-reply usado neste plano (`confirm_appointment_presence`) é um placeholder de negócio, igual aos `name` de `lib/whatsapp/templates.ts`; ajuste o valor quando o botão for configurado de verdade no Business Manager.
- `WHATSAPP_APP_SECRET` e `WHATSAPP_WEBHOOK_VERIFY_TOKEN` já existem em `apps/web/.env.local.example` e `apps/web/.env.local` (Fase 0/1) — nenhuma env var nova neste plano.
- Assinatura inválida → `401` e a rota não deve ler/processar o corpo (nem para logging). Assinatura válida mas dado de negócio não encontrado (ex.: `external_message_id` sem `notification_log` correspondente, `reference_id` de consulta inexistente) → loga a anomalia e responde `200` mesmo assim — nunca `4xx`/`5xx` nesse caso (reenvio agressivo da Meta é pior que perder uma atualização pontual).
- Verificação de assinatura precisa comparar bytes em tempo constante (`crypto.timingSafeEqual`) — nunca `===` em uma string derivada de segredo.
- `pnpm check-types` precisa passar antes de cada commit.
- Ambiente local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; `pnpm --filter @ventre/supabase db:reset` aplica todas as migrations do zero.
- Depois de qualquer migration, rodar `pnpm db:types` antes de escrever/ajustar código TypeScript dependente.
- Nome de migration: `YYYYMMDDHHMMSS_descricao_em_snake_case.sql`, em `packages/supabase/supabase/migrations/`; próximo timestamp livre é `20260808000001` (a migration mais recente é `20260807000016_lock_down_phase3_functions.sql`).

---

## File Structure

**TypeScript novo:**
- `apps/web/src/lib/whatsapp/webhook-signature.ts` — `verifyWhatsAppSignature()` (HMAC-SHA256 timing-safe)
- `apps/web/src/lib/whatsapp/webhook-schemas.ts` — schemas Zod do payload da Meta (`statuses[]`, `messages[]` do tipo `button`)
- `apps/web/src/lib/notifications/notification-log.ts` — `updateNotificationLogStatusByExternalId()`, `findNotificationLogByExternalId()`
- `apps/web/src/lib/notifications/whatsapp-inbound-handlers.ts` — `WHATSAPP_INBOUND_BUTTON_HANDLERS`
- `apps/web/app/api/whatsapp/webhook/route.ts` — `GET` (handshake) e `POST` (statuses + button replies)

**Migrations novas** (`packages/supabase/supabase/migrations/`):
- `20260808000001_appointment_confirmed_by_patient_and_log_index.sql` — `appointments.confirmed_by_patient_at` + índice em `notification_log.external_message_id`

---

### Task 1: Schema — `confirmed_by_patient_at` + índice de lookup

**Files:**
- Create: `packages/supabase/supabase/migrations/20260808000001_appointment_confirmed_by_patient_and_log_index.sql`

**Interfaces:**
- Consome: nada novo.
- Produz: coluna `public.appointments.confirmed_by_patient_at timestamptz` (nullable) e índice `idx_notification_log_external_message_id` em `public.notification_log(external_message_id)`. Consumida pelo handler de confirmação (Task 4) e por `findNotificationLogByExternalId`/`updateNotificationLogStatusByExternalId` (Task 3).

- [ ] **Step 1: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260808000001_appointment_confirmed_by_patient_and_log_index.sql

-- Fase 4 do design de WhatsApp (Fluxo 4): marca quando a paciente confirma presença via
-- botão de quick-reply no WhatsApp. Nullable — a maioria das consultas nunca recebe uma
-- confirmação explícita (paciente não usa WhatsApp, ou simplesmente não toca no botão).
ALTER TABLE public.appointments
  ADD COLUMN confirmed_by_patient_at timestamptz;

-- Lookup do webhook inbound: dado o wamid (context.id) da mensagem que o usuário respondeu,
-- ou o id de status que a Meta está reportando, encontra a linha de notification_log
-- correspondente para descobrir notification_type/reference_type/reference_id e para
-- atualizar o status (sent -> delivered -> read, ou failed).
CREATE INDEX idx_notification_log_external_message_id
  ON public.notification_log (external_message_id);
```

- [ ] **Step 2: Aplicar a migration e regenerar tipos**

```bash
pnpm --filter @ventre/supabase db:reset
pnpm db:types
```

Esperado: reset sem erro; `packages/supabase/src/types/database.types.ts` passa a incluir `confirmed_by_patient_at` em `appointments`.

- [ ] **Step 3: Type-check e commit**

```bash
pnpm check-types
git add packages/supabase/supabase/migrations/20260808000001_appointment_confirmed_by_patient_and_log_index.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add appointments.confirmed_by_patient_at and notification_log external id index"
```

---

### Task 2: Verificação de assinatura (`lib/whatsapp/webhook-signature.ts`)

**Files:**
- Create: `apps/web/src/lib/whatsapp/webhook-signature.ts`

**Interfaces:**
- Consome: nada novo (`node:crypto` nativo).
- Produz: `export function verifyWhatsAppSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean`. Consumida pela rota (Task 5).

- [ ] **Step 1: Escrever o script de verificação (falha por função inexistente)**

Salve como `/tmp/verify-whatsapp-webhook-signature.ts` na raiz de `apps/web`:

```ts
import { verifyWhatsAppSignature } from "@/lib/whatsapp/webhook-signature";
import { createHmac } from "node:crypto";

const appSecret = "test-app-secret";
const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });

const validSignature = `sha256=${createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;

console.assert(
  verifyWhatsAppSignature(rawBody, validSignature, appSecret) === true,
  "valid signature should verify",
);

console.assert(
  verifyWhatsAppSignature(rawBody, "sha256=deadbeef", appSecret) === false,
  "wrong signature should not verify",
);

console.assert(
  verifyWhatsAppSignature(rawBody, null, appSecret) === false,
  "missing signature header should not verify",
);

console.assert(
  verifyWhatsAppSignature(rawBody, "not-even-hex-prefixed", appSecret) === false,
  "malformed signature header should not verify",
);

// Corpo alterado depois de assinado deve invalidar a assinatura.
console.assert(
  verifyWhatsAppSignature(rawBody + "tampered", validSignature, appSecret) === false,
  "tampered body should not verify",
);

console.log("PASS");
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-webhook-signature.ts
```

Esperado: erro de módulo não encontrado (`Cannot find module '@/lib/whatsapp/webhook-signature'`).

- [ ] **Step 3: Escrever `webhook-signature.ts`**

```ts
// apps/web/src/lib/whatsapp/webhook-signature.ts
import { createHmac, timingSafeEqual } from "node:crypto";

const SIGNATURE_PREFIX = "sha256=";

// Valida o header X-Hub-Signature-256 que a Meta envia em todo POST de webhook: HMAC-SHA256
// do corpo bruto da requisição (antes de qualquer parse), assinado com o App Secret. Precisa
// ser comparado em tempo constante — uma comparação de string comum (===) vaza timing e
// permite um ataque de força bruta byte a byte contra o segredo.
export function verifyWhatsAppSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const receivedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  const expectedHex = createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const receivedBuffer = Buffer.from(receivedHex, "hex");
  const expectedBuffer = Buffer.from(expectedHex, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-webhook-signature.ts
```

Esperado: `PASS`.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/whatsapp/webhook-signature.ts
git commit -m "feat(whatsapp): add timing-safe X-Hub-Signature-256 verification"
```

---

### Task 3: Schemas do payload + acesso a `notification_log` por `external_message_id`

**Files:**
- Create: `apps/web/src/lib/whatsapp/webhook-schemas.ts`
- Create: `apps/web/src/lib/notifications/notification-log.ts`

**Interfaces:**
- Consome: `z` (Zod, já dependência do projeto).
- Produz:
  ```ts
  // webhook-schemas.ts
  export const whatsappWebhookPayloadSchema: z.ZodType<WhatsAppWebhookPayload>;
  export type WhatsAppStatusUpdate = { messageId: string; status: "sent" | "delivered" | "read" | "failed"; errorTitle?: string };
  export type WhatsAppButtonReply = { contextMessageId: string; buttonPayload: string };
  export function extractStatusUpdates(payload: WhatsAppWebhookPayload): WhatsAppStatusUpdate[];
  export function extractButtonReplies(payload: WhatsAppWebhookPayload): WhatsAppButtonReply[];

  // notification-log.ts
  export type NotificationLogEntry = { id: string; notificationType: string; referenceType: string | null; referenceId: string | null };
  export async function findNotificationLogByExternalId(supabaseAdmin, externalMessageId: string): Promise<NotificationLogEntry | null>;
  export async function updateNotificationLogStatusByExternalId(supabaseAdmin, externalMessageId: string, status: "delivered" | "read" | "failed", errorReason?: string | null): Promise<void>;
  ```
  Ambos consumidos pela rota (Task 5); `WHATSAPP_INBOUND_BUTTON_HANDLERS` (Task 4) consome `NotificationLogEntry`.

- [ ] **Step 1: Escrever o script de verificação (falha por módulos inexistentes)**

Salve como `/tmp/verify-whatsapp-webhook-schemas.ts` na raiz de `apps/web`:

```ts
import { extractButtonReplies, extractStatusUpdates, whatsappWebhookPayloadSchema } from "@/lib/whatsapp/webhook-schemas";

const statusPayload = whatsappWebhookPayloadSchema.parse({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-id",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            statuses: [
              { id: "wamid.STATUS1", status: "delivered", timestamp: "1234567890" },
              {
                id: "wamid.STATUS2",
                status: "failed",
                timestamp: "1234567891",
                errors: [{ code: 131026, title: "Message undeliverable" }],
              },
            ],
          },
        },
      ],
    },
  ],
});

const statuses = extractStatusUpdates(statusPayload);
console.assert(statuses.length === 2, `expected 2 status updates, got ${statuses.length}`);
console.assert(statuses[0].messageId === "wamid.STATUS1" && statuses[0].status === "delivered", "first status mismatch");
console.assert(
  statuses[1].messageId === "wamid.STATUS2" && statuses[1].status === "failed" && statuses[1].errorTitle === "Message undeliverable",
  "second status mismatch",
);

const buttonPayload = whatsappWebhookPayloadSchema.parse({
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-id",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            messages: [
              {
                id: "wamid.INBOUND1",
                from: "5511999999999",
                timestamp: "1234567892",
                type: "button",
                context: { id: "wamid.ORIGINAL1" },
                button: { text: "Confirmar presença", payload: "confirm_appointment_presence" },
              },
            ],
          },
        },
      ],
    },
  ],
});

const buttons = extractButtonReplies(buttonPayload);
console.assert(buttons.length === 1, `expected 1 button reply, got ${buttons.length}`);
console.assert(
  buttons[0].contextMessageId === "wamid.ORIGINAL1" && buttons[0].buttonPayload === "confirm_appointment_presence",
  "button reply mismatch",
);

// Payload sem statuses/messages não deve quebrar a extração (webhooks de outros campos, ex.
// account_update, também batem nesta rota).
const emptyPayload = whatsappWebhookPayloadSchema.parse({
  object: "whatsapp_business_account",
  entry: [{ id: "waba-id", changes: [{ field: "messages", value: { messaging_product: "whatsapp" } }] }],
});
console.assert(extractStatusUpdates(emptyPayload).length === 0, "empty payload should yield no statuses");
console.assert(extractButtonReplies(emptyPayload).length === 0, "empty payload should yield no button replies");

console.log("PASS");
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-webhook-schemas.ts
```

Esperado: erro de módulo não encontrado.

- [ ] **Step 3: Escrever `webhook-schemas.ts`**

```ts
// apps/web/src/lib/whatsapp/webhook-schemas.ts
import { z } from "zod";

const statusSchema = z.object({
  id: z.string(),
  status: z.enum(["sent", "delivered", "read", "failed"]),
  timestamp: z.string(),
  errors: z.array(z.object({ code: z.number(), title: z.string() })).optional(),
});

const buttonMessageSchema = z.object({
  id: z.string(),
  from: z.string(),
  timestamp: z.string(),
  type: z.literal("button"),
  context: z.object({ id: z.string() }).optional(),
  button: z.object({ text: z.string(), payload: z.string() }),
});

// A Meta manda outros tipos de mensagem (text, image, interactive, etc.) no mesmo array —
// este schema aceita qualquer objeto com "type" e ignora o que não for "button" na extração.
const inboundMessageSchema = z.union([
  buttonMessageSchema,
  z.object({ id: z.string(), from: z.string(), timestamp: z.string(), type: z.string() }).passthrough(),
]);

const changeValueSchema = z.object({
  messaging_product: z.literal("whatsapp"),
  statuses: z.array(statusSchema).optional(),
  messages: z.array(inboundMessageSchema).optional(),
});

const changeSchema = z.object({
  field: z.string(),
  value: changeValueSchema,
});

const entrySchema = z.object({
  id: z.string(),
  changes: z.array(changeSchema),
});

export const whatsappWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(entrySchema),
});

export type WhatsAppWebhookPayload = z.infer<typeof whatsappWebhookPayloadSchema>;

export type WhatsAppStatusUpdate = {
  messageId: string;
  status: "sent" | "delivered" | "read" | "failed";
  errorTitle?: string;
};

export type WhatsAppButtonReply = {
  contextMessageId: string;
  buttonPayload: string;
};

export function extractStatusUpdates(payload: WhatsAppWebhookPayload): WhatsAppStatusUpdate[] {
  const updates: WhatsAppStatusUpdate[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      for (const status of change.value.statuses ?? []) {
        updates.push({
          messageId: status.id,
          status: status.status,
          errorTitle: status.errors?.[0]?.title,
        });
      }
    }
  }
  return updates;
}

export function extractButtonReplies(payload: WhatsAppWebhookPayload): WhatsAppButtonReply[] {
  const replies: WhatsAppButtonReply[] = [];
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      for (const message of change.value.messages ?? []) {
        if (message.type !== "button" || !("button" in message) || !message.context) continue;
        replies.push({ contextMessageId: message.context.id, buttonPayload: message.button.payload });
      }
    }
  }
  return replies;
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-webhook-schemas.ts
```

Esperado: `PASS`.

- [ ] **Step 5: Escrever o script de verificação de `notification-log.ts` (falha por módulo inexistente)**

Salve como `/tmp/verify-notification-log.ts` na raiz de `apps/web`:

```ts
import { findNotificationLogByExternalId, updateNotificationLogStatusByExternalId } from "@/lib/notifications/notification-log";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { randomUUID } from "node:crypto";

async function main() {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const externalMessageId = `wamid.TEST-${Date.now()}`;
  const referenceId = randomUUID();
  const recipientId = randomUUID();

  const { data: inserted, error } = await supabaseAdmin
    .from("notification_log")
    .insert({
      channel: "whatsapp",
      notification_type: "appointment_reminder",
      reference_type: "appointment",
      reference_id: referenceId,
      recipient_type: "patient",
      recipient_id: recipientId,
      status: "sent",
      external_message_id: externalMessageId,
    })
    .select("id")
    .single();
  if (error || !inserted) throw new Error(`failed to seed notification_log: ${error?.message}`);

  const found = await findNotificationLogByExternalId(supabaseAdmin, externalMessageId);
  console.assert(found !== null, "expected to find seeded notification_log row");
  console.assert(found?.notificationType === "appointment_reminder", "notificationType mismatch");
  console.assert(found?.referenceType === "appointment", "referenceType mismatch");
  console.assert(found?.referenceId === referenceId, "referenceId mismatch");

  const notFound = await findNotificationLogByExternalId(supabaseAdmin, "wamid.DOES-NOT-EXIST");
  console.assert(notFound === null, "expected null for unknown external_message_id");

  await updateNotificationLogStatusByExternalId(supabaseAdmin, externalMessageId, "delivered");
  const { data: afterUpdate } = await supabaseAdmin
    .from("notification_log")
    .select("status, error_reason")
    .eq("id", inserted.id)
    .single();
  console.assert(afterUpdate?.status === "delivered", `expected status "delivered", got "${afterUpdate?.status}"`);

  await updateNotificationLogStatusByExternalId(supabaseAdmin, externalMessageId, "failed", "Message undeliverable");
  const { data: afterFailed } = await supabaseAdmin
    .from("notification_log")
    .select("status, error_reason")
    .eq("id", inserted.id)
    .single();
  console.assert(afterFailed?.status === "failed", `expected status "failed", got "${afterFailed?.status}"`);
  console.assert(
    afterFailed?.error_reason === "Message undeliverable",
    `expected error_reason "Message undeliverable", got "${afterFailed?.error_reason}"`,
  );

  // Atualizar um external_message_id desconhecido não deve lançar (anomalia best-effort).
  await updateNotificationLogStatusByExternalId(supabaseAdmin, "wamid.DOES-NOT-EXIST", "delivered");

  await supabaseAdmin.from("notification_log").delete().eq("id", inserted.id);

  console.log("PASS");
}

main();
```

- [ ] **Step 6: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-notification-log.ts
```

Esperado: erro de módulo não encontrado (`Cannot find module '@/lib/notifications/notification-log'`).

- [ ] **Step 7: Escrever `notification-log.ts`**

```ts
// apps/web/src/lib/notifications/notification-log.ts
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export type NotificationLogEntry = {
  id: string;
  notificationType: string;
  referenceType: string | null;
  referenceId: string | null;
};

// external_message_id não tem constraint de unicidade (ver migration da Task 1) — em teoria
// o mesmo wamid nunca se repete (é gerado pela Meta por envio), então pegar a linha mais
// recente é seguro e evita depender de uma constraint que não existe.
export async function findNotificationLogByExternalId(
  supabaseAdmin: SupabaseAdmin,
  externalMessageId: string,
): Promise<NotificationLogEntry | null> {
  const { data, error } = await supabaseAdmin
    .from("notification_log")
    .select("id, notification_type, reference_type, reference_id")
    .eq("external_message_id", externalMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Falha ao buscar notification_log por external_message_id: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: data.id,
    notificationType: data.notification_type,
    referenceType: data.reference_type,
    referenceId: data.reference_id,
  };
}

// Best-effort: se o external_message_id não bate com nenhuma linha (log nunca gravado, ou já
// expirado/limpo), não lança — só não atualiza nada. O webhook precisa responder 200 de
// qualquer forma (ver rota, Task 5), então uma falha aqui nunca deve virar exceção não tratada.
export async function updateNotificationLogStatusByExternalId(
  supabaseAdmin: SupabaseAdmin,
  externalMessageId: string,
  status: "delivered" | "read" | "failed",
  errorReason?: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notification_log")
    .update({ status, error_reason: errorReason ?? null })
    .eq("external_message_id", externalMessageId);

  if (error) {
    console.error("[notification-log] failed to update status by external_message_id:", error);
  }
}
```

- [ ] **Step 8: Rodar a verificação de novo**

```bash
pnpm --filter @ventre/supabase dev
cd apps/web && npx tsx /tmp/verify-notification-log.ts
```

Esperado: `PASS`.

- [ ] **Step 9: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/whatsapp/webhook-schemas.ts apps/web/src/lib/notifications/notification-log.ts
git commit -m "feat(whatsapp): parse inbound webhook payload and update notification_log by external id"
```

---

### Task 4: Handler de quick-reply — confirmar presença (`lib/notifications/whatsapp-inbound-handlers.ts`)

**Files:**
- Create: `apps/web/src/lib/notifications/whatsapp-inbound-handlers.ts`

**Interfaces:**
- Consome: `NotificationLogEntry` (Task 3).
- Produz:
  ```ts
  export type WhatsAppInboundButtonHandler = (
    supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
    logEntry: NotificationLogEntry,
  ) => Promise<{ handled: boolean; reason?: string }>;

  export const WHATSAPP_INBOUND_BUTTON_HANDLERS: Record<string, WhatsAppInboundButtonHandler>;
  ```
  Chaveado pelo `button.payload` do quick-reply (ex.: `"confirm_appointment_presence"`). Consumida pela rota (Task 5).

- [ ] **Step 1: Escrever o script de verificação (falha por módulo inexistente)**

Salve como `/tmp/verify-whatsapp-inbound-handlers.ts` na raiz de `apps/web`:

```ts
import { WHATSAPP_INBOUND_BUTTON_HANDLERS } from "@/lib/notifications/whatsapp-inbound-handlers";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { randomUUID } from "node:crypto";

async function main() {
  const supabaseAdmin = await createServerSupabaseAdmin();

  const handler = WHATSAPP_INBOUND_BUTTON_HANDLERS.confirm_appointment_presence;
  console.assert(typeof handler === "function", "expected a handler for confirm_appointment_presence");

  const { data: professional } = await supabaseAdmin
    .from("users")
    .insert({
      id: randomUUID(),
      email: `inbound-handlers-test-${Date.now()}@example.com`,
      name: "Profissional Teste Inbound",
      user_type: "profissional",
    })
    .select("id")
    .single();
  if (!professional) throw new Error("failed to create test professional");

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .insert({
      name: "Paciente Inbound",
      email: `patient-inbound-${Date.now()}@example.com`,
      phone: "(11) 96666-0000",
      date_of_birth: "1990-01-01",
      created_by: professional.id,
    })
    .select("id")
    .single();
  if (!patient) throw new Error("failed to create test patient");

  const { data: appointment } = await supabaseAdmin
    .from("appointments")
    .insert({
      patient_id: patient.id,
      professional_id: professional.id,
      date: "2026-12-01",
      time: "10:00:00",
      status: "agendada",
      type: "consulta",
    })
    .select("id, confirmed_by_patient_at")
    .single();
  if (!appointment) throw new Error("failed to create test appointment");
  console.assert(appointment.confirmed_by_patient_at === null, "appointment should start unconfirmed");

  const result = await handler!(supabaseAdmin, {
    id: randomUUID(),
    notificationType: "appointment_reminder",
    referenceType: "appointment",
    referenceId: appointment.id,
  });
  console.assert(result.handled === true, `expected handled=true, got ${JSON.stringify(result)}`);

  const { data: afterConfirm } = await supabaseAdmin
    .from("appointments")
    .select("confirmed_by_patient_at")
    .eq("id", appointment.id)
    .single();
  console.assert(afterConfirm?.confirmed_by_patient_at !== null, "expected confirmed_by_patient_at to be set");

  // reference_type errado (ex.: log de um tipo que não é sobre consulta) -> não trata, não quebra.
  const wrongTypeResult = await handler!(supabaseAdmin, {
    id: randomUUID(),
    notificationType: "team_invite_pending",
    referenceType: "team_invite",
    referenceId: randomUUID(),
  });
  console.assert(wrongTypeResult.handled === false, "expected handled=false for wrong reference_type");

  // reference_id que não existe -> não trata, não lança.
  const missingResult = await handler!(supabaseAdmin, {
    id: randomUUID(),
    notificationType: "appointment_reminder",
    referenceType: "appointment",
    referenceId: randomUUID(),
  });
  console.assert(missingResult.handled === false, "expected handled=false for missing appointment");

  await supabaseAdmin.from("appointments").delete().eq("id", appointment.id);
  await supabaseAdmin.from("patients").delete().eq("id", patient.id);
  await supabaseAdmin.from("users").delete().eq("id", professional.id);

  console.log("PASS");
}

main();
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-inbound-handlers.ts
```

Esperado: erro de módulo não encontrado.

- [ ] **Step 3: Escrever `whatsapp-inbound-handlers.ts`**

```ts
// apps/web/src/lib/notifications/whatsapp-inbound-handlers.ts
import type { NotificationLogEntry } from "@/lib/notifications/notification-log";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export type WhatsAppInboundButtonHandler = (
  supabaseAdmin: SupabaseAdmin,
  logEntry: NotificationLogEntry,
) => Promise<{ handled: boolean; reason?: string }>;

// Único fluxo de quick-reply com contrato de dados definido na spec (Fluxo 4). O payload do
// botão ("confirm_appointment_presence") é um placeholder de negócio — troque pelo valor real
// quando o template com botão for aprovado no Meta Business Manager (Fase 0).
async function handleConfirmAppointmentPresence(
  supabaseAdmin: SupabaseAdmin,
  logEntry: NotificationLogEntry,
): Promise<{ handled: boolean; reason?: string }> {
  if (logEntry.referenceType !== "appointment" || !logEntry.referenceId) {
    return { handled: false, reason: `unexpected reference_type "${logEntry.referenceType}"` };
  }

  const { data: appointment, error } = await supabaseAdmin
    .from("appointments")
    .select("id")
    .eq("id", logEntry.referenceId)
    .maybeSingle();
  if (error) {
    throw new Error(`Falha ao buscar consulta ${logEntry.referenceId}: ${error.message}`);
  }
  if (!appointment) {
    return { handled: false, reason: `appointment ${logEntry.referenceId} not found` };
  }

  const { error: updateError } = await supabaseAdmin
    .from("appointments")
    .update({ confirmed_by_patient_at: new Date().toISOString() })
    .eq("id", logEntry.referenceId);
  if (updateError) {
    throw new Error(`Falha ao confirmar consulta ${logEntry.referenceId}: ${updateError.message}`);
  }

  return { handled: true };
}

export const WHATSAPP_INBOUND_BUTTON_HANDLERS: Record<string, WhatsAppInboundButtonHandler> = {
  confirm_appointment_presence: handleConfirmAppointmentPresence,
};
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
pnpm --filter @ventre/supabase dev
cd apps/web && npx tsx /tmp/verify-whatsapp-inbound-handlers.ts
```

Esperado: `PASS`.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/notifications/whatsapp-inbound-handlers.ts
git commit -m "feat(whatsapp): add confirm_appointment_presence inbound button handler"
```

---

### Task 5: Rota do webhook (`app/api/whatsapp/webhook/route.ts`)

**Files:**
- Create: `apps/web/app/api/whatsapp/webhook/route.ts`

**Interfaces:**
- Consome: `verifyWhatsAppSignature` (Task 2), `whatsappWebhookPayloadSchema`/`extractStatusUpdates`/`extractButtonReplies` (Task 3), `findNotificationLogByExternalId`/`updateNotificationLogStatusByExternalId` (Task 3), `WHATSAPP_INBOUND_BUTTON_HANDLERS` (Task 4).
- Produz: `GET`/`POST` exportados (Next.js Route Handler), sem consumidores dentro do repo (é a borda do sistema).

- [ ] **Step 1: Escrever `route.ts`**

Sem suíte automatizada para Route Handlers neste projeto (mesma limitação das Fases 1-3, que testam a rota do worker via `curl`) — este passo já entrega o código final; a verificação manual é o Step 2.

```ts
// apps/web/app/api/whatsapp/webhook/route.ts
import { updateNotificationLogStatusByExternalId, findNotificationLogByExternalId } from "@/lib/notifications/notification-log";
import { WHATSAPP_INBOUND_BUTTON_HANDLERS } from "@/lib/notifications/whatsapp-inbound-handlers";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/webhook-signature";
import { extractButtonReplies, extractStatusUpdates, whatsappWebhookPayloadSchema } from "@/lib/whatsapp/webhook-schemas";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

// Handshake de verificação do webhook (configurado uma vez no painel da Meta, ver spec seção
// "Passos manuais no Meta Business Platform", item 5).
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const verifyToken = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && expectedToken && verifyToken === expectedToken && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Verificação inválida" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // Segredo ausente é erro de configuração do ambiente, não uma tentativa de ataque — mas o
  // resultado prático é o mesmo: nunca processar sem poder validar a origem.
  if (!appSecret || !verifyWhatsAppSignature(rawBody, signatureHeader, appSecret)) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  const json = JSON.parse(rawBody);
  const parseResult = whatsappWebhookPayloadSchema.safeParse(json);
  if (!parseResult.success) {
    // Assinatura já validada (é a Meta de verdade), mas o formato não bateu com o schema —
    // loga e responde 200 mesmo assim, igual a qualquer outra anomalia de negócio abaixo.
    console.error("[whatsapp-webhook] payload failed schema validation:", parseResult.error.message);
    return NextResponse.json({ received: true });
  }

  const supabaseAdmin = await createServerSupabaseAdmin();
  const payload = parseResult.data;

  for (const statusUpdate of extractStatusUpdates(payload)) {
    if (statusUpdate.status === "sent") continue; // já gravado como "sent" no envio (worker)
    await updateNotificationLogStatusByExternalId(
      supabaseAdmin,
      statusUpdate.messageId,
      statusUpdate.status,
      statusUpdate.errorTitle,
    );
  }

  for (const buttonReply of extractButtonReplies(payload)) {
    const logEntry = await findNotificationLogByExternalId(supabaseAdmin, buttonReply.contextMessageId);
    if (!logEntry) {
      console.error(
        `[whatsapp-webhook] button reply "${buttonReply.buttonPayload}" references unknown message ${buttonReply.contextMessageId}`,
      );
      continue;
    }

    const handler = WHATSAPP_INBOUND_BUTTON_HANDLERS[buttonReply.buttonPayload];
    if (!handler) {
      console.error(`[whatsapp-webhook] no handler registered for button payload "${buttonReply.buttonPayload}"`);
      continue;
    }

    try {
      const result = await handler(supabaseAdmin, logEntry);
      if (!result.handled) {
        console.error(`[whatsapp-webhook] button handler did not apply: ${result.reason}`);
      }
    } catch (err) {
      console.error("[whatsapp-webhook] button handler threw:", err);
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Verificação manual — handshake GET**

```bash
pnpm --filter @ventre/supabase dev
pnpm --filter web dev
```

Em outro terminal (usando o `WHATSAPP_WEBHOOK_VERIFY_TOKEN` de `apps/web/.env.local`, hoje `timani-wa@2026`):

```bash
curl -s "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=timani-wa@2026&hub.challenge=1234567890"
```

Esperado: corpo da resposta é exatamente `1234567890`, status `200`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=1234567890"
```

Esperado: `403`.

- [ ] **Step 3: Verificação manual — POST com assinatura válida (status update)**

```bash
cd apps/web
APP_SECRET=$(grep '^WHATSAPP_APP_SECRET=' .env.local | cut -d= -f2)
BODY='{"object":"whatsapp_business_account","entry":[{"id":"waba-1","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","statuses":[{"id":"wamid.MANUALTEST","status":"delivered","timestamp":"1234567890"}]}}]}]}'
SIGNATURE="sha256=$(node -e "const c=require('crypto');process.stdout.write(c.createHmac('sha256',process.argv[1]).update(process.argv[2]).digest('hex'))" "$APP_SECRET" "$BODY")"
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$BODY"
```

Esperado: `200` (mesmo sem nenhuma linha em `notification_log` com esse `external_message_id` — é uma anomalia best-effort, não erro).

- [ ] **Step 4: Verificação manual — POST com assinatura inválida**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=deadbeef" \
  -d "$BODY"
```

Esperado: `401`.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/app/api/whatsapp/webhook/route.ts
git commit -m "feat(whatsapp): add inbound webhook route (status updates + quick-reply buttons)"
```

---

### Task 6: Confirmar o fluxo ponta a ponta (status update + botão) com dados reais

**Files:** nenhum arquivo novo — só verificação.

- [ ] **Step 1: Rodar o servidor local**

```bash
pnpm --filter @ventre/supabase dev
pnpm --filter web dev
```

- [ ] **Step 2: Semear uma consulta + linha de `notification_log` com um `external_message_id` conhecido**

```bash
cd apps/web
cat > /tmp/seed-webhook-e2e.ts <<'EOF'
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { randomUUID } from "node:crypto";

async function main() {
  const supabaseAdmin = await createServerSupabaseAdmin();

  const { data: professional } = await supabaseAdmin
    .from("users")
    .insert({ id: randomUUID(), email: `webhook-e2e-${Date.now()}@example.com`, name: "Prof E2E", user_type: "profissional" })
    .select("id")
    .single();
  if (!professional) throw new Error("failed to create professional");

  const { data: patient } = await supabaseAdmin
    .from("patients")
    .insert({
      name: "Paciente E2E",
      email: `patient-e2e-${Date.now()}@example.com`,
      phone: "(11) 95555-0000",
      date_of_birth: "1990-01-01",
      created_by: professional.id,
    })
    .select("id")
    .single();
  if (!patient) throw new Error("failed to create patient");

  const { data: appointment } = await supabaseAdmin
    .from("appointments")
    .insert({ patient_id: patient.id, professional_id: professional.id, date: "2026-12-01", time: "10:00:00", status: "agendada", type: "consulta" })
    .select("id")
    .single();
  if (!appointment) throw new Error("failed to create appointment");

  const externalMessageId = "wamid.E2ETEST";
  await supabaseAdmin.from("notification_log").insert({
    channel: "whatsapp",
    notification_type: "appointment_reminder",
    reference_type: "appointment",
    reference_id: appointment.id,
    recipient_type: "patient",
    recipient_id: patient.id,
    status: "sent",
    external_message_id: externalMessageId,
  });

  console.log(JSON.stringify({ appointmentId: appointment.id, patientId: patient.id, professionalId: professional.id }));
}

main();
EOF
npx tsx /tmp/seed-webhook-e2e.ts
```

Anote o `appointmentId` impresso.

- [ ] **Step 3: Enviar o clique de botão via curl**

```bash
cd apps/web
APP_SECRET=$(grep '^WHATSAPP_APP_SECRET=' .env.local | cut -d= -f2)
BODY='{"object":"whatsapp_business_account","entry":[{"id":"waba-1","changes":[{"field":"messages","value":{"messaging_product":"whatsapp","messages":[{"id":"wamid.INBOUND-E2E","from":"5511999999999","timestamp":"1234567890","type":"button","context":{"id":"wamid.E2ETEST"},"button":{"text":"Confirmar presença","payload":"confirm_appointment_presence"}}]}}]}]}'
SIGNATURE="sha256=$(node -e "const c=require('crypto');process.stdout.write(c.createHmac('sha256',process.argv[1]).update(process.argv[2]).digest('hex'))" "$APP_SECRET" "$BODY")"
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIGNATURE" \
  -d "$BODY"
```

Esperado: `200`.

- [ ] **Step 4: Confirmar no banco que `confirmed_by_patient_at` foi setado**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT confirmed_by_patient_at FROM appointments WHERE id = '<appointmentId do Step 2>';"
```

Esperado: coluna com timestamp preenchido (não `NULL`).

- [ ] **Step 5: Limpar dados de teste**

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "DELETE FROM notification_log WHERE external_message_id = 'wamid.E2ETEST';
   DELETE FROM appointments WHERE id = '<appointmentId do Step 2>';
   DELETE FROM patients WHERE id = '<patientId do Step 2>';
   DELETE FROM users WHERE id = '<professionalId do Step 2>';"
rm -f /tmp/seed-webhook-e2e.ts
```

Este task não gera commit (é só verificação do que as Tasks 1-5 já entregaram).
