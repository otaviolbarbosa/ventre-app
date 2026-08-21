# Feature: Modo Parto — Fase 4: Tela `/modo-parto` e Formulários de Registro

## Summary

Construir a tela `/modo-parto`, onde qualquer membro da equipe de cuidado registra os 8 tipos de evento do parto (contração, dilatação cervical, altura de apresentação/Lee, FCF, fluido amniótico, medicamentos — repetíveis; bolsa rota — único; entrada em fase ativa — já capturada na ativação do Modo Parto, fase 3) e vê uma linha do tempo unificada e atualizada em tempo real para toda a equipe. Cada registro múltiplo dispara um alerta não-bloqueante quando outro profissional já registrou o mesmo tipo de medição nos últimos 30 minutos. Como não existe hoje nenhum ponto de entrada de UI para `activateBirthModeAction` (construída na fase 3), esta fase também adiciona o botão "Ativar Modo Parto" na ficha da paciente, que é o gatilho manual que leva à tela.

## User Story

Como profissional da equipe de cuidado (doula, enfermeira, médica obstetra)
Eu quero registrar e visualizar em tempo real os eventos do parto de uma gestante em trabalho de parto ativo
Para que eu possa substituir o registro em papel por um registro digital colaborativo e preciso

## Problem Statement

Hoje não existe nenhuma interface para ativar o Modo Parto nem para registrar os 8 tipos de evento definidos nas fases 1–3 (que só criaram schema, RLS, spike de Realtime e notificação WhatsApp). As tabelas `birth_*` existem e têm RLS pronta, mas não há formulários, tela ou histórico visível — a funcionalidade é hoje inacessível pela UI.

## Solution Statement

Seguir o padrão já maduro de "seção clínica" usado em `prenatal-card.tsx` (schema Zod → server action `authActionClient` de insert → modal `ContentModal` com `react-hook-form` → seção com lista + botão "Adicionar"), mas trocando o `onRefresh`-por-refetch-completo por um hook de Realtime que assina `postgres_changes` INSERT nas 7 tabelas `birth_*` filtradas por `pregnancy_id`, seguindo exatamente o formato confirmado na documentação oficial do Supabase (múltiplos `.on('postgres_changes', ...)` encadeados em um único `.channel()`). O alerta de duplicidade é resolvido no próprio server action de cada tipo de registro múltiplo: antes do insert, uma query busca o registro mais recente do mesmo tipo para a mesma gestação nos últimos 30 minutos: se encontrado E de um profissional diferente, o insert prossegue normalmente e a action retorna um aviso não-bloqueante (`duplicateWarning`) que o modal exibe via toast após salvar.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | NEW_CAPABILITY                                                       |
| Complexity       | HIGH                                                                  |
| Systems Affected | apps/web (routes, actions, validations, modals, hooks), packages/supabase (types regen only, no new migration) |
| Dependencies     | `@supabase/supabase-js` ^2.91.1, `react-hook-form` ^7.54.2, `zod`, `next-safe-action` ^8.1.4, `sonner` |
| Estimated Tasks  | 18                                                                    |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌─────────────┐         ┌──────────────────┐        ┌─────────────┐         ║
║   │  Ficha da   │ ──────► │  Nenhum botão     │        │  Sem tela   │         ║
║   │  Paciente   │         │  "Ativar Modo     │  ✗     │  /modo-parto│         ║
║   │  (profile)  │         │  Parto" na UI     │        │  acessível  │         ║
║   └─────────────┘         └──────────────────┘        └─────────────┘         ║
║                                                                                ║
║   USER_FLOW: Profissional não tem como ativar o Modo Parto nem registrar      ║
║   eventos do parto pela UI — apenas os dados de backend (tabelas, RLS,        ║
║   action de ativação, fila WhatsApp) existem, sem front-end.                  ║
║   PAIN_POINT: Toda a captura de eventos do parto continua em papel.           ║
║   DATA_FLOW: Nenhum — tabelas `birth_*` existem vazias, sem escrita possível. ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  ┌────────────┐    ┌─────────────────┐    ┌───────────────────────────────┐   ║
║  │ Ficha da   │───►│ Botão "Ativar   │───►│ /modo-parto?pregnancyId=...   │   ║
║  │ Paciente   │    │ Modo Parto"     │    │                               │   ║
║  └────────────┘    └─────────────────┘    │  ┌─────────────────────────┐ │   ║
║                                            │  │ 6 botões de registro    │ │   ║
║                                            │  │ (contração, dilatação,  │ │   ║
║                                            │  │ Lee, FCF, líquido,      │ │   ║
║                                            │  │ medicamento) + 1 botão  │ │   ║
║                                            │  │ único (bolsa rota)      │ │   ║
║                                            │  └───────────┬─────────────┘ │   ║
║                                            │              ▼               │   ║
║                                            │  ┌─────────────────────────┐ │   ║
║                                            │  │ Linha do tempo unificada│ │   ║
║                                            │  │ (8 tipos, ordenada por  │ │   ║
║                                            │  │ hora, autor visível)    │◄┼───┼── outro profissional insere
║                                            │  │ atualiza via Realtime   │ │   ║   evento → aparece aqui
║                                            │  └─────────────────────────┘ │   ║   sem reload
║                                            └───────────────────────────────┘   ║
║                                                                                ║
║   USER_FLOW: Ativa → é levado à tela → registra eventos com formulários      ║
║   rápidos → vê imediatamente os registros de toda a equipe, com aviso        ║
║   não-bloqueante se uma medição duplicada recente for detectada.             ║
║   VALUE_ADD: Substitui papel por captura estruturada e colaborativa em       ║
║   tempo real.                                                                ║
║   DATA_FLOW: Insert em `birth_*` (RLS `is_team_member`) → Postgres publica   ║
║   no `supabase_realtime` → todo cliente inscrito no canal da gestação        ║
║   recebe o evento e atualiza a lista local sem refetch completo.             ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `app/(dashboard)/patients/[id]/profile/page.tsx` | Sem botão de Modo Parto | Botão "Ativar Modo Parto" (visível se `!patient.has_finished && !pregnancy?.birth_mode_active`) | Ponto de entrada manual da fase |
| `/modo-parto` (nova rota) | Não existe | Tela com 7 formulários de registro + linha do tempo ao vivo | Substitui papel por captura digital |
| Insert de medição múltipla | N/A | Alerta toast não-bloqueante se duplicidade < 30min | Reduz risco de dado duplicado sem travar o fluxo |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/actions/add-ultrasound-action.ts` | 1-48 | Padrão canônico de action de insert (`.inputSchema`, `ctx.supabase`, `captureServerEvent`) a replicar para as 7 novas actions |
| P0 | `apps/web/src/modals/add-ultrasound-modal.tsx` | 1-297 | Padrão canônico de modal (`ContentModal`, `useForm`+`zodResolver`, `useAction`, toast, reset em `open`) |
| P0 | `apps/web/src/lib/validations/prenatal.ts` | 76-148 | Padrão de schema Zod com `z.coerce.number()` para ranges e `z.enum()` para enums Postgres |
| P0 | `apps/web/src/lib/safe-action.ts` | 1-37 | Contrato de `ctx: { supabase, supabaseAdmin, user, profile }` em `authActionClient` |
| P0 | `packages/supabase/supabase/migrations/20260822000003_birth_mode_patient_id_trigger_fn.sql` | 1-15 | Trigger que popula `patient_id` — **nunca enviar `patient_id` no insert client-side** |
| P0 | `packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql` | 1-43 | Referência de shape de tabela + RLS + trigger, idêntico às outras 6 tabelas `birth_*` |
| P1 | `apps/web/src/actions/get-patient-action.ts` | 1-46 | Como `pregnancyId` ativo é resolvido a partir de `patientId` — reutilizar/estender este padrão |
| P1 | `apps/web/src/actions/get-prenatal-card-action.ts` | 1-89 | Padrão de `Promise.all` para buscar múltiplas tabelas em paralelo — base para a query inicial da timeline |
| P1 | `apps/web/src/hooks/use-birth-mode-realtime.ts` | 1-73 | Único precedente de Realtime no repo — replicar estrutura de subscribe/cleanup, mas trocar `UPDATE` por `INSERT` e adicionar filtro por `pregnancy_id` |
| P1 | `apps/web/src/actions/activate-birth-mode-action.ts` | 1-37 | Action de ativação já pronta (fase 3) — só falta o botão de UI |
| P1 | `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx` | 25-212 | Onde adicionar o botão "Ativar Modo Parto", ao lado de "Finalizar Acompanhamento" |
| P2 | `packages/ui/src/shared/content-modal/content-modal.tsx` | 1-62 | Dialog (desktop) / Sheet (mobile) — usar diretamente, não reimplementar `window.innerWidth` |
| P2 | `apps/web/src/screens/last-activities-screen.tsx` | 19-77 | Padrão de "dispatch por tipo" com `ACTION_TYPE_CONFIG` (ícone + cor) — base para a linha do tempo unificada dos 8 tipos |
| P2 | `apps/web/app/(dashboard)/patients/[id]/prenatal/page.tsx` | 1-48 | Padrão de página client-only que busca dados via `useAction` em `useEffect` e trata loading/empty state |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) | "Listening to multiple changes" | Confirma que múltiplos `.on('postgres_changes', ...)` podem ser encadeados em um único `.channel()` — usar para as 7 tabelas `birth_*` |
| [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) | "Enable Postgres Changes" / REPLICA IDENTITY | Cada tabela `birth_*` precisa de `ALTER PUBLICATION supabase_realtime ADD TABLE ...` — `REPLICA IDENTITY FULL` NÃO é necessário só para INSERT |
| [Supabase JS Reference: removeChannel](https://supabase.com/docs/reference/javascript/removechannel) | — | Preferir `supabase.removeChannel(channel)` no cleanup do `useEffect`, não apenas `channel.unsubscribe()` (evita vazamento de `client.channels` em Strict Mode) |
| [Realtime Row Level Security (blog)](https://supabase.com/blog/realtime-row-level-security-in-postgresql) | — | RLS de SELECT já é respeitada automaticamente em `postgres_changes` — não é necessário canal `private`/`realtime.messages` |

---

## Patterns to Mirror

**ZOD_SCHEMA_ENUM_E_RANGE:**
```typescript
// SOURCE: apps/web/src/lib/validations/prenatal.ts:100-114
// COPY THIS PATTERN:
gestational_weeks: z.coerce.number().int().min(0).max(45).optional().nullable(),
amniotic_fluid_index: z
  .enum(["severe_oligohydramnios", "oligohydramnios", "normal", "polyhydramnios"])
  .optional()
  .nullable(),
```

**SERVER_ACTION_INSERT:**
```typescript
// SOURCE: apps/web/src/actions/add-ultrasound-action.ts:14-24
// COPY THIS PATTERN (sem inserir patient_id — trigger cuida disso):
export const addUltrasoundAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { pregnancyId, data } = parsedInput;
    const { error } = await supabase.from("ultrasounds").insert({
      pregnancy_id: pregnancyId,
      ...data,
    });
    if (error) throw new Error(error.message);
    // ...
  });
```

**MODAL_FORM:**
```typescript
// SOURCE: apps/web/src/modals/add-ultrasound-modal.tsx:44-88
// COPY THIS PATTERN:
const form = useForm<UltrasoundInput>({
  resolver: zodResolver(ultrasoundSchema),
  defaultValues: { exam_date: new Date().toISOString().split("T")[0] },
});

useEffect(() => {
  if (open) form.reset({ /* ... */ });
}, [open, ultrasound, form]);

async function onSubmit(values: UltrasoundInput) {
  const result = await addAction({ pregnancyId, data: values });
  if (result?.serverError) {
    toast.error(result.serverError);
    return;
  }
  toast.success("Registrado!");
  onOpenChange(false);
  onSuccess();
}
```

**ACTIVE_PREGNANCY_RESOLUTION:**
```typescript
// SOURCE: apps/web/src/actions/get-patient-action.ts:23-29
// ADAPTAR: em vez de `!has_finished`, filtrar por `birth_mode_active === true`
const activeBirthModePregnancy = patient?.pregnancies.find((p) => p.birth_mode_active);
```

**REALTIME_HOOK_STRUCTURE:**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-realtime.ts:21-66
// ADAPTAR: trocar event "UPDATE" por "INSERT", tabela única por 7 tabelas encadeadas,
// filter "birth_mode_active=eq.true" por "pregnancy_id=eq.<id>" por tabela.
useEffect(() => {
  if (!pregnancyId) return;
  let cancelled = false;
  const channel = supabase
    .channel(`birth-mode-events-${pregnancyId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "birth_contractions", filter: `pregnancy_id=eq.${pregnancyId}` }, handler)
    // ...repetir para as outras 6 tabelas...
    .subscribe((status) => { /* status handling igual ao spike */ });
  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
}, [pregnancyId]);
```

**DISPATCH_POR_TIPO (timeline):**
```typescript
// SOURCE: apps/web/src/screens/last-activities-screen.tsx:19-28
const BIRTH_EVENT_CONFIG = {
  contraction: { icon: Activity, colorClass: "text-pink-500", label: "Contração" },
  cervical_dilation: { icon: Ruler, colorClass: "text-primary", label: "Dilatação" },
  // ... 8 tipos
} as const;
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/lib/validations/birth-mode.ts` | UPDATE | Adicionar schemas Zod para os 6 registros múltiplos + 1 único (bolsa rota) |
| `apps/web/src/actions/add-birth-contraction-action.ts` | CREATE | Insert de contração + verificação de duplicidade |
| `apps/web/src/actions/add-birth-cervical-dilation-action.ts` | CREATE | Insert de dilatação cervical + duplicidade |
| `apps/web/src/actions/add-birth-fetal-station-action.ts` | CREATE | Insert de altura de apresentação (Lee) + duplicidade |
| `apps/web/src/actions/add-birth-fetal-heart-rate-action.ts` | CREATE | Insert de FCF + duplicidade |
| `apps/web/src/actions/add-birth-amniotic-fluid-record-action.ts` | CREATE | Insert de fluido amniótico + duplicidade |
| `apps/web/src/actions/add-birth-medication-administration-action.ts` | CREATE | Insert de medicamento + duplicidade |
| `apps/web/src/actions/add-birth-membrane-rupture-action.ts` | CREATE | Insert único de bolsa rota (constraint UNIQUE já impede duplicata real) |
| `apps/web/src/actions/get-birth-mode-timeline-action.ts` | CREATE | Busca paralela das 7 tabelas + evento de ativação, mesclados e ordenados |
| `apps/web/src/actions/get-active-birth-mode-pregnancy-action.ts` | CREATE | Resolve `pregnancyId` ativo em Modo Parto para o usuário atual (usado por `/modo-parto` sem query param) |
| `apps/web/src/actions/get-patient-action.ts` | UPDATE | Incluir `birth_mode_active` no `select()` de `pregnancies(...)` |
| `apps/web/src/lib/birth-mode-constants.ts` | CREATE | Labels PT-BR + `BIRTH_EVENT_CONFIG` (ícone/cor) por tipo de evento, mirror de `prenatal-constants.ts` |
| `apps/web/src/hooks/use-birth-mode-timeline-realtime.ts` | CREATE | Hook Realtime que assina INSERT nas 7 tabelas `birth_*` filtradas por `pregnancy_id`, mesclando na lista local |
| `apps/web/src/modals/add-birth-contraction-modal.tsx` | CREATE | Formulário de contração (input de duração em segundos) |
| `apps/web/src/modals/add-birth-cervical-dilation-modal.tsx` | CREATE | Formulário de dilatação cervical (0-10 cm) |
| `apps/web/src/modals/add-birth-fetal-station-modal.tsx` | CREATE | Formulário de altura Lee (-4 a +4) |
| `apps/web/src/modals/add-birth-fetal-heart-rate-modal.tsx` | CREATE | Formulário de FCF (bpm) |
| `apps/web/src/modals/add-birth-amniotic-fluid-record-modal.tsx` | CREATE | Formulário de fluido amniótico (select enum) |
| `apps/web/src/modals/add-birth-medication-administration-modal.tsx` | CREATE | Formulário de medicamento (select enum + campo condicional "outros") |
| `apps/web/src/modals/add-birth-membrane-rupture-modal.tsx` | CREATE | Formulário único de bolsa rota (sem campos, só confirmação + timestamp) |
| `apps/web/src/components/shared/birth-mode-timeline.tsx` | CREATE | Lista cronológica unificada dos 8 tipos de evento, dispatch por tipo (mirror `last-activities-screen.tsx`) |
| `apps/web/src/components/shared/birth-mode-register-buttons.tsx` | CREATE | Grade de 7 botões que abrem os modais de registro |
| `apps/web/src/screens/birth-mode-screen.tsx` | CREATE | Screen full-page que compõe cabeçalho da paciente + botões de registro + timeline |
| `apps/web/app/(dashboard)/modo-parto/page.tsx` | CREATE | Rota `/modo-parto`; lê `?pregnancyId=` ou resolve via `get-active-birth-mode-pregnancy-action`; trata loading/empty/múltiplos-partos-ativos |
| `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx` | UPDATE | Adicionar botão "Ativar Modo Parto" (gated por `!has_finished && !birth_mode_active`, roles doula/enfermeira/obstetra) |

---

## NOT Building (Scope Limits)

- **Redirect automático com contagem regressiva de 10s e barra de notificação persistente** — Fase 5, depende desta fase (4) e da 2 (Realtime spike).
- **Extensão do `finish-care-modal.tsx` com dados de desfecho do parto** — Fase 6, escopo isolado.
- **Geração do documento/relatório de partograma consolidado** — explicitamente fora do escopo do PRD inteiro.
- **Bloqueio de edição concorrente** — decisão do PRD é apenas alertar, nunca impedir o insert.
- **Suporte a múltiplas gestações ativas em Modo Parto simultâneas para o mesmo profissional além de um seletor simples** — se `get-active-birth-mode-pregnancy-action` encontrar mais de uma gestação ativa para o usuário, a tela mostra uma lista simples de seleção; não há UX sofisticada de múltiplos partos simultâneos.
- **Modo offline / fila local para conectividade instável** — marcado como TBD no PRD (Open Questions), não resolvido nesta fase.
- **Edição ou exclusão de registros já inseridos** — tabelas `birth_*` são append-only por design (fase 1); esta fase só implementa CREATE + leitura.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: UPDATE `apps/web/src/lib/validations/birth-mode.ts`

- **ACTION**: Adicionar 7 novos schemas Zod ao arquivo existente
- **IMPLEMENT**:
  ```typescript
  export const birthContractionSchema = z.object({
    duration_seconds: z.coerce.number().int().positive("Duração deve ser maior que zero"),
  });
  export const birthCervicalDilationSchema = z.object({
    dilation_cm: z.coerce.number().min(0).max(10),
  });
  export const birthFetalStationSchema = z.object({
    station_lee: z.coerce.number().int().min(-4).max(4),
  });
  export const birthFetalHeartRateSchema = z.object({
    bpm: z.coerce.number().int().positive().max(299),
  });
  export const birthAmnioticFluidRecordSchema = z.object({
    fluid_type: z.enum(["intacto", "com_sangue", "claro", "com_meconio"]),
  });
  export const birthMedicationAdministrationSchema = z
    .object({
      medication_type: z.enum(["fluidos_intravenosos", "ocitocina", "analgesia", "outros"]),
      other_birth_medication_type: z.string().optional().nullable(),
      notes: z.string().optional().nullable(),
    })
    .refine((v) => v.medication_type !== "outros" || !!v.other_birth_medication_type, {
      message: "Especifique o medicamento",
      path: ["other_birth_medication_type"],
    });
  export const birthMembraneRuptureSchema = z.object({});
  ```
  Exportar os respectivos `z.infer` types (`BirthContractionInput`, etc.)
- **MIRROR**: `apps/web/src/lib/validations/prenatal.ts:76-148` — mesmo shape de `z.coerce.number()` para ranges e `z.enum()` para enums Postgres
- **GOTCHA**: `effectiveness` em `birth_contractions` é `GENERATED ALWAYS` — NUNCA incluir no schema de insert. `duration_seconds` já cobre o CHECK `> 0` do Postgres.
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/lib/birth-mode-constants.ts`

- **ACTION**: Criar labels PT-BR e configuração de dispatch por tipo de evento
- **IMPLEMENT**: `AMNIOTIC_FLUID_TYPE_LABELS`, `BIRTH_MEDICATION_TYPE_LABELS`, `BIRTH_CONTRACTION_EFFECTIVENESS_LABELS` (mapas `Record<string,string>`), e `BIRTH_EVENT_TYPES` como `as const` array com `{ type, label, cardinality: "multiple" | "single" }` para os 7 tipos registráveis via formulário (não incluir "entrada em fase ativa", que vem de `pregnancies.birth_mode_activated_at`)
- **MIRROR**: `apps/web/src/lib/prenatal-constants.ts` (mesma pasta, mesmo padrão de `Record` de labels)
- **VALIDATE**: `pnpm check-types`

### Task 3: CREATE as 6 actions de insert múltiplo com verificação de duplicidade

- **ACTION**: Criar `add-birth-contraction-action.ts`, `add-birth-cervical-dilation-action.ts`, `add-birth-fetal-station-action.ts`, `add-birth-fetal-heart-rate-action.ts`, `add-birth-amniotic-fluid-record-action.ts`, `add-birth-medication-administration-action.ts`
- **IMPLEMENT**: Cada action segue exatamente o shape de `add-ultrasound-action.ts:14-24`, mas antes do insert consulta o registro mais recente da mesma tabela para a mesma `pregnancy_id` nos últimos 30 minutos (`.gte("measured_at"|"administered_at", new Date(Date.now() - 30*60*1000).toISOString())`, `.order(..., { ascending: false }).limit(1)`); se encontrado e `professional_id !== user.id`, retorna `{ success: true, duplicateWarning: { minutesAgo, professionalName } }` (buscar nome via join `professional:users(name)` na mesma query de duplicidade)
- **MIRROR**: `apps/web/src/actions/add-ultrasound-action.ts:1-48`
- **IMPORTS**: `authActionClient` de `@/lib/safe-action`, schema correspondente de `@/lib/validations/birth-mode`
- **GOTCHA**: NÃO enviar `patient_id` nem `professional_id` no payload de insert explicitamente para `patient_id` (trigger cuida disso); `professional_id` DEVE ser setado explicitamente pela action como `user.id` (não há trigger para essa coluna — confirmar contra `database.types.ts` que `professional_id` é `NOT NULL` sem default). Contração usa coluna `measured_at`, mesmo para as demais exceto `birth_medication_administrations` (`administered_at`).
- **VALIDATE**: `pnpm check-types` após cada arquivo

### Task 4: CREATE `apps/web/src/actions/add-birth-membrane-rupture-action.ts`

- **ACTION**: Insert único de bolsa rota
- **IMPLEMENT**: Igual ao Task 3, mas sem verificação de duplicidade em janela de tempo (a constraint `UNIQUE (pregnancy_id)` no banco já garante unicidade — capturar erro de constraint e traduzir para mensagem amigável: `if (error?.code === "23505") throw new Error("Bolsa rota já foi registrada para este parto")`)
- **MIRROR**: `apps/web/src/actions/add-ultrasound-action.ts:14-24`
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/actions/get-patient-action.ts`

- **ACTION**: Incluir `birth_mode_active` na seleção de `pregnancies`
- **IMPLEMENT**: Adicionar `birth_mode_active` à string de `select()` em `pregnancies(id, ..., birth_mode_active, patient_id)` (linha 16); adicionar `birth_mode_active: pregnancy?.birth_mode_active ?? false` ao objeto `patient` retornado (mirror do padrão `has_finished`/`delivery_method` já existente nas linhas 39-41), e incluir `pregnancy` completo (já retornado) para acesso a `pregnancy?.id`
- **MIRROR**: `apps/web/src/actions/get-patient-action.ts:16,39-41`
- **GOTCHA**: Este arquivo é usado por 3+ telas (`patient-profile`, `prenatal`) — validar que nenhuma quebra com o campo adicional (é apenas aditivo, não deve quebrar nada)
- **VALIDATE**: `pnpm check-types`

### Task 6: CREATE `apps/web/src/actions/get-active-birth-mode-pregnancy-action.ts`

- **ACTION**: Resolver a gestação ativa em Modo Parto para o usuário logado
- **IMPLEMENT**: Sem input (ou input opcional vazio), query `supabase.from("pregnancies").select("id, patient_id, birth_mode_activated_at, birth_mode_activated_by, patient:patients(name)").eq("birth_mode_active", true)` — RLS via `is_team_member` já filtra para gestações onde o usuário é membro de equipe; retorna array (pode ter 0, 1 ou mais resultados)
- **MIRROR**: `apps/web/src/actions/get-patient-action.ts:10-21` (estrutura de action simples com `ctx.supabase`)
- **VALIDATE**: `pnpm check-types`

### Task 7: CREATE `apps/web/src/actions/get-birth-mode-timeline-action.ts`

- **ACTION**: Buscar todos os eventos das 7 tabelas `birth_*` para uma `pregnancyId`, mais o evento de ativação
- **IMPLEMENT**: `Promise.all` com 7 queries paralelas (uma por tabela), cada uma com `.select("*, professional:users(name)").eq("pregnancy_id", pregnancyId).order(<coluna_de_tempo>, { ascending: true })`; mais uma query a `pregnancies` para `birth_mode_activated_at`/`birth_mode_activated_by`; action mescla tudo em um único array `{ type, id, occurredAt, professionalName, payload }` ordenado por `occurredAt` antes de retornar
- **MIRROR**: `apps/web/src/actions/get-prenatal-card-action.ts:16-89` (estrutura `Promise.all`)
- **GOTCHA**: Colunas de tempo variam por tabela (`measured_at` para contração/dilatação/estação/FCF/fluido, `administered_at` para medicamento, `occurred_at` para bolsa rota) — normalizar todas para `occurredAt` no merge
- **VALIDATE**: `pnpm check-types`

### Task 8: CREATE `apps/web/src/hooks/use-birth-mode-timeline-realtime.ts`

- **ACTION**: Hook client que assina INSERT em tempo real nas 7 tabelas `birth_*` para uma `pregnancyId`
- **IMPLEMENT**: Um único `.channel(`birth-mode-timeline-${pregnancyId}`)` com 7 chamadas `.on("postgres_changes", { event: "INSERT", schema: "public", table: "<tabela>", filter: `pregnancy_id=eq.${pregnancyId}` }, handler)` encadeadas — uma por tabela — cada handler normaliza o payload no mesmo shape `{ type, id, occurredAt, payload }` do Task 7 e chama um callback `onNewEvent` fornecido pelo componente pai (que faz `setEvents((prev) => [...prev, newEvent].sort(...))`, com dedupe por `id` para evitar duplicar caso o evento já tenha vindo do fetch inicial)
- **MIRROR**: `apps/web/src/hooks/use-birth-mode-realtime.ts:16-72` (subscribe/reconnect/cleanup), adaptando `event: "UPDATE"` → `"INSERT"` e adicionando `filter` por `pregnancy_id`
- **IMPORTS**: `supabase` de `@ventre/supabase`, `RealtimeChannel` de `@supabase/supabase-js`
- **GOTCHA**: Usar `supabase.removeChannel(channel)` no cleanup, não `channel.unsubscribe()` isolado (confirmado via docs oficiais — evita vazamento de canais em React Strict Mode). O payload do Realtime NÃO inclui o nome do profissional (só `professional_id`) — o handler precisa fazer fallback de exibição (ex: buscar nome depois, ou mostrar "Profissional" genérico até o próximo refetch) OU manter um mapa local `professionalId → name` já carregado no fetch inicial (Task 7) e usar esse mapa para resolver o nome nos eventos que chegam via Realtime.
- **VALIDATE**: `pnpm check-types`; teste manual: dois navegadores logados como profissionais diferentes da mesma equipe, inserir evento em um, confirmar aparição no outro em <2s (mesmo critério de sucesso da fase 2)

### Task 9: New migration — registrar as 7 tabelas `birth_*` na publicação `supabase_realtime`

- **ACTION**: CREATE `packages/supabase/supabase/migrations/<timestamp>_birth_tables_realtime_publication.sql`
- **IMPLEMENT**:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_contractions;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_cervical_dilations;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_fetal_stations;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_fetal_heart_rates;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_amniotic_fluid_records;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_medication_administrations;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_membrane_ruptures;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260822000012_pregnancies_realtime_publication.sql:1-3`
- **GOTCHA**: `REPLICA IDENTITY FULL` NÃO é necessário aqui — confirmado via docs oficiais, é exigido só para UPDATE/DELETE com old-row data; estas tabelas são insert-only
- **VALIDATE**: `pnpm db:push` depois `pnpm db:types` (regenera `database.types.ts` — nenhuma mudança de tipo esperada, é só metadado de publicação)

### Task 10: CREATE os 6 modais de registro múltiplo

- **ACTION**: `add-birth-contraction-modal.tsx`, `add-birth-cervical-dilation-modal.tsx`, `add-birth-fetal-station-modal.tsx`, `add-birth-fetal-heart-rate-modal.tsx`, `add-birth-amniotic-fluid-record-modal.tsx`, `add-birth-medication-administration-modal.tsx`
- **IMPLEMENT**: Cada modal segue `add-ultrasound-modal.tsx` mas simplificado (1-3 campos cada, sem modo de edição — só criação): `ContentModal` + `useForm` com `zodResolver` do schema do Task 1 + `useAction` da action do Task 3 + no `onSubmit`, se `result.data?.duplicateWarning` existir, disparar `toast.warning(...)` além do `toast.success(...)`. Campo de duração de contração pode usar um cronômetro simples (start/stop) que calcula `duration_seconds` automaticamente, OU input numérico direto — optar por input numérico direto nesta fase para simplicidade (cronômetro fica como melhoria futura, não bloqueante para o MVP do PRD)
- **MIRROR**: `apps/web/src/modals/add-ultrasound-modal.tsx:1-297` (estrutura completa), campos `Select` para enums iguais ao campo `doppler_result` (linhas 219-241)
- **GOTCHA**: Não há campo de data/hora manual — `measured_at`/`administered_at` usam o `DEFAULT now()` do Postgres, então o formulário não deve incluir esses campos (diferente de `ultrasoundSchema` que tem `exam_date` manual)
- **VALIDATE**: `pnpm check-types`; abrir cada modal no browser e submeter com dados válidos

### Task 11: CREATE `apps/web/src/modals/add-birth-membrane-rupture-modal.tsx`

- **ACTION**: Modal de confirmação simples (sem campos de formulário, já que `birthMembraneRuptureSchema` é vazio)
- **IMPLEMENT**: `ContentModal` com texto de confirmação ("Confirmar que a bolsa rompeu agora?") e botão único que chama a action do Task 4 diretamente (sem `react-hook-form`, já que não há campos)
- **MIRROR**: Estrutura de `ContentModal` de `add-ultrasound-modal.tsx:90-96`, sem o `<Form>` interno
- **VALIDATE**: `pnpm check-types`

### Task 12: CREATE `apps/web/src/components/shared/birth-mode-register-buttons.tsx`

- **ACTION**: Grade de botões que abre cada um dos 7 modais
- **IMPLEMENT**: Componente client que recebe `pregnancyId` e `onSuccess: () => void`; renderiza 7 `Button` (grid responsivo, `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`) usando `BIRTH_EVENT_TYPES` do Task 2 para labels/ícones; cada clique abre o modal correspondente via `useState` local (um `activeModal: string | null`)
- **MIRROR**: Estrutura de botões de `app/(dashboard)/patients/[id]/profile/page.tsx:171-187` (Button + ícone + label)
- **VALIDATE**: `pnpm check-types`

### Task 13: CREATE `apps/web/src/components/shared/birth-mode-timeline.tsx`

- **ACTION**: Lista cronológica unificada dos eventos do parto
- **IMPLEMENT**: Recebe `events: BirthModeTimelineEvent[]` (shape normalizado do Task 7/8); renderiza lista `divide-y divide-border` (mirror `last-activities-screen.tsx:55-77`), cada linha com ícone por tipo (`BIRTH_EVENT_CONFIG`), horário (`dayjs(occurredAt).format("HH:mm")`), descrição formatada por tipo (ex: "Contração de 45s (efetiva)", "Dilatação: 6 cm", "FCF: 140 bpm"), e "Por: {professionalName}"; `EmptyState` quando `events.length === 0`
- **MIRROR**: `apps/web/src/screens/last-activities-screen.tsx:45-77` (estrutura de card + divide-y + dispatch por tipo)
- **VALIDATE**: `pnpm check-types`

### Task 14: CREATE `apps/web/src/screens/birth-mode-screen.tsx`

- **ACTION**: Screen full-page que compõe tudo
- **IMPLEMENT**: Client component recebendo `pregnancyId`, `patientName`; usa `useAction(getBirthModeTimelineAction)` no mount para o fetch inicial (mirror Task 8's parent), usa `useBirthModeTimelineRealtime(pregnancyId, onNewEvent)` para atualizações ao vivo; renderiza cabeçalho com nome da paciente + badge "Modo Parto Ativo", `<BirthModeRegisterButtons pregnancyId onSuccess={refetch} />`, `<BirthModeTimeline events={events} />`
- **MIRROR**: `apps/web/app/(dashboard)/patients/[id]/prenatal/page.tsx:1-48` (padrão de fetch client-only com loading/empty)
- **VALIDATE**: `pnpm check-types`

### Task 15: CREATE `apps/web/app/(dashboard)/modo-parto/page.tsx`

- **ACTION**: Nova rota `/modo-parto`
- **IMPLEMENT**: Client component; lê `pregnancyId` de `useSearchParams()`; se ausente, chama `getActiveBirthModePregnancyAction()` (Task 6) — se resultado tiver exatamente 1 gestação, renderiza `BirthModeScreen` direto; se 0, `EmptyState` ("Nenhum parto ativo no momento"); se >1, lista simples de seleção (nome da paciente + botão "Acompanhar") que atualiza a URL com `?pregnancyId=`
- **MIRROR**: `apps/web/app/(dashboard)/patients/[id]/prenatal/page.tsx:1-48` (estrutura de page.tsx client-only)
- **VALIDATE**: `pnpm check-types`; `pnpm dev` e navegar manualmente para `/modo-parto`

### Task 16: UPDATE `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx`

- **ACTION**: Adicionar botão "Ativar Modo Parto"
- **IMPLEMENT**: Novo `useAction(activateBirthModeAction)`; botão visível quando `!patient.has_finished && !patient.birth_mode_active && pregnancy?.id` (usar `useAuth()` para gating opcional por `isObstetrician || isNurse || isDoula`, mirror `prenatal/page.tsx:14`); ao clicar, chama a action e em caso de sucesso usa `router.push(`/modo-parto?pregnancyId=${pregnancy.id}`)`; se `pregnancy.birth_mode_active` já for `true`, mostrar botão "Ir para Modo Parto" (mesma rota) em vez de "Ativar"
- **MIRROR**: `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:171-187` (estrutura de botão + `useConfirmModal` opcional para confirmar ativação, já que é uma ação com efeito colateral de notificação WhatsApp em massa)
- **GOTCHA**: Usar `useConfirmModal` (já importado no arquivo, linha 18) para confirmar antes de ativar, já que dispara WhatsApp para toda a equipe — ação não deve ser um clique único acidental
- **VALIDATE**: `pnpm check-types`; teste manual: clicar, confirmar, verificar redirect e badge atualizado

### Task 17: Validação de tipos e lint completos

- **ACTION**: Rodar validação estática em todo o escopo alterado
- **VALIDATE**: `pnpm check-types && npx biome check --write --unsafe apps/web/src/actions apps/web/src/modals apps/web/src/components/shared apps/web/src/screens apps/web/src/hooks apps/web/src/lib apps/web/app/\(dashboard\)/modo-parto`

### Task 18: Validação manual ponta a ponta

- **ACTION**: Smoke test manual (não há infraestrutura de testes automatizados no repo — confirmado, zero arquivos `*.test.ts`/`*.spec.ts` em todo o monorepo)
- **VALIDATE**: Ver seção "Validação Manual" abaixo

---

## Testing Strategy

Este repositório não possui nenhuma infraestrutura de testes automatizados (nenhum `*.test.ts`, `*.spec.ts`, ou test runner configurado em `apps/web` ou `packages/supabase` — confirmado por busca exaustiva). Introduzir uma suíte de testes do zero está fora do escopo desta fase (seria uma mudança estrutural maior, não pedida no PRD). A validação desta fase é 100% manual, seguindo os passos abaixo, e via `pnpm check-types`/`biome` para correção estática.

### Edge Cases Checklist (validação manual)

- [ ] Dois profissionais da mesma equipe, mesma gestação: inserir contração em uma aba, ver aparecer na outra em <2s
- [ ] Inserir a mesma medição (ex: FCF) duas vezes em <30min por profissionais diferentes → segunda inserção mostra toast de aviso, mas o registro é salvo
- [ ] Inserir a mesma medição duas vezes em <30min pelo MESMO profissional → sem aviso (checar `professional_id !== user.id` na query de duplicidade)
- [ ] Tentar registrar bolsa rota duas vezes na mesma gestação → segunda tentativa falha com mensagem amigável (constraint UNIQUE)
- [ ] Profissional que NÃO é membro da equipe da paciente tenta acessar `/modo-parto?pregnancyId=X` → RLS bloqueia leitura, tela mostra vazio/erro tratado
- [ ] Gestação sem Modo Parto ativo (`birth_mode_active=false`) acessada via `/modo-parto?pregnancyId=X` → tela trata graciosamente (não deveria permitir registro se não está ativo — validar na action ou na UI)
- [ ] Usuário acessa `/modo-parto` sem query param e sem nenhuma gestação ativa em sua equipe → `EmptyState`
- [ ] Usuário acessa `/modo-parto` sem query param com 2+ gestações ativas simultâneas em sua equipe → lista de seleção

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types && npx biome check apps/web/src
```
**EXPECT**: Exit 0, sem erros

### Level 2: DATABASE_VALIDATION
Usar Supabase MCP (`mcp__supabase__list_tables`, `mcp__supabase__get_advisors`) para verificar:
- [ ] Migration da Task 9 aplicada (`ALTER PUBLICATION supabase_realtime ADD TABLE ...` para as 7 tabelas)
- [ ] `pnpm db:types` executado e `database.types.ts` sem diffs inesperados
- [ ] `get_advisors` sem novos warnings de RLS/segurança introduzidos

### Level 3: BROWSER_VALIDATION
Usar Chrome MCP ou `pnpm dev` manual:
- [ ] `/modo-parto` renderiza corretamente para paciente com Modo Parto ativo
- [ ] Os 7 formulários abrem, validam e submetem corretamente (Dialog no desktop, Sheet no mobile — testar em viewport <640px)
- [ ] Timeline atualiza em tempo real entre duas sessões de browser diferentes
- [ ] Toast de duplicidade aparece corretamente no cenário de teste

### Level 4: MANUAL_VALIDATION
Seguir os "Edge Cases Checklist" acima na íntegra, incluindo o teste de dois profissionais simultâneos.

---

## Acceptance Criteria

- [ ] Todos os 8 tipos de evento (7 formulários + ativação) capturados corretamente com `professional_id` + timestamp
- [ ] Cardinalidade correta: 6 tipos permitem múltiplos registros, bolsa rota é única (enforced por constraint UNIQUE no banco)
- [ ] Alerta de duplicidade não-bloqueante funciona para os 6 tipos de registro múltiplo
- [ ] Timeline atualiza em tempo real (<2s) entre membros da equipe, sem refresh manual
- [ ] Botão "Ativar Modo Parto" funcional na ficha da paciente, com confirmação antes do disparo (WhatsApp em massa)
- [ ] `pnpm check-types` e `biome check` passam sem erros
- [ ] RLS via `is_team_member` respeitada em todas as novas actions (nenhum bypass com `supabaseAdmin` fora do necessário)
- [ ] Nenhum campo `patient_id` enviado manualmente nos inserts (trigger cuida disso)

---

## Completion Checklist

- [ ] Todas as 18 tasks completas em ordem de dependência
- [ ] Level 1: `pnpm check-types` + `biome check` passam
- [ ] Level 2: Migration de Realtime publication aplicada e `database.types.ts` atualizado
- [ ] Level 3: Validação manual no browser (desktop + mobile) completa
- [ ] Level 4: Edge cases manuais validados
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Realtime com 7 tabelas encadeadas em 1 canal pode ter overhead de latência não documentado pela Supabase | LOW | MED | Smoke test manual de latência (<2s, mesmo critério da fase 2); se degradar, considerar 1 canal por tabela como fallback |
| `professional_id` exige resolução de nome via join extra em cada action e no hook Realtime (payload de Realtime não traz joins) | MED | LOW | Task 8 mantém um mapa local `professionalId → name` carregado no fetch inicial (Task 7) para resolver nomes de eventos que chegam via Realtime sem join |
| Nenhuma infraestrutura de testes automatizados no repo — risco de regressão silenciosa em mudanças futuras | HIGH (pré-existente) | MED | Fora do escopo desta fase corrigir; validação manual documentada extensivamente na seção Testing Strategy |
| Ausência de UI prévia para `activateBirthModeAction` (gap entre fases 3 e 4) pode gerar confusão sobre limite de escopo desta fase | LOW | LOW | Documentado explicitamente no Summary e Task 16 como parte necessária desta fase, já que sem ela `/modo-parto` é inacessível |
| Tabela `birth_contractions` com input manual de `duration_seconds` (sem cronômetro) pode gerar dados imprecisos em campo | MED | LOW | Aceito como simplificação de MVP explícita nesta fase (Task 10); cronômetro é melhoria futura, não bloqueante para o prazo do PRD |

---

## Notes

- A rota é `/modo-parto` (fora do namespace `/patients/[id]/...`), conforme especificado literalmente no PRD e no prompt original do cliente — por isso a resolução de `pregnancyId` precisa acontecer via query param ou resolução automática (Task 6/15), diferente do padrão usual de rotas aninhadas em `patients/[id]`.
- "Entrada em fase ativa" (1 dos 8 tipos de evento do PRD) **não precisa de tabela nem formulário novo** — já é capturada pela `activateBirthModeAction` existente (fase 3) via `pregnancies.birth_mode_activated_at`/`birth_mode_activated_by`; a Task 7/13 apenas precisa incluí-la como o primeiro item da timeline.
- A Fase 5 (redirect automático + barra persistente) dependerá diretamente do hook `use-birth-mode-timeline-realtime.ts` desta fase como referência de padrão, mas terá seu próprio hook focado em `pregnancies.birth_mode_active` (não nas 7 tabelas de evento).
