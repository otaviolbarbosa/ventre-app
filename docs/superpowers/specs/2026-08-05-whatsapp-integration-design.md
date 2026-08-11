# Integração WhatsApp (Meta Cloud API) — Design

**Data:** 2026-08-05
**Status:** Aprovado para planejamento de implementação

## Contexto

O app já dispara notificações por push (Firebase) e e-mail (Resend) a partir de dois caminhos
distintos: chamadas diretas em server actions e um pipeline de agendamento (`scheduled_notifications`
+ `pg_cron` + Edge Function `process-notifications`, e um cron separado do Vercel para lembretes
de cobrança em `installments_scheduled_notifications`).

Este design cobre a adição de um terceiro canal — **WhatsApp**, via **Meta Cloud API direta** — para
24 tipos de mensagem já mapeados (9 disparadas por action, 15 disparadas por trigger de banco/cron —
8 de paciente + 7 de profissional), e aproveita a oportunidade para **unificar push e WhatsApp numa
única infraestrutura de fila**,
usando **Supabase Queues (pgmq)**, substituindo o pipeline de polling atual.

### Decisões já tomadas
- Provedor: **Meta Cloud API direta** (sem BSP intermediário — menor custo, setup único no Business
  Manager, e o time já tem experiência com integração REST/OAuth de baixo nível, comprovada pela
  implementação atual do FCM v1).
- Escopo: **MVP completo**, incluindo o webhook inbound para processar botões de quick-reply
  (confirmar presença, aceitar convite, etc.), não só envio outbound.
- Opt-in: **implícito no cadastro** (texto informativo, sem checkbox extra), com opção de desativar
  depois — reaproveitando o padrão de `notification_settings` já existente para push.
- Escopo do pgmq: **unificar push e WhatsApp** na mesma infraestrutura de fila, migrando o pipeline
  de push existente para pgmq também (não é uma fila exclusiva de WhatsApp).
- Worker: **pg_cron continua como agendador** (nativo do Postgres, já provado em produção, sem risco
  de limite de frequência de plano do Vercel), mas passa a chamar, via `pg_net`, uma **rota Next.js**
  em vez de uma Edge Function Deno — consolidando toda a lógica de envio em TypeScript e eliminando a
  duplicação Deno/TS que existe hoje entre `process-notifications` e `lib/notifications/send.ts`.

## Arquitetura geral

Três caminhos de disparo, um único módulo de envio (`lib/notifications/`), transporte diferente
conforme a origem:

```
┌─────────────────────┐
│  Server Action        │ ── chamada direta, síncrona ──┐
│  (add-appointment,    │                                │
│   add-patient, ...)   │                                ▼
└─────────────────────┘                    ┌────────────────────────┐
                                            │  lib/notifications/      │
┌─────────────────────┐                    │  - sendPush()             │
│  Trigger de banco     │── pgmq.send() ───▶│  - sendWhatsApp()         │──▶ FCM / Meta Cloud API
│  (schedule_dpp_...,   │   (direto, já      │  - template registry      │
│   novo appointment)   │    dentro do PG)   └────────────────────────┘
└─────────────────────┘                                ▲
                                                         │ lê da fila
┌─────────────────────┐   pg_net.http_post              │
│  pg_cron (1x/min)     │──────────────────▶ /api/cron/process-notification-queues
└─────────────────────┘   Bearer CRON_SECRET   (Next.js Route Handler)
                                                         │
                                                         ▼
                                              pgmq.read('push_notifications')
                                              pgmq.read('whatsapp_notifications')
                                              (via funções RPC wrapper)

┌─────────────────────┐
│  Meta (webhook)       │──▶ /api/whatsapp/webhook (Next.js) ──▶ processa botão
│  quick-reply, status  │     verifica assinatura X-Hub-Signature-256
└─────────────────────┘
```

### Os três caminhos

1. **Action-triggered (síncrono, sem fila)** — a própria server action chama `sendWhatsApp()`
   diretamente, in-process, igual ao `sendNotificationToUser()` que já existe hoje para push. Cobre
   as 9 mensagens: `add-appointment-action`, `add-patient-action`, `cancel-day-appointments-action`,
   `finish-patient-care-action`, `save-installment-link-action`, `sign-patient-contract-action`,
   `update-appointment-action`, `update-billing-action`, `upsert-vaccine-record-action`. Falha no
   envio nunca deve propagar erro pra ação principal — só loga e segue.

2. **Trigger/cron-triggered (assíncrono, via pgmq)** — funções Postgres chamam `pgmq.send()`
   diretamente (já rodam dentro do Postgres). `pg_cron` a cada 1 minuto dispara `pg_net.http_post`
   para a rota Next.js, que drena as filas e envia. Cobre as 15 mensagens de trigger/cron — **8 de
   paciente**: lembrete de consulta (D-3/D-1/hoje), consulta sem confirmação na véspera, parcela
   vencendo/vencida, pagamento em análise parado, DPP se aproximando, DPP passada sem registro de
   nascimento, gap de retorno do pré-natal, contrato pendente de assinatura; **7 de profissional**:
   resumo diário da agenda, pagamento recebido, relatório mensal de faturamento, parcela de paciente
   atrasada, cancelamento de última hora, convite de equipe pendente, problema na cobrança da
   assinatura da plataforma.

3. **Webhook inbound** — rota Next.js recebendo callbacks da Meta quando alguém toca num botão de
   quick-reply ou quando o status de uma mensagem muda (entregue/lida/falhou). Processa e aciona a
   ação correspondente no backend (ex.: gravar `confirmed_by_patient_at`).

## Componentes

### 1. Client Meta Cloud API (`apps/web/src/lib/whatsapp/`)
- **`client.ts`** — wrapper fino sobre a REST API da Meta (`POST /{phone-number-id}/messages`),
  autenticado com token de sistema (system user, long-lived, sem rotação de JWT).
- **`templates.ts`** — registro dos 24 templates aprovados, análogo a `lib/notifications/templates.ts`.
  A API da Meta usa placeholders posicionais (`{{1}}`, `{{2}}`...), não nomeados — este arquivo mapeia
  `{ paciente_nome, data, hora }` → array posicional na ordem exata registrada no Business Manager.
- **`phone.ts`** — normalização `(XX) XXXXX-XXXX` (formato salvo hoje em `patients.phone`/`users.phone`)
  → E.164 `55XXXXXXXXXXX`. Implementação própria (strip de não-dígitos + prefixo `55`), sem dependência
  externa — o app é Brasil-only hoje.

### 2. Envio (`lib/notifications/send.ts` ganha um irmão)
- **`sendWhatsAppToUser()`** — mesma assinatura/espírito do `sendNotificationToUser()` existente:
  resolve destinatário, checa opt-out, monta template, chama o client, grava log. Chamada tanto pelas
  actions (caminho 1) quanto pelo worker (caminho 2).

### 3. Fila (pgmq)
- Duas filas: `push_notifications` e `whatsapp_notifications` (isolamento de falha por canal).
- Funções wrapper em `public`, expostas via RPC (pgmq não é exposto via PostgREST diretamente):
  - `enqueue_notification(queue text, payload jsonb, delay_seconds int default 0) returns bigint`
  - `dequeue_notifications(queue text, qty int, vt int) returns setof record`
  - `ack_notification(queue text, msg_id bigint)`
  - `requeue_with_backoff(queue text, msg_id bigint, read_ct int)`
  - `dead_letter_notification(queue text, msg_id bigint, reason text)`
  - `cancel_notifications_for_reference(reference_type text, reference_id uuid)`
- Substitui `scheduled_for timestamptz + polling` pelo **delay nativo do pgmq**
  (`pgmq.send(queue, msg, delay)`).
- Payload: `{ notification_type, reference_type, reference_id, recipient_type, recipient_id }` — o
  worker busca os dados atualizados na hora de enviar, nunca confia em dado desatualizado no payload.

### 4. Worker (`app/api/cron/process-notification-queues/route.ts`)
- `Bearer CRON_SECRET`, acionado por `pg_cron` a cada 1 min via `pg_net`.
- Drena as duas filas na mesma invocação, cada uma em seu próprio `try/catch`.
- Classifica erro (ver seção de erros) e decide entre retry com backoff ou dead-letter.
- Respeita rate limit de mensagens/segundo da Meta (throttling no loop, não só no backoff de erro).

### 5. Enfileiramento — quem chama `pgmq.send()`
- Funções Postgres existentes (`schedule_appointment_reminders`, `schedule_dpp_reminders`) passam a
  chamar `pgmq.send()` (via wrapper) em vez de `INSERT INTO scheduled_notifications`.
- Novas funções cron (scan periódico): `schedule_daily_agenda_summary`,
  `schedule_monthly_billing_report`, `schedule_installment_overdue_professional`,
  `schedule_prenatal_followup_gap`, `schedule_contract_pending_signature`,
  `schedule_team_invite_pending`, `schedule_dpp_passed_no_birth_record`,
  `schedule_installment_under_review_stalled`, `schedule_appointment_unconfirmed`.
- Novos triggers de linha (event-driven, não scan periódico): `on_appointment_last_minute_cancel`
  (UPDATE em `appointments`) e `on_payment_received` (INSERT em `payments` — na hora de enfileirar,
  exclui o próprio `registered_by` da lista de destinatários pra não autonotificar quem acabou de
  registrar o pagamento).
- Caso especial: `scheduleBillingNotifications` (hoje chamada de dentro de `add-billing-action.ts`)
  continua disparada pela action, mas passa a enfileirar no pgmq com delay em vez de inserir linhas em
  `installments_scheduled_notifications` — gatilho é a action, entrega é assíncrona/futura.

### 6. Webhook inbound (`app/api/whatsapp/webhook/route.ts`)
- `GET` — handshake de verificação da Meta (`hub.challenge`).
- `POST` — valida `X-Hub-Signature-256` (HMAC com o App Secret nativo do Node `crypto`), processa
  quick-replies e atualizações de status. Processamento inline (updates simples de uma linha) — sem
  fila própria no MVP. Sempre responde `200` rápido após validar a assinatura, mesmo em caso de
  anomalia de negócio (evita reenvio agressivo da Meta), tratando erros de forma assíncrona/best-effort.

### 7. Consentimento — onde mora o opt-out
`patients.user_id` é **nullable** — muitas pacientes têm só o cadastro (`patients.phone`), sem conta
de usuário/login. O opt-out não pode viver só em `notification_settings` (que referencia `users.id`):
- `patients.whatsapp_enabled boolean not null default true` — cobre pacientes com ou sem conta.
- `notification_settings.whatsapp_enabled boolean not null default true` — cobre profissionais.
- Texto informativo no formulário de cadastro da paciente e no perfil da profissional.

### 8. Auditoria
- `notification_log` — grava cada envio (canal, tipo, destinatário, id da mensagem externa, status,
  motivo de erro), populada pelo worker no envio e atualizada pelo webhook de status. Também usada para
  idempotência (evita reenvio duplicado, já que pgmq garante *at-least-once*, não *exactly-once*).

## Fluxo de dados

### Fluxo 1 — Action-triggered (síncrono) — `add-appointment-action.ts`
```
1. Profissional cria consulta → add-appointment-action.ts insere em appointments
2. Action, após o insert bem-sucedido, chama:
     await sendWhatsAppToUser({ recipientType: 'patient', recipientId: patient.id },
       'appointment_scheduled', { data, hora, profissional_nome })
3. sendWhatsAppToUser():
     - busca patients.phone + patients.whatsapp_enabled
     - se whatsapp_enabled = false → no-op (log "skipped: opt-out")
     - normaliza telefone pra E.164
     - monta payload posicional do template appointment_scheduled
     - POST na Meta Cloud API
     - grava linha em notification_log (status inicial: sent | failed)
4. Falha na chamada à Meta não propaga erro pro usuário — loga e segue
```
Mesmo padrão para as demais 8 mensagens action-triggered.

### Fluxo 2 — Trigger de banco + delay no pgmq — lembrete de consulta (D-3/D-1/hoje)
```
1. INSERT/UPDATE em appointments (status = 'agendada') dispara schedule_appointment_reminders()
2. A trigger calcula os horários alvo e chama, pra cada um:
     enqueue_notification('whatsapp_notifications', {...}, delay_seconds := epoch(horario_alvo - now()))
   (e o equivalente pra push_notifications, conforme preferência do destinatário)
3. Mensagem fica invisível na fila até o delay expirar
4. pg_cron (1x/min) → pg_net.http_post → /api/cron/process-notification-queues
5. Worker chama dequeue_notifications('whatsapp_notifications', qty=20, vt=60)
6. Pra cada mensagem: busca appointments fresco pelo reference_id
     - se status != 'agendada' (cancelada nesse meio tempo) → ack e descarta, não envia
     - senão → sendWhatsAppToUser(...) e ack em caso de sucesso
7. Se a consulta for reagendada/cancelada, cancel_notifications_for_reference() remove as mensagens
   pendentes antigas antes de reinserir novas (usa notification_queue_index pra localizar o msg_id)
```

### Fluxo 3 — Cron periódico (scan, sem trigger de linha) — resumo diário da agenda
```
1. pg_cron roda schedule_daily_agenda_summary() 1x/dia às 7h
2. Varre appointments WHERE date = CURRENT_DATE AND status = 'agendada', agrupa por professional_id,
   e pra cada profissional com quantidade > 0 chama enqueue_notification(..., delay_seconds := 0)
3. Delay 0 → mensagem já nasce visível, worker pega na próxima passada (até 1 min de espera)
4. Worker resolve profissional + conta consultas + monta template daily_agenda_summary
```
Mesmo padrão para: `monthly_billing_report`, `installment_overdue_professional`,
`prenatal_followup_gap`, `contract_pending_signature`, `team_invite_pending`,
`dpp_passed_no_birth_record`, `installment_under_review_stalled`.

### Fluxo 4 — Webhook inbound — "✅ Confirmar presença"
```
1. Paciente toca no botão no WhatsApp
2. Meta faz POST em /api/whatsapp/webhook com o payload do botão
3. Rota valida X-Hub-Signature-256 (rejeita se inválido → 401)
4. Identifica o tipo de callback (button reply) + reference_id da mensagem original
   (guardado em notification_log no momento do envio)
5. UPDATE appointments SET confirmed_by_patient_at = now() WHERE id = reference_id
6. Responde 200 rápido pra Meta
7. (Fase 2, fora deste MVP) Notifica a profissional que a consulta foi confirmada
```

## Schema e migração

### Filas
```sql
SELECT pgmq.create('push_notifications');
SELECT pgmq.create('whatsapp_notifications');
```

### Tabela de índice (permite cancelar mensagens pendentes por `reference_id`, já que pgmq não indexa por payload)
```sql
CREATE TABLE public.notification_queue_index (
  notification_type text NOT NULL,
  reference_type     text NOT NULL,
  reference_id       uuid NOT NULL,
  queue_name         text NOT NULL,
  msg_id             bigint NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_type, reference_type, reference_id, queue_name)
);
```

### Opt-out
```sql
ALTER TABLE public.patients ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.notification_settings ADD COLUMN whatsapp_enabled boolean NOT NULL DEFAULT true;
```

### Log/auditoria unificado (substitui `installments_scheduled_notifications` como fonte de verdade)
```sql
CREATE TYPE public.notification_channel AS ENUM ('push', 'whatsapp');
CREATE TYPE public.notification_log_status AS ENUM ('sent','delivered','read','failed','dead_letter');

CREATE TABLE public.notification_log (
  id                   uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  channel              public.notification_channel NOT NULL,
  notification_type    text NOT NULL,
  reference_type       text,
  reference_id         uuid,
  recipient_type       text NOT NULL,           -- 'user' | 'patient'
  recipient_id         uuid NOT NULL,
  external_message_id  text,
  status               public.notification_log_status NOT NULL,
  error_reason         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_log_recipient ON public.notification_log(recipient_type, recipient_id);
CREATE INDEX idx_notification_log_reference ON public.notification_log(reference_type, reference_id);
```

### Plano de migração (evitar quebrar o push em produção)
1. **Fase A** — cria filas, wrappers e `notification_log`; triggers antigos continuam escrevendo em
   `scheduled_notifications` normalmente (nada muda em produção ainda).
2. **Fase B** — novo worker sobe em paralelo ao `process-notifications` (Edge Function) e ao cron de
   billing antigos; `schedule_appointment_reminders`/`schedule_dpp_reminders` passam a **também**
   enfileirar no pgmq (shadow mode).
3. **Fase C** — validado o shadow mode, os triggers antigos param de escrever nas tabelas antigas; o
   `pg_cron` que chamava a Edge Function e o cron de billing do `vercel.json` são removidos.
4. **Fase D** (migration separada, só depois de operação estável) — `DROP TABLE
   scheduled_notifications, installments_scheduled_notifications`; remove a Edge Function
   `process-notifications` do repo.

## Tratamento de erros

### Retry via pgmq nativo
- `vt` (visibility timeout) controla quando uma mensagem não confirmada volta a ficar visível.
- `read_ct` controla o backoff: `requeue_with_backoff` chama `pgmq.set_vt()` com
  `min(60 * 2^read_ct, 3600)` segundos.
- Máximo de 5 tentativas — na 6ª leitura, vai pra `dead_letter_notification`.

### Classificação de erro da Meta
| Categoria | Exemplos | Ação |
|---|---|---|
| Retryable | `429` rate limit, `5xx`, timeout de rede | `requeue_with_backoff` |
| Permanente — dado do destinatário | `131030` número inválido, `131026` não entregável | `dead_letter_notification` direto |
| Permanente — configuração | `132001` template não aprovado, `131009` parâmetros não batem | `dead_letter_notification` + alerta |

### Circuit breaker por template
Se o mesmo `notification_type` falhar com erro de configuração 3 vezes seguidas, o worker pausa esse
tipo específico e loga um alerta crítico — evita drenar a fila inteira pra dead-letter por causa de um
template mal configurado ou reprovado.

### Webhook inbound
Assinatura inválida → `401`, não processa. Assinatura válida mas `reference_id` não encontrado →
loga anomalia, responde `200` mesmo assim (evita reenvio agressivo da Meta).

### Autenticação
Token do system user da Meta é de longa duração — falha de token é tratada como erro de configuração
(alerta imediato), nunca como retry por mensagem.

## Dependências e setup

### Dependências novas
Nenhuma dependência de peso — API REST simples (`fetch` nativo) e HMAC nativo do Node (`crypto`).
Normalização de telefone é implementação própria (Brasil-only hoje), sem lib externa.

### Env vars novas
```
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_BUSINESS_ACCOUNT_ID
WHATSAPP_SYSTEM_USER_TOKEN
WHATSAPP_APP_SECRET             # valida assinatura do webhook
WHATSAPP_WEBHOOK_VERIFY_TOKEN   # handshake GET do webhook
```
(`CRON_SECRET` já existe e é reaproveitado pelo worker novo.)

### Passos manuais no Meta Business Platform (fora do código, prazo fora do nosso controle)
1. Criar/usar uma Meta Business Account vinculada ao CNPJ.
2. Criar um App em developers.facebook.com, adicionar o produto WhatsApp.
3. Criar a WhatsApp Business Account (WABA) e verificar o número de telefone dedicado.
4. Criar um System User no Business Manager, dar permissão `whatsapp_business_messaging`, gerar o
   token permanente.
5. Configurar o webhook no painel: URL pública, verify token, assinar o campo `messages`.
6. Submeter os 24 templates (nome, categoria — majoritariamente `UTILITY`, idioma `pt_BR`, corpo com
   variáveis posicionais, botões) — revisar textos contra o filtro de tom promocional da Meta antes de
   submeter.
7. Passar pela verificação de negócio — eleva o limite inicial de conversas/dia.
8. Testar contra números de teste sandbox antes de ir a público.

Recomenda-se iniciar esse processo em paralelo à implementação, já que os passos 6 e 7 têm prazo fora
do nosso controle e podem virar o gargalo real do projeto.

## Fases de implementação
| Fase | Conteúdo |
|---|---|
| 0 | Setup externo no Meta Business (em paralelo ao código) |
| 1 | Infra genérica: filas pgmq, wrappers RPC, tabela de índice, `notification_log`, worker route — validada em shadow mode com o push existente |
| 2 | Client Meta + `templates.ts` + `sendWhatsAppToUser` + as 9 mensagens action-triggered |
| 3 | As 15 mensagens trigger/cron-based (8 de paciente + 7 de profissional) |
| 4 | Webhook inbound + processamento de quick-reply |
| 5 | Limpeza: remove `scheduled_notifications`, `installments_scheduled_notifications`, Edge Function antiga, cron antigo do `vercel.json` |
