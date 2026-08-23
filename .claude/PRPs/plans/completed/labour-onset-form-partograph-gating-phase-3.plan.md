# Feature: Cálculo e Persistência do Gating do Partograma (Phase 3)

## Summary

Implementar a checagem, persistida e monotônica ("high-water mark"), de quando uma gestante em Modo Parto atinge o limiar clínico para liberar o partograma: contração a cada 3 minutos E dilatação cervical ≥ 5cm. Ao ser atingido pela primeira vez, `pregnancies.partograph_unlocked_at` (coluna já existente desde a Phase 1) é setado para `now()` — e nunca mais alterado, mesmo que os indicadores regridam depois. A checagem roda dentro de `add-birth-contraction-action` e `add-birth-cervical-dilation-action`, já que qualquer um dos dois eventos pode ser o que "empurra" a gestante para o limiar. Também propaga `partograph_unlocked_at` pelo `fetchBirthModeTimelineData`, para que a Phase 4 (UI) possa consumi-lo.

## User Story

As a sistema de Modo Parto
I want to saber, de forma persistida e que nunca regride, quando uma gestante atingiu o limiar clínico de contração 3/3min + dilatação ≥5cm
So that o partograma só seja liberado quando clinicamente apropriado (Phase 4 consome esse dado para a UI)

## Problem Statement

Hoje não existe nenhuma lógica no código que leia ou escreva `partograph_unlocked_at` — a coluna existe no banco (Phase 1) mas está sempre `null`. Sem essa Phase 3, a Phase 4 (gating na UI) não tem nenhum dado para consumir.

## Solution Statement

Um novo helper puro-de-domínio, `maybeUnlockPartograph(supabase, pregnancyId)`, criado em `apps/web/src/lib/birth-mode-partograph-gating.ts`, busca as 2 contrações mais recentes (para calcular o intervalo entre elas) e a dilatação mais recente da gestação; se o intervalo entre as duas últimas contrações for ≤ 3 minutos E a dilatação mais recente for ≥ 5cm, faz um `.update({ partograph_unlocked_at: now() }).is("partograph_unlocked_at", null)` — que só afeta a linha se ainda estiver `null`, garantindo o comportamento idempotente/monotônico sem necessidade de transação ou lock. Esse helper é chamado (fire-and-forget, com `.catch()` logado, mesmo padrão de `scheduleBirthModeActivationNotifications`) logo após o insert em `add-birth-contraction-action` e em `add-birth-cervical-dilation-action`. `fetchBirthModeTimelineData` passa a selecionar e retornar `partograph_unlocked_at` da pregnancy.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | NEW_CAPABILITY                                                        |
| Complexity       | LOW                                                                   |
| Systems Affected | `apps/web` (lib, actions)                                             |
| Dependencies     | Nenhuma nova — usa apenas `@ventre/supabase` já em uso                |
| Estimated Tasks  | 4                                                                     |

---

## UX Design

Esta fase não tem UI própria — é puramente server-side (cálculo + persistência). A UI que consome `partograph_unlocked_at` é a Phase 4. Ainda assim, o diagrama abaixo documenta o efeito no fluxo de dados:

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  Profissional registra contração ──► addBirthContractionAction                 ║
║      │  INSERT birth_contractions                                              ║
║      ▼                                                                         ║
║  captureServerEvent("add_birth_contraction")                                   ║
║                                                                                 ║
║  Profissional registra dilatação ──► addBirthCervicalDilationAction            ║
║      │  INSERT birth_cervical_dilations                                        ║
║      ▼                                                                         ║
║  captureServerEvent("add_birth_cervical_dilation")                             ║
║                                                                                 ║
║  pregnancies.partograph_unlocked_at permanece NULL para sempre                 ║
║  (nenhum código lê ou escreve essa coluna)                                     ║
║                                                                                 ║
║  PAIN_POINT: não há como a Phase 4 saber quando liberar o partograma.          ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  Profissional registra contração ──► addBirthContractionAction                 ║
║      │  INSERT birth_contractions                                              ║
║      ▼                                                                         ║
║  maybeUnlockPartograph(supabase, pregnancyId)  ◄── fire-and-forget, .catch()   ║
║      │  1. busca 2 contrações mais recentes (measured_at desc, limit 2)        ║
║      │  2. busca dilatação mais recente (measured_at desc, limit 1)            ║
║      │  3. se intervalo ≤ 3min E dilatação ≥ 5cm:                              ║
║      │       UPDATE pregnancies SET partograph_unlocked_at = now()             ║
║      │       WHERE id = pregnancyId AND partograph_unlocked_at IS NULL         ║
║      ▼                                                                         ║
║  captureServerEvent("add_birth_contraction")                                   ║
║                                                                                 ║
║  (idêntico em addBirthCervicalDilationAction)                                  ║
║                                                                                 ║
║  fetchBirthModeTimelineData agora retorna partographUnlockedAt: string | null  ║
║                                                                                 ║
║  VALUE_ADD: dado persistido, monotônico, pronto para a Phase 4 consumir.       ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | Impact |
|----------|--------|-------|--------|
| `add-birth-contraction-action.ts` | Só insere a contração | Insere + verifica/seta gating | Sem mudança perceptível para o usuário; efeito é interno |
| `add-birth-cervical-dilation-action.ts` | Só insere a dilatação | Insere + verifica/seta gating | Idem |
| `fetchBirthModeTimelineData` | Não retorna `partograph_unlocked_at` | Retorna `partographUnlockedAt: string \| null` | Consumido pela Phase 4 (fora de escopo aqui) |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/actions/add-birth-contraction-action.ts` | 1-53 | Action a estender — ponto de chamada do novo helper |
| P0 | `apps/web/src/actions/add-birth-cervical-dilation-action.ts` | 1-53 | Idêntico — segundo ponto de chamada |
| P0 | `apps/web/src/lib/birth-mode-duplicate-check.ts` | 1-64 | Padrão de helper `SupabaseClient` type, estilo de query, `resolvePregnancyPatientId` (já roda antes do insert em ambas actions) |
| P0 | `apps/web/src/lib/birth-mode-chart-utils.ts` | 38-52 | `computeContractionsPer10Min` — CONFIRMA que a lógica existente é "contagem em janela de 10min", NÃO "intervalo entre duas últimas" — não reutilizar essa função, escrever cálculo de intervalo novo e mais simples |
| P0 | `apps/web/src/lib/birth-mode-timeline-data.ts` | 1-49, 247-255 | Onde adicionar `partograph_unlocked_at` ao select e ao objeto de retorno |
| P1 | `apps/web/src/actions/sign-patient-contract-action.ts` | ~115-123 | Padrão exato de "set apenas se ainda null" já usado no codebase (`.is("revoked_at", null)`) — mirror para `.is("partograph_unlocked_at", null)` |
| P1 | `apps/web/src/actions/activate-birth-mode-action.ts` | 25-29 (pós-extensão da Phase 2) | Padrão de fire-and-forget com `.catch()` logado (`scheduleBirthModeActivationNotifications(...).catch(...)`) a replicar para `maybeUnlockPartograph` |
| P2 | `packages/supabase/src/types/database.types.ts` | ~439-466 (`birth_cervical_dilations`), ~491-527 (`birth_contractions`) | Confirmar nomes de colunas: `measured_at` (timestamp), `dilation_cm` (valor de dilatação) |

**External Documentation:** Nenhuma necessária — feature usa apenas Supabase JS client já em uso, sem padrões novos.

---

## Patterns to Mirror

**QUERY "MAIS RECENTE(S) PARA UMA PREGNANCY_ID" (padrão existente, adaptado):**
```typescript
// SOURCE: apps/web/src/actions/add-birth-contraction-action.ts:24-31 (padrão de duplicate-check, adaptar removendo o .gte() de janela)
const { data: recent } = await supabase
  .from("birth_contractions")
  .select("measured_at, professional_id, professional:users(name)")
  .eq("pregnancy_id", pregnancyId)
  .gte("measured_at", duplicateWindowStart())
  .order("measured_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

**"SET APENAS SE AINDA NULL" (high-water mark idiom já usado no codebase):**
```typescript
// SOURCE: apps/web/src/actions/sign-patient-contract-action.ts:115-123
const { error: revokeError } = await supabase
  .from("contracts")
  .update({
    is_active: false,
    revoked_at: new Date().toISOString(),
    revoked_by: user.id,
  })
  .eq("id", existing.id)
  .is("revoked_at", null);
```

**COMPUTE DERIVADO DE JANELA (NÃO reutilizar — é uma contagem, não um intervalo):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-chart-utils.ts:38-52
export function computeContractionsPer10Min(
  contractionEvents: { id: string; occurredAt: string }[],
): Map<string, number> {
  const contractionsPer10MinById = new Map<string, number>();
  const trailingWindow: number[] = [];
  for (const event of contractionEvents) {
    const time = new Date(event.occurredAt).getTime();
    trailingWindow.push(time);
    while (trailingWindow.length > 0 && (trailingWindow[0] ?? time) < time - 10 * 60 * 1000) {
      trailingWindow.shift();
    }
    contractionsPer10MinById.set(event.id, trailingWindow.length);
  }
  return contractionsPer10MinById;
}
```
Este helper responde "quantas contrações caíram nos últimos 10 minutos terminando em cada contração" — uma contagem por janela deslizante, não "intervalo entre as duas últimas contrações". "Contração a cada 3 minutos" (requisito da PRD) é uma medida de INTERVALO, não de contagem — por isso o novo helper desta fase calcula a diferença de tempo entre as duas contrações mais recentes diretamente, em vez de adaptar/reutilizar `computeContractionsPer10Min`.

**FIRE-AND-FORGET COM `.catch()` LOGADO:**
```typescript
// SOURCE: apps/web/src/actions/activate-birth-mode-action.ts (após extensão da Phase 2)
scheduleBirthModeActivationNotifications(pregnancyId).catch((err) => {
  console.error("[activate-birth-mode] Failed to schedule WhatsApp notifications", err);
});
```

**HELPER `SupabaseClient` TYPE (padrão de arquivo lib):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-duplicate-check.ts:1-4
import { dayjs } from "@/lib/dayjs";
import type { createServerSupabaseClient } from "@ventre/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
```

**PREGNANCIES SELECT EM `fetchBirthModeTimelineData` (a estender):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-timeline-data.ts:33-39
supabase
  .from("pregnancies")
  .select(
    "patient_id, birth_mode_activated_at, birth_mode_activated_by, has_finished, birth_mode_active, activated_by:users!pregnancies_birth_mode_activated_by_fkey(name), patient:patients(name)",
  )
  .eq("id", pregnancyId)
  .single(),
```

**RETURN OBJECT DE `fetchBirthModeTimelineData` (a estender):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-timeline-data.ts:7-14, 247-254
export type BirthModeTimelineData = {
  events: BirthModeTimelineEvent[];
  patientId: string | null;
  patientName: string | null;
  hasFinished: boolean;
  birthModeActive: boolean;
  wasActivated: boolean;
};
...
return {
  events,
  patientId: pregnancy?.patient_id ?? null,
  patientName: (pregnancy?.patient as { name: string } | null)?.name ?? null,
  hasFinished: pregnancy?.has_finished ?? false,
  birthModeActive: pregnancy?.birth_mode_active ?? false,
  wasActivated: pregnancy?.birth_mode_activated_at != null,
};
```

---

## Files to Change

| File                                                                 | Action | Justification                                                        |
| ---------------------------------------------------------------------|--------|------------------------------------------------------------------------|
| `apps/web/src/lib/birth-mode-partograph-gating.ts`                  | CREATE | Novo helper `maybeUnlockPartograph` — cálculo do limiar + set idempotente |
| `apps/web/src/actions/add-birth-contraction-action.ts`              | UPDATE | Chamar `maybeUnlockPartograph` (fire-and-forget) após o insert |
| `apps/web/src/actions/add-birth-cervical-dilation-action.ts`        | UPDATE | Idem |
| `apps/web/src/lib/birth-mode-timeline-data.ts`                      | UPDATE | Selecionar e retornar `partographUnlockedAt` |

**Nota**: `apps/web/src/actions/get-birth-mode-timeline-action.ts` NÃO precisa de nenhuma mudança — delega inteiramente para `fetchBirthModeTimelineData` e o tipo `BirthModeTimelineData` propaga automaticamente.

---

## NOT Building (Scope Limits)

- Qualquer mudança em `birth-mode-screen.tsx` ou em qualquer componente de UI — isso é Phase 4, fora de escopo aqui.
- Re-bloqueio do partograma caso os indicadores regridam — explicitamente fora de escopo em toda a PRD (high-water mark permanente).
- Evento de analytics `partograph_unlocked` no PostHog — não solicitado pela PRD; nenhum evento equivalente existe hoje para "unlock" de nenhum tipo no codebase. Não introduzir isso nesta fase para não expandir escopo sem pedido explícito.
- Uso de `computeContractionsPer10Min` para o cálculo do limiar — é uma métrica diferente (contagem em janela, não intervalo); o novo helper calcula o intervalo diretamente.
- Qualquer mudança em `use-birth-mode-realtime.ts`/`use-birth-mode-timeline-realtime.ts` — a subscription existente em `pregnancies` (filtro `birth_mode_active=eq.true`) já recebe a mudança de `partograph_unlocked_at` automaticamente (confirmado pelo codebase-analyst); a Phase 4 decide o que fazer com esse dado na UI.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: CREATE `apps/web/src/lib/birth-mode-partograph-gating.ts`

- **ACTION**: Novo helper que calcula o limiar clínico e persiste `partograph_unlocked_at` de forma idempotente
- **IMPLEMENT**:
  ```typescript
  import type { createServerSupabaseClient } from "@ventre/supabase/server";

  type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

  const CONTRACTION_INTERVAL_THRESHOLD_MS = 3 * 60 * 1000;
  const DILATION_THRESHOLD_CM = 5;

  /** Libera o partograma permanentemente (high-water mark) quando a gestação atinge
   * contração a cada 3 minutos E dilatação ≥ 5cm. Idempotente: o `.is(..., null)` garante
   * que só a primeira chamada bem-sucedida efetivamente seta a coluna. */
  export async function maybeUnlockPartograph(
    supabase: SupabaseClient,
    pregnancyId: string,
  ): Promise<void> {
    const [{ data: recentContractions }, { data: latestDilation }] = await Promise.all([
      supabase
        .from("birth_contractions")
        .select("measured_at")
        .eq("pregnancy_id", pregnancyId)
        .order("measured_at", { ascending: false })
        .limit(2),
      supabase
        .from("birth_cervical_dilations")
        .select("dilation_cm")
        .eq("pregnancy_id", pregnancyId)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (!recentContractions || recentContractions.length < 2) return;
    if (!latestDilation || latestDilation.dilation_cm < DILATION_THRESHOLD_CM) return;

    const [latest, previous] = recentContractions;
    const intervalMs =
      new Date(latest.measured_at).getTime() - new Date(previous.measured_at).getTime();

    if (intervalMs > CONTRACTION_INTERVAL_THRESHOLD_MS) return;

    await supabase
      .from("pregnancies")
      .update({ partograph_unlocked_at: new Date().toISOString() })
      .eq("id", pregnancyId)
      .is("partograph_unlocked_at", null);
  }
  ```
- **MIRROR**: `apps/web/src/lib/birth-mode-duplicate-check.ts` (estilo de helper, `SupabaseClient` type) + `apps/web/src/actions/sign-patient-contract-action.ts:115-123` (padrão `.is(coluna, null)`)
- **GOTCHA**: `recentContractions` vem ordenado `measured_at desc`, então `recentContractions[0]` é a contração mais recente e `recentContractions[1]` é a anterior — `intervalMs` é sempre ≥ 0 nessa ordem
- **GOTCHA**: NÃO usar `computeContractionsPer10Min` — é uma métrica de contagem por janela, não de intervalo entre duas medições; escrever o cálculo de intervalo diretamente, como acima
- **GOTCHA**: A query de `birth_contractions`/`birth_cervical_dilations` usa o mesmo `supabase` (RLS, anon-key) já usado pelas actions chamadoras — confirmado pelo codebase-analyst que a policy `"Team members can update pregnancies"` permite ao membro de equipe atualizar `pregnancies` sem precisar de `supabaseAdmin`
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/actions/add-birth-contraction-action.ts`

- **ACTION**: Chamar `maybeUnlockPartograph` (fire-and-forget, com `.catch()` logado) logo após o insert bem-sucedido
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
- **MIRROR**: `apps/web/src/actions/activate-birth-mode-action.ts` — padrão `scheduleBirthModeActivationNotifications(pregnancyId).catch((err) => console.error(...))`
- **GOTCHA**: Chamar SEM `await` (fire-and-forget) para não atrasar a resposta ao usuário — igual ao padrão de notificações; a atualização de `partograph_unlocked_at` chega ao cliente via a subscription realtime já existente em `pregnancies` quando terminar
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/actions/add-birth-cervical-dilation-action.ts`

- **ACTION**: Idêntico à Task 2, mesma chamada fire-and-forget após o insert
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
  import { birthCervicalDilationSchema } from "@/lib/validations/birth-mode";
  import { z } from "zod";

  const schema = z.object({
    pregnancyId: z.string().uuid(),
    data: birthCervicalDilationSchema,
  });

  export const addBirthCervicalDilationAction = authActionClient
    .inputSchema(schema)
    .action(async ({ parsedInput, ctx: { supabase, user } }) => {
      const { pregnancyId, data } = parsedInput;

      const { data: recent } = await supabase
        .from("birth_cervical_dilations")
        .select("measured_at, professional_id, professional:users(name)")
        .eq("pregnancy_id", pregnancyId)
        .gte("measured_at", duplicateWindowStart())
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const duplicateWarning = toDuplicateWarning(user.id, recent, recent?.measured_at);

      const patientId = await resolvePregnancyPatientId(supabase, pregnancyId);

      const { date, time, ...rest } = data;

      const { error } = await supabase.from("birth_cervical_dilations").insert({
        pregnancy_id: pregnancyId,
        patient_id: patientId,
        professional_id: user.id,
        measured_at: combineDateAndTime(date, time),
        ...rest,
      });

      if (error) throw new Error(error.message);

      maybeUnlockPartograph(supabase, pregnancyId).catch((err) => {
        console.error(
          "[add-birth-cervical-dilation] Failed to check partograph unlock threshold",
          err,
        );
      });

      await captureServerEvent(user.id, "add_birth_cervical_dilation", {
        pregnancy_id: pregnancyId,
      });

      return { success: true, duplicateWarning };
    });
  ```
- **MIRROR**: Task 2 (mesmo padrão, arquivo irmão)
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/lib/birth-mode-timeline-data.ts`

- **ACTION**: Selecionar `partograph_unlocked_at` na query de `pregnancies` e retorná-lo no objeto `BirthModeTimelineData`
- **IMPLEMENT**:
  1. Estender o tipo (linhas 7-14):
     ```typescript
     export type BirthModeTimelineData = {
       events: BirthModeTimelineEvent[];
       patientId: string | null;
       patientName: string | null;
       hasFinished: boolean;
       birthModeActive: boolean;
       wasActivated: boolean;
       partographUnlockedAt: string | null;
     };
     ```
  2. Estender o select de `pregnancies` (linhas 33-39):
     ```typescript
     supabase
       .from("pregnancies")
       .select(
         "patient_id, birth_mode_activated_at, birth_mode_activated_by, has_finished, birth_mode_active, partograph_unlocked_at, activated_by:users!pregnancies_birth_mode_activated_by_fkey(name), patient:patients(name)",
       )
       .eq("id", pregnancyId)
       .single(),
     ```
  3. Estender o objeto de retorno (linhas 247-254):
     ```typescript
     return {
       events,
       patientId: pregnancy?.patient_id ?? null,
       patientName: (pregnancy?.patient as { name: string } | null)?.name ?? null,
       hasFinished: pregnancy?.has_finished ?? false,
       birthModeActive: pregnancy?.birth_mode_active ?? false,
       wasActivated: pregnancy?.birth_mode_activated_at != null,
       partographUnlockedAt: pregnancy?.partograph_unlocked_at ?? null,
     };
     ```
- **MIRROR**: Padrão existente de campos opcionais com fallback `?? null`/`?? false` já usado nas outras linhas do mesmo retorno
- **GOTCHA**: `get-birth-mode-timeline-action.ts` não precisa de nenhuma mudança — delega inteiramente para esta função e o tipo propaga automaticamente
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

Mesma realidade da Phase 2: não existe suíte de testes automatizados para actions/lib deste domínio (`apps/web` não tem `*.test.ts` para os arquivos irmãos `add-birth-*`/`birth-mode-*`). Validação desta fase é manual (inserção de eventos via UI existente) + `pnpm check-types` + query direta no banco.

### Edge Cases Checklist

- [ ] Gestação com 0 ou 1 contração registrada → `maybeUnlockPartograph` retorna cedo (sem dados suficientes), sem erro
- [ ] Gestação com 2+ contrações mas nenhuma dilatação registrada → retorna cedo, sem erro
- [ ] Duas contrações com intervalo de exatamente 3:00 (180000ms) → deve liberar (`intervalMs > threshold` usa `>`, não `>=`, então 180000 não é maior que 180000 → libera)
- [ ] Duas contrações com intervalo de 3:01 → NÃO libera
- [ ] Dilatação exatamente 5cm → libera (condição é `< 5`, então 5 não é menor que 5 → passa)
- [ ] Dilatação 4.9cm → NÃO libera
- [ ] Após liberar uma vez, registrar uma contração com intervalo > 3min (regressão) → `partograph_unlocked_at` NÃO muda (continua com o valor já setado, pois `.is(..., null)` não casa nenhuma linha)
- [ ] Registrar uma dilatação primeiro atingindo o limiar (não uma contração) → `maybeUnlockPartograph` chamado a partir de `add-birth-cervical-dilation-action` também libera corretamente
- [ ] Verificar via `mcp__supabase__execute_sql` que `partograph_unlocked_at` foi setado com um timestamp plausível (próximo do momento do insert que cruzou o limiar)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo

```bash
./node_modules/.bin/biome lint --write --unsafe apps/web/src/lib/birth-mode-partograph-gating.ts apps/web/src/actions/add-birth-contraction-action.ts apps/web/src/actions/add-birth-cervical-dilation-action.ts apps/web/src/lib/birth-mode-timeline-data.ts
```
**EXPECT**: 0 issues (usar o binário local diretamente — `npx biome` via o wrapper `rtk` deste ambiente pode retornar um exit code espúrio mesmo sem problemas reais, conforme observado na Phase 2)

### Level 4: DATABASE_VALIDATION

Usar `mcp__supabase__execute_sql` para simular/confirmar, após inserir manualmente via UI duas contrações com intervalo ≤3min e uma dilatação ≥5cm para uma pregnancy em Modo Parto:
```sql
select partograph_unlocked_at from pregnancies where id = '<pregnancyId testado>';
```
**EXPECT**: Não-nulo, com timestamp plausível

Depois, inserir uma nova contração com intervalo >3min para a mesma pregnancy e reconsultar:
```sql
select partograph_unlocked_at from pregnancies where id = '<pregnancyId testado>';
```
**EXPECT**: Valor inalterado (não regride, não é limpo)

### Level 6: MANUAL_VALIDATION

1. Ativar Modo Parto para uma gestante de teste (via fluxo da Phase 2).
2. Registrar uma contração.
3. Registrar uma dilatação de 3cm — não deve haver mudança em `partograph_unlocked_at` (dilatação abaixo do limiar).
4. Registrar uma segunda contração 2 minutos depois da primeira.
5. Registrar uma dilatação de 6cm.
6. Consultar `pregnancies.partograph_unlocked_at` — deve estar setado.
7. Registrar mais uma contração 10 minutos depois (fora do limiar de intervalo) — `partograph_unlocked_at` deve permanecer inalterado.

---

## Acceptance Criteria

- [ ] `maybeUnlockPartograph` calcula corretamente o intervalo entre as 2 contrações mais recentes e a dilatação mais recente
- [ ] Ao atingir o limiar (intervalo ≤3min E dilatação ≥5cm) pela primeira vez, `partograph_unlocked_at` é setado com `now()`
- [ ] Uma vez setado, `partograph_unlocked_at` nunca é sobrescrito, mesmo que indicadores subsequentes regridam
- [ ] A checagem roda tanto ao inserir uma contração quanto ao inserir uma dilatação — qualquer um dos dois pode ser o evento que cruza o limiar
- [ ] `fetchBirthModeTimelineData` retorna `partographUnlockedAt` corretamente
- [ ] Nenhuma falha no cálculo de gating quebra o fluxo principal de inserção do evento (erro é apenas logado, nunca propagado ao usuário)
- [ ] `pnpm check-types` passa sem erros

---

## Completion Checklist

- [ ] Task 1: Helper `maybeUnlockPartograph` criado
- [ ] Task 2: `add-birth-contraction-action` estendida
- [ ] Task 3: `add-birth-cervical-dilation-action` estendida
- [ ] Task 4: `fetchBirthModeTimelineData` estendida
- [ ] Level 1: `pnpm check-types` + Biome passam
- [ ] Level 4: Comportamento confirmado no banco via query manual
- [ ] Level 6: Fluxo testado manualmente end-to-end
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| Confundir "contração a cada 3 minutos" com a métrica existente `computeContractionsPer10Min` (contagem, não intervalo) | Medium | High (lógica clinicamente incorreta) | Plano documenta explicitamente a diferença e fornece o cálculo de intervalo direto a implementar, sem reutilizar a função existente |
| Race condition entre duas chamadas quase simultâneas de `maybeUnlockPartograph` (uma via contração, outra via dilatação, quase ao mesmo tempo) | Low | Low | O filtro `.is("partograph_unlocked_at", null)` no `.update()` garante que só uma das duas chamadas efetivamente altera a linha — a outra apenas não casa nenhuma linha, sem erro |
| Falha silenciosa se `maybeUnlockPartograph` lançar exceção não tratada | Low | Medium | Chamada envolvida em `.catch()` com `console.error` explícito, seguindo o padrão já usado para `scheduleBirthModeActivationNotifications` — erro é visível em log, não silenciosamente ignorado, mas também não quebra o insert principal |
| RLS bloquear o `.update()` de `pregnancies` feito com `ctx.supabase` (anon-key) dentro do helper | Low | Medium | Confirmado pelo codebase-analyst: a policy `"Team members can update pregnancies"` (`is_team_member(patient_id)`) já permite isso para qualquer membro de equipe autenticado — não é necessário `supabaseAdmin` |

---

## Notes

- Esta fase é puramente server-side; nenhuma tela ou componente é alterado. A Phase 4 consome `partographUnlockedAt` (via `fetchBirthModeTimelineData`) e a mudança realtime em `pregnancies` (via a subscription já existente com filtro `birth_mode_active=eq.true`, que já recebe qualquer UPDATE na linha, incluindo apenas `partograph_unlocked_at`).
- O `.is("partograph_unlocked_at", null)` no `.update()` é o mecanismo central do "high-water mark": não há necessidade de transação, lock, ou leitura prévia do valor atual — a própria cláusula `WHERE ... AND partograph_unlocked_at IS NULL` garante idempotência e ausência de regressão.
- Decisão deliberada de não reutilizar `computeContractionsPer10Min`: essa função responde "quantas contrações em uma janela de 10min terminando em cada ponto", enquanto o requisito da PRD ("contração a cada 3 minutos") é sobre o intervalo entre duas contrações consecutivas — são semânticas diferentes, e forçar a reutilização geraria uma aproximação incorreta.
- Fase 4 (gating na UI) depende desta fase estar completa antes de começar.
