# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/patient-contract-signature-phase-1-data-model.plan.md`
**Source PRD**: `.claude/PRPs/prds/patient-contract-signature.prd.md` (Phase 1)
**Branch**: `feature/patient-contract-signature-phase-1`
**Date**: 2026-08-14
**Status**: COMPLETE

---

## Summary

Introduzida a tabela filha `contract_signatures` (uma linha por papel: `professional` | `patient`)
e a coluna `contracts.fully_signed_at`, com um trigger de conclusão que a seta apenas quando
ambos os papéis assinaram. O trigger de imutabilidade existente foi estendido (união, não
substituição) para também travar em `fully_signed_at`, RLS de leitura foi concedida à gestante
no próprio contrato, dados históricos foram migrados (backfill), e a ação de assinatura da
profissional agora grava também na tabela nova.

---

## Assessment vs Reality

| Metric     | Predicted | Actual   | Reasoning                                                                      |
| ---------- | --------- | -------- | ------------------------------------------------------------------------------ |
| Complexity | HIGH      | HIGH     | Confirmado — o trigger de imutabilidade precisou de uma correção não prevista no plano (ver Deviations) |
| Confidence | 7/10      | —        | O ponto de menor confiança apontado no plano (backfill/trigger) foi exatamente onde um bug real apareceu, capturado pelo próprio `pnpm db:push` |

**Deviação do plano**: durante `pnpm db:push`, a migration de backfill (Task 5) falhou com
`Contrato assinado é imutável e não pode ser alterado`. Causa raiz: a condição `WHEN (OLD.is_signed
= true OR OLD.fully_signed_at IS NOT NULL)` do trigger reescrito na Task 4 já dispara para
qualquer contrato com `is_signed = true` — e como `fully_signed_at` estava na lista de colunas
protegidas incondicionalmente, a própria transição `NULL → valor` (necessária tanto para o
backfill quanto para o futuro trigger de conclusão da Fase 2) ficava bloqueada. Corrigido
alterando a condição de proteção de `fully_signed_at` para
`(OLD.fully_signed_at IS NOT NULL AND OLD.fully_signed_at IS DISTINCT FROM NEW.fully_signed_at)`
— ou seja, só bloqueia mudanças **depois** que já foi setada, permitindo a transição única
`NULL → valor`. A correção foi feita revertendo o registro da migration 4 via
`supabase migration repair --status reverted`, editando o arquivo, e reaplicando (nenhuma
migration nova foi adicionada — o arquivo da Task 4 já reflete a versão corrigida).

---

## Tasks Completed

| #   | Task                                                                 | File                                                                                       | Status |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| 1   | CREATE coluna `contracts.fully_signed_at`                            | `packages/supabase/supabase/migrations/20260814000001_contracts_add_fully_signed_at.sql`   | ✅     |
| 2   | CREATE tabela `contract_signatures` + RLS + triggers de imutabilidade | `packages/supabase/supabase/migrations/20260814000002_create_contract_signatures_table.sql`| ✅     |
| 3   | CREATE trigger de conclusão (`AFTER INSERT`)                          | `packages/supabase/supabase/migrations/20260814000003_contract_signatures_completion_trigger.sql` | ✅ |
| 4   | Reescrever trigger de imutabilidade + RLS de leitura da gestante      | `packages/supabase/supabase/migrations/20260814000004_contracts_rewrite_immutability_and_patient_rls.sql` | ✅ (corrigido após falha inicial) |
| 5   | Backfill de assinaturas históricas                                    | `packages/supabase/supabase/migrations/20260814000005_backfill_contract_signatures.sql`    | ✅     |
| 6   | Regenerar tipos TS                                                     | `packages/supabase/src/types/database.types.ts`                                             | ✅     |
| 7   | Gravar linha em `contract_signatures` ao assinar (profissional)       | `apps/web/src/actions/sign-patient-contract-action.ts`                                      | ✅     |
| 8   | Validação end-to-end                                                  | N/A (SQL manual)                                                                             | ✅     |

---

## Validation Results

| Check       | Result | Details                                                                 |
| ----------- | ------ | ------------------------------------------------------------------------ |
| Type check  | ✅     | `pnpm check-types` — 5/5 pacotes, sem erros                              |
| Lint        | ✅     | `npx biome check` no arquivo modificado — sem issues                     |
| Migrations  | ✅     | `pnpm db:push` — 5/5 migrations aplicadas (após correção da Task 4)      |
| Types gerados | ✅   | `pnpm db:types` — `contract_signatures` e `fully_signed_at` presentes    |
| Backfill    | ✅     | 0 contratos com `is_signed=true` e `fully_signed_at IS NULL`; 35/35 assinaturas migradas |
| Testes SQL (transação com ROLLBACK) | ✅ | Ver seção "Tests Written" abaixo |
| Build/test suite | ⏭️ | Não há suíte de testes automatizados de banco no repositório para migrations (confirmado no plano) |

---

## Files Changed

| File                                                                                          | Action | Lines     |
| ------------------------------------------------------------------------------------------------ | ------ | --------- |
| `packages/supabase/supabase/migrations/20260814000001_contracts_add_fully_signed_at.sql`         | CREATE | +6        |
| `packages/supabase/supabase/migrations/20260814000002_create_contract_signatures_table.sql`      | CREATE | +50       |
| `packages/supabase/supabase/migrations/20260814000003_contract_signatures_completion_trigger.sql`| CREATE | +30       |
| `packages/supabase/supabase/migrations/20260814000004_contracts_rewrite_immutability_and_patient_rls.sql` | CREATE | +48 |
| `packages/supabase/supabase/migrations/20260814000005_backfill_contract_signatures.sql`          | CREATE | +12       |
| `packages/supabase/src/types/database.types.ts`                                                  | UPDATE (gerado) | regenerado |
| `apps/web/src/actions/sign-patient-contract-action.ts`                                           | UPDATE | +17       |

---

## Deviations from Plan

- Correção do trigger de imutabilidade (Task 4) descrita acima em "Assessment vs Reality" — bug
  real capturado pela própria validação de `pnpm db:push`, corrigido no mesmo arquivo antes de
  seguir adiante (nenhuma migration extra criada).

---

## Issues Encountered

1. **RLS pré-existente quebrada, fora do escopo desta fase** (achado durante a validação, não
   introduzido por esta implementação): a policy `"View contracts"` tem um branch para leitura de
   `is_base_contract = true` por membros de uma empresa, que referencia `users.enterprise_id` —
   **essa coluna não existe** na tabela `users` (`information_schema.columns` confirma). A coluna
   real que modela essa relação é `user_enterprises.enterprise_id` (tabela de junção). Esse branch
   da policy já estava assim antes desta fase (herdado de
   `20260630000002_contracts_enterprise_member_read.sql`, migration de 2026-06-30) — Task 4 apenas
   copiou o predicado existente ao lado do novo branch da gestante, sem alterá-lo, conforme o
   escopo definido no plano ("Files to Change" não incluía essa lógica). **Recomendo abrir um item
   separado para corrigir esse branch** (provavelmente trocar por
   `EXISTS (SELECT 1 FROM user_enterprises WHERE user_enterprises.user_id = auth.uid() AND user_enterprises.enterprise_id = contracts.enterprise_id)`),
   já que hoje o comportamento efetivo desse branch é degenerado (referência de coluna inexistente
   força a resolução para a tabela externa `contracts`), não é algo que se deva investigar/corrigir
   silenciosamente dentro desta fase.

---

## Tests Written

Não há suíte de testes automatizados de banco no repositório (confirmado no plano). Validação
feita via SQL manual, dentro de uma transação `BEGIN ... ROLLBACK` (nenhum dado de teste
persistido), usando IDs reais de paciente/profissional/gestante já existentes para satisfazer FKs:

| Cenário                                                                 | Resultado |
| -------------------------------------------------------------------------| --------- |
| `fully_signed_at` continua `NULL` após só uma assinatura (`professional`) | ✅ |
| `fully_signed_at` é setado após a segunda assinatura (`patient`)          | ✅ |
| Constraint única `(contract_id, signer_role)` bloqueia duplicata          | ✅ |
| `UPDATE` em linha de `contract_signatures` já existente é bloqueado       | ✅ |
| `UPDATE fully_signed_at` é bloqueado depois de já setado                  | ✅ |
| `UPDATE clauses_html` em contrato real já assinado continua bloqueado (sem regressão) | ✅ |
| `UPDATE is_active` em contrato assinado continua permitido (soft-delete)  | ✅ |
| Policy `"View contracts"` inclui o branch `patients.user_id = auth.uid()` (inspeção do texto da policy via `pg_get_expr`) | ✅ |

---

## Next Steps

- [ ] Revisar a implementação
- [ ] Abrir issue/task separada para o branch quebrado de RLS de empresa em `"View contracts"` (achado em "Issues Encountered")
- [ ] Criar PR: `gh pr create` (aguardando confirmação do usuário antes de abrir/pushar)
- [ ] Merge quando aprovado
- [ ] Continuar com as Fases 2 e 3 do PRD (podem rodar em paralelo, ambas dependem só desta fase)
