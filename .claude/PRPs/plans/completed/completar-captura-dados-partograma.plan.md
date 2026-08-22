# Feature: Completar Captura de Dados do Partograma (Fase 1)

## Summary

Fechar as lacunas de captura de dados do modo parto necessárias para o futuro partograma: frequência de contração, dose/gotejamento de ocitocina, tipo de ruptura de membrana + líquido no momento da ruptura, e duas novas categorias de evento (vitais maternos e urina). Também expor `birth_apgar_scores` (já existente, mas nunca consultado) na timeline, como evento somente-leitura. Tudo seguindo, sem desvio, o padrão vertical já estabelecido em `birth_contractions`/`birth_medication_administrations`/`birth_membrane_ruptures`: migração SQL → tipos gerados → schema Zod → safe-action → modal → wiring em constants/register-buttons/timeline-action/timeline-render/realtime.

## User Story

As a integrante da equipe de cuidado (enfermagem obstétrica ou obstetra) no modo parto
I want to registrar frequência de contração, dose/gotejamento de ocitocina, tipo de ruptura de membrana, vitais maternos e urina
So that o futuro gráfico de partograma (Fases 3-4) tenha todos os dados clínicos necessários, e a linha do tempo já reflita esses registros hoje

## Problem Statement

O modelo de dados do modo parto cobre hoje dilatação, estação fetal, BCF, duração/efetividade de contração, tipo de líquido amniótico e timestamp de ruptura de membrana — mas falta: (1) frequência de contrações por 10 min, (2) dose/gotejamento de ocitocina, (3) tipo de ruptura (espontânea/artificial) e líquido no momento da ruptura, (4) vitais maternos (PA, pulso, temperatura), (5) urina (proteína, cetonúria, volume). Além disso, `birth_apgar_scores` existe mas não é consultado pela timeline. Sem isso, o partograma das Fases 3-4 fica incompleto frente ao modelo do Ministério da Saúde usado como referência.

## Solution Statement

Estender 3 tabelas existentes com novas colunas nullable, criar 2 tabelas novas (`birth_maternal_vitals`, `birth_urine_tests`) replicando fielmente o template de `birth_contractions`, e adicionar leitura (não escrita) de `birth_apgar_scores` à timeline — todos os pontos de wiring (constants, register-buttons, timeline action, timeline render, realtime hook, publication) atualizados na mesma passada por tipo de evento.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | MEDIUM (mecânico, mas toca ~10 pontos de wiring por tipo de evento)   |
| Systems Affected | `packages/supabase` (migrations, generated types), `apps/web/src/lib/validations`, `apps/web/src/actions`, `apps/web/src/modals`, `apps/web/src/components/shared`, `apps/web/src/hooks`, `apps/web/src/lib/birth-mode-constants.ts` |
| Dependencies     | zod ~3.24.1, next-safe-action ^8.1.4 (ambos já em uso, sem mudança de versão) |
| Estimated Tasks  | 16                                                                    |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌──────────────┐      ┌───────────────────┐      ┌───────────────────────┐  ║
║   │ Grid de       │ ──► │ Modal: Contração   │ ──► │ Timeline: "Contração   │  ║
║   │ registro       │     │ (duração apenas)   │     │  20s - intermediária"  │  ║
║   │ (7 botões)     │     ├───────────────────┤     ├───────────────────────┤  ║
║   │                │ ──► │ Modal: Ocitocina   │ ──► │ Timeline: "Ocitocina"  │  ║
║   │                │     │ (sem dose/gotejo)  │     │  (sem detalhe)         │  ║
║   │                │     ├───────────────────┤     ├───────────────────────┤  ║
║   │                │ ──► │ Modal: Ruptura de  │ ──► │ Timeline: "Ruptura de  │  ║
║   │                │     │ membrana (só data/ │     │  membrana" (sem tipo/  │  ║
║   │                │     │ hora)              │     │  líquido)              │  ║
║   └──────────────┘      └───────────────────┘      └───────────────────────┘  ║
║                                                                                ║
║   USER_FLOW: equipe só registra os campos hoje suportados; sem vitais/urina.   ║
║   PAIN_POINT: frequência, dose de ocitocina, detalhe de ruptura, vitais e      ║
║   urina não têm onde ser registrados. birth_apgar_scores existe mas nunca      ║
║   aparece na timeline.                                                        ║
║   DATA_FLOW: modal → safe-action → insert → fetchTimeline → lista plana.       ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌──────────────┐      ┌───────────────────┐      ┌───────────────────────┐  ║
║   │ Grid de       │ ──► │ Modal: Contração   │ ──► │ Timeline: "Contração   │  ║
║   │ registro       │     │ (duração +         │     │  20s - 3x/10min -     │  ║
║   │ (9 botões:     │     │  frequência/10min) │     │  intermediária"        │  ║
║   │  +2 novos)     │     ├───────────────────┤     ├───────────────────────┤  ║
║   │                │ ──► │ Modal: Ocitocina   │ ──► │ Timeline: "Ocitocina - │  ║
║   │                │     │ (+campos dose/     │     │  2.5 U/L - 20 gtt/min" │  ║
║   │                │     │  gotejamento se     │     │                       │  ║
║   │                │     │  medication_type =  │     │                       │  ║
║   │                │     │  ocitocina)         │     │                       │  ║
║   │                │     ├───────────────────┤     ├───────────────────────┤  ║
║   │                │ ──► │ Modal: Ruptura     │ ──► │ Timeline: "Ruptura     │  ║
║   │                │     │ (+tipo espontânea/  │     │  espontânea - líquido │  ║
║   │                │     │  artificial +       │     │  claro"                │  ║
║   │                │     │  líquido)           │     │                       │  ║
║   │                │     ├───────────────────┤     ├───────────────────────┤  ║
║   │                │ ──► │ Modal NOVO: Vitais │ ──► │ Timeline: "PA 120/80 - │  ║
║   │                │     │ maternos           │     │  Pulso 88 - 36.5°C"    │  ║
║   │                │     ├───────────────────┤     ├───────────────────────┤  ║
║   │                │ ──► │ Modal NOVO: Urina  │ ──► │ Timeline: "Proteína    │  ║
║   │                │     │                    │     │  ausente - Cetonúria   │  ║
║   │                │     │                    │     │  traços - 150ml"       │  ║
║   └──────────────┘      └───────────────────┘      └──── (sem botão) ───────┘  ║
║                                              ┌───────────────────────┐         ║
║                                              │ Timeline: "Apgar min 1:║         ║
║                                              │  9" (lido de           ║         ║
║                                              │  birth_apgar_scores,   ║         ║
║                                              │  escrito só por        ║         ║
║                                              │  finish-patient-care)  ║         ║
║                                              └───────────────────────┘         ║
║                                                                                ║
║   USER_FLOW: equipe registra 9 tipos de evento (2 novos); linha do tempo já    ║
║   mostra todos os campos que o partograma (Fase 3-4) vai plotar.               ║
║   VALUE_ADD: nenhum dado do modelo de referência falta na captura.            ║
║   DATA_FLOW: idêntico ao anterior (modal → safe-action → insert →             ║
║   fetchTimeline) — sem mudança de arquitetura, só mais colunas/tabelas/casos.  ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `birth-mode-register-buttons.tsx` | 7 botões de registro | 9 botões (Vitais Maternos, Urina novos) | Equipe registra os 2 novos tipos de evento |
| `add-birth-contraction-modal.tsx` | Só duração | Duração + frequência/10min | Registro mais completo por contração |
| `add-birth-medication-administration-modal.tsx` | Sem campos de dose para ocitocina | Campos dose (U/L) e gotejamento (gtt/min) aparecem quando `medication_type === "ocitocina"` | Consistente com o padrão já usado para "outros" |
| `add-birth-membrane-rupture-modal.tsx` | Só data/hora | + tipo (espontânea/artificial) + líquido | Documentação completa da ruptura |
| `birth-mode-timeline.tsx` | Sem entrada de Apgar | Mostra "Apgar min X: nota" (somente leitura) | Equipe vê o Apgar já registrado no finish-care sem sair da timeline |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql` | all | Template EXATO de migração a mirror para colunas novas e tabelas novas |
| P0 | `packages/supabase/supabase/migrations/20260822000010_birth_medication_administrations.sql` | all | Precedente de campo condicional via CHECK constraint (`outros`) |
| P0 | `apps/web/src/actions/add-birth-contraction-action.ts` | all (53 linhas) | Template EXATO de safe-action a mirror |
| P0 | `apps/web/src/modals/add-birth-contraction-modal.tsx` | all | Template EXATO de modal a mirror |
| P0 | `apps/web/src/lib/validations/birth-mode.ts` | all | Todos os schemas Zod existentes + `birthEventDateTimeSchema` compartilhado |
| P0 | `apps/web/src/actions/get-birth-mode-timeline-action.ts` | all (185 linhas) | Onde adicionar novas queries + mapeamento de payload |
| P1 | `apps/web/src/lib/birth-mode-constants.ts` | all (76 linhas) | `BirthEventType`, `BIRTH_EVENT_CONFIG`, `BIRTH_EVENT_TYPES`, label maps |
| P1 | `apps/web/src/lib/birth-mode-duplicate-check.ts` | all | `resolvePregnancyPatientId`, `combineDateAndTime`, `duplicateWindowStart`, `toDuplicateWarning`, `defaultBirthEventDateTime` |
| P1 | `apps/web/src/components/shared/birth-mode-register-buttons.tsx` | all (99 linhas) | Onde registrar os 2 novos modais |
| P1 | `apps/web/src/components/shared/birth-mode-timeline.tsx` | all (102 linhas) | `describeEvent` — onde adicionar novos `case`s |
| P1 | `apps/web/src/hooks/use-birth-mode-timeline-realtime.ts` | all | `TABLE_TO_EVENT_TYPE`/`TIME_COLUMN_BY_TABLE`/`PAYLOAD_KEYS_BY_TABLE` |
| P2 | `packages/supabase/supabase/migrations/20260822000004_birth_membrane_ruptures.sql` | all | Precedente "timestamp-only" + `UNIQUE(pregnancy_id)` |
| P2 | `packages/supabase/supabase/migrations/20260823000005_birth_apgar_scores.sql` | all | Estrutura da tabela já existente que será só lida |
| P2 | `packages/supabase/supabase/migrations/20260822000003_birth_mode_patient_id_trigger_fn.sql` | all | Função de trigger compartilhada (não duplicar) |
| P2 | `packages/supabase/supabase/migrations/20260822000011_birth_mode_professional_id_indexes.sql` | all | Padrão de índice `professional_id` por tabela |
| P2 | `packages/supabase/supabase/migrations/20260822000013_birth_tables_realtime_publication.sql` | all | Lista de tabelas na publicação realtime — adicionar as novas |
| P2 | `apps/web/src/lib/validations/prenatal.ts` | 84-85 | Convenção `systolic_bp`/`diastolic_bp` (dois inteiros) a reaproveitar em vitais maternos |
| P2 | `apps/web/src/lib/posthog/server.ts` | all | `captureServerEvent` — assinatura exata a chamar em cada nova action |

**External Documentation**: Nenhuma nova — zod (~3.24.1) e next-safe-action (^8.1.4) já são as versões em uso; nenhuma sintaxe nova é necessária além do que já aparece nos arquivos acima.

---

## Patterns to Mirror

**MIGRATION — tabela nova completa (mirror para `birth_maternal_vitals` e `birth_urine_tests`):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql
CREATE TABLE public.birth_contractions (
  id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
  pregnancy_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  duration_seconds smallint NOT NULL CHECK (duration_seconds > 0),
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

**MIGRATION — precedente de campo condicional (referência de raciocínio, NÃO usar CHECK rígido para ocitocina — ver Notes):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260822000010_birth_medication_administrations.sql
CONSTRAINT birth_medication_administrations_other_type_check
  CHECK (medication_type <> 'outros' OR other_birth_medication_type IS NOT NULL)
```

**ZOD SCHEMA — padrão compartilhado de data/hora:**
```ts
// SOURCE: apps/web/src/lib/validations/birth-mode.ts:9-20
export const birthEventDateTimeSchema = {
  date: z.string().min(1, "Informe a data"),
  time: z.string().min(1, "Informe o horário"),
};

export const birthContractionSchema = z.object({
  duration_seconds: z.coerce.number().int().positive("Duração deve ser maior que zero"),
  ...birthEventDateTimeSchema,
});
export type BirthContractionInput = z.infer<typeof birthContractionSchema>;
```

**ZOD SCHEMA — campo condicional (mirror para ocitocina):**
```ts
// SOURCE: apps/web/src/lib/validations/birth-mode.ts:51-64 (medication schema, padrão .refine)
export const birthMedicationAdministrationSchema = z
  .object({
    medication_type: z.enum(["fluidos_intravenosos", "ocitocina", "analgesia", "outros"]),
    other_birth_medication_type: z.string().optional(),
    notes: z.string().optional(),
    ...birthEventDateTimeSchema,
  })
  .refine((v) => v.medication_type !== "outros" || !!v.other_birth_medication_type, {
    message: "Especifique o medicamento",
    path: ["other_birth_medication_type"],
  });
```

**SAFE-ACTION — padrão completo (mirror exato):**
```ts
// SOURCE: apps/web/src/actions/add-birth-contraction-action.ts (arquivo completo, 53 linhas)
"use server";

import {
  combineDateAndTime,
  duplicateWindowStart,
  resolvePregnancyPatientId,
  toDuplicateWarning,
} from "@/lib/birth-mode-duplicate-check";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { birthContractionSchema } from "@/lib/validations/birth-mode";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: birthContractionSchema,
});

export const addBirthContractionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { pregnancyId, data } = parsedInput;

    const { data: recent } = await supabase
      .from("birth_contractions")
      .select("measured_at, professional_id, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .gte("measured_at", duplicateWindowStart())
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const duplicateWarning = toDuplicateWarning(user.id, recent, recent?.measured_at);
    const patientId = await resolvePregnancyPatientId(supabase, pregnancyId);
    const { date, time, ...rest } = data;

    const { error } = await supabase.from("birth_contractions").insert({
      pregnancy_id: pregnancyId,
      patient_id: patientId,
      professional_id: user.id,
      measured_at: combineDateAndTime(date, time),
      ...rest,
    });

    if (error) throw new Error(error.message);

    await captureServerEvent(user.id, "add_birth_contraction", { pregnancy_id: pregnancyId });

    return { success: true, duplicateWarning };
  });
```

**SAFE-ACTION — tabela com cardinalidade única (mirror para não duplicar erro de unicidade):**
```ts
// SOURCE: apps/web/src/actions/add-birth-membrane-rupture-action.ts (comportamento observado)
if (error.code === "23505") {
  throw new Error("Bolsa rota já foi registrada para este parto");
}
```

**MODAL — campo condicional (mirror exato para dose/gotejamento de ocitocina):**
```tsx
// SOURCE: apps/web/src/modals/add-birth-medication-administration-modal.tsx (padrão observado)
const medicationType = form.watch("medication_type");
// ...
{medicationType === "outros" && (
  <FormField name="other_birth_medication_type" ... />
)}
```

**CONSTANTS — union + config (mirror para novos tipos de evento):**
```ts
// SOURCE: apps/web/src/lib/birth-mode-constants.ts:32-75 (estrutura observada)
export type BirthEventType =
  | "start_monitoring"
  | "contraction"
  | "cervical_dilation"
  | "fetal_station"
  | "fetal_heart_rate"
  | "amniotic_fluid"
  | "medication"
  | "membrane_rupture";
// ADICIONAR: "maternal_vitals" | "urine_test" | "apgar"

export const BIRTH_EVENT_CONFIG: Record<BirthEventType, { label: string; icon: LucideIcon; colorClass: string }> = {
  // ... entradas existentes
};

export const BIRTH_EVENT_TYPES: Array<{ type: BirthEventType; cardinality: "multiple" | "single" }> = [
  // ... entradas existentes (SEM start_monitoring, SEM apgar — apgar não tem botão de registro)
];
```

**TIMELINE ACTION — loop de mapeamento por tabela (mirror para novas tabelas):**
```ts
// SOURCE: apps/web/src/actions/get-birth-mode-timeline-action.ts:93-172 (padrão observado por tabela)
for (const row of contractions ?? []) {
  events.push({
    type: "contraction",
    id: row.id,
    occurredAt: row.measured_at,
    professionalId: row.professional_id,
    professionalName: row.professional?.name ?? "—",
    payload: { duration_seconds: row.duration_seconds, effectiveness: row.effectiveness },
  });
}
```

**REALTIME HOOK — mapas por tabela (mirror para novas tabelas):**
```ts
// SOURCE: apps/web/src/hooks/use-birth-mode-timeline-realtime.ts:11-38
const TABLE_TO_EVENT_TYPE: Record<string, BirthEventType> = {
  birth_contractions: "contraction",
  // ADICIONAR: birth_maternal_vitals: "maternal_vitals", birth_urine_tests: "urine_test", birth_apgar_scores: "apgar"
};
const TIME_COLUMN_BY_TABLE: Record<string, string> = {
  birth_contractions: "measured_at",
  // ADICIONAR conforme coluna de tempo de cada nova tabela
};
const PAYLOAD_KEYS_BY_TABLE: Record<string, string[]> = {
  birth_contractions: ["duration_seconds", "effectiveness"],
  // ADICIONAR as colunas de payload de cada nova tabela
};
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `packages/supabase/supabase/migrations/20260824000001_extend_birth_contractions_frequency.sql` | CREATE | Adiciona `contractions_per_10min` |
| `packages/supabase/supabase/migrations/20260824000002_extend_birth_medication_oxytocin.sql` | CREATE | Adiciona `oxytocin_concentration_u_per_l`, `oxytocin_drip_rate_gtt_per_min` |
| `packages/supabase/supabase/migrations/20260824000003_extend_birth_membrane_ruptures.sql` | CREATE | Adiciona enum `birth_membrane_rupture_type` + colunas `rupture_type`, `fluid_type_at_rupture` (reaproveita enum `birth_amniotic_fluid_type` existente) |
| `packages/supabase/supabase/migrations/20260824000004_birth_maternal_vitals.sql` | CREATE | Nova tabela completa (mirror `birth_contractions`) |
| `packages/supabase/supabase/migrations/20260824000005_birth_urine_tests.sql` | CREATE | Nova tabela completa + enum `birth_urine_dipstick_level` compartilhado entre proteína/cetonúria |
| `packages/supabase/supabase/migrations/20260824000006_birth_new_tables_realtime_publication.sql` | CREATE | `ALTER PUBLICATION supabase_realtime ADD TABLE` para as 2 tabelas novas + `birth_apgar_scores` |
| `packages/supabase/src/types/database.types.ts` | UPDATE (gerado) | Via `pnpm db:types` após aplicar as migrações |
| `apps/web/src/lib/validations/birth-mode.ts` | UPDATE | Estende 3 schemas existentes, adiciona `birthMaternalVitalsSchema`, `birthUrineTestSchema` |
| `apps/web/src/lib/birth-mode-constants.ts` | UPDATE | Novos `BirthEventType`, `BIRTH_EVENT_CONFIG`, `BIRTH_EVENT_TYPES`, label maps para os novos enums |
| `apps/web/src/actions/add-birth-contraction-action.ts` | UPDATE | Insere `contractions_per_10min` |
| `apps/web/src/actions/add-birth-medication-administration-action.ts` | UPDATE | Insere campos de ocitocina |
| `apps/web/src/actions/add-birth-membrane-rupture-action.ts` | UPDATE | Insere `rupture_type`, `fluid_type_at_rupture` |
| `apps/web/src/actions/add-birth-maternal-vitals-action.ts` | CREATE | Mirror `add-birth-contraction-action.ts` |
| `apps/web/src/actions/add-birth-urine-test-action.ts` | CREATE | Mirror `add-birth-contraction-action.ts` |
| `apps/web/src/modals/add-birth-contraction-modal.tsx` | UPDATE | Campo de frequência |
| `apps/web/src/modals/add-birth-medication-administration-modal.tsx` | UPDATE | Campos condicionais de ocitocina |
| `apps/web/src/modals/add-birth-membrane-rupture-modal.tsx` | UPDATE | Campos de tipo de ruptura + líquido |
| `apps/web/src/modals/add-birth-maternal-vitals-modal.tsx` | CREATE | Mirror `add-birth-contraction-modal.tsx` |
| `apps/web/src/modals/add-birth-urine-test-modal.tsx` | CREATE | Mirror `add-birth-contraction-modal.tsx` |
| `apps/web/src/components/shared/birth-mode-register-buttons.tsx` | UPDATE | Registra os 2 novos modais/botões |
| `apps/web/src/actions/get-birth-mode-timeline-action.ts` | UPDATE | Query + mapeamento para `birth_maternal_vitals`, `birth_urine_tests`, `birth_apgar_scores`; estende payloads existentes |
| `apps/web/src/components/shared/birth-mode-timeline.tsx` | UPDATE | Novos `case`s em `describeEvent`; estende casos existentes |
| `apps/web/src/hooks/use-birth-mode-timeline-realtime.ts` | UPDATE | Novos mapas para as 3 tabelas (2 novas + apgar) |

---

## NOT Building (Scope Limits)

- **Nenhum componente de gráfico** — isso é Fase 3/4 do PRD. Esta fase só fecha a captura de dados e expõe tudo na timeline existente (lista, não gráfico).
- **Registro de Apgar via UI de modo parto** — `birth_apgar_scores` continua sendo escrito só por `finish-patient-care-action.ts`; aqui só adicionamos leitura (query + timeline). Não criamos modal nem botão de registro para Apgar.
- **Correção da race condition entre `fetchTimeline` (onSuccess) e o realtime `onNewEvent`** — identificada durante a exploração como comportamento pré-existente; documentada nos Riscos, mas o fix pertence à Fase 5 (Tempo real), não a esta fase.
- **CHECK constraints rígidos de banco para os novos campos condicionais** (ocitocina, ruptura de membrana) — ver Notes: usamos validação em nível de Zod para não arriscar migração falhar sobre linhas já existentes.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável.

### Task 1: CREATE migração — estender `birth_contractions`

- **ACTION**: CREATE `packages/supabase/supabase/migrations/20260824000001_extend_birth_contractions_frequency.sql`
- **IMPLEMENT**: `ALTER TABLE public.birth_contractions ADD COLUMN contractions_per_10min smallint CHECK (contractions_per_10min IS NULL OR contractions_per_10min >= 0);` — nullable, sem NOT NULL (linhas existentes não têm esse dado)
- **MIRROR**: Estilo de `packages/supabase/supabase/migrations/20260822000011_birth_mode_professional_id_indexes.sql` (migração pequena, um `ALTER TABLE` por arquivo)
- **VALIDATE**: `pnpm db:push` aplica sem erro

### Task 2: CREATE migração — estender `birth_medication_administrations` (ocitocina)

- **ACTION**: CREATE `packages/supabase/supabase/migrations/20260824000002_extend_birth_medication_oxytocin.sql`
- **IMPLEMENT**: `ALTER TABLE public.birth_medication_administrations ADD COLUMN oxytocin_concentration_u_per_l numeric(5,1), ADD COLUMN oxytocin_drip_rate_gtt_per_min smallint CHECK (oxytocin_drip_rate_gtt_per_min IS NULL OR oxytocin_drip_rate_gtt_per_min >= 0);` — ambas nullable
- **GOTCHA**: Não adicionar CHECK exigindo os campos quando `medication_type = 'ocitocina'` — linhas de ocitocina já existentes ficariam inválidas. A obrigatoriedade fica só no Zod (Task 8)
- **VALIDATE**: `pnpm db:push`

### Task 3: CREATE migração — estender `birth_membrane_ruptures`

- **ACTION**: CREATE `packages/supabase/supabase/migrations/20260824000003_extend_birth_membrane_ruptures.sql`
- **IMPLEMENT**:
  ```sql
  CREATE TYPE public.birth_membrane_rupture_type AS ENUM ('espontanea', 'artificial');

  ALTER TABLE public.birth_membrane_ruptures
    ADD COLUMN rupture_type public.birth_membrane_rupture_type,
    ADD COLUMN fluid_type_at_rupture public.birth_amniotic_fluid_type;
  ```
- **GOTCHA**: `fluid_type_at_rupture` reaproveita o enum `birth_amniotic_fluid_type` já criado para `birth_amniotic_fluid_records` — não criar um enum novo
- **MIRROR**: `packages/supabase/supabase/migrations/20260822000009_birth_amniotic_fluid_records.sql` para confirmar o nome exato do enum antes de referenciá-lo
- **VALIDATE**: `pnpm db:push`

### Task 4: CREATE migração — tabela `birth_maternal_vitals`

- **ACTION**: CREATE `packages/supabase/supabase/migrations/20260824000004_birth_maternal_vitals.sql`
- **IMPLEMENT**: Réplica exata da estrutura de `birth_contractions` (Patterns to Mirror) com colunas de domínio: `systolic_bp smallint CHECK (systolic_bp > 0)`, `diastolic_bp smallint CHECK (diastolic_bp > 0)`, `pulse_bpm smallint CHECK (pulse_bpm > 0)`, `temperature_celsius numeric(3,1) CHECK (temperature_celsius > 0)`, `measured_at timestamptz NOT NULL DEFAULT now()` — todas as colunas de domínio nullable individualmente (equipe pode registrar só o que mediu)
- **MIRROR**: `packages/supabase/supabase/migrations/20260822000005_birth_contractions.sql` (trigger `set_patient_id_before_insert`, RLS `is_team_member`, índices `patient_id` e `(pregnancy_id, measured_at DESC)`, GRANT para anon/authenticated/service_role)
- **ALSO ADD**: índice `professional_id` na mesma migração (não deixar para depois, como foi feito para as tabelas antigas em `20260822000011`)
- **VALIDATE**: `pnpm db:push`

### Task 5: CREATE migração — tabela `birth_urine_tests`

- **ACTION**: CREATE `packages/supabase/supabase/migrations/20260824000005_birth_urine_tests.sql`
- **IMPLEMENT**: `CREATE TYPE public.birth_urine_dipstick_level AS ENUM ('ausente', 'tracos', 'uma_cruz', 'duas_cruzes', 'tres_cruzes');` reaproveitado em duas colunas: `protein_level public.birth_urine_dipstick_level`, `ketone_level public.birth_urine_dipstick_level`, mais `volume_ml numeric(6,1) CHECK (volume_ml IS NULL OR volume_ml >= 0)`. Mesma estrutura de trigger/RLS/índices/grants de `birth_contractions`
- **MIRROR**: Task 4 (mesma estrutura, tabela irmã)
- **VALIDATE**: `pnpm db:push`

### Task 6: CREATE migração — publicação realtime

- **ACTION**: CREATE `packages/supabase/supabase/migrations/20260824000006_birth_new_tables_realtime_publication.sql`
- **IMPLEMENT**:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_maternal_vitals;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_urine_tests;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.birth_apgar_scores;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260822000013_birth_tables_realtime_publication.sql`
- **VALIDATE**: `pnpm db:push`

### Task 7: Regenerar tipos TypeScript

- **ACTION**: RUN `pnpm db:types`
- **VALIDATE**: `git diff packages/supabase/src/types/database.types.ts` mostra as 2 novas tabelas + colunas novas nas 3 tabelas estendidas + `pnpm check-types` sem erro

### Task 8: UPDATE `apps/web/src/lib/validations/birth-mode.ts`

- **ACTION**: UPDATE schemas existentes + CREATE 2 novos
- **IMPLEMENT**:
  - `birthContractionSchema`: adicionar `contractions_per_10min: z.coerce.number().int().min(0).optional()`
  - `birthMedicationAdministrationSchema`: adicionar `oxytocin_concentration_u_per_l: z.coerce.number().positive().optional()`, `oxytocin_drip_rate_gtt_per_min: z.coerce.number().int().min(0).optional()`, e estender o `.refine` existente (ou adicionar um segundo `.refine`) para exigir ambos quando `medication_type === "ocitocina"`
  - `birthMembraneRuptureSchema`: adicionar `rupture_type: z.enum(["espontanea", "artificial"])`, `fluid_type_at_rupture: z.enum(["claro", "com_meconio", "com_sangue"])` (mesmos valores usados em `birthAmnioticFluidRecordSchema`, exceto `"intacto"` que não faz sentido no momento da ruptura)
  - CREATE `birthMaternalVitalsSchema = z.object({ systolic_bp: z.coerce.number().int().positive().optional(), diastolic_bp: z.coerce.number().int().positive().optional(), pulse_bpm: z.coerce.number().int().positive().optional(), temperature_celsius: z.coerce.number().positive().optional(), ...birthEventDateTimeSchema })`
  - CREATE `birthUrineTestSchema = z.object({ protein_level: z.enum([...]).optional(), ketone_level: z.enum([...]).optional(), volume_ml: z.coerce.number().min(0).optional(), ...birthEventDateTimeSchema })`
- **MIRROR**: `birthContractionSchema` (16-19), `birthMedicationAdministrationSchema` (51-64)
- **VALIDATE**: `pnpm check-types` (packages/web)

### Task 9: UPDATE `apps/web/src/lib/birth-mode-constants.ts`

- **ACTION**: UPDATE `BirthEventType`, `BIRTH_EVENT_CONFIG`, `BIRTH_EVENT_TYPES`, label maps
- **IMPLEMENT**: Adicionar `"maternal_vitals" | "urine_test" | "apgar"` ao union; entradas em `BIRTH_EVENT_CONFIG` para os 3 (ícone/cor — escolher ícones Lucide coerentes, ex. `Activity` para vitais, `TestTube` para urina, `Baby` para apgar); adicionar `{ type: "maternal_vitals", cardinality: "multiple" }` e `{ type: "urine_test", cardinality: "multiple" }` a `BIRTH_EVENT_TYPES` — **NÃO adicionar `"apgar"` a `BIRTH_EVENT_TYPES`** (sem botão de registro); adicionar `BIRTH_URINE_DIPSTICK_LABELS` e `BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS` (pt-BR)
- **MIRROR**: Estrutura existente (32-75)
- **VALIDATE**: `pnpm check-types`

### Task 10: UPDATE `add-birth-contraction-action.ts` + modal

- **ACTION**: UPDATE action (insert já usa spread `...rest`, então incluir o novo campo no `data` é suficiente — sem mudança na action) + UPDATE modal para adicionar campo `contractions_per_10min` (input numérico)
- **MIRROR**: Estrutura de campos do próprio modal (padrão de `FormField` + `Input type="number"`)
- **VALIDATE**: `pnpm check-types && pnpm lint`

### Task 11: UPDATE `add-birth-medication-administration-action.ts` + modal

- **ACTION**: UPDATE modal para renderizar campos condicionais de ocitocina
- **IMPLEMENT**: `const medicationType = form.watch("medication_type"); {medicationType === "ocitocina" && (<><FormField name="oxytocin_concentration_u_per_l" .../><FormField name="oxytocin_drip_rate_gtt_per_min" .../></>)}`
- **MIRROR**: Bloco condicional existente para `"outros"` (Patterns to Mirror)
- **VALIDATE**: `pnpm check-types && pnpm lint`

### Task 12: UPDATE `add-birth-membrane-rupture-action.ts` + modal

- **ACTION**: UPDATE modal para adicionar `Select` de `rupture_type` e `Select` de `fluid_type_at_rupture`
- **MIRROR**: `Select` de `medication_type` no modal de medicação (`Object.entries(LABELS).map(...)`)
- **VALIDATE**: `pnpm check-types && pnpm lint`

### Task 13: CREATE `add-birth-maternal-vitals-action.ts` + modal

- **ACTION**: CREATE ambos os arquivos
- **MIRROR**: `add-birth-contraction-action.ts` (arquivo completo) e `add-birth-contraction-modal.tsx` (arquivo completo) — trocar nome da tabela, schema e campos
- **IMPORTS**: `birthMaternalVitalsSchema` de `@/lib/validations/birth-mode`
- **VALIDATE**: `pnpm check-types && pnpm lint`

### Task 14: CREATE `add-birth-urine-test-action.ts` + modal

- **ACTION**: CREATE ambos os arquivos
- **MIRROR**: Mesmo padrão da Task 13
- **VALIDATE**: `pnpm check-types && pnpm lint`

### Task 15: UPDATE `birth-mode-register-buttons.tsx`

- **ACTION**: UPDATE para importar e renderizar `AddBirthMaternalVitalsModal` e `AddBirthUrineTestModal`, seguindo o padrão hardcoded existente (import + bloco `<AddXModal open={activeModal === "x"} .../>`)
- **MIRROR**: Blocos existentes (linhas 55-96)
- **VALIDATE**: `pnpm check-types && pnpm lint`

### Task 16: UPDATE `get-birth-mode-timeline-action.ts`, `birth-mode-timeline.tsx`, `use-birth-mode-timeline-realtime.ts`

- **ACTION**: UPDATE os 3 arquivos de wiring final na mesma task (interdependentes)
- **IMPLEMENT**:
  - `get-birth-mode-timeline-action.ts`: adicionar `birth_maternal_vitals`, `birth_urine_tests`, `birth_apgar_scores` ao `Promise.all`; adicionar 3 loops `for (const row of X ?? [])` mapeando para `BirthModeTimelineEvent` (tipo `"maternal_vitals"`, `"urine_test"`, `"apgar"`); estender os payloads de `contraction` (+ `contractions_per_10min`), `medication` (+ `oxytocin_concentration_u_per_l`, `oxytocin_drip_rate_gtt_per_min`), `membrane_rupture` (+ `rupture_type`, `fluid_type_at_rupture`)
  - `birth-mode-timeline.tsx`: adicionar `case`s `"maternal_vitals"`, `"urine_test"`, `"apgar"` em `describeEvent`; estender os `case`s existentes de `"contraction"`, `"medication"`, `"membrane_rupture"` para exibir os novos campos quando presentes
  - `use-birth-mode-timeline-realtime.ts`: adicionar entradas em `TABLE_TO_EVENT_TYPE`, `TIME_COLUMN_BY_TABLE` (`measured_at` para as 2 novas; confirmar coluna de tempo de `birth_apgar_scores` — provavelmente `created_at`, já que a tabela não tem `measured_at` própria — checar migração antes de assumir), `PAYLOAD_KEYS_BY_TABLE`
- **MIRROR**: Patterns to Mirror (loop de mapeamento, mapas do hook)
- **GOTCHA**: `birth_apgar_scores` não tem coluna `measured_at` (confirmar em `20260823000005_birth_apgar_scores.sql`) — usar `created_at` como `occurredAt`/`TIME_COLUMN_BY_TABLE` para esse caso
- **VALIDATE**: `pnpm check-types && pnpm lint`

---

## Testing Strategy

### Edge Cases Checklist

- [ ] Registrar contração sem preencher frequência (campo opcional) — não deve quebrar
- [ ] Selecionar `medication_type = "ocitocina"` sem preencher dose/gotejamento — Zod deve exigir (mensagem de erro visível)
- [ ] Trocar de "ocitocina" para outro tipo no mesmo formulário antes de submeter — campos condicionais devem sumir e não bloquear submit
- [ ] Registrar ruptura de membrana pela segunda vez na mesma gestação — deve continuar retornando o erro amigável de unicidade (23505), agora também com os novos campos preenchidos na tentativa
- [ ] Vitais maternos com apenas 1 dos 4 campos preenchido (ex.: só temperatura) — deve salvar
- [ ] Urina sem volume (só proteína/cetonúria) — deve salvar
- [ ] `birth_apgar_scores` populado via finish-care aparece na timeline com type `"apgar"` sem ter passado pelo grid de registro
- [ ] Timeline com gestação que NUNCA teve finish-care — nenhuma entrada de Apgar aparece (sem erro de linha ausente)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types && pnpm lint
```
**EXPECT**: Exit 0, sem erros

### Level 2: DATABASE_VALIDATION
Via Supabase MCP ou `pnpm db:push` + inspeção manual:
- [ ] 3 tabelas estendidas têm as novas colunas, nullable
- [ ] 2 tabelas novas criadas com trigger, RLS (SELECT+INSERT via `is_team_member`), índices (`patient_id`, `professional_id`, `(pregnancy_id, measured_at DESC)`), grants
- [ ] `birth_maternal_vitals`, `birth_urine_tests`, `birth_apgar_scores` aparecem em `supabase_realtime` publication
- [ ] `pnpm db:types` roda sem erro e gera diff coerente em `database.types.ts`

### Level 3: MANUAL_VALIDATION (via `apps/web` local)
1. Abrir modo parto de uma gestação de teste
2. Registrar cada um dos 9 tipos de evento (incluindo os 2 novos) e confirmar que aparecem corretamente na timeline com os novos campos
3. Confirmar que o campo de frequência/dose/gotejamento/tipo de ruptura é opcional/condicional conforme especificado
4. Confirmar que uma gestação com finish-care já concluído mostra a entrada de Apgar na timeline

---

## Acceptance Criteria

- [ ] Todos os 5 campos/gaps do PRD (frequência, ocitocina dose/gotejamento, ruptura detalhada, vitais maternos, urina) têm caminho de captura funcional
- [ ] `birth_apgar_scores` aparece na timeline como evento somente-leitura
- [ ] Level 1-2 de validação passam
- [ ] Nenhuma regressão nos 7 tipos de evento já existentes (testar manualmente cada um)
- [ ] Nenhum CHECK constraint de banco quebra dados já existentes nas tabelas estendidas

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Adicionar NOT NULL/CHECK rígido em coluna nova de tabela com linhas já existentes falha a migração | MEDIUM | HIGH | Todas as colunas novas em tabelas existentes são nullable (Tasks 1-3); obrigatoriedade fica no Zod, não no banco |
| Race entre `fetchTimeline` (onSuccess) e `useBirthModeTimelineRealtime` (onNewEvent) já existe hoje e passa a afetar também os 2 novos tipos de evento | MEDIUM (pré-existente) | LOW-MEDIUM | Fora do escopo desta fase; documentado para ser tratado na Fase 5 (Tempo real) |
| `birth_apgar_scores` não tem coluna `measured_at` própria — usar coluna errada como timestamp quebra ordenação da timeline | LOW | MEDIUM | Task 16 exige confirmar a coluna de tempo real na migração antes de codar (`created_at` provável) |
| Escolha de ícones/labels em `BIRTH_EVENT_CONFIG` para os novos tipos ficar inconsistente com os demais | LOW | LOW | Seguir o padrão visual (Lucide icon + colorClass Tailwind) já usado nas 7 entradas existentes |

---

## Notes

- **Frequência de contração**: decidido como campo manual (`contractions_per_10min`, observação da equipe durante o exame), não calculado a partir dos timestamps das contrações já registradas — mantém fidelidade ao modelo clássico do partograma (papel), onde a frequência é uma contagem observada em janela de 10 min, não uma métrica derivada. Alternativa rejeitada: calcular a partir de `birth_contractions.measured_at` (rejeitada porque contrações individuais já logadas continuamente não formam necessariamente uma janela de observação de 10 min limpa).
- **Nenhum CHECK rígido para campos condicionais em tabelas existentes**: diferente do precedente de `"outros"` (que tinha CHECK porque a tabela era nova quando o CHECK foi criado), aqui optamos por só Zod porque `birth_medication_administrations` e `birth_membrane_ruptures` já têm dados em produção — um CHECK que exigisse os novos campos quebraria a migração se qualquer linha existente de ocitocina não tiver dose, por exemplo.
- Este plano cobre só a Fase 1 do PRD. As Fases 3-4 (mini-gráficos) dependem dos dados aqui capturados existirem e estarem corretamente expostos por `getBirthModeTimelineAction`.
