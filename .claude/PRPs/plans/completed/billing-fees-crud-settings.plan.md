# Feature: Billing Fees — CRUD de Taxas + Página de Configurações (Phase 2)

## Summary

Implementa a Phase 2 de 4 do PRD `billing-fees-taxes-discounts`: uma nova página de configurações a nível de empresa (`/settings/billing-deductions`, gate `isManager`) onde gestores criam, editam e desativam taxas/impostos/descontos (`enterprise_billing_fees`, já criada na Phase 1). Cada operação grava um log em `activity_logs` (`actionType: "enterprise"`). Sem lógica de cálculo de taxas em cobranças (Phase 3) nem exibição de valor líquido (Phase 4) — estritamente CRUD + UI de configuração.

## User Story

As a gestor de empresa
I want to cadastrar, editar e desativar taxas (fixas em R$ ou percentuais) em uma página de configurações
So that essas taxas fiquem disponíveis para serem aplicadas automaticamente nas cobranças (Phase 3), com histórico auditável de toda alteração

## Problem Statement

A tabela `enterprise_billing_fees` existe desde a Phase 1 mas não há nenhuma forma de um gestor inserir, editar ou desativar uma taxa — não existe página, server action, nem componente de UI. Sem isso, a Phase 3 (cálculo automático) não tem dados reais para consumir.

## Solution Statement

Duas rotas novas, ambas gated por `isManager(profile)` com `redirect("/home?error=acesso-negado")` caso contrário: (1) `app/(dashboard)/settings/page.tsx` — um hub simples de configurações de empresa, com um card/link para cada seção (nesta fase, apenas "Taxas e Descontos"); (2) `app/(dashboard)/settings/billing-deductions/page.tsx` — a página de CRUD em si. O item de navegação na sidebar/bottom-nav aponta para o hub (`/settings`), **não** diretamente para `/settings/billing-deductions` — isso mantém a navegação estável caso novas seções de configuração sejam adicionadas no futuro (ex: dados da empresa, integrações), sem precisar de mais itens na nav principal. A página de CRUD busca as taxas da empresa via um novo `getEnterpriseBillingFees()` em `src/services/enterprise-billing-fees.ts` e renderiza `BillingDeductionsScreen` (client component em `src/screens`), que lista as taxas em cards, com modais de criar/editar (`ContentModal` + `react-hook-form` + `zodResolver`) e desativação/reativação via `useConfirmModal` (apenas para desativar — reativar é uma ação não-destrutiva direta). Três novas server actions (`create`, `update`, `toggle-active`) usam `authActionClient.inputSchema(...)`, todas restritas a `profile.user_type === "manager"` (verificação inline, pois RLS já bloqueia secretary no INSERT/UPDATE, mas a action deve retornar erro amigável antes de bater na RLS). Cada action chama `insertActivityLog` com `actionType: "enterprise"`.

## Metadata

| Field            | Value                                                          |
| ---------------- | --------------------------------------------------------------- |
| Type             | NEW_CAPABILITY (CRUD + UI)                                      |
| Complexity       | MEDIUM                                                           |
| Systems Affected | `apps/web` (actions, services, validations, screens, modals, routes, nav) |
| Dependencies     | Nenhuma nova — `next-safe-action@^8.1.4` (`.inputSchema()`), `zod@~3.24.1`, `react-hook-form@^7.54.2`, `@hookform/resolvers@^4.1.0`, todas já em uso |
| Estimated Tasks  | 13                                                                |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   Sidebar/BottomNav            Nenhuma rota             enterprise_billing_   ║
║   sem item "Configurações" ──► /settings e         ───►  fees vazia, sem     ║
║                                 /settings/billing-         CRUD                ║
║                                 deductions existem,                           ║
║                                 ambas 404                                     ║
║                                                                                ║
║   USER_FLOW: Gestor não tem como configurar taxas — tabela existe apenas      ║
║   no schema, populada manualmente via SQL se necessário.                      ║
║   PAIN_POINT: Zero UI; toda a Phase 1 fica inacessível ao usuário final.       ║
║   DATA_FLOW: enterprise_billing_fees permanece sempre vazia.                  ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║   Sidebar/BottomNav        /settings (hub, gate         /settings/billing-   ║
║   "Configurações"     ──►  isManager) → card       ──►  deductions →         ║
║   (visível só p/ manager)  "Taxas e Descontos"           enterprise_billing_  ║
║                                                            fees: lista de      ║
║                                                            taxas, create/edit/║
║                                                            deactivate         ║
║                                       │                                       ║
║                                       ▼                                       ║
║                          ┌─────────────────────────┐                         ║
║                          │ BillingDeductionsScreen │ ◄── cards de taxa +     ║
║                          │ + modais                │     badge ativo/inativo║
║                          └─────────────────────────┘                         ║
║                                                                                ║
║   USER_FLOW: Gestor acessa /settings → vê hub com card "Taxas e Descontos"    ║
║   → clica → /settings/billing-deductions → vê lista de taxas → cria nova via  ║
║   ContentModal (nome, tipo fixo/percentual, valor) → edita ou desativa        ║
║   (confirm dialog) qualquer taxa existente.                                   ║
║   VALUE_ADD: Taxas configuráveis sem SQL manual; toda ação fica auditada      ║
║   em activity_logs.                                                          ║
║   DATA_FLOW: Form → Zod validation (client) → server action → Zod             ║
║   validation (server, .inputSchema) → INSERT/UPDATE em                        ║
║   enterprise_billing_fees → insertActivityLog (fire-and-forget) →             ║
║   router.refresh() → lista atualizada.                                        ║
║                                                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User_Action | Impact |
|----------|--------|-------|-------------|--------|
| Sidebar/BottomNav (manager) | Sem item de configurações de empresa | Item "Configurações" visível | Click no item | Navega para `/settings` (hub) |
| `/settings` | 404 (rota não existe) | Hub com card/link "Taxas e Descontos" | Acesso à rota | Vê seções de configuração disponíveis |
| `/settings` (não-manager) | N/A | Redirect para `/home?error=acesso-negado` | Tenta acessar sem ser manager | Bloqueado, mesmo padrão de `/users` |
| `/settings/billing-deductions` | 404 (rota não existe) | Lista de taxas + botão "Nova taxa" | Click no card do hub, ou acesso direto à rota | Vê todas as taxas da empresa (ativas e inativas) |
| `/settings/billing-deductions` (não-manager) | N/A | Redirect para `/home?error=acesso-negado` | Tenta acessar sem ser manager | Bloqueado, mesmo padrão de `/users` |
| Card de taxa | N/A | Nome, tipo, valor formatado, badge ativo/inativo, botões Editar/Desativar(Ativar) | Click "Editar" | Abre `ContentModal` pré-preenchido |
| Card de taxa | N/A | — | Click "Desativar" | `useConfirmModal` → confirma → `is_active = false`, taxa permanece visível (cinza/badge inativo) |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/app/(dashboard)/users/page.tsx` | all (17) | Padrão EXATO de gate + fetch + render a mirror, trocando `isStaff` por `isManager` |
| P0 | `apps/web/src/lib/safe-action.ts` | all (37) | `authActionClient`, shape de `ctx.profile` (`enterprise_id`, `user_type`), `.inputSchema()` (NÃO `.schema()`) |
| P0 | `apps/web/src/lib/activity-log.ts` | all (48) | `insertActivityLog` — assinatura exata, fire-and-forget, `actionType: "enterprise"` já existe na union |
| P0 | `apps/web/src/actions/add-enterprise-professional-action.ts` | all (59) | Action CREATE enterprise-scoped: `.inputSchema()`, `ctx: { user, profile }`, `insertActivityLog` não-awaited |
| P0 | `apps/web/src/actions/update-billing-action.ts` | all (47) | Action UPDATE: `ctx: { supabase, supabaseAdmin, user, profile }`, log condicional |
| P0 | `apps/web/src/lib/validations/billing.ts` | all (104) | Convenção de schema create/update separados, enum derivado de `Database["public"]["Enums"]` |
| P0 | `apps/web/src/lib/access-control.ts` | all (25) | `isManager(profile)` já existe — usar diretamente, sem criar novo helper |
| P0 | `apps/web/src/modals/record-payment-modal.tsx` | all (283) | Padrão COMPLETO de form: `useForm` + `zodResolver` + `Form`/`FormField` + `ContentModal` + `CurrencyInput` + `Select` |
| P1 | `packages/ui/src/hooks/use-confirmation-modal.tsx` + `packages/ui/src/contexts/confirmation-modal-provider.tsx` + `packages/ui/src/shared/confirm-modal/confirm-modal.tsx` | all | `useConfirmModal()` — usar para desativação, NÃO construir modal de confirmação manual |
| P1 | `apps/web/src/components/shared/team-member-card.tsx` | all (92) | Exemplo real e completo de `useConfirmModal` + `useAction` (`onSuccess`/`onError`) + `toast` numa Card |
| P1 | `apps/web/src/components/billing/currency-input.tsx` | all (72) | `CurrencyInput` — reusar para o campo `value` quando `fee_type === "fixed"` (centavos) |
| P1 | `apps/web/src/services/enterprise-users.ts` | all (99) | Padrão de service: `getServerAuth()` + `createServerSupabaseAdmin()`, retorno tipado, fallback enterprise_id vazio |
| P1 | `apps/web/src/screens/users-screen.tsx` | all (201) | Estrutura de screen: `Header` + `PageHeader` + grid de cards + estado de modais via `useState` |
| P1 | `apps/web/src/components/layouts/sidebar.tsx` | 26-40, 52-55 | Onde adicionar item de nav condicional (`navigationStaff` array + `useMemo`) — aponta para `/settings` (hub), não para `/settings/billing-deductions` |
| P1 | `apps/web/src/components/layouts/bottom-nav.tsx` | 75-138 | Onde adicionar item de nav mobile (`mainNav`/`overflowNav` condicionais por `isStaff`/`isManager`) — idem, aponta para `/settings` |
| P2 | `apps/web/src/components/shared/staff-card.tsx` | all (43) | Exemplo simples de Card + Badge para mirror de `BillingFeeCard` e dos cards de seção do hub |
| P2 | `apps/web/src/components/shared/page-header.tsx` | all | `PageHeader` — título + slot de ações (botão "Nova taxa") |
| P2 | `apps/web/src/components/shared/empty-state.tsx` | all | `EmptyState` para lista vazia de taxas |
| P2 | `apps/web/src/lib/billing/calculations.ts` | 61-66 | `formatCurrency(cents)` — reusar para exibir valor de taxas `fixed` |
| P2 | `packages/supabase/src/types/database.types.ts` | buscar `enterprise_billing_fees` e `billing_fee_type` | Confirmar shape exato gerado (`fee_type`, `value: number`, `is_active: boolean`) |

**External Documentation:**

Nenhuma nova dependência é introduzida nesta fase — todas as libs (`next-safe-action@^8.1.4`, `zod@~3.24.1`, `react-hook-form@^7.54.2`, `@hookform/resolvers@^4.1.0`) já estão em uso ativo no monorepo com os mesmos padrões que esta fase replica. Não há gotcha de versão a documentar além do já confirmado pela exploração do código: `next-safe-action@^8.x` usa `.inputSchema()`, não `.schema()` (mudança de API entre v7→v8, já adotada em 100% dos 77 arquivos de actions existentes).

---

## Patterns to Mirror

**PAGE_GATE (manager-only, mirror exato trocando isStaff→isManager):**
```tsx
// SOURCE: apps/web/app/(dashboard)/users/page.tsx:1-17
import { isStaff } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { UsersScreen } from "@/screens";
import { getEnterpriseUsers } from "@/services/enterprise-users";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const { profile } = await getServerAuth();

  if (!isStaff(profile)) {
    redirect("/home?error=acesso-negado");
  }

  const { professionals, staff } = await getEnterpriseUsers();

  return <UsersScreen professionals={professionals} staff={staff} />;
}
```

**SERVER_ACTION_CREATE (enterprise-scoped, COPIAR shape exato):**
```ts
// SOURCE: apps/web/src/actions/add-enterprise-professional-action.ts (full file)
"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import { z } from "zod";

export const addEnterpriseProfessionalAction = authActionClient
  .inputSchema(z.object({ email: z.string().email() }))
  .action(async ({ parsedInput: { email }, ctx: { user, profile } }) => {
    if (!profile?.enterprise_id) {
      throw new Error("Você não está associado a nenhuma organização.");
    }
    // ... lógica
    insertActivityLog({
      supabaseAdmin,
      actionName: "Profissional adicionada à organização",
      description: `${targetUser.name} foi adicionada à organização`,
      actionType: "enterprise",
      userId: user.id,
      enterpriseId: profile.enterprise_id,
      metadata: { professional_id: targetUser.id, professional_email: targetUser.email },
    });

    return { name: targetUser.name, email: targetUser.email };
  });
```

**SERVER_ACTION_UPDATE (ctx destructure completo):**
```ts
// SOURCE: apps/web/src/actions/update-billing-action.ts (full file)
export const updateBillingAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: billing, error } = await supabase
      .from("billings")
      .update({ status: parsedInput.status })
      .eq("id", parsedInput.billingId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      insertActivityLog({ supabaseAdmin, actionName: "...", description: "...", actionType: "billing", userId: user.id, enterpriseId: profile.enterprise_id });
    }

    return { billing };
  });
```

**VALIDATION_SCHEMA (enum derivado do DB, create/update separados):**
```ts
// SOURCE: apps/web/src/lib/validations/billing.ts:1-13, 101-103 (adaptado)
import type { Database } from "@ventre/supabase/types";
import { z } from "zod";

type BillingFeeType = Database["public"]["Enums"]["billing_fee_type"];

const feeTypes = ["fixed", "percentage"] as const satisfies readonly BillingFeeType[];

export const createBillingFeeSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  fee_type: z.enum(feeTypes, { required_error: "Tipo de taxa é obrigatório" }),
  value: z.number().positive("Valor deve ser positivo"),
}).refine(
  (data) => data.fee_type !== "percentage" || data.value <= 100,
  { message: "Percentual não pode ser maior que 100", path: ["value"] },
);

export type CreateBillingFeeInput = z.infer<typeof createBillingFeeSchema>;
```

**CONFIRM_MODAL_TOGGLE (deactivate, useConfirmModal — NÃO criar modal manual):**
```tsx
// SOURCE: apps/web/src/components/shared/team-member-card.tsx:9,28,30-38,42-52
import { useConfirmModal } from "@ventre/ui/hooks/use-confirmation-modal";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

const { confirm } = useConfirmModal();

const { executeAsync: executeToggle } = useAction(toggleBillingFeeActiveAction, {
  onSuccess: () => toast.success("Taxa desativada com sucesso"),
  onError: ({ error }) => toast.error(error.serverError ?? "Erro ao desativar taxa"),
});

function handleDeactivate() {
  confirm({
    title: "Desativar taxa",
    description: `Tem certeza que deseja desativar "${fee.name}"? Cobranças futuras deixarão de receber essa taxa.`,
    confirmLabel: "Desativar",
    variant: "destructive",
    onConfirm: async () => {
      await executeToggle({ id: fee.id, is_active: false });
    },
  });
}
```

**FORM_MODAL (react-hook-form + zodResolver + ContentModal + CurrencyInput):**
```tsx
// SOURCE: apps/web/src/modals/record-payment-modal.tsx:1-18, 43-51, 66-96, 104-167 (adaptado)
import { CurrencyInput } from "@/components/billing/currency-input";
import { type CreateBillingFeeInput, createBillingFeeSchema } from "@/lib/validations/enterprise-billing-fees";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventre/ui/select";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { useAction } from "next-safe-action/hooks";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const form = useForm<CreateBillingFeeInput>({
  resolver: zodResolver(createBillingFeeSchema),
  defaultValues: { name: "", fee_type: "fixed", value: 0 },
});

const { executeAsync, isPending } = useAction(createBillingFeeAction);

async function onSubmit(data: CreateBillingFeeInput) {
  const result = await executeAsync(data);
  if (result?.serverError) {
    toast.error(result.serverError);
    return;
  }
  toast.success("Taxa criada com sucesso");
  form.reset();
  onSuccess?.();
  setShowModal(false);
}
```

**NAV_ITEM_CONDITIONAL (sidebar, manager-only, aponta para o hub `/settings`):**
```tsx
// SOURCE: apps/web/src/components/layouts/sidebar.tsx:26-40,52-55 (adaptado)
const navigationManager = [
  ...navigationStaff,
  { name: "Configurações", href: "/settings", icon: Settings },
];

const navigation = useMemo(() => {
  if (isManager(profile)) return navigationManager;
  if (isStaff(profile)) return navigationStaff;
  return navigationProfessionals;
}, [profile]);
```

**SETTINGS_HUB_LINK_CARD (hub → seção, simples link estático):**
```tsx
// Inspirado em staff-card.tsx (Card+CardContent) e PageHeader, sem precedente exato no repo
import Link from "next/link";
import { ChevronRight, Percent } from "lucide-react";
import { Card, CardContent } from "@ventre/ui/card";

<Link href="/settings/billing-deductions">
  <Card className="transition-colors hover:bg-muted/40">
    <CardContent className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Percent className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1">
        <p className="font-medium">Taxas e Descontos</p>
        <p className="text-muted-foreground text-sm">Configure taxas fixas e percentuais aplicadas às cobranças</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </CardContent>
  </Card>
</Link>
```

**SERVICE_FETCH (mirror de getEnterpriseUsers, mais simples):**
```ts
// SOURCE: apps/web/src/services/enterprise-users.ts:1-27 (adaptado, sem joins complexos)
import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";

export async function getEnterpriseBillingFees(): Promise<Tables<"enterprise_billing_fees">[]> {
  const { profile } = await getServerAuth();
  if (!profile?.enterprise_id) return [];

  const supabaseAdmin = await createServerSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("enterprise_billing_fees")
    .select("*")
    .eq("enterprise_id", profile.enterprise_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getEnterpriseBillingFees]", error.message);
    return [];
  }

  return data;
}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `apps/web/src/lib/validations/enterprise-billing-fees.ts` | CREATE | Zod schemas `createBillingFeeSchema`/`updateBillingFeeSchema`, reuso form ↔ action |
| `apps/web/src/services/enterprise-billing-fees.ts` | CREATE | `getEnterpriseBillingFees()` — fetch server-side para a página |
| `apps/web/src/actions/create-billing-fee-action.ts` | CREATE | Action de criação, manager-only, com `insertActivityLog` |
| `apps/web/src/actions/update-billing-fee-action.ts` | CREATE | Action de edição (nome/tipo/valor), manager-only, com `insertActivityLog` |
| `apps/web/src/actions/toggle-billing-fee-active-action.ts` | CREATE | Action de ativar/desativar (`is_active`), manager-only, com `insertActivityLog` |
| `apps/web/src/components/shared/billing-fee-card.tsx` | CREATE | Card de exibição de uma taxa (nome, tipo, valor formatado, badge, ações) |
| `apps/web/src/modals/billing-fee-form-modal.tsx` | CREATE | Modal único reusado para criar E editar (props opcionais `fee?`) |
| `apps/web/src/screens/billing-deductions-screen.tsx` | CREATE | Screen client component da página de CRUD: lista + estado de modais |
| `apps/web/src/screens/settings-screen.tsx` | CREATE | Screen do hub `/settings`: grid de cards-link para cada seção de configuração (nesta fase, só "Taxas e Descontos") |
| `apps/web/src/screens/index.ts` | UPDATE | Adicionar `export { default as BillingDeductionsScreen }` e `export { default as SettingsScreen }` |
| `apps/web/app/(dashboard)/settings/page.tsx` | CREATE | Server Component, gate `isManager`, render `SettingsScreen` (hub, sem fetch) |
| `apps/web/app/(dashboard)/settings/billing-deductions/page.tsx` | CREATE | Server Component, gate `isManager`, fetch `getEnterpriseBillingFees`, render `BillingDeductionsScreen` |
| `apps/web/src/components/layouts/sidebar.tsx` | UPDATE | Adicionar item "Configurações" (`href: "/settings"`) condicional a `isManager` |
| `apps/web/src/components/layouts/bottom-nav.tsx` | UPDATE | Adicionar item "Configurações" (`href: "/settings"`) no overflow nav condicional a `isManager` |

---

## NOT Building (Scope Limits)

- **Cálculo/aplicação automática de taxas em cobranças** — Phase 3. Esta fase não toca `calculations.ts` nem `services/billing.ts`.
- **Exibição de valor líquido para o profissional** — Phase 4.
- **Edição de `fee_type` após criação** — o formulário de edição permite editar `name` e `value`, mas **não** `fee_type`, para evitar ambiguidade de interpretação do campo `value` (cents vs percentual) em taxas já potencialmente referenciadas por cobranças futuras com lógica de cálculo ainda não implementada. Se o gestor errar o tipo, deve desativar e criar uma nova taxa.
- **Hard delete de taxas** — soft-delete via `is_active` apenas (RLS da Phase 1 já não permite DELETE para `authenticated`).
- **Taxas por profissional individual ou por tipo de serviço** — fora de escopo do PRD inteiro (Won't Build).
- **Paginação da lista de taxas** — volume esperado é baixo (poucas taxas por empresa); grid simples sem paginação, como `/users`.
- **Reordenação/priorização manual de taxas** — ordem de aplicação é responsabilidade da Phase 3, não desta fase de CRUD.

---

## Step-by-Step Tasks

### Task 1: CREATE `apps/web/src/lib/validations/enterprise-billing-fees.ts`

- **ACTION**: CREATE arquivo de validação Zod
- **IMPLEMENT**:
  - `createBillingFeeSchema`: `name` (string, min 2 max 100), `fee_type` (enum `["fixed","percentage"]` derivado de `Database["public"]["Enums"]["billing_fee_type"]`), `value` (number, positive) — com `.refine()` para `value <= 100` quando `fee_type === "percentage"`.
  - `updateBillingFeeSchema`: `name` (optional), `value` (optional, positive) — **sem `fee_type`** (NOT_BUILDING acima).
  - `toggleBillingFeeActiveSchema`: `id` (uuid), `is_active` (boolean).
  - Exportar `CreateBillingFeeInput`, `UpdateBillingFeeInput`, `ToggleBillingFeeActiveInput` via `z.infer`.
- **MIRROR**: `apps/web/src/lib/validations/billing.ts:1-13,67-80,101-103`
- **IMPORTS**: `import type { Database } from "@ventre/supabase/types"; import { z } from "zod";`
- **GOTCHA**: `value` no banco é `numeric(12,3)` compartilhado entre fixed (centavos inteiros, ex: `1500`) e percentage (ex: `12.5`) — o schema Zod NÃO precisa diferenciar a escala (isso é responsabilidade da Phase 3/UI), apenas validar `> 0` e `<= 100` quando percentual. Para `fixed`, usar `.int()` adicional pois é sempre centavos inteiros: `value: z.number().positive()` mas refinar `Number.isInteger(value)` quando `fee_type === "fixed"`.
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/src/services/enterprise-billing-fees.ts`

- **ACTION**: CREATE service de leitura
- **IMPLEMENT**: `getEnterpriseBillingFees(): Promise<Tables<"enterprise_billing_fees">[]>` — usa `getServerAuth()` + `createServerSupabaseAdmin()`, filtra por `enterprise_id`, ordena por `created_at desc`, retorna `[]` se sem `enterprise_id` ou erro.
- **MIRROR**: `apps/web/src/services/enterprise-users.ts:1-27`
- **IMPORTS**: `import { getServerAuth } from "@/lib/server-auth"; import { createServerSupabaseAdmin } from "@ventre/supabase/server"; import type { Tables } from "@ventre/supabase/types";`
- **GOTCHA**: Usar `supabaseAdmin` (não `supabase` anon) pois a página Server Component não tem sessão RLS-friendly direta neste padrão — mesma escolha de `getEnterpriseUsers`. RLS staff-select já permitiria, mas seguir o precedente exato evita inconsistência.
- **VALIDATE**: `pnpm check-types`

### Task 3: CREATE `apps/web/src/actions/create-billing-fee-action.ts`

- **ACTION**: CREATE server action
- **IMPLEMENT**: `createBillingFeeAction = authActionClient.inputSchema(createBillingFeeSchema).action(...)` — verifica `profile.user_type === "manager"` (throw `"Apenas gestores podem criar taxas."` caso contrário, mensagem amigável antes de bater no RLS), verifica `profile.enterprise_id` (throw se ausente), insere via `ctx.supabase` (respeitando RLS, já que só manager passa), `insertActivityLog` com `actionType: "enterprise"`, `actionName: "Taxa de cobrança criada"`, `description: \`Taxa "${name}" criada (${fee_type === "fixed" ? formatCurrency(value) : \`${value}%\`})\``.
- **MIRROR**: `apps/web/src/actions/add-enterprise-professional-action.ts` (shape completo), `apps/web/src/actions/add-billing-action.ts` (uso de `ctx: { supabase, supabaseAdmin, user, profile }`)
- **IMPORTS**: `import { insertActivityLog } from "@/lib/activity-log"; import { authActionClient } from "@/lib/safe-action"; import { createBillingFeeSchema } from "@/lib/validations/enterprise-billing-fees"; import { formatCurrency } from "@/lib/billing/calculations";`
- **GOTCHA**: `insertActivityLog` NÃO deve ser `await`-ado (fire-and-forget, padrão confirmado em todos os call sites existentes).
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/actions/update-billing-fee-action.ts`

- **ACTION**: CREATE server action
- **IMPLEMENT**: `updateBillingFeeAction = authActionClient.inputSchema(updateBillingFeeSchema.extend({ id: z.string().uuid() })).action(...)` — mesma checagem de `user_type === "manager"`, `UPDATE` em `enterprise_billing_fees` filtrando por `id` E `enterprise_id` (defesa em profundidade além do RLS), `insertActivityLog` com `actionName: "Taxa de cobrança atualizada"`.
- **MIRROR**: `apps/web/src/actions/update-billing-action.ts` (shape completo)
- **IMPORTS**: idem Task 3 + `updateBillingFeeSchema`
- **GOTCHA**: Filtrar `.eq("enterprise_id", profile.enterprise_id)` no UPDATE, não confiar apenas na RLS — padrão de defesa em profundidade já documentado em `CLAUDE.md`/`supabase.md` ("Valide permissões na action antes de executar a query, mesmo com RLS ativo").
- **VALIDATE**: `pnpm check-types`

### Task 5: CREATE `apps/web/src/actions/toggle-billing-fee-active-action.ts`

- **ACTION**: CREATE server action
- **IMPLEMENT**: `toggleBillingFeeActiveAction = authActionClient.inputSchema(toggleBillingFeeActiveSchema).action(...)` — `UPDATE enterprise_billing_fees SET is_active = $is_active WHERE id = $id AND enterprise_id = $enterprise_id`, `insertActivityLog` com `actionName: is_active ? "Taxa de cobrança ativada" : "Taxa de cobrança desativada"`.
- **MIRROR**: `apps/web/src/actions/update-billing-action.ts`
- **IMPORTS**: idem Task 3 + `toggleBillingFeeActiveSchema`
- **GOTCHA**: Esta é a action usada tanto para desativar (via `useConfirmModal`, destructive) quanto para reativar (chamada direta, sem confirm) — o componente decide a UX, a action é simétrica.
- **VALIDATE**: `pnpm check-types`

### Task 6: CREATE `apps/web/src/components/shared/billing-fee-card.tsx`

- **ACTION**: CREATE componente de apresentação
- **IMPLEMENT**: `BillingFeeCard({ fee, onEdit, onToggleActive }: { fee: Tables<"enterprise_billing_fees">; onEdit: () => void; onToggleActive: () => void })` — `Card` com nome, `Badge` de tipo (Fixo/Percentual), valor formatado (`formatCurrency(fee.value)` se fixed, `${fee.value}%` se percentage), `Badge` ativo/inativo (`variant="outline"` ativo, `variant="secondary"` ou classe `opacity-60` inativo), botões "Editar" (sempre) e "Desativar"/"Ativar" (label condicional a `fee.is_active`).
- **MIRROR**: `apps/web/src/components/shared/staff-card.tsx` (estrutura Card+Badge), `apps/web/src/components/shared/team-member-card.tsx` (botão de ação com ícone)
- **IMPORTS**: `import type { Tables } from "@ventre/supabase/types"; import { formatCurrency } from "@/lib/billing/calculations"; import { Badge } from "@ventre/ui/badge"; import { Button } from "@ventre/ui/button"; import { Card, CardContent } from "@ventre/ui/card"; import { Pencil, Power } from "lucide-react";`
- **GOTCHA**: Não criar lógica de `useConfirmModal`/`useAction` dentro deste componente puramente apresentacional — receber `onEdit`/`onToggleActive` como callbacks (padrão `ui-tailwind.md`: "Componentes de UI devem ser controlados via props"). A lógica de confirm fica no componente pai (`SettingsScreen` ou um wrapper client).
- **VALIDATE**: `pnpm check-types`

### Task 7: CREATE `apps/web/src/modals/billing-fee-form-modal.tsx`

- **ACTION**: CREATE modal de criar/editar (componente único reusado)
- **IMPLEMENT**: `BillingFeeFormModal({ fee, showModal, setShowModal, onSuccess }: { fee?: Tables<"enterprise_billing_fees"> | null; ... })` — `useForm` com `zodResolver(fee ? updateBillingFeeSchema : createBillingFeeSchema)`, `useEffect` para `form.reset()` quando `fee`/`showModal` mudam (mirror do padrão em `record-payment-modal.tsx:53-64`), campos: `name` (`Input`), `fee_type` (`Select`, **desabilitado** se `fee` existe — não editável, ver NOT_BUILDING), `value` (condicional: `CurrencyInput` se `fee_type === "fixed"`, `Input type="number"` com sufixo "%" se `percentage` — observar `form.watch("fee_type")` para alternar). `useAction` chamando `createBillingFeeAction` ou `updateBillingFeeAction` conforme `fee` existe.
- **MIRROR**: `apps/web/src/modals/record-payment-modal.tsx` (estrutura completa de form+modal), `apps/web/src/components/billing/currency-input.tsx` (uso do componente)
- **IMPORTS**: `ContentModal` de `@ventre/ui/shared/content-modal`, `Form`/`FormField`/etc de `@ventre/ui/form`, `Select` de `@ventre/ui/select`, `useForm` de `react-hook-form`, `zodResolver` de `@hookform/resolvers/zod`, `toast` de `sonner`, `useAction` de `next-safe-action/hooks`
- **GOTCHA 1**: Como `fee_type` não é editável no modo edição (Task 4 scope), renderizar o `Select` com `disabled` quando `fee` existe, e ainda assim incluir o campo no formulário (apenas leitura) para contexto visual — `value` precisa saber qual `fee_type` está ativo para escolher `CurrencyInput` vs `Input number`.
- **GOTCHA 2**: `CurrencyInput.onChange` retorna `valueInCents` (number) — compatível diretamente com `field.onChange` do RHF, igual ao uso em `record-payment-modal.tsx:162`.
- **VALIDATE**: `pnpm check-types`

### Task 8: CREATE `apps/web/src/screens/billing-deductions-screen.tsx`

- **ACTION**: CREATE client component de tela (página de CRUD)
- **IMPLEMENT**: `BillingDeductionsScreen({ fees }: { fees: Tables<"enterprise_billing_fees">[] })` — `Header title="Taxas e Descontos" back="/settings"` + `PageHeader` com botão "Nova taxa" (responsivo ícone-only mobile / texto desktop, mirror `users-screen.tsx:67-81`), grid de `BillingFeeCard` (ou `EmptyState` se `fees.length === 0`), estado local para modal de criar/editar (`feeToEdit: Tables<"enterprise_billing_fees"> | null`, `showFormModal: boolean`), `useConfirmModal` + `useAction(toggleBillingFeeActiveAction)` para o fluxo de desativar/ativar (confirm só quando `is_active → false`), `router.refresh()` em todo `onSuccess`.
- **MIRROR**: `apps/web/src/screens/users-screen.tsx` (estrutura geral), `apps/web/src/components/shared/team-member-card.tsx` (uso de `useConfirmModal`)
- **IMPORTS**: `Header`, `PageHeader`, `EmptyState`, `BillingFeeCard`, `BillingFeeFormModal`, `useConfirmModal` de `@ventre/ui/hooks/use-confirmation-modal`, `useAction`, `toast`, `useRouter`, `Percent` (ícone vazio) de `lucide-react`
- **GOTCHA**: Diferente de `team-member-card.tsx` (onde o confirm está dentro do card), aqui o confirm fica na screen (pai), e `BillingFeeCard` apenas dispara `onToggleActive` — decisão consciente para manter `BillingFeeCard` puramente apresentacional (ver Task 6 GOTCHA). Usar `Header back="/settings"` (prop `back` de `apps/web/src/components/layouts/header.tsx`) para permitir voltar ao hub.
- **VALIDATE**: `pnpm check-types`

### Task 9: CREATE `apps/web/src/screens/settings-screen.tsx`

- **ACTION**: CREATE client component do hub de configurações
- **IMPLEMENT**: `SettingsScreen()` (sem props — nesta fase não há dados a buscar, é só navegação) — `Header title="Configurações"` + `PageHeader` + grid com um único `Link`+`Card` ("Taxas e Descontos" → `/settings/billing-deductions`, ver padrão `SETTINGS_HUB_LINK_CARD`). Estrutura pensada para crescer (futuras seções viram novos cards no mesmo grid), mas **não construir** nenhum mecanismo de registro dinâmico de seções nesta fase — array estático de um item é suficiente (YAGNI).
- **MIRROR**: `apps/web/src/screens/users-screen.tsx` (estrutura `Header`+`PageHeader`), `apps/web/src/components/shared/staff-card.tsx` (Card+CardContent)
- **IMPORTS**: `Header`, `PageHeader`, `Card`/`CardContent` de `@ventre/ui/card`, `Link` de `next/link`, `ChevronRight`/`Percent` de `lucide-react`
- **GOTCHA**: Esta screen é puramente de navegação — sem `useState`, sem actions, sem fetch. Não adicionar `"use client"` desnecessariamente seria ideal, mas como faz parte do barrel `src/screens` (todas client components no padrão atual do repo, ex.: `users-screen.tsx:1`), manter `"use client"` por consistência.
- **VALIDATE**: `pnpm check-types`

### Task 10: UPDATE `apps/web/src/screens/index.ts`

- **ACTION**: ADD exports
- **IMPLEMENT**: `export { default as BillingDeductionsScreen } from "./billing-deductions-screen";` e `export { default as SettingsScreen } from "./settings-screen";` (ordem alfabética, junto aos demais)
- **MIRROR**: `apps/web/src/screens/index.ts:13` (`UsersScreen`)
- **VALIDATE**: `pnpm check-types`

### Task 11: CREATE `apps/web/app/(dashboard)/settings/page.tsx`

- **ACTION**: CREATE rota Server Component (hub)
- **IMPLEMENT**: Gate `isManager(profile)` → `redirect("/home?error=acesso-negado")`, render `<SettingsScreen />` (sem fetch — a screen é estática nesta fase).
- **MIRROR**: `apps/web/app/(dashboard)/users/page.tsx` (mirror do gate, trocar `isStaff`→`isManager`; sem a parte de fetch/data, já que o hub não tem dados)
- **IMPORTS**: `import { isManager } from "@/lib/access-control"; import { getServerAuth } from "@/lib/server-auth"; import { SettingsScreen } from "@/screens"; import { redirect } from "next/navigation";`
- **VALIDATE**: `pnpm check-types`

### Task 12: CREATE `apps/web/app/(dashboard)/settings/billing-deductions/page.tsx`

- **ACTION**: CREATE rota Server Component (CRUD)
- **IMPLEMENT**: Gate `isManager(profile)` → `redirect("/home?error=acesso-negado")`, fetch `getEnterpriseBillingFees()`, render `<BillingDeductionsScreen fees={fees} />`.
- **MIRROR**: `apps/web/app/(dashboard)/users/page.tsx` (mirror exato, trocar `isStaff`→`isManager`, `getEnterpriseUsers`→`getEnterpriseBillingFees`, `UsersScreen`→`BillingDeductionsScreen`)
- **IMPORTS**: `import { isManager } from "@/lib/access-control"; import { getServerAuth } from "@/lib/server-auth"; import { BillingDeductionsScreen } from "@/screens"; import { getEnterpriseBillingFees } from "@/services/enterprise-billing-fees"; import { redirect } from "next/navigation";`
- **GOTCHA**: Esta rota é gated de forma independente do hub (`/settings`) — um acesso direto via URL a `/settings/billing-deductions` deve funcionar e ser gated igualmente, sem depender de navegação prévia pelo hub.
- **VALIDATE**: `pnpm check-types`

### Task 13: UPDATE `apps/web/src/components/layouts/sidebar.tsx` e `apps/web/src/components/layouts/bottom-nav.tsx`

- **ACTION**: ADD item de navegação condicional a `isManager`, apontando para o hub
- **IMPLEMENT (sidebar.tsx)**: Importar `isManager` de `@/lib/access-control` e ícone `Settings` de `lucide-react`. Criar `navigationManager = [...navigationStaff, { name: "Configurações", href: "/settings", icon: Settings }]`. Atualizar `useMemo` de `navigation` para: `isManager(profile) ? navigationManager : isStaff(profile) ? navigationStaff : navigationProfessionals`.
- **IMPLEMENT (bottom-nav.tsx)**: Adicionar item "Configurações" (`href: "/settings"`) ao array `overflowNav` quando `isManager(profile)` (junto com "Financeiro" já presente), reaproveitando o slot "Ellipsis"/overflow já existente — NÃO adicionar ao `mainNav` (já tem 4 itens fixos, manter layout).
- **MIRROR**: `apps/web/src/components/layouts/sidebar.tsx:26-55`, `apps/web/src/components/layouts/bottom-nav.tsx:75-138`
- **GOTCHA**: `bottom-nav.tsx` já importa `isStaff` de `@/lib/access-control` — adicionar `isManager` ao mesmo import existente (linha 3), não duplicar import statement. O item de nav SEMPRE aponta para `/settings` (hub), nunca diretamente para `/settings/billing-deductions` — navegar até o CRUD é responsabilidade do card dentro do hub (Task 9).
- **VALIDATE**: `pnpm check-types` e inspeção visual manual (Level 6)

---

## Testing Strategy

### Unit Tests to Write

Este monorepo não tem suíte de testes unitários estabelecida para actions/services (nenhum `*.test.ts` encontrado nos arquivos de precedente explorados — `add-enterprise-professional-action.ts`, `update-billing-action.ts` não têm testes irmãos). Seguindo o padrão existente, **nenhum teste automatizado é escrito nesta fase** — validação via Level 1 (types) + Level 4 (database) + Level 5/6 (manual/browser), consistente com o resto do código de actions do projeto.

### Edge Cases Checklist

- [ ] Criar taxa `fee_type = "fixed"`, `value = 1500` (R$15,00) → sucesso, aparece na lista
- [ ] Criar taxa `fee_type = "percentage"`, `value = 12.5` → sucesso
- [ ] Criar taxa `fee_type = "percentage"`, `value = 150` → bloqueado no client (Zod `.refine`) antes de chegar à action
- [ ] Criar taxa `fee_type = "fixed"`, `value = 0` → bloqueado no client (`.positive()`)
- [ ] Usuário `secretary` tentando acessar `/settings` ou `/settings/billing-deductions` diretamente via URL → `redirect("/home?error=acesso-negado")` em ambas
- [ ] Usuário `secretary` tentando chamar `createBillingFeeAction` diretamente (bypass UI) → action retorna erro amigável antes do INSERT (checagem `user_type === "manager"`), E RLS bloquearia de qualquer forma como segunda camada
- [ ] Editar taxa existente, mudar `name` e `value`, manter `fee_type` → sucesso, `fee_type` permanece inalterado (campo disabled na UI)
- [ ] Desativar taxa ativa → `useConfirmModal` aparece, confirma → `is_active = false`, card mostra badge "Inativa"
- [ ] Reativar taxa inativa → ação direta sem confirm, `is_active = true`
- [ ] Cada criação/edição/desativação/reativação gera uma entrada em `activity_logs` com `action_type = "enterprise"`
- [ ] Lista vazia (nenhuma taxa cadastrada) → `EmptyState` exibido com CTA "Nova taxa"
- [ ] Gestor de empresa A não vê/edita taxas de empresa B (RLS + filtro `enterprise_id` na action)

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```
**EXPECT**: Exit 0, sem erros de tipo em todos os 13 arquivos novos/alterados

### Level 4: DATABASE_VALIDATION

Usar Supabase MCP (`mcp__supabase__execute_sql`) para confirmar, após testes manuais via UI:

- [ ] Taxa criada via UI aparece em `enterprise_billing_fees` com `enterprise_id` correto e `created_by` preenchido
- [ ] Entrada correspondente em `activity_logs` com `action_type = 'enterprise'`, `metadata` contendo referência à taxa
- [ ] `is_active` alterna corretamente entre `true`/`false` via UPDATE
- [ ] Nenhuma linha de `enterprise_billing_fees` de outra empresa aparece nas queries da action (filtro `enterprise_id` funcionando)

### Level 5: BROWSER_VALIDATION

Usar Browser MCP / `/run` skill para verificar end-to-end:

- [ ] Login como `manager` → item "Configurações" visível na sidebar/bottom-nav → leva ao hub `/settings`
- [ ] No hub `/settings`, clicar no card "Taxas e Descontos" → navega para `/settings/billing-deductions`
- [ ] Login como `secretary` ou `professional` → item "Configurações" **não** visível, e acesso direto a `/settings` ou `/settings/billing-deductions` redireciona
- [ ] Criar taxa fixa via modal → toast de sucesso → card aparece na lista
- [ ] Criar taxa percentual via modal → toast de sucesso → card aparece com `%`
- [ ] Editar taxa → campo `fee_type` desabilitado, `name`/`value` editáveis → salva corretamente
- [ ] Desativar taxa → `ConfirmModal` (Dialog desktop / Sheet mobile) aparece → confirma → badge muda para "Inativa"
- [ ] Reativar taxa inativa → sem confirm, badge volta para "Ativa"
- [ ] Testar em viewport mobile (`< 640px`) → `ContentModal` renderiza como `Sheet` bottom, não `Dialog`

### Level 6: MANUAL_VALIDATION

1. Aplicar nenhuma migration nova (Phase 1 já aplicada) — apenas `pnpm check-types` na raiz.
2. Testar fluxo completo como descrito em Level 5, com pelo menos 2 contas de teste (`manager` e `secretary`) na mesma empresa.
3. Confirmar no Supabase Studio/MCP que os logs de auditoria batem com as ações realizadas na UI.

---

## Acceptance Criteria

- [ ] Gestor consegue criar, editar (nome/valor) e desativar/reativar taxas via `/settings/billing-deductions`, alcançado a partir do hub `/settings`
- [ ] `secretary`/`professional`/`patient` não acessam `/settings` nem `/settings/billing-deductions` (redirect) nem conseguem chamar as actions com sucesso
- [ ] Toda criação/edição/toggle gera entrada em `activity_logs` com `actionType: "enterprise"`
- [ ] `fee_type` não é editável após criação (apenas no momento da criação)
- [ ] UI responsiva: `ContentModal`/`ConfirmModal` alternam Dialog↔Sheet conforme viewport
- [ ] `pnpm check-types` passa sem erros em todo o monorepo
- [ ] Nenhuma lógica de cálculo de taxas em cobranças foi escrita (escopo estritamente CRUD/UI — Phase 3 fica intacta)

---

## Completion Checklist

- [ ] Tasks 1-13 completas em ordem de dependência
- [ ] Level 1: `pnpm check-types` passa
- [ ] Level 4: validação via Supabase MCP confirma dados e activity_logs
- [ ] Level 5: validação via browser cobre todos os fluxos (manager/secretary, criar/editar/desativar/reativar, mobile/desktop)
- [ ] Level 6: validação manual com múltiplas contas
- [ ] Todos os acceptance criteria atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Gestor editar `value` de uma taxa `fixed` confundindo reais com centavos (campo `CurrencyInput` já abstrai isso, mas `percentage` usa `Input` number cru) | M | M | `CurrencyInput` exibe "R$" e formata automaticamente; campo percentual usa sufixo "%" visível no form; testar visualmente em Level 5 |
| Ação de toggle (`is_active`) ser chamada para reativar uma taxa sem nenhuma confirmação, causando reativação acidental | L | L | Reativação é não-destrutiva por natureza (não afeta cobranças já criadas — snapshot é imutável); aceitável não ter confirm, mas o botão deve ter label e cor visualmente distintas de "Desativar" |
| `fee_type` ficar inconsistente se o `Select` desabilitado no modo edição não enviar o valor correto no `inputSchema` | M | M | `updateBillingFeeSchema` não inclui `fee_type` no payload — mesmo que o `Select` renderize o valor atual, ele nunca é enviado à action de update, eliminando o risco na origem |
| Nova rota `/settings` colidir semanticamente com `/profile/settings` existente (confusão de nomenclatura para o usuário) | L | L | Rotas são tecnicamente distintas (`/settings` vs `/profile/settings`); nav label "Configurações" (empresa) vs settings de perfil ficam em menus diferentes (sidebar/bottom-nav vs `/profile`) — aceito como está, fora de escopo renomear |
| Hub `/settings` com um único card poder parecer "vazio"/desnecessário até que mais seções existam | M | L | Aceito conscientemente — a indireção via hub foi pedido explícito (nav não deve apontar direto para `/settings/billing-deductions`), prepara o terreno para futuras seções de configuração sem exigir retrabalho de navegação |

---

## Notes

- Esta é a Phase 2 de 4 do PRD `.claude/PRPs/prds/billing-fees-taxes-discounts.prd.md`. Phase 1 (schema) está `complete`. Phase 3 (aplicação automática em cobranças) também depende apenas da Phase 1 e pode ser desenvolvida em paralelo a esta, em outro worktree, já que toca arquivos completamente diferentes (`calculations.ts`, `services/billing.ts`) sem overlap com os arquivos desta fase.
- A decisão de não permitir editar `fee_type` após criação é uma escolha de implementação desta fase (não estava explícita no PRD) — motivada por reduzir ambiguidade de interpretação do campo `value` (numeric compartilhado) e por simplicidade de UX. Documentada em NOT_BUILDING; se o produto precisar permitir, é uma mudança pequena e isolada (remover `disabled` do Select e ajustar `updateBillingFeeSchema`).
- `useConfirmModal` (`packages/ui`) já existe e cobre exatamente o caso de "desativação com confirmação" usado em todo o app (`team-member-card.tsx` é o precedente mais próximo) — não há necessidade de criar um modal de confirmação dedicado para taxas.
- Nenhuma migration nova é necessária nesta fase — a tabela e RLS já foram criadas na Phase 1.
- A indireção `/settings` (hub) → `/settings/billing-deductions` (CRUD) foi uma decisão explícita do usuário durante o planejamento: o item de navegação principal não deve apontar diretamente para a página de taxas, e sim para uma página de configurações de empresa que, nesta fase, contém um único link/card para "Taxas e Descontos". Isso evita que a nav precise ser refeita quando novas seções de configuração forem adicionadas no futuro (ex: dados da empresa, integrações).
