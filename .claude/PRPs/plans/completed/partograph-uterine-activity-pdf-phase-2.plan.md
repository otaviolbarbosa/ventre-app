# Feature: Matriz de Contrações no PDF — Fase 2: Desenho Aditivo das Células ◢/⬛

## Summary

Adicionar, em `apps/web/src/lib/partograph-overlay-svg.ts`, uma nova função de desenho `buildUterineActivityElements` que transforma os `UterineActivityChartColumn[]` produzidos na Fase 1 (`buildUterineActivityColumns`) em marcações SVG (`<rect>`/`<polygon>`) desenhadas na mesma faixa física `CONTRACTIONS_BAND`, e conectar essa nova função em `buildPartographOverlaySvg`. Por decisão do usuário (2026-08-31, registrada na PRD), a conexão usa **precedência**: se o parto tiver qualquer evento `uterine_activity`, a faixa desenha exclusivamente a matriz `uterine_activity`; caso contrário, desenha `buildContractionsElements` como hoje. `buildContractionsElements` continua sem nenhuma edição interna.

## User Story

As a médica obstetra/enfermeira obstétrica que exporta o partograma em PDF
I want ver a matriz de dinâmica uterina (◢/⬛) desenhada na faixa de contrações do PDF quando o parto usa o fluxo `birth_uterine_activity`
So that o prontuário impresso reflita fielmente o que já foi visto e confiado no gráfico em tela, sem células ilegíveis por sobreposição com dados antigos de `birth_contractions`

## Problem Statement

A Fase 1 produz a estrutura de colunas/células (`buildUterineActivityColumns`), mas nada ainda a desenha no SVG nem a conecta a `buildPartographOverlaySvg` — o PDF de um parto com dados `uterine_activity` continua sem mostrar nada nessa faixa (ou mostrando incorretamente, se também tiver `birth_contractions` antigo).

## Solution Statement

1. Nova função privada `uterineActivityCell(x, cellYTop, symbol)` que desenha um `<rect>` preenchido para `⬛` (mesmo padrão de preenchimento total de `contractionCell`) ou um `<polygon>` triangular (mesma técnica de `triangleApexPoints`) para `◢`, evitando depender de renderização de glifo Unicode via `sharp`.
2. Nova função privada `buildUterineActivityElements(columns)` que itera as colunas (truncando ao limite físico de 24 posições de `HOUR_COLUMN_X`/`CONTRACTIONS_BAND.columnX`), posiciona cada coluna sequencialmente via `columnXByIndex`, empilha até 5 células por coluna de baixo para cima (reaproveitando `CONTRACTION_ROW_HEIGHT`, que já é `(yBottom - yTop) / 5`), e concatena as strings SVG.
3. Em `buildPartographOverlaySvg` (linha 511), substituir a chamada direta a `buildContractionsElements(events)` por uma decisão de precedência: computar `buildUterineActivityColumns(events)` primeiro; se não-vazio, desenhar via `buildUterineActivityElements`; senão, cair para `buildContractionsElements(events)` como hoje. Nenhuma linha *dentro* de `buildContractionsElements` é tocada — apenas o call site em `buildPartographOverlaySvg` muda.

## Metadata

| Field            | Value                                                        |
| ---------------- | -------------------------------------------------------------- |
| Type             | NEW_CAPABILITY (fase 2 de 3 de uma feature aditiva)             |
| Complexity       | LOW-MEDIUM                                                      |
| Systems Affected | `apps/web/src/lib/partograph-overlay-svg.ts`                    |
| Dependencies     | Nenhuma nova — reaproveita `CONTRACTION_ROW_HEIGHT`, `CONTRACTION_CELL_WIDTH`, `columnXByIndex`, `CONTRACTIONS_BAND`, e a saída de `buildUterineActivityColumns` (Fase 1, já implementada) |
| Estimated Tasks  | 3                                                                |

---

## UX Design

### Before State
```
╔══════════════════════════════════════════════════════════════╗
║ PDF exportado — parto usando fluxo birth_uterine_activity      ║
╠══════════════════════════════════════════════════════════════╣
║  Faixa "contrações em 10 min." (CONTRACTIONS_BAND)             ║
║  ┌────┬────┬────┬────┬────┬────┬────┬────┬─── (24 colunas) ──┐ ║
║  │    │    │    │    │    │    │    │    │                   │ ║
║  └────┴────┴────┴────┴────┴────┴────┴────┴───────────────────┘ ║
║  VAZIA — buildContractionsElements só lê event.type ===         ║
║  "contraction"; eventos uterine_activity não aparecem em        ║
║  nenhum desenho.                                                ║
╚══════════════════════════════════════════════════════════════╝
```

### After State
```
╔══════════════════════════════════════════════════════════════╗
║ PDF exportado — parto usando fluxo birth_uterine_activity      ║
╠══════════════════════════════════════════════════════════════╣
║  Faixa "contrações em 10 min." (CONTRACTIONS_BAND)             ║
║  ┌────┬────┬────┬────┬────┬────┬────┬────┬─── (24 colunas) ──┐ ║
║  │ ⬛ │    │ ◢  │ ⬛ │    │ ◢  │    │ ⬛ │                   │ ║
║  │ ◢  │    │ ⬛ │ ◢  │    │    │    │ ◢  │                   │ ║
║  └────┴────┴────┴────┴────┴────┴────┴────┴───────────────────┘ ║
║  Uma coluna por bloco de 10 min de registro, ordem cronológica  ║
║  de registro (não hora real do exame), até 5 células/coluna,    ║
║  empilhadas de baixo para cima — mesma classificação simbólica  ║
║  vista no gráfico interativo em tela.                           ║
╚══════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════╗
║ PDF exportado — parto usando SÓ birth_contractions (sem        ║
║ nenhum evento uterine_activity)                                 ║
╠══════════════════════════════════════════════════════════════╣
║  Idêntico a antes da mudança — buildContractionsElements        ║
║  continua sendo chamada exatamente como hoje (fallback quando   ║
║  buildUterineActivityColumns(events) retorna []).                ║
╚══════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| PDF exportado, faixa "contrações em 10 min." | Vazia para partos com dados `uterine_activity` | Mostra matriz ◢/⬛ fiel ao gráfico em tela | Prontuário impresso passa a refletir dinâmica uterina registrada |
| PDF exportado, parto com só `birth_contractions` | Grade de frequência (quadrados cheio/meio/contorno) | Idêntico — sem mudança | Nenhum, comportamento preservado |
| PDF exportado, parto com AMBOS os tipos de evento | Só `birth_contractions` seria mostrado (código atual ignora `uterine_activity`) | Só `uterine_activity` é mostrado (precedência decidida pelo usuário) | Dado de `birth_contractions` deixa de aparecer nesse cenário raro — aceito conscientemente para evitar sobreposição ilegível |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/lib/partograph-overlay-svg.ts` | 214-231 | `contractionCell` — técnica de string SVG para `<rect>` preenchido, a mirrorar para `⬛` |
| P0 | `apps/web/src/lib/partograph-overlay-svg.ts` | 233-270 | `buildContractionsElements` — NÃO editar; apenas referência estrutural |
| P0 | `apps/web/src/lib/partograph-overlay-svg.ts` | 272-292 | `buildUterineActivityColumns` (Fase 1) — função de entrada desta fase, já implementada |
| P0 | `apps/web/src/lib/partograph-overlay-svg.ts` | ~110-115 | `triangleApexPoints` — técnica de `<polygon>` para desenhar glifo sem depender de fonte Unicode via `sharp`, a adaptar para ◢ |
| P0 | `apps/web/src/lib/partograph-overlay-svg.ts` | 502-515 | `buildPartographOverlaySvg` — ponto de conexão (linha 511) a alterar |
| P1 | `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.ts` | 1-58 | Tipos `UterineActivityChartColumn`/`UterineActivityChartCell` (`symbol: "◢" | "⬛"`) e `MAX_ROWS = 6` (tela) vs 5 exigido no PDF |
| P1 | `apps/web/src/lib/partograph-template-calibration.ts` | 27-30, 75-79 | `HOUR_COLUMN_X` (24 posições), `CONTRACTIONS_BAND` (`yTop: 457, yBottom: 511`) |

---

## Patterns to Mirror

**FILLED_RECT_PATTERN** (mirror exato do branch `> 40` de `contractionCell`, para `⬛`):
```typescript
// SOURCE: apps/web/src/lib/partograph-overlay-svg.ts:224
return `<rect x="${cellX}" y="${cellYTop}" width="${CONTRACTION_CELL_WIDTH}" height="${CONTRACTION_ROW_HEIGHT}" fill="#111827" />`;
```

**POLYGON_GLYPH_TECHNIQUE** (mirror da técnica de `triangleApexPoints`, adaptada para ◢ — triângulo inferior-direito preenchendo a célula):
```typescript
// SOURCE: apps/web/src/lib/partograph-overlay-svg.ts (~linha 110, triangleApexPoints)
function triangleApexPoints(x: number, apexY: number): string {
  return `${x},${apexY} ${x - 9},${apexY + 15} ${x + 9},${apexY + 15}`;
}
// usado como: `<polygon points="${triangleApexPoints(p.x, p.y)}" fill="${DILATION_COLOR}" />`
```
Adaptar para um triângulo ocupando o canto inferior-direito de uma célula retangular (equivalente visual ao glifo Unicode ◢ "BLACK LOWER RIGHT TRIANGLE"): vértices em `(cellX + width, cellYTop)`, `(cellX + width, cellYTop + height)`, `(cellX, cellYTop + height)`.

**PRIVATE_FUNCTION_CONVENTION** (nenhuma função de banda é exportada — mirror):
```typescript
// SOURCE: apps/web/src/lib/partograph-overlay-svg.ts:233 (sem `export`)
function buildContractionsElements(events: BirthModeTimelineEvent[]): string { ... }
```

**BAND_ASSEMBLY_PATTERN** (ponto de conexão a alterar, mirror do estilo de variável única por banda):
```typescript
// SOURCE: apps/web/src/lib/partograph-overlay-svg.ts:508-512
const fcf = buildFcfElements(events, t0);
const dilationStation = buildDilationStationElements(events, t0);
const pulsePa = buildPulsePaElements(events, t0);
const contractions = buildContractionsElements(events);
const columnText = buildColumnTextBands(events, t0);
```

**REUSE_EXISTING_ROW_HEIGHT** (não recriar constante — `CONTRACTION_ROW_HEIGHT` já é `(yBottom - yTop) / 5`, exatamente o limite físico de 5 linhas exigido para `uterine_activity` no PDF):
```typescript
// SOURCE: apps/web/src/lib/partograph-overlay-svg.ts:214
const CONTRACTION_ROW_HEIGHT = (CONTRACTIONS_BAND.yBottom - CONTRACTIONS_BAND.yTop) / 5;
```
**GOTCHA**: Apesar do nome ter prefixo `CONTRACTION_`, esta constante já representa a altura de uma linha assumindo 5 linhas físicas — coincide exatamente com o limite de 5 exigido pela PRD para `uterine_activity`. Reutilizar diretamente (não redefinir `UTERINE_ACTIVITY_ROW_HEIGHT` com o mesmo valor) evita duplicação/drift caso o template seja recalibrado no futuro.

---

## Files to Change

| File | Action | Justification |
| ---- | ------ | -------------- |
| `apps/web/src/lib/partograph-overlay-svg.ts` | UPDATE | Adicionar `uterineActivityCell`, `buildUterineActivityElements` (novas funções, após `buildUterineActivityColumns`); alterar apenas a linha 511 de `buildPartographOverlaySvg` para aplicar a regra de precedência. `buildContractionsElements` (233-270) permanece intocada. |

---

## NOT Building (Scope Limits)

- Nenhuma mudança em `buildContractionsElements` — a função em si não muda uma linha; apenas deixa de ser chamada nos partos com `uterine_activity` presente (decisão de precedência no call site).
- Nenhum suporte a mais de 24 colunas — truncamento simples via `.slice(0, CONTRACTIONS_BAND.columnX.length)`, mantendo as primeiras (mais antigas) e descartando o excedente mais recente, conforme decisão provisória já registrada na PRD.
- Nenhuma correção do bug de sobrescrita de `byColumn.set()` em `buildContractionsElements` — fora de escopo desta PRD inteira.
- Nenhum teste automatizado nesta fase — Fase 3 cobre isso.
- Nenhuma mudança no componente de tela (`birth-mode-uterine-activity-chart.tsx`) — só a camada de exportação SVG/PDF é tocada.

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/lib/partograph-overlay-svg.ts` — `uterineActivityCell`

- **ACTION**: Adicionar função privada de desenho de célula, logo após `buildUterineActivityColumns` (após a linha 292 atual).
- **IMPLEMENT**:
  ```typescript
  // Draws one ◢/⬛ cell for the uterine_activity matrix — polygon/rect only (no Unicode
  // glyph text), matching the technique already used for the dilation triangle
  // (triangleApexPoints), since glyph rendering via the sharp SVG->PNG pipeline is
  // unreliable for arbitrary Unicode symbols.
  function uterineActivityCell(
    x: number,
    cellYTop: number,
    symbol: UterineActivityChartCell["symbol"],
  ): string {
    const cellX = x - CONTRACTION_CELL_WIDTH / 2;
    if (symbol === "⬛") {
      return `<rect x="${cellX}" y="${cellYTop}" width="${CONTRACTION_CELL_WIDTH}" height="${CONTRACTION_ROW_HEIGHT}" fill="#111827" />`;
    }
    const points = `${cellX + CONTRACTION_CELL_WIDTH},${cellYTop} ${cellX + CONTRACTION_CELL_WIDTH},${cellYTop + CONTRACTION_ROW_HEIGHT} ${cellX},${cellYTop + CONTRACTION_ROW_HEIGHT}`;
    return `<polygon points="${points}" fill="#111827" />`;
  }
  ```
- **MIRROR**: `contractionCell` (`partograph-overlay-svg.ts:220-231`) for the `<rect>` fill branch and cell-x centering (`x - CONTRACTION_CELL_WIDTH / 2`); `triangleApexPoints` polygon-string technique for the triangle branch.
- **IMPORTS**: Requires `type { UterineActivityChartCell }` from `@/lib/birth-mode-uterine-activity-chart-utils` — add to the Phase-1 import block.
- **GOTCHA**: Reuse `CONTRACTION_CELL_WIDTH`/`CONTRACTION_ROW_HEIGHT` (module consts already defined at lines 214-215) — do not redeclare.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/lib/partograph-overlay-svg.ts` — `buildUterineActivityElements`

- **ACTION**: Adicionar função privada de montagem, logo após `uterineActivityCell`.
- **IMPLEMENT**:
  ```typescript
  const UTERINE_ACTIVITY_MAX_ROWS = 5; // physical print limit — vs 6 on the interactive screen chart

  // Draws the uterine_activity matrix: one column per 10-min registration block
  // (chronological order of registration, not real exam hour), reusing the same 24
  // physical column positions as buildContractionsElements. Truncates at 24 columns
  // (template's physical limit) and at 5 cells per column (vs 6 on screen).
  function buildUterineActivityElements(columns: UterineActivityChartColumn[]): string {
    const truncatedColumns = columns.slice(0, CONTRACTIONS_BAND.columnX.length);

    return truncatedColumns
      .map((column, columnIndex) => {
        const x = columnXByIndex(CONTRACTIONS_BAND, columnIndex);
        return column.cells
          .slice(0, UTERINE_ACTIVITY_MAX_ROWS)
          .map((cell, rowIndexFromBottom) => {
            const rowIndexFromTop = UTERINE_ACTIVITY_MAX_ROWS - 1 - rowIndexFromBottom;
            const cellYTop = CONTRACTIONS_BAND.yTop + rowIndexFromTop * CONTRACTION_ROW_HEIGHT;
            return uterineActivityCell(x, cellYTop, cell.symbol);
          })
          .join("");
      })
      .join("");
  }
  ```
- **MIRROR**: `buildContractionsElements`'s `.map(...).join("")` assembly style (`partograph-overlay-svg.ts:261-269`); `columnXByIndex` usage identical to `buildContractionsElements:266`.
- **IMPORTS**: `type { UterineActivityChartColumn }` already imported (Phase 1); no new imports needed.
- **GOTCHA**: `column.cells[0]` is the bottom-most cell chronologically (per `computeUterineActivityChartColumns`'s docstring and the screen chart's `flex-col-reverse` rendering) — `rowIndexFromBottom` in `.map((cell, rowIndexFromBottom) => ...)` is already correct as the array index; do not reverse the array before mapping.
- **GOTCHA 2**: Truncating to `CONTRACTIONS_BAND.columnX.length` (24) keeps the first 24 columns (oldest) and drops any overflow beyond that — matches the PRD's provisional truncation decision ("truncamento das colunas excedentes, mais recentes primeiro" = the excess/newest columns are the ones cut).
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/lib/partograph-overlay-svg.ts` — conectar em `buildPartographOverlaySvg`

- **ACTION**: Alterar apenas a linha `const contractions = buildContractionsElements(events);` (linha 511 atual) dentro de `buildPartographOverlaySvg`, aplicando a regra de precedência decidida pelo usuário.
- **IMPLEMENT**:
  ```typescript
  const uterineActivityColumns = buildUterineActivityColumns(events);
  const contractions =
    uterineActivityColumns.length > 0
      ? buildUterineActivityElements(uterineActivityColumns)
      : buildContractionsElements(events);
  ```
- **MIRROR**: Mantém o nome da variável `contractions` e o ponto de concatenação na string template (linha 514) exatamente como está — nenhuma outra linha de `buildPartographOverlaySvg` muda.
- **GOTCHA**: A precedência é decidida pela presença de QUALQUER evento `uterine_activity` no parto (sinalizada por `buildUterineActivityColumns` retornar array não-vazio — que só acontece se houver pelo menos 1 evento `uterine_activity`, ver guard `if (uterineActivityEvents.length === 0) return [];` da Fase 1), não pela presença de células visíveis dentro das colunas. Um parto com 1 registro `uterine_activity` de só contrações `<20s` (sem nenhum símbolo visível) ainda assim suprime `buildContractionsElements` — comportamento intencional da decisão de precedência do usuário (2026-08-31, PRD Decisions Log).
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

Nenhum teste automatizado nesta fase — Fase 3 da PRD cobre:
- Teste de múltiplos registros `uterine_activity` decompostos sem perda de dados entre colunas.
- Teste de overflow (>24 blocos) sem erro de índice.
- Teste de exclusão de contrações `<20s`.
- Teste de regressão de `buildContractionsElements` para eventos `contraction` (deve ser idêntica).
- **Adicional recomendado para a Fase 3 (não desta fase)**: teste cobrindo a regra de precedência (parto com ambos os tipos de evento → só `uterine_activity` desenhado).

### Edge Cases Checklist (validação manual nesta fase; testes formais na Fase 3)

- [ ] Parto só com `birth_contractions` → `buildUterineActivityColumns` retorna `[]` → cai no fallback `buildContractionsElements`, saída idêntica a antes da Fase 2.
- [ ] Parto só com `birth_uterine_activity` → desenha matriz ◢/⬛ via `buildUterineActivityElements`.
- [ ] Parto com AMBOS → só `uterine_activity` é desenhado (precedência).
- [ ] Parto sem nenhum dos dois tipos de evento → ambas as funções retornam vazio/`""`, faixa fica vazia (comportamento já existente, preservado).
- [ ] Geração manual de PDF real (via `renderPartographImageBuffer`/pipeline `sharp`) para confirmar que `<polygon>`/`<rect>` renderizam corretamente sem depender de fonte Unicode.

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
**EXPECT**: Exit 0, sem warnings.

### Level 2: MANUAL_VALIDATION

- Confirmar via `git diff` que `buildContractionsElements` (linhas 233-270) permanece byte-a-byte idêntica.
- Confirmar que a única mudança dentro de `buildPartographOverlaySvg` é a substituição da linha 511 (nenhuma outra linha da função tocada).
- Se possível, exportar um PDF de teste manual (parto com dados `uterine_activity` de teste) e inspecionar visualmente a faixa de contrações.

---

## Acceptance Criteria

- [ ] `uterineActivityCell`/`buildUterineActivityElements` existem, não exportadas, seguindo a convenção de funções privadas do arquivo.
- [ ] PDF de um parto com `uterine_activity` mostra a matriz corretamente (◢/⬛, até 5 linhas, colunas sequenciais).
- [ ] PDF de um parto que só usa `birth_contractions` permanece visualmente idêntico ao gerado antes desta mudança.
- [ ] `buildContractionsElements` inalterada — diff vazio nessa função.
- [ ] Nenhum índice fora do array `CONTRACTIONS_BAND.columnX`/`HOUR_COLUMN_X` é gerado, mesmo com >24 colunas de entrada.
- [ ] `pnpm check-types` e lint passam sem erros.

---

## Completion Checklist

- [ ] Task 1 (célula) implementada e validada
- [ ] Task 2 (montagem da faixa) implementada e validada
- [ ] Task 3 (conexão com precedência) implementada e validada
- [ ] Level 1: type-check + lint passam
- [ ] Level 2: revisão manual confirma zero alteração em `buildContractionsElements` e mudança isolada na linha de conexão
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Renderização incorreta do `<polygon>` triangular (◢) pelo pipeline `sharp` (SVG→PNG) | L | M | Usa a mesma técnica já validada em produção para o triângulo de dilatação (`triangleApexPoints`) — não introduz técnica nova, só nova geometria |
| Confusão entre `MAX_ROWS = 6` (tela, em `birth-mode-uterine-activity-chart-utils.ts`) e o limite de 5 exigido no PDF | L | M | `UTERINE_ACTIVITY_MAX_ROWS = 5` é uma constante local explícita nesta função, com comentário citando o motivo (limite físico do template impresso vs. tela) |
| Precedência de `uterine_activity` sobre `birth_contractions` esconder dado real em um parto raro com ambos os tipos | Confirmado possível pela análise de código (flag não é exclusiva nem forçada no servidor) | M | Decisão explícita do usuário (2026-08-31); documentada na PRD (Decisions Log) e nesta plan; comportamento é intencional, não um bug |
| Overflow de >24 colunas gerando erro de índice | L | M | `columnXByIndex` já tem fallback `?? band.columnX[0] ?? 0` (código existente, não desta fase) E `buildUterineActivityElements` trunca explicitamente para `CONTRACTIONS_BAND.columnX.length` antes de mapear — dupla proteção |

---

## Notes

- Esta fase conecta a Fase 1 ao SVG final. A partir desta fase, o PDF já reflete o comportamento funcional completo da feature (falta só a cobertura de testes formal da Fase 3).
- A regra de precedência foi decidida pelo usuário durante o planejamento desta fase (não estava resolvida no PRD original) — ver PRD, seção "Open Questions" (item marcado `[x]`) e "Decisions Log".
- `contractionCell`/`buildContractionsElements` permanecem 100% intocadas nesta fase — a única mudança de comportamento observável para partos com só `birth_contractions` é nenhuma (fallback preserva o caminho exato).

---

*Generated: 2026-08-31*
*Source PRD: `.claude/PRPs/prds/partograph-uterine-activity-pdf.prd.md` — Phase 2*
