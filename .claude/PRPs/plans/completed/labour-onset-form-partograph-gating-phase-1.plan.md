# Feature: Registro de Início do Trabalho de Parto + Partograma Gating — Phase 1: Migration + Tipos

## Summary

Adicionar 4 novas colunas nullable à tabela `pregnancies` — `birth_mode_labour_type`, `birth_mode_induction_type`, `labour_start_description`, `partograph_unlocked_at` — via uma migration Supabase, seguindo exatamente o padrão já estabelecido em `20260822000002_pregnancies_add_birth_mode_state.sql`, e regenerar `database.types.ts`. Nenhuma lógica de aplicação é escrita nesta fase — apenas schema + tipos, base para as Fases 2–4.

## User Story

As a agente de implementação
I want to ter as colunas de banco e tipos TS disponíveis para os dados de início de trabalho de parto e o gating do partograma
So that as Fases 2 (formulário) e 3 (gating) possam ser implementadas sem bloqueio de schema

## Problem Statement

Hoje `pregnancies` não tem nenhuma coluna para registrar tipo de trabalho de parto, tipo de indução, descrição de início, nem um marcador persistido de quando o partograma foi liberado. Sem essas colunas, nenhuma lógica de aplicação pode ser escrita.

## Solution Statement

Uma única migration SQL idiomática ao padrão do repositório: dois novos tipos `ENUM` nativos do Postgres (`birth_mode_labour_type`, `birth_mode_induction_type` — mesma abordagem de `delivery_method`/`baby_sex`, que também vivem em `pregnancies`), mais duas colunas simples (`text` nullable, `timestamptz` nullable). Depois, `pnpm db:push` aplica a migration e `pnpm db:types` regenera os tipos.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY (schema foundation)                |
| Complexity       | LOW                                                |
| Systems Affected | `packages/supabase` (migrations, generated types)  |
| Dependencies     | Supabase CLI (local, via `supabase db push`)       |
| Estimated Tasks  | 4                                                  |

---

## UX Design

Não aplicável — Phase 1 é puramente schema de banco de dados, sem superfície de UI. As Fases 2–4 do plano PRD consomem este schema.

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `packages/supabase/supabase/migrations/20260822000002_pregnancies_add_birth_mode_state.sql` | 1-8 | Padrão EXATO a espelhar: `ALTER TABLE public.pregnancies ADD COLUMN ...` + índice parcial |
| P0 | `packages/supabase/supabase/migrations/20260823000003_pregnancies_add_baby_sex.sql` | all | Padrão de `CREATE TYPE ... AS ENUM` seguido de `ALTER TABLE pregnancies ADD COLUMN` nullable — mesma tabela, mesmo estilo de enum nativo |
| P1 | `packages/supabase/supabase/migrations/20260318000001_pregnancies_add_delivery_method.sql` | all | Segundo exemplo de enum nativo em `pregnancies` (`delivery_method`) |
| P1 | `packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql` | 1-16 | Referência de enum nativo `CREATE TYPE ... AS ENUM` com qualificação `public.` explícita (variação de estilo a estar ciente, embora não usada aqui) |
| P2 | `packages/supabase/src/types/database.types.ts` | 2043-2162 | Shape atual do bloco `pregnancies` (Row/Insert/Update/Relationships) — after `pnpm db:types`, este bloco deve ganhar os 4 novos campos + 2 novos `Enums` |
| P2 | `packages/supabase/package.json` | 14-21 | Scripts `db:push`/`db:types` reais a rodar |

**External Documentation**: Não necessário — DDL Postgres padrão, já coberto pelos padrões internos do repositório.

---

## Patterns to Mirror

**MIGRATION_BASE_PATTERN (coluna simples nullable, sem enum):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260822000002_pregnancies_add_birth_mode_state.sql:1-8
ALTER TABLE public.pregnancies
  ADD COLUMN birth_mode_active boolean NOT NULL DEFAULT false,
  ADD COLUMN birth_mode_activated_at timestamptz,
  ADD COLUMN birth_mode_activated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN birth_mode_ended_at timestamptz;

CREATE INDEX IF NOT EXISTS pregnancies_birth_mode_active_idx
  ON public.pregnancies (birth_mode_active) WHERE birth_mode_active = true;
```

**NATIVE_ENUM_PATTERN (mesma tabela `pregnancies`):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260823000003_pregnancies_add_baby_sex.sql (full file)
CREATE TYPE baby_sex AS ENUM ('masculino', 'feminino');

ALTER TABLE pregnancies
  ADD COLUMN baby_sex baby_sex NULL;
```
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260318000001_pregnancies_add_delivery_method.sql (full file)
CREATE TYPE delivery_method AS ENUM ('cesarean', 'vaginal');

ALTER TABLE pregnancies
  ADD COLUMN delivery_method delivery_method NULL;
```

**CHECK_CONSTRAINT_PATTERN (referência, NÃO usar aqui — mantido apenas para contraste com o enum nativo escolhido):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260823000004_pregnancies_add_birth_weight.sql
ALTER TABLE pregnancies
  ADD COLUMN birth_weight_grams integer NULL
    CHECK (birth_weight_grams IS NULL OR birth_weight_grams > 0);
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `packages/supabase/supabase/migrations/20260824000008_pregnancies_add_labour_onset_and_partograph_gating.sql` | CREATE | Nova migration com os 2 enums + 4 colunas |
| `packages/supabase/src/types/database.types.ts` | REGENERATE (via `pnpm db:types`) | Nunca editar manualmente — sempre gerado pelo CLI |

---

## NOT Building (Scope Limits)

- Nenhuma lógica de aplicação (server actions, formulários, gating na UI) — isso é Fase 2/3/4 do plano PRD.
- Nenhum guard de "set-once" em UPDATE (`.is("partograph_unlocked_at", null)`) — a coluna é criada aqui; o guard de escrita é implementado na Fase 3, dentro de `add-birth-contraction-action`/`add-birth-cervical-dilation-action`.
- Nenhuma mudança de RLS/policy — confirmado que `pregnancies` usa RLS puramente row-level (`is_team_member(patient_id)` / `is_enterprise_patient(patient_id)`, `packages/supabase/supabase/migrations/20260313000001_pregnancies_table.sql:41-81`), sem GRANT/policy por coluna em nenhuma migration existente. Novas colunas nullable não exigem nenhuma alteração de RLS.
- Nenhum índice novo — nenhum dos 4 campos é usado hoje em filtro de query de alta frequência que justifique um índice (diferente de `birth_mode_active`, que tem um índice parcial porque é usado em `.eq("birth_mode_active", true)` em múltiplos lugares). Se a Fase 3/4 precisar filtrar por `partograph_unlocked_at`, um índice pode ser adicionado então.

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: CREATE `packages/supabase/supabase/migrations/20260824000008_pregnancies_add_labour_onset_and_partograph_gating.sql`

- **ACTION**: CREATE new migration file
- **IMPLEMENT**:
  ```sql
  CREATE TYPE birth_mode_labour_type AS ENUM ('espontaneo', 'induzido');

  CREATE TYPE birth_mode_induction_type AS ENUM ('balao', 'misoprostol', 'ocitocina');

  ALTER TABLE pregnancies
    ADD COLUMN birth_mode_labour_type birth_mode_labour_type NULL,
    ADD COLUMN birth_mode_induction_type birth_mode_induction_type NULL,
    ADD COLUMN labour_start_description text NULL,
    ADD COLUMN partograph_unlocked_at timestamptz NULL;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260823000003_pregnancies_add_baby_sex.sql` — mesmo estilo: `CREATE TYPE <nome> AS ENUM (...)` sem qualificação `public.`, seguido de `ALTER TABLE pregnancies ADD COLUMN <nome> <tipo> NULL` sem prefixo `public.` na tabela (esse arquivo específico e o de `delivery_method` não qualificam `public.`; apenas `20260822000002` e `20260822000005` qualificam — seguir o estilo mais recente/próximo: `20260823000003`)
- **NAMING**: valores de enum sem acentuação, minúsculos, consistente com `baby_sex`/`delivery_method` (`masculino`/`feminino`, `cesarean`/`vaginal`) — não usar `espontâneo` com acento para evitar inconsistência com o padrão de enums nativos existentes nesta tabela
- **GOTCHA**: NÃO usar `CHECK (col IN (...))` aqui — o padrão local e mais recente para campos enum-like em `pregnancies` é `CREATE TYPE ... AS ENUM`, não `text + CHECK`. Manter os dois `ADD COLUMN` blocos combinados no mesmo `ALTER TABLE` (como no arquivo espelhado), não uma migration por coluna
- **VALIDATE**: `cat packages/supabase/supabase/migrations/20260824000008_pregnancies_add_labour_onset_and_partograph_gating.sql` — revisar sintaxe visualmente antes de aplicar

### Task 2: RUN `pnpm db:push`

- **ACTION**: Apply migration to the Supabase project (local CLI workflow — NOT `mcp__supabase__apply_migration`; confirmed via `CLAUDE.md` and `packages/supabase/supabase/config.toml` that this repo uses local Supabase CLI migrations)
- **COMMAND**: `pnpm db:push`
- **GOTCHA**: Este comando aplica a migration ao projeto Supabase configurado (ver `packages/supabase/supabase/config.toml:5`, `project_id = "ventre-app"`) — é uma escrita real de schema. Confirmar que não há outras migrations pendentes não relacionadas antes de rodar.
- **VALIDATE**: Comando retorna sucesso (exit 0), sem erros de sintaxe SQL

### Task 3: RUN `pnpm db:types`

- **ACTION**: Regenerate `packages/supabase/src/types/database.types.ts`
- **COMMAND**: `pnpm db:types`
- **MIRROR**: `packages/supabase/package.json:20` — `"db:types": "node scripts/with-env.cjs supabase gen types typescript --project-id \\$NEXT_PUBLIC_SUPABASE_PROJECCT_ID > ./src/types/database.types.ts"`
- **GOTCHA**: NUNCA editar `database.types.ts` manualmente — é 100% gerado. Se o `pregnancies` block não mostrar os 4 novos campos após rodar, o `db:push` da Task 2 não foi aplicado corretamente ao projeto remoto/local esperado.
- **VALIDATE**: `grep -n "birth_mode_labour_type\|birth_mode_induction_type\|labour_start_description\|partograph_unlocked_at" packages/supabase/src/types/database.types.ts` — deve retornar múltiplas ocorrências (Row/Insert/Update + Enums)

### Task 4: VALIDATE type-check across monorepo

- **ACTION**: Confirm no TypeScript regressions from the regenerated types
- **COMMAND**: `pnpm check-types`
- **GOTCHA**: Como nenhuma lógica de aplicação usa os novos campos ainda, este comando deve passar sem nenhuma mudança adicional de código — ele só confirma que o arquivo gerado é sintaticamente válido e não quebra nenhum import existente de `Database["public"]["Tables"]["pregnancies"]`
- **VALIDATE**: `pnpm check-types` — exit 0

---

## Testing Strategy

### Unit Tests to Write

Nenhum — Phase 1 não introduz lógica de aplicação testável. Testes de comportamento (form validation, gating logic) pertencem às Fases 2 e 3.

### Edge Cases Checklist

- [ ] Migration é idempotente/segura de re-rodar (usa `CREATE TYPE`/`ADD COLUMN` simples — se já existir, `db push` falhará de forma clara, não silenciosa; aceitável pois migrations não são re-executadas em produção)
- [ ] `database.types.ts` regenerado não quebra nenhum uso existente de `Database["public"]["Tables"]["pregnancies"]["Row"]` em `apps/web` (validado via `pnpm check-types`)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, no errors

### Level 4: DATABASE_VALIDATION

Use Supabase MCP (`mcp__supabase__list_tables`) ou `grep` no `database.types.ts` regenerado para confirmar:

- [ ] `pregnancies` possui as 4 novas colunas
- [ ] `Database["public"]["Enums"]` possui `birth_mode_labour_type` e `birth_mode_induction_type` com os valores corretos
- [ ] Nenhuma RLS policy nova foi necessária/criada (confirmar que não há `CREATE POLICY` na migration)

---

## Acceptance Criteria

- [ ] Migration criada seguindo exatamente o padrão de `20260823000003_pregnancies_add_baby_sex.sql`
- [ ] `pnpm db:push` aplicado com sucesso
- [ ] `pnpm db:types` regenerado, 4 novos campos + 2 novos enums presentes em `database.types.ts`
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma lógica de aplicação foi tocada (escopo estritamente limitado a schema + tipos)

---

## Completion Checklist

- [ ] Task 1: migration file criado e revisado
- [ ] Task 2: `pnpm db:push` executado com sucesso
- [ ] Task 3: `pnpm db:types` executado, campos confirmados via grep
- [ ] Task 4: `pnpm check-types` passa
- [ ] PRD atualizado: Phase 1 status → `complete`, link ao plano preenchido

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Nome de enum colide com um tipo já existente no schema | Low | Medium | Nomes `birth_mode_labour_type`/`birth_mode_induction_type` são específicos o suficiente; confirmar via `mcp__supabase__list_tables` ou grep em migrations antes de aplicar (`grep -rn "birth_mode_labour_type\|birth_mode_induction_type" packages/supabase/supabase/migrations/`) — não encontrado hoje |
| `db:push` aplicado em ambiente errado (ex: produção sem querer) | Low | High | Confirmar `packages/supabase/supabase/config.toml` project_id antes de rodar; seguir o mesmo fluxo já usado por todas as migrations anteriores do repositório |
| Timestamp de migration (`20260824000008`) conflita com outra migration criada em paralelo por outro desenvolvedor | Low | Low | Verificar `ls packages/supabase/supabase/migrations/ | tail -5` imediatamente antes de criar o arquivo para confirmar o próximo timestamp livre |

---

## Notes

- A escolha de enum nativo (em vez de `text + CHECK`) segue diretamente o precedente mais próximo e mais recente na mesma tabela (`baby_sex`, `delivery_method`), não o padrão genérico usado em outras tabelas do repositório (que usam `CHECK IN (...)` com mais frequência). Isso mantém `pregnancies` internamente consistente.
- Valores de enum foram deliberadamente escolhidos sem acentuação (`espontaneo` em vez de `espontâneo`) para seguir a convenção observada nos enums nativos já existentes nesta tabela, que evitam caracteres acentuados.
- A coluna `partograph_unlocked_at` é criada aqui mas seu guard de escrita "set-once" (nunca resetar) é responsabilidade explícita da Fase 3 — não existe hoje no codebase nenhum padrão de `UPDATE ... WHERE col IS NULL` para isso; a Fase 3 precisará introduzir esse padrão pela primeira vez (documentado no PRD, Research Summary).

---

*Generated: 2026-08-23*
