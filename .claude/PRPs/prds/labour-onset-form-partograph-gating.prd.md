# Registro de Início do Trabalho de Parto + Liberação Condicional do Partograma

## Problem Statement

Profissionais da equipe de cuidado ativam o "modo parto" para uma gestante sem registrar os eventos clínicos que desencadearam essa ativação (tipo de trabalho de parto, indução, contexto). Essa lacuna de documentação compromete auditorias e o resguardo legal da equipe. Em paralelo, o partograma é exibido e alimentado com dados desde o primeiro registro de contração/dilatação, mesmo antes de a gestante atingir os critérios clínicos mínimos (contração a cada 3 minutos e dilatação ≥ 5cm) que definem o início real da fase ativa do trabalho de parto — o que distorce o gráfico e a documentação clínica.

## Evidence

- Observação direta da equipe após os primeiros testes em produção do modo parto: a ativação ocorre hoje via um `confirm()` sem nenhum campo de captura de dados (`apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:56-72`).
- A tabela `pregnancies` já possui `birth_mode_active`/`birth_mode_activated_at`/`birth_mode_activated_by`, mas nenhuma coluna sobre a origem clínica da ativação.
- O tab "Partograma" (`birth-mode-screen.tsx:190-201`) hoje é sempre exibido assim que existe qualquer evento, sem checagem de limiar clínico.

## Proposed Solution

Duas mudanças conectadas ao fluxo de ativação do modo parto:

1. **Formulário de início do trabalho de parto**: ao clicar em ativar o modo parto, exibir um formulário (substituindo o `confirm()` atual) que captura tipo de trabalho de parto (espontâneo/induzido), tipo de indução (quando aplicável) e uma descrição livre. Esses dados são persistidos na mesma transação que ativa o modo parto, em novas colunas `birth_mode_*`/`labour_start_description` na tabela `pregnancies`.
2. **Liberação condicional do partograma**: o tab "Partograma" só fica visível/habilitado quando a gestante atinge contração a cada 3 minutos E dilatação ≥ 5cm. Uma vez atingido, o desbloqueio é permanente (high-water mark) — persistido via uma nova coluna (`partograph_unlocked_at`) setada pelas actions de registro de contração/dilatação. Dados registrados antes do desbloqueio continuam salvos e visíveis na "Linha do tempo", mas não entram no gráfico do partograma.

## Key Hypothesis

We believe **capturar os dados de início do trabalho de parto antes da ativação do modo parto** will **fechar a lacuna de documentação/auditoria** for **profissionais da equipe de cuidado**.
We'll know we're right when **100% das ativações de modo parto possuem `birth_mode_labour_type` e `labour_start_description` registrados**.

## What We're NOT Building

- **Edição posterior dos dados de início de parto** - fora de escopo por agora; uma vez registrado, o dado é imutável nesta v1.
- **Backfill de gestações já em modo parto ativo** - pregnancies já ativas antes do deploy não recebem esses dados retroativamente.
- **Painel de auditoria/relatórios sobre esses dados** - a captura é o foco; consumo analítico fica para uma iteração futura.
- **Re-bloqueio do partograma caso os indicadores regridam** - o desbloqueio é permanente (high-water mark), não há caminho de volta.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Ativações de modo parto com dados de início registrados | 100% | `birth_mode_labour_type` e `labour_start_description` não nulos em toda `pregnancies` com `birth_mode_active = true` a partir do deploy |
| Partogramas exibidos antes do limiar clínico | 0% | Nenhuma pregnancy com tab Partograma habilitado sem `partograph_unlocked_at` setado |

## Open Questions

- [ ] `labour_start_description` deve ser obrigatório no submit, ou apenas os campos estruturados (tipo/indução) são obrigatórios? (assumido como opcional nesta PRD — texto livre complementar)
- [ ] Existe necessidade de expor, na UI, *quando* o partograma foi desbloqueado (ex: badge "desbloqueado às HH:mm")? Não especificado no requisito original.

---

## Users & Context

**Primary User**
- **Who**: Profissional da equipe de cuidado (obstetra, enfermeira, doula — mesmos papéis que hoje podem ativar o modo parto: `isObstetrician || isNurse || isDoula`)
- **Current behavior**: Ativa o modo parto direto por um `confirm()` sem registrar nenhum dado clínico de contexto
- **Trigger**: Decisão clínica de que a gestante entrou em trabalho de parto (espontâneo ou induzido)
- **Success state**: O registro de início do parto fica documentado permanentemente, e o partograma só aparece quando clinicamente apropriado

**Job to Be Done**
When ativo o modo parto para uma gestante, eu quero visualizar um formulário para preencher os dados referentes ao início do trabalho de parto, so I can ter o registro documental do início do processo.

**Non-Users**
Gestantes, gestores e secretárias — não interagem com este formulário nem com a lógica de liberação do partograma.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Formulário pré-ativação: tipo de trabalho de parto (espontâneo/induzido) | Requisito explícito; determina o campo condicional seguinte |
| Must | Campo condicional: tipo de indução (Balão/Misoprostol/Ocitocina) quando induzido | Requisito explícito |
| Must | Campo de descrição livre | Requisito explícito, para contexto documental |
| Must | Persistência atômica: dados de início do parto + ativação do modo parto na mesma action | Evita estado inconsistente (modo parto ativo sem dados de origem) |
| Must | Tab "Partograma" oculto/desabilitado até atingir contração 3/3min + dilatação ≥5cm | Requisito explícito |
| Must | Dados registrados antes do limiar não entram no gráfico do partograma (mas persistem e aparecem na Linha do tempo) | Requisito explícito |
| Must | Desbloqueio do partograma é permanente (high-water mark), persistido em banco | Confirmado pelo usuário — evita "piscar" o tab caso indicadores regridam |
| Won't | Edição de `birth_mode_labour_type`/`induction_type`/`labour_start_description` após submissão | Fora de escopo v1 |
| Won't | Backfill de pregnancies já ativas | Fora de escopo v1 |

### MVP Scope

Ambas as capacidades (formulário + gating) entram juntas na mesma entrega — não há uma fase intermediária útil isoladamente, já que o gating depende dos dados já existentes de contração/dilatação e o formulário é um pré-requisito de UX para a ativação.

### User Flow

1. Profissional clica em "Abrir Modo Parto" no perfil da paciente.
2. Modal/formulário abre: seleciona tipo de trabalho de parto → se "Induzido", campo de tipo de indução aparece → preenche descrição (opcional).
3. Submit: uma única action persiste `birth_mode_labour_type`, `birth_mode_induction_type` (se aplicável), `labour_start_description`, e ativa `birth_mode_active`/`birth_mode_activated_at`/`birth_mode_activated_by` — replicando o comportamento atual (revalidatePath, notificações WhatsApp, evento PostHog).
4. Usuário é redirecionado para `/modo-parto`. O tab "Partograma" aparece desabilitado/oculto; "Linha do tempo" funciona normalmente desde o início.
5. Conforme contrações e dilatações são registradas, o sistema verifica se o limiar (3min + 5cm) foi atingido. Ao ser atingido pela primeira vez, `partograph_unlocked_at` é setado permanentemente na pregnancy, e o tab "Partograma" passa a ficar visível/habilitado, exibindo apenas eventos a partir do desbloqueio.

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- Formulário reutiliza o padrão já existente em `add-birth-medication-administration-modal.tsx` + `validations/birth-mode.ts` (enum → sub-campo condicional → texto livre, com `.refine()` para validação condicional).
- `activateBirthModeSchema`/`activateBirthModeAction` (`apps/web/src/actions/activate-birth-mode-action.ts`) são estendidos — não duplicados — para incluir os novos campos no mesmo `.update()` de `pregnancies`, preservando `revalidatePath`, `scheduleBirthModeActivationNotifications` e `captureServerEvent`.
- Nova migration adiciona à `pregnancies`: `birth_mode_labour_type` (enum: espontâneo/induzido), `birth_mode_induction_type` (enum nullable: balão/misoprostol/ocitocina), `labour_start_description` (text nullable), e `partograph_unlocked_at` (timestamptz nullable).
- Cálculo de "contração a cada 3 minutos" adapta `computeContractionsPer10Min` (`birth-mode-chart-utils.ts`) para uma janela/intervalo de 3 minutos. Checagem de dilatação usa o valor mais recente de `dilation_cm` em `birth_cervical_dilations`.
- O desbloqueio (`partograph_unlocked_at`) é setado dentro de `add-birth-contraction-action`/`add-birth-cervical-dilation-action` na primeira vez que a checagem combinada (contração + dilatação) passa, usando padrão "set apenas se ainda nulo" (idempotente, sem re-bloqueio).
- No client, `birth-mode-screen.tsx` usa `partograph_unlocked_at` (vindo do fetch inicial e mantido via realtime) para: (a) controlar `disabled`/visibilidade do `TabsTrigger` do Partograma; (b) filtrar o array `events` passado para `BirthModePartograph` (apenas eventos com timestamp ≥ desbloqueio), mantendo `BirthModeTimeline` sempre com o array completo.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dessincronia entre cálculo de gating no fetch inicial (servidor) e updates via realtime (cliente) | Medium | Replicar o mesmo padrão já usado para `contractions_per_10min` (recomputado em `onNewEvent`), mas para o gating usar prioritariamente o campo persistido `partograph_unlocked_at` em vez de recomputar do zero no cliente |
| Ativação do modo parto falhar após já ter mostrado sucesso do formulário (rollback parcial) | Low | Manter tudo em uma única query `.update()` atômica, como hoje |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Migration + tipos | Adicionar colunas `birth_mode_labour_type`, `birth_mode_induction_type`, `labour_start_description`, `partograph_unlocked_at` em `pregnancies`; regenerar `database.types.ts` | complete | - | - | `.claude/PRPs/plans/completed/labour-onset-form-partograph-gating-phase-1.plan.md` |
| 2 | Formulário de início de parto | Novo componente de formulário + extensão de `activateBirthModeSchema`/`activateBirthModeAction`; substituir `confirm()` em `patients/[id]/profile/page.tsx` | pending | - | 1 | - |
| 3 | Cálculo e persistência do gating | Função de intervalo de 3min em `birth-mode-chart-utils.ts`; lógica de "set se nulo" em `add-birth-contraction-action`/`add-birth-cervical-dilation-action`; incluir `partograph_unlocked_at` no retorno de `fetchBirthModeTimelineData` | pending | - | 1 | - |
| 4 | Gating na UI do modo parto | `birth-mode-screen.tsx`: desabilitar/ocultar tab Partograma e filtrar `events` passados a `BirthModePartograph` conforme `partograph_unlocked_at`; manter sincronismo via realtime | pending | - | 3 | - |

### Phase Details

**Phase 1: Migration + tipos**
- **Goal**: Base de dados pronta para as duas features
- **Scope**: Uma migration SQL, `pnpm db:types`
- **Success signal**: `pnpm check-types` passa; colunas visíveis via `mcp__supabase__list_tables`

**Phase 2: Formulário de início de parto**
- **Goal**: Ativação do modo parto passa a exigir/capturar tipo de trabalho de parto, indução e descrição
- **Scope**: Componente de formulário (padrão modal existente), extensão de schema/action, troca do call site
- **Success signal**: Ativar modo parto sem preencher tipo de trabalho de parto é bloqueado; dados aparecem em `pregnancies` após ativação

**Phase 3: Cálculo e persistência do gating**
- **Goal**: Sistema sabe, de forma persistida e monotônica, quando os critérios clínicos foram atingidos
- **Scope**: Função de intervalo de 3min, atualização das duas add-actions, propagação do campo pelo fetch de timeline
- **Success signal**: Ao inserir contrações a cada 3min e dilatação ≥5cm, `partograph_unlocked_at` é setado uma única vez e não regride

**Phase 4: Gating na UI do modo parto**
- **Goal**: Tab do Partograma reflete o estado de desbloqueio; gráfico exclui eventos pré-desbloqueio
- **Scope**: `birth-mode-screen.tsx` e fluxo realtime
- **Success signal**: Antes do limiar, tab oculto/desabilitado e sem dados no gráfico; após o limiar, tab habilitado permanentemente com apenas eventos pós-desbloqueio no gráfico, e todos os eventos na Linha do tempo

### Parallelism Notes

Fases são majoritariamente sequenciais pois cada uma depende de schema/dados da anterior. Fases 2 e 3 poderiam, em tese, rodar em paralelo em worktrees separados após a Fase 1 (tocam arquivos diferentes — formulário de ativação vs. actions de contração/dilatação), mas a Fase 4 depende da Fase 3 estar completa.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Ativação do modo parto: uma action ou duas? | Estender `activateBirthModeAction` existente | Nova action separada | Mesma linha de `pregnancies`, mesmo `revalidatePath`/notificações/analytics — evitar duplicação e risco de dessincronia |
| Comportamento do desbloqueio do partograma ao regredir indicadores | High-water mark (permanente) | Reavaliação contínua (pode re-esconder) | Confirmado pelo usuário — condiz com realidade clínica: trabalho de parto não "desfaz" |
| Persistência do gating | Nova coluna `partograph_unlocked_at` em `pregnancies` | Recomputar do histórico a cada carregamento | Não existe padrão de "monotonic max" no codebase; recomputar não é naturalmente monotônico se a última dilatação regredir |
| Filtragem do gráfico vs. timeline | Timeline sempre mostra tudo; apenas o gráfico do partograma filtra por `partograph_unlocked_at` | Filtrar em ambos | Requisito explícito: dados continuam registrados e auditáveis, só não entram no partograma |

---

## Research Summary

**Market Context**
Não aplicável — feature interna de fluxo clínico específico do produto, sem necessidade de benchmark externo para esta PRD.

**Technical Context**
- Ativação do modo parto hoje é um `confirm()` sem campos, chamando `activateBirthModeAction` (`apps/web/src/actions/activate-birth-mode-action.ts:9-36`).
- `pregnancies` já tem `birth_mode_active`/`birth_mode_activated_at`/`birth_mode_activated_by`/`birth_mode_ended_at` (migration `20260822000002_pregnancies_add_birth_mode_state.sql`); novas colunas serão adicionadas nesta mesma tabela.
- Tab "Partograma" hoje sempre visível assim que há eventos (`birth-mode-screen.tsx:190-201`), sem qualquer gating.
- Frequência de contração já é derivada (não armazenada) via `computeContractionsPer10Min` (`birth-mode-chart-utils.ts:38-52`); dilatação é lida diretamente de `birth_cervical_dilations.dilation_cm`.
- Padrão de formulário condicional de referência: `add-birth-medication-administration-modal.tsx` + `birthMedicationAdministrationSchema` em `validations/birth-mode.ts`.
- Não existe no codebase nenhum padrão de "high water mark"/flag monotônico persistido — esta feature introduz o primeiro caso, via `partograph_unlocked_at`.

---

*Generated: 2026-08-23*
*Status: DRAFT - needs validation*
