# Feature: Dinâmica Uterina — Fase 4: Modal de Registro

## Summary

Criar o modal `AddBirthUterineActivityModal`, uma UI de registro em lote de baixo atrito com 3 campos (quantidade de contrações, intervalo 10/20/30 min, array de durações em segundos) que calcula e exibe a notação DU em tempo real conforme o profissional preenche o formulário, e persiste o registro via `addBirthUterineActivityAction` (já implementado na Fase 2). O modal é standalone nesta fase — **não é conectado** ao botão "Dinâmica Uterina" existente (`birth-mode-register-buttons.tsx`); essa troca condicionada pela feature flag é escopo da Fase 5.

## User Story

As a médica obstetra ou enfermeira obstétrica
I want to preencher um formulário simples de 3 campos e ver a notação DU calculada instantaneamente
So that eu registre a dinâmica uterina em lote, sem precisar calcular manualmente médias e agrupamentos de 10 em 10 minutos

## Problem Statement

Não existe hoje nenhuma UI para o novo formato de registro em lote. A tabela (Fase 1), o server action (Fase 2) e a função de cálculo da notação (Fase 3) já existem, mas nada os conecta a uma interface que o profissional possa efetivamente usar.

## Solution Statement

Novo arquivo `apps/web/src/modals/add-birth-uterine-activity-modal.tsx`, espelhando estruturalmente `add-birth-contraction-modal.tsx` (mesmo contrato de props, mesmo wrapper `ContentModal`, mesmo padrão `useAction`/`executeAsync`/toast/reset-on-open). Dois padrões adicionais, ambos com precedente direto no codebase (não inventados): (1) o array `durations_seconds` é dimensionado dinamicamente a partir do campo `contraction_count` via `form.watch` + `useEffect` + `Array.from({length})`, exatamente como `new-billing-modal.tsx` faz para `installments_dates`/`installment_count`; (2) a notação DU é derivada ao vivo via `form.watch` + `useMemo` chamando a função pura `computeDuNotations` (Fase 3), e sincronizada de volta ao campo `du_notations` do formulário via `form.setValue` em um `useEffect`, para que a validação Zod do submit sempre veja um valor consistente.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | NEW_CAPABILITY                                                       |
| Complexity       | MEDIUM                                                                |
| Systems Affected | `apps/web/src/modals`                                                |
| Dependencies     | Nenhuma nova — `react-hook-form`, `zod`, `next-safe-action`, `@ventre/ui` já em uso |
| Estimated Tasks  | 1                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  Fase 1-3 completas: tabela, action e função de notação existem, mas      ║
║  nenhuma UI os conecta. Profissional não tem como usar o novo fluxo.      ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════╗
║  AddBirthUterineActivityModal (standalone, ainda não conectado ao botão)  ║
║                                                                             ║
║  [Intervalo: 10 | 20 | 30 min]  (segmented pill, igual ao padrão de       ║
║                                   intensidade de dor já existente)         ║
║  [Quantidade de contrações: __]                                           ║
║  [Duração 1: __s] [Duração 2: __s] ... (N campos, N = quantidade)         ║
║  [Data *] [Hora *]                                                        ║
║                                                                             ║
║  ┌─────────────────────────────────────────┐                             ║
║  │   DU 3/10'/27"  DU 2/10'/41"             │  ◄── destaque, calculado    ║
║  └─────────────────────────────────────────┘       em tempo real          ║
║                                                                             ║
║  [Cancelar] [Salvar] ──► addBirthUterineActivityAction ──► toast/close    ║
║                                                                             ║
║  VALUE_ADD: profissional pode testar o fluxo completo de registro em      ║
║             lote isoladamente, antes da troca de flag na Fase 5.          ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes
| Location | Before | After | Impact |
|----------|--------|-------|--------|
| `apps/web/src/modals/` | Sem modal para dinâmica uterina em lote | `AddBirthUterineActivityModal` disponível, testável isoladamente | Fase 5 pode conectá-lo ao botão existente sem trabalho adicional de UI |

---

## Mandatory Reading

**CRITICAL: Ler estes arquivos antes de iniciar a task.**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/modals/add-birth-contraction-modal.tsx` | 1-172 (full) | Template estrutural EXATO — props, `useAction`, `useForm`, reset-on-open, `onSubmit`, `ContentModal`, date/time fields, botões |
| P0 | `apps/web/src/lib/validations/birth-mode.ts` | 132-152 (`birthUterineActivitySchema`) | Contrato de campos exato — `interval_minutes`, `contraction_count`, `durations_seconds`, `du_notations`, `date`, `time` |
| P0 | `apps/web/src/lib/birth-mode-uterine-activity-utils.ts` | full (`computeDuNotations`) | Função pura a chamar client-side para a notação em tempo real |
| P1 | `apps/web/src/modals/new-billing-modal.tsx` | 100-110, 181-187, 639-661 | Padrão de array dimensionado por outro campo (`installments_dates`/`installment_count`) — copiar essa técnica para `durations_seconds`/`contraction_count` |
| P1 | `apps/web/src/actions/add-birth-uterine-activity-action.ts` | full | Action já implementada a ser chamada via `useAction` |
| P1 | `packages/ui/src/shared/content-modal/content-modal.tsx` | full | Wrapper responsivo Dialog/Sheet — usar sem modificar |
| P2 | `apps/web/src/lib/birth-mode-duplicate-check.ts` | 40-43 (`defaultBirthEventDateTime`) | Defaults de `date`/`time` |

**External Documentation:** Nenhuma pesquisa externa necessária — reutiliza exclusivamente padrões já em uso (`react-hook-form`, `zod`, `next-safe-action`), sem API nova.

---

## Patterns to Mirror

**MODAL_SKELETON (props, useAction, reset-on-open, onSubmit):**
```typescript
// SOURCE: apps/web/src/modals/add-birth-contraction-modal.tsx (full file)
type AddBirthContractionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pregnancyId: string;
  onSuccess: () => void;
};

export function AddBirthContractionModal({ open, onOpenChange, pregnancyId, onSuccess }: AddBirthContractionModalProps) {
  const { executeAsync: addContraction, isPending } = useAction(addBirthContractionAction);

  const form = useForm<BirthContractionInput>({
    resolver: zodResolver(birthContractionSchema),
    defaultValues: { duration_seconds: undefined, pain_intensity: undefined, ...defaultBirthEventDateTime() },
  });

  useEffect(() => {
    if (open) {
      form.reset({ duration_seconds: undefined, pain_intensity: undefined, ...defaultBirthEventDateTime() });
    }
  }, [open, form]);

  async function onSubmit(values: BirthContractionInput) {
    const result = await addContraction({ pregnancyId, data: values });
    if (result?.serverError) {
      toast.error(result.serverError);
      return;
    }
    toast.success("Contração registrada!");
    if (result?.data?.duplicateWarning) {
      const { minutesAgo, professionalName } = result.data.duplicateWarning;
      toast.warning(`${professionalName} já registrou uma contração há ${minutesAgo} min`);
    }
    onOpenChange(false);
    onSuccess();
  }
  // ...ContentModal + Form JSX
}
```

**DYNAMIC_ARRAY_FROM_COUNT (resize + render N inputs):**
```typescript
// SOURCE: apps/web/src/modals/new-billing-modal.tsx:181-187, 639-661
useEffect(() => {
  if (!isCustomInterval) return;
  const current = form.getValues("installments_dates") ?? [];
  const next = Array.from({ length: installmentCount }, (_, i) => current[i] ?? "");
  form.setValue("installments_dates", next);
}, [installmentCount, isCustomInterval]);

// render:
{Array.from({ length: installmentCount }, (_, i) => (
  <div key={`custom-date-${i + 1}`}>
    <FormField control={form.control} name={`installments_dates.${i}`} render={({ field }) => (/* ... */)} />
  </div>
))}
```

**HAND_ROLLED_SEGMENTED_SELECTOR (sem RadioGroup no design system):**
```typescript
// SOURCE: apps/web/src/modals/add-birth-contraction-modal.tsx (pain_intensity field)
<div role="radiogroup" aria-label="Intensidade da dor" className="grid grid-cols-5 gap-2">
  {BIRTH_PAIN_INTENSITY_OPTIONS.map(({ value, emoji, label }) => {
    const selected = field.value === value;
    return (
      <label key={value} className={selected ? "border-primary bg-primary/10 ..." : "border-border hover:bg-muted/50 ..."}>
        <input type="radio" name="pain_intensity" value={value} checked={selected} onChange={() => field.onChange(value)} className="sr-only" />
        <span>{label}</span>
      </label>
    );
  })}
</div>
```

**LIVE_DERIVED_VALUE (watch + useMemo, mesmo shape de `installmentAmounts`):**
```typescript
// SOURCE: apps/web/src/modals/new-billing-modal.tsx:100-110
const installmentCount = form.watch("installment_count");
const installmentAmounts = useMemo(
  () => recalculateInstallmentAmounts(totalAmount ?? 0, installmentCount, lockedAmounts),
  [totalAmount, installmentCount, lockedAmounts],
);
```

---

## Files to Change

| File                                                              | Action | Justification                                                        |
| -------------------------------------------------------------------| ------ | ---------------------------------------------------------------------|
| `apps/web/src/modals/add-birth-uterine-activity-modal.tsx`        | CREATE | Novo modal de registro em lote, standalone nesta fase                |

---

## NOT Building (Scope Limits)

- **Conexão com o botão "Dinâmica Uterina"/`birth-mode-register-buttons.tsx`** — Fase 5, escopo explícito do PRD.
- **Feature flag `show_uterine_activity`** — não referenciada nesta fase; o modal é construído e testado isoladamente, sem gating.
- **Novo `BirthEventType`/entrada em `birth-mode-constants.ts`** — não necessário nesta fase (só seria necessário se o modal fosse montado agora, o que é Fase 5).
- **Componente `RadioGroup`/`ToggleGroup` reutilizável no design system** — não existe hoje (confirmado); o seletor de intervalo usa o mesmo padrão hand-rolled já usado para intensidade de dor, sem introduzir abstração nova em `packages/ui`.

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|---------------|-----------|
| Como dimensionar `durations_seconds` | `form.watch("contraction_count")` + `useEffect` + `Array.from({length})` + `form.setValue`, preservando valores já digitados por índice | `useFieldArray` do react-hook-form | `useFieldArray` é a única API de array já usada no repo, mas para um formulário sem add/remove manual (o tamanho é 100% derivado de `contraction_count`), o padrão já estabelecido em `new-billing-modal.tsx` para exatamente este cenário (array-size-from-count) é mais direto e evita a complexidade extra de field arrays (chaves estáveis, `append`/`remove`) que não são necessárias aqui |
| Como manter `du_notations` sincronizado com o formulário | `useMemo` deriva a notação a partir de `interval_minutes`/`durations_seconds` watchados, e um `useEffect` separado sincroniza esse valor derivado para `form.setValue("du_notations", ...)` | Computar `du_notations` apenas dentro de `onSubmit`, sem sincronizar ao form state | O schema (`birthUterineActivitySchema`) valida `du_notations` como campo obrigatório (`min(1)`) via `zodResolver` — se o valor não estiver no form state antes do submit, a validação do próprio `handleSubmit` bloqueia o envio mesmo com dados numéricos válidos. Sincronizar via `setValue` garante que a validação sempre veja o valor mais recente calculado |
| O que exibir enquanto as durações estão parcialmente preenchidas | Calcular a notação apenas com as durações já preenchidas (filtrando valores vazios/inválidos antes de chamar `computeDuNotations`), atualizando ao vivo conforme cada campo é preenchido | Só exibir a notação depois que TODOS os campos de duração estiverem preenchidos | O requisito original (`prompts/019-uterine-activity.md:18`) pede notação exibida "conforme os campos de input são preenchidos" — atualização parcial/incremental é mais fiel a "tempo real" do que esperar o preenchimento completo |
| Seletor de intervalo (10/20/30 min) | Segmented pills hand-rolled (mesmo padrão de `pain_intensity`) | `Select`/`SelectContent`/`SelectItem` do Shadcn | Apenas 3 opções fixas e sempre visíveis — pills favorecem toque em ambiente de parto (sem necessidade de abrir um dropdown), consistente com a UX de baixo atrito pedida no PRD; também mantém consistência visual com o único outro seletor de opções fixas do mesmo formulário (`pain_intensity` no modal irmão) |

---

## Step-by-Step Tasks

### Task 1: CREATE `apps/web/src/modals/add-birth-uterine-activity-modal.tsx`

- **ACTION**: CREATE o modal completo
- **IMPLEMENT**:
  ```tsx
  "use client";

  import { addBirthUterineActivityAction } from "@/actions/add-birth-uterine-activity-action";
  import { computeDuNotations } from "@/lib/birth-mode-uterine-activity-utils";
  import { defaultBirthEventDateTime } from "@/lib/birth-mode-duplicate-check";
  import { dayjs } from "@/lib/dayjs";
  import {
    type BirthUterineActivityInput,
    birthUterineActivitySchema,
  } from "@/lib/validations/birth-mode";
  import { zodResolver } from "@hookform/resolvers/zod";
  import { Button } from "@ventre/ui/button";
  import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
  import { Input } from "@ventre/ui/input";
  import { ContentModal } from "@ventre/ui/shared/content-modal";
  import { DatePicker } from "@ventre/ui/shared/date-picker";
  import { TimePicker } from "@ventre/ui/shared/time-picker";
  import { Loader2 } from "lucide-react";
  import { useAction } from "next-safe-action/hooks";
  import { useEffect, useMemo } from "react";
  import { useForm } from "react-hook-form";
  import { toast } from "sonner";

  const INTERVAL_OPTIONS = [10, 20, 30] as const;

  type AddBirthUterineActivityModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pregnancyId: string;
    onSuccess: () => void;
  };

  function emptyDefaults() {
    return {
      interval_minutes: undefined,
      contraction_count: undefined,
      durations_seconds: [],
      du_notations: [],
      ...defaultBirthEventDateTime(),
    };
  }

  export function AddBirthUterineActivityModal({
    open,
    onOpenChange,
    pregnancyId,
    onSuccess,
  }: AddBirthUterineActivityModalProps) {
    const { executeAsync: addUterineActivity, isPending } = useAction(
      addBirthUterineActivityAction,
    );

    const form = useForm<BirthUterineActivityInput>({
      resolver: zodResolver(birthUterineActivitySchema),
      defaultValues: emptyDefaults() as unknown as BirthUterineActivityInput,
    });

    useEffect(() => {
      if (open) {
        form.reset(emptyDefaults() as unknown as BirthUterineActivityInput);
      }
    }, [open, form]);

    const intervalMinutes = form.watch("interval_minutes");
    const contractionCount = form.watch("contraction_count");
    const durationsSeconds = form.watch("durations_seconds");

    // Dimensiona durations_seconds a partir de contraction_count, preservando
    // valores já digitados por índice — mesmo padrão de new-billing-modal.tsx
    // (installments_dates/installment_count).
    useEffect(() => {
      const current = form.getValues("durations_seconds") ?? [];
      const next = Array.from(
        { length: contractionCount || 0 },
        (_, i) => current[i],
      );
      form.setValue("durations_seconds", next as unknown as number[]);
    }, [contractionCount, form]);

    const duNotations = useMemo(() => {
      if (!intervalMinutes) return [];
      const validDurations = (durationsSeconds ?? []).filter(
        (d): d is number => typeof d === "number" && Number.isFinite(d) && d > 0,
      );
      if (validDurations.length === 0) return [];
      return computeDuNotations({ interval_minutes: intervalMinutes, durations_seconds: validDurations });
    }, [intervalMinutes, durationsSeconds]);

    useEffect(() => {
      form.setValue("du_notations", duNotations.length > 0 ? duNotations : []);
    }, [duNotations, form]);

    async function onSubmit(values: BirthUterineActivityInput) {
      const result = await addUterineActivity({ pregnancyId, data: values });
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success("Dinâmica uterina registrada!");
      if (result?.data?.duplicateWarning) {
        const { minutesAgo, professionalName } = result.data.duplicateWarning;
        toast.warning(`${professionalName} já registrou dinâmica uterina há ${minutesAgo} min`);
      }
      onOpenChange(false);
      onSuccess();
    }

    return (
      <ContentModal
        open={open}
        onOpenChange={onOpenChange}
        title="Registrar Dinâmica Uterina"
        description="Informe a quantidade de contrações, o intervalo e as durações"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="interval_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Intervalo *</FormLabel>
                  <FormControl>
                    <div role="radiogroup" aria-label="Intervalo" className="grid grid-cols-3 gap-2">
                      {INTERVAL_OPTIONS.map((minutes) => {
                        const selected = field.value === minutes;
                        return (
                          <label
                            key={minutes}
                            className={`flex cursor-pointer items-center justify-center rounded-xl border py-3 font-semibold transition-colors ${
                              selected ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="interval_minutes"
                              value={minutes}
                              checked={selected}
                              onChange={() => field.onChange(minutes)}
                              className="sr-only"
                            />
                            {minutes} min
                          </label>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contraction_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade de contrações *</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {contractionCount > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: contractionCount }, (_, i) => (
                  <FormField
                    key={`duration-${i}`}
                    control={form.control}
                    name={`durations_seconds.${i}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{i + 1}ª (s) *</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}

            {duNotations.length > 0 && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center">
                <p className="font-bold text-2xl text-primary">{duNotations.join("  ")}</p>
              </div>
            )}

            <div className="flex gap-2">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Data *</FormLabel>
                    <FormControl>
                      <DatePicker
                        selected={field.value ? new Date(`${field.value}T00:00:00`) : null}
                        onChange={(date) => field.onChange(date ? date.toISOString().slice(0, 10) : "")}
                        placeholderText="Selecione a data"
                        hideCalendar
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora *</FormLabel>
                    <FormControl>
                      <TimePicker
                        selected={field.value ? new Date(`1970-01-01T${field.value}:00`) : null}
                        onChange={(date) => field.onChange(date ? dayjs(date).format("HH:mm") : "")}
                        timeIntervals={1}
                        hidePredefinedTimes
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-primary" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </div>
          </form>
        </Form>
      </ContentModal>
    );
  }
  ```
- **MIRROR**: `apps/web/src/modals/add-birth-contraction-modal.tsx` (estrutura geral, props, `onSubmit`, botões, date/time) + `apps/web/src/modals/new-billing-modal.tsx:181-187,639-661` (array dimensionado por contagem)
- **IMPORTS**: idênticos ao modal espelhado, trocando `addBirthContractionAction`/`birthContractionSchema` pelos equivalentes de dinâmica uterina, mais `computeDuNotations` e `useMemo`
- **GOTCHA**: `defaultValues`/`form.reset` usam `as unknown as BirthUterineActivityInput` porque os campos começam intencionalmente vazios/inválidos (`interval_minutes: undefined`, `durations_seconds: []`) — mesmo padrão tolerado em `add-birth-contraction-modal.tsx` (`pain_intensity: undefined` apesar do tipo exigir um enum). A validação real acontece no submit via `zodResolver`
- **GOTCHA**: o `useEffect` que sincroniza `du_notations` roda em TODO render onde `duNotations` muda de referência — como `duNotations` vem de um `useMemo` com dependências primitivas/array estável, isso não deve causar loop infinito, mas **validar manualmente no browser** que não há re-render em loop (React DevTools Profiler ou apenas observar performance) antes de considerar a task concluída
- **GOTCHA**: `contraction_count > 0 &&` guarda a renderização condicional dos campos de duração — como o campo pode estar `undefined` inicialmente, usar `(contractionCount ?? 0) > 0` seria mais seguro; ajustar se o TypeScript reclamar de `contractionCount` possivelmente `undefined` na comparação
- **GOTCHA**: `durations_seconds.${i}` como `name` do `FormField` depende de o array já ter sido dimensionado pelo `useEffect` anterior (que roda depois do primeiro render) — pode haver um flash de campos undefined no primeiro render após mudar `contraction_count`; comportamento aceitável, não uma condição de corrida real já que React re-renderiza após o `setValue`
- **VALIDATE**: `cd apps/web && NODE_OPTIONS="--max-old-space-size=8192" pnpm exec tsc --noEmit` (crash de memória do `tsc` já documentado nas Fases 2/3, não relacionado ao código desta fase — usar o flag de memória)

---

## Testing Strategy

Nenhum modal irmão em `apps/web/src/modals/` possui teste automatizado (componentes React não são testados neste repositório — apenas a lógica pura da Fase 3 introduziu Vitest, escopado a funções sem DOM). Consistente com essa convenção, esta fase não introduz testes automatizados de componente. A validação é manual, no browser.

### Edge Cases Checklist (validação manual)

- [ ] Alterar `contraction_count` de 0 → 3 → 1 e confirmar que os campos de duração são adicionados/removidos corretamente, preservando valores já digitados nos índices que permanecem
- [ ] Preencher parcialmente as durações (ex.: 2 de 3) e confirmar que a notação DU exibida reflete apenas as durações já preenchidas, atualizando ao vivo
- [ ] Selecionar intervalo 20 ou 30 min e confirmar que a notação exibida já mostra múltiplos blocos (`DU x/10'/y" DU x/10'/y"`) conforme os exemplos da Fase 3
- [ ] Submeter com `durations_seconds.length !== contraction_count` (ex.: diminuir `contraction_count` depois de preencher todas as durações, sem que o efeito de resize tenha rodado a tempo) — confirmar que a validação Zod bloqueia o submit com a mensagem correta
- [ ] Confirmar responsividade: abrir em viewport <640px (Sheet) e ≥640px (Dialog), sem mudança de código no modal (delegado ao `ContentModal`)
- [ ] Submissão bem-sucedida: confirmar toast de sucesso, fechamento do modal, e que o registro aparece em `birth_uterine_activity` via Supabase (dashboard ou MCP)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
cd apps/web && NODE_OPTIONS="--max-old-space-size=8192" pnpm exec tsc --noEmit
pnpm exec biome check apps/web/src/modals/add-birth-uterine-activity-modal.tsx
```

**EXPECT**: Exit 0 em ambos.

### Level 5: BROWSER_VALIDATION

Como este modal ainda não está conectado a nenhum botão (Fase 5 faz essa conexão), a validação em browser requer montá-lo temporariamente em uma página de teste OU adiantar minimamente a Fase 5's wiring apenas para fins de teste manual local (sem persistir essa mudança — reverter antes de finalizar esta fase, já que conectar ao botão é explicitamente escopo da Fase 5). Alternativa mais limpa: renderizar `<AddBirthUterineActivityModal open pregnancyId="..." onOpenChange={() => {}} onSuccess={() => {}} />` em uma rota/story temporária do Storybook (`apps/storybook`) ou em uma página de debug local, validar todos os Edge Cases acima, e descartar a montagem temporária.

### Level 6: MANUAL_VALIDATION

1. Repetir o payload de exemplo já usado nas Fases 2/3 (`interval_minutes: 10, durations_seconds: [45,50,55]`) através da UI e confirmar que a notação exibida (`DU 3/10'/50"`) bate com o cálculo da Fase 3.
2. Confirmar que o registro persistido em `birth_uterine_activity` tem `du_notations` idêntico ao exibido na UI no momento do submit.

---

## Acceptance Criteria

- [ ] `AddBirthUterineActivityModal` criado em `apps/web/src/modals/add-birth-uterine-activity-modal.tsx`, estruturalmente espelhando `add-birth-contraction-modal.tsx`
- [ ] Campo de intervalo (10/20/30 min), campo de quantidade de contrações, e N campos de duração dinâmicos funcionais
- [ ] Notação DU calculada e exibida em destaque, atualizando em tempo real conforme os campos são preenchidos
- [ ] Submissão bem-sucedida persiste corretamente via `addBirthUterineActivityAction`, com toast de sucesso/erro e tratamento de `duplicateWarning`
- [ ] `tsc --noEmit` e `biome check` passam sem erros
- [ ] Validação manual em browser confirma todos os Edge Cases

---

## Completion Checklist

- [ ] Task 1 completa e validada (`tsc --noEmit`, `biome check`)
- [ ] Level 1: Static analysis passa
- [ ] Level 5: Validação em browser (montagem temporária) confirma todos os edge cases
- [ ] Level 6: Validação manual confirma paridade entre notação exibida e persistida
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk               | Likelihood   | Impact       | Mitigation                              |
| ------------------ | ------------ | ------------ | ---------------------------------------- |
| Loop de re-render entre o `useEffect` de `du_notations` e o `useMemo` que o alimenta | L | M | `useMemo` tem dependências primitivas/array estável (`intervalMinutes`, `durationsSeconds` vindos de `form.watch`), e o `useEffect` só chama `setValue` (que não força um novo `watch` a disparar o mesmo `useMemo` com uma referência diferente na maioria dos casos) — validar manualmente no browser antes de finalizar, conforme GOTCHA da Task 1 |
| Validação manual em browser requer montagem temporária fora do fluxo real (modal não conectado ainda) | M | L | Escopo intencional — Fase 5 é responsável pela conexão real; a alternativa (adiantar a Fase 5 aqui) misturaria escopo e contradiria o PRD, que separa as duas fases explicitamente |
| Layout de N campos de duração pode ficar visualmente denso para `contraction_count` alto (até 18 em um intervalo de 30min) | M | L | Não abordado nesta implementação — grid de 3 colunas com scroll natural do modal (`ContentModal` já tem `overflow-y-auto`); se a equipe de produto considerar inaceitável após teste manual, é um ajuste de CSS pontual, não uma mudança estrutural |

---

## Notes

- Este modal reutiliza 100% da camada de dados já validada nas Fases 2 e 3 — nenhuma mudança em action, schema ou lógica de notação é necessária ou esperada nesta fase.
- A decisão de não conectar o modal ao botão existente nesta fase é deliberada e replica a separação de fases do PRD (Fase 4 = UI isolada, Fase 5 = toggle de flag) — resistir à tentação de "já deixar funcionando de verdade" adiantando a Fase 5.
- Depois desta fase, atualizar a tabela de fases do PRD (`uterine-activity.prd.md`): Status da Fase 4 → `complete`, campo PRP Plan apontando para este arquivo.
