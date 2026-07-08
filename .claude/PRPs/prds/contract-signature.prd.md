# Assinatura Eletrônica de Contratos de Gestante

## Problem Statement

Hoje, o botão "Gerar e assinar" em `patient-contract.tsx` apenas salva um rascunho do
contrato — não há consentimento explícito, hash criptográfico, selo de autenticidade nem
forma de verificar se um PDF em mãos de uma paciente é genuíno. O contrato também pode ser
editado livremente após ser "assinado". Isso deixa a profissional/clínica CONTRATADA
exposta a risco jurídico: sem prova de integridade e autoria, um contrato pode ser
contestado sem defesa técnica.

## Evidence

- Risco jurídico identificado internamente (sinalizado por cliente/usuário da plataforma).
- Pesquisa de mercado: STJ e TJSP já validaram assinaturas eletrônicas não-ICP-Brasil em
  disputas, mas destacam que, se a autenticidade for contestada, a qualidade da trilha de
  auditoria (hash, autoria, timestamp) é o que sustenta a defesa — hoje o fluxo atual não
  produz nenhuma dessas evidências.
- Assumption: nenhum caso relatado ainda de disputa concreta sobre um contrato desta
  plataforma — a motivação é fechar a lacuna antes que isso aconteça.

## Proposed Solution

Adicionar ao fluxo de contrato de paciente já existente uma etapa de assinatura eletrônica
avançada (art. 4º da Lei 14.063/2020): modal de consentimento obrigatório → geração do PDF
final com selo de autenticidade visual → cálculo de hash SHA-256 do PDF → geração de código
de verificação único → imutabilidade do conteúdo assinado garantida em nível de aplicação e
banco (trigger) → página pública `/check/[codigo]` onde qualquer pessoa envia o PDF que
possui para confirmar autenticidade. Tudo reaproveitando padrões e bibliotecas já existentes
no projeto (`ContentModal`, `next-safe-action`, `@react-pdf/renderer`, bucket
`patient_documents`) — sem novas dependências.

## Key Hypothesis

Acreditamos que assinatura eletrônica avançada auto-construída (hash + trilha de auditoria +
verificação pública) vai fechar a lacuna jurídica de validade/imutabilidade dos contratos
para profissionais e clínicas CONTRATADAS.
Não há uma métrica de produto para validar isso — o objetivo é qualitativo: ter o recurso
disponível e juridicamente defensável, não testar uma hipótese de adoção.

## What We're NOT Building

- Assinatura da paciente/gestante (CONTRATANTE) — apenas a CONTRATADA assina eletronicamente
  pela plataforma; a paciente não passa por um fluxo de assinatura próprio.
- Assinatura qualificada com certificado ICP-Brasil — fora de escopo; o fluxo se limita à
  camada "avançada" da Lei 14.063/2020.
- Qualquer integração com plataforma terceira de assinatura (Clicksign, DocuSign, Autentique,
  D4Sign) — tudo é construído internamente.

## Success Metrics

Não há métrica quantitativa definida — sucesso é ter o recurso disponível e corretamente
implementado (consentimento + hash + imutabilidade + verificação pública funcionando
ponta a ponta), fechando a lacuna jurídica identificada.

## Open Questions

- [ ] Nenhum case de mercado (BR, saúde) constrói isso 100% internamente — approach é
      incomum mas não inválido; vale reavaliar se surgir disputa real no futuro.
- [ ] Manual técnico gov.br de integração de assinatura avançada
      (`manual-integracao-assinatura-eletronica.servicos.gov.br`) não foi consultado em
      profundidade — pode conter checklist técnico adicional, mas não bloqueia o v1.

---

## Users & Context

**Primary User**
- **Who**: Profissional autônoma (obstetra/doula) ou secretária/admin de clínica que
  administra contratos em nome da profissional/empresa — o fluxo é idêntico para ambas, o
  que importa é a conta autenticada.
- **Current behavior**: Clica em "Gerar e assinar", que hoje só salva um rascunho sem
  nenhuma validade jurídica reforçada.
- **Trigger**: Ao finalizar a negociação do contrato com a paciente.
- **Success state**: O contrato assinado é imutável, tem hash e selo, e pode ser verificado
  publicamente por qualquer parte (inclusive em disputa) sem depender da palavra da clínica.

**Job to Be Done**
Quando finaliza o contrato com a paciente, a profissional/secretária quer formalizar o
acordo com valor jurídico real, para que o documento assinado seja à prova de contestação e
não precise de ferramenta externa.

**Non-Users**
Pacientes/gestantes (não assinam eletronicamente pela plataforma) e clínicas que exigem
certificação ICP-Brasil (assinatura qualificada, fora de escopo).

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Modal de consentimento obrigatório (checkbox) antes de assinar | Base legal exige consentimento explícito e registrado |
| Must | Hash SHA-256 do PDF final salvo em `contracts` | Vínculo inequívoco ao documento — base da assinatura avançada |
| Must | Código de verificação único (10 chars) + rota `/check/[codigo]` | Permite detecção pública de alteração posterior |
| Must | Imutabilidade em app + trigger de banco | Garante que conteúdo assinado não pode ser alterado, mesmo por bypass da UI |
| Must | IP e user-agent do signatário registrados em `contracts` | Reforça a trilha de auditoria para defesa jurídica (decisão do usuário nesta PRD) |
| Must | Extração de helpers compartilhados (`parties_details`, render PDF) | Evita duplicação já identificada entre `save-patient-contract-action.ts` e a rota de PDF |
| Should | Selo de autenticidade visual no PDF (imagem + texto sobreposto) | Reforça percepção de autenticidade, mas hash/imutabilidade já garantem a validade técnica mesmo sem o selo |
| Should | Preview em tela reproduzindo o selo (CSS) | Consistência visual, não bloqueia a validade jurídica |
| Won't | Assinatura da paciente | Fora de escopo deste pedido |
| Won't | Certificação ICP-Brasil (assinatura qualificada) | Fora de escopo deste pedido |

### MVP Scope

Fatiado em fases (ver Implementation Phases) — a Fase 1 entrega o núcleo jurídico
(consentimento, hash, imutabilidade, auditoria) sem o selo visual; Fases 2 e 3 adicionam o
selo e a verificação pública.

### User Flow

1. Usuário clica em "Gerar e assinar" → modal de consentimento (`ContentModal`, mesmo padrão
   do modal de exclusão em `patient-contract.tsx`) com checkbox obrigatório.
2. Confirma → `signPatientContractAction` roda: valida que ainda não está assinado, monta
   `parties_details` (helper compartilhado), salva o rascunho, gera `verification_code`
   (retry em colisão), renderiza o PDF final (com ou sem selo, conforme fase), calcula
   SHA-256, faz upload para `patient_documents` com `is_immutable: true`, atualiza
   `contracts` com `is_signed`, `signed_at`, `signed_by`, `signed_ip`, `signed_user_agent`,
   `content_hash`, `verification_code`, `signed_document_id`.
3. UI passa a ocultar "Editar contrato", mostra selo/informações de assinatura (quando
   disponível) e "Baixar contrato" reutiliza o PDF já assinado via `signed_document_id`.
4. (Fase 3) Qualquer pessoa acessa `/check/[codigo]`, envia o PDF, servidor recalcula o hash
   e compara — sucesso ou falha exibidos com ícone.

---

## Technical Approach

**Feasibility**: HIGH

**Architecture Notes**
- `@react-pdf/renderer@4.5.1` (já em uso em `contract-pdf-document.tsx`) suporta nativamente
  `Image` + `Text`/`View` com `position: 'absolute'` — confirmado por análise técnica, sem
  necessidade de nova biblioteca para compor o selo (imagem de fundo + texto sobreposto).
- Hash SHA-256 é um passo independente do react-pdf: `crypto.createHash('sha256')` do Node
  sobre o `Buffer` retornado por `renderToBuffer`.
- IP/user-agent do signatário: capturados via `headers()` do `next/headers` dentro da server
  action (`x-forwarded-for`, `user-agent`), seguindo o padrão de `authActionClient`.
- Reaproveitar: `ContentModal` (`packages/ui/src/shared/content-modal`), padrão de upload
  para bucket `patient_documents` já usado em `contract/pdf/route.ts:95-133`,
  `createServerSupabaseAdmin` para a rota pública de verificação (bypassa RLS sem exigir
  login).
- Duplicação a eliminar: lógica de montagem de `parties_details`
  (`save-patient-contract-action.ts:51-79` ≈ `contract/pdf/route.ts:59-84`) — extrair para
  helper compartilhado usado por `save-patient-contract-action.ts`,
  `sign-patient-contract-action.ts` (nova) e a rota de PDF.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Trigger de imutabilidade bloquear soft-delete acidentalmente | M | Trigger deve permitir explicitamente mudança de `is_active`/`updated_at` quando `OLD.is_signed = true`, bloqueando as demais colunas |
| Colisão de `verification_code` | L | Índice único parcial + retry na geração |
| Hash calculado sobre PDF não-determinístico (ex.: timestamp de render) | M | Hash é calculado uma única vez no momento da assinatura e armazenado — nunca recalculado a partir de uma nova renderização |
| Policy de exclusão de `patient_documents` não bloquear documento imutável | M | Atualizar policy `"Delete own documents"` para checar `is_immutable IS NOT TRUE` e a rota DELETE responder com erro claro |

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
| 1 | Núcleo de assinatura | Migration (`contracts`/`patient_documents`), helpers compartilhados, modal de consentimento, `signPatientContractAction` (hash, código, imutabilidade, auditoria IP/UA), UI pós-assinatura básica | complete | - | - | [contract-signature-phase-1-core.plan.md](../plans/completed/contract-signature-phase-1-core.plan.md) |
| 2 | Selo de autenticidade | Composição visual do selo no PDF (`@react-pdf/renderer`) e replicação em CSS no preview em tela | complete | with 3 | 1 | [contract-signature-phase-2-stamp.plan.md](../plans/completed/contract-signature-phase-2-stamp.plan.md) |
| 3 | Verificação pública | Rota `/check/[codigo]` (upload de PDF, recálculo e comparação de hash, estados de sucesso/falha) | complete | with 2 | 1 | [contract-signature-phase-3-verification.plan.md](../plans/completed/contract-signature-phase-3-verification.plan.md) |

### Phase Details

**Phase 1: Núcleo de assinatura**
- **Goal**: Garantir que assinar um contrato produza um documento juridicamente defensável
  (consentimento, hash, imutabilidade, auditoria) — sem depender ainda do selo visual.
- **Scope**:
  - Migration: `contracts.is_signed/signed_at/signed_by/content_hash/verification_code/signed_document_id/signed_ip/signed_user_agent`,
    índice único parcial em `verification_code`, trigger `prevent_signed_contract_mutation`;
    `patient_documents.is_immutable` + policy de delete atualizada.
  - Helper compartilhado para montagem de `parties_details` (extraído de
    `save-patient-contract-action.ts`/`contract/pdf/route.ts`).
  - Modal de consentimento (`ContentModal`) com checkbox obrigatório.
  - `signPatientContractAction`: valida não-assinado, salva rascunho, gera código, renderiza
    PDF (sem selo nesta fase), calcula hash, faz upload imutável, atualiza `contracts` com
    todos os campos incluindo IP/user-agent.
  - UI: ocultar "Editar contrato" após assinado; "Baixar contrato" reutiliza
    `signed_document_id`.
  - Atualizar rota DELETE de `patient_documents` para responder com erro claro em documento
    imutável.
- **Success signal**: Contrato assinado não pode ser editado (bloqueado por trigger mesmo
  via SQL direto), hash/código/IP/UA persistidos, PDF assinado reaproveitado no download.

**Phase 2: Selo de autenticidade**
- **Goal**: Reforçar visualmente a autenticidade do documento.
- **Scope**: Compor `digital-signature-stamp.png` + texto (nome CONTRATADA, data/hora,
  link de verificação) via `Image`/`Text` absolutamente posicionados no
  `contract-pdf-document.tsx`; replicar a mesma composição em CSS no preview em tela.
- **Success signal**: PDF assinado exibe o selo com as informações corretas; preview em
  tela replica a mesma composição visual.

**Phase 3: Verificação pública**
- **Goal**: Permitir que qualquer pessoa valide a autenticidade de um PDF sem login.
- **Scope**: Rota `/check/[codigo]` fora dos grupos `(dashboard)`/`(auth)`; upload do PDF;
  recálculo de SHA-256 via `createServerSupabaseAdmin`/server-side; comparação com
  `content_hash`; estados de sucesso (nome CONTRATADA + data/hora) e falha.
- **Success signal**: Upload de um PDF genuíno retorna sucesso; upload de PDF alterado (1
  byte) ou código inexistente retorna falha.

### Parallelism Notes

Fases 2 e 3 dependem apenas da Fase 1 (que cria `verification_code`, `content_hash` e o
pipeline de renderização/upload) e não têm sobreposição de arquivos entre si — Fase 2 mexe
em `contract-pdf-document.tsx`/preview, Fase 3 cria uma rota pública nova (`app/check/`).
Podem rodar em paralelo em worktrees separados.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Nível de assinatura | Avançada (Lei 14.063/2020, sem ICP-Brasil) | Qualificada (ICP-Brasil) | Certificação qualificada exigiria integração com certificadora externa, fora de escopo e custo; jurisprudência (STJ/TJSP) já valida assinatura avançada com trilha de auditoria robusta |
| Auditoria extra (IP/user-agent) | Must-have no v1 | Could-have para depois | Usuário decidiu reforçar a defesa jurídica desde a primeira entrega |
| Fatiamento do escopo | 3 fases (núcleo → selo → verificação pública) | Entrega única monolítica | Selo e verificação pública são incrementos visuais/de superfície que não bloqueiam a validade jurídica do núcleo (hash + imutabilidade + consentimento já bastam) |
| Biblioteca de PDF | Reaproveitar `@react-pdf/renderer` existente | Nova lib de composição de imagem | Análise técnica confirmou suporte nativo a `Image` + `Text` absolutamente posicionados na versão já usada (4.5.1) |

---

## Research Summary

**Market Context**
Lei 14.063/2020 (art. 4º) permite assinatura eletrônica avançada sem certificado ICP-Brasil,
desde que haja meio de comprovação de autoria/integridade aceito pelas partes. STJ e TJSP já
validaram assinaturas não-ICP em disputas — o risco só se materializa se a autenticidade for
contestada, e nesse caso a trilha de auditoria (hash, autoria, timestamp) é o que sustenta a
defesa. Nenhum case de mercado (SaaS de saúde no Brasil) foi encontrado construindo isso
100% internamente — a maioria integra Clicksign/DocuSign/D4Sign/Autentique — mas nada indica
que a abordagem interna seja inválida, apenas incomum.

**Technical Context**
Código atual (`patient-contract.tsx`, `save-patient-contract-action.ts`,
`contract/pdf/route.ts`, `contract-pdf-document.tsx`) já tem toda a infraestrutura de base
(padrão de modal, geração de PDF, upload para `patient_documents`) — falta apenas a camada
de assinatura em si. Duplicação de lógica de `parties_details` já identificada e a ser
extraída. `@react-pdf/renderer@4.5.1` confirmado como suficiente para o selo, sem novas
dependências.

---

*Generated: 2026-07-06*
*Status: DRAFT - needs validation*
