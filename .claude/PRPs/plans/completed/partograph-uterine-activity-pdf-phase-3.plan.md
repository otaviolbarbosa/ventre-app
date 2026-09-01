# Feature: Matriz de Contrações no PDF — Fase 3: Testes de Fidelidade e Não-Regressão

## Summary

Criar `apps/web/src/lib/partograph-overlay-svg.test.ts` (arquivo de teste novo — hoje não existe nenhum) cobrindo, via a função pública `buildPartographOverlaySvg`: (a) fidelidade do desenho `uterine_activity` comparado a `computeUterineActivityChartColumns` para o mesmo conjunto de eventos, (b) exclusão de contrações `<20s`, (c) a regra de precedência `uterine_activity` sobre `birth_contractions` (decidida na Fase 2), (d) truncamento seguro em >24 colunas sem erro de índice, e (e) regressão explícita do caminho `birth_contractions` (incluindo o bug conhecido de sobrescrita, documentado como inalterado, não corrigido).

## User Story

As a médica obstetra/enfermeira obstétrica que exporta o partograma em PDF
I want ter confiança automatizada de que a matriz de dinâmica uterina é fiel ao gráfico em tela e de que o caminho antigo de `birth_contractions` não regrediu
So that a feature aditiva das Fases 1-2 seja segura para produção sem depender só de inspeção visual manual

## Problem Statement

As Fases 1 e 2 implementaram a funcionalidade completa, mas sem nenhum teste automatizado — a única validação até agora foi `pnpm check-types`/lint e revisão manual de diff. Não há proteção contra regressão futura em `buildContractionsElements` nem confirmação formal de que o novo caminho `uterine_activity` produz exatamente a mesma classificação que o gráfico em tela.

## Solution Statement

Novo arquivo de teste `apps/web/src/lib/partograph-overlay-svg.test.ts` (padrão vitest, mesmo estilo de `birth-mode-uterine-activity-chart-utils.test.ts`), testando **através da função pública `buildPartographOverlaySvg`** (não exportando nenhuma função privada nova) — usando os helpers já exportados (`columnX`) e as constantes já exportadas (`CONTRACTIONS_BAND`) para computar as coordenadas SVG esperadas em vez de hardcodar números mágicos, evitando erros de aritmética manual e mantendo o teste resiliente a uma futura recalibração do template.

## Metadata

| Field            | Value                                                        |
| ---------------- | -------------------------------------------------------------- |
| Type             | NEW_CAPABILITY (fase 3 de 3 — cobertura de testes)               |
| Complexity       | MEDIUM                                                           |
| Systems Affected | `apps/web/src/lib/partograph-overlay-svg.ts` (só leitura/teste, nenhuma mudança de produção) |
| Dependencies     | Nenhuma nova — `vitest` já é a suite de testes do projeto (`apps/web/package.json:18`) |
| Estimated Tasks  | 1                                                                |

---

## UX Design

Não aplicável — esta fase não altera comportamento observável pelo usuário, apenas adiciona cobertura de testes para o comportamento já implementado nas Fases 1-2.

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/lib/partograph-overlay-svg.ts` | arquivo inteiro (562 linhas) | Estado atual completo — `buildContractionsElements`, `contractionCell`, `buildUterineActivityColumns`, `uterineActivityCell`, `buildUterineActivityElements`, `buildPartographOverlaySvg` (com a regra de precedência da Fase 2) |
| P0 | `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.test.ts` | arquivo inteiro | Padrão de teste (vitest, describe/it, fixtures inline) a mirrorar estruturalmente |
| P1 | `apps/web/src/lib/partograph-template-calibration.ts` | 19-30, 75-79 | `CONTRACTIONS_BAND` (`yTop: 457, yBottom: 511`), `HOUR_COLUMN_X` (24 posições) — usados para computar coordenadas esperadas nos testes |
| P1 | `apps/web/src/lib/birth-mode-chart-utils.ts` | 5-12 | `resolveChartT0` — confirma que basta 1 evento com `occurredAt` para `buildPartographOverlaySvg` não retornar SVG vazio |

**GOTCHA IMPORTANTE**: `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.test.ts` **já falha na branch atual antes desta fase** (5 de 6 testes) — o código-fonte usa `MIN_COLUMNS = 14`/`MAX_ROWS = 6` (`birth-mode-uterine-activity-chart-utils.ts:5-6`), mas os testes existentes esperam `10`/`6`. Isso é um bug pré-existente, **não introduzido por nenhuma fase desta PRD** (confirmado rodando `npx vitest run src/lib/birth-mode-uterine-activity-chart-utils.test.ts` antes de qualquer mudança desta fase) e **fora de escopo** para corrigir aqui — a PRD é estritamente sobre `partograph-overlay-svg.ts`. Os comandos de validação desta fase rodam **apenas o novo arquivo de teste**, não a suite inteira, para não reportar falso-negativo por causa desse problema não relacionado.

---

## Patterns to Mirror

**TEST_FILE_STRUCTURE** (mirror de `birth-mode-uterine-activity-chart-utils.test.ts`):
```typescript
import { describe, expect, it } from "vitest";
import { computeUterineActivityChartColumns } from "./birth-mode-uterine-activity-chart-utils";

describe("computeUterineActivityChartColumns", () => {
  it("descrição em português do comportamento testado", () => {
    // ...
  });
});
```

**EXPORTED_HELPERS_TO_REUSE** (evita hardcode de coordenadas — mirror do próprio código de produção):
```typescript
// SOURCE: apps/web/src/lib/partograph-overlay-svg.ts:76-82
export function nearestHourColumn(hoursSinceT0: number): number {
  return Math.max(0, Math.min(23, Math.round(hoursSinceT0)));
}
export function columnX(band: ColumnBand, hoursSinceT0: number): number {
  return band.columnX[nearestHourColumn(hoursSinceT0)] ?? band.columnX[0] ?? 0;
}
```
**GOTCHA**: Para um índice inteiro `i` em `[0, 23]`, `nearestHourColumn(i) === i` (arredondar um inteiro já dentro do range é um no-op) — logo `columnX(CONTRACTIONS_BAND, i)` produz exatamente o mesmo x que `columnXByIndex(CONTRACTIONS_BAND, i)` (função privada usada internamente por `buildContractionsElements`/`buildUterineActivityElements`), sem precisar exportar `columnXByIndex` só para o teste.

**PAYLOAD_SHAPES_TO_MIRROR** (contratos exatos usados pela Fase 1/2, para construir fixtures válidas):
```typescript
// contraction — SOURCE: partograph-overlay-svg.ts:250-253
{ contractions_per_10min: number | null; duration_seconds: number }

// uterine_activity — SOURCE: partograph-overlay-svg.ts:284-287
{ interval_minutes: 10 | 20 | 30; durations_seconds: number[] }
```

---

## Files to Change

| File | Action | Justification |
| ---- | ------ | -------------- |
| `apps/web/src/lib/partograph-overlay-svg.test.ts` | CREATE | Único arquivo desta fase — nenhuma mudança em código de produção |

---

## NOT Building (Scope Limits)

- Nenhuma correção do bug de sobrescrita `byColumn.set()` em `buildContractionsElements` — o teste de regressão desta fase **documenta o comportamento atual como está** (inclusive o bug), não corrige nada.
- Nenhuma correção do bug pré-existente em `birth-mode-uterine-activity-chart-utils.test.ts` (`MIN_COLUMNS`/`MAX_ROWS` desalinhados) — fora de escopo desta PRD; reportar ao usuário como achado, não corrigir silenciosamente.
- Nenhuma exportação de função privada de `partograph-overlay-svg.ts` (`buildContractionsElements`, `buildUterineActivityColumns`, `uterineActivityCell`, `buildUterineActivityElements`) — todos os testes passam exclusivamente pela função pública `buildPartographOverlaySvg`, preservando a convenção de encapsulamento estabelecida nas Fases 1-2.
- Nenhum teste de snapshot de PDF real (`sharp`/pipeline de renderização) — fora do escopo de teste unitário; validação visual manual do PDF real já foi sugerida como next step da Fase 2.

---

## Step-by-Step Tasks

### Task 1: CREATE `apps/web/src/lib/partograph-overlay-svg.test.ts`

- **ACTION**: Criar arquivo de teste novo, testando `buildPartographOverlaySvg` para os cinco cenários da PRD (Success Metrics + Testing Strategy da Fase 3).
- **IMPLEMENT**:
  ```typescript
  import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
  import {
    computeUterineActivityChartColumns,
    type UterineActivityChartRow,
  } from "@/lib/birth-mode-uterine-activity-chart-utils";
  import { CONTRACTIONS_BAND } from "@/lib/partograph-template-calibration";
  import { describe, expect, it } from "vitest";
  import { buildPartographOverlaySvg, columnX } from "./partograph-overlay-svg";

  const ROW_HEIGHT = (CONTRACTIONS_BAND.yBottom - CONTRACTIONS_BAND.yTop) / 5;
  const CELL_WIDTH = 14;

  let eventCounter = 0;
  function makeEvent(
    type: BirthModeTimelineEvent["type"],
    occurredAt: string,
    payload: Record<string, unknown>,
  ): BirthModeTimelineEvent {
    eventCounter += 1;
    return {
      type,
      id: `event-${eventCounter}`,
      occurredAt,
      professionalId: null,
      professionalName: "Profissional",
      payload,
    };
  }

  function uterineActivityEvent(
    occurredAt: string,
    intervalMinutes: 10 | 20 | 30,
    durationsSeconds: number[],
  ) {
    return makeEvent("uterine_activity", occurredAt, {
      interval_minutes: intervalMinutes,
      durations_seconds: durationsSeconds,
    });
  }

  function contractionEvent(
    occurredAt: string,
    contractionsPer10Min: number | null,
    durationSeconds: number,
  ) {
    return makeEvent("contraction", occurredAt, {
      contractions_per_10min: contractionsPer10Min,
      duration_seconds: durationSeconds,
    });
  }

  function cellX(columnIndex: number): number {
    return columnX(CONTRACTIONS_BAND, columnIndex) - CELL_WIDTH / 2;
  }

  function fullRect(columnIndex: number, rowIndexFromTop: number): string {
    const x = cellX(columnIndex);
    const y = CONTRACTIONS_BAND.yTop + rowIndexFromTop * ROW_HEIGHT;
    return `<rect x="${x}" y="${y}" width="${CELL_WIDTH}" height="${ROW_HEIGHT}" fill="#111827" />`;
  }

  function halfFillRect(columnIndex: number, rowIndexFromTop: number): string {
    const x = cellX(columnIndex);
    const cellYTop = CONTRACTIONS_BAND.yTop + rowIndexFromTop * ROW_HEIGHT;
    const halfY = cellYTop + ROW_HEIGHT / 2;
    return `<rect x="${x}" y="${halfY}" width="${CELL_WIDTH}" height="${ROW_HEIGHT / 2}" fill="#111827" />`;
  }

  function triangleCell(columnIndex: number, rowIndexFromTop: number): string {
    const x = cellX(columnIndex);
    const cellYTop = CONTRACTIONS_BAND.yTop + rowIndexFromTop * ROW_HEIGHT;
    const points = `${x + CELL_WIDTH},${cellYTop} ${x + CELL_WIDTH},${cellYTop + ROW_HEIGHT} ${x},${cellYTop + ROW_HEIGHT}`;
    return `<polygon points="${points}" fill="#111827" />`;
  }

  describe("buildPartographOverlaySvg — uterine_activity band (Phase 1+2)", () => {
    it("draws ⬛/◢ cells matching computeUterineActivityChartColumns for the same events", () => {
      const rows: UterineActivityChartRow[] = [
        { interval_minutes: 10, durations_seconds: [45, 25, 15] },
      ];
      const expectedColumns = computeUterineActivityChartColumns(rows);
      expect(expectedColumns[0]?.cells).toEqual([{ symbol: "⬛" }, { symbol: "◢" }]);

      const svg = buildPartographOverlaySvg([
        uterineActivityEvent("2026-01-01T00:00:00Z", 10, [45, 25, 15]),
      ]);

      // cells[0] (⬛, bottom-most) → row index from top = 4 (last of 5 physical rows)
      expect(svg).toContain(fullRect(0, 4));
      // cells[1] (◢, next up) → row index from top = 3
      expect(svg).toContain(triangleCell(0, 3));
    });

    it("excludes contractions <20s from the drawn matrix", () => {
      const svg = buildPartographOverlaySvg([
        uterineActivityEvent("2026-01-01T00:00:00Z", 10, [10, 15]),
      ]);

      expect(svg).not.toContain(fullRect(0, 4));
      expect(svg).not.toContain(triangleCell(0, 4));
    });

    it("takes precedence over birth_contractions when a birth has both event types", () => {
      const svg = buildPartographOverlaySvg([
        contractionEvent("2026-01-01T00:00:00Z", 3, 45),
        uterineActivityEvent("2026-01-01T00:10:00Z", 10, [45]),
      ]);

      // contractionCell's outline never appears when uterine_activity wins the band
      expect(svg).not.toContain('fill="none" stroke="#111827"');
      // uterine_activity's single ⬛ cell (bottom row of its column) is drawn instead
      expect(svg).toContain(fullRect(0, 4));
    });

    it("truncates to the template's 24 physical columns without an out-of-bounds error", () => {
      const events = Array.from({ length: 30 }, (_, i) =>
        uterineActivityEvent(`2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`, 10, [45]),
      );

      expect(() => buildPartographOverlaySvg(events)).not.toThrow();

      const svg = buildPartographOverlaySvg(events);
      const cellCount = (svg.match(/fill="#111827"/g) ?? []).length;
      expect(cellCount).toBe(24);
    });
  });

  describe("buildPartographOverlaySvg — birth_contractions regression (unchanged path)", () => {
    it("draws the existing frequency/duration grid exactly as before, when there is no uterine_activity data", () => {
      const svg = buildPartographOverlaySvg([contractionEvent("2026-01-01T00:00:00Z", 3, 45)]);

      // frequency 3 → rowIndexFromTop = 5 - 3 = 2; duration 45 (>40) → filled rect
      expect(svg).toContain(fullRect(0, 2));
    });

    it("keeps the known byColumn.set() overwrite behavior unchanged (documented, not fixed — out of PRD scope)", () => {
      const svg = buildPartographOverlaySvg([
        contractionEvent("2026-01-01T00:00:00Z", 2, 45), // same hour column — overwritten
        contractionEvent("2026-01-01T00:10:00Z", 4, 25), // wins (latest reading in that column)
      ]);

      // freq 2 / duration 45 (rowIndexFromTop = 5-2=3, full fill) is lost
      expect(svg).not.toContain(fullRect(0, 3));
      // freq 4 / duration 25 (rowIndexFromTop = 5-4=1, half fill) is what's drawn
      expect(svg).toContain(halfFillRect(0, 1));
    });
  });
  ```
- **MIRROR**: `birth-mode-uterine-activity-chart-utils.test.ts` (import style `describe/expect/it` from `vitest`, `it("descrição em português", ...)`).
- **IMPORTS**: `BirthModeTimelineEvent` (type), `computeUterineActivityChartColumns`/`UterineActivityChartRow` (para o teste de fidelidade), `CONTRACTIONS_BAND` (constante de calibração), `columnX`/`buildPartographOverlaySvg` (as duas únicas exportações de `partograph-overlay-svg.ts` necessárias).
- **GOTCHA**: Todas as datas de fixture usam dias distintos do mês (`2026-01-01` a `2026-01-30`) em vez de horas (`T00`-`T29`), porque hora ISO só vai até 23 — usar `T29:00:00Z` geraria uma data inválida silenciosamente reinterpretada pelo `Date` parser.
- **GOTCHA 2**: Os helpers (`fullRect`/`halfFillRect`/`triangleCell`) **computam** as coordenadas esperadas a partir das mesmas constantes/fórmulas do código de produção (`CONTRACTIONS_BAND`, `ROW_HEIGHT`), em vez de hardcodar números — isso evita erro de aritmética manual no teste e mantém os testes corretos mesmo que o template seja recalibrado no futuro (mudando `CONTRACTIONS_BAND.yTop/yBottom` ou `HOUR_COLUMN_X`).
- **VALIDATE**: `cd apps/web && npx vitest run src/lib/partograph-overlay-svg.test.ts`

---

## Testing Strategy

Esta fase inteira **é** a estratégia de testes (não há tarefa de implementação de produção). Cobertura mapeada às Success Metrics da PRD:

| Success Metric da PRD | Teste correspondente |
|---|---|
| Novos dados visíveis no PDF (100% das contrações ≥20s aparecem) | "draws ⬛/◢ cells matching computeUterineActivityChartColumns..." + "excludes contractions <20s..." |
| Zero regressão no caminho `birth_contractions` | Ambos os testes do describe de regressão |
| Consistência visual tela vs. PDF | "draws ⬛/◢ cells matching computeUterineActivityChartColumns..." (compara diretamente com a função usada pela tela) |
| (Risco da Fase 2) Overflow >24 colunas | "truncates to the template's 24 physical columns..." |
| (Decisão da Fase 2) Precedência `uterine_activity` | "takes precedence over birth_contractions..." |

### Edge Cases Checklist

- [x] Múltiplos registros `uterine_activity` decompostos sem perda de dados entre colunas — coberto indiretamente pelo teste de fidelidade (usa `computeUterineActivityChartColumns` como oráculo)
- [x] >24 blocos sequenciais não quebra o desenho (truncamento seguro)
- [x] Contrações `<20s` corretamente omitidas
- [x] Regressão de `buildContractionsElements` para eventos `contraction` (idêntica, incluindo o bug de overwrite conhecido)
- [x] Regra de precedência (parto com ambos os tipos de evento → só `uterine_activity` desenhado)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo.

```bash
npx biome lint --write --unsafe apps/web/src/lib/partograph-overlay-svg.test.ts
```
**EXPECT**: Exit 0, sem warnings.

### Level 2: UNIT_TESTS

```bash
cd apps/web && npx vitest run src/lib/partograph-overlay-svg.test.ts
```
**EXPECT**: Todos os 6 testes passam (0 falhas).

**NÃO rodar** `pnpm test`/`vitest run` sem escopo (suite inteira) como critério de sucesso desta fase — `birth-mode-uterine-activity-chart-utils.test.ts` já falha na branch atual por um bug pré-existente e não relacionado (ver GOTCHA em Mandatory Reading). Rodar a suite inteira é aceitável para *observar* o estado geral, mas o critério de conclusão desta fase é o arquivo novo passar, não a suite inteira ficar verde.

---

## Acceptance Criteria

- [ ] `apps/web/src/lib/partograph-overlay-svg.test.ts` existe com 6 testes, todos passando.
- [ ] Nenhuma função privada de `partograph-overlay-svg.ts` foi exportada só para viabilizar o teste — tudo passa por `buildPartographOverlaySvg`.
- [ ] Nenhuma mudança em código de produção nesta fase (só o arquivo de teste é criado).
- [ ] `pnpm check-types` passa.
- [ ] O bug pré-existente em `birth-mode-uterine-activity-chart-utils.test.ts` é reportado ao usuário (não corrigido silenciosamente).

---

## Completion Checklist

- [ ] Task 1 (arquivo de teste) implementada e validada
- [ ] Level 1: type-check + lint passam
- [ ] Level 2: os 6 testes novos passam
- [ ] Achado do bug pré-existente comunicado ao usuário no relatório de implementação

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Confundir o bug pré-existente de `birth-mode-uterine-activity-chart-utils.test.ts` com uma regressão introduzida por esta fase | M | LOW | Confirmado via `npx vitest run` ANTES de qualquer mudança desta fase (ver GOTCHA) — documentado explicitamente para não ser mal-atribuído |
| Teste de contagem de `fill="#111827"` (`cellCount === 24`) ser frágil se outra banda futura vier a usar a mesma cor | L | LOW | Aceitável para esta fase — a fixture do teste usa exclusivamente eventos `uterine_activity`, então nenhuma outra banda contribui `fill="#111827"` hoje; se isso mudar no futuro, o teste falhará de forma óbvia e será corrigido no momento |
| Arredondamento de ponto flutuante (`ROW_HEIGHT = 10.8`) causar mismatch de string entre produção e teste | L | M | Ambos usam a mesma expressão JS (`CONTRACTIONS_BAND.yTop + rowIndexFromTop * ROW_HEIGHT`) na mesma engine — resultado determinístico e idêntico bit-a-bit, sem hardcode de valores calculados |

---

## Notes

- Esta é a última fase da PRD `partograph-uterine-activity-pdf`. Depois desta fase, a feature está funcionalmente completa E coberta por testes automatizados.
- O achado do teste pré-existente quebrado (`birth-mode-uterine-activity-chart-utils.test.ts`) deve ser reportado ao usuário no relatório de implementação desta fase como um item separado, fora do escopo desta PRD, para decisão futura (corrigir os testes para `MIN_COLUMNS=14`/`MAX_ROWS=6`, ou reverter a constante para `10`/manter `6` — não é óbvio qual lado está "errado" sem contexto adicional do time).

---

*Generated: 2026-09-01*
*Source PRD: `.claude/PRPs/prds/partograph-uterine-activity-pdf.prd.md` — Phase 3*
