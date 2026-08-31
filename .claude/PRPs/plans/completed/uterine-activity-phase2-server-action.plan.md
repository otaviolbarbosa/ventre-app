# Feature: Dinâmica Uterina — Fase 2: Server Action e Validação

## Summary

Criar o server action `addBirthUterineActivityAction` que persiste um registro em lote de dinâmica uterina (quantidade de contrações, intervalo fixo em minutos, array de durações, notações DU já calculadas no cliente) na tabela `birth_uterine_activity` — espelhando exatamente o padrão de `add-birth-contraction-action.ts`, incluindo duplicate-check, resolução de `patient_id`, `maybeUnlockPartograph` (reaproveitado sem modificação) e captura de evento PostHog. Nenhuma UI é construída nesta fase; a notação DU é aceita como campo de entrada pré-calculado, permitindo que as Fases 3 (lógica pura de notação) e 4 (modal) avancem em paralelo depois desta.

## User Story

As a médica obstetra ou enfermeira obstétrica
I want to enviar um registro em lote de dinâmica uterina (via chamada de action) contendo quantidade de contrações, intervalo e durações
So that o dado seja persistido de forma segura e imutável em `birth_uterine_activity`, pronto para alimentar a matriz visual e a timeline do parto

## Problem Statement

Não existe hoje nenhum server action para escrever em `birth_uterine_activity` (tabela já criada na Fase 1). Sem ele, nem o modal (Fase 4) nem qualquer teste manual do fluxo em lote são possíveis.

## Solution Statement

Novo arquivo `apps/web/src/actions/add-birth-uterine-activity-action.ts`, construído sobre `authActionClient`, com um novo schema Zod `birthUterineActivitySchema` (co-localizado em `apps/web/src/lib/validations/birth-mode.ts`, junto aos demais schemas de birth-mode) que espelha as constraints de banco (`interval_minutes IN (10,20,30)`, `contraction_count` limitado por intervalo, `durations_seconds` todos positivos, `array_length(durations_seconds) === contraction_count`). O action reaproveita os helpers existentes de `birth-mode-duplicate-check.ts` (adaptado para a tabela `birth_uterine_activity`) e chama `maybeUnlockPartograph` sem alterações.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | NEW_CAPABILITY                                                       |
| Complexity       | LOW                                                                   |
| Systems Affected | `apps/web/src/actions`, `apps/web/src/lib/validations`                |
| Dependencies     | `next-safe-action` (existing), `zod` (existing), `@ventre/supabase` (existing) — no new packages |
| Estimated Tasks  | 3                                                                     |

---

## UX Design

Esta fase não tem UI própria (nenhum componente React é criado). O "usuário" desta fase é o próprio código-cliente (o modal da Fase 4, ou uma chamada manual via script/teste), que passa a ter um endpoint de persistência disponível onde antes não existia nenhum.

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Cliente (futuro modal) ──X──► Nenhum action disponível ──X──► Nenhuma     ║
║                                                              persistência  ║
║  DADO: tabela birth_uterine_activity existe (Fase 1) mas está vazia,      ║
║        sem nenhum caminho de escrita no código da aplicação.              ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Cliente ──► addBirthUterineActivityAction({pregnancyId, data}) ──►       ║
║     duplicate-check (birth_uterine_activity, janela 30min)                ║
║     ──► resolvePregnancyPatientId (valida birth_mode_active)              ║
║     ──► INSERT birth_uterine_activity                                     ║
║     ──► maybeUnlockPartograph (fire-and-forget, reaproveitado)            ║
║     ──► captureServerEvent("add_birth_uterine_activity")                  ║
║     ──► return { success, duplicateWarning }                              ║
║                                                                             ║
║  VALUE_ADD: caminho de escrita seguro e validado, pronto para o modal      ║
║             da Fase 4 consumir via useAction/executeAsync.                 ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | Impact |
|----------|--------|-------|--------|
| `apps/web/src/actions/` | Sem action para `birth_uterine_activity` | `addBirthUterineActivityAction` disponível | Fase 4 (modal) pode ser implementada sem bloqueio |

---

## Mandatory Reading

**CRITICAL: Ler estes arquivos antes de iniciar qualquer task.**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/actions/add-birth-contraction-action.ts` | 1-58 (full) | Padrão EXATO a espelhar — estrutura do action |
| P0 | `apps/web/src/lib/validations/birth-mode.ts` | 1-36 | Convenção de co-localização de schemas + `birthEventDateTimeSchema` spread pattern |
| P1 | `apps/web/src/lib/birth-mode-duplicate-check.ts` | full | Helpers a reaproveitar/adaptar: `duplicateWindowStart`, `toDuplicateWarning`, `combineDateAndTime`, `resolvePregnancyPatientId` |
| P1 | `apps/web/src/lib/birth-mode-partograph-gating.ts` | full | `maybeUnlockPartograph` — chamar SEM modificar (ver Decisions Log) |
| P1 | `apps/web/src/lib/safe-action.ts` | full | `authActionClient` — contexto `{ supabase, supabaseAdmin, user, profile }` |
| P1 | `apps/web/src/lib/posthog/server.ts` | full | `captureServerEvent(userId, event, properties)` |
| P2 | `packages/supabase/supabase/migrations/20260831000000_birth_uterine_activity.sql` | full | Constraints de banco que o Zod schema deve espelhar |
| P2 | `packages/supabase/src/types/database.types.ts` | linhas do bloco `birth_uterine_activity` (~927-987) | Tipo `Insert` gerado — colunas obrigatórias/opcionais |

**External Documentation:** Nenhuma pesquisa externa necessária — esta fase reusa exclusivamente bibliotecas e padrões já em uso no repositório (`next-safe-action`, `zod`, `@supabase/supabase-js`), sem API nova ou versão diferente envolvida.

---

## Patterns to Mirror

**SCHEMA_COMPOSITION (co-located, spread de `birthEventDateTimeSchema`):**
```typescript
// SOURCE: apps/web/src/lib/validations/birth-mode.ts:29-35
export const birthContractionSchema = z.object({
  duration_seconds: z.coerce.number().int().positive("Duração deve ser maior que zero"),
  pain_intensity: z.enum(["fraca", "fraca_media", "media", "media_forte", "forte"], {
    message: "Selecione a intensidade da dor",
  }),
  ...birthEventDateTimeSchema,
});
export type BirthContractionInput = z.infer<typeof birthContractionSchema>;
```

**ACTION_STRUCTURE (authActionClient + inputSchema + action):**
```typescript
// SOURCE: apps/web/src/actions/add-birth-contraction-action.ts (full file)
"use server";

import {
  combineDateAndTime,
  duplicateWindowStart,
  resolvePregnancyPatientId,
  toDuplicateWarning,
} from "@/lib/birth-mode-duplicate-check";
import { maybeUnlockPartograph } from "@/lib/birth-mode-partograph-gating";
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

    maybeUnlockPartograph(supabase, pregnancyId).catch((err) => {
      console.error("[add-birth-contraction] Failed to check partograph unlock threshold", err);
    });

    await captureServerEvent(user.id, "add_birth_contraction", { pregnancy_id: pregnancyId });

    return { success: true, duplicateWarning };
  });
```

**DUPLICATE_CHECK_HELPERS (reuse as-is, just target a different table in the query):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-duplicate-check.ts
export const DUPLICATE_WINDOW_MINUTES = 30;

export function duplicateWindowStart(): string {
  return new Date(Date.now() - DUPLICATE_WINDOW_MINUTES * 60 * 1000).toISOString();
}

export function toDuplicateWarning(
  currentUserId: string,
  row: { professional_id: string; professional: { name: string } | null } | null,
  occurredAtIso: string | undefined,
): DuplicateWarning {
  if (!row || row.professional_id === currentUserId || !occurredAtIso) return null;
  const minutesAgo = Math.max(1, Math.round((Date.now() - new Date(occurredAtIso).getTime()) / 60000));
  return { minutesAgo, professionalName: row.professional?.name ?? "outro profissional" };
}
```

---

## Files to Change

| File                                                              | Action | Justification                                                        |
| ------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------|
| `apps/web/src/lib/validations/birth-mode.ts`                      | UPDATE | Adicionar `birthUterineActivitySchema` co-localizado aos demais schemas |
| `apps/web/src/actions/add-birth-uterine-activity-action.ts`       | CREATE | Novo server action espelhando `add-birth-contraction-action.ts`     |

---

## NOT Building (Scope Limits)

- **UI/modal** — `add-birth-uterine-activity-modal.tsx` é Fase 4, não incluído aqui.
- **Cálculo/decomposição da notação DU** — a lógica pura de cálculo é Fase 3. Este action **aceita `du_notations` como entrada já calculada** (ver Decisions Log), não computa nada server-side.
- **Alteração em `maybeUnlockPartograph`** — a função continua lendo exclusivamente `birth_contractions`; registros em `birth_uterine_activity` não contribuem para o destravamento do partograma nesta fase (ver Decisions Log e Risks).
- **Agregação na timeline** — Fase 6.
- **Toggle de feature flag** — Fase 5.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Onde calcular `du_notations` | Cliente computa e envia como `string[]` no payload; o action apenas valida (array não-vazio de strings) e persiste | Action recalcula a notação a partir de `contraction_count`/`interval_minutes`/`durations_seconds` server-side | PRD descreve a notação sendo "calculada e exibida em tempo real" no modal (Fase 4) conforme os campos são preenchidos — cálculo é claramente client-side. Isso também é o que torna as Fases 3 e 4 paralelas e dependentes apenas da Fase 2 (a coluna `du_notations` é `NOT NULL` no schema gerado, então o action precisa aceitá-la desde já, mesmo antes da função pura da Fase 3 existir) |
| `maybeUnlockPartograph` | Reaproveitar sem nenhuma modificação, chamada fire-and-forget idêntica ao padrão de `add-birth-contraction-action.ts` | Estender a função para também considerar `birth_uterine_activity` | PRD Phase 2 diz explicitamente "maybeUnlockPartograph reaproveitados do padrão existente" (reuso, não modificação); estender o gating cross-tabela é uma decisão de produto fora do escopo desta fase — registrado como risco conhecido abaixo |
| Query de duplicate-check | Nova query contra `birth_uterine_activity` (mesma janela de 30min, mesma lógica de `toDuplicateWarning`), reaproveitando as funções puras existentes | Criar uma tabela/consulta unificada entre `birth_contractions` e `birth_uterine_activity` | Fora de escopo — PRD mantém as duas tabelas coexistindo por design, sem unificação |

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/lib/validations/birth-mode.ts`

- **ACTION**: ADD novo schema `birthUterineActivitySchema` (não remover nada existente)
- **IMPLEMENT**:
  ```typescript
  // ── Dinâmica uterina (registro em lote) ──────────────────────────────────
  export const birthUterineActivitySchema = z
    .object({
      interval_minutes: z.union([z.literal(10), z.literal(20), z.literal(30)], {
        message: "Selecione o intervalo (10, 20 ou 30 minutos)",
      }),
      contraction_count: z.coerce.number().int().min(0, "Quantidade inválida"),
      durations_seconds: z
        .array(z.coerce.number().int().positive("Duração deve ser maior que zero"))
        .min(1, "Informe ao menos uma duração"),
      du_notations: z.array(z.string().min(1)).min(1, "Notação DU não calculada"),
      ...birthEventDateTimeSchema,
    })
    .refine((v) => v.durations_seconds.length === v.contraction_count, {
      message: "A quantidade de durações deve ser igual à quantidade de contrações",
      path: ["durations_seconds"],
    })
    .refine((v) => v.contraction_count <= (v.interval_minutes / 10) * 6, {
      message: "Quantidade de contrações acima do limite esperado para o intervalo",
      path: ["contraction_count"],
    });
  export type BirthUterineActivityInput = z.infer<typeof birthUterineActivitySchema>;
  ```
- **MIRROR**: `apps/web/src/lib/validations/birth-mode.ts:22-35` (`birthEventDateTimeSchema` spread, `birthContractionSchema` composition style)
- **GOTCHA**: A constraint de banco `array_length(durations_seconds,1) = contraction_count` deve ser espelhada no `.refine()` — sem isso, um payload malformado só falharia no INSERT com um erro de Postgres pouco legível para o usuário
- **GOTCHA**: `interval_minutes` no banco é `smallint` com `CHECK IN (10,20,30)` — usar `z.union([z.literal(10), z.literal(20), z.literal(30)])` em vez de `z.enum` (que é só para strings) ou `z.coerce.number()` solto (que aceitaria qualquer inteiro)
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/lib/birth-mode-duplicate-check.ts` (update, not create)

- **ACTION**: Nenhuma mudança estrutural necessária neste arquivo — as funções `duplicateWindowStart`, `toDuplicateWarning`, `combineDateAndTime`, `resolvePregnancyPatientId` já são genéricas o suficiente (não fazem referência hardcoded a `birth_contractions` — a tabela é parametrizada pela query que as chama). **Confirmar isso lendo o arquivo antes de prosseguir**; se alguma função referenciar `birth_contractions` diretamente, ela precisa ser generalizada nesta task.
- **VALIDATE**: `pnpm check-types`

### Task 3: CREATE `apps/web/src/actions/add-birth-uterine-activity-action.ts`

- **ACTION**: CREATE novo server action
- **IMPLEMENT**:
  ```typescript
  "use server";

  import {
    combineDateAndTime,
    duplicateWindowStart,
    resolvePregnancyPatientId,
    toDuplicateWarning,
  } from "@/lib/birth-mode-duplicate-check";
  import { maybeUnlockPartograph } from "@/lib/birth-mode-partograph-gating";
  import { captureServerEvent } from "@/lib/posthog/server";
  import { authActionClient } from "@/lib/safe-action";
  import { birthUterineActivitySchema } from "@/lib/validations/birth-mode";
  import { z } from "zod";

  const schema = z.object({
    pregnancyId: z.string().uuid(),
    data: birthUterineActivitySchema,
  });

  export const addBirthUterineActivityAction = authActionClient
    .inputSchema(schema)
    .action(async ({ parsedInput, ctx: { supabase, user } }) => {
      const { pregnancyId, data } = parsedInput;

      const { data: recent } = await supabase
        .from("birth_uterine_activity")
        .select("measured_at, professional_id, professional:users(name)")
        .eq("pregnancy_id", pregnancyId)
        .gte("measured_at", duplicateWindowStart())
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const duplicateWarning = toDuplicateWarning(user.id, recent, recent?.measured_at);

      const patientId = await resolvePregnancyPatientId(supabase, pregnancyId);

      const { date, time, ...rest } = data;

      const { error } = await supabase.from("birth_uterine_activity").insert({
        pregnancy_id: pregnancyId,
        patient_id: patientId,
        professional_id: user.id,
        measured_at: combineDateAndTime(date, time),
        ...rest,
      });

      if (error) throw new Error(error.message);

      maybeUnlockPartograph(supabase, pregnancyId).catch((err) => {
        console.error(
          "[add-birth-uterine-activity] Failed to check partograph unlock threshold",
          err,
        );
      });

      await captureServerEvent(user.id, "add_birth_uterine_activity", {
        pregnancy_id: pregnancyId,
      });

      return { success: true, duplicateWarning };
    });
  ```
- **MIRROR**: `apps/web/src/actions/add-birth-contraction-action.ts` (full file, 1:1 structural mirror)
- **IMPORTS**: idênticos ao arquivo espelhado, trocando apenas `birthContractionSchema` → `birthUterineActivitySchema`
- **GOTCHA**: o spread `...rest` após desestruturar `date`/`time` de `data` deve produzir exatamente `{ interval_minutes, contraction_count, durations_seconds, du_notations }` — confirme que o tipo `Insert` gerado (`packages/supabase/src/types/database.types.ts`, bloco `birth_uterine_activity`) aceita esses campos sem sobra/falta antes de considerar a task concluída
- **GOTCHA**: `patient_id` é sobrescrito pelo trigger `set_patient_id_before_insert` no banco — o valor explícito no insert é exigido apenas pelo tipo TS gerado, não terá efeito real (mesmo comportamento documentado em `resolvePregnancyPatientId`)
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

Nenhum action irmão (`add-birth-contraction-action.ts` e os demais 9 em `apps/web/src/actions/birth-*`) possui teste automatizado — não há padrão de teste a seguir nesta camada. Consistente com essa convenção, esta fase não introduz testes automatizados; a validação é manual (ver Level 4 e 6 abaixo). A cobertura automatizada de lógica de negócio (decomposição da notação DU) fica para a Fase 3, que é a primeira desta feature com testes unitários planejados.

### Edge Cases Checklist (validação manual)

- [ ] `interval_minutes = 20` ou `30` com `contraction_count` dentro do limite (`(interval/10)*6`)
- [ ] `durations_seconds.length !== contraction_count` → erro de validação Zod, não chega ao INSERT
- [ ] Duração com valor `0` ou negativo → rejeitado pelo Zod antes do INSERT
- [ ] `birth_mode_active = false` na gestação → `resolvePregnancyPatientId` lança erro, action falha com `serverError`
- [ ] Registro duplicado de outro profissional dentro de 30min → `duplicateWarning` retornado, insert prossegue normalmente
- [ ] Registro duplicado do MESMO profissional → `duplicateWarning` é `null` (comportamento herdado de `toDuplicateWarning`)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros de tipo em nenhum pacote do monorepo

### Level 4: DATABASE_VALIDATION

Usar Supabase MCP (ou `psql`/dashboard) para confirmar após um insert manual de teste:
- [ ] Linha aparece em `birth_uterine_activity` com `patient_id` corretamente sobrescrito pelo trigger
- [ ] `array_length(durations_seconds,1) = contraction_count` satisfeito (o insert deve falhar no banco se o Zod não tivesse barrado antes — testar propositalmente burlando o Zod via chamada direta, se possível, para confirmar que o CHECK do banco é uma segunda linha de defesa)

### Level 6: MANUAL_VALIDATION

1. Escrever um script/teste ad-hoc (ou usar o console do Next.js/`ts-node`) chamando `addBirthUterineActivityAction` diretamente com um payload válido de exemplo do PRD (ex.: `DU 3/10/50"`: `interval_minutes: 10, contraction_count: 3, durations_seconds: [45,50,55], du_notations: ["DU 3/10' 50\""]`, `date`/`time` válidos) contra uma gestação de teste com `birth_mode_active = true`.
2. Confirmar retorno `{ success: true, duplicateWarning: null }`.
3. Repetir com um payload inválido (`durations_seconds.length !== contraction_count`) e confirmar que a validação Zod barra antes do INSERT (`result.validationErrors` populado).
4. Confirmar no PostHog (ou nos logs, se capturas de teste não forem desejadas em produção) que o evento `add_birth_uterine_activity` foi disparado.

---

## Acceptance Criteria

- [ ] `birthUterineActivitySchema` criado em `apps/web/src/lib/validations/birth-mode.ts`, espelhando convenções existentes
- [ ] `addBirthUterineActivityAction` criado em `apps/web/src/actions/add-birth-uterine-activity-action.ts`, estruturalmente idêntico a `add-birth-contraction-action.ts`
- [ ] `pnpm check-types` passa sem erros
- [ ] Duplicate-check funcional contra `birth_uterine_activity` (não `birth_contractions`)
- [ ] `maybeUnlockPartograph` chamado sem modificações, fire-and-forget
- [ ] Evento PostHog `add_birth_uterine_activity` capturado com `pregnancy_id`
- [ ] Validação manual (Level 6) executada com sucesso em ambiente de desenvolvimento

---

## Completion Checklist

- [ ] Task 1 completa e validada (`pnpm check-types`)
- [ ] Task 2 completa (confirmação de que os helpers já são genéricos, ou generalizados se necessário)
- [ ] Task 3 completa e validada (`pnpm check-types`)
- [ ] Level 1: Static analysis passa
- [ ] Level 4: Validação manual via Supabase confirma constraints de banco
- [ ] Level 6: Chamada manual do action confirma fluxo ponta a ponta
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | ---------------------------------------- |
| `maybeUnlockPartograph` não considera `birth_uterine_activity`, então partos que usam exclusivamente o novo fluxo em lote (flag ativa) podem nunca destravar o partograma automaticamente | M | M | Registrado explicitamente como fora de escopo desta fase (ver Decisions Log); deve ser revisitado como possível Fase adicional ou ajuste de produto antes do rollout completo da flag `show_uterine_activity` |
| `du_notations` aceito como entrada do cliente sem revalidação server-side da lógica de cálculo (Fase 3) permite, em tese, um payload com notação inconsistente com os dados numéricos | L | L | Aceito como trade-off deliberado para permitir paralelismo Fase 3/4; a integridade dos dados numéricos (`contraction_count`, `interval_minutes`, `durations_seconds`) é garantida por Zod + CHECK de banco independentemente do conteúdo de `du_notations` |
| Helpers de `birth-mode-duplicate-check.ts` podem ter alguma referência não-genérica a `birth_contractions` não detectada na exploração | L | M | Task 2 exige leitura/confirmação explícita do arquivo antes de prosseguir para a Task 3 |

---

## Notes

- Esta fase é deliberadamente pequena (2 arquivos) para manter o paralelismo com as Fases 3 e 4 conforme planejado no PRD.
- O nome do evento PostHog (`add_birth_uterine_activity`) e a métrica de sucesso do PRD ("Tempo médio de registro... Evento PostHog `add_birth_uterine_activity`") já estão alinhados — nenhuma decisão adicional de naming necessária.
- Depois desta fase, atualizar a tabela de fases do PRD (`uterine-activity.prd.md`): Status da Fase 2 → `in-progress`/`complete` conforme execução, e o campo PRP Plan apontando para este arquivo.
