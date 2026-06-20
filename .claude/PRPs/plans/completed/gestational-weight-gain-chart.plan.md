# Feature: Gráfico de Ganho de Peso Gestacional (CONMAI/IOM)

## Summary

Adicionar um componente `GestationalWeightGainChart`, estruturalmente análogo ao `UterineHeightChart` já existente, que plota o ganho de peso cumulativo da gestante (`weight_kg − initial_weight_kg`) por semana gestacional sobre uma banda de referência (faixa baixa/alta) escolhida automaticamente pela classificação de IMC pré-gestacional (`pregnancies.initial_bmi`). O usuário pode alternar entre as referências **CONMAI/MS 2022** (padrão) e **IOM 2009** via `Tabs`. O componente é inserido em `EvolutionsSection` (`prenatal-card.tsx`), **acima** do `UterineHeightChart` existente, na mesma coluna lateral de 360px.

## User Story

As a profissional de saúde (médico/enfermeiro obstetra) responsável pelo pré-natal
I want to ver visualmente se o ganho de peso cumulativo da gestante está dentro da faixa esperada para o IMC pré-gestacional dela
So that posso decidir rapidamente se preciso intervir (orientação nutricional, investigação adicional) sem calcular manualmente ou consultar a Caderneta da Gestante física

## Problem Statement

`pregnancy_evolutions.weight_kg` é registrado a cada consulta mas hoje só aparece como número solto no card de evolução, sem nenhuma comparação visual contra a faixa de ganho de peso esperada para o IMC pré-gestacional da paciente.

## Solution Statement

Novo Client Component `GestationalWeightGainChart` que renderiza um `<Line />` do `react-chartjs-2` com 3 datasets (limite superior da banda, limite inferior da banda com `fill: '-1'` para sombrear a área entre eles, e os pontos reais de ganho cumulativo da gestante). A banda exibida é selecionada a partir de duas tabelas estáticas (`CONMAI_BANDS`, `IOM_BANDS`), indexadas pela categoria de IMC (`baixo peso` / `eutrofia` / `sobrepeso` / `obesidade`), com toggle `Tabs` para alternar entre os dois padrões. Quando `initial_bmi` é `null`, o componente renderiza um estado vazio compacto em vez do gráfico.

## Metadata

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                     |
| Complexity       | LOW                                                                 |
| Systems Affected | `apps/web/src/components/shared` (frontend only, sem banco/action) |
| Dependencies     | `chart.js@^4.5.1`, `react-chartjs-2@^5.3.1` (já instalados), `@ventre/ui/tabs` (já existe) |
| Estimated Tasks  | 4                                                                   |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   EvolutionsSection — coluna lateral (lg:grid-cols-[1fr_360px])              ║
║                                                                               ║
║   ┌──────────────────────────┐   ┌─────────────────────────────┐            ║
║   │ Lista de evoluções        │   │ Altura Uterina (AU)         │            ║
║   │ (cards por consulta)      │   │ [gráfico P10/P50/P90]       │            ║
║   └──────────────────────────┘   └─────────────────────────────┘            ║
║                                                                               ║
║   USER_FLOW: profissional vê peso (ex: "68 kg") solto em cada card,          ║
║   sem comparação com faixa esperada; precisa calcular manualmente            ║
║   (peso atual − peso pré-gestacional) e consultar Caderneta física.          ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌──────────────────────────┐   ┌─────────────────────────────┐            ║
║   │ Lista de evoluções        │   │ Ganho de Peso Gestacional    │ ◄── NOVO  ║
║   │ (cards por consulta)      │   │ [CONMAI | IOM]  (tabs)       │            ║
║   │                            │   │ [gráfico banda + pontos]    │            ║
║   │                            │   ├─────────────────────────────┤            ║
║   │                            │   │ Altura Uterina (AU)         │            ║
║   │                            │   │ [gráfico P10/P50/P90]       │            ║
║   └──────────────────────────┘   └─────────────────────────────┘            ║
║                                                                               ║
║   USER_FLOW: profissional rola até EvolutionsSection, vê imediatamente       ║
║   se o ganho cumulativo de peso está dentro da banda esperada para o         ║
║   IMC pré-gestacional da paciente; pode alternar CONMAI/IOM com 1 clique.    ║
║   VALUE_ADD: avaliação visual em segundos, sem cálculo manual.               ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `EvolutionsSection` coluna lateral | Apenas `UterineHeightChart` | `GestationalWeightGainChart` acima de `UterineHeightChart` | Visualização imediata de adequação do ganho de peso |
| `initial_bmi` ausente | N/A | Estado vazio compacto ("IMC pré-gestacional não informado") | Evita gráfico enganoso sem bloquear renderização da seção |

---

## Mandatory Reading

**CRITICAL: ler estes arquivos antes de iniciar qualquer task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/components/shared/uterine-height-chart.tsx` | 1-212 | Padrão a ESPELHAR: registro ChartJS, cálculo de semana decimal, estrutura de datasets com `fill: '-1'`, leitura de cor via `getCssVar` em `useEffect`, options do `<Line />` |
| P0 | `prompts/009-gestational-weigth-gain.md` | 33-63 | Fonte numérica das bandas CONMAI (seção 4) e IOM (seção 3) — usar os valores exatamente como estão |
| P1 | `apps/web/src/components/shared/prenatal-card.tsx` | 63-95 | Tipo `PrenatalData` — `pregnancy.initial_weight_kg`/`initial_bmi` já tipados e buscados |
| P1 | `apps/web/src/components/shared/prenatal-card.tsx` | 537-562, 603-762, 1438-1446 | `EvolutionsSection`: assinatura de props, ponto de inserção exato (linha 760, antes de `<UterineHeightChart />`), e onde a section é chamada com `data.pregnancy` |
| P2 | `apps/web/src/actions/get-prenatal-card-action.ts` | 34-40 | Confirma que `initial_weight_kg`/`initial_bmi` já são buscados — nenhuma mudança de action necessária |
| P2 | `packages/ui/src/tabs.tsx` | 1-56 | API do `Tabs`/`TabsList`/`TabsTrigger` a usar no toggle CONMAI/IOM |

**External Documentation:** nenhuma necessária — toda a referência clínica está em `prompts/009-gestational-weigth-gain.md`, já fornecida pelo usuário com fontes oficiais (MS, FEBRASGO, IOM). `chart.js`/`react-chartjs-2` já estão em uso no padrão a espelhar, sem necessidade de pesquisa de API adicional.

---

## Patterns to Mirror

**CHARTJS_REGISTRATION:**
```typescript
// SOURCE: apps/web/src/components/shared/uterine-height-chart.tsx:1-16
"use client";

import type { Tables } from "@ventre/supabase";
import {
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);
```

**SSR_SAFE_COLOR_READ:**
```typescript
// SOURCE: apps/web/src/components/shared/uterine-height-chart.tsx:59-82
function getCssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function UterineHeightChart({ evolutions }: { evolutions: Evolution[] }) {
  const [primaryColor, setPrimaryColor] = useState<string | null>(null);

  useEffect(() => {
    setPrimaryColor(`hsl(${getCssVar("--primary")})`);
  }, []);

  if (primaryColor === null) {
    return (
      <div className="rounded-lg border p-4">
        <p className="mb-3 font-semibold text-sm">Altura Uterina (AU)</p>
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }
  // ...
```

**GESTATIONAL_WEEK_CALC + REAL_POINTS:**
```typescript
// SOURCE: apps/web/src/components/shared/uterine-height-chart.tsx:84-93
const realPoints = evolutions
  .filter(
    (ev): ev is Evolution & { uterine_height_cm: number; gestational_weeks: number } =>
      ev.uterine_height_cm != null && ev.gestational_weeks != null,
  )
  .map((ev) => ({
    x: ev.gestational_weeks + (ev.gestational_days ?? 0) / 7,
    y: ev.uterine_height_cm,
  }))
  .sort((a, b) => a.x - b.x);
```

**FILL_BAND_DATASET_ORDER (gotcha crítico):**
```typescript
// SOURCE: apps/web/src/components/shared/uterine-height-chart.tsx:95-170
// Ordem dos datasets é obrigatória: fill: '-1' referencia o dataset anterior
// por índice no array, não por nome.
const data = {
  datasets: [
    { /* dataset 0: linha superior da banda — sem fill */ },
    { /* dataset 1: linha inferior da banda — fill: '-1' sombra área entre 0 e 1 */ },
    { /* dataset 2: pontos reais */ },
  ],
};
```

**CHART_CONTAINER + OPTIONS:**
```typescript
// SOURCE: apps/web/src/components/shared/uterine-height-chart.tsx:173-211
return (
  <div className="rounded-lg border p-4">
    <p className="mb-3 font-semibold text-sm">Altura Uterina (AU)</p>
    <div className="h-64">
      <Line
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: "linear", min: 16, max: 41, title: { display: true, text: "Semanas" } },
            y: { min: Y_MIN, max: Y_MAX, title: { display: true, text: "AU (cm)" } },
          },
          plugins: {
            legend: { display: false, labels: { filter: (item) => Boolean(item.text) } },
            tooltip: { filter: (item) => item.dataset.label != null },
          },
        }}
      />
    </div>
  </div>
);
```

**TABS_TOGGLE:**
```typescript
// SOURCE: apps/web/src/screens/users-screen.tsx:19 (import) — API de packages/ui/src/tabs.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventre/ui/tabs";

<Tabs value={standard} onValueChange={(v) => setStandard(v as "conmai" | "iom")}>
  <TabsList>
    <TabsTrigger value="conmai">CONMAI</TabsTrigger>
    <TabsTrigger value="iom">IOM</TabsTrigger>
  </TabsList>
</Tabs>
```

**EMPTY_STATE_COMPACT (não usar `EmptyState` cheio — é genérico demais para um card de 360px):**
```typescript
// Estilo a seguir, mirando o chrome do próprio card (rounded-lg border p-4)
<div className="rounded-lg border p-4">
  <p className="mb-3 font-semibold text-sm">Ganho de Peso Gestacional</p>
  <div className="flex h-64 items-center justify-center text-center">
    <p className="max-w-[220px] text-muted-foreground text-xs">
      IMC pré-gestacional não informado. Preencha o peso e altura iniciais para ver este gráfico.
    </p>
  </div>
</div>
```

**INTEGRATION_POINT (prenatal-card.tsx):**
```typescript
// SOURCE: apps/web/src/components/shared/prenatal-card.tsx:537-549, 760, 1438-1446
// EvolutionsSection precisa de 2 novas props: initialWeightKg, initialBmi
function EvolutionsSection({
  pregnancyId,
  evolutions,
  dum,
  initialWeightKg,
  initialBmi,
  isEditable,
  onRefresh,
}: {
  pregnancyId: string;
  evolutions: PrenatalData["evolutions"];
  dum: string | null | undefined;
  initialWeightKg: number | null | undefined;
  initialBmi: number | null | undefined;
  isEditable: boolean;
  onRefresh: () => void;
}) {
  // ...
  <div className="space-y-4">
    <GestationalWeightGainChart
      evolutions={evolutions}
      initialWeightKg={initialWeightKg ?? null}
      initialBmi={initialBmi ?? null}
    />
    <UterineHeightChart evolutions={evolutions} />
  </div>
  // ...
}

// Call site (linha 1438-1446):
<EvolutionsSection
  pregnancyId={pregnancyId}
  evolutions={data.evolutions}
  dum={data.pregnancy?.dum}
  initialWeightKg={data.pregnancy?.initial_weight_kg}
  initialBmi={data.pregnancy?.initial_bmi}
  isEditable={isEditable}
  onRefresh={refresh}
/>
```

---

## Files to Change

| File                                                                  | Action | Justification                                                        |
| ----------------------------------------------------------------------| ------ | ---------------------------------------------------------------------|
| `apps/web/src/components/shared/gestational-weight-gain-chart.tsx`   | CREATE | Componente do gráfico + dados de referência CONMAI/IOM                |
| `apps/web/src/components/shared/prenatal-card.tsx`                   | UPDATE | Inserir componente acima de `UterineHeightChart`, passar novas props |

Nenhuma mudança de banco, action ou tipo gerado — `initial_weight_kg`/`initial_bmi` já são buscados por `get-prenatal-card-action.ts` e já estão tipados em `PrenatalData["pregnancy"]`.

---

## NOT Building (Scope Limits)

- Curvas para gestação múltipla/alto risco — sem referência oficial aplicável.
- Visualização para a própria paciente — fora do contexto do profissional.
- Edição manual das faixas de referência — valores hardcoded, como no `uterine-height-chart.tsx`.
- Persistência de preferência de padrão (CONMAI/IOM) entre sessões — toggle é estado local do componente (`useState`), reavalia para CONMAI a cada nova montagem. Decisão tomada por falta de evidência de necessidade — pode ser revisitada se usuários pedirem.
- Novos campos de banco ou mudanças na action `getPrenatalCardAction` — todos os dados necessários já existem e já são buscados.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e validável independentemente.

### Task 1: CREATE `apps/web/src/components/shared/gestational-weight-gain-chart.tsx` — dados de referência

- **ACTION**: CREATE arquivo com as constantes de referência CONMAI e IOM
- **IMPLEMENT**:
  ```typescript
  type BmiCategory = "low" | "normal" | "overweight" | "obese";

  function classifyBmi(bmi: number): BmiCategory {
    if (bmi < 18.5) return "low";
    if (bmi < 25.0) return "normal";
    if (bmi < 30.0) return "overweight";
    return "obese";
  }

  type BandPoint = { week: number; low: number; high: number };

  // Fonte: CONMAI/UFRJ, adotada pelo MS em ago/2022 — Caderneta da Gestante 6ª ed.
  // (prompts/009-gestational-weigth-gain.md, seção 4). Ganho cumulativo por trimestre.
  // Ponto week:0 é assumido (0,0) — não há ganho antes da concepção.
  const CONMAI_BANDS: Record<BmiCategory, BandPoint[]> = {
    low: [
      { week: 0, low: 0, high: 0 },
      { week: 13, low: 0.2, high: 1.2 },
      { week: 27, low: 5.6, high: 7.2 },
      { week: 40, low: 9.7, high: 12.2 },
    ],
    normal: [
      { week: 0, low: 0, high: 0 },
      { week: 13, low: -1.8, high: 0.7 },
      { week: 27, low: 3.1, high: 6.3 },
      { week: 40, low: 8.0, high: 12.0 },
    ],
    overweight: [
      { week: 0, low: 0, high: 0 },
      { week: 13, low: -1.6, high: -0.05 },
      { week: 27, low: 2.3, high: 3.7 },
      { week: 40, low: 7.0, high: 9.0 },
    ],
    obese: [
      { week: 0, low: 0, high: 0 },
      { week: 13, low: -1.6, high: 0.05 },
      { week: 27, low: 1.1, high: 2.7 },
      { week: 40, low: 5.0, high: 7.2 },
    ],
  };

  // Fonte: IOM 2009 (prompts/009-gestational-weigth-gain.md, seção 3) — apenas
  // ganho total recomendado (gestação única), sem pontos por trimestre.
  // Interpolação linear de (0,0) até (40, total) — decisão documentada no
  // PRD (Technical Risks) como mitigação à ausência de pontos intermediários oficiais.
  const IOM_TOTALS: Record<BmiCategory, { low: number; high: number }> = {
    low: { low: 12.5, high: 18.0 },
    normal: { low: 11.5, high: 16.0 },
    overweight: { low: 7.0, high: 11.5 },
    obese: { low: 5.0, high: 9.0 },
  };

  const IOM_BANDS: Record<BmiCategory, BandPoint[]> = Object.fromEntries(
    (Object.keys(IOM_TOTALS) as BmiCategory[]).map((category) => [
      category,
      [
        { week: 0, low: 0, high: 0 },
        { week: 40, low: IOM_TOTALS[category].low, high: IOM_TOTALS[category].high },
      ],
    ]),
  ) as Record<BmiCategory, BandPoint[]>;
  ```
- **MIRROR**: `uterine-height-chart.tsx:18-54` — constante de referência clínica fixa, comentário citando a fonte
- **GOTCHA**: Os valores de `CONMAI_BANDS` e `IOM_TOTALS` devem bater **exatamente** com as tabelas das seções 3 e 4 de `prompts/009-gestational-weigth-gain.md` — checagem ponto a ponto na Task 4 (validação visual)
- **VALIDATE**: `pnpm check-types` (arquivo ainda não exportado/usado, deve compilar isoladamente sem erros de sintaxe)

### Task 2: UPDATE `apps/web/src/components/shared/gestational-weight-gain-chart.tsx` — componente do gráfico

- **ACTION**: ADD componente `GestationalWeightGainChart` no mesmo arquivo, após as constantes da Task 1
- **IMPLEMENT**:
  ```typescript
  "use client";

  import type { Tables } from "@ventre/supabase";
  import { Tabs, TabsList, TabsTrigger } from "@ventre/ui/tabs";
  import {
    Chart as ChartJS,
    Filler,
    Legend,
    LineElement,
    LinearScale,
    PointElement,
    Tooltip,
  } from "chart.js";
  import { useEffect, useState } from "react";
  import { Line } from "react-chartjs-2";

  ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);

  // ... (constantes da Task 1 aqui) ...

  const Y_MIN = -3;
  const Y_MAX = 19;

  function getCssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  type Evolution = Pick<
    Tables<"pregnancy_evolutions">,
    "weight_kg" | "gestational_weeks" | "gestational_days"
  >;

  type Standard = "conmai" | "iom";

  export function GestationalWeightGainChart({
    evolutions,
    initialWeightKg,
    initialBmi,
  }: {
    evolutions: Evolution[];
    initialWeightKg: number | null;
    initialBmi: number | null;
  }) {
    const [primaryColor, setPrimaryColor] = useState<string | null>(null);
    const [standard, setStandard] = useState<Standard>("conmai");

    useEffect(() => {
      setPrimaryColor(`hsl(${getCssVar("--primary")})`);
    }, []);

    if (initialBmi == null) {
      return (
        <div className="rounded-lg border p-4">
          <p className="mb-3 font-semibold text-sm">Ganho de Peso Gestacional</p>
          <div className="flex h-64 items-center justify-center text-center">
            <p className="max-w-[220px] text-muted-foreground text-xs">
              IMC pré-gestacional não informado. Preencha o peso e altura iniciais para ver
              este gráfico.
            </p>
          </div>
        </div>
      );
    }

    if (primaryColor === null) {
      return (
        <div className="rounded-lg border p-4">
          <p className="mb-3 font-semibold text-sm">Ganho de Peso Gestacional</p>
          <div className="h-64 animate-pulse rounded-lg bg-muted" />
        </div>
      );
    }

    const category = classifyBmi(initialBmi);
    const band = (standard === "conmai" ? CONMAI_BANDS : IOM_BANDS)[category];

    const realPoints =
      initialWeightKg == null
        ? []
        : evolutions
            .filter(
              (ev): ev is Evolution & { weight_kg: number; gestational_weeks: number } =>
                ev.weight_kg != null && ev.gestational_weeks != null,
            )
            .map((ev) => ({
              x: ev.gestational_weeks + (ev.gestational_days ?? 0) / 7,
              y: ev.weight_kg - initialWeightKg,
            }))
            .sort((a, b) => a.x - b.x);

    // Ordem dos datasets é obrigatória: fill: '-1' referencia o dataset anterior
    // por índice, não por nome. [limite superior, limite inferior (fill), pontos reais].
    const data = {
      datasets: [
        {
          label: "Limite superior",
          data: band.map((p) => ({ x: p.week, y: p.high })),
          borderColor: "rgba(34, 197, 94, 0.6)",
          borderWidth: 1,
          fill: false,
          tension: 0.2,
          pointRadius: 0,
        },
        {
          label: "Limite inferior",
          data: band.map((p) => ({ x: p.week, y: p.low })),
          borderColor: "rgba(34, 197, 94, 0.6)",
          backgroundColor: "rgba(34, 197, 94, 0.12)",
          borderWidth: 1,
          fill: "-1" as const,
          tension: 0.2,
          pointRadius: 0,
        },
        {
          label: "Gestante",
          data: realPoints,
          borderColor: primaryColor,
          backgroundColor: primaryColor,
          pointStyle: "circle" as const,
          pointRadius: 4,
          spanGaps: false,
        },
      ],
    };

    return (
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold text-sm">Ganho de Peso Gestacional</p>
          <Tabs value={standard} onValueChange={(v) => setStandard(v as Standard)}>
            <TabsList className="h-7">
              <TabsTrigger value="conmai" className="px-2 py-0.5 text-xs">
                CONMAI
              </TabsTrigger>
              <TabsTrigger value="iom" className="px-2 py-0.5 text-xs">
                IOM
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="h-64">
          <Line
            data={data}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: {
                  type: "linear",
                  min: 0,
                  max: 41,
                  title: { display: true, text: "Semanas" },
                },
                y: {
                  min: Y_MIN,
                  max: Y_MAX,
                  title: { display: true, text: "Ganho (kg)" },
                },
              },
              plugins: {
                legend: { display: false },
                tooltip: { filter: (item) => item.dataset.label != null },
              },
            }}
          />
        </div>
      </div>
    );
  }
  ```
- **MIRROR**: `uterine-height-chart.tsx:68-211` — estrutura completa do componente (loading state, cálculo de pontos, datasets, `<Line />`)
- **IMPORTS**: `@ventre/supabase` (`Tables`), `@ventre/ui/tabs` (`Tabs`, `TabsList`, `TabsTrigger`), `chart.js`, `react-chartjs-2`
- **GOTCHA 1**: `ChartJS.register(...)` deve ser chamado uma vez no escopo do módulo — copiar exatamente como em `uterine-height-chart.tsx:16` (não duplicar registro se algum dia os dois componentes forem unificados em um arquivo, mas por ora cada arquivo registra independentemente, igual ao padrão existente)
- **GOTCHA 2**: Ordem dos datasets no array `data.datasets` é significativa para `fill: '-1'` — limite superior **antes** do inferior
- **GOTCHA 3**: Tratar `initialBmi == null` **antes** do estado de loading (`primaryColor === null`), para que o estado vazio não pisque um skeleton antes de aparecer — confirmar que a ordem das duas verificações early-return no código acima está correta
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/components/shared/prenatal-card.tsx` — integração

- **ACTION**: MODIFY `EvolutionsSection` para aceitar `initialWeightKg`/`initialBmi` e renderizar o novo componente acima de `UterineHeightChart`; MODIFY o call site para passar os novos props
- **IMPLEMENT**:
  1. Adicionar import: `import { GestationalWeightGainChart } from "@/components/shared/gestational-weight-gain-chart";` (junto aos demais imports de `@/components/shared`, perto da linha 9)
  2. Atualizar assinatura de `EvolutionsSection` (linha 537-549) adicionando `initialWeightKg` e `initialBmi` aos parâmetros e ao type inline de props
  3. Na linha 760, envolver a coluna lateral existente em um wrapper vertical e inserir o novo componente:
     ```tsx
     <div className="space-y-4">
       <GestationalWeightGainChart
         evolutions={evolutions}
         initialWeightKg={initialWeightKg ?? null}
         initialBmi={initialBmi ?? null}
       />
       <UterineHeightChart evolutions={evolutions} />
     </div>
     ```
  4. No call site (linha 1438-1446), adicionar `initialWeightKg={data.pregnancy?.initial_weight_kg}` e `initialBmi={data.pregnancy?.initial_bmi}`
- **MIRROR**: `prenatal-card.tsx:1420-1426` (`ObstetricHistorySection` já recebe `pregnancy={data.pregnancy}` inteiro) — alternativa mais simples seria passar `pregnancy: PrenatalData["pregnancy"]` ao invés de 2 campos soltos; **decisão**: manter 2 props explícitas (`initialWeightKg`, `initialBmi`) para não acoplar `EvolutionsSection` ao tipo inteiro de `pregnancy` quando só 2 campos são necessários — consistente com o padrão já usado para `dum` (também extraído individualmente de `data.pregnancy?.dum` na linha 1442)
- **GOTCHA**: `data.pregnancy` pode ser `null` (paciente sem gestação ativa) — usar optional chaining `data.pregnancy?.initial_weight_kg` como já é feito para `dum`
- **VALIDATE**: `pnpm check-types && npx biome check apps/web/src/components/shared/prenatal-card.tsx apps/web/src/components/shared/gestational-weight-gain-chart.tsx`

### Task 4: VALIDAÇÃO — conferência visual contra a referência oficial

- **ACTION**: Validação manual, sem mudança de código (a menos que divergências sejam encontradas)
- **IMPLEMENT**: Iniciar dev server, abrir uma ficha de gestante com evoluções cadastradas e `initial_bmi` preenchido, conferir:
  - Os 4 valores de `week: 13/27/40` de cada categoria CONMAI batem 1:1 com a tabela da seção 4 de `prompts/009-gestational-weigth-gain.md`
  - Os totais IOM (`IOM_TOTALS`) batem 1:1 com a tabela da seção 3
  - Para cada uma das 4 categorias de IMC (testar com pacientes/gestações de teste ou alterando `initial_bmi` manualmente via Supabase Studio em ambiente local), o gráfico troca de banda corretamente
  - Toggle CONMAI/IOM funciona sem reload da página
  - Estado vazio aparece quando `initial_bmi` é `null`
- **GOTCHA**: Se alguma divergência visual for encontrada na interpolação linear da banda IOM, documentar a decisão consciente (já pré-aprovada como mitigação no PRD) em vez de tentar achar pontos intermediários não-oficiais
- **VALIDATE**: Checklist manual acima, sem comando automatizado

---

## Testing Strategy

Não há suíte de testes automatizados de componentes neste projeto (confirmado pelo padrão do `uterine-height-chart.tsx`, que também não tem testes unitários). Validação é via `pnpm check-types` + Biome + verificação manual no browser, replicando exatamente a estratégia usada na feature irmã (`uterine-height-growth-chart.plan.md`, já completa).

### Edge Cases Checklist

- [ ] `initial_bmi` é `null` → estado vazio compacto, sem quebrar layout
- [ ] `initial_weight_kg` é `null` mas `initial_bmi` não é (caso teoricamente improvável já que IMC depende do peso, mas defensivo) → `realPoints` fica vazio, banda ainda renderiza
- [ ] `evolutions` vazio → banda renderiza sozinha, sem pontos
- [ ] Evolução com `weight_kg` preenchido mas `gestational_weeks` nulo → excluída de `realPoints` (mesmo padrão do `uterine-height-chart`)
- [ ] IMC exatamente nos limites de categoria (18.5, 25.0, 30.0) → `classifyBmi` usa `<` (não `<=`) consistente com a tabela da seção 1 do documento de referência
- [ ] Ganho de peso negativo no 1º trimestre (perda fisiológica) → `Y_MIN = -3` acomoda valores negativos sem cortar o gráfico

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome check apps/web/src/components/shared/gestational-weight-gain-chart.tsx apps/web/src/components/shared/prenatal-card.tsx
```

**EXPECT**: Exit 0, sem erros de tipo ou lint

### Level 2: BROWSER_VALIDATION (manual)

Iniciar o dev server (`pnpm dev`), navegar até uma ficha de gestante com evoluções cadastradas e `initial_bmi` preenchido, e verificar:

- [ ] Gráfico de ganho de peso renderiza acima do gráfico de altura uterina, sem erros no console (sem hydration mismatch)
- [ ] Banda de referência (verde, sombreada) visível, com pontos reais da gestante posicionados corretamente
- [ ] Toggle CONMAI/IOM troca a banda exibida instantaneamente
- [ ] Paciente/gestação sem `initial_bmi` mostra estado vazio em vez de gráfico quebrado
- [ ] Responsivo: coluna lateral em viewport ≥ 1024px, empilhado abaixo da lista em viewport menor (mesmo comportamento do `UterineHeightChart`)

### Level 3: VISUAL_REFERENCE_CHECK (manual, Task 4)

Conferência ponto a ponto dos valores `CONMAI_BANDS`/`IOM_TOTALS` contra `prompts/009-gestational-weigth-gain.md` seções 3 e 4, para as 4 categorias de IMC.

---

## Acceptance Criteria

- [ ] Gráfico plota ganho de peso cumulativo (`weight_kg − initial_weight_kg`) por semana gestacional decimal
- [ ] Banda de referência selecionada automaticamente pela classificação de `initial_bmi` (baixo peso/eutrofia/sobrepeso/obesidade)
- [ ] CONMAI é o padrão exibido por default; toggle alterna para IOM
- [ ] Estado vazio claro quando `initial_bmi` é `null`
- [ ] Posicionado acima do `UterineHeightChart`, na mesma coluna lateral de `EvolutionsSection`
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma mudança de banco, action ou tipo gerado introduzida (escopo confirmado pelo PRD)
- [ ] Valores das bandas conferem 1:1 com `prompts/009-gestational-weigth-gain.md` (Task 4)

---

## Completion Checklist

- [ ] Task 1 completa e validada (`pnpm check-types`)
- [ ] Task 2 completa e validada (`pnpm check-types`)
- [ ] Task 3 completa e validada (`pnpm check-types` + biome)
- [ ] Task 4 completa (conferência visual ponto a ponto, sem divergências não-documentadas)
- [ ] Level 1: Static analysis (type-check + biome) passa
- [ ] Level 2: Validação manual no browser passa (todos os itens do checklist)
- [ ] Level 3: Bandas conferem com a tabela de referência oficial
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Interpolação linear da banda IOM (apenas total, sem pontos por trimestre) diverge visualmente da banda CONMAI (3 pontos) | M | L | Documentado como decisão consciente na Task 1; validado na Task 4 contra a tabela oficial |
| `initial_bmi` ausente em pacientes legadas | M | M | Estado vazio explícito implementado na Task 2 (não esconde a seção, não quebra layout) |
| Gestação múltipla sem flag clara no schema | L | L | Fora de escopo (confirmado no PRD) — CONMAI/IOM assumem gestação única; nenhuma verificação de gemelaridade implementada nesta fase |
| Mudança de assinatura de `EvolutionsSection` quebra outro caller | L | M | `EvolutionsSection` só é chamada em um lugar (`prenatal-card.tsx:1439`), confirmado via grep na Task 3 |

---

## Notes

- Este plano cobre as 4 fases descritas no PRD (`gestational-weight-gain-chart.prd.md`) como um único PR/sessão de implementação, seguindo o mesmo padrão usado na feature irmã `uterine-height-growth-chart.plan.md` (também tratada como uma única entrega, não 4 PRs separados) — justificado pela complexidade LOW e forte acoplamento sequencial entre as fases (dados → componente → integração → validação).
- Decisões tomadas para as Open Questions do PRD, documentadas aqui por serem necessárias para a implementação:
  1. **IMC ausente**: estado vazio compacto (não esconde, não bloqueia) — ver Task 2.
  2. **Persistência do toggle**: estado local (`useState`), não persiste entre sessões — ver "NOT Building".
  3. **Interpolação IOM**: linear de `(0, 0)` até `(40, total)`, conforme proposto no próprio PRD como mitigação de risco — ver Task 1.
- Ao concluir, atualizar a tabela de fases do PRD (`gestational-weight-gain-chart.prd.md`) marcando as 4 fases como `complete` e movendo o PRD/plano para a pasta `completed/`, no mesmo padrão de `uterine-height-growth-chart`.
