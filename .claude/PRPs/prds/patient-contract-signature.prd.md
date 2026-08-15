# Assinatura de Contrato pela Gestante

## Problem Statement

O contrato de acompanhamento hoje só é assinado eletronicamente pela profissional/CONTRATADA
(feature entregue em `contract-signature.prd.md`) — a gestante/CONTRATANTE não tem nenhum
fluxo para visualizar, solicitar alteração ou assinar o contrato dentro da plataforma. Isso
mantém o processo descentralizado: a profissional ainda precisa recorrer a outro canal
(WhatsApp, e-mail, papel) para formalizar o acordo com a paciente, o que é exatamente o custo
que a Nascere quer eliminar como diferencial de mercado antes do lançamento.

## Evidence

- Nenhuma plataforma concorrente voltada a doulas/parteiras/obstetras identificada
  (DoulaOS, Doulado, eDoula.biz nos EUA; ObsCare no Brasil) publica um fluxo nativo de
  assinatura bilateral dentro do produto — a maioria integra ou não divulga o mecanismo.
  Isso é evidência de oportunidade de mercado, não de demanda validada por usuárias.
- Assumption: a motivação central é estratégica (diferencial de lançamento) e de eficiência
  operacional (eliminar canais paralelos), não um problema relatado por usuárias em produção —
  precisa validação pós-lançamento via uso real.

## Proposed Solution

Estender o pipeline de assinatura já existente (hash, `verification_code`, imutabilidade)
para suportar duas assinaturas independentes por contrato — profissional/CONTRATADA e
gestante/CONTRATANTE — via uma tabela filha `contract_signatures`, em vez de reaproveitar as
colunas singulares hoje existentes em `contracts`. A gestante ganha acesso de leitura ao
próprio contrato (nova política RLS espelhando o padrão já usado em `appointments`), pode
solicitar alteração via um campo de texto rico (reaproveitando o `RichEditor` já usado no
projeto) antes de assinar, e visualiza contratos pendentes/assinados na sua home (hoje
inexistente). Quando qualquer parte pede mudança após a assinatura completa de ambas as
partes, o contrato vigente é revogado e um contrato novo é redigido do zero — não há edição
in-place de um contrato já totalmente assinado. Notificações (push + WhatsApp) avisam cada
parte nos momentos relevantes, reaproveitando a fila de notificações (`enqueueNotification` +
`pg_cron`) já usada por `schedule_contract_pending_signature`. A pré-visualização do
documento passa a usar `pdf.js` para renderizar o PDF real (hoje `contract-signature-preview.tsx`
é apenas HTML estilizado simulando o rodapé de assinatura, não um preview de PDF de fato).

## Key Hypothesis

Acreditamos que permitir assinatura digital nativa de ambas as partes vai resolver a
descentralização do processo de contrato para profissionais autônomas/empresas e gestantes.
Saberemos que estamos certos quando essa funcionalidade começar a ser usada por 80% das
usuárias ativas.

## What We're NOT Building

- Assinatura com certificado ICP-Brasil (assinatura qualificada) — a assinatura eletrônica
  simples/avançada já implementada (hash + trilha de auditoria) é juridicamente suficiente
  para um contrato bilateral privado sob a MP 2.200-2/2001; certificação qualificada
  adicionaria custo/complexidade sem necessidade jurídica identificada.
- Reconhecimento em cartório — fora do escopo de um contrato de prestação de serviço privado
  entre profissional e gestante.
- Contratos multi-idioma — a plataforma opera hoje só em pt-BR.
- Edição in-place de um contrato já assinado por todas as partes com apenas re-assinatura das
  cláusulas alteradas — qualquer mudança pós-assinatura-completa exige revogar o contrato
  vigente e redigir um novo do zero, sem mecanismo de "amendment" incremental.
- Integração com plataformas terceiras de assinatura (DocuSign, Clicksign, ZapSign, D4Sign,
  Autentique) — constraint explícita do usuário, tudo construído internamente.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| % de usuárias ativas (profissionais + gestantes) usando a assinatura digital | 80% | Contratos com `is_signed = true` via fluxo nativo / total de usuárias ativas com contrato gerado, medido pós-lançamento |
| Tempo entre geração do contrato e assinatura completa (ambas as partes) | Redução perceptível vs. baseline manual (sem baseline numérico hoje — TBD) | Diferença entre `contracts.created_at` e o `signed_at` da última assinatura pendente na tabela `contract_signatures` |

## Open Questions

- [ ] Não há baseline numérico do tempo médio de formalização hoje (processo manual/externo)
      para comparar o "antes x depois" — precisa ser estimado ou aceito como não mensurável no v1.
- [ ] A meta de 80% de adoção foi definida sem pesquisa de usuário direta — vale validar com
      as profissionais beta antes de tratar como meta rígida de lançamento.
- [ ] Fluxo de "solicitar alteração" não define limite de quantas rodadas de solicitação são
      permitidas antes da assinatura — pode gerar loop indefinido entre gestante e profissional.

---

## Users & Context

**Primary User**
- **Who**: Qualquer profissional (autônoma ou vinculada a empresa/organização) que fecha um
  novo acompanhamento, e a gestante vinculada a esse acompanhamento — ambas são usuárias
  primárias, com papéis diferentes no mesmo fluxo.
- **Current behavior**: A profissional gera e assina o contrato pela plataforma (feature já
  existente); a gestante não tem nenhuma visibilidade ou ação sobre o contrato hoje.
- **Trigger**: Profissional gera o contrato após negociar os termos do acompanhamento com a
  gestante.
- **Success state**: O contrato fica disponível na área da gestante, ela pode consultar,
  solicitar alteração se necessário, e assinar — sem sair da plataforma e sem canal externo.

**Job to Be Done**
Quando eu (profissional) gerar um contrato, eu quero que ele esteja disponível na área
destinada à gestante, para que eu e a gestante possamos assinar e consultar sem depender de
outro canal.

**Non-Users**
Por enquanto, todas as usuárias da plataforma são usuárias potenciais desta feature — não há
segmento explicitamente excluído no v1.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Tabela filha `contract_signatures` (uma linha por papel: profissional/gestante) | Colunas singulares atuais em `contracts` + trigger de imutabilidade travam a linha após a 1ª assinatura, impedindo uma 2ª assinatura independente |
| Must | RLS de leitura/assinatura da gestante no próprio contrato | Hoje a gestante não tem nenhum acesso de leitura à própria linha em `contracts` |
| Must | Ação de assinatura pela gestante, reaproveitando pipeline de hash/imutabilidade | Consistência com o padrão já validado juridicamente na assinatura da profissional |
| Must | Bloqueio de geração/assinatura se houver campo `[não informado]` no cabeçalho | Requisito explícito do usuário — hoje o placeholder pode vazar para o PDF assinado sem checagem |
| Must | Campo de solicitação de alteração (rich text, `contract_change_requests`) | Requisito explícito — gestante precisa poder pedir mudança antes de assinar |
| Must | Seção de contratos pendentes + assinados na home da gestante | Hoje a home não tem nenhuma seção de pendências |
| Must | Notificações push + WhatsApp (contrato pronto, alteração solicitada, assinatura completa) | Reaproveita fila de notificação já existente; sem isso a gestante não sabe que há algo pendente |
| Must | Fluxo de revogação + recriação quando há pedido de mudança pós-assinatura completa | Decisão explícita do usuário — sem amendment incremental |
| Should | Preview real do PDF via `pdf.js` em `contract-signature-preview.tsx`, `contract-settings-screen.tsx`, `personal-contract-settings-screen.tsx` | Melhoria de UX de visualização — não bloqueia a validade jurídica nem o fluxo de assinatura em si |
| Won't | Assinatura com certificado ICP-Brasil | Fora de escopo (ver "What We're NOT Building") |
| Won't | Edição in-place de contrato totalmente assinado | Fora de escopo — sempre revoga + recria |

### MVP Scope

Assinatura de todas as partes (profissional + gestante) + solicitação de alteração +
visualização de contratos pendentes/assinados na home da gestante. O preview com `pdf.js` é
Should-have e pode ser entregue em fase separada sem bloquear a validação da hipótese central.

### User Flow

1. Profissional gera/edita o contrato (fluxo já existente em `patient-contract.tsx`) —
   geração bloqueada se houver `[não informado]` pendente no cabeçalho.
2. Gestante recebe notificação (push + WhatsApp) de que o contrato está pronto para
   assinatura.
3. Na home, a gestante vê o contrato pendente, abre para visualizar (preview real via
   `pdf.js` na fase Should-have).
4. Gestante pode: (a) solicitar alteração via campo rich text — profissional é notificada
   (push + WhatsApp), redige um novo contrato/ajusta e reinicia o ciclo; ou (b) assinar
   diretamente.
5. Cada assinatura (profissional e gestante) grava uma linha própria em
   `contract_signatures`, com hash/IP/user-agent/timestamp independentes.
6. Quando ambas as partes assinaram, o contrato é finalizado (PDF final gerado/hasheado,
   imutável) e a profissional é notificada.
7. Gestante visualiza o contrato assinado na home, associado à sua gestação.
8. Se, após assinatura completa por ambas as partes, qualquer uma solicitar mudança: o
   contrato vigente é revogado/invalidado, e a profissional redige um contrato novo do zero,
   reiniciando o ciclo a partir do passo 1.

---

## Technical Approach

**Feasibility**: MÉDIA — a maior parte do pipeline de geração de PDF, hash e notificação já
existe e é reaproveitável; o ponto de maior esforço é a remodelagem do dado de assinatura
(colunas singulares → tabela filha) e a reescrita do trigger de imutabilidade.

**Architecture Notes**
- Tabela nova `contract_signatures`: `id`, `contract_id` (FK `contracts`), `signer_role`
  (`professional` | `patient`), `signer_id`, `signed_at`, `signed_ip`, `signed_user_agent`,
  `verification_code`, com constraint única em `(contract_id, signer_role)`. `contracts`
  passa a ser finalizado/imutável (PDF final gerado e hasheado) apenas quando ambas as linhas
  existirem — trigger `prevent_signed_contract_mutation` precisa ser reescrito para essa nova
  condição de "totalmente assinado".
- RLS de leitura/assinatura da gestante segue exatamente o padrão já usado em
  `appointments` (`20260710000003_appointments_patient_rls_and_confirm.sql`):
  `patients.user_id = auth.uid()`.
- "Profissional responsável" no caso multi-profissional sem empresa = `patients.created_by`
  (confirmado pelo usuário) — não precisa de nova coluna/flag.
- Solicitação de alteração: nova tabela `contract_change_requests`
  (`contract_id`, `patient_id`, `requested_by`, `message_html`, `status`, `created_at`,
  `resolved_at`, `resolved_by`), sem padrão idêntico existente no projeto — modelada por
  analogia a `patient_invite_links` (coluna `status`) e `appointments.confirmed_by_patient_at`.
- Gate de `[não informado]`: checagem a inserir logo após `buildPatientContractParties()`
  retornar, antes de persistir/assinar — hoje esse ponto não existe em
  `sign-patient-contract-action.ts`.
- Notificações reaproveitam `sendWhatsAppToUser` (síncrono, no momento da ação) e
  `enqueueNotification`/`pg_cron` (para lembretes, como já feito em
  `schedule_contract_pending_signature`) — só precisa de novos `notification_type`.
- Preview com `pdf.js`: `pdfjs-dist` não é dependência hoje; é necessário (a) adicionar a
  lib no client, (b) uma rota/action que chame `renderContractPdfBuffer()` contra estado de
  rascunho (hoje só é chamada no momento da assinatura, com dados já persistidos), (c) um
  componente cliente que renderize o buffer via canvas/`pdfjs-dist`.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reescrever o trigger de imutabilidade sem quebrar o fluxo já em produção da assinatura da profissional | M | Migração cuidadosa com testes cobrindo o caso "só profissional assinou" (ainda mutável) vs. "ambas assinaram" (imutável); rollout em fase isolada antes de ligar o lado da gestante |
| Loop indefinido de "solicitar alteração" sem limite | M | Definir limite de rodadas ou pelo menos instrumentar para observar no v1 (ver Open Questions) |
| `renderContractPdfBuffer` hoje só aceita dados já persistidos — preview de rascunho exige refatoração para aceitar dados não salvos | M | Isolar essa mudança na fase de preview (Should-have), sem acoplar ao caminho crítico de assinatura |
| Vazamento de `[não informado]` para PDF assinado sem bloqueio, caso o gate não cubra todos os pontos de entrada (patient-contract vs. futura ação de assinatura da gestante) | M | Centralizar a checagem em um helper único (`hasUnfilledFields()`) chamado por ambas as ações de assinatura |

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
| 1 | Modelo de dados de assinatura dupla | `contract_signatures`, migração das assinaturas de profissional existentes, reescrita do trigger de imutabilidade, RLS de leitura da gestante | complete | - | - | [patient-contract-signature-phase-1-data-model.plan.md](../plans/completed/patient-contract-signature-phase-1-data-model.plan.md) |
| 2 | Assinatura pela gestante + gate de campos ausentes + autorização do lado CONTRATADA | Ação de assinatura da gestante reaproveitando o pipeline de hash/imutabilidade, checagem de `[não informado]` antes de assinar, validação de quem pode assinar pelo lado CONTRATADA | complete | - | 1 | [patient-contract-signature-phase-2-patient-signing.plan.md](../plans/completed/patient-contract-signature-phase-2-patient-signing.plan.md) |
| 3 | Solicitar alteração | `contract_change_requests`, ações de criar/resolver, RLS, UI do campo rich text | complete | with 2 | 1 | [patient-contract-signature-phase-3-change-requests.plan.md](../plans/completed/patient-contract-signature-phase-3-change-requests.plan.md) |
| 4 | Notificações | Push + WhatsApp para contrato pronto, alteração solicitada, assinatura completa | complete | - | 2, 3 | [patient-contract-signature-phase-4-notifications.plan.md](../plans/completed/patient-contract-signature-phase-4-notifications.plan.md) |
| 5 | Home da gestante — pendências e assinados | Seção de contratos pendentes/assinados em `patient-home-screen.tsx` | in-progress | with 4 | 2 | [patient-contract-signature-phase-5-patient-home.plan.md](../plans/patient-contract-signature-phase-5-patient-home.plan.md) |
| 6 | Revogação e recriação pós-assinatura completa | Fluxo de revogar contrato vigente e redigir novo quando há pedido de mudança após ambas as partes já terem assinado | in-progress | - | 2, 3 | [patient-contract-signature-phase-6-revocation.plan.md](../plans/patient-contract-signature-phase-6-revocation.plan.md) |
| 7 | Preview com pdf.js | Renderização real do PDF (draft e final) em `contract-signature-preview.tsx`, `contract-settings-screen.tsx`, `personal-contract-settings-screen.tsx` | in-progress | with 4, 5, 6 | 1 | [patient-contract-signature-phase-7-pdf-preview.plan.md](../plans/patient-contract-signature-phase-7-pdf-preview.plan.md) |

### Phase Details

**Phase 1: Modelo de dados de assinatura dupla**
- **Goal**: Permitir que um contrato tenha duas assinaturas independentes (profissional e
  gestante) sem violar a imutabilidade já garantida hoje.
- **Scope**: Nova tabela `contract_signatures`, migração de dados/lógica das colunas
  singulares atuais de `contracts` para a nova tabela (ou coexistência controlada), reescrita
  de `prevent_signed_contract_mutation` para considerar "totalmente assinado" como a condição
  de trava, nova política RLS de SELECT para a gestante em `contracts` espelhando o padrão de
  `appointments`.
- **Success signal**: Uma linha de `contracts` pode ter uma assinatura de profissional sem
  travar, e só se torna imutável quando a segunda assinatura (gestante) é gravada.

**Phase 2: Assinatura pela gestante + gate de campos ausentes + autorização do lado CONTRATADA**
- **Goal**: Gestante consegue assinar o contrato pela plataforma, com a mesma robustez
  jurídica (hash, IP, user-agent, verification code) já aplicada à profissional; e apenas a
  pessoa correta consegue assinar pelo lado CONTRATADA.
- **Scope**: Nova ação de assinatura (ou extensão da existente) usando `contract_signatures`;
  checagem centralizada de `[não informado]` bloqueando a assinatura/geração enquanto houver
  campo pendente; validação de autorização em `sign-patient-contract-action.ts` (ou equivalente)
  antes de gravar `signer_role = 'professional'` — hoje **qualquer** membro da equipe consegue
  assinar pelo lado CONTRATADA, sem checar se é de fato a pessoa autorizada. Regra: se o
  contrato é de empresa/organização (`profile.enterprise_id` setado), só `user_type IN
  ('manager', 'secretary')` pode assinar; caso contrário (multi-profissional sem empresa), só
  `patients.created_by = user.id` pode assinar. Achado durante a implementação da Fase 1 (ver
  relatório `patient-contract-signature-phase-1-data-model-report.md`) — `signer_role` é um
  rótulo de papel no contrato (CONTRATADA/CONTRATANTE), não um espelho de `users.user_type`, e
  a ação grava esse rótulo de forma incondicional hoje.
- **Success signal**: Gestante assina, linha correspondente é criada em
  `contract_signatures`, contrato com campo `[não informado]` não pode ser assinado, e uma
  tentativa de assinatura pelo lado CONTRATADA por alguém não autorizado (ex.: profissional
  comum tentando assinar um contrato de empresa) é rejeitada.

**Phase 3: Solicitar alteração**
- **Goal**: Gestante pode pedir mudança no contrato antes de assinar.
- **Scope**: Tabela `contract_change_requests`, ações de criar solicitação (gestante) e
  marcar como resolvida (profissional), RLS, campo de texto rico reaproveitando
  `RichEditor`.
- **Success signal**: Gestante registra uma solicitação de alteração vinculada ao contrato;
  profissional visualiza e pode marcar como resolvida.

**Phase 4: Notificações**
- **Goal**: Cada parte é avisada nos momentos relevantes sem precisar checar a plataforma
  ativamente.
- **Scope**: Novos `notification_type` para contrato pronto (gestante), alteração solicitada
  (profissional) e assinatura completa (profissional), usando `sendWhatsAppToUser` e/ou
  `enqueueNotification` conforme o padrão síncrono/assíncrono já estabelecido.
- **Success signal**: Push e WhatsApp disparados corretamente em cada evento, sem duplicidade.

**Phase 5: Home da gestante — pendências e assinados**
- **Goal**: Gestante enxerga o estado dos seus contratos sem precisar navegar manualmente.
- **Scope**: Nova seção em `patient-home-screen.tsx` listando contratos pendentes de
  assinatura e contratos assinados, associados à gestação.
- **Success signal**: Contrato pendente aparece na home assim que gerado; some da lista de
  pendentes e aparece na lista de assinados após a assinatura completa.

**Phase 6: Revogação e recriação pós-assinatura completa**
- **Goal**: Suportar mudança de contrato mesmo depois de assinado por todas as partes, sem
  amendment incremental.
- **Scope**: Ação de revogar/invalidar o contrato vigente (marcando estado, não deletando —
  preserva histórico/imutabilidade), fluxo de redigir novo contrato do zero reaproveitando o
  ciclo das fases 1-3.
- **Success signal**: Contrato revogado permanece consultável (auditoria), novo contrato
  segue o ciclo completo de geração → assinatura novamente.

**Phase 7: Preview com pdf.js**
- **Goal**: Melhorar a visualização do contrato (rascunho e assinado) com um preview real de
  PDF, substituindo a simulação em HTML atual.
- **Scope**: Adicionar `pdfjs-dist`, criar caminho para renderizar PDF de rascunho (dados não
  persistidos) via `renderContractPdfBuffer`, componente de visualização client-side,
  aplicado nos três componentes/telas listados no prompt original.
- **Success signal**: `contract-signature-preview.tsx`, `contract-settings-screen.tsx` e
  `personal-contract-settings-screen.tsx` renderizam o PDF real via `pdf.js`, não mais um
  mock em HTML.

### Parallelism Notes

Fase 1 é bloqueante para tudo — é a mudança de schema que viabiliza a assinatura dupla.
Fases 2 e 3 podem rodar em paralelo (assinatura da gestante e solicitação de alteração tocam
arquivos diferentes, ambas dependem só da Fase 1). Fases 4 e 5 dependem do estado de
assinatura/alteração existir (Fases 2/3) para terem o que notificar/exibir, mas podem rodar
em paralelo entre si e com a Fase 7 (preview é uma camada de UI isolada, dependente apenas do
pipeline de geração de PDF já existente desde a Fase 1). Fase 6 depende de 2 e 3 porque
precisa do ciclo completo de assinatura e do fluxo de alteração já funcionando para poder
"reiniciar" o processo.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Modelo de assinatura dupla | Tabela filha `contract_signatures` | Novas colunas `patient_*` diretamente em `contracts` | Usuário optou explicitamente pela tabela filha — mais extensível caso surjam outros papéis de assinatura no futuro, e evita reescrever o trigger para múltiplos conjuntos de colunas |
| "Profissional responsável" (multi-profissional sem empresa) | `patients.created_by` | Nova coluna/flag em `team_members` | Já existe e resolve o caso sem migração adicional — confirmado pelo usuário |
| Mudança pós-assinatura completa | Revogar contrato vigente + redigir novo do zero | Amendment incremental (editar cláusulas e re-coletar só as assinaturas afetadas) | Decisão explícita do usuário — mais simples de implementar e mais claro para auditoria/histórico jurídico |
| Vendor de assinatura eletrônica | Construção 100% interna | Clicksign/DocuSign/ZapSign/D4Sign | Constraint explícita do usuário; MP 2.200-2/2001 permite assinatura simples/avançada sem ICP-Brasil, desde que haja trilha de auditoria — já implementada no pipeline existente |
| Preview de documento | `pdf.js`, priorizado como Should-have | Manter simulação em HTML atual | Requisito explícito do usuário, mas não bloqueia a validação da hipótese central (assinatura funcionando) |

---

## Research Summary

**Market Context**
Nenhum concorrente direto (DoulaOS, Doulado, eDoula.biz, ObsCare) publica detalhes técnicos
de como implementa assinatura — a maioria integra vendors terceiros (Clicksign, ZapSign,
D4Sign, Autentique) ou não divulga o mecanismo. Isso é uma abertura competitiva: publicar uma
trilha de auditoria explícita (hash, IP, timestamp, consentimento) é um diferencial que
nenhum concorrente parece liderar. MP 2.200-2/2001 confirma que assinatura eletrônica simples
é juridicamente defensável no Brasil sem ICP-Brasil, desde que a trilha de auditoria exista —
o que já está em produção no fluxo de assinatura da profissional. Tendência de mercado
recente: envio de link de assinatura via WhatsApp tem maior taxa de conclusão no Brasil,
reforçando a decisão de notificar a gestante também por esse canal.

**Technical Context**
A feature de assinatura da profissional está viva em produção (`dev`), não foi removida —
commit `513f612` era um refactor, não uma reversão. O pipeline de geração de PDF, hash e
imutabilidade já existe e é reaproveitável. O bloqueio técnico central é que as colunas de
assinatura em `contracts` são singulares e o trigger de imutabilidade trava a linha inteira
após a primeira assinatura — por isso a decisão de usar uma tabela filha. RLS da gestante
sobre o próprio contrato não existe hoje, mas há um padrão direto para copiar
(`appointments`). Não há padrão existente de "solicitar alteração"/comentário no projeto —
modelagem nova por analogia. `pdfjs-dist` não é dependência hoje; a geração de PDF
(`@react-pdf/renderer`) é totalmente reaproveitável para gerar os bytes que o preview via
`pdf.js` vai renderizar.

---

*Generated: 2026-08-14*
*Status: DRAFT - needs validation*
