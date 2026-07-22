# Feature: Múltiplos Profissionais Backup Ilimitados por Especialidade

## Summary

Hoje uma paciente só pode ter **1 profissional titular + 1 profissional backup** por especialidade (`professional_type`) — regra imposta por uma constraint `UNIQUE (patient_id, professional_type, is_backup)` no banco, replicada por pré-checagens nas server actions e refletida na UI (botão "adicionar backup" some após o primeiro). A nova regra mantém **1 titular por especialidade por gestação (`pregnancy_id`)**, mas permite **backups ilimitados**. A mudança toca três camadas: migration de banco (troca a constraint por um índice único parcial escopado por `pregnancy_id`, aplicado somente ao titular), server actions (remove as checagens de duplicidade de backup, mantém as de titular, e padroniza a resolução de "gestação ativa"), e UI (troca `.find()` por `.filter()` para renderizar lista de backups, remove o limite de seleção no modal de nova paciente).

## User Story

Como uma administradora/staff (ou profissional titular) de uma equipe de cuidado
Eu quero adicionar quantas profissionais backup forem necessárias para uma especialidade
Para que a paciente tenha cobertura de plantão adequada sem ficar limitada a apenas 1 backup por área

## Problem Statement

A constraint `team_members_patient_id_professional_type_is_backup_key` e as checagens correspondentes no código impedem inserir uma segunda profissional backup para a mesma especialidade da mesma paciente/gestação, mesmo quando isso é uma necessidade operacional legítima (múltiplas plantonistas de backup).

## Solution Statement

1. **Banco**: substituir a constraint `UNIQUE (patient_id, professional_type, is_backup)` por um índice único parcial `UNIQUE (pregnancy_id, professional_type) WHERE is_backup = false` — isso restringe apenas o titular (por gestação, não mais por paciente histórica) e libera o backup para múltiplas linhas.
2. **Actions**: remover as pré-checagens de "já existe backup" em `add-professional-to-team-action.ts` e `add-backup-professional-action.ts`, mantendo apenas a checagem de titular duplicado. Padronizar a resolução de gestação para usar sempre a **gestação ativa** (`has_finished = false`) nos três pontos de inserção, evitando que um titular seja vinculado a uma gestação antiga/finalizada enquanto o backup é vinculado à gestação atual (o que quebraria silenciosamente o novo índice, já que são `pregnancy_id` diferentes).
3. **UI**: nas telas de equipe, trocar `backupByType` de `.find()` (retorna 1 item) para `.filter()` (retorna array) e renderizar uma lista de cards de backup, sempre exibindo o botão de adicionar mais um backup. No modal de nova paciente, corrigir `getBackupProfessionalIds` para marcar como backup toda ocorrência a partir da 2ª (hoje só marca exatamente a 2ª) e remover/aumentar o `maxSelectedPerGroup={2}` do `SearchableDropdown`.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | MEDIUM                                                                |
| Systems Affected | Supabase (migration + tipos gerados), server actions, UI (2 screens + 1 modal) |
| Dependencies     | Nenhuma nova lib — usa Supabase, next-safe-action, Zod, React já existentes |
| Estimated Tasks  | 9                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  Equipe Titular          Equipe Backup                                    ║
║  ┌──────────────┐        ┌──────────────┐                                 ║
║  │ Dra. Ana      │        │ Dra. Bia      │  ◄─ único slot de backup       ║
║  │ Obstetra      │        │ Obstetra(bkp)│                                ║
║  └──────────────┘        └──────────────┘                                 ║
║                                                                             ║
║  Ao tentar adicionar outra backup para "obstetra":                        ║
║  → botão "Adicionar profissional backup" já não aparece mais              ║
║  → se forçado via API: erro "Já existe um profissional backup..."         ║
║                                                                             ║
║  DB: UNIQUE(patient_id, professional_type, is_backup) bloqueia insert     ║
║                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                  ║
╠═══════════════════════════════════════════════════════════════════════════╣
║                                                                             ║
║  Equipe Titular          Equipe Backup                                    ║
║  ┌──────────────┐        ┌──────────────┐                                 ║
║  │ Dra. Ana      │        │ Dra. Bia      │                                ║
║  │ Obstetra      │        │ Obstetra(bkp)│                                ║
║  └──────────────┘        └──────────────┘                                 ║
║                          ┌──────────────┐                                 ║
║                          │ Dra. Carla    │  ◄─ 2ª backup, agora permitida  ║
║                          │ Obstetra(bkp)│                                 ║
║                          └──────────────┘                                 ║
║                          [+ Adicionar profissional backup]  ◄─ sempre visível
║                                                                             ║
║  DB: UNIQUE(pregnancy_id, professional_type) WHERE is_backup=false        ║
║      → só o titular é único; backups sem limite                          ║
║                                                                             ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `patient-team-screen.tsx` | 1 backup exibido, botão some após 1º | Lista de backups, botão sempre visível | Pode adicionar N backups por especialidade |
| `patient-team-enterprise-screen.tsx` | idem | idem | idem (fluxo staff) |
| `new-patient-modal.tsx` (step 4) | Seleção trava em 2 por especialidade | Sem limite de seleção por especialidade | Pode selecionar 1 titular + N backups na criação da paciente |
| `add-professional-to-team-action.ts` | Erro ao inserir 2º backup | Insere normalmente | Staff pode adicionar quantos backups quiser |
| `add-backup-professional-action.ts` | Erro ao inserir 2º backup | Insere normalmente | Titular pode convidar múltiplos backups |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `packages/supabase/supabase/migrations/20260318000003_team_members_unique_constraint_with_backup.sql` | 1-6 | Constraint atual a ser substituída |
| P0 | `packages/supabase/supabase/migrations/20260519000001_team_members_populate_pregnancy_id.sql` | 1-27 | Confirma `pregnancy_id NOT NULL` desde essa migration |
| P0 | `packages/supabase/supabase/migrations/20260626000003_addresses_nullable_patient_user_unique.sql` | all | Padrão de índice único parcial (`CREATE UNIQUE INDEX ... WHERE ...`) a seguir |
| P0 | `apps/web/src/actions/add-professional-to-team-action.ts` | 22-44 | Checagem de titular/backup e resolução de gestação (hoje: mais recente, sem filtro) a alterar |
| P0 | `apps/web/src/actions/add-backup-professional-action.ts` | 17-68 | Checagem de backup duplicado a remover; já usa gestação ativa (`has_finished = false`) — padrão a replicar |
| P0 | `apps/web/src/actions/add-patients-to-professional-action.ts` | 20-31 | Resolução de gestação (mais recente, sem filtro) a padronizar |
| P0 | `apps/web/src/screens/patient-team-screen.tsx` | 83-95, 186-246 | `backupByType`/`canAddBackupForRole` e render do grid titular/backup |
| P0 | `apps/web/src/screens/patient-team-enterprise-screen.tsx` | 64-76, 141-189 | Mesma lógica espelhada (fluxo staff) |
| P1 | `apps/web/src/modals/new-patient-modal.tsx` | 83-96, 1337-1389 | `getBackupProfessionalIds` e uso do `SearchableDropdown` com `maxSelectedPerGroup` |
| P1 | `packages/ui/src/shared/searchable-dropdown/searchable-dropdown.tsx` | 96-102 | `isGroupLimitReached` — não precisa mudar, só o valor passado |
| P2 | `apps/web/src/types/index.ts` | 25-37 | Shape de `TeamMember` consumido pelas telas |
| P2 | `packages/supabase/src/types/database.types.ts` | 1796-1847 | Tipos gerados de `team_members` (não editar manualmente — regenerar) |

**Documentação externa**: não aplicável — mudança é 100% interna (Postgres + Supabase + React já em uso). Sintaxe de índice único parcial já documentada nos exemplos do próprio repositório (ver P0 acima).

---

## Patterns to Mirror

**PARTIAL UNIQUE INDEX (banco):**
```sql
-- SOURCE: packages/supabase/supabase/migrations/20260626000003_addresses_nullable_patient_user_unique.sql
CREATE UNIQUE INDEX addresses_user_id_unique
  ON public.addresses (user_id)
  WHERE user_id IS NOT NULL;
```

**RESOLUÇÃO DE GESTAÇÃO ATIVA (padrão já correto a replicar):**
```typescript
// SOURCE: apps/web/src/actions/add-backup-professional-action.ts:17-26
const { data: pregnancy } = await supabase
  .from("pregnancies")
  .select("id")
  .eq("patient_id", parsedInput.patientId)
  .eq("has_finished", false)
  .single();

if (!pregnancy) {
  throw new Error("Os dados da gestação não foram encontrados");
}
```

**SERVER ACTION COM next-safe-action:**
```typescript
// SOURCE: apps/web/src/actions/add-professional-to-team-action.ts:15-20
export const addProfessionalToTeamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    if (!isStaff(profile)) throw new Error("Acesso não autorizado");
    ...
```

**GRID TITULAR/BACKUP (UI, a generalizar para lista):**
```tsx
// SOURCE: apps/web/src/screens/patient-team-screen.tsx:186-246
{activeRoles.map((role) => {
  const primary = primaryByType[role];
  const backup = backupByType[role]; // hoje: item único — vira array
  ...
  {backup ? (
    <TeamMemberCard member={backup} ... />
  ) : canAddBackupForRole ? (
    <button onClick={() => setIsBackupOpen(true)}>Adicionar profissional backup</button>
  ) : ( ... )}
})}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `packages/supabase/supabase/migrations/20260722000001_team_members_unlimited_backups.sql` | CREATE | Nova constraint: só titular é único, agora por `pregnancy_id` |
| `packages/supabase/src/types/database.types.ts` | REGENERATE | Via `pnpm db:types` — não editar manualmente |
| `apps/web/src/actions/add-professional-to-team-action.ts` | UPDATE | Remove checagem de backup duplicado; mantém checagem de titular escopada por `pregnancy_id`; passa a resolver gestação ativa (`has_finished = false`) |
| `apps/web/src/actions/add-backup-professional-action.ts` | UPDATE | Remove bloco de checagem de backup duplicado (linhas 54-67) |
| `apps/web/src/actions/add-patients-to-professional-action.ts` | UPDATE | Padroniza resolução de gestação para "ativa" (`has_finished = false`) em vez de "mais recente" |
| `apps/web/src/screens/patient-team-screen.tsx` | UPDATE | `backupByType`: `.find()` → `.filter()`; renderiza lista de backups; botão sempre visível quando elegível |
| `apps/web/src/screens/patient-team-enterprise-screen.tsx` | UPDATE | Mesma mudança (fluxo staff) |
| `apps/web/src/modals/new-patient-modal.tsx` | UPDATE | `getBackupProfessionalIds`: marca 2ª+ ocorrência como backup; remove/aumenta `maxSelectedPerGroup` |

---

## NOT Building (Scope Limits)

- **Rotas de convite** (`apps/web/app/api/team/invites/route.ts` e `[id]/route.ts`): hoje só criam membros **titulares** (`is_backup` não é setado, default `false`); não fazem parte do fluxo de backup e não serão alteradas nesta mudança. A checagem de duplicidade lá (sem filtro `is_backup`) é um comportamento pré-existente independente desta feature — fora de escopo.
- **Consumidores que já tratam array corretamente** (`team-members-avatars.tsx`, `patient-card.tsx`, `home-patients-cache.ts`, `enterprise-home-patients-cache.ts`, `apps/admin/src/actions/patients.ts`): já iteram sobre todos os `team_members` sem assumir 1 backup — não precisam de mudança.
- **Testes automatizados**: não existem no repositório (`*.test.ts`/`*.test.tsx`) para nenhuma área do código — validação será manual + `pnpm check-types`, consistente com o padrão atual do projeto.
- **Migração de dados históricos**: não há necessidade de backfill — a mudança só afeta constraint/índice, não dados existentes.

---

## Step-by-Step Tasks

### Task 1: CREATE migration `packages/supabase/supabase/migrations/20260722000001_team_members_unlimited_backups.sql`

- **ACTION**: Substituir a constraint UNIQUE atual por um índice único parcial escopado por `pregnancy_id`, restrito ao titular
- **IMPLEMENT**:
  ```sql
  -- Permite múltiplos profissionais backup ilimitados por especialidade;
  -- mantém apenas 1 titular por especialidade por gestação (não mais por paciente histórica).
  ALTER TABLE public.team_members
    DROP CONSTRAINT team_members_patient_id_professional_type_is_backup_key;

  CREATE UNIQUE INDEX team_members_pregnancy_professional_type_primary_unique
    ON public.team_members (pregnancy_id, professional_type)
    WHERE is_backup = false;
  ```
- **MIRROR**: `packages/supabase/supabase/migrations/20260626000003_addresses_nullable_patient_user_unique.sql` — padrão de índice único parcial
- **GOTCHA**: a constraint antiga `team_members_patient_id_professional_id_key` (UNIQUE patient_id, professional_id) continua existindo e não deve ser tocada — ela impede que o mesmo profissional tenha 2 linhas para a mesma paciente, o que é uma regra independente e ainda válida
- **VALIDATE**: `pnpm db:push` (aplica a migration no Supabase) — deve rodar sem erro

### Task 2: REGENERATE tipos TS

- **ACTION**: Regenerar `database.types.ts` após a migration
- **IMPLEMENT**: rodar `pnpm db:types` a partir da raiz do monorepo
- **GOTCHA**: constraints não aparecem em `Relationships` (só FKs) — não espere diff nesse arquivo além de metadados triviais; o importante é a migration ter sido aplicada antes
- **VALIDATE**: `git diff packages/supabase/src/types/database.types.ts` roda sem erro; `pnpm check-types` continua passando

### Task 3: UPDATE `apps/web/src/actions/add-professional-to-team-action.ts`

- **ACTION**: Remover a checagem de duplicidade quando `isBackup === true`; manter apenas para titular; padronizar resolução de gestação para "ativa"
- **IMPLEMENT**:
  - Trocar a query de gestação (linhas 22-28) de `.order("created_at", { ascending: false }).limit(1).single()` para `.eq("has_finished", false).single()`, igual ao padrão de `add-backup-professional-action.ts`
  - Na checagem de duplicidade (linhas 33-44), só executar quando `!isBackup`; adicionar `.eq("pregnancy_id", pregnancyId)` ao filtro para escopar por gestação; remover o branch de erro para `isBackup === true`
- **MIRROR**: `apps/web/src/actions/add-backup-professional-action.ts:17-26` (resolução de gestação ativa)
- **GOTCHA**: se remover a query de gestação inteira, checar que `pregnancyId` continua sendo usado no insert (linha 51) e que a mensagem de erro "Paciente não possui gestação registrada" (linha 30) permanece para o caso de gestação ativa inexistente
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/actions/add-backup-professional-action.ts`

- **ACTION**: Remover o bloco de checagem de backup duplicado
- **IMPLEMENT**: Deletar as linhas 54-67 (bloco `const { data: existingBackup } = ...` até o `throw new Error(...)`), mantendo o restante do fluxo (resolução de `professionalType` via `teamMember`, insert final) intacto
- **MIRROR**: nenhum — é uma remoção pontual dentro de um bloco `if (!isStaff(profile))` já existente
- **GOTCHA**: não remover o `if (!isStaff(profile)) { ... }` inteiro — ele ainda resolve `professionalType` a partir do `teamMember` do usuário atual (linhas 42-52), que continua necessário
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/actions/add-patients-to-professional-action.ts`

- **ACTION**: Padronizar resolução de gestação para "ativa" em vez de "mais recente"
- **IMPLEMENT**: Na query de `pregnancies` (linhas 20-24), adicionar `.eq("has_finished", false)` e remover o `.order("created_at", { ascending: false })` (não é mais necessário filtrar por mais recente quando já filtramos por ativa — deve haver no máximo 1 gestação ativa por paciente)
- **MIRROR**: `apps/web/src/actions/add-backup-professional-action.ts:17-22`
- **GOTCHA**: como isso é um bulk insert com múltiplos `patientIds`, o filtro `.in("patient_id", patientIds).eq("has_finished", false)` deve continuar retornando 1 linha por paciente — se uma paciente não tiver gestação ativa, ela já é excluída do `inserts` pelo `.filter((id) => pregnancyByPatient.has(id))` existente (linha 34), então nenhuma mudança adicional é necessária ali
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/screens/patient-team-screen.tsx`

- **ACTION**: Trocar `backupByType` de item único para array e renderizar lista de backups
- **IMPLEMENT**:
  - Linha 90-95: trocar `.find(...)` por `.filter(...)`, resultando em `Record<ProfessionalType, TeamMember[]>`
  - Linha 190-194 (`canAddBackupForRole`): remover a condição `!backup` — o botão de adicionar deve sempre aparecer para quem tem permissão (staff ou titular da própria especialidade), independente de já existir backup
  - Linhas 221-245: trocar o card único de backup por `.map()` sobre o array de backups, renderizando um `TeamMemberCard` por item, seguido do botão "Adicionar profissional backup" (sempre visível quando `canAddBackupForRole`)
- **MIRROR**: estrutura de grid já existente (linhas 202-247), só troca o card único por lista
- **GOTCHA**: o grid é `sm:grid-cols-2` (titular | backup) — ao ter múltiplos backups, decidir se cada backup extra ocupa uma nova linha do grid (mantendo titular alinhado só na primeira linha) ou uma coluna separada; recomenda-se manter titular na primeira linha e empilhar os backups abaixo dele na mesma coluna para não distorcer o alinhamento visual
- **VALIDATE**: `pnpm check-types`; teste manual (ver seção Manual Validation)

### Task 7: UPDATE `apps/web/src/screens/patient-team-enterprise-screen.tsx`

- **ACTION**: Mesma mudança da Task 6, aplicada ao fluxo enterprise/staff
- **IMPLEMENT**: Linhas 71-76 (`backupByType` → filter), linhas 171-186 (render lista + botão sempre visível — aqui não há `canAddBackupForRole`, staff sempre pode adicionar, então só remover a condicional `backup ?` que esconde o botão)
- **MIRROR**: Task 6 (mesmo padrão, arquivo irmão)
- **VALIDATE**: `pnpm check-types`; teste manual

### Task 8: UPDATE `apps/web/src/modals/new-patient-modal.tsx`

- **ACTION**: Corrigir `getBackupProfessionalIds` para marcar toda ocorrência a partir da 2ª como backup; remover/aumentar `maxSelectedPerGroup`
- **IMPLEMENT**:
  - Linha 93: trocar `if (seenByType[type] === 2) result.push(id);` por `if (seenByType[type] >= 2) result.push(id);`
  - Linha 1384: remover a prop `maxSelectedPerGroup={2}` do `SearchableDropdown` (permite seleção ilimitada por grupo/especialidade) — a 1ª selecionada de cada tipo continua titular (via `makeResponsible`/ordem de seleção), as demais viram backup automaticamente
- **MIRROR**: nenhum — ajuste pontual de lógica existente
- **GOTCHA**: `getBackupProfessionalIds` depende da ORDEM de `ids` (primeira ocorrência de cada tipo = titular); confirmar que essa ordem é preservada em `selectedIds` (vem de `field.value`, que é a ordem de seleção/reordenação via `makeResponsible`) — não deve quebrar com a remoção do limite
- **VALIDATE**: `pnpm check-types`; teste manual (selecionar 3+ profissionais da mesma especialidade e confirmar que só a 1ª vira titular)

### Task 9: Validação final e revisão de regressão

- **ACTION**: Rodar checagem de tipos completa e revisar pontos sensíveis identificados na investigação
- **IMPLEMENT**: N/A — apenas validação
- **VALIDATE**: `pnpm check-types` (raiz do monorepo) sem erros

---

## Testing Strategy

Não há suíte de testes automatizados no repositório. A validação será:

### Edge Cases Checklist (manual)

- [ ] Adicionar 2º backup para a mesma especialidade/gestação → deve funcionar (staff e fluxo self-service do titular)
- [ ] Adicionar 3º, 4º backup → deve continuar funcionando (sem limite)
- [ ] Tentar adicionar 2º **titular** para a mesma especialidade/gestação → deve continuar bloqueado (mensagem de erro clara)
- [ ] Paciente com gestação finalizada + nova gestação ativa → titular da gestação antiga não deve conflitar com titular da gestação nova (constraint agora é por `pregnancy_id`)
- [ ] Tela `patient-team-screen.tsx`: múltiplos backups aparecem listados, botão de adicionar continua visível
- [ ] Tela `patient-team-enterprise-screen.tsx`: idem, fluxo staff
- [ ] Modal de nova paciente: selecionar 3 profissionais da mesma especialidade → 1º vira titular, 2º e 3º viram backup
- [ ] Remover um backup (`remove-backup-professional-action.ts`) continua funcionando normalmente com múltiplos backups presentes

---

## Validation Commands

### Level 1: STATIC_ANALYSIS
```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo

### Level 2: DATABASE_VALIDATION
Usar Supabase MCP (ou `pnpm db:push` local) para confirmar:
- [ ] Constraint `team_members_patient_id_professional_type_is_backup_key` removida
- [ ] Índice `team_members_pregnancy_professional_type_primary_unique` criado
- [ ] Constraint `team_members_patient_id_professional_id_key` continua intacta

### Level 3: MANUAL_VALIDATION
Seguir o checklist de Edge Cases acima em ambiente de desenvolvimento, cobrindo os três fluxos: staff adicionando backup (`add-professional-to-team-action`), titular convidando backup (`add-backup-professional-action`), e criação de nova paciente com múltiplos profissionais da mesma especialidade (`new-patient-modal`).

---

## Acceptance Criteria

- [ ] Migration aplicada: só o titular é único por `(pregnancy_id, professional_type)`; backups ilimitados
- [ ] `pnpm db:types` executado e tipos regenerados
- [ ] `add-professional-to-team-action.ts` e `add-backup-professional-action.ts` não bloqueiam mais 2º+ backup, mas continuam bloqueando 2º titular
- [ ] `patient-team-screen.tsx` e `patient-team-enterprise-screen.tsx` renderizam lista de backups, botão sempre visível
- [ ] `new-patient-modal.tsx` permite selecionar múltiplos profissionais da mesma especialidade, só o 1º vira titular
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma regressão nos fluxos de titular único, remoção de backup, ou RLS

---

## Completion Checklist

- [ ] Todas as 9 tasks completadas em ordem
- [ ] Cada task validada imediatamente após a conclusão
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 2: constraints/índices confirmados no banco
- [ ] Level 3: checklist manual de edge cases percorrido
- [ ] Todos os critérios de aceite atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pacientes com múltiplas gestações históricas terem titulares "duplicados" ao trocar a constraint de `patient_id` para `pregnancy_id` | LOW | MEDIUM | O índice novo é por `pregnancy_id`, então cada gestação (ativa ou finalizada) mantém sua própria restrição de titular único — não há conflito entre gestações diferentes; validar com uma query manual pós-migration contando titulares por `(pregnancy_id, professional_type)` |
| Inconsistência entre "gestação mais recente" (usado antes em 2 actions) e "gestação ativa" (`has_finished=false`, usado em 1 action) causar `pregnancy_id` divergente entre titular e backup inseridos em momentos diferentes | MEDIUM | HIGH | Tasks 3 e 5 padronizam todas as actions para resolver sempre a gestação ativa, eliminando a divergência |
| UI quebrar o alinhamento visual do grid ao ter múltiplos backups por role | LOW | LOW | Task 6/7 recomenda empilhar backups na mesma coluna, mantendo grid 2 colunas (titular \| backups) |
| Rotas de convite (`team_invites`) ficarem com comportamento não relacionado a esta mudança | LOW | LOW | Documentado explicitamente em "NOT Building" — não fazem parte do fluxo de backup hoje |

---

## Notes

- A investigação prévia (codebase-explorer + codebase-analyst) confirmou que **não existem testes automatizados** em nenhuma parte do projeto — a validação desta feature depende de `pnpm check-types` + QA manual, replicando o padrão já usado no repositório.
- As rotas de convite (`apps/web/app/api/team/invites/*`) têm uma checagem de duplicidade pré-existente que não filtra por `is_backup` — é um comportamento independente desta mudança (elas só inserem titulares) e foi deixado fora de escopo para não introduzir mudanças não solicitadas.
- `remove-backup-professional-action.ts` não precisa de nenhuma alteração — sua lógica de permissão (staff remove qualquer backup; não-staff remove só backup da própria especialidade) já funciona corretamente com múltiplos backups, pois opera sobre `id` específico, não sobre suposição de unicidade.
