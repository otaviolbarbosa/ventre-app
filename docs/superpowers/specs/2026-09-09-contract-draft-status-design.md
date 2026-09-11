# Rascunho de contrato (status draft/active/revoked)

## Motivação

Hoje, quando a profissional redige um contrato para uma gestante (título,
cidade, estado, cláusulas), nada é persistido até ela clicar em "Gerar
contrato". Se algum dado obrigatório das partes (gestante, profissional ou
equipe de cuidado) estiver incompleto, o modal "Dados incompletos" bloqueia
totalmente a geração — não existe um "Continuar mesmo assim". Como o
conteúdo redigido só existe em estado React (`useState`), qualquer saída da
página (fechar aba, navegar para editar o cadastro em outro lugar, sessão
expirar) faz a profissional perder todo o texto já escrito.

Este documento cobre a Fase 2 de uma correção em duas fases. A Fase 1 (já
implementada) adicionou um aviso antecipado de dados incompletos no topo do
formulário, reaproveitando a lógica e o modal já existentes — reduz a
surpresa, mas não resolve a causa raiz: ainda não é possível salvar
progresso enquanto os dados das partes estão incompletos.

A Fase 2 introduz um estado de **rascunho** persistido: a profissional pode
salvar o texto do contrato a qualquer momento, mesmo com dados de partes
incompletos, sem gerar PDF nem exigir validação de assinatura. O rascunho
fica visível para a gestante (que pode enviar solicitações de alteração),
mas não pode ser assinado nem finalizado até a profissional completar os
dados e gerar o contrato normalmente.

## Estado atual relevante

- `contracts` (`packages/supabase/supabase/migrations/20260627000001_contracts.sql`
  + migrations subsequentes) tem hoje `is_active boolean` **nullable**, usado
  como tri-estado: `NULL` = contrato-base/template (`is_base_contract=true`),
  `true` = contrato de paciente ativo, `false` = excluído ou revogado — essas
  duas últimas hoje só se distinguem pela presença de `revoked_at`. Não há
  nenhuma constraint de unicidade garantindo "no máximo um contrato ativo por
  paciente" — isso só é garantido pelo código das actions.
- A política RLS de `SELECT` em `contracts`
  (`20260814000004_contracts_rewrite_immutability_and_patient_rls.sql:41-53`)
  permite a gestante ler qualquer linha onde `patient_id` aponte para o
  registro dela — **não** filtra por `is_active`/status. O filtro por
  "ativo" acontece só nas queries da aplicação
  (`getMyContractById`, `getPatientContractAction`,
  `sign-patient-contract-action.ts`). Ou seja, criar um novo valor de status
  não exige mudança de RLS para visibilidade — só ajustar os filtros de
  query.
- `sign-patient-contract-action.ts` — a action por trás do botão "Gerar
  contrato" — já suporta criar um contrato **sem assinar**
  (`consent: false`): monta `parties_details` (snapshot das partes),
  gera e faz upload do PDF (`original_document_id`), mas não cria
  assinatura. Hoje esse contrato "gerado sem assinatura" já fica com
  `is_active = true`, portanto já visível e **já assinável** pela gestante —
  não existe hoje uma distinção entre "gerado, aguardando assinatura" e
  "ainda em rascunho, não pronto para assinatura".
- `getPatientContractAction` (lado profissional) e `getMyContractById`
  (`apps/web/src/services/patient-self.ts:192-233`, lado gestante) hoje
  filtram `is_base_contract=false AND is_active=true`.
- `ContractDetail` (`apps/web/src/components/patient-area/contract-detail.tsx`)
  já lida com ausência de PDF: usa `finalized_document_id` se
  `fully_signed_at`, senão `original_document_id`, senão renderiza uma
  pré-visualização via `previewContractPdfAction` a partir de
  `parties_details`. Não existe hoje nenhum branch para "contrato sem
  `parties_details` e sem PDF" (um rascunho puro cairia num estado de
  loading infinito se nada mudar aqui).
- `contract_change_requests` já existe e já é exclusiva da gestante para
  criar (`requested_by = auth.uid()`, checado como `user_type === "patient"`
  em `create-contract-change-request-action.ts`), resolvida só por
  `service_role`. A action de criação hoje exige
  `is_base_contract=false AND is_active=true` — não checa `is_signed` — ou
  seja, mecanicamente já aceitaria um contrato não assinado, bastando trocar
  o filtro de status.
- `patient-contract.tsx` (lado profissional): `mode` vira `"readonly"` para
  **qualquer** `contract` retornado, independente de `is_signed` — não há
  hoje uma visão distinta para "rascunho" vs. "gerado".
- O botão "Excluir contrato" (`deactivatePatientContractAction`) já é
  usado tanto para descartar um contrato recém-criado quanto um parcialmente
  assinado (`!fullySignedAt`); "Revogar e redigir novo"
  (`revokeContractAction`) só aparece quando `fullySignedAt` é verdadeiro.
  Essa distinção de intenção ("cancelar algo que nunca chegou a valer" vs.
  "revogar algo que já era válido") já existe hoje via `revoked_at IS NULL`
  vs. `NOT NULL` — decidimos no brainstorm **não** criar um quarto valor de
  status (`canceled`) para isso, para não duplicar a mesma informação em
  dois lugares. Ver "Decisões de escopo".

## Decisões de escopo (definidas no brainstorm)

- **Modelo de status**: `contracts.status text`, valores
  `'draft' | 'active' | 'revoked'`, substituindo `is_active` por completo
  (sem coluna de compatibilidade). `NULL` continua reservado para
  `is_base_contract = true`.
- **Sem quarto status `canceled`**: "excluir rascunho/contrato não
  totalmente assinado" e "revogar contrato totalmente assinado" continuam
  ambos como `status='revoked'`, diferenciados por `revoked_at` (mesma
  distinção que já existe hoje implicitamente via `is_active=false`). Só
  revisitar isso se surgir necessidade real de relatório/filtro separado
  para os dois casos.
- **Salvamento de rascunho é manual**: botão explícito "Salvar rascunho",
  sem autosave/debounce.
- **Rascunho é visível para a gestante**: ela pode ler o texto das
  cláusulas e enviar solicitação de alteração, mas **não pode assinar**
  enquanto `status = 'draft'`.
- **Rascunho nunca exige dados de partes completos**: diferente do
  "Gerar contrato" (que continua bloqueado por dados incompletos, sem
  mudança nesse ponto), salvar rascunho funciona mesmo com
  `activeIncompleteParties.length > 0` — essa é a correção real do
  problema original.
- **Reedição de contrato já gerado não volta a ser rascunho**: o fluxo
  existente de "editar contrato assinado" (`revoke-contract-signatures-action.ts`,
  que revoga assinaturas e recria a linha) continua deixando a nova linha
  como `status='active'`. Ficou fora de escopo esconder da gestante um
  contrato que está sendo reeditado depois de já ter sido gerado — o
  problema em questão é só a fase *antes* da primeira geração.
- **Sem PDF nem `parties_details` para rascunho**: salvar rascunho não
  gera PDF nem tira snapshot das partes. Isso só acontece na finalização
  ("Gerar contrato"), como hoje.

## Design

### Banco de dados

Nova migration (`packages/supabase/supabase/migrations/`):

```sql
-- 1. Nova coluna
alter table public.contracts add column status text;

-- 2. Backfill a partir do is_active atual
update public.contracts
set status = case
  when is_base_contract then null
  when is_active = true then 'active'
  when is_active = false then 'revoked'
end;

-- 3. Constraint: status só para contratos de paciente, valores fechados
alter table public.contracts
  add constraint contracts_status_check
  check (
    (is_base_contract = true and status is null)
    or (is_base_contract = false and status in ('draft', 'active', 'revoked'))
  );

-- 4. No máximo um contrato "vivo" (draft ou active) por paciente
create unique index one_live_contract_per_patient
  on public.contracts (patient_id)
  where is_base_contract = false and status in ('draft', 'active');

-- 5. Remove a coluna antiga
alter table public.contracts drop column is_active;
```

Após aplicar, rodar `pnpm db:types` para regenerar
`packages/supabase/src/types/database.types.ts` (convenção do projeto).

O trigger `prevent_signed_contract_mutation()` não referencia `is_active`
hoje (usa `is_signed`/`fully_signed_at`/`revoked_at`/`finalized_*`) — não
precisa de alteração.

### Actions

**Nova: `save-contract-draft-action.ts`** (`authActionClient`)

- Schema de input: mesmo formato de `patientContractFormSchema`
  (`title`, `city`, `state`, `clauses_html`) + `patientId`, `pregnancyId`.
- Fluxo:
  1. Verifica autorização (mesma checagem de team-membership que as outras
     actions de contrato já fazem).
  2. Busca contrato existente do paciente com `status in ('draft','active')`.
  3. Se não existir: insere nova linha com `status='draft'`, `is_signed=false`,
     `parties_details=null`, sem gerar PDF.
  4. Se existir com `status='draft'`: atualiza `title`/`city`/`state`/`clauses_html`/`updated_at` in-place.
  5. Se existir com `status='active'`: rejeita com erro claro ("Este
     contrato já foi gerado — use 'Editar contrato' em vez de salvar
     rascunho"), evitando sobrescrever silenciosamente um contrato
     finalizado.
  6. Trata violação do índice único (`one_live_contract_per_patient`) como
     erro amigável, não 500 cru.
  7. `revalidatePath` da aba de contrato.

**`sign-patient-contract-action.ts`** (o "Gerar contrato" de hoje):

- A busca por contrato existente (hoje `.eq("is_active", true)`) passa a
  ser `.in("status", ["draft", "active"])`, para localizar e finalizar um
  rascunho existente em vez de sempre criar uma linha nova.
- Ao concluir com sucesso (assinado ou não), grava `status='active'`.
- Continua exigindo dados de partes completos antes de abrir o modal de
  geração (gate já existe no client, sem mudança).

**`deactivate-patient-contract-action.ts`** e **`revoke-contract-action.ts`**:
gravam `status='revoked'` em vez de `is_active=false` (mantendo a mesma
distinção via `revoked_at` que já existe).

**`create-contract-change-request-action.ts`**: filtro de elegibilidade
passa de `is_base_contract=false AND is_active=true` para
`is_base_contract=false AND status in ('draft','active')`.

**Action de assinatura pelo lado da gestante** (a invocada pelo botão
"Assinar" em `ContractDetail` — confirmar o nome exato do arquivo na
implementação): adicionar guarda explícita rejeitando quando
`status = 'draft'`, com mensagem clara. Defesa em profundidade — o botão já
fica escondido na UI (ver abaixo), mas a action não deve confiar só nisso.

**`getPatientContractAction`** e **`getMyContractById`**: trocam o filtro
`is_active=true` por `status in ('draft','active')`, e passam a
`select`/retornar a coluna `status` para os componentes consumidores.

### UI da profissional (`patient-contract.tsx`)

- Novo estado local `contractStatus: "draft" | "active" | null`, populado a
  partir de `data.contract.status` em `fetchContract`.
- **Modo `editing`**: novo botão "Salvar rascunho" (`variant="outline"`, ao
  lado de "Cancelar"), chama `saveContractDraftAction`. **Não** é bloqueado
  pelo estado `activeIncompleteParties` — funciona mesmo com dados
  incompletos. Em caso de sucesso: toast + `fetchContract` para recarregar
  em modo `readonly` já como rascunho salvo.
- **Modo `readonly` com `contractStatus === "draft"`**:
  - A faixa verde de "Assinado eletronicamente" é substituída por uma
    faixa neutra: "Rascunho — visível para a gestante, mas ainda não pode
    ser assinado".
  - Botão "Assinar digitalmente" fica oculto (nunca aparece para rascunho).
  - "Excluir contrato" exibe o rótulo "Descartar rascunho".
  - "Editar contrato" continua levando a `mode="editing"` sem passar por
    `isEditConfirmOpen` (que já só dispara quando existe `signatureInfo`,
    inexistente em rascunho) — nenhuma mudança de código necessária aqui.
  - "Gerar contrato", acessado a partir da edição, continua sendo o único
    caminho de finalização — sem botão novo duplicando esse caminho.

### UI da gestante (`ContractDetail`)

- Novo branch quando `contract.status === "draft"`:
  - Banner explicando o estado: "Sua profissional está preparando o
    contrato. Você já pode revisar o texto e enviar comentários, mas a
    assinatura só estará disponível quando o contrato for finalizado."
  - Renderiza `clauses_html` diretamente (sanitizado com o mesmo
    `sanitizeMessageHtml`/allowlist já usado nas mensagens de solicitação de
    alteração), **sem** PDF e **sem** o bloco de cabeçalho/partes — isso
    evita ter que exibir "[não informado]" para a gestante enquanto os
    dados da profissional/equipe ainda estão incompletos.
  - Botão "Assinar" fica oculto, independente de `patientSigned`/pedido
    pendente.
  - "Solicitar alteração" continua funcionando exatamente como hoje (já é
    `contract_id`-scoped).
- `contract.status === "active"`: fluxo atual, sem mudanças.

### Segurança

- Guarda `status !== 'draft'` na action de assinatura da gestante (defesa
  em profundidade, já que a RLS de `SELECT` não filtra por status).
- Índice único `one_live_contract_per_patient` previne duas linhas
  `draft`/`active` simultâneas por corrida entre "Salvar rascunho" e
  "Gerar contrato" clicados em sequência rápida ou em abas diferentes.

## Testes

- Unit: `save-contract-draft-action` — cria rascunho novo; atualiza
  rascunho existente in-place; rejeita quando já existe contrato `active`
  para o paciente; trata violação do índice único com erro amigável.
- Unit: `sign-patient-contract-action` — localiza e finaliza um rascunho
  existente (`status: draft → active`), além do caminho já coberto de
  criação direta.
- Integração: `create-contract-change-request-action` aceita solicitação
  sobre um contrato `draft`.
- Integração: `getPatientContractAction`/`getMyContractById` retornam o
  contrato correto com o novo filtro de `status`.
- Verificar testes existentes que referenciam `is_active` — reportar quais
  quebram e por quê antes de alterá-los (não corrigir silenciosamente,
  conforme convenção do projeto).

## Fora de escopo

- Autosave/debounce do rascunho.
- Notificação push/e-mail/WhatsApp avisando a gestante de que um rascunho
  foi salvo (ela só vê ao entrar na própria tela de contrato).
- Esconder da gestante um contrato já gerado que está sendo reeditado após
  revogação de assinaturas.
- Status `canceled` separado de `revoked` (ver "Decisões de escopo").
- Migração de dados/relatórios administrativos que hoje possam depender de
  `is_active` fora do fluxo de contrato (não identificado nenhum até
  agora, mas não auditado exaustivamente fora de `apps/web/src`).
