# Feature: Billing Fees — Schema e Fundação (Phase 1)

## Summary

Cria a base de dados para o sistema de taxas/impostos/descontos configuráveis em cobranças: uma nova tabela `enterprise_billing_fees` (escopo de empresa, gerida apenas por gestores) e uma nova coluna jsonb `applied_billing_fees` em `billings` para armazenar o snapshot imutável das taxas aplicadas no momento da criação de cada cobrança. Esta é a Phase 1 de 4 do PRD `billing-fees-taxes-discounts` — schema apenas, sem lógica de cálculo (Phase 3) nem UI (Phase 2/4).

## User Story

As a gestor de empresa
I want to ter uma estrutura de dados para configurar taxas (fixas ou percentuais) e registrar o snapshot aplicado em cada cobrança
So that as próximas fases possam construir CRUD, cálculo automático e exibição do valor líquido sobre uma base de dados sólida e imutável

## Problem Statement

Hoje não existe nenhuma tabela para configuração de taxas (`enterprises` não tem coluna de config) nem coluna de snapshot em `billings` (que só tem `splitted_billing` como jsonb). Sem essa fundação, nenhuma fase seguinte (CRUD, cálculo, exibição) pode ser construída.

## Solution Statement

Nova migration Supabase que: (1) cria um enum `billing_fee_type` (`fixed` | `percentage`); (2) cria a tabela `enterprise_billing_fees` com RLS restrita a gestores (write) e staff (read); (3) adiciona a coluna `applied_billing_fees jsonb NOT NULL DEFAULT '[]'` em `billings` para o snapshot por cobrança. Após aplicar, regenerar `database.types.ts` via `pnpm db:types`.

## Metadata

| Field            | Value                                                          |
| ---------------- | --------------------------------------------------------------- |
| Type             | NEW_CAPABILITY (schema foundation)                              |
| Complexity       | LOW                                                              |
| Systems Affected | `packages/supabase` (migrations, generated types)                |
| Dependencies     | Supabase Postgres (existing project), no new external libs       |
| Estimated Tasks  | 3                                                                 |

---

## UX Design

Esta fase não tem UI — é puramente schema. Nenhum diagrama Before/After de UX se aplica. O "before/after" relevante é estrutural:

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  enterprises (sem coluna de config de taxas)                                ║
║  billings { ..., splitted_billing jsonb }  ← sem snapshot de taxas          ║
║  Nenhuma tabela para taxas configuráveis existe.                            ║
╚═══════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                   ║
╠═══════════════════════════════════════════════════════════════════════════╣
║  enterprise_billing_fees { id, enterprise_id, name, fee_type,               ║
║    value, is_active, created_by, created_at, updated_at }                   ║
║      ↑ FK enterprise_id → enterprises.id                                    ║
║                                                                              ║
║  billings { ..., splitted_billing jsonb,                                    ║
║             applied_billing_fees jsonb NOT NULL DEFAULT '[]' }  ← NOVO      ║
║                                                                              ║
║  RLS: staff (manager/secretary) lê; apenas manager cria/edita.              ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `packages/supabase/supabase/migrations/20260619000001_pregnancy_evolutions_created_by.sql` | all | Convenção mais recente de header/comentário e `created_by` FK pattern |
| P0 | `packages/supabase/supabase/migrations/20260213000001_billing_module.sql` | 47-61 | Schema original de `billings`, estilo de CREATE TABLE, enums |
| P0 | `packages/supabase/supabase/migrations/20260319000001_billings_splitted_billing.sql` | all | Precedente exato de ADD COLUMN jsonb em `billings` |
| P0 | `packages/supabase/supabase/migrations/20260501000001_activity_logs.sql` | all | Tabela mais próxima do padrão "staff lê, service_role escreve" + `handle_updated_at` trigger |
| P1 | `packages/supabase/supabase/migrations/20260527000005_update_billings_appointments_policies.sql` | 15-28 | Padrão de RLS policy usando `user_type IN (...)` inline, sem função `is_manager()` |
| P1 | `packages/supabase/supabase/migrations/20260306000001_enterprise_and_user_types.sql` | 6-49 | Schema de `enterprises` + RLS básica |
| P1 | `packages/supabase/src/types/database.types.ts` | buscar `billings:` e `team_members:` | Formato gerado — NUNCA editar manualmente, apenas para conferência pós `pnpm db:types` |
| P2 | `apps/web/src/lib/access-control.ts` | all | Confirma que não existe `is_manager()` SQL — só `user_type === "manager"` em TS; RLS deve replicar isso inline |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [PostgreSQL Docs — Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) | CHECK constraints | Sintaxe de CHECK condicional por tipo (`fee_type`) |
| [Crunchy Data — Working with Money in Postgres](https://www.crunchydata.com/blog/working-with-money-in-postgres) | numeric precision | Justifica `numeric(12,3)` para o campo `value` (cobre cents grandes e percentuais com 3 casas decimais) |

---

## Patterns to Mirror

**ENUM_TYPE_AND_TABLE (estilo geral de CREATE TABLE + trigger updated_at):**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260213000001_billing_module.sql:47-61
CREATE TABLE public.billings (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.users(id),
  description text NOT NULL,
  total_amount bigint NOT NULL,
  ...
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**UPDATED_AT_TRIGGER:**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260213000001_billing_module.sql:113-116
CREATE TRIGGER handle_billings_updated_at
  BEFORE UPDATE ON public.billings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
```

**JSONB_SNAPSHOT_COLUMN (precedente exato a mirror):**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260319000001_billings_splitted_billing.sql
ALTER TABLE public.billings
  ADD COLUMN splitted_billing jsonb NOT NULL DEFAULT '{}';
```

**CREATED_BY_FK:**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260619000001_pregnancy_evolutions_created_by.sql
ALTER TABLE public.pregnancy_evolutions
  ADD COLUMN created_by uuid
  REFERENCES public.users(id) ON DELETE SET NULL;
```

**STAFF_READ_SERVICE_ROLE_WRITE_RLS (padrão `activity_logs`, mais próximo de uma tabela de config gerida por staff):**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260501000001_activity_logs.sql:21-37
CREATE POLICY "service_role_manage_activity_logs"
  ON public.activity_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "staff_select_enterprise_activity_logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );
```

**MANAGER_ONLY_WRITE_RLS (inline, sem função SQL dedicada — não existe `is_manager()`):**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260527000005_update_billings_appointments_policies.sql:15-28 (adaptado de staff para manager-only)
CREATE POLICY "Enterprise staff can create enterprise billings"
  ON public.billings FOR INSERT
  WITH CHECK (public.is_enterprise_staff());
-- (nossa policy substitui is_enterprise_staff() por checagem inline user_type = 'manager',
--  pois o PRD exige EXCLUIR secretaries da escrita de taxas)
```

**INDEX_PATTERN:**
```sql
// SOURCE: packages/supabase/supabase/migrations/20260527000003_billings_appointments_enterprise_id.sql:11-14
CREATE INDEX idx_billings_enterprise_id ON public.billings(enterprise_id);
```

---

## Files to Change

| File                             | Action | Justification                            |
| --------------------------------- | ------ | ----------------------------------------- |
| `packages/supabase/supabase/migrations/20260620000001_enterprise_billing_fees.sql` | CREATE | Nova tabela de taxas + coluna de snapshot em `billings` |
| `packages/supabase/src/types/database.types.ts` | UPDATE (auto-gerado) | Regenerado via `pnpm db:types` após aplicar a migration — NUNCA editar manualmente |

---

## NOT Building (Scope Limits)

- **CRUD/actions/UI de taxas** — Phase 2, fora deste plano.
- **Cálculo/aplicação automática de taxas em cobranças** — Phase 3, fora deste plano. A coluna `applied_billing_fees` fica com default `'[]'` e não é populada nesta fase.
- **Exibição de valor líquido** — Phase 4, fora deste plano.
- **Função SQL `is_manager()`** — o codebase não tem esse padrão (apenas `is_enterprise_staff()`, `is_same_enterprise()`); seguimos a convenção existente de checagem inline `user_type = 'manager'` em vez de criar uma nova função genérica para uma única tabela.
- **Hard delete de taxas** — PRD exige soft-delete via `is_active`; nenhuma policy de DELETE é criada para `authenticated` (apenas `service_role`, via grant `ALL`, para correções administrativas excepcionais).

---

## Step-by-Step Tasks

### Task 1: CREATE migration `packages/supabase/supabase/migrations/20260620000001_enterprise_billing_fees.sql`

- **ACTION**: CREATE novo arquivo de migration
- **IMPLEMENT**: Conteúdo exato abaixo (enum, tabela, índices, trigger, RLS, grants, e ALTER em `billings`)

```sql
-- ============================================================
-- Enterprise billing fees (taxas/impostos/descontos configuráveis)
-- Gestores configuram taxas fixas (cents) ou percentuais que serão
-- aplicadas automaticamente a novas cobranças (Phase 3 — fora deste
-- escopo). Esta migration cria apenas a fundação de schema:
-- a tabela de configuração e a coluna de snapshot imutável em billings.
-- ============================================================

CREATE TYPE public.billing_fee_type AS ENUM ('fixed', 'percentage');

CREATE TABLE public.enterprise_billing_fees (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  name text NOT NULL,
  fee_type public.billing_fee_type NOT NULL,
  value numeric(12,3) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT enterprise_billing_fees_value_range_check CHECK (
    (fee_type = 'percentage' AND value > 0 AND value <= 100)
    OR
    (fee_type = 'fixed' AND value > 0)
  )
);

CREATE INDEX idx_enterprise_billing_fees_enterprise_id
  ON public.enterprise_billing_fees (enterprise_id);

CREATE INDEX idx_enterprise_billing_fees_enterprise_active
  ON public.enterprise_billing_fees (enterprise_id, is_active);

CREATE TRIGGER handle_enterprise_billing_fees_updated_at
  BEFORE UPDATE ON public.enterprise_billing_fees
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.enterprise_billing_fees ENABLE ROW LEVEL SECURITY;

-- Staff (manager ou secretary) podem visualizar as taxas da própria empresa
CREATE POLICY "Staff can view enterprise billing fees"
  ON public.enterprise_billing_fees FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

-- Apenas managers (não secretaries) podem criar taxas — requisito explícito do PRD
CREATE POLICY "Managers can create enterprise billing fees"
  ON public.enterprise_billing_fees FOR INSERT TO authenticated
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type = 'manager'
        AND enterprise_id IS NOT NULL
    )
  );

-- Apenas managers podem editar/desativar taxas (is_active, name, value)
CREATE POLICY "Managers can update enterprise billing fees"
  ON public.enterprise_billing_fees FOR UPDATE TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type = 'manager'
        AND enterprise_id IS NOT NULL
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type = 'manager'
        AND enterprise_id IS NOT NULL
    )
  );

CREATE POLICY "service_role_manage_enterprise_billing_fees"
  ON public.enterprise_billing_fees FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON public.enterprise_billing_fees TO authenticated;
GRANT ALL ON public.enterprise_billing_fees TO service_role;

-- ============================================================
-- Snapshot imutável das taxas aplicadas a uma cobrança no momento
-- da criação. Array de objetos pois múltiplas taxas podem se aplicar.
-- Populado pela lógica de cálculo na Phase 3 — aqui apenas o schema.
-- Shape esperado (documentado para a Phase 3, não validado em DB):
--   [{ fee_id, name, fee_type, value, base_amount_cents, computed_amount_cents }]
-- ============================================================
ALTER TABLE public.billings
  ADD COLUMN applied_billing_fees jsonb NOT NULL DEFAULT '[]';
```

- **MIRROR**: `packages/supabase/supabase/migrations/20260501000001_activity_logs.sql` (RLS staff-read/service_role-write shape), `packages/supabase/supabase/migrations/20260319000001_billings_splitted_billing.sql` (ALTER TABLE jsonb)
- **IMPORTS**: N/A (SQL file)
- **GOTCHA 1**: Não existe `is_manager()` SQL — use checagem inline `user_type = 'manager'`, igual ao padrão já usado para `'manager','secretary'` em outras tabelas.
- **GOTCHA 2**: `value numeric(12,3)` é compartilhado entre fixed (cents inteiros, ex: `500` = R$5,00) e percentage (ex: `12.500` = 12,5%) — a interpretação correta depende de `fee_type`; isso será resolvido na lógica de cálculo da Phase 3, não nesta migration.
- **GOTCHA 3**: Não criar policy de DELETE para `authenticated` — soft-delete via `is_active` é o único mecanismo de desativação (requisito do PRD).
- **GOTCHA 4**: Timestamp do arquivo deve ser posterior ao último (`20260619000001`) — usar `20260620000001`.
- **VALIDATE**: `pnpm db:push` (aplica a migration ao Supabase remoto/local)

### Task 2: REGENERATE `packages/supabase/src/types/database.types.ts`

- **ACTION**: RUN comando de regeneração de tipos
- **IMPLEMENT**: `pnpm db:types`
- **MIRROR**: N/A — comando padrão do projeto, ver `CLAUDE.md`
- **GOTCHA**: Nunca editar `database.types.ts` manualmente; se o tipo gerado para `enterprise_billing_fees` ou `applied_billing_fees` não aparecer como esperado, a migration não foi aplicada corretamente — reaplicar `pnpm db:push` antes de regenerar.
- **VALIDATE**: Confirmar manualmente que `database.types.ts` contém `enterprise_billing_fees: { Row: {...} }` e que `billings.Row` agora inclui `applied_billing_fees: Json`.

### Task 3: VALIDATE compilação de tipos em todo o monorepo

- **ACTION**: RUN type-check
- **IMPLEMENT**: `pnpm check-types`
- **MIRROR**: N/A
- **GOTCHA**: Como nenhuma lógica de aplicação consome os novos tipos ainda (Phase 2/3 ficam pendentes), o type-check deve passar sem nenhuma alteração em código TypeScript além do arquivo gerado.
- **VALIDATE**: `pnpm check-types` — exit 0, sem erros

---

## Testing Strategy

### Unit Tests to Write

Nenhum — esta fase é puramente schema/DDL, sem lógica de aplicação para testar unitariamente. Testes de cálculo/CRUD ficam para Phase 2/3.

### Edge Cases Checklist (validados via Level 4 — Database Validation)

- [ ] Inserir taxa com `fee_type = 'percentage'` e `value = 0` → deve FALHAR (CHECK exige `> 0`)
- [ ] Inserir taxa com `fee_type = 'percentage'` e `value = 100.001` → deve FALHAR (CHECK exige `<= 100`)
- [ ] Inserir taxa com `fee_type = 'fixed'` e `value = 0` → deve FALHAR (CHECK exige `> 0`)
- [ ] Inserir taxa com `fee_type = 'fixed'` e `value = 1500` (R$15,00) → deve PASSAR
- [ ] Usuário `secretary` tentando INSERT em `enterprise_billing_fees` → deve ser bloqueado por RLS
- [ ] Usuário `manager` de outra empresa tentando ver/criar taxa de empresa diferente → deve ser bloqueado por RLS
- [ ] `billings` existentes (pré-migration) devem ter `applied_billing_fees = '[]'` após o ALTER TABLE (verificar default aplicado retroativamente)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo (incluindo o novo tipo gerado para `enterprise_billing_fees` e `billings.applied_billing_fees`)

### Level 4: DATABASE_VALIDATION

Usar Supabase MCP (`mcp__supabase__list_tables`, `mcp__supabase__execute_sql`) para verificar:

- [ ] Tabela `enterprise_billing_fees` criada com as colunas esperadas
- [ ] Enum `billing_fee_type` criado com valores `fixed`/`percentage`
- [ ] RLS habilitada (`relrowsecurity = true`) em `enterprise_billing_fees`
- [ ] 4 policies criadas (`Staff can view...`, `Managers can create...`, `Managers can update...`, `service_role_manage_...`)
- [ ] Índices `idx_enterprise_billing_fees_enterprise_id` e `idx_enterprise_billing_fees_enterprise_active` criados
- [ ] Trigger `handle_enterprise_billing_fees_updated_at` criado
- [ ] Coluna `billings.applied_billing_fees` existe, tipo `jsonb`, `NOT NULL`, default `'[]'::jsonb`
- [ ] Rodar os 7 edge cases do checklist acima via `execute_sql` direto (como `service_role`/admin, contornando RLS para os testes de CHECK constraint; para os testes de RLS, simular via `SET ROLE` ou testar pela aplicação na Phase 2)

### Level 6: MANUAL_VALIDATION

1. Rodar `pnpm db:push` e confirmar que a migration aparece em `pnpm db:pull`/histórico sem erros.
2. Rodar `pnpm db:types` e abrir `database.types.ts` para confirmar manualmente os dois novos shapes (`enterprise_billing_fees` table e `billings.applied_billing_fees`).
3. Rodar `pnpm check-types` na raiz do monorepo.

---

## Acceptance Criteria

- [ ] Migration aplicada sem erros e sem afetar dados existentes em `billings` (todas as linhas existentes recebem `applied_billing_fees = '[]'` via DEFAULT)
- [ ] Tabela `enterprise_billing_fees` criada com RLS: staff lê, apenas manager escreve, service_role tem acesso total
- [ ] CHECK constraint impede valores inválidos (percentage fora de 0-100, fixed <= 0)
- [ ] `database.types.ts` regenerado e reflete ambas as mudanças
- [ ] `pnpm check-types` passa sem erros em todo o monorepo
- [ ] Nenhuma lógica de aplicação/CRUD/UI foi escrita nesta fase (escopo estritamente schema)

---

## Completion Checklist

- [ ] Task 1: Migration criada e aplicada (`pnpm db:push`)
- [ ] Task 2: Tipos regenerados (`pnpm db:types`)
- [ ] Task 3: Type-check do monorepo passa (`pnpm check-types`)
- [ ] Level 4: Validação via Supabase MCP confirma schema, RLS, índices, trigger
- [ ] Level 6: Validação manual dos tipos gerados
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------- | ------------ | ------------ | ----------------------------------------- |
| `value numeric(12,3)` compartilhado entre fixed/percentage gerar confusão de interpretação na Phase 3 | M | M | Documentado explicitamente no comentário da migration e neste plano; Phase 3 deve ler `fee_type` antes de interpretar `value` |
| RLS inline (`user_type = 'manager'`) divergir de futuras mudanças em `is_enterprise_staff()` | L | L | Padrão já é usado em outras tabelas (`billings`, `activity_logs`) sem função dedicada; consistente com a convenção atual do repo |
| Migration timestamp colidir com outra migration criada em paralelo por outro desenvolvedor | L | M | Confirmar timestamp mais recente (`20260619000001`) imediatamente antes de aplicar; usar `20260620000001` |
| `applied_billing_fees` shape não documentado em DB (jsonb sem schema) causar inconsistência na Phase 3 | M | M | Shape esperado documentado em comentário SQL; Phase 3 deve definir Zod schema correspondente em `packages/validations` (fora deste plano) |

---

## Notes

- Esta é a Phase 1 de 4 do PRD `.claude/PRPs/prds/billing-fees-taxes-discounts.prd.md`. Phases 2 e 3 dependem desta fase; Phase 4 depende da Phase 3.
- A decisão de não criar uma função SQL `is_manager()` genérica foi deliberada — o codebase não tem esse padrão hoje (só `is_enterprise_staff()` para staff em geral) e criar uma função para uma única tabela seria prematuro. Se Phase 2/3 revelar necessidade de reutilização, extrair a função então.
- O shape do snapshot `applied_billing_fees` (`fee_id`, `name`, `fee_type`, `value`, `base_amount_cents`, `computed_amount_cents`) é uma recomendação baseada em pesquisa de mercado (Stripe Connect, audit/snapshot patterns) e deve ser usado como referência pela Phase 3, mas não está fixado em nenhum CHECK/schema de banco — flexibilidade intencional para a fase de cálculo definir a forma final.
- Ordem de aplicação entre taxas fixas e percentuais (open question do PRD) e tratamento de arredondamento por parcela permanecem **não resolvidos nesta fase** — são responsabilidade explícita da Phase 3.
