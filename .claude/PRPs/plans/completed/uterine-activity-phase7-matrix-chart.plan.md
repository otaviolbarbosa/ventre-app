# Feature: Dinâmica Uterina — Fase 7: Componente de Gráfico Matriz

## Summary

Construir, do zero, um componente de gráfico em matriz (6 linhas × n colunas) que visualiza registros de `birth_uterine_activity` no formato reconhecido pela equipe obstétrica: cada coluna representa um bloco de 10 minutos, preenchido de baixo para cima com ◢ (contração intermediária, 20-40s) ou ■ (contração efetiva, >40s); contrações <20s não são exibidas. Não há precedente de componente de grade/heatmap interativo neste codebase — a lógica de referência mais próxima (`partograph-overlay-svg.ts`, geração de PDF) usa um MODELO DIFERENTE (1 célula por hora, linha = frequência arredondada, preenchimento = duração) e não é reutilizável, conforme já confirmado pela investigação e pela decisão registrada no PRD.

## User Story

As a médica obstetra ou enfermeira obstétrica
I want to ver a dinâmica uterina em formato de matriz (linhas × colunas de 10 min), do jeito que já reconheço do partograma em papel
So that eu tome decisões clínicas mais rápido, sem precisar reinterpretar um gráfico de linha

## Problem Statement

Não existe hoje nenhum componente que renderize dados de `birth_uterine_activity` como matriz. O gráfico de linha atual (`BirthModeContractionChart`) plota duração de contrações individuais ao longo do tempo — formato diferente do que a equipe obstétrica reconhece, e que só faz sentido para o fluxo antigo (`birth_contractions`).

## Solution Statement

Dois artefatos novos: (1) `birth-mode-uterine-activity-chart-utils.ts` — função pura que decompõe registros de `birth_uterine_activity` em colunas de células prontas para renderização, reaproveitando o algoritmo de divisão em blocos de 10 min já validado na Fase 3 (exportando a função privada `splitIntoBlocks` de lá); (2) `BirthModeUterineActivityChart` — componente React que renderiza essa estrutura como grid CSS (Tailwind), preenchido de baixo para cima. Ambos construídos e testados de forma standalone, seguindo o padrão já estabelecido na Fase 4 (componente pronto mas não conectado à tela — a troca visual é escopo da Fase 8).

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | NEW_CAPABILITY                                                        |
| Complexity       | HIGH                                                                   |
| Systems Affected | `apps/web/src/lib`, `apps/web/src/components/shared`                  |
| Dependencies     | Nenhuma nova — Tailwind, React, Vitest (já introduzido na Fase 3)      |
| Estimated Tasks  | 3                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Nenhum componente de matriz existe. birth_uterine_activity só tem        ║
║  representação textual (notação DU) na timeline (Fase 6).                 ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  BirthModeUterineActivityChart (standalone, ainda não conectado à tela)   ║
║                                                                             ║
║  linha 6  │   │   │   │   │                                               ║
║  linha 5  │   │   │   │   │                                               ║
║  linha 4  │   │   │ ■ │   │                                               ║
║  linha 3  │   │ ◢ │ ■ │   │  ◄── preenchido de baixo para cima            ║
║  linha 2  │ ◢ │ ◢ │ ■ │   │                                               ║
║  linha 1  │ ◢ │ ◢ │ ■ │   │                                               ║
║           col1 col2 col3 col4  (cada coluna = 1 bloco de 10min)          ║
║                                                                             ║
║  VALUE_ADD: Fase 8 pode trocar o gráfico de linha por este, por trás da   ║
║             flag, sem trabalho adicional de construção.                   ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | Impact |
|----------|--------|-------|--------|
| `apps/web/src/components/shared/` | Sem componente de matriz | `BirthModeUterineActivityChart` disponível e testado | Fase 8 pode integrá-lo à tela do partograma sem bloqueio |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/lib/birth-mode-uterine-activity-utils.ts` | full | `splitIntoBlocks` (privada) precisa ser exportada — algoritmo de decomposição já validado na Fase 3, NÃO reimplementar |
| P0 | `apps/web/src/lib/birth-mode-uterine-activity-utils.test.ts` | full | Exemplos numéricos já validados (fonte: `prompts/019-uterine-activity.md`) — reaproveitar os mesmos casos para os testes desta fase |
| P0 | `prompts/019-uterine-activity.md` | 20-27 | Exemplo numérico ESPECÍFICO do gráfico (não da notação): "6 contrações, medidas em 20 minutos, com durações de [28,31,35,43,55,54]" → 2 colunas de 3 |
| P1 | `apps/web/src/lib/partograph-overlay-svg.ts` | 209-265 | Referência conceitual dos limiares 20s/40s e do padrão de preenchimento parcial (via 2 `<rect>` empilhados) — modelo DIFERENTE (frequência×hora), não portar diretamente, só os limiares |
| P1 | `apps/web/src/components/shared/birth-mode-contraction-chart.tsx` | full | Convenção de nomenclatura/estrutura de componente de gráfico irmão — prop `{ events: BirthModeTimelineEvent[] }`, filtro por `event.type` |
| P2 | `apps/web/src/components/shared/appointment-calendar-view.tsx` | 153-189 | Precedente mais próximo (ainda que parcial) de grid CSS com preenchimento condicional por célula neste codebase |

**External Documentation:** Nenhuma — CSS Grid do Tailwind já em uso extensivamente no codebase.

---

## Patterns to Mirror

**BLOCK_SPLIT_REUSE (exportar, não duplicar):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-uterine-activity-utils.ts
// Função já existe como não-exportada — apenas adicionar `export`:
export function splitIntoBlocks<T>(items: T[], blockCount: number): T[][] {
  const base = Math.floor(items.length / blockCount);
  const remainder = items.length % blockCount;
  const blocks: T[][] = [];
  let cursor = 0;
  for (let i = 0; i < blockCount; i++) {
    const size = base + (i < remainder ? 1 : 0);
    blocks.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return blocks;
}
```

**CHART_GRID_PATTERN (grid CSS com preenchimento condicional, adaptado):**
```tsx
// SOURCE: apps/web/src/components/shared/appointment-calendar-view.tsx:153-189 (padrão adaptado)
<div className="grid grid-cols-{n} gap-1">
  {columns.map((column, colIndex) => (
    <div key={colIndex} className="flex flex-col-reverse gap-0.5">
      {/* flex-col-reverse: primeiro item do array = célula de baixo (preenchimento bottom-up nativo) */}
      {Array.from({ length: 6 }, (_, rowIndex) => {
        const cell = column.cells[rowIndex];
        return (
          <div key={rowIndex} className="flex h-6 w-6 items-center justify-center border text-xs">
            {cell?.symbol ?? ""}
          </div>
        );
      })}
    </div>
  ))}
</div>
```

**SIBLING_CHART_PROP_CONTRACT:**
```typescript
// SOURCE: apps/web/src/components/shared/birth-mode-contraction-chart.tsx
type BirthModeContractionChartProps = {
  events: BirthModeTimelineEvent[];
};
export function BirthModeContractionChart({ events }: BirthModeContractionChartProps) {
  const contractionEvents = events.filter((event) => event.type === "contraction");
  // ...
}
```

---

## Files to Change

| File                                                                        | Action | Justification                                                        |
| -----------------------------------------------------------------------------| ------ | ---------------------------------------------------------------------|
| `apps/web/src/lib/birth-mode-uterine-activity-utils.ts`                    | UPDATE | Exportar `splitIntoBlocks` (uma palavra, sem lógica nova)             |
| `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.ts`              | CREATE | Função pura de data-shaping: registros → colunas de células          |
| `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.test.ts`         | CREATE | Testes cobrindo o exemplo numérico do requisito + edge cases          |
| `apps/web/src/components/shared/birth-mode-uterine-activity-chart.tsx`     | CREATE | Componente React da matriz                                           |

---

## NOT Building (Scope Limits)

- **Conexão com a tela do partograma** — Fase 8, escopo explícito do PRD.
- **Toggle de feature flag** — não referenciado nesta fase; componente standalone, testado isoladamente (mesmo padrão da Fase 4).
- **Reutilização/adaptação do SVG do PDF** — decisão já registrada no PRD: não reutilizar diretamente, apenas os limiares conceituais (20s/40s).
- **Tooltip/interatividade avançada (hover, clique em célula)** — fora do escopo mínimo definido pelo PRD ("Gráfico renderiza corretamente os exemplos numéricos do requisito"); pode ser adicionado depois sem mudança estrutural.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Granularidade de coluna | Uma coluna por bloco de 10 minutos, DENTRO de um único registro decomposto (ex: registro de 20min → 2 colunas) — colunas de registros diferentes se concatenam em ordem cronológica | Uma coluna por hora (como o SVG do PDF) | O PRD é explícito: "Cada coluna representa 10 minutos do registro da tabela birth_uterine_activity" — granularidade diferente do modelo por hora do PDF, que é uma agregação de MÚLTIPLOS registros por hora, não a decomposição de UM registro em sub-blocos |
| Atribuição de linha (row) dentro de uma coluna | Uma linha por contração sobrevivente (≥20s) dentro do bloco, empilhadas de baixo para cima na ordem em que ocorreram, até 6 linhas | Uma única linha "de frequência" com preenchimento por duração (modelo do SVG do PDF) | O modelo do SVG do PDF agrega MÚLTIPLAS leituras por hora numa única célula (frequência × duração da última leitura) — não faz sentido aqui, onde o registro já vem com a lista completa de durações de um bloco de 10min; "uma linha por contração, até 6" é a leitura mais direta do requisito ("Quantidade de contrações: Entre 0 e 6 a cada 10 minutos") e do exemplo do gráfico (linha 27 do requisito), que lista contagens exatas por coluna sem menção a agregação de frequência |
| Exclusão de contrações <20s | Removidas do array de células ANTES de atribuir linhas (não contam para as 6 posições) | Renderizar como célula vazia mantendo a posição | Requisito explícito: "Contrações leves ou não efetivas (<20s) não devem ser registradas" (linha 24) — tratado como ausência total, não como espaço reservado vazio |
| Ordem de empilhamento (baixo para cima) | `flex-col-reverse` com o array de células em ordem cronológica (primeira contração do bloco = primeiro item = fica embaixo) | Inverter o array manualmente e usar `flex-col` | `flex-col-reverse` é a abordagem CSS mais direta para "primeiro item embaixo" sem precisar inverter o array em JS, mantendo a função de data-shaping mais simples (retorna só a ordem cronológica natural) |
| Símbolos ◢/■ | Caracteres Unicode literais (`◢`, `■`) diretamente no JSX | `clip-path` CSS para o triângulo, ou ícone SVG customizado | Nenhum precedente de nenhuma das duas abordagens existe no codebase (confirmado); Unicode literal é a opção de menor esforço/manutenção e o PRD já usa esses exatos glifos na sua própria especificação, sugerindo que são aceitáveis como está |

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/lib/birth-mode-uterine-activity-utils.ts`

- **ACTION**: Exportar a função `splitIntoBlocks` (já implementada na Fase 3, atualmente privada)
- **IMPLEMENT**: Adicionar a palavra-chave `export` antes de `function splitIntoBlocks<T>(...)`. Nenhuma outra mudança.
- **MIRROR**: A função já existe integralmente — apenas mudar sua visibilidade
- **GOTCHA**: Não duplicar/reimplementar esta lógica em `birth-mode-uterine-activity-chart-utils.ts` — importar diretamente
- **VALIDATE**: `cd apps/web && pnpm exec tsc --noEmit` (deve continuar passando — mudança não-quebrante), `pnpm test` (6/6 testes da Fase 3 continuam passando)

### Task 2: CREATE `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.ts` + teste

- **ACTION**: CREATE função pura de data-shaping + teste unitário
- **IMPLEMENT**:
  ```typescript
  import { splitIntoBlocks } from "./birth-mode-uterine-activity-utils";

  const INTERMEDIATE_THRESHOLD_SECONDS = 20;
  const EFFECTIVE_THRESHOLD_SECONDS = 40;
  const MAX_ROWS = 6;

  export type UterineActivityChartCell = {
    symbol: "◢" | "■";
  };

  export type UterineActivityChartColumn = {
    cells: UterineActivityChartCell[];
  };

  export type UterineActivityChartRow = {
    interval_minutes: 10 | 20 | 30;
    durations_seconds: number[];
  };

  function classifyDuration(duration: number): UterineActivityChartCell["symbol"] | null {
    if (duration > EFFECTIVE_THRESHOLD_SECONDS) return "■";
    if (duration >= INTERMEDIATE_THRESHOLD_SECONDS) return "◢";
    return null;
  }

  function blockToColumn(blockDurations: number[]): UterineActivityChartColumn {
    const cells = blockDurations
      .map(classifyDuration)
      .filter((symbol): symbol is UterineActivityChartCell["symbol"] => symbol !== null)
      .slice(0, MAX_ROWS)
      .map((symbol) => ({ symbol }));
    return { cells };
  }

  /** Decompõe registros de dinâmica uterina (em ordem cronológica) em colunas de
   * células prontas para o gráfico matriz, uma coluna por bloco de 10 minutos.
   * Contrações <20s são excluídas; células são retornadas em ordem cronológica
   * (primeiro item = célula de baixo, via `flex-col-reverse` na renderização). */
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
    return columns;
  }
  ```
- **MIRROR**: Estrutura/estilo do módulo puro de `birth-mode-uterine-activity-utils.ts` (constantes de limiar, funções auxiliares privadas, uma função exportada principal com JSDoc explicando o "porquê")
- **GOTCHA**: `EFFECTIVE_THRESHOLD_SECONDS` (40) e `INTERMEDIATE_THRESHOLD_SECONDS` (20) são DUPLICADOS aqui em vez de importados de `birth-mode-uterine-activity-utils.ts` — aquele módulo não os exporta atualmente (foram removidos como não usados na Fase 3, ver Decisions Log da Fase 3). Se preferir, adicionar uma Task 0 para exportá-los de lá em vez de duplicar; decisão deixada para o momento da implementação, documentar como desvio se optar por duplicar
- **GOTCHA**: `.slice(0, MAX_ROWS)` trunca silenciosamente além de 6 contrações sobreviventes — a constraint de banco já impede `contraction_count > 6` por bloco de 10min, então este truncamento é defesa em profundidade, não deveria disparar em dados reais
- **TEST**:
  ```typescript
  import { describe, expect, it } from "vitest";
  import { computeUterineActivityChartColumns } from "./birth-mode-uterine-activity-chart-utils";

  describe("computeUterineActivityChartColumns", () => {
    it("decompõe 20min em 2 colunas de 3 células cada (exemplo do requisito)", () => {
      // Fonte: prompts/019-uterine-activity.md:27
      const columns = computeUterineActivityChartColumns([
        { interval_minutes: 20, durations_seconds: [28, 31, 35, 43, 55, 54] },
      ]);
      expect(columns).toHaveLength(2);
      expect(columns[0]?.cells).toEqual([{ symbol: "◢" }, { symbol: "◢" }, { symbol: "◢" }]);
      expect(columns[1]?.cells).toEqual([{ symbol: "■" }, { symbol: "■" }, { symbol: "■" }]);
    });

    it("exclui contrações <20s da coluna", () => {
      const columns = computeUterineActivityChartColumns([
        { interval_minutes: 10, durations_seconds: [15, 25, 45] },
      ]);
      expect(columns).toHaveLength(1);
      expect(columns[0]?.cells).toEqual([{ symbol: "◢" }, { symbol: "■" }]);
    });

    it("concatena colunas de múltiplos registros em ordem cronológica", () => {
      const columns = computeUterineActivityChartColumns([
        { interval_minutes: 10, durations_seconds: [45, 50] },
        { interval_minutes: 10, durations_seconds: [25] },
      ]);
      expect(columns).toHaveLength(2);
      expect(columns[0]?.cells).toHaveLength(2);
      expect(columns[1]?.cells).toHaveLength(1);
    });

    it("retorna coluna com array de células vazio quando todas as contrações do bloco são <20s", () => {
      const columns = computeUterineActivityChartColumns([
        { interval_minutes: 10, durations_seconds: [10, 15] },
      ]);
      expect(columns).toEqual([{ cells: [] }]);
    });
  });
  ```
- **VALIDATE**: `cd apps/web && pnpm test` — todos os casos devem passar

### Task 3: CREATE `apps/web/src/components/shared/birth-mode-uterine-activity-chart.tsx`

- **ACTION**: CREATE componente React da matriz
- **IMPLEMENT**:
  ```tsx
  "use client";

  import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
  import {
    computeUterineActivityChartColumns,
    type UterineActivityChartRow,
  } from "@/lib/birth-mode-uterine-activity-chart-utils";

  const MAX_ROWS = 6;

  type BirthModeUterineActivityChartProps = {
    events: BirthModeTimelineEvent[];
  };

  export function BirthModeUterineActivityChart({ events }: BirthModeUterineActivityChartProps) {
    const rows: UterineActivityChartRow[] = events
      .filter((event) => event.type === "uterine_activity")
      .map((event) => {
        const { interval_minutes, durations_seconds } = event.payload as {
          interval_minutes: 10 | 20 | 30;
          durations_seconds: number[];
        };
        return { interval_minutes, durations_seconds };
      });

    if (rows.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">
          Nenhum registro de dinâmica uterina ainda
        </div>
      );
    }

    const columns = computeUterineActivityChartColumns(rows);

    return (
      <div className="flex gap-1 overflow-x-auto">
        {columns.map((column, colIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: colunas não têm identidade estável própria
          <div key={colIndex} className="flex flex-col-reverse gap-0.5">
            {Array.from({ length: MAX_ROWS }, (_, rowIndex) => {
              const cell = column.cells[rowIndex];
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: linhas são posições fixas 1-6
                <div
                  key={rowIndex}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border text-sm"
                >
                  {cell?.symbol ?? ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/birth-mode-contraction-chart.tsx` (prop `{ events }`, filtro por `event.type`, estado vazio com mesmo estilo de placeholder `border-dashed`)
- **GOTCHA**: `event.payload` é tipado como `Record<string, unknown>` em `BirthModeTimelineEvent` — o cast para `{ interval_minutes, durations_seconds }` assume que a Fase 6 já populou o payload corretamente; se a Fase 6 não estiver mesclada, este componente não terá dados reais para renderizar (mas compila e testa normalmente via props sintéticas)
- **VALIDATE**: `cd apps/web && NODE_OPTIONS="--max-old-space-size=8192" pnpm exec tsc --noEmit` (usar flag de memória apenas se o crash de `tsc` reaparecer — já corrigido na Fase 4, não deveria ser necessário), `pnpm exec biome check apps/web/src/components/shared/birth-mode-uterine-activity-chart.tsx`

---

## Testing Strategy

### Unit Tests to Write

| Test File                                                              | Test Cases                                                              | Validates                          |
| ---------------------------------------------------------------------------| ------------------------------------------------------------------------| ------------------------------------|
| `apps/web/src/lib/birth-mode-uterine-activity-chart-utils.test.ts`      | Exemplo do requisito (6→2 colunas), exclusão <20s, múltiplos registros, todas excluídas | `computeUterineActivityChartColumns` |

Nenhum teste automatizado para o componente React em si (mesma lacuna de convenção das fases anteriores).

### Edge Cases Checklist (validação manual, requer montagem temporária — ver Level 5)

- [ ] Registro de 10min com 6 contrações efetivas → 1 coluna com 6 células ■
- [ ] Registro de 30min → 3 colunas
- [ ] Mistura de ◢ e ■ na mesma coluna, empilhados corretamente de baixo para cima
- [ ] Scroll horizontal funciona quando há muitas colunas (`overflow-x-auto`)
- [ ] Estado vazio (nenhum registro) exibe o placeholder, não uma matriz quebrada

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
cd apps/web && pnpm exec tsc --noEmit
pnpm exec biome check apps/web/src/lib/birth-mode-uterine-activity-chart-utils.ts apps/web/src/lib/birth-mode-uterine-activity-chart-utils.test.ts apps/web/src/components/shared/birth-mode-uterine-activity-chart.tsx apps/web/src/lib/birth-mode-uterine-activity-utils.ts
```

### Level 2: UNIT_TESTS

```bash
cd apps/web && pnpm test
```

**EXPECT**: 4 novos casos + 6 casos existentes da Fase 3, todos passando (10 no total).

### Level 5: BROWSER_VALIDATION

Mesmo padrão da Fase 4: montagem temporária (`<BirthModeUterineActivityChart events={[...eventos sintéticos com type: "uterine_activity"...]} />`) em uma rota/story de debug local, validar o checklist acima, descartar a montagem antes de finalizar (a conexão real é Fase 8).

---

## Acceptance Criteria

- [ ] `computeUterineActivityChartColumns` implementada e testada, reproduzindo o exemplo numérico do requisito
- [ ] `BirthModeUterineActivityChart` renderiza a matriz corretamente a partir de eventos da timeline
- [ ] Contrações <20s nunca aparecem como célula
- [ ] Preenchimento visualmente de baixo para cima
- [ ] `tsc --noEmit`, `biome check` e `pnpm test` passam sem erros

---

## Completion Checklist

- [ ] Task 1-3 completas em ordem
- [ ] Level 1 passa
- [ ] Level 2: todos os testes passam
- [ ] Level 5 validado manualmente via montagem temporária
- [ ] Acceptance criteria atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | ---------------------------------------- |
| Interpretação de "uma linha por contração" (em vez do modelo de frequência do SVG do PDF) pode não bater com a expectativa visual da equipe obstétrica se ela esperar o MESMO modelo do PDF | M | H | Documentado explicitamente no Decisions Log com a justificativa; recomendar validação visual com a equipe clínica antes do rollout da Fase 8, comparando lado a lado com o gráfico do PDF existente |
| Limiares 20s/40s duplicados entre `birth-mode-uterine-activity-utils.ts` e este novo arquivo (não há constante compartilhada exportada) | L | L | Se um dos limiares mudar no futuro, os dois arquivos precisam ser atualizados juntos — considerar extrair uma constante compartilhada em uma refatoração futura, fora do escopo desta fase |
| Símbolos Unicode ◢/■ podem renderizar de forma inconsistente entre fontes/SOs | L | L | Sem precedente no codebase para avaliar; validar visualmente em pelo menos Chrome/Safari durante o Level 5 |

---

## Notes

- Este é o componente de maior esforço/risco da feature inteira, conforme o próprio PRD já sinalizava ("H" likelihood no risco técnico "Componente de matriz exige implementação nova sem precedente").
- A decisão de "uma linha por contração" em vez do modelo de frequência do SVG do PDF é a interpretação mais direta do texto do requisito, mas é a área com MAIOR incerteza desta fase — sinalizada com destaque no Decisions Log e nos Risks.
- Depois desta fase, atualizar a tabela de fases do PRD: Status da Fase 7 → `complete`, campo PRP Plan apontando para este arquivo.
