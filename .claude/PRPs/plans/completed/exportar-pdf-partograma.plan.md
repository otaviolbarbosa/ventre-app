# Feature: Exportar PDF do Partograma (layout clássico compactado)

## Summary

Fase 6 (nice to have) do PRD do Partograma. Adiciona um botão "Exportar PDF" à tela de Modo Parto que gera, sob demanda, um PDF com o partograma completo no layout clássico do Ministério da Saúde — todos os tracks (dilatação/estação com Linha de Alerta/Ação, BCF, contrações, ocitocina, medicações, bolsa rota, vitais maternos, urina) sincronizados no mesmo eixo de tempo horizontal, ao contrário das mini-sessões em tela (um `Card`/gráfico por track, Fases 3-4). O repositório já tem um pipeline de PDF maduro (`@react-pdf/renderer` + `pdf-lib`, usado hoje só para contratos) que serve de template direto: um módulo server-only que renderiza um `Document`/`Page` React-PDF para `Buffer`, disparado por uma `next-safe-action` que devolve o PDF em base64 (sem persistência em Storage, já que este é um snapshot efêmero, não um documento clínico versionado). A parte genuinamente greenfield é o desenho vetorial denso multi-track — não existe hoje nenhum componente que sincronize mais de um track no mesmo eixo compartilhado (as mini-sessões em tela são independentes) — construído com as primitivas `Svg`/`Polyline`/`Line`/`Rect`/`Text` do `@react-pdf/renderer`, reaproveitando a mesma lógica de eixo (`resolveChartT0`/`hoursSince`) e o mesmo algoritmo de Linha de Alerta/Ação já usados no gráfico em tela.

## User Story

As a profissional da equipe de cuidado (enfermagem obstétrica/obstetra) em modo parto
I want to gerar um PDF com o partograma completo, no formato clássico compactado usado pela documentação do parto
So that eu tenha um registro impresso/arquivável fiel ao modelo de referência, sem precisar montar isso manualmente a partir da Linha do tempo

## Problem Statement

Hoje o partograma só existe em tela, decomposto em mini-sessões (uma por track, Fases 3-4) — decisão deliberada para legibilidade mobile, mas que não serve para documentação/impressão formal, que exige o layout clássico denso com todos os tracks no mesmo eixo de tempo (como nos PDFs de referência do Ministério da Saúde). Não existe hoje nenhum caminho para gerar esse documento.

## Solution Statement

1. Extrair a lógica de query/mapeamento de `getBirthModeTimelineAction` (hoje presa dentro do corpo de uma `next-safe-action`, não invocável por uma rota/action server-side diferente) para uma função pura `fetchBirthModeTimelineData(supabase, pregnancyId)` em um novo módulo `lib`, reaproveitada tanto pela action existente quanto pela nova action de exportação — evita duplicar as 10 queries paralelas e o mapeamento de ~150 linhas.
2. Extrair o cálculo da Linha de Alerta/Ação (hoje inline em `birth-mode-dilation-station-chart.tsx`) para uma função pura em `birth-mode-chart-utils.ts`, reaproveitada pelo gráfico em tela E pelo novo documento PDF — garante que o PDF reflita exatamente a mesma lógica clínica já validada na Fase 3.
3. Criar `partograph-pdf-document.tsx` (componente `@react-pdf/renderer`, server-only) com bandas horizontais empilhadas — uma por track — todas compartilhando o mesmo eixo X (horas desde o início), desenhadas com `Svg`/`Polyline`/`Line`/`Rect`/`Text`: uma banda "linha" (dilatação/estação/alerta/ação, BCF, contrações, ocitocina, vitais, urina) e uma banda "evento" (medicações, bolsa rota — marcadores verticais com rótulo, mesma natureza categórica dos componentes de lista em tela).
4. Criar `partograph-pdf.ts` (server-only, mirror de `contract-pdf.ts`) com `renderPartographPdfBuffer`, e uma nova `next-safe-action` `exportPartographPdfAction` (mirror de `previewContractPdfAction`) que busca os dados via `fetchBirthModeTimelineData` e devolve `{ pdfBase64, fileName }` — sem upload a Storage, já que não é um documento clínico persistido/versionado como o contrato.
5. Adicionar um botão "Exportar PDF" em `birth-mode-screen.tsx`, com estado `isExportingPdf` + spinner (mirror do padrão `isExporting`/`Loader2` de `patient-contract.tsx`), que decodifica o base64 em `Blob` e dispara o download via um `<a download>` temporário — mais simples que o fluxo de pré-visualização do contrato (`ContentModal` + `PdfViewer`), que existe ali porque o contrato precisa ser revisado antes de assinar; aqui é só um snapshot para exportar.

## Metadata

| Field            | Value                                                                |
| ---------------- | --------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                         |
| Complexity       | HIGH                                                                   |
| Systems Affected | `apps/web/src/lib/`, `apps/web/src/actions/`, `apps/web/src/components/shared/`, `apps/web/src/screens/birth-mode-screen.tsx` |
| Dependencies     | `@react-pdf/renderer@4.5.1`, `pdf-lib@^1.17.1` (já em uso para contratos, nenhuma lib nova) |
| Estimated Tasks  | 8                                                                      |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  Tela de Modo Parto, aba "Partograma":                                         ║
║  ┌────────────────────────────────────────┐                                    ║
║  │ Header: {Nome} · Badge · [Registrar     │                                    ║
║  │          Nascimento]                     │  ← sem botão de exportação        ║
║  ├────────────────────────────────────────┤                                    ║
║  │ Card: Dilatação/Estação → mini-gráfico  │                                    ║
║  │ Card: BCF → mini-gráfico                │  ← 8 mini-gráficos independentes,  ║
║  │ Card: Contrações → mini-gráfico         │     cada um com seu próprio eixo   ║
║  │ Card: ... (mais 5 tracks)               │     de tempo isolado               ║
║  └────────────────────────────────────────┘                                    ║
║                                                                                  ║
║  USER_FLOW: Equipe quer documentar/imprimir o parto → não há caminho; teria     ║
║  que capturar 8 telas ou reconstruir manualmente o layout clássico.            ║
║  PAIN_POINT: Nenhum artefato exportável/arquivável no formato de referência.    ║
║                                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║  Tela de Modo Parto:                                                           ║
║  ┌────────────────────────────────────────┐                                    ║
║  │ Header: {Nome} · Badge · [Exportar PDF] │  ← NOVO botão                      ║
║  │          · [Registrar Nascimento]        │                                    ║
║  └────────────────────────────────────────┘                                    ║
║                    │ clique                                                     ║
║                    ▼                                                            ║
║  ┌────────────────────────────────────────┐                                    ║
║  │ PARTOGRAMA_{PACIENTE}_{DATA}.pdf         │                                    ║
║  │  ┌──────────────────────────────────┐   │                                    ║
║  │  │ Dilatação/Estação + Alerta/Ação   │   │  ← todas as bandas compartilham   ║
║  │  ├──────────────────────────────────┤   │     o MESMO eixo X (horas desde   ║
║  │  │ BCF                                │   │     o início), empilhadas como   ║
║  │  ├──────────────────────────────────┤   │     no modelo de referência       ║
║  │  │ Contrações                        │   │                                    ║
║  │  ├──────────────────────────────────┤   │                                    ║
║  │  │ Ocitocina                         │   │                                    ║
║  │  ├──────────────────────────────────┤   │                                    ║
║  │  │ Medicações / Bolsa Rota (eventos) │   │                                    ║
║  │  ├──────────────────────────────────┤   │                                    ║
║  │  │ Vitais Maternos                   │   │                                    ║
║  │  ├──────────────────────────────────┤   │                                    ║
║  │  │ Urina                             │   │                                    ║
║  │  └──────────────────────────────────┘   │                                    ║
║  └────────────────────────────────────────┘                                    ║
║                                                                                  ║
║  USER_FLOW: Equipe clica "Exportar PDF" → botão mostra "Gerando..." →          ║
║  download automático do PDF compactado, pronto para arquivar/imprimir.         ║
║  VALUE_ADD: Documento de referência fiel ao modelo do Ministério da Saúde,      ║
║  gerado sob demanda a partir dos dados já capturados.                          ║
║                                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `birth-mode-screen.tsx` (header) | Sem opção de exportação | Botão "Exportar PDF" com estado de loading | Equipe consegue gerar um artefato arquivável/imprimível sob demanda |
| N/A (novo) | — | `PARTOGRAMA_{PACIENTE}_{DATA}.pdf` baixado no navegador | Documento fiel ao layout clássico, todos os tracks no mesmo eixo de tempo |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/actions/get-birth-mode-timeline-action.ts` | 1-267 (inteiro) | Query/mapping a EXTRAIR para `fetchBirthModeTimelineData` — algoritmo e shape exatos |
| P0 | `apps/web/src/lib/contract-pdf.ts` | 1-44 | Padrão exato de módulo PDF server-only (`renderContractPdfBuffer`) a MIRROR em `partograph-pdf.ts` |
| P0 | `apps/web/src/components/shared/contract-pdf-document.tsx` | 1-92 | Padrão de `StyleSheet`/`Document`/`Page` do `@react-pdf/renderer` a MIRROR |
| P0 | `apps/web/src/actions/preview-contract-pdf-action.ts` | 1-52 | Padrão exato de action que devolve `{ pdfBase64 }` sem persistência a MIRROR em `export-partograph-pdf-action.ts` |
| P1 | `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` | 62-96 | Cálculo de Linha de Alerta/Ação a EXTRAIR para `birth-mode-chart-utils.ts` |
| P1 | `apps/web/src/lib/birth-mode-chart-utils.ts` | 1-33 (após Fase 5) | `resolveChartT0`/`hoursSince`/`computeContractionsPer10Min` — reaproveitar diretamente, sem duplicar |
| P1 | `apps/web/src/lib/contract-pdf-fonts.ts` | 1-22 | `PDF_FONT_FAMILY` já registrado — reaproveitar diretamente, não registrar fonte de novo |
| P1 | `apps/web/src/lib/birth-mode-constants.ts` | 1-90 | `BIRTH_EVENT_CONFIG`, `BIRTH_MEDICATION_TYPE_LABELS`, `BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS`, `BIRTH_URINE_DIPSTICK_LABELS` — labels pt-BR para o PDF |
| P2 | `apps/web/src/components/shared/patient-contract.tsx` | 452-517 | Padrão de botão de exportação com `isExporting`/`Loader2` a MIRROR (adaptado, sem `ContentModal`/preview) |
| P2 | `apps/web/src/screens/birth-mode-screen.tsx` | 88-159 | Header/tela onde o botão "Exportar PDF" e a chamada da action serão adicionados |
| P2 | `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | 14-25 | Referência de padrão de auth (`getUser()` + RLS) — NÃO seguido aqui (usamos `authActionClient`, já equivalente) |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [@react-pdf/renderer v4 — Svg components](https://react-pdf.org/components#svg) | `Svg`, `Line`, `Polyline`, `Rect`, `Circle`, `Text` | Primitivas de desenho vetorial para as bandas do partograma — sem suporte a canvas/DOM, então o chart.js existente não é reaproveitável diretamente |
| [@react-pdf/renderer v4 — Document/Page](https://react-pdf.org/components#document) | `Document`, `Page`, `StyleSheet` | Estrutura base já usada em `contract-pdf-document.tsx`, mesmo padrão aqui |

---

## Patterns to Mirror

**PDF_SERVER_MODULE_STYLE (a mirror em `partograph-pdf.ts`):**
```typescript
// SOURCE: apps/web/src/lib/contract-pdf.ts:1-44
// COPY THIS PATTERN: módulo server-only, comentário explícito, renderToBuffer + React.createElement
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

// Server-only module: imports @react-pdf/renderer. Never import from client components.

export async function renderContractPdfBuffer({ ... }): Promise<Buffer> {
  return renderToBuffer(
    React.createElement(ContractPdfDocument, { data: {...} }) as React.ReactElement<DocumentProps>,
  );
}

function sanitizePatientNameForFile(patientName: string): string { /* NFD strip, uppercase, replace non-alnum */ }
export function buildContractPdfFileName(patientName: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `CONTRATO_${sanitizePatientNameForFile(patientName)}_${dateStr}.pdf`;
}
```

**PDF_DOCUMENT_STYLESHEET_STYLE (a mirror em `partograph-pdf-document.tsx`):**
```typescript
// SOURCE: apps/web/src/components/shared/contract-pdf-document.tsx:1-20
import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { fontFamily: PDF_FONT_FAMILY, fontSize: 11, paddingTop: 48, paddingBottom: 48, paddingLeft: 60, paddingRight: 60 },
  // ...
});
```

**PREVIEW_ACTION_STYLE (a mirror em `export-partograph-pdf-action.ts`):**
```typescript
// SOURCE: apps/web/src/actions/preview-contract-pdf-action.ts:1-52
"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const previewContractPdfAction = authActionClient
  .inputSchema(z.object({ /* ... */ }))
  .action(async ({ parsedInput: { /* ... */ } }) => {
    const buffer = await renderContractPdfBuffer({ /* ... */ });
    return { pdfBase64: buffer.toString("base64") };
  });
```

**ALERT_ACTION_LINE_ALGORITHM (a extrair, não reinventar):**
```typescript
// SOURCE: apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx:76-91
// Modelo clássico (Ministério da Saúde): fase ativa começa ao atingir 4cm de
// dilatação; a Linha de Alerta sobe 1cm/h a partir desse ponto até 10cm; a
// Linha de Ação é a mesma linha deslocada 4h à direita (PRD Fase 3).
const activePhaseStart = dilationPoints.find((point) => point.y >= 4);
const alertLine: ChartPoint[] = activePhaseStart
  ? [
      { x: activePhaseStart.x, y: activePhaseStart.y },
      { x: activePhaseStart.x + (DILATION_MAX - activePhaseStart.y), y: DILATION_MAX },
    ]
  : [];
const actionLine: ChartPoint[] = activePhaseStart
  ? [
      { x: activePhaseStart.x + 4, y: activePhaseStart.y },
      { x: activePhaseStart.x + 4 + (DILATION_MAX - activePhaseStart.y), y: DILATION_MAX },
    ]
  : [];
```

**EXPORT_BUTTON_LOADING_STATE (a mirror, adaptado — sem preview/`ContentModal`):**
```typescript
// SOURCE: apps/web/src/components/shared/patient-contract.tsx:461-496 (handleExportPdf), 142 (isExporting state)
const [isExporting, setIsExporting] = useState(false);

const handleExportPdf = async () => {
  setIsExporting(true);
  try {
    // ... chama a action, trata erro com toast.error(res?.serverError ?? "...")
  } finally {
    setIsExporting(false);
  }
};
// <Button disabled={isExporting}>{isExporting ? "Gerando..." : "Baixar contrato"}</Button>
```

**CHART_UTILS_EXTRACTION_STYLE (a seguir para a nova função em `birth-mode-chart-utils.ts`, mesmo padrão da Fase 5 `computeContractionsPer10Min`):**
```typescript
// SOURCE: apps/web/src/lib/birth-mode-chart-utils.ts (após Fase 5)
export type ChartPoint = { x: number; y: number };
export function resolveChartT0(events: BirthModeTimelineEvent[]): number | null { /* ... */ }
export function hoursSince(t0: number, iso: string): number { /* ... */ }
export function computeContractionsPer10Min(contractionEvents: { id: string; occurredAt: string }[]): Map<string, number> { /* ... */ }
// NOVO: computeAlertActionLines(dilationPoints, dilationMax) — mesma responsabilidade, função pura
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/lib/birth-mode-timeline-data.ts` | CREATE | Extrai a query/mapping de `getBirthModeTimelineAction` para uma função plain, invocável tanto pela action existente quanto pela nova action de export |
| `apps/web/src/actions/get-birth-mode-timeline-action.ts` | UPDATE | Corpo da action passa a chamar `fetchBirthModeTimelineData` em vez de conter a lógica inline |
| `apps/web/src/lib/birth-mode-chart-utils.ts` | UPDATE | Adicionar `computeAlertActionLines`, extraída de `birth-mode-dilation-station-chart.tsx` |
| `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx` | UPDATE | Usar `computeAlertActionLines` em vez do cálculo inline (comportamento idêntico) |
| `apps/web/src/components/shared/partograph-pdf-document.tsx` | CREATE | Layout `@react-pdf/renderer` com bandas multi-track no mesmo eixo de tempo |
| `apps/web/src/lib/partograph-pdf.ts` | CREATE | `renderPartographPdfBuffer` + `buildPartographPdfFileName`, server-only |
| `apps/web/src/actions/export-partograph-pdf-action.ts` | CREATE | `next-safe-action` que busca dados + renderiza PDF, devolve `{ pdfBase64, fileName }` |
| `apps/web/src/screens/birth-mode-screen.tsx` | UPDATE | Botão "Exportar PDF" + `isExportingPdf` + download via `Blob`/`<a download>` |

---

## NOT Building (Scope Limits)

- **Persistência do PDF em Supabase Storage / `patient_documents`** — ao contrário do contrato (documento legal versionado, assinado, re-baixável), o partograma em PDF é um snapshot efêmero gerado sob demanda a partir dos dados já persistidos nas tabelas `birth_*`; persistir cada exportação criaria lixo de storage sem valor clínico adicional (os dados de origem já são a fonte da verdade).
- **Pré-visualização em modal (`ContentModal` + `PdfViewer`) antes do download** — padrão existente no contrato porque o documento precisa ser revisado antes de assinar; aqui não há edição/assinatura, então o download direto é suficiente e mais simples.
- **Paginação/quebra automática de página quando o parto é muito longo** — o MVP assume que o layout de bandas cabe em uma página `A4`/`Letter` paisagem para a duração típica de um parto; paginação multi-página fica para uma iteração futura caso surja demanda real (fora do escopo "nice to have" desta fase).
- **Migração para o modelo Labour Care Guide (OMS pós-2020)** — decisão já registrada no PRD; o PDF segue o mesmo modelo clássico (linhas de alerta/ação) do gráfico em tela.
- **Botão de exportação em qualquer lugar além do header da tela de Modo Parto** — sem duplicar o ponto de entrada (ex: dentro de cada mini-sessão).
- **Testes automatizados de snapshot visual do PDF** — não há framework de teste para modo parto hoje (Fases 1-5); validação é manual/browser, mesma prática já estabelecida.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e validável de forma independente.

### Task 1: CREATE `apps/web/src/lib/birth-mode-timeline-data.ts`

- **ACTION**: Extrair a lógica de `getBirthModeTimelineAction` para uma função plain reutilizável
- **IMPLEMENT**: `export async function fetchBirthModeTimelineData(supabase: SupabaseClient, pregnancyId: string): Promise<{ events: BirthModeTimelineEvent[]; patientId: string | null; patientName: string | null; hasFinished: boolean; birthModeActive: boolean; wasActivated: boolean }>` — corpo idêntico ao de `get-birth-mode-timeline-action.ts:22-267` (as 10 queries em `Promise.all`, o mapeamento por tipo, o `events.sort`); usar `computeContractionsPer10Min` de `birth-mode-chart-utils.ts` no lugar do loop de janela deslizante inline (linhas 99-111 do arquivo original) — mesma lógica, já extraída na Fase 5, evita a terceira duplicação
- **MIRROR**: `apps/web/src/actions/get-birth-mode-timeline-action.ts:22-267` (corpo a mover, adaptado para função plain sem `parsedInput`/`ctx`)
- **IMPORTS**: `import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";` (type-only, sem dependência circular em runtime); `import { computeContractionsPer10Min } from "@/lib/birth-mode-chart-utils";`; `import type { createServerSupabaseClient } from "@ventre/supabase/server";` para tipar o parâmetro `supabase` (mesmo padrão de `type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;` usado em `contract-pdf.ts:23`)
- **GOTCHA**: manter o tipo `BirthModeTimelineEvent` declarado em `get-birth-mode-timeline-action.ts` (não mover) — é importado por ~12 arquivos (todos os componentes de gráfico, `birth-mode-partograph.tsx`, `birth-mode-timeline.tsx`, `birth-mode-screen.tsx`); mover o tipo forçaria atualizar todos esses imports sem necessidade
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/actions/get-birth-mode-timeline-action.ts`

- **ACTION**: Substituir o corpo da action por uma chamada a `fetchBirthModeTimelineData`
- **IMPLEMENT**:
  ```typescript
  export const getBirthModeTimelineAction = authActionClient
    .inputSchema(schema)
    .action(async ({ parsedInput, ctx: { supabase } }) => {
      return fetchBirthModeTimelineData(supabase, parsedInput.pregnancyId);
    });
  ```
- **MIRROR**: estrutura de action fina que delega para uma função de serviço — nenhum precedente idêntico no repo, mas segue a convenção geral de `next-safe-action` (action = camada fina de auth/validação, lógica de negócio isolada) já documentada em `~/.claude/rules/safe-actions.md`
- **IMPORTS**: `import { fetchBirthModeTimelineData } from "@/lib/birth-mode-timeline-data";`
- **GOTCHA**: o `BirthModeTimelineEvent` type e o `schema` `z.object({ pregnancyId: z.string().uuid() })` continuam neste arquivo — só o corpo de busca/mapeamento se move
- **VALIDATE**: `pnpm check-types` — comportamento do endpoint deve ser idêntico (mesmo shape de retorno)

### Task 3: UPDATE `apps/web/src/lib/birth-mode-chart-utils.ts`

- **ACTION**: ADD função pura `computeAlertActionLines`
- **IMPLEMENT**:
  ```typescript
  export function computeAlertActionLines(
    dilationPoints: ChartPoint[],
    dilationMax: number,
  ): { alertLine: ChartPoint[]; actionLine: ChartPoint[] } {
    const activePhaseStart = dilationPoints.find((point) => point.y >= 4);
    const alertLine: ChartPoint[] = activePhaseStart
      ? [
          { x: activePhaseStart.x, y: activePhaseStart.y },
          { x: activePhaseStart.x + (dilationMax - activePhaseStart.y), y: dilationMax },
        ]
      : [];
    const actionLine: ChartPoint[] = activePhaseStart
      ? [
          { x: activePhaseStart.x + 4, y: activePhaseStart.y },
          { x: activePhaseStart.x + 4 + (dilationMax - activePhaseStart.y), y: dilationMax },
        ]
      : [];
    return { alertLine, actionLine };
  }
  ```
- **MIRROR**: `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx:76-91` — copiar o algoritmo exatamente, sem alterar a lógica clínica já validada na Fase 3
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx`

- **ACTION**: Substituir o cálculo inline de `alertLine`/`actionLine` pela chamada a `computeAlertActionLines`
- **IMPLEMENT**: `const { alertLine, actionLine } = computeAlertActionLines(dilationPoints, DILATION_MAX);` no lugar das linhas 76-91 atuais
- **MIRROR**: import já existente de `birth-mode-chart-utils.ts` neste arquivo — adicionar `computeAlertActionLines` ao import existente
- **GOTCHA**: comportamento em tela deve permanecer idêntico — esta task é um refactor puro, sem mudança visual
- **VALIDATE**: `pnpm check-types`; conferir visualmente no navegador que o mini-gráfico de dilatação/estação não mudou

### Task 5: CREATE `apps/web/src/components/shared/partograph-pdf-document.tsx`

- **ACTION**: CREATE o layout `@react-pdf/renderer` do partograma completo
- **IMPLEMENT**: `PartographPdfDocument({ data }: { data: PartographPdfData })` onde `PartographPdfData = { patientName: string; events: BirthModeTimelineEvent[] }`. Estrutura:
  - Página `A4` paisagem (`size="A4" orientation="landscape"`), header com nome da paciente + data de geração
  - Resolver `t0` via `resolveChartT0(events)` e `maxHours` (maior `hoursSince` entre todos os eventos, arredondado para cima) uma única vez, compartilhado por todas as bandas
  - Um componente interno `LineTrackBand` (reutilizado para dilatação/estação, BCF, contrações, ocitocina, vitais, urina): recebe `{ title, points, min, max, width, height, alertLine?, actionLine?, secondaryPoints? }` e desenha eixos + `Polyline` via `Svg`/`Line`/`Polyline` do `@react-pdf/renderer`, convertendo `{x: horas, y: valor}` para coordenadas de pixel do viewBox (`pxX = (x / maxHours) * width`, `pxY = height - ((y - min) / (max - min)) * height`)
  - Um componente interno `EventTrackBand` (reutilizado para medicações não-ocitocina e bolsa rota/líquido amniótico): desenha uma linha de base + um marcador vertical (`Line`) + `Text` rotacionado ou abreviado por evento, posicionado em `pxX` na mesma escala de horas
  - Reaproveitar `BIRTH_MEDICATION_TYPE_LABELS`, `BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS`, `BIRTH_URINE_DIPSTICK_LABELS` de `birth-mode-constants.ts` para os textos dos marcadores/eixos
- **MIRROR**: `apps/web/src/components/shared/contract-pdf-document.tsx:1-92` (estrutura `StyleSheet`/`Document`/`Page`); `apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx:36-96` (filtros de evento por `type`, cálculo de `ChartPoint[]`, uso de `resolveChartT0`/`hoursSince`) — mesma lógica de transformação de dados, sem chart.js
- **IMPORTS**: `import { Document, Page, StyleSheet, Svg, Line as SvgLine, Polyline, Rect, Text, View } from "@react-pdf/renderer";`; `import { PDF_FONT_FAMILY } from "@/lib/contract-pdf-fonts";`; `import { computeAlertActionLines, hoursSince, resolveChartT0 } from "@/lib/birth-mode-chart-utils";`; `import { BIRTH_MEDICATION_TYPE_LABELS, BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS, BIRTH_URINE_DIPSTICK_LABELS } from "@/lib/birth-mode-constants";`; `import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";`
- **GOTCHA**: `@react-pdf/renderer` não suporta `canvas`/DOM — os componentes de gráfico em tela (`birth-mode-*-chart.tsx`) NÃO são reaproveitáveis diretamente; apenas a lógica pura de transformação de dados (filtros, `ChartPoint[]`, `resolveChartT0`/`hoursSince`, `computeAlertActionLines`) é compartilhada. `Svg`/`Polyline` do react-pdf usam coordenadas absolutas em pixels do viewBox — calcular escala manualmente (sem lib de charting)
- **VALIDATE**: `pnpm check-types` (o componente em si não é renderizável em teste automatizado sem rodar `renderToBuffer` — validação visual real acontece na Task 8/Level 5)

### Task 6: CREATE `apps/web/src/lib/partograph-pdf.ts`

- **ACTION**: CREATE módulo server-only com `renderPartographPdfBuffer` e `buildPartographPdfFileName`
- **IMPLEMENT**:
  ```typescript
  // Server-only module: imports @react-pdf/renderer. Never import from client components.

  export async function renderPartographPdfBuffer(data: PartographPdfData): Promise<Buffer> {
    return renderToBuffer(
      React.createElement(PartographPdfDocument, { data }) as React.ReactElement<DocumentProps>,
    );
  }

  export function buildPartographPdfFileName(patientName: string): string {
    const dateStr = new Date().toISOString().slice(0, 10);
    return `PARTOGRAMA_${sanitizePatientNameForFile(patientName)}_${dateStr}.pdf`;
  }
  ```
  `sanitizePatientNameForFile` — duplicar a função privada de `contract-pdf.ts:46-52` (não exportada de lá, então não há import direto disponível) ou extraí-la para um util compartilhado se preferível; dado o tamanho (7 linhas), duplicar é aceitável e evita acoplar dois módulos de PDF não relacionados
- **MIRROR**: `apps/web/src/lib/contract-pdf.ts:1-57` (estrutura completa do módulo, comentário server-only, `renderToBuffer` + `React.createElement`, builder de nome de arquivo)
- **IMPORTS**: `import { PartographPdfDocument, type PartographPdfData } from "@/components/shared/partograph-pdf-document";`; `import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";`; `import React from "react";`
- **VALIDATE**: `pnpm check-types`

### Task 7: CREATE `apps/web/src/actions/export-partograph-pdf-action.ts`

- **ACTION**: CREATE a `next-safe-action` de exportação
- **IMPLEMENT**:
  ```typescript
  "use server";

  export const exportPartographPdfAction = authActionClient
    .inputSchema(z.object({ pregnancyId: z.string().uuid() }))
    .action(async ({ parsedInput: { pregnancyId }, ctx: { supabase } }) => {
      const { events, patientName } = await fetchBirthModeTimelineData(supabase, pregnancyId);
      const buffer = await renderPartographPdfBuffer({
        patientName: patientName ?? "Paciente",
        events,
      });
      return {
        pdfBase64: buffer.toString("base64"),
        fileName: buildPartographPdfFileName(patientName ?? "Paciente"),
      };
    });
  ```
- **MIRROR**: `apps/web/src/actions/preview-contract-pdf-action.ts:1-52` (mesmo padrão `"use server"` + `authActionClient` + retorno `{ pdfBase64 }`, aqui acrescido de `fileName`)
- **IMPORTS**: `import { fetchBirthModeTimelineData } from "@/lib/birth-mode-timeline-data";`; `import { buildPartographPdfFileName, renderPartographPdfBuffer } from "@/lib/partograph-pdf";`; `import { authActionClient } from "@/lib/safe-action";`; `import { z } from "zod";`
- **GOTCHA**: buscar os dados no servidor via `pregnancyId` (não aceitar `events` já montados vindos do cliente) — o PDF é um documento clínico e não deve confiar em dados potencialmente adulterados no client antes da geração; a autorização de acesso à gestação já é garantida pela RLS nas queries de `fetchBirthModeTimelineData`, igual à action original
- **VALIDATE**: `pnpm check-types`

### Task 8: UPDATE `apps/web/src/screens/birth-mode-screen.tsx`

- **ACTION**: ADD botão "Exportar PDF" no header, com download automático do PDF gerado
- **IMPLEMENT**:
  ```typescript
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const { execute: exportPdf } = useAction(exportPartographPdfAction, {
    onSuccess: ({ data }) => {
      if (!data) return;
      const byteChars = atob(data.pdfBase64);
      const byteNumbers = Array.from(byteChars, (c) => c.charCodeAt(0));
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = data.fileName;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Erro ao gerar PDF do partograma");
    },
    onExecute: () => setIsExportingPdf(true),
    onSettled: () => setIsExportingPdf(false),
  });
  ```
  Botão na mesma `div` de ações do header (`birth-mode-screen.tsx:92-114`, ao lado de/antes de "Registrar Nascimento"):
  ```tsx
  <Button
    type="button"
    variant="outline"
    size="sm"
    disabled={isExportingPdf}
    onClick={() => exportPdf({ pregnancyId })}
  >
    {isExportingPdf ? (
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
    ) : (
      <FileDown className="mr-2 h-4 w-4" />
    )}
    {isExportingPdf ? "Gerando PDF..." : "Exportar PDF"}
  </Button>
  ```
- **MIRROR**: `apps/web/src/components/shared/patient-contract.tsx:461-496` (`handleExportPdf`, `isExporting` boolean, `toast.error` em falha) — adaptado para usar `useAction`'s próprios callbacks (`onExecute`/`onSettled`) em vez de `try/finally` manual, já que aqui não há branch condicional de "documento já existe" como no contrato
- **IMPORTS**: `import { exportPartographPdfAction } from "@/actions/export-partograph-pdf-action";`; `import { FileDown, Loader2 } from "lucide-react";` (adicionar aos imports já existentes de `lucide-react`); `import { toast } from "sonner";` (se ainda não importado neste arquivo — confirmar)
- **GOTCHA**: `pregnancyId` já está disponível como prop do componente (`birth-mode-screen.tsx:24-27`) — não precisa vir do state `events`/`patientId`; o botão deve ficar desabilitado (ou oculto) quando `wasActivated === false` ou antes do primeiro carregamento, mesma condição que já esconde o resto do conteúdo da tela
- **VALIDATE**: `pnpm check-types`; teste manual — clicar no botão deve baixar um arquivo `PARTOGRAMA_*.pdf` válido

---

## Testing Strategy

Não há testes automatizados para nenhum componente/hook/action de modo parto hoje (confirmado nas Fases 1-5) — esta fase não introduz um framework de teste novo. A validação de um documento PDF gerado programaticamente é inerentemente visual; a estratégia é manual (Level 5/6 abaixo).

### Edge Cases Checklist

- [ ] Parto sem nenhum evento registrado além de `start_monitoring` (partograma recém-ativado) — `resolveChartT0` retorna o timestamp de ativação, `maxHours` deve ter um mínimo razoável (ex: 1h) para não gerar bandas de largura zero
- [ ] Track sem nenhum evento (ex: nenhuma vitais materna registrada) — banda correspondente deve renderizar vazia/com mensagem "Sem registros", não quebrar o layout das demais bandas
- [ ] Nome da paciente com acentos/caracteres especiais — `sanitizePatientNameForFile` já trata isso (mesmo padrão do contrato)
- [ ] Parto muito longo (>24h) — `maxHours` grande o suficiente para que o eixo X não fique ilegível; aceitar como limitação conhecida do MVP (ver NOT Building)
- [ ] Múltiplos eventos de medicação/bolsa rota muito próximos no tempo — marcadores da `EventTrackBand` podem se sobrepor visualmente; aceitável para o MVP, sem lógica de anti-colisão de rótulos
- [ ] Usuário sem acesso à gestação (não é `team_member`) tenta exportar — a action deve falhar de forma segura via RLS (mesma proteção de `getBirthModeTimelineAction`), sem vazar dados

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros

### Level 2: LINT

```bash
npx biome lint --write --unsafe apps/web/src/lib/birth-mode-timeline-data.ts apps/web/src/actions/get-birth-mode-timeline-action.ts apps/web/src/lib/birth-mode-chart-utils.ts apps/web/src/components/shared/birth-mode-dilation-station-chart.tsx apps/web/src/components/shared/partograph-pdf-document.tsx apps/web/src/lib/partograph-pdf.ts apps/web/src/actions/export-partograph-pdf-action.ts apps/web/src/screens/birth-mode-screen.tsx
```
**EXPECT**: Sem warnings pendentes

### Level 3: BUILD

```bash
pnpm --filter web build
```
**EXPECT**: Build completo sem erros (confirma que `@react-pdf/renderer`/`Svg` compilam corretamente no bundle server)

### Level 5: BROWSER_VALIDATION

Usar Browser MCP (ou navegador manual) para verificar:
- [ ] Abrir uma gestação em Modo Parto ativo, com dados em pelo menos 5 dos 8 tracks → clicar "Exportar PDF" → confirmar download de um arquivo `PARTOGRAMA_{NOME}_{DATA}.pdf`
- [ ] Abrir o PDF baixado → confirmar que todas as bandas aparecem, alinhadas ao mesmo eixo de tempo horizontal, com a Linha de Alerta/Ação na banda de dilatação/estação
- [ ] Comparar visualmente um evento específico (ex: horário de uma contração) entre o PDF e a mini-sessão correspondente em tela — devem corresponder à mesma posição relativa no eixo de horas
- [ ] Testar em uma gestação com poucos dados (só `start_monitoring` + 1-2 eventos) — PDF deve gerar sem erro, bandas vazias não devem quebrar o layout

### Level 6: MANUAL_VALIDATION

1. Ativar Modo Parto em uma gestação de teste e registrar ao menos um evento em cada um dos 8 tracks (dilatação, estação, BCF, contração, ocitocina, outra medicação, bolsa rota, vitais, urina)
2. Clicar "Exportar PDF" e abrir o arquivo baixado
3. Conferir que a Linha de Alerta/Ação no PDF é idêntica à do mini-gráfico em tela (mesmos pontos de início/inclinação)
4. Testar com um usuário que NÃO é `team_member` da gestação (ou simular) e confirmar que a exportação falha de forma segura (sem vazar dados de outra gestação)
5. Testar o botão em mobile (tela pequena) — deve continuar acessível/clicável no header responsivo já existente

---

## Acceptance Criteria

- [ ] Botão "Exportar PDF" visível no header da tela de Modo Parto quando `wasActivated === true`
- [ ] Clique gera e baixa um PDF válido com todos os 8 tracks, sincronizados no mesmo eixo de tempo
- [ ] Linha de Alerta/Ação no PDF usa exatamente o mesmo algoritmo do gráfico em tela (via `computeAlertActionLines` compartilhado)
- [ ] `pnpm check-types` e `pnpm --filter web build` passam sem erros
- [ ] Nenhum novo pacote adicionado a `package.json` (reaproveita `@react-pdf/renderer`/`pdf-lib` já instalados)
- [ ] `getBirthModeTimelineAction` mantém o mesmo comportamento/shape de retorno após o refactor (Task 1-2)

---

## Completion Checklist

- [ ] Todas as 8 tasks completas em ordem de dependência
- [ ] Cada task validada com `pnpm check-types` imediatamente após a mudança
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 2: `biome lint --write --unsafe` sem warnings pendentes
- [ ] Level 3: `pnpm --filter web build` passa
- [ ] Level 5: Validação manual em navegador (PDF gerado e correto) feita
- [ ] Level 6: Teste de autorização (usuário sem acesso) feito
- [ ] Todos os critérios de aceite atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Desenho vetorial denso multi-track é genuinamente greenfield — sem precedente exato no repo, maior chance de ajustes visuais depois da primeira geração | H | M | Escopo do MVP aceita isso explicitamente (PRD já marca esta fase como concentrando esse risco); iterar visualmente após a primeira geração real, sem bloquear a entrega inicial |
| `@react-pdf/renderer` não suporta canvas/chart.js — todo o desenho precisa ser refeito com primitivas `Svg` | M | M | Mitigado reaproveitando só a lógica pura de dados (`resolveChartT0`/`hoursSince`/`computeAlertActionLines`), não o componente de gráfico em si; documentado explicitamente na Task 5 |
| Parto muito longo (>24h) ou com muitos eventos por track pode gerar um PDF ilegível (marcadores sobrepostos, eixo denso) | M | L | Aceito como limitação conhecida do MVP (ver NOT Building); sem paginação/anti-colisão nesta fase |
| Extrair `fetchBirthModeTimelineData` pode introduzir uma regressão sutil na action existente (`getBirthModeTimelineAction`) usada pela tela inteira (Partograma + Linha do tempo) | L | H | Task 2 é um refactor puro (mover código, não reescrever); validar manualmente que a tela de Modo Parto continua funcionando idêntica após a mudança, antes de prosseguir para as tasks de PDF |

---

## Notes

- Esta fase depende apenas da Fase 5 (agora completa) e é explicitamente "nice to have" no PRD — pode ser adiada sem bloquear o lançamento do MVP em tela, que já está completo (Fases 1-5).
- A extração de `fetchBirthModeTimelineData` e `computeAlertActionLines` (Tasks 1-4) é valiosa independentemente do PDF: remove duplicação de ~150 linhas de query/mapping e ~15 linhas de lógica clínica que já existiam apenas dentro de uma `next-safe-action` não reutilizável.
- O download via `Blob`/`<a download>` é código de aplicação real (não uma Artifact sandboxed) — sem restrição de plataforma para esse padrão.
- Layout `A4 landscape` foi escolhido por ser o formato mais comum para documentos multi-coluna/multi-track densos; ajustável na Task 5 se a equipe preferir `Letter` ou paisagem A3 após revisão visual.

---

*Generated: 2026-08-22*
