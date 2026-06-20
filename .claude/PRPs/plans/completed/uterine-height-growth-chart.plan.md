# Feature: Gráfico de Altura Uterina (AU) na EvolutionsSection

## Summary

Adicionar um gráfico de linha (Chart.js via `react-chartjs-2`) que plota a curva de crescimento da altura uterina (AU) da gestante contra as faixas de referência P10/P50/P90 do INTERGROWTH-21st, posicionado em uma coluna lateral ao lado da lista de evoluções em `EvolutionsSection` (dentro de `prenatal-card.tsx`). Um novo componente client-only `UterineHeightChart` encapsula o gráfico; a tabela de referência é uma constante estática hardcoded no componente.

## User Story

As a profissional de saúde (médico/enfermeiro) preenchendo o pré-natal
I want to ver visualmente a curva de AU da gestante sobreposta às faixas de normalidade P10–P90
So that posso identificar rapidamente, sem precisar memorizar valores de referência, se o crescimento uterino está dentro do esperado para a idade gestacional

## Problem Statement

Os valores de `uterine_height_cm` hoje só aparecem como números soltos em cada card de evolução. Não há comparação visual contra a faixa de normalidade clínica (P10–P90), exigindo que o profissional memorize a tabela ou consulte a Caderneta da Gestante física.

## Solution Statement

Novo Client Component `UterineHeightChart` que renderiza um `<Line />` do `react-chartjs-2` com 6 datasets: 2 datasets auxiliares invisíveis (topo/base fixos, para sombrear fora da faixa), P90, Mediana (P50), P10, e os valores reais da gestante. É renderizado em uma segunda coluna de um grid `lg:grid-cols-[1fr_360px]` dentro de `EvolutionsSection`, ao lado da lista de cards de evolução existente (que permanece intacta).

## Metadata

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                     |
| Complexity       | LOW                                                                 |
| Systems Affected | `apps/web/src/components/shared` (frontend only, sem banco/action) |
| Dependencies     | `chart.js@^4.5.1`, `react-chartjs-2@^5.3.1` (já instalados)         |
| Estimated Tasks  | 3                                                                   |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════╗
║                          BEFORE STATE                              ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║   EvolutionsSection (single column, space-y-3)                    ║
║   ┌──────────────────────────────────────────┐                    ║
║   │ 12/03/2026  [28s3d]            ✏️  🗑️    │                    ║
║   │ Peso 68kg │ PA 110/70 │ AU 27cm │ BCF 140 │                    ║
║   └──────────────────────────────────────────┘                    ║
║   ┌──────────────────────────────────────────┐                    ║
║   │ 26/02/2026  [25s1d]            ✏️  🗑️    │                    ║
║   │ Peso 66kg │ PA 108/68 │ AU 24cm │ BCF 138 │                    ║
║   └──────────────────────────────────────────┘                    ║
║                                                                    ║
║   USER_FLOW: rola a lista, lê o número "AU 27cm" de cada card      ║
║   PAIN_POINT: precisa lembrar de cabeça se 27cm é normal p/ 28s    ║
║   DATA_FLOW: evolutions[] → cards empilhados, sem agregação visual ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   EvolutionsSection (grid lg:grid-cols-[1fr_360px])                           ║
║   ┌──────────────────────────────────────────┐  ┌───────────────────────────┐ ║
║   │ 12/03/2026  [28s3d]            ✏️  🗑️    │  │  AU (cm)         ___ P90  │ ║
║   │ Peso 68kg │ PA 110/70 │ AU 27cm │ BCF 140 │  │ 40┤▒▒▒▒░░░░░░    ___ P50  │ ║
║   └──────────────────────────────────────────┘  │   │    ╱●        ___ Real │ ║
║   ┌──────────────────────────────────────────┐  │ 25┤  ╱●                  │ ║
║   │ 26/02/2026  [25s1d]            ✏️  🗑️    │  │   │▒▒▒▒░░░░░░             │ ║
║   │ Peso 66kg │ PA 108/68 │ AU 24cm │ BCF 138 │  │ 10┴──────────────────    │ ║
║   └──────────────────────────────────────────┘  │     16    28    41 (sem) │ ║
║                                                   └───────────────────────────┘ ║
║                                                                                ║
║   USER_FLOW: olha o gráfico lateral, vê os pontos da gestante na faixa azul/  ║
║              dentro das bandas vermelhas (normal) sem precisar calcular nada  ║
║   VALUE_ADD: leitura visual instantânea de crescimento normal/anormal         ║
║   DATA_FLOW: evolutions[].{uterine_height_cm, gestational_weeks,              ║
║              gestational_days} → pontos (x=semana+dias/7, y=cm) plotados      ║
║              sobre curva INTERGROWTH-21st estática                            ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                                              | Before                       | After                                                     | User Impact                                          |
| ------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `EvolutionsSection` (`prenatal-card.tsx:574-777`)     | Lista única, sem coluna lateral | Grid 2 colunas (`lg:`) com gráfico ao lado da lista        | Comparação visual instantânea com faixa de normalidade |
| `apps/web/src/components/shared/uterine-height-chart.tsx` | Não existe                   | Novo componente client renderizando `<Line />` do Chart.js | -                                                      |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File                                                                 | Lines   | Why Read This                                                                 |
| -------- | --------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------------- |
| P0       | `apps/web/src/components/shared/trimester-semi-chart.tsx`           | 1-125   | Padrão EXATO a seguir: `"use client"`, `ChartJS.register`, `getCssVar` em `useEffect`, evitar SSR mismatch |
| P0       | `apps/web/src/components/shared/prenatal-card.tsx`                  | 536-777 | `EvolutionsSection` completo — onde inserir o grid e o novo componente            |
| P1       | `apps/web/src/components/shared/prenatal-card.tsx`                  | 62-94   | Shape de `PrenatalData["evolutions"]` (tipo a importar/derivar)                   |
| P1       | `apps/web/app/globals.css`                                          | 14-29, 62-77 | Variáveis CSS de tema (`--primary`, `--destructive`) — light e dark mode      |
| P2       | `apps/web/src/components/shared/empty-state.tsx`                    | 1-20    | Não usado diretamente aqui (gráfico sempre renderiza), mas confirma padrão de ícones |
| P2       | `prompts/008-AU-data.md`                                            | 19-48   | Tabela oficial INTERGROWTH-21st (fonte dos dados hardcoded, semanas 16-41)       |

**External Documentation:**

| Source                                                                                                  | Section                  | Why Needed                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| [Chart.js v4 — Filler plugin](https://www.chartjs.org/docs/4.5.1/charts/area.html#filling-modes)        | Filling modes (`'-1'`, `'origin'`) | Necessário para sombrear "acima do P90" e "abaixo do P10" com datasets auxiliares relativos |
| [Chart.js v4 — Line dataset properties](https://www.chartjs.org/docs/4.5.1/charts/line.html#dataset-properties) | `spanGaps`, `pointRadius`, `tension` | Controla como a linha de valores reais NÃO interpola onde faltam pontos (`spanGaps: false`) |
| [react-chartjs-2 v5 docs](https://react-chartjs-2.js.org/)                                              | `<Line />` component       | Confirma API de props (`data`, `options`) — já em uso em `trimester-semi-chart.tsx` (via `<Doughnut />`, mesma lib) |

---

## Patterns to Mirror

**CLIENT_COMPONENT_SSR_SAFE_COLOR:**

```typescript
// SOURCE: apps/web/src/components/shared/trimester-semi-chart.tsx:16-29
function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function TrimesterSemiChart({ trimesterCounts, total }: Props) {
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    setColors([
      `hsl(${getCssVar("--chart-1")})`,
      `hsl(${getCssVar("--chart-2")})`,
      `hsl(${getCssVar("--chart-3")})`,
    ]);
  }, []);
  // ...
  if (colors.length === 0) {
    return ( /* skeleton fallback enquanto cor não foi lida no client */ );
  }
```

**CHARTJS_REGISTER_PATTERN:**

```typescript
// SOURCE: apps/web/src/components/shared/trimester-semi-chart.tsx:5-9
import { ArcElement, Chart as ChartJS, DoughnutController, Tooltip } from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, DoughnutController, Tooltip);
// Para o novo componente, registrar: LineElement, PointElement, LinearScale,
// CategoryScale (ou LinearScale no X, ver Task 1), Tooltip, Legend, Filler
```

**EVOLUTIONS_SECTION_LAYOUT (onde inserir o grid):**

```tsx
// SOURCE: apps/web/src/components/shared/prenatal-card.tsx:615-756
// Estrutura atual (sem grid):
) : (
  <div className="space-y-3">
    {evolutions.map((ev) => (
      <div key={ev.id} className="overflow-hidden rounded-lg border">
        {/* ... */}
      </div>
    ))}
  </div>
)}
```

**PRENATAL_DATA_EVOLUTIONS_TYPE:**

```typescript
// SOURCE: apps/web/src/components/shared/prenatal-card.tsx:87-89
evolutions: (Tables<"pregnancy_evolutions"> & {
  created_by_user: Pick<Tables<"users">, "name" | "avatar_url"> | null;
})[];
// Campos relevantes ao gráfico: uterine_height_cm, gestational_weeks, gestational_days
// (todos number | null — ver packages/supabase/src/types/database.types.ts para a tabela pregnancy_evolutions)
```

**SKELETON_FALLBACK_PATTERN (enquanto cor primária não foi lida):**

```tsx
// SOURCE: apps/web/src/components/shared/trimester-semi-chart.tsx:39-50
if (colors.length === 0) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gestantes por Trimestre</CardTitle>
      </CardHeader>
      <CardContent className="h-full">
        <div className="h-full animate-pulse rounded-lg bg-muted" />
      </CardContent>
    </Card>
  );
}
```

---

## Files to Change

| File                                                              | Action | Justification                                                                 |
| -------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------- |
| `apps/web/src/components/shared/uterine-height-chart.tsx`        | CREATE | Novo componente do gráfico, com tabela INTERGROWTH-21st hardcoded                 |
| `apps/web/src/components/shared/prenatal-card.tsx`                | UPDATE | Importar `UterineHeightChart`, envolver a lista de evoluções em grid 2 colunas    |

---

## NOT Building (Scope Limits)

- Cálculo de IG via DUM como fallback quando `gestational_weeks` é nulo — usar apenas dado já registrado em cada evolução (fora de escopo conforme PRD).
- Tabela de referência configurável/editável pelo usuário — é uma constante clínica fixa no componente.
- Exportar/imprimir o gráfico isoladamente.
- Alertas automáticos (toast, badge, etc.) quando um ponto cai fora da faixa P10–P90 — nesta versão é puramente visual.
- Migração de banco, nova server action, ou novos tipos — todos os dados já chegam via `getPrenatalCardAction`.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e validável independentemente.

### Task 1: CREATE `apps/web/src/components/shared/uterine-height-chart.tsx`

- **ACTION**: CREATE novo Client Component
- **IMPLEMENT**:
  1. `"use client"` no topo.
  2. Constante estática `AU_REFERENCE: { week: number; p10: number; p50: number; p90: number }[]` com os 26 pontos (semanas 16–41) da tabela em `prompts/008-AU-data.md:19-48` (valores com `.` decimal, ex: `14.0` não `14,0`).
  3. Registrar Chart.js: `ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, Filler)`. Usar `LinearScale` para o eixo X (não `CategoryScale`) porque os pontos reais usam valores fracionários (`semana + dias/7`) que precisam ser plotados numericamente, não como categorias discretas — os datasets de referência (`AU_REFERENCE`) e os de valores reais devem usar pares `{x, y}` em vez de arrays paralelos `labels`/`data`.
  4. `getCssVar` local (mesma função de `trimester-semi-chart.tsx:16-18`) + `useEffect` que seta `primaryColor` via `hsl(${getCssVar("--primary")})`. Cores fixas (não dependem de tema): vermelho `rgba(239, 68, 68, 0.8)` para P90/P10, vermelho `rgba(239, 68, 68, 0.2)` para fill, azul `rgba(59, 130, 246, 0.8)` para Mediana.
  5. Enquanto `primaryColor` não foi lido (`useState<string | null>(null)`), renderizar skeleton (mirror do padrão em `trimester-semi-chart.tsx:39-50`, sem `Card`/`CardHeader` — ver Task 1 nota de layout abaixo).
  6. Props: `{ evolutions: PrenatalData["evolutions"] }` (reusar o tipo já exportado/local de `prenatal-card.tsx` — se não exportado, declarar tipo local equivalente apenas com os 3 campos usados: `Pick<Tables<"pregnancy_evolutions">, "uterine_height_cm" | "gestational_weeks" | "gestational_days">[]`).
  7. Transformar `evolutions` em pontos reais: `evolutions.filter(ev => ev.uterine_height_cm != null && ev.gestational_weeks != null).map(ev => ({ x: ev.gestational_weeks! + (ev.gestational_days ?? 0) / 7, y: ev.uterine_height_cm! }))`, ordenado por `x` ascendente (a query já vem ordenada por `consultation_date`, mas ordenar por `x` explicitamente evita linha "voltando no tempo" se IG e data divergirem).
  8. 6 datasets no `<Line />` (ordem importa para os `fill` relativos):
     - `topo` (auxiliar invisível, y constante = 45 em todos os pontos de `AU_REFERENCE`): `borderWidth: 0, pointRadius: 0`, sem entrada de legenda.
     - `p90`: `data: AU_REFERENCE.map(r => ({x: r.week, y: r.p90}))`, `borderColor` vermelho 80%, `fill: '-1'` (preenche entre `topo` e `p90`), `tension: 0.4`, `pointRadius: 0`.
     - `p50`: `borderColor` azul 80%, sem `fill`, `tension: 0.4`, `pointRadius: 0`.
     - `p10`: `borderColor` vermelho 80%, `fill: false` (não preenche aqui — ver `base` abaixo), `tension: 0.4`, `pointRadius: 0`.
     - `base` (auxiliar invisível, y constante = 10): `borderWidth: 0, pointRadius: 0`, `fill: '-1'` (preenche entre `p10` e `base`), sem legenda.
     - `real`: `data` = pontos reais computados no passo 7, `borderColor: primaryColor`, `backgroundColor: primaryColor`, `pointStyle: 'circle'`, `pointRadius: 4`, `spanGaps: false` (não interpola onde não há dado — como os pontos já vêm filtrados sem `null`, isso preserva o comportamento descrito no PRD de "conectar apenas os pontos existentes").
  9. `options`: `scales.x` tipo `linear`, `min: 16, max: 41`, `title: { display: true, text: 'Semanas' }`; `scales.y`: `min: 10, max: 45`, `title: { display: true, text: 'AU (cm)' }`; `plugins.legend`: filtrar datasets auxiliares (`topo`/`base`) via `labels.filter: (item) => item.text !== undefined` combinado com `label: undefined` nesses dois datasets (Chart.js omite da legenda datasets sem `label`); `plugins.tooltip.filter`: excluir datasets `topo`/`base` dos tooltips (`(item) => item.dataset.label != null`).
  10. Wrapper: `<div className="rounded-lg border p-4">` com um título `<p className="mb-3 font-semibold text-sm">Altura Uterina (AU)</p>` acima do `<Line />`, mirror do estilo dos cards de evolução (`rounded-lg border`), não usar `Card`/`CardHeader` do shadcn (que tem padding/título maiores demais para um painel lateral compacto).
- **MIRROR**: `apps/web/src/components/shared/trimester-semi-chart.tsx:1-125` (estrutura geral: imports, `getCssVar`, `useEffect`, registro Chart.js, skeleton fallback)
- **IMPORTS**:
  ```ts
  "use client";
  import {
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
  } from "chart.js";
  import { useEffect, useState } from "react";
  import { Line } from "react-chartjs-2";
  import type { Tables } from "@ventre/supabase";
  ```
  (Nota: `CategoryScale` não é necessária se o eixo X for `linear` — confirmar e remover do import/register se não usada, para não acionar `noUnusedImports` do Biome.)
- **GOTCHA**: Chart.js `fill: '-1'` é relativo ao **índice do dataset anterior na array `datasets`**, não ao nome — a ordem `[topo, p90, p50, p10, base, real]` é obrigatória para os fills funcionarem como descrito no PRD (linhas 61-64 do PRD).
- **GOTCHA**: usar `LinearScale` (não `CategoryScale`) no eixo X é necessário porque os pontos reais têm valores fracionários (`28 + 3/7 ≈ 28.43`) — com `CategoryScale` esses pontos cairiam fora das categorias inteiras da tabela de referência.
- **GOTCHA**: `ev.uterine_height_cm` e `ev.gestational_weeks` no tipo gerado do Supabase são `number | null` — o `!` non-null assertion no passo 7 é seguro porque já filtrado por `!= null` na mesma expressão (`filter` antes do `map`), mas se preferir, usar narrowing explícito (`if (ev.uterine_height_cm == null || ev.gestational_weeks == null) return null` + `filter(Boolean)`) para evitar `!` sem comentário, conforme regra `~/.claude/rules/typescript.md` ("Não use `!` sem comentário explicando por que é seguro").
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/components/shared/prenatal-card.tsx` — importar e renderizar `UterineHeightChart`

- **ACTION**: ADD import + ADD grid wrapper dentro de `EvolutionsSection`
- **IMPLEMENT**:
  1. Adicionar import (ordem alfabética junto aos outros imports de `@/components/shared`, perto da linha 8):
     ```ts
     import { UterineHeightChart } from "@/components/shared/uterine-height-chart";
     ```
  2. Em `EvolutionsSection` (linha 615-756), envolver o `<div className="space-y-3">` existente (lista de cards) em um grid de 2 colunas, mantendo a lista exatamente como está, e adicionar `<UterineHeightChart evolutions={evolutions} />` como segunda coluna:
     ```tsx
     ) : (
       <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
         <div className="space-y-3">
           {evolutions.map((ev) => (
             /* ... conteúdo existente sem alteração ... */
           ))}
         </div>
         <UterineHeightChart evolutions={evolutions} />
       </div>
     )}
     ```
  3. **Não alterar** o branch `evolutions.length === 0` (linha 602-614) — `EmptyState` continua sem o gráfico quando não há evoluções (a PRD define empty-state apenas para "sem `uterine_height_cm`/`gestational_weeks`", que é tratado dentro do próprio `UterineHeightChart`, não aqui).
- **MIRROR**: PRD linhas 37-42 (estrutura de grid exata fornecida na spec)
- **GOTCHA**: `evolutions` passado para `UterineHeightChart` é o array completo (incluindo entradas sem `uterine_height_cm`/`gestational_weeks`) — a filtragem para os pontos reais acontece dentro do componente (Task 1, passo 7), não aqui.
- **VALIDATE**: `pnpm check-types`

### Task 3: VALIDATE biome/lint e revisão visual manual

- **ACTION**: RUN lint fix + smoke test manual no browser
- **IMPLEMENT**: Rodar `npx biome lint --write --unsafe apps/web/src/components/shared/uterine-height-chart.tsx apps/web/src/components/shared/prenatal-card.tsx` para corrigir ordenação de classes Tailwind/imports. Abrir uma ficha de gestante com evoluções cadastradas (algumas com `gestational_weeks` preenchido, idealmente uma fora da faixa P10-P90 para validar visualmente o sombreamento) e uma sem nenhuma evolução com IG preenchida, conferindo: (a) curvas de referência aparecem nos dois casos, (b) linha real aparece apenas quando há dados, (c) responsivo — coluna lateral em desktop, empilhado abaixo da lista em mobile (`< 1024px`), (d) sem warning de hydration mismatch no console do browser.
- **MIRROR**: N/A (validação manual)
- **VALIDATE**: `pnpm check-types && npx biome check apps/web/src/components/shared/uterine-height-chart.tsx apps/web/src/components/shared/prenatal-card.tsx`

---

## Testing Strategy

Este projeto não possui suíte de testes automatizados de componentes configurada para `apps/web` (verificar `apps/web/package.json` — sem `vitest`/`jest`/`testing-library` nos scripts atuais). A validação é manual + type-check, conforme Task 3.

### Edge Cases Checklist

- [ ] Nenhuma evolução tem `uterine_height_cm` E `gestational_weeks` simultaneamente preenchidos → curvas de referência renderizam sozinhas, sem linha "real"
- [ ] `gestational_weeks` fora do range 16–41 (ex.: evolução de 1º trimestre, semana 10) → ponto correspondente é descartado do dataset real (fora do domínio da tabela de referência) ou plotado fora da área visível do eixo X sem quebrar o gráfico (eixo X fixo em `min: 16, max: 41` — Chart.js simplesmente não desenha pontos fora do range, não lança erro)
- [ ] `gestational_days` ausente (`null`) mas `gestational_weeks` presente → ponto usa `dias/7 = 0` (semana cheia)
- [ ] Lista com uma única evolução válida → linha "real" com 1 ponto único (sem linha conectando, apenas o círculo)
- [ ] Mobile (`< 1024px`) → grid empilha verticalmente (gráfico abaixo da lista), sem overflow horizontal
- [ ] Dark mode → cor `primaryColor` (lida via `--primary`) reflete a paleta dark corretamente (linha 62 de `globals.css`); cores vermelho/azul fixas permanecem legíveis em ambos os temas

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome check apps/web/src/components/shared/uterine-height-chart.tsx apps/web/src/components/shared/prenatal-card.tsx
```

**EXPECT**: Exit 0, sem erros de tipo ou lint

### Level 2: BROWSER_VALIDATION (manual)

Iniciar o dev server (`pnpm dev` na raiz ou dentro de `apps/web`), navegar até uma ficha de gestante com evoluções cadastradas (`app/(dashboard)/...` rota de pacientes → aba pré-natal), e verificar:

- [ ] Gráfico renderiza sem erros no console (sem hydration mismatch)
- [ ] 3 curvas de referência visíveis com cores/transparências corretas (P90/P10 vermelho 80%, fill 20% acima/abaixo, mediana azul 80%)
- [ ] Pontos reais da gestante aparecem como círculos na cor primária, posicionados corretamente por semana gestacional
- [ ] Responsivo: coluna lateral em viewport ≥ 1024px, empilhado abaixo da lista em viewport menor

---

## Acceptance Criteria

- [ ] Gráfico renderiza as 3 curvas de referência (P10/P50/P90) com cores e preenchimento conforme PRD
- [ ] Pontos reais da gestante aparecem corretamente posicionados por semana gestacional (`gestational_weeks + gestational_days/7`)
- [ ] Layout responsivo: coluna lateral (`lg:`) em desktop, empilhado em mobile
- [ ] Sem erros de SSR/hydration mismatch (cor primária lida via `getCssVar` em `useEffect`, igual ao padrão `trimester-semi-chart.tsx`)
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma mudança de banco, action ou tipo introduzida (conforme escopo do PRD)

---

## Completion Checklist

- [ ] Task 1 completa e validada (`pnpm check-types`)
- [ ] Task 2 completa e validada (`pnpm check-types`)
- [ ] Task 3 completa (lint + validação manual no browser)
- [ ] Level 1: Static analysis (type-check + biome) passa
- [ ] Level 2: Validação manual no browser passa (todos os itens do checklist)
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk                                                                                     | Likelihood | Impact | Mitigation                                                                                                   |
| ------------------------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| `fill: '-1'` relativo a índice de dataset quebra se a ordem do array `datasets` mudar      | MEDIUM     | MEDIUM | Manter comentário explícito no código sobre a ordem obrigatória `[topo, p90, p50, p10, base, real]`         |
| Eixo X com `LinearScale` + pontos `{x, y}` é menos comum no codebase (só há exemplo `Doughnut`) | LOW        | MEDIUM | Seguir doc oficial Chart.js linkada na seção de pesquisa externa; testar visualmente antes de finalizar     |
| Tabela `AU_REFERENCE` digitada manualmente pode conter erro de transcrição (vírgula→ponto) | MEDIUM     | HIGH   | Conferir cada linha contra `prompts/008-AU-data.md:23-48` na implementação; validar visualmente que a curva P50 é suave/monotônica crescente |
| Legenda/tooltip mostrando os datasets auxiliares `topo`/`base` por engano                  | LOW        | LOW    | `label: undefined` nesses datasets + filtro explícito em `plugins.legend.labels.filter` e `plugins.tooltip.filter` (Task 1, passo 9) |

---

## Notes

- A tabela `AU_REFERENCE` é dado clínico estático (não vem do banco) — está correto hardcodá-la no componente, conforme decisão explícita do PRD.
- O componente não usa `Card`/`CardHeader` do shadcn (diferente de `trimester-semi-chart.tsx`) porque vai inline dentro de uma seção já existente (`EvolutionsSection`), não como card isolado de dashboard — usa o mesmo `rounded-lg border` que os cards de evolução ao lado, para consistência visual dentro da seção.
- Fora de escopo (replicado do PRD): cálculo de IG via DUM, tabela configurável, exportação/impressão isolada, alertas automáticos fora da faixa P10–P90.
