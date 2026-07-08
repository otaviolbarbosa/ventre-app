# Implementation Report

**Plan**: `.claude/PRPs/plans/contract-signature-phase-1-core.plan.md`
**Source PRD**: `.claude/PRPs/prds/contract-signature.prd.md` (Phase 1 of 3)
**Branch**: `dev`
**Date**: 2026-07-06
**Status**: PARTIAL — code complete; DB application pending user approval

---

## Summary

Núcleo da assinatura eletrônica de contratos: modal de consentimento obrigatório →
`signPatientContractAction` (upsert do conteúdo, render do PDF final, SHA-256 do buffer,
código de verificação único de 10 chars, upload imutável em `patient_documents`, carimbo
dos campos de assinatura em `contracts` com IP/user-agent). Migration com colunas, índice
único parcial, triggers de imutabilidade e políticas RLS atualizadas. UI esconde "Editar
contrato" pós-assinatura, exibe badge com data + código, e o download reutiliza sempre o
PDF assinado (nunca re-renderiza). `savePatientContractAction` removida (lógica absorvida
por helper compartilhado + sign action).

---

## Assessment vs Reality

| Metric     | Predicted   | Actual      | Reasoning |
| ---------- | ----------- | ----------- | --------- |
| Complexity | MEDIUM-HIGH | MEDIUM-HIGH | Padrões extraídos de código real; nenhuma surpresa estrutural |
| Confidence | 8/10        | 8/10        | Única incerteza prevista (typing do helper) resolvida com `ProfileWithEnterprise` + `Awaited<ReturnType<...>>` dos clients |

**Deviation obrigatória**: `pnpm db:push` foi bloqueado pelo modo de permissão da sessão
(mudança de schema no banco remoto exige aprovação do usuário). Os tipos em
`database.types.ts` foram atualizados manualmente no formato exato do gerador; após rodar
`pnpm db:push && pnpm db:types`, o arquivo deve ficar idêntico (validar com `git diff`).

---

## Tasks Completed

| #  | Task | File | Status |
| -- | ---- | ---- | ------ |
| 1  | Migration (colunas, índice, triggers, policies) | `packages/supabase/supabase/migrations/20260706000001_contract_signature.sql` | ✅ criada (⏳ não aplicada) |
| 1b | Tipos regenerados | `packages/supabase/src/types/database.types.ts` | ✅ (manual, conferir pós-`db:types`) |
| 2  | `signPatientContractSchema` | `apps/web/src/lib/validations/contract.ts` | ✅ |
| 3  | Helper `buildPatientContractParties` | `apps/web/src/lib/contract-parties.ts` | ✅ |
| 4  | Helpers de PDF (sanitize/render/filename/upload) | `apps/web/src/lib/contract-pdf.ts` | ✅ |
| 5  | `generateVerificationCode` (randomInt, sem 0/O/1/I) | `apps/web/src/lib/verification-code.ts` | ✅ |
| 6  | `signPatientContractAction` (hash, código c/ retry 23505, compensação) | `apps/web/src/actions/sign-patient-contract-action.ts` | ✅ |
| 7  | Rota PDF: short-circuit p/ PDF assinado + helpers | `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | ✅ |
| 8  | UI: modal de consentimento, badge, esconder editar, download reuso | `apps/web/src/components/shared/patient-contract.tsx` | ✅ |
| 8b | DELETE `save-patient-contract-action.ts` (sem refs órfãs) | — | ✅ |
| 9  | Guard de doc imutável | `apps/web/src/actions/delete-document-action.ts` | ✅ |
| 10 | Validação completa | — | ✅ estática / ⏳ DB + browser |

---

## Validation Results

| Check | Result | Details |
| ----- | ------ | ------- |
| Type check | ✅ | `pnpm check-types` — 4/4 pacotes ok |
| Lint | ✅ | `npx biome check apps/web` — 0 issues |
| Unit tests | ⏭️ | Sem framework de testes no repo (consistente com as 5 fases anteriores) |
| Build | ⏭️ | Não incluído nos Validation Commands do plano |
| DB push + SQL assertions | ⏳ | Bloqueado pela permissão da sessão — pendente (ver Next Steps) |
| Browser flow | ⏳ | Depende da migration aplicada |

---

## Files Changed

| File | Action | Lines |
| ---- | ------ | ----- |
| `packages/supabase/supabase/migrations/20260706000001_contract_signature.sql` | CREATE | +88 |
| `packages/supabase/src/types/database.types.ts` | UPDATE | +58 |
| `apps/web/src/lib/validations/contract.ts` | UPDATE | +9 |
| `apps/web/src/lib/contract-parties.ts` | CREATE | +88 |
| `apps/web/src/lib/contract-pdf.ts` | CREATE | +95 |
| `apps/web/src/lib/verification-code.ts` | CREATE | +13 |
| `apps/web/src/actions/sign-patient-contract-action.ts` | CREATE | +142 |
| `apps/web/src/actions/save-patient-contract-action.ts` | DELETE | -113 |
| `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | UPDATE | +46/-56 |
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | +130/-30 |
| `apps/web/src/actions/delete-document-action.ts` | UPDATE | +7/-1 |
| `apps/web/src/actions/get-patient-contract-action.ts` | UPDATE | comment fix |

---

## Deviations from Plan

1. **`pnpm db:push` não executado** — bloqueado pelo classificador de permissões
   (schema change no Supabase remoto exige aprovação). `database.types.ts` editado à mão
   espelhando o output do gerador. Pendências do usuário listadas em Next Steps.
2. Nenhuma outra deviation — implementação seguiu o plano.

---

## Issues Encountered

- Apenas o bloqueio de permissão do `db:push` (acima). Nenhum erro de tipo ou lint.

---

## Tests Written

Nenhum — repo sem framework de testes (validação = types + Biome + SQL assertions + browser, conforme Testing Strategy do plano).

---

## Next Steps

- [ ] **Usuário**: `pnpm db:push && pnpm db:types && pnpm check-types` — aplicar migration e confirmar que `database.types.ts` não drifta (git diff deve ficar vazio)
- [ ] SQL assertions (Supabase MCP `execute_sql`, após haver contrato assinado):
  - `UPDATE contracts SET clauses_html = 'x' WHERE is_signed = true` → deve RAISE
  - `UPDATE contracts SET is_active = false WHERE is_signed = true` → deve passar
  - `DELETE FROM patient_documents WHERE is_immutable = true` → deve RAISE
  - Confirmar `idx_contracts_verification_code`
- [ ] Fluxo manual no browser (Validation Commands item 4 do plano)
- [ ] Review + PR
- [ ] Fases 2 (selo) e 3 (verificação pública) podem rodar em paralelo: `/prp-plan .claude/PRPs/prds/contract-signature.prd.md`
