# Feature: Activity Logs — Últimas Atualizações

## Summary

Add an `activity_logs` table to record all relevant mutations performed by professionals and staff. Instrument the most impactful server actions to write log entries (fire-and-forget via `supabaseAdmin`). Display the 10 latest logs on the enterprise home screen in a new "Últimas Atualizações" section (visible only to staff/managers). Provide a full paginated view at `/last-activities`.

## User Story

As a manager or secretary (staff)
I want to see a feed of recent actions taken by all professionals in my organization
So that I have visibility into what the team is doing without having to navigate each patient's profile

## Problem Statement

Staff have no centralized view of team activity. They must navigate individual patient profiles to track what professionals are doing. There is currently no audit trail or activity feed in the enterprise home screen.

## Solution Statement

Introduce a new `activity_logs` Postgres table. Instrument existing server actions to call `insertActivityLog()` (a fire-and-forget helper using `ctx.supabaseAdmin`) after each successful mutation. Add a `LastActivitiesSection` component to the enterprise home screen, conditionally shown for `isStaff(profile)` users. Create a `/last-activities` route with paginated server-side rendering mirroring the `patients/history` page pattern.

## Metadata

| Field            | Value                                                                           |
|------------------|---------------------------------------------------------------------------------|
| Type             | NEW_CAPABILITY                                                                  |
| Complexity       | HIGH                                                                            |
| Systems Affected | database, server-actions, services, screens, routes                             |
| Dependencies     | next-safe-action, @supabase/supabase-js, supabase RLS, @ventre/supabase/types  |
| Estimated Tasks  | 16                                                                              |

---

## UX Design

### Before State

```
╔══════════════════════════════════════════════════════════════════════════╗
║                          HOME ENTERPRISE (BEFORE)                        ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   [Action Cards: Equipe / Gestantes / Agenda / Financeiro / Perfil]      ║
║                                                                          ║
║   ┌─────────────────────────────┐   ┌─────────────────────────────┐     ║
║   │  Gestantes por Profissional │   │  Agenda                     │     ║
║   │  [Donut chart]              │   │  [Timeline of appointments] │     ║
║   └─────────────────────────────┘   └─────────────────────────────┘     ║
║                                                                          ║
║   USER_FLOW: Staff lands on home, sees chart and appointments only       ║
║   PAIN_POINT: No visibility into what professionals are actually doing   ║
║   DATA_FLOW: getHomeEnterpriseDataAction → homeData.professionals        ║
║                                           homeData.upcomingAppointments  ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔══════════════════════════════════════════════════════════════════════════╗
║                          HOME ENTERPRISE (AFTER)                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║   [Action Cards: Equipe / Gestantes / Agenda / Financeiro / Perfil]      ║
║                                                                          ║
║   ┌────────────────────────────┐   ┌─────────────────────────────┐      ║
║   │  Gestantes por Profissional│   │  Agenda                     │      ║
║   │  [Donut chart]             │   │  [Timeline of appointments] │      ║
║   └────────────────────────────┘   └─────────────────────────────┘      ║
║                                                                          ║
║   ┌──────────────────────────────────────────────────────────────┐       ║
║   │ Últimas Atualizações                         [Ver todas →]   │       ║
║   ├──────────────────────────────────────────────────────────────┤       ║
║   │ 🔵 Nova consulta agendada                          há 5 min  │       ║
║   │    Consulta pré-natal para Maria Silva com Dra. Ana Souza    │       ║
║   │ 🟢 Nova gestante cadastrada                       há 20 min  │       ║
║   │    João Lopes foi cadastrado por Enf. Carla Lima             │       ║
║   │ ... (até 10 itens)                                           │       ║
║   └──────────────────────────────────────────────────────────────┘       ║
║                                                                          ║
║   USER_FLOW: Staff sees latest 10 activities inline on home screen       ║
║   VALUE_ADD: Immediate visibility into team activity without navigation  ║
║   DATA_FLOW: getActivityLogsAction → activityLogs[] → LastActivitiesSection ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝

/last-activities PAGE:
╔══════════════════════════════════════════════════════════════════════════╗
║  Últimas Atualizações                                                    ║
╠══════════════════════════════════════════════════════════════════════════╣
║  [ícone] Nova consulta agendada             01/05 14:32                  ║
║          Consulta pré-natal para Maria Silva com Dra. Ana Souza          ║
║          Por: Dra. Ana Souza                                             ║
║  ─────────────────────────────────────────────────────────────────────   ║
║  [ícone] Evolução registrada                01/05 14:15                  ║
║          Nova evolução registrada para João Lopes                        ║
║          Por: Enf. Carla Lima                                            ║
║  ─────────────────────────────────────────────────────────────────────   ║
║  ... (20 por página)                                                     ║
║                                                                          ║
║           < Anterior    Página 1 de 5    Próxima >                       ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                              | Before               | After                                    | User Impact                          |
|---------------------------------------|----------------------|------------------------------------------|--------------------------------------|
| `home-enterprise-screen.tsx`          | No activity section  | `LastActivitiesSection` (staff-only)     | Staff sees last 10 actions inline    |
| `app/(dashboard)/last-activities/`    | Route doesn't exist  | Paginated list of all logs               | Staff can drill into full history    |
| Each instrumented action              | No side effects      | `insertActivityLog()` called on success  | Logs accumulate automatically        |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `apps/web/src/lib/safe-action.ts` | 1-22 | Exact `ctx` shape — `supabaseAdmin`, `user`, `profile` |
| P0 | `apps/web/src/actions/add-patient-action.ts` | 1-50 | Full ctx destructure + `supabaseAdmin` + `revalidateTag` pattern |
| P0 | `apps/web/src/actions/create-evolution-action.ts` | 1-50 | Fire-and-forget side effect pattern to mirror for log insert |
| P0 | `apps/web/src/lib/access-control.ts` | all | `isStaff()` — checks `user_type === 'manager' || 'secretary'` |
| P1 | `apps/web/src/services/home-enterprise.ts` | all | Service pattern + join syntax + types |
| P1 | `apps/web/src/actions/get-home-enterprise-data-action.ts` | all | No-input action pattern |
| P1 | `apps/web/src/screens/home-enterprise-screen.tsx` | all | Where to add `LastActivitiesSection` |
| P1 | `apps/web/app/(dashboard)/patients/history/page.tsx` | all | Paginated route pattern to mirror exactly |
| P2 | `packages/supabase/supabase/migrations/20260410000001_registration_invites.sql` | all | Migration DDL convention (uppercase SQL, public. prefix, GRANT) |
| P2 | `apps/web/src/components/shared/patients-donut-chart.tsx` | all | Shared component pattern in home screen |

---

## Patterns to Mirror

**SAFE-ACTION CTX (read before every task):**
```typescript
// SOURCE: apps/web/src/lib/safe-action.ts:6-22
export const authActionClient = actionClient.use(async ({ next }) => {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autorizado");
  const { data: profile } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!profile) throw new Error("Usuário não encontrado");
  const supabaseAdmin = await createServerSupabaseAdmin();
  return next({ ctx: { supabase, supabaseAdmin, user, profile } });
});
// ctx = { supabase, supabaseAdmin, user, profile }
// profile.enterprise_id → enterprise membership (no enterprise_users table)
// profile.user_type → 'professional' | 'manager' | 'secretary' | 'patient'
```

**ACTION PATTERN (mutation with supabaseAdmin + revalidateTag):**
```typescript
// SOURCE: apps/web/src/actions/add-patient-action.ts:10-47
export const addPatientAction = authActionClient
  .inputSchema(createPatientSchema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const patient = await createPatient(supabaseAdmin, user.id, parsedInput);
    revalidateTag(`home-patients-${user.id}`, { expire: 300 });
    if (profile.enterprise_id) {
      revalidateTag(`enterprise-patients-${profile.enterprise_id}`, { expire: 300 });
    }
    return { patient };
  });
// NOTE: .inputSchema() not .schema()
// NOTE: supabaseAdmin comes from ctx — do NOT call createServerSupabaseAdmin() again
// NOTE: profile.enterprise_id is the only way to get enterprise ID in actions
```

**FIRE-AND-FORGET SIDE EFFECT:**
```typescript
// SOURCE: apps/web/src/actions/create-evolution-action.ts:14-47
export const createEvolutionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { data: evolution, error } = await supabase
      .from("patient_evolutions")
      .insert({ patient_id: parsedInput.patientId, professional_id: user.id, content: parsedInput.data.content })
      .select("*, professional:professional_id(id, name)")
      .single();
    if (error) throw new Error(error.message);
    
    // fire-and-forget side effect — NOT awaited, error doesn't break main flow
    sendNotificationToTeam(parsedInput.patientId, user.id, { ... });
    
    return { evolution };
  });
// MIRROR THIS: insertActivityLog call goes here, between main operation and return
// NOTE: patient.name available at line 31 via Promise.all fetch
```

**NO-INPUT ACTION:**
```typescript
// SOURCE: apps/web/src/actions/get-home-enterprise-data-action.ts:1-11
"use server";
import { authActionClient } from "@/lib/safe-action";
import { getHomeEnterpriseData } from "@/services/home-enterprise";
import { z } from "zod";

export const getHomeEnterpriseDataAction = authActionClient
  .inputSchema(z.object({}))
  .action(async () => {
    return await getHomeEnterpriseData();
  });
```

**SUPABASE JOIN SYNTAX:**
```typescript
// SOURCE: apps/web/src/services/home-enterprise.ts:160-174
const { data: appointments } = await supabaseAdmin
  .from("appointments")
  .select(
    `*,
     patient:patients!appointments_patient_id_fkey(id, name, pregnancies(dum)),
     professional:users!appointments_professional_id_fkey(id, name)`,
  )
  .eq("enterprise_id", enterpriseId)
  .order("created_at", { ascending: false })
  .limit(10);
// Use FK constraint name for explicit join disambiguation
```

**PAGINATED SERVER COMPONENT PAGE:**
```typescript
// SOURCE: apps/web/app/(dashboard)/patients/history/page.tsx:8-64
export default async function PatientsHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);
  const { profile } = await getServerAuth();
  if (isStaff(profile) && profile?.enterprise_id) {
    // fetch data, pass to screen component
    return <ScreenComponent currentPage={currentPage} ... />;
  }
  redirect("/home");
}
```

**MIGRATION DDL:**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260410000001_registration_invites.sql
CREATE TABLE public.registration_invites (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  enterprise_id uuid        NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registration_invites_email_enterprise_idx
  ON public.registration_invites (email, enterprise_id)
  WHERE completed_at IS NULL;
ALTER TABLE public.registration_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_manage_invites"
  ON public.registration_invites FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "staff_select_own_enterprise_invites"
  ON public.registration_invites FOR SELECT TO authenticated
  USING (
    enterprise_id IN (
      SELECT enterprise_id FROM public.users
      WHERE id = auth.uid() AND user_type IN ('manager', 'secretary') AND enterprise_id IS NOT NULL
    )
  );
GRANT SELECT ON public.registration_invites TO authenticated;
GRANT ALL   ON public.registration_invites TO service_role;
-- KEY CONVENTIONS: uppercase SQL, public. prefix, uuid_generate_v4(), timestamptz, GRANT at end
```

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `packages/supabase/supabase/migrations/20260501000001_activity_logs.sql` | CREATE | DDL for activity_logs table + RLS + indexes |
| `apps/web/src/lib/activity-log.ts` | CREATE | `insertActivityLog()` helper for actions |
| `apps/web/src/services/activity-logs.ts` | CREATE | Service: query logs for enterprise with pagination |
| `apps/web/src/actions/get-activity-logs-action.ts` | CREATE | Action: last 10 logs for home screen |
| `apps/web/src/actions/get-activity-logs-paginated-action.ts` | CREATE | Action: paginated logs for /last-activities |
| `apps/web/src/actions/add-appointment-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/create-evolution-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/add-patient-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/add-professional-to-team-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/upsert-patient-prenatal-fields-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/add-lab-exam-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/add-ultrasound-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/upsert-vaccine-record-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/finish-patient-care-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/actions/add-enterprise-professional-action.ts` | UPDATE | Add insertActivityLog call |
| `apps/web/src/components/shared/last-activities-section.tsx` | CREATE | Widget for home screen (10 latest) |
| `apps/web/src/screens/home-enterprise-screen.tsx` | UPDATE | Add LastActivitiesSection + activity fetch |
| `apps/web/app/(dashboard)/last-activities/page.tsx` | CREATE | Server Component route for paginated view |
| `apps/web/src/screens/last-activities-screen.tsx` | CREATE | Client Component: paginated activity list |

---

## NOT Building (Scope Limits)

- No real-time updates (WebSocket/Supabase Realtime) — polling/on-mount fetch is sufficient for v1
- No filtering by `action_type` in the UI — simple chronological list only (phase 2)
- No deletion of log entries — logs are append-only by design
- No professional-facing activity view — this is staff-only
- Do not add `/last-activities` to sidebar or bottom-nav — accessible only via home screen link
- Do not instrument these lower-priority actions in v1: `updateAppointmentAction`, `deletePatientAction`, `updatePatientAction`, `updateBillingAction`, `addBillingAction`, `addOtherExamAction`, `cancelDayAppointmentsAction`, `upsertRiskFactorsAction`, `upsertObstetricHistoryAction`, `inviteProfessionalDirectAction`

---

## Step-by-Step Tasks

Execute strictly in order. Each task is atomic and independently verifiable.

---

### Task 1: CREATE migration `20260501000001_activity_logs.sql`

- **ACTION**: CREATE new migration file
- **FILE**: `packages/supabase/supabase/migrations/20260501000001_activity_logs.sql`
- **IMPLEMENT**:
```sql
CREATE TABLE public.activity_logs (
  id            uuid        PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  action_name   text        NOT NULL,
  description   text        NOT NULL,
  action_type   text        NOT NULL,
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  patient_id    uuid        REFERENCES public.patients(id) ON DELETE SET NULL,
  enterprise_id uuid        NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  metadata      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_logs_enterprise_id_created_at_idx
  ON public.activity_logs (enterprise_id, created_at DESC);

CREATE INDEX activity_logs_user_id_idx
  ON public.activity_logs (user_id);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL   ON public.activity_logs TO service_role;
```
- **GOTCHA**: Use uppercase SQL keywords — codebase convention. Use `public.` prefix on all table names. `user_type IN ('manager', 'secretary')` — these are the exact DB enum values for staff (NOT 'staff' or 'owner').
- **GOTCHA**: The composite index on `(enterprise_id, created_at DESC)` is critical for the paginated query performance.
- **VALIDATE**: `pnpm db:push` — must apply cleanly. Then `pnpm db:types` — must regenerate without error. After types regenerate, `Tables<"activity_logs">` must exist in `packages/supabase/src/types/database.types.ts`.

---

### Task 2: CREATE `apps/web/src/lib/activity-log.ts`

- **ACTION**: CREATE helper function
- **IMPLEMENT**:
```typescript
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

type ActionType =
  | "appointment"
  | "patient"
  | "team"
  | "clinical"
  | "exam"
  | "vaccine"
  | "billing"
  | "enterprise";

type InsertActivityLogParams = {
  supabaseAdmin: SupabaseClient;
  actionName: string;
  description: string;
  actionType: ActionType;
  userId: string;
  enterpriseId: string;
  patientId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function insertActivityLog({
  supabaseAdmin,
  actionName,
  description,
  actionType,
  userId,
  enterpriseId,
  patientId,
  metadata = {},
}: InsertActivityLogParams): Promise<void> {
  const { error } = await supabaseAdmin.from("activity_logs").insert({
    action_name: actionName,
    description,
    action_type: actionType,
    user_id: userId,
    enterprise_id: enterpriseId,
    patient_id: patientId ?? null,
    metadata,
  });

  if (error) {
    console.error("[insertActivityLog]", error.message);
    // failure never propagates — logging is observability only
  }
}
```
- **MIRROR**: Fire-and-forget side effect pattern from `create-evolution-action.ts:39`
- **GOTCHA**: `"use server"` directive required — this runs server-side only. Do NOT throw on error — a log failure must never break the calling action.
- **GOTCHA**: `supabaseAdmin` is passed in from the calling action's `ctx` — do NOT import `createServerSupabaseAdmin` here.
- **VALIDATE**: `pnpm check-types` — must pass.

---

### Task 3: CREATE `apps/web/src/services/activity-logs.ts`

- **ACTION**: CREATE service for querying logs
- **IMPLEMENT**:
```typescript
import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityLog = {
  id: string;
  action_name: string;
  description: string;
  action_type: string;
  user: { id: string; name: string } | null;
  user_id: string;
  patient_id: string | null;
  enterprise_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function getEnterpriseActivityLogs(
  supabaseAdmin: SupabaseClient,
  enterpriseId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<{ logs: ActivityLog[]; total: number }> {
  const { limit = 10, offset = 0 } = options;

  const [logsResult, countResult] = await Promise.all([
    supabaseAdmin
      .from("activity_logs")
      .select("id, action_name, description, action_type, user_id, patient_id, enterprise_id, created_at, metadata, user:users!activity_logs_user_id_fkey(id, name)")
      .eq("enterprise_id", enterpriseId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),

    supabaseAdmin
      .from("activity_logs")
      .select("*", { count: "exact", head: true })
      .eq("enterprise_id", enterpriseId),
  ]);

  if (logsResult.error) throw new Error(logsResult.error.message);

  return {
    logs: logsResult.data as ActivityLog[],
    total: countResult.count ?? 0,
  };
}
```
- **MIRROR**: `home-enterprise.ts:160-174` join syntax pattern; `home-enterprise.ts:61-100` `Promise.all` + error check pattern
- **GOTCHA**: The FK name for the user join must match the actual constraint name. If Supabase can't resolve `activity_logs_user_id_fkey`, try `users!user_id` (shorter alias). Verify after `pnpm db:types`.
- **GOTCHA**: Use `supabaseAdmin` to bypass RLS — the select RLS policy only covers `authenticated` role but the service may be called from contexts that need admin.
- **VALIDATE**: `pnpm check-types`

---

### Task 4: CREATE `apps/web/src/actions/get-activity-logs-action.ts`

- **ACTION**: CREATE action for home screen (last 10)
- **IMPLEMENT**:
```typescript
"use server";

import { authActionClient } from "@/lib/safe-action";
import { getEnterpriseActivityLogs } from "@/services/activity-logs";
import { z } from "zod";

export const getActivityLogsAction = authActionClient
  .inputSchema(z.object({}))
  .action(async ({ ctx: { supabaseAdmin, profile } }) => {
    if (!profile.enterprise_id) return { logs: [], total: 0 };
    return await getEnterpriseActivityLogs(supabaseAdmin, profile.enterprise_id, { limit: 10 });
  });
```
- **MIRROR**: `get-home-enterprise-data-action.ts` no-input pattern exactly
- **GOTCHA**: Guard `if (!profile.enterprise_id)` before calling service — non-enterprise users should get empty result, not an error.
- **VALIDATE**: `pnpm check-types`

---

### Task 5: CREATE `apps/web/src/actions/get-activity-logs-paginated-action.ts`

- **ACTION**: CREATE action for `/last-activities` page
- **IMPLEMENT**:
```typescript
"use server";

import { authActionClient } from "@/lib/safe-action";
import { getEnterpriseActivityLogs } from "@/services/activity-logs";
import { z } from "zod";

const PAGE_SIZE = 20;

const schema = z.object({
  page: z.number().int().min(1).default(1),
});

export const getActivityLogsPaginatedAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabaseAdmin, profile } }) => {
    if (!profile.enterprise_id) return { logs: [], total: 0, page: 1, totalPages: 0 };

    const offset = (parsedInput.page - 1) * PAGE_SIZE;
    const { logs, total } = await getEnterpriseActivityLogs(supabaseAdmin, profile.enterprise_id, {
      limit: PAGE_SIZE,
      offset,
    });

    return {
      logs,
      total,
      page: parsedInput.page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    };
  });
```
- **VALIDATE**: `pnpm check-types`

---

### Task 6: INSTRUMENT `add-appointment-action.ts`

- **ACTION**: UPDATE — add `insertActivityLog` after `createAppointment` succeeds
- **READ FIRST**: The full current file. Note that `createAppointment` returns the appointment row but not the patient name. Patient name was fetched inside `appointment.ts:79-83` — re-fetch it or pass it up.
- **STRATEGY**: After `createAppointment` returns, do a lightweight lookup for patient name. Then call `insertActivityLog` (not awaited). The appointment type determines `action_name`.
- **ADD TO ACTION**:
```typescript
import { insertActivityLog } from "@/lib/activity-log";

// After: const appointment = await createAppointment(supabase, professionalId, parsedInput);
if (profile.enterprise_id) {
  const { data: patient } = await supabase
    .from("patients")
    .select("name")
    .eq("id", appointment.patient_id)
    .single();

  const isConsulta = parsedInput.type === "consulta";
  const actionName = isConsulta ? "Nova consulta agendada" : "Novo encontro agendado";
  const typeLabel = isConsulta ? "Consulta pré-natal" : "Encontro preparatório";
  const description = patient
    ? `${typeLabel} para ${patient.name} em ${appointment.date} às ${appointment.time.slice(0, 5)}`
    : `${typeLabel} agendado para ${appointment.date}`;

  insertActivityLog({
    supabaseAdmin,
    actionName,
    description,
    actionType: "appointment",
    userId: user.id,
    enterpriseId: profile.enterprise_id,
    patientId: appointment.patient_id,
    metadata: { appointment_id: appointment.id, type: parsedInput.type },
  });
}
```
- **GOTCHA**: `insertActivityLog` is NOT awaited — fire-and-forget. Call it before `return { appointment }`. Add `supabaseAdmin` to the ctx destructure if not already present.
- **GOTCHA**: The appointment `time` column is a string like `"14:00:00"` — use `.slice(0, 5)` to get `"14:00"`.
- **VALIDATE**: `pnpm check-types`

---

### Task 7: INSTRUMENT `create-evolution-action.ts`

- **ACTION**: UPDATE — add `insertActivityLog` after evolution insert
- **READ FIRST**: The action already fetches `patient.name` at line 31 inside a `Promise.all`. Add the log call inside the same `if (professionalProfile && patient)` block, or add it separately using the same pattern.
- **ADD TO ACTION** (after the existing `if` block):
```typescript
import { insertActivityLog } from "@/lib/activity-log";
// Add profile to ctx destructure: ctx: { supabase, user, profile }

// After the main insert and notification, before return:
if (profile.enterprise_id) {
  const { data: patient } = await supabase.from("patients").select("name").eq("id", parsedInput.patientId).single();
  insertActivityLog({
    supabaseAdmin,
    actionName: "Evolução registrada",
    description: patient
      ? `Nova evolução registrada para ${patient.name}`
      : "Nova evolução registrada",
    actionType: "clinical",
    userId: user.id,
    enterpriseId: profile.enterprise_id,
    patientId: parsedInput.patientId,
    metadata: { evolution_id: evolution.id },
  });
}
```
- **GOTCHA**: `profile` is NOT currently destructured in this action's ctx — must add it: `ctx: { supabase, supabaseAdmin, user, profile }`.
- **VALIDATE**: `pnpm check-types`

---

### Task 8: INSTRUMENT `add-patient-action.ts`

- **ACTION**: UPDATE — add `insertActivityLog` after `createPatient` succeeds
- **READ FIRST**: Patient name is available in `parsedInput.name`. `profile.enterprise_id` is already used in this action.
- **ADD TO ACTION** (before the `return { patient }`):
```typescript
import { insertActivityLog } from "@/lib/activity-log";

if (profile.enterprise_id) {
  insertActivityLog({
    supabaseAdmin,
    actionName: "Nova gestante cadastrada",
    description: `${parsedInput.name} foi cadastrada como nova gestante`,
    actionType: "patient",
    userId: user.id,
    enterpriseId: profile.enterprise_id,
    patientId: patient.id,
    metadata: { patient_id: patient.id },
  });
}
```
- **VALIDATE**: `pnpm check-types`

---

### Task 9: INSTRUMENT `add-professional-to-team-action.ts`

- **ACTION**: UPDATE — add `insertActivityLog` after team member is added
- **READ FIRST**: Read the full current file first to understand what data is available.
- **LOOKUP NEEDED**: Patient name (from `patientId`) and professional name (from `professionalId`). Do a single `Promise.all` lookup.
- **PATTERN**:
```typescript
import { insertActivityLog } from "@/lib/activity-log";

if (profile.enterprise_id) {
  const [{ data: patient }, { data: professional }] = await Promise.all([
    supabase.from("patients").select("name").eq("id", parsedInput.patientId).single(),
    supabase.from("users").select("name").eq("id", parsedInput.professionalId).single(),
  ]);

  const patientName = patient?.name ?? "gestante";
  const professionalName = professional?.name ?? "profissional";

  insertActivityLog({
    supabaseAdmin,
    actionName: "Profissional adicionada à equipe",
    description: `${professionalName} foi adicionada à equipe de ${patientName}`,
    actionType: "team",
    userId: user.id,
    enterpriseId: profile.enterprise_id,
    patientId: parsedInput.patientId,
    metadata: { professional_id: parsedInput.professionalId, professional_type: parsedInput.professionalType },
  });
}
```
- **VALIDATE**: `pnpm check-types`

---

### Task 10: INSTRUMENT Priority 2 actions

Instrument these actions following the same pattern as Tasks 6-9. For each, read the file first to understand what data is available, then add the log call before `return`.

| Action file | `action_name` | `actionType` | Name lookup needed |
|---|---|---|---|
| `upsert-patient-prenatal-fields-action.ts` | `"Cartão pré-natal atualizado"` | `"clinical"` | patient name from `patientId` |
| `add-lab-exam-action.ts` | `"Exame laboratorial registrado"` | `"exam"` | patient name from `pregnancyId → patient_id` |
| `add-ultrasound-action.ts` | `"Ultrassom registrado"` | `"exam"` | patient name from `pregnancyId → patient_id` |
| `upsert-vaccine-record-action.ts` | `"Registro de vacina atualizado"` | `"vaccine"` | patient name from `pregnancyId → patient_id` |
| `finish-patient-care-action.ts` | `"Acompanhamento encerrado"` | `"patient"` | patient name from `patientId` |
| `add-enterprise-professional-action.ts` | `"Profissional adicionada à organização"` | `"enterprise"` | professional name from result |

For actions where only `pregnancyId` is available, query:
```typescript
const { data: pregnancy } = await supabase
  .from("pregnancies")
  .select("patient:patients(id, name)")
  .eq("id", parsedInput.pregnancyId)
  .single();
const patientName = (pregnancy?.patient as { name: string } | null)?.name ?? "gestante";
const patientId = (pregnancy?.patient as { id: string } | null)?.id ?? null;
```

- **VALIDATE** (run after all 6 actions): `pnpm check-types`

---

### Task 11: CREATE `apps/web/src/components/shared/last-activities-section.tsx`

- **ACTION**: CREATE new shared component
- **MIRROR**: `apps/web/src/components/shared/patients-donut-chart.tsx` for component structure; `home-enterprise-screen.tsx:120-190` for the `AppointmentTimeline` card+list pattern
- **IMPLEMENT**:
```typescript
"use client";

import type { ActivityLog } from "@/services/activity-logs";
import { dayjs } from "@/lib/dayjs";
import { Card, CardContent } from "@ventre/ui/card";
import { Skeleton } from "@ventre/ui/skeleton";
import {
  Baby, Building2, Calendar, DollarSign, FileHeart,
  FlaskConical, Syringe, UserPlus, Users,
} from "lucide-react";
import Link from "next/link";

const ACTION_TYPE_CONFIG = {
  appointment: { icon: Calendar, colorClass: "text-primary" },
  patient:     { icon: UserPlus,  colorClass: "text-green-500" },
  team:        { icon: Users,     colorClass: "text-purple-500" },
  clinical:    { icon: FileHeart, colorClass: "text-pink-500" },
  exam:        { icon: FlaskConical, colorClass: "text-orange-500" },
  vaccine:     { icon: Syringe,   colorClass: "text-teal-500" },
  billing:     { icon: DollarSign, colorClass: "text-yellow-500" },
  enterprise:  { icon: Building2, colorClass: "text-muted-foreground" },
} as const;

type LastActivitiesSectionProps = {
  logs: ActivityLog[];
  isLoading: boolean;
};

function LastActivitiesSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Card>
        <CardContent className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function LastActivitiesSection({ logs, isLoading }: LastActivitiesSectionProps) {
  if (isLoading) return <LastActivitiesSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-poppins font-semibold text-xl">Últimas Atualizações</h2>
        <Link href="/last-activities" className="text-primary text-sm hover:underline">
          Ver todas
        </Link>
      </div>
      <Card className="h-fit">
        <CardContent className="space-y-4">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const config = ACTION_TYPE_CONFIG[log.action_type as keyof typeof ACTION_TYPE_CONFIG]
                  ?? ACTION_TYPE_CONFIG.enterprise;
                const Icon = config.icon;
                return (
                  <div key={log.id} className="flex gap-3">
                    <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.colorClass}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm">{log.action_name}</p>
                        <p className="text-muted-foreground text-xs shrink-0">
                          {dayjs(log.created_at).fromNow()}
                        </p>
                      </div>
                      <p className="text-muted-foreground text-xs mt-0.5">{log.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```
- **GOTCHA**: `dayjs().fromNow()` requires the `relativeTime` plugin. Check `apps/web/src/lib/dayjs.ts` — if not already loaded, add `dayjs.extend(relativeTime)` and `import relativeTime from "dayjs/plugin/relativeTime"`.
- **VALIDATE**: `pnpm check-types`

---

### Task 12: UPDATE `home-enterprise-screen.tsx`

- **ACTION**: UPDATE — add activity log fetch + `LastActivitiesSection` to the enterprise home
- **READ FIRST**: Full current file. Understand the `useAction` + `useEffect` + `useCallback` pattern at lines 195-213.
- **ADD imports**:
```typescript
import { getActivityLogsAction } from "@/actions/get-activity-logs-action";
import { LastActivitiesSection } from "@/components/shared/last-activities-section";
import { isStaff } from "@/lib/access-control";
import type { ActivityLog } from "@/services/activity-logs";
```
- **ADD state** (after existing `useAction` calls):
```typescript
const {
  execute: fetchActivityLogs,
  result: activityLogsResult,
  isPending: isLoadingLogs,
} = useAction(getActivityLogsAction);
```
- **ADD to `useEffect`** (alongside `fetchHomeData({})`):
```typescript
if (isStaff(profile)) {
  fetchActivityLogs({});
}
```
- **ADD to `refreshAll`**:
```typescript
const refreshAll = useCallback(() => {
  fetchHomeData({});
  if (isStaff(profile)) fetchActivityLogs({});
}, [fetchHomeData, fetchActivityLogs, profile]);
```
- **ADD to return JSX** (after the mobile `AppointmentTimeline`, before `</div>` closing the scroll area):
```tsx
{isStaff(profile) && (
  <LastActivitiesSection
    logs={(activityLogsResult.data?.logs ?? []) as ActivityLog[]}
    isLoading={isLoadingLogs}
  />
)}
```
- **GOTCHA**: `profile` is already available as a prop. Pass it to `isStaff()` directly.
- **GOTCHA**: The activity section must appear after the donut+agenda grid — do NOT put it inside the `lg:grid-cols-[1fr_320px]` grid. It should span full width.
- **VALIDATE**: `pnpm check-types`

---

### Task 13: CREATE `apps/web/app/(dashboard)/last-activities/page.tsx`

- **ACTION**: CREATE server component route
- **MIRROR**: `apps/web/app/(dashboard)/patients/history/page.tsx` exactly
- **IMPLEMENT**:
```typescript
import { Header } from "@/components/layouts/header";
import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { getEnterpriseActivityLogs } from "@/services/activity-logs";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { redirect } from "next/navigation";
import { LastActivitiesScreen } from "@/screens/last-activities-screen";

const PAGE_SIZE = 20;

export default async function LastActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const { profile } = await getServerAuth();

  if (!isStaff(profile) || !profile?.enterprise_id) {
    redirect("/home");
  }

  const supabaseAdmin = await createServerSupabaseAdmin();
  const offset = (currentPage - 1) * PAGE_SIZE;
  const { logs, total } = await getEnterpriseActivityLogs(
    supabaseAdmin,
    profile.enterprise_id,
    { limit: PAGE_SIZE, offset },
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="flex h-full flex-col">
      <Header title="Últimas Atualizações" />
      <LastActivitiesScreen
        logs={logs}
        currentPage={currentPage}
        totalPages={totalPages}
        total={total}
      />
    </div>
  );
}
```
- **GOTCHA**: `searchParams` is a `Promise` in Next.js 15 — must `await` it.
- **GOTCHA**: `getServerAuth()` is from `@/lib/server-auth`, not from the action middleware. Check the import path matches what `patients/history/page.tsx` uses.
- **GOTCHA**: This is a Server Component — data is fetched server-side, not via `useAction`.
- **VALIDATE**: `pnpm check-types`

---

### Task 14: CREATE `apps/web/src/screens/last-activities-screen.tsx`

- **ACTION**: CREATE client component screen
- **IMPLEMENT**:
```typescript
"use client";

import type { ActivityLog } from "@/services/activity-logs";
import { dayjs } from "@/lib/dayjs";
import { Button } from "@ventre/ui/button";
import { Card, CardContent } from "@ventre/ui/card";
import {
  Building2, Calendar, DollarSign, FileHeart,
  FlaskConical, Syringe, UserPlus, Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ACTION_TYPE_CONFIG = {
  appointment: { icon: Calendar,     colorClass: "text-primary" },
  patient:     { icon: UserPlus,     colorClass: "text-green-500" },
  team:        { icon: Users,        colorClass: "text-purple-500" },
  clinical:    { icon: FileHeart,    colorClass: "text-pink-500" },
  exam:        { icon: FlaskConical, colorClass: "text-orange-500" },
  vaccine:     { icon: Syringe,      colorClass: "text-teal-500" },
  billing:     { icon: DollarSign,   colorClass: "text-yellow-500" },
  enterprise:  { icon: Building2,    colorClass: "text-muted-foreground" },
} as const;

type LastActivitiesScreenProps = {
  logs: ActivityLog[];
  currentPage: number;
  totalPages: number;
  total: number;
};

export function LastActivitiesScreen({ logs, currentPage, totalPages, total }: LastActivitiesScreenProps) {
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col space-y-4 px-4 pb-28 pt-4 sm:pb-4 md:px-6">
      <p className="text-muted-foreground text-sm">{total} atividades registradas</p>
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">
              Nenhuma atividade registrada ainda.
            </p>
          ) : (
            logs.map((log) => {
              const config = ACTION_TYPE_CONFIG[log.action_type as keyof typeof ACTION_TYPE_CONFIG]
                ?? ACTION_TYPE_CONFIG.enterprise;
              const Icon = config.icon;
              return (
                <div key={log.id} className="flex gap-3 px-4 py-4">
                  <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.colorClass}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{log.action_name}</p>
                      <p className="text-muted-foreground text-xs shrink-0 mt-0.5">
                        {dayjs(log.created_at).format("DD/MM HH:mm")}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-xs mt-0.5">{log.description}</p>
                    {log.user && (
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Por: {log.user.name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => router.push(`/last-activities?page=${currentPage - 1}`)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => router.push(`/last-activities?page=${currentPage + 1}`)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
```
- **GOTCHA**: Pagination is URL-based (not state) — clicking previous/next navigates to `?page=N`, which causes a server-side re-render with fresh data.
- **VALIDATE**: `pnpm check-types`

---

### Task 15: FINAL TYPE CHECK AND LINT

- **ACTION**: Run full type checking and linting
- **COMMANDS**:
```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/lib/activity-log.ts
npx biome lint --write --unsafe apps/web/src/services/activity-logs.ts
npx biome lint --write --unsafe apps/web/src/actions/get-activity-logs-action.ts
npx biome lint --write --unsafe apps/web/src/actions/get-activity-logs-paginated-action.ts
npx biome lint --write --unsafe apps/web/src/components/shared/last-activities-section.tsx
npx biome lint --write --unsafe apps/web/src/screens/last-activities-screen.tsx
```
- **EXPECT**: Zero type errors, zero lint errors

---

### Task 16: MANUAL VALIDATION

1. Start the dev server and navigate to `/home` as a manager/secretary user
2. Trigger one of the instrumented actions (e.g., add a new appointment)
3. Navigate back to `/home` — "Últimas Atualizações" section should show the new log entry
4. Click "Ver todas" — should navigate to `/last-activities` with the full paginated list
5. Test pagination by checking that page 2 loads different entries
6. Navigate to `/last-activities` as a professional (non-staff) — should redirect to `/home`
7. Confirm that log insert failure does NOT break the original action (test by temporarily making enterpriseId null)

---

## Testing Strategy

### Unit Tests to Write

No new test files are strictly required for this feature (the codebase has no unit test files — pattern from explorer shows no `*.test.ts` files in actions or services). Validate via type-checking and manual testing.

### Edge Cases Checklist

- [ ] Action called by a professional with no `enterprise_id` — log is skipped silently
- [ ] `supabaseAdmin` log insert fails — main action still succeeds, error logged to console only
- [ ] `patient.name` lookup returns null (patient deleted between action and log) — description falls back to generic text
- [ ] Staff user with no enterprise (`enterprise_id = null`) on `/last-activities` — redirected to `/home`
- [ ] Page parameter outside valid range — clamped to page 1 via `Math.max(1, Number(page) || 1)`
- [ ] Empty activity logs — component shows "Nenhuma atividade registrada ainda."
- [ ] Large metadata objects — `jsonb` column handles arbitrary JSON without schema constraint

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, no TypeScript errors

### Level 2: BIOME LINT

```bash
npx biome lint apps/web/src/lib/activity-log.ts apps/web/src/services/activity-logs.ts apps/web/src/components/shared/last-activities-section.tsx apps/web/src/screens/last-activities-screen.tsx
```

**EXPECT**: No lint errors (class sorting warnings are fine — fix with `--write --unsafe`)

### Level 3: BUILD

```bash
pnpm db:push && pnpm db:types
```

**EXPECT**: Migration applied cleanly, `Tables<"activity_logs">` present in database.types.ts

### Level 4: DATABASE_VALIDATION

After `pnpm db:push`, use Supabase MCP or Supabase dashboard to verify:

- [ ] `activity_logs` table created with correct columns
- [ ] RLS enabled with two policies (`service_role_manage_activity_logs`, `staff_select_enterprise_activity_logs`)
- [ ] Composite index on `(enterprise_id, created_at DESC)` created
- [ ] Index on `user_id` created
- [ ] GRANT statements applied

### Level 5: BROWSER_VALIDATION

Manual test (see Task 16 above)

---

## Acceptance Criteria

- [ ] `activity_logs` table exists with correct schema, RLS, and indexes
- [ ] `insertActivityLog()` helper writes log via `supabaseAdmin`, never throws
- [ ] Priority 1 actions (appointment, evolution, patient, team) write logs on success
- [ ] Priority 2 actions (prenatal, lab exam, ultrasound, vaccine, finish care, enterprise) write logs
- [ ] `LastActivitiesSection` appears on enterprise home screen only for `isStaff(profile)` users
- [ ] Section shows last 10 logs with correct icon, description, and relative timestamp
- [ ] "Ver todas" link navigates to `/last-activities`
- [ ] `/last-activities` is server-rendered, paginated (20/page), accessible to staff only
- [ ] Non-staff users redirected from `/last-activities` to `/home`
- [ ] `pnpm check-types` passes with zero errors

---

## Completion Checklist

- [ ] Task 1: Migration created and applied (`pnpm db:push && pnpm db:types`)
- [ ] Task 2: `insertActivityLog` helper created
- [ ] Task 3: `activity-logs.ts` service created
- [ ] Task 4: `getActivityLogsAction` created
- [ ] Task 5: `getActivityLogsPaginatedAction` created
- [ ] Tasks 6-9: Priority 1 actions instrumented (appointment, evolution, patient, team)
- [ ] Task 10: Priority 2 actions instrumented (prenatal, exam, ultrasound, vaccine, finish, enterprise)
- [ ] Task 11: `LastActivitiesSection` component created
- [ ] Task 12: `home-enterprise-screen.tsx` updated
- [ ] Task 13: `/last-activities/page.tsx` created
- [ ] Task 14: `last-activities-screen.tsx` created
- [ ] Task 15: Type check and lint pass
- [ ] Task 16: Manual validation confirmed

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| FK constraint name `activity_logs_user_id_fkey` differs from Supabase auto-generated name | MED | LOW | After migration, check actual FK name in DB; use short alias `user:users!user_id` if needed |
| `dayjs().fromNow()` requires `relativeTime` plugin not yet loaded | MED | LOW | Check `apps/web/src/lib/dayjs.ts` before Task 11; extend if missing |
| `profile` not destructured in some action contexts | LOW | LOW | Always add `profile` to ctx destructure before using `profile.enterprise_id` |
| Heavy query load from N+1 lookups (patient name per action) | LOW | LOW | Lookups are per-action-call, not per-list-render; acceptable for v1 |
| `pnpm db:types` not run after migration | HIGH | HIGH | Task 1 validation explicitly requires `pnpm db:types` before proceeding |

---

## Notes

- **`enterprise_id` source**: There is NO `enterprise_users` junction table. Enterprise membership is encoded directly as `users.enterprise_id` FK column. The original spec mentioned `enterprise_users` — this is incorrect based on actual DB schema.
- **`isStaff()` = manager + secretary**: The function checks `user_type === 'manager' || user_type === 'secretary'`. Do not use `'staff'` or `'owner'` as they don't exist in the enum.
- **`supabaseAdmin` in ctx**: The `authActionClient` middleware already creates and provides `supabaseAdmin` in `ctx`. Never call `createServerSupabaseAdmin()` inside an action body — use `ctx.supabaseAdmin` directly.
- **Method name**: The safe-action method is `.inputSchema()` (not `.schema()`) — confirmed from all existing actions.
- **`revalidateTag` signature**: Second argument is `{ expire: 300 }` — confirmed from add-patient-action.ts.
- **Nav not updated**: `/last-activities` is intentionally not added to sidebar or bottom-nav. Both already hide for staff on `/home`, and the new route is accessed via the "Ver todas" link only.
- **`dayjs().fromNow()` locale**: If Portuguese relative time is needed, add `import "dayjs/locale/pt-br"` and `dayjs.locale("pt-br")` to `apps/web/src/lib/dayjs.ts`.
