# Registro de Documentos Profissionais (CRM/RQE/COREN/CREFITO)

## Problem Statement

Médicas (obstetras), enfermeiras e fisioterapeutas cadastradas na plataforma não têm como registrar seus números de conselho profissional (CRM, RQE, COREN, CREFITO). Isso é uma exigência legal/regulatória para exercício da profissão em saúde no Brasil, é necessário para emitir documentos oficiais (receitas, laudos, atestados) e aumenta a confiança do paciente ao ver a credencial da profissional. Sem esse dado estruturado no banco, nenhuma feature futura de emissão de documentos pode ser construída.

## Evidence

- Feature de emissão de receitas/documentos está planejada e é bloqueada pela ausência desses dados — dependência direta identificada pelo time de produto.
- Exigência regulatória: exercício de medicina, enfermagem e fisioterapia no Brasil exige registro em conselho de classe (CFM/CRM, COREN, CREFITO), fato de domínio público, não uma suposição.
- Assumption: nenhuma profissional pediu isso explicitamente ainda — é trabalho de preparação, não reativo a um pedido de usuária.

## Proposed Solution

Adicionar uma coluna `professional_documents` (jsonb) na tabela `users` para armazenar os registros profissionais, com formato dependente do `professional_type`. Coletar esses dados de forma **opcional** em um novo passo do onboarding (após a seleção do tipo profissional) e, para quem pular ou já estiver cadastrada sem esses dados, exibir um banner persistente no topo do dashboard que leva a `/profile?action=edit-profile` — um novo padrão de URL que abre o `EditProfileModal` automaticamente, onde os campos también passam a existir no formulário, condicionados ao `professional_type` do usuário logado.

## Key Hypothesis

We believe **adicionar um campo estruturado + coleta guiada (onboarding + banner)** will **fazer com que profissionais preencham seus registros profissionais** for **médicas (obstetras), enfermeiras e fisioterapeutas cadastradas na plataforma**.
We'll know we're right when **a estrutura de dados e UI estiverem funcionando ponta a ponta** (sem meta numérica de adoção definida neste momento — ver Success Metrics).

## What We're NOT Building

- Validação real com CFM/COREN/CREFITO (integração externa de verificação) — fora de escopo; validamos apenas formato/UF no client.
- Emissão de receitas/laudos/atestados usando esses dados — é a feature futura que este PRD desbloqueia, não faz parte dele.
- Exibição pública desses documentos para pacientes — os dados ficam armazenados mas não aparecem em telas voltadas ao paciente nesta fase.
- Migração/backfill de dados de profissionais já cadastradas — elas simplesmente terão `professional_documents = null` até preencherem via banner ou perfil.
- Suporte a `doula` — esse tipo profissional não possui registro de conselho e fica de fora do formulário/banner.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Estrutura de dados e UI funcionando end-to-end | 100% dos fluxos (onboarding opcional, banner, modal) funcionais em produção | Validação manual / QA dos 3 fluxos |
| Existência do campo | Coluna `professional_documents` populável para obstetra/enfermeiro/fisio | Migração aplicada + `pnpm db:types` sincronizado |

*Nota: não há meta de % de adoção definida neste momento — será revisitado quando a feature de emissão de documentos entrar em planejamento.*

## Open Questions

- [ ] O formulário de onboarding (novo passo pós-seleção de card) deve bloquear o avanço até clicar "Pular" explicitamente, ou o "Pular" é o botão padrão de continuar?
- [ ] Qual é o formato exato de validação de UF (lista de siglas de estado) a ser reutilizado — já existe um enum/lista de UFs no codebase (ex: nos campos de endereço) que deva ser reaproveitado?
- [ ] O banner deve ser um Server Component (lendo `professional_documents` via query) ou Client Component com fetch — dado que precisa de dado real do banco, ao contrário do `NotificationPermissionPrompt` que é puramente client-side?

---

## Users & Context

**Primary User**
- **Who**: Profissionais de saúde cadastradas como `professional_type` = `obstetra` (médica), `enfermeiro` (enfermeira) ou `fisio` (fisioterapeuta).
- **Current behavior**: Completam o onboarding selecionando apenas o tipo profissional (card), sem preencher nenhum dado de registro de conselho. Hoje não há lugar nenhum na plataforma para inserir CRM/RQE/COREN/CREFITO.
- **Trigger**: Ao se cadastrar (onboarding) ou, se pularam essa etapa, ao navegar pelo dashboard e ver o banner de alerta.
- **Success state**: `professional_documents` preenchido com os números relevantes ao seu tipo profissional; banner desaparece.

**Job to Be Done**
Quando estou me cadastrando ou usando a plataforma sem meus dados de registro profissional preenchidos, quero poder inserir meu CRM/RQE, COREN ou CREFITO+RQE (conforme minha especialidade) sem que isso bloqueie meu cadastro, para que eu possa completar esses dados no meu tempo e a plataforma possa futuramente emitir documentos oficiais em meu nome.

**Non-Users**
- Pacientes (`user_type = patient`) — não têm `professional_type`, não são afetados.
- Doulas (`professional_type = doula`) — não possuem registro de conselho de classe; ficam fora do formulário e do banner.
- Managers, secretaries, admins — não são profissionais de saúde no sentido regulatório; fora de escopo.

---

## Solution Detail

### Mapeamento de documentos por `professional_type`

| professional_type | Label PT-BR | Documentos |
|---|---|---|
| `obstetra` | Médica/Obstetra | CRM (com UF) + RQE (lista, 0 ou mais) |
| `fisio` | Fisioterapeuta | CREFITO (com UF) + RQE (lista, 0 ou mais) |
| `enfermeiro` | Enfermeira | COREN (com UF) |
| `doula` | Doula | Nenhum — fora de escopo |

### Formato do JSON (`professional_documents`)

```ts
type ProfessionalDocuments = {
  crm?: { number: string; uf: string };
  crefito?: { number: string; uf: string };
  coren?: { number: string; uf: string };
  rqe?: { number: string; uf: string }[]; // usado por obstetra e fisio
};
```

Coluna nullable — `null` significa "não preenchido". Validação de formato: número (dígitos) + UF (sigla de estado), sem verificação externa de autenticidade.

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Migration adicionando `professional_documents jsonb` nullable em `users` | Base de dados necessária para tudo o resto |
| Must | Novo passo opcional no onboarding, pós-seleção de card, com formulário condicional por tipo | Ponto de coleta principal, sem bloquear cadastro |
| Must | Banner persistente no dashboard layout para quem não preencheu (obstetra/enfermeiro/fisio) | Garante que o dado eventualmente seja preenchido |
| Must | `?action=edit-profile` abre `EditProfileModal` automaticamente na página de perfil | Destino do banner |
| Must | Campos de documento no `EditProfileModal`, condicionais por `professional_type` | Permite preencher/editar depois do onboarding |
| Should | Suporte a múltiplos RQEs (adicionar/remover linha) no formulário | Médicas/fisios podem ter mais de uma especialidade |
| Won't | Validação externa com CFM/COREN/CREFITO | Fora de escopo, feature futura |
| Won't | Exibição para pacientes | Fora de escopo, feature futura |

### MVP Scope

Migration + formulário condicional (onboarding opcional e modal de edição) + banner condicionado a dado real do banco. Sem validação externa, sem exibição pública, sem backfill.

### User Flow

1. Profissional (obstetra/enfermeiro/fisio) seleciona tipo no onboarding → vê formulário opcional de documentos → preenche ou pula → onboarding concluído.
2. Se pulou (ou é usuária já existente sem dados): ao navegar no dashboard, vê banner fixo "Complete seus dados profissionais".
3. Clica no banner → navega para `/profile?action=edit-profile` → `EditProfileModal` abre automaticamente já na aba/seção correta → preenche CRM/RQE ou COREN ou CREFITO/RQE → salva.
4. `professional_documents` populado → banner some nas próximas renderizações do layout.

---

## Technical Approach

**Feasibility**: HIGH — segue padrões já estabelecidos no codebase (migrations Supabase, `next-safe-action`, Zod + react-hook-form, `authActionClient`). Os únicos elementos net-new são: coluna `jsonb` em `users` (há precedente em outra tabela) e o padrão `?action=` para abrir modal via URL (não existe precedente, mas é simples de implementar com `useSearchParams` + `useEffect`/`useState` inicial).

**Architecture Notes**
- Migration em `packages/supabase/supabase/migrations/`, seguida de `pnpm db:types` para sincronizar `database.types.ts`.
- Extrair o schema Zod do `EditProfileModal` (hoje inline) para um schema compartilhado que inclua os novos campos condicionais — pode usar `z.discriminatedUnion` ou validação condicional baseada em `professional_type` passado como prop.
- `update-profile-action.ts` precisa aceitar e persistir `professional_documents` (update simples na tabela `users`, mesmo padrão do update de `name`/`phone`).
- Banner: como depende de dado real do banco (não é client-side/localStorage como `NotificationPermissionPrompt`), a leitura de `professional_documents` deve vir do layout como Server Component (query ao Supabase) e passar um boolean/flag para um componente client que renderiza o banner e o link.
- Onboarding: novo passo no `onboarding-screen.tsx` após a seleção de card, antes de concluir — precisa de novo estado local e possivelmente uma nova server action ou extensão da `set-professional-type-action.ts` para aceitar os documentos opcionalmente na mesma chamada.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Formulário condicional por tipo profissional em dois lugares (onboarding + modal) gera duplicação de lógica | M | Extrair um componente compartilhado `ProfessionalDocumentsFields` reutilizado nos dois formulários |
| Banner lido via Server Component pode cachear estado desatualizado após o usuário salvar no modal | M | Usar `revalidatePath` na action de update, já é o padrão do projeto |
| RLS: leitura de `professional_documents` no layout precisa respeitar `auth.uid()` | L | Usar `createServerSupabaseClient()` (anon, respeita RLS), não admin |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | Database | Migration `professional_documents jsonb` + `pnpm db:types` | complete | - | - | `.claude/PRPs/plans/completed/professional-document-registration-phase-1-database.plan.md` |
| 2 | Shared form fields | Componente + schema Zod condicional por `professional_type`, action de update estendida | complete | - | 1 | `.claude/PRPs/plans/completed/professional-document-registration-phase-2-shared-form-fields.plan.md` |
| 3 | Onboarding | Novo passo opcional pós-card no `onboarding-screen.tsx` | in-progress | with 4 | 2 | `.claude/PRPs/plans/professional-document-registration-phase-3-onboarding.plan.md` |
| 4 | Banner + deep link | Banner no dashboard layout (Server Component) + `?action=edit-profile` no `EditProfileModal` | pending | with 3 | 2 | - |

### Phase Details

**Phase 1: Database**
- **Goal**: Ter a coluna `professional_documents` disponível e tipada.
- **Scope**: Migration nullable `jsonb`, sem backfill; `pnpm db:types`.
- **Success signal**: `Tables<"users">["professional_documents"]` disponível nos tipos gerados.

**Phase 2: Shared form fields**
- **Goal**: Lógica de formulário e persistência reutilizável entre onboarding e modal.
- **Scope**: Componente de campos condicionais (CRM+RQE / CREFITO+RQE / COREN), schema Zod, extensão de `update-profile-action.ts` (ou nova action) para persistir `professional_documents`.
- **Success signal**: Consegue salvar `professional_documents` via action isolada, testável sem UI de onboarding/banner ainda prontas.

**Phase 3: Onboarding**
- **Goal**: Coleta opcional no momento do cadastro.
- **Scope**: Novo passo no `onboarding-screen.tsx`, botão "Pular", integração com a action da Phase 2.
- **Success signal**: Fluxo de onboarding completo com e sem preenchimento dos documentos, sem bloquear conclusão.

**Phase 4: Banner + deep link**
- **Goal**: Garantir que quem pulou complete depois.
- **Scope**: Banner Server Component no `(dashboard)/layout.tsx` condicionado a `professional_type` + `professional_documents IS NULL`; suporte a `?action=edit-profile` no `EditProfileModal`/`ProfileScreen` para abrir automaticamente.
- **Success signal**: Banner aparece/desaparece corretamente conforme estado do banco; link leva ao modal já aberto.

### Parallelism Notes

Phases 3 e 4 podem rodar em paralelo (worktrees separados) após a Phase 2 estar pronta — onboarding e banner/modal tocam arquivos diferentes e ambos dependem apenas do componente/action compartilhados da Phase 2.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| Tipo de coluna | `jsonb` único `professional_documents` | Colunas separadas (`crm`, `rqe`, `coren`) ou tabela normalizada | Pedido explícito do usuário; formato varia por tipo profissional, jsonb evita colunas nulas em massa |
| Obrigatoriedade | Opcional no onboarding | Obrigatório antes de concluir cadastro | Reduz fricção no cadastro; dado é necessário só para feature futura, não bloqueia uso imediato da plataforma |
| Escopo de tipos profissionais | obstetra (CRM+RQE), fisio (CREFITO+RQE), enfermeiro (COREN), doula fora | Incluir todos ou só obstetra/enfermeiro | Doula não possui registro de conselho; fisio corrigido para incluir CREFITO+RQE após esclarecimento do usuário |
| Comportamento do banner | Persistente, sem dismiss, até preencher | Dismissable com cooldown (como `NotificationPermissionPrompt`) | Decisão explícita do usuário — dado é considerado importante o suficiente para não permitir ignorar |
| Migração de dados existentes | Nenhuma (não obrigatório) | Backfill manual ou campanha de preenchimento | Decisão explícita do usuário — profissionais existentes preenchem organicamente via banner |

---

## Research Summary

**Market Context**
Não foi conduzida pesquisa de mercado formal para este PRD — a necessidade é regulatória (exigência legal de registro profissional em saúde no Brasil) e de dependência interna (feature de emissão de documentos), não uma resposta a comportamento de concorrentes.

**Technical Context**
- `users` table (`packages/supabase/supabase/migrations/20260126012100_remote_schema.sql:195-205`) não possui coluna jsonb hoje; precedente de jsonb existe em `patients` (endereço, `20260626000001_patients_address_jsonb.sql`).
- `professional_type` enum atual: `obstetra`, `enfermeiro`, `doula`, `fisio` (`database.types.ts:2446`, estendido por `20260530000001_add_fisioterapeuta_professional_type.sql`).
- Onboarding (`onboarding-screen.tsx:61-91`, `set-professional-type-action.ts`) hoje só seleciona o tipo, sem formulário — passo de documentos será novo.
- `EditProfileModal` (`apps/web/src/modals/edit-profile-modal.tsx`, 352 linhas) tem schema Zod inline, sem pacote de validações compartilhado; usa `react-hook-form` + `updateProfileAction`.
- `update-profile-action.ts` hoje só persiste `name`/`phone`/`addresses`; precisa ser estendida.
- `NotificationPermissionPrompt` é o único banner existente no `(dashboard)/layout.tsx`, mas é puramente client-side/localStorage — não serve de padrão direto pois o banner de documentos precisa de dado real do servidor.
- Não há precedente de `?action=` abrindo modal via URL no codebase — padrão novo a ser introduzido.

---

*Generated: 2026-07-13*
*Status: DRAFT - needs validation*
