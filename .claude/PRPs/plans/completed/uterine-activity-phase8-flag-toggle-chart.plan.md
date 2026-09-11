# Feature: Dinâmica Uterina — Fase 8: Toggle da Flag no Gráfico

## Summary

Alternar, no local onde o gráfico de dinâmica uterina é renderizado dentro da tela de partograma (`birth-mode-partograph.tsx`, `case "contraction"`), entre o gráfico de linha atual (`BirthModeContractionChart`, Chart.js) e a nova matriz (`BirthModeUterineActivityChart`, Fase 7), controlado pela MESMA flag `show_uterine_activity` já usada na Fase 5. Estrutura idêntica à Fase 5 — mesmo padrão de ternária, mesma flag, local de troca diferente.

## User Story

As a médica obstetra ou enfermeira obstétrica
I want to ver o gráfico no formato de matriz que já reconheço, na mesma aba de partograma de sempre
So that a transição para o novo fluxo seja completa e consistente — registro em lote E visualização em matriz juntos, não um sem o outro

## Problem Statement

Mesmo com a Fase 5 (modal) e a Fase 7 (componente de matriz) prontos, a tela de partograma continua mostrando o gráfico de linha antigo para TODOS os usuários — a matriz nova nunca é exibida, mesmo com a flag ativa e dados de `birth_uterine_activity` já sendo coletados.

## Solution Statement

Substituir o `case "contraction": return <BirthModeContractionChart events={events} />;` em `birth-mode-partograph.tsx` por uma ternária usando `useFeatureFlagEnabled("show_uterine_activity")`, análoga à troca de modal da Fase 5. Nenhuma mudança em `BIRTH_PARTOGRAPH_SESSIONS` (o array de configuração de abas/sessões) é necessária — a troca acontece dentro do mesmo `case`, sob a mesma aba "Dinâmica Uterina".

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | LOW                                                                    |
| Systems Affected | `apps/web/src/components/shared/birth-mode-partograph.tsx`            |
| Dependencies     | Nenhuma nova                                                          |
| Estimated Tasks  | 1                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Aba "Dinâmica Uterina" do partograma ──► sempre mostra o gráfico de      ║
║  linha (BirthModeContractionChart), independente da flag e dos dados     ║
║  de birth_uterine_activity já existentes (Fases 5-7 completas).          ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Aba "Dinâmica Uterina" ──► useFeatureFlagEnabled("show_uterine_activity")║
║       flag ativa  ──► BirthModeUterineActivityChart (matriz)              ║
║       flag inativa ──► BirthModeContractionChart (gráfico de linha atual) ║
║                                                                             ║
║  VALUE_ADD: fluxo de ponta a ponta completo — registro em lote (Fase 5)   ║
║             + visualização em matriz (esta fase), ambos atrás da mesma    ║
║             flag, ativados/desativados juntos de forma consistente.       ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `birth-mode-partograph.tsx`, aba "Dinâmica Uterina" | Gráfico de linha fixo | Gráfico alternado por flag | Fluxo visual consistente com o modal de registro (mesma flag) |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/components/shared/birth-mode-partograph.tsx` | `BIRTH_PARTOGRAPH_SESSIONS` (linhas ~25-70) e o `switch`/`case "contraction"` (linha ~83) | Local exato da troca |
| P0 | `apps/web/src/components/shared/birth-mode-register-buttons.tsx` | Bloco da Fase 5 (após implementada) | Padrão EXATO a espelhar — mesma flag, mesma estrutura de ternária |
| P1 | `apps/web/src/components/shared/birth-mode-uterine-activity-chart.tsx` | props (Fase 7) | Confirmar contrato de props: `{ events: BirthModeTimelineEvent[] }` — idêntico ao `BirthModeContractionChart` |

**External Documentation:** Nenhuma.

---

## Patterns to Mirror

**FLAG_TOGGLE (idêntico à Fase 5, local diferente):**
```tsx
// SOURCE: apps/web/src/components/shared/birth-mode-register-buttons.tsx (Fase 5, já implementada)
const showUterineActivity = useFeatureFlagEnabled("show_uterine_activity");
// ...
{showUterineActivity ? (
  <BirthModeUterineActivityChart events={events} />
) : (
  <BirthModeContractionChart events={events} />
)}
```

**CURRENT_CASE (a ser substituído em `birth-mode-partograph.tsx`):**
```tsx
case "contraction": return <BirthModeContractionChart events={events} />;
```

---

## Files to Change

| File                                                              | Action | Justification                                                        |
| -------------------------------------------------------------------| ------ | ---------------------------------------------------------------------|
| `apps/web/src/components/shared/birth-mode-partograph.tsx`        | UPDATE | Adicionar flag + ternária no `case "contraction"` do switch de gráficos |

---

## NOT Building (Scope Limits)

- **Mudança em `BIRTH_PARTOGRAPH_SESSIONS`** — a aba/sessão "Dinâmica Uterina" (`configType: "contraction"`) permanece a mesma; só o componente renderizado dentro dela muda.
- **Nova flag** — reaproveita `show_uterine_activity`, a mesma da Fase 5. Não introduzir uma flag separada para o gráfico (manteria os dois lados do fluxo dessincronizáveis, contrariando o objetivo desta fase).
- **Alteração no PDF do partograma** — decisão já registrada no PRD, mantida.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Reaproveitar a flag `show_uterine_activity` da Fase 5 | Sim, mesma flag | Nova flag dedicada ao gráfico (ex. `show_uterine_activity_chart`) | O PRD trata "modal e gráfico" como uma única feature ativada por uma única flag global (ver Solution Detail do PRD: "Feature flag show_uterine_activity (global, PostHog) alternando modal E gráfico") — duas flags permitiriam estados inconsistentes (registro em lote sem visualização em matriz, ou vice-versa), o que não faz sentido para o usuário |

---

## Step-by-Step Tasks

### Task 1: UPDATE `apps/web/src/components/shared/birth-mode-partograph.tsx`

- **ACTION**: Adicionar a flag (se ainda não importada neste arquivo) e substituir o `case "contraction"` por uma ternária
- **IMPLEMENT**:
  ```tsx
  // Adicionar import do novo componente:
  import { BirthModeUterineActivityChart } from "@/components/shared/birth-mode-uterine-activity-chart";
  import { useFeatureFlagEnabled } from "posthog-js/react";

  // No corpo do componente:
  const showUterineActivity = useFeatureFlagEnabled("show_uterine_activity");

  // Substituir:
  case "contraction": return <BirthModeContractionChart events={events} />;
  // por:
  case "contraction":
    return showUterineActivity ? (
      <BirthModeUterineActivityChart events={events} />
    ) : (
      <BirthModeContractionChart events={events} />
    );
  ```
- **MIRROR**: `apps/web/src/components/shared/birth-mode-register-buttons.tsx` (Fase 5) — mesma flag, mesmo padrão de ternária
- **GOTCHA**: se `useFeatureFlagEnabled` já estiver importado neste arquivo por outro motivo (confirmar antes de duplicar o import), reaproveitar a mesma declaração de variável em vez de chamar o hook duas vezes
- **GOTCHA**: manter o MESMO nome de flag exato usado na Fase 5 (`"show_uterine_activity"`, case-sensitive) — qualquer divergência dessincroniza modal e gráfico
- **VALIDATE**: `cd apps/web && pnpm exec tsc --noEmit`

---

## Testing Strategy

Nenhum teste automatizado — componente React, mesma lacuna de convenção das fases anteriores.

### Edge Cases Checklist (validação manual)

- [ ] Com a flag desativada: aba "Dinâmica Uterina" mostra o gráfico de linha atual (comportamento inalterado)
- [ ] Com a flag ativada: aba "Dinâmica Uterina" mostra a matriz nova
- [ ] Registros feitos ANTES da flag ser ativada (via `birth_contractions`, fluxo antigo) continuam visíveis no gráfico de linha quando a flag está desativada
- [ ] Registros feitos DEPOIS da flag ser ativada (via `birth_uterine_activity`, fluxo novo) aparecem corretamente na matriz quando a flag está ativada
- [ ] Alternar a flag ativa/desativa modal E gráfico juntos, de forma consistente (testar as Fases 5 e 8 em conjunto)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
cd apps/web && pnpm exec tsc --noEmit
pnpm exec biome check apps/web/src/components/shared/birth-mode-partograph.tsx
```

### Level 5: BROWSER_VALIDATION

Testar em ambiente de desenvolvimento com override local de feature flags do PostHog, cobrindo o checklist acima — idealmente testando o fluxo completo (Fases 5-8 juntas): registrar via modal novo, ver na timeline (Fase 6), ver na matriz (Fase 7/8), tudo sob a mesma flag ativa.

---

## Acceptance Criteria

- [ ] Flag `show_uterine_activity` controla qual gráfico aparece na aba "Dinâmica Uterina" do partograma
- [ ] Mesma flag da Fase 5 (não uma nova) — modal e gráfico ativam/desativam juntos
- [ ] `tsc --noEmit` e `biome check` passam sem erros
- [ ] Validação manual confirma ambos os caminhos e a consistência com a Fase 5

---

## Completion Checklist

- [ ] Task 1 completa e validada
- [ ] Level 1 passa
- [ ] Level 5 validado manualmente, cobrindo o fluxo completo Fases 5-8
- [ ] Acceptance criteria atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | ---------------------------------------- |
| Nome da flag digitado de forma diferente entre esta fase e a Fase 5 (typo ou case diferente) | L | H | Copiar a string literal exata da Fase 5 já implementada, não redigitar |
| Esta é a ÚLTIMA fase da feature — qualquer problema nas Fases 1-7 só se torna visível de ponta a ponta aqui | M | M | Validação manual desta fase deve necessariamente testar o fluxo completo (registro → timeline → matriz), funcionando como o teste de integração final da feature inteira |

---

## Notes

- Esta é a fase final do MVP definido no PRD — depois dela, todo o fluxo (registro em lote → timeline → matriz) está completo e a flag `show_uterine_activity` controla a feature inteira de ponta a ponta.
- Depois desta fase, atualizar a tabela de fases do PRD: Status da Fase 8 → `complete`, campo PRP Plan apontando para este arquivo. Considerar também atualizar o `Status` no rodapé do PRD de "DRAFT - needs validation" para refletir que a implementação está completa.
