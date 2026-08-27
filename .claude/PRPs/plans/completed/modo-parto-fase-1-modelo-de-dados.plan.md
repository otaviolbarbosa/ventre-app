# Feature: Modo Parto — Fase 1: Modelo de Dados & RLS

## Summary

Criar o schema de banco de dados e as políticas RLS para o Modo Parto: estado de ativação na gestação, tabelas de eventos únicos (bolsa rota) e múltiplos (contração, dilatação cervical, altura de apresentação/Lee, FCF, fluido amniótico, medicamentos). Todas as tabelas seguem o padrão append-only já usado em `patient_evolutions` e `ultrasounds`, com `patient_id` **denormalizado diretamente** em cada tabela (não resolvido via subquery a partir de `pregnancy_id`) para manter as políticas RLS baratas em tabelas de alta frequência de escrita (ex: contrações podem gerar dezenas de registros por hora).

## User Story

Como profissional da equipe de cuidado (doula, enfermeira, médica obstetra)
Eu quero que o Ventre tenha uma base de dados confiável e rápida para registrar eventos do parto em tempo real
Para que os registros do Modo Parto (Fases 2 em diante) tenham onde persistir com segurança e performance adequada durante trabalho de parto ativo

## Problem Statement

Hoje não existe nenhuma estrutura de dados no Ventre para capturar eventos de trabalho de parto ativo. Todo o registro é manual em papel (ver PRD). Sem essa base, nenhuma das fases seguintes (Realtime, UI de registro, notificação WhatsApp, finalização) pode ser construída.

## Solution Statement

Migrations Supabase que: (1) adicionam estado de ativação do Modo Parto à tabela `pregnancies`; (2) criam uma tabela de evento único para bolsa rota; (3) criam seis tabelas de evento múltiplo, uma por tipo de medição; (4) reaproveitam `is_team_member(patient_id)` para RLS em todas, com `patient_id` denormalizado via trigger para evitar o custo de resolução por subquery em tabelas de alta frequência; (5) adicionam índice composto em `team_members(patient_id, professional_id)` — pré-requisito de performance para o padrão de RLS em si, hoje ausente.

## Metadata

| Field             | Value                                                                 |
| ----------------- | ---------------------------------------------------------------------|
| Type              | NEW_CAPABILITY                                                       |
| Complexity        | MEDIUM                                                                |
| Systems Affected  | `packages/supabase/supabase/migrations`, `packages/supabase/src/types/database.types.ts` |
| Dependencies      | Supabase CLI (`pnpm db:push`, `pnpm db:types`) — nenhuma nova lib     |
| Estimated Tasks   | 11                                                                    |

---

## UX Design

Esta fase é puramente de banco de dados — não há UI. Não existe "Before/After" visual; o "before" é a ausência total de schema para o Modo Parto, o "after" é a base de dados pronta para a Fase 2 (Realtime) e Fase 4 (telas de registro) consumirem.

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| Banco de dados | Sem tabelas de evento de parto | Schema completo + RLS | Nenhum impacto direto ao usuário nesta fase — habilita as fases seguintes |

---

## Mandatory Reading

**CRITICAL: o agente de implementação DEVE ler estes arquivos antes de começar qualquer task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `packages/supabase/supabase/migrations/20260321000006_ultrasounds.sql` | all (107) | Padrão exato de tabela clínica estruturada com enum + RLS via `pregnancy_id` — vamos DESVIAR desse padrão (denormalizar `patient_id`), então precisa entender o que está sendo evitado e por quê |
| P0 | `packages/supabase/supabase/migrations/20260207000000_patient_evolutions.sql` | all | Padrão de tabela append-only (sem UPDATE/DELETE) — é o modelo direto para todas as novas tabelas de evento |
| P1 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 98-108 | Definição exata de `is_team_member(p_patient_id uuid)` |
| P1 | `packages/supabase/supabase/migrations/20260313000001_pregnancies_table.sql` | 13-81 | Schema atual de `pregnancies` + RLS existente, para a ALTER TABLE não conflitar |
| P2 | `packages/supabase/supabase/migrations/20260318000001_pregnancies_add_delivery_method.sql` | all | Exemplo mínimo de ALTER TABLE + enum, para a task de estado de ativação |
| P2 | `packages/supabase/supabase/migrations/20260302000003_subscriptions_table.sql` | 1-26 | Único exemplo no código de enum de estado com comentários inline documentando semântica de cada valor — modelo para o enum de efetividade de contração |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|--------------|
| [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) | "Call functions with select" / "Minimize joins" | `is_team_member(patient_id)` recebe argumento derivado de linha — não pode ser otimizado com `(select ...)`. Justifica a decisão de denormalizar `patient_id` em vez de resolver via `pregnancy_id` |
| [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) | "Add indexes" | Índice composto `team_members(patient_id, professional_id)` é o maior ganho de performance para o `EXISTS` interno de `is_team_member` — hoje não confirmado que existe |
| [Postgres Function Volatility](https://www.postgresql.org/docs/current/xfunc-volatility.html) | STABLE functions | `is_team_member` é STABLE — cache por argumento repetido dentro do mesmo statement, útil quando várias linhas do mesmo `patient_id` são inseridas em sequência (ex: várias medições de contração) |

---

## Patterns to Mirror

**ENUM_DEFINITION (schema-qualified, multi-line — padrão majoritário em migrations recentes):**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260321000006_ultrasounds.sql:6
CREATE TYPE public.doppler_result AS ENUM ('normal', 'abnormal', 'not_performed');
```

**ENUM_WITH_STATE_COMMENTS (para o campo de efetividade de contração, mais rico):**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260302000003_subscriptions_table.sql:1-5 (adaptado)
-- Efetiva: > 40s | Intermediária: 20-40s | Não efetiva: < 20s
CREATE TYPE public.birth_contraction_effectiveness AS ENUM ('efetiva', 'intermediaria', 'nao_efetiva');
```

**APPEND_ONLY_TABLE (sem UPDATE/DELETE policy — registros imutáveis):**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260207000000_patient_evolutions.sql (íntegra)
CREATE TABLE IF NOT EXISTS "public"."patient_evolutions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "patient_id" "uuid" NOT NULL,
    "professional_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."patient_evolutions"
    ADD CONSTRAINT "patient_evolutions_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."patient_evolutions"
    ADD CONSTRAINT "patient_evolutions_patient_id_fkey"
    FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."patient_evolutions"
    ADD CONSTRAINT "patient_evolutions_professional_id_fkey"
    FOREIGN KEY ("professional_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;

ALTER TABLE "public"."patient_evolutions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View patient evolutions" ON "public"."patient_evolutions"
    FOR SELECT USING (
        "public"."is_team_member"("patient_id")
        OR EXISTS (
            SELECT 1 FROM "public"."patients"
            WHERE "patients"."id" = "patient_evolutions"."patient_id"
            AND "patients"."user_id" = "auth"."uid"()
        )
    );

CREATE POLICY "Create patient evolutions" ON "public"."patient_evolutions"
    FOR INSERT WITH CHECK (
        "public"."is_team_member"("patient_id")
    );

GRANT ALL ON TABLE "public"."patient_evolutions" TO "anon";
GRANT ALL ON TABLE "public"."patient_evolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."patient_evolutions" TO "service_role";
```

**IS_TEAM_MEMBER_FUNCTION (reaproveitar, não recriar):**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260126012100_remote_schema.sql:98-108
CREATE OR REPLACE FUNCTION "public"."is_team_member"("p_patient_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  select exists (
    select 1 from public.team_members
    where patient_id = p_patient_id
    and professional_id = auth.uid()
  );
$$;
```

**MIGRATION_FILENAME_CONVENTION:**
```
// SOURCE: 5 migrations mais recentes em packages/supabase/supabase/migrations/
20260817000001_contracts_add_revocation.sql
20260818000001_contracts_finalized_document.sql
20260819000001_contracts_finalized_content_hash.sql
20260820000001_sync_billing_from_installments_trigger.sql
20260821000001_patient_invite_links_add_status.sql
```
Padrão: `YYYYMMDDHHMMSS_snake_case_description.sql`. As novas migrations desta fase usarão `20260822000001` em diante (dia seguinte ao último existente).

**PREGNANCIES_ALTER_PATTERN:**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260318000001_pregnancies_add_delivery_method.sql (íntegra)
CREATE TYPE delivery_method AS ENUM ('cesarean', 'vaginal');

ALTER TABLE public.pregnancies
  ADD COLUMN delivery_method delivery_method NULL;
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `packages/supabase/supabase/migrations/20260822000001_team_members_add_composite_index.sql` | CREATE | Índice composto `(patient_id, professional_id)` — pré-requisito de performance para `is_team_member` em tabelas de alta escrita |
| `packages/supabase/supabase/migrations/20260822000002_pregnancies_add_birth_mode_state.sql` | CREATE | Estado de ativação do Modo Parto (`birth_mode_active`, `birth_mode_activated_at`, `birth_mode_activated_by`, `birth_mode_ended_at`) — cobre "Registro de entrada em fase ativa" do PRD |
| `packages/supabase/supabase/migrations/20260822000003_birth_mode_patient_id_trigger_fn.sql` | CREATE | Função de trigger reutilizável `set_patient_id_from_pregnancy()` — popula `patient_id` a partir de `pregnancy_id` no INSERT, evitando resolução por subquery na RLS |
| `packages/supabase/supabase/migrations/20260822000004_birth_membrane_ruptures.sql` | CREATE | Evento único: bolsa rota |
| `packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql` | CREATE | Evento múltiplo: contração, com efetividade calculada via generated column |
| `packages/supabase/supabase/migrations/20260822000006_birth_cervical_dilations.sql` | CREATE | Evento múltiplo: dilatação cervical (cm) |
| `packages/supabase/supabase/migrations/20260822000007_birth_fetal_stations.sql` | CREATE | Evento múltiplo: altura da apresentação (Lee, -4 a +4) |
| `packages/supabase/supabase/migrations/20260822000008_birth_fetal_heart_rates.sql` | CREATE | Evento múltiplo: FCF (bpm) |
| `packages/supabase/supabase/migrations/20260822000009_birth_amniotic_fluid_records.sql` | CREATE | Evento múltiplo: fluido amniótico (enum) |
| `packages/supabase/supabase/migrations/20260822000010_birth_medication_administrations.sql` | CREATE | Evento múltiplo: administração de medicamentos (enum) |
| `packages/supabase/src/types/database.types.ts` | UPDATE (gerado) | Regenerado via `pnpm db:types` — não editar manualmente |

---

## NOT Building (Scope Limits)

- **Realtime subscriptions** — Fase 2, spike técnico separado.
- **UI/formulários de registro** — Fase 4.
- **Notificação WhatsApp de ativação** — Fase 3.
- **Barra de status persistente / redirect automático** — Fase 5.
- **Extensão do `finish-care-modal.tsx`** — Fase 6.
- **Tabela separada para "entrada em fase ativa"** — modelado como estado direto em `pregnancies` (ativação = entrada em fase ativa), não como tabela de evento própria, já que é 1:1 com a ativação do Modo Parto.
- **Bloqueio de edição concorrente** — só o alerta de medição recente (<30 min) será implementado, na Fase 4 (lógica de leitura na UI/action), não como constraint de banco nesta fase.

---

## Step-by-Step Tasks

Executar em ordem. Cada task é atômica e verificável.

### Task 1: CREATE `packages/supabase/supabase/migrations/20260822000001_team_members_add_composite_index.sql`

- **ACTION**: Adicionar índice composto em `team_members`
- **IMPLEMENT**:
  ```sql
  CREATE INDEX IF NOT EXISTS team_members_patient_id_professional_id_idx
    ON public.team_members (patient_id, professional_id);
  ```
- **MIRROR**: convenção de índice `IF NOT EXISTS` — checar `pregnancies_table.sql:28-29` para o padrão de nomenclatura `<table>_<col>_idx`
- **GOTCHA**: confirmar antes (via `mcp__supabase__list_tables` ou `\d team_members` local) que esse índice ainda não existe — se existir com ordem de colunas diferente (`professional_id, patient_id`), este índice pode ser redundante para o caso de uso do `is_team_member` (que filtra por `patient_id` primeiro)
- **VALIDATE**: `pnpm db:push` aplica sem erro; `mcp__supabase__list_tables` ou `EXPLAIN ANALYZE SELECT ... FROM team_members WHERE patient_id = '...'` confirma uso do índice

### Task 2: CREATE `packages/supabase/supabase/migrations/20260822000002_pregnancies_add_birth_mode_state.sql`

- **ACTION**: ALTER TABLE `pregnancies` — adicionar estado do Modo Parto
- **IMPLEMENT**:
  ```sql
  ALTER TABLE public.pregnancies
    ADD COLUMN birth_mode_active boolean NOT NULL DEFAULT false,
    ADD COLUMN birth_mode_activated_at timestamptz,
    ADD COLUMN birth_mode_activated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN birth_mode_ended_at timestamptz;

  CREATE INDEX IF NOT EXISTS pregnancies_birth_mode_active_idx
    ON public.pregnancies (birth_mode_active) WHERE birth_mode_active = true;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260318000004_pregnancies_add_created_by.sql:7-9` (ALTER TABLE + FK a `users`)
- **GOTCHA**: `birth_mode_activated_at` registra "entrada em fase ativa, data e hora" — junto com `birth_mode_activated_by` cobre exatamente o requisito do PRD ("Registro de entrada em fase ativa: data e hora, id_profissional") sem precisar de tabela própria. RLS de UPDATE já existe em `pregnancies` (herdada) — não precisa de nova policy
- **VALIDATE**: `pnpm db:push` && `pnpm db:types` — conferir que `Tables<"pregnancies">` inclui os 4 novos campos

### Task 3: CREATE `packages/supabase/supabase/migrations/20260822000003_birth_mode_patient_id_trigger_fn.sql`

- **ACTION**: Criar função de trigger reutilizável para popular `patient_id` a partir de `pregnancy_id`
- **IMPLEMENT**:
  ```sql
  CREATE OR REPLACE FUNCTION public.set_patient_id_from_pregnancy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
  BEGIN
    SELECT patient_id INTO NEW.patient_id
    FROM public.pregnancies
    WHERE id = NEW.pregnancy_id;

    IF NEW.patient_id IS NULL THEN
      RAISE EXCEPTION 'pregnancy_id % não corresponde a nenhuma gestação válida', NEW.pregnancy_id;
    END IF;

    RETURN NEW;
  END;
  $$;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260313000001_pregnancies_table.sql:32-39` (padrão de trigger function `plpgsql` já usado no projeto, ex. `handle_pregnancies_updated_at`)
- **IMPORTS**: N/A (SQL puro)
- **GOTCHA**: essa função será referenciada por um `BEFORE INSERT` trigger em cada uma das 7 tabelas de evento criadas nas Tasks 4-10 — não duplicar a lógica por tabela
- **VALIDATE**: `pnpm db:push` aplica sem erro; função aparece em `information_schema.routines`

### Task 4: CREATE `packages/supabase/supabase/migrations/20260822000004_birth_membrane_ruptures.sql`

- **ACTION**: Criar tabela de evento único — bolsa rota
- **IMPLEMENT**:
  ```sql
  CREATE TABLE public.birth_membrane_ruptures (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_membrane_ruptures_pkey PRIMARY KEY (id),
    CONSTRAINT birth_membrane_ruptures_pregnancy_id_key UNIQUE (pregnancy_id),
    CONSTRAINT birth_membrane_ruptures_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_membrane_ruptures_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_membrane_ruptures_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
  );

  CREATE INDEX birth_membrane_ruptures_patient_id_idx ON public.birth_membrane_ruptures (patient_id);
  CREATE INDEX birth_membrane_ruptures_pregnancy_id_idx ON public.birth_membrane_ruptures (pregnancy_id);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_membrane_ruptures
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_membrane_ruptures ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View membrane ruptures" ON public.birth_membrane_ruptures
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create membrane ruptures" ON public.birth_membrane_ruptures
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_membrane_ruptures TO anon;
  GRANT ALL ON TABLE public.birth_membrane_ruptures TO authenticated;
  GRANT ALL ON TABLE public.birth_membrane_ruptures TO service_role;
  ```
- **MIRROR**: `patient_evolutions.sql` (imutável, sem UPDATE/DELETE) + `UNIQUE (pregnancy_id)` para reforçar cardinalidade de evento único
- **GOTCHA**: `patient_id` é preenchido pelo trigger, não pela aplicação — a action da Fase 4 deve enviar apenas `pregnancy_id`, `professional_id`, `occurred_at`; se enviar `patient_id` manualmente ele será sobrescrito pelo trigger (comportamento esperado, mas documentar na Fase 4)
- **VALIDATE**: `pnpm db:push` && insert de teste via SQL editor confirmando que `patient_id` é preenchido automaticamente e que um segundo INSERT com o mesmo `pregnancy_id` falha por violação de UNIQUE

### Task 5: CREATE `packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql`

- **ACTION**: Criar tabela de evento múltiplo — contração, com efetividade calculada
- **IMPLEMENT**:
  ```sql
  CREATE TYPE public.birth_contraction_effectiveness AS ENUM ('efetiva', 'intermediaria', 'nao_efetiva');
  -- Efetiva: > 40s | Intermediária: 20-40s | Não efetiva: < 20s

  CREATE TABLE public.birth_contractions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    duration_seconds smallint NOT NULL CHECK (duration_seconds > 0),
    effectiveness public.birth_contraction_effectiveness GENERATED ALWAYS AS (
      CASE
        WHEN duration_seconds > 40 THEN 'efetiva'::public.birth_contraction_effectiveness
        WHEN duration_seconds >= 20 THEN 'intermediaria'::public.birth_contraction_effectiveness
        ELSE 'nao_efetiva'::public.birth_contraction_effectiveness
      END
    ) STORED,
    measured_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_contractions_pkey PRIMARY KEY (id),
    CONSTRAINT birth_contractions_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_contractions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_contractions_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
  );

  CREATE INDEX birth_contractions_patient_id_idx ON public.birth_contractions (patient_id);
  CREATE INDEX birth_contractions_pregnancy_id_measured_at_idx ON public.birth_contractions (pregnancy_id, measured_at DESC);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_contractions
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_contractions ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View contractions" ON public.birth_contractions
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create contractions" ON public.birth_contractions
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_contractions TO anon;
  GRANT ALL ON TABLE public.birth_contractions TO authenticated;
  GRANT ALL ON TABLE public.birth_contractions TO service_role;
  ```
- **MIRROR**: `ultrasounds.sql` para enum + tabela no mesmo arquivo; `GENERATED ALWAYS AS ... STORED` é padrão Postgres nativo, sem precedente direto no código mas consistente com o estilo declarativo das migrations existentes
- **GOTCHA**: classificação de efetividade fica garantida no banco (fonte única de verdade), evitando duplicar os limiares clínicos (40s/20s) na aplicação — mas isso significa que qualquer mudança de limiar clínico exige nova migration, não apenas mudança de código. Índice `(pregnancy_id, measured_at DESC)` otimiza a query de "última medição nos últimos 30 min" que a Fase 4 vai precisar para o alerta de duplicidade
- **VALIDATE**: `pnpm db:push` && insert de teste com `duration_seconds = 45` confirma `effectiveness = 'efetiva'`; `duration_seconds = 25` confirma `'intermediaria'`; `duration_seconds = 10` confirma `'nao_efetiva'`

### Task 6: CREATE `packages/supabase/supabase/migrations/20260822000006_birth_cervical_dilations.sql`

- **ACTION**: Criar tabela de evento múltiplo — dilatação cervical
- **IMPLEMENT**:
  ```sql
  CREATE TABLE public.birth_cervical_dilations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    dilation_cm numeric(3,1) NOT NULL CHECK (dilation_cm >= 0 AND dilation_cm <= 10),
    measured_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_cervical_dilations_pkey PRIMARY KEY (id),
    CONSTRAINT birth_cervical_dilations_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_cervical_dilations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_cervical_dilations_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
  );

  CREATE INDEX birth_cervical_dilations_patient_id_idx ON public.birth_cervical_dilations (patient_id);
  CREATE INDEX birth_cervical_dilations_pregnancy_id_measured_at_idx ON public.birth_cervical_dilations (pregnancy_id, measured_at DESC);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_cervical_dilations
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_cervical_dilations ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View cervical dilations" ON public.birth_cervical_dilations
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create cervical dilations" ON public.birth_cervical_dilations
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_cervical_dilations TO anon;
  GRANT ALL ON TABLE public.birth_cervical_dilations TO authenticated;
  GRANT ALL ON TABLE public.birth_cervical_dilations TO service_role;
  ```
- **MIRROR**: mesmo padrão da Task 5 (sem enum, apenas numeric com CHECK)
- **GOTCHA**: PRD especifica aferição a cada 30 minutos — isso é uma regra de UX/negócio da Fase 4 (lembrete/cadência), não uma constraint de banco; não adicionar `CHECK` de intervalo temporal aqui
- **VALIDATE**: `pnpm db:push`; insert com `dilation_cm = 10.5` deve falhar (CHECK); `dilation_cm = 4.5` deve funcionar

### Task 7: CREATE `packages/supabase/supabase/migrations/20260822000007_birth_fetal_stations.sql`

- **ACTION**: Criar tabela de evento múltiplo — altura da apresentação (escala de Lee)
- **IMPLEMENT**:
  ```sql
  CREATE TABLE public.birth_fetal_stations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    station_lee smallint NOT NULL CHECK (station_lee >= -4 AND station_lee <= 4),
    measured_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_fetal_stations_pkey PRIMARY KEY (id),
    CONSTRAINT birth_fetal_stations_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_fetal_stations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_fetal_stations_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
  );

  CREATE INDEX birth_fetal_stations_patient_id_idx ON public.birth_fetal_stations (patient_id);
  CREATE INDEX birth_fetal_stations_pregnancy_id_measured_at_idx ON public.birth_fetal_stations (pregnancy_id, measured_at DESC);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_fetal_stations
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_fetal_stations ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View fetal stations" ON public.birth_fetal_stations
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create fetal stations" ON public.birth_fetal_stations
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_fetal_stations TO anon;
  GRANT ALL ON TABLE public.birth_fetal_stations TO authenticated;
  GRANT ALL ON TABLE public.birth_fetal_stations TO service_role;
  ```
- **MIRROR**: mesmo padrão da Task 5/6
- **GOTCHA**: decisão de escopo do PRD já fixou escala de Lee (-4 a +4); não suportar a escala 0-5 do partograma clássico nesta fase (ver Decisions Log do PRD)
- **VALIDATE**: `pnpm db:push`; insert com `station_lee = 5` deve falhar (CHECK); `station_lee = -2` deve funcionar

### Task 8: CREATE `packages/supabase/supabase/migrations/20260822000008_birth_fetal_heart_rates.sql`

- **ACTION**: Criar tabela de evento múltiplo — FCF (frequência cardíaca fetal)
- **IMPLEMENT**:
  ```sql
  CREATE TABLE public.birth_fetal_heart_rates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    bpm smallint NOT NULL CHECK (bpm > 0 AND bpm < 300),
    measured_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_fetal_heart_rates_pkey PRIMARY KEY (id),
    CONSTRAINT birth_fetal_heart_rates_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_fetal_heart_rates_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_fetal_heart_rates_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
  );

  CREATE INDEX birth_fetal_heart_rates_patient_id_idx ON public.birth_fetal_heart_rates (patient_id);
  CREATE INDEX birth_fetal_heart_rates_pregnancy_id_measured_at_idx ON public.birth_fetal_heart_rates (pregnancy_id, measured_at DESC);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_fetal_heart_rates
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_fetal_heart_rates ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View fetal heart rates" ON public.birth_fetal_heart_rates
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create fetal heart rates" ON public.birth_fetal_heart_rates
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_fetal_heart_rates TO anon;
  GRANT ALL ON TABLE public.birth_fetal_heart_rates TO authenticated;
  GRANT ALL ON TABLE public.birth_fetal_heart_rates TO service_role;
  ```
- **MIRROR**: mesmo padrão da Task 5/6/7
- **GOTCHA**: essa é provavelmente a tabela de MAIOR frequência de escrita (FCF monitorado continuamente) — o índice `(pregnancy_id, measured_at DESC)` é crítico para a UI de histórico da Fase 4 não fazer table scan
- **VALIDATE**: `pnpm db:push`; insert com `bpm = 140` funciona; `bpm = 0` falha (CHECK)

### Task 9: CREATE `packages/supabase/supabase/migrations/20260822000009_birth_amniotic_fluid_records.sql`

- **ACTION**: Criar tabela de evento múltiplo — fluido amniótico
- **IMPLEMENT**:
  ```sql
  CREATE TYPE public.birth_amniotic_fluid_type AS ENUM ('intacto', 'com_sangue', 'claro', 'com_meconio');

  CREATE TABLE public.birth_amniotic_fluid_records (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    fluid_type public.birth_amniotic_fluid_type NOT NULL,
    measured_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_amniotic_fluid_records_pkey PRIMARY KEY (id),
    CONSTRAINT birth_amniotic_fluid_records_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_amniotic_fluid_records_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_amniotic_fluid_records_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
  );

  CREATE INDEX birth_amniotic_fluid_records_patient_id_idx ON public.birth_amniotic_fluid_records (patient_id);
  CREATE INDEX birth_amniotic_fluid_records_pregnancy_id_idx ON public.birth_amniotic_fluid_records (pregnancy_id);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_amniotic_fluid_records
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_amniotic_fluid_records ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View amniotic fluid records" ON public.birth_amniotic_fluid_records
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create amniotic fluid records" ON public.birth_amniotic_fluid_records
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_amniotic_fluid_records TO anon;
  GRANT ALL ON TABLE public.birth_amniotic_fluid_records TO authenticated;
  GRANT ALL ON TABLE public.birth_amniotic_fluid_records TO service_role;
  ```
- **GOTCHA**: nome do enum `birth_amniotic_fluid_type` propositalmente não colide com o enum já existente `amniotic_fluid_index` (`20260322000001_amniotic_fluid_index_enum.sql`) — são conceitos clínicos diferentes (índice de líquido amniótico via ultrassom vs. tipo de fluido observado no parto)
- **VALIDATE**: `pnpm db:push`; insert com `fluid_type = 'com_meconio'` funciona; valor fora do enum falha

### Task 10: CREATE `packages/supabase/supabase/migrations/20260822000010_birth_medication_administrations.sql`

- **ACTION**: Criar tabela de evento múltiplo — administração de medicamentos
- **IMPLEMENT**:
  ```sql
  CREATE TYPE public.birth_medication_type AS ENUM ('fluidos_intravenosos', 'ocitocina', 'analgesia', 'outros');

  CREATE TABLE public.birth_medication_administrations (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    medication_type public.birth_medication_type NOT NULL,
    notes text,
    administered_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_medication_administrations_pkey PRIMARY KEY (id),
    CONSTRAINT birth_medication_administrations_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_medication_administrations_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_medication_administrations_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
  );

  CREATE INDEX birth_medication_administrations_patient_id_idx ON public.birth_medication_administrations (patient_id);
  CREATE INDEX birth_medication_administrations_pregnancy_id_idx ON public.birth_medication_administrations (pregnancy_id);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_medication_administrations
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_medication_administrations ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View medication administrations" ON public.birth_medication_administrations
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create medication administrations" ON public.birth_medication_administrations
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_medication_administrations TO anon;
  GRANT ALL ON TABLE public.birth_medication_administrations TO authenticated;
  GRANT ALL ON TABLE public.birth_medication_administrations TO service_role;
  ```
- **GOTCHA**: `notes text` é opcional (não especificado explicitamente pelo PRD, mas útil para o "outros" — nome do medicamento livre); manter nullable
- **VALIDATE**: `pnpm db:push`; insert com `medication_type = 'ocitocina', notes = null` funciona

### Task 11: Regenerar tipos TypeScript

- **ACTION**: Rodar `pnpm db:types` após todas as migrations aplicadas
- **IMPLEMENT**: N/A — comando de geração
- **MIRROR**: instrução obrigatória do `CLAUDE.md`: "After writing migrations, always run `pnpm db:types`"
- **VALIDATE**: `git diff packages/supabase/src/types/database.types.ts` mostra `Row`/`Insert`/`Update`/`Relationships` para as 7 novas tabelas + 4 novas colunas em `pregnancies` + 3 novos enums (`birth_contraction_effectiveness`, `birth_amniotic_fluid_type`, `birth_medication_type`) no bloco `Enums`; `pnpm check-types` passa sem erro

---

## Testing Strategy

Não há suite de testes automatizados no repositório para migrations/RLS (confirmado via exploração — zero arquivos `*.test.ts` cobrindo banco). A validação desta fase é manual/SQL, via Supabase MCP ou SQL editor.

### Casos a validar manualmente

| Caso | Tabela | Validação |
|------|--------|-------------|
| Profissional da equipe consegue INSERT | qualquer tabela nova | `is_team_member(patient_id) = true` → insert sucede |
| Profissional fora da equipe NÃO consegue INSERT | qualquer tabela nova | `is_team_member(patient_id) = false` → insert falha por RLS |
| `patient_id` é preenchido automaticamente | todas as 7 tabelas | Insert enviando só `pregnancy_id` resulta em `patient_id` correto após trigger |
| Efetividade calculada corretamente | `birth_contractions` | 45s → `efetiva`; 25s → `intermediaria`; 10s → `nao_efetiva` |
| Constraint de evento único respeitada | `birth_membrane_ruptures` | Segundo insert com mesmo `pregnancy_id` falha |
| CHECK constraints respeitadas | `birth_cervical_dilations`, `birth_fetal_stations`, `birth_fetal_heart_rates` | Valores fora do range (dilatação >10, Lee fora de -4/+4, bpm ≤0 ou ≥300) falham |
| Nenhuma policy de UPDATE/DELETE existe | todas as 7 tabelas | Tentativa de UPDATE/DELETE por qualquer usuário falha (RLS não define essas policies → deny by default) |

### Edge Cases Checklist

- [ ] `pregnancy_id` inexistente → trigger lança exceção clara, não insere linha órfã
- [ ] Ativação de Modo Parto duas vezes na mesma gestação (reentrada) — comportamento não definido pelo PRD; documentar como TBD para Fase 4 (a coluna `birth_mode_active` permite reativação, mas não há histórico de múltiplas ativações nesta fase)
- [ ] Paciente sem nenhum `team_members` cadastrado tentando ativar Modo Parto — deve falhar por RLS ao tentar UPDATE em `pregnancies`

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros de tipo (confirma que `database.types.ts` regenerado é consistente com o resto do código)

### Level 4: DATABASE_VALIDATION

Usar Supabase MCP (`mcp__supabase__list_tables`, `mcp__supabase__execute_sql`, `mcp__supabase__get_advisors`) para verificar:

- [ ] As 7 novas tabelas existem com as colunas esperadas
- [ ] RLS habilitado em todas (`rowsecurity = true`)
- [ ] Policies de SELECT/INSERT presentes, UPDATE/DELETE ausentes
- [ ] `mcp__supabase__get_advisors` não reporta `unindexed_foreign_keys` para as novas tabelas nem `auth_rls_initplan` para as novas policies
- [ ] Índices `(pregnancy_id, measured_at DESC)` existem nas tabelas de alta frequência (contractions, cervical_dilations, fetal_stations, fetal_heart_rates)

### Level 6: MANUAL_VALIDATION

1. Aplicar migrations: `pnpm db:push`
2. Regenerar tipos: `pnpm db:types`
3. Via SQL editor do Supabase, autenticado como um profissional de equipe de teste: inserir um registro em cada uma das 7 tabelas usando apenas `pregnancy_id`, `professional_id` e o campo de valor — confirmar que `patient_id` aparece preenchido corretamente após o insert
4. Repetir os inserts autenticado como um profissional SEM vínculo na `team_members` da paciente de teste — confirmar que todos falham por RLS

---

## Acceptance Criteria

- [ ] 10 migrations criadas e aplicadas sem erro via `pnpm db:push`
- [ ] `pnpm db:types` gera tipos para as 7 novas tabelas + 4 colunas novas em `pregnancies` + 3 novos enums
- [ ] `pnpm check-types` passa sem erro
- [ ] RLS ativo em todas as 7 tabelas, restrito a `is_team_member(patient_id)`
- [ ] Nenhuma policy de UPDATE/DELETE nas tabelas de evento (imutabilidade garantida)
- [ ] Trigger de `patient_id` funcional em todas as 7 tabelas
- [ ] `birth_contractions.effectiveness` calculado corretamente pelos 3 limiares do PRD
- [ ] `mcp__supabase__get_advisors` sem alertas críticos novos relacionados a essas tabelas

---

## Completion Checklist

- [ ] Todas as 11 tasks completadas em ordem de dependência
- [ ] Cada task validada imediatamente após a conclusão
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 4: validação de banco (RLS, índices, advisors) passa
- [ ] Level 6: validação manual de insert/RLS passa para todas as 7 tabelas
- [ ] Todos os critérios de aceite atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| `is_team_member(patient_id)` avaliado por linha em tabelas de alta frequência (FCF, contrações) degrada performance de insert em lote | MEDIUM | MEDIUM | `patient_id` denormalizado evita o join extra via `pregnancies`; índice composto em `team_members` (Task 1) garante que o `EXISTS` interno seja lookup indexado, não scan |
| Trigger `set_patient_id_from_pregnancy` falha silenciosamente se `pregnancy_id` for nulo/inválido | LOW | HIGH | Trigger lança exceção explícita (`RAISE EXCEPTION`) em vez de deixar `patient_id` nulo — falha alta e visível, não silenciosa |
| Nome de enum `birth_amniotic_fluid_type` confundido com `amniotic_fluid_index` já existente | LOW | LOW | Nomenclatura já diferenciada nesta fase; documentado no GOTCHA da Task 9 |
| Limiares clínicos de efetividade de contração fixos no banco (40s/20s) exigem migration para mudar | LOW | MEDIUM | Aceito conscientemente — fonte única de verdade no banco é preferível a duplicar lógica na aplicação; revisão futura pode extrair para função configurável se necessário |

---

## Notes

- A decisão de **não** criar uma tabela separada para "entrada em fase ativa" (usando em vez disso colunas em `pregnancies`) é uma simplificação deliberada: a ativação do Modo Parto É o evento de entrada em fase ativa — são a mesma ocorrência, então não faz sentido modelar duas vezes.
- A Fase 2 (Realtime) vai precisar publicar mudanças na coluna `pregnancies.birth_mode_active` — vale considerar se o canal Realtime vai escutar `postgres_changes` na tabela `pregnancies` filtrada por `id=eq.<pregnancy_id>`, ou se faz mais sentido introduzir uma tabela de eventos de ativação dedicada para o Realtime observar de forma mais granular. Essa decisão fica para o spike da Fase 2, mas o schema desta fase já suporta ambas as abordagens sem alteração.
- O alerta de "medição duplicada em menos de 30 minutos" (regra de negócio do PRD) não foi implementado como constraint de banco — é uma leitura feita pela aplicação (Fase 4) usando os índices `(pregnancy_id, measured_at DESC)` já criados aqui.
