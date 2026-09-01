# Matriz de Contrações no PDF do Partograma — Migração para `birth_uterine_activity`

## Problem Statement

A seção "contrações em 10 min." do PDF do partograma (`partograph-overlay-svg.ts:209-265`) só desenha eventos da tabela antiga `birth_contractions`; eventos registrados no novo fluxo `birth_uterine_activity` (notação DU, registro em lote — ver `uterine-activity.prd.md`) simplesmente não aparecem nessa seção do PDF hoje, porque `buildContractionsElements` nunca foi estendida para reconhecer `event.type === "uterine_activity"`.

**Nota de escopo**: esta iteração é estritamente aditiva. O comportamento existente de `buildContractionsElements` para `birth_contractions` — incluindo o bug conhecido de `Map.set()` sobrescrevendo leituras no mesmo bloco horário — não é alterado, corrigido ou removido aqui. Corrigir esse bug fica fora do escopo desta PRD; o objetivo é apenas fazer os novos registros de `birth_uterine_activity` também aparecerem no PDF, sem tocar em nada que já existe e já funciona.

## Evidence

- Confirmado pelo usuário inicialmente como "valores mal formatados vindos da tabela `birth_contractions`"; após revisão, o usuário determinou que nada do comportamento/dados existentes deve ser alterado nesta iteração — o achado do bug (`byColumn.set()` sobrescrevendo leituras, ver nota abaixo) fica registrado, mas não corrigido aqui.
- Leitura direta do código (`buildContractionsElements`, `partograph-overlay-svg.ts:228-265`): `byColumn.set(column, {...})` substitui, não acumula — qualquer segunda leitura na mesma coluna horária apaga a primeira. **Registrado apenas como contexto técnico; correção fora do escopo desta PRD.**
- `partograph-overlay-svg.ts` nunca foi atualizado para também ler `event.type === "uterine_activity"`; continua filtrando exclusivamente `event.type === "contraction"` na seção de contrações.
- O PRD pai (`uterine-activity.prd.md`, seção "What We're NOT Building") registra explicitamente: "Alteração na exibição de dados no PDF do partograma... escopo explicitamente adiado para próxima iteração pelo requisito original" — esta PRD é essa próxima iteração, confirmada pelo usuário, com escopo restrito a uma adição (não substituição/correção).

## Proposed Solution

Adicionar, em `partograph-overlay-svg.ts`, uma nova função de desenho para eventos `uterine_activity` (payload `{ interval_minutes, durations_seconds }`), reaproveitando a lógica pura já validada em `birth-mode-uterine-activity-chart-utils.ts` (`computeUterineActivityChartColumns`) e `birth-mode-uterine-activity-utils.ts` (`splitIntoBlocks`) para decompor cada registro em blocos de 10 minutos e classificar cada contração como ◢ (20-40s), ⬛ (>40s) ou omitida (<20s). As colunas resultantes são desenhadas sequencialmente (uma por bloco de 10 min, na ordem cronológica de registro — não vinculadas ao horário real do exame), reaproveitando as 24 posições físicas de coluna já calibradas em `HOUR_COLUMN_X`/`CONTRACTIONS_BAND`, e cada célula é empilhada de baixo para cima dentro do limite físico de 5 linhas do template impresso (vs. 6 no gráfico interativo em tela). **O caminho e o comportamento existentes de `buildContractionsElements` para `birth_contractions` permanecem intocados — nada do que já existe e já funciona é alterado, removido ou reescrito nesta iteração.** A mudança é estritamente aditiva: um novo desenho para `uterine_activity` passa a coexistir com o desenho atual de `contraction` na mesma faixa do PDF.

## Key Hypothesis

Acreditamos que adicionar o desenho de eventos `birth_uterine_activity` no PDF, com a mesma lógica de decomposição/classificação já usada no gráfico interativo, vai fazer com que os novos registros de dinâmica uterina passem a aparecer no partograma exportado, sem alterar nada do comportamento já existente para `birth_contractions`.
Vamos saber que estamos certos quando o PDF exportado de um parto com registros de `birth_uterine_activity` mostrar essas contrações corretamente (mesma classificação simbólica ◢/⬛ usada na tela) e o PDF de um parto que usa apenas `birth_contractions` continuar exatamente igual a antes da mudança (nenhuma regressão).

## What We're NOT Building

- Correção do bug de `byColumn.set()` sobrescrevendo leituras em `buildContractionsElements` (fluxo `birth_contractions`) — decisão confirmada pelo usuário: nada do comportamento/dados existentes deve ser alterado nesta iteração. Fica registrado como problema conhecido para uma iteração futura.
- Remoção ou substituição do caminho `birth_contractions` no PDF — decisão confirmada pelo usuário: os dois caminhos (`contraction` e `uterine_activity`) coexistem na mesma faixa do PDF; nenhum dado ou comportamento existente é removido.
- Alinhamento das colunas de `uterine_activity` ao horário real do exame (eixo 1-24h) — decisão confirmada pelo usuário: colunas permanecem sequenciais por bloco de registro, como no gráfico interativo, não à prova de "quando" a contração ocorreu no partograma.
- Suporte a mais de 24 blocos de 10 min no PDF — o template físico tem exatamente 24 posições de coluna calibradas (`HOUR_COLUMN_X`). Comportamento de truncamento fica como questão em aberto (ver abaixo), não uma capacidade nova a construir.
- Mudança no gráfico interativo em tela (`birth-mode-uterine-activity-chart.tsx`) — já implementado e correto; esta PRD toca apenas a camada de exportação SVG/PDF.
- Migração de dados históricos de `birth_contractions` para `birth_uterine_activity` — mesma decisão herdada do PRD pai: tabelas coexistem no banco, e agora também coexistem na renderização do PDF.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Novos dados visíveis no PDF exportado | 100% das contrações válidas (≥20s) registradas em `birth_uterine_activity` aparecem no PDF | Teste automatizado comparando a nova função de desenho com `computeUterineActivityChartColumns` para o mesmo conjunto de eventos |
| Zero regressão no caminho existente | PDF de um parto que usa apenas `birth_contractions` é byte-a-byte/visualmente idêntico ao gerado antes desta mudança | Teste de regressão comparando saída de `buildContractionsElements` antes/depois para o mesmo conjunto de eventos `contraction` |
| Consistência visual tela vs. PDF (para `uterine_activity`) | Mesma classificação simbólica (◢ intermediária, ⬛ efetiva, omitida <20s) nos dois lugares | Revisão manual comparando PDF exportado com gráfico em tela do mesmo parto |

## Open Questions

- [x] Como as duas visualizações (`contraction` por hora do exame vs. `uterine_activity` sequencial por bloco) compartilham a mesma faixa física do template (`CONTRACTIONS_BAND`, 5 linhas) caso um mesmo parto tenha eventos dos dois tipos? **Decidido (2026-08-31)**: precedência para `uterine_activity` — se o parto tiver qualquer evento `uterine_activity`, a faixa de contrações desenha exclusivamente a matriz `uterine_activity` para esse parto, e `buildContractionsElements` não desenha nada (mesmo que existam eventos `contraction` também). Ver Decisions Log.
- [ ] O que fazer quando um parto gera mais de 24 blocos de 10 min de dinâmica uterina (trabalho de parto ativo prolongado, >4h de registros)? Truncar as colunas mais antigas, mais recentes, ou aceitar overflow visual? Não decidido nesta rodada — assumir truncamento das colunas excedentes (mais recentes primeiro) como comportamento provisório até validação clínica.
- [ ] PDFs já exportados/arquivados antes desta mudança não serão regenerados — aceito como natural (exportação é um snapshot no momento da geração), não uma pendência de migração.

---

## Users & Context

**Primary User**
- **Who**: Médicas obstetras e enfermeiras obstétricas que exportam/imprimem o partograma em PDF para prontuário físico ou compartilhamento com a equipe (mesmo perfil do `uterine-activity.prd.md`).
- **Current behavior**: Registram dinâmica uterina em lote via `add-birth-uterine-activity-modal.tsx`, acompanham a matriz no gráfico interativo em tela, mas ao exportar o PDF final para o prontuário, veem dados incorretos ou ausentes na seção de contrações.
- **Trigger**: Momento de exportação do partograma em PDF (fim do acompanhamento, handoff de plantão, ou registro em prontuário físico).
- **Success state**: O PDF exportado mostra a mesma informação de dinâmica uterina, com a mesma fidelidade simbólica, que a equipe já viu e confiou durante o acompanhamento em tela.

**Job to Be Done**
Quando eu exporto o partograma em PDF ao final do acompanhamento de um parto, eu quero que a matriz de contrações reflita fielmente os registros de dinâmica uterina feitos durante o parto, para que o prontuário físico/impresso seja clinicamente confiável e consistente com o que foi visto em tela.

**Non-Users**
Mesmo grupo do PRD pai — staff administrativo, doulas e gestantes não interagem com esta camada de exportação.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Nova função de desenho que filtra `event.type === "uterine_activity"` e é chamada **em adição** a `buildContractionsElements` existente, não em substituição | Cobre o dado que falta sem tocar no que já funciona |
| Must | Reutilizar `computeUterineActivityChartColumns`/`splitIntoBlocks` para decompor e classificar contrações (◢/⬛), sem reimplementar a lógica de classificação no SVG | Evita duplicação e drift entre tela e PDF |
| Must | Desenhar colunas sequencialmente (uma por bloco de 10 min, ordem cronológica), reaproveitando as 24 posições físicas de `HOUR_COLUMN_X` | Decisão confirmada pelo usuário; usa a calibração de coordenadas já existente |
| Must | Limitar a 5 linhas por coluna no SVG (vs. 6 no componente de tela), por ser o limite físico impresso do template | Decisão confirmada pelo usuário |
| Must | `buildContractionsElements` e seu tratamento de `birth_contractions` permanecem byte-a-byte inalterados | Decisão confirmada pelo usuário — nada existente é alterado nesta iteração |
| Won't | Correção do bug de sobrescrita (`byColumn.set()`) no caminho `birth_contractions` | Fora de escopo — fica como problema conhecido para iteração futura |
| Won't | Alinhamento ao eixo de horas reais (1-24h) | Decisão confirmada pelo usuário |
| Won't | Suporte a >24 blocos sequenciais | Limite físico do template; tratamento fica como questão em aberto |

### MVP Scope

O escopo completo acima é o MVP — é uma correção pontual e coesa em uma única função (`buildContractionsElements`) mais suas dependências de posicionamento (`CONTRACTIONS_BAND`), sem redução viável.

### User Flow

1. Profissional registra dinâmica uterina em lote durante o parto (fluxo já existente, inalterado) — ou, em partos com a flag desativada, registra contrações individuais via `birth_contractions` (fluxo já existente, inalterado).
2. Ao final do acompanhamento (ou a qualquer momento), profissional exporta o PDF do partograma.
3. A seção "contrações em 10 min." do PDF passa a exibir, adicionalmente ao que já era desenhado para `birth_contractions`, uma coluna por bloco de 10 min de registro de `birth_uterine_activity`, com símbolos ◢/⬛ empilhados de baixo para cima (até 5 por coluna).

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- Mudança é aditiva e isolada: `buildContractionsElements` em `apps/web/src/lib/partograph-overlay-svg.ts:228-265` **permanece intocada**; uma nova função de desenho para `uterine_activity` é adicionada ao lado dela e sua saída é concatenada à de `buildContractionsElements` na mesma faixa, dentro de `buildPartographOverlaySvg` (linha 484).
- Lógica de classificação/decomposição já existe e é testada em `birth-mode-uterine-activity-chart-utils.ts` (`computeUterineActivityChartColumns`, `classifyDuration`) e `birth-mode-uterine-activity-utils.ts` (`splitIntoBlocks`) — reutilizar diretamente em vez de duplicar no módulo SVG, que hoje é puramente de renderização (string templates), não de lógica de negócio.
- `CONTRACTIONS_BAND` (`partograph-template-calibration.ts:75-79`) já fornece as 24 posições x calibradas (`HOUR_COLUMN_X`) e os limites y (`yTop: 457, yBottom: 511`) da faixa impressa — reutilizada como está, sem alteração, para a nova função também.
- Novo desenho de célula (para `uterine_activity` apenas) usa glifos de texto ou `<polygon>` para ◢ e `<rect>`/`<polygon>` sólido para ⬛, mantendo o padrão de string SVG usado no resto do arquivo. A célula existente de `contractionCell` (quadrado cheio/meio/contorno, usada por `buildContractionsElements`) não é tocada.
- `event.payload` para `uterine_activity` já está tipado em `birth-mode-uterine-activity-chart.tsx:19-22` como `{ interval_minutes: 10 | 20 | 30; durations_seconds: number[] }` — mesmo shape a ser usado no overlay.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Sobreposição visual entre as duas visualizações (`contraction` por hora vs. `uterine_activity` sequencial) caso um mesmo parto tenha eventos dos dois tipos na mesma faixa física | M | Ver Open Questions — precisa de regra explícita antes da implementação; considerado cenário raro dado o desenho da flag |
| Overflow de mais de 24 blocos sequenciais (trabalho de parto prolongado) estourando as posições calibradas de `HOUR_COLUMN_X` | M | Truncar colunas excedentes (comportamento provisório, ver Open Questions); cobrir com teste que gera >24 blocos e verifica que não há erro de índice fora do array |
| Perda de fidelidade visual entre glifo Unicode (◢/⬛) renderizado em SVG via `sharp` (que compõe o overlay sobre o PNG) vs. os mesmos glifos renderizados em HTML/CSS na tela | M | Testar a exportação de PDF real com ambos os símbolos e confirmar renderização correta pelo pipeline `sharp`; se glifos Unicode não renderizarem de forma confiável, substituir por `<polygon>`/`<rect>` desenhados (mesma técnica já usada para o triângulo de dilatação em `triangleApexPoints`) |
| Alteração acidental do caminho `birth_contractions` existente ao editar o arquivo compartilhado `partograph-overlay-svg.ts` | L | Teste de regressão explícito (ver Success Metrics) comparando saída antes/depois para eventos `contraction`; nova função adicionada como código novo, sem editar `buildContractionsElements` |

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
| 1 | Nova função de decomposição/classificação para `uterine_activity` | Filtrar `event.type === "uterine_activity"`, reaproveitar `computeUterineActivityChartColumns`/`splitIntoBlocks`, sem tocar em `buildContractionsElements` | complete | - | - | `.claude/PRPs/plans/completed/partograph-uterine-activity-pdf-phase-1.plan.md` |
| 2 | Desenho aditivo das células ◢/⬛ com limite de 5 linhas | Nova função de desenho de célula (glifo ou polígono), posicionamento sequencial via `HOUR_COLUMN_X`, concatenada à saída existente sem substituí-la | complete | - | 1 | `.claude/PRPs/plans/completed/partograph-uterine-activity-pdf-phase-2.plan.md` |
| 3 | Testes de fidelidade e de não-regressão | Testes unitários cobrindo o novo caminho (sem perda entre blocos, overflow) e teste de regressão garantindo que `buildContractionsElements`/saída para `contraction` não mudou | complete | - | 2 | `.claude/PRPs/plans/completed/partograph-uterine-activity-pdf-phase-3.plan.md` |

### Phase Details

**Phase 1: Nova função de decomposição/classificação para `uterine_activity`**
- **Goal**: Nova função (não uma edição de `buildContractionsElements`) que lê `uterine_activity` e produz a mesma decomposição/classificação já usada na tela.
- **Scope**: Filtro de `event.type === "uterine_activity"`, extrair `{ interval_minutes, durations_seconds }` do payload, chamar `computeUterineActivityChartColumns` para obter as colunas de células já classificadas. `buildContractionsElements` permanece sem nenhuma edição.
- **Success signal**: Função retorna a mesma estrutura de colunas/células que o componente de tela produziria para o mesmo conjunto de eventos; `buildContractionsElements` inalterada (diff vazio nessa função).

**Phase 2: Desenho aditivo das células ◢/⬛ com limite de 5 linhas**
- **Goal**: Renderizar as colunas calculadas na Fase 1 como marcações SVG adicionais, concatenadas à saída de `buildContractionsElements` na mesma faixa do template.
- **Scope**: Nova função de célula para ◢/⬛ (independente de `contractionCell`, que não é tocada), posicionamento sequencial usando `HOUR_COLUMN_X[index]`, truncamento em 5 linhas por coluna, concatenação em `buildPartographOverlaySvg`.
- **Success signal**: PDF gerado manualmente para um parto de teste mostra a nova matriz de `uterine_activity` corretamente, e um PDF de um parto que só tem `birth_contractions` permanece visualmente idêntico ao gerado antes desta mudança.

**Phase 3: Testes de fidelidade e de não-regressão**
- **Goal**: Garantir corretude do novo caminho e ausência total de regressão no caminho existente.
- **Scope**: Testes unitários para: (a) múltiplos registros de `uterine_activity` decompostos sem perda de dados entre colunas, (b) >24 blocos sequenciais não quebra o desenho (truncamento seguro), (c) contrações <20s corretamente omitidas, (d) teste de regressão comparando a saída de `buildContractionsElements` para um conjunto fixo de eventos `contraction` antes/depois da mudança (deve ser idêntica).
- **Success signal**: Suite de testes passa; nenhum índice fora do array `HOUR_COLUMN_X` gerado; teste de regressão confirma zero diferença na saída para `contraction`.

### Parallelism Notes

Fases são sequenciais — mudança pontual e pequena, puramente aditiva em um único arquivo, sem paralelismo natural (Fase 2 depende da estrutura de dados da Fase 1; Fase 3 testa o resultado de ambas, incluindo a garantia de não-regressão).

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Fonte de dados no PDF | Ambas — `birth_contractions` (existente, intocado) e `birth_uterine_activity` (novo, adicionado) coexistem | Substituição completa por `birth_uterine_activity` | Revertido pelo usuário: nada do comportamento/dados existentes deve ser alterado nesta iteração |
| Correção do bug de sobrescrita em `birth_contractions` | Fora de escopo — não corrigido nesta PRD | Corrigir junto com a adição do novo caminho | Revertido pelo usuário: nenhuma alteração no que já existe, mesmo que seja um bug conhecido |
| Alinhamento de colunas (para `uterine_activity`) | Sequencial por bloco de registro | Alinhado ao eixo de horas reais (1-24h), como as demais faixas do PDF | Confirmado pelo usuário — consistência com o gráfico interativo em tela, não com o eixo temporal do partograma |
| Limite de linhas por coluna no PDF (para `uterine_activity`) | 5 linhas | 6 linhas (igual ao componente de tela) | Confirmado pelo usuário — limite físico do template impresso, que não pode ser alterado |
| Reutilização de lógica de classificação | Importar `computeUterineActivityChartColumns`/`splitIntoBlocks` do módulo de utils existente | Reimplementar a lógica diretamente em `partograph-overlay-svg.ts` | Evita duplicação/drift entre a lógica já testada da tela e a do PDF |
| Colisão de faixa quando um parto tem eventos `contraction` E `uterine_activity` | Precedência para `uterine_activity` — se existir qualquer evento `uterine_activity`, a faixa desenha só a matriz `uterine_activity` (nada de `contraction` é desenhado nesse parto); `buildContractionsElements` continua intocada como função, mas seu resultado é descartado quando há `uterine_activity` presente | Desenhar ambos sobrepostos; dar precedência a `contraction`; dividir a coluna ao meio | Confirmado pelo usuário (2026-08-31) — evita células ilegíveis por sobreposição; `uterine_activity` é o fluxo mais novo/recomendado, então partos que já migraram para ele não devem mostrar dado potencialmente obsoleto de `birth_contractions` |
| Posicionamento das colunas de `uterine_activity` (correção pós-implementação) | Grade fina própria da faixa de contrações — medida diretamente do template real (`prompts/017-partograph/partograma_vs_ok.png` e `apps/web/src/assets/partograph-template.png`, ambos 595×841px): 48 células de ~10,59px, começando em x=51, distinta da grade de 24 posições de `HOUR_COLUMN_X` usada pelas demais faixas. Célula do símbolo com 9px de largura (padding mínimo mas perceptível dentro da célula real) | Manter as 24 posições de `HOUR_COLUMN_X` (decisão original desta PRD) com célula larga (14-22px) | Revertido pelo usuário (2026-09-01) após dois rounds de feedback visual em PDFs reais — a suposição original de que a faixa de contrações compartilha a grade do eixo de horas (`HOUR_COLUMN_X`) estava incorreta; medição direta do template mostrou uma grade 2x mais fina. Sem essa correção era impossível satisfazer simultaneamente "sem espaço entre colunas" e "símbolo contido na própria célula" — os símbolos ficavam ~2x mais largos que a célula real, extrapolando a grade fina em ambos os lados. Aumenta o limite de truncamento de 24 para 48 colunas |

---

## Research Summary

**Market Context**
Não aplicável nesta iteração — decisão de design (notação DU, símbolos ◢/⬛) já validada e documentada no PRD pai (`uterine-activity.prd.md`), que confirmou alinhamento com os protocolos CAISM-Unicamp/ME-UFRJ e o padrão WHO de grade de contrações.

**Technical Context**
Mudança isolada, aditiva e de baixo risco: introduz uma nova função de renderização SVG ao lado de `buildContractionsElements` (que permanece intocada), reaproveitando as mesmas coordenadas de posicionamento (`CONTRACTIONS_BAND`) e a lógica de negócio já implementada e testada para o gráfico interativo (`birth-mode-uterine-activity-chart-utils.ts`, `birth-mode-uterine-activity-utils.ts`). O único ponto genuinamente novo é a técnica de desenho dos glifos ◢/⬛ em SVG estático (via `sharp`), que não tem precedente direto no arquivo — o triângulo já desenhado para dilatação (`triangleApexPoints`) serve de referência técnica caso os glifos Unicode não renderizem de forma confiável no pipeline atual.

---

*Generated: 2026-08-31*
*Status: DRAFT - needs validation*
