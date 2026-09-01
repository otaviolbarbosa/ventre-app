# Feature: Matriz de Contrações no PDF — Fase 1: Decomposição/Classificação de `uterine_activity`

## Summary

Adicionar uma nova função privada em `apps/web/src/lib/partograph-overlay-svg.ts` que filtra eventos `BirthModeTimelineEvent` do tipo `"uterine_activity"`, extrai o payload `{ interval_minutes, durations_seconds }` e reaproveita `computeUterineActivityChartColumns` (já testada, usada pelo gráfico em tela) para produzir a mesma estrutura de colunas/células classificadas (◢/⬛) que o PDF vai desenhar na Fase 2. Esta fase é puramente de dados — nenhum SVG é desenhado e `buildContractionsElements` não é tocada.

## User Story

As a médica obstetra/enfermeira obstétrica que exporta o partograma em PDF
I want que os registros de dinâmica uterina (`birth_uterine_activity`) sejam decompostos e classificados com a mesma lógica já usada no gráfico em tela
So that a Fase 2 possa desenhá-los no PDF com fidelidade simbólica idêntica à tela, sem duplicar/divergir a lógica de classificação

## Problem Statement

`partograph-overlay-svg.ts` só entende `event.type === "contraction"` na faixa de contrações. Eventos `uterine_activity` não têm nenhum caminho de leitura/decomposição no módulo de overlay do PDF.

## Solution Statement

Nova função privada `buildUterineActivityColumns(events)` em `partograph-overlay-svg.ts`, que filtra/ordena eventos `uterine_activity`, mapeia o payload para `UterineActivityChartRow[]` (mesmo shape usado por `BirthModeUterineActivityChart`) e delega toda a lógica de decomposição/classificação a `computeUterineActivityChartColumns` (importada de `birth-mode-uterine-activity-chart-utils.ts`). Retorna `UterineActivityChartColumn[]`, pronta para a Fase 2 desenhar.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | NEW_CAPABILITY (fase 1 de 3 de uma feature aditiva) |
| Complexity       | LOW                                                 |
| Systems Affected | `apps/web/src/lib/partograph-overlay-svg.ts`        |
| Dependencies     | Nenhuma nova — reaproveita `computeUterineActivityChartColumns`/`UterineActivityChartRow`/`UterineActivityChartColumn` já existentes e testadas |
| Estimated Tasks  | 2                                                   |

---

## UX Design

Esta fase não tem UI/PDF visível — é puramente uma função de dados intermediária. Nenhuma diferença perceptível ao usuário final até a Fase 2 (desenho) ser implementada. Nenhum diagrama Before/After aplicável.

---

## Mandatory Reading

**CRITICAL: Ler antes de implementar:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/lib/partograph-overlay-svg.ts` | 209-265 | `buildContractionsElements` — padrão de filtro/sort/mapeamento de `BirthModeTimelineEvent[]` a NÃO tocar, mas a mirrorar estruturalmente |
| P0 | `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.ts` | 1-58 (arquivo inteiro) | `computeUterineActivityChartColumns`, tipos `UterineActivityChartRow`/`UterineActivityChartColumn`/`UterineActivityChartCell` — a função a reutilizar, sem reimplementar |
| P1 | `apps/web/src/components/shared/birth-mode-uterine-activity-chart.tsx` | 1-40 (arquivo inteiro) | Padrão exato de filtro `event.type === "uterine_activity"` → map para `{ interval_minutes, durations_seconds }` → `computeUterineActivityChartColumns(rows)`, incluindo o guard de lista vazia |
| P1 | `apps/web/src/actions/get-birth-mode-timeline-action.ts` | 12-19 | Tipo `BirthModeTimelineEvent` (`payload: Record<string, unknown>`) — contrato de entrada |
| P2 | `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.test.ts` | arquivo inteiro | Padrão de teste (vitest, describe/it, fixtures inline) — referência para a Fase 3, não implementar testes nesta fase |

---

## Patterns to Mirror

**FILTER_SORT_PATTERN** (mirror estrutural de `buildContractionsElements`, sem tocar nela):
```typescript
// SOURCE: apps/web/src/lib/partograph-overlay-svg.ts:228-234
const contractionEvents = events
  .filter((event) => event.type === "contraction")
  .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

if (contractionEvents.length === 0) return "";
```

**PAYLOAD_EXTRACTION_PATTERN** (mirror exato de `birth-mode-uterine-activity-chart.tsx:12-19` — usar este, não o de `buildContractionsElements`, pois o payload de `uterine_activity` é diferente):
```typescript
// SOURCE: apps/web/src/components/shared/birth-mode-uterine-activity-chart.tsx:12-19
const rows: UterineActivityChartRow[] = events
  .filter((event) => event.type === "uterine_activity")
  .map((event) => {
    const { interval_minutes, durations_seconds } = event.payload as {
      interval_minutes: 10 | 20 | 30;
      durations_seconds: number[];
    };
    return { interval_minutes, durations_seconds };
  });
```

**REUSE_NOT_REIMPLEMENT** (a função pura a chamar, já testada em `birth-mode-uterine-activity-chart-utils.test.ts`):
```typescript
// SOURCE: apps/web/src/lib/birth-mode-uterine-activity-chart-utils.ts:29-40
export function computeUterineActivityChartColumns(
  rows: UterineActivityChartRow[],
): UterineActivityChartColumn[] {
  const columns: UterineActivityChartColumn[] = [];
  for (const row of rows) {
    const blockCount = row.interval_minutes / 10;
    const blocks = splitIntoBlocks(row.durations_seconds, blockCount);
    for (const block of blocks) {
      columns.push(blockToColumn(block));
    }
  }
  while (columns.length < MIN_COLUMNS) {
    columns.push({ cells: [] });
  }
  return columns;
}
```
**GOTCHA**: `computeUterineActivityChartColumns` sempre completa até `MIN_COLUMNS = 14` colunas (constante interna, não exportada), preenchendo com `{ cells: [] }` quando necessário — isso é intencional para o gráfico em tela (grid mínima visual) e é inofensivo para o PDF (colunas vazias não desenham nada na Fase 2), mas **não** deve ser confundido com o limite físico de 24 colunas de `HOUR_COLUMN_X`, que é responsabilidade da Fase 2 (truncamento), não desta fase.

**GOTCHA 2**: `MAX_ROWS` dentro de `birth-mode-uterine-activity-chart-utils.ts` é `6` (não 5) — é o limite do componente em tela. A PRD exige limite de **5 linhas no PDF** (limite físico do template impresso), mas esse recorte é responsabilidade da Fase 2 (ao desenhar `column.cells`, iterar apenas os 5 primeiros), não desta função de decomposição — `buildUterineActivityColumns` deve retornar os `UterineActivityChartColumn[]` exatamente como `computeUterineActivityChartColumns` os produz (até 6 células por coluna), sem truncar aqui.

**PRIVATE_FUNCTION_CONVENTION** (nenhuma função de banda é exportada neste arquivo — mirror):
```typescript
// SOURCE: apps/web/src/lib/partograph-overlay-svg.ts:228 (assinatura sem `export`)
function buildContractionsElements(events: BirthModeTimelineEvent[]): string { ... }
```

---

## Files to Change

| File                                                  | Action | Justification                                                         |
| ------------------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| `apps/web/src/lib/partograph-overlay-svg.ts`           | UPDATE | Adicionar import de `computeUterineActivityChartColumns`/tipos e a nova função `buildUterineActivityColumns`, logo após `buildContractionsElements` (linha 265). `buildContractionsElements` e todo o resto do arquivo permanecem byte-a-byte inalterados. |

---

## NOT Building (Scope Limits)

- Nenhum desenho SVG (`<polygon>`/`<rect>` para ◢/⬛) — isso é a Fase 2.
- Nenhuma chamada a `buildUterineActivityColumns` a partir de `buildPartographOverlaySvg` — a função fica pronta mas não conectada; conectá-la é a Fase 2 (concatenar à saída existente).
- Nenhuma alteração em `buildContractionsElements`, `CONTRACTIONS_BAND`, `HOUR_COLUMN_X` ou qualquer outra banda existente.
- Nenhum teste automatizado novo — cobertura formal (incl. teste comparando com `computeUterineActivityChartColumns`, teste de regressão de `buildContractionsElements`) é escopo da Fase 3.
- Nenhuma resolução da Open Question sobre colisão visual entre `contraction` e `uterine_activity` no mesmo parto — é uma decisão de posicionamento/desenho, relevante apenas quando a Fase 2 conectar a função ao SVG. Fica registrada como risco a resolver antes da Fase 2 (ver Risks).

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/lib/partograph-overlay-svg.ts` — adicionar import

- **ACTION**: Adicionar import de `computeUterineActivityChartColumns` e dos tipos `UterineActivityChartColumn`/`UterineActivityChartRow` de `@/lib/birth-mode-uterine-activity-chart-utils`, junto aos imports existentes no topo do arquivo (após o bloco de import de `@/lib/partograph-template-calibration`, linha 27).
- **IMPLEMENT**:
  ```typescript
  import {
    computeUterineActivityChartColumns,
    type UterineActivityChartColumn,
    type UterineActivityChartRow,
  } from "@/lib/birth-mode-uterine-activity-chart-utils";
  ```
- **MIRROR**: Estilo de import existente no topo do arquivo (`partograph-overlay-svg.ts:1-27`) — `import type` para tipos, import nomeado para valores, agrupado por módulo de origem.
- **GOTCHA**: Usar `import type` para `UterineActivityChartColumn`/`UterineActivityChartRow` (só usados como tipo) e import de valor normal para `computeUterineActivityChartColumns` — Biome (`useImportType`) reclama se misturar errado.
- **VALIDATE**: `pnpm check-types` (deve compilar sem erros — os tipos/função já existem e são exportados em `birth-mode-uterine-activity-chart-utils.ts`)

### Task 2: UPDATE `apps/web/src/lib/partograph-overlay-svg.ts` — nova função `buildUterineActivityColumns`

- **ACTION**: Adicionar função privada nova, imediatamente após o fim de `buildContractionsElements` (após a linha 265 no arquivo atual), sem editar nenhuma linha existente de `buildContractionsElements`.
- **IMPLEMENT**:
  ```typescript
  function buildUterineActivityColumns(
    events: BirthModeTimelineEvent[],
  ): UterineActivityChartColumn[] {
    const uterineActivityEvents = events
      .filter((event) => event.type === "uterine_activity")
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    if (uterineActivityEvents.length === 0) return [];

    const rows: UterineActivityChartRow[] = uterineActivityEvents.map((event) => {
      const { interval_minutes, durations_seconds } = event.payload as {
        interval_minutes: 10 | 20 | 30;
        durations_seconds: number[];
      };
      return { interval_minutes, durations_seconds };
    });

    return computeUterineActivityChartColumns(rows);
  }
  ```
- **MIRROR**: Estrutura de filtro/sort de `buildContractionsElements` (`partograph-overlay-svg.ts:228-234`) para o guard de ordenação cronológica e lista vazia; extração de payload mirrorando exatamente `birth-mode-uterine-activity-chart.tsx:12-19` (mesmo cast, mesmos nomes de campo).
- **IMPORTS**: Usa os imports adicionados na Task 1; `BirthModeTimelineEvent` já está importado no topo do arquivo (linha 1).
- **GOTCHA**: Ordenar por `occurredAt` (não por `measured_at`/`created_at` diretamente) — `occurredAt` já é o campo mapeado de `measured_at` pela camada de query (`birth-mode-timeline-data.ts:140`), mesma fonte cronológica usada por `buildContractionsElements` para eventos `contraction`. Isso satisfaz a decisão da PRD de "ordem cronológica de registro" para a Fase 2 (colunas sequenciais por bloco de registro).
- **GOTCHA 2**: Não truncar/filtrar `< 20s` aqui — `computeUterineActivityChartColumns`/`classifyDuration` já fazem isso internamente (retorna `null` para durações `< 20s`, filtrado em `blockToColumn`). Reimplementar esse filtro aqui duplicaria lógica já testada.
- **VALIDATE**: `pnpm check-types` (função não é chamada em nenhum lugar ainda — é esperado que o linter não acuse "unused" porque TypeScript não falha por função não usada por padrão; se o Biome acusar `noUnusedVariables` em modo estrito para funções module-level, isso é aceitável nesta fase pois a função é conectada na Fase 2. Se o CI falhar por isso, adicionar um comentário `// biome-ignore lint/correctness/noUnusedVariables: conectada na Fase 2 (buildPartographOverlaySvg)` com justificativa — mas primeiro confirmar se o linter de fato acusa antes de adicionar a supressão)

---

## Testing Strategy

Nenhum teste automatizado nesta fase — a Fase 3 da PRD cobre explicitamente:
- Teste comparando `buildUterineActivityColumns`/a função de desenho da Fase 2 com `computeUterineActivityChartColumns` para o mesmo conjunto de eventos (Success Metric 1 da PRD).
- Teste de regressão garantindo que `buildContractionsElements` não mudou (Success Metric 2 da PRD).

### Edge Cases Checklist (validar manualmente ou via type-check nesta fase; testes formais na Fase 3)

- [ ] `events` sem nenhum evento `uterine_activity` → função retorna `[]` (guard early-return)
- [ ] `events` com eventos `uterine_activity` E `contraction` misturados → filtro pega apenas os `uterine_activity`, sem interferir no processamento de `contraction` por `buildContractionsElements` (funções são independentes, operam sobre o mesmo array de entrada sem mutação)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo.

```bash
npx biome lint --write --unsafe apps/web/src/lib/partograph-overlay-svg.ts
```
**EXPECT**: Exit 0, sem warnings de import/formatação.

### Level 2: MANUAL_VALIDATION

- Confirmar via leitura do diff que `buildContractionsElements` (linhas 209-265 antes da mudança) permanece **byte-a-byte idêntica** após a edição — nenhuma linha dentro dela foi tocada.
- Confirmar que `buildUterineActivityColumns` não é chamada em nenhum lugar ainda (a conexão com `buildPartographOverlaySvg` é escopo da Fase 2).

---

## Acceptance Criteria

- [ ] `buildUterineActivityColumns(events)` existe em `partograph-overlay-svg.ts`, não exportada, seguindo a convenção de funções privadas do arquivo.
- [ ] Para o mesmo conjunto de eventos `uterine_activity`, `buildUterineActivityColumns` produz exatamente o mesmo `UterineActivityChartColumn[]` que `computeUterineActivityChartColumns` produziria a partir do mesmo mapeamento usado por `BirthModeUterineActivityChart` (mesma lógica, zero duplicação/reimplementação).
- [ ] `buildContractionsElements` inalterada — diff vazio nessa função.
- [ ] `pnpm check-types` passa sem erros.
- [ ] Nenhuma nova dependência externa introduzida.

---

## Completion Checklist

- [ ] Task 1 (import) implementada e validada
- [ ] Task 2 (função) implementada e validada
- [ ] Level 1: `pnpm check-types` + `biome lint` passam
- [ ] Level 2: revisão manual confirma zero alteração em `buildContractionsElements`
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Biome `noUnusedVariables` acusar a função nova como não utilizada (já que não é conectada nesta fase) | M | LOW | Se ocorrer, confirmar antes de suprimir — pode ser aceitável deixar o warning documentado até a Fase 2 conectar a função, ou adicionar supressão pontual com justificativa (ver Task 2 GOTCHA 2) |
| Colisão visual entre `contraction` e `uterine_activity` na mesma faixa física do template, caso um parto tenha os dois tipos de evento (Open Question da PRD, confirmada como possível pela análise de código — a flag `show_uterine_activity` não é exclusiva e não há guard de servidor) | M | M | Não é um risco desta fase (função pura de dados, sem desenho). **Bloqueia o início da Fase 2** até uma regra explícita de precedência/sobreposição ser decidida — registrar como pré-requisito do próximo `/prp-plan` para a Fase 2 |
| Confundir o limite `MAX_ROWS = 6` (tela) com o limite de 5 linhas exigido no PDF | L | M | Documentado explicitamente nos GOTCHAs desta fase; recorte de linhas é responsabilidade explícita da Fase 2, não desta função |

---

## Notes

- Esta fase é intencionalmente mínima (2 tasks) porque a PRD já quebrou o trabalho em fases muito finas dentro de um único arquivo pequeno. A função fica "órfã" (não chamada) até a Fase 2 — isso é esperado e documentado.
- A Fase 2 precisará, antes de implementar, de uma decisão explícita sobre a Open Question de colisão `contraction`/`uterine_activity` na mesma faixa (ver Risks) — recomenda-se levantar essa decisão com o usuário no início do `/prp-plan` da Fase 2, não assumir uma regra implicitamente.
- `computeUterineActivityChartColumns` já lida com padding até `MIN_COLUMNS = 14` e classificação/exclusão de durações `< 20s` — nenhuma lógica de negócio nova foi criada nesta fase, apenas adaptação do formato de entrada (`BirthModeTimelineEvent[]` → `UterineActivityChartRow[]`).

---

*Generated: 2026-08-31*
*Source PRD: `.claude/PRPs/prds/partograph-uterine-activity-pdf.prd.md` — Phase 1*
