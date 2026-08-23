# Feature: Partograma — Correção de Frequência em Tempo Real + Polimento Mobile/Tablet

## Summary

Fase 5 do PRD do Partograma. A investigação de codebase mostrou que o fluxo de tempo real já está totalmente funcional — `useBirthModeTimelineRealtime` alimenta um único `events` state em `BirthModeScreen`, consumido de forma idêntica por `BirthModePartograph` e `BirthModeTimeline`, então qualquer novo evento já aparece nas duas abas sem reload, sem gating por aba ativa. O trabalho real desta fase é mais estreito que o título sugere: (1) corrigir uma lacuna documentada no próprio código — `contractions_per_10min` não é recalculado para eventos de contração inseridos via tempo real, então o mini-gráfico de contrações e o texto da timeline ficam com a frequência ausente até o próximo reload; e (2) fazer o polimento responsivo mobile/tablet dos 6 mini-gráficos chart.js, que hoje usam uma altura fixa `h-64` e fonte de legenda `10px` idênticas em todos os breakpoints — sem nenhum precedente de hook de viewport no repositório.

## User Story

As a profissional da equipe de cuidado (enfermagem obstétrica/obstetra) em modo parto
I want to ver a frequência de contrações atualizada corretamente assim que registro uma nova contração, e conseguir ler os mini-gráficos do partograma confortavelmente no celular ou tablet durante o plantão
So that eu confie no partograma como referência em tempo real, sem precisar recarregar a página ou apertar os olhos para ler o gráfico

## Problem Statement

1. `PAYLOAD_KEYS_BY_TABLE.birth_contractions` em `use-birth-mode-timeline-realtime.ts:40` não inclui `contractions_per_10min` (o comentário nas linhas 38-39 documenta isso explicitamente). Resultado: quando uma nova contração é inserida enquanto a equipe está com o Partograma aberto, `BirthModeContractionChart` (que filtra pontos com `contractions_per_10min == null`, linhas 60-62) simplesmente omite o ponto de frequência daquele evento, e `BirthModeTimeline` (linha 28) omite o sufixo "Nx/10min" do texto — até o próximo reload completo via `getBirthModeTimelineAction`.
2. Os 6 componentes de mini-gráfico (`birth-mode-dilation-station-chart.tsx`, `-fetal-heart-rate-chart.tsx`, `-contraction-chart.tsx`, `-oxytocin-chart.tsx`, `-maternal-vitals-chart.tsx`, `-urine-test-chart.tsx`) usam `<div className="h-64">` com `chart.js` `plugins.legend.labels.font.size: 10` e nenhuma opção de eixo X (`ticks.maxTicksLimit`/`maxRotation`) — idênticos em qualquer largura de tela. Não há nenhum hook de viewport (`matchMedia`/`useMediaQuery`) em `apps/web/src`, então não há como esses gráficos hoje se adaptarem a celular vs tablet.

## Solution Statement

1. Extrair a mesma lógica de janela deslizante de 10 minutos já usada em `getBirthModeTimelineAction` (linhas 99-111) para uma função pura `computeContractionsPer10Min` em `birth-mode-chart-utils.ts`, e aplicá-la no merge de eventos de `BirthModeScreen.onNewEvent`: sempre que um evento `contraction` chega via tempo real, recalcular `contractions_per_10min` para todos os eventos de contração acumulados e reescrever o `payload` no state. Isso corrige o gráfico E o texto da timeline em um único ponto de integração, sem tocar no hook de realtime nem duplicar a lógica em cada componente consumidor.
2. Criar um hook compartilhado `useIsCompactViewport()` (via `useSyncExternalStore` + `window.matchMedia`, seguindo o mesmo breakpoint de 640px já documentado em `CLAUDE.md` para Dialog/Sheet) em `apps/web/src/hooks/use-media-query.ts`. Aplicar esse hook nos 6 componentes de mini-gráfico para reduzir `plugins.legend.labels.font.size`, adicionar `scales.x.ticks.maxTicksLimit` (menor em telas compactas) e `maxRotation: 0` — mantendo a altura `h-64` fixa (Chart.js exige altura explícita do contêiner; pesquisa confirma que isso já está correto) e adicionando `relative` + `min-w-0` no wrapper por defesa, conforme os docs do Chart.js.

## Metadata

| Field            | Value                                                                |
| ---------------- | --------------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                            |
| Complexity       | LOW                                                                    |
| Systems Affected | `apps/web/src/hooks/`, `apps/web/src/lib/birth-mode-chart-utils.ts`, `apps/web/src/screens/birth-mode-screen.tsx`, 6 componentes `apps/web/src/components/shared/birth-mode-*-chart.tsx` |
| Dependencies     | `chart.js@^4.5.1`, `react-chartjs-2@^5.3.1` (já em uso, nenhuma lib nova) |
| Estimated Tasks  | 9                                                                      |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  Celular (< 640px), aba "Partograma" aberta durante o plantão:                 ║
║  ┌────────────────────────────────────────┐                                    ║
║  │ Card: Contrações                        │  ← nova contração é registrada    ║
║  │  h-64, legenda 10px, sem limite de tick │     via modal em outra aba/sheet  ║
║  │  eixo X denso, ticks podem colidir      │                                    ║
║  │  Frequência do último ponto = AUSENTE   │  ← realtime não recalcula         ║
║  │  (só aparece após reload da tela)       │     contractions_per_10min        ║
║  └────────────────────────────────────────┘                                    ║
║                                                                                  ║
║  USER_FLOW: Equipe registra contração → volta para "Partograma" → ponto de     ║
║  frequência daquele evento não aparece no gráfico nem no texto da timeline até  ║
║  um reload manual da tela.                                                     ║
║  PAIN_POINT: Confiança no tempo real quebrada para o track de contrações;      ║
║  gráficos idênticos em celular/tablet/desktop, sem ajuste de legibilidade.      ║
║                                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  Celular (< 640px), aba "Partograma" aberta durante o plantão:                 ║
║  ┌────────────────────────────────────────┐                                    ║
║  │ Card: Contrações                        │                                    ║
║  │  h-64, legenda 9px, maxTicksLimit: 4     │  ← compacto e legível             ║
║  │  eixo X horizontal (maxRotation: 0)     │                                    ║
║  │  Frequência do novo ponto = PRESENTE     │  ← recalculada no merge do        ║
║  │  imediatamente após o registro           │     evento em BirthModeScreen     ║
║  └────────────────────────────────────────┘                                    ║
║                                                                                  ║
║  Tablet/desktop (>= 640px): legenda 10px, maxTicksLimit maior — sem mudança    ║
║  visual perceptível em relação ao comportamento atual.                        ║
║                                                                                  ║
║  USER_FLOW: Equipe registra contração → o mini-gráfico e a Linha do tempo já   ║
║  mostram a frequência correta sem reload; em celular, os 6 mini-gráficos têm   ║
║  menos ticks e fonte reduzida, priorizando leitura rápida em poucos segundos.  ║
║  VALUE_ADD: Tempo real correto ponta a ponta; leitura mobile otimizada dentro  ║
║  do "melhor esforço" já definido no PRD (decisão do stakeholder).             ║
║                                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `birth-mode-screen.tsx` (`onNewEvent`) | Novo evento de contração é apenas anexado ao array `events` | Novo evento de contração dispara recálculo de `contractions_per_10min` para todos os eventos de contração no array | Frequência aparece imediatamente no gráfico e na timeline, sem reload |
| 6 mini-gráficos (`birth-mode-*-chart.tsx`) | Legenda/eixo X com fonte e densidade de ticks fixas em qualquer largura | Legenda/eixo X mais compactos em telas < 640px | Menos poluição visual e menos sobreposição de rótulos em celular |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/actions/get-birth-mode-timeline-action.ts` | 99-111 | Algoritmo exato de janela deslizante de 10min a MIRROR em `computeContractionsPer10Min` |
| P0 | `apps/web/src/screens/birth-mode-screen.tsx` | 28, 61-65 | State `events` e callback `onNewEvent` a ESTENDER |
| P0 | `apps/web/src/hooks/use-birth-mode-timeline-realtime.ts` | 37-56 | `PAYLOAD_KEYS_BY_TABLE` e comentário do gap — NÃO precisa mudar, mas documenta o comportamento atual |
| P1 | `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` | 1-180 (inteiro) | Padrão de referência para os 6 mini-gráficos — options `scales`/`plugins.legend` a tornar responsivos |
| P1 | `apps/web/src/components/shared/birth-mode-contraction-chart.tsx` | 55-65 | Onde `contractions_per_10min` é lido do payload — deve continuar funcionando sem mudança após o fix em Task 2 |
| P1 | `apps/web/src/lib/birth-mode-chart-utils.ts` | 1-17 | Util compartilhado onde `computeContractionsPer10Min` deve ser adicionado, ao lado de `resolveChartT0`/`hoursSince` |
| P2 | `apps/web/src/components/shared/birth-mode-timeline.tsx` | 20-30 | Consumidor adicional de `contractions_per_10min` que se beneficia do fix sem mudança própria |
| P2 | `apps/web/CLAUDE.md` | 56-61 | Convenção de breakpoint 640px (`window.innerWidth < 640`) já documentada no projeto |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [Chart.js v4 — Responsive Charts](https://www.chartjs.org/docs/latest/configuration/responsive.html) | Container requirements, `resizeDelay` | Wrapper precisa ser `position: relative` dedicado ao canvas; `maintainAspectRatio: false` + altura explícita já está correto — manter `h-64` |
| [Chart.js v4 — Common Tick Options](https://www.chartjs.org/docs/latest/axes/cartesian/_common_ticks.html) | `autoSkip`, `maxTicksLimit`, `maxRotation` | Reduzir `maxTicksLimit` e forçar `maxRotation: 0` em telas compactas evita rótulos rotacionados/sobrepostos |
| React docs — `useSyncExternalStore` | Pattern para `matchMedia` | Base do hook `useIsCompactViewport`, evita bugs de listener duplicado de um `useEffect` mal escrito |

---

## Patterns to Mirror

**CONTRACTIONS_PER_10MIN_ALGORITHM (a extrair, não reinventar):**
```typescript
// SOURCE: apps/web/src/actions/get-birth-mode-timeline-action.ts:99-111
// COPY THIS PATTERN (mesma janela deslizante, mesma ordem cronológica):
const contractionRows = contractions ?? [];
const contractionsPer10MinById = new Map<string, number>();
const trailingWindow: number[] = [];
for (const row of contractionRows) {
  const time = new Date(row.measured_at).getTime();
  trailingWindow.push(time);
  while (trailingWindow.length > 0 && (trailingWindow[0] ?? time) < time - 10 * 60 * 1000) {
    trailingWindow.shift();
  }
  contractionsPer10MinById.set(row.id, trailingWindow.length);
}
```

**EXISTING_CHART_UTIL_STYLE (para o novo export em `birth-mode-chart-utils.ts`):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-chart-utils.ts:1-17
// COPY THIS STYLE: funções puras, tipadas, sem dependência de React
import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";

export type ChartPoint = { x: number; y: number };

export function resolveChartT0(events: BirthModeTimelineEvent[]): number | null { /* ... */ }
export function hoursSince(t0: number, iso: string): number { /* ... */ }
```

**EVENT_MERGE_CALLBACK (ponto de integração a estender):**
```typescript
// SOURCE: apps/web/src/screens/birth-mode-screen.tsx:61-63
// CURRENT — apenas anexa e dedupe por id:
const onNewEvent = useCallback((event: BirthModeTimelineEvent) => {
  setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]));
}, []);
```

**CHART_COMPONENT_SKELETON (repetido idêntico nos 6 arquivos, ponto de injeção do hook responsivo):**
```typescript
// SOURCE: apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx:36-48, 141-179
"use client";
// ... imports chart.js, resolveChartT0, hoursSince ...

export function BirthModeXChart({ events }: Props) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);
  useEffect(() => { setPrimaryColor(`hsl(${getCssVar("--primary")})`); }, []);
  // ... filtro de eventos, early returns h-64 skeleton/empty-state ...
  return (
    <div className="h-64">
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: { x: { type: "linear", min: 0, max: maxX, title: {...} }, y: {...} },
          plugins: {
            legend: { display: true, position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
            tooltip: { filter: (item) => item.dataset.label != null },
          },
        }}
      />
    </div>
  );
}
```

**MEDIA_QUERY_HOOK_PATTERN (novo arquivo, seguir estilo dos hooks existentes):**
```typescript
// SOURCE: apps/web/src/hooks/use-scroll-direction.ts (estilo de hook simples do repo, para nomeação/organização)
// NOVO PADRÃO a introduzir (useSyncExternalStore + matchMedia, sem lib nova):
"use client";

import { useSyncExternalStore } from "react";

function subscribe(query: string, callback: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function useIsCompactViewport(): boolean {
  return useMediaQuery("(max-width: 639px)");
}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/hooks/use-media-query.ts` | CREATE | Hook compartilhado `useMediaQuery`/`useIsCompactViewport`, base de todo o polimento responsivo |
| `apps/web/src/lib/birth-mode-chart-utils.ts` | UPDATE | Adicionar `computeContractionsPer10Min`, ao lado de `resolveChartT0`/`hoursSince` |
| `apps/web/src/screens/birth-mode-screen.tsx` | UPDATE | Estender `onNewEvent` para recalcular `contractions_per_10min` ao inserir evento de contração |
| `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` | UPDATE | Aplicar `useIsCompactViewport` nas opções de legenda/eixo X; `relative`/`min-w-0` no wrapper |
| `apps/web/src/components/shared/birth-mode-fetal-heart-rate-chart.tsx` | UPDATE | Idem |
| `apps/web/src/components/shared/birth-mode-contraction-chart.tsx` | UPDATE | Idem |
| `apps/web/src/components/shared/birth-mode-oxytocin-chart.tsx` | UPDATE | Idem |
| `apps/web/src/components/shared/birth-mode-maternal-vitals-chart.tsx` | UPDATE | Idem |
| `apps/web/src/components/shared/birth-mode-urine-test-chart.tsx` | UPDATE | Idem |

---

## NOT Building (Scope Limits)

- **Recalcular `contractions_per_10min` no hook de realtime (`use-birth-mode-timeline-realtime.ts`)** — o hook não tem acesso ao histórico completo de contrações (só recebe uma linha por vez); o fix correto e mínimo vive no merge de estado em `BirthModeScreen`, que já tem o array completo. O comentário existente no hook (linhas 38-39) pode ficar como está — ele descreve corretamente o que o hook em si não faz.
- **Suporte a `UPDATE`/`DELETE` no realtime** — fora do escopo desta fase; o PRD não pede edição/remoção de eventos, e o hook hoje só escuta `INSERT` (comportamento existente, não uma regressão introduzida aqui).
- **Novo hook `useIsMobile` genérico com múltiplos breakpoints (mobile/tablet/desktop)** — o PRD pede "melhor esforço" para mobile/tablet; um único breakpoint de 640px (já convencionado no `CLAUDE.md` para Dialog/Sheet) é suficiente e evita introduzir uma nova convenção de breakpoints paralela.
- **Refatorar os 6 componentes de gráfico para eliminar duplicação de código (`ChartJS.register`, skeleton, empty-state)** — fora do escopo; cada componente já segue o mesmo padrão estabelecido nas Fases 3/4, e uma refatoração de abstração não foi pedida nem é necessária para os dois objetivos desta fase.
- **Alterar altura do contêiner (`h-64`) por breakpoint** — a pesquisa confirma que o Chart.js precisa de uma altura explícita e que isso já está correto; variar a altura por breakpoint adicionaria complexidade sem ganho de legibilidade claro (o ganho vem de fonte/ticks, não de altura).
- **Componentes sem chart.js** (`birth-mode-medication-list.tsx`, `birth-mode-membrane-rupture-summary.tsx`) — já são listas simples com `divide-y`, responsivas por natureza (texto que quebra linha, sem eixo/legenda); não fazem parte do polimento de gráfico desta fase.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e validável de forma independente.

### Task 1: CREATE `apps/web/src/hooks/use-media-query.ts`

- **ACTION**: CREATE hook de viewport compartilhado
- **IMPLEMENT**: `useMediaQuery(query: string): boolean` via `useSyncExternalStore` + `window.matchMedia`; `useIsCompactViewport(): boolean` como conveniência para `(max-width: 639px)` (mesmo breakpoint 640px documentado em `CLAUDE.md:60`)
- **MIRROR**: estilo simples de hook único-propósito em `apps/web/src/hooks/use-scroll-direction.ts`
- **GOTCHA**: `getServerSnapshot` deve retornar `false` (não lançar erro em SSR) — Next.js renderiza este componente no servidor primeiro; seguir o mesmo padrão de "fallback estável até montar" já usado em `primaryColor` (`useState<string | null>(null)` + `useEffect`) nos componentes de gráfico
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/lib/birth-mode-chart-utils.ts`

- **ACTION**: ADD função pura `computeContractionsPer10Min`
- **IMPLEMENT**: `export function computeContractionsPer10Min(contractionEvents: { id: string; occurredAt: string }[]): Map<string, number>` — espera a lista já ordenada cronologicamente (mesma responsabilidade do chamador, igual ao `contractionRows` em `get-birth-mode-timeline-action.ts`); usa a mesma janela deslizante de 10 minutos
- **MIRROR**: `apps/web/src/actions/get-birth-mode-timeline-action.ts:99-111` — copiar o algoritmo exatamente, adaptando `row.measured_at`/`row.id` para `event.occurredAt`/`event.id`
- **IMPORTS**: nenhum novo — arquivo já não depende de nada além do tipo `BirthModeTimelineEvent`
- **GOTCHA**: a assinatura aceita `{ id: string; occurredAt: string }[]` (não `BirthModeTimelineEvent[]` completo) para deixar explícito que a função não olha `payload`/`type` — o chamador é responsável por filtrar e ordenar antes de chamar
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/screens/birth-mode-screen.tsx`

- **ACTION**: ESTENDER `onNewEvent` (linhas 61-63) para recalcular `contractions_per_10min` quando o evento inserido é do tipo `contraction`
- **IMPLEMENT**:
  ```typescript
  const onNewEvent = useCallback((event: BirthModeTimelineEvent) => {
    setEvents((prev) => {
      if (prev.some((e) => e.id === event.id)) return prev;
      const next = [...prev, event];
      if (event.type !== "contraction") return next;

      const contractionEvents = next
        .filter((e) => e.type === "contraction")
        .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
      const frequencyById = computeContractionsPer10Min(contractionEvents);

      return next.map((e) =>
        e.type === "contraction"
          ? { ...e, payload: { ...e.payload, contractions_per_10min: frequencyById.get(e.id) ?? null } }
          : e,
      );
    });
  }, []);
  ```
- **MIRROR**: `apps/web/src/screens/birth-mode-screen.tsx:61-63` (callback existente a substituir)
- **IMPORTS**: `import { computeContractionsPer10Min } from "@/lib/birth-mode-chart-utils";`
- **GOTCHA**: recalcular para TODOS os eventos de contração no array (não só o novo) — inserções fora de ordem cronológica (raro, mas possível com latência de rede) exigem reprocessar a janela deslizante inteira; o custo é desprezível (lista de contrações de um parto é pequena)
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx`

- **ACTION**: Aplicar `useIsCompactViewport` nas `options` do gráfico
- **IMPLEMENT**: importar e chamar `const isCompact = useIsCompactViewport();`; ajustar `plugins.legend.labels.font.size: isCompact ? 9 : 10`; adicionar `scales.x.ticks: { maxTicksLimit: isCompact ? 4 : 8, maxRotation: 0 }`; adicionar `relative` e `min-w-0` na `className` do `<div className="h-64">` → `<div className="relative h-64 min-w-0">`
- **MIRROR**: bloco `options` existente em `birth-mode-dilation-station-chart.tsx:145-176`
- **IMPORTS**: `import { useIsCompactViewport } from "@/hooks/use-media-query";`
- **GOTCHA**: `useIsCompactViewport()` deve ser chamado no nível superior do componente, antes dos `if (primaryColor === null)`/`if (t0 === null)` early returns, para respeitar as regras de hooks do React
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/components/shared/birth-mode-fetal-heart-rate-chart.tsx`

- **ACTION**: Mesmo padrão de Task 4
- **MIRROR**: Task 4 aplicada a este arquivo (mesma estrutura de `options`/wrapper)
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/components/shared/birth-mode-contraction-chart.tsx`

- **ACTION**: Mesmo padrão de Task 4 (o fix de `contractions_per_10min` da Task 3 já resolve os dados; esta task cobre só o polimento visual deste componente)
- **MIRROR**: Task 4 aplicada a este arquivo
- **VALIDATE**: `pnpm check-types`

### Task 7: UPDATE `apps/web/src/components/shared/birth-mode-oxytocin-chart.tsx`

- **ACTION**: Mesmo padrão de Task 4
- **MIRROR**: Task 4 aplicada a este arquivo
- **VALIDATE**: `pnpm check-types`

### Task 8: UPDATE `apps/web/src/components/shared/birth-mode-maternal-vitals-chart.tsx`

- **ACTION**: Mesmo padrão de Task 4 — aplicar apenas ao gráfico `<Line>` (linhas 130-168); a lista de temperatura abaixo (linhas 169-183) não usa chart.js e não muda
- **MIRROR**: Task 4 aplicada a este arquivo
- **VALIDATE**: `pnpm check-types`

### Task 9: UPDATE `apps/web/src/components/shared/birth-mode-urine-test-chart.tsx`

- **ACTION**: Mesmo padrão de Task 4
- **MIRROR**: Task 4 aplicada a este arquivo
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

Não há testes automatizados para nenhum componente/hook/action de modo parto hoje (`find` por `*birth-mode*.test.*`/`*.spec.*` não retornou resultados) — consistente com o padrão do repositório para esta feature. Esta fase não introduz um framework de teste novo; a validação é manual (Level 5/6 abaixo), seguindo a mesma prática das Fases 1-4.

### Edge Cases Checklist

- [ ] Duas contrações inseridas em rápida sucessão via tempo real (ex: equipe corrige um registro logo após o outro) — `contractions_per_10min` deve refletir a janela correta para ambas
- [ ] Evento de contração chega fora de ordem cronológica (latência de rede) — recálculo usa `sort` por `occurredAt`, não pela ordem de chegada
- [ ] Nenhuma contração registrada ainda — `computeContractionsPer10Min([])` retorna `Map` vazio, sem erro
- [ ] Viewport exatamente em 640px (limite do breakpoint) — `useIsCompactViewport` não deve oscilar (usar `matchMedia`, não uma leitura pontual de `window.innerWidth`)
- [ ] Rotação de orientação do celular (retrato → paisagem) com o Partograma aberto — `useSyncExternalStore` + `matchMedia` `change` event deve atualizar sem reload manual
- [ ] Gráfico com 0 ou 1 ponto de dados em viewport compacto — `maxTicksLimit: 4` não deve causar eixo vazio/quebrado

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros

### Level 2: LINT

```bash
npx biome lint --write --unsafe apps/web/src/hooks/use-media-query.ts apps/web/src/lib/birth-mode-chart-utils.ts apps/web/src/screens/birth-mode-screen.tsx apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx apps/web/src/components/shared/birth-mode-fetal-heart-rate-chart.tsx apps/web/src/components/shared/birth-mode-contraction-chart.tsx apps/web/src/components/shared/birth-mode-oxytocin-chart.tsx apps/web/src/components/shared/birth-mode-maternal-vitals-chart.tsx apps/web/src/components/shared/birth-mode-urine-test-chart.tsx
```
**EXPECT**: Sem warnings de ordenação de classes/imports não resolvidos

### Level 5: BROWSER_VALIDATION

Usar Browser MCP (ou navegador manual) para verificar:
- [ ] Abrir uma gestação em Modo Parto ativo → aba "Partograma" → registrar uma nova contração via modal → confirmar que o ponto de frequência aparece no `BirthModeContractionChart` sem reload, e que a Linha do tempo mostra o sufixo "Nx/10min" no novo evento
- [ ] Redimensionar a janela do navegador (ou DevTools device toolbar) cruzando 640px → confirmar que a legenda/ticks dos 6 gráficos mudam de tamanho sem quebrar o layout ou disparar erro no console
- [ ] Em viewport de celular (< 640px), confirmar que os rótulos do eixo X não se sobrepõem em nenhum dos 6 gráficos com dados de exemplo

### Level 6: MANUAL_VALIDATION

1. Ativar Modo Parto em uma gestação de teste
2. Abrir a tela em duas abas do navegador lado a lado (simulando duas pessoas da equipe) — registrar uma contração em uma aba, confirmar atualização em tempo real na outra sem reload
3. Repetir para dois eventos de contração em sequência rápida (< 2s de diferença) e conferir que a frequência calculada é consistente com a mesma lógica do fetch completo (comparar com um reload manual após o teste)
4. Testar em um dispositivo móvel real ou emulado (não só redimensionar desktop) — orientação retrato e paisagem

---

## Acceptance Criteria

- [ ] Novo evento de contração via realtime atualiza `contractions_per_10min` no gráfico e na timeline sem reload
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma regressão visual nos 6 mini-gráficos em desktop (>= 640px) — comportamento idêntico ao atual
- [ ] Em telas < 640px, legenda e eixo X dos 6 mini-gráficos usam fonte/densidade de ticks reduzidas
- [ ] Nenhum novo pacote adicionado a `package.json`

---

## Completion Checklist

- [ ] Todas as 9 tasks completas em ordem de dependência
- [ ] Cada task validada com `pnpm check-types` imediatamente após a mudança
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 2: `biome lint --write --unsafe` sem warnings pendentes
- [ ] Level 5: Validação manual em navegador (realtime + responsivo) feita
- [ ] Level 6: Teste em dispositivo móvel real/emulado feito
- [ ] Todos os critérios de aceite atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Recalcular `contractions_per_10min` a cada inserção de contração pode ficar caro se um parto tiver centenas de contrações registradas | L | L | A lista de contrações de um único parto é tipicamente pequena (dezenas, não milhares); o mesmo algoritmo já roda a cada fetch completo em `getBirthModeTimelineAction` sem problema de performance reportado |
| `useSyncExternalStore` com `matchMedia` pode se comportar de forma inesperada em navegadores móveis mais antigos (Safari iOS mais antigo tem suporte parcial a `addEventListener` em `MediaQueryList`) | L | M | `matchMedia` e `MediaQueryList.addEventListener` são suportados desde iOS Safari 14+ (2020); risco aceito dado que é "melhor esforço" por decisão do stakeholder |
| Reduzir `maxTicksLimit` demais em telas compactas pode esconder pontos de dados importantes no eixo X | M | L | Valor escolhido (4 em compacto vs padrão do Chart.js de 11) é um ponto de partida; ajustável após revisão visual em Level 5/6 sem exigir mudança de arquitetura |

---

## Notes

- A investigação de codebase (Fase 2 deste plano) confirmou que a premissa original da Fase 5 do PRD ("realtime + polimento mobile/tablet") já está em grande parte implementada: `useBirthModeTimelineRealtime` já atualiza ambas as abas (Partograma e Linha do tempo) simultaneamente, sem gating por aba ativa e sem necessidade de refetch manual. O escopo real desta fase foi reduzido a um bug fix pontual (frequência de contração) e ao polimento responsivo, que era genuinamente greenfield.
- O breakpoint de 640px foi escolhido por já estar documentado em `CLAUDE.md` como convenção do projeto (`Dialog` desktop / `Sheet` mobile), evitando introduzir um segundo padrão de breakpoint no código.
- Suporte a `UPDATE`/`DELETE` em tempo real, layout multi-track denso e exportação PDF permanecem fora do escopo desta fase (ver PRD Fase 6 e decisões já registradas).

---

*Generated: 2026-08-22*
