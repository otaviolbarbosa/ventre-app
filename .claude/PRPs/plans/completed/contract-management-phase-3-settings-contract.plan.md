# Feature: Contract Management — Phase 3: Settings Contract

## Summary

Build the `/settings/contract` route where managers configure the organization's base contract. The screen contains a TipTap RichEditor for the clause body, a "Preview" button that opens a ContentModal showing the auto-generated header (enterprise/professional data) plus the current clauses, and a "Salvar contrato base" button that upserts to the `contracts` table (`is_base_contract = true`). A new card is also added to the `/settings` index. This phase depends on Phase 1 (database) and Phase 2 (RichEditor) being complete — both are marked `complete` in the PRD.

## User Story

As a gestora/secretária of an obstetric organization  
I want to configure the organization's standard contract clauses once in `/settings/contract`  
So that future patient contracts can be generated automatically from this base without retyping

## Problem Statement

Professionals currently write contract clauses from scratch for every patient or copy from an external Word/Google Docs template. No system-level base contract exists. Phase 3 eliminates this by providing a one-time configuration screen where the clause body is written once and stored in `contracts` with `is_base_contract = true`.

## Solution Statement

New settings route following the exact `billing-deductions` pattern: thin server `page.tsx` loads the existing base contract, guards with `isManager()`, passes data to a `ContractSettingsScreen` client component. The screen hosts the RichEditor for clauses and a ContentModal-based preview that renders the auto-generated header (enterprise name/CNPJ/address or professional data) plus the live HTML clauses. Saving calls `saveBaseContractAction` which upserts (insert if none exists, update if it does) using `ctx.supabase` (RLS enforces the enterprise_id / user_id gate already defined in the migration).

## Metadata

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| Type             | NEW_CAPABILITY                                                     |
| Complexity       | MEDIUM                                                             |
| Systems Affected | settings route, server actions, Supabase contracts table, screens  |
| Dependencies     | @tiptap/react ^3.0.0, @ventre/ui/shared/rich-editor, @ventre/ui/shared/content-modal |
| Estimated Tasks  | 8                                                                  |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────────────┐    ┌─────────────────────┐                         ║
║   │  /settings           │    │  (only one card:    │                         ║
║   │  ┌───────────────┐   │    │   Taxas e Descontos)│                         ║
║   │  │ Taxas e       │   │    │                     │                         ║
║   │  │ Descontos     │ ──┼──► │  /settings/billing- │                         ║
║   │  │               │   │    │  deductions         │                         ║
║   │  └───────────────┘   │    └─────────────────────┘                         ║
║   └─────────────────────┘                                                     ║
║                                                                               ║
║   USER_FLOW: Manager goes to /settings → no contract configuration available  ║
║   PAIN_POINT: No way to set a base contract inside the system                 ║
║   DATA_FLOW: n/a — contracts table exists but no UI to write to it            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌──────────────────────────┐                                                ║
║   │  /settings               │                                                ║
║   │  ┌──────────────────┐    │  ┌─────────────────────────────────────────┐  ║
║   │  │ Taxas e Descontos│    │  │  /settings/contract                     │  ║
║   │  └──────────────────┘    │  │                                         │  ║
║   │  ┌──────────────────┐    │  │  ┌──────────────────────────────────┐  │  ║
║   │  │ Contrato Padrão  │───►│  │  │ RichEditor (TipTap)             │  │  ║
║   │  └──────────────────┘    │  │  │  [Cláusulas do contrato...]     │  │  ║
║   └──────────────────────────┘  │  └──────────────────────────────────┘  │  ║
║                                 │                                         │  ║
║                                 │  [Preview]  [Salvar contrato base]      │  ║
║                                 └─────────────────────────────────────────┘  ║
║                                         │                                     ║
║                                         ▼ (click Preview)                    ║
║                          ┌──────────────────────────────┐                    ║
║                          │  ContentModal (Dialog/Sheet)  │                    ║
║                          │  CONTRATANTE: [dados gestante]│                    ║
║                          │  CONTRATADA: Empresa LTDA,   │                    ║
║                          │    CNPJ: 00.000.000/0001-00  │                    ║
║                          │  EQUIPE CONTRATADA:           │                    ║
║                          │    Enf. Obstétrica: ...       │                    ║
║                          │  ─────────────────────────── │                    ║
║                          │  [clauses HTML rendered here] │                    ║
║                          └──────────────────────────────┘                    ║
║                                                                               ║
║   USER_FLOW: /settings → click "Contrato Padrão" → write clauses → Preview   ║
║              → verify header + clauses → Salvar contrato base                 ║
║   VALUE_ADD: Base contract configured once; all future patient contracts      ║
║              inherit these clauses automatically (Phase 4)                   ║
║   DATA_FLOW: RichEditor.onChange → clausesHtml state → saveBaseContractAction ║
║              → supabase.contracts upsert (is_base_contract=true)             ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `/settings` | 1 card (Taxas e Descontos) | 2 cards (+Contrato Padrão) | Manager can navigate to contract config |
| `/settings/contract` | 404 | Full contract settings screen | Manager writes base contract clauses |
| Preview button | n/a | ContentModal with header + clauses | Manager validates the full contract layout before saving |
| Save button | n/a | Upsert to `contracts` table | Base contract persisted, ready for patient use in Phase 4 |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `apps/web/app/(dashboard)/settings/billing-deductions/page.tsx` | all | Route page pattern to MIRROR exactly |
| P0 | `apps/web/src/screens/billing-deductions-screen.tsx` | all | Screen pattern (Header, PageHeader, useAction, router.refresh) |
| P0 | `apps/web/src/screens/enterprise-settings-screen.tsx` | all | settingsSections array — ADD card here |
| P0 | `apps/web/src/actions/create-billing-fee-action.ts` | all | authActionClient action pattern to MIRROR |
| P1 | `apps/web/src/lib/safe-action.ts` | all | ctx shape: `{ supabase, supabaseAdmin, user, profile }` |
| P1 | `apps/web/src/lib/access-control.ts` | all | `isManager()` returns `profile?.user_type === "manager"` |
| P1 | `apps/web/src/lib/validations/enterprise-billing-fees.ts` | all | Zod schema + type export pattern |
| P1 | `apps/web/src/services/enterprise-billing-fees.ts` | all | Server-side query function pattern for page.tsx |
| P1 | `packages/ui/src/shared/rich-editor/rich-editor.tsx` | all | Props: `{ content, onChange, placeholder, disabled, className }` |
| P1 | `packages/ui/src/shared/content-modal/content-modal.tsx` | all | ContentModal props + Dialog/Sheet responsive pattern |
| P1 | `packages/supabase/supabase/migrations/20260627000001_contracts.sql` | all | RLS policies — understand what supabase vs supabaseAdmin to use |
| P2 | `packages/supabase/src/types/database.types.ts` | 317-381 | `Tables<"contracts">` and `Tables<"enterprises">` types |
| P2 | `apps/web/src/screens/index.ts` | all | Barrel export — add ContractSettingsScreen here |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [TipTap v3 content prop](https://tiptap.dev/docs/editor/getting-started/install/react) | useEditor options | `content` prop is INITIAL ONLY — not reactive after mount |
| [TipTap setContent v3](https://tiptap.dev/api/commands/set-content) | emitUpdate | v3 breaking: `emitUpdate` defaults to `true` — pass `{ emitUpdate: false }` when loading from DB |

---

## Patterns to Mirror

**SETTINGS_ROUTE_PAGE:**
```typescript
// SOURCE: apps/web/app/(dashboard)/settings/billing-deductions/page.tsx:1-17
// COPY THIS PATTERN exactly for contract page:
import { isManager } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { BillingDeductionsScreen } from "@/screens";
import { getEnterpriseBillingFees } from "@/services/enterprise-billing-fees";
import { redirect } from "next/navigation";

export default async function BillingDeductionsPage() {
  const { profile } = await getServerAuth();

  if (!isManager(profile)) {
    redirect("/home?error=acesso-negado");
  }

  const fees = await getEnterpriseBillingFees();

  return <BillingDeductionsScreen fees={fees} />;
}
```

**SETTINGS_SCREEN_STRUCTURE:**
```typescript
// SOURCE: apps/web/src/screens/billing-deductions-screen.tsx:1-110
// COPY THIS PATTERN for ContractSettingsScreen:
"use client";
import { Header } from "@/components/layouts/header";
import { PageHeader } from "@/components/shared/page-header";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function BillingDeductionsScreen({ fees }: BillingDeductionsScreenProps) {
  const router = useRouter();
  // ... useState for modals/state
  // ... useAction for mutations (onSuccess: toast + router.refresh())
  return (
    <div>
      <Header title="Taxas e Descontos" back="/settings" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader description="...">
          {/* action buttons */}
        </PageHeader>
        {/* content */}
      </div>
    </div>
  );
}
```

**SETTINGS_CARD_ENTRY:**
```typescript
// SOURCE: apps/web/src/screens/enterprise-settings-screen.tsx:9-16
// ADD new entry to settingsSections array:
const settingsSections = [
  {
    title: "Taxas e Descontos",
    description: "Configure taxas fixas e percentuais aplicadas às cobranças",
    href: "/settings/billing-deductions",
    icon: Percent,
  },
  // ADD HERE:
  // {
  //   title: "Contrato Padrão",
  //   description: "Configure as cláusulas do contrato base da organização",
  //   href: "/settings/contract",
  //   icon: FileText,
  // },
];
```

**AUTH_ACTION_PATTERN:**
```typescript
// SOURCE: apps/web/src/actions/create-billing-fee-action.ts:1-44
// MIRROR this exact structure:
"use server";
import { authActionClient } from "@/lib/safe-action";
import { createBillingFeeSchema } from "@/lib/validations/enterprise-billing-fees";

export const createBillingFeeAction = authActionClient
  .inputSchema(createBillingFeeSchema)
  .action(async ({ parsedInput: { name, fee_type, value }, ctx: { supabase, profile } }) => {
    if (profile.user_type !== "manager") {
      throw new Error("Apenas gestores podem criar taxas.");
    }
    if (!profile.enterprise_id) {
      throw new Error("Você não está associado a nenhuma organização.");
    }
    const { data: fee, error } = await supabase
      .from("enterprise_billing_fees")
      .insert({ enterprise_id: profile.enterprise_id, name, fee_type, value, created_by: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { fee };
  });
```

**ZOD_SCHEMA_PATTERN:**
```typescript
// SOURCE: apps/web/src/lib/validations/enterprise-billing-fees.ts:1-43
import { z } from "zod";

export const createBillingFeeSchema = z.object({
  name: z.string().min(2, "...").max(100, "..."),
  fee_type: z.enum(feeTypes, { required_error: "..." }),
  value: z.number().positive("..."),
});

export type CreateBillingFeeInput = z.infer<typeof createBillingFeeSchema>;
```

**SERVICE_FUNCTION_PATTERN:**
```typescript
// SOURCE: apps/web/src/services/enterprise-billing-fees.ts:20-40
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

**CONTENT_MODAL_USAGE:**
```typescript
// SOURCE: apps/web/src/modals/billing-fee-form-modal.tsx (pattern)
// import: import { ContentModal } from "@ventre/ui/shared/content-modal";
<ContentModal
  open={showPreview}
  onOpenChange={setShowPreview}
  title="Preview do Contrato"
  description="Visualização do contrato completo com cabeçalho auto-gerado"
>
  {/* header JSX + dangerouslySetInnerHTML for clauses */}
</ContentModal>
```

**RICH_EDITOR_USAGE:**
```typescript
// SOURCE: packages/ui/src/shared/rich-editor/rich-editor.tsx:20-26
// Props: { content: string; onChange: (html: string) => void; placeholder?: string; disabled?: boolean; className?: string }
// CRITICAL GOTCHA: content prop is INITIAL ONLY (TipTap v3 uncontrolled)
// Pattern: only render RichEditor AFTER async data has loaded
// import: import { RichEditor } from "@ventre/ui/shared/rich-editor";
{initialized && (
  <RichEditor
    key="loaded"
    content={clausesHtml}
    onChange={setClausesHtml}
    placeholder="Escreva as cláusulas do contrato..."
  />
)}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `apps/web/src/screens/enterprise-settings-screen.tsx` | UPDATE | Add "Contrato Padrão" card to settingsSections |
| `apps/web/src/lib/validations/contract.ts` | CREATE | Zod schema for saveBaseContractAction input |
| `apps/web/src/services/base-contract.ts` | CREATE | Server-side query for initial page load + header data |
| `apps/web/src/actions/get-contract-header-data-action.ts` | CREATE | Fetches enterprise/user/team data for preview header |
| `apps/web/src/actions/save-base-contract-action.ts` | CREATE | Upserts base contract clauses_html |
| `apps/web/src/screens/contract-settings-screen.tsx` | CREATE | Client screen with RichEditor + preview modal + save |
| `apps/web/app/(dashboard)/settings/contract/page.tsx` | CREATE | Server route: isManager guard + data prefetch |
| `apps/web/src/screens/index.ts` | UPDATE | Add ContractSettingsScreen barrel export |

---

## NOT Building (Scope Limits)

- **Patient-specific header fields** (patient name, CPF, due date) — CONTRATANTE section shows `[dados da gestante]` placeholder in the settings preview; actual patient data is in Phase 4
- **"Choose between own vs. enterprise" header toggle** — header always uses enterprise data if `enterprise_id` exists; autonomous professional path uses user data; no UI toggle in this phase
- **Autonomous professional missing fields (CPF, address)** — render `[não informado]` for any absent field; no data collection form
- **Contract PDF export** — Phase 5
- **Patient contract generation** — Phase 4
- **Contract listing/audit** — explicitly excluded from v1 ("Could" in MoSCoW)
- **Versioning** — explicitly excluded from v1

---

## Step-by-Step Tasks

Execute in order. Each task is atomic and independently verifiable.

---

### Task 1: UPDATE `apps/web/src/screens/enterprise-settings-screen.tsx`

- **ACTION**: ADD new entry to `settingsSections` array
- **IMPLEMENT**:
  - Import `FileText` from `lucide-react` alongside existing `Percent, ChevronRight`
  - Add entry after "Taxas e Descontos":
    ```ts
    {
      title: "Contrato Padrão",
      description: "Configure as cláusulas do contrato base da organização",
      href: "/settings/contract",
      icon: FileText,
    }
    ```
- **MIRROR**: `enterprise-settings-screen.tsx:9-16` — exact same object shape
- **GOTCHA**: The icon renders as `<section.icon className="h-5 w-5 text-primary" />` — no size prop needed, just pass the Lucide component reference
- **VALIDATE**: `pnpm check-types`

---

### Task 2: CREATE `apps/web/src/lib/validations/contract.ts`

- **ACTION**: CREATE Zod schema file for contract validation
- **IMPLEMENT**:
  ```ts
  import { z } from "zod";

  export const saveBaseContractSchema = z.object({
    clauses_html: z.string().min(1, "As cláusulas não podem estar vazias"),
  });

  export type SaveBaseContractInput = z.infer<typeof saveBaseContractSchema>;
  ```
- **MIRROR**: `apps/web/src/lib/validations/enterprise-billing-fees.ts:1-10` — exact same structure
- **IMPORTS**: `import { z } from "zod"` — do NOT use `zod/v4` (project uses standard `zod` import as seen in existing files)
- **VALIDATE**: `pnpm check-types`

---

### Task 3: CREATE `apps/web/src/services/base-contract.ts`

- **ACTION**: CREATE two server-side functions — `getBaseContract` for initial page load and `getContractHeaderData` for preview
- **IMPLEMENT**:

```ts
import { getServerAuth } from "@/lib/server-auth";
import { createServerSupabaseAdmin } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";

export async function getBaseContract(): Promise<Tables<"contracts"> | null> {
  const { profile, user } = await getServerAuth();
  if (!user) return null;

  const supabaseAdmin = await createServerSupabaseAdmin();

  let query = supabaseAdmin
    .from("contracts")
    .select("*")
    .eq("is_base_contract", true);

  if (profile?.enterprise_id) {
    query = query.eq("enterprise_id", profile.enterprise_id);
  } else {
    query = query.eq("user_id", user.id).is("enterprise_id", null);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[getBaseContract]", error.message);
    return null;
  }

  return data;
}

export type ContractHeaderData =
  | {
      type: "enterprise";
      enterprise: Pick<
        Tables<"enterprises">,
        "name" | "legal_name" | "cnpj" | "email" | "phone" | "street" | "number" | "complement" | "neighborhood" | "city" | "state" | "zipcode"
      > | null;
      teamMembers: { id: string; name: string | null; professional_type: string | null; email: string | null; phone: string | null }[];
    }
  | {
      type: "autonomous";
      user: Pick<Tables<"users">, "name" | "email" | "phone" | "professional_type">;
    };

export async function getContractHeaderData(): Promise<ContractHeaderData> {
  const { profile, user } = await getServerAuth();
  if (!user) return { type: "autonomous", user: { name: null, email: null, phone: null, professional_type: null } };

  const supabaseAdmin = await createServerSupabaseAdmin();

  if (profile?.enterprise_id) {
    const { data: enterprise } = await supabaseAdmin
      .from("enterprises")
      .select("name, legal_name, cnpj, email, phone, street, number, complement, neighborhood, city, state, zipcode")
      .eq("id", profile.enterprise_id)
      .maybeSingle();

    const { data: teamRows } = await supabaseAdmin
      .from("user_enterprises")
      .select("users!inner(id, name, professional_type, email, phone)")
      .eq("enterprise_id", profile.enterprise_id);

    const teamMembers = (teamRows ?? []).map((r) => r.users as { id: string; name: string | null; professional_type: string | null; email: string | null; phone: string | null });

    return { type: "enterprise", enterprise: enterprise ?? null, teamMembers };
  }

  return {
    type: "autonomous",
    user: {
      name: profile?.name ?? null,
      email: profile?.email ?? null,
      phone: profile?.phone ?? null,
      professional_type: profile?.professional_type ?? null,
    },
  };
}
```

- **MIRROR**: `apps/web/src/services/enterprise-billing-fees.ts:20-40` — same pattern: `getServerAuth()`, `createServerSupabaseAdmin()`, error logging, return null on error
- **GOTCHA**: The `user_enterprises` join returns `{ users: {...} }[]` — map with `r.users` to extract the user object; TypeScript may need explicit cast
- **GOTCHA**: `supabaseAdmin` bypasses RLS — correct here since `getContractHeaderData` is called in a server context after isManager guard
- **VALIDATE**: `pnpm check-types`

---

### Task 4: CREATE `apps/web/src/actions/save-base-contract-action.ts`

- **ACTION**: CREATE server action that upserts the base contract
- **IMPLEMENT**:

```ts
"use server";

import { authActionClient } from "@/lib/safe-action";
import { saveBaseContractSchema } from "@/lib/validations/contract";
import { revalidatePath } from "next/cache";

export const saveBaseContractAction = authActionClient
  .inputSchema(saveBaseContractSchema)
  .action(async ({ parsedInput: { clauses_html }, ctx: { supabase, profile, user } }) => {
    if (profile.user_type !== "manager") {
      throw new Error("Apenas gestores podem configurar o contrato base.");
    }

    // Check if base contract already exists
    let existingId: string | null = null;

    if (profile.enterprise_id) {
      const { data: existing } = await supabase
        .from("contracts")
        .select("id")
        .eq("is_base_contract", true)
        .eq("enterprise_id", profile.enterprise_id)
        .maybeSingle();
      existingId = existing?.id ?? null;
    } else {
      const { data: existing } = await supabase
        .from("contracts")
        .select("id")
        .eq("is_base_contract", true)
        .eq("user_id", user.id)
        .is("enterprise_id", null)
        .maybeSingle();
      existingId = existing?.id ?? null;
    }

    if (existingId) {
      const { error } = await supabase
        .from("contracts")
        .update({ clauses_html })
        .eq("id", existingId);

      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("contracts")
        .insert({
          is_base_contract: true,
          clauses_html,
          enterprise_id: profile.enterprise_id ?? null,
          user_id: profile.enterprise_id ? null : user.id,
        });

      if (error) throw new Error(error.message);
    }

    revalidatePath("/settings/contract");
    return { success: true };
  });
```

- **MIRROR**: `apps/web/src/actions/create-billing-fee-action.ts:1-44` — "use server", `authActionClient.inputSchema(schema).action(...)`, role check, enterprise_id check, `.select().single()`, throw on error
- **GOTCHA**: Use `ctx.supabase` (not `supabaseAdmin`) for the INSERT/UPDATE — RLS policy `"Create contracts"` / `"Update contracts"` allows this when `user_type IN ('manager', 'secretary')` and `enterprise_id` matches. The anon-key client respects RLS and will enforce the policy automatically.
- **GOTCHA**: The SELECT to find existing uses `.maybeSingle()` not `.single()` — base contract may not exist yet, and `.single()` throws on 0 rows
- **GOTCHA**: When inserting for enterprise user, set `user_id = null` and `enterprise_id = profile.enterprise_id`. When inserting for autonomous, set `user_id = user.id` and `enterprise_id = null`. The RLS policy is scoped to the correct combination.
- **VALIDATE**: `pnpm check-types`

---

### Task 5: CREATE `apps/web/src/screens/contract-settings-screen.tsx`

- **ACTION**: CREATE the main client screen component
- **IMPLEMENT**:

```tsx
"use client";

import { saveBaseContractAction } from "@/actions/save-base-contract-action";
import { Header } from "@/components/layouts/header";
import { PageHeader } from "@/components/shared/page-header";
import type { ContractHeaderData } from "@/services/base-contract";
import type { Tables } from "@ventre/supabase/types";
import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { RichEditor } from "@ventre/ui/shared/rich-editor";
import { Eye, Save } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type ContractSettingsScreenProps = {
  initialContract: Tables<"contracts"> | null;
  headerData: ContractHeaderData;
};

export default function ContractSettingsScreen({ initialContract, headerData }: ContractSettingsScreenProps) {
  const router = useRouter();
  const [clausesHtml, setClausesHtml] = useState(initialContract?.clauses_html ?? "");
  const [showPreview, setShowPreview] = useState(false);

  const { execute: save, isExecuting } = useAction(saveBaseContractAction, {
    onSuccess: () => {
      toast.success("Contrato base salvo com sucesso");
      router.refresh();
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Erro ao salvar contrato"),
  });

  return (
    <div>
      <Header title="Contrato Padrão" back="/settings" />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <PageHeader description="Configure as cláusulas do contrato base da organização">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="size-4" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button
            className="gradient-primary"
            disabled={isExecuting}
            onClick={() => save({ clauses_html: clausesHtml })}
          >
            <Save className="size-4" />
            {isExecuting ? "Salvando..." : "Salvar contrato base"}
          </Button>
        </PageHeader>

        <RichEditor
          content={clausesHtml}
          onChange={setClausesHtml}
          placeholder="Escreva as cláusulas do contrato..."
          className="min-h-[500px]"
        />
      </div>

      <ContentModal
        open={showPreview}
        onOpenChange={setShowPreview}
        title="Preview do Contrato"
        description="Visualização com cabeçalho auto-gerado e cláusulas atuais"
      >
        <ContractPreview headerData={headerData} clausesHtml={clausesHtml} />
      </ContentModal>
    </div>
  );
}

function ContractPreview({ headerData, clausesHtml }: { headerData: ContractHeaderData; clausesHtml: string }) {
  const na = "[não informado]";

  const contratadaBlock =
    headerData.type === "enterprise" && headerData.enterprise
      ? [
          `${headerData.enterprise.legal_name ?? headerData.enterprise.name ?? na}, pessoa jurídica de direito privado,`,
          `inscrita no CNPJ sob nº ${headerData.enterprise.cnpj ?? na},`,
          `com sede à ${[headerData.enterprise.street, headerData.enterprise.number, headerData.enterprise.neighborhood, headerData.enterprise.city, headerData.enterprise.state].filter(Boolean).join(", ") || na},`,
          `doravante denominada simplesmente EQUIPE CONTRATADA.`,
        ].join(" ")
      : headerData.type === "autonomous"
        ? `${headerData.user.name ?? na}, ${headerData.user.professional_type ?? na}, ${headerData.user.email ?? na}, telefone: ${headerData.user.phone ?? na}, doravante denominada simplesmente EQUIPE CONTRATADA.`
        : na;

  const teamMembersBlock =
    headerData.type === "enterprise" && headerData.teamMembers.length > 0
      ? headerData.teamMembers
          .map((m) => `${m.name ?? na}, ${m.professional_type ?? na}, ${m.email ?? na}, ${m.phone ?? na}`)
          .join("\n")
      : null;

  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-md border border-dashed bg-muted/40 p-4 text-muted-foreground italic">
        <p className="font-medium not-italic text-foreground">CONTRATANTE:</p>
        <p>[dados da gestante — preenchidos automaticamente ao gerar contrato por paciente]</p>
      </div>

      <div className="rounded-md border bg-background p-4">
        <p className="font-medium">CONTRATADA:</p>
        <p className="mt-1 whitespace-pre-wrap">{contratadaBlock}</p>
      </div>

      {teamMembersBlock && (
        <div className="rounded-md border bg-background p-4">
          <p className="font-medium">EQUIPE CONTRATADA:</p>
          <p className="mt-1 whitespace-pre-wrap">{teamMembersBlock}</p>
        </div>
      )}

      <div className="border-t pt-4">
        <div
          className="contract-clauses prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: clausesHtml || "<p><em>Nenhuma cláusula adicionada ainda.</em></p>" }}
        />
      </div>
    </div>
  );
}
```

- **MIRROR**: `apps/web/src/screens/billing-deductions-screen.tsx:1-110` — `"use client"`, Header with `back`, PageHeader with description + action buttons, `useAction` with `onSuccess: toast + router.refresh()`, `onError: toast.error`
- **GOTCHA**: `RichEditor` `content` prop is initial-only (TipTap v3 uncontrolled). Since `initialContract` is server-fetched and passed as prop, it's available at mount time — no async loading issue. `useState(initialContract?.clauses_html ?? "")` initializes correctly at mount.
- **GOTCHA**: The `ContractPreview` component uses `dangerouslySetInnerHTML` for clauses. This is safe because the content is produced by TipTap's own editor (not from external user input or an API). Add `prose prose-sm max-w-none` Tailwind class for readable rendering.
- **GOTCHA**: `headerData.type === "enterprise"` and `headerData.teamMembers` may be empty — handle gracefully with null checks.
- **GOTCHA**: Buttons in `PageHeader` children follow gradient-primary convention for primary actions and `variant="outline"` for secondary. Check `billing-deductions-screen.tsx:68-74` for the mobile/desktop button pattern.
- **VALIDATE**: `pnpm check-types`

---

### Task 6: CREATE `apps/web/app/(dashboard)/settings/contract/page.tsx`

- **ACTION**: CREATE the route page (server component)
- **IMPLEMENT**:

```ts
import { isManager } from "@/lib/access-control";
import { getServerAuth } from "@/lib/server-auth";
import { ContractSettingsScreen } from "@/screens";
import { getBaseContract, getContractHeaderData } from "@/services/base-contract";
import { redirect } from "next/navigation";

export default async function ContractPage() {
  const { profile } = await getServerAuth();

  if (!isManager(profile)) {
    redirect("/home?error=acesso-negado");
  }

  const [initialContract, headerData] = await Promise.all([
    getBaseContract(),
    getContractHeaderData(),
  ]);

  return <ContractSettingsScreen initialContract={initialContract} headerData={headerData} />;
}
```

- **MIRROR**: `apps/web/app/(dashboard)/settings/billing-deductions/page.tsx:1-17` — exact same guard pattern
- **GOTCHA**: `getServerAuth()` is already React `cache()`-wrapped — calling it again in `getBaseContract()` / `getContractHeaderData()` hits the cache; no duplicate DB queries
- **GOTCHA**: `Promise.all` runs both queries in parallel — preferable to sequential awaits since they're independent
- **VALIDATE**: `pnpm check-types`

---

### Task 7: UPDATE `apps/web/src/screens/index.ts`

- **ACTION**: ADD barrel export for new screen
- **IMPLEMENT**: Add after `BillingDeductionsScreen`:
  ```ts
  export { default as ContractSettingsScreen } from "./contract-settings-screen";
  ```
- **MIRROR**: `apps/web/src/screens/index.ts` — same `export { default as XxxScreen }` pattern used by all other screens
- **VALIDATE**: `pnpm check-types`

---

### Task 8: ADD `prose` CSS to Tailwind config (if not already present)

- **ACTION**: VERIFY Tailwind Typography plugin is available for the `prose` class used in preview
- **IMPLEMENT**:
  - Run: `grep -r "typography" /Users/otaviobarbosa/dev/nascere/apps/web/tailwind.config.ts`
  - If `@tailwindcss/typography` is NOT present:
    - Add to `apps/web/package.json` devDependencies: `"@tailwindcss/typography": "^0.5.x"`
    - Add to `apps/web/tailwind.config.ts` plugins: `require('@tailwindcss/typography')`
    - Run `pnpm install`
  - If already present: skip, no changes needed
  - If installing it is not desirable, replace `prose prose-sm max-w-none` with manual CSS classes:
    ```tsx
    className="[&_p]:my-2 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold"
    ```
- **VALIDATE**: `pnpm check-types` then verify preview renders readable contract clauses in browser

---

## Testing Strategy

### Manual Testing Checklist (no automated tests for this phase — UI-heavy)

| Scenario | Steps | Expected |
|----------|-------|----------|
| Enterprise manager creates base contract | Login as manager → /settings → Contrato Padrão → write clauses → Salvar | Toast "Contrato base salvo", row in `contracts` table with `is_base_contract=true`, `enterprise_id` set |
| Save updates existing contract | Save once → edit clauses → Save again | Only one row in `contracts` for the enterprise (UPDATE, not duplicate INSERT) |
| Preview shows enterprise header | Click Preview before saving | ContentModal shows CONTRATADA with enterprise name/CNPJ; CONTRATANTE shows placeholder |
| Preview shows clauses live | Type in editor → click Preview | Preview shows current (unsaved) clauses |
| Empty clauses validation | Click Save with empty editor | Zod error surfaced via `result.serverError` — toast shows error message |
| Non-manager access | Login as non-manager → navigate to /settings/contract | Redirect to `/home?error=acesso-negado` |
| Autonomous professional | Login as professional without enterprise → /settings/contract | Preview shows user data (name/email/phone) in CONTRATADA; save uses `user_id` not `enterprise_id` |
| Mobile preview | Resize to <640px → click Preview | Sheet (bottom drawer) opens instead of Dialog |

### Edge Cases Checklist

- [ ] Enterprise with no CNPJ/address → header shows `[não informado]` for missing fields
- [ ] Enterprise with no team members → EQUIPE CONTRATADA section hidden in preview
- [ ] Autonomous professional with no phone/email → `[não informado]` rendered
- [ ] Saving empty `clauses_html` → Zod `min(1)` blocks the action
- [ ] Double-click Save → `isExecuting` disables button, no duplicate requests
- [ ] `profile.enterprise_id = null` for autonomous → INSERT uses `user_id`, `enterprise_id = null`

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, zero TypeScript errors

### Level 2: BIOME LINT

```bash
npx biome lint --write apps/web/src/screens/contract-settings-screen.tsx
npx biome lint --write apps/web/src/actions/save-base-contract-action.ts
npx biome lint --write apps/web/src/services/base-contract.ts
```

**EXPECT**: No errors. Unused imports removed automatically.

### Level 3: BUILD CHECK

```bash
pnpm check-types
```

**EXPECT**: All packages compile cleanly

### Level 4: DATABASE_VALIDATION

Use Supabase MCP or Supabase Studio to verify:
- [ ] After saving a base contract: `SELECT * FROM contracts WHERE is_base_contract = true` returns one row
- [ ] Re-saving does not create a second row (UPDATE path taken)
- [ ] `enterprise_id` is set correctly for enterprise users; `user_id` for autonomous

### Level 5: BROWSER_VALIDATION

```bash
pnpm dev  # in apps/web
```

- [ ] `/settings` shows two cards: "Taxas e Descontos" AND "Contrato Padrão"
- [ ] `/settings/contract` loads without errors
- [ ] RichEditor is functional (bold, italic, lists work)
- [ ] Preview opens as Dialog on desktop, Sheet on mobile
- [ ] Preview shows enterprise data in CONTRATADA block
- [ ] Preview clauses render HTML (paragraphs, bold, lists) correctly
- [ ] Save shows success toast
- [ ] Refreshing page after save repopulates editor with saved content
- [ ] Non-manager user redirected to `/home?error=acesso-negado`

---

## Acceptance Criteria

- [ ] `/settings` page shows new "Contrato Padrão" card linking to `/settings/contract`
- [ ] Manager can write contract clauses using TipTap rich editor
- [ ] Preview modal shows auto-generated header with enterprise/professional data and current clauses
- [ ] Saving persists `clauses_html` to `contracts` table with `is_base_contract = true`
- [ ] Saving twice does not create duplicate rows (upsert pattern)
- [ ] Non-managers are redirected — not blocked at UI level only
- [ ] All missing header fields render as `[não informado]`
- [ ] `pnpm check-types` passes with zero errors
- [ ] Mobile: preview opens as bottom Sheet; desktop: Dialog

---

## Completion Checklist

- [ ] Task 1: `enterprise-settings-screen.tsx` updated with new card
- [ ] Task 2: `src/lib/validations/contract.ts` created
- [ ] Task 3: `src/services/base-contract.ts` created (getBaseContract + getContractHeaderData)
- [ ] Task 4: `src/actions/save-base-contract-action.ts` created
- [ ] Task 5: `src/screens/contract-settings-screen.tsx` created (screen + ContractPreview)
- [ ] Task 6: `app/(dashboard)/settings/contract/page.tsx` created
- [ ] Task 7: `src/screens/index.ts` updated with barrel export
- [ ] Task 8: Tailwind Typography verified/installed
- [ ] Level 1: `pnpm check-types` passes
- [ ] Level 5: Manual browser validation complete
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TipTap v3 `content` prop silently stale | LOW | HIGH | Server-fetches initial contract before mount; `useState(initialContract?.clauses_html ?? "")` initializes at mount time — no async loading, no stale-content issue |
| Enterprise has no CNPJ/address in `enterprises` table | HIGH | MED | All fields use `?? na` pattern — `[não informado]` rendered; no crash |
| `user_enterprises` join TypeScript shape mismatch | MED | MED | Explicit cast `r.users as { ... }` in service function; verify shape with `pnpm check-types` |
| Duplicate base contracts on concurrent save | LOW | MED | Double-click is blocked by `isExecuting` button disable; race condition window is tiny; no unique constraint in DB but acceptable for v1 |
| `prose` CSS class missing (Typography plugin) | MED | LOW | Task 8 explicitly checks; fallback Tailwind arbitrary classes documented |
| Autonomous professional `users` table missing CPF/address fields | HIGH | LOW | Phase 3 only shows `[não informado]`; gap documented in PRD open questions |

---

## Notes

- **Storage**: The `contracts` table stores `clauses_html TEXT` (not JSON). The `RichEditor` emits HTML via `onChange(e.getHTML())`. This matches the migration schema — do not attempt to store JSON.
- **RLS understanding**: `ctx.supabase` (anon key) is used for INSERT/UPDATE because the RLS policies on `contracts` are crafted to allow enterprise managers to write their own base contract. Using `supabaseAdmin` for writes would bypass these policies — use `ctx.supabase` to let RLS enforce data isolation.
- **TipTap v3 key change**: `setContent` now emits updates by default (`emitUpdate: true`). Since Phase 3 loads content server-side as a prop (not via async action), this specific gotcha is not triggered. But Phase 4 (patient contract with async load) WILL need `{ emitUpdate: false }` — document this in the Phase 4 plan.
- **Header preview is read-only**: The preview shows what the contract WILL look like with real data. CONTRATANTE section is a placeholder in settings context. This is intentional — patient data is only available in Phase 4.
- **`getServerAuth()` is cached**: Multiple calls within the same request (page.tsx → getBaseContract → getContractHeaderData) hit the React cache. No duplicate auth queries.
