# Feature: Mini-gráficos das demais tracks do Partograma

## Summary

Completar o partograma visual preenchendo os 7 mini-gráficos placeholder ainda pendentes em `BirthModePartograph` (BCF, contrações, ocitocina, medicações, bolsa rota/líquido amniótico, vitais maternos, urina), reaproveitando o padrão de chart.js estabelecido nas Fases 2/3 (`Line` com escala linear em horas, sem adaptador de tempo novo) e introduzindo dois componentes não-gráficos (lista de eventos discretos) para os tracks que são categóricos por natureza (medicações e bolsa rota), onde forçar um chart.js numérico seria artificial.

## User Story

As a profissional da equipe de cuidado (enfermagem obstétrica/obstetra) em modo parto
I want to ver BCF, contrações, ocitocina, medicações, bolsa rota, vitais maternos e urina plotados nas mini-sessões já existentes
So that eu tenha o partograma clínico completo, sem precisar consultar a Linha do tempo para nenhum desses dados

## Problem Statement

Hoje 7 das 8 mini-sessões do partograma (`BirthModePartograph`) mostram apenas o placeholder "Gráfico em breve" com uma contagem de registros — só a sessão de Dilatação/Estação (Fase 3) tem um gráfico real. A equipe não consegue ler visualmente a progressão de BCF, contrações, ocitocina, medicações, bolsa rota, vitais ou urina.

## Solution Statement

Criar um util compartilhado de tempo (`birth-mode-chart-utils.ts`) extraindo a lógica de `t0`/`hoursSince` já implementada em `birth-mode-dilation-station-chart.tsx` (Fase 3), e reutilizá-la em 5 novos componentes de gráfico numérico (BCF, contrações, ocitocina, vitais maternos, urina) seguindo o padrão `Line` de `chart.js` já estabelecido. Para os 2 tracks puramente categóricos (medicações não-ocitocina, bolsa rota — este último de cardinalidade "single"), criar componentes de lista/resumo simples (sem chart.js), já que forçar um eixo numérico neles não teria valor clínico. Substituir os placeholders correspondentes em `BirthModePartograph`.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                          |
| Complexity       | HIGH                                                                    |
| Systems Affected | `apps/web/src/components/shared/` (7 novos arquivos + 1 util + 1 update) |
| Dependencies     | `chart.js@^4.5.1`, `react-chartjs-2@^5.3.1` (já em uso, nenhuma lib nova) |
| Estimated Tasks  | 9                                                                       |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║   Aba "Partograma"                                                              ║
║   ┌────────────────────────────────────────────────────────────────────────┐   ║
║   │ Card: Dilatação Cervical & Estação Fetal → gráfico real (Fase 3)         │   ║
║   ├────────────────────────────────────────────────────────────────────────┤   ║
║   │ Card: BCF               → "Gráfico em breve" + "N registros aguardando" │   ║
║   │ Card: Contrações        → "Gráfico em breve" + "N registros aguardando" │   ║
║   │ Card: Ocitocina         → "Gráfico em breve" + "N registros aguardando" │   ║
║   │ Card: Medicações        → "Gráfico em breve" + "N registros aguardando" │   ║
║   │ Card: Bolsa Rota & LA   → "Gráfico em breve" + "N registros aguardando" │   ║
║   │ Card: Vitais Maternos   → "Gráfico em breve" + "N registros aguardando" │   ║
║   │ Card: Urina             → "Gráfico em breve" + "N registros aguardando" │   ║
║   └────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                  ║
║   USER_FLOW: Equipe abre "Partograma", vê a dilatação/estação plotada, mas      ║
║   para os outros 7 tracks só vê uma contagem — precisa ir na "Linha do tempo"   ║
║   para entender os valores reais.                                              ║
║   PAIN_POINT: Progressão de BCF, contrações, ocitocina, vitais e urina não é    ║
║   visualmente legível; medicações/bolsa rota não têm nem resumo estruturado.    ║
║                                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║   Aba "Partograma"                                                              ║
║   ┌────────────────────────────────────────────────────────────────────────┐   ║
║   │ Card: Dilatação/Estação → gráfico real (inalterado, Fase 3)              │   ║
║   ├────────────────────────────────────────────────────────────────────────┤   ║
║   │ Card: BCF               → BirthModeFetalHeartRateChart (linha + faixa   │   ║
║   │                            normal 110-160bpm sombreada)                 │   ║
║   │ Card: Contrações        → BirthModeContractionChart (frequência/10min   │   ║
║   │                            + duração, eixo duplo)                       │   ║
║   │ Card: Ocitocina         → BirthModeOxytocinChart (concentração U/L +    │   ║
║   │                            gotejamento gtt/min, eixo duplo)             │   ║
║   │ Card: Medicações        → BirthModeMedicationList (lista cronológica    │   ║
║   │                            compacta: ícone + tipo + hora)               │   ║
║   │ Card: Bolsa Rota & LA   → BirthModeMembraneRuptureSummary (resumo       │   ║
║   │                            único: tipo + líquido + hora)                │   ║
║   │ Card: Vitais Maternos   → BirthModeMaternalVitalsChart (PA sistólica/   │   ║
║   │                            diastólica + pulso, eixo duplo; temperatura  │   ║
║   │                            em lista abaixo do gráfico)                  │   ║
║   │ Card: Urina             → BirthModeUrineTestChart (volume_ml em linha;  │   ║
║   │                            proteína/cetonúria em lista abaixo)          │   ║
║   └────────────────────────────────────────────────────────────────────────┘   ║
║                                                                                  ║
║   USER_FLOW: Equipe abre "Partograma" e lê todos os 8 tracks clínicos           ║
║   diretamente nos mini-gráficos, sem precisar ir na Linha do tempo.             ║
║   VALUE_ADD: Partograma completo em tela conforme o modelo de referência,       ║
║   pronto para a Fase 5 (tempo real + polimento mobile/tablet).                  ║
║   DATA_FLOW: events[] (já carregado por getBirthModeTimelineAction, Fase 1) →   ║
║     BirthModePartograph → filtra por session.eventTypes → cada componente de    ║
║     gráfico/lista recebe só os eventos relevantes e calcula seus próprios       ║
║     pontos/série.                                                               ║
║                                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                        | Before                                  | After                                                        | User Impact                                              |
| -------------------------------- | ------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| Card "BCF"                      | Placeholder + contagem                    | Gráfico de linha (bpm x horas, faixa normal sombreada)            | Lê tendência de BCF sem abrir a Linha do tempo               |
| Card "Contrações"                | Placeholder + contagem                    | Gráfico duplo-eixo (frequência/10min + duração em segundos)       | Lê padrão de contrações (frequência crescente, etc.)          |
| Card "Ocitocina"                 | Placeholder + contagem                    | Gráfico duplo-eixo (concentração U/L + gotejamento gtt/min)        | Acompanha titulação de ocitocina ao longo do tempo            |
| Card "Medicações"                | Placeholder + contagem                    | Lista cronológica compacta (ícone + tipo + hora)                  | Vê rapidamente quais medicamentos (exceto ocitocina) já foram dados |
| Card "Bolsa Rota & Líquido Amniótico" | Placeholder + contagem               | Resumo único (tipo de ruptura + líquido + hora)                   | Vê o status da bolsa em um único cartão, sem lista            |
| Card "Vitais Maternos"           | Placeholder + contagem                    | Gráfico duplo-eixo (PA sist./diast. + pulso) + lista de temperatura | Acompanha tendência de PA/pulso; vê temperatura pontual        |
| Card "Urina"                     | Placeholder + contagem                    | Gráfico de linha (volume_ml) + lista de proteína/cetonúria         | Acompanha volume urinário; vê alterações de dipstick pontuais |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File                                                                     | Lines   | Why Read This                                                                 |
| -------- | --------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------- |
| P0       | `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx`     | all     | O ARQUÉTIPO desta fase — `t0`/`hoursSince`, estrutura de dataset, eixo duplo, dashed lines, empty/loading states. Todo novo gráfico deve mirror este arquivo |
| P0       | `apps/web/src/components/shared/birth-mode-partograph.tsx`                 | all     | Arquivo a modificar — entender `BIRTH_PARTOGRAPH_SESSIONS` e o `.map()` de renderização |
| P0       | `apps/web/src/components/shared/birth-mode-timeline.tsx`                   | 1-119   | Payload shapes reais de cada `BirthModeTimelineEvent.type` (contraction, medication, membrane_rupture, maternal_vitals, urine_test) |
| P1       | `apps/web/src/lib/birth-mode-constants.ts`                                 | 1-97    | `BIRTH_EVENT_CONFIG` (ícones/cores), label maps (`BIRTH_MEDICATION_TYPE_LABELS`, `BIRTH_URINE_DIPSTICK_LABELS`, etc.) a reaproveitar |
| P1       | `apps/web/src/components/shared/gestational-weight-gain-chart.tsx`         | all     | Padrão alternativo de eixo único com banda sombreada (útil para a faixa normal de BCF) |
| P2       | `apps/web/src/actions/get-birth-mode-timeline-action.ts`                   | 108-260 | Confirma payload exato de cada evento (fonte de verdade, mais completo que o describeEvent) |
| P2       | `packages/ui/src/card.tsx`                                                 | 1-56    | `Card`/`CardContent` já em uso — nenhuma mudança necessária, apenas contexto     |

**External Documentation:**

Nenhuma pesquisa externa necessária — mesma justificativa da Fase 3: `chart.js`/`react-chartjs-2` já são dependências, e o padrão de eixo linear (sem adaptador de tempo) já está validado em produção nesta fase anterior.

---

## Patterns to Mirror

**SHARED_TIME_UTIL (a extrair nesta fase, Task 1):**

```typescript
// SOURCE: apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx
// (lógica hoje inline, será extraída para lib/birth-mode-chart-utils.ts)
const t0Candidates = [
  startEvent?.occurredAt,
  ...dilationEvents.map((event) => event.occurredAt),
  ...stationEvents.map((event) => event.occurredAt),
].filter((value): value is string => value != null);

const t0 = Math.min(...t0Candidates.map((iso) => new Date(iso).getTime()));
const hoursSince = (iso: string) => (new Date(iso).getTime() - t0) / (1000 * 60 * 60);
```

**DUAL_AXIS_CHART_PATTERN:**

```tsx
// SOURCE: apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx
// COPY THIS PATTERN (estrutura completa do componente, incluindo loading/empty state,
// getCssVar para cor primária, ChartJS.register, datasets com yAxisID diferentes,
// options.scales.y / options.scales.y1 com position:"right" e grid.drawOnChartArea:false):
"use client";

import { Chart as ChartJS, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";

ChartJS.register(LineElement, PointElement, LinearScale, Tooltip, Legend, Filler);
// ... getCssVar, empty-state check, hoursSince, datasets[], <Line data={...} options={{ scales: { x, y, y1 } }} />
```

**BANDED_REFERENCE_RANGE (para faixa normal de BCF):**

```tsx
// SOURCE: apps/web/src/components/shared/uterine-height-chart.tsx:97-140
// Datasets "invisíveis" (borderWidth: 0) usados só para ancorar fill: "-1" e
// desenhar uma faixa sombreada de referência (aqui: P10-P90). Reaproveitar a
// MESMA técnica para a faixa normal de BCF (110-160bpm), com pontos fixos
// (não dependentes do tempo) — reference band constante ao longo de todo o
// eixo x, para (x=0, y=110/160) e (x=maxX, y=110/160).
```

**EVENT_LIST_PATTERN (para tracks categóricos — Medicações e Bolsa Rota, novo nesta fase):**

```tsx
// SOURCE (estrutura de linha por evento): apps/web/src/components/shared/birth-mode-timeline.tsx:140-161
// Reaproveitar o padrão de ícone + texto + hora por linha, mas em versão compacta
// (sem borda externa, já que já está dentro de um Card da mini-sessão):
<div className="divide-y divide-border">
  {items.map((item) => (
    <div key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
      <span>{item.label}</span>
      <span className="whitespace-nowrap text-muted-foreground text-xs">
        {dayjs(item.occurredAt).format("HH:mm")}
      </span>
    </div>
  ))}
</div>
```

**PAYLOAD_CASTING_PATTERN:**

```typescript
// SOURCE: apps/web/src/components/shared/birth-mode-timeline.tsx:20-30, 85-98
// Payload é Record<string, unknown> — castar explicitamente por tipo de evento:
const { duration_seconds, effectiveness, contractions_per_10min } = event.payload as {
  duration_seconds: number;
  effectiveness: string | null;
  contractions_per_10min: number | null;
};
```

---

## Files to Change

| File                                                                            | Action | Justification                                                                   |
| ---------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `apps/web/src/lib/birth-mode-chart-utils.ts`                                       | CREATE | Extrai `t0`/`hoursSince` de `birth-mode-dilation-station-chart.tsx` para reuso nos 5 novos gráficos numéricos |
| `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx`             | UPDATE | Passa a importar `t0`/`hoursSince` do util compartilhado em vez de calcular inline (elimina duplicação) |
| `apps/web/src/components/shared/birth-mode-fetal-heart-rate-chart.tsx`             | CREATE | Mini-gráfico de BCF (bpm x horas, faixa normal sombreada 110-160bpm)              |
| `apps/web/src/components/shared/birth-mode-contraction-chart.tsx`                  | CREATE | Mini-gráfico de contrações (frequência/10min + duração, eixo duplo)               |
| `apps/web/src/components/shared/birth-mode-oxytocin-chart.tsx`                     | CREATE | Mini-gráfico de ocitocina (concentração U/L + gotejamento gtt/min, eixo duplo)     |
| `apps/web/src/components/shared/birth-mode-medication-list.tsx`                    | CREATE | Lista cronológica compacta de medicações (excluindo ocitocina)                    |
| `apps/web/src/components/shared/birth-mode-membrane-rupture-summary.tsx`           | CREATE | Resumo único de bolsa rota + líquido amniótico (cardinalidade single/multiple mista) |
| `apps/web/src/components/shared/birth-mode-maternal-vitals-chart.tsx`              | CREATE | Mini-gráfico de PA sistólica/diastólica + pulso (eixo duplo) + lista de temperatura |
| `apps/web/src/components/shared/birth-mode-urine-test-chart.tsx`                   | CREATE | Mini-gráfico de volume_ml (linha) + lista de proteína/cetonúria                   |
| `apps/web/src/components/shared/birth-mode-partograph.tsx`                        | UPDATE | Substitui os 7 placeholders restantes pelos componentes reais                     |

---

## NOT Building (Scope Limits)

- **Nenhuma extensão do realtime** (`useBirthModeTimelineRealtime`) — os gráficos recebem `events` já injetado pelo componente pai; atualização automática ao vivo é escopo da Fase 5.
- **Nenhum polimento responsivo dedicado além do já existente** (`h-64`, `Card` já responsivos) — melhor esforço de legibilidade mobile/tablet fica para a Fase 5.
- **Nenhuma linha de alerta/ação em outros tracks** — essas linhas são exclusivas do modelo clássico de dilatação/estação (Fase 3); os demais tracks (BCF, contrações, etc.) não têm equivalente no modelo de referência.
- **Nenhum eixo de tempo compartilhado sincronizado entre mini-gráficos** — cada mini-gráfico calcula seu próprio `t0`/janela de horas de forma independente (decisão já tomada na Fase 2: layout multi-track denso e sincronizado é exclusivo da exportação PDF, Fase 6).
- **Nenhuma normalização de vitais maternos em 3 eixos** — temperatura fica como lista simples abaixo do gráfico de PA/pulso, não como terceiro eixo do chart.js (ver Risks).

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: CREATE `apps/web/src/lib/birth-mode-chart-utils.ts`

- **ACTION**: CREATE util compartilhado, extraindo lógica de `birth-mode-dilation-station-chart.tsx`
- **IMPLEMENT**:
  ```typescript
  import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";

  export type ChartPoint = { x: number; y: number };

  export function resolveChartT0(events: BirthModeTimelineEvent[]): number | null {
    const startEvent = events.find((event) => event.type === "start_monitoring");
    const candidates = [startEvent?.occurredAt, ...events.map((event) => event.occurredAt)].filter(
      (value): value is string => value != null,
    );
    if (candidates.length === 0) return null;
    return Math.min(...candidates.map((iso) => new Date(iso).getTime()));
  }

  export function hoursSince(t0: number, iso: string): number {
    return (new Date(iso).getTime() - t0) / (1000 * 60 * 60);
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` (lógica hoje inline)
- **GOTCHA**: `resolveChartT0` recebe TODOS os eventos relevantes ao gráfico que a chamam (não só o tipo alvo) para que `start_monitoring` seja incluído — cada gráfico deve passar `events` (o array completo recebido de `BirthModePartograph`), não um array pré-filtrado.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx`

- **ACTION**: MODIFY para usar o util compartilhado em vez do cálculo inline
- **IMPLEMENT**: Substituir o bloco de `t0Candidates`/`t0`/`hoursSince` local por:
  ```typescript
  import { resolveChartT0, hoursSince as hoursSinceT0 } from "@/lib/birth-mode-chart-utils";
  // ...
  const t0 = resolveChartT0(events);
  if (t0 === null) { /* mesmo empty state de hoje */ }
  const hoursSince = (iso: string) => hoursSinceT0(t0, iso);
  ```
- **GOTCHA**: Manter exatamente o mesmo comportamento visual/numérico — este é um refactor puro, sem mudança de UX. Rodar `pnpm --filter web build` no final da fase para confirmar que a Fase 3 não regrediu.
- **VALIDATE**: `pnpm check-types`

### Task 3: CREATE `apps/web/src/components/shared/birth-mode-fetal-heart-rate-chart.tsx`

- **ACTION**: CREATE mini-gráfico de BCF
- **IMPLEMENT**:
  - Filtrar `events` por `type === "fetal_heart_rate"`, payload `{ bpm: number }`
  - `t0 = resolveChartT0(events)`; se `null`, mesmo empty state pattern da Fase 3 ("Nenhum registro de BCF ainda")
  - Dataset principal: pontos `{ x: hoursSince(t0, event.occurredAt), y: bpm }`, eixo único `y` (min 80, max 200 — cobre bradicardia/taquicardia extremas)
  - Faixa normal sombreada 110-160bpm: 2 datasets invisíveis (`borderWidth: 0`) em `y: 160` e `y: 110` com `fill: "-1"`, técnica idêntica a `UterineHeightChart` (P90/P95 bands), usando `x: [0, maxX]` (2 pontos, não por evento)
  - Título eixo x: "Horas desde o início"; eixo y: "BCF (bpm)"
- **MIRROR**: `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` (estrutura geral, loading/empty state), `apps/web/src/components/shared/uterine-height-chart.tsx:97-140` (técnica de banda sombreada com dataset invisível)
- **IMPORTS**:
  ```typescript
  import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
  import { resolveChartT0, hoursSince, type ChartPoint } from "@/lib/birth-mode-chart-utils";
  import { Chart as ChartJS, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
  import { useEffect, useState } from "react";
  import { Line } from "react-chartjs-2";
  ```
- **GOTCHA**: A faixa sombreada precisa de `maxX` calculado ANTES de montar os datasets (mesmo padrão do Task de dilatação: `Math.max(4, ...allX) + 1`, aqui sem alert/action line então basta `Math.max(1, ...pontosReais.map(p=>p.x)) + 1`).
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/components/shared/birth-mode-contraction-chart.tsx`

- **ACTION**: CREATE mini-gráfico de contrações
- **IMPLEMENT**:
  - Filtrar `events` por `type === "contraction"`, payload `{ duration_seconds: number; effectiveness: string | null; contractions_per_10min: number | null }`
  - Dataset 1 ("Frequência (contrações/10min)"): `y: contractions_per_10min ?? 0`, eixo `y` (min 0, max 6 — referência clínica de taquissistolia >5/10min)
  - Dataset 2 ("Duração (s)"): `y: duration_seconds`, eixo `y1` posição direita (min 0, max 120)
  - `spanGaps: false` em ambos; se `contractions_per_10min` for `null` (dado legado/derivação impossível), pular o ponto no dataset 1 em vez de plotar 0 (evita falso "sem contrações")
- **MIRROR**: `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` (eixo duplo `y`/`y1`)
- **GOTCHA**: `contractions_per_10min` já vem calculado pelo servidor (`get-birth-mode-timeline-action.ts:96-107`) — não recalcular no cliente.
- **VALIDATE**: `pnpm check-types`

### Task 5: CREATE `apps/web/src/components/shared/birth-mode-oxytocin-chart.tsx`

- **ACTION**: CREATE mini-gráfico de ocitocina
- **IMPLEMENT**:
  - Filtrar `events` por `type === "medication"` E `payload.medication_type === "ocitocina"`
  - Payload: `{ oxytocin_concentration_u_per_l: number | null; oxytocin_drip_rate_gtt_per_min: number | null }`
  - Dataset 1 ("Concentração (U/L)"): eixo `y` (min 0, max 20)
  - Dataset 2 ("Gotejamento (gtt/min)"): eixo `y1` (min 0, max 60)
  - Filtrar pontos onde o respectivo valor é `null` (nem todo registro de ocitocina necessariamente tem os dois campos preenchidos)
  - Se não houver nenhum evento de ocitocina, empty state: "Nenhum registro de ocitocina ainda"
- **MIRROR**: `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx`
- **GOTCHA**: O mesmo evento `medication` alimenta tanto este componente quanto `BirthModeMedicationList` (Task 6) — cada um filtra seu próprio subconjunto (`medication_type === "ocitocina"` vs `!== "ocitocina"`), sem necessidade de coordenação entre eles.
- **VALIDATE**: `pnpm check-types`

### Task 6: CREATE `apps/web/src/components/shared/birth-mode-medication-list.tsx`

- **ACTION**: CREATE lista cronológica compacta (SEM chart.js)
- **IMPLEMENT**:
  - Filtrar `events` por `type === "medication"` E `payload.medication_type !== "ocitocina"`
  - Ordenar por `occurredAt` ascendente
  - Renderizar `EVENT_LIST_PATTERN` (ver "Patterns to Mirror"): rótulo = `medication_type === "outros" && other_birth_medication_type ? other_birth_medication_type : BIRTH_MEDICATION_TYPE_LABELS[medication_type]` (mesma lógica de `birth-mode-timeline.tsx:59-62`), hora = `dayjs(occurredAt).format("HH:mm")`
  - Se lista vazia: `<p className="py-4 text-center text-muted-foreground text-xs">Nenhuma medicação (além de ocitocina) registrada ainda</p>`
- **MIRROR**: `apps/web/src/components/shared/birth-mode-timeline.tsx:47-70` (lógica de rótulo), `:140-161` (estrutura de linha)
- **IMPORTS**:
  ```typescript
  import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
  import { BIRTH_MEDICATION_TYPE_LABELS } from "@/lib/birth-mode-constants";
  import { dayjs } from "@/lib/dayjs";
  ```
- **GOTCHA**: Este componente NÃO usa `chart.js`/`resolveChartT0` — é puramente uma lista, não um gráfico de série temporal (decisão documentada em "NOT Building").
- **VALIDATE**: `pnpm check-types`

### Task 7: CREATE `apps/web/src/components/shared/birth-mode-membrane-rupture-summary.tsx`

- **ACTION**: CREATE resumo único (SEM chart.js) para bolsa rota + líquido amniótico
- **IMPLEMENT**:
  - Combinar dois tipos de evento: `membrane_rupture` (cardinalidade single, payload `{ rupture_type, fluid_type_at_rupture }`) e `amniotic_fluid` (cardinalidade multiple, payload `{ fluid_type }`) — ambos já fazem parte da mesma sessão (`eventTypes: ["membrane_rupture", "amniotic_fluid"]` em `birth-mode-partograph.tsx`)
  - Se houver evento `membrane_rupture`: renderizar um card de resumo com `BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS[rupture_type]`, líquido (`AMNIOTIC_FLUID_TYPE_LABELS[fluid_type_at_rupture]` se presente) e hora — mirror da lógica em `birth-mode-timeline.tsx:71-84`
  - Se houver eventos `amniotic_fluid` adicionais (reavaliações do líquido ao longo do tempo, já que este é `cardinality: "multiple"`), listar abaixo do resumo de ruptura usando o `EVENT_LIST_PATTERN`
  - Se não houver nenhum dos dois tipos de evento: `"Bolsa íntegra — nenhuma ruptura registrada ainda"`
- **MIRROR**: `apps/web/src/components/shared/birth-mode-timeline.tsx:43-46, 71-84`
- **IMPORTS**:
  ```typescript
  import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
  import { AMNIOTIC_FLUID_TYPE_LABELS, BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS } from "@/lib/birth-mode-constants";
  import { dayjs } from "@/lib/dayjs";
  ```
- **GOTCHA**: `membrane_rupture` é `cardinality: "single"` (`birth-mode-constants.ts:94`) — não iterar como lista para este tipo, tratar como no-máximo-um-registro.
- **VALIDATE**: `pnpm check-types`

### Task 8: CREATE `apps/web/src/components/shared/birth-mode-maternal-vitals-chart.tsx`

- **ACTION**: CREATE mini-gráfico de PA/pulso + lista de temperatura
- **IMPLEMENT**:
  - Filtrar `events` por `type === "maternal_vitals"`, payload `{ systolic_bp, diastolic_bp, pulse_bpm, temperature_celsius }` (todos `number | null`)
  - Gráfico (chart.js): Dataset "PA sistólica" e "PA diastólica" no eixo `y` (min 40, max 200 mmHg), pontos apenas onde o respectivo valor não é `null`; Dataset "Pulso (bpm)" no eixo `y1` (min 40, max 160)
  - Abaixo do gráfico: lista compacta (`EVENT_LIST_PATTERN`) só dos registros com `temperature_celsius != null`, formato `"{temperature_celsius}°C"` + hora
  - Empty state se nenhum evento: "Nenhum registro de vitais maternos ainda"
- **MIRROR**: `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` (eixo duplo), `apps/web/src/components/shared/birth-mode-timeline.tsx:85-98` (payload/labels de vitais)
- **GOTCHA**: Ver "Risks and Mitigations" — decisão explícita de NÃO adicionar um terceiro eixo `y2` para temperatura (chart.js suporta tecnicamente, mas a leitura visual de 3 eixos em um mini-gráfico pequeno (`h-64`) prejudicaria a legibilidade mobile, indo contra o requisito "Should" do PRD).
- **VALIDATE**: `pnpm check-types`

### Task 9: CREATE `apps/web/src/components/shared/birth-mode-urine-test-chart.tsx`

- **ACTION**: CREATE mini-gráfico de volume urinário + lista de proteína/cetonúria
- **IMPLEMENT**:
  - Filtrar `events` por `type === "urine_test"`, payload `{ protein_level, ketone_level, volume_ml }` (`string | null`, `string | null`, `number | null`)
  - Gráfico (chart.js): Dataset único "Volume (mL)", eixo `y` único, pontos onde `volume_ml != null`; `min: 0`, `max` dinâmico (`Math.max(50, ...volumes) + 20`, arredondado)
  - Abaixo do gráfico: lista compacta (`EVENT_LIST_PATTERN`) para registros onde `protein_level != null || ketone_level != null`, formato `"Proteína {label} · Cetonúria {label}"` (usando `BIRTH_URINE_DIPSTICK_LABELS`, mesma lógica de `birth-mode-timeline.tsx:105-110`) + hora
  - Empty state se nenhum evento: "Nenhum registro de urina ainda"
- **MIRROR**: `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` (estrutura geral), `apps/web/src/components/shared/birth-mode-timeline.tsx:99-111` (labels de urina)
- **VALIDATE**: `pnpm check-types`

### Task 10: UPDATE `apps/web/src/components/shared/birth-mode-partograph.tsx`

- **ACTION**: MODIFY para renderizar os 7 componentes reais em vez do placeholder genérico
- **IMPLEMENT**:
  - Importar os 7 novos componentes
  - Substituir o ternário atual (`session.id === "dilation_station" ? <BirthModeDilationStationChart .../> : <placeholder>`) por um `switch`/mapa de renderização por `session.id`:
    ```tsx
    function renderSessionContent(session: (typeof BIRTH_PARTOGRAPH_SESSIONS)[number], events: BirthModeTimelineEvent[]) {
      switch (session.id) {
        case "dilation_station": return <BirthModeDilationStationChart events={events} />;
        case "fetal_heart_rate": return <BirthModeFetalHeartRateChart events={events} />;
        case "contraction": return <BirthModeContractionChart events={events} />;
        case "oxytocin": return <BirthModeOxytocinChart events={events} />;
        case "medication": return <BirthModeMedicationList events={events} />;
        case "membrane_rupture": return <BirthModeMembraneRuptureSummary events={events} />;
        case "maternal_vitals": return <BirthModeMaternalVitalsChart events={events} />;
        case "urine_test": return <BirthModeUrineTestChart events={events} />;
      }
    }
    ```
  - Cada componente recebe o array `events` COMPLETO (não pré-filtrado por `session.eventTypes`) — a filtragem por tipo acontece dentro de cada componente (necessário para que `resolveChartT0` tenha acesso ao evento `start_monitoring`, que não pertence a nenhuma sessão)
  - Remover o placeholder genérico e a contagem `{count} registro(s) aguardando gráfico` (não fazem mais sentido — todas as sessões agora têm conteúdo real)
- **MIRROR**: Estrutura de `.map()` já existente no arquivo
- **GOTCHA**: TypeScript vai reclamar de "not all code paths return a value" no `switch` se um `PartographSessionId` novo for adicionado no futuro sem case correspondente — isso é desejável (fail-fast), não suprimir com `default`.
- **VALIDATE**: `pnpm check-types && pnpm --filter web build`

---

## Testing Strategy

Mesma justificativa das Fases 2/3: não há suíte de testes de componentes React neste projeto. Validação via `check-types`, `lint`, `build`, e verificação manual dos cálculos de série (mirroring a verificação da Fase 3 para alert/action line).

### Edge Cases Checklist

- [ ] Nenhum evento do tipo alvo em qualquer um dos 7 componentes → empty state, não crash
- [ ] `contractions_per_10min === null` (dado legado) → ponto pulado no dataset de frequência, não plotado como 0
- [ ] Ocitocina com só `oxytocin_concentration_u_per_l` OU só `oxytocin_drip_rate_gtt_per_min` preenchido (não ambos) → cada dataset plota só os pontos onde seu próprio campo não é `null`
- [ ] Vitais maternos com `temperature_celsius` preenchido mas PA/pulso `null` (ou vice-versa) → gráfico e lista de temperatura são independentes, cada um filtra seus próprios campos
- [ ] `membrane_rupture` ausente mas `amniotic_fluid` presente (líquido avaliado sem bolsa rota registrada, ex. bolsa rompida antes do início do acompanhamento) → mostrar só a lista de `amniotic_fluid`, sem o card de resumo de ruptura
- [ ] Medicação com `medication_type === "outros"` e `other_birth_medication_type` preenchido → rótulo usa o texto livre, não "Outros"
- [ ] `resolveChartT0` retorna `null` quando não há NENHUM evento (nem `start_monitoring`) → todos os empty states devem cobrir esse caso sem lançar erro

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/lib/birth-mode-chart-utils.ts apps/web/src/components/shared/birth-mode-*.tsx
```

**EXPECT**: Exit 0, no errors or warnings

### Level 2: UNIT_TESTS

N/A — sem suíte de testes de componentes neste projeto (ver Fases 2/3).

### Level 3: FULL_SUITE

```bash
pnpm check-types
pnpm --filter web build
```

**EXPECT**: Todos os pacotes type-checkam; build de produção do `web` conclui sem erros (confirma que `/modo-parto` continua compilável)

### Level 4: DATABASE_VALIDATION

N/A — nenhuma mudança de schema nesta fase.

### Level 5: BROWSER_VALIDATION

Mesma ressalva das Fases 2/3 — requer sessão autenticada + paciente com Modo Parto ativo em Supabase local. Ao validar manualmente:

- [ ] Cada uma das 7 mini-sessões restantes mostra seu gráfico/lista real, sem placeholder "Gráfico em breve"
- [ ] BCF mostra faixa sombreada 110-160bpm visivelmente distinta da linha de dados reais
- [ ] Contrações e Ocitocina mostram os dois eixos (esquerdo/direito) sem sobreposição de grid
- [ ] Medicações e Bolsa Rota renderizam como lista/resumo (não como gráfico vazio)
- [ ] Nenhuma regressão no gráfico de Dilatação/Estação (Fase 3) após o refactor do Task 2

### Level 6: MANUAL_VALIDATION

- [ ] Rodar um script Node standalone (mesmo padrão da Fase 3) para conferir manualmente o cálculo de `resolveChartT0`/`hoursSince` com um conjunto de eventos sintético, antes de considerar a fase concluída

---

## Acceptance Criteria

- [ ] Todas as 7 mini-sessões restantes (`fetal_heart_rate`, `contraction`, `oxytocin`, `medication`, `membrane_rupture`, `maternal_vitals`, `urine_test`) renderizam conteúdo real, não placeholder
- [ ] `birth-mode-chart-utils.ts` é usado por TODOS os gráficos numéricos (incluindo o refactor do gráfico de dilatação/estação da Fase 3)
- [ ] `pnpm check-types` e `pnpm --filter web build` passam sem erros
- [ ] Nenhuma regressão no gráfico de dilatação/estação (Fase 3) nem nas Fases 1/2
- [ ] UX corresponde ao diagrama "After State"

---

## Completion Checklist

- [ ] Tasks 1-10 completas e validadas (`pnpm check-types` após cada uma)
- [ ] Level 1: Static analysis (lint + type-check) passa
- [ ] Level 3: Build de produção passa
- [ ] Level 5: Browser validation (humano) — pendente, mesma ressalva das fases anteriores
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk                                                                                     | Likelihood | Impact | Mitigation                                                                                     |
| ------------------------------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| Vitais maternos com 3 grandezas (PA, pulso, temperatura) forçadas em um chart de 2 eixos pode ficar denso/ilegível em mobile | M | M | Decisão explícita (documentada em "NOT Building"): temperatura sai do gráfico e vira lista simples abaixo — reduz de 3 para 2 eixos no chart.js |
| `contractions_per_10min` nulo (dados legados de antes da Fase 1) pode gerar "buracos" visuais na linha de frequência | M | L | `spanGaps: false` já é o padrão estabelecido (Fase 3) — buraco visual é aceitável e mais honesto que interpolar/zerar |
| Refactor do Task 2 (extrair util) introduzir regressão silenciosa no gráfico já em produção da Fase 3 | L | M | Task 2 é um refactor 1:1 sem mudança de comportamento; validado por `pnpm --filter web build` ao final + a mesma verificação manual de alert/action line já documentada no report da Fase 3 |
| 7 componentes novos em uma única fase aumenta a chance de inconsistência de estilo entre eles | M | L | Todos mirram o MESMO arquivo arquétipo (`birth-mode-dilation-station-chart.tsx`) e o MESMO util compartilhado (Task 1) — reduz divergência de padrão |
| `amniotic_fluid` (multiple) e `membrane_rupture` (single) compartilharem a mesma mini-sessão pode confundir qual é o dado "principal" no resumo | L | L | Ordem de exibição fixa: resumo de ruptura primeiro (se existir), lista de reavaliações de líquido depois — documentado no Task 7 |

---

## Notes

- Esta fase roda em paralelo com nenhuma outra pendente no momento (Fase 3 já está completa) — é a única fase "Must" restante antes da Fase 5 (tempo real + polimento mobile/tablet), que depende desta E da Fase 3.
- Os nomes de arquivo seguem o padrão já estabelecido (`birth-mode-{track}-chart.tsx` para gráficos chart.js, `birth-mode-{track}-list.tsx`/`-summary.tsx` para os 2 componentes não-gráficos), facilitando que a Fase 5 (polimento) e a Fase 6 (PDF) localizem cada track rapidamente.
- Ao final desta fase, `BirthModePartograph` deixa de ter QUALQUER placeholder — é um bom ponto de checkpoint visual para validação de produto (equipe pode revisar o partograma completo, mesmo antes do polimento de tempo real da Fase 5).
