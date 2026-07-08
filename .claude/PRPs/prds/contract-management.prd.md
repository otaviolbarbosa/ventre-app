# Gestão de Contratos (Contract Management)

## Problem Statement

Profissionais do parto (enfermeiras obstétricas, doulas, fisioterapeutas) e equipes de gestão criam contratos de prestação de serviços manualmente, copiando e colando dados da gestante a cada novo contrato em ferramentas externas (Word, Google Docs). Isso gera retrabalho constante, fragmentação de informações em múltiplas ferramentas e ausência de rastreabilidade histórica — tudo isso enquanto os dados da paciente já estão disponíveis no Ventre.

## Evidence

- Profissionais relatam copiar/colar dados da paciente a cada contrato novo — retrabalho identificado como dor principal
- Contratos armazenados em ferramentas externas dificultam auditoria e histórico por paciente
- Assumption: adoção superior a 50% entre usuárias ativas seria validação de product-market fit para esta funcionalidade

## Proposed Solution

Incorporar um módulo de gestão de contratos diretamente no Ventre: a profissional configura um **contrato base** em `/settings/contract` com cláusulas em rich text (TipTap), e para cada gestação pode gerar um contrato personalizado (usando o base na íntegra ou com edições). O cabeçalho é gerado automaticamente a partir dos dados já cadastrados (gestante, empresa, equipe). O contrato pode ser exportado como PDF, salvo no Supabase Storage e disponibilizado na seção de documentos da paciente.

## Key Hypothesis

Acreditamos que centralizar a criação e gestão de contratos dentro do Ventre (com cabeçalho auto-gerado e exportação PDF) vai eliminar o retrabalho de copiar dados manualmente para as profissionais. Saberemos que acertamos quando a adoção da funcionalidade superar 50% das usuárias ativas nos primeiros 60 dias após o lançamento.

## What We're NOT Building

- **Assinatura digital pela gestante** — gestante não tem acesso ao sistema neste momento; assinatura é feita offline/impressa
- **Merge fields / variáveis dinâmicas no editor** — não há campos `{{nome_da_gestante}}` no corpo do contrato; o cabeçalho já é gerado automaticamente
- **Biblioteca de cláusulas pré-prontas** — a profissional escreve suas próprias cláusulas do zero
- **Versionamento de contratos** — sem histórico de versões de um mesmo contrato; pode evoluir em v2
- **Envio de contrato por e-mail/link para a gestante** — fora do escopo v1

## Success Metrics

| Métrica | Meta | Como medir |
|---------|------|------------|
| Adoção da funcionalidade | >50% das usuárias ativas | % de usuárias que criaram ao menos 1 contrato nos primeiros 60 dias |
| Contratos base configurados | >70% das organizações ativas | Contratos com `is_base_contract = true` no banco |
| PDFs exportados por contrato | >1 por gestação com contrato | Registros em `patient_documents` com `file_type = 'application/pdf'` e origem contrato |

## Open Questions

- [ ] O contrato de gestação deve ser acessível via nova aba na navegação da paciente ou como accordion dentro de "Perfil"? (análise do codebase sugere accordion, mas pode ser decisão de UX)
- [ ] Quando uma profissional autônoma (sem empresa) cria o contrato, o cabeçalho CONTRATADA usa quais campos do perfil? (CPF, endereço, registro profissional — esses dados estão cadastrados no sistema?)
- [ ] O preview do contrato base deve abrir em modal/dialog ou em página separada?
- [ ] Profissionais autônomas têm acesso a `/settings/contract` ou apenas gestores/secretárias?

---

## Users & Context

**Primary User**
- **Quem**: Gestora/secretária de organização obstétrica, ou profissional autônoma (enfermeira obstetra, doula) que gerencia seus próprios contratos
- **Comportamento atual**: Copia template de Word/Google Docs, preenche dados da paciente manualmente, salva/envia via e-mail ou imprime
- **Gatilho**: Início de uma nova gestação/paciente que requer formalização da prestação de serviço
- **Estado de sucesso**: Contrato gerado em <2 minutos a partir de dados já cadastrados, PDF disponível na ficha da paciente

**Job to Be Done**
Quando inicio o acompanhamento de uma nova gestante, quero gerar o contrato de prestação de serviços rapidamente com os dados dela já preenchidos, para que eu possa formalizar o serviço sem sair do sistema ou repetir informações já cadastradas.

**Non-Users**
- Gestantes/pacientes — não têm acesso ao sistema neste momento
- Profissionais sem pacientes cadastrados — não têm gatilho de uso

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Prioridade | Capacidade | Racional |
|------------|------------|----------|
| Must | Configuração do contrato base em `/settings/contract` com editor TipTap | Pré-requisito para tudo; sem base não há contrato |
| Must | Cabeçalho auto-gerado (não editável) seguindo formato CONTRATANTE/CONTRATADA | Elimina o retrabalho principal; dado já existe no sistema |
| Must | Preview do contrato base (cabeçalho + cláusulas) antes de salvar | Solicitado explicitamente; valida visualmente o resultado final |
| Must | Contrato por gestação baseado no contrato base (uso integral ou com edições) | Fluxo core de uso; sem isso a feature não entrega valor |
| Must | Exportação PDF nomeado `CONTRATO_<NOME>_<YYYY-MM-DD>` | Entregável final do fluxo; necessário para assinatura offline |
| Must | PDF salvo no Supabase Storage + disponível na seção Documentos da paciente | Centralização — razão de existir da feature |
| Should | Indicação visual de qual gestação já tem contrato gerado | Evita duplicações acidentais |
| Could | Listagem de todos os contratos de uma organização | Útil para auditoria; pode ser v2 |
| Won't | Assinatura digital pela gestante | Gestante sem acesso ao sistema em v1 |
| Won't | Histórico de versões de contrato | Complexidade alta para v1 |

### MVP Scope

Contrato base configurável + geração de contrato por gestação (com edição opcional a partir do base) + preview + exportação PDF disponível nos documentos da paciente.

### User Flow

**Fluxo de configuração (uma vez por organização):**
`/settings` → card "Contrato Padrão" → `/settings/contract` → editor TipTap (cláusulas) → botão "Preview" (modal com cabeçalho + cláusulas renderizados) → "Salvar contrato base"

**Fluxo de uso por gestação:**
Perfil da paciente → accordion "Contrato" → "Gerar contrato" → escolha: "Usar contrato base" ou "Editar a partir do base" → (se editar) editor TipTap → "Exportar PDF" → PDF disponível em "Documentos"

---

## Technical Approach

**Viabilidade**: ALTA

**Architecture Notes**
- Nova tabela `contracts`: `id`, `user_id` (nullable), `enterprise_id` (nullable), `patient_id` (nullable — null para contrato base), `pregnancy_id` (nullable), `is_base_contract boolean`, `clauses_html text` (output do TipTap), `created_at`, `updated_at`
- RLS: espelhar `patient_documents` — `is_team_member(patient_id)` para acesso por profissional, `is_enterprise_patient(patient_id)` para acesso por staff; contrato base visível por `organization_id` matching ou `user_id` matching
- PDF: `@react-pdf/renderer` server-side em Route Handler `/api/contracts/[id]/export` — gera PDF, faz upload para bucket `patient_documents` (path: `contracts/${patientId}/${filename}.pdf`), insere em `patient_documents`
- TipTap em `packages/ui/src/shared/rich-editor/index.ts` — toolbar: FontSize, FontFamily, Bold, Italic, Underline, OrderedList, BulletList, TextAlign
- Preview: Dialog/Sheet com renderização HTML das cláusulas + cabeçalho hardcoded em formato textual
- Cabeçalho: gerado server-side com joins em `patients`, `pregnancies`, `enterprises`, `team_members`, `users` — função pura que retorna string formatada seguindo o modelo definido
- Settings route: guard `isManager()` existente, padrão idêntico a `/settings/billing-deductions`

**Technical Risks**

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Cabeçalho com dados incompletos (CPF, endereço da paciente não cadastrados) | ALTA | Renderizar campos ausentes como `[não informado]`; exibir aviso no preview |
| `@react-pdf/renderer` styling fidelidade no servidor | MÉDIA | Testar com o formato exato do cabeçalho antes de fechar o design |
| TipTap + React 19 compatibilidade | BAIXA | TipTap 2.x tem suporte a React 19; verificar na instalação |
| Profissional autônoma sem dados de endereço/CPF no perfil | MÉDIA | Identificar quais campos do perfil existem; mapear gaps antes de implementar cabeçalho |

---

## Implementation Phases

<!--
  STATUS: pending | in-progress | complete
  PARALLEL: phases that can run concurrently (e.g., "with 3" or "-")
  DEPENDS: phases that must complete first (e.g., "1, 2" or "-")
  PRP: link to generated plan file once created
-->

| # | Fase | Descrição | Status | Paralelo | Depende | PRP Plan |
|---|------|-----------|--------|----------|---------|----------|
| 1 | Database | Migration `contracts` + RLS + `pnpm db:types` | complete | - | - | `.claude/PRPs/plans/completed/contract-management-phase-1-database.plan.md` |
| 2 | RichEditor | Componente TipTap em `packages/ui/src/shared/rich-editor` | complete | with 1 | - | `.claude/PRPs/plans/completed/contract-management-phase-2-richeditor.plan.md` |
| 3 | Settings Contract | Rota `/settings/contract`, tela de configuração do contrato base com preview | complete | - | 1, 2 | `.claude/PRPs/plans/completed/contract-management-phase-3-settings-contract.plan.md` |
| 4 | Patient Contract | Accordion "Contrato" no perfil da paciente, geração a partir do base | complete | - | 3 | `.claude/PRPs/plans/completed/contract-management-phase-4-patient-contract.plan.md` |
| 5 | PDF Export | Route Handler de exportação PDF + upload Storage + link em Documentos | complete | - | 4 | `.claude/PRPs/plans/completed/contract-management-phase-5-pdf-export.plan.md` |

### Phase Details

**Phase 1: Database**
- **Goal**: Criar a estrutura de dados para contratos
- **Scope**: Migration SQL para tabela `contracts`, políticas RLS, trigger `updated_at`; rodar `pnpm db:types`
- **Success signal**: `contracts` visível nos tipos gerados, RLS testável via Supabase

**Phase 2: RichEditor**
- **Goal**: Componente TipTap compartilhado e reutilizável
- **Scope**: `pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-*` em packages/ui; criar `RichEditor` com toolbar configurável (FontSize, FontFamily, Bold, Italic, Underline, OrderedList, BulletList, TextAlign); exportar como `@ventre/ui/shared/rich-editor`
- **Success signal**: Componente renderiza no Storybook ou em página de teste com todos os controles funcionais

**Phase 3: Settings Contract**
- **Goal**: Profissionais/gestores configuram o contrato base
- **Scope**: `app/(dashboard)/settings/contract/page.tsx` com guard `isManager()`; `ContractSettingsScreen` com RichEditor para cláusulas; actions `saveBaseContractAction` e `getBaseContractAction`; botão "Preview" abre Dialog/Sheet com cabeçalho auto-gerado + cláusulas renderizadas; card na tela `/settings` apontando para a nova rota
- **Success signal**: Gestor consegue salvar cláusulas e visualizar preview do contrato completo com cabeçalho

**Phase 4: Patient Contract**
- **Goal**: Gerar contrato por gestação a partir do contrato base
- **Scope**: Novo accordion item "Contrato" em `patients/[id]/profile/page.tsx`; componente `PatientContract` com ações: "Gerar contrato" (selecionar uso integral ou editar), RichEditor pré-populado com cláusulas do contrato base; actions `createPatientContractAction`, `getPatientContractAction`, `updatePatientContractAction`
- **Success signal**: Profissional consegue gerar e editar contrato de uma gestação; contrato salvo com `patient_id` e `pregnancy_id`

**Phase 5: PDF Export**
- **Goal**: Exportar contrato como PDF e disponibilizar nos documentos da paciente
- **Scope**: Instalar `@react-pdf/renderer` em apps/web; Route Handler `POST /api/contracts/[id]/export`; template React PDF com cabeçalho + cláusulas (renderização do HTML TipTap); upload para bucket `patient_documents` com path `contracts/${patientId}/CONTRATO_${nome}_${data}.pdf`; inserir em `patient_documents`; botão "Exportar PDF" na UI do contrato
- **Success signal**: PDF nomeado corretamente aparece na seção Documentos da paciente, com cabeçalho formatado conforme modelo

### Parallelism Notes

Fases 1 e 2 podem rodar em paralelo (banco vs. componente UI — domínios independentes). Fase 3 depende de ambas. Fases 4 e 5 são sequenciais pois 5 depende do contrato estar persistido (fase 4).

---

## Modelo de Cabeçalho (Referência Obrigatória)

O cabeçalho gerado automaticamente deve seguir exatamente este formato:

```
CONTRATANTE: {nome_completo}, {nacionalidade}, {estado_civil}, {profissao},
CPF: {cpf}, RG: {rg}, {endereco_completo}, {email}, telefone:
{telefone} e data provável de parto: {data_provavel_parto}, doravante denominada
simplesmente GESTANTE.

CONTRATADA: {nome_empresa_ou_profissional} [pessoa jurídica de direito privado,
inscrita no CNPJ sob no {cnpj}, com sede à {endereco_empresa}] OU
[{nacionalidade_prof}, {estado_civil_prof}, {profissao_prof}, CPF: {cpf_prof}...],
doravante denominada simplesmente EQUIPE CONTRATADA.

EQUIPE CONTRATADA:
{agrupado por professional_type}
{nome}, {nacionalidade}, {estado_civil}, {profissao}, {cpf}, {endereco},
{email}, {telefone}, {registro_profissional}
```

**Cenários do cabeçalho CONTRATADA:**
1. Profissional sem empresa → dados da profissional (`users`)
2. Profissional com empresa → pode escolher: dados próprios OU dados da empresa (`enterprises`)
3. Se empresa: incluir seção EQUIPE CONTRATADA com `team_members` agrupados por `professional_type`

---

## Decisions Log

| Decisão | Escolha | Alternativas | Racional |
|---------|---------|--------------|----------|
| Rich text editor | TipTap | Quill (especificado originalmente) | Quill está em modo legado em 2026; TipTap tem React 19 nativo, headless, melhor manutenção |
| PDF generation | `@react-pdf/renderer` (server-side) | jsPDF (client-only), Puppeteer (pesado) | Server-side é o padrão Next.js 15; sem dependência de browser headless |
| Storage do PDF | Bucket `patient_documents` existente (path `contracts/`) | Bucket dedicado `contracts` | Reuso do padrão já implementado; sem nova configuração de bucket |
| Assinatura digital | Fora do escopo v1 | DocuSign, Autentique | Gestante sem acesso ao sistema em v1; aumentaria complexidade significativamente |
| Contrato base | Tabela `contracts` com `is_base_contract = true` | Tabela separada `contract_templates` | Reuso de estrutura; simplifica queries e RLS |
| Local do contrato no perfil | Accordion em "Perfil" da paciente | Nova aba de navegação | Segue padrão existente de documentos; evita sobrecarga na navegação |

---

## Research Summary

**Market Context**
Nenhuma plataforma brasileira de gestão obstétrica oferece contrato de prestação de serviços com dados auto-preenchidos nativo. Concorrentes globais (SimplePractice, Noterro) tratam contratos como formulários de consentimento, não documentos legais com cláusulas livres. O padrão de mercado para service businesses (HoneyBook, Dubsado) combina rich text + PDF + send-link + e-sign. O Ventre entrega o diferencial de integração com dados obstétricos sem a complexidade de assinatura digital em v1. Legalmente, assinatura offline é suficiente para contratos de prestação de serviços entre particulares (Lei 14.063/2020).

**Technical Context**
Todos os padrões necessários existem no codebase: `patient_documents` (tabela + Storage bucket) como blueprint para contratos, `team_members` + `user_enterprises` + `enterprises` com dados para o cabeçalho, settings route com `isManager()` guard, safe-action pattern para mutations, `packages/ui/src/shared/` para o componente RichEditor. As únicas adições são TipTap (packages/ui) e `@react-pdf/renderer` (apps/web) — sem conflitos com a stack atual.

---

*Gerado: 2026-06-27*
*Status: DRAFT - needs validation*
