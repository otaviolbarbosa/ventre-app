# Gráfico de Ganho de Peso Gestacional

## Problem Statement

Profissionais de pré-natal registram o peso da gestante a cada consulta (`pregnancy_evolutions.weight_kg`), mas hoje esse dado só aparece como número solto na lista de evoluções, sem nenhuma visualização de tendência ou comparação com a faixa de ganho de peso esperada para o IMC pré-gestacional da paciente. Para avaliar se o ganho está adequado, o profissional precisaria consultar manualmente as tabelas da Caderneta da Gestante (CONMAI/MS 2022 ou IOM 2009) e fazer o cálculo cumulativo à mão.

## Evidence

- Confirmado via exploração de código: `pregnancy_evolutions.weight_kg`, `consultation_date`, `gestational_weeks`/`gestational_days` já existem e são preenchidos a cada consulta, mas não são plotados em nenhum gráfico (`get-prenatal-card-action.ts`).
- O componente irmão `uterine-height-chart.tsx` já resolve exatamente este mesmo problema para altura uterina — replicando bandas de percentil oficiais (INTERGROWTH-21st) num gráfico Chart.js — provando que o padrão é validado e replicável.
- `pregnancies.initial_bmi` e `initial_weight_kg`, e `patients.height_cm` já são capturados e exibidos como "IMC inicial" / "Peso inicial" em `prenatal-card.tsx`, mas hoje sem uso para classificação de faixa de ganho de peso.

## Proposed Solution

Adicionar um novo componente `GestationalWeightGainChart`, estruturalmente análogo ao `UterineHeightChart` (mesma stack Chart.js/react-chartjs-2, mesmo cálculo de semana gestacional decimal, mesmo padrão de props), exibido **acima** do gráfico de altura uterina dentro de `EvolutionsSection` (`prenatal-card.tsx`). O gráfico plota o ganho de peso cumulativo (peso da consulta − peso pré-gestacional) por semana gestacional, sobre bandas de referência. A classificação de faixa (baixo peso/eutrofia/sobrepeso/obesidade) é automática, derivada do `initial_bmi` já armazenado. O usuário pode alternar entre as referências **CONMAI/MS 2022** (padrão, oficial atual) e **IOM 2009** via toggle.

## Key Hypothesis

We believe um gráfico de ganho de peso gestacional com bandas de referência CONMAI e IOM, classificado automaticamente pelo IMC pré-gestacional, will permitir que profissionais de pré-natal identifiquem visualmente, em segundos, gestantes com ganho de peso fora da faixa esperada for profissionais de saúde durante a consulta.
We'll know we're right when o profissional consegue, olhando o gráfico, dizer se o ganho está dentro/fora da faixa sem precisar consultar tabela ou calcular manualmente — sem precisar pedir validação adicional de UX, dado que o padrão já replica o gráfico de altura uterina já aceito.

## What We're NOT Building

- Curvas para gestação múltipla (gemelar) ou alto risco — CONMAI e IOM são válidas apenas para gestação única e baixo risco; não há referência oficial alternativa a usar agora.
- Visualização voltada à própria paciente (fora do contexto do profissional) — fica para iteração futura.
- Edição manual das faixas de referência ou cadastro de novas curvas — valores são hardcoded como no `uterine-height-chart.tsx`.
- Cálculo/captura de novos campos no banco — toda a base de dados necessária já existe.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Disponibilidade do gráfico | 100% das gestações com `initial_weight_kg`/`height_cm` preenchidos exibem o gráfico corretamente classificado | Verificação manual em QA + casos de paciente reais |
| Paridade visual com Caderneta | Bandas CONMAI batem com a tabela oficial (seção 4 do documento de referência) em pelo menos 3 pontos de checagem por classificação | Revisão manual contra `prompts/009-gestational-weigth-gain.md` |

## Open Questions

- [ ] Quando `initial_weight_kg` ou `height_cm` (logo `initial_bmi`) estiverem ausentes, o gráfico deve ficar oculto, mostrar estado vazio, ou pedir preenchimento? (uterine-height-chart não tem este problema pois não depende de IMC)
- [ ] O toggle CONMAI/IOM é por gráfico (estado local) ou deve persistir preferência do profissional entre sessões?
- [ ] CONMAI define faixas por trimestre (3 pontos por categoria) — IOM define apenas total + taxa semanal constante. Confirmar se a banda IOM deve ser interpolada linearmente entre 0 e o total ao longo das 40 semanas, já que não há pontos intermediários oficiais.

---

## Users & Context

**Primary User**
- **Who**: Profissional de saúde (médico/enfermeiro obstetra) responsável pelo pré-natal.
- **Current behavior**: Registra o peso a cada consulta em `pregnancy_evolutions`; para avaliar adequação, hoje precisaria calcular manualmente ou consultar a Caderneta física.
- **Trigger**: Durante a consulta, ao revisar a evolução da gestante ou decidir sobre orientações nutricionais.
- **Success state**: Olha o gráfico e identifica imediatamente se o ganho de peso está dentro da faixa esperada para o IMC da paciente.

**Job to Be Done**
When estou avaliando a evolução de uma gestante durante o pré-natal, I want to ver de forma visual se o ganho de peso cumulativo está dentro da faixa esperada para o IMC pré-gestacional dela, so I can decidir rapidamente se preciso intervir (orientação nutricional, investigação adicional) sem fazer cálculo manual.

**Non-Users**
Pacientes visualizando diretamente o próprio gráfico (fora de uma consulta com o profissional); gestações múltiplas ou de alto risco, que não têm referência aplicável aqui.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Plotar ganho de peso cumulativo (peso atual − peso pré-gestacional) por semana gestacional | Núcleo da feature — sem isso não há gráfico |
| Must | Classificar automaticamente a faixa de referência usando `initial_bmi` (baixo peso/eutrofia/sobrepeso/obesidade) | Sem classificação automática, o profissional teria que escolher manualmente, reintroduzindo fricção |
| Must | Exibir bandas de referência CONMAI/MS 2022 por padrão | É a referência oficial atual da Caderneta da Gestante |
| Should | Toggle para alternar para bandas IOM 2009 | Referência internacional ainda amplamente usada; decidido incluir em v1 |
| Should | Posicionamento acima do `UterineHeightChart` na coluna lateral de `EvolutionsSection` | Requisito explícito do usuário |
| Could | Estado vazio claro quando `initial_bmi` não está disponível | Evita gráfico quebrado/enganoso, mas não bloqueia o MVP central |
| Won't | Curvas para gestação múltipla/alto risco | Fora do escopo das referências oficiais disponíveis |
| Won't | Visualização para a paciente | Não é o usuário-alvo desta iteração |

### MVP Scope

Componente `GestationalWeightGainChart` renderizado em `EvolutionsSection`, acima do `UterineHeightChart`, plotando pontos reais de ganho de peso cumulativo sobre as bandas CONMAI (padrão) com toggle para IOM, usando a classificação de IMC já armazenada em `pregnancies.initial_bmi`.

### User Flow

1. Profissional abre o cartão de pré-natal de uma paciente (`prenatal-card.tsx`).
2. Rola até `EvolutionsSection`.
3. Vê o novo gráfico de ganho de peso acima do gráfico de altura uterina, já classificado pela faixa de IMC da paciente, com os pontos de cada consulta plotados.
4. Opcionalmente alterna entre referência CONMAI e IOM via toggle.

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- Reutilizar majoritariamente a estrutura de `apps/web/src/components/shared/uterine-height-chart.tsx`: Chart.js via `react-chartjs-2`, cálculo de semana gestacional decimal (`gestational_weeks + (gestational_days ?? 0) / 7`), filtragem de evolutions válidas, props no mesmo formato.
- Diferença chave: o eixo Y é ganho cumulativo (`weight_kg − initial_weight_kg`), não um valor absoluto — exige acesso a `pregnancies.initial_weight_kg`/`initial_bmi` além de `pregnancy_evolutions`.
- Bandas de referência (CONMAI por trimestre, IOM por taxa semanal) hardcoded como datasets estáticos, no mesmo padrão dos percentis INTERGROWTH-21st já usados no gráfico de altura uterina.
- Classificação por IMC seleciona qual conjunto de bandas (das 4 categorias × 2 padrões) exibir.
- Sem novos campos de banco — todos os dados necessários (`initial_weight_kg`, `initial_bmi`, `height_cm`, `weight_kg`, `gestational_weeks/days`, `consultation_date`) já existem e já são buscados em `get-prenatal-card-action.ts`.
- Inserção em `prenatal-card.tsx`: novo componente antes de `<UterineHeightChart evolutions={evolutions} />` (linha 760), dentro da coluna lateral de 360px.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Interpolação da banda IOM (apenas total + taxa, sem pontos por trimestre) pode divergir da banda CONMAI (3 pontos por trimestre) em forma visual | M | Documentar a interpolação linear escolhida; validar visualmente contra a tabela do documento de referência |
| `initial_bmi` ausente em pacientes legadas/sem preenchimento completo | M | Definir estado vazio explícito (ver Open Questions) |
| Gestação múltipla sem flag clara no schema atual | L | Confirmar se existe campo de gestação múltipla antes de assumir todas como gestação única no cálculo |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Dados de referência | Codificar bandas CONMAI (4 categorias × 3 pontos por trimestre) e IOM (4 categorias × total/taxa) como datasets estáticos | complete | - | - | `.claude/PRPs/plans/completed/gestational-weight-gain-chart.plan.md` |
| 2 | Componente do gráfico | Criar `GestationalWeightGainChart` seguindo o padrão de `uterine-height-chart.tsx`, com classificação automática por IMC e toggle CONMAI/IOM | complete | - | 1 | `.claude/PRPs/plans/completed/gestational-weight-gain-chart.plan.md` |
| 3 | Integração no EvolutionsSection | Inserir o novo componente acima do `UterineHeightChart` em `prenatal-card.tsx`, tratando estado vazio quando IMC indisponível | complete | - | 2 | `.claude/PRPs/plans/completed/gestational-weight-gain-chart.plan.md` |
| 4 | Validação visual | Conferir bandas renderizadas contra a tabela oficial do documento de referência, para os 4 IMCs e ambos padrões | complete | - | 3 | `.claude/PRPs/plans/completed/gestational-weight-gain-chart.plan.md` |

### Phase Details

**Phase 1: Dados de referência**
- **Goal**: Ter os valores numéricos das curvas CONMAI e IOM estruturados em código, prontos para consumo pelo gráfico.
- **Scope**: Constantes/objetos TS com os percentis/faixas de `prompts/009-gestational-weigth-gain.md` seção 3 e 4.
- **Success signal**: Valores conferem 1:1 com as tabelas do documento de referência.

**Phase 2: Componente do gráfico**
- **Goal**: Componente funcional e isolado, testável com dados mockados.
- **Scope**: `GestationalWeightGainChart.tsx`, recebendo evolutions + dados de IMC/peso inicial via props, plotando ganho cumulativo sobre a banda da categoria correta, com toggle de padrão.
- **Success signal**: Renderiza corretamente com dados reais de uma gestação de teste, para as 4 categorias de IMC.

**Phase 3: Integração no EvolutionsSection**
- **Goal**: Gráfico visível na posição correta no cartão de pré-natal real.
- **Scope**: Edição de `prenatal-card.tsx` para inserir o componente acima da linha 760, passando os dados necessários (que já são buscados por `get-prenatal-card-action.ts`).
- **Success signal**: Gráfico aparece acima do gráfico de altura uterina em produção/local, sem quebrar o layout existente.

**Phase 4: Validação visual**
- **Goal**: Confiança de que as bandas exibidas batem com a referência oficial.
- **Scope**: Checagem manual ponto a ponto contra a seção 4 do documento de referência, para todas as 4 categorias e os 2 padrões.
- **Success signal**: Nenhuma divergência relevante encontrada; divergências documentadas como decisão consciente (ex: interpolação IOM).

### Parallelism Notes

Fases são sequenciais — não há paralelismo significativo, dado que cada fase depende diretamente dos dados/componente da fase anterior.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Padrão de referência no MVP | CONMAI + IOM com toggle | Apenas CONMAI; apenas IOM | Usuário optou por incluir ambos desde o v1 |
| Origem do IMC pré-gestacional | Reutilizar `pregnancies.initial_bmi` já existente | Adicionar novo campo | Dado já capturado e exibido no cartão; evita nova migração |
| Posição do gráfico | Coluna lateral, acima de `UterineHeightChart` | Abaixo; em nova seção própria | Requisito explícito do usuário |
| Stack técnica | Chart.js/react-chartjs-2 (mesma do uterine-height-chart) | Nova lib de gráficos | Reuso de padrão já validado, menor risco técnico |

---

## Research Summary

**Market Context**
Não foi necessário pesquisa de mercado externa — a referência clínica (CONMAI/MS 2022, IOM 2009) já estava documentada em `prompts/009-gestational-weigth-gain.md`, fornecida pelo usuário com fontes oficiais (Ministério da Saúde, FEBRASGO, Institute of Medicine).

**Technical Context**
Exploração de código confirmou que toda a base de dados necessária já existe (`pregnancy_evolutions.weight_kg`, `pregnancies.initial_weight_kg`/`initial_bmi`, `patients.height_cm`) e que o padrão de implementação do `uterine-height-chart.tsx` (Chart.js, cálculo de semana gestacional decimal, estrutura de datasets de percentil) é diretamente replicável para esta nova feature, reduzindo significativamente o risco técnico.

---

*Generated: 2026-06-20*
*Status: DRAFT - needs validation*
