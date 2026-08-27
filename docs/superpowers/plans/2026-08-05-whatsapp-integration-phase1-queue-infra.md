# Fase 1 — Infra de Filas de Notificação (pgmq) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a infraestrutura genérica de filas (Supabase Queues / pgmq) que vai transportar tanto push quanto WhatsApp, validada em modo shadow contra o pipeline de push existente (`scheduled_notifications`), sem alterar o comportamento em produção.

**Architecture:** Duas filas pgmq (`push_notifications`, `whatsapp_notifications`) acessadas via funções wrapper em `public` (pgmq não é exposto via PostgREST). Um cron do Postgres (`pg_cron`, 1x/min) chama, via `pg_net`, uma rota Next.js (`/api/cron/process-notification-queues`) que drena as filas e envia. Nesta fase, só o canal push tem um remetente real (reaproveitando `sendNotificationToUser` já existente); o canal WhatsApp fica com a fila criada e pronta, mas sem consumidor real até a Fase 2. Os triggers `schedule_appointment_reminders` e `schedule_dpp_reminders` passam a escrever tanto no `scheduled_notifications` (como já fazem) quanto no pgmq (shadow write) — o pipeline antigo continua sendo a fonte de verdade em produção até uma fase futura de corte.

**Tech Stack:** PostgreSQL (Supabase), extensão `pgmq` (já habilitada), PL/pgSQL, Next.js 15 Route Handlers (TypeScript), Supabase CLI local (`supabase start`, porta DB `54322`).

## Global Constraints

- Sem suíte de testes automatizados (unit/integration) nesta fase — decisão explícita do usuário ao aprovar a spec ("Remova os testes unitários e de integração"). Verificação é feita via SQL de asserção (`psql`) para o banco e via `curl` + inspeção de estado do banco para a rota Next.js.
- **Não alterar o comportamento de produção do push existente** — este plano roda em modo shadow (dual-write); o corte do pipeline antigo é uma fase futura, fora deste plano.
- Toda fila, tabela e função nova só pode ser acessada por `service_role` — nunca `authenticated` ou `anon` (mesma convenção de `scheduled_notifications`/`installments_scheduled_notifications`).
- Nome de migration segue o padrão já usado no repo: `YYYYMMDDHHMMSS_descricao_em_snake_case.sql`, em `packages/supabase/supabase/migrations/`.
- Depois de qualquer migration que altera schema exposto via RPC/tabela, rodar `pnpm db:types` (regenera `packages/supabase/src/types/database.types.ts`) antes de escrever código TypeScript que dependa dos tipos novos.
- `pnpm check-types` e `pnpm lint` (Biome, hook de pre-commit) precisam passar antes de cada commit.
- Ambiente local: `pnpm --filter @ventre/supabase dev` inicia o stack local (`supabase start`); `pnpm db:push` aplica migrations a esse stack local por padrão quando rodado dentro dele, mas o comando canônico para aplicar TODAS as migrations do zero localmente (recriando o banco) é `pnpm --filter @ventre/supabase db:reset`. Conexão direta ao Postgres local: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.

---

## File Structure

**Migrations novas** (`packages/supabase/supabase/migrations/`):
- `20260805100001_create_notification_queues.sql` — cria as duas filas pgmq
- `20260805100002_create_notification_queue_index.sql` — tabela de índice pra cancelamento
- `20260805100003_create_notification_log.sql` — enums + tabela de auditoria
- `20260805100004_notification_queue_producer_functions.sql` — `enqueue_notification`, `cancel_notifications_for_reference`
- `20260805100005_notification_queue_consumer_functions.sql` — `dequeue_notifications`, `ack_notification`, `requeue_with_backoff`, `dead_letter_notification`
- `20260805100006_process_notification_queues_cron.sql` — função `process_notification_queues()` (chama a rota Next.js via `pg_net`) + registro do `pg_cron`
- `20260805100007_shadow_write_appointment_reminders.sql` — `CREATE OR REPLACE` de `schedule_appointment_reminders()` com dual-write
- `20260805100008_shadow_write_dpp_reminders.sql` — `CREATE OR REPLACE` de `schedule_dpp_reminders()` com dual-write

**TypeScript novo** (`apps/web/src/`):
- `lib/notifications/queue.ts` — client RPC fino sobre as funções wrapper
- `lib/notifications/errors.ts` — classificador de erro (retryable vs permanente)

**TypeScript novo** (`apps/web/app/`):
- `api/cron/process-notification-queues/route.ts` — worker que drena `push_notifications` (e, sem enviar nada ainda, também lê e reconhece `whatsapp_notifications` como vazia)

---

### Task 1: Criar as filas pgmq

**Files:**
- Create: `packages/supabase/supabase/migrations/20260805100001_create_notification_queues.sql`

**Interfaces:**
- Produz: filas pgmq nomeadas `push_notifications` e `whatsapp_notifications`, consumidas por todas as tasks seguintes.

- [ ] **Step 1: Escrever a query de verificação (vai falhar antes da migration existir)**

Salve como `/tmp/verify_queues.sql` (não faz parte do repo):

```sql
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM pgmq.list_queues() WHERE queue_name = 'push_notifications') = 1,
    'push_notifications queue not found';
  ASSERT (SELECT count(*) FROM pgmq.list_queues() WHERE queue_name = 'whatsapp_notifications') = 1,
    'whatsapp_notifications queue not found';
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar a verificação e confirmar que falha**

```bash
pnpm --filter @ventre/supabase dev
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_queues.sql
```

Esperado: erro de asserção (`push_notifications queue not found`), já que as filas ainda não existem.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260805100001_create_notification_queues.sql

-- Filas de notificação (Supabase Queues / pgmq).
-- push_notifications: canal Firebase, migrado de scheduled_notifications (modo shadow nesta fase).
-- whatsapp_notifications: canal Meta Cloud API, sem consumidor ainda (chega na Fase 2).
SELECT pgmq.create('push_notifications');
SELECT pgmq.create('whatsapp_notifications');
```

- [ ] **Step 4: Aplicar a migration e rodar a verificação de novo**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_queues.sql
```

Esperado: `NOTICE: PASS`, sem erro de asserção.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260805100001_create_notification_queues.sql
git commit -m "feat(whatsapp): create pgmq queues for push and whatsapp notifications"
```

---

### Task 2: Criar tabela `notification_queue_index`

**Files:**
- Create: `packages/supabase/supabase/migrations/20260805100002_create_notification_queue_index.sql`

**Interfaces:**
- Produz: tabela `public.notification_queue_index` com colunas
  `(notification_type text, reference_type text, reference_id uuid, queue_name text, dedup_key text, msg_id bigint, created_at timestamptz)`,
  chave primária `(notification_type, reference_type, reference_id, queue_name, dedup_key)`.
  Consumida pelas funções `enqueue_notification` e `cancel_notifications_for_reference` (Task 4).
- **Por que `dedup_key` existe:** um mesmo `(notification_type, reference_type, reference_id)` pode gerar
  mais de uma mensagem pendente ao mesmo tempo — ex.: `appointment_reminder` agenda um lembrete de 1 dia
  E um de 1 hora para a mesma consulta. Sem uma forma de diferenciá-los na chave, o segundo `INSERT`
  sobrescreveria o índice do primeiro e o cancelamento (`cancel_notifications_for_reference`) perderia
  o rastro de uma das duas mensagens pendentes na fila.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify_queue_index.sql`:

```sql
DO $$
BEGIN
  ASSERT (
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_queue_index'
  ) = 1, 'notification_queue_index table not found';
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_queue_index.sql
```

Esperado: erro de asserção.

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260805100002_create_notification_queue_index.sql

CREATE TABLE public.notification_queue_index (
  notification_type text NOT NULL,
  reference_type     text NOT NULL,
  reference_id       uuid NOT NULL,
  queue_name         text NOT NULL,
  dedup_key          text NOT NULL DEFAULT '',
  msg_id             bigint NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_type, reference_type, reference_id, queue_name, dedup_key)
);

CREATE INDEX idx_notification_queue_index_reference
  ON public.notification_queue_index(reference_type, reference_id);

ALTER TABLE public.notification_queue_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages notification queue index"
  ON public.notification_queue_index
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_queue_index.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260805100002_create_notification_queue_index.sql
git commit -m "feat(whatsapp): add notification_queue_index table"
```

---

### Task 3: Criar `notification_log` (enums + tabela)

**Files:**
- Create: `packages/supabase/supabase/migrations/20260805100003_create_notification_log.sql`

**Interfaces:**
- Produz: tipos `public.notification_channel` (`'push' | 'whatsapp'`) e `public.notification_log_status`
  (`'sent' | 'delivered' | 'read' | 'failed' | 'dead_letter'`), e tabela `public.notification_log`
  com colunas `(id uuid, channel notification_channel, notification_type text, reference_type text,
  reference_id uuid, recipient_type text, recipient_id uuid, external_message_id text,
  status notification_log_status, error_reason text, created_at timestamptz, updated_at timestamptz)`.
  Consumida por `dead_letter_notification` (Task 5) e pela rota worker (Task 8).

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify_notification_log.sql`:

```sql
DO $$
BEGIN
  ASSERT (
    SELECT count(*) FROM pg_type WHERE typname = 'notification_channel'
  ) = 1, 'notification_channel type not found';
  ASSERT (
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_log'
  ) = 1, 'notification_log table not found';
  -- garante que dá pra inserir um registro válido
  INSERT INTO public.notification_log
    (channel, notification_type, recipient_type, recipient_id, status)
  VALUES
    ('push', 'test_type', 'user', gen_random_uuid(), 'sent');
  ASSERT (SELECT count(*) FROM public.notification_log WHERE notification_type = 'test_type') = 1,
    'insert into notification_log failed';
  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_notification_log.sql
```

Esperado: erro de asserção (tipo/tabela não existem).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260805100003_create_notification_log.sql

CREATE TYPE public.notification_channel AS ENUM ('push', 'whatsapp');
CREATE TYPE public.notification_log_status AS ENUM ('sent', 'delivered', 'read', 'failed', 'dead_letter');

CREATE TABLE public.notification_log (
  id                   uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  channel              public.notification_channel NOT NULL,
  notification_type    text NOT NULL,
  reference_type       text,
  reference_id         uuid,
  recipient_type       text NOT NULL,
  recipient_id         uuid NOT NULL,
  external_message_id  text,
  status               public.notification_log_status NOT NULL,
  error_reason         text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notification_log_recipient ON public.notification_log(recipient_type, recipient_id);
CREATE INDEX idx_notification_log_reference ON public.notification_log(reference_type, reference_id);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages notification log"
  ON public.notification_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_notification_log.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260805100003_create_notification_log.sql
git commit -m "feat(whatsapp): add notification_log audit table"
```

---

### Task 4: Funções de produção da fila — `enqueue_notification`, `cancel_notifications_for_reference`

**Files:**
- Create: `packages/supabase/supabase/migrations/20260805100004_notification_queue_producer_functions.sql`

**Interfaces:**
- Consome: filas pgmq (Task 1), tabela `notification_queue_index` (Task 2).
- Produz:
  - `public.enqueue_notification(p_queue_name text, p_notification_type text, p_reference_type text, p_reference_id uuid, p_recipient_type text, p_recipient_id uuid, p_delay_seconds integer DEFAULT 0, p_dedup_key text DEFAULT '') RETURNS bigint`
  - `public.cancel_notifications_for_reference(p_reference_type text, p_reference_id uuid) RETURNS integer`
  - Ambas usadas por: `lib/notifications/queue.ts` (Task 6), `schedule_appointment_reminders` (Task 10), `schedule_dpp_reminders` (Task 11).

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify_producer_functions.sql`:

```sql
DO $$
DECLARE
  v_msg_id bigint;
  v_ref_id uuid := gen_random_uuid();
  v_cancelled_count integer;
BEGIN
  -- enqueue básico
  v_msg_id := public.enqueue_notification(
    'push_notifications', 'appointment_reminder', 'appointment', v_ref_id,
    'patient', gen_random_uuid(), 0, '1_day'
  );
  ASSERT v_msg_id IS NOT NULL, 'enqueue_notification did not return a msg_id';

  -- índice foi gravado
  ASSERT (
    SELECT count(*) FROM public.notification_queue_index
    WHERE reference_id = v_ref_id AND dedup_key = '1_day'
  ) = 1, 'notification_queue_index row not created';

  -- mensagem está na fila pgmq
  ASSERT (SELECT count(*) FROM pgmq.q_push_notifications WHERE msg_id = v_msg_id) = 1,
    'message not found in pgmq queue';

  -- um segundo enqueue com dedup_key diferente para a mesma reference_id não colide
  PERFORM public.enqueue_notification(
    'push_notifications', 'appointment_reminder', 'appointment', v_ref_id,
    'patient', gen_random_uuid(), 0, '1_hour'
  );
  ASSERT (
    SELECT count(*) FROM public.notification_queue_index WHERE reference_id = v_ref_id
  ) = 2, 'second enqueue with different dedup_key should coexist, not overwrite';

  -- cancel remove as duas mensagens pendentes e limpa o índice
  v_cancelled_count := public.cancel_notifications_for_reference('appointment', v_ref_id);
  ASSERT v_cancelled_count = 2, 'expected 2 cancelled messages, got ' || v_cancelled_count;
  ASSERT (
    SELECT count(*) FROM public.notification_queue_index WHERE reference_id = v_ref_id
  ) = 0, 'notification_queue_index rows should be removed after cancel';

  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_producer_functions.sql
```

Esperado: erro (`function public.enqueue_notification(...) does not exist`).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260805100004_notification_queue_producer_functions.sql

CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_queue_name text,
  p_notification_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_recipient_type text,
  p_recipient_id uuid,
  p_delay_seconds integer DEFAULT 0,
  p_dedup_key text DEFAULT ''
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_msg_id bigint;
  v_payload jsonb;
BEGIN
  v_payload := jsonb_build_object(
    'notification_type', p_notification_type,
    'reference_type', p_reference_type,
    'reference_id', p_reference_id,
    'recipient_type', p_recipient_type,
    'recipient_id', p_recipient_id
  );

  SELECT pgmq.send(p_queue_name, v_payload, p_delay_seconds) INTO v_msg_id;

  INSERT INTO public.notification_queue_index
    (notification_type, reference_type, reference_id, queue_name, dedup_key, msg_id)
  VALUES
    (p_notification_type, p_reference_type, p_reference_id, p_queue_name, p_dedup_key, v_msg_id)
  ON CONFLICT (notification_type, reference_type, reference_id, queue_name, dedup_key)
  DO UPDATE SET msg_id = EXCLUDED.msg_id, created_at = now();

  RETURN v_msg_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_notification TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_notifications_for_reference(
  p_reference_type text,
  p_reference_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT queue_name, msg_id
    FROM public.notification_queue_index
    WHERE reference_type = p_reference_type
      AND reference_id = p_reference_id
  LOOP
    PERFORM pgmq.delete(v_row.queue_name, v_row.msg_id);
    v_count := v_count + 1;
  END LOOP;

  DELETE FROM public.notification_queue_index
  WHERE reference_type = p_reference_type
    AND reference_id = p_reference_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_notifications_for_reference FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_notifications_for_reference TO service_role;
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_producer_functions.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260805100004_notification_queue_producer_functions.sql
git commit -m "feat(whatsapp): add enqueue_notification and cancel_notifications_for_reference"
```

---

### Task 5: Funções de consumo da fila — `dequeue_notifications`, `ack_notification`, `requeue_with_backoff`, `dead_letter_notification`

**Files:**
- Create: `packages/supabase/supabase/migrations/20260805100005_notification_queue_consumer_functions.sql`

**Interfaces:**
- Consome: filas pgmq (Task 1), `notification_log` (Task 3).
- Produz:
  - `public.dequeue_notifications(p_queue_name text, p_qty integer DEFAULT 20, p_vt integer DEFAULT 60) RETURNS TABLE(msg_id bigint, read_ct integer, enqueued_at timestamptz, message jsonb)`
  - `public.ack_notification(p_queue_name text, p_msg_id bigint) RETURNS boolean`
  - `public.requeue_with_backoff(p_queue_name text, p_msg_id bigint, p_read_ct integer) RETURNS void`
  - `public.dead_letter_notification(p_queue_name text, p_msg_id bigint, p_channel public.notification_channel, p_notification_type text, p_reference_type text, p_reference_id uuid, p_recipient_type text, p_recipient_id uuid, p_reason text) RETURNS void`
  - Todas usadas por `lib/notifications/queue.ts` (Task 6) e pela rota worker (Task 8).

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify_consumer_functions.sql`:

```sql
DO $$
DECLARE
  v_msg_id bigint;
  v_ref_id uuid := gen_random_uuid();
  v_dequeued record;
  v_acked boolean;
BEGIN
  v_msg_id := public.enqueue_notification(
    'push_notifications', 'test_type', 'appointment', v_ref_id, 'patient', gen_random_uuid()
  );

  -- dequeue devolve a mensagem
  SELECT * INTO v_dequeued FROM public.dequeue_notifications('push_notifications', 10, 30)
    WHERE msg_id = v_msg_id;
  ASSERT v_dequeued.msg_id = v_msg_id, 'dequeue_notifications did not return the enqueued message';
  ASSERT (v_dequeued.message->>'notification_type') = 'test_type', 'payload not preserved';

  -- enquanto o vt não expira, uma segunda leitura não deve devolver a mesma mensagem
  ASSERT (
    SELECT count(*) FROM public.dequeue_notifications('push_notifications', 10, 30)
    WHERE msg_id = v_msg_id
  ) = 0, 'message should be invisible while vt has not expired';

  -- ack remove a mensagem definitivamente
  v_acked := public.ack_notification('push_notifications', v_msg_id);
  ASSERT v_acked = true, 'ack_notification should return true';

  -- requeue_with_backoff: cria uma nova mensagem e testa que set_vt não gera erro
  v_msg_id := public.enqueue_notification(
    'push_notifications', 'test_type', 'appointment', v_ref_id, 'patient', gen_random_uuid()
  );
  PERFORM public.dequeue_notifications('push_notifications', 10, 1);
  PERFORM public.requeue_with_backoff('push_notifications', v_msg_id, 1);
  PERFORM public.ack_notification('push_notifications', v_msg_id);

  -- dead_letter_notification arquiva a mensagem e grava no log
  v_msg_id := public.enqueue_notification(
    'push_notifications', 'test_type', 'appointment', v_ref_id, 'patient', gen_random_uuid()
  );
  PERFORM public.dead_letter_notification(
    'push_notifications', v_msg_id, 'push', 'test_type', 'appointment', v_ref_id,
    'patient', gen_random_uuid(), 'simulated permanent failure'
  );
  ASSERT (
    SELECT count(*) FROM public.notification_log
    WHERE reference_id = v_ref_id AND status = 'dead_letter'
  ) = 1, 'dead_letter_notification did not write to notification_log';
  ASSERT (
    SELECT count(*) FROM pgmq.q_push_notifications WHERE msg_id = v_msg_id
  ) = 0, 'dead-lettered message should no longer be in the active queue';

  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_consumer_functions.sql
```

Esperado: erro (`function public.dequeue_notifications(...) does not exist`).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260805100005_notification_queue_consumer_functions.sql

CREATE OR REPLACE FUNCTION public.dequeue_notifications(
  p_queue_name text,
  p_qty integer DEFAULT 20,
  p_vt integer DEFAULT 60
) RETURNS TABLE (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  message jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT msg_id, read_ct, enqueued_at, message
  FROM pgmq.read(p_queue_name, p_vt, p_qty);
$$;

REVOKE ALL ON FUNCTION public.dequeue_notifications FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dequeue_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.ack_notification(p_queue_name text, p_msg_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
  SELECT pgmq.delete(p_queue_name, p_msg_id);
$$;

REVOKE ALL ON FUNCTION public.ack_notification FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ack_notification TO service_role;

CREATE OR REPLACE FUNCTION public.requeue_with_backoff(
  p_queue_name text,
  p_msg_id bigint,
  p_read_ct integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
DECLARE
  v_backoff_seconds integer;
BEGIN
  v_backoff_seconds := LEAST((60 * POWER(2, p_read_ct))::integer, 3600);
  PERFORM pgmq.set_vt(p_queue_name, p_msg_id, v_backoff_seconds);
END;
$$;

REVOKE ALL ON FUNCTION public.requeue_with_backoff FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.requeue_with_backoff TO service_role;

CREATE OR REPLACE FUNCTION public.dead_letter_notification(
  p_queue_name text,
  p_msg_id bigint,
  p_channel public.notification_channel,
  p_notification_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_recipient_type text,
  p_recipient_id uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  PERFORM pgmq.archive(p_queue_name, p_msg_id);

  INSERT INTO public.notification_log
    (channel, notification_type, reference_type, reference_id,
     recipient_type, recipient_id, status, error_reason)
  VALUES
    (p_channel, p_notification_type, p_reference_type, p_reference_id,
     p_recipient_type, p_recipient_id, 'dead_letter', p_reason);
END;
$$;

REVOKE ALL ON FUNCTION public.dead_letter_notification FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dead_letter_notification TO service_role;
```

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_consumer_functions.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260805100005_notification_queue_consumer_functions.sql
git commit -m "feat(whatsapp): add queue consumer functions (dequeue, ack, backoff, dead-letter)"
```

---

### Task 6: Regenerar tipos + client RPC `lib/notifications/queue.ts`

**Files:**
- Modify: `packages/supabase/src/types/database.types.ts` (gerado, não editar manualmente)
- Create: `apps/web/src/lib/notifications/queue.ts`

**Interfaces:**
- Consome: `createServerSupabaseAdmin()` de `@ventre/supabase/server` (padrão já usado em todo o
  `apps/web/src/lib/`), e as funções RPC das Tasks 4 e 5.
- Produz:
  ```ts
  export type QueueName = "push_notifications" | "whatsapp_notifications";

  export type DequeuedNotification = {
    msgId: number;
    readCt: number;
    enqueuedAt: string;
    notificationType: string;
    referenceType: string;
    referenceId: string;
    recipientType: "user" | "patient";
    recipientId: string;
  };

  export async function enqueueNotification(params: {
    queueName: QueueName;
    notificationType: string;
    referenceType: string;
    referenceId: string;
    recipientType: "user" | "patient";
    recipientId: string;
    delaySeconds?: number;
    dedupKey?: string;
  }): Promise<number>;

  export async function dequeueNotifications(
    queueName: QueueName,
    qty?: number,
    vt?: number,
  ): Promise<DequeuedNotification[]>;

  export async function ackNotification(queueName: QueueName, msgId: number): Promise<void>;

  export async function requeueWithBackoff(
    queueName: QueueName,
    msgId: number,
    readCt: number,
  ): Promise<void>;

  export async function deadLetterNotification(params: {
    queueName: QueueName;
    msgId: number;
    channel: "push" | "whatsapp";
    notificationType: string;
    referenceType: string;
    referenceId: string;
    recipientType: "user" | "patient";
    recipientId: string;
    reason: string;
  }): Promise<void>;
  ```
  Consumido pela rota worker (Task 8).

- [ ] **Step 1: Regenerar os tipos do banco**

```bash
pnpm db:types
git diff --stat packages/supabase/src/types/database.types.ts
```

Confirme que `enqueue_notification`, `dequeue_notifications`, `ack_notification`,
`requeue_with_backoff`, `dead_letter_notification` e `cancel_notifications_for_reference` aparecem no
diff dentro de `Functions` do schema `public`.

- [ ] **Step 2: Escrever um script de verificação manual (não faz parte do repo)**

Salve como `/tmp/verify-queue-client.ts` na raiz de `apps/web`:

```ts
import { enqueueNotification, dequeueNotifications, ackNotification } from "@/lib/notifications/queue";
import { randomUUID } from "node:crypto";

async function main() {
  const referenceId = randomUUID();
  const recipientId = randomUUID();

  const msgId = await enqueueNotification({
    queueName: "push_notifications",
    notificationType: "test_type",
    referenceType: "appointment",
    referenceId,
    recipientType: "patient",
    recipientId,
  });
  console.assert(typeof msgId === "number", "enqueueNotification should return a number");

  const messages = await dequeueNotifications("push_notifications", 10, 30);
  const found = messages.find((m) => m.msgId === msgId);
  console.assert(found?.referenceId === referenceId, "dequeueNotifications should return the enqueued message");

  await ackNotification("push_notifications", msgId);

  console.log("PASS");
}

main();
```

- [ ] **Step 3: Rodar e confirmar que falha (o arquivo `queue.ts` ainda não existe)**

```bash
cd apps/web && npx tsx /tmp/verify-queue-client.ts
```

Esperado: erro de módulo não encontrado (`Cannot find module '@/lib/notifications/queue'`).

- [ ] **Step 4: Escrever `queue.ts`**

```ts
// apps/web/src/lib/notifications/queue.ts
import { createServerSupabaseAdmin } from "@ventre/supabase/server";

export type QueueName = "push_notifications" | "whatsapp_notifications";

export type DequeuedNotification = {
  msgId: number;
  readCt: number;
  enqueuedAt: string;
  notificationType: string;
  referenceType: string;
  referenceId: string;
  recipientType: "user" | "patient";
  recipientId: string;
};

export async function enqueueNotification(params: {
  queueName: QueueName;
  notificationType: string;
  referenceType: string;
  referenceId: string;
  recipientType: "user" | "patient";
  recipientId: string;
  delaySeconds?: number;
  dedupKey?: string;
}): Promise<number> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("enqueue_notification", {
    p_queue_name: params.queueName,
    p_notification_type: params.notificationType,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId,
    p_recipient_type: params.recipientType,
    p_recipient_id: params.recipientId,
    p_delay_seconds: params.delaySeconds ?? 0,
    p_dedup_key: params.dedupKey ?? "",
  });

  if (error) throw new Error(`enqueueNotification failed: ${error.message}`);
  return data as number;
}

export async function dequeueNotifications(
  queueName: QueueName,
  qty = 20,
  vt = 60,
): Promise<DequeuedNotification[]> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("dequeue_notifications", {
    p_queue_name: queueName,
    p_qty: qty,
    p_vt: vt,
  });

  if (error) throw new Error(`dequeueNotifications failed: ${error.message}`);

  return (data ?? []).map((row) => {
    const message = row.message as {
      notification_type: string;
      reference_type: string;
      reference_id: string;
      recipient_type: "user" | "patient";
      recipient_id: string;
    };
    return {
      msgId: row.msg_id,
      readCt: row.read_ct,
      enqueuedAt: row.enqueued_at,
      notificationType: message.notification_type,
      referenceType: message.reference_type,
      referenceId: message.reference_id,
      recipientType: message.recipient_type,
      recipientId: message.recipient_id,
    };
  });
}

export async function ackNotification(queueName: QueueName, msgId: number): Promise<void> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { error } = await supabaseAdmin.rpc("ack_notification", {
    p_queue_name: queueName,
    p_msg_id: msgId,
  });

  if (error) throw new Error(`ackNotification failed: ${error.message}`);
}

export async function requeueWithBackoff(
  queueName: QueueName,
  msgId: number,
  readCt: number,
): Promise<void> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { error } = await supabaseAdmin.rpc("requeue_with_backoff", {
    p_queue_name: queueName,
    p_msg_id: msgId,
    p_read_ct: readCt,
  });

  if (error) throw new Error(`requeueWithBackoff failed: ${error.message}`);
}

export async function deadLetterNotification(params: {
  queueName: QueueName;
  msgId: number;
  channel: "push" | "whatsapp";
  notificationType: string;
  referenceType: string;
  referenceId: string;
  recipientType: "user" | "patient";
  recipientId: string;
  reason: string;
}): Promise<void> {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { error } = await supabaseAdmin.rpc("dead_letter_notification", {
    p_queue_name: params.queueName,
    p_msg_id: params.msgId,
    p_channel: params.channel,
    p_notification_type: params.notificationType,
    p_reference_type: params.referenceType,
    p_reference_id: params.referenceId,
    p_recipient_type: params.recipientType,
    p_recipient_id: params.recipientId,
    p_reason: params.reason,
  });

  if (error) throw new Error(`deadLetterNotification failed: ${error.message}`);
}
```

- [ ] **Step 5: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-queue-client.ts
```

Esperado: `PASS` impresso no console, sem erro.

- [ ] **Step 6: Type-check e commit**

```bash
pnpm check-types
git add packages/supabase/src/types/database.types.ts apps/web/src/lib/notifications/queue.ts
git commit -m "feat(whatsapp): add typed RPC client for notification queues"
```

---

### Task 7: Classificador de erro `lib/notifications/errors.ts`

**Files:**
- Create: `apps/web/src/lib/notifications/errors.ts`

**Interfaces:**
- Produz:
  ```ts
  export type NotificationErrorClassification = "retryable" | "permanent";

  export function classifyPushError(error: { code?: string; message?: string }): NotificationErrorClassification;
  ```
  Consumido pela rota worker (Task 8). A classificação reaproveita a mesma distinção já usada em
  `packages/supabase/supabase/functions/ventre-send-notification/index.ts` (`UNREGISTERED` /
  `INVALID_ARGUMENT` → token inválido/permanente; qualquer outro código → retryable).

- [ ] **Step 1: Escrever o script de verificação (falha por falta do módulo)**

Salve como `/tmp/verify-errors.ts` na raiz de `apps/web`:

```ts
import { classifyPushError } from "@/lib/notifications/errors";

console.assert(
  classifyPushError({ code: "UNREGISTERED" }) === "permanent",
  "UNREGISTERED should be permanent",
);
console.assert(
  classifyPushError({ code: "INVALID_ARGUMENT" }) === "permanent",
  "INVALID_ARGUMENT should be permanent",
);
console.assert(
  classifyPushError({ code: "INTERNAL" }) === "retryable",
  "INTERNAL should be retryable",
);
console.assert(
  classifyPushError({}) === "retryable",
  "unknown/missing code should default to retryable",
);

console.log("PASS");
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd apps/web && npx tsx /tmp/verify-errors.ts
```

Esperado: erro de módulo não encontrado.

- [ ] **Step 3: Escrever `errors.ts`**

```ts
// apps/web/src/lib/notifications/errors.ts

export type NotificationErrorClassification = "retryable" | "permanent";

const PERMANENT_PUSH_ERROR_CODES = new Set(["UNREGISTERED", "INVALID_ARGUMENT"]);

export function classifyPushError(error: { code?: string; message?: string }): NotificationErrorClassification {
  if (error.code && PERMANENT_PUSH_ERROR_CODES.has(error.code)) {
    return "permanent";
  }
  return "retryable";
}
```

- [ ] **Step 4: Rodar a verificação de novo**

```bash
cd apps/web && npx tsx /tmp/verify-errors.ts
```

Esperado: `PASS`, sem asserção falhando.

- [ ] **Step 5: Commit**

```bash
pnpm check-types
git add apps/web/src/lib/notifications/errors.ts
git commit -m "feat(whatsapp): add notification error classifier"
```

---

### Task 8: Rota worker `/api/cron/process-notification-queues`

**Files:**
- Create: `apps/web/app/api/cron/process-notification-queues/route.ts`

**Interfaces:**
- Consome: `dequeueNotifications`, `ackNotification`, `requeueWithBackoff`, `deadLetterNotification` de
  `lib/notifications/queue.ts` (Task 6); `classifyPushError` de `lib/notifications/errors.ts` (Task 7);
  `sendNotificationToUser` já existente em `apps/web/src/lib/notifications/send.ts`;
  `getNotificationTemplate` já existente em `apps/web/src/lib/notifications/templates.ts`;
  `createServerSupabaseAdmin()` de `@ventre/supabase/server`; env var `CRON_SECRET` (já existe, mesmo
  padrão usado em `apps/web/app/api/cron/billing-notifications/route.ts`).
- Produz: endpoint `GET /api/cron/process-notification-queues` protegido por
  `Authorization: Bearer $CRON_SECRET`, que drena `push_notifications` e envia via `sendNotificationToUser`.
  Nesta fase, `whatsapp_notifications` é apenas verificada (sempre vazia — nada a enviar ainda).

Esta rota busca dados frescos de `appointments`/`patients` por `reference_id` para os dois
`notification_type` que já existem hoje: `appointment_reminder` e `dpp_approaching` — os mesmos tipos
que `schedule_appointment_reminders`/`schedule_dpp_reminders` (Tasks 10/11) vão passar a enfileirar em
modo shadow.

- [ ] **Step 1: Escrever o código da rota**

```ts
// apps/web/app/api/cron/process-notification-queues/route.ts
import { classifyPushError } from "@/lib/notifications/errors";
import { getNotificationTemplate } from "@/lib/notifications/templates";
import {
  ackNotification,
  deadLetterNotification,
  dequeueNotifications,
  requeueWithBackoff,
  type DequeuedNotification,
} from "@/lib/notifications/queue";
import { type NotificationType, sendNotificationToUser } from "@/lib/notifications/send";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { NextResponse } from "next/server";

const MAX_ATTEMPTS = 5;

type ResolvedPushNotification = {
  type: NotificationType;
  userId: string;
  title: string;
  body: string;
  url: string;
};

async function resolvePushRecipientAndTemplate(
  notification: DequeuedNotification,
  supabaseAdmin: Awaited<ReturnType<typeof createServerSupabaseAdmin>>,
): Promise<ResolvedPushNotification | null> {
  if (notification.notificationType === "appointment_reminder") {
    const { data: appointment } = await supabaseAdmin
      .from("appointments")
      .select("*, patient:patients!appointments_patient_id_fkey(id, name, user_id)")
      .eq("id", notification.referenceId)
      .single();

    if (!appointment || appointment.status !== "agendada") return null;

    const patient = appointment.patient as unknown as { name: string; user_id: string | null };
    if (!patient.user_id) return null;

    const template = getNotificationTemplate("appointment_reminder", {
      patientName: patient.name,
      date: appointment.date,
      time: appointment.time,
    });

    return {
      type: "appointment_reminder",
      userId: patient.user_id,
      title: template.title,
      body: template.body,
      url: `/patients/${appointment.patient_id}`,
    };
  }

  if (notification.notificationType === "dpp_approaching") {
    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("id, name, user_id")
      .eq("id", notification.referenceId)
      .single();

    if (!patient?.user_id) return null;

    const template = getNotificationTemplate("dpp_approaching", {
      patientName: patient.name,
    });

    return {
      type: "dpp_approaching",
      userId: patient.user_id,
      title: template.title,
      body: template.body,
      url: `/patients/${patient.id}`,
    };
  }

  return null;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabaseAdmin = await createServerSupabaseAdmin();

  let pushSent = 0;
  let pushSkipped = 0;
  let pushFailed = 0;

  const pushMessages = await dequeueNotifications("push_notifications", 20, 60);

  for (const notification of pushMessages) {
    try {
      const resolved = await resolvePushRecipientAndTemplate(notification, supabaseAdmin);

      if (!resolved) {
        // referência não existe mais ou não é mais válida (ex: consulta cancelada) — descarta
        await ackNotification("push_notifications", notification.msgId);
        pushSkipped++;
        continue;
      }

      await sendNotificationToUser(resolved.userId, {
        type: resolved.type,
        title: resolved.title,
        body: resolved.body,
        data: { url: resolved.url },
      });

      await supabaseAdmin.from("notification_log").insert({
        channel: "push",
        notification_type: notification.notificationType,
        reference_type: notification.referenceType,
        reference_id: notification.referenceId,
        recipient_type: notification.recipientType,
        recipient_id: notification.recipientId,
        status: "sent",
      });

      await ackNotification("push_notifications", notification.msgId);
      pushSent++;
    } catch (err) {
      const classification = classifyPushError(err as { code?: string; message?: string });

      if (classification === "permanent" || notification.readCt >= MAX_ATTEMPTS) {
        await deadLetterNotification({
          queueName: "push_notifications",
          msgId: notification.msgId,
          channel: "push",
          notificationType: notification.notificationType,
          referenceType: notification.referenceType,
          referenceId: notification.referenceId,
          recipientType: notification.recipientType,
          recipientId: notification.recipientId,
          reason: err instanceof Error ? err.message : "unknown error",
        });
      } else {
        await requeueWithBackoff("push_notifications", notification.msgId, notification.readCt);
      }
      pushFailed++;
    }
  }

  // Fase 1: fila de whatsapp existe mas ainda não tem remetente — só confirma que está vazia/acessível.
  const whatsappMessages = await dequeueNotifications("whatsapp_notifications", 1, 1);

  return NextResponse.json({
    push: { sent: pushSent, skipped: pushSkipped, failed: pushFailed },
    whatsapp: { pending: whatsappMessages.length },
  });
}
```

- [ ] **Step 2: Adicionar `CRON_SECRET` ao `.env.local` se ainda não existir**

```bash
grep -q "^CRON_SECRET=" apps/web/.env.local || echo "CRON_SECRET=local-dev-secret" >> apps/web/.env.local
```

- [ ] **Step 3: Rodar o dev server e testar manualmente**

```bash
pnpm --filter web dev
```

Em outro terminal, insira uma mensagem de teste na fila diretamente via SQL e confirme que a rota
processa (vai cair no branch `resolvePushRecipientAndTemplate` retornando `null`, já que
`notification_type = 'test_type'` não é reconhecido — o objetivo aqui é confirmar que a rota roda sem
erro e faz o `ack`, não testar o envio real do Firebase, que exige credenciais):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT public.enqueue_notification(
    'push_notifications', 'test_type', 'appointment', gen_random_uuid(),
    'patient', gen_random_uuid()
  );
"

curl -s -H "Authorization: Bearer local-dev-secret" \
  http://localhost:3000/api/cron/process-notification-queues | jq .
```

Esperado: resposta JSON com `push.skipped: 1` (o tipo desconhecido cai no branch `resolved === null` e
é descartado com `ack`) e confirme que a mensagem some da fila:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "SELECT count(*) FROM pgmq.q_push_notifications;"
```

Esperado: `0`.

- [ ] **Step 4: Type-check e commit**

```bash
pnpm check-types
git add apps/web/app/api/cron/process-notification-queues/route.ts apps/web/.env.local
git commit -m "feat(whatsapp): add worker route to drain push and whatsapp queues"
```

Nota: se `.env.local` não for versionado no repo (confira `git status` — ele normalmente está no
`.gitignore`), pule o `git add` desse arquivo e apenas documente a variável no README/`.env.example`
do projeto, se existir um.

---

### Task 9: Função `process_notification_queues()` + registro do `pg_cron`

**Files:**
- Create: `packages/supabase/supabase/migrations/20260805100006_process_notification_queues_cron.sql`

**Interfaces:**
- Consome: rota Next.js da Task 8 (via HTTP, não em tempo de compilação).
- Produz: função `public.process_notification_queues() RETURNS void` e um job `pg_cron` chamado
  `process-notification-queues` rodando a cada 1 minuto.

Esta função segue o mesmo padrão de `public.process_scheduled_notifications()` (já existente em
`20260209000001_notification_cron.sql`), mas chama a rota Next.js em vez da Edge Function.

- [ ] **Step 1: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260805100006_process_notification_queues_cron.sql

CREATE OR REPLACE FUNCTION public.process_notification_queues()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM net.http_get(
    url := current_setting('app.settings.web_app_url', true) || '/api/cron/process-notification-queues',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret', true)
    )
  );
END;
$$;

-- Requer as configurações abaixo definidas no projeto (fora deste arquivo, são segredos):
--   ALTER DATABASE postgres SET app.settings.web_app_url = 'https://<seu-dominio>';
--   ALTER DATABASE postgres SET app.settings.cron_secret = '<mesmo valor de CRON_SECRET no Vercel>';
-- Rode esses dois comandos manualmente no SQL Editor do painel Supabase (produção e qualquer
-- ambiente de staging), antes deste cron job disparar pela primeira vez.

SELECT cron.schedule(
  'process-notification-queues',
  '* * * * *',
  'SELECT public.process_notification_queues()'
);
```

- [ ] **Step 2: Aplicar localmente**

```bash
pnpm --filter @ventre/supabase db:reset
```

- [ ] **Step 3: Verificar que a função existe e que o job foi registrado**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT proname FROM pg_proc WHERE proname = 'process_notification_queues';
"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT jobname, schedule FROM cron.job WHERE jobname = 'process-notification-queues';
"
```

Esperado: uma linha em cada consulta. (A chamada HTTP em si não é testável localmente sem
`app.settings.web_app_url` apontando pra um túnel público — isso fica para a validação manual em
staging, depois do deploy.)

- [ ] **Step 4: Commit**

```bash
git add packages/supabase/supabase/migrations/20260805100006_process_notification_queues_cron.sql
git commit -m "feat(whatsapp): schedule pg_cron job to drive the notification queue worker"
```

- [ ] **Step 5: Registrar manualmente os settings em staging/produção (fora do git, ação manual)**

No SQL Editor do painel Supabase do projeto (staging primeiro, depois produção):

```sql
ALTER DATABASE postgres SET app.settings.web_app_url = 'https://<seu-dominio-de-staging-ou-producao>';
ALTER DATABASE postgres SET app.settings.cron_secret = '<mesmo valor da env var CRON_SECRET no Vercel>';
```

---

### Task 10: Shadow-write em `schedule_appointment_reminders()`

**Files:**
- Create: `packages/supabase/supabase/migrations/20260805100007_shadow_write_appointment_reminders.sql`

**Interfaces:**
- Consome: `public.enqueue_notification` e `public.cancel_notifications_for_reference` (Task 4).
- Modifica o comportamento do trigger `on_appointment_change_schedule_reminders` (já existe, definido
  em `20260209000001_notification_cron.sql`) — sem alterar sua assinatura ou o nome do trigger, só o
  corpo da função que ele executa.

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify_shadow_appointment.sql`:

```sql
DO $$
DECLARE
  v_patient_id uuid;
  v_professional_id uuid;
  v_appointment_id uuid;
BEGIN
  -- Setup mínimo: cria um usuário profissional e uma paciente pra satisfazer as FKs.
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'prof-shadow-test@example.com', 'Profissional Teste', 'profissional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (id, name, phone, created_by)
  VALUES (gen_random_uuid(), 'Paciente Teste', '(11) 99999-0000', v_professional_id)
  RETURNING id INTO v_patient_id;

  -- Consulta em 2 dias, ainda deve poder agendar o lembrete de 1 dia.
  INSERT INTO public.appointments (id, patient_id, professional_id, date, time, type, status)
  VALUES (
    gen_random_uuid(), v_patient_id, v_professional_id,
    CURRENT_DATE + 2, '10:00', 'consulta', 'agendada'
  )
  RETURNING id INTO v_appointment_id;

  ASSERT (
    SELECT count(*) FROM public.scheduled_notifications
    WHERE reference_id = v_appointment_id AND notification_type = 'appointment_reminder'
  ) = 2, 'expected 2 rows in scheduled_notifications (old path unaffected)';

  ASSERT (
    SELECT count(*) FROM public.notification_queue_index
    WHERE reference_id = v_appointment_id AND notification_type = 'appointment_reminder'
  ) = 2, 'expected 2 rows in notification_queue_index (new pgmq shadow path)';

  -- Cancelar a consulta deve limpar os dois caminhos.
  UPDATE public.appointments SET status = 'cancelada' WHERE id = v_appointment_id;

  ASSERT (
    SELECT count(*) FROM public.scheduled_notifications
    WHERE reference_id = v_appointment_id AND processed_at IS NULL
  ) = 0, 'scheduled_notifications should be cleared after cancel';

  ASSERT (
    SELECT count(*) FROM public.notification_queue_index WHERE reference_id = v_appointment_id
  ) = 0, 'notification_queue_index should be cleared after cancel';

  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_shadow_appointment.sql
```

Esperado: a segunda asserção falha (`notification_queue_index` ainda vazio, já que o trigger não
enfileira no pgmq ainda).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260805100007_shadow_write_appointment_reminders.sql

CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'cancelada' THEN
    DELETE FROM public.scheduled_notifications
    WHERE reference_id = NEW.id
      AND reference_type = 'appointment'
      AND processed_at IS NULL;
    PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);
    RETURN NEW;
  END IF;

  DELETE FROM public.scheduled_notifications
  WHERE reference_id = NEW.id
    AND reference_type = 'appointment'
    AND processed_at IS NULL;
  PERFORM public.cancel_notifications_for_reference('appointment', NEW.id);

  IF NEW.status = 'agendada' THEN
    DECLARE
      appointment_datetime timestamptz;
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

        PERFORM public.enqueue_notification(
          'push_notifications', 'appointment_reminder', 'appointment', NEW.id,
          'patient', NEW.patient_id,
          GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '1 day' - now()))::integer, 0),
          '1_day'
        );
      END IF;

      IF appointment_datetime - INTERVAL '1 hour' > now() THEN
        INSERT INTO public.scheduled_notifications
          (notification_type, reference_id, reference_type, scheduled_for, payload)
        VALUES
          ('appointment_reminder', NEW.id, 'appointment',
           appointment_datetime - INTERVAL '1 hour',
           jsonb_build_object('patient_id', NEW.patient_id, 'professional_id', NEW.professional_id, 'reminder_type', '1_hour'))
        ON CONFLICT DO NOTHING;

        PERFORM public.enqueue_notification(
          'push_notifications', 'appointment_reminder', 'appointment', NEW.id,
          'patient', NEW.patient_id,
          GREATEST(extract(epoch FROM (appointment_datetime - INTERVAL '1 hour' - now()))::integer, 0),
          '1_hour'
        );
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
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_shadow_appointment.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260805100007_shadow_write_appointment_reminders.sql
git commit -m "feat(whatsapp): dual-write appointment reminders to pgmq (shadow mode)"
```

---

### Task 11: Shadow-write em `schedule_dpp_reminders()`

**Files:**
- Create: `packages/supabase/supabase/migrations/20260805100008_shadow_write_dpp_reminders.sql`

**Interfaces:**
- Consome: `public.enqueue_notification` (Task 4).
- Modifica o corpo de `schedule_dpp_reminders()` (função chamada por `pg_cron`, não um trigger — sem
  cancelamento de mensagens pendentes aqui, já que ela roda 1x/dia e o `ON CONFLICT DO NOTHING` do
  `scheduled_notifications` já evita duplicidade; o `enqueue_notification` usa `dedup_key` pra ter a
  mesma proteção do lado do pgmq).

- [ ] **Step 1: Escrever a query de verificação**

Salve como `/tmp/verify_shadow_dpp.sql`:

```sql
DO $$
DECLARE
  v_professional_id uuid;
  v_patient_id uuid;
BEGIN
  INSERT INTO public.users (id, email, name, user_type)
  VALUES (gen_random_uuid(), 'prof-dpp-test@example.com', 'Profissional DPP', 'profissional')
  RETURNING id INTO v_professional_id;

  INSERT INTO public.patients (id, name, phone, created_by)
  VALUES (gen_random_uuid(), 'Paciente DPP', '(11) 99999-0001', v_professional_id)
  RETURNING id INTO v_patient_id;

  INSERT INTO public.pregnancies (patient_id, due_date, has_finished)
  VALUES (v_patient_id, CURRENT_DATE + 30, false);

  PERFORM public.schedule_dpp_reminders();

  ASSERT (
    SELECT count(*) FROM public.scheduled_notifications
    WHERE reference_id = v_patient_id AND notification_type = 'dpp_approaching'
  ) = 1, 'expected 1 row in scheduled_notifications (old path unaffected)';

  ASSERT (
    SELECT count(*) FROM public.notification_queue_index
    WHERE reference_id = v_patient_id AND notification_type = 'dpp_approaching' AND dedup_key = '30_days'
  ) = 1, 'expected notification_queue_index row for the 30-day dpp reminder';

  RAISE NOTICE 'PASS';
END $$;
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_shadow_dpp.sql
```

Esperado: a segunda asserção falha (`notification_queue_index` vazio).

- [ ] **Step 3: Escrever a migration**

```sql
-- packages/supabase/supabase/migrations/20260805100008_shadow_write_dpp_reminders.sql

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

      PERFORM public.enqueue_notification(
        'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
        'patient', patient_record.id, 0, '30_days'
      );
    END IF;

    IF patient_record.due_date - CURRENT_DATE = 15 THEN
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 15))
      ON CONFLICT DO NOTHING;

      PERFORM public.enqueue_notification(
        'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
        'patient', patient_record.id, 0, '15_days'
      );
    END IF;

    IF patient_record.due_date - CURRENT_DATE = 7 THEN
      INSERT INTO public.scheduled_notifications
        (notification_type, reference_id, reference_type, scheduled_for, payload)
      VALUES
        ('dpp_approaching', patient_record.id, 'patient',
         CURRENT_DATE::timestamptz + INTERVAL '8 hours',
         jsonb_build_object('patient_name', patient_record.name, 'days_until_dpp', 7))
      ON CONFLICT DO NOTHING;

      PERFORM public.enqueue_notification(
        'push_notifications', 'dpp_approaching', 'patient', patient_record.id,
        'patient', patient_record.id, 0, '7_days'
      );
    END IF;
  END LOOP;
END;
$$;
```

Nota: o `recipient_id` usado acima é o `patients.id`, não `patients.user_id` — a Task 8 (rota worker)
já busca `patients.user_id` a partir do `reference_id` (que também é `patients.id`) antes de enviar,
então isso é consistente com o que o worker espera.

- [ ] **Step 4: Aplicar e verificar**

```bash
pnpm --filter @ventre/supabase db:reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /tmp/verify_shadow_dpp.sql
```

Esperado: `NOTICE: PASS`.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260805100008_shadow_write_dpp_reminders.sql
git commit -m "feat(whatsapp): dual-write dpp reminders to pgmq (shadow mode)"
```

---

### Task 12: Verificação manual ponta a ponta

**Files:** nenhum arquivo novo — só validação do que já foi construído.

**Interfaces:** nenhuma nova; exercita a integração completa das Tasks 1-11.

- [ ] **Step 1: Resetar o banco local do zero, aplicando todas as migrations em ordem**

```bash
pnpm --filter @ventre/supabase db:reset
```

- [ ] **Step 2: Subir o dev server**

```bash
pnpm --filter web dev
```

- [ ] **Step 3: Criar uma consulta de teste que dispare o shadow-write real**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  DO \$\$
  DECLARE
    v_professional_id uuid;
    v_patient_id uuid;
  BEGIN
    INSERT INTO public.users (id, email, name, user_type)
    VALUES (gen_random_uuid(), 'e2e-test@example.com', 'Profissional E2E', 'profissional')
    RETURNING id INTO v_professional_id;

    INSERT INTO public.patients (id, name, phone, created_by, user_id)
    VALUES (gen_random_uuid(), 'Paciente E2E', '(11) 98888-0000', v_professional_id, v_professional_id)
    RETURNING id INTO v_patient_id;

    INSERT INTO public.appointments (patient_id, professional_id, date, time, type, status)
    VALUES (v_patient_id, v_professional_id, CURRENT_DATE, (CURRENT_TIME + INTERVAL '90 seconds')::time, 'consulta', 'agendada');
  END \$\$;
"
```

(Usamos `user_id = v_professional_id` na paciente só pra ter um `user_id` válido de teste — em dados
reais a paciente teria seu próprio usuário.)

- [ ] **Step 4: Confirmar que o dual-write aconteceu nos dois caminhos**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT notification_type, scheduled_for FROM public.scheduled_notifications ORDER BY scheduled_for;
"
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT notification_type, dedup_key FROM public.notification_queue_index ORDER BY dedup_key;
"
```

Esperado: linhas correspondentes nos dois (o lembrete de 1 hora, já que a consulta é quase agora — o
de 1 dia não é agendado porque a consulta é hoje).

- [ ] **Step 5: Forçar o delay a zero e rodar o worker manualmente**

Como o teste E2E não pode esperar o delay real do lembrete de 1 hora, ajuste a visibilidade da
mensagem na fila diretamente antes de chamar o worker:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  SELECT pgmq.set_vt('push_notifications', msg_id, 0)
  FROM public.notification_queue_index
  WHERE notification_type = 'appointment_reminder';
"

curl -s -H "Authorization: Bearer local-dev-secret" \
  http://localhost:3000/api/cron/process-notification-queues | jq .
```

Esperado: `push.sent` ou `push.skipped` maior que zero (será `skipped` se as credenciais do Firebase
não estiverem configuradas localmente — nesse caso `sendNotificationToUser` deve lançar erro tratado,
não travar a rota; confirme no log do dev server que o erro foi capturado e classificado, não que
subiu sem tratamento).

- [ ] **Step 6: Confirmar que a fila foi drenada**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "SELECT count(*) FROM pgmq.q_push_notifications;"
```

Esperado: `0` (mensagem foi `ack`ada ou dead-lettered, não ficou presa).

- [ ] **Step 7: Limpar os dados de teste**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
  DELETE FROM public.appointments WHERE professional_id IN (
    SELECT id FROM public.users WHERE email IN ('e2e-test@example.com')
  );
  DELETE FROM public.patients WHERE created_by IN (
    SELECT id FROM public.users WHERE email IN ('e2e-test@example.com')
  );
  DELETE FROM public.users WHERE email = 'e2e-test@example.com';
"
```

Nenhum commit nesta task — é uma validação, não produz arquivo novo.

---

## O que fica fora deste plano (fases futuras, spec já documenta)

- Client Meta Cloud API, `templates.ts`, `sendWhatsAppToUser`, e as 9 mensagens action-triggered (Fase 2).
- As 15 mensagens trigger/cron-based além de `appointment_reminder`/`dpp_approaching` (Fase 3).
- Webhook inbound (Fase 4).
- Corte do pipeline antigo (`scheduled_notifications`, `installments_scheduled_notifications`, Edge
  Function `process-notifications`, cron de billing do `vercel.json`) e limpeza (Fase 5) — só depois de
  um período de operação estável validando o shadow mode construído aqui.
