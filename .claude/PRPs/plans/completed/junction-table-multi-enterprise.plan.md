# Feature: Junction table — profissionais em múltiplas empresas

## Summary

Migramos a ancoragem de empresa de `users.enterprise_id` (1:1) para a tabela de junção `user_enterprises` (N:N), permitindo que um profissional pertença a múltiplas organizações. Paralelamente adicionamos `enterprise_id` nas tabelas `pregnancies`, `billings` e `appointments` para isolar dados por empresa sem depender de JOINs longos. As funções helper de RLS (`is_same_enterprise`, `is_enterprise_patient`) são reescritas para usar as novas colunas. As funções helper afetam 11+ tabelas via RLS em cascata — nenhuma policy individual precisa mudar, apenas as funções.

## User Story

Como gestora de uma clínica
Eu quero que profissionais possam pertencer a mais de uma empresa
Para que eu possa adicionar uma obstetra que atua em outra clínica ao meu time sem conflito

## Problem Statement

`users.enterprise_id` é um FK simples: uma profissional só pode ter um valor. A lógica de `addEnterpriseProfessionalAction` rejeita qualquer profissional que já tenha `enterprise_id` preenchido (linha 39). Isso bloqueia casos reais onde a mesma obstetra atua em duas clínicas.

## Solution Statement

1. Criar `user_enterprises (user_id, enterprise_id, joined_at)` como junction table com PK composta.
2. Fazer backfill das relações existentes e zerar `users.enterprise_id` apenas para profissionais.
3. Adicionar `enterprise_id` em `pregnancies`, `billings` e `appointments` com backfill.
4. Reescrever as 3 funções helper de RLS para usar as novas colunas.
5. Atualizar as RLS policies de `billings` e `appointments` que hoje filtram via `is_enterprise_patient(patient_id)` para usar `enterprise_id` direto.
6. Atualizar as actions e services que fazem queries ou writes de `enterprise_id` em `users`.

## Metadata

| Field            | Value                                                          |
| ---------------- | -------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                    |
| Complexity       | HIGH                                                           |
| Systems Affected | database/migrations, RLS, actions, services, TS types          |
| Dependencies     | Supabase, next-safe-action, Zod                                |
| Estimated Tasks  | 11                                                             |

---

## UX Design

### Before State

```
╔════════════════════════════════════════════════════════════════════╗
║                          BEFORE STATE                              ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  users.enterprise_id ──FK──► enterprises                          ║
║       │                                                            ║
║       └─ profissional só pode ter 1 empresa                        ║
║                                                                    ║
║  addEnterpriseProfessionalAction                                   ║
║    ├── se targetUser.enterprise_id == profile.enterprise_id        ║
║    │     → throw "Já pertence à sua organização"                   ║
║    └── se targetUser.enterprise_id (qualquer valor)                ║
║          → throw "Já está vinculado a outra organização" ❌        ║
║                                                                    ║
║  getEnterpriseBillings:                                            ║
║    users WHERE enterprise_id = X                                   ║
║      → professional IDs                                            ║
║        → billings WHERE splitted_billing keys IN IDs               ║
║          (2 queries, depende de profissional ainda na empresa)     ║
║                                                                    ║
║  getHomeEnterpriseData:                                            ║
║    users WHERE enterprise_id = X AND user_type = 'professional'   ║
║      → team_members WHERE professional_id IN [...]                 ║
║        → patients                                                  ║
║                                                                    ║
║  is_enterprise_patient(p_patient_id):                              ║
║    patients.created_by → users.enterprise_id                       ║
║    (pacientes de profissional removido ficam órfãos)               ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔════════════════════════════════════════════════════════════════════╗
║                          AFTER STATE                               ║
╠════════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  user_enterprises (user_id, enterprise_id)  — N:N junction        ║
║  users.enterprise_id  — mantido APENAS para staff (manager/sec.)  ║
║                                                                    ║
║  addEnterpriseProfessionalAction                                   ║
║    ├── se já existe user_enterprises(user, enterprise)             ║
║    │     → throw "Já pertence à sua organização"                   ║
║    └── INSERE em user_enterprises ✅ (sem bloqueio p/ multi)       ║
║                                                                    ║
║  pregnancies.enterprise_id ──FK──► enterprises                    ║
║  billings.enterprise_id    ──FK──► enterprises                    ║
║  appointments.enterprise_id──FK──► enterprises                    ║
║                                                                    ║
║  getEnterpriseBillings:                                            ║
║    billings WHERE enterprise_id = X (1 query direta)              ║
║                                                                    ║
║  getHomeEnterpriseData:                                            ║
║    pregnancies WHERE enterprise_id = X AND has_finished = false   ║
║      → patients + team_members                                     ║
║                                                                    ║
║  is_enterprise_patient(p_patient_id):                              ║
║    pregnancies WHERE patient_id = p AND enterprise_id = staff.ent  ║
║    (ancora em pregnancy, não em criador do paciente)               ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                                | Before                                     | After                                             | User Impact                             |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------------- | --------------------------------------- |
| `add-enterprise-professional-action.ts` | Rejeita profissional em outra org          | Insere em `user_enterprises`; aceita multi-org    | Pode adicionar profissional compartilhada |
| `join-enterprise-action.ts`             | UPDATE `users.enterprise_id`               | INSERT em `user_enterprises`                      | Pode entrar em múltiplas orgs            |
| `remove-enterprise-professional-action` | SET `users.enterprise_id = null`           | DELETE de `user_enterprises`                      | Remoção granular por empresa             |
| `complete-registration-action.ts`       | UPDATE `users.enterprise_id = invite.ent`  | INSERT em `user_enterprises(user, invite.ent)`    | Novo usuário entra direto na org do invite |
| `billing.ts` (`getEnterpriseBillings`)  | 2-step: professionals → splitted_billing   | 1-step: `billings WHERE enterprise_id = X`        | Desempenho melhor, isolamento correto    |
| `home-enterprise.ts`                    | professionals → team_members → patients    | pregnancies WHERE enterprise_id → patients        | Home mostra pacientes da org, não do profissional |
| `enterprise-home-patients-cache.ts`     | professionals → team_members               | user_enterprises → team_members                   | Cache indexado por empresa               |

---

## Mandatory Reading

**CRITICAL: Ler antes de começar qualquer task:**

| Priority | File                                                                                      | Lines    | Por quê ler                                               |
| -------- | ----------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| P0       | `packages/supabase/supabase/migrations/20260308000001_enterprise_staff_rls_policies.sql` | all      | Funções helper e policies a serem reescritas/mantidas     |
| P0       | `packages/supabase/supabase/migrations/20260425000001_get_filtered_patients_add_pregnancy_fields.sql` | all | Padrão de migration SQL e assinatura de `get_filtered_patients` |
| P0       | `apps/web/src/lib/safe-action.ts`                                                         | all      | Como `profile.enterprise_id` flui para actions            |
| P0       | `apps/web/src/services/billing.ts`                                                        | 51–146   | Query atual de `getEnterpriseBillings` que muda por inteiro |
| P1       | `apps/web/src/services/home-enterprise.ts`                                                | 61–130   | Query pivot que muda de professionals → pregnancies       |
| P1       | `apps/web/src/services/enterprise-home-patients-cache.ts`                                 | 58–100   | Mesma pivot, com unstable_cache                           |
| P1       | `apps/web/src/actions/add-enterprise-professional-action.ts`                              | all      | Guard a remover (linha 39) e write a mudar               |
| P1       | `apps/web/src/actions/remove-enterprise-professional-action.ts`                           | all      | DELETE em vez de UPDATE                                   |
| P1       | `apps/web/src/actions/join-enterprise-action.ts`                                          | all      | INSERT em vez de UPDATE                                   |
| P1       | `apps/web/src/actions/complete-registration-action.ts`                                    | all      | INSERT + manter `users.enterprise_id` apenas para staff   |
| P2       | `packages/supabase/supabase/migrations/20260313000001_pregnancies_table.sql`              | 67–81    | Como policies de pregnancies foram adicionadas            |
| P2       | `packages/supabase/supabase/migrations/20260513000002_fix_enterprise_create_appointment_rls.sql` | all | Policy de appointment que será substituída               |
| P2       | `packages/supabase/src/types/database.types.ts`                                           | procurar `billings:` `appointments:` `pregnancies:` | Tipos atuais sem `enterprise_id` |

---

## Patterns to Mirror

**ACTION_PATTERN — estrutura padrão de action:**

```typescript
// SOURCE: apps/web/src/actions/add-enterprise-professional-action.ts:8-63
export const addEnterpriseProfessionalAction = authActionClient
  .inputSchema(z.object({ email: z.string().email() }))
  .action(async ({ parsedInput: { email }, ctx: { user, profile } }) => {
    if (!profile?.enterprise_id) {
      throw new Error("Você não está associado a nenhuma organização.");
    }
    const supabaseAdmin = await createServerSupabaseAdmin();
    // ... lógica ...
    return { name: targetUser.name, email: targetUser.email };
  });
```

**SERVICE_ENTERPRISE_QUERY_PATTERN — pivot atual (a ser substituída):**

```typescript
// SOURCE: apps/web/src/services/home-enterprise.ts:70-74
// ESTE PADRÃO MUDA — não copiar para novas queries
const { data: professionals } = await supabase
  .from("users")
  .select("id, name, professional_type, avatar_url")
  .eq("enterprise_id", enterpriseId)
  .eq("user_type", "professional");
```

**SERVICE_ENTERPRISE_QUERY_PATTERN — novo padrão após migration:**

```typescript
// NOVO PADRÃO — usar user_enterprises para encontrar profissionais
const { data: userEnterprises } = await supabaseAdmin
  .from("user_enterprises")
  .select("user_id")
  .eq("enterprise_id", enterpriseId);
const professionalIds = (userEnterprises ?? []).map((ue) => ue.user_id);
```

**BILLING_NEW_QUERY_PATTERN — após migration 3:**

```typescript
// SOURCE: apps/web/src/services/billing.ts:78-87 (versão ANTES — a substituir)
// NOVO: query direta por enterprise_id em vez de via professional IDs
const { data } = await supabaseAdmin
  .from("billings")
  .select("*, installments(*), patient:patients!billings_patient_id_fkey(id, name)")
  .eq("enterprise_id", enterpriseId)
  .order("created_at", { ascending: false });
```

**MIGRATION_STRUCTURE_PATTERN — cabeçalho e estilo SQL:**

```sql
-- SOURCE: packages/supabase/supabase/migrations/20260308000001_enterprise_staff_rls_policies.sql:1-9
-- ============================================================
-- [Descrição da migration]
-- ============================================================
CREATE TABLE public.user_enterprises (
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, enterprise_id)
);
```

**SUPABASE_ADMIN_PATTERN — quando usar admin:**

```typescript
// SOURCE: apps/web/src/actions/remove-enterprise-professional-action.ts:9,32-35
// ctx.supabaseAdmin já está disponível via authActionClient middleware
// Para cross-user writes (outro user_id), usar supabaseAdmin
const { error: updateError } = await supabaseAdmin
  .from("user_enterprises")
  .delete()
  .eq("user_id", professionalId)
  .eq("enterprise_id", profile.enterprise_id);
```

---

## Atenção: Restrição em `billings.splitted_billing`

`billings` **não tem coluna `professional_id`**. A coluna foi dropada na migration `20260319000001_billings_splitted_billing.sql` e substituída por `splitted_billing jsonb` (formato: `{ "<uuid_profissional>": <valor_inteiro> }`).

O backfill SQL do prompt usa `tm.professional_id = b.professional_id` — isso não funciona. Usar o backfill alternativo abaixo:

```sql
-- Backfill CORRETO para billings: via patient_id → pregnancy mais recente com enterprise_id
UPDATE public.billings b
SET enterprise_id = preg.enterprise_id
FROM (
  SELECT DISTINCT ON (patient_id) patient_id, enterprise_id
  FROM public.pregnancies
  WHERE enterprise_id IS NOT NULL
  ORDER BY patient_id, created_at DESC
) preg
WHERE preg.patient_id = b.patient_id
  AND b.enterprise_id IS NULL;
```

---

## Files to Change

### Novas Migrations (pasta `packages/supabase/supabase/migrations/`)

| File                                                      | Action | Justificativa                                               |
| --------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `20260527000001_user_enterprises_junction_table.sql`      | CREATE | Junction table + RLS + backfill profissionais + zera users  |
| `20260527000002_pregnancies_enterprise_id.sql`            | CREATE | Coluna + index + backfill via created_by                    |
| `20260527000003_billings_appointments_enterprise_id.sql`  | CREATE | Colunas + indexes + backfill via pregnancy                  |
| `20260527000004_rewrite_rls_helper_functions.sql`         | CREATE | Reescreve is_same_enterprise e is_enterprise_patient        |
| `20260527000005_update_billings_appointments_policies.sql`| CREATE | Drop + recreate policies de billings e appointments         |

### Application Code (`apps/web/src/`)

| File                                                           | Action | Justificativa                                          |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| `actions/join-enterprise-action.ts`                            | UPDATE | INSERT user_enterprises em vez de UPDATE users         |
| `actions/complete-registration-action.ts`                      | UPDATE | INSERT user_enterprises + não setar users.enterprise_id para profissionais |
| `actions/add-enterprise-professional-action.ts`                | UPDATE | Remove guard de single-enterprise; INSERT user_enterprises |
| `actions/remove-enterprise-professional-action.ts`             | UPDATE | DELETE user_enterprises em vez de UPDATE users         |
| `actions/add-billing-action.ts`                                | UPDATE | enterprise_id via pregnancy lookup, não via profile    |
| `actions/add-appointment-action.ts`                            | UPDATE | enterprise_id via pregnancy lookup, não via profile    |
| `services/billing.ts` (`getEnterpriseBillings`)                | UPDATE | Query direta em billings.enterprise_id                 |
| `services/home-enterprise.ts` (`getHomeEnterpriseData`)        | UPDATE | Pivot: pregnancies WHERE enterprise_id → patients      |
| `services/enterprise-home-patients-cache.ts`                   | UPDATE | Pivot: user_enterprises em vez de users.enterprise_id  |
| `services/professional.ts` (`getEnterpriseProfessionals`)      | UPDATE | user_enterprises em vez de users.enterprise_id         |
| `services/enterprise-users.ts` (`getEnterpriseUsers`)          | UPDATE | JOIN user_enterprises para profissionais               |

### Após todas as migrations

| Command           | Justificativa                               |
| ----------------- | ------------------------------------------- |
| `pnpm db:types`   | Regenerar `database.types.ts` com novas colunas e tabela |
| `pnpm check-types`| Verificar que o código TypeScript compila após mudança de tipos |

---

## NOT Building (Scope Limits)

- **UI para escolher empresa por gestação** — o profissional precisará de uma tela para associar uma gestante a uma empresa específica. Isso é Phase 7 e não está neste plano.
- **Múltiplos `enterprise_id` no `profile` de context** — `authActionClient` continua carregando `users.*`; profissionais terão `enterprise_id = null`. Não adicionar `user_enterprises` ao context do safe-action agora.
- **`add-new-professional-action.ts`** — esta action também seta `users.enterprise_id`. Não está no escopo deste plano (raramente usada; pode ser migrada depois).
- **`get_filtered_patients` RPC** — o prompt menciona adicionar `p_enterprise_id`, mas isso pertence à Phase 7 (UI de seleção). Não alterar aqui.
- **Validação de "profissional externa"** — a flag `is_external` derivada no frontend é uma feature de UI, fora deste plano.
- **`getEnterprisePatients` inline** (dentro de `get-enterprise-patients-action.ts`) — mantém a lógica via `team_members` por enquanto; isolamento via `pregnancies.enterprise_id` é suficiente para o RLS.

---

## Step-by-Step Tasks

### Task 1: CREATE migration `20260527000001_user_enterprises_junction_table.sql`

**ACTION**: Criar junction table + RLS + backfill + zerar `users.enterprise_id` dos profissionais  
**FILE**: `packages/supabase/supabase/migrations/20260527000001_user_enterprises_junction_table.sql`

**CONTEÚDO**:

```sql
-- ============================================================
-- Junction table: profissionais em múltiplas empresas
-- ============================================================

CREATE TABLE public.user_enterprises (
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, enterprise_id)
);

CREATE INDEX user_enterprises_enterprise_id_idx ON public.user_enterprises(enterprise_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.user_enterprises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_user_enterprises"
  ON public.user_enterprises FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "professional_view_own_enterprises"
  ON public.user_enterprises FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "staff_view_enterprise_professionals"
  ON public.user_enterprises FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

-- ============================================================
-- Backfill: preserva relações existentes de profissionais
-- ============================================================
INSERT INTO public.user_enterprises (user_id, enterprise_id, joined_at)
SELECT id, enterprise_id, COALESCE(created_at, now())
FROM public.users
WHERE enterprise_id IS NOT NULL
  AND user_type = 'professional';

-- ============================================================
-- Zera users.enterprise_id APENAS para profissionais
-- (managers e secretaries mantêm o campo)
-- ============================================================
UPDATE public.users
SET enterprise_id = NULL
WHERE user_type = 'professional'
  AND enterprise_id IS NOT NULL;
```

**GOTCHA**: Executar o `UPDATE` de zeragem APÓS o INSERT do backfill — ordem importa.  
**GOTCHA**: `user_type = 'admin'` também existe — não é profissional, não zerar.  
**VALIDATE**: `pnpm db:push` sem erros → verificar via Supabase dashboard que `user_enterprises` tem dados.

---

### Task 2: CREATE migration `20260527000002_pregnancies_enterprise_id.sql`

**ACTION**: Adicionar `enterprise_id` em `pregnancies` + backfill  
**FILE**: `packages/supabase/supabase/migrations/20260527000002_pregnancies_enterprise_id.sql`

**CONTEÚDO**:

```sql
-- ============================================================
-- pregnancies.enterprise_id — ancora principal de isolamento
-- ============================================================

ALTER TABLE public.pregnancies
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX pregnancies_enterprise_id_idx ON public.pregnancies(enterprise_id);

-- ============================================================
-- Backfill via staff (manager/secretary): usa users.enterprise_id
-- ============================================================
UPDATE public.pregnancies preg
SET enterprise_id = u.enterprise_id
FROM public.users u
WHERE u.id = preg.created_by
  AND u.user_type IN ('manager', 'secretary')
  AND u.enterprise_id IS NOT NULL;

-- ============================================================
-- Backfill via profissional: usa user_enterprises
-- (pega a primeira empresa se houver ambiguidade — situação rara pré-migration)
-- ============================================================
UPDATE public.pregnancies preg
SET enterprise_id = ue.enterprise_id
FROM public.user_enterprises ue
WHERE ue.user_id = preg.created_by
  AND preg.enterprise_id IS NULL;
```

**GOTCHA**: A migration 1 deve ter rodado antes (backfill de `user_enterprises` já existente).  
**GOTCHA**: Gestações criadas por profissionais autônomos (sem `user_enterprises`) ficam com `enterprise_id = NULL` — correto.  
**VALIDATE**: `pnpm db:push` → verificar contagem de `pregnancies WHERE enterprise_id IS NOT NULL`.

---

### Task 3: CREATE migration `20260527000003_billings_appointments_enterprise_id.sql`

**ACTION**: Adicionar `enterprise_id` em `billings` e `appointments` + backfill  
**FILE**: `packages/supabase/supabase/migrations/20260527000003_billings_appointments_enterprise_id.sql`

**IMPORTANTE**: `billings` não tem coluna `professional_id` (foi removida em favor de `splitted_billing jsonb`). Usar backfill via `patient_id → pregnancy`.

**CONTEÚDO**:

```sql
-- ============================================================
-- billings.enterprise_id
-- ============================================================

ALTER TABLE public.billings
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX idx_billings_enterprise_id ON public.billings(enterprise_id);

-- ============================================================
-- appointments.enterprise_id
-- ============================================================

ALTER TABLE public.appointments
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX idx_appointments_enterprise_id ON public.appointments(enterprise_id);

-- ============================================================
-- Backfill billings: via patient_id → pregnancy mais recente com enterprise_id
-- (billings não tem professional_id — usa splitted_billing jsonb)
-- ============================================================
UPDATE public.billings b
SET enterprise_id = preg.enterprise_id
FROM (
  SELECT DISTINCT ON (patient_id) patient_id, enterprise_id
  FROM public.pregnancies
  WHERE enterprise_id IS NOT NULL
  ORDER BY patient_id, created_at DESC
) preg
WHERE preg.patient_id = b.patient_id
  AND b.enterprise_id IS NULL;

-- ============================================================
-- Backfill appointments: via team_members → pregnancy → enterprise
-- ============================================================
UPDATE public.appointments a
SET enterprise_id = preg.enterprise_id
FROM public.pregnancies preg
JOIN public.team_members tm ON tm.patient_id = a.patient_id
                           AND tm.professional_id = a.professional_id
                           AND tm.pregnancy_id = preg.id
WHERE a.enterprise_id IS NULL
  AND preg.enterprise_id IS NOT NULL;

-- Fallback appointments: sem team_member vinculado → via user_enterprises
UPDATE public.appointments a
SET enterprise_id = ue.enterprise_id
FROM public.user_enterprises ue
WHERE ue.user_id = a.professional_id
  AND a.enterprise_id IS NULL;
```

**GOTCHA**: Billings de profissionais autônomos sem team_members ficam com `enterprise_id = NULL` — esperado.  
**VALIDATE**: `pnpm db:push` → verificar taxa de preenchimento das novas colunas.

---

### Task 4: CREATE migration `20260527000004_rewrite_rls_helper_functions.sql`

**ACTION**: Reescrever `is_same_enterprise` e `is_enterprise_patient`  
**FILE**: `packages/supabase/supabase/migrations/20260527000004_rewrite_rls_helper_functions.sql`

**CONTEÚDO**:

```sql
-- ============================================================
-- Reescrita das funções helper de RLS
-- is_enterprise_staff() — SEM MUDANÇA (mantém users.enterprise_id para staff)
-- ============================================================

-- is_same_enterprise: agora cruza staff.enterprise_id com user_enterprises
CREATE OR REPLACE FUNCTION public.is_same_enterprise(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users staff
    JOIN public.user_enterprises ue ON ue.enterprise_id = staff.enterprise_id
    WHERE staff.id = auth.uid()
      AND staff.user_type IN ('manager', 'secretary')
      AND staff.enterprise_id IS NOT NULL
      AND ue.user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_same_enterprise(uuid) TO anon, authenticated, service_role;

-- is_enterprise_patient: agora ancora em pregnancies.enterprise_id
-- (não mais no criador do paciente)
CREATE OR REPLACE FUNCTION public.is_enterprise_patient(p_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users staff
    WHERE staff.id = auth.uid()
      AND staff.user_type IN ('manager', 'secretary')
      AND staff.enterprise_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.pregnancies preg
        WHERE preg.patient_id = p_patient_id
          AND preg.enterprise_id = staff.enterprise_id
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_enterprise_patient(uuid) TO anon, authenticated, service_role;
```

**GOTCHA**: O backfill de `pregnancies.enterprise_id` (migration 2) deve ter rodado antes. Se algum paciente de empresa não tiver gestação com `enterprise_id`, ele ficará invisível para o staff — verificar dados antes.  
**GOTCHA**: Todas as 11+ policies que usam `is_enterprise_patient` funcionam automaticamente com a nova lógica — não precisam mudar.  
**VALIDATE**: `pnpm db:push` → testar acesso de manager a paciente da empresa.

---

### Task 5: CREATE migration `20260527000005_update_billings_appointments_policies.sql`

**ACTION**: Substituir policies de billings e appointments por versão direta em `enterprise_id`  
**FILE**: `packages/supabase/supabase/migrations/20260527000005_update_billings_appointments_policies.sql`

**CONTEÚDO**:

```sql
-- ============================================================
-- billings — substitui policy baseada em is_enterprise_patient
-- pela coluna enterprise_id direta (mais eficiente e correta)
-- ============================================================

DROP POLICY IF EXISTS "Enterprise staff can view enterprise billings" ON public.billings;
DROP POLICY IF EXISTS "Enterprise staff can create enterprise billings" ON public.billings;
DROP POLICY IF EXISTS "Enterprise staff can update enterprise billings" ON public.billings;
DROP POLICY IF EXISTS "Enterprise staff can delete enterprise billings" ON public.billings;

CREATE POLICY "Enterprise staff can view enterprise billings"
  ON public.billings FOR SELECT
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

CREATE POLICY "Enterprise staff can create enterprise billings"
  ON public.billings FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise billings"
  ON public.billings FOR UPDATE
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise billings"
  ON public.billings FOR DELETE
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

-- ============================================================
-- appointments — substitui policies de SELECT e INSERT
-- ============================================================

DROP POLICY IF EXISTS "Enterprise staff can view enterprise appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can create enterprise appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can update enterprise appointments" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can delete enterprise appointments" ON public.appointments;

-- Também dropar as policies fixadas nas migrations 20260513000002 e 20260513000004
DROP POLICY IF EXISTS "Enterprise staff can create appointments for enterprise professionals" ON public.appointments;
DROP POLICY IF EXISTS "Enterprise staff can view appointments for enterprise professionals" ON public.appointments;

CREATE POLICY "Enterprise staff can view enterprise appointments"
  ON public.appointments FOR SELECT
  USING (
    (enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    ))
    OR (patient_id IS NULL AND professional_id IN (
      SELECT ue.user_id FROM public.user_enterprises ue
      JOIN public.users staff ON staff.enterprise_id = ue.enterprise_id
      WHERE staff.id = auth.uid()
        AND staff.user_type IN ('manager', 'secretary')
    ))
  );

CREATE POLICY "Enterprise staff can create enterprise appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (public.is_enterprise_staff());

CREATE POLICY "Enterprise staff can update enterprise appointments"
  ON public.appointments FOR UPDATE
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  )
  WITH CHECK (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );

CREATE POLICY "Enterprise staff can delete enterprise appointments"
  ON public.appointments FOR DELETE
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid()
        AND user_type IN ('manager', 'secretary')
        AND enterprise_id IS NOT NULL
    )
  );
```

**GOTCHA**: Verificar nomes exatos das policies a dropar em `20260513000002` e `20260513000004` antes de executar.  
**VALIDATE**: `pnpm db:push` → staff consegue ver billings e appointments da empresa.

---

### Task 6: `pnpm db:types` — regenerar tipos TypeScript

**ACTION**: Rodar `pnpm db:types` para regenerar `packages/supabase/src/types/database.types.ts`  
**VALIDATE**: `pnpm check-types` — pode falhar até as tasks de application code serem concluídas; esperado.

---

### Task 7: UPDATE `apps/web/src/actions/join-enterprise-action.ts`

**ACTION**: Substituir `UPDATE users SET enterprise_id` por `INSERT INTO user_enterprises`

**MUDANÇA** (linha 38–41):

```typescript
// ANTES:
const { error } = await supabase
  .from("users")
  .update({ user_type: userType, enterprise_id: enterprise.id })
  .eq("id", user.id);

// DEPOIS:
const { error: typeError } = await supabase
  .from("users")
  .update({ user_type: userType })
  .eq("id", user.id);

if (typeError) throw new Error(typeError.message);

// Para profissionais: adicionar na junction table
if (userType === "professional") {
  const supabaseAdmin = await createServerSupabaseAdmin();
  const { error: joinError } = await supabaseAdmin
    .from("user_enterprises")
    .insert({ user_id: user.id, enterprise_id: enterprise.id });
  if (joinError) throw new Error(joinError.message);
} else {
  // Para manager/secretary: mantém users.enterprise_id
  const { error } = await supabase
    .from("users")
    .update({ enterprise_id: enterprise.id })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
}
```

**IMPORTS a adicionar**: `import { createServerSupabaseAdmin } from "@ventre/supabase/server";`  
**VALIDATE**: `pnpm check-types`

---

### Task 8: UPDATE `apps/web/src/actions/complete-registration-action.ts`

**ACTION**: INSERT em `user_enterprises` em vez de setar `users.enterprise_id` para profissionais

**MUDANÇA** (linha 61–64):

```typescript
// ANTES:
const { error: updateError } = await supabaseAdmin
  .from("users")
  .update({ name: finalName, phone: finalPhone, enterprise_id: invite.enterprise_id })
  .eq("id", signUpData.user.id);

// DEPOIS:
// Atualiza perfil sem enterprise_id (para profissionais)
const { error: updateError } = await supabaseAdmin
  .from("users")
  .update({ name: finalName, phone: finalPhone })
  .eq("id", signUpData.user.id);

if (updateError) throw new Error("Erro ao atualizar perfil.");

// Associa à empresa via junction table (para qualquer user_type no invite)
if (invite.enterprise_id) {
  const { error: joinError } = await supabaseAdmin
    .from("user_enterprises")
    .insert({ user_id: signUpData.user.id, enterprise_id: invite.enterprise_id });
  if (joinError) throw new Error("Erro ao vincular à organização.");
}
```

**GOTCHA**: Remover o `if (updateError) throw` que já existe no arquivo — mesclar com a nova lógica.  
**VALIDATE**: `pnpm check-types`

---

### Task 9: UPDATE `apps/web/src/actions/add-enterprise-professional-action.ts` e `remove-enterprise-professional-action.ts`

**ADD-PROFESSIONAL — MUDANÇAS**:

```typescript
// REMOVER linhas 35-41 (guard de single-enterprise):
// if (targetUser.enterprise_id === profile.enterprise_id) { throw ... }
// if (targetUser.enterprise_id) { throw ... }

// Substituir linhas 43-46 (UPDATE users) por:
const { error: updateError } = await supabaseAdmin
  .from("user_enterprises")
  .insert({ user_id: targetUser.id, enterprise_id: profile.enterprise_id });

// Adicionar guard de duplicata no lugar do antigo:
// (user_enterprises tem PK composta — o insert vai falhar com constraint violation)
// Tratar o erro especificamente:
if (updateError) {
  if (updateError.code === "23505") {
    throw new Error("Este profissional já pertence à sua organização.");
  }
  throw new Error("Erro ao adicionar profissional.");
}

// REMOVER select de enterprise_id do targetUser (linha 19) — não é mais necessário
// Ajustar: .select("id, name, email, user_type") (sem enterprise_id)
```

**REMOVE-PROFESSIONAL — MUDANÇAS**:

```typescript
// Substituir guard (linha 24) — não compara enterprise_id em users:
// Verificar via user_enterprises se o profissional está na empresa
const { data: membership } = await supabaseAdmin
  .from("user_enterprises")
  .select("user_id")
  .eq("user_id", professionalId)
  .eq("enterprise_id", profile.enterprise_id)
  .single();

if (!membership) {
  throw new Error("Este profissional não pertence à sua organização.");
}

// Substituir UPDATE users SET enterprise_id = null (linhas 32-35) por:
const { error: updateError } = await supabaseAdmin
  .from("user_enterprises")
  .delete()
  .eq("user_id", professionalId)
  .eq("enterprise_id", profile.enterprise_id);
```

**VALIDATE**: `pnpm check-types`

---

### Task 10: UPDATE services — pivot queries para usar `user_enterprises` ou `enterprise_id` diretamente

**10a. `services/billing.ts` — `getEnterpriseBillings`:**

Substituir o Step 1 (linhas 64–72) por query direta em `billings.enterprise_id`:

```typescript
// ANTES (lines 64-87): busca professionalIds → billings via splitted_billing
// DEPOIS: query direta
const supabaseAdmin = await createAdmin();
let query = supabaseAdmin
  .from("billings")
  .select(`*, installments(*), patient:patients!billings_patient_id_fkey(id, name)`)
  .eq("enterprise_id", enterpriseId)
  .order("created_at", { ascending: false })
  .order("installment_number", { ascending: true, referencedTable: "installments" });

// professionalId filter: via splitted_billing key (manter lógica atual para filtro individual)
if (professionalId) {
  query = query.not(`splitted_billing->>${professionalId}`, "is", null);
}
```

Para `professionals` (para o dropdown de filtro), ainda buscar via `user_enterprises`:
```typescript
const { data: ueData } = await supabaseAdmin
  .from("user_enterprises")
  .select("user_id, users!inner(id, name, professional_type)")
  .eq("enterprise_id", enterpriseId);
```

**10b. `services/home-enterprise.ts` — `getHomeEnterpriseData`:**

Pivot no Step 3 (linhas 70–74) — de `users.enterprise_id` para `user_enterprises`:

```typescript
// ANTES:
await supabase.from("users").select("id, name, professional_type, avatar_url")
  .eq("enterprise_id", enterpriseId).eq("user_type", "professional");

// DEPOIS:
const { data: ueData } = await supabase
  .from("user_enterprises")
  .select("user_id, users!inner(id, name, professional_type, avatar_url)")
  .eq("enterprise_id", enterpriseId);
const professionals = (ueData ?? []).map((ue) => ue.users).flat();
```

**10c. `services/enterprise-home-patients-cache.ts`:**

Mesma pivot nas linhas 73–77 (dentro do `else` sem `professionalId`):

```typescript
// ANTES:
await supabase.from("users").select("id").eq("enterprise_id", enterpriseId).eq("user_type", "professional");

// DEPOIS:
const { data: ueData } = await supabase
  .from("user_enterprises")
  .select("user_id")
  .eq("enterprise_id", enterpriseId);
const professionalIds = (ueData ?? []).map((ue) => ue.user_id);
```

**10d. `services/professional.ts` — `getEnterpriseProfessionals`:**

```typescript
// ANTES: .eq("enterprise_id", ...).eq("user_type", "professional") em users
// DEPOIS:
const { data: ueData } = await supabase
  .from("user_enterprises")
  .select("user_id, users!inner(id, name, email, professional_type, avatar_url)")
  .eq("enterprise_id", enterpriseId);
```

**10e. `services/enterprise-users.ts` — `getEnterpriseUsers`:**

Para staff: `users WHERE enterprise_id = X AND user_type IN ('manager','secretary')` — **sem mudança**.  
Para profissionais: substituir por `user_enterprises JOIN users`:

```typescript
// Profissionais via junction table
const { data: ueData } = await supabaseAdmin
  .from("user_enterprises")
  .select("user_id, users!inner(id, name, email, professional_type, avatar_url, user_type)")
  .eq("enterprise_id", enterpriseId);
const professionals = (ueData ?? []).map((ue) => ue.users);
```

**VALIDATE**: `pnpm check-types` após todas as mudanças de services.

---

### Task 11: UPDATE `add-billing-action.ts` e `add-appointment-action.ts`

Para definir `enterprise_id` nos inserts após as migrations.

**`add-billing-action.ts`** — `createBilling` no service precisa receber `enterprise_id`:

A lógica de determinar o `enterprise_id` para uma nova cobrança:
1. Se `profile.enterprise_id` existe (staff) → usar `profile.enterprise_id`
2. Se profissional → buscar a gestação do `patient_id` da cobrança e usar `pregnancy.enterprise_id`

```typescript
// Em add-billing-action.ts, antes de chamar createBilling:
let billingEnterpriseId: string | null = profile.enterprise_id ?? null;

if (!billingEnterpriseId && parsedInput.patientId) {
  const { data: pregnancy } = await supabase
    .from("pregnancies")
    .select("enterprise_id")
    .eq("patient_id", parsedInput.patientId)
    .eq("has_finished", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  billingEnterpriseId = pregnancy?.enterprise_id ?? null;
}
```

Passar `billingEnterpriseId` para `createBilling()` e incluir no INSERT de `billings`.

**`add-appointment-action.ts`** — mesma lógica: derivar `enterprise_id` do profissional + paciente via `user_enterprises`:

```typescript
// enterprise_id para appointment: via professional + patient
let appointmentEnterpriseId: string | null = profile.enterprise_id ?? null;

if (!appointmentEnterpriseId && parsedInput.professionalId && parsedInput.patientId) {
  const { data: pregnancy } = await supabaseAdmin
    .from("pregnancies")
    .select("enterprise_id")
    .eq("patient_id", parsedInput.patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  appointmentEnterpriseId = pregnancy?.enterprise_id ?? null;
}
```

**VALIDATE**: `pnpm check-types && pnpm check-types`

---

## Testing Strategy

### Manual Validation (não há testes automatizados no projeto para este fluxo)

| Cenário                                          | Passos                                                                                              | Resultado Esperado                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Professional join enterprise                     | Logar como profissional, usar token de empresa A, depois token de empresa B                         | `user_enterprises` tem 2 linhas; `users.enterprise_id = null` |
| Staff adiciona profissional da empresa A na B    | Manager de empresa B adiciona email de profissional que já é de empresa A                           | INSERT em `user_enterprises`; sem erro de "já vinculado"   |
| Staff remove profissional                        | Manager clica em remover profissional                                                               | DELETE em `user_enterprises`; profissional ainda existe    |
| Staff vê billings isolados                       | Profissional tem billings em empresa A e B; manager de A loga                                       | Só vê billings com `enterprise_id = A`                    |
| Home enterprise atualizada                       | Profissional pertence a empresa A; tem paciente com gestação `enterprise_id = A`                    | Paciente aparece na home da empresa A                     |
| Gestação associada a empresa correta no backfill | Verificar via SQL: `SELECT count(*) FROM pregnancies WHERE enterprise_id IS NOT NULL`               | Maioria das gestações têm enterprise_id preenchido         |

### Edge Cases Checklist

- [ ] Profissional autônomo (sem `user_enterprises`) — billings e appointments com `enterprise_id = NULL`
- [ ] Paciente criado por profissional que está em duas empresas — pregnancy backfill pega a primeira empresa (comportamento aceitável)
- [ ] Tentativa de inserir duplicata em `user_enterprises` (profissional já na empresa) — erro 23505 tratado na action
- [ ] Manager de empresa A tentando ver billings de empresa B — RLS bloqueia
- [ ] Profissional tenta ver `user_enterprises` de outro usuário — RLS bloqueia (policy `professional_view_own_enterprises`)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros de tipo

### Level 2: DATABASE

```bash
pnpm db:push
```

**EXPECT**: Todas as 5 migrations aplicadas sem erros

### Level 3: DATABASE TYPES

```bash
pnpm db:types && pnpm check-types
```

**EXPECT**: Tipos regenerados, TypeScript compila

### Level 4: BIOME (se arquivos JS/TS foram modificados)

```bash
npx biome lint --write --unsafe apps/web/src/actions/join-enterprise-action.ts
npx biome lint --write --unsafe apps/web/src/actions/add-enterprise-professional-action.ts
npx biome lint --write --unsafe apps/web/src/actions/remove-enterprise-professional-action.ts
npx biome lint --write --unsafe apps/web/src/actions/complete-registration-action.ts
npx biome lint --write --unsafe apps/web/src/actions/add-billing-action.ts
npx biome lint --write --unsafe apps/web/src/actions/add-appointment-action.ts
```

### Level 5: SQL VERIFY (via Supabase dashboard ou psql)

```sql
-- Verificar backfill user_enterprises
SELECT COUNT(*) FROM user_enterprises;

-- Verificar que profissionais não têm mais enterprise_id
SELECT COUNT(*) FROM users WHERE user_type = 'professional' AND enterprise_id IS NOT NULL;
-- Esperado: 0

-- Verificar pregnancies com enterprise_id
SELECT COUNT(*), COUNT(enterprise_id) FROM pregnancies;

-- Verificar billings com enterprise_id
SELECT COUNT(*), COUNT(enterprise_id) FROM billings;
```

---

## Acceptance Criteria

- [ ] Profissional pode ser adicionado a múltiplas empresas via `addEnterpriseProfessionalAction`
- [ ] `joinEnterpriseAction` insere em `user_enterprises` (não atualiza `users`)
- [ ] `removeEnterpriseProfessionalAction` faz DELETE em `user_enterprises` (profissional não some do sistema)
- [ ] `getEnterpriseBillings` query direta em `billings.enterprise_id`
- [ ] `getHomeEnterpriseData` usa `user_enterprises` para profissionais
- [ ] RLS: staff de empresa A não vê billings/appointments de empresa B
- [ ] `pnpm check-types` passa com exit 0
- [ ] `pnpm db:push` aplica todas as 5 migrations sem erro
- [ ] Dados existentes preservados (nenhum paciente ou billing perdido)

---

## Completion Checklist

- [ ] Task 1: migration `user_enterprises` criada e aplicada
- [ ] Task 2: migration `pregnancies.enterprise_id` criada e aplicada
- [ ] Task 3: migration `billings` + `appointments enterprise_id` criada e aplicada
- [ ] Task 4: migration helper functions reescritas e aplicada
- [ ] Task 5: migration policies `billings`/`appointments` atualizada e aplicada
- [ ] Task 6: `pnpm db:types` executado
- [ ] Task 7: `join-enterprise-action.ts` atualizado
- [ ] Task 8: `complete-registration-action.ts` atualizado
- [ ] Task 9: `add-enterprise-professional-action.ts` + `remove-enterprise-professional-action.ts` atualizados
- [ ] Task 10: 5 services atualizados (billing, home-enterprise, cache, professional, enterprise-users)
- [ ] Task 11: `add-billing-action.ts` + `add-appointment-action.ts` atualizados
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 2: `pnpm db:push` sem erros
- [ ] Level 3: `pnpm db:types && pnpm check-types` passa
- [ ] Level 5: SQL verify — backfill correto
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk                                                                     | Likelihood | Impact | Mitigation                                                                                          |
| ------------------------------------------------------------------------ | ---------- | ------ | --------------------------------------------------------------------------------------------------- |
| Backfill incompleto de `pregnancies.enterprise_id` deixa pacientes ocultos para staff | MED | HIGH | Verificar count via SQL antes de rodar migration 4. Se < 90% preenchido, investigar. |
| Policy DROP em migration 5 nomeia policy errada (nome exato das migrations 20260513) | MED | HIGH | Ler as migrations 20260513000002 e 20260513000004 e copiar o nome exato das policies antes de executar. |
| `user_enterprises` JOIN em Supabase JS SDK — sintaxe de foreign table     | LOW        | MED    | Testar `select("user_id, users!inner(...)")` no Supabase Studio antes de usar em código. |
| `createBillingSchema` não tem `patientId` disponível na action            | MED        | MED    | Verificar campos do schema antes de Task 11. Pode ser `patient_id` ou `patientId`. |
| Profissionais com `users.enterprise_id = NULL` quebram guards de ações existentes que checam `profile.enterprise_id` para profissionais (ex: activity log) | LOW | LOW | Guards de activity log são `if (profile.enterprise_id)` — simplesmente não logam para profissionais autônomos. Correto. |
| Migrations 20260513 têm policies com nomes ligeiramente diferentes do padrão | MED | MED | Ler os arquivos 20260513 antes de executar migration 5 para confirmar nomes exatos. |

---

## Notes

**Ordem crítica das migrations**: 1 → 2 → 3 → 4 → 5. As funções helper (4) dependem dos dados de `pregnancies.enterprise_id` (2). As policies de billings/appointments (5) dependem das colunas (3).

**`users.enterprise_id` não some**: A coluna permanece para managers e secretaries. A foreign key e o índice existente continuam válidos. Apenas `user_type = 'professional'` tem o campo zerado.

**`safe-action.ts` não muda**: `profile.enterprise_id` continua válido para staff. Para profissionais, ficará `null` — o que é o comportamento correto (profissional autônomo ou multi-empresa).

**Supabase FK syntax para joins**: No SDK do Supabase, para fazer JOIN via FK use `users!inner(campos)` quando a FK aponta de `user_enterprises.user_id` para `users.id`. Testar no Studio antes de usar em código.

**`add-new-professional-action.ts` não está no escopo**: Esta action também seta `users.enterprise_id`. Deixar como tech debt e migrar em follow-up separado.
