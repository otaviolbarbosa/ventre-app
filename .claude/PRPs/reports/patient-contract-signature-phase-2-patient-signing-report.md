# Implementation Report

**Plan**: `.claude/PRPs/plans/completed/patient-contract-signature-phase-2-patient-signing.plan.md`
**Source PRD**: `.claude/PRPs/prds/patient-contract-signature.prd.md` (Phase 2)
**Branch**: `feature/patient-contract-signature-phase-1` (continuação — nenhuma migration nesta fase, código de aplicação empilhado sobre a Fase 1 ainda não commitada)
**Date**: 2026-08-14
**Status**: COMPLETE

---

## Summary

Adicionada autorização (`isStaff`/`patients.created_by`) e o gate de `[não informado]` na ação
de assinatura já existente da profissional, e criada uma nova ação
`signContractAsPatientAction` para a gestante assinar, reaproveitando a trilha de auditoria
(`contract_signatures`) sem regenerar o PDF. Nenhuma migration foi necessária — schema da Fase
1 já cobria tudo.

---

## Assessment vs Reality

| Metric     | Predicted | Actual   | Reasoning                                                                      |
| ---------- | --------- | -------- | ------------------------------------------------------------------------------ |
| Complexity | MEDIUM    | MEDIUM   | Confirmado — implementação seguiu o plano quase à risca, sem descobertas que mudassem o desenho |
| Confidence | 8/10      | —        | Nenhum bug de lógica encontrado durante a implementação (diferente da Fase 1); único ajuste foi cosmético (import order/formatação via `biome check --write`) |

**Nenhuma deviação de lógica do plano.** Único ajuste: ordem de imports e uma linha de
formatação foram corrigidas automaticamente pelo `biome check --write` (import sorting em 3
arquivos, quebra de linha em `sign-contract-as-patient-action.ts`) — cosmético, sem mudança de
comportamento.

---

## Tasks Completed

| #   | Task                                                                 | File                                                                       | Status |
| --- | ----------------------------------------------------------------------| -----------------------------------------------------------------------     | ------ |
| 1   | Exportar `NAO_INFORMADO` + `hasUnfilledFields()`                      | `apps/web/src/lib/contract-header-text.ts`                                 | ✅     |
| 2   | Adicionar `signContractAsPatientSchema`                                | `apps/web/src/lib/validations/contract.ts`                                 | ✅     |
| 3   | Autorização do lado CONTRATADA (isStaff / created_by)                 | `apps/web/src/actions/sign-patient-contract-action.ts`                     | ✅     |
| 4   | Gate de `[não informado]` na ação da profissional                     | `apps/web/src/actions/sign-patient-contract-action.ts`                     | ✅     |
| 5   | Nova ação `signContractAsPatientAction`                                | `apps/web/src/actions/sign-contract-as-patient-action.ts`                  | ✅     |
| 6   | Validação end-to-end                                                   | N/A (SQL + revisão de código)                                              | ✅     |

---

## Validation Results

| Check       | Result | Details                                                                 |
| ----------- | ------ | ------------------------------------------------------------------------ |
| Type check  | ✅     | `pnpm check-types` — 5/5 pacotes, sem erros                              |
| Lint        | ✅     | `biome check` nos 4 arquivos alterados — 0 issues após autofix de import order/formatação |
| Testes SQL (transação com ROLLBACK) | ✅ | Ver seção "Tests Written" abaixo |
| Invocação real das actions (via UI/dev server, autenticado como cada papel) | ⏭️ | Não executável neste ambiente (sem sessão autenticada por papel) — recomendado como último passo manual antes do merge, ver "Next Steps" |

---

## Files Changed

| File                                                                | Action | Lines     |
| ------------------------------------------------------------------- | ------ | --------- |
| `apps/web/src/lib/contract-header-text.ts`                          | UPDATE | +8/-1     |
| `apps/web/src/lib/validations/contract.ts`                          | UPDATE | +8        |
| `apps/web/src/actions/sign-patient-contract-action.ts`               | UPDATE | +17       |
| `apps/web/src/actions/sign-contract-as-patient-action.ts`            | CREATE | +75       |

---

## Deviations from Plan

- Nenhuma deviação funcional. `na` foi mantido como alias local de `NAO_INFORMADO` em vez de
  substituir todas as ~15 ocorrências internas por `NAO_INFORMADO` diretamente (o plano sugeria
  renomear todos os usos) — decisão de reduzir o diff sem duplicar a constante (mesma fonte de
  verdade), funcionalmente idêntico.

---

## Issues Encountered

Nenhum. Diferente da Fase 1 (onde a validação via `pnpm db:push` capturou um bug real de
trigger), esta fase não tem migrations e nenhum problema surgiu durante `check-types`/lint.

---

## Tests Written

Não há suíte de testes automatizados no repositório para server actions (confirmado na Fase 1).
Validação feita via:

1. `pnpm check-types` (5/5 pacotes) e `biome check` (0 issues) — Level 1/2 do plano.
2. Consulta SQL confirmando os dados reais de autorização se alinham com a lógica implementada:
   - Profissional `441032b3...` (sem `enterprise_id`, membro de equipe mas não `created_by` da
     paciente `11e5bc73...`) seria corretamente **bloqueada** pela nova checagem.
   - Gestora `617a61a0...` (vinculada à empresa `216c1405...`, `user_type='manager'`) seria
     corretamente **autorizada** pela checagem `isStaff`.
3. Teste SQL dentro de transação com `ROLLBACK` (nenhum dado persistido) simulando a sequência
   exata de queries da nova ação contra um contrato real já assinado pela profissional:
   - Segunda assinatura do mesmo papel (`patient`) é bloqueada pela constraint única
     `(contract_id, signer_role)` — confirma que o pré-check `alreadySigned` da ação tem a
     constraint do banco como rede de segurança.
   - `fully_signed_at` permanece estável (idempotente) para um contrato já totalmente assinado
     via backfill da Fase 1 — sem regressão.

---

## Next Steps

- [ ] Revisar a implementação
- [ ] **Validação manual recomendada antes do merge**: rodar `pnpm dev` e invocar as duas ações
      (`signPatientContractAction` autorização/gate; `signContractAsPatientAction` completa) via
      UI/chamada direta, autenticado como cada papel (profissional não-staff, gestora, gestante
      dona do contrato, outro usuário) — não executável de forma automatizada neste ambiente.
- [ ] Decidir sobre commit/PR (Fase 1 ainda não foi commitada nesta branch)
- [ ] Continuar com a Fase 3 (Solicitar alteração) — pode rodar em paralelo, não compartilha
      arquivos com esta fase
