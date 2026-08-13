# Múltiplos Contratos Base (Templates)

## Problem Statement

Empresas (staff/managers) e profissionais autônomos só podem manter **um único** contrato base cada. Sempre que precisam de um texto contratual diferente para um cenário de atendimento distinto (ex: parto domiciliar vs. hospitalar, ou tipos de plano diferentes), a única opção é sobrescrever o contrato base existente ou reescrever cláusulas manualmente dentro do editor de cada paciente — perdendo o template anterior e gastando tempo repetido.

## Evidence

- Levantamento do código: `saveBaseContractAction` e `savePersonalContractAction` fazem select-then-update-or-insert scoped por `(enterprise_id)` ou `(user_id + enterprise_id IS NULL)` — não existe constraint de banco impedindo múltiplas linhas, mas a lógica de aplicação garante que só exista uma. Qualquer novo save sobrescreve a anterior.
- Requisito de negócio explicito do usuário (prompt 013): "Isso limita que tenhamos apenas um formato de contrato" — confirma que a empresa já opera com múltiplos cenários de prestação de serviço que hoje não podem ser representados como templates reutilizáveis.

## Proposed Solution

Permitir que cada dono (empresa via staff, ou profissional autônomo) salve **múltiplos** contratos base nomeados. Um novo campo `name` (nullable) identifica cada template na tabela `contracts`. As páginas `/settings/contract` e `/profile/settings/contract` ganham um seletor dropdown (não agrupado, pois cada página já é escopada a um único tipo de dono) para carregar um template existente para edição, mais um botão para começar um contrato em branco. O componente `patient-contract.tsx` — usado para gerar o contrato real de uma gestante — ganha um seletor inicial agrupado por "contratos da empresa" e "meus contratos pessoais", substituindo o fluxo atual `no-base`/`choose-base`/`no-contract`. As mensagens de "contrato base não configurado" são removidas, já que criar um novo template é possível diretamente ali.

## Key Hypothesis

Acreditamos que permitir múltiplos contratos base nomeados vai eliminar a necessidade de reescrever cláusulas manualmente e o risco de perder templates por sobrescrita, para managers e profissionais autônomos.
Saberemos que estamos certos quando o tempo até a geração/assinatura de um contrato de paciente cair, e nenhum usuário reportar perda de conteúdo de um contrato base anterior.

## What We're NOT Building

- Exclusão/arquivamento de templates — adiado; v1 não remove templates, apenas cria/edita/lista.
- Indicador de quantos pacientes usam um template — adiado; não há visibilidade sobre uso cruzado em v1.
- Renomear um template já salvo sem duplicar — adiado; renomear = criar novo via "salvar como novo".
- Limite de quantidade de templates por dono — v1 é ilimitado (sem cap artificial).
- Permitir que "salvar como novo" em patient-contract.tsx grave como contrato da empresa — sempre grava como pessoal do profissional, nunca como enterprise, mesmo partindo de um template da empresa.

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|---------------|
| Empresas/profissionais com 2+ templates salvos | Aumento sustentado após lançamento | Contagem de linhas `is_base_contract=true` agrupadas por `enterprise_id`/`user_id` |
| Tempo mediano até assinatura do contrato do paciente | Redução vs. baseline pré-lançamento | Timestamp entre abertura da aba de contrato e `signed_at` |
| Relatos de perda de conteúdo de template base | Zero | Suporte/feedback dos usuários |

## Open Questions

- [ ] O limite de templates deve permanecer ilimitado indefinidamente, ou reavaliar após adoção (ex: UI de dropdown ficando poluída)?
- [ ] Deve haver uma forma de excluir/arquivar templates no futuro próximo, dado que v1 não permite remoção?

---

## Users & Context

**Primary User**
- **Who**: Managers (staff da empresa) e profissionais autônomos (`user_type = professional`, `enterprise_id IS NULL`) que geram contratos para gestantes.
- **Current behavior**: Mantêm um único contrato base por dono; ao precisar de variação, editam manualmente as cláusulas no editor por paciente ou sobrescrevem o template existente.
- **Trigger**: Momento de configurar um novo contrato base em `/settings/contract` ou `/profile/settings/contract`, ou ao gerar o contrato de uma gestante em `patient-contract.tsx` e perceber que o cenário exige um texto diferente do template atual.
- **Success state**: Consegue escolher entre múltiplos templates nomeados, carregar um para edição/geração, e salvar variações sem perder as anteriores.

**Job to Be Done**
Quando preciso gerar um contrato para um cenário de atendimento diferente do padrão, quero escolher ou criar um template de contrato base nomeado, para não reescrever cláusulas do zero nem perder o template anterior.

**Non-Users**
Pacientes/gestantes não interagem com esta funcionalidade — elas apenas visualizam/assinam o contrato final gerado a partir de um template.

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | Coluna `name` (nullable) em `contracts` | Necessária para identificar/rotular cada template no seletor |
| Must | Ações de save passam a suportar criar (novo) e atualizar (por id) em vez de upsert único por dono | Base para múltiplos templates coexistirem |
| Must | Query de listagem de templates por dono (empresa e pessoal) | Alimenta os dropdowns nas 3 telas |
| Must | Dropdown simples em `/settings/contract` e `/profile/settings/contract` + botão "novo contrato" que limpa o formulário | Fluxo de escolher/criar template nessas páginas |
| Must | Botões "Editar" (atualiza in-place) e "Criar novo" nessas páginas | Permite tanto atualizar quanto duplicar sem perder o template original |
| Must | Seletor inicial agrupado (empresa / pessoal) em `patient-contract.tsx`, substituindo estados `no-base`/`choose-base`/`no-contract` | Requisito explícito do usuário |
| Must | Botão "novo contrato" em `patient-contract.tsx` que limpa o formulário (reset se já preenchido) | Requisito explícito |
| Must | Modal "salvar como novo contrato base" em `patient-contract.tsx`, sempre associando ao `user_id` do profissional, nunca `enterprise_id` | Requisito explícito |
| Must | Remover mensagens de "contrato base não configurado" em `patient-contract.tsx` | Requisito explícito — criar template é possível na própria tela |
| Won't | Excluir/arquivar templates | Fora de escopo v1 |
| Won't | Indicador de uso do template por pacientes | Fora de escopo v1 |
| Won't | Renomear template existente sem duplicar | Fora de escopo v1 |

### MVP Scope

CRUD mínimo (create, list, update-in-place, save-as-new) de templates nomeados nas 3 telas, sem exclusão, sem indicadores de uso, sem limite de quantidade.

### User Flow

1. **Settings (empresa ou pessoal)**: usuário abre a página → vê dropdown vazio de templates + botão "novo contrato" → nenhum é carregado automaticamente → seleciona um template existente (carrega campos) ou clica "novo" (formulário em branco) → edita → clica "Editar" (atualiza in-place, se um template estava selecionado) ou "Criar novo" (sempre insere novo, pedindo nome se necessário).
2. **Patient contract (`patient-contract.tsx`)**: usuário abre a aba de contrato da gestante → vê apenas o seletor agrupado (empresa / pessoal) + botão "novo contrato" → nenhum contrato é pré-carregado → seleciona um template base → formulário populado, editável → pode gerar/assinar o contrato do paciente normalmente, ou clicar "salvar como novo contrato base" → modal pede nome → cria novo template pessoal (nunca da empresa).

---

## Technical Approach

**Feasibility**: HIGH — não existe constraint de banco bloqueando múltiplas linhas `is_base_contract=true` por dono; a restrição de "um único" é inteiramente lógica de aplicação (select-then-update-or-insert em `save-base-contract-action.ts` e `save-personal-contract-action.ts`). Adicionar suporte a múltiplos templates é principalmente uma mudança de queries + UI, não de arquitetura.

**Architecture Notes**
- Migration: `ALTER TABLE contracts ADD COLUMN name text NULL;` — seguir o padrão das migrations incrementais existentes (`..._contracts_add_title.sql`, etc.) em `packages/supabase/supabase/migrations/`.
- `save-base-contract-action.ts` / `save-personal-contract-action.ts`: adicionar parâmetro opcional `contractId` (update in-place quando presente) e `name` (obrigatório ao criar novo); quando `contractId` ausente, sempre `insert` (nunca mais buscar linha existente por dono).
- `get-patient-contract-action.ts`: trocar `.maybeSingle()` por queries que retornam arrays (`enterpriseBaseOptions`, `personalBaseOptions`), preservando compatibilidade com os campos legados se necessário durante a transição.
- `services/base-contract.ts` (`getBaseContract`, `getPersonalBaseContract`): trocar de single-row para listagem (`getBaseContracts`, `getPersonalBaseContracts`), mantendo função para buscar template específico por id ao carregar no dropdown.
- Nova action para "salvar como novo contrato base" a partir de `patient-contract.tsx`, sempre insere com `user_id = user.id`, `enterprise_id = null`, `is_base_contract = true`, `name` do modal.
- Após `pnpm db:push`, rodar `pnpm db:types` para sincronizar `database.types.ts`.

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Dados legados sem `name` aparecendo em branco no dropdown | Alta (certeza) | Fallback de label para `title` quando `name` for null |
| Quebra de fluxo existente em `patient-contract.tsx` ao remover estados `no-base`/`choose-base`/`no-contract` | Média | Revisar todos os call sites e testes manuais do fluxo de geração/assinatura de contrato antes de mergear |
| `RLS`/policies não previstas para múltiplas linhas por dono | Baixa | Policies atuais já são por ownership (`user_id`/`enterprise_id`), não têm lógica de cardinalidade — não deve exigir mudança de RLS |

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
| 1 | Schema + migration | Adicionar coluna `name` nullable, rodar `db:push` e `db:types` | complete | - | - | `.claude/PRPs/plans/completed/multi-template-base-contracts-phase1-schema-migration.plan.md` |
| 2 | Server actions (save/list) | Refatorar save actions para create/update explícitos; queries de listagem por dono | complete | - | 1 | `.claude/PRPs/plans/completed/multi-template-base-contracts-phase2-server-actions.plan.md` |
| 3 | Settings pages UI | Dropdown + botão novo + Editar/Criar novo em `/settings/contract` e `/profile/settings/contract` | complete | with 4 | 2 | `.claude/PRPs/plans/completed/multi-template-base-contracts-phase3-settings-ui.plan.md` |
| 4 | Patient-contract UI | Seletor agrupado + modal "salvar como novo" + remoção das mensagens de contrato não configurado | complete | with 3 | 2 | `.claude/PRPs/plans/completed/multi-template-base-contracts-phase4-patient-contract-ui.plan.md` |
| 5 | Validação end-to-end | Testar fluxo completo: criar, editar, gerar contrato de paciente, salvar como novo | in-progress | - | 3, 4 | `.claude/PRPs/plans/multi-template-base-contracts-phase5-e2e-validation.plan.md` |

### Phase Details

**Phase 1: Schema + migration**
- **Goal**: Persistir nome de template sem quebrar dados existentes.
- **Scope**: Nova migration `ALTER TABLE contracts ADD COLUMN name text NULL`; `pnpm db:push`; `pnpm db:types`.
- **Success signal**: `database.types.ts` reflete o novo campo `name` em `contracts`.

**Phase 2: Server actions (save/list)**
- **Goal**: Suportar múltiplos templates por dono via create/update explícitos.
- **Scope**: Refatorar `save-base-contract-action.ts`, `save-personal-contract-action.ts` para aceitar `contractId`/`name`; nova action de "salvar como novo" a partir do contexto do paciente; atualizar `get-patient-contract-action.ts` e `services/base-contract.ts` para retornar listas.
- **Success signal**: É possível criar múltiplas linhas `is_base_contract=true` por dono via as actions, e listá-las corretamente.

**Phase 3: Settings pages UI**
- **Goal**: Permitir escolher/criar/editar templates em `/settings/contract` e `/profile/settings/contract`.
- **Scope**: Dropdown de seleção (não agrupado), botão "novo contrato" (reset), botões "Editar" e "Criar novo".
- **Success signal**: Nenhum template carrega automaticamente ao abrir a página; usuário consegue alternar entre templates e criar novos sem perder os existentes.

**Phase 4: Patient-contract UI**
- **Goal**: Fluxo inicial de seleção agrupada + salvar como novo template pessoal.
- **Scope**: Substituir estados `no-base`/`choose-base`/`no-contract` por seletor agrupado (empresa/pessoal) + botão novo contrato; adicionar modal "salvar como novo contrato base" (sempre pessoal); remover mensagens de "contrato base não configurado".
- **Success signal**: Usuário nunca vê contrato pré-carregado automaticamente; consegue gerar contrato de paciente a partir de qualquer template ou do zero; consegue salvar edições como novo template pessoal.

**Phase 5: Validação end-to-end**
- **Goal**: Garantir que o fluxo completo (criação de templates → geração de contrato de paciente → assinatura) funciona sem regressões.
- **Scope**: Testes manuais dos 3 fluxos (settings empresa, settings pessoal, patient-contract), incluindo casos de dados legados (`name` null).
- **Success signal**: Todos os fluxos funcionam sem mensagens de erro ou estados inconsistentes; PDF/assinatura de contrato de paciente continua funcionando normalmente.

### Parallelism Notes

Fases 3 e 4 podem rodar em paralelo (em worktrees separadas, se desejado) pois tocam componentes/telas distintos (`ContractSettingsScreen`/`PersonalContractSettingsScreen` vs. `patient-contract.tsx`), ambas dependendo apenas da Fase 2 (server actions) estar pronta.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Limite de templates por dono | Ilimitado em v1 | Cap fixo (ex: 10) | Simplicidade; revisitar se dropdown ficar poluído |
| Dropdown agrupado | Apenas em `patient-contract.tsx` | Agrupar também em settings pages | Settings pages já são escopadas a um único tipo de dono (empresa OU pessoal), não fazem sentido agrupadas |
| Edição em `/settings` páginas | Dois botões: "Editar" (in-place) e "Criar novo" | Sempre pedir nome ao salvar | Usuário optou por controle explícito sobre atualizar vs. duplicar |
| Origem de "salvar como novo" em patient-contract | Sempre pessoal (`user_id`), nunca empresa | Permitir escolher destino | Requisito explícito do usuário/prompt original |
| Exclusão de templates | Fora de escopo v1 | Incluir delete/archive | Usuário escolheu "minimal v1" |

---

## Research Summary

**Market Context**
Não coletado nesta rodada — feature é interna/operacional (gestão de contratos), sem necessidade de benchmarking externo identificada pelo usuário.

**Technical Context**
- Tabela `contracts` (`packages/supabase/supabase/migrations/20260627000001_contracts.sql` + migrations incrementais) armazena tanto templates base (`is_base_contract=true`) quanto contratos por paciente, diferenciados por `user_id` xor `enterprise_id` e `patient_id`/`pregnancy_id` nulos.
- Nenhuma constraint única de banco impede múltiplos templates por dono hoje — a restrição é somente lógica de aplicação em `save-base-contract-action.ts` e `save-personal-contract-action.ts` (select-then-update-or-insert).
- `get-patient-contract-action.ts` usa `.maybeSingle()` para `enterpriseBase`/`personalBase`; precisa mudar para arrays.
- `services/base-contract.ts` (`getBaseContract`, `getPersonalBaseContract`) usados pelas páginas de settings também usam `.maybeSingle()`.
- Nenhuma coluna `name` existe hoje; `title` é usado apenas como cabeçalho exibido no contrato, não como identificador de template.
- RLS de `contracts` é baseada em ownership (`user_id = auth.uid()` / membership de `enterprise_id`), sem lógica de cardinalidade — não deve exigir mudanças de política.

---

*Generated: 2026-07-14*
*Status: DRAFT - needs validation*
