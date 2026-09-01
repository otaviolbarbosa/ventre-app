# Feature: Dinâmica Uterina — Fase 5: Toggle da Flag no Botão de Registro

## Summary

Alternar, sob o botão "Dinâmica Uterina" já existente em `birth-mode-register-buttons.tsx`, entre o modal antigo (`AddBirthContractionModal`) e o novo modal de registro em lote (`AddBirthUterineActivityModal`, Fase 4), controlado por `useFeatureFlagEnabled("show_uterine_activity")`. Este é o primeiro caso no codebase onde uma flag PostHog decide qual de dois componentes inteiros é montado, em vez de gatear um booleano/filtro — não há precedente estrutural a espelhar 1:1, mas o padrão de flag em si (`useFeatureFlagEnabled`, fail-closed) já existe.

## User Story

As a médica obstetra ou enfermeira obstétrica
I want to clicar no mesmo botão "Dinâmica Uterina" de sempre
So that eu veja automaticamente o modal novo ou antigo conforme a flag de rollout, sem precisar aprender uma nova localização de UI

## Problem Statement

`AddBirthUterineActivityModal` existe (Fase 4) mas não está conectado a lugar nenhum — profissionais não têm como acessá-lo, mesmo com a flag ativa.

## Solution Statement

Substituir o bloco único de `AddBirthContractionModal` (linhas 81-86 de `birth-mode-register-buttons.tsx`) por uma ternária controlada por `useFeatureFlagEnabled("show_uterine_activity")`, mantendo `activeModal === "contraction"` como o mesmo valor de estado para ambos — nenhuma mudança na grade de botões, no `BirthEventType`, ou em `BIRTH_EVENT_TYPES`/`BIRTH_EVENT_CONFIG` é necessária, já que os dois modais compartilham o contrato de props exato.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | LOW                                                                    |
| Systems Affected | `apps/web/src/components/shared/birth-mode-register-buttons.tsx`      |
| Dependencies     | Nenhuma nova — `posthog-js/react` já em uso                           |
| Estimated Tasks  | 1                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Botão "Dinâmica Uterina" ──► sempre abre AddBirthContractionModal        ║
║  (independente do valor da flag show_uterine_activity)                    ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Botão "Dinâmica Uterina" ──► useFeatureFlagEnabled("show_uterine_activity")║
║       flag ativa  ──► AddBirthUterineActivityModal (registro em lote)     ║
║       flag inativa ──► AddBirthContractionModal (comportamento atual)     ║
║                                                                             ║
║  VALUE_ADD: rollout controlado sem exigir nova navegação/botão            ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `birth-mode-register-buttons.tsx` | 1 modal fixo | 2 modais alternados por flag | Profissional migra sem perceber mudança de fluxo, só de formulário |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/components/shared/birth-mode-register-buttons.tsx` | full (81 linhas) | Local exato da troca — `activeModal` state, bloco `AddBirthContractionModal` (linhas 81-86) |
| P0 | `apps/web/src/hooks/use-birth-mode-status.ts` | 1-30 | Padrão de uso de `useFeatureFlagEnabled` neste codebase — import de `posthog-js/react`, coerção `!!flag`, fail-closed |
| P1 | `apps/web/src/modals/add-birth-uterine-activity-modal.tsx` | 26-31 (props) | Confirmar contrato de props idêntico ao `AddBirthContractionModal` |

**External Documentation:** Nenhuma — reuso de `posthog-js/react` já integrado.

---

## Patterns to Mirror

**FLAG_USAGE (fail-closed, sem estado de loading especial):**
```typescript
// SOURCE: apps/web/src/hooks/use-birth-mode-status.ts:7,23-24
import { useFeatureFlagEnabled } from "posthog-js/react";
// ...
const disableBirthModeForDoulas = useFeatureFlagEnabled("disable-birth-mode-for-doulas");
const birthModeDisabled = isDoula && !!disableBirthModeForDoulas;
```

**CURRENT_MODAL_BLOCK (a ser substituído):**
```tsx
// SOURCE: apps/web/src/components/shared/birth-mode-register-buttons.tsx:81-86
<AddBirthContractionModal
  open={activeModal === "contraction"}
  onOpenChange={(open) => setActiveModal(open ? "contraction" : null)}
  pregnancyId={pregnancyId}
  onSuccess={onSuccess}
/>
```

---

## Files to Change

| File                                                              | Action | Justification                                                        |
| -------------------------------------------------------------------| ------ | ---------------------------------------------------------------------|
| `apps/web/src/components/shared/birth-mode-register-buttons.tsx`  | UPDATE | Adicionar flag + ternária substituindo o bloco fixo do modal          |

---

## NOT Building (Scope Limits)

- **Novo `BirthEventType`/botão** — confirmado pela Fase 5 do PRD e pelo Decisions Log: o botão/tipo "contraction" é reaproveitado, sem novo item na grade.
- **Gating server-side/de rota** — decisão já registrada no PRD: apenas client-side, ambos os fluxos permanecem autorizados.
- **Estado de loading da flag** — seguindo o precedente único existente (`use-birth-mode-status.ts`), a flag é tratada como fail-closed (`undefined` durante bootstrap do PostHog = comportamento igual a "false", ou seja, mostra o modal antigo até a flag carregar).

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Estrutura da alternância | Ternária inline no local de renderização atual (`{flag ? <New/> : <Old/>}`) | Extrair um componente wrapper `UterineActivityRegisterModal` | Não há precedente de wrapper no codebase para esse tipo de troca (confirmado — nenhum outro lugar faz swap de 2 componentes inteiros); a ternária inline é consistente com o estilo do arquivo (tudo inline, sem extração) e é a mudança mínima |
| Nome da flag no código | `"show_uterine_activity"` (snake_case, igual ao nome definido no PRD) | `camelCase` ou outro nome | O PRD já fixa o nome exato da flag; PostHog flags são strings livres, não há convenção automática de case no codebase (`disable-birth-mode-for-doulas` usa kebab-case, `show-all-events-on-partograph-tab` também kebab-case) — **ATENÇÃO**: os 2 exemplos existentes no codebase usam kebab-case, não snake_case como o PRD especifica para esta flag. Manter `show_uterine_activity` (snake_case) exatamente como o PRD e as Fases 1-4 já a referenciam em comentários/testes, mas **sinalizar esta inconsistência de convenção como risco** — confirmar o nome exato configurado no painel do PostHog antes do rollout |

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/components/shared/birth-mode-register-buttons.tsx`

- **ACTION**: Adicionar a flag e substituir o bloco fixo do modal de contração por uma ternária
- **IMPLEMENT**:
  ```tsx
  // Adicionar ao import existente de "@/modals/add-birth-contraction-modal":
  import { AddBirthUterineActivityModal } from "@/modals/add-birth-uterine-activity-modal";
  // Adicionar import:
  import { useFeatureFlagEnabled } from "posthog-js/react";

  // Dentro do componente, junto às outras declarações no topo:
  const showUterineActivity = useFeatureFlagEnabled("show_uterine_activity");

  // Substituir o bloco atual (linhas 81-86):
  {showUterineActivity ? (
    <AddBirthUterineActivityModal
      open={activeModal === "contraction"}
      onOpenChange={(open) => setActiveModal(open ? "contraction" : null)}
      pregnancyId={pregnancyId}
      onSuccess={onSuccess}
    />
  ) : (
    <AddBirthContractionModal
      open={activeModal === "contraction"}
      onOpenChange={(open) => setActiveModal(open ? "contraction" : null)}
      pregnancyId={pregnancyId}
      onSuccess={onSuccess}
    />
  )}
  ```
- **MIRROR**: `apps/web/src/hooks/use-birth-mode-status.ts:7,23-24` (import e uso da flag)
- **GOTCHA**: `activeModal === "contraction"` continua sendo o valor usado por AMBOS os ramos — não criar um novo valor de `activeModal` para o modal novo, ou o botão da grade (que só conhece `"contraction"`) nunca vai abrir o modal correto
- **GOTCHA**: confirmar o nome exato da flag no painel do PostHog antes de mesclar — ver Decisions Log sobre inconsistência de case (`show_uterine_activity` vs. o kebab-case usado pelas 2 flags existentes no codebase)
- **VALIDATE**: `cd apps/web && pnpm exec tsc --noEmit` (deve passar limpo — dependência de resolver já corrigida na Fase 4)

---

## Testing Strategy

Nenhum teste automatizado — componente React, sem precedente de teste no repo (mesma lacuna documentada nas Fases 2-4).

### Edge Cases Checklist (validação manual)

- [ ] Com a flag desativada (ou ainda carregando): clicar em "Dinâmica Uterina" abre `AddBirthContractionModal` (comportamento atual, inalterado)
- [ ] Com a flag ativada: clicar em "Dinâmica Uterina" abre `AddBirthUterineActivityModal`
- [ ] Alternar a flag (via PostHog feature flag override local, se disponível) e confirmar que o modal correto abre sem exigir reload da página
- [ ] Confirmar que nenhum novo botão aparece na grade — apenas o botão "Dinâmica Uterina" já existente

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
cd apps/web && pnpm exec tsc --noEmit
pnpm exec biome check apps/web/src/components/shared/birth-mode-register-buttons.tsx
```

**EXPECT**: Exit 0 em ambos.

### Level 5: BROWSER_VALIDATION

Testar em ambiente de desenvolvimento com Modo Parto ativo em uma gestação de teste, usando o override local de feature flags do PostHog (`posthog.featureFlags.override({...})` no console do browser, ou o painel de debug do PostHog se configurado) para alternar `show_uterine_activity` sem esperar rollout real.

---

## Acceptance Criteria

- [ ] Flag `show_uterine_activity` controla qual modal abre sob o botão "Dinâmica Uterina"
- [ ] Nenhuma mudança visual na grade de botões (mesmo label, mesmo ícone, mesma posição)
- [ ] `tsc --noEmit` e `biome check` passam sem erros
- [ ] Validação manual confirma ambos os caminhos (flag ativa/inativa)

---

## Completion Checklist

- [ ] Task 1 completa e validada
- [ ] Level 1 passa
- [ ] Level 5 validado manualmente com override de flag
- [ ] Acceptance criteria atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | ---------------------------------------- |
| Nome da flag no painel do PostHog pode ter sido criado com convenção kebab-case (como as 2 flags existentes) em vez de snake_case como escrito no PRD | M | H | Confirmar o nome exato no painel do PostHog antes de mesclar — se divergente, ajustar a string no código para bater exatamente (case-sensitive) |
| `useFeatureFlagEnabled` retorna `undefined` durante o bootstrap do PostHog, mostrando brevemente o modal antigo mesmo com a flag ativa | L | L | Comportamento consistente com o único precedente do codebase (fail-closed); aceitável dado que o modal só é montado ao clicar no botão, não no carregamento da página |

---

## Notes

- Esta é a fase mais simples da feature (1 arquivo, poucas linhas) — o trabalho pesado já foi feito nas Fases 1-4.
- Depois desta fase, atualizar a tabela de fases do PRD: Status da Fase 5 → `complete`, campo PRP Plan apontando para este arquivo.
