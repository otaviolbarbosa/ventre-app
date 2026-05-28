# 007 — Junction table: profissionais em múltiplas empresas

## Objetivo

Permitir que profissionais sejam associadas a mais de uma empresa, mantendo cobranças, agendamentos e gestações isoladas por empresa. A ancoragem principal de acesso migra de `users.enterprise_id` (profissional) para `pregnancies.enterprise_id`.

---

## Contexto do estado atual

```
users.enterprise_id  ──FK──►  enterprises
       │
       └─ usado por:
          - staff (manager/secretary): pertence a 1 empresa
          - professional: também pertence a 1 empresa (limitação atual)

is_enterprise_patient(patient_id)  →  verifica enterprise via criador do paciente
getHomeEnterpriseData()            →  professionals WHERE enterprise_id = X → team_members → patients
getEnterpriseBillings()            →  professionals WHERE enterprise_id = X → billings by professional_id
```

---

## Requisitos

- Cobranças e agendamentos de uma profissional devem ser isolados por empresa — a gestora da empresa A não vê os da empresa B para a mesma profissional
- Os gráficos da home da empresa consideram apenas as gestantes da própria empresa
- Manter integridade dos dados existentes (backfill de todas as relações)
- Criar indexes, atualizar ou criar novas RLS policies conforme necessário
- A profissional decide qual empresa associar ao cuidado de sua gestante (empresa A, empresa B, ou autônoma — sem empresa)
- Adicionar `pregnancies.enterprise_id` nullable
- Se uma gestante/gestação for associada a uma empresa e uma profissional adicionada ao time não pertencer a essa empresa, ela é considerada profissional **externa**
- Se um membro da staff criar uma nova gestante/gestação, essa gestação é automaticamente associada à empresa do staff

---

## O que muda

### Ancoragem principal

A lógica muda de _"quem criou o paciente pertence a qual empresa"_ para _"qual empresa está associada a esta gestação"_. Esse é o núcleo de toda a mudança.

---

## Fase 1 — Junction table `user_enterprises`

### Schema

```sql
CREATE TABLE public.user_enterprises (
  user_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enterprise_id uuid NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  joined_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, enterprise_id)
);

CREATE INDEX user_enterprises_enterprise_id_idx ON public.user_enterprises(enterprise_id);
```

### RLS

```sql
ALTER TABLE public.user_enterprises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_user_enterprises"
  ON public.user_enterprises FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Profissional vê suas próprias empresas
CREATE POLICY "professional_view_own_enterprises"
  ON public.user_enterprises FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Staff vê profissionais da sua empresa
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
```

### Backfill (preserva relações existentes)

```sql
INSERT INTO public.user_enterprises (user_id, enterprise_id, joined_at)
SELECT id, enterprise_id, COALESCE(created_at, now())
FROM public.users
WHERE enterprise_id IS NOT NULL
  AND user_type = 'professional';
```

### Limpar `users.enterprise_id` dos profissionais

A coluna continua existindo para staff. Apenas profissionais têm o campo zerado.

```sql
UPDATE public.users
SET enterprise_id = NULL
WHERE user_type = 'professional' AND enterprise_id IS NOT NULL;
```

---

## Fase 2 — `pregnancies.enterprise_id`

```sql
ALTER TABLE public.pregnancies
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;

CREATE INDEX pregnancies_enterprise_id_idx ON public.pregnancies(enterprise_id);
```

### Backfill

```sql
-- Via staff (manager/secretary): usa users.enterprise_id diretamente
UPDATE public.pregnancies preg
SET enterprise_id = u.enterprise_id
FROM public.users u
WHERE u.id = preg.created_by
  AND u.user_type IN ('manager', 'secretary')
  AND u.enterprise_id IS NOT NULL;

-- Via professional: usa user_enterprises (pega a primeira empresa se houver ambiguidade)
UPDATE public.pregnancies preg
SET enterprise_id = ue.enterprise_id
FROM public.user_enterprises ue
WHERE ue.user_id = preg.created_by
  AND preg.enterprise_id IS NULL;
```

---

## Fase 3 — `billings.enterprise_id` e `appointments.enterprise_id`

Necessário para isolar cobranças e agendamentos por empresa sem depender de JOINs longos. Sem essa coluna, uma profissional em duas empresas teria suas cobranças visíveis para ambas.

```sql
ALTER TABLE public.billings
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;
CREATE INDEX idx_billings_enterprise_id ON public.billings(enterprise_id);

ALTER TABLE public.appointments
  ADD COLUMN enterprise_id uuid REFERENCES public.enterprises(id) ON DELETE SET NULL;
CREATE INDEX idx_appointments_enterprise_id ON public.appointments(enterprise_id);
```

### Backfill

```sql
-- Via team_members → pregnancy → enterprise
UPDATE public.billings b
SET enterprise_id = preg.enterprise_id
FROM public.pregnancies preg
JOIN public.team_members tm ON tm.patient_id = b.patient_id
                            AND tm.professional_id = b.professional_id
                            AND tm.pregnancy_id = preg.id
WHERE b.enterprise_id IS NULL;

-- Fallback: sem team_member linkado — usa enterprise via junction
UPDATE public.billings b
SET enterprise_id = ue.enterprise_id
FROM public.user_enterprises ue
WHERE ue.user_id = b.professional_id
  AND b.enterprise_id IS NULL;

-- Mesma lógica para appointments
UPDATE public.appointments a
SET enterprise_id = preg.enterprise_id
FROM public.pregnancies preg
JOIN public.team_members tm ON tm.patient_id = a.patient_id
                            AND tm.professional_id = a.professional_id
                            AND tm.pregnancy_id = preg.id
WHERE a.enterprise_id IS NULL;
```

---

## Fase 4 — Reescrita das funções helper de RLS

### `is_enterprise_staff()` — sem mudança

Continua usando `users.enterprise_id` para managers/secretaries.

### `is_same_enterprise(p_user_id)` — reescrever

```sql
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
```

### `is_enterprise_patient(p_patient_id)` — reescrever (mudança principal)

```sql
-- Agora ancora em pregnancies.enterprise_id, não mais no criador do paciente
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
```

Todas as policies existentes que usam `is_enterprise_patient` funcionam automaticamente com a nova lógica.

---

## Fase 5 — Novas policies para billings e appointments

```sql
-- Substitui a policy atual baseada em is_enterprise_patient
DROP POLICY "Enterprise staff can view enterprise billings" ON public.billings;
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

DROP POLICY "Enterprise staff can view enterprise appointments" ON public.appointments;
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
```

---

## Fase 6 — Mudanças na aplicação

### Actions

| Action | O que muda |
|---|---|
| `joinEnterpriseAction` | `INSERT INTO user_enterprises` em vez de `UPDATE users SET enterprise_id` |
| `completeRegistrationAction` | `INSERT INTO user_enterprises` em vez de `UPDATE users SET enterprise_id` |
| `addEnterpriseProfessionalAction` | Remove verificação de `enterprise_id` já preenchido; insere em `user_enterprises` |
| `removeEnterpriseProfessionalAction` | `DELETE FROM user_enterprises` em vez de `UPDATE users SET enterprise_id = null` |
| `addPatientAction` | Ao criar a gestação, define `pregnancies.enterprise_id = profile.enterprise_id` |
| `addBillingAction` | Define `enterprise_id` no insert quando `profile.enterprise_id` existir |
| `addAppointmentAction` | Define `enterprise_id` no insert quando `profile.enterprise_id` existir |

### Services

**`getEnterpriseBillings`** — query direta em vez de via profissionais:

```ts
// Antes: filtra profissionais por enterprise_id → filtra billings por professional_id
// Depois: filtra billings diretamente por enterprise_id
supabaseAdmin
  .from("billings")
  .select("..., patient:patients(id, name), installments(*)")
  .eq("enterprise_id", enterpriseId)
```

**`getHomeEnterpriseData` e `fetchEnterpriseHomePatients`** — pivot da query principal:

```ts
// Antes: users WHERE enterprise_id = X → team_members → patients
// Depois: pregnancies WHERE enterprise_id = X → patients + team_members
supabaseAdmin
  .from("pregnancies")
  .select("patient_id")
  .eq("enterprise_id", enterpriseId)
  .eq("has_finished", false)
```

**`get_filtered_patients` (SQL function)** — parâmetro opcional `enterprise_id`:

```sql
AND (p_enterprise_id IS NULL OR pg.enterprise_id = p_enterprise_id)
```

---

## Profissional externa (derivada, sem coluna extra)

```ts
const isExternal = !professional.user_enterprises
  .some(ue => ue.enterprise_id === pregnancy.enterprise_id)
```

Query SQL para listar o time com o flag:

```sql
SELECT
  tm.*,
  NOT EXISTS (
    SELECT 1 FROM public.user_enterprises ue
    WHERE ue.user_id = tm.professional_id
      AND ue.enterprise_id = preg.enterprise_id
  ) AS is_external
FROM public.team_members tm
JOIN public.pregnancies preg ON preg.id = tm.pregnancy_id
WHERE tm.patient_id = $1;
```

---

## Sequência das migrations

| # | Migration | Descrição |
|---|---|---|
| 1 | `user_enterprises` | Cria tabela, RLS, backfill profissionais, zera `users.enterprise_id` para profissionais |
| 2 | `pregnancies.enterprise_id` | Adiciona coluna, backfill via `created_by` |
| 3 | `billings.enterprise_id` + `appointments.enterprise_id` | Adiciona colunas, backfill via team_members → pregnancy |
| 4 | Reescrita das funções helper | `is_same_enterprise`, `is_enterprise_patient` |
| 5 | Update policies billings e appointments | Usa `enterprise_id` direto nas tabelas |
| 6 | Atualização das actions e services | `joinEnterprise`, `addBilling`, `addAppointment`, `getHomeEnterprise`, etc. |

As migrations 1–5 são seguras em sequência. As RLS existentes continuam funcionando até a migration 4, pois o backfill já está completo antes das funções serem reescritas.

---

## O que não muda

- `users.enterprise_id` para managers e secretaries — mantido como está
- `activity_logs.enterprise_id` — mantido, já é UUID explícito
- `registration_invites.enterprise_id` — mantido
- `subscriptions.enterprise_id` — mantido
- `team_members` — sem mudanças de schema
- Todas as policies de profissional autônomo (`is_team_member`) — sem mudanças
