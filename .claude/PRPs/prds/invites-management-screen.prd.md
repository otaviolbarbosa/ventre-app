# Gerenciamento de Convites (Invites)

## Problem Statement

Profissionais não têm nenhuma forma de gerenciar os convites que enviam — nem os enviados a gestantes para autocadastro (`patient_invite_links`), nem os enviados a outras profissionais para integrar equipes de cuidado (`team_invites`). Hoje só existe visibilidade dos convites **recebidos**. Convites enviados desaparecem da UI assim que o modal de compartilhamento é fechado, sem forma de saber se expiraram, foram rejeitados, ou precisam ser reenviados.

## Evidence

- Assumption - necessidade identificada internamente após a implementação dos invites de gestantes (`patient_invite_links`), quando ficou evidente a ausência de controle sobre convites enviados. Sem dado quantitativo de suporte/reclamação — validação será qualitativa, via uso real da funcionalidade.

## Proposed Solution

Expandir a tela de invites (`apps/web/src/screens/invites-screen.tsx`) para ser o hub central de gerenciamento de convites da aplicação, com duas abas — **Enviados** e **Recebidos** — cobrindo os dois tipos de convite (`patient_invite_links` e `team_invites`) e as ações necessárias (reenviar, aceitar, rejeitar), com convites expirados/rejeitados segregados visualmente do que está ativo. A alternativa de manter os convites enviados sem nenhuma visibilidade foi descartada porque é exatamente a lacuna que motiva o pedido.

## Key Hypothesis

Acreditamos que gerenciar os convites (visualizar, reenviar, aceitar, rejeitar em um único lugar) vai trazer autonomia para as profissionais.
Saberemos que estamos certos quando o gerenciamento de convites passar a ser usado pelas profissionais (adoção orgânica da tela, sem necessidade de suporte).

## What We're NOT Building

- Nenhum item fora de escopo identificado neste momento — o escopo descrito (duas abas, duas seções em Enviados, reenvio, expiração via cron) é o MVP completo.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Adoção da tela | Uso orgânico recorrente pelas profissionais | Qualitativo — observação de uso pós-lançamento |

## Open Questions

- [ ] A disposição das funcionalidades/componentes na UI pode não estar clara para as profissionais — validar com uso real após lançamento e ajustar se necessário.
- [ ] `patient_invite_links.status`: enum Postgres ou `text` livre (como `team_invites.status` hoje)? Decidir na fase de implementação — projeto tem convenção mista.

---

## Users & Context

**Primary User**
- **Who**: Qualquer profissional do parto (médica, doula, enfermeira, etc.) que envia e recebe convites — tanto para gestantes se autocadastrarem quanto para outras profissionais integrarem equipes de cuidado.
- **Current behavior**: Cria convites via modais (`invite-professional-modal`, `invite-existing-patient-modal`) e os compartilha manualmente (link/WhatsApp/e-mail), sem nenhum registro ou tela de acompanhamento posterior.
- **Trigger**: Precisa saber se um convite enviado foi aceito, expirou, ou precisa ser reenviado; ou precisa responder a um convite recebido.
- **Success state**: Abre a tela de invites e resolve qualquer tarefa relacionada a convites (visualizar, reenviar, aceitar, rejeitar) de forma autônoma, sem confusão.

**Job to Be Done**
Quando eu abrir a tela de invites, eu quero poder visualizar as informações mais importantes de cada invite de forma simples, para que eu possa executar qualquer tarefa relacionada a essa tela de forma autônoma e sem grandes complicações.

**Non-Users**
Gestores e gestantes — a tela é exclusiva para profissionais do parto.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Aba **Enviados** com duas seções: convites a gestantes (`patient_invite_links`) e a profissionais (`team_invites`) | Núcleo do problema — visibilidade de convites enviados não existe hoje |
| Must | Aba **Recebidos** com convites de equipe recebidos (`team_invites`), mantendo Aceitar/Recusar | Funcionalidade já existente, deve ser preservada |
| Must | Data de expiração visível em cada invite, em ambas as abas | Requisito explícito; sem isso a profissional não sabe quando agir |
| Must | Botão de reenviar em **Enviados** | Requisito explícito; hoje não existe reenvio para `team_invites`, e para `patient_invite_links` existe só dentro do modal de criação |
| Must | Convites expirados/rejeitados em lista separada, na parte de baixo de cada seção | Requisito explícito; evita o anti-padrão de convites "mortos" misturados com ativos |
| Must | Coluna `status` em `patient_invite_links` + job diário (Vercel Cron) que atualiza pendentes vencidos para expirado em ambas as tabelas, via `UPDATE` em lote (padrão `billing-statuses`) | Decisão técnica confirmada — necessário para que "expirado" seja um estado consultável sem checagem lazy em toda leitura |
| Should | Double-check de expiração no momento de aceitar/rejeitar (mantendo o padrão já existente em `respondToInvite`) | Rede de segurança contra a janela de corrida entre o cron (batch diário) e uma ação em tempo real |

### MVP Scope

Escopo completo descrito acima — duas abas, duas seções em Enviados, reenvio, e status derivado de cron. Não há corte de escopo para uma primeira iteração menor; o usuário confirmou que o MVP é a implementação completa.

### User Flow

1. Profissional acessa `/invites`.
2. Por padrão, vê a aba **Recebidos** (comportamento atual preservado) ou **Enviados** — a aba padrão é uma decisão de implementação a validar (provavelmente Recebidos, por ser o fluxo existente e mais acionável).
3. Em **Recebidos**: vê convites pendentes de equipes de cuidado, com Aceitar/Recusar; convites expirados/rejeitados aparecem em lista separada abaixo.
4. Em **Enviados**: vê duas seções (gestantes / profissionais), cada convite mostrando destinatário, data de expiração, e botão de reenviar; expirados/rejeitados em lista separada abaixo de cada seção.
5. Reenviar dispara o mesmo mecanismo de compartilhamento já existente (e-mail via `sendPatientInviteEmailAction` para `patient_invite_links`; para `team_invites`, requer nova ação de reenvio — hoje inexistente).

---

## Technical Approach

**Feasibility**: MEDIUM/HIGH

**Architecture Notes**
- Reutilizar padrão de `Tabs` (`packages/ui/src/tabs.tsx`), já usado em `users-screen.tsx`, para as abas Enviados/Recebidos.
- Nova coluna `patient_invite_links.status`, populada por migration (backfill baseado em `used_at`/`expires_at` existentes) e mantida por cron diário.
- Cron de expiração segue o padrão de `apps/web/app/api/cron/billing-statuses/route.ts`: `UPDATE` em lote síncrono, agendado via `vercel.json` (Vercel Cron) — **não** pg_cron/pg_net, e **sem fila (pgmq)** — decisão explícita do usuário após avaliação de custo/benefício.
- `respondToInvite` mantém o double-check de expiração em tempo real como rede de segurança.
- Reenvio para `team_invites` é uma capacidade nova (hoje só existe compartilhamento client-side no momento da criação) — precisa de uma action nova ou extensão de uma existente.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ausência de e-mail/notificação para `team_invites` hoje (só link/WhatsApp) — "reenviar" pode não ter um canal de envio automático equivalente ao de `patient_invite_links` | M | Definir na fase de plano se reenvio de `team_invites` reabre o modal de compartilhamento (copiar link) ou implementa envio de e-mail novo |
| `patient_invite_links.status` novo pode divergir de `used_at`/`expires_at` se o backfill ou o cron falhar silenciosamente | L | Job idempotente, com base em `UPDATE ... WHERE status = 'pendente' AND expires_at < now()`, seguindo o padrão já validado do `billing-statuses` |
| Disposição de UI confusa (risco levantado pelo usuário) | M | Validar com uso real pós-lançamento; ajustar layout se necessário (item em Open Questions) |

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
| 1 | Schema & cron | Adicionar `patient_invite_links.status` (migration + backfill), criar rota de cron de expiração em lote e registrar em `vercel.json` | complete | - | - | `.claude/PRPs/plans/completed/invite-status-cron-schema.plan.md` |
| 2 | Queries de listagem | Criar/estender queries e actions para listar convites enviados (ambas as tabelas) e recebidos, incluindo status derivado/expirado | complete | - | 1 | `.claude/PRPs/plans/completed/invites-listing-queries.plan.md` |
| 3 | Ação de reenvio para `team_invites` | Nova action de reenvio (extensão do modal de compartilhamento ou envio de e-mail) | complete | with 2 | 1 | `.claude/PRPs/plans/completed/resend-team-invite-action.plan.md` |
| 4 | UI — Tabs + seções | Implementar `Tabs` Enviados/Recebidos, seções por tipo, listas de expirados/rejeitados segregadas, data de expiração, botões de ação | pending | - | 2, 3 | - |

### Phase Details

**Phase 1: Schema & cron**
- **Goal**: Garantir que `status` seja uma fonte de verdade consultável para ambas as tabelas de convite.
- **Scope**: Migration para nova coluna + backfill; rota `apps/web/app/api/cron/*` seguindo padrão de `billing-statuses`; entrada em `vercel.json`; `pnpm db:types` após a migration.
- **Success signal**: Cron roda diariamente e atualiza convites vencidos para `expirado` em ambas as tabelas sem intervenção manual.

**Phase 2: Queries de listagem**
- **Goal**: Dados prontos para a UI consumir, com status correto.
- **Scope**: Queries/actions para "meus convites enviados" (patient + team) e "meus convites recebidos" (team), separando ativos de expirados/rejeitados.
- **Success signal**: Actions retornam os dados esperados, com testes/verificação manual cobrindo os 4 estados por tipo de convite.

**Phase 3: Ação de reenvio para `team_invites`**
- **Goal**: Preencher a lacuna de reenvio para convites de equipe, hoje inexistente.
- **Scope**: Nova server action seguindo `authActionClient`; decidir se reabre modal de compartilhamento ou envia e-mail.
- **Success signal**: Profissional consegue reenviar um convite de equipe pendente a partir da tela de invites.

**Phase 4: UI — Tabs + seções**
- **Goal**: Entregar a experiência completa descrita no PRD.
- **Scope**: Componente de tela com `Tabs`, seções, cards de convite (com data de expiração e ações), listas de expirados/rejeitados segregadas.
- **Success signal**: Profissional consegue visualizar e agir sobre qualquer convite (enviado ou recebido) sem sair da tela.

### Parallelism Notes

Fases 2 e 3 podem rodar em paralelo em worktrees separadas — tocam domínios diferentes (queries de leitura vs. nova action de escrita para `team_invites`). Fase 4 depende de ambas estarem prontas, já que consome os dados de leitura e a nova ação de reenvio.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Mecanismo de expiração | `UPDATE` em lote síncrono, agendado via Vercel Cron | Fila `pgmq` própria (paralela à de notificações); reaproveitar fila de notificações existente | Fila de notificações é acoplada ao domínio de envio de notificações, reaproveitá-la seria forçado; fila própria é complexidade não comprovadamente necessária. `billing-statuses` já valida o padrão de `UPDATE` em lote em produção. |
| Scheduler | Vercel Cron (`vercel.json`) | pg_cron + pg_net | Decisão explícita do usuário — mantém consistência com `billing-statuses`, que já usa Vercel Cron para essa classe de job. |
| Escopo do MVP | Implementação completa (2 abas, 2 seções, reenvio, expiração via cron) | MVP reduzido sem reenvio | Usuário confirmou que reenvio é essencial já no MVP, não um "nice to have" adiado. |

---

## Research Summary

**Market Context**
Padrões dominantes em SaaS (Slack, GitHub) usam lista única (não necessariamente em abas) com resend/revoke inline e expiração automática (7–30 dias). A divisão em abas Enviados/Recebidos é validada pela Nielsen Norman Group como uso correto de tabs para seções paralelas. Anti-padrão a evitar: convites expirados "presos" sem ação disponível — mitigado aqui separando expirados/rejeitados em lista própria, sempre com contexto claro. Não foi encontrada referência de mercado para uma tela que combine dois tipos de convite (paciente + profissional) — composição é original deste produto.

**Technical Context**
A tela atual só cobre convites recebidos (`team_invites`). Não existe hoje nenhuma listagem de convites enviados para nenhum dos dois tipos. `team_invites.status` é `text` livre com expiração checada lazily em `respondToInvite`; `patient_invite_links` não tem coluna de status. O padrão de fila de notificações (`pgmq` + `process_notification_queues`) existe mas é específico do domínio de envio de notificações — não é adequado para reaproveitamento direto. O precedente mais próximo para o cron de expiração é `billing-statuses` (Vercel Cron, `UPDATE` em lote síncrono, sem fila), adotado como padrão para este PRD.

---

*Generated: 2026-08-18*
*Status: DRAFT - needs validation*
