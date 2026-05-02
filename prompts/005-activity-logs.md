# 005 — Activity Logs: Últimas Atualizações

## Objetivo

Implementar um sistema de log de atividades para a home enterprise, dando visibilidade ao staff sobre tudo que as profissionais estão fazendo na plataforma. O log registra ações relevantes (consultas, evoluções, exames, equipe, etc.) e exibe as 10 últimas atualizações na home, com link para uma página paginada completa em `/last-activities`.

---

## 1. Migration — tabela `activity_logs`

**Arquivo:** `packages/supabase/supabase/migrations/20260501000001_activity_logs.sql`

```sql
create table activity_logs (
  id            uuid        primary key default extensions.uuid_generate_v4(),
  action_name   text        not null,
  description   text        not null,
  action_type   text        not null,
  user_id      uuid        not null references users(id) on delete cascade,
  patient_id    uuid        references patients(id) on delete set null,
  enterprise_id uuid        not null references enterprises(id) on delete cascade,
  metadata      jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index activity_logs_enterprise_id_created_at_idx
  on activity_logs (enterprise_id, created_at desc);

create index activity_logs_user_id_idx
  on activity_logs (user_id);

alter table activity_logs enable row level security;

-- Staff vê todos os logs da sua organização
create policy "staff can view enterprise activity logs"
  on activity_logs for select
  using (
    enterprise_id in (
      select enterprise_id
      from enterprise_users
      where user_id = auth.uid()
        and user_type in ('staff', 'manager', 'owner')
    )
  );

-- Apenas o sistema (service_role) insere logs
create policy "service role can insert activity logs"
  on activity_logs for insert
  with check (true);
```

### Campos

| Campo          | Tipo          | Descrição                                                     |
|----------------|---------------|---------------------------------------------------------------|
| `id`           | uuid          | PK                                                            |
| `action_name`  | text          | Nome curto exibido na UI, ex: "Nova consulta agendada"        |
| `description`  | text          | Frase completa, ex: "Consulta pré-natal para Maria Silva com Dr. João marcada para 05/05" |
| `action_type`  | text          | Categoria: `appointment`, `patient`, `team`, `clinical`, `exam`, `vaccine`, `billing`, `enterprise` |
| `user_id`     | uuid          | ID da usuária que realizou a ação (FK → users)                |
| `patient_id`   | uuid nullable | Paciente envolvida na ação (null quando não se aplica)        |
| `enterprise_id`| uuid          | Organização à qual o log pertence                             |
| `metadata`     | jsonb         | Dados extras para contexto: `appointment_id`, `exam_type`, `billing_status`, etc. |
| `created_at`   | timestamptz   | Data/hora UTC da ação                                         |

---

## 2. Helper — `insertActivityLog`

**Arquivo:** `apps/web/src/lib/activity-log.ts`

Função server-side chamada ao final de cada action relevante. Usa `supabaseAdmin` para bypassar RLS (apenas o sistema insere logs).

```ts
import type { SupabaseClient } from "@supabase/supabase-js"

type InsertActivityLogParams = {
  supabaseAdmin: SupabaseClient
  actionName: string
  description: string
  actionType:
    | "appointment"
    | "patient"
    | "team"
    | "clinical"
    | "exam"
    | "vaccine"
    | "billing"
    | "enterprise"
  userId: string
  enterpriseId: string
  patientId?: string | null
  metadata?: Record<string, unknown>
}

export async function insertActivityLog({
  supabaseAdmin,
  actionName,
  description,
  actionType,
  userId,
  enterpriseId,
  patientId,
  metadata = {},
}: InsertActivityLogParams) {
  const { error } = await supabaseAdmin.from("activity_logs").insert({
    action_name: actionName,
    description,
    action_type: actionType,
    user_id: userId,
    enterprise_id: enterpriseId,
    patient_id: patientId ?? null,
    metadata,
  })

  if (error) {
    console.error("[insertActivityLog]", error)
    // não lança erro — falha no log não deve quebrar a action principal
  }
}
```

> **Importante:** a falha no log nunca deve propagar erro para o usuário. É uma operação de observabilidade.

---

## 3. Mapeamento de Actions → Logs

Para cada action abaixo, chamar `insertActivityLog` ao final, após a operação principal ter sido concluída com sucesso.

O `enterpriseId` é obtido via query ao perfil da usuária autenticada no contexto da action (já disponível via `ctx.user` + consulta a `enterprise_users`).

### 3.1 Consultas / Agenda

| Action | `action_name` | `action_type` | Dados necessários |
|---|---|---|---|
| `addAppointmentAction` | `"Nova consulta agendada"` ou `"Novo encontro agendado"` | `appointment` | Nome da paciente (query), nome do profissional (query), data, hora, tipo |
| `updateAppointmentAction` | `"Consulta atualizada"` | `appointment` | ID do appointment → lookup nome da paciente + profissional |
| `cancelDayAppointmentsAction` | `"Consultas canceladas"` | `appointment` | Data, quantidade de consultas canceladas |

**Exemplo de description:**
- `"Consulta pré-natal agendada para Maria Silva com Dra. Ana Souza — 10/05 às 14h"`
- `"Encontro preparatório agendado para João Lopes — 12/05 às 09h"`
- `"3 consultas canceladas para o dia 15/05"`

### 3.2 Gestantes

| Action | `action_name` | `action_type` | Dados necessários |
|---|---|---|---|
| `addPatientAction` | `"Nova gestante cadastrada"` | `patient` | Nome da paciente (disponível no input) |
| `updatePatientAction` | `"Dados da gestante atualizados"` | `patient` | Nome da paciente (query por ID) |
| `finishPatientCareAction` | `"Acompanhamento encerrado"` | `patient` | Nome da paciente (query por ID), método de parto |
| `deletePatientAction` | `"Gestante removida"` | `patient` | Apenas ID disponível |

**Exemplo de description:**
- `"Maria Silva foi cadastrada como nova gestante"`
- `"Dados de Maria Silva foram atualizados"`
- `"Acompanhamento de Maria Silva encerrado (parto cesariana)"`

### 3.3 Equipe

| Action | `action_name` | `action_type` | Dados necessários |
|---|---|---|---|
| `addProfessionalToTeamAction` | `"Profissional adicionada à equipe"` | `team` | Nome da paciente, nome da profissional, especialidade |
| `addBackupProfessionalAction` | `"Profissional backup adicionada"` | `team` | Nome da paciente, nome da profissional, especialidade |
| `removeBackupProfessionalAction` | `"Profissional backup removida"` | `team` | Nome da paciente, nome da profissional (lookup por teamMemberId) |
| `addEnterpriseProfessionalAction` | `"Profissional adicionada à organização"` | `enterprise` | Email/nome da profissional adicionada |
| `removeEnterpriseProfessionalAction` | `"Profissional removida da organização"` | `enterprise` | Nome/ID da profissional removida |

**Exemplo de description:**
- `"Dra. Ana Souza (obstetra) foi adicionada à equipe de Maria Silva"`
- `"Profissional backup adicionada à equipe de Maria Silva"`
- `"Dra. Carla Lima foi adicionada à organização"`

### 3.4 Evolução Clínica

| Action | `action_name` | `action_type` | Dados necessários |
|---|---|---|---|
| `createEvolutionAction` | `"Evolução registrada"` | `clinical` | Nome da paciente (disponível no resultado da query) |
| `addPregnancyEvolutionAction` | `"Evolução de gravidez registrada"` | `clinical` | Nome da paciente (lookup por pregnancyId) |
| `upsertPatientPrenatalFieldsAction` | `"Cartão pré-natal atualizado"` | `clinical` | Nome da paciente (lookup por patientId) |
| `upsertObstetricHistoryAction` | `"Histórico obstétrico atualizado"` | `clinical` | Nome da paciente (lookup por patientId) |
| `upsertRiskFactorsAction` | `"Fatores de risco atualizados"` | `clinical` | Nome da paciente (lookup por pregnancyId) |

**Exemplo de description:**
- `"Nova evolução registrada para Maria Silva"`
- `"Cartão pré-natal de Maria Silva foi atualizado"`
- `"Fatores de risco de Maria Silva foram atualizados"`

### 3.5 Exames

| Action | `action_name` | `action_type` | Dados necessários |
|---|---|---|---|
| `addLabExamAction` | `"Exame laboratorial registrado"` | `exam` | Nome da paciente (lookup por pregnancyId) |
| `updateLabExamAction` | `"Exame laboratorial atualizado"` | `exam` | Lookup por examId → paciente |
| `deleteLabExamAction` | `"Exame laboratorial removido"` | `exam` | Apenas examId |
| `addUltrasoundAction` | `"Ultrassom registrado"` | `exam` | Nome da paciente (lookup por pregnancyId) |
| `addOtherExamAction` | `"Exame registrado"` | `exam` | Nome da paciente (lookup por pregnancyId) |
| `upsertVaccineRecordAction` | `"Registro de vacina atualizado"` | `vaccine` | Nome da paciente (lookup por pregnancyId) |

### 3.6 Financeiro

| Action | `action_name` | `action_type` | Dados necessários |
|---|---|---|---|
| `addBillingAction` | `"Nova cobrança criada"` | `billing` | Nome da paciente, valor (lookup por patientId) |
| `updateBillingAction` | `"Status de cobrança atualizado"` | `billing` | Status novo, lookup por billingId → paciente |

### 3.7 Convites

| Action | `action_name` | `action_type` | Dados necessários |
|---|---|---|---|
| `inviteProfessionalDirectAction` | `"Profissional convidada para equipe"` | `team` | Nome da paciente, nome da profissional convidada |
| `createInviteAction` | `"Convite de equipe gerado"` | `team` | Nome da paciente |

---

## 4. Novo Service — `activity-logs.ts`

**Arquivo:** `apps/web/src/services/activity-logs.ts`

```ts
export type ActivityLog = {
  id: string
  action_name: string
  description: string
  action_type: string
  user: {
    id: string
    name: string
  }
  patient_id: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export async function getEnterpriseActivityLogs(
  supabase: SupabaseClient,
  enterpriseId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ logs: ActivityLog[]; total: number }> {
  const { limit = 10, offset = 0 } = options

  const [logsResult, countResult] = await Promise.all([
    supabase
      .from("activity_logs")
      .select("id, action_name, description, action_type, user_id, patient_id, created_at, metadata, user:users!user_id(id, name)")
      .eq("enterprise_id", enterpriseId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),

    supabase
      .from("activity_logs")
      .select("*", { count: "exact", head: true })
      .eq("enterprise_id", enterpriseId),
  ])

  if (logsResult.error) throw new Error(logsResult.error.message)

  return {
    logs: logsResult.data as ActivityLog[],
    total: countResult.count ?? 0,
  }
}
```

---

## 5. Novas Actions

### `getActivityLogsAction` (para home)

**Arquivo:** `apps/web/src/actions/get-activity-logs-action.ts`

- Usa `authActionClient`
- Input: `z.object({})` (sem parâmetros)
- Verifica se o usuário é staff/manager da enterprise
- Retorna as 10 últimas `ActivityLog[]`

### `getActivityLogsPaginatedAction` (para `/last-activities`)

**Arquivo:** `apps/web/src/actions/get-activity-logs-paginated-action.ts`

- Usa `authActionClient`
- Input: `z.object({ page: z.number().int().min(1).default(1) })`
- Page size: 20 registros
- Retorna `{ logs: ActivityLog[], total: number, page: number, totalPages: number }`

---

## 6. Alterações na Home Enterprise

**Arquivo:** `apps/web/src/screens/home-enterprise-screen.tsx`

### Condição de exibição

A seção "Últimas Atualizações" só é exibida para usuárias com `user_type === 'staff'` ou `user_type === 'manager'`. O `profile` já está disponível como prop.

### Estrutura da seção

Adicionar abaixo do gráfico de donut (e da agenda, no mobile), antes do final do `div` principal:

```tsx
{isStaff && (
  <LastActivitiesSection logs={activityLogs} isLoading={isLoadingLogs} />
)}
```

### Layout no grid

No desktop, a seção de "Últimas Atualizações" fica abaixo do grid de donut+agenda, ocupando largura total (ou uma terceira coluna dependendo de espaço). No mobile, aparece abaixo da agenda.

### Fetch dos dados

Chamar `getActivityLogsAction` em paralelo com `getHomeEnterpriseDataAction` usando `useAction` separado. Mostrar skeleton durante carregamento.

---

## 7. Componente `LastActivitiesSection`

**Arquivo:** `apps/web/src/components/shared/last-activities-section.tsx`

### Props
```ts
type LastActivitiesSectionProps = {
  logs: ActivityLog[]
  isLoading: boolean
}
```

### Estrutura visual

```
┌─────────────────────────────────────────────┐
│ Últimas Atualizações          [Ver todas →] │
├─────────────────────────────────────────────┤
│ ● Nova consulta agendada           há 5 min │
│   Consulta pré-natal para Maria Silva       │
│   com Dra. Ana Souza — 10/05 às 14h         │
│                                             │
│ ● Evolução registrada             há 20 min │
│   Nova evolução registrada para João Lopes  │
│   por Enf. Carla Lima                       │
│                                             │
│  ... (até 10 itens)                         │
└─────────────────────────────────────────────┘
```

- Ícone colorido por `action_type`:
  - `appointment` → `Calendar` (azul/primary)
  - `patient` → `UserPlus` (verde)
  - `team` → `Users` (roxo)
  - `clinical` → `FileHeart` (rosa)
  - `exam` → `FlaskConical` (laranja)
  - `vaccine` → `Syringe` (teal)
  - `billing` → `DollarSign` (amarelo)
  - `enterprise` → `Building2` (cinza)

- Timestamp relativo usando `dayjs().from()` (ex: "há 5 minutos", "há 2 horas")
- Nome da atora exibido em destaque na descrição
- Estado vazio: "Nenhuma atividade registrada ainda."
- Skeleton: 5 itens com linhas de loading
- Botão "Ver todas" → `Link href="/last-activities"`

---

## 8. Nova Rota `/last-activities`

### Arquivos

```
apps/web/src/app/(dashboard)/last-activities/
  page.tsx        → Server Component com header + client screen
apps/web/src/screens/
  last-activities-screen.tsx   → Client Component com estado de paginação
```

### `page.tsx`

```tsx
// Server Component
export default async function LastActivitiesPage() {
  const profile = await getCurrentProfile()
  if (!isStaff(profile)) redirect("/home")

  return (
    <div className="flex h-full flex-col">
      <Header title="Últimas Atualizações" />
      <LastActivitiesScreen profile={profile} />
    </div>
  )
}
```

### `last-activities-screen.tsx`

- Client Component
- Estado: `page` (número da página atual), `logs`, `total`, `isLoading`
- Chama `getActivityLogsPaginatedAction` ao montar e ao trocar de página
- Paginação: botões "Anterior" / "Próxima" + contador "Página X de Y"
- Lista de itens com mesmo visual do `LastActivitiesSection` mas mais detalhada (pode mostrar metadados adicionais)
- Filtro por `action_type` (opcional, fase 2)

### Layout da lista
```
┌──────────────────────────────────────────────────────┐
│ [ícone] Nova consulta agendada          01/05 14:32  │
│         Consulta pré-natal para Maria Silva          │
│         com Dra. Ana Souza — 10/05 às 14h            │
│         Por: Dra. Ana Souza                          │
├──────────────────────────────────────────────────────┤
│ [ícone] Evolução registrada             01/05 14:15  │
│         Nova evolução registrada para João Lopes     │
│         Por: Enf. Carla Lima                         │
└──────────────────────────────────────────────────────┘

                   < Anterior  Página 1 de 5  Próxima >
```

---

## 9. Navigation

### Sidebar e Bottom Nav

Verificar se `/last-activities` precisa de entrada de navegação. Provavelmente **não** — é acessível apenas via link na home. Não adicionar ao menu principal.

---

## 10. Ordem de Implementação

1. **Migration** — criar e aplicar `20260501000001_activity_logs.sql`, rodar `pnpm db:types`
2. **Helper** — criar `apps/web/src/lib/activity-log.ts`
3. **Actions de leitura** — `getActivityLogsAction` e `getActivityLogsPaginatedAction`
4. **Instrumentar actions** — adicionar chamadas `insertActivityLog` em cada action mapeada na seção 3, priorizando as mais frequentes:
   - Priority 1: `addAppointmentAction`, `createEvolutionAction`, `addPatientAction`, `addProfessionalToTeamAction`
   - Priority 2: `upsertPatientPrenatalFieldsAction`, `addLabExamAction`, `addUltrasoundAction`, `upsertVaccineRecordAction`
   - Priority 3: demais actions
5. **Componente** — criar `LastActivitiesSection`
6. **Home screen** — integrar `LastActivitiesSection` em `home-enterprise-screen.tsx`
7. **Rota** — criar `app/(dashboard)/last-activities/` + `LastActivitiesScreen`
8. **Teste manual** — verificar que logs aparecem na home e na página paginada

---

## 11. Observações Técnicas

- **`enterpriseId` nas actions:** nem todas as actions têm acesso direto ao `enterprise_id`. Será necessário buscá-lo via `enterprise_users` table usando `ctx.user.id`. Criar utilitário `getEnterpriseIdForUser(supabase, userId)` para reutilização.
- **Lookups de nome:** várias actions têm apenas IDs (patient, professional). Para montar descriptions ricas, será necessário fazer queries adicionais dentro de cada action após a operação principal. Usar `supabase` (não `supabaseAdmin`) para esses lookups.
- **Performance:** o `insertActivityLog` deve ser fire-and-forget onde possível — usar `await` mas não deixar falha quebrar o fluxo principal.
- **Fuso horário:** armazenar UTC no banco, exibir no fuso do browser usando `dayjs` com `timezone` plugin (já configurado no projeto).
- **RLS insert policy:** usar `supabaseAdmin` para insert, pois a policy permite apenas `service_role`. Nunca chamar insert de client-side.
- **Paginação server-side:** a query usa `.range(offset, offset + limit - 1)` do Supabase — não trazer todos os registros.
