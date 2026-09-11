# Feature: Dinâmica Uterina — Schema e Migração (`birth_uterine_activity`)

## Summary

Criar a tabela `birth_uterine_activity` via migração Supabase, seguindo exatamente as convenções já estabelecidas para tabelas `birth_*` neste monorepo (mesma estrutura de `birth_contractions`, `birth_maternal_vitals`). Esta é a Fase 1 do PRD de dinâmica uterina: escopo estritamente de schema — nenhuma server action, modal ou UI é criada aqui. A tabela armazena registros em lote (quantidade de contrações, intervalo em minutos, array de durações) e um array de notações DU pré-calculadas, persistidas pela camada de aplicação (Fase 2/3), não por coluna gerada em SQL.

## User Story

As a médica obstetra ou enfermeira obstétrica
I want to que o sistema tenha uma tabela pronta para registrar dinâmica uterina em lote
So that os dados possam ser persistidos de forma imutável, auditável e compatível com o padrão obstétrico DU nas fases seguintes de implementação

## Problem Statement

Não existe hoje uma tabela que suporte o novo formato de registro em lote de dinâmica uterina (quantidade de contrações + intervalo fixo de 10/20/30 min + array de durações). A tabela `birth_contractions` existente modela apenas registro individual por contração e não deve ser alterada nem descartada.

## Solution Statement

Nova migração cria `public.birth_uterine_activity` mirrorando a estrutura de `birth_contractions`/`birth_maternal_vitals`: PK uuid, FKs para pregnancy/patient/professional (`ON DELETE CASCADE`), trigger `set_patient_id_before_insert` reaproveitando `set_patient_id_from_pregnancy()`, RLS com apenas políticas SELECT/INSERT via `is_team_member(patient_id)`, grants padrão, índices em `patient_id`, `professional_id` e `(pregnancy_id, measured_at DESC)`. Colunas de validação usam CHECK constraints (não enum/generated column, diferente de `birth_contractions.effectiveness`) porque a lógica de segmentação DU para intervalos de 20/30 min é multi-etapas e será implementada em TypeScript puro (Fase 3 do PRD), não em SQL. Uma migração de publicação realtime separada adiciona a tabela ao padrão já usado por todas as tabelas `birth_*` recentes.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY (schema-only slice)                 |
| Complexity       | LOW                                                 |
| Systems Affected | packages/supabase (migrations, generated types)    |
| Dependencies     | Supabase CLI, Postgres 15+ (remote project schema)  |
| Estimated Tasks  | 4                                                   |

---

## UX Design

Esta fase não tem UI. Nenhuma tela ou componente é afetado — apenas o schema do banco de dados. Os diagramas Before/After de UX serão produzidos nas fases de modal (Fase 4) e gráfico (Fase 7) do PRD.

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| N/A (schema only) | Tabela `birth_uterine_activity` não existe | Tabela existe, vazia, pronta para receber inserts nas próximas fases | Nenhum impacto visível ao usuário final nesta fase |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql` | all (~35 linhas) | Padrão de tabela `birth_*` a MIRRORAR exatamente (PK, FKs, trigger, RLS, grants, índices) |
| P0 | `packages/supabase/supabase/migrations/20260824000003_birth_maternal_vitals.sql` | all | Confirma o padrão com índice adicional em `professional_id` (mais recente que `birth_contractions`, deve ser a referência primária de estrutura) |
| P1 | `packages/supabase/supabase/migrations/20260822000003_birth_mode_patient_id_trigger_fn.sql` | all | Função de trigger `set_patient_id_from_pregnancy()` a REUTILIZAR (não recriar) |
| P1 | `packages/supabase/supabase/migrations/20260126012100_remote_schema.sql` | 98-107 | Função `is_team_member(p_patient_id uuid)` usada nas políticas RLS |
| P1 | `packages/supabase/supabase/migrations/20260823000005_birth_apgar_scores.sql` | linha 6 | Precedente de CHECK com conjunto fixo de valores (`minute IN (1,5,10,15,20)`) — mesma técnica para `interval_minutes IN (10,20,30)` |
| P2 | `packages/supabase/supabase/migrations/20260824000005_birth_new_tables_realtime_publication.sql` | all | Padrão exato de migração de publicação realtime a seguir para a nova tabela |
| P2 | `packages/supabase/supabase/migrations/20260829155433_extend_birth_contractions_pain_intensity.sql` | all | Exemplo de migração de extensão posterior (referência para futuras fases, não usado nesta fase) |
| P3 | `packages/supabase/package.json` | 11-18 | Scripts `db:push`/`db:types` — confirma que `db:types` lê do projeto Supabase remoto, não local |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [PostgreSQL Docs — Array Functions](https://www.postgresql.org/docs/current/functions-array.html) | `array_length()` | `array_length()` retorna `NULL` (não `0`) para array vazio — precisa de `COALESCE` na CHECK constraint que compara tamanho do array com `contraction_count` |
| [PostgreSQL Docs — Constraints §5.5](https://www.postgresql.org/docs/current/ddl-constraints.html) | CHECK constraints | Confirma que CHECK só falha em `FALSE`; `NULL` é tratado como satisfeito — motivo do gotcha acima |
| [PostgreSQL mailing list — validar elementos de array sem subquery](https://www.postgresql.org/message-id/532A1B97.4000902@dalibo.com) | uso de `ALL()`/`ANY()` | `unnest()` em subquery NÃO é permitido em CHECK constraint; usar `0 < ALL(durations_seconds)` em vez disso |

---

## Patterns to Mirror

**TABLE_STRUCTURE (fonte de verdade — mirrorar exatamente exceto pelas colunas de negócio):**

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260824000003_birth_maternal_vitals.sql
CREATE TABLE public.birth_maternal_vitals (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  -- ... colunas de negócio específicas do domínio ...
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT birth_maternal_vitals_pkey PRIMARY KEY (id),
  CONSTRAINT birth_maternal_vitals_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
  CONSTRAINT birth_maternal_vitals_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  CONSTRAINT birth_maternal_vitals_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
);

CREATE INDEX birth_maternal_vitals_patient_id_idx ON public.birth_maternal_vitals (patient_id);
CREATE INDEX birth_maternal_vitals_professional_id_idx ON public.birth_maternal_vitals (professional_id);
CREATE INDEX birth_maternal_vitals_pregnancy_id_measured_at_idx ON public.birth_maternal_vitals (pregnancy_id, measured_at DESC);

CREATE TRIGGER set_patient_id_before_insert
  BEFORE INSERT ON public.birth_maternal_vitals
  FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

ALTER TABLE public.birth_maternal_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View maternal vitals" ON public.birth_maternal_vitals
  FOR SELECT USING (public.is_team_member(patient_id));

CREATE POLICY "Create maternal vitals" ON public.birth_maternal_vitals
  FOR INSERT WITH CHECK (public.is_team_member(patient_id));

GRANT ALL ON TABLE public.birth_maternal_vitals TO anon;
GRANT ALL ON TABLE public.birth_maternal_vitals TO authenticated;
GRANT ALL ON TABLE public.birth_maternal_vitals TO service_role;
```

**FIXED_SET_CHECK_CONSTRAINT:**

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260823000005_birth_apgar_scores.sql:6
-- COPY THIS PATTERN for interval_minutes:
minute smallint NOT NULL CHECK (minute IN (1, 5, 10, 15, 20)),
```

**REALTIME_PUBLICATION_PATTERN:**

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260824000005_birth_new_tables_realtime_publication.sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_maternal_vitals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_urine_tests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_apgar_scores;
```

**LATER_EXTENSION_PATTERN (referência para futuras fases, não usado agora):**

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260829155433_extend_birth_contractions_pain_intensity.sql
CREATE TYPE public.birth_pain_intensity AS ENUM ('fraca', 'fraca_media', 'media', 'media_forte', 'forte');
ALTER TABLE public.birth_contractions ADD COLUMN pain_intensity public.birth_pain_intensity;
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `packages/supabase/supabase/migrations/20260831000000_birth_uterine_activity.sql` | CREATE | Migração principal: tabela, índices, trigger, RLS, grants |
| `packages/supabase/supabase/migrations/20260831000001_birth_uterine_activity_realtime_publication.sql` | CREATE | Migração separada para publicação realtime, seguindo o padrão de migrações dedicadas já usado |
| `packages/supabase/src/types/database.types.ts` | UPDATE (gerado) | Regenerado automaticamente via `pnpm db:types` após push da migração — não editar manualmente |

---

## NOT Building (Scope Limits)

- Server action, schema Zod, modal ou componente de gráfico — ficam para as Fases 2-8 do PRD.
- Coluna gerada (`GENERATED ALWAYS AS`) para a notação DU em SQL — a lógica de segmentação para intervalos de 20/30 min é multi-etapas (fatiar o array de durações em blocos de 10 min) e será implementada como função pura TypeScript na Fase 3 do PRD; a tabela armazena o resultado já calculado (`du_notations text[]`), não o computa em SQL.
- Alteração em `birth_contractions` ou qualquer tabela existente — tabela nova e independente, conforme requisito explícito do PRD.
- Alteração na exportação de PDF do partograma (`partograph-overlay-svg.ts`) — fora de escopo desta fase e do PRD como um todo.

---

## Step-by-Step Tasks

Execute em ordem. Cada tarefa é atômica e verificável independentemente.

### Task 1: CREATE `packages/supabase/supabase/migrations/20260831000000_birth_uterine_activity.sql`

- **ACTION**: CREATE nova migração com a tabela `birth_uterine_activity`
- **IMPLEMENT**: Mirrorar exatamente a estrutura de `birth_maternal_vitals` (ver PATTERN acima), substituindo as colunas de negócio por:
  ```sql
  CREATE TABLE public.birth_uterine_activity (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    interval_minutes smallint NOT NULL CHECK (interval_minutes IN (10, 20, 30)),
    contraction_count smallint NOT NULL CHECK (
      contraction_count >= 0 AND contraction_count <= (interval_minutes / 10) * 6
    ),
    durations_seconds smallint[] NOT NULL CHECK (0 < ALL (durations_seconds)),
    du_notations text[] NOT NULL,
    measured_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_uterine_activity_pkey PRIMARY KEY (id),
    CONSTRAINT birth_uterine_activity_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_uterine_activity_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_uterine_activity_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT birth_uterine_activity_durations_length_matches_count CHECK (
      COALESCE(array_length(durations_seconds, 1), 0) = contraction_count
    )
  );

  CREATE INDEX birth_uterine_activity_patient_id_idx ON public.birth_uterine_activity (patient_id);
  CREATE INDEX birth_uterine_activity_professional_id_idx ON public.birth_uterine_activity (professional_id);
  CREATE INDEX birth_uterine_activity_pregnancy_id_measured_at_idx ON public.birth_uterine_activity (pregnancy_id, measured_at DESC);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_uterine_activity
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_uterine_activity ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View uterine activity" ON public.birth_uterine_activity
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create uterine activity" ON public.birth_uterine_activity
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_uterine_activity TO anon;
  GRANT ALL ON TABLE public.birth_uterine_activity TO authenticated;
  GRANT ALL ON TABLE public.birth_uterine_activity TO service_role;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260824000003_birth_maternal_vitals.sql` (estrutura completa) + `20260823000005_birth_apgar_scores.sql:6` (CHECK de conjunto fixo)
- **GOTCHA 1**: `array_length(durations_seconds, 1)` retorna `NULL` (não `0`) para array vazio — a constraint `birth_uterine_activity_durations_length_matches_count` usa `COALESCE(..., 0)` para evitar que um array vazio com `contraction_count > 0` passe silenciosamente pela validação (CHECK só falha em `FALSE`; `NULL` é tratado como satisfeito).
- **GOTCHA 2**: `unnest()` dentro de subquery NÃO é permitido em CHECK constraint — usar `0 < ALL(durations_seconds)` (sintaxe de array direta), não uma subquery com `SELECT unnest(...)`.
- **GOTCHA 3**: `du_notations` é `text[] NOT NULL` sem CHECK de tamanho — o número de notações varia (1 notação se `interval_minutes = 10`, até 3 se `interval_minutes = 30`) e é calculado/validado pela camada de aplicação (Fase 2/3), não pelo schema, pois depende da mesma lógica de segmentação usada para `durations_seconds`.
- **GOTCHA 4**: NÃO reutilizar ou modificar `birth_contractions` — esta é uma tabela nova e totalmente independente.
- **VALIDATE**: `cat packages/supabase/supabase/migrations/20260831000000_birth_uterine_activity.sql` — revisar visualmente contra o template acima; nenhum comando de compilação aplicável a SQL puro nesta etapa (validação real ocorre no Task 3 via `db:push`)

### Task 2: CREATE `packages/supabase/supabase/migrations/20260831000001_birth_uterine_activity_realtime_publication.sql`

- **ACTION**: CREATE migração dedicada para publicação realtime
- **IMPLEMENT**:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_uterine_activity;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260824000005_birth_new_tables_realtime_publication.sql` (padrão exato — uma linha por tabela, migração separada)
- **GOTCHA**: Deve ser um arquivo de migração distinto do Task 1 (timestamp posterior), seguindo o padrão observado de que a criação da tabela e a publicação realtime sempre ficam em migrações separadas neste codebase.
- **VALIDATE**: `cat packages/supabase/supabase/migrations/20260831000001_birth_uterine_activity_realtime_publication.sql`

### Task 3: APPLY migração ao projeto Supabase remoto

- **ACTION**: RUN `pnpm db:push` a partir de `packages/supabase` (ou raiz do monorepo, conforme configuração do turbo)
- **IMPLEMENT**: Nenhuma alteração de código — apenas execução do comando que aplica as migrações pendentes ao projeto Supabase referenciado por `NEXT_PUBLIC_SUPABASE_PROJECCT_ID` em `apps/web/.env.local`
- **MIRROR**: `packages/supabase/package.json:11` (`"db:push": "supabase db push"`)
- **GOTCHA**: `db:types` (Task 4) lê o schema do projeto **remoto**, não de uma instância local — a migração precisa estar de fato aplicada ao projeto remoto antes da regeneração de tipos funcionar; rodar `db:push` sem confirmar que apontou para o projeto correto pode aplicar a migração no ambiente errado — confirmar `NEXT_PUBLIC_SUPABASE_PROJECCT_ID` antes de executar.
- **VALIDATE**: Verificar via Supabase MCP ou `supabase db diff` que a tabela `birth_uterine_activity` existe no projeto remoto com as colunas/constraints esperadas

### Task 4: REGENERATE tipos TypeScript

- **ACTION**: RUN `pnpm db:types`
- **IMPLEMENT**: Nenhuma alteração manual — comando regenera `packages/supabase/src/types/database.types.ts` a partir do schema remoto atualizado
- **MIRROR**: `packages/supabase/package.json:16`, conforme instruído em `CLAUDE.md`: "After writing migrations, always run `pnpm db:types` to keep `database.types.ts` in sync"
- **GOTCHA**: Requer que o Task 3 (`db:push`) já tenha sido executado com sucesso contra o projeto remoto correto — caso contrário a tabela nova não aparecerá no arquivo gerado.
- **VALIDATE**: `grep -A 30 "birth_uterine_activity:" packages/supabase/src/types/database.types.ts` — confirmar que `Row`/`Insert`/`Update` incluem `contraction_count`, `interval_minutes`, `durations_seconds: number[]`, `du_notations: string[]`; em seguida `pnpm check-types` na raiz do monorepo para confirmar que nada quebrou

---

## Testing Strategy

### Unit Tests to Write

Nenhum teste unitário de código aplicável nesta fase — é uma migração SQL pura. A validação é feita via inspeção do schema aplicado (Task 3) e dos tipos gerados (Task 4).

### Edge Cases Checklist

- [ ] Insert com `durations_seconds = '{}'` e `contraction_count = 0` → deve SUCEDER (array vazio, contagem zero, consistente)
- [ ] Insert com `durations_seconds = '{}'` e `contraction_count = 3` → deve FALHAR (constraint `birth_uterine_activity_durations_length_matches_count`, graças ao `COALESCE`)
- [ ] Insert com `interval_minutes = 15` (valor fora do conjunto permitido) → deve FALHAR (`CHECK (interval_minutes IN (10, 20, 30))`)
- [ ] Insert com `contraction_count = 7` e `interval_minutes = 10` (acima do máximo de 6/10min) → deve FALHAR
- [ ] Insert com `contraction_count = 13` e `interval_minutes = 20` (acima do máximo de 12/20min) → deve FALHAR
- [ ] Insert com algum elemento de `durations_seconds` igual a `0` ou negativo → deve FALHAR (`CHECK (0 < ALL(durations_seconds))`)
- [ ] Insert sem ser team member do paciente → deve FALHAR por RLS (`is_team_member`)
- [ ] `pregnancy_id` inválido (não corresponde a gestação existente) → deve FALHAR via `RAISE EXCEPTION` do trigger `set_patient_id_from_pregnancy`
- [ ] DELETE de uma pregnancy → deve fazer CASCADE corretamente em `birth_uterine_activity` (mesmo comportamento das demais tabelas `birth_*`)

Estes casos devem ser verificados manualmente via SQL (`INSERT INTO ...`) contra o projeto Supabase local/staging antes de considerar a fase concluída, e reconfirmados via testes de integração da server action na Fase 2 do PRD.

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros — `database.types.ts` regenerado deve compilar sem quebrar nenhum consumidor existente.

### Level 4: DATABASE_VALIDATION (aplicável a esta fase)

Usar Supabase MCP ou `psql`/SQL Editor para verificar:

- [ ] Tabela `birth_uterine_activity` criada com todas as colunas esperadas
- [ ] Todas as CHECK constraints presentes e funcionando (testar os edge cases acima)
- [ ] RLS habilitado, políticas "View uterine activity" e "Create uterine activity" presentes
- [ ] Trigger `set_patient_id_before_insert` presente e funcional
- [ ] Índices criados (`patient_id`, `professional_id`, `(pregnancy_id, measured_at DESC)`)
- [ ] Tabela adicionada à publicação `supabase_realtime`
- [ ] Grants para `anon`, `authenticated`, `service_role` presentes

### Level 5/6: N/A nesta fase

Sem UI ou fluxo end-to-end nesta fase — validação manual via banco de dados é suficiente.

---

## Acceptance Criteria

- [ ] Migração `20260831000000_birth_uterine_activity.sql` criada e aplicada com sucesso
- [ ] Migração `20260831000001_birth_uterine_activity_realtime_publication.sql` criada e aplicada com sucesso
- [ ] `database.types.ts` regenerado inclui `birth_uterine_activity` com os 4 campos de negócio corretos
- [ ] `pnpm check-types` passa sem erros
- [ ] Todos os edge cases da checklist testados manualmente contra o schema aplicado
- [ ] `birth_contractions` permanece inalterada
- [ ] Estrutura da nova tabela mirrora fielmente o padrão de `birth_maternal_vitals`/`birth_contractions` (nomenclatura de constraints, políticas RLS, grants)

---

## Completion Checklist

- [ ] Task 1-4 completadas em ordem de dependência
- [ ] Level 1 (static analysis) passa
- [ ] Level 4 (database validation) passa, incluindo todos os edge cases
- [ ] Todos os critérios de aceite atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| `array_length()` retorna `NULL` para array vazio, permitindo inserts inconsistentes passarem pela constraint | MEDIUM | MEDIUM | Uso explícito de `COALESCE(array_length(durations_seconds, 1), 0)` na constraint, testado no edge case checklist |
| `db:types` executado antes do `db:push` terminar de propagar no projeto remoto, gerando tipos desatualizados | LOW | MEDIUM | Confirmar via Supabase MCP/dashboard que a tabela existe no projeto remoto antes de rodar `db:types` |
| Migração aplicada ao projeto Supabase errado (dev vs. produção) por `.env.local` apontando para ambiente incorreto | LOW | HIGH | Confirmar `NEXT_PUBLIC_SUPABASE_PROJECCT_ID` em `apps/web/.env.local` antes de rodar `db:push` |
| `du_notations text[]` sem validação de schema fica dessincronizado de `durations_seconds` se a lógica de segmentação (Fase 3, TS) tiver bug | MEDIUM | LOW | Fora do escopo desta fase; mitigado nas Fases 2/3 com testes unitários da função de segmentação usando os exemplos numéricos do próprio requisito (`prompts/019-uterine-activity.md`) |

---

## Notes

- A decisão de **não** usar uma coluna `GENERATED ALWAYS AS` para a notação DU (diferente do padrão `effectiveness` em `birth_contractions`) é deliberada: a segmentação de um registro de 20/30 min em múltiplas notações de 10 min (ver exemplo no requisito original, linha 19: "5 contrações em 20 minutos... deve exibir `DU 3/10'/27"` e `DU 2/10'/41"`") não é expressável de forma direta e legível em SQL puro — será uma função TypeScript pura testada isoladamente na Fase 3 do PRD, e o resultado será persistido como `du_notations text[]` pela server action da Fase 2.
- `contraction_count <= (interval_minutes / 10) * 6` funciona corretamente em SQL porque `interval_minutes` só assume 10, 20 ou 30 (divisão inteira exata por 10) — não generalizar essa fórmula para outros valores sem revisitar a divisão inteira.
- Esta fase não introduz nenhuma nova função ou tipo enum compartilhado — reaproveita 100% da infraestrutura existente (`set_patient_id_from_pregnancy`, `is_team_member`), consistente com o objetivo de manter o codebase uniforme entre tabelas `birth_*`.
