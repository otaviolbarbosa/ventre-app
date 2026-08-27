# Feature: Formulário de Início do Trabalho de Parto (Phase 2)

## Summary

Substituir o `confirm()` genérico usado hoje para ativar o "Modo Parto" por um modal com formulário que captura o tipo de trabalho de parto (espontâneo/induzido), o tipo de indução (quando aplicável) e uma descrição livre opcional. Esses dados são persistidos na mesma chamada `.update()` que já ativa `birth_mode_active`/`birth_mode_activated_at`/`birth_mode_activated_by`, estendendo o `activateBirthModeSchema`/`activateBirthModeAction` existentes — sem criar uma nova action.

## User Story

As a profissional da equipe de cuidado (obstetra, enfermeira ou doula)
I want to preencher um formulário com os dados do início do trabalho de parto ao ativar o Modo Parto
So that o registro documental do início do processo fica garantido para fins de auditoria e resguardo legal

## Problem Statement

Hoje a ativação do Modo Parto ocorre via um `confirm()` sem nenhum campo de captura de dados (`apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:56-72`), o que deixa uma lacuna de documentação sobre o que motivou a ativação (parto espontâneo vs. induzido, tipo de indução, contexto clínico).

## Solution Statement

Um novo modal client-side (`StartLabourModal`), seguindo exatamente o padrão dos demais modais de eventos do Modo Parto (`ContentModal` + `react-hook-form` + `zod` + `next-safe-action`), substitui a chamada a `confirm()`. O submit invoca a mesma `activateBirthModeAction`, agora estendida para aceitar e persistir `birth_mode_labour_type`, `birth_mode_induction_type` e `labour_start_description` no mesmo `.update()` de `pregnancies`, preservando `revalidatePath`, `scheduleBirthModeActivationNotifications` e `captureServerEvent` inalterados.

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------|
| Type             | ENHANCEMENT                                                           |
| Complexity       | LOW                                                                   |
| Systems Affected | `apps/web` (actions, validations, modals, profile page)              |
| Dependencies     | zod, react-hook-form, @hookform/resolvers, next-safe-action, sonner (all already in use, no version changes) |
| Estimated Tasks  | 5                                                                     |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  Profissional clica em "Modo Parto"                                            ║
║      │                                                                         ║
║      ▼                                                                         ║
║  useConfirmModal().confirm({ title, description, onConfirm })                  ║
║  (dialog genérico: só título + texto fixo + botão "Ativar")                    ║
║      │                                                                         ║
║      ▼                                                                         ║
║  activateBirthModeAction({ pregnancyId })                                      ║
║      │  UPDATE pregnancies SET birth_mode_active=true,                         ║
║      │                          birth_mode_activated_at=now(),                 ║
║      │                          birth_mode_activated_by=user.id                ║
║      ▼                                                                         ║
║  toast.success + router.push(/modo-parto?pregnancyId=...)                      ║
║                                                                                 ║
║  PAIN_POINT: nenhum dado clínico sobre a origem do parto é capturado.          ║
║  DATA_FLOW: pregnancyId → activateBirthModeAction → pregnancies (3 campos)     ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                 ║
║  Profissional clica em "Modo Parto"                                            ║
║      │                                                                         ║
║      ▼                                                                         ║
║  setShowStartLabourModal(true)                                                 ║
║      │                                                                         ║
║      ▼                                                                         ║
║  ┌───────────────────────────────────────────┐                                ║
║  │ StartLabourModal (ContentModal)            │                                ║
║  │  Tipo de trabalho de parto * [Select]      │  ◄── espontâneo | induzido     ║
║  │  (se induzido) Tipo de indução * [Select]  │  ◄── balão|misoprostol|ocit.   ║
║  │  Descrição (opcional) [Textarea]           │                                ║
║  │  [Cancelar]           [Ativar]             │                                ║
║  └───────────────────────────────────────────┘                                ║
║      │ submit                                                                 ║
║      ▼                                                                         ║
║  activateBirthModeAction({ pregnancyId, birth_mode_labour_type,                ║
║                             birth_mode_induction_type?, labour_start_description? })║
║      │  UPDATE pregnancies SET birth_mode_active=true, ...,                    ║
║      │                          birth_mode_labour_type=...,                    ║
║      │                          birth_mode_induction_type=...,                 ║
║      │                          labour_start_description=...                   ║
║      ▼                                                                         ║
║  toast.success + router.push(/modo-parto?pregnancyId=...)                      ║
║                                                                                 ║
║  VALUE_ADD: registro documental completo e imutável do início do parto.        ║
║  DATA_FLOW: form values → activateBirthModeAction → pregnancies (6 campos)     ║
║                                                                                 ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `patients/[id]/profile/page.tsx` — botão "Modo Parto" | Abre `confirm()` genérico | Abre `StartLabourModal` | Precisa preencher tipo de trabalho de parto antes de ativar |
| `activateBirthModeAction` | Só ativa `birth_mode_active` | Ativa + persiste dados de início do parto | Nenhuma ação extra do usuário; a persistência é atômica |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/modals/add-birth-medication-administration-modal.tsx` | 1-237 | Padrão EXATO a espelhar: enum → sub-campo condicional (`form.watch`) → texto livre, `ContentModal`, `useAction` destructured como `{ executeAsync, isPending }` |
| P0 | `apps/web/src/actions/activate-birth-mode-action.ts` | 1-37 | Action a ESTENDER (não duplicar) — único `.update()` a modificar |
| P0 | `apps/web/src/lib/validations/birth-mode.ts` | 1-8, 51-77 | `activateBirthModeSchema` (linha 3-5) a estender; padrão `.refine()` condicional (linhas 60-76) a replicar |
| P0 | `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx` | 1-91, 131-152, 263-281 | Call site exato a substituir (linhas 56-72), padrão de estado de modal (`showFinishModal` etc, linhas 37-39), local de renderização dos modais (linhas 263-281) |
| P1 | `apps/web/src/modals/add-birth-membrane-rupture-modal.tsx` | 81-129 | Segundo exemplo de dois `Select` de enum em sequência — reforça o padrão de sub-campo condicional |
| P1 | `apps/web/src/lib/birth-mode-constants.ts` | 1-44 | Onde adicionar os novos `Record<string,string>` de labels (`BIRTH_MODE_LABOUR_TYPE_LABELS`, `BIRTH_MODE_INDUCTION_TYPE_LABELS`) |
| P2 | `packages/supabase/src/types/database.types.ts` | ~2043-2155, 3058-3059, 3290-3291 | Confirmar tipos gerados e valores literais dos enums (`espontaneo`/`induzido`, `balao`/`misoprostol`/`ocitocina`) — NÃO usar acentos |

**External Documentation:** Nenhuma necessária — feature usa exclusivamente bibliotecas já adotadas no projeto (zod, react-hook-form, next-safe-action, shadcn/ui), sem padrões novos de API externa.

---

## Patterns to Mirror

**SCHEMA COM `.refine()` CONDICIONAL:**
```typescript
// SOURCE: apps/web/src/lib/validations/birth-mode.ts:51-77
export const birthMedicationAdministrationSchema = z
  .object({
    medication_type: z.enum(["fluidos_intravenosos", "ocitocina", "analgesia", "outros"]),
    other_birth_medication_type: z.string().optional().nullable(),
    ...
  })
  .refine((v) => v.medication_type !== "outros" || !!v.other_birth_medication_type, {
    message: "Especifique o medicamento",
    path: ["other_birth_medication_type"],
  });
```

**ACTION PATTERN (a estender, não duplicar):**
```typescript
// SOURCE: apps/web/src/actions/activate-birth-mode-action.ts (COMPLETO)
export const activateBirthModeAction = authActionClient
  .inputSchema(activateBirthModeSchema)
  .action(async ({ parsedInput: { pregnancyId }, ctx: { supabase, user } }) => {
    const { data: pregnancy, error } = await supabase
      .from("pregnancies")
      .update({
        birth_mode_active: true,
        birth_mode_activated_at: new Date().toISOString(),
        birth_mode_activated_by: user.id,
      })
      .eq("id", pregnancyId)
      .select("id, patient_id")
      .single();

    if (error) throw new Error(error.message);

    revalidatePath(`/patients/${pregnancy.patient_id}/profile`);

    scheduleBirthModeActivationNotifications(pregnancyId).catch((err) => {
      console.error("[activate-birth-mode] Failed to schedule WhatsApp notifications", err);
    });

    await captureServerEvent(user.id, "activate_birth_mode", {
      pregnancy_id: pregnancyId,
    });

    return { success: true };
  });
```

**MODAL COM CAMPO CONDICIONAL VIA `form.watch`:**
```typescript
// SOURCE: apps/web/src/modals/add-birth-medication-administration-modal.tsx:55, 119-133
const medicationType = form.watch("medication_type");
...
{medicationType === "outros" && (
  <FormField
    control={form.control}
    name="other_birth_medication_type"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Qual medicamento? *</FormLabel>
        <FormControl>
          <Input {...field} value={field.value ?? ""} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
)}
```

**SELECT DE ENUM COM LABELS MAP:**
```typescript
// SOURCE: apps/web/src/modals/add-birth-membrane-rupture-modal.tsx:81-104
<FormField
  control={form.control}
  name="rupture_type"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tipo *</FormLabel>
      <Select onValueChange={field.onChange} value={field.value ?? ""}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {Object.entries(BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**TEXTAREA OPCIONAL:**
```typescript
// SOURCE: apps/web/src/modals/add-birth-medication-administration-modal.tsx:167-179
<FormField
  control={form.control}
  name="notes"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Observações</FormLabel>
      <FormControl>
        <Textarea rows={3} {...field} value={field.value ?? ""} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**CALL SITE ATUAL A SUBSTITUIR:**
```typescript
// SOURCE: apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:56-72
function handleActivateBirthMode(pregnancyId: string) {
  confirm({
    title: "Ativar Modo Parto",
    description:
      "Isso enviará uma notificação por WhatsApp para toda a equipe de cuidado da gestante. Confirma a ativação?",
    confirmLabel: "Ativar",
    onConfirm: async () => {
      const res = await activateBirthMode({ pregnancyId });
      if (res?.serverError) {
        toast.error(res.serverError);
        return;
      }
      toast.success("Modo Parto ativado!");
      router.push(`/modo-parto?pregnancyId=${pregnancyId}`);
    },
  });
}
```

**PADRÃO DE ESTADO DE MODAL NO PROFILE PAGE:**
```typescript
// SOURCE: apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:37-39
const [showFinishModal, setShowFinishModal] = useState(false);
const [showInvitePatientModal, setShowInvitePatientModal] = useState(false);
const [showNewAppointmentModal, setShowNewAppointmentModal] = useState(false);
```

**RENDERIZAÇÃO DE MODAIS NO FINAL DO COMPONENTE:**
```typescript
// SOURCE: apps/web/app/(dashboard)/patients/[id]/profile/page.tsx:263-281
<FinishCareModal
  open={showFinishModal}
  onOpenChange={setShowFinishModal}
  patientId={patientId}
  pregnancyId={pregnancy?.id}
  onSuccess={() => fetchPatient({ patientId })}
/>
```

---

## Files to Change

| File                                                                 | Action | Justification                                                        |
| ---------------------------------------------------------------------|--------|------------------------------------------------------------------------|
| `apps/web/src/lib/validations/birth-mode.ts`                        | UPDATE | Estender `activateBirthModeSchema` com os 3 novos campos + `.refine()` condicional |
| `apps/web/src/lib/birth-mode-constants.ts`                          | UPDATE | Adicionar `BIRTH_MODE_LABOUR_TYPE_LABELS` e `BIRTH_MODE_INDUCTION_TYPE_LABELS` |
| `apps/web/src/actions/activate-birth-mode-action.ts`                | UPDATE | Incluir os 3 novos campos no `.update()` de `pregnancies` |
| `apps/web/src/modals/start-labour-modal.tsx`                        | CREATE | Novo modal de formulário, espelhando `add-birth-medication-administration-modal.tsx` |
| `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx`           | UPDATE | Trocar `confirm()` por `showStartLabourModal` state + renderizar `StartLabourModal` |

---

## NOT Building (Scope Limits)

- Edição posterior de `birth_mode_labour_type`/`birth_mode_induction_type`/`labour_start_description` — imutável nesta v1 (confirmado na PRD).
- Backfill de pregnancies já com `birth_mode_active = true` antes do deploy.
- Qualquer lógica de gating do partograma (`partograph_unlocked_at`) — isso é Phase 3/4, fora do escopo desta fase.
- Exibição de `birth_mode_labour_type`/`labour_start_description` em qualquer tela de leitura (timeline, status bar) — não solicitado nesta fase; apenas a captura no momento da ativação.

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: UPDATE `apps/web/src/lib/validations/birth-mode.ts`

- **ACTION**: Estender `activateBirthModeSchema` (linhas 3-5) com os novos campos e validação condicional
- **IMPLEMENT**:
  ```typescript
  export const activateBirthModeSchema = z
    .object({
      pregnancyId: z.string().uuid("ID da gestação inválido"),
      birth_mode_labour_type: z.enum(["espontaneo", "induzido"], {
        message: "Selecione o tipo de trabalho de parto",
      }),
      birth_mode_induction_type: z.enum(["balao", "misoprostol", "ocitocina"]).optional().nullable(),
      labour_start_description: z.string().optional().nullable(),
    })
    .refine(
      (v) => v.birth_mode_labour_type !== "induzido" || !!v.birth_mode_induction_type,
      {
        message: "Informe o tipo de indução",
        path: ["birth_mode_induction_type"],
      },
    );
  ```
- **MIRROR**: `birthMedicationAdministrationSchema` (linhas 51-77) — mesmo padrão `.object().refine()`
- **GOTCHA**: Os valores do enum são literais sem acento — `"espontaneo"`, `"induzido"`, `"balao"`, `"misoprostol"`, `"ocitocina"` — confirmados na migration `20260824000008_pregnancies_add_labour_onset_and_partograph_gating.sql` e em `database.types.ts` (linhas 3058-3059). NÃO usar `"espontâneo"`/`"balão"`.
- **VALIDATE**: `pnpm check-types`

### Task 2: UPDATE `apps/web/src/lib/birth-mode-constants.ts`

- **ACTION**: Adicionar dois novos `Record<string, string>` de labels, seguindo o padrão das linhas 13-44
- **IMPLEMENT**:
  ```typescript
  export const BIRTH_MODE_LABOUR_TYPE_LABELS: Record<string, string> = {
    espontaneo: "Espontâneo",
    induzido: "Induzido",
  };

  export const BIRTH_MODE_INDUCTION_TYPE_LABELS: Record<string, string> = {
    balao: "Balão",
    misoprostol: "Misoprostol",
    ocitocina: "Ocitocina",
  };
  ```
- **MIRROR**: `BIRTH_MEMBRANE_RUPTURE_TYPE_LABELS` (linhas 33-36) — mesma estrutura, chave = valor literal do DB, valor = label em pt-BR com acento
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/actions/activate-birth-mode-action.ts`

- **ACTION**: Incluir os 3 novos campos no `.update()` existente, sem criar nova action nem novo `.inputSchema()`
- **IMPLEMENT**:
  ```typescript
  export const activateBirthModeAction = authActionClient
    .inputSchema(activateBirthModeSchema)
    .action(
      async ({
        parsedInput: {
          pregnancyId,
          birth_mode_labour_type,
          birth_mode_induction_type,
          labour_start_description,
        },
        ctx: { supabase, user },
      }) => {
        const { data: pregnancy, error } = await supabase
          .from("pregnancies")
          .update({
            birth_mode_active: true,
            birth_mode_activated_at: new Date().toISOString(),
            birth_mode_activated_by: user.id,
            birth_mode_labour_type,
            birth_mode_induction_type: birth_mode_induction_type ?? null,
            labour_start_description: labour_start_description ?? null,
          })
          .eq("id", pregnancyId)
          .select("id, patient_id")
          .single();

        if (error) throw new Error(error.message);

        revalidatePath(`/patients/${pregnancy.patient_id}/profile`);

        scheduleBirthModeActivationNotifications(pregnancyId).catch((err) => {
          console.error("[activate-birth-mode] Failed to schedule WhatsApp notifications", err);
        });

        await captureServerEvent(user.id, "activate_birth_mode", {
          pregnancy_id: pregnancyId,
        });

        return { success: true };
      },
    );
  ```
- **MIRROR**: Estrutura existente do arquivo — apenas adiciona campos ao `.update()` e desestrutura mais campos de `parsedInput`
- **GOTCHA**: NÃO tocar em `revalidatePath`, `scheduleBirthModeActivationNotifications` ou `captureServerEvent` — confirmado pelo codebase-analyst que nenhuma dessas dependências lê os novos campos, então nada mais precisa mudar
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/modals/start-labour-modal.tsx`

- **ACTION**: Novo modal de formulário para captura dos dados de início do parto + ativação
- **IMPLEMENT**: Estrutura completa espelhando `add-birth-medication-administration-modal.tsx`, mas chamando `activateBirthModeAction` (não uma action de "add event" com `data` aninhado — os campos vão direto no top-level do input, junto com `pregnancyId`, pois `activateBirthModeSchema` é flat)
  ```tsx
  "use client";

  import { activateBirthModeAction } from "@/actions/activate-birth-mode-action";
  import {
    BIRTH_MODE_INDUCTION_TYPE_LABELS,
    BIRTH_MODE_LABOUR_TYPE_LABELS,
  } from "@/lib/birth-mode-constants";
  import {
    type ActivateBirthModeInput,
    activateBirthModeSchema,
  } from "@/lib/validations/birth-mode";
  import { zodResolver } from "@hookform/resolvers/zod";
  import { Button } from "@ventre/ui/button";
  import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
  import { ContentModal } from "@ventre/ui/shared/content-modal";
  import { Textarea } from "@ventre/ui/textarea";
  import { Loader2 } from "lucide-react";
  import { useAction } from "next-safe-action/hooks";
  import { useEffect } from "react";
  import { useForm } from "react-hook-form";
  import { useRouter } from "next/navigation";
  import { toast } from "sonner";

  type StartLabourModalProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pregnancyId: string;
  };

  export function StartLabourModal({ open, onOpenChange, pregnancyId }: StartLabourModalProps) {
    const router = useRouter();
    const { executeAsync: activateBirthMode, isPending } = useAction(activateBirthModeAction);

    const form = useForm<ActivateBirthModeInput>({
      resolver: zodResolver(activateBirthModeSchema),
      defaultValues: {
        pregnancyId,
        birth_mode_labour_type: undefined,
        birth_mode_induction_type: undefined,
        labour_start_description: undefined,
      },
    });

    const labourType = form.watch("birth_mode_labour_type");

    useEffect(() => {
      if (open) {
        form.reset({
          pregnancyId,
          birth_mode_labour_type: undefined,
          birth_mode_induction_type: undefined,
          labour_start_description: undefined,
        });
      }
    }, [open, pregnancyId, form]);

    async function onSubmit(values: ActivateBirthModeInput) {
      const result = await activateBirthMode(values);
      if (result?.serverError) {
        toast.error(result.serverError);
        return;
      }
      toast.success("Modo Parto ativado!");
      onOpenChange(false);
      router.push(`/modo-parto?pregnancyId=${pregnancyId}`);
    }

    return (
      <ContentModal
        open={open}
        onOpenChange={onOpenChange}
        title="Ativar Modo Parto"
        description="Registre os dados do início do trabalho de parto. Isso enviará uma notificação por WhatsApp para toda a equipe de cuidado."
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="birth_mode_labour_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de trabalho de parto *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(BIRTH_MODE_LABOUR_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {labourType === "induzido" && (
              <FormField
                control={form.control}
                name="birth_mode_induction_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de indução *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(BIRTH_MODE_INDUCTION_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="labour_start_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="gradient-primary" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Ativar
              </Button>
            </div>
          </form>
        </Form>
      </ContentModal>
    );
  }
  ```
- **MIRROR**: `add-birth-medication-administration-modal.tsx` (estrutura geral, `form.watch` condicional) + `add-birth-membrane-rupture-modal.tsx` (dois `Select` em sequência)
- **IMPORTS**: Note que este modal NÃO usa `data: {...}` aninhado (diferente das actions de "add event") — `activateBirthModeAction` recebe os campos direto no top-level, então `form` deve incluir `pregnancyId` como `defaultValues` e o submit passa `values` inteiro
- **GOTCHA**: Sem `defaultBirthEventDateTime()` aqui — este formulário não tem campos de data/hora (a ativação usa `new Date()` no servidor, como já ocorre hoje)
- **GOTCHA**: `router.push` deve ocorrer no modal (não mais no call site da página), já que a navegação depende do sucesso do submit do form
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/app/(dashboard)/patients/[id]/profile/page.tsx`

- **ACTION**: Substituir a chamada `confirm()` por abertura do `StartLabourModal`
- **IMPLEMENT**:
  1. Adicionar import: `import { StartLabourModal } from "@/modals/start-labour-modal";`
  2. Adicionar estado (junto às linhas 37-39): `const [showStartLabourModal, setShowStartLabourModal] = useState(false);`
  3. Remover a função `handleActivateBirthMode` (linhas 56-72) inteira — a lógica de submit agora vive dentro do `StartLabourModal`
  4. Trocar o `onClick` do botão "Modo Parto" (linha 147) de `onClick={() => handleActivateBirthMode(pregnancy.id)}` para `onClick={() => setShowStartLabourModal(true)}`
  5. Remover `disabled={isActivatingBirthMode}` (linha 146) e a desestruturação `const { executeAsync: activateBirthMode, isPending: isActivatingBirthMode } = useAction(activateBirthModeAction);` (linhas 46-47) e o import de `activateBirthModeAction` (linha 2) — não são mais usados diretamente nesta página
  6. Adicionar renderização do modal junto às linhas 263-281:
     ```tsx
     <StartLabourModal
       open={showStartLabourModal}
       onOpenChange={setShowStartLabourModal}
       pregnancyId={pregnancy?.id ?? ""}
     />
     ```
- **MIRROR**: Padrão de `showFinishModal`/`FinishCareModal` (linhas 37, 263-269)
- **GOTCHA**: `useConfirmModal()`/`confirm` (linha 20, 40) continuam sendo usados por `handleConfirmDelete` (linhas 74-91) — NÃO remover esse import/hook, apenas parar de usá-lo para a ativação do modo parto
- **GOTCHA**: `pregnancy?.id` pode ser `undefined` no momento da renderização do JSX do botão, mas o botão só aparece quando `pregnancy?.id` é truthy (linha 131) — usar `pregnancy?.id ?? ""` apenas como fallback de tipo para a prop `pregnancyId: string`
- **VALIDATE**: `pnpm check-types`

---

## Testing Strategy

Este projeto não possui suíte de testes automatizados para actions/modais (`apps/web` não tem arquivos `*.test.ts(x)` para este domínio, confirmado pela ausência de padrão de teste nos arquivos irmãos `add-birth-*`). A validação desta fase é manual + `pnpm check-types`.

### Edge Cases Checklist

- [ ] Selecionar "Espontâneo" e submeter sem preencher tipo de indução → deve funcionar (indução não é exigida)
- [ ] Selecionar "Induzido" e submeter sem selecionar tipo de indução → deve bloquear com mensagem "Informe o tipo de indução"
- [ ] Trocar de "Induzido" para "Espontâneo" depois de já ter selecionado um tipo de indução → campo de indução some da UI; ao submeter, o valor antigo de `birth_mode_induction_type` ainda estará no form state, mas isso é aceitável pois o schema só valida quando `birth_mode_labour_type === "induzido"` (não há necessidade de limpar o campo ao trocar, pois não é enviado como erro)
- [ ] Submeter sem descrição → deve funcionar (campo opcional)
- [ ] Cancelar o modal → nenhuma ativação ocorre, modal fecha, nenhum toast exibido
- [ ] Verificar em `mcp__supabase__execute_sql` (ou tabela `pregnancies` via Studio) que após ativação os 3 novos campos foram persistidos com os valores literais corretos (`espontaneo`/`induzido`, `balao`/`misoprostol`/`ocitocina`, sem acento)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo

```bash
npx biome lint --write --unsafe apps/web/src/modals/start-labour-modal.tsx apps/web/src/actions/activate-birth-mode-action.ts apps/web/src/lib/validations/birth-mode.ts apps/web/src/lib/birth-mode-constants.ts "apps/web/app/(dashboard)/patients/[id]/profile/page.tsx"
```
**EXPECT**: Sem warnings de class sorting/imports não utilizados

### Level 4: DATABASE_VALIDATION

Usar `mcp__supabase__execute_sql` para confirmar, após um teste manual de ativação:
```sql
select birth_mode_labour_type, birth_mode_induction_type, labour_start_description
from pregnancies
where id = '<pregnancyId testado>';
```
**EXPECT**: Valores condizentes com o que foi preenchido no formulário, usando os literais sem acento

### Level 5: BROWSER_VALIDATION

- [ ] Abrir `/patients/[id]/profile` de uma gestante sem Modo Parto ativo, com usuário obstetra/enfermeira/doula
- [ ] Clicar em "Modo Parto" → modal abre (Dialog em desktop, Sheet em mobile — testar `< 640px`)
- [ ] Selecionar "Induzido" → campo "Tipo de indução" aparece
- [ ] Tentar submeter sem selecionar indução → erro de validação exibido no campo
- [ ] Selecionar indução, submeter → toast de sucesso, redirecionamento para `/modo-parto?pregnancyId=...`
- [ ] Voltar para o profile → botão agora mostra "Abrir Modo Parto" (estado já ativo)

### Level 6: MANUAL_VALIDATION

Repetir o fluxo acima com "Espontâneo" (sem campo de indução) e confirmar que a descrição é realmente opcional (submeter em branco).

---

## Acceptance Criteria

- [ ] Clicar em "Modo Parto" abre o novo formulário, não mais o `confirm()` genérico
- [ ] Ativar sem selecionar tipo de trabalho de parto é bloqueado pelo Zod (`birth_mode_labour_type` obrigatório)
- [ ] Selecionar "Induzido" sem tipo de indução é bloqueado pelo `.refine()`
- [ ] Ao ativar com sucesso, `pregnancies` recebe `birth_mode_active`, `birth_mode_activated_at`, `birth_mode_activated_by`, `birth_mode_labour_type`, `birth_mode_induction_type` (ou null) e `labour_start_description` (ou null) em uma única query
- [ ] Notificações WhatsApp e evento PostHog `activate_birth_mode` continuam disparando normalmente
- [ ] `pnpm check-types` passa sem erros
- [ ] Nenhuma regressão em `handleConfirmDelete`/exclusão de paciente (que ainda usa `useConfirmModal`)

---

## Completion Checklist

- [ ] Task 1: Schema estendido
- [ ] Task 2: Labels adicionadas
- [ ] Task 3: Action estendida
- [ ] Task 4: Modal criado
- [ ] Task 5: Call site atualizado
- [ ] Level 1: `pnpm check-types` + Biome passam
- [ ] Level 4: Dados confirmados no banco via query manual
- [ ] Level 5: Fluxo testado no browser (desktop + mobile)
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| Confundir os valores do enum com as versões acentuadas do PRD (`espontâneo`, `balão`) | Medium | High (erro silencioso de tipo/DB) | Confirmado via migration real e `database.types.ts`: usar sempre `espontaneo`, `induzido`, `balao`, `misoprostol`, `ocitocina` (sem acento) no código; labels em pt-BR com acento só na UI |
| Esquecer de remover a função `handleActivateBirthMode` e o import de `activateBirthModeAction` não utilizado na página, gerando warning de lint | Low | Low | Task 5 lista explicitamente os itens a remover |
| Regressão em `handleConfirmDelete` ao mexer no import de `useConfirmModal` | Low | Medium | Task 5 marca explicitamente para NÃO remover esse import/hook |

---

## Notes

- O modal foi projetado como flat (`ActivateBirthModeInput` no top-level, sem `data: {...}` aninhado) porque `activateBirthModeSchema` já é o schema de input direto de `activateBirthModeAction` — diferente das actions de "add event" (contração, medicamento, etc.) que usam um wrapper `{ pregnancyId, data: eventSchema }`. Isso é intencional e consistente com o schema já existente (`pregnancyId` é um campo irmão, não aninhado).
- `router.push` foi movido do call site da página para dentro do modal, já que a navegação pós-sucesso agora depende do submit do formulário, não mais de um `onConfirm` de dialog genérico.
- Fases 3 e 4 (gating do partograma) são independentes desta fase e podem ser planejadas/implementadas em paralelo (Fase 3 já pode começar, pois só depende da Fase 1/migration, já completa).
