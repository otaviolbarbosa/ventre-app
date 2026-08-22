# Partograma no Modo Parto

## Problem Statement

Durante o modo parto, a equipe de cuidado (enfermagem obstétrica e obstetras) já registra todos os eventos clínicos relevantes (dilatação, estação fetal, BCF, contrações, líquido amniótico, medicações), mas esses dados só existem hoje como uma lista cronológica plana (`BirthModeTimeline`). Não há uma ferramenta visual que permita à equipe ler a progressão do parto rapidamente — especialmente em consultas curtas pelo celular durante o plantão — o que dificulta o apoio à tomada de decisão em tempo real e a documentação clínica do trabalho de parto no pós-parto.

## Evidence

- Auditoria interna do schema (`packages/supabase/supabase/migrations/20260822*`, `get-birth-mode-timeline-action.ts`) confirma que os dados de dilatação, estação (Dee Lee), BCF, contrações (duração/efetividade), líquido amniótico e ruptura de membrana já são coletados, mas apenas renderizados como lista (`birth-mode-timeline.tsx`) — não como gráfico.
- Não há hoje nenhum componente de partograma ou gráfico de série temporal multi-track no código (`chart.js`/`react-chartjs-2` só é usado para gráficos de domínio único, ex. peso gestacional por semana).
- Confirmação do usuário (PM/stakeholder): "não há uma ferramenta visual que facilite a leitura desses dados" e "temos captura parcial de dados para o escopo do partograma, precisamos completar essa funcionalidade" — declaração do responsável pelo produto, não pesquisa de usuário formal (entrevista/observação de campo). **Assunção a validar**: uso real da equipe em campo ainda não foi observado diretamente.

## Proposed Solution

Adicionar uma aba "Partograma" à tela de modo parto (`birth-mode-screen.tsx`), ao lado da aba "Linha do tempo" já existente, que plota os eventos do modo parto no formato clássico do partograma do Ministério da Saúde: dilatação cervical (cm) x tempo com Linha de Alerta e Linha de Ação, estação fetal (Dee Lee) sobreposta, frequência cardíaca fetal (BCF), contrações (frequência/duração), e faixas para ocitocina, medicações, ruptura de membrana e vitais maternos. Como parte do mesmo projeto, o modelo de dados do modo parto será estendido para fechar as lacunas de captura hoje existentes (frequência de contração, dose/gotejamento de ocitocina, vitais maternos, urina, detalhe de ruptura de membrana), seguindo o padrão já estabelecido de tabela `birth_*` + Zod schema + safe-action + modal. O gráfico é atualizado em tempo real conforme novos eventos são registrados, reaproveitando a infraestrutura de realtime já usada pela linha do tempo.

## Key Hypothesis

Acreditamos que um partograma visual, atualizado em tempo real, vai auxiliar a equipe de cuidado de forma ágil e precisa no acompanhamento do trabalho de parto e na tomada de decisão.
Saberemos que estamos certos quando a equipe passar a consultar o partograma como referência de progresso do parto com acurácia, em vez de depender apenas da lista cronológica. *(Métrica numérica específica ainda não definida — ver Success Metrics.)*

## What We're NOT Building

- **Visão da gestante** — o partograma é uma ferramenta de uso exclusivo da equipe de cuidado; a gestante não terá acesso a essa visualização.
- **Modo "Labour Care Guide" (OMS, pós-2020)** — a OMS substituiu o partograma clássico (linhas de alerta/ação, fase ativa a partir de 4cm) pelo Labour Care Guide (fase ativa a partir de 5cm, sem linhas diagonais fixas). O Ministério da Saúde e os documentos de referência deste projeto ainda usam o modelo clássico, então construímos esse modelo agora — mas o design de dados não deve travar uma futura migração para o LCG.

## Success Metrics

Métrica de sucesso é **qualitativa** no MVP (decisão explícita do stakeholder — sem meta numérica definida):

| Metric | Target | How Measured |
|--------|--------|---------------|
| Equipe percebe o partograma como confiável/acurado para acompanhar o progresso do parto | Qualitativo — sem número-alvo | Feedback qualitativo da equipe pós-lançamento |
| Utilização dos campos novos (vitais maternos, urina) ao longo do tempo | Observacional — sem meta prévia | Monitorar uso via eventos (`captureServerEvent`); campos permanecem no escopo mesmo se subutilizados inicialmente |

## Open Questions

Todas as questões abertas da rodada anterior foram resolvidas pelo stakeholder (ver Decisions Log):

- [x] Vitais maternos e urina são mantidos no escopo; a utilização será observada ao longo do tempo, sem meta prévia de adoção.
- [x] "Sessão" = o partograma na tela é decomposto em mini-sessões, cada uma com título e mini-gráfico próprio, para facilitar a leitura. O layout clássico completo/compactado (todos os tracks no mesmo eixo de tempo, como nos PDFs de referência) fica reservado à versão PDF/impressão.
- [x] Métrica de sucesso é qualitativa no MVP — sem meta numérica.
- [x] Para telas pequenas, a orientação é "melhor esforço" — a decomposição em mini-sessões já reduz bastante o risco de densidade visual na tela; o layout multi-track denso e sincronizado permanece necessário apenas na exportação PDF (fora do caminho crítico de mobile).

---

## Users & Context

**Primary User**
- **Who**: Toda a equipe de cuidado no modo parto — enfermagem obstétrica e obstetras, sem hierarquia de acesso diferenciada.
- **Current behavior**: Registra eventos discretos via os modais de "modo parto" (`add-birth-*-modal.tsx`) e hoje só consegue revisar o histórico como lista cronológica.
- **Trigger**: Necessidade de checar rapidamente a progressão do parto durante o plantão, geralmente pelo celular.
- **Success state**: Consulta o partograma e entende o progresso do parto com acurácia, em segundos, sem precisar interpretar uma lista de eventos.

**Job to Be Done**
Quando eu registro algum evento durante o modo parto, eu quero visualizar esse dado automaticamente no gráfico, para que eu possa ter um registro visual que me auxilie na tomada de decisão.

**Non-Users**
A gestante — não terá acesso a esta visualização.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Gráfico atualizado em tempo real conforme eventos são registrados | Requisito explícito; reaproveita `useBirthModeTimelineRealtime` |
| Must | Partograma decomposto em mini-sessões, cada uma com título e mini-gráfico | Requisito explícito do stakeholder — facilita leitura em tela pequena; layout clássico completo/sincronizado fica só no PDF |
| Must | Fechar os gaps de dados hoje existentes (frequência de contração, dose/gotejamento de ocitocina, vitais maternos, urina, detalhe de ruptura de membrana) | Sem esses dados o partograma clássico fica incompleto frente ao modelo do Ministério da Saúde usado como referência |
| Must | Curvas de dilatação + estação fetal com Linha de Alerta e Linha de Ação | Núcleo clínico do partograma clássico |
| Must | Tracks de BCF e contrações | Já existem dados hoje; parte central do modelo de referência |
| Should | Leitura otimizada para celular e tablet (consulta rápida, poucos segundos) | Requisito explícito de uso; mitigado pela decomposição em mini-sessões, mas ainda exige melhor esforço de design dentro de cada mini-gráfico |
| Could | Exportar/gerar PDF do partograma, com o layout clássico completo e compactado (todos os tracks sincronizados no mesmo eixo de tempo, como nos documentos de referência) | Nice-to-have explícito do stakeholder — é aqui que o layout multi-track denso do modelo clássico se aplica integralmente |
| Won't | Visão da gestante | Fora de escopo explícito |
| Won't | Modo Labour Care Guide (OMS pós-2020) | Fora de escopo explícito; MS ainda usa modelo clássico |

### MVP Scope

Tudo de uma vez (conforme decisão do stakeholder): partograma completo, exibido na tela como mini-sessões (título + mini-gráfico por sessão/track) com atualização em tempo real, **e** a captura de dados que hoje falta (frequência de contração, ocitocina, vitais maternos, urina, ruptura de membrana detalhada). O layout clássico completo (todos os tracks sincronizados em um único eixo de tempo, como no modelo do Ministério da Saúde) é reservado à exportação em PDF (nice to have).

### User Flow

1. Equipe registra um evento no modo parto (ex: nova dilatação, contração, ocitocina, vitais) via modal existente ou modal novo (vitais/urina).
2. Evento é salvo via safe-action, seguindo o padrão `birth_*` já estabelecido.
3. Aba "Partograma" (nova, ao lado de "Linha do tempo") atualiza automaticamente via realtime, adicionando o novo ponto à mini-sessão/mini-gráfico correspondente.
4. Equipe consulta o partograma pelo celular ou tablet durante o plantão, navegando pelas mini-sessões para entender a progressão do parto rapidamente.
5. (Nice to have) Equipe gera um PDF com o partograma completo no layout clássico compactado, para documentação/impressão.

---

## Technical Approach

**Feasibility**: MEDIUM

**Architecture Notes**
- Extensão do modelo de dados segue o padrão já estabelecido e é mecânica: para campos que cabem em tabelas existentes (frequência em `birth_contractions`, dose/gotejamento em `birth_medication_administrations` condicionado a `medication_type = 'ocitocina'`, tipo/líquido em `birth_membrane_ruptures`) é uma migração de colunas + `pnpm db:types` + ajuste de schema Zod. Para vitais maternos e urina — sem tabela hoje — replica-se o template completo de `birth_contractions` (nova tabela `birth_*`, trigger `set_patient_id_from_pregnancy`, RLS com `is_team_member`, índices, grants) + schema/action/modal novos.
- `getBirthModeTimelineAction` precisa ser estendido para buscar os novos campos/tabelas (incluindo `birth_apgar_scores`, que já existe mas hoje não é buscado).
- Gráfico: `chart.js` + `react-chartjs-2` já são dependências (`apps/web/package.json`), com padrão estabelecido em `gestational-weight-gain-chart.tsx` e `uterine-height-chart.tsx` — mas esses componentes são de domínio único (ex: semanas 0–40) e altura fixa. Como a exibição na tela foi decomposta em mini-sessões (título + mini-gráfico por sessão/track), esses componentes são uma base mais direta de reaproveitar do que um gráfico único multi-track; o layout multi-track denso e sincronizado (todos os tracks no mesmo eixo de tempo) só é necessário na exportação PDF.
- Aba "Partograma" requer introduzir o componente Shadcn `Tabs` na tela `birth-mode-screen.tsx`, que hoje não usa abas.
- Realtime: reaproveitar `use-birth-mode-realtime.ts`, estendendo para os novos tipos de evento.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Mesmo decomposto em mini-sessões, cada mini-gráfico ainda precisa ser legível em telas pequenas (celular/tablet) — sem precedente de referência exata no código | M | Melhor esforço de design por mini-gráfico (decisão do stakeholder); iterar com a equipe de cuidado após protótipo inicial |
| Layout multi-track denso e sincronizado (todos os tracks no mesmo eixo de tempo) fica concentrado na exportação PDF — maior complexidade de composição de PDF a partir de múltiplos mini-gráficos | M | Tratar como nice-to-have (Fase 6), fora do caminho crítico do MVP em tela |
| Linha de Alerta/Ação tem baixa sensibilidade/especificidade clínica comprovada na literatura (Bonet et al., BJOG 2019) para prever desfechos adversos | M | Enquadrar o partograma como ferramenta de apoio visual à decisão, não como triagem automática/diagnóstica; evitar alertas automáticos que simulem julgamento clínico |
| Campos novos (vitais, urina) podem ficar subutilizados, gerando gráficos com lacunas | M (aceito pelo stakeholder) | Manter no escopo; observar utilização ao longo do tempo, sem meta prévia de adoção |
| Modelo clássico (linha de alerta/ação, fase ativa em 4cm) diverge do padrão OMS pós-2020 (Labour Care Guide, fase ativa em 5cm) | L (fora de escopo, mas risco de roadmap) | Não fazer hard-code de premissas do modelo clássico de forma que bloqueie uma futura "modo LCG" |

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
| 1 | Completar captura de dados | Migrações + schemas Zod + safe-actions + modais para frequência de contração (derivada, não campo manual), dose/gotejamento de ocitocina, vitais maternos, urina e ruptura de membrana detalhada; expor tudo (incl. APGAR) em `getBirthModeTimelineAction` | complete | with 2 | - | `.claude/PRPs/plans/completed/completar-captura-dados-partograma.plan.md` |
| 2 | Shell da aba Partograma | Introduzir `Tabs` em `birth-mode-screen.tsx` (Partograma / Linha do tempo), estrutura de mini-sessões (título + container de mini-gráfico) | complete | with 1 | - | `.claude/PRPs/plans/completed/shell-aba-partograma.plan.md` |
| 3 | Mini-gráfico: dilatação/estação | Mini-gráfico por sessão para dilatação cervical + estação fetal (Dee Lee) com Linha de Alerta/Ação | complete | with 4 | 1, 2 | `.claude/PRPs/reports/mini-grafico-dilatacao-estacao-report.md` |
| 4 | Mini-gráficos: demais tracks | Mini-gráficos por sessão para BCF, contrações (frequência/duração), ocitocina, medicações, ruptura de membrana, vitais maternos, urina | complete | with 3 | 1, 2 | `.claude/PRPs/plans/completed/mini-graficos-demais-tracks.plan.md` |
| 5 | Tempo real + polimento mobile/tablet | Estender realtime para atualizar as mini-sessões em novos eventos; melhor esforço de legibilidade em telas pequenas | in-progress | - | 3, 4 | `.claude/PRPs/plans/tempo-real-polimento-mobile-partograma.plan.md` |
| 6 | Exportar PDF (nice to have) | Compor o layout clássico completo/compactado (todos os tracks sincronizados no mesmo eixo de tempo, como no modelo de referência) a partir dos dados das mini-sessões, e gerar o PDF | pending | - | 5 | - |

### Phase Details

**Phase 1: Completar captura de dados**
- **Goal**: Fechar os gaps de dados do partograma (frequência de contração, ocitocina, vitais, urina, ruptura de membrana).
- **Scope**: Migrações SQL, `pnpm db:types`, schemas Zod, safe-actions, modais novos/estendidos, atualização de `getBirthModeTimelineAction`.
- **Success signal**: Todos os campos do modelo de referência (PDFs) têm um caminho de captura funcional.

**Phase 2: Shell da aba Partograma**
- **Goal**: Introduzir a navegação por abas na tela de modo parto sem quebrar a Linha do tempo existente, e a estrutura de mini-sessões.
- **Scope**: Componente `Tabs`, estrutura de lista de mini-sessões (título + slot de mini-gráfico) como placeholder.
- **Success signal**: Usuário alterna entre "Partograma" e "Linha do tempo" sem regressão na timeline, e vê a estrutura de sessões vazia.

**Phase 3: Mini-gráfico de dilatação/estação**
- **Goal**: Plotar o mini-gráfico clinicamente mais crítico (dilatação, estação, linhas de alerta/ação) dentro de cada mini-sessão.
- **Scope**: Componente de mini-gráfico usando chart.js, cálculo das linhas de alerta/ação a partir do padrão clássico (início em 4cm, 1cm/h; ação 4h à direita).
- **Success signal**: Mini-gráfico reflete com acurácia os dados de dilatação/estação já existentes.

**Phase 4: Mini-gráficos das demais tracks**
- **Goal**: Completar o partograma com mini-gráficos para as faixas restantes.
- **Scope**: BCF, contrações, ocitocina, medicações, ruptura de membrana, vitais, urina — um mini-gráfico por track dentro de cada sessão.
- **Success signal**: Todas as faixas do modelo de referência estão representadas como mini-gráficos legíveis.

**Phase 5: Tempo real + polimento mobile/tablet**
- **Goal**: Garantir atualização automática e leitura rápida em celular/tablet.
- **Scope**: Extensão do hook de realtime; melhor esforço de design responsivo por mini-gráfico.
- **Success signal**: Novo evento aparece na mini-sessão correspondente sem reload; equipe consegue ler o progresso do parto em poucos segundos no celular ou tablet.

**Phase 6: Exportar PDF (nice to have)**
- **Goal**: Permitir gerar um PDF com o partograma completo no layout clássico compactado (todos os tracks sincronizados, como nos documentos de referência), a partir dos dados já plotados nas mini-sessões.
- **Scope**: Botão de exportação, composição do layout multi-track denso, geração de PDF.
- **Success signal**: PDF gerado reflete fielmente os dados do partograma, no formato clássico completo.

### Parallelism Notes

Fases 1 e 2 podem rodar em paralelo (dados vs. shell de UI não se sobrepõem). Fases 3 e 4 dependem de 1 e 2, mas podem rodar em paralelo entre si (mini-gráfico de dilatação/estação vs. mini-gráficos das demais tracks tocam partes distintas do componente de partograma, desde que compartilhem a mesma estrutura de sessão definida em Fase 2). Fase 5 depende de 3 e 4 estarem prontas para integrar tempo real e polir mobile/tablet. Fase 6 é opcional, concentra o risco de layout multi-track denso (antes associado à tela) na composição do PDF, e pode ser adiada para depois do lançamento do MVP em tela.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Modelo clínico do partograma | Modelo clássico (Ministério da Saúde, linhas de alerta/ação) | Labour Care Guide (OMS 2020+) | MS e documentos de referência ainda usam o modelo clássico; OMS permite via FIGO 2025 enquanto não há transição formal |
| Escopo do MVP | Tudo de uma vez (gráfico completo + captura de dados nova) | MVP incremental (só as 4 curvas com dados existentes primeiro) | Decisão explícita do stakeholder |
| Acesso ao partograma | Somente equipe de cuidado | Incluir visão da gestante | Fora de escopo explícito |
| Biblioteca de gráfico | Reaproveitar chart.js/react-chartjs-2 | Introduzir nova lib (recharts, visx, d3) | Já é dependência do projeto, evita nova superfície de manutenção |
| Layout de exibição em tela | Mini-sessões (título + mini-gráfico por sessão/track) | Gráfico único multi-track denso, sincronizado, como nos PDFs de referência | Reduz risco de legibilidade em celular/tablet; decisão explícita do stakeholder |
| Layout clássico completo/sincronizado | Reservado à exportação PDF (nice to have) | Replicar o layout clássico também na tela | Decisão explícita do stakeholder — separa preocupação de leitura rápida (tela) de documentação formal (PDF) |
| Campos de vitais maternos e urina | Mantidos no escopo, mesmo com risco de subutilização | Removê-los do MVP até haver evidência de demanda | Decisão explícita do stakeholder — observar uso ao longo do tempo |

---

## Research Summary

**Market Context**
Partogramas digitais existentes (Bangladesh, Tanzânia, Índia) convergem em plotagem automática a partir de eventos discretos, alertas visuais ao cruzar a linha de alerta, e tracks empilhados sincronizados no mesmo eixo de tempo — validando a abordagem proposta. A OMS substituiu o modelo clássico pelo Labour Care Guide em 2020 (fase ativa em 5cm, sem linhas diagonais fixas), mas a FIGO (2025) permite manter o modelo clássico onde a transição não ocorreu — caso do Ministério da Saúde brasileiro. Literatura clínica (Bonet et al., BJOG 2019) mostra baixa sensibilidade/especificidade das linhas de alerta/ação para prever desfechos adversos — reforça enquadrar o partograma como apoio à decisão, não triagem automática.

**Technical Context**
O modelo de dados do modo parto (`birth_*` tables) já cobre boa parte do partograma clássico (dilatação, estação, BCF, contrações parcialmente, líquido amniótico, ruptura de membrana). Faltam: frequência de contração, dose/gotejamento de ocitocina, vitais maternos, urina, e detalhe de ruptura de membrana — todos extensíveis com baixo-médio esforço seguindo o padrão já estabelecido (migração + Zod + safe-action + modal). `chart.js`/`react-chartjs-2` já são dependências, mas nenhum gráfico existente no projeto lida com séries temporais multi-track densas otimizadas para mobile — essa parte é greenfield.

---

*Generated: 2026-08-22*
*Status: DRAFT - needs validation*
