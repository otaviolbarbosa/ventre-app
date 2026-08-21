# Feature: Modo Parto — Fase 6: Extensão do Fluxo de Finalização

## Summary

Estender o fluxo existente de finalização de acompanhamento (`finish-care-modal.tsx` + `finish-patient-care-action.ts`) para capturar o desfecho estruturado do parto: via de parto (agora com 3 opções — vaginal normal, vaginal assistido, cesárea), data **e hora** do nascimento, sexo do bebê, peso ao nascer e escala de APGAR (componentes clínicos padrão, aos 1 e 5 minutos). Os campos de desfecho simples (via de parto, data/hora, sexo, peso) são adicionados como colunas em `pregnancies`, seguindo o padrão já usado por `delivery_method`/`born_at`. O APGAR é modelado como uma tabela dedicada (`birth_apgar_scores`), pois é clinicamente composto por 5 subcomponentes (não um número livre) e pode ter múltiplas leituras — isso seguiria o padrão de tabela de evento já usado pelas demais tabelas do Modo Parto (`birth_membrane_ruptures`, `birth_fetal_heart_rates`), mas sem Realtime (captura pontual no encerramento, não colaboração ao vivo).

## User Story

Como profissional da equipe de cuidado (doula, enfermeira, médica obstetra)
Eu quero registrar o desfecho completo do parto (via de parto, horário, sexo do bebê, peso e APGAR) ao finalizar o acompanhamento
Para que os dados estruturados do parto fiquem digitalmente registrados, substituindo o registro em papel, sem retrabalho em uma tela separada

## Problem Statement

Hoje, ao finalizar o acompanhamento de uma gestante (`finish-care-modal.tsx`), o sistema só captura data de nascimento (sem hora) e via de parto (2 opções: vaginal/cesárea, sem distinguir assistido). Não existe nenhum campo para sexo do bebê, peso ao nascer ou APGAR — dados que hoje continuam sendo anotados em papel, exatamente o problema central que o Modo Parto pretende resolver. Isso é testável: hoje, ao finalizar um parto no Ventre, é impossível preencher esses campos digitalmente; após esta fase, deve ser possível preencher todos eles e vê-los persistidos corretamente no banco.

## Solution Statement

Estender o schema Zod compartilhado (novo arquivo `apps/web/src/lib/validations/birth-outcome.ts`), o schema de banco (`pregnancies` + nova tabela `birth_apgar_scores`) e a UI (`finish-care-modal.tsx`) e a action (`finish-patient-care-action.ts`) de forma aditiva e retrocompatível: todos os novos campos são opcionais, o fluxo de finalização para partos sem Modo Parto continua funcionando exatamente como hoje.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                        |
| Complexity       | MEDIUM                                             |
| Systems Affected | `packages/supabase` (migrations, types), `apps/web` (validations, action, UI, constants) |
| Dependencies     | zod ~3.24.1, next-safe-action ^8.1.4, next 16.1.0, react-hook-form, @hookform/resolvers/zod |
| Estimated Tasks  | 11                                                  |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌──────────────────┐    ┌─────────────────────┐    ┌──────────────────┐    ║
║   │ Perfil da         │───▶│ FinishCareModal      │───▶│ pregnancies       │    ║
║   │ Paciente          │    │ - Data nascimento     │    │ has_finished=true │    ║
║   │ "Finalizar         │    │ - Via de parto        │    │ born_at (date)    │    ║
║   │  Acompanhamento"   │    │   (vaginal/cesárea)   │    │ delivery_method   │    ║
║   └──────────────────┘    │ - Descrição livre      │    └──────────────────┘    ║
║                            └─────────────────────┘                             ║
║                                                                                ║
║   USER_FLOW: Profissional finaliza acompanhamento; só consegue registrar       ║
║   data de nascimento (sem hora) e via de parto (2 opções); sexo, peso e        ║
║   APGAR seguem sendo anotados em papel à parte.                                ║
║   PAIN_POINT: Nenhum dado clínico de desfecho estruturado (sexo, peso, APGAR)  ║
║   é capturado digitalmente — o problema central do Modo Parto continua para    ║
║   esses campos.                                                                ║
║   DATA_FLOW: form → finishPatientCareAction → UPDATE pregnancies (2 campos)    ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   ┌──────────────────┐    ┌─────────────────────────┐    ┌──────────────────┐ ║
║   │ Perfil da         │───▶│ FinishCareModal (ext.)   │───▶│ pregnancies       │ ║
║   │ Paciente          │    │ - Data + Hora nascimento  │    │ has_finished=true │ ║
║   │ "Finalizar         │    │ - Via de parto (3 opções) │    │ born_at (datetime)│ ║
║   │  Acompanhamento"   │    │ - Sexo do bebê            │    │ delivery_method   │ ║
║   └──────────────────┘    │ - Peso ao nascer (g)      │    │ baby_sex (novo)   │ ║
║                            │ - [x] Registrar APGAR      │    │ birth_weight_g    │ ║
║                            │    ┌──────────┬─────────┐ │    └──────────────────┘ ║
║                            │    │ 1 minuto │ 5 minuto│ │           │             ║
║                            │    │ 5 selects│5 selects│ │           ▼             ║
║                            │    └──────────┴─────────┘ │    ┌──────────────────┐ ║
║                            │ - Descrição livre          │───▶│ birth_apgar_     │ ║
║                            └─────────────────────────┘    │ scores (novo)     │ ║
║                                                             │ 2 linhas (1/5min) │ ║
║                                                             └──────────────────┘ ║
║                                                                                ║
║   USER_FLOW: Profissional finaliza acompanhamento e, no mesmo modal, registra  ║
║   via de parto detalhada, data/hora exata, sexo, peso e escala de APGAR        ║
║   (por componente clínico, 1 e 5 minutos) — tudo digital, sem papel.           ║
║   VALUE_ADD: Elimina o último ponto de registro em papel do fluxo de parto;    ║
║   dados de desfecho ficam estruturados e consultáveis.                         ║
║   DATA_FLOW: form → finishPatientCareAction → UPDATE pregnancies (6 campos)    ║
║              + INSERT birth_apgar_scores (0-2 linhas, se addApgar=true)        ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `finish-care-modal.tsx` — via de parto | Radio 2 opções (vaginal/cesárea) | Select/radio 3 opções (vaginal normal/assistido/cesárea) | Registro mais fiel à realidade clínica |
| `finish-care-modal.tsx` — data nascimento | `DatePicker` (data apenas) | `DatePicker` + campo de hora (`type="time"`) | Permite registrar horário exato do parto |
| `finish-care-modal.tsx` — novos campos | Não existem | Sexo do bebê (Select), Peso ao nascer em gramas (Input numérico) | Substitui anotação em papel |
| `finish-care-modal.tsx` — APGAR | Não existe | Checkbox "Registrar APGAR" revela 2×5 selects (0/1/2 por componente, 1min e 5min) | Substitui partograma em papel para esse dado |
| `pregnancies` (DB) | `born_at date`, `delivery_method` (2 valores) | `born_at timestamptz`, `delivery_method` (3 valores), `baby_sex`, `birth_weight_grams` | — |
| `birth_apgar_scores` (DB, novo) | N/A | Tabela nova, RLS via `is_team_member`, sem Realtime | — |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/components/shared/finish-care-modal.tsx` | 1-206 | Arquivo completo a ser estendido — mirror exato do padrão de form/toggle/DatePicker |
| P0 | `apps/web/src/actions/finish-patient-care-action.ts` | 1-84 | Action completa a ser estendida — mirror exato do padrão de mutation/side-effects |
| P0 | `apps/web/src/lib/validations/birth-mode.ts` | 1-57 | Convenção de schemas Zod por evento (`z.object` + `z.infer`, `.superRefine`/`.refine` para campo condicional) |
| P0 | `packages/supabase/supabase/migrations/20260822000004_birth_membrane_ruptures.sql` | 1-33 | Padrão de tabela de evento "único por gestação" (`UNIQUE(pregnancy_id)`) — próximo ao que `birth_apgar_scores` precisa, mas com `UNIQUE(pregnancy_id, minute)` |
| P0 | `packages/supabase/supabase/migrations/20260822000008_birth_fetal_heart_rates.sql` | 1-33 | Padrão de `smallint NOT NULL CHECK (...)` para escalas numéricas pequenas |
| P1 | `packages/supabase/supabase/migrations/20260822000003_birth_mode_patient_id_trigger_fn.sql` | 1-16 | Trigger `set_patient_id_from_pregnancy()` — reaproveitar (não recriar) para `birth_apgar_scores` |
| P1 | `packages/supabase/supabase/migrations/20260318000001_pregnancies_add_delivery_method.sql` | 1-4 | Padrão exato de `CREATE TYPE ... AS ENUM` + `ALTER TABLE ADD COLUMN` a mirrorar para `baby_sex` |
| P1 | `apps/web/src/modals/add-birth-medication-administration-modal.tsx` | 1-152 | Padrão de modal com campo condicional (`Select` + campo revelado) e `Select`/`SelectContent`/`SelectItem` do design system |
| P1 | `apps/web/src/lib/constants.ts` | 1-8 | `PREGNANCY_DELIVERY_METHOD` — precisa de novo valor `vaginal_assisted`; mesmo padrão para `BABY_SEX` label map |
| P2 | `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx` | 34-56, 220-253 | Entry point: `pregnancy` já está em escopo (`result.data?.pregnancy`) — precisa passar `pregnancy?.id` como nova prop `pregnancyId` para `FinishCareModal` |
| P2 | `apps/web/src/actions/get-patient-action.ts` | 1-47 | Precisa incluir `baby_sex`, `birth_weight_grams` no `.select()` de `pregnancies` e no objeto `patient` retornado, se a UI for exibi-los depois (fora do escopo desta fase salvo indicação contrária — ver NOT_BUILDING) |
| P2 | `apps/web/src/actions/add-birth-fetal-heart-rate-action.ts` | 1-51 (arquivo análogo) | Reforça o padrão de action simples de insert em tabela de evento, caso o INSERT de APGAR seja extraído depois |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [ACOG Committee Opinion No. 644 — The Apgar Score](https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2015/10/the-apgar-score) | Estrutura clínica do escore | Confirma: 5 subcomponentes (aparência/cor, pulso/FC, irritabilidade reflexa, tônus muscular, respiração), cada um 0-2, aos 1 e 5 minutos (e a cada 5 min até 20 min se <7 — fora do escopo desta fase, ver NOT_BUILDING) |
| [Next.js — `updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag) | Uso em Server Actions | Confirma que `updateTag` (já usado na action) só funciona dentro de Server Actions — nenhuma mudança de comportamento necessária, apenas manter o padrão existente |
| [Zod v3 — `.superRefine`](https://v3.zod.dev/?id=superrefine) | Validação condicional multi-campo | `.superRefine` com múltiplos `ctx.addIssue` é necessário para os 10 subcampos de APGAR (condicionalmente obrigatórios) — `.refine()` simples só permite 1 erro por chamada |
| [next-safe-action — Validation errors](https://next-safe-action.dev/docs/define-actions/validation-errors) | `result.validationErrors` | Confirma que `path` no `ctx.addIssue`/`.refine()` é respeitado no client — já comprovado no próprio código (`birth-mode.ts:46-49`) |

---

## Patterns to Mirror

**ZOD_SCHEMA_CONDITIONAL_FIELD (padrão existente, estendido para múltiplos campos):**
```typescript
// SOURCE: apps/web/src/lib/validations/birth-mode.ts:40-49
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
```

**MIGRATION_SIMPLE_ENUM_COLUMN:**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260318000001_pregnancies_add_delivery_method.sql
CREATE TYPE delivery_method AS ENUM ('cesarean', 'vaginal');

ALTER TABLE pregnancies
  ADD COLUMN delivery_method delivery_method NULL;
```

**MIGRATION_EVENT_TABLE_WITH_UNIQUE_CONSTRAINT:**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260822000004_birth_membrane_ruptures.sql
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

**MIGRATION_SMALLINT_CHECK_SCALE:**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260822000008_birth_fetal_heart_rates.sql:6
bpm smallint NOT NULL CHECK (bpm > 0 AND bpm < 300),
```

**SERVER_ACTION_PATTERN (mutation + side effects, a estender):**
```typescript
// SOURCE: apps/web/src/actions/finish-patient-care-action.ts:17-83
export const finishPatientCareAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { error: updateError } = await supabase
      .from("pregnancies")
      .update({
        has_finished: true,
        born_at: parsedInput.bornAt ?? null,
        delivery_method: parsedInput.deliveryMethod ?? null,
      })
      .eq("patient_id", parsedInput.patientId);

    if (updateError) throw new Error(updateError.message);
    // ... revalidatePath, updateTag, WhatsApp, activity log, PostHog — mesma ordem
  });
```

**MODAL_SELECT_FIELD_PATTERN:**
```tsx
// SOURCE: apps/web/src/modals/add-birth-medication-administration-modal.tsx:84-107
<FormField
  control={form.control}
  name="medication_type"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tipo *</FormLabel>
      <Select onValueChange={field.onChange} value={field.value ?? ""}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {Object.entries(BIRTH_MEDICATION_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**CONSTANTS_LABEL_MAP_PATTERN:**
```ts
// SOURCE: apps/web/src/lib/constants.ts:5-8
export const PREGNANCY_DELIVERY_METHOD: Record<Enums<"delivery_method">, string> = {
  cesarean: "Cesárea",
  vaginal: "Parto Normal",
};
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `packages/supabase/supabase/migrations/20260823000001_pregnancies_born_at_timestamptz.sql` | CREATE | Muda `born_at` de `date` para `timestamptz` para suportar hora do parto |
| `packages/supabase/supabase/migrations/20260823000002_delivery_method_add_vaginal_assisted.sql` | CREATE | `ALTER TYPE delivery_method ADD VALUE 'vaginal_assisted'` |
| `packages/supabase/supabase/migrations/20260823000003_pregnancies_add_baby_sex.sql` | CREATE | Novo enum `baby_sex` + coluna em `pregnancies` |
| `packages/supabase/supabase/migrations/20260823000004_pregnancies_add_birth_weight.sql` | CREATE | Nova coluna `birth_weight_grams` em `pregnancies` |
| `packages/supabase/supabase/migrations/20260823000005_birth_apgar_scores.sql` | CREATE | Nova tabela de evento para os subcomponentes do APGAR (1 e 5 min), RLS via `is_team_member`, sem Realtime |
| `packages/supabase/src/types/database.types.ts` | UPDATE (gerado) | Rodar `pnpm db:types` após as migrations acima |
| `apps/web/src/lib/validations/birth-outcome.ts` | CREATE | Schema Zod compartilhado (client + server) para o desfecho do parto, incluindo `.superRefine` do APGAR |
| `apps/web/src/lib/constants.ts` | UPDATE | Adicionar `vaginal_assisted` a `PREGNANCY_DELIVERY_METHOD`; novo `BABY_SEX_LABELS` |
| `apps/web/src/actions/finish-patient-care-action.ts` | UPDATE | Usar o novo schema compartilhado; gravar `baby_sex`, `birth_weight_grams`, `born_at` (datetime), `delivery_method` (3 valores); inserir em `birth_apgar_scores` quando aplicável |
| `apps/web/src/components/shared/finish-care-modal.tsx` | UPDATE | Novos campos de UI: hora do parto, 3ª opção de via de parto, sexo, peso, seção de APGAR (checkbox + 2×5 selects) |
| `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx` | UPDATE | Passar `pregnancyId={pregnancy?.id}` para `FinishCareModal` (necessário para o INSERT em `birth_apgar_scores`) |

---

## NOT Building (Scope Limits)

- **Leituras estendidas de APGAR (10/15/20 min)** — o padrão clínico (ACOG/AAP) prevê leituras adicionais a cada 5 min até 20 min quando o escore aos 5 min é <7. Fora de escopo nesta fase; a tabela `birth_apgar_scores` já suporta `minute` como `smallint` livre (não travado a 1/5), então uma leitura futura pode ser adicionada sem nova migration — mas a UI desta fase só expõe 1 e 5 minutos.
- **Exibição/consulta pós-finalização dos dados de desfecho na tela de perfil ou histórico** — esta fase cobre apenas a captura no modal de finalização. Exibir sexo/peso/APGAR de volta na ficha da paciente é responsabilidade de uma fase de consumo/relatório futura (alinhado ao "Won't" do PRD: geração do partograma consolidado).
- **Edição/correção de um registro de finalização já salvo** — assim como o fluxo atual, não há tela de edição pós-finalização; corrigir um erro exige suporte manual (mesma limitação de hoje, não introduzida por esta fase).
- **Realtime em `birth_apgar_scores`** — diferente das tabelas de evento do Modo Parto (contração, FCF etc.), o APGAR é preenchido uma vez no encerramento por quem está finalizando o acompanhamento, não em colaboração ao vivo durante o parto. Não hcompensa o custo de manter mais uma tabela na publicação Realtime.
- **Migração de dados históricos** — partos já finalizados antes desta fase não terão `baby_sex`/`birth_weight_grams`/APGAR retroativamente; os campos ficam `NULL`, tratados normalmente pela UI (não exibidos nesta fase, ver acima).

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: CREATE migration `20260823000001_pregnancies_born_at_timestamptz.sql`

- **ACTION**: Alterar tipo da coluna `born_at` de `date` para `timestamptz`
- **IMPLEMENT**:
  ```sql
  ALTER TABLE pregnancies
    ALTER COLUMN born_at TYPE timestamptz USING born_at::timestamptz;
  ```
- **GOTCHA**: Todo o código que já lê `born_at` (11 arquivos, ver `apps/web/src/services/*`, `apps/web/src/lib/gestational-age.ts`, `patient-card.tsx`) trata o valor como `string | null` e formata via `dayjs(...)`. `dayjs` interpreta ISO timestamps normalmente — nenhuma dessas leituras quebra. Confirmado por busca prévia no código; não é necessário alterar esses arquivos.
- **VALIDATE**: `pnpm db:push` aplica sem erro; `pnpm db:types` reflete `born_at: string | null` (tipo TS inalterado)

### Task 2: CREATE migration `20260823000002_delivery_method_add_vaginal_assisted.sql`

- **ACTION**: Adicionar novo valor ao enum `delivery_method`
- **IMPLEMENT**:
  ```sql
  ALTER TYPE delivery_method ADD VALUE 'vaginal_assisted';
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260318000001_pregnancies_add_delivery_method.sql` (criação original do enum)
- **GOTCHA**: `ALTER TYPE ... ADD VALUE` não pode ser usado na mesma transação em que o novo valor é referenciado — como esta migration só adiciona o valor (não o usa), rodar como arquivo isolado é seguro.
- **VALIDATE**: `pnpm db:push`; `select unnest(enum_range(NULL::delivery_method))` retorna 3 valores

### Task 3: CREATE migration `20260823000003_pregnancies_add_baby_sex.sql`

- **ACTION**: Criar enum `baby_sex` e coluna em `pregnancies`
- **IMPLEMENT**:
  ```sql
  CREATE TYPE baby_sex AS ENUM ('masculino', 'feminino');

  ALTER TABLE pregnancies
    ADD COLUMN baby_sex baby_sex NULL;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260318000001_pregnancies_add_delivery_method.sql` (mesmo padrão exato)
- **VALIDATE**: `pnpm db:push`

### Task 4: CREATE migration `20260823000004_pregnancies_add_birth_weight.sql`

- **ACTION**: Adicionar coluna de peso ao nascer
- **IMPLEMENT**:
  ```sql
  ALTER TABLE pregnancies
    ADD COLUMN birth_weight_grams integer NULL
      CHECK (birth_weight_grams IS NULL OR birth_weight_grams > 0);
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260324000001_pregnancies_add_baby_name.sql` (coluna simples) + padrão de `CHECK` visto em `20260822000008_birth_fetal_heart_rates.sql:6`
- **GOTCHA**: Peso em gramas (inteiro), não quilos com decimais — evita problemas de precisão float; a UI deve converter/exibir como preferir (ex: "3450 g" ou "3,45 kg"), mas o armazenamento é sempre inteiro em gramas.
- **VALIDATE**: `pnpm db:push`

### Task 5: CREATE migration `20260823000005_birth_apgar_scores.sql`

- **ACTION**: Criar tabela de evento para os subcomponentes do APGAR
- **IMPLEMENT**:
  ```sql
  CREATE TABLE public.birth_apgar_scores (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    pregnancy_id uuid NOT NULL,
    patient_id uuid NOT NULL,
    professional_id uuid NOT NULL,
    minute smallint NOT NULL CHECK (minute IN (1, 5, 10, 15, 20)),
    appearance smallint NOT NULL CHECK (appearance BETWEEN 0 AND 2),
    pulse smallint NOT NULL CHECK (pulse BETWEEN 0 AND 2),
    grimace smallint NOT NULL CHECK (grimace BETWEEN 0 AND 2),
    activity smallint NOT NULL CHECK (activity BETWEEN 0 AND 2),
    respiration smallint NOT NULL CHECK (respiration BETWEEN 0 AND 2),
    total smallint GENERATED ALWAYS AS (appearance + pulse + grimace + activity + respiration) STORED,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT birth_apgar_scores_pkey PRIMARY KEY (id),
    CONSTRAINT birth_apgar_scores_pregnancy_id_minute_key UNIQUE (pregnancy_id, minute),
    CONSTRAINT birth_apgar_scores_pregnancy_id_fkey FOREIGN KEY (pregnancy_id) REFERENCES public.pregnancies(id) ON DELETE CASCADE,
    CONSTRAINT birth_apgar_scores_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
    CONSTRAINT birth_apgar_scores_professional_id_fkey FOREIGN KEY (professional_id) REFERENCES public.users(id) ON DELETE CASCADE
  );

  CREATE INDEX birth_apgar_scores_patient_id_idx ON public.birth_apgar_scores (patient_id);
  CREATE INDEX birth_apgar_scores_pregnancy_id_idx ON public.birth_apgar_scores (pregnancy_id);

  CREATE TRIGGER set_patient_id_before_insert
    BEFORE INSERT ON public.birth_apgar_scores
    FOR EACH ROW EXECUTE FUNCTION public.set_patient_id_from_pregnancy();

  ALTER TABLE public.birth_apgar_scores ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "View apgar scores" ON public.birth_apgar_scores
    FOR SELECT USING (public.is_team_member(patient_id));

  CREATE POLICY "Create apgar scores" ON public.birth_apgar_scores
    FOR INSERT WITH CHECK (public.is_team_member(patient_id));

  GRANT ALL ON TABLE public.birth_apgar_scores TO anon;
  GRANT ALL ON TABLE public.birth_apgar_scores TO authenticated;
  GRANT ALL ON TABLE public.birth_apgar_scores TO service_role;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260822000004_birth_membrane_ruptures.sql` (estrutura geral, trigger, RLS, grants) + `20260822000008_birth_fetal_heart_rates.sql` (padrão `smallint CHECK`)
- **IMPORTS**: Reaproveita `public.set_patient_id_from_pregnancy()` já criada em `20260822000003_birth_mode_patient_id_trigger_fn.sql` — **não recriar a função**
- **GOTCHA**: `minute IN (1, 5, 10, 15, 20)` permite as leituras estendidas futuras sem nova migration, mesmo que a UI desta fase só use 1 e 5. `UNIQUE(pregnancy_id, minute)` impede duplicar a mesma leitura (ex: reenvio duplo do form) — se a action tentar inserir a mesma `(pregnancy_id, minute)` duas vezes, a segunda falha com erro de constraint; tratar esse erro na action (idealmente `upsert` com `onConflict: "pregnancy_id,minute"` em vez de `insert`, para permitir reenvio do form finalizar sem erro).
- **VALIDATE**: `pnpm db:push`; inserir uma linha de teste via SQL editor como membro de equipe e como não-membro, confirmar RLS

### Task 6: RUN `pnpm db:types`

- **ACTION**: Regenerar tipos TypeScript após as 5 migrations acima
- **VALIDATE**: `packages/supabase/src/types/database.types.ts` contém `baby_sex`, `birth_weight_grams`, `birth_apgar_scores` (Row/Insert/Update), e `delivery_method` com 3 valores; `pnpm check-types` passa

### Task 7: CREATE `apps/web/src/lib/validations/birth-outcome.ts`

- **ACTION**: Criar schema Zod compartilhado (client + server) para o desfecho do parto
- **IMPLEMENT**:
  ```ts
  import { z } from "zod";

  const apgarSubScoreSchema = z.coerce.number().int().min(0).max(2);

  const apgarTimepointSchema = z.object({
    appearance: apgarSubScoreSchema.optional(),
    pulse: apgarSubScoreSchema.optional(),
    grimace: apgarSubScoreSchema.optional(),
    activity: apgarSubScoreSchema.optional(),
    respiration: apgarSubScoreSchema.optional(),
  });

  export const birthOutcomeBaseSchema = z.object({
    addBornAt: z.boolean().default(false),
    bornAt: z.string().optional(),
    bornAtTime: z.string().optional(),
    deliveryMethod: z.enum(["vaginal", "vaginal_assisted", "cesarean"]).optional(),
    babySex: z.enum(["masculino", "feminino"]).optional(),
    birthWeightGrams: z.coerce.number().int().positive().optional(),
    addApgar: z.boolean().default(false),
    apgar1: apgarTimepointSchema,
    apgar5: apgarTimepointSchema,
    description: z.string().max(5000).optional(),
  });

  function withApgarRefinement<T extends typeof birthOutcomeBaseSchema>(schema: T) {
    return schema.superRefine((v, ctx) => {
      if (!v.addApgar) return;
      (["apgar1", "apgar5"] as const).forEach((timepoint) => {
        (["appearance", "pulse", "grimace", "activity", "respiration"] as const).forEach((key) => {
          if (v[timepoint][key] === undefined) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Campo obrigatório ao registrar o APGAR",
              path: [timepoint, key],
            });
          }
        });
      });
    });
  }

  export const birthOutcomeSchema = withApgarRefinement(birthOutcomeBaseSchema);
  export type BirthOutcomeInput = z.infer<typeof birthOutcomeSchema>;

  export const finishCareActionSchema = withApgarRefinement(
    birthOutcomeBaseSchema.extend({
      patientId: z.string().uuid("ID do paciente inválido"),
      pregnancyId: z.string().uuid("ID da gestação inválido").optional(),
    }),
  );
  export type FinishCareActionInput = z.infer<typeof finishCareActionSchema>;
  ```
- **MIRROR**: `apps/web/src/lib/validations/birth-mode.ts:40-49` (padrão de `.refine`/schema por evento), mas usando `.superRefine` com `ctx.addIssue` múltiplo (necessário para 10 subcampos condicionais — ver GOTCHA)
- **GOTCHA**: `.refine()` só permite 1 mensagem de erro por chamada; com 10 subcampos de APGAR potencialmente vazios, usar `.superRefine()` com `ctx.addIssue` por campo (ver research: Zod v3 docs, discussion #938) para que cada select vazio mostre seu próprio erro em vez de um erro genérico único.
- **GOTCHA**: Campos-base (`apgar1.appearance` etc.) devem ficar `.optional()` no schema base — refinamentos só rodam **depois** que o shape base valida; se fossem `z.number().min(0).max(2)` obrigatórios, um campo vazio falharia na validação de shape antes do `.superRefine()` rodar, e a mensagem customizada nunca apareceria.
- **VALIDATE**: `pnpm check-types`

### Task 8: UPDATE `apps/web/src/lib/constants.ts`

- **ACTION**: Adicionar label do novo valor de `delivery_method` e labels de `baby_sex`
- **IMPLEMENT**:
  ```ts
  export const PREGNANCY_DELIVERY_METHOD: Record<Enums<"delivery_method">, string> = {
    cesarean: "Cesárea",
    vaginal: "Parto Normal",
    vaginal_assisted: "Parto Normal Assistido",
  };

  export const BABY_SEX_LABELS: Record<Enums<"baby_sex">, string> = {
    masculino: "Masculino",
    feminino: "Feminino",
  };
  ```
- **MIRROR**: `apps/web/src/lib/constants.ts:5-8` (padrão exato já existente)
- **VALIDATE**: `pnpm check-types`

### Task 9: UPDATE `apps/web/src/actions/finish-patient-care-action.ts`

- **ACTION**: Trocar schema local pelo `finishCareActionSchema` compartilhado; gravar os novos campos; inserir em `birth_apgar_scores` quando `addApgar` for `true`
- **IMPLEMENT**:
  - Substituir a definição local de `schema` por `import { finishCareActionSchema } from "@/lib/validations/birth-outcome"` e usar `.inputSchema(finishCareActionSchema)`
  - Montar `born_at` combinando `bornAt` (data) + `bornAtTime` (hora, opcional — default `00:00`) em uma string ISO antes do `.update()`
  - Adicionar `delivery_method`, `baby_sex`, `birth_weight_grams` ao objeto do `.update()` em `pregnancies`, mantendo o mesmo `.eq("patient_id", parsedInput.patientId)`
  - Após o `.update()` bem-sucedido, se `parsedInput.addApgar && parsedInput.pregnancyId`, fazer `supabase.from("birth_apgar_scores").upsert([...], { onConflict: "pregnancy_id,minute" })` com as 2 linhas (minute 1 e 5), incluindo `pregnancy_id: parsedInput.pregnancyId`, `professional_id: user.id` (o trigger preenche `patient_id` automaticamente)
  - Se `addApgar` for `true` mas `pregnancyId` estiver ausente, lançar erro claro (`throw new Error("Não é possível registrar APGAR sem uma gestação associada")`) em vez de falhar silenciosamente na FK
- **MIRROR**: `apps/web/src/actions/finish-patient-care-action.ts:17-83` (estrutura geral); `apps/web/src/actions/add-birth-medication-administration-action.ts:36-43` (padrão de insert em tabela de evento)
- **IMPORTS**: `import { finishCareActionSchema } from "@/lib/validations/birth-outcome"`
- **GOTCHA**: `UNIQUE(pregnancy_id, minute)` na tabela — usar `.upsert(..., { onConflict: "pregnancy_id,minute" })` em vez de `.insert()` para que reenviar o form (ex: usuário corrige um campo e salva de novo antes de finalizar) não quebre com erro de constraint
- **GOTCHA**: Não alterar a ordem dos side-effects existentes (`revalidatePath` → `updateTag` → busca de paciente → WhatsApp → activity log → PostHog) — apenas inserir a lógica de APGAR logo após o `.update()` de `pregnancies` e antes do `revalidatePath`
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/actions/finish-patient-care-action.ts`

### Task 10: UPDATE `apps/web/src/components/shared/finish-care-modal.tsx`

- **ACTION**: Adicionar UI para hora do parto, 3ª opção de via de parto, sexo, peso e seção de APGAR
- **IMPLEMENT**:
  - Adicionar prop `pregnancyId?: string` à interface `FinishCareModalProps`
  - Trocar o `schema`/`zodResolver` local pelo `birthOutcomeSchema` importado de `@/lib/validations/birth-outcome`
  - Ao lado do `DatePicker` de `bornAt`, adicionar um `<input type="time">` para `bornAtTime` (mesmo padrão de input cru já usado no arquivo para checkbox/radio, ver linhas 89-101 do arquivo atual)
  - Estender o bloco de `deliveryMethod` (linhas 130-163 do arquivo atual) com uma 3ª opção de radio `vaginal_assisted` — "Parto normal assistido"
  - Adicionar `FormField` para `babySex` (usar `Select`/`SelectContent`/`SelectItem` como em `add-birth-medication-administration-modal.tsx:84-107`, opções de `BABY_SEX_LABELS`)
  - Adicionar `FormField` para `birthWeightGrams` (`Input type="number"`, sufixo "g")
  - Adicionar checkbox `addApgar` (mesmo padrão do checkbox `addBornAt` já existente) que revela uma grade 2 colunas (1 minuto / 5 minutos) × 5 `Select` (Aparência, Pulso, Irritabilidade reflexa, Tônus muscular, Respiração), cada um com opções 0/1/2
  - No `onSubmit`, montar o payload combinando `patientId`, `pregnancyId`, e todos os campos do form antes de chamar `executeAsync`
- **MIRROR**: `apps/web/src/components/shared/finish-care-modal.tsx:1-206` (estrutura geral do componente); `apps/web/src/modals/add-birth-medication-administration-modal.tsx:84-137` (padrão de `Select` e campo condicional)
- **IMPORTS**: `import { birthOutcomeSchema, type BirthOutcomeInput } from "@/lib/validations/birth-outcome"`, `import { BABY_SEX_LABELS, PREGNANCY_DELIVERY_METHOD } from "@/lib/constants"`, `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` de `@ventre/ui/select`
- **GOTCHA**: A seção de APGAR só deve ser exibida/habilitada se `pregnancyId` estiver definido (sem gestação ativa, não há como persistir em `birth_apgar_scores` por causa da FK) — se `!pregnancyId`, ocultar o checkbox `addApgar` ou desabilitá-lo com uma nota explicativa
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/components/shared/finish-care-modal.tsx`

### Task 11: UPDATE `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx`

- **ACTION**: Passar `pregnancyId` para `FinishCareModal`
- **IMPLEMENT**: Alterar a chamada em torno da linha 247-252 para incluir `pregnancyId={pregnancy?.id}`
- **MIRROR**: Uso já existente de `pregnancy` no mesmo componente (linha 54: `const pregnancy = result.data?.pregnancy;`)
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

Não há suíte de testes automatizados para actions/forms neste repositório hoje (confirmado por busca — nenhum arquivo `*.test.ts*` em `apps/web`). Esta fase não introduz um framework de testes novo (fora de escopo); a validação é feita via os níveis abaixo (type-check, lint, validação manual/DB).

### Edge Cases Checklist

- [ ] Finalizar acompanhamento sem marcar `addBornAt` — nenhum campo novo é enviado, comportamento idêntico ao atual (regressão zero)
- [ ] Marcar `addBornAt` mas não preencher hora — `bornAtTime` vazio, `born_at` grava a data às 00:00 (comportamento atual preservado)
- [ ] Marcar `addApgar` sem preencher todos os 10 subcampos — erro por campo via `.superRefine`, submit bloqueado
- [ ] Marcar `addApgar` sem `pregnancyId` disponível (paciente sem gestação ativa) — seção oculta/desabilitada na UI; se contornado, action lança erro claro em vez de falhar na FK
- [ ] Reenviar o form de finalização duas vezes com APGAR preenchido (ex: erro de rede, usuário clica de novo) — `upsert` com `onConflict: "pregnancy_id,minute"` não deve gerar erro de constraint duplicada
- [ ] Selecionar via de parto `vaginal_assisted` — grava corretamente e aparece com o label correto em qualquer lugar que já leia `delivery_method` (ex: `insertActivityLog` já usa `deliveryLabel` — atualizar esse mapeamento também, ver Task 9)
- [ ] Peso ao nascer com valor não-positivo ou não-inteiro — bloqueado pelo Zod (`z.coerce.number().int().positive()`) antes de chegar à CHECK constraint do banco

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/actions/finish-patient-care-action.ts apps/web/src/components/shared/finish-care-modal.tsx apps/web/src/lib/validations/birth-outcome.ts apps/web/src/lib/constants.ts
```
**EXPECT**: Exit 0, sem erros

### Level 2: DATABASE_VALIDATION

Usar Supabase MCP ou `pnpm db:push` + SQL editor para verificar:
- [ ] `born_at` é `timestamptz` em `pregnancies`
- [ ] `delivery_method` tem 3 valores (`cesarean`, `vaginal`, `vaginal_assisted`)
- [ ] `baby_sex` e `birth_weight_grams` existem em `pregnancies`, nulláveis
- [ ] Tabela `birth_apgar_scores` existe com RLS habilitado, 2 políticas (SELECT/INSERT via `is_team_member`), trigger de `patient_id`, `UNIQUE(pregnancy_id, minute)`
- [ ] `pnpm db:types` gerado sem diffs pendentes (`git diff packages/supabase/src/types/database.types.ts` reflete exatamente os campos novos)

### Level 3: MANUAL_VALIDATION

1. Abrir uma paciente com gestação ativa não finalizada → "Finalizar Acompanhamento"
2. Marcar "Adicionar data de nascimento", preencher data + hora, selecionar "Parto normal assistido", sexo "Feminino", peso "3200"
3. Marcar "Registrar APGAR", deixar um subcampo em branco → confirmar erro específico nesse campo, submit bloqueado
4. Preencher todos os 10 subcampos de APGAR → salvar → confirmar sucesso, toast, redirecionamento para `/patients`
5. Verificar no banco: `pregnancies.born_at` com hora correta, `delivery_method = 'vaginal_assisted'`, `baby_sex = 'feminino'`, `birth_weight_grams = 3200`; `birth_apgar_scores` com 2 linhas (minute 1 e 5), `total` calculado corretamente
6. Repetir o fluxo de finalização **sem** marcar nenhum campo novo (paciente diferente) → confirmar que nada quebrou (regressão zero no caminho existente)
7. Testar com um usuário que **não** é membro da equipe da paciente tentando inserir diretamente em `birth_apgar_scores` via SQL — confirmar bloqueio por RLS

---

## Acceptance Criteria

- [ ] Todas as 5 migrations aplicam sem erro e `pnpm db:types` reflete o novo schema
- [ ] `finish-care-modal.tsx` captura via de parto (3 opções), data+hora do nascimento, sexo, peso e APGAR (10 subcampos, 2 timepoints)
- [ ] `finishPatientCareAction` grava todos os campos novos em `pregnancies` e `birth_apgar_scores`
- [ ] Fluxo de finalização sem Modo Parto (sem nenhum campo novo preenchido) continua funcionando exatamente como antes — zero regressão
- [ ] Level 1-2 de validação passam com exit 0
- [ ] Código mirrora os padrões existentes (schema Zod compartilhado, migrations no estilo dos arquivos `birth_*`, RLS via `is_team_member`)

---

## Completion Checklist

- [ ] Tasks 1-11 completadas em ordem de dependência
- [ ] Cada task validada imediatamente após conclusão
- [ ] Level 1: `pnpm check-types` + Biome lint passam
- [ ] Level 2: validação de banco (RLS, tipos, constraints) passa
- [ ] Level 3: validação manual completa (fluxo feliz + regressão + RLS)
- [ ] Todos os critérios de aceite atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| `ALTER COLUMN born_at TYPE timestamptz` falha ou corrompe dados existentes em produção | LOW | HIGH | `USING born_at::timestamptz` é um cast seguro de `date` para `timestamptz` (vira meia-noite UTC do dia); testar em ambiente de staging/branch antes de aplicar em produção; todos os 11 pontos de leitura já tratam o campo como `string` opaco formatado via `dayjs`, sem parsing manual de formato |
| `ALTER TYPE delivery_method ADD VALUE` bloqueando se executado dentro de uma transação que já usa o enum | LOW | MED | Migration isolada, sem uso do novo valor no mesmo arquivo — seguro conforme documentado pelo Postgres |
| Usuário marca "Registrar APGAR" sem gestação ativa (`pregnancyId` ausente) | MED | LOW | UI oculta/desabilita a seção sem `pregnancyId`; action lança erro explícito como defesa em profundidade caso a UI seja contornada |
| Reenvio duplo do formulário gera erro de `UNIQUE(pregnancy_id, minute)` | MED | LOW | Usar `upsert` com `onConflict` em vez de `insert` simples |
| `insertActivityLog` (linha 62-63 da action atual) hardcoda label de 2 valores de `delivery_method` (`"parto cesariana"`/`"parto vaginal"`) | HIGH | LOW | Task 9 deve atualizar esse mapeamento para incluir `vaginal_assisted`, ou trocar por `PREGNANCY_DELIVERY_METHOD[parsedInput.deliveryMethod]` (reaproveitando a constante já corrigida na Task 8) |

---

## Notes

- **Decisão de arquitetura — APGAR como tabela separada vs. colunas em `pregnancies`**: o PRD (linha 105) permite explicitamente "extensão de schema (Zod) e da tabela `pregnancies` (ou nova tabela de desfecho)". Optou-se por uma tabela dedicada (`birth_apgar_scores`) em vez de 10-12 colunas nulláveis em `pregnancies`, porque (1) o padrão clínico real (ACOG/AAP) modela o APGAR como leituras repetíveis por minuto, não um valor único, e uma tabela normalizada acomoda isso sem redesenho futuro; (2) o codebase já tem um padrão maduro e testado para exatamente esse tipo de tabela (`birth_membrane_ruptures`, `birth_fetal_heart_rates`); (3) evita inflar ainda mais a já grande tabela `pregnancies`. Os demais campos (via de parto, data/hora, sexo, peso) são valores únicos por gestação e seguem o padrão mais simples de coluna direta, mirrorando exatamente `delivery_method`/`born_at`/`baby_name` já existentes.
- **`Enums<"baby_sex">` e `Enums<"delivery_method">`** vêm de `@ventre/supabase` (re-export dos tipos gerados) — confirmar que o import em `constants.ts` continua funcionando após `pnpm db:types` (mesmo padrão já usado para `delivery_method`).
- Esta fase não altera `activate-birth-mode-action.ts` nem desativa `birth_mode_active`/grava `birth_mode_ended_at` — isso permanece um gap pré-existente (mencionado pelo agente de análise: nenhum código hoje desativa o Modo Parto). Se o cliente esperar que finalizar o acompanhamento também encerre o Modo Parto (`birth_mode_active = false`, `birth_mode_ended_at = now()`), isso é uma decisão de produto a confirmar — **não implementado nesta fase** por não estar no MoSCoW da Fase 6 do PRD, mas é um risco de expectativa a validar com o cliente antes do release.
