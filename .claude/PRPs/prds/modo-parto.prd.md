# Modo Parto (Birth Mode)

## Problem Statement

Quando uma gestante entra em trabalho de parto ativo, a equipe de cuidado (doulas, enfermeiras, médicas obstetras) hoje registra os eventos clínicos do parto — contrações, dilatação cervical, FCF, medicamentos — em papel ou outro registro físico. O Ventre não foi concebido originalmente para esse fluxo em tempo real e alta pressão, e não existe hoje nenhum jeito de a equipe inteira acompanhar e contribuir com os registros de um parto em andamento de forma coordenada.

## Evidence

- Levantamento acadêmico brasileiro encontrou **94,96% de erros em partogramas preenchidos manualmente** ([SciELO](https://www.scielo.br/j/reeusp/a/RpJYdRJxjLSNZj5nVDPknsq/?format=html&lang=pt)) — evidência indireta de que o registro manual em papel é propenso a erro e que digitalização guiada tem valor clínico real.
- Confirmado pelo usuário: processo atual é 100% papel/registro físico, sem ferramenta digital.
- Assumption: "adoção massiva" e "diminuição de dados mal formados" são as métricas de sucesso declaradas pelo cliente, ainda não validadas com dados de uso real (feature ainda não existe).

## Proposed Solution

Um modo dedicado do Ventre, ativado por qualquer membro da equipe de cuidado quando uma gestante entra em trabalho de parto ativo. A ativação dispara notificação WhatsApp para toda a equipe e, via Supabase Realtime, redireciona automaticamente (com contagem regressiva de 10s) qualquer profissional com o app aberto para a tela `/modo-parto`. Nessa tela, a equipe registra de forma colaborativa e em tempo real os eventos do parto — a maioria como registros múltiplos ao longo do tempo (contrações, dilatação, FCF, altura da apresentação/Lee, fluido amniótico, medicamentos), e dois como registros únicos (entrada em fase ativa, bolsa rota). Profissionais podem sair da tela e navegar livremente pelo Ventre, mas uma barra de notificação persistente no topo do app mantém o Modo Parto visível e permite retornar a qualquer momento. Ao final, o fluxo existente de finalização de acompanhamento (`finish-care-modal.tsx`) é estendido para capturar os dados de desfecho do parto (via de parto, data/hora, sexo, peso, APGAR).

## Key Hypothesis

Acreditamos que o Modo Parto vai agilizar a captura de informações durante o parto e isso vai diminuir a quantidade de dados mal formados durante esse processo, para as equipes de cuidado que usam o Ventre.
Saberemos que estamos certos quando as profissionais passarem a utilizar o resultado da coleta dos dados para documentar o processo de parto (adoção real do output, não só da entrada de dados).

## What We're NOT Building

- **Partograma (relatório/documento final compilado)** — a geração do documento clínico consolidado a partir dos dados coletados fica para uma fase futura. O Modo Parto desta fase é só captura estruturada de eventos, não o relatório final.
- **Bloqueio de edição concorrente** — não vamos impedir dois profissionais de registrarem a mesma medição; vamos apenas alertar quando houver duplicidade recente (ver regra abaixo).
- **Suporte formal a múltiplas escalas de altura da apresentação** — apenas a escala de Lee (-4 a +4) será suportada nesta fase, não o padrão 0–5 do partograma clássico.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Adoção do Modo Parto em partos com equipe de cuidado ativa | 90% dos partos elegíveis | `birth_mode_sessions` (ou tabela equivalente) / total de `pregnancies.has_finished = true` com equipe cadastrada, no período pós-lançamento |
| Registros digitais vs. papel | Redução mensurável de dados incompletos/mal formados no desfecho do parto | Comparar campos obrigatórios preenchidos em `finish-care-modal` extendido antes/depois do lançamento |
| Uso pós-parto dos dados coletados | Profissionais acessam/exportam os registros do parto após finalização | Evento de produto (PostHog) ao visualizar/consultar histórico de eventos do parto finalizado |

## Open Questions

- [ ] Qual é a base legal LGPD para esse fluxo (dado de saúde é dado sensível — precisa de revisão jurídica antes do lançamento)?
- [ ] Template WhatsApp está em produção/aprovação Meta — qual o prazo de aprovação e isso impacta a data de lançamento de 2 semanas?
- [ ] Como o app deve se comportar em conectividade ruim/instável de hospital (Realtime + registro offline)? Não foi levantado pelo cliente — TBD.
- [ ] Múltiplos dispositivos/abas do mesmo profissional — o redirect automático e a barra persistente precisam de comportamento definido por sessão ou por usuário?
- [ ] O prazo de 2 semanas é compatível com o escopo completo pedido (Realtime é funcionalidade nova no codebase, sem precedente) — precisa de validação de capacidade da equipe de dev.

---

## Users & Context

**Primary User**
- **Who**: Qualquer profissional da equipe de cuidado de uma gestante — doula, enfermeira, médica obstetra. Todos têm a mesma importância; não há papel "dono" do registro (apenas o `id_profissional` de quem ativa o Modo Parto é registrado como iniciador).
- **Current behavior**: Registra eventos do parto em papel ou outro meio físico.
- **Trigger**: Gestante da sua equipe de cuidado entra em trabalho de parto ativo.
- **Success state**: Consegue registrar e acompanhar os eventos do parto em tempo real, sem usar papel, sabendo imediatamente quando o Modo Parto foi ativado para uma paciente sua.

**Job to Be Done**
Quando alguém ativa o Modo Parto para uma paciente da minha equipe, eu quero saber disso imediatamente, para que eu possa contribuir com ou acompanhar os registros do parto em tempo real.

**Non-Users**
Assumption (não confirmado pelo cliente — precisa validação): partos domiciliares sem equipe cadastrada no Ventre; gestantes/pacientes como usuárias diretas (o Modo Parto é ferramenta da equipe profissional, não da paciente); clínicas/maternidades que não usam o Ventre como sistema principal de acompanhamento.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Ativação do Modo Parto (registra data/hora + `id_profissional` iniciador) | Ponto de entrada de todo o fluxo |
| Must | Notificação WhatsApp para toda a equipe de cuidado na ativação | Requisito explícito do cliente; gap de comunicação é o problema central |
| Must | Redirect em tempo real (Realtime) para `/modo-parto` com contagem de 10s | Requisito explícito do cliente, incluído no escopo completo pedido |
| Must | Barra de notificação persistente no topo do app quando Modo Parto ativo e usuário navega para outra tela | Ajuste explícito do cliente — navegação não é travada, mas o estado deve ser sempre visível |
| Must | Registros múltiplos: contração (com classificação automática efetiva/intermediária/não efetiva), dilatação cervical, altura da apresentação (Lee -4 a +4), FCF, fluido amniótico, medicamentos — todos com data/hora + `id_profissional` | Núcleo funcional do Modo Parto |
| Must | Registros únicos: entrada em fase ativa, bolsa rota | Especificado explicitamente pelo cliente como diferente cardinalidade |
| Must | Alerta de medição duplicada/recente (mesmo tipo de medição registrada há menos de 30 min por outro profissional) — não bloqueia, apenas avisa | Regra de negócio explícita para lidar com edição concorrente |
| Must | Extensão do `finish-care-modal.tsx`: via de parto (vaginal [normal\|assistido] / cesárea), data/hora do parto, sexo do bebê, peso, escala de APGAR | Requisito explícito do cliente |
| Won't | Geração do documento/relatório partograma consolidado | Adiado explicitamente pelo cliente para fase futura |

### MVP Scope

O cliente foi explícito: **todo o escopo descrito no prompt original deve ser implementado**, incluindo o redirect via Realtime — não há uma versão reduzida aceita para a v1. O "MVP" aqui é, na prática, o escopo completo do documento inicial. Dado o prazo de 2 semanas e o fato de Realtime ser tecnologia nova neste codebase, isso é um risco de cronograma que deve ser explicitamente comunicado ao cliente (ver Riscos Técnicos e Fases).

### User Flow

1. Doula/enfermeira/médica identifica que a gestante entrou em trabalho de parto ativo.
2. Profissional ativa o Modo Parto na ficha da paciente → grava `id_profissional` + timestamp de entrada em fase ativa.
3. Sistema dispara notificação WhatsApp para todos os `team_members` da paciente (via fila existente, análoga a `billing/notifications.ts`).
4. Sistema publica evento Realtime; qualquer profissional da equipe com o Ventre aberto recebe notificação in-app + contagem regressiva de 10s → redirect automático para `/modo-parto`.
5. Na tela `/modo-parto`, qualquer profissional da equipe registra eventos (múltiplos ou únicos conforme o tipo), cada um com timestamp + autor. Alertas de duplicidade aparecem quando aplicável.
6. Profissional pode sair da tela para outras áreas do Ventre; barra persistente no topo mantém o Modo Parto visível com botão de retorno.
7. Ao final do parto, fluxo de finalização de acompanhamento (modal estendido) captura desfecho: via de parto, data/hora, sexo, peso, APGAR — encerra o Modo Parto.

---

## Technical Approach

**Feasibility**: MEDIUM — a maior parte do trabalho (RLS, modelo de dados de eventos, fan-out de notificação) tem precedente direto e reutilizável no codebase. O risco concentrado é a introdução do Supabase Realtime, que não existe hoje na aplicação, combinada com o prazo de 2 semanas.

**Architecture Notes**
- Modelo de dados de eventos deve seguir o padrão append-only observado em `patient_evolutions` (`packages/supabase/supabase/migrations/20260207000000_patient_evolutions.sql`): sem UPDATE/DELETE, um registro por evento, `professional_id` + `created_at` obrigatórios.
- Tabelas provavelmente escopadas por `pregnancy_id` (como `ultrasounds`), não `patient_id` diretamente, seguindo o padrão de tabelas clínicas estruturadas já existentes.
- Fan-out de notificação para toda a equipe deve reaproveitar o padrão de `apps/web/src/lib/billing/notifications.ts:42-91` (itera `team_members.professional_id` + paciente).
- Envio WhatsApp: usar a fila assíncrona existente (`enqueueNotification` + handler em `whatsapp-queue-handlers.ts`) em vez do envio síncrono direto, dado que é um fan-out para múltiplos destinatários — mais robusto a falhas parciais.
- Realtime: **primeira implementação de Supabase Realtime no codebase** (`.channel()`/`postgres_changes`) — sem convenção existente para nomenclatura de canal, cleanup de subscription, ou reconexão. Precisa de spike técnico antes da implementação.
- RLS: reaproveitar `is_team_member(patient_id)` para todas as novas tabelas de evento do Modo Parto.
- `finish-care-modal.tsx` e a action `finish-patient-care-action.ts` precisam de extensão de schema (Zod) e da tabela `pregnancies` (ou nova tabela de desfecho) para os novos campos (sexo, peso, APGAR).

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Realtime é greenfield no codebase — subscription/cleanup/reconexão sem padrão testado | H | Spike técnico dedicado no início da implementação, antes de comprometer o prazo de 2 semanas |
| Prazo de 2 semanas para escopo completo (incluindo Realtime) | H | Comunicar ao cliente o risco de cronograma; considerar fatiar entrega em fases com validação incremental |
| Template WhatsApp ainda em aprovação pela Meta | M | Acompanhar prazo de aprovação em paralelo; sem template aprovado, notificação não pode ir ao ar mesmo com o resto pronto |
| Conformidade LGPD para dado de saúde sensível não verificada | M | Revisão jurídica antes do lançamento — bloqueante para produção, não para desenvolvimento |
| Comportamento em conectividade instável de hospital não definido | M | TBD — precisa decisão de produto antes de finalizar UX do formulário de registro |
| Alerta de duplicidade (30 min) exige leitura de estado recente entre múltiplos profissionais editando simultaneamente | M | Modelar como query simples (última medição do mesmo tipo por paciente/pregnancy nos últimos 30 min), não requer lock nem transação complexa |

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
| 1 | Modelo de dados & RLS | Tabelas de eventos do parto (únicos e múltiplos), ativação do Modo Parto, RLS via `is_team_member` | complete | - | - | `.claude/PRPs/plans/completed/modo-parto-fase-1-modelo-de-dados.plan.md` |
| 2 | Realtime spike & infraestrutura | Prova de conceito de subscription/redirect via Supabase Realtime; convenção de canal e cleanup | complete | with 1 | - | `.claude/PRPs/plans/completed/modo-parto-fase-2-realtime-spike.plan.md` |
| 3 | Notificação WhatsApp de ativação | Fan-out para equipe via fila existente, novo `WhatsAppNotificationType`, handler de fila | complete | with 4 | 1 | `.claude/PRPs/plans/completed/modo-parto-fase-3-notificacao-whatsapp.plan.md` |
| 4 | Tela `/modo-parto` e formulários de registro | UI de registro para todos os eventos, com alerta de duplicidade (30 min) | complete | with 3 | 1, 2 | `.claude/PRPs/plans/completed/modo-parto-fase-4-tela-registro.plan.md` |
| 5 | Redirect automático + barra persistente | Notificação in-app, contagem de 10s, barra de status global no layout | in-progress | - | 2, 4 | `.claude/PRPs/plans/modo-parto-fase-5-redirect-e-barra.plan.md` |
| 6 | Extensão do fluxo de finalização | Estender `finish-care-modal.tsx` + action + schema `pregnancies` com dados de desfecho do parto | pending | with 3 | 1 | - |

### Phase Details

**Phase 1: Modelo de dados & RLS**
- **Goal**: Base de dados sólida para todos os eventos do Modo Parto.
- **Scope**: Migrations para tabelas de evento (contração, dilatação, Lee, FCF, fluido amniótico, medicamentos — múltiplos; entrada em fase ativa, bolsa rota — únicos), tabela/coluna de estado do Modo Parto na paciente/gestação, políticas RLS reaproveitando `is_team_member`.
- **Success signal**: Migrations aplicadas, `pnpm db:types` gerado, queries de leitura/escrita testadas via RLS para membro de equipe e não-membro.

**Phase 2: Realtime spike & infraestrutura**
- **Goal**: Validar viabilidade técnica do redirect em tempo real antes de comprometer o restante do cronograma.
- **Scope**: Prova de conceito mínima de `.channel()`/`postgres_changes` disparando evento no client quando Modo Parto é ativado; decidir padrão de cleanup/reconexão.
- **Success signal**: Cliente conectado recebe evento de ativação em <2s, com reconexão funcional após queda de rede simulada.

**Phase 3: Notificação WhatsApp de ativação**
- **Goal**: Toda a equipe de cuidado recebe WhatsApp na ativação do Modo Parto.
- **Scope**: Novo tipo de notificação na fila existente, handler de fan-out (padrão `billing/notifications.ts`), texto do template (dependente de aprovação Meta, em produção).
- **Success signal**: Ativação de teste gera mensagem para todos os `team_members` da paciente, logada em `notification_log`.

**Phase 4: Tela `/modo-parto` e formulários de registro**
- **Goal**: Interface funcional de captura de todos os eventos do parto.
- **Scope**: Formulários para os 8 tipos de registro do prompt original, com cardinalidade correta (múltiplo vs. único), classificação automática de efetividade da contração, alerta de duplicidade (30 min).
- **Success signal**: Profissional consegue registrar cada tipo de evento e ver histórico atualizado em tempo real para outros membros da equipe.

**Phase 5: Redirect automático + barra persistente**
- **Goal**: Comportamento de "hijacking suave" descrito pelo cliente.
- **Scope**: Notificação in-app com contagem regressiva de 10s ao receber evento Realtime; barra de status global (layout do dashboard) visível em qualquer tela enquanto Modo Parto ativo, com botão de retorno a `/modo-parto`.
- **Success signal**: Usuário com app aberto em outra tela é redirecionado automaticamente; ao navegar para longe depois, barra persistente aparece e permite retorno com 1 clique.

**Phase 6: Extensão do fluxo de finalização**
- **Goal**: Capturar desfecho estruturado do parto.
- **Scope**: Estender `finish-care-modal.tsx`, schema Zod e `finish-patient-care-action.ts` (ou tabela nova) com via de parto (vaginal normal/assistido, cesárea), data/hora, sexo do bebê, peso, escala de APGAR.
- **Success signal**: Finalização de um parto de teste grava todos os campos novos corretamente e mantém compatibilidade com o fluxo de finalização já existente para partos sem Modo Parto.

### Parallelism Notes

Fases 1 e 2 podem rodar em paralelo (dados vs. spike técnico de Realtime, domínios independentes). Fases 3, 4 e 6 dependem da Fase 1 (schema pronto) e podem rodar em paralelo entre si em worktrees separadas, já que tocam áreas diferentes (notificação, UI de registro, modal de finalização). Fase 5 depende de 2 (Realtime funcionando) e 4 (tela existir) — deve ser a última a fechar.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Escala de altura da apresentação | Lee (-4 a +4) | Escala 0–5 do partograma clássico | Escolha explícita do cliente; simplifica escopo (não precisa ser configurável) |
| Edição concorrente da mesma medição | Alerta não-bloqueante se houver medição do mesmo tipo há menos de 30 min | Bloquear edição / lock otimista / merge automático | Decisão explícita do cliente — prioriza continuidade do registro sobre prevenção rígida de duplicidade |
| Canal de notificação de ativação | WhatsApp via fila assíncrona existente | Push notification nativo, envio síncrono direto | Reaproveita infraestrutura já madura (retry, dead-letter); requisito original já pedia WhatsApp |
| Escopo do Modo Parto vs. Partograma | Só captura de eventos nesta fase; relatório consolidado fica para depois | Entregar partograma completo já nesta fase | Decisão explícita do cliente para viabilizar prazo de 2 semanas |
| Bloqueio de navegação durante Modo Parto | Não bloqueia — barra persistente + retorno manual | Travar app inteiro em `/modo-parto` até desativação | Ajuste explícito do cliente após entendimento inicial do documento original |

---

## Research Summary

**Market Context**
Não existe concorrente direto oferecendo colaboração multi-profissional em tempo real (doula + enfermeira + obstetra) fora de EHRs hospitalares fechados e caros (Epic Stork, Cerner FetaLink) — espaço em branco real, mas sem padrão de UX comprovado para copiar. O padrão clínico atual é o WHO Labour Care Guide (substituiu o partograma clássico em 2020). Estudo brasileiro encontrou 94,96% de erros em partogramas manuais, reforçando o valor da digitalização guiada. Padrão NICHD para contrações usa duração/intensidade/frequência, com "taquissistolia" (>5 em 10 min) como limiar clínico nomeado que pode virar alerta futuro. UX de interrupção clínica geral recomenda que só eventos realmente acionáveis sejam bloqueantes — o resto deve ser indicador passivo, o que confirma o ajuste do cliente (redirect inicial + barra persistente, não travamento total).

**Technical Context**
O codebase já tem toda a base de segurança e dados necessária: `is_team_member(patient_id)` cobre RLS, `patient_evolutions` é o modelo direto para tabelas de evento append-only, e `billing/notifications.ts` já resolve fan-out de notificação para toda a equipe. `finish-care-modal.tsx` hoje é simples (via de parto, data, nota livre) e precisa de extensão real para os campos de desfecho pedidos. A fila de WhatsApp (pgmq + cron) é madura e deve ser reaproveitada em vez do envio síncrono direto. O maior risco é que **Supabase Realtime nunca foi usado nesta aplicação** — não há convenção de canal, cleanup ou reconexão a seguir, o que torna a Fase 2 (spike) crítica para não comprometer o prazo de 2 semanas.

---

*Generated: 2026-08-20*
*Status: DRAFT - needs validation*
