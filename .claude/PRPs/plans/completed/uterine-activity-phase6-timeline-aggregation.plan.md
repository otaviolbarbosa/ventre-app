# Feature: Dinâmica Uterina — Fase 6: Agregação na Timeline

## Summary

Incluir registros de `birth_uterine_activity` na timeline unificada de eventos do parto — que hoje agrega 9 tabelas `birth_*` diferentes em `birth-mode-timeline-data.ts`. A investigação revelou que o escopo real é maior do que a descrição resumida do PRD ("query adicional em `birth-mode-timeline-data.ts`"): são **5 arquivos** que precisam mudar, porque o tipo `BirthEventType` é um union fechado consumido em múltiplos lugares (config de ícone/label, renderização textual, mapeamento de subscrição realtime).

## User Story

As a médica obstetra ou enfermeira obstétrica
I want to ver os registros de dinâmica uterina em lote na mesma timeline onde vejo todos os outros eventos do parto
So that eu tenha uma visão cronológica completa do acompanhamento, sem lacunas entre o fluxo antigo e o novo

## Problem Statement

`birth_uterine_activity` já é escrita (Fase 2) mas nunca é lida de volta para a timeline — registros feitos pelo novo modal (Fase 4) ficam invisíveis na tela de partograma, tanto na busca inicial quanto em tempo real.

## Solution Statement

Estender o union `BirthEventType` com um novo literal `"uterine_activity"` — decisão tecnicamente necessária e que **não contradiz** a decisão já registrada no PRD de "reaproveitar o botão/tipo `contraction` existente": aquela decisão é sobre a GRADE DE BOTÕES (`BIRTH_EVENT_TYPES`, array curado separado, Fase 5), não sobre o discriminador de tipo de evento da timeline. Adicionar o novo literal a `BIRTH_EVENT_CONFIG` (ícone/label usados APENAS na renderização da timeline, não na grade de botões) não cria nenhum botão novo. Com o tipo estendido, adicionar: a query + mapeamento em `birth-mode-timeline-data.ts` (mesmo padrão das outras 9 tabelas), o `case` de renderização textual em `birth-mode-timeline.tsx`, e a entrada de subscrição realtime em `use-birth-mode-timeline-realtime.ts`.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | MEDIUM                                                                |
| Systems Affected | `apps/web/src/lib`, `apps/web/src/components/shared`, `apps/web/src/hooks` |
| Dependencies     | Nenhuma nova                                                          |
| Estimated Tasks  | 4                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Timeline do parto: mostra 9 tipos de evento (contração individual,       ║
║  dilatação, FCF, etc.) — registros de birth_uterine_activity NUNCA        ║
║  aparecem, mesmo já persistidos no banco (Fase 2 já escreve lá).          ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Timeline do parto: registros de birth_uterine_activity aparecem          ║
║  cronologicamente junto aos demais, com texto descritivo próprio          ║
║  (ex: "Dinâmica uterina em lote: DU 3/10'/27\" DU 2/10'/41\"") e          ║
║  atualização em tempo real (INSERT via Supabase Realtime).                ║
║                                                                             ║
║  VALUE_ADD: visão cronológica completa, sem lacuna entre fluxo antigo e   ║
║             novo, independente de qual modal está ativo pela flag.        ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| Timeline do partograma | `birth_uterine_activity` invisível | Aparece com descrição própria | Nenhuma lacuna de visibilidade entre os dois formatos de registro |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/lib/birth-mode-timeline-data.ts` | full (259 linhas) | Padrão EXATO de query+mapeamento a replicar para a 10ª tabela — `Promise.all`, loop `for...of`, `events.push({...})`, sort final |
| P0 | `apps/web/src/lib/birth-mode-constants.ts` | `BirthEventType`, `BIRTH_EVENT_CONFIG`, `BIRTH_EVENT_TYPES` | Onde adicionar o novo literal — **confirmar que `BIRTH_EVENT_TYPES` NÃO recebe a nova entrada** (isso criaria um botão, fora de escopo) |
| P0 | `apps/web/src/components/shared/birth-mode-timeline.tsx` | `describeEvent()`, full switch | Onde adicionar o `case "uterine_activity"` — sem ele, o evento aparece em branco na UI (fallback silencioso `default: return ""`, não é erro de compilação) |
| P0 | `apps/web/src/hooks/use-birth-mode-timeline-realtime.ts` | full (123 linhas) | `TABLE_TO_EVENT_TYPE`, `TIME_COLUMN_BY_TABLE`, `PAYLOAD_KEYS_BY_TABLE` — 3 mapas a estender, loop de subscrição já é genérico sobre `Object.keys(TABLE_TO_EVENT_TYPE)` |
| P1 | `apps/web/src/actions/get-birth-mode-timeline-action.ts` | full (26 linhas) | Confirmar que este arquivo NÃO precisa mudar — é um passthrough puro |

**External Documentation:** Nenhuma — reuso de padrões 100% internos.

---

## Patterns to Mirror

**QUERY_AND_MAP (padrão das outras 9 tabelas, a replicar):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-timeline-data.ts (padrão de birth_contractions, adaptado)
// 1. Adicionar ao array do Promise.all:
supabase
  .from("birth_uterine_activity")
  .select("*, professional:users(name)")
  .eq("pregnancy_id", pregnancyId)
  .order("measured_at", { ascending: true }),

// 2. Destructure do resultado do Promise.all (adicionar { data: uterineActivityRecords } na posição correspondente)

// 3. Loop de mapeamento:
for (const row of uterineActivityRecords ?? []) {
  events.push({
    type: "uterine_activity",
    id: row.id,
    occurredAt: row.measured_at,
    professionalId: row.professional_id,
    professionalName: (row.professional as { name: string } | null)?.name ?? "Profissional",
    payload: {
      interval_minutes: row.interval_minutes,
      contraction_count: row.contraction_count,
      durations_seconds: row.durations_seconds,
      du_notations: row.du_notations,
    },
  });
}
```

**REALTIME_TABLE_MAPS (3 mapas a estender, um valor cada):**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-timeline-realtime.ts
const TABLE_TO_EVENT_TYPE: Record<string, BirthEventType> = {
  // ...existentes
  birth_uterine_activity: "uterine_activity",
};
const TIME_COLUMN_BY_TABLE: Record<string, string> = {
  // ...existentes
  birth_uterine_activity: "measured_at",
};
const PAYLOAD_KEYS_BY_TABLE: Record<string, string[]> = {
  // ...existentes
  birth_uterine_activity: ["interval_minutes", "contraction_count", "durations_seconds", "du_notations"],
};
```

**DESCRIBE_EVENT_CASE (padrão do switch em birth-mode-timeline.tsx):**
```typescript
// SOURCE: apps/web/src/components/shared/birth-mode-timeline.tsx (padrão do case "contraction", adaptado)
case "uterine_activity": {
  const { du_notations } = event.payload as { du_notations: string[] };
  return `Dinâmica uterina em lote: ${du_notations.join(" ")}`;
}
```

---

## Files to Change

| File                                                                    | Action | Justification                                                        |
| ---------------------------------------------------------------------------| ------ | ---------------------------------------------------------------------|
| `apps/web/src/lib/birth-mode-constants.ts`                              | UPDATE | Adicionar `"uterine_activity"` a `BirthEventType` + entrada em `BIRTH_EVENT_CONFIG` |
| `apps/web/src/lib/birth-mode-timeline-data.ts`                          | UPDATE | Query + mapeamento da 10ª tabela                                     |
| `apps/web/src/components/shared/birth-mode-timeline.tsx`                | UPDATE | `case "uterine_activity"` em `describeEvent()`                       |
| `apps/web/src/hooks/use-birth-mode-timeline-realtime.ts`                | UPDATE | 3 mapas estendidos com a nova tabela                                  |

---

## NOT Building (Scope Limits)

- **Novo botão na grade** — `BIRTH_EVENT_TYPES` (array curado que gera os botões) permanece inalterado; a extensão de `BirthEventType`/`BIRTH_EVENT_CONFIG` serve apenas ícone/label da timeline, não a grade.
- **`get-birth-mode-timeline-action.ts`** — confirmado como passthrough puro, nenhuma mudança necessária.
- **`contractions_per_10min`-like campo derivado** — `birth_contractions` deriva frequência via `computeContractionsPer10Min` (janela deslizante de 10min sobre o histórico); `birth_uterine_activity` já carrega sua própria granularidade (`interval_minutes`, `contraction_count`) diretamente nas colunas, sem necessidade de derivação equivalente.
- **Componente de gráfico matriz** — consumir esses dados visualmente é Fase 7, não esta fase.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Estender `BirthEventType` com `"uterine_activity"` | Sim, união com novo literal | Reaproveitar `"contraction"` como tipo também para linhas de `birth_uterine_activity`, diferenciando só pelo payload | A decisão já registrada no PRD sobre reaproveitar o tipo `contraction` é especificamente sobre o BOTÃO (Fase 5), não sobre o discriminador de evento da timeline — payloads das duas tabelas são estruturalmente diferentes (`duration_seconds: number` vs. `durations_seconds: number[]`), e reaproveitar o mesmo `type` forçaria toda renderização/subscrição a inspecionar chaves de payload para desambiguar, mais frágil que um discriminador explícito |
| Rótulo da entrada em `BIRTH_EVENT_CONFIG` | Label distinto do `"contraction"` existente (que já é "Dinâmica Uterina") — ex. "Dinâmica Uterina (lote)" | Mesmo label "Dinâmica Uterina" | Confirmado pela exploração: o label atual de `"contraction"` já é literalmente "Dinâmica Uterina" — usar o mesmo label para as duas entradas geraria confusão visual na timeline entre registros do fluxo antigo e do novo, mesmo sendo tecnicamente dois `type`s diferentes |
| Texto de `describeEvent` para o novo case | `"Dinâmica uterina em lote: {notações unidas por espaço}"` | Reformatar com mais detalhes (intervalo, contagem) | Mantém simplicidade consistente com os outros cases (uma linha, foco no dado clinicamente relevante — a notação já resume contagem+intervalo+duração média) |

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/lib/birth-mode-constants.ts`

- **ACTION**: Estender `BirthEventType` e `BIRTH_EVENT_CONFIG`
- **IMPLEMENT**:
  ```typescript
  export type BirthEventType =
    | "start_monitoring"
    | "contraction"
    | "uterine_activity"
    | "cervical_dilation"
    // ...demais inalterados

  export const BIRTH_EVENT_CONFIG: Record<BirthEventType, {...}> = {
    // ...existentes
    uterine_activity: { label: "Dinâmica Uterina (lote)", icon: Activity, colorClass: "text-pink-500" },
  };
  // BIRTH_EVENT_TYPES (array da grade de botões) NÃO recebe nova entrada.
  ```
- **MIRROR**: entrada `contraction` existente (mesmo ícone `Activity`, mesma `colorClass`, já que é conceitualmente a mesma categoria clínica)
- **GOTCHA**: `BIRTH_EVENT_CONFIG` é `Record<BirthEventType, ...>` total — o compilador vai FORÇAR a adição desta entrada assim que o union for estendido; se pular esta task, `tsc` falha imediatamente em `birth-mode-constants.ts` (erro útil, não silencioso)
- **VALIDATE**: `cd apps/web && pnpm exec tsc --noEmit` — espera-se falha temporária em OUTROS arquivos (timeline-data.ts, timeline.tsx, realtime hook) até completar as Tasks 2-4; isso é esperado neste ponto intermediário

### Task 2: UPDATE `apps/web/src/lib/birth-mode-timeline-data.ts`

- **ACTION**: Adicionar query + destructure + loop de mapeamento para `birth_uterine_activity`
- **IMPLEMENT**: Ver bloco QUERY_AND_MAP acima — inserir a query no array do `Promise.all` (posição livre, ordem não é semanticamente significativa), adicionar a variável destructurada correspondente, adicionar o loop `for (const row of uterineActivityRecords ?? [])` junto aos outros 9 loops (antes do `events.sort(...)` final)
- **MIRROR**: `apps/web/src/lib/birth-mode-timeline-data.ts` — loop de `birth_contractions` (linhas ~114-128) é o mais próximo estruturalmente (mesma tabela "irmã")
- **GOTCHA**: `select("*, professional:users(name)")` retorna TODAS as colunas — os campos usados no payload (`interval_minutes`, `contraction_count`, `durations_seconds`, `du_notations`) já estão cobertos por `*`, não precisa listar explicitamente
- **VALIDATE**: `cd apps/web && pnpm exec tsc --noEmit`

### Task 3: UPDATE `apps/web/src/components/shared/birth-mode-timeline.tsx`

- **ACTION**: Adicionar `case "uterine_activity"` em `describeEvent()`
- **IMPLEMENT**: Ver bloco DESCRIBE_EVENT_CASE acima — inserir junto aos demais `case`s do switch, antes do `default`
- **MIRROR**: `case "contraction"` (estrutura de destructure do payload + template string de retorno)
- **GOTCHA**: o `switch` tem `default: return ""` — esquecer este case NÃO quebra a build, apenas produz uma linha em branco na timeline para cada registro de dinâmica uterina em lote; validar visualmente que o texto aparece, não apenas confiar no type-check
- **VALIDATE**: `cd apps/web && pnpm exec tsc --noEmit`

### Task 4: UPDATE `apps/web/src/hooks/use-birth-mode-timeline-realtime.ts`

- **ACTION**: Adicionar uma entrada a cada um dos 3 mapas (`TABLE_TO_EVENT_TYPE`, `TIME_COLUMN_BY_TABLE`, `PAYLOAD_KEYS_BY_TABLE`)
- **IMPLEMENT**: Ver bloco REALTIME_TABLE_MAPS acima
- **MIRROR**: entradas de `birth_contractions` nos 3 mapas (mesma tabela "irmã")
- **GOTCHA**: o loop de subscrição (`for (const table of Object.keys(TABLE_TO_EVENT_TYPE))`) já é genérico — não precisa tocar nele, só os 3 mapas de dados
- **GOTCHA**: confirmar que a migração de Realtime publication da Fase 1 (`20260831000001_birth_uterine_activity_realtime_publication.sql`) já habilitou `birth_uterine_activity` na publicação `supabase_realtime` — sem isso, o `channel.on("postgres_changes", ...)` nunca dispara mesmo com o código correto (já confirmado como feito na Fase 1, apenas reconfirmar antes de testar)
- **VALIDATE**: `cd apps/web && pnpm exec tsc --noEmit`

---

## Testing Strategy

Nenhum teste automatizado — mesma lacuna de convenção das fases anteriores para código de UI/agregação (não pura lógica de negócio como a Fase 3).

### Edge Cases Checklist (validação manual)

- [ ] Registrar um evento via `AddBirthUterineActivityModal` (com a flag ativa, Fase 5) e confirmar que aparece na timeline imediatamente (via Realtime), sem precisar recarregar a página
- [ ] Recarregar a página com registros já existentes e confirmar que aparecem corretamente na busca inicial (`fetchBirthModeTimelineData`)
- [ ] Confirmar que o texto exibido mostra a(s) notação(ões) DU corretamente, incluindo o caso de múltiplas notações (intervalo 20/30 min)
- [ ] Confirmar que registros de `birth_contractions` (fluxo antigo) continuam aparecendo normalmente, sem regressão
- [ ] Confirmar visualmente que o label/ícone do novo tipo de evento é distinguível do label "Dinâmica Uterina" (contração individual) na timeline

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
cd apps/web && pnpm exec tsc --noEmit
pnpm exec biome check apps/web/src/lib/birth-mode-constants.ts apps/web/src/lib/birth-mode-timeline-data.ts apps/web/src/components/shared/birth-mode-timeline.tsx apps/web/src/hooks/use-birth-mode-timeline-realtime.ts
```

**EXPECT**: Exit 0 em ambos, SOMENTE após as 4 tasks completas (Task 1 sozinha quebra o build intencionalmente, ver GOTCHA da Task 1).

### Level 4: DATABASE_VALIDATION

Confirmar via Supabase MCP/dashboard que `birth_uterine_activity` está na publicação `supabase_realtime` (checar `20260831000001_birth_uterine_activity_realtime_publication.sql` já aplicada).

### Level 5: BROWSER_VALIDATION

Ver Edge Cases Checklist acima — requer a Fase 5 (flag toggle) já mesclada/ativa localmente para conseguir criar registros de teste via UI.

---

## Acceptance Criteria

- [ ] `birth_uterine_activity` aparece na timeline, busca inicial e tempo real
- [ ] Nenhum novo botão na grade de registro
- [ ] Texto da timeline distinguível do evento "contraction" existente
- [ ] `tsc --noEmit` e `biome check` passam sem erros após as 4 tasks
- [ ] Nenhuma regressão nos 9 tipos de evento existentes

---

## Completion Checklist

- [ ] Task 1-4 completas em ordem (Task 1 primeiro — as demais dependem do tipo estendido)
- [ ] Level 1 passa
- [ ] Level 4 confirma publicação Realtime
- [ ] Level 5 validado manualmente (requer Fase 5 ativa)
- [ ] Acceptance criteria atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | ---------------------------------------- |
| Esquecer o `case` em `describeEvent()` não quebra a build (fallback silencioso) | M | M | Validação manual explícita no checklist, não confiar apenas em `tsc` |
| Testar esta fase isoladamente requer a Fase 5 já ativa (para conseguir criar registros via UI) | H | L | Alternativa: inserir uma linha de teste diretamente via Supabase MCP/SQL para validar a leitura sem depender da Fase 5 |

---

## Notes

- Esta fase corrige uma descrição de escopo otimista do PRD original ("query adicional") — a investigação mostrou 4 arquivos além do óbvio, todos documentados aqui com justificativa técnica clara.
- Depois desta fase, atualizar a tabela de fases do PRD: Status da Fase 6 → `complete`, campo PRP Plan apontando para este arquivo.
