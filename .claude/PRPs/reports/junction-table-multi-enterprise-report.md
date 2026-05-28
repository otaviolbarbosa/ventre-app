# Implementation Report

**Plan**: `.claude/PRPs/plans/junction-table-multi-enterprise.plan.md`
**Branch**: `feature/junction-table-multi-enterprise`
**Date**: 2026-05-27
**Status**: COMPLETE

---

## Summary

Implementada a junction table `user_enterprises` para permitir que profissionais pertençam a múltiplas empresas. Adicionadas colunas `enterprise_id` em `pregnancies`, `billings` e `appointments`. Funções helper de RLS reescritas para usar as novas âncoras. Services e actions atualizados para usar `user_enterprises` em vez de `users.enterprise_id` ao buscar profissionais de uma empresa.

---

## Assessment vs Reality

| Metric     | Predicted | Actual | Reasoning |
| ---------- | --------- | ------ | --------- |
| Complexity | HIGH      | HIGH   | 5 migrations + 11 arquivos TS alterados; descoberta de bug no SQL do plano confirmou complexidade |
| Confidence | 8/10      | 8/10   | Root cause correto; um bug de SQL encontrado e corrigido durante execução |

**Desvios do plano:**

1. **Bug no backfill de appointments (migration 3)**: O plano usava `JOIN ... ON tm.patient_id = a.patient_id` que falha porque PostgreSQL não permite referenciar a tabela sendo atualizada por alias em ON de JOIN. Corrigido para usar `FROM tabela1, tabela2 WHERE condições`.
2. **`getEnterpriseBillings` removeu dependência de `supabase` (anon)**: Como a nova query vai direto em `billings.enterprise_id` com `supabaseAdmin`, a variável `supabase` deixou de ser necessária nessa função — mais seguro.
3. **`home-enterprise.ts` usa `supabaseAdmin` para buscar `user_enterprises`**: O plano sugeria usar `supabase` anon, mas como a função já tinha `supabaseAdmin` disponível e user_enterprises requer acesso via service_role para cross-user reads, usamos admin.

---

## Tasks Completed

| # | Task | File | Status |
| - | ---- | ---- | ------ |
| 1 | CREATE migration `user_enterprises` | `migrations/20260527000001_user_enterprises_junction_table.sql` | ✅ |
| 2 | CREATE migration `pregnancies.enterprise_id` | `migrations/20260527000002_pregnancies_enterprise_id.sql` | ✅ |
| 3 | CREATE migration `billings`+`appointments enterprise_id` | `migrations/20260527000003_billings_appointments_enterprise_id.sql` | ✅ (com fix SQL) |
| 4 | CREATE migration helper functions rewrite | `migrations/20260527000004_rewrite_rls_helper_functions.sql` | ✅ |
| 5 | CREATE migration policies billings/appointments | `migrations/20260527000005_update_billings_appointments_policies.sql` | ✅ |
| 6 | `pnpm db:types` + fix linha 1 do arquivo gerado | `packages/supabase/src/types/database.types.ts` | ✅ |
| 7 | UPDATE `join-enterprise-action.ts` | `apps/web/src/actions/join-enterprise-action.ts` | ✅ |
| 8 | UPDATE `complete-registration-action.ts` | `apps/web/src/actions/complete-registration-action.ts` | ✅ |
| 9a | UPDATE `add-enterprise-professional-action.ts` | `apps/web/src/actions/add-enterprise-professional-action.ts` | ✅ |
| 9b | UPDATE `remove-enterprise-professional-action.ts` | `apps/web/src/actions/remove-enterprise-professional-action.ts` | ✅ |
| 10a | UPDATE `services/billing.ts` (`getEnterpriseBillings`) | `apps/web/src/services/billing.ts` | ✅ |
| 10b | UPDATE `services/home-enterprise.ts` | `apps/web/src/services/home-enterprise.ts` | ✅ |
| 10c | UPDATE `services/enterprise-home-patients-cache.ts` | `apps/web/src/services/enterprise-home-patients-cache.ts` | ✅ |
| 10d | UPDATE `services/professional.ts` | `apps/web/src/services/professional.ts` | ✅ |
| 10e | UPDATE `services/enterprise-users.ts` | `apps/web/src/services/enterprise-users.ts` | ✅ |
| 11a | UPDATE `add-billing-action.ts` + `createBilling` | `apps/web/src/actions/add-billing-action.ts` + `services/billing.ts` | ✅ |
| 11b | UPDATE `add-appointment-action.ts` + `createAppointment` | `apps/web/src/actions/add-appointment-action.ts` + `services/appointment.ts` | ✅ |

---

## Validation Results

| Check | Result | Details |
| ----- | ------ | ------- |
| `pnpm db:push` | ✅ | Todas as 5 migrations aplicadas (migration 3 requereu fix SQL primeiro) |
| `pnpm db:types` | ✅ | Tipos regenerados; linha de log removida do arquivo gerado |
| `pnpm check-types` | ✅ | 4 packages passaram, 0 erros |
| Biome lint | ✅ | Sem issues em todos os arquivos modificados |

---

## Files Changed

| File | Action | Notes |
| ---- | ------ | ----- |
| `migrations/20260527000001_user_enterprises_junction_table.sql` | CREATE | Junction table + RLS + backfill + zera professionals |
| `migrations/20260527000002_pregnancies_enterprise_id.sql` | CREATE | Coluna + backfill via created_by |
| `migrations/20260527000003_billings_appointments_enterprise_id.sql` | CREATE | Colunas + backfill corrigido |
| `migrations/20260527000004_rewrite_rls_helper_functions.sql` | CREATE | is_same_enterprise + is_enterprise_patient reescritas |
| `migrations/20260527000005_update_billings_appointments_policies.sql` | CREATE | Policies por enterprise_id direto |
| `packages/supabase/src/types/database.types.ts` | UPDATE | Regenerado + linha 1 de log removida |
| `apps/web/src/actions/join-enterprise-action.ts` | UPDATE | INSERT user_enterprises para professional, UPDATE users para staff |
| `apps/web/src/actions/complete-registration-action.ts` | UPDATE | INSERT user_enterprises, não seta users.enterprise_id |
| `apps/web/src/actions/add-enterprise-professional-action.ts` | UPDATE | Sem guard single-enterprise; INSERT user_enterprises; trata 23505 |
| `apps/web/src/actions/remove-enterprise-professional-action.ts` | UPDATE | DELETE user_enterprises em vez de UPDATE users |
| `apps/web/src/actions/add-billing-action.ts` | UPDATE | enterprise_id derivado da gestação se profile.enterprise_id = null |
| `apps/web/src/actions/add-appointment-action.ts` | UPDATE | enterprise_id derivado da gestação se profile.enterprise_id = null |
| `apps/web/src/services/billing.ts` | UPDATE | getEnterpriseBillings via enterprise_id direto; createBilling aceita enterpriseId |
| `apps/web/src/services/home-enterprise.ts` | UPDATE | user_enterprises em vez de users.enterprise_id para profissionais |
| `apps/web/src/services/enterprise-home-patients-cache.ts` | UPDATE | user_enterprises em vez de users.enterprise_id |
| `apps/web/src/services/professional.ts` | UPDATE | user_enterprises em vez de users.enterprise_id |
| `apps/web/src/services/enterprise-users.ts` | UPDATE | user_enterprises para profissionais; staff mantém via users.enterprise_id |
| `apps/web/src/services/appointment.ts` | UPDATE | createAppointment aceita enterpriseId opcional |

---

## Deviations from Plan

1. **SQL bug em migration 3**: `JOIN ... ON ... = a.patient_id` inválido no PostgreSQL para UPDATE. Corrigido com vírgula na cláusula FROM e condições no WHERE.
2. **`billing.ts` sem `supabase` anon**: `getEnterpriseBillings` passou a usar apenas `supabaseAdmin` (mais seguro); variável `supabase` removida da função.
3. **`home-enterprise.ts` usa `supabaseAdmin`** para buscar `user_enterprises` (já disponível no escopo).
4. **`appointment.ts` atualizado** (não estava explicitamente no plano, mas necessário para passar `enterprise_id` ao criar agendamentos).

---

## Issues Encountered

1. **Migration 3 falhou na primeira tentativa** (erro PostgreSQL 42P01) — JOIN inválido corrigido antes do segundo `db:push`.
2. **`database.types.ts` gerado com linha de log na linha 1** — removida manualmente (artefato do script `with-env.cjs`).

---

## Next Steps

- [ ] Verificar backfill via SQL: `SELECT COUNT(*), COUNT(enterprise_id) FROM pregnancies;`
- [ ] Testar manualmente: adicionar profissional que já é de outra empresa
- [ ] Testar manualmente: home enterprise mostra pacientes corretos
- [ ] Criar PR: `gh pr create` ou `/prp-pr`
- [ ] Tasks futuras (fora deste escopo): UI para profissional escolher empresa por gestação, migrar `add-new-professional-action.ts`
