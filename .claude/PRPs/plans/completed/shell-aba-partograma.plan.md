# Feature: Shell da Aba Partograma

## Summary

Introduzir uma navegação por abas ("Partograma" / "Linha do tempo") na tela de modo parto (`birth-mode-screen.tsx`), reutilizando o componente `Tabs` já existente em `@ventre/ui/tabs`, e criar a estrutura vazia de mini-sessões do partograma (título + card placeholder por track clínico), sem plotar nenhum gráfico ainda. Esta é a Fase 2 do PRD `partograma-modo-parto`, que roda em paralelo com a Fase 1 (já completa) e é pré-requisito para as Fases 3 e 4 (mini-gráficos).

## User Story

As a profissional da equipe de cuidado (enfermagem obstétrica/obstetra) em modo parto
I want to alternar entre uma visão de "Partograma" e a "Linha do tempo" já existente
So that eu tenha, no futuro (Fases 3/4), uma leitura visual rápida da progressão do parto, sem perder a lista cronológica que já uso hoje

## Problem Statement

Hoje `birth-mode-screen.tsx` renderiza direto a `BirthModeTimeline`, sem nenhum mecanismo de navegação. Não existe ponto de extensão para introduzir o partograma visual sem quebrar a timeline existente.

## Solution Statement

Envolver a área de exibição de eventos (hoje só `BirthModeTimeline`) em um componente `Tabs` do Shadcn/Radix já usado no projeto (`invites-screen.tsx`, `gestational-weight-gain-chart.tsx`), com duas abas: "Partograma" (nova, default) e "Linha do tempo" (comportamento atual, sem alteração). A aba "Partograma" renderiza um novo componente `BirthModePartograph`, que lista 8 mini-sessões (uma por track clínico do modelo de referência), cada uma um `Card` com título + ícone + um placeholder de "gráfico em breve" — a ser preenchido pelas Fases 3 e 4.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                          |
| Complexity       | LOW                                                                     |
| Systems Affected | `apps/web/src/screens/birth-mode-screen.tsx`, `apps/web/src/components/shared/` (novo componente) |
| Dependencies     | `@radix-ui/react-tabs@^1.1.2` (via `@ventre/ui/tabs`, já em uso), nenhuma lib nova |
| Estimated Tasks  | 3                                                                       |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║   ┌──────────────────┐      ┌────────────────────┐      ┌───────────────────┐  ║
║   │ BirthModeScreen  │ ───► │ BirthModeRegister-  │ ───► │ BirthModeTimeline │  ║
║   │ (header, badge)  │      │ Buttons (registra)  │      │ (lista cronológ.) │  ║
║   └──────────────────┘      └────────────────────┘      └───────────────────┘  ║
║                                                                                  ║
║   USER_FLOW: Usuário abre o modo parto, registra eventos pelos modais, e vê    ║
║   apenas uma lista cronológica plana de todos os eventos, do mais recente ao   ║
║   mais antigo.                                                                  ║
║   PAIN_POINT: Não há como agrupar/visualizar os eventos por track clínico      ║
║   (dilatação, BCF, etc). Para entender a progressão, é preciso ler a lista     ║
║   inteira mentalmente.                                                          ║
║   DATA_FLOW: getBirthModeTimelineAction → events[] → BirthModeTimeline (lista)  ║
║                                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                       ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                  ║
║   ┌──────────────────┐      ┌────────────────────┐      ┌───────────────────┐  ║
║   │ BirthModeScreen  │ ───► │ BirthModeRegister-  │ ───► │  <Tabs>           │  ║
║   │ (header, badge)  │      │ Buttons (registra)  │      │                   │  ║
║   └──────────────────┘      └────────────────────┘      └─────────┬─────────┘  ║
║                                                                     │            ║
║                          ┌──────────────────────────────────────────┴─────┐     ║
║                          ▼                                                ▼     ║
║              ┌────────────────────────┐                    ┌─────────────────┐  ║
║              │ Tab: "Partograma"      │  ◄── NOVA          │ Tab: "Linha do  │  ║
║              │ (default)              │                    │  tempo"          │  ║
║              │ BirthModePartograph    │                    │ BirthModeTimeline│  ║
║              │  - Card: Dilatação/    │                    │ (sem alteração)  │  ║
║              │    Estação (placeholder)│                   └─────────────────┘  ║
║              │  - Card: BCF (placeh.) │                                        ║
║              │  - Card: Contrações... │                                        ║
║              │  - (8 mini-sessões)    │                                        ║
║              └────────────────────────┘                                        ║
║                                                                                  ║
║   USER_FLOW: Usuário abre o modo parto e cai por padrão na aba "Partograma",   ║
║   vendo a estrutura de 8 mini-sessões (título + placeholder). Pode alternar     ║
║   para "Linha do tempo" para ver a lista cronológica exatamente como hoje.      ║
║   VALUE_ADD: Prepara o terreno visual/estrutural para as Fases 3-4 plotarem     ║
║   os mini-gráficos reais, sem regressão na timeline existente.                  ║
║   DATA_FLOW: getBirthModeTimelineAction → events[] → (Tabs) →                  ║
║     "Partograma": events[] → BirthModePartograph (estrutura only, Fase 2)      ║
║     "Linha do tempo": events[] → BirthModeTimeline (idêntico a hoje)           ║
║                                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location                 | Before                          | After                                                   | User_Action              | Impact                                                     |
| ------------------------ | -------------------------------- | -------------------------------------------------------- | ------------------------ | ----------------------------------------------------------- |
| `birth-mode-screen.tsx`  | Só renderiza `BirthModeTimeline` | Renderiza `Tabs` com "Partograma" (default) e "Linha do tempo" | Nenhuma ação nova exigida | Vê a estrutura de mini-sessões vazias; timeline preservada |
| Novo componente          | Não existe                       | `BirthModePartograph` com 8 `Card`s placeholder           | Clica na aba "Partograma" | Enxerga os 8 tracks clínicos que serão plotados nas Fases 3/4 |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File                                                                 | Lines   | Why Read This                                                        |
| -------- | --------------------------------------------------------------------- | ------- | ------------------------------------------------------------------- |
| P0       | `apps/web/src/screens/birth-mode-screen.tsx`                         | 1-142   | Arquivo a modificar — entender o fluxo completo antes de editar      |
| P0       | `apps/web/src/screens/invites-screen.tsx`                             | 111-132 | Padrão de uso de `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` a copiar |
| P1       | `packages/ui/src/tabs.tsx`                                             | 1-58    | Componente `Tabs` já existente — não recriar, apenas importar        |
| P1       | `packages/ui/src/card.tsx`                                             | 1-56    | `Card`/`CardHeader`/`CardTitle`/`CardContent` a usar nas mini-sessões |
| P1       | `apps/web/src/lib/birth-mode-constants.ts`                             | 46-97   | `BirthEventType`, `BIRTH_EVENT_CONFIG` (ícones/cores) a reaproveitar  |
| P2       | `apps/web/src/components/shared/birth-mode-timeline.tsx`               | 1-30, 121-162 | Como `BirthModeTimelineEvent`/`payload` são tipados e consumidos |
| P2       | `apps/web/src/components/shared/empty-state.tsx`                      | all     | Padrão de estado vazio, caso necessário para placeholder            |
| P2       | `apps/web/src/actions/get-birth-mode-timeline-action.ts`               | 1-17    | Tipo `BirthModeTimelineEvent` exportado, usado como prop do novo componente |

**External Documentation:**

Nenhuma pesquisa externa necessária — `@radix-ui/react-tabs` já é dependência em uso (`apps/web/package.json:35`, `^1.1.2`) e o wrapper `Tabs` de `packages/ui/src/tabs.tsx` já encapsula o comportamento de acessibilidade (Radix cuida de roving tabindex/ARIA nativamente). Nenhuma lib nova é introduzida nesta fase.

---

## Patterns to Mirror

**TABS_USAGE:**

```tsx
// SOURCE: apps/web/src/screens/invites-screen.tsx:12,119-130
// COPY THIS PATTERN:
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventre/ui/tabs";

<Tabs defaultValue="professionals">
  <TabsList className="mb-4 w-full max-w-xs">
    <TabsTrigger value="professionals">Profissionais</TabsTrigger>
    <TabsTrigger value="patients">Gestantes</TabsTrigger>
  </TabsList>

  <TabsContent value="professionals" className="space-y-8">
    {/* ... */}
  </TabsContent>
  <TabsContent value="patients" className="space-y-6">
    {/* ... */}
  </TabsContent>
</Tabs>
```

**CARD_SECTION_PATTERN:**

```tsx
// SOURCE: packages/ui/src/card.tsx:5-56 (componente); uso análogo em
// apps/web/src/components/shared/prenatal-card.tsx:116-118 (SectionCard wrapper)
// COPY THIS PATTERN (adaptado para mini-sessão com ícone):
import { Card, CardContent, CardHeader, CardTitle } from "@ventre/ui/card";

<Card>
  <CardHeader className="pb-2">
    <CardTitle className="flex items-center gap-2 text-base">
      <Icon className={`h-4 w-4 ${colorClass}`} />
      {title}
    </CardTitle>
  </CardHeader>
  <CardContent className="pt-0">{/* placeholder do mini-gráfico */}</CardContent>
</Card>
```

**EVENT_CONFIG_REUSE:**

```tsx
// SOURCE: apps/web/src/lib/birth-mode-constants.ts:59-82
// Reaproveitar ícones/cores já definidos por tipo de evento, em vez de inventar novos:
export const BIRTH_EVENT_CONFIG: Record<
  BirthEventType,
  { label: string; icon: LucideIcon; colorClass: string }
> = {
  contraction: { label: "Contração", icon: Activity, colorClass: "text-pink-500" },
  cervical_dilation: { label: "Dilatação cervical", icon: Ruler, colorClass: "text-purple-500" },
  fetal_station: { label: "Altura de apresentação (Lee)", icon: Baby, colorClass: "text-orange-500" },
  fetal_heart_rate: { label: "BCF", icon: HeartPulse, colorClass: "text-red-500" },
  // ...
};
```

**COMPONENT_FILE_STRUCTURE (client component "use client"):**

```tsx
// SOURCE: apps/web/src/components/shared/birth-mode-timeline.tsx:1-16
// COPY THIS PATTERN (imports/estrutura do arquivo):
"use client";

import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
import { BIRTH_EVENT_CONFIG } from "@/lib/birth-mode-constants";
// ...
```

---

## Files to Change

| File                                                              | Action | Justification                                                                 |
| ------------------------------------------------------------------ | ------ | ------------------------------------------------------------------------------ |
| `apps/web/src/components/shared/birth-mode-partograph.tsx`         | CREATE | Novo componente com a config de 8 mini-sessões e o placeholder de cada uma     |
| `apps/web/src/screens/birth-mode-screen.tsx`                        | UPDATE | Envolver a área de exibição em `Tabs`, com "Partograma" (default) e "Linha do tempo" |

---

## NOT Building (Scope Limits)

- **Nenhum gráfico real (chart.js)** — os cards de mini-sessão são placeholders estáticos; os mini-gráficos são as Fases 3 e 4.
- **Nenhuma lógica de agrupamento/filtragem de eventos por track** (ex: separar `medication` em ocitocina vs. outras) — isso é necessário só quando os mini-gráficos forem implementados (Fases 3/4), que já terão os dados de payload por evento.
- **Nenhuma mudança em `getBirthModeTimelineAction`** — já foi estendido na Fase 1; nenhum campo novo é necessário para a estrutura vazia.
- **Nenhuma mudança em `BirthModeTimeline`** — deve continuar funcionando exatamente como hoje, apenas dentro de uma `TabsContent`.
- **Nenhum polimento responsivo além do já existente no `Card`/`Tabs`** — isso é escopo da Fase 5 ("Tempo real + polimento mobile/tablet").

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

### Task 1: CREATE `apps/web/src/components/shared/birth-mode-partograph.tsx`

- **ACTION**: CREATE novo componente client
- **IMPLEMENT**:
  - Um array de configuração local `BIRTH_PARTOGRAPH_SESSIONS: { id: string; title: string; icon: LucideIcon; colorClass: string }[]` com as 8 mini-sessões, na ordem do modelo clínico de referência:
    1. `dilation_station` — "Dilatação Cervical & Estação Fetal" (ícone `Ruler`, reaproveitar `colorClass` de `cervical_dilation` em `BIRTH_EVENT_CONFIG`)
    2. `fetal_heart_rate` — "Frequência Cardíaca Fetal (BCF)" (ícone/cor de `BIRTH_EVENT_CONFIG.fetal_heart_rate`)
    3. `contraction` — "Contrações" (ícone/cor de `BIRTH_EVENT_CONFIG.contraction`)
    4. `oxytocin` — "Ocitocina" (ícone `Waves`, cor de `BIRTH_EVENT_CONFIG.medication`)
    5. `medication` — "Medicações" (mesmo ícone/cor de `BIRTH_EVENT_CONFIG.medication`)
    6. `membrane_rupture` — "Bolsa Rota & Líquido Amniótico" (ícone/cor de `BIRTH_EVENT_CONFIG.membrane_rupture`)
    7. `maternal_vitals` — "Vitais Maternos" (ícone/cor de `BIRTH_EVENT_CONFIG.maternal_vitals`)
    8. `urine_test` — "Urina" (ícone/cor de `BIRTH_EVENT_CONFIG.urine_test`)
  - Um componente exportado `BirthModePartograph({ events }: { events: BirthModeTimelineEvent[] })` que:
    - Recebe `events` (mesma prop que `BirthModeTimeline` já recebe) para manter a assinatura simétrica e permitir que Fases 3/4 usem os dados sem re-plumbing na tela — mas NÃO processa/filtra os eventos ainda nesta fase (parâmetro recebido e não utilizado no corpo é aceitável aqui pois documenta o contrato futuro; adicionar comentário curto explicando).
    - Renderiza um `<div className="space-y-3">` com um `Card` por mini-sessão (usar `CARD_SECTION_PATTERN` acima).
    - Cada `CardContent` mostra um placeholder: `<div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-xs">Gráfico em breve</div>`.
- **MIRROR**: `apps/web/src/components/shared/birth-mode-timeline.tsx:1-16` (estrutura de arquivo/imports), `packages/ui/src/card.tsx:5-56` (componentes de Card)
- **IMPORTS**:
  ```tsx
  import type { BirthModeTimelineEvent } from "@/actions/get-birth-mode-timeline-action";
  import { BIRTH_EVENT_CONFIG } from "@/lib/birth-mode-constants";
  import { Card, CardContent, CardHeader, CardTitle } from "@ventre/ui/card";
  import { Ruler, HeartPulse, Activity, Waves, Droplet, TestTube, type LucideIcon } from "lucide-react";
  ```
- **GOTCHA**: `BIRTH_EVENT_CONFIG` é `Record<BirthEventType, ...>` — os ids `oxytocin`/`dilation_station` da nova config NÃO são `BirthEventType` (são agrupamentos de exibição), então a nova config deve ser um tipo próprio, não reaproveitar `BirthEventType` como chave. Não tentar indexar `BIRTH_EVENT_CONFIG["oxytocin"]` (não existe) — usar `BIRTH_EVENT_CONFIG.medication` explicitamente para os dois ids `oxytocin` e `medication`.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/screens/birth-mode-screen.tsx`

- **ACTION**: MODIFY para introduzir `Tabs` ao redor da área de exibição (linhas 128-134 hoje: bloco `isPending && events.length === 0 ? <Skeleton/> : <BirthModeTimeline events={events} />`)
- **IMPLEMENT**:
  - Adicionar imports: `import { Tabs, TabsContent, TabsList, TabsTrigger } from "@ventre/ui/tabs";` e `import { BirthModePartograph } from "@/components/shared/birth-mode-partograph";`
  - Substituir o bloco condicional atual por:
    ```tsx
    {isPending && events.length === 0 ? (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    ) : (
      <Tabs defaultValue="partograph">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="partograph">Partograma</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
        </TabsList>
        <TabsContent value="partograph">
          <BirthModePartograph events={events} />
        </TabsContent>
        <TabsContent value="timeline">
          <BirthModeTimeline events={events} />
        </TabsContent>
      </Tabs>
    )}
    ```
  - Não alterar mais nada no arquivo (header, badges, `BirthModeRegisterButtons`, `FinishCareModal` permanecem fora do `Tabs`, exatamente como hoje).
- **MIRROR**: `apps/web/src/screens/invites-screen.tsx:119-130`
- **IMPORTS**: ver acima
- **GOTCHA**: Manter o `Skeleton` de loading FORA do `Tabs` (como já está) — só a troca é do conteúdo pós-loading. Não envolver o skeleton em `TabsContent`, ou a UI de loading vai piscar comportamento de aba antes dos dados chegarem.
- **VALIDATE**: `pnpm check-types`

### Task 3: VALIDATE manualmente no browser

- **ACTION**: Rodar a tela de modo parto localmente e verificar visualmente
- **IMPLEMENT**: N/A (validação manual)
- **MIRROR**: N/A
- **GOTCHA**: Testar em viewport mobile (< 640px) e desktop — confirmar que a `TabsList` não quebra layout e que a aba "Linha do tempo" continua idêntica à versão atual (sem regressão)
- **VALIDATE**: Ver seção "Level 5: BROWSER_VALIDATION" abaixo

---

## Testing Strategy

Esta fase é puramente estrutural/visual (shell de UI), sem lógica de negócio nova, sem novas server actions, sem novos schemas Zod. Não há unit tests novos a escrever — os componentes são apresentacionais (props in, JSX out), sem branching lógico além do map estático das 8 mini-sessões.

### Edge Cases Checklist

- [ ] `events` vazio (`[]`) — `BirthModePartograph` deve renderizar as 8 mini-sessões normalmente (placeholder não depende de haver eventos)
- [ ] `events` com dados reais (Modo Parto já ativo com registros) — aba "Linha do tempo" deve continuar mostrando exatamente os mesmos itens de antes
- [ ] Alternância rápida entre abas (clicar Partograma → Linha do tempo → Partograma) — não deve perder estado de `events` (já vem de `useState` no componente pai, fora do `Tabs`)
- [ ] `wasActivated === false` (Modo Parto não ativado) — tela already retorna `EmptyState` antes de chegar no bloco de `Tabs`; não deve ser afetado por esta mudança (ver `birth-mode-screen.tsx:74-83`)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/components/shared/birth-mode-partograph.tsx apps/web/src/screens/birth-mode-screen.tsx
```

**EXPECT**: Exit 0, no errors or warnings

### Level 2: UNIT_TESTS

N/A — não há suíte de testes automatizados de componentes neste projeto (ver `apps/web/package.json` — sem `test` script para componentes React). Validação é via `check-types` + `lint` + validação manual em browser.

### Level 3: FULL_SUITE

```bash
pnpm check-types
```

**EXPECT**: Todos os pacotes (`web`, `admin`, `ui`, `docs`, `storybook`) type-check sem erros

### Level 4: DATABASE_VALIDATION

N/A — nenhuma mudança de schema nesta fase.

### Level 5: BROWSER_VALIDATION

Usar Browser MCP (ou navegador manual) para verificar:

- [ ] Abrir uma gestação com Modo Parto ativo (`/patients/{id}` → aba modo parto, ou rota equivalente que renderiza `BirthModeScreen`)
- [ ] Confirmar que a aba "Partograma" abre por padrão, mostrando 8 cards com título + ícone + "Gráfico em breve"
- [ ] Clicar em "Linha do tempo" e confirmar que a lista cronológica aparece idêntica ao comportamento anterior (mesmos eventos, mesma ordenação, mesmo horário/autor)
- [ ] Redimensionar para viewport mobile (< 640px) e confirmar que a `TabsList` ocupa a largura disponível sem overflow horizontal
- [ ] Confirmar que `BirthModeRegisterButtons` e o botão "Registrar Nascimento" continuam funcionando normalmente (fora do `Tabs`, sem regressão)

### Level 6: MANUAL_VALIDATION

- [ ] Registrar um novo evento (ex: contração) via modal existente e confirmar que ele aparece na aba "Linha do tempo" via realtime, exatamente como antes (a mudança não deve interferir com `useBirthModeTimelineRealtime`, que já injeta no mesmo `events` state compartilhado pelas duas abas)

---

## Acceptance Criteria

- [ ] `birth-mode-screen.tsx` renderiza `Tabs` com "Partograma" (default) e "Linha do tempo"
- [ ] `BirthModePartograph` novo componente renderiza 8 mini-sessões com título + ícone + placeholder
- [ ] `BirthModeTimeline` continua funcionando sem nenhuma alteração de comportamento dentro de `TabsContent value="timeline"`
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma regressão visual/funcional na timeline existente
- [ ] UX corresponde ao diagrama "After State"

---

## Completion Checklist

- [ ] Task 1 completa e validada (`pnpm check-types`)
- [ ] Task 2 completa e validada (`pnpm check-types`)
- [ ] Task 3 (validação manual/browser) completa
- [ ] Level 1: Static analysis (lint + type-check) passa
- [ ] Level 5: Browser validation passa
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk                                                                                     | Likelihood | Impact | Mitigation                                                                                     |
| ------------------------------------------------------------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------ |
| Regressão visual na `BirthModeTimeline` ao envolvê-la em `TabsContent`                      | LOW        | MEDIUM | `TabsContent` não adiciona nenhum estilo que afete o filho além de `mt-2` (ver `packages/ui/src/tabs.tsx:44-53`) — comportamento validado manualmente no Task 3 |
| Nomenclatura das 8 mini-sessões não bater exatamente com o que as Fases 3/4 esperam        | LOW        | LOW    | Ids (`dilation_station`, `oxytocin`, etc.) documentados nesta fase; Fases 3/4 podem renomear/reagrupar se necessário, sem custo de migração (é só config local, não persistida) |
| `BirthModePartograph` receber `events` sem uso (parâmetro não utilizado) pode disparar warning do Biome (`noUnusedVariables`) | MEDIUM     | LOW    | Usar o parâmetro ao menos para calcular contagem de eventos por sessão (ex: badge opcional) OU prefixar com `_events` se realmente não for usado — preferir a primeira opção para já sinalizar visualmente que a mini-sessão tem dados aguardando gráfico (ex: `{count} registro(s)` abaixo do placeholder) |

---

## Notes

- A contagem de eventos por mini-sessão (mencionada na mitigação acima) é uma pequena antecipação útil: como `events` já está disponível, mostrar `"3 registros aguardando gráfico"` em vez de só "Gráfico em breve" dá feedback real ao usuário sobre dados já capturados, sem exigir nenhuma lógica de charting. Isso é opcional mas recomendado para o Task 1.
- Os ids de mini-sessão (`dilation_station`, `fetal_heart_rate`, `contraction`, `oxytocin`, `medication`, `membrane_rupture`, `maternal_vitals`, `urine_test`) foram escolhidos para bater 1:1 com a decomposição de tracks da Fase 4 do PRD (`BIRTH_EVENT_CONFIG` tem `medication` único para ocitocina e outras medicações — a separação visual em "Ocitocina" vs "Medicações" é uma decisão de agrupamento de exibição desta fase, já antecipando o requisito explícito do PRD de tracks separados).
