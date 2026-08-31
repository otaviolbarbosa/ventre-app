# Dinâmica Uterina — Registro em Lote com Notação DU

## Problem Statement

Médicas obstetras e enfermeiras obstétricas registrando dinâmica uterina durante o trabalho de parto ativo precisam interromper o cuidado à paciente para acessar o dispositivo a cada contração — em alguns casos, 3-4 vezes a cada 10 minutos. Além do custo de atenção, a reconstrução de datas/horários exatos quando o registro é feito com atraso é propensa a erro, e o gráfico atual (linha temporal de duração por contração) não corresponde ao formato de matriz que a equipe obstétrica já usa e reconhece (notação DU, grade WHO).

## Evidence

- Feedback direto de uso em campo: profissionais relataram que a granularidade de registro por contração individual exige sincronicidade incompatível com o ambiente de parto.
- Reconstrução de datetime após o fato é uma fonte reconhecida de erro pela equipe técnica (relato direto do usuário/PM do produto).
- Pesquisa de mercado confirma que a notação "DU 3/10/30" (contrações/janela/duração) é o padrão real de registro obstétrico no Brasil (protocolos CAISM-Unicamp, ME-UFRJ) e que o próprio padrão WHO já é periódico (a cada 30 min), não contínuo — validando que o registro em lote é alinhado à prática clínica, não uma solução de compromisso.
- O código já contém, na camada de exportação de PDF (`partograph-overlay-svg.ts:213-262`), uma grade de 5 linhas empilhadas por coluna para contrações — evidência de que esse formato de matriz já é reconhecido como o formato correto de visualização dentro do próprio produto, apenas não exposto como gráfico interativo.

## Proposed Solution

Uma nova tabela `birth_uterine_activity` e um novo par modal/gráfico, ativados por uma feature flag `show_uterine_activity` (global, PostHog), substituem — apenas quando a flag está ativa — o fluxo atual de registro por contração individual (`birth_contractions` / `add-birth-contraction-modal.tsx` / `birth-mode-contraction-chart.tsx`), que permanece intocado e funcional quando a flag está desativada. O novo modal captura 3 campos por registro (quantidade de contrações, intervalo de tempo fixo em 10/20/30 min, array de durações em segundos), calcula e exibe a notação DU (`DU 3/10'/50"`) em destaque, e — quando o intervalo é 20 ou 30 min — decompõe o registro em sub-notações de 10 em 10 minutos. O novo gráfico é uma matriz de 6 linhas × n colunas (uma coluna por bloco de 10 minutos), preenchida de baixo para cima com ◢ (contrações intermediárias, 20-40s) ou ■ (contrações efetivas, >40s); contrações <20s não são exibidas. Esta é a abordagem escolhida em vez de adaptar o gráfico de linha do Chart.js existente porque a matriz é o formato que a equipe obstétrica já reconhece e porque o Chart.js não suporta nativamente células de preenchimento parcial empilhadas.

## Key Hypothesis

Acreditamos que o registro em lote com notação DU e visualização em matriz vai reduzir o atrito e os erros de documentação durante o parto ativo para médicas obstetras e enfermeiras obstétricas.
Vamos saber que estamos certos quando observarmos tempo de registro mais rápido (menos interações com o dispositivo por hora de trabalho de parto) e adoção sustentada da funcionalidade após habilitação da flag.

## What We're NOT Building

- Alteração na exibição de dados no PDF do partograma — mantido apontando para `birth_contractions` / `partograph-overlay-svg.ts` sem modificação. Motivo: escopo explicitamente adiado para próxima iteração pelo requisito original.
- Migração ou backfill de dados históricos de `birth_contractions` para `birth_uterine_activity`. Motivo: as duas tabelas coexistem por design; a tabela antiga não é descartada.
- Rollout segmentado por clínica/usuário da flag `show_uterine_activity`. Motivo: confirmado pelo usuário como flag global.
- Gating server-side/rota (como o gate de doulas em `modo-parto/page.tsx`) para esta flag. Motivo: ambos os fluxos (antigo e novo) permanecem funcionais e autorizados — a flag apenas escolhe qual é renderizado, não bloqueia acesso.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Tempo médio de registro por evento de dinâmica uterina | Redução mensurável vs. baseline do fluxo atual | Evento PostHog `add_birth_uterine_activity` (mirror de `add_birth_contraction`) com timestamp de abertura/submissão do modal |
| Adoção da funcionalidade após habilitação da flag | Uso sustentado (não apenas pico inicial) nos partos acompanhados após rollout | Contagem de registros em `birth_uterine_activity` por semana/por profissional via PostHog/analytics |
| Feedback qualitativo da equipe técnica | Feedback positivo predominante | Coleta direta com profissionais (canal já usado para feedback do produto) |

## Open Questions

- [ ] Nenhuma pendência identificada pelo usuário no momento da criação deste PRD — validação de exatidão clínica da notação DU e dos limiares de duração (20s/40s) já herdados do enum existente `birth_contraction_effectiveness`, não questionados nesta rodada.

---

## Users & Context

**Primary User**
- **Who**: Profissionais técnicas presentes no parto — médicas obstetras e enfermeiras obstétricas.
- **Current behavior**: Registram cada contração individualmente (duração + data/hora) via `add-birth-contraction-modal.tsx`, muitas vezes com atraso em relação ao momento real da contração.
- **Trigger**: Ao observar/palpar uma janela de contrações (10, 20 ou 30 minutos) durante o acompanhamento do trabalho de parto ativo.
- **Success state**: Preenchem um formulário simples de 3 campos, veem a notação DU calculada instantaneamente, e a informação alimenta a matriz visual usada para acompanhamento e tomada de decisão.

**Job to Be Done**
Quando eu recebo os dados de dinâmica uterina durante o acompanhamento do parto, eu quero preencher um formulário simples e registrar esses dados em lote, para que eu possa visualizar a informação em formato de matriz e apoiar a tomada de decisão da equipe durante o parto ativo, além de manter o registro disponível para o partograma futuramente.

**Non-Users**
Staff administrativo, doulas e gestantes — dinâmica uterina é uma informação de registro clínico/técnico, não voltada a esses perfis nesta implementação.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Feature flag `show_uterine_activity` (global, PostHog) alternando modal e gráfico | Mecanismo de rollout controlado sem descartar a implementação atual |
| Must | Nova tabela `birth_uterine_activity` (quantidade de contrações, intervalo, array de durações) | Base de dados para o novo formato de registro |
| Must | Novo modal `add-birth-uterine-activity-modal.tsx` com 3 campos + notação DU em destaque | Interface de registro em lote de baixo atrito |
| Must | Cálculo/decomposição da notação DU em sub-blocos de 10 min quando intervalo = 20 ou 30 min | Fidelidade ao padrão clínico real (protocolos CAISM/ME-UFRJ) |
| Must | Novo gráfico em matriz (6 linhas × n colunas, ◢/■, preenchimento de baixo para cima) reativo à flag | Visualização no formato reconhecido pela equipe obstétrica |
| Won't | Alteração no PDF do partograma | Adiado explicitamente para próxima iteração |
| Won't | Migração/backfill de `birth_contractions` para a nova tabela | Tabelas coexistem por design |

### MVP Scope

O conjunto completo definido acima — flag, tabela, modal, notação e gráfico matriz — é o MVP; o usuário confirmou que não há redução de escopo aceitável (todos os itens são "must have").

### User Flow

1. Profissional clica no botão "Dinâmica Uterina" (botão existente, sem mudança de posição/label).
2. Se `show_uterine_activity` está ativa: abre `add-birth-uterine-activity-modal.tsx`; senão, abre o modal atual (`add-birth-contraction-modal.tsx`), sem mudança de comportamento.
3. No novo modal, profissional informa: quantidade de contrações, intervalo (10/20/30 min), e as durações individuais (segundos) de cada contração.
4. Notação DU é calculada e exibida em destaque em tempo real conforme os campos são preenchidos (com decomposição em múltiplas notações se intervalo > 10 min).
5. Ao submeter, o registro é persistido em `birth_uterine_activity` e o evento passa a compor a matriz visual (mesma reatividade à flag) e a timeline de eventos do parto.

---

## Technical Approach

**Feasibility**: MEDIUM-HIGH

**Architecture Notes**
- A camada de dados (tabela, server action, modal, agregação de timeline) segue diretamente o padrão existente de `birth_contractions` (mesmas convenções de RLS via `is_team_member`, mesmo trigger `set_patient_id_from_pregnancy`, registros imutáveis — sem UPDATE/DELETE).
- O botão/tipo de evento "Dinâmica Uterina" existente é reaproveitado (nenhum novo `BirthEventType` é necessário); a flag decide apenas qual modal/gráfico é montado sob esse mesmo botão — primeiro caso no código onde uma flag PostHog decide entre dois componentes distintos em vez de um booleano/filtro.
- A grade matriz (6×n, ◢/■) não tem precedente como componente interativo no codebase — precisa ser construída do zero (o Chart.js atual, usado no gráfico de linha, não suporta células de preenchimento parcial empilhadas nativamente). O código de overlay SVG do PDF (`partograph-overlay-svg.ts`) já implementa uma lógica de grade equivalente para o PDF e pode servir de referência conceitual, mas não é reutilizável diretamente (SVG estático vs. componente React interativo).
- O algoritmo de agrupamento/decomposição da notação DU (dividir um registro de 20/30 min em sub-blocos de 10 min, cada um com sua própria notação a partir de uma fatia do array de durações) é lógica nova, sem equivalente em `birth-mode-chart-utils.ts`.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Componente de matriz (grid de células com preenchimento parcial) exige implementação nova sem precedente no design system | H | Tratar como o item de maior esforço da implementação; prototipar isoladamente antes de integrar à tela de partograma |
| Algoritmo de segmentação DU (20/30 min → sub-blocos de 10 min) tem edge cases não triviais (ex.: primeira contração desprezada no exemplo do requisito) | M | Cobrir com testes unitários dedicados usando os exemplos numéricos do próprio requisito como casos de teste |
| Padrão de flag decidindo entre dois componentes é inédito no codebase — risco de inconsistência com o padrão de gate client-side já usado (doula gate) | L | Seguir estritamente `useFeatureFlagEnabled` client-side, sem introduzir gating server-side desnecessário, já que ambos os fluxos permanecem autorizados |

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
| 1 | Schema e migração | Criar tabela `birth_uterine_activity` + RLS + migração, `pnpm db:types` | complete | - | - | `.claude/PRPs/plans/completed/uterine-activity-schema-migration.plan.md` |
| 2 | Server action e validação | `add-birth-uterine-activity-action.ts` + schema Zod (quantidade, intervalo, array de durações) | complete | - | 1 | `.claude/PRPs/plans/completed/uterine-activity-phase2-server-action.plan.md` |
| 3 | Lógica de notação DU | Função pura de cálculo/decomposição da notação DU em sub-blocos de 10 min | complete | with 4 | 2 | `.claude/PRPs/plans/completed/uterine-activity-phase3-du-notation-logic.plan.md` |
| 4 | Modal de registro | `add-birth-uterine-activity-modal.tsx` com os 3 campos + notação em destaque | pending | with 3 | 2 | - |
| 5 | Toggle da flag no botão de registro | `useFeatureFlagEnabled("show_uterine_activity")` alternando modal em `birth-mode-register-buttons.tsx` | pending | - | 3, 4 | - |
| 6 | Agregação na timeline | Incluir `birth_uterine_activity` em `birth-mode-timeline-data.ts` | pending | with 7 | 2 | - |
| 7 | Componente de gráfico matriz | Novo componente de grade 6×n com ◢/■, preenchimento de baixo para cima | pending | with 6 | 3 | - |
| 8 | Toggle da flag no gráfico | Alternar entre gráfico atual e nova matriz reativo à flag, na tela de partograma | pending | - | 6, 7 | - |

### Phase Details

**Phase 1: Schema e migração**
- **Goal**: Base de dados pronta para o novo formato de registro.
- **Scope**: Migração SQL seguindo o padrão de `birth_contractions` (uuid PK, FKs para pregnancy/patient/professional, trigger de patient_id, RLS `is_team_member`, sem UPDATE/DELETE), colunas para quantidade de contrações, intervalo em minutos e array de durações (`smallint[]`).
- **Success signal**: Migração aplicada, `pnpm db:types` regenerado, tabela visível nos tipos gerados.

**Phase 2: Server action e validação**
- **Goal**: Persistência segura do novo registro.
- **Scope**: `authActionClient`, schema Zod espelhando `birthContractionSchema` (com array de durações e intervalo), duplicate-check e `maybeUnlockPartograph` reaproveitados do padrão existente.
- **Success signal**: Registro inserido corretamente via action, evento PostHog capturado.

**Phase 3: Lógica de notação DU**
- **Goal**: Função pura, testável, que calcula a notação DU e a decompõe em sub-blocos de 10 min quando o intervalo é 20 ou 30 min.
- **Scope**: Módulo utilitário (ex. `birth-mode-uterine-activity-utils.ts`), casos de teste extraídos diretamente dos exemplos numéricos do requisito.
- **Success signal**: Testes unitários cobrindo os exemplos do requisito passam, incluindo o caso de "primeira contração desprezada".

**Phase 4: Modal de registro**
- **Goal**: Interface de registro em lote de baixo atrito.
- **Scope**: `add-birth-uterine-activity-modal.tsx`, formulário react-hook-form + Zod, exibição em destaque (fonte grande, peso alto) da notação calculada em tempo real.
- **Success signal**: Modal funcional isoladamente, validação e submissão testadas manualmente.

**Phase 5: Toggle da flag no botão de registro**
- **Goal**: Alternância entre modal antigo e novo controlada pela flag.
- **Scope**: Alteração pontual em `birth-mode-register-buttons.tsx` com `useFeatureFlagEnabled("show_uterine_activity")`.
- **Success signal**: Com flag ativa, novo modal abre; com flag inativa, comportamento atual inalterado.

**Phase 6: Agregação na timeline**
- **Goal**: Novos registros aparecem na timeline de eventos do parto.
- **Scope**: Query adicional em `birth-mode-timeline-data.ts`, extensão do tipo de payload de evento.
- **Success signal**: Registros de `birth_uterine_activity` aparecem corretamente na timeline junto aos demais eventos.

**Phase 7: Componente de gráfico matriz**
- **Goal**: Visualização em matriz 6×n reconhecível pela equipe obstétrica.
- **Scope**: Novo componente React (grid de células, preenchimento bottom-up, símbolos ◢/■), consumindo os dados agregados/decompostos da Fase 3.
- **Success signal**: Gráfico renderiza corretamente os exemplos numéricos do requisito (incluindo divisão de registros de 20/30 min em múltiplas colunas).

**Phase 8: Toggle da flag no gráfico**
- **Goal**: Alternância entre gráfico atual (Chart.js) e nova matriz controlada pela flag.
- **Scope**: Alteração na tela de partograma (`birth-mode-screen.tsx` ou equivalente) para renderizar condicionalmente.
- **Success signal**: Com flag ativa, nova matriz aparece; com flag inativa, gráfico de linha atual permanece inalterado.

### Parallelism Notes

Fases 3 e 4 podem rodar em paralelo (lógica de notação vs. UI do modal são desacopladas, ambas dependem apenas da Fase 2). Fases 6 e 7 podem rodar em paralelo pela mesma razão (agregação de dados vs. componente de gráfico). Fases 1→2 e 5, 8 são sequenciais por dependência direta de schema/dados.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Reaproveitar tipo de evento "contraction" existente vs. criar novo `BirthEventType` | Reaproveitar o botão/tipo existente | Criar novo tipo `uterine_activity` com botão próprio | Requisito original especifica que a flag altera o modal do botão já existente, não adiciona um novo botão |
| Escopo da flag `show_uterine_activity` | Global | Rollout por clínica/usuário | Confirmado diretamente pelo usuário |
| Gating da flag | Apenas client-side (`useFeatureFlagEnabled`), sem bloqueio de rota | Gate server-side como o padrão de doulas | Ambos os fluxos (antigo/novo) permanecem autorizados; a flag escolhe exibição, não acesso |
| Reutilização do componente de gráfico matriz do PDF (`partograph-overlay-svg.ts`) | Não reutilizar diretamente — construir novo componente React | Adaptar a lógica SVG existente | SVG estático de geração de PDF não é reutilizável como componente interativo; serve apenas como referência conceitual |

---

## Research Summary

**Market Context**
A notação "DU n/10/duração" é o padrão real de registro obstétrico no Brasil (protocolos CAISM-Unicamp, ME-UFRJ). O padrão WHO de partograma já usa uma grade de linhas (contrações por 10 min) × colunas (blocos de tempo), com preenchimento por duração/intensidade (pontilhado <20s, hachurado/triângulo 20-40s, sólido >40s) — o requisito deste PRD é uma implementação fiel desse padrão já estabelecido, não um design novo. Literatura de enfermagem em trabalho de parto (Wisner et al. 2021) documenta a tensão "cuidar vs. documentar" e aponta registro em lote em pausas naturais como o ponto de equilíbrio prático, validando a abordagem de registro por janela de tempo em vez de por contração isolada. Não foi identificado concorrente brasileiro já oferecendo esse formato digital — gap potencialmente diferenciador.

**Technical Context**
A camada de dados/CRUD segue diretamente o padrão estabelecido por `birth_contractions` (tabela, action, modal, agregação de timeline) — baixo risco. Dois componentes são genuinamente novos, sem precedente no codebase: (1) o algoritmo de decomposição da notação DU para registros de 20/30 minutos, e (2) o componente de grade matriz interativa (nenhum componente de heatmap/grid/matrix existe hoje em `packages/ui` ou `apps/web/src/components`). A alternância de componente inteiro (modal ou gráfico) via feature flag também é um padrão novo neste codebase — todos os 4 usos atuais de `useFeatureFlagEnabled` gateiam booleanos/filtros, nunca a escolha de componente.

---

*Generated: 2026-08-31*
*Status: DRAFT - needs validation*
