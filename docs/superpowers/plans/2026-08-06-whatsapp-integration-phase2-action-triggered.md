# Fase 2 — Client Meta Cloud API + Mensagens Action-Triggered Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o client Meta Cloud API, o registro de templates WhatsApp, e `sendWhatsAppToUser()` (o "irmão" WhatsApp de `sendNotificationToUser`), e disparar as 9 mensagens action-triggered da spec nos pontos reais onde cada ação de negócio acontece hoje no código — não onde o spec original assumia que elas estariam.

**Architecture:** `lib/whatsapp/{phone,client,templates}.ts` fornecem a infraestrutura de baixo nível (normalização de telefone, chamada REST à Meta, registro de templates). `lib/notifications/whatsapp-send.ts` expõe `sendWhatsAppToUser()`, que resolve o destinatário (paciente ou profissional), checa opt-out, normaliza o telefone, monta o template e grava em `notification_log` — nunca lança erro para quem chamou (mesmo contrato do Fluxo 1 da spec: falha de envio nunca deve propagar). Essa função é chamada de forma fire-and-forget (sem `await` bloqueante) nos 9 pontos de disparo.

**Descoberta importante (motivo de desvio do spec):** o spec assumia que os 9 disparos entrariam nas server actions (`add-appointment-action.ts` etc). Investigação mostrou que **as actions do app web hoje não disparam nenhuma notificação** — o push existente vive em rotas REST legadas paralelas (`app/api/appointments/route.ts`, `app/api/appointments/[id]/route.ts`), usadas por um cliente diferente (provavelmente mobile). Das 9 mensagens do spec, só 2 têm uma rota REST equivalente para espelhar (`add-appointment` → POST `/api/appointments`, `update-appointment` → PUT `/api/appointments/[id]`). As outras 7 não têm nenhum call site de notificação hoje (nem push, nem WhatsApp) — para essas, o único lugar onde a ação de negócio realmente acontece é a própria server action, então o disparo entra lá diretamente. **Consequência aceita:** appointments criados/atualizados pelo app web via `add-appointment-action.ts`/`update-appointment-action.ts` (usados pelo Next.js) não vão dispersar WhatsApp nesta fase, só os criados via REST `/api/appointments` (mobile) — mesma assimetria que já existe hoje para push. Resolver essa duplicidade é uma limpeza de arquitetura fora do escopo deste plano.

**Tech Stack:** Next.js 15 Route Handlers e Server Actions (TypeScript), `fetch` nativo para a REST API da Meta, PostgreSQL (Supabase) para o schema de opt-out.

## Global Constraints

- Sem suíte de testes automatizados (unit/integration) — mesma decisão da Fase 1. Verificação via `npx tsx` para módulos puros e via `psql` + interação manual (dev server) para os pontos de disparo.
- Templates da Meta **ainda não foram aprovados** (Fase 0 do spec, processo externo em paralelo). Os nomes de template usados no código (`lib/whatsapp/templates.ts`) são placeholders de negócio (ex.: `appointment_scheduled`) que serão trocados pelos nomes reais aprovados quando a Fase 0 concluir — sem mudança de estrutura, só o valor da constante `name`.
- `sendWhatsAppToUser()` nunca lança erro para quem chama — captura toda falha (telefone ausente, opt-out, erro de rede/API da Meta) e grava em `notification_log`. Sem essa garantia, disparo fica no meio de uma mutação de negócio (criar consulta, assinar contrato) e poderia quebrar o fluxo principal.
- `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_SYSTEM_USER_TOKEN` não configurados (ambiente local e provavelmente staging) fazem `sendWhatsAppTemplateMessage` lançar um erro claro (`not_configured`), capturado e logado como `failed` — nunca trava a ação principal.
- Nome de migration segue o padrão do repo: `YYYYMMDDHHMMSS_descricao_em_snake_case.sql`, em `packages/supabase/supabase/migrations/`.
- Depois de qualquer migration, rodar `pnpm db:types` antes de escrever código TypeScript que dependa dos tipos novos.
- `pnpm check-types` precisa passar antes de cada commit.
- Ambiente local: conexão direta `postgresql://postgres:postgres@127.0.0.1:54322/postgres`; `pnpm --filter @ventre/supabase db:reset` aplica todas as migrations do zero.

---

## File Structure

**Migration nova** (`packages/supabase/supabase/migrations/`):
- `20260806100001_whatsapp_opt_out_columns.sql` — `patients.whatsapp_enabled`, `notification_settings.whatsapp_enabled`

**TypeScript novo** (`apps/web/src/lib/whatsapp/`):
- `phone.ts` — normalização de telefone BR → E.164
- `client.ts` — wrapper REST fino sobre a Meta Cloud API
- `templates.ts` — registro dos 9 templates action-triggered

**TypeScript novo** (`apps/web/src/lib/notifications/`):
- `whatsapp-send.ts` — `sendWhatsAppToUser()`

**TypeScript modificado:**
- `apps/web/app/api/appointments/route.ts` — dispara `appointment_scheduled`
- `apps/web/app/api/appointments/[id]/route.ts` — dispara `appointment_updated`/`appointment_cancelled`
- `apps/web/src/actions/add-patient-action.ts` — dispara `patient_welcome`
- `apps/web/src/actions/cancel-day-appointments-action.ts` — dispara `appointment_cancelled`
- `apps/web/src/actions/finish-patient-care-action.ts` — dispara `care_finished`
- `apps/web/src/actions/save-installment-link-action.ts` — dispara `installment_payment_link`
- `apps/web/src/actions/sign-patient-contract-action.ts` — dispara `contract_signed`
- `apps/web/src/actions/update-billing-action.ts` — dispara `billing_status_updated`
- `apps/web/src/actions/upsert-vaccine-record-action.ts` — dispara `vaccine_record_updated`

---

### Task 1: Colunas de opt-out (`patients.whatsapp_enabled`, `notification_settings.whatsapp_enabled`)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260806100001_whatsapp_opt_out_columns.sql`

**Interfaces:**
- Produz: colunas `public.patients.whatsapp_enabled boolean not null default true` e
  `public.notification_settings.whatsapp_enabled boolean not null default true`.
  Consumidas por `resolveRecipientPhone()` (Task 5).

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify_whatsapp_opt_out.sql`:

```sql
DO $$
BEGIN
  ASSERT (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'patients' AND column_name = 'whatsapp_enabled'
  ) = 1, 'patients.whatsapp_enabled column not found';
  ASSERT (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_settings' AND column_name = 'whatsapp_enabled'
  ) = 1, 'notification_settings.whatsapp_enabled column not found';
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_whatsapp_opt_out.sql
```

Esperado: erro de asserção (colunas ainda não existem).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260806100001_whatsapp_opt_out_columns.sql

ALTER TABLE public.patients
  ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.notification_settings
  ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT true;
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_whatsapp_opt_out.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Regenerar tipos e commit**

```bash
pnpm db:types
git add packages/supabase/supabase/migrations/20260806100001_whatsapp_opt_out_columns.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(whatsapp): add whatsapp_enabled opt-out columns"
```

---

### Task 2: Normalização de telefone (`lib/whatsapp/phone.ts`)

**Files:**
- Create: `apps/web/src/lib/whatsapp/phone.ts`

**Interfaces:**
- Produz: `export function normalizePhoneToE164(phone: string): string | null`.
  Consumida por `whatsapp-send.ts` (Task 5).

- [ ] **Step 1: Escrever o script de verificação (falha por falta do módulo)**

Salve como `/tmp/verify-phone.ts` na raiz de `apps/web`:

```ts
import { normalizePhoneToE164 } from "@/lib/whatsapp/phone";

console.assert(
  normalizePhoneToE164("(11) 99999-0000") === "5511999990000",
  "mobile with formatting should normalize to E.164",
);
console.assert(
  normalizePhoneToE164("11999990000") === "5511999990000",
  "mobile without formatting should normalize to E.164",
);
console.assert(
  normalizePhoneToE164("(11) 3333-0000") === "551133330000",
  "landline should normalize to E.164",
);
console.assert(
  normalizePhoneToE164("5511999990000") === "5511999990000",
  "already E.164 mobile should stay unchanged",
);
console.assert(
  normalizePhoneToE164("551133330000") === "551133330000",
  "already E.164 landline should stay unchanged",
);
console.assert(normalizePhoneToE164("123") === null, "too short should return null");
console.assert(normalizePhoneToE164("") === null, "empty string should return null");

console.log("PASS");
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-phone.ts
```

Esperado: erro de módulo não encontrado (`Cannot find module '@/lib/whatsapp/phone'`).

- [ ] **Step 3: Escrever `phone.ts`**

```ts
// apps/web/src/lib/whatsapp/phone.ts

// Implementação própria — o app é Brasil-only hoje, sem dependência externa.
export function normalizePhoneToE164(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");

  // Já vem com código do país (55 + DDD + número): 12 dígitos (fixo) ou 13 (celular).
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  // Formato local sem código do país: 10 dígitos (fixo) ou 11 (celular).
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return null;
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-phone.ts
```

Esperado: `PASS`, sem asserção falhando.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/whatsapp/phone.ts
git commit -m "feat(whatsapp): add BR phone to E.164 normalization"
```

---

### Task 3: Client Meta Cloud API (`lib/whatsapp/client.ts`)

**Files:**
- Create: `apps/web/src/lib/whatsapp/client.ts`

**Interfaces:**
- Consome: env vars `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_SYSTEM_USER_TOKEN`.
- Produz:
  ```ts
  export class WhatsAppApiError extends Error {
    code?: string;
  }

  export async function sendWhatsAppTemplateMessage(params: {
    to: string;
    templateName: string;
    languageCode?: string;
    parameters: string[];
  }): Promise<{ externalMessageId: string }>;
  ```
  Consumido por `whatsapp-send.ts` (Task 5).

- [ ] **Step 1: Escrever o script de verificação (falha por falta do módulo)**

Salve como `/tmp/verify-whatsapp-client.ts` na raiz de `apps/web`:

```ts
import { sendWhatsAppTemplateMessage, WhatsAppApiError } from "@/lib/whatsapp/client";

async function main() {
  // Sem credenciais no ambiente local — deve lançar WhatsAppApiError com code "not_configured",
  // nunca travar ou lançar um erro genérico não tipado.
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_SYSTEM_USER_TOKEN;

  try {
    await sendWhatsAppTemplateMessage({
      to: "5511999990000",
      templateName: "test_template",
      parameters: ["foo"],
    });
    console.assert(false, "should have thrown when credentials are missing");
  } catch (err) {
    console.assert(err instanceof WhatsAppApiError, "should throw WhatsAppApiError");
    console.assert(
      (err as WhatsAppApiError).code === "not_configured",
      `expected code "not_configured", got "${(err as WhatsAppApiError).code}"`,
    );
  }

  console.log("PASS");
}

main();
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-client.ts
```

Esperado: erro de módulo não encontrado.

- [ ] **Step 3: Escrever `client.ts`**

```ts
// apps/web/src/lib/whatsapp/client.ts

const META_GRAPH_API_VERSION = "v21.0";

export class WhatsAppApiError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "WhatsAppApiError";
    this.code = code;
  }
}

export async function sendWhatsAppTemplateMessage(params: {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters: string[];
}): Promise<{ externalMessageId: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN;

  if (!phoneNumberId || !token) {
    throw new WhatsAppApiError("WhatsApp credentials not configured", "not_configured");
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: params.to,
        type: "template",
        template: {
          name: params.templateName,
          language: { code: params.languageCode ?? "pt_BR" },
          components: [
            {
              type: "body",
              parameters: params.parameters.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    },
  );

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    const errorCode = json?.error?.code !== undefined ? String(json.error.code) : undefined;
    const errorMessage = json?.error?.message ?? `WhatsApp API request failed (${response.status})`;
    throw new WhatsAppApiError(errorMessage, errorCode);
  }

  const externalMessageId = json?.messages?.[0]?.id;
  if (!externalMessageId) {
    throw new WhatsAppApiError("WhatsApp API response missing message id");
  }

  return { externalMessageId };
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-client.ts
```

Esperado: `PASS`, sem asserção falhando.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/whatsapp/client.ts
git commit -m "feat(whatsapp): add Meta Cloud API client for template messages"
```

---

### Task 4: Registro de templates (`lib/whatsapp/templates.ts`)

**Files:**
- Create: `apps/web/src/lib/whatsapp/templates.ts`

**Interfaces:**
- Produz:
  ```ts
  export type WhatsAppNotificationType =
    | "appointment_scheduled"
    | "appointment_updated"
    | "appointment_cancelled"
    | "patient_welcome"
    | "care_finished"
    | "installment_payment_link"
    | "contract_signed"
    | "billing_status_updated"
    | "vaccine_record_updated";

  export function getWhatsAppTemplate(
    type: WhatsAppNotificationType,
    params: {
      patientName?: string;
      date?: string;
      time?: string;
      status?: string;
      paymentLink?: string;
    },
  ): { name: string; parameters: string[] };
  ```
  Consumida por `whatsapp-send.ts` (Task 5). Os 9 `WhatsAppNotificationType` mapeiam 1:1 com os 9
  eventos de negócio da spec (`add-appointment` → `appointment_scheduled`, `add-patient` →
  `patient_welcome`, `cancel-day-appointments` → `appointment_cancelled`, `finish-patient-care` →
  `care_finished`, `save-installment-link` → `installment_payment_link`, `sign-patient-contract` →
  `contract_signed`, `update-appointment` → `appointment_updated`, `update-billing` →
  `billing_status_updated`, `upsert-vaccine-record` → `vaccine_record_updated`).

- [ ] **Step 1: Escrever o script de verificação (falha por falta do módulo)**

Salve como `/tmp/verify-whatsapp-templates.ts` na raiz de `apps/web`:

```ts
import { getWhatsAppTemplate } from "@/lib/whatsapp/templates";

const scheduled = getWhatsAppTemplate("appointment_scheduled", {
  patientName: "Maria",
  date: "10/03/2026",
  time: "14:00",
});
console.assert(scheduled.name === "appointment_scheduled", "template name should match type");
console.assert(
  JSON.stringify(scheduled.parameters) === JSON.stringify(["Maria", "10/03/2026", "14:00"]),
  `unexpected parameters: ${JSON.stringify(scheduled.parameters)}`,
);

const cancelled = getWhatsAppTemplate("appointment_cancelled", {
  patientName: "Maria",
  date: "10/03/2026",
});
console.assert(
  JSON.stringify(cancelled.parameters) === JSON.stringify(["Maria", "10/03/2026"]),
  `unexpected parameters: ${JSON.stringify(cancelled.parameters)}`,
);

const welcome = getWhatsAppTemplate("patient_welcome", { patientName: "Maria" });
console.assert(
  JSON.stringify(welcome.parameters) === JSON.stringify(["Maria"]),
  `unexpected parameters: ${JSON.stringify(welcome.parameters)}`,
);

const link = getWhatsAppTemplate("installment_payment_link", {
  patientName: "Maria",
  paymentLink: "https://pay.example.com/abc",
});
console.assert(
  JSON.stringify(link.parameters) === JSON.stringify(["Maria", "https://pay.example.com/abc"]),
  `unexpected parameters: ${JSON.stringify(link.parameters)}`,
);

// Parâmetro ausente vira string vazia, nunca "undefined" — a API da Meta rejeita
// parâmetro de template com texto ausente/undefined.
const missingParam = getWhatsAppTemplate("patient_welcome", {});
console.assert(
  missingParam.parameters[0] === "",
  `expected empty string for missing param, got "${missingParam.parameters[0]}"`,
);

console.log("PASS");
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-templates.ts
```

Esperado: erro de módulo não encontrado.

- [ ] **Step 3: Escrever `templates.ts`**

```ts
// apps/web/src/lib/whatsapp/templates.ts

export type WhatsAppNotificationType =
  | "appointment_scheduled"
  | "appointment_updated"
  | "appointment_cancelled"
  | "patient_welcome"
  | "care_finished"
  | "installment_payment_link"
  | "contract_signed"
  | "billing_status_updated"
  | "vaccine_record_updated";

type WhatsAppTemplateParams = {
  patientName?: string;
  date?: string;
  time?: string;
  status?: string;
  paymentLink?: string;
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
  };

  return templates[type]();
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-templates.ts
```

Esperado: `PASS`, sem asserção falhando.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/whatsapp/templates.ts
git commit -m "feat(whatsapp): add template registry for action-triggered messages"
```

---

### Task 5: `sendWhatsAppToUser()` (`lib/notifications/whatsapp-send.ts`)

**Files:**
- Create: `apps/web/src/lib/notifications/whatsapp-send.ts`

**Interfaces:**
- Consome: `createServerSupabaseAdmin()` de `@ventre/supabase/server`; `normalizePhoneToE164` (Task 2);
  `sendWhatsAppTemplateMessage`, `WhatsAppApiError` (Task 3); `getWhatsAppTemplate`,
  `WhatsAppNotificationType` (Task 4); tabela `notification_log` (já existe, Fase 1) e as colunas
  `whatsapp_enabled` (Task 1).
- Produz:
  ```ts
  export type WhatsAppRecipient =
    | { recipientType: "patient"; recipientId: string }
    | { recipientType: "user"; recipientId: string };

  export async function sendWhatsAppToUser(
    recipient: WhatsAppRecipient,
    notificationType: WhatsAppNotificationType,
    templateParams: Parameters<typeof getWhatsAppTemplate>[1],
  ): Promise<void>;
  ```
  Consumida pelos 9 pontos de disparo (Tasks 6-14). **Nunca lança erro** — toda falha é capturada e
  gravada em `notification_log` com `status: 'failed'`.

- [ ] **Step 1: Escrever o script de verificação (falha por falta do módulo)**

Salve como `/tmp/verify-whatsapp-send.ts` na raiz de `apps/web`:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { randomUUID } from "node:crypto";

async function main() {
  const supabaseAdmin = await createServerSupabaseAdmin();

  // Cria uma paciente de teste com opt-out ativo (whatsapp_enabled = false)
  const { data: professional } = await supabaseAdmin
    .from("users")
    .insert({
      id: randomUUID(),
      email: `whatsapp-send-test-${Date.now()}@example.com`,
      name: "Profissional Teste WhatsApp",
      user_type: "profissional",
    })
    .select("id")
    .single();

  if (!professional) throw new Error("failed to create test professional");

  const { data: optedOutPatient } = await supabaseAdmin
    .from("patients")
    .insert({
      name: "Paciente Opt-Out",
      email: `patient-opt-out-${Date.now()}@example.com`,
      phone: "(11) 99999-0000",
      date_of_birth: "1990-01-01",
      due_date: "2026-12-01",
      created_by: professional.id,
      whatsapp_enabled: false,
    })
    .select("id")
    .single();

  if (!optedOutPatient) throw new Error("failed to create opted-out test patient");

  // Não deve lançar, mesmo sem credenciais da Meta configuradas.
  await sendWhatsAppToUser(
    { recipientType: "patient", recipientId: optedOutPatient.id },
    "patient_welcome",
    { patientName: "Paciente Opt-Out" },
  );

  const { data: logRow } = await supabaseAdmin
    .from("notification_log")
    .select("status, error_reason")
    .eq("channel", "whatsapp")
    .eq("recipient_id", optedOutPatient.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  console.assert(logRow?.status === "failed", `expected status "failed", got "${logRow?.status}"`);
  console.assert(
    logRow?.error_reason?.includes("opt-out"),
    `expected error_reason to mention opt-out, got "${logRow?.error_reason}"`,
  );

  // Cleanup
  await supabaseAdmin.from("patients").delete().eq("id", optedOutPatient.id);
  await supabaseAdmin.from("users").delete().eq("id", professional.id);

  console.log("PASS");
}

main();
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-whatsapp-send.ts
```

Esperado: erro de módulo não encontrado (`Cannot find module '@/lib/notifications/whatsapp-send'`).

- [ ] **Step 3: Escrever `whatsapp-send.ts`**

```ts
// apps/web/src/lib/notifications/whatsapp-send.ts
import { sendWhatsAppTemplateMessage, WhatsAppApiError } from "@/lib/whatsapp/client";
import { normalizePhoneToE164 } from "@/lib/whatsapp/phone";
import { getWhatsAppTemplate, type WhatsAppNotificationType } from "@/lib/whatsapp/templates";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export type WhatsAppRecipient =
  | { recipientType: "patient"; recipientId: string }
  | { recipientType: "user"; recipientId: string };

type WhatsAppTemplateParams = Parameters<typeof getWhatsAppTemplate>[1];
type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export async function sendWhatsAppToUser(
  recipient: WhatsAppRecipient,
  notificationType: WhatsAppNotificationType,
  templateParams: WhatsAppTemplateParams,
): Promise<void> {
  const supabaseAdmin = await createServerSupabaseAdmin();

  try {
    const { phone, whatsappEnabled } = await resolveRecipientPhone(supabaseAdmin, recipient);

    if (!whatsappEnabled) {
      await logWhatsAppAttempt(supabaseAdmin, recipient, notificationType, "failed", "skipped: opt-out");
      return;
    }

    if (!phone) {
      await logWhatsAppAttempt(
        supabaseAdmin,
        recipient,
        notificationType,
        "failed",
        "skipped: no phone on file",
      );
      return;
    }

    const normalizedPhone = normalizePhoneToE164(phone);
    if (!normalizedPhone) {
      await logWhatsAppAttempt(
        supabaseAdmin,
        recipient,
        notificationType,
        "failed",
        "skipped: invalid phone format",
      );
      return;
    }

    const template = getWhatsAppTemplate(notificationType, templateParams);

    const { externalMessageId } = await sendWhatsAppTemplateMessage({
      to: normalizedPhone,
      templateName: template.name,
      parameters: template.parameters,
    });

    await logWhatsAppAttempt(
      supabaseAdmin,
      recipient,
      notificationType,
      "sent",
      null,
      externalMessageId,
    );
  } catch (err) {
    const reason =
      err instanceof WhatsAppApiError
        ? `${err.code ?? "unknown"}: ${err.message}`
        : err instanceof Error
          ? err.message
          : "unknown error";

    console.error(
      `[whatsapp] failed to send ${notificationType} to ${recipient.recipientType} ${recipient.recipientId}: ${reason}`,
    );

    await logWhatsAppAttempt(supabaseAdmin, recipient, notificationType, "failed", reason);
  }
}

async function resolveRecipientPhone(
  supabaseAdmin: SupabaseAdmin,
  recipient: WhatsAppRecipient,
): Promise<{ phone: string | null; whatsappEnabled: boolean }> {
  if (recipient.recipientType === "patient") {
    const { data, error } = await supabaseAdmin
      .from("patients")
      .select("phone, whatsapp_enabled")
      .eq("id", recipient.recipientId)
      .maybeSingle();

    if (error) throw new Error(`Falha ao buscar telefone da paciente: ${error.message}`);

    return { phone: data?.phone ?? null, whatsappEnabled: data?.whatsapp_enabled ?? true };
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("phone, notification_settings(whatsapp_enabled)")
    .eq("id", recipient.recipientId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao buscar telefone do usuário: ${error.message}`);

  const settings = Array.isArray(data?.notification_settings)
    ? data.notification_settings[0]
    : data?.notification_settings;

  return { phone: data?.phone ?? null, whatsappEnabled: settings?.whatsapp_enabled ?? true };
}

async function logWhatsAppAttempt(
  supabaseAdmin: SupabaseAdmin,
  recipient: WhatsAppRecipient,
  notificationType: WhatsAppNotificationType,
  status: "sent" | "failed",
  errorReason: string | null,
  externalMessageId?: string,
): Promise<void> {
  const { error } = await supabaseAdmin.from("notification_log").insert({
    channel: "whatsapp",
    notification_type: notificationType,
    recipient_type: recipient.recipientType,
    recipient_id: recipient.recipientId,
    status,
    error_reason: errorReason,
    external_message_id: externalMessageId ?? null,
  });

  if (error) {
    console.error("[whatsapp] failed to write notification_log row:", error);
  }
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
pnpm --filter @ventre/supabase dev
cd apps/web && npx tsx /tmp/verify-whatsapp-send.ts
```

Esperado: `PASS`, sem asserção falhando.

- [ ] **Step 5: Type-check e commit**

```bash
pnpm check-types
git add apps/web/src/lib/notifications/whatsapp-send.ts
git commit -m "feat(whatsapp): add sendWhatsAppToUser with opt-out/phone resolution and logging"
```

---

### Task 6: Disparo — `appointment_scheduled` em `POST /api/appointments`

**Files:**
- Modify: `apps/web/app/api/appointments/route.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import e o bloco de notificação**

No topo do arquivo, adicione o import:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

Dentro de `POST`, no bloco que já dispara o push (`if (patient) { ... sendNotificationToTeam(...) }`),
adicione a chamada de WhatsApp logo depois, direcionada só à paciente (não ao time todo — o
WhatsApp é um canal 1:1 com a paciente, diferente do push que notifica toda a equipe):

```ts
      if (patient) {
        const template = getNotificationTemplate("appointment_created", {
          patientName: patient.name,
          date: validation.data.date,
          time: validation.data.time,
        });
        sendNotificationToTeam(validation.data.patient_id, user.id, {
          type: "appointment_created",
          ...template,
          data: { url: "/appointments" },
        });

        sendWhatsAppToUser(
          { recipientType: "patient", recipientId: validation.data.patient_id },
          "appointment_scheduled",
          { patientName: patient.name, date: validation.data.date, time: validation.data.time },
        ).catch((err) => {
          console.error("[whatsapp] appointment_scheduled send failed", err);
        });
      }
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter @ventre/supabase dev
pnpm --filter web dev
```

Crie uma consulta via `POST /api/appointments` (autenticado, com `patient_id` de uma paciente
existente com telefone válido cadastrado). Depois confirme:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'appointment_scheduled'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`
(credenciais da Meta não configuradas localmente) — confirma que o pipeline inteiro rodou sem
travar a criação da consulta.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/appointments/route.ts
git commit -m "feat(whatsapp): trigger appointment_scheduled on POST /api/appointments"
```

---

### Task 7: Disparo — `appointment_updated`/`appointment_cancelled` em `PUT /api/appointments/[id]`

**Files:**
- Modify: `apps/web/app/api/appointments/[id]/route.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import e o bloco de notificação**

No topo do arquivo:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

No bloco `if (appointment?.patient) { ... }` de `PUT`:

```ts
    if (appointment?.patient) {
      const isCancelled = validation.data.status === "cancelada";
      const notificationType = isCancelled ? "appointment_cancelled" : "appointment_updated";
      const patient = appointment.patient as { id: string; name: string };
      const template = getNotificationTemplate(notificationType, {
        patientName: patient.name,
        date: appointment.date,
        time: appointment.time,
      });
      sendNotificationToTeam(patient.id, user.id, {
        type: notificationType,
        ...template,
        data: { url: "/appointments" },
      });

      sendWhatsAppToUser(
        { recipientType: "patient", recipientId: patient.id },
        isCancelled ? "appointment_cancelled" : "appointment_updated",
        { patientName: patient.name, date: appointment.date, time: appointment.time },
      ).catch((err) => {
        console.error("[whatsapp] appointment update/cancel send failed", err);
      });
    }
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter web dev
```

Faça um `PUT /api/appointments/{id}` com `status: "cancelada"` numa consulta de teste, depois:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'appointment_cancelled'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/api/appointments/[id]/route.ts"
git commit -m "feat(whatsapp): trigger appointment_updated/appointment_cancelled on PUT /api/appointments/[id]"
```

---

### Task 8: Disparo — `patient_welcome` em `add-patient-action.ts`

**Files:**
- Modify: `apps/web/src/actions/add-patient-action.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import e adicionar a chamada após a criação da paciente**

No topo do arquivo:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

Logo depois de `const patient = await createPatient(...)` (antes do bloco `if (parsedInput.billing)`):

```ts
    const patient = await createPatient(supabaseAdmin, user.id, {
      ...parsedInput,
      enterprise_id: enterpriseId,
    });

    sendWhatsAppToUser({ recipientType: "patient", recipientId: patient.id }, "patient_welcome", {
      patientName: patient.name,
    }).catch((err) => {
      console.error("[whatsapp] patient_welcome send failed", err);
    });

    if (parsedInput.billing) {
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter web dev
```

Cadastre uma nova gestante pelo app web (formulário de "Nova gestante"), depois:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'patient_welcome'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/add-patient-action.ts
git commit -m "feat(whatsapp): trigger patient_welcome on addPatientAction"
```

---

### Task 9: Disparo — `appointment_cancelled` (em massa) em `cancel-day-appointments-action.ts`

**Files:**
- Modify: `apps/web/src/actions/cancel-day-appointments-action.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import, a query de fetch e o loop de cancelamento**

No topo do arquivo:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

Amplie a query que busca as consultas a cancelar para trazer também o paciente (nome + id):

```ts
    let fetchQuery = supabase
      .from("appointments")
      .select("id, google_event_id, patient_id, patient:patients(id, name)")
      .eq("status", "agendada")
      .eq("date", parsedInput.date);
```

No loop que hoje só cuida do Google Calendar, adicione o disparo de WhatsApp por paciente:

```ts
    // Fire-and-forget GCal deletes for appointments that had calendar events
    for (const appt of appointmentsToCancel ?? []) {
      if (appt.google_event_id) {
        syncDeleteToGoogleCalendar(appt.google_event_id, user.id).catch((err) => {
          console.error("[google-calendar] delete sync failed", err);
        });
      }

      const patient = appt.patient as { id: string; name: string } | null;
      if (patient) {
        sendWhatsAppToUser(
          { recipientType: "patient", recipientId: patient.id },
          "appointment_cancelled",
          { patientName: patient.name, date: parsedInput.date },
        ).catch((err) => {
          console.error("[whatsapp] cancel-day-appointments send failed", err);
        });
      }
    }
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter web dev
```

Use a ação de "cancelar consultas do dia" pela UI num dia com pelo menos uma consulta agendada com
paciente registrada, depois:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'appointment_cancelled'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/cancel-day-appointments-action.ts
git commit -m "feat(whatsapp): trigger appointment_cancelled on cancelDayAppointmentsAction"
```

---

### Task 10: Disparo — `care_finished` em `finish-patient-care-action.ts`

**Files:**
- Modify: `apps/web/src/actions/finish-patient-care-action.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import e buscar a paciente incondicionalmente**

No topo do arquivo:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

Hoje a paciente só é buscada dentro do `if (profile.enterprise_id)`, para a activity log. Mova essa
busca para fora do `if`, já que o WhatsApp precisa do nome independentemente de `enterprise_id`:

```ts
    revalidatePath("/patients");
    updateTag(`home-patients-${user.id}`);
    updateTag(`home-data-${user.id}`);

    const { data: patient } = await supabase
      .from("patients")
      .select("id, name")
      .eq("id", parsedInput.patientId)
      .single();

    if (patient) {
      sendWhatsAppToUser({ recipientType: "patient", recipientId: patient.id }, "care_finished", {
        patientName: patient.name,
      }).catch((err) => {
        console.error("[whatsapp] care_finished send failed", err);
      });
    }

    if (profile.enterprise_id) {
      updateTag(`enterprise-patients-${profile.enterprise_id}`);

      const deliveryLabel =
        parsedInput.deliveryMethod === "cesarean" ? "parto cesariana" : "parto vaginal";
      insertActivityLog({
        supabaseAdmin,
        actionName: "Acompanhamento encerrado",
        description: patient
          ? `Acompanhamento de ${patient.name} encerrado (${deliveryLabel})`
          : "Acompanhamento encerrado",
        actionType: "patient",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: parsedInput.patientId,
        metadata: { delivery_method: parsedInput.deliveryMethod ?? null },
      });
    }
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter web dev
```

Finalize o acompanhamento de uma gestante de teste pela UI, depois:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'care_finished'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/finish-patient-care-action.ts
git commit -m "feat(whatsapp): trigger care_finished on finishPatientCareAction"
```

---

### Task 11: Disparo — `installment_payment_link` em `save-installment-link-action.ts`

**Files:**
- Modify: `apps/web/src/actions/save-installment-link-action.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import e a busca de billing/paciente**

No topo do arquivo:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

Hoje o `billing` (com o nome da paciente) só é buscado dentro do `if (profile.enterprise_id)`. Mova
essa busca para fora e reaproveite tanto no envio de WhatsApp quanto na activity log — só dispare o
WhatsApp se um link válido foi salvo (`parsedInput.paymentLink` não vazio):

```ts
    const { error } = await supabaseAdmin
      .from("installments")
      .update({ payment_link: parsedInput.paymentLink || null })
      .eq("id", parsedInput.installmentId);

    if (error) throw new Error(error.message);

    const { data: billing } = await supabaseAdmin
      .from("billings")
      .select("patient_id, patient:patients(id, name)")
      .eq("id", parsedInput.billingId)
      .single();
    const patient = billing?.patient as { id: string; name: string } | null;

    if (patient && parsedInput.paymentLink) {
      sendWhatsAppToUser(
        { recipientType: "patient", recipientId: patient.id },
        "installment_payment_link",
        { patientName: patient.name, paymentLink: parsedInput.paymentLink },
      ).catch((err) => {
        console.error("[whatsapp] installment_payment_link send failed", err);
      });
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Link de pagamento salvo",
        description: patient
          ? `Link de pagamento salvo para cobrança de ${patient.name}`
          : "Link de pagamento salvo",
        actionType: "billing",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: billing?.patient_id ?? null,
        metadata: { billing_id: parsedInput.billingId, installment_id: parsedInput.installmentId },
      });
    }
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter web dev
```

Salve um link de pagamento numa parcela de teste pela UI, depois:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'installment_payment_link'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/save-installment-link-action.ts
git commit -m "feat(whatsapp): trigger installment_payment_link on saveInstallmentLinkAction"
```

---

### Task 12: Disparo — `contract_signed` em `sign-patient-contract-action.ts`

**Files:**
- Modify: `apps/web/src/actions/sign-patient-contract-action.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import e adicionar a chamada após a assinatura confirmada**

No topo do arquivo:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

Logo depois de `revalidatePath(...)`, antes do `captureServerEvent` (a variável `patient` já existe
nesse escopo, vinda de `buildPatientContractParties`):

```ts
      revalidatePath(`/patients/${patientId}/profile`);

      sendWhatsAppToUser({ recipientType: "patient", recipientId: patientId }, "contract_signed", {
        patientName: patient.name,
      }).catch((err) => {
        console.error("[whatsapp] contract_signed send failed", err);
      });

      await captureServerEvent(user.id, "sign_patient_contract", {
        patient_id: patientId,
        contract_id: contractId,
      });
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter web dev
```

Assine um contrato de teste pela UI, depois:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'contract_signed'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/sign-patient-contract-action.ts
git commit -m "feat(whatsapp): trigger contract_signed on signPatientContractAction"
```

---

### Task 13: Disparo — `billing_status_updated` em `update-billing-action.ts`

**Files:**
- Modify: `apps/web/src/actions/update-billing-action.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import e buscar a paciente incondicionalmente**

No topo do arquivo:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

Hoje `patient` só é buscada dentro do `if (profile.enterprise_id)`. Mova para fora do `if` e
reaproveite para o disparo de WhatsApp:

```ts
    if (error) throw new Error(error.message);

    const { data: patient } = await supabase
      .from("patients")
      .select("id, name")
      .eq("id", billing.patient_id)
      .single();

    if (patient) {
      sendWhatsAppToUser(
        { recipientType: "patient", recipientId: patient.id },
        "billing_status_updated",
        { patientName: patient.name, status: parsedInput.status },
      ).catch((err) => {
        console.error("[whatsapp] billing_status_updated send failed", err);
      });
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Cobrança atualizada",
        description: patient
          ? `Status da cobrança de ${patient.name} atualizado para ${parsedInput.status}`
          : `Status da cobrança atualizado para ${parsedInput.status}`,
        actionType: "billing",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: billing.patient_id,
        metadata: { billing_id: parsedInput.billingId, status: parsedInput.status },
      });
    }
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter web dev
```

Atualize o status de uma cobrança de teste pela UI, depois:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'billing_status_updated'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/update-billing-action.ts
git commit -m "feat(whatsapp): trigger billing_status_updated on updateBillingAction"
```

---

### Task 14: Disparo — `vaccine_record_updated` em `upsert-vaccine-record-action.ts`

**Files:**
- Modify: `apps/web/src/actions/upsert-vaccine-record-action.ts`

**Interfaces:**
- Consome: `sendWhatsAppToUser` (Task 5).

- [ ] **Step 1: Editar o import e buscar a paciente incondicionalmente**

No topo do arquivo:

```ts
import { sendWhatsAppToUser } from "@/lib/notifications/whatsapp-send";
```

Hoje a paciente (via `pregnancy.patient`) só é buscada dentro do `if (profile.enterprise_id)`. Mova
para fora do `if`:

```ts
    const { data: pregnancy } = await supabase
      .from("pregnancies")
      .select("patient:patients(id, name)")
      .eq("id", pregnancyId)
      .single();
    const patient = pregnancy?.patient as { id: string; name: string } | null;

    if (patient) {
      sendWhatsAppToUser(
        { recipientType: "patient", recipientId: patient.id },
        "vaccine_record_updated",
        { patientName: patient.name },
      ).catch((err) => {
        console.error("[whatsapp] vaccine_record_updated send failed", err);
      });
    }

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Registro de vacina atualizado",
        description: patient
          ? `Registro de vacina atualizado para ${patient.name}`
          : "Registro de vacina atualizado",
        actionType: "vaccine",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { pregnancy_id: pregnancyId },
      });
    }
```

- [ ] **Step 2: Type-check**

```bash
pnpm check-types
```

Esperado: sem erros novos.

- [ ] **Step 3: Verificação manual**

```bash
pnpm --filter web dev
```

Registre/atualize uma vacina de uma gestação de teste pela UI, depois:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT channel, notification_type, status, error_reason
  FROM public.notification_log
  WHERE channel = 'whatsapp' AND notification_type = 'vaccine_record_updated'
  ORDER BY created_at DESC LIMIT 1;
"
```

Esperado: uma linha com `status = 'failed'` e `error_reason` começando com `not_configured:`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/actions/upsert-vaccine-record-action.ts
git commit -m "feat(whatsapp): trigger vaccine_record_updated on upsertVaccineRecordAction"
```

---

## O que fica fora deste plano (fases futuras, spec já documenta)

- As 15 mensagens trigger/cron-based além de `appointment_reminder`/`dpp_approaching` — que já rodam
  em shadow mode desde a Fase 1 (Fase 3 da spec, precisa estender o worker de
  `process-notification-queues` para consumir de verdade `whatsapp_notifications`).
- Webhook inbound para quick-reply (Fase 4).
- Trocar os nomes placeholder de `lib/whatsapp/templates.ts` pelos nomes reais aprovados no Meta
  Business Manager, assim que a Fase 0 (setup externo) concluir.
- Resolver a duplicidade de call sites entre as rotas REST legadas (`app/api/appointments/*`) e as
  server actions do app web (`add-appointment-action.ts`, `update-appointment-action.ts`) — hoje só
  as rotas REST disparam notificação (push e, a partir deste plano, WhatsApp); unificar isso é uma
  limpeza de arquitetura que não foi pedida neste plano.
- Corte do pipeline antigo (Fase 5), só depois de operação estável.
