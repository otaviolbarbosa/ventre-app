# Templated Rich Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Nota (2026-09-16):** depois que este plano foi executado (Tasks 1-12) e
> passou pela revisão final, o componente `templated-rich-editor` (e tudo
> dentro dele — node, NodeView, modais, extensão de inserção,
> `unwrapTemplateBlocks`) foi movido de `apps/web/src/components/shared/
> templated-rich-editor/` para `packages/ui/src/shared/templated-rich-
> editor/`, com infra de testes (Vitest + Testing Library) configurada
> dentro do próprio `packages/ui`. As referências a `apps/web/.../
> templated-rich-editor/` abaixo (e nos briefs de cada task) refletem os
> caminhos originais de quando o plano foi escrito e executado — o código
> real está em `packages/ui`. Também foram adicionadas stories em
> `apps/storybook/src/stories/TemplatedRichEditor.stories.tsx`, cuja
> verificação ao vivo encontrou e corrigiu um bug real no widget de
> inserção "+" (posição obsoleta após o documento crescer) que nenhum teste
> automatizado exercitava.

**Goal:** Build a Tiptap-based rich text editor (`TemplatedRichEditor`) whose content is composed of reusable, saveable content blocks ("modelos"), backed by a new `document_templates` table — the shared editing primitive that future prescription/document screens (atestados, laudos, etc.) will build on.

**Architecture:** A custom Tiptap Node (`templateBlock`) wraps groups of paragraphs/headings/lists in a plain `<div data-type="template-block">`, rendered via a React NodeView that adds edit-only chrome (drag handle, save icon, delete icon). Content is stored and exchanged as ProseMirror JSON (not HTML), so block metadata (`templateId`, `label`) survives round-trips exactly. `document_templates` (new table, RLS-scoped `personal`/`global`) backs the "Modelos" sidebar and the save-as-template flow, which reuses the existing `ContentModal`-based two-step "overwrite or create new" pattern already proven for contract templates.

**Tech Stack:** Next.js 15 / React 19, Tiptap v3 (`@tiptap/core`, `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, plus individual node extensions), Supabase (Postgres + RLS), `next-safe-action`, Vitest + `@testing-library/react` + `happy-dom`, Zod, `react-hook-form`.

**Spec:** [docs/superpowers/specs/2026-09-15-templated-rich-editor-design.md](../specs/2026-09-15-templated-rich-editor-design.md)

## Global Constraints

- Content is stored as ProseMirror JSON (`editor.getJSON()`), never HTML — no `<script>` tags, no HTML-string persistence for this editor.
- `document_templates.category` is a Postgres enum: `prescricao | exame | cirurgia | laudo | atestado | declaracao | relatorio`.
- `document_templates.scope` is `personal | global`; only `personal` rows are writable by regular users (via `owner_id = auth.uid()`); `global` rows have no client-writable RLS policy.
- All server actions use `authActionClient` from `apps/web/src/lib/safe-action.ts`, mirroring the existing `.inputSchema(schema).action(async ({ parsedInput, ctx: { supabase, user } }) => {...})` pattern — Supabase errors become `throw new Error(error.message)`, no `returnValidationErrors`.
- Ownership/scope checks are enforced in the action's query filter itself (defense in depth), not only via RLS.
- All new UI-facing strings are Portuguese (pt-BR).
- The component lives in `apps/web/src/components/shared/templated-rich-editor/` (not `packages/ui`) — this deviates from the design spec's original placement; see Task 6 for why.
- Tests: Vitest, `pnpm test -- <path>` from `apps/web` (or `pnpm --filter web test -- <path>` from repo root). Component tests need `// @vitest-environment happy-dom` as the first line (global config is `environment: "node"`).
- No nesting of `templateBlock` inside another `templateBlock` — declared at the schema level (Task 7's `content: "templateBlockContent+"`), but this is NOT a complete guarantee, confirmed two ways: (1) Tiptap's JSON deserialization does not strictly enforce it against raw invalid content (confirmed during Task 7); (2) `ListItem`'s content expression (`"paragraph block*"`, from `@tiptap/extension-list`, unmodified by this plan) accepts anything in the `block` group — which `templateBlock` is a member of — so `templateBlock > bulletList > listItem > templateBlock` is schema-valid and reachable through native drag-and-drop reordering (`draggable: true`), not just JSON bypass (confirmed during the final whole-branch review; deliberately left unfixed — see that review's findings for the reasoning). Actual prevention for the *controlled insertion* paths only: `InsertBetweenBlocks` (Task 9) only inserts between top-level siblings, and the sidebar insertion in `TemplatedRichEditor` (Task 12) resolves to the nearest top-level position before inserting. Neither covers drag-and-drop into a list. `unwrapTemplateBlocks` (Task 6) already handles nesting correctly regardless of how it occurs, as the actual safety net — PDF/preview generation stays correct even through this gap.
- After any migration: run `pnpm db:types` to regenerate `packages/supabase/src/types/database.types.ts`.

---

### Task 1: `document_templates` migration

**Files:**
- Create: `packages/supabase/supabase/migrations/20260915000000_document_templates.sql`
- Modify (generated): `packages/supabase/src/types/database.types.ts`

**Interfaces:**
- Produces: table `public.document_templates` (`id`, `owner_id`, `scope`, `category`, `title`, `content jsonb`, `created_at`, `updated_at`), enum `public.document_template_category`, used by every action task below.

- [ ] **Step 1: Write the migration**

```sql
create type public.document_template_category as enum (
  'prescricao',
  'exame',
  'cirurgia',
  'laudo',
  'atestado',
  'declaracao',
  'relatorio'
);

create table public.document_templates (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid references public.users(id) on delete cascade,
  scope text not null default 'personal' check (scope in ('personal', 'global')),
  category public.document_template_category not null,
  title text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_templates_owner_scope_check check (
    (scope = 'personal' and owner_id is not null)
    or (scope = 'global' and owner_id is null)
  )
);

create index idx_document_templates_owner on public.document_templates (owner_id);
create index idx_document_templates_category on public.document_templates (category);

alter table public.document_templates enable row level security;

create policy "Users can view own and global templates"
  on public.document_templates for select
  using (scope = 'global' or owner_id = auth.uid());

create policy "Users can insert own personal templates"
  on public.document_templates for insert
  with check (scope = 'personal' and owner_id = auth.uid());

create policy "Users can update own personal templates"
  on public.document_templates for update
  using (scope = 'personal' and owner_id = auth.uid())
  with check (scope = 'personal' and owner_id = auth.uid());

create policy "Users can delete own personal templates"
  on public.document_templates for delete
  using (scope = 'personal' and owner_id = auth.uid());

create trigger set_updated_at
  before update on public.document_templates
  for each row execute function public.handle_updated_at();
```

- [ ] **Step 2: Apply the migration**

This writes to the real linked Supabase project — confirm with the user before running if this plan is being executed unattended.

Run: `pnpm db:push`
Expected: migration applies with no errors; `document_templates` and `document_template_category` exist in the remote schema.

- [ ] **Step 3: Regenerate types**

Run: `pnpm db:types`
Expected: `packages/supabase/src/types/database.types.ts` now includes `document_templates` (Row/Insert/Update) and `document_template_category` in the `Enums` section.

- [ ] **Step 4: Verify types compile**

Run: `pnpm check-types`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/supabase/supabase/migrations/20260915000000_document_templates.sql packages/supabase/src/types/database.types.ts
git commit -m "feat(db): add document_templates table with personal/global scope"
```

---

### Task 2: Validations + `listDocumentTemplatesAction`

**Files:**
- Create: `apps/web/src/lib/validations/document-template.ts`
- Create: `apps/web/src/actions/list-document-templates-action.ts`
- Test: `apps/web/src/actions/list-document-templates-action.test.ts`

**Interfaces:**
- Consumes: `authActionClient` (`@/lib/safe-action`), `document_templates` table (Task 1).
- Produces: `documentTemplateCategorySchema`, `DocumentTemplateCategory` type, `listDocumentTemplatesSchema`, `createDocumentTemplateSchema`, `updateDocumentTemplateSchema`, `deleteDocumentTemplateSchema` (all from `@/lib/validations/document-template`, consumed by Tasks 3-5); `listDocumentTemplatesAction(input: { category }) => { templates: Tables<"document_templates">[] }`.

- [ ] **Step 1: Write the validations file**

```typescript
// apps/web/src/lib/validations/document-template.ts
import { z } from "zod";

export const documentTemplateCategorySchema = z.enum([
  "prescricao",
  "exame",
  "cirurgia",
  "laudo",
  "atestado",
  "declaracao",
  "relatorio",
]);

export type DocumentTemplateCategory = z.infer<typeof documentTemplateCategorySchema>;

export const listDocumentTemplatesSchema = z.object({
  category: documentTemplateCategorySchema,
});

export const createDocumentTemplateSchema = z.object({
  category: documentTemplateCategorySchema,
  title: z.string().min(1, "O nome não pode estar vazio"),
  content: z.record(z.string(), z.unknown()),
});

export const updateDocumentTemplateSchema = z.object({
  templateId: z.string().uuid(),
  title: z.string().min(1, "O nome não pode estar vazio").optional(),
  content: z.record(z.string(), z.unknown()),
});

export const deleteDocumentTemplateSchema = z.object({
  templateId: z.string().uuid(),
});
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/web/src/actions/list-document-templates-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, templatesResult } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  templatesResult: {
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    then: (
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "document_templates") return makeQueryBuilder(templatesResult);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

import { listDocumentTemplatesAction } from "./list-document-templates-action";

describe("listDocumentTemplatesAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    templatesResult.data = [];
    templatesResult.error = null;
  });

  it("returns templates for the requested category", async () => {
    templatesResult.data = [
      {
        id: "t1",
        category: "exame",
        title: "Hemograma",
        scope: "personal",
        owner_id: "professional-1",
        content: { type: "doc", content: [] },
      },
    ];

    const res = await listDocumentTemplatesAction({ category: "exame" });

    expect(res?.data?.templates).toEqual(templatesResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("surfaces a server error from Supabase", async () => {
    templatesResult.error = { message: "connection error" };

    const res = await listDocumentTemplatesAction({ category: "exame" });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test -- list-document-templates-action.test.ts`
Expected: FAIL — `Cannot find module './list-document-templates-action'`.

- [ ] **Step 4: Write the action**

```typescript
// apps/web/src/actions/list-document-templates-action.ts
"use server";

import { authActionClient } from "@/lib/safe-action";
import { listDocumentTemplatesSchema } from "@/lib/validations/document-template";

export const listDocumentTemplatesAction = authActionClient
  .inputSchema(listDocumentTemplatesSchema)
  .action(async ({ parsedInput: { category }, ctx: { supabase, user } }) => {
    const { data: templates, error } = await supabase
      .from("document_templates")
      .select("*")
      .eq("category", category)
      .or(`scope.eq.global,owner_id.eq.${user.id}`)
      .order("scope", { ascending: false })
      .order("title", { ascending: true });

    if (error) throw new Error(error.message);

    return { templates: templates ?? [] };
  });
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test -- list-document-templates-action.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/validations/document-template.ts apps/web/src/actions/list-document-templates-action.ts apps/web/src/actions/list-document-templates-action.test.ts
git commit -m "feat(actions): add listDocumentTemplatesAction"
```

---

### Task 3: `createDocumentTemplateAction`

**Files:**
- Create: `apps/web/src/actions/create-document-template-action.ts`
- Test: `apps/web/src/actions/create-document-template-action.test.ts`

**Interfaces:**
- Consumes: `createDocumentTemplateSchema` (Task 2).
- Produces: `createDocumentTemplateAction(input: { category, title, content }) => { template: Tables<"document_templates"> }` — always inserts `scope: "personal"`, `owner_id: user.id`, regardless of caller-supplied fields (input schema doesn't even accept `scope`/`owner_id`).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/actions/create-document-template-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, templateResult, insertSpy } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  templateResult: {
    data: null as unknown,
    error: null as { message: string } | null,
  },
  insertSpy: vi.fn(),
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    insert: vi.fn((payload: unknown) => {
      insertSpy(payload);
      return builder;
    }),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "document_templates") return makeQueryBuilder(templateResult);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

import { createDocumentTemplateAction } from "./create-document-template-action";

describe("createDocumentTemplateAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    templateResult.data = null;
    templateResult.error = null;
    insertSpy.mockClear();
  });

  it("always inserts with scope='personal' and owner_id=user.id", async () => {
    templateResult.data = {
      id: "t1",
      category: "exame",
      title: "Hemograma",
      scope: "personal",
      owner_id: "professional-1",
      content: { type: "doc", content: [] },
    };

    const res = await createDocumentTemplateAction({
      category: "exame",
      title: "Hemograma",
      content: { type: "doc", content: [] },
    });

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ scope: "personal", owner_id: "professional-1" }),
    );
    expect(res?.data?.template).toEqual(templateResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("surfaces a server error from Supabase", async () => {
    templateResult.error = { message: "insert failed" };

    const res = await createDocumentTemplateAction({
      category: "exame",
      title: "Hemograma",
      content: { type: "doc", content: [] },
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- create-document-template-action.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the action**

```typescript
// apps/web/src/actions/create-document-template-action.ts
"use server";

import type { Json } from "@ventre/supabase/types";
import { authActionClient } from "@/lib/safe-action";
import { createDocumentTemplateSchema } from "@/lib/validations/document-template";

export const createDocumentTemplateAction = authActionClient
  .inputSchema(createDocumentTemplateSchema)
  .action(async ({ parsedInput: { category, title, content }, ctx: { supabase, user } }) => {
    const { data: template, error } = await supabase
      .from("document_templates")
      .insert({
        category,
        title,
        content: content as Json,
        scope: "personal",
        owner_id: user.id,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return { template };
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- create-document-template-action.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/create-document-template-action.ts apps/web/src/actions/create-document-template-action.test.ts
git commit -m "feat(actions): add createDocumentTemplateAction"
```

---

### Task 4: `updateDocumentTemplateAction`

**Files:**
- Create: `apps/web/src/actions/update-document-template-action.ts`
- Test: `apps/web/src/actions/update-document-template-action.test.ts`

**Interfaces:**
- Consumes: `updateDocumentTemplateSchema` (Task 2).
- Produces: `updateDocumentTemplateAction(input: { templateId, title?, content }) => { template: Tables<"document_templates"> }`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/actions/update-document-template-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, templateResult } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  templateResult: {
    data: null as unknown,
    error: null as { message: string } | null,
  },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "document_templates") return makeQueryBuilder(templateResult);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

import { updateDocumentTemplateAction } from "./update-document-template-action";

describe("updateDocumentTemplateAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    templateResult.data = null;
    templateResult.error = null;
  });

  it("updates a template the caller owns", async () => {
    templateResult.data = {
      id: "t1",
      category: "exame",
      title: "Hemograma",
      scope: "personal",
      owner_id: "professional-1",
      content: { type: "doc", content: [{ type: "paragraph" }] },
    };

    const res = await updateDocumentTemplateAction({
      templateId: "11111111-1111-1111-1111-111111111111",
      content: { type: "doc", content: [{ type: "paragraph" }] },
    });

    expect(res?.data?.template).toEqual(templateResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("rejects updating a template it doesn't own (wrong owner or scope='global') — the ownership/scope filter blocks both", async () => {
    templateResult.error = { message: "JSON object requested, multiple (or no) rows returned" };

    const res = await updateDocumentTemplateAction({
      templateId: "22222222-2222-2222-2222-222222222222",
      content: { type: "doc", content: [] },
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- update-document-template-action.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the action**

```typescript
// apps/web/src/actions/update-document-template-action.ts
"use server";

import type { Json } from "@ventre/supabase/types";
import { authActionClient } from "@/lib/safe-action";
import { updateDocumentTemplateSchema } from "@/lib/validations/document-template";

export const updateDocumentTemplateAction = authActionClient
  .inputSchema(updateDocumentTemplateSchema)
  .action(async ({ parsedInput: { templateId, title, content }, ctx: { supabase, user } }) => {
    const { data: template, error } = await supabase
      .from("document_templates")
      .update({
        content: content as Json,
        ...(title !== undefined ? { title } : {}),
      })
      .eq("id", templateId)
      .eq("owner_id", user.id)
      .eq("scope", "personal")
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return { template };
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- update-document-template-action.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/update-document-template-action.ts apps/web/src/actions/update-document-template-action.test.ts
git commit -m "feat(actions): add updateDocumentTemplateAction"
```

---

### Task 5: `deleteDocumentTemplateAction`

**Files:**
- Create: `apps/web/src/actions/delete-document-template-action.ts`
- Test: `apps/web/src/actions/delete-document-template-action.test.ts`

**Interfaces:**
- Consumes: `deleteDocumentTemplateSchema` (Task 2).
- Produces: `deleteDocumentTemplateAction(input: { templateId }) => { template: Tables<"document_templates"> }`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/actions/delete-document-template-action.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, profileRow, ueRow, templateResult } = vi.hoisted(() => ({
  authUser: { id: "professional-1" },
  profileRow: {
    data: { id: "professional-1", name: "Dra. Ana" } as Record<string, unknown> | null,
    error: null as { message: string } | null,
  },
  ueRow: {
    data: null as { enterprise_id: string } | null,
    error: null as { message: string } | null,
  },
  templateResult: {
    data: null as unknown,
    error: null as { message: string } | null,
  },
}));

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    delete: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

vi.mock("@ventre/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: authUser } })) },
    from: vi.fn((table: string) => {
      if (table === "users") return makeQueryBuilder(profileRow);
      if (table === "document_templates") return makeQueryBuilder(templateResult);
      throw new Error(`unexpected table: ${table}`);
    }),
  })),
  createServerSupabaseAdmin: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === "user_enterprises") return makeQueryBuilder(ueRow);
      throw new Error(`unexpected admin table: ${table}`);
    }),
  })),
}));

import { deleteDocumentTemplateAction } from "./delete-document-template-action";

describe("deleteDocumentTemplateAction", () => {
  beforeEach(() => {
    ueRow.data = null;
    ueRow.error = null;
    templateResult.data = null;
    templateResult.error = null;
  });

  it("deletes a template the caller owns", async () => {
    templateResult.data = {
      id: "t1",
      category: "exame",
      title: "Hemograma",
      scope: "personal",
      owner_id: "professional-1",
      content: { type: "doc", content: [] },
    };

    const res = await deleteDocumentTemplateAction({
      templateId: "11111111-1111-1111-1111-111111111111",
    });

    expect(res?.data?.template).toEqual(templateResult.data);
    expect(res?.serverError).toBeUndefined();
  });

  it("rejects deleting a template it doesn't own (wrong owner or scope='global')", async () => {
    templateResult.error = { message: "JSON object requested, multiple (or no) rows returned" };

    const res = await deleteDocumentTemplateAction({
      templateId: "22222222-2222-2222-2222-222222222222",
    });

    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- delete-document-template-action.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the action**

```typescript
// apps/web/src/actions/delete-document-template-action.ts
"use server";

import { authActionClient } from "@/lib/safe-action";
import { deleteDocumentTemplateSchema } from "@/lib/validations/document-template";

export const deleteDocumentTemplateAction = authActionClient
  .inputSchema(deleteDocumentTemplateSchema)
  .action(async ({ parsedInput: { templateId }, ctx: { supabase, user } }) => {
    const { data: template, error } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", templateId)
      .eq("owner_id", user.id)
      .eq("scope", "personal")
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return { template };
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- delete-document-template-action.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/actions/delete-document-template-action.ts apps/web/src/actions/delete-document-template-action.test.ts
git commit -m "feat(actions): add deleteDocumentTemplateAction"
```

---

### Task 6: Add Tiptap dependencies + `unwrapTemplateBlocks`

`apps/web` doesn't depend on any `@tiptap/*` package yet (only `packages/ui` does, for the existing plain `RichEditor`). This task adds them directly to `apps/web`, and places all new editor code under `apps/web/src/components/shared/templated-rich-editor/` rather than `packages/ui/src/shared/` as the design spec originally proposed. Two reasons: (1) `packages/ui` has no test script, no Vitest config, and no test files at all — every test in this repo runs from `apps/web` per `CLAUDE.md`; (2) the exact "save block as template" UI this editor needs (`SaveContractChoiceModal`/`SaveNewTemplateModal`) already made this same call for contracts — those live in `apps/web/src/components/shared/`, not `packages/ui`, precisely because they're feature-specific composites built on top of `packages/ui`'s generic `ContentModal`/`ConfirmModal` shells. `TemplatedRichEditor` is the same kind of thing: domain-specific, not a generic primitive like the plain `RichEditor`.

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/components/shared/templated-rich-editor/unwrap-template-blocks.ts`
- Test: `apps/web/src/components/shared/templated-rich-editor/unwrap-template-blocks.test.ts`

**Interfaces:**
- Produces: `unwrapTemplateBlocks(node: JSONContent) => JSONContent`, used later by any consumer that renders a document's content outside the editor (PDF/preview — out of scope here, but this function is the reusable primitive for it).

- [ ] **Step 1: Add Tiptap dependencies**

Edit `apps/web/package.json`, adding to `dependencies` (matching the versions already pinned in `packages/ui/package.json`):

```json
"@tiptap/core": "^3.0.0",
"@tiptap/extension-bullet-list": "^3.0.0",
"@tiptap/extension-document": "^3.0.0",
"@tiptap/extension-heading": "^3.0.0",
"@tiptap/extension-ordered-list": "^3.0.0",
"@tiptap/extension-paragraph": "^3.0.0",
"@tiptap/extension-text": "^3.0.0",
"@tiptap/extension-text-align": "^3.0.0",
"@tiptap/extension-text-style": "^3.0.0",
"@tiptap/pm": "^3.0.0",
"@tiptap/react": "^3.0.0",
"@tiptap/starter-kit": "^3.0.0",
```

`@tiptap/extension-document` and `@tiptap/extension-text` are added here because Tasks 7-9's tests construct headless editors directly with `Document`/`Text` (not via `StarterKit`) — they're not otherwise used by the app, but need to be direct dependencies for pnpm's strict resolution to allow importing them.

Run: `pnpm install`
Expected: lockfile updates, no errors.

- [ ] **Step 2: Write the failing test**

```typescript
// apps/web/src/components/shared/templated-rich-editor/unwrap-template-blocks.test.ts
import { describe, expect, it } from "vitest";
import { unwrapTemplateBlocks } from "./unwrap-template-blocks";

describe("unwrapTemplateBlocks", () => {
  it("replaces a templateBlock node with its own children, preserving order", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "antes" }] },
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Vitamina D" },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Vitamina D 2000ui" }] },
            { type: "paragraph", content: [{ type: "text", text: "Tomar 1 cápsula ao dia" }] },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "depois" }] },
      ],
    };

    expect(unwrapTemplateBlocks(doc)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "antes" }] },
        { type: "paragraph", content: [{ type: "text", text: "Vitamina D 2000ui" }] },
        { type: "paragraph", content: [{ type: "text", text: "Tomar 1 cápsula ao dia" }] },
        { type: "paragraph", content: [{ type: "text", text: "depois" }] },
      ],
    });
  });

  it("handles multiple templateBlocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: {},
          content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
        },
        {
          type: "templateBlock",
          attrs: {},
          content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
        },
      ],
    };

    expect(unwrapTemplateBlocks(doc).content).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "A" }] },
      { type: "paragraph", content: [{ type: "text", text: "B" }] },
    ]);
  });

  it("returns a doc with no templateBlock unchanged", () => {
    const doc = {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "sem blocos" }] }],
    };

    expect(unwrapTemplateBlocks(doc)).toEqual(doc);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test -- unwrap-template-blocks.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the implementation**

```typescript
// apps/web/src/components/shared/templated-rich-editor/unwrap-template-blocks.ts
import type { JSONContent } from "@tiptap/core";

export function unwrapTemplateBlocks(node: JSONContent): JSONContent {
  if (!node.content) return node;

  return {
    ...node,
    content: node.content.flatMap((child) => {
      const unwrapped = unwrapTemplateBlocks(child);
      return unwrapped.type === "templateBlock" ? (unwrapped.content ?? []) : [unwrapped];
    }),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test -- unwrap-template-blocks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/components/shared/templated-rich-editor/unwrap-template-blocks.ts apps/web/src/components/shared/templated-rich-editor/unwrap-template-blocks.test.ts
git commit -m "feat(editor): add tiptap deps and unwrapTemplateBlocks helper"
```

---

### Task 7: `templateBlock` Tiptap node schema

**Files:**
- Create: `apps/web/src/components/shared/templated-rich-editor/template-block-node.ts`
- Create: `apps/web/src/components/shared/templated-rich-editor/template-block-view.tsx` (placeholder component, filled in properly in Task 8 — needed here only so `addNodeView` has something to import)
- Test: `apps/web/src/components/shared/templated-rich-editor/template-block-node.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `TemplateBlock` (Node, options `{ onRequestSave, onRequestDelete }`), `TemplateBlockParagraph`, `TemplateBlockHeading`, `TemplateBlockBulletList`, `TemplateBlockOrderedList` (group-extended StarterKit node replacements), `TemplateBlockAttrs` type, `TemplateBlockOptions` type — all consumed by Task 8 (NodeView) and Task 12 (main editor).

- [ ] **Step 1: Write a minimal `TemplateBlockView` stub**

This will be replaced with the real NodeView in Task 8; it only needs to exist so `template-block-node.ts` has a valid import and the schema test in this task can run without a NodeView-specific test needing the full chrome yet.

```tsx
// apps/web/src/components/shared/templated-rich-editor/template-block-view.tsx
"use client";

import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";

export function TemplateBlockView() {
  return (
    <NodeViewWrapper>
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 2: Write the failing test**

This test mounts a headless Tiptap `Editor` (not `useEditor`/React) with just enough of the schema to exercise `templateBlock` in isolation. It needs a DOM (`ReactNodeViewRenderer` renders into real DOM nodes), so it runs under `happy-dom`.

```typescript
// apps/web/src/components/shared/templated-rich-editor/template-block-node.test.ts
// @vitest-environment happy-dom
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { Editor, type Content } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { TemplateBlock, TemplateBlockParagraph } from "./template-block-node";

function makeEditor(content: Content) {
  return new Editor({
    extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock],
    content,
  });
}

describe("templateBlock node", () => {
  it("round-trips through JSON, preserving attrs", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Vitamina D" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "2000ui" }] }],
        },
      ],
    };

    const editor = makeEditor(doc);

    expect(editor.getJSON()).toEqual(doc);
    editor.destroy();
  });

  it("round-trips through HTML, serializing attrs as data-* attributes", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Vitamina D" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "2000ui" }] }],
        },
      ],
    };

    const editor = makeEditor(doc);
    const html = editor.getHTML();

    expect(html).toContain('data-type="template-block"');
    expect(html).toContain('data-template-id="t1"');
    editor.destroy();
  });

  it("documents that the schema alone does not reject a templateBlock nested via raw JSON (known limitation)", () => {
    // CONFIRMED EMPIRICALLY (2026-09-16, Task 7 implementation): Tiptap's JSON
    // deserialization (`new Editor({ content })` / `setContent`) does not strictly
    // validate nested content against `content: "templateBlockContent+"` here — it
    // neither throws nor strips the invalid nesting; the nested templateBlock survives
    // unchanged in editor.getJSON(). This test documents that reality rather than
    // asserting incorrect behavior.
    //
    // Real nesting prevention does not rely on this schema restriction alone — it comes
    // from controlling where new templateBlock nodes get inserted in the first place:
    // InsertBetweenBlocks (Task 9) only ever computes positions between top-level
    // siblings via `state.doc.forEach`, so it can't produce nesting. The sidebar
    // insertion in TemplatedRichEditor (Task 12) resolves the insertion position to the
    // nearest top-level boundary before inserting, specifically to close this gap. And
    // unwrapTemplateBlocks (Task 6) already handles nested templateBlocks correctly as a
    // safety net regardless, so even if nesting occurred through some other path, PDF/
    // preview generation would still flatten it correctly.
    const nestedDoc = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: {},
          content: [
            {
              type: "templateBlock",
              attrs: {},
              content: [{ type: "paragraph", content: [{ type: "text", text: "aninhado" }] }],
            },
          ],
        },
      ],
    };

    const editor = makeEditor(nestedDoc);
    const outer = editor.getJSON().content?.[0];
    const inner = outer?.content?.[0];

    expect(inner?.type).toBe("templateBlock");
    editor.destroy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter web test -- template-block-node.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the node schema**

```typescript
// apps/web/src/components/shared/templated-rich-editor/template-block-node.ts
import { mergeAttributes, Node } from "@tiptap/core";
import BulletList from "@tiptap/extension-bullet-list";
import Heading from "@tiptap/extension-heading";
import OrderedList from "@tiptap/extension-ordered-list";
import Paragraph from "@tiptap/extension-paragraph";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TemplateBlockView } from "./template-block-view";

export type TemplateBlockScope = "personal" | "global";

export interface TemplateBlockAttrs {
  templateId: string | null;
  templateScope: TemplateBlockScope | null;
  label: string | null;
}

export interface TemplateBlockOptions {
  onRequestSave: (pos: number, attrs: TemplateBlockAttrs) => void;
  onRequestDelete: (pos: number, attrs: TemplateBlockAttrs) => void;
}

const TEMPLATE_BLOCK_CONTENT_GROUP = "templateBlockContent";

export const TemplateBlockParagraph = Paragraph.extend({
  group: `block ${TEMPLATE_BLOCK_CONTENT_GROUP}`,
});

export const TemplateBlockHeading = Heading.extend({
  group: `block ${TEMPLATE_BLOCK_CONTENT_GROUP}`,
});

export const TemplateBlockBulletList = BulletList.extend({
  group: `block ${TEMPLATE_BLOCK_CONTENT_GROUP}`,
});

export const TemplateBlockOrderedList = OrderedList.extend({
  group: `block ${TEMPLATE_BLOCK_CONTENT_GROUP}`,
});

export const TemplateBlock = Node.create<TemplateBlockOptions>({
  name: "templateBlock",
  group: "block",
  content: `${TEMPLATE_BLOCK_CONTENT_GROUP}+`,
  draggable: true,
  isolating: true,

  addOptions() {
    return {
      // Real handlers are provided via .configure() in Task 12; these are just safe
      // defaults so calling them before configuration doesn't throw.
      onRequestSave: () => undefined,
      onRequestDelete: () => undefined,
    };
  },

  addAttributes() {
    return {
      templateId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-template-id"),
        renderHTML: (attributes) => ({ "data-template-id": attributes.templateId }),
      },
      templateScope: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-template-scope"),
        renderHTML: (attributes) => ({ "data-template-scope": attributes.templateScope }),
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label"),
        renderHTML: (attributes) => ({ "data-label": attributes.label }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="template-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-type": "template-block" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TemplateBlockView);
  },
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter web test -- template-block-node.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shared/templated-rich-editor/template-block-node.ts apps/web/src/components/shared/templated-rich-editor/template-block-node.test.ts apps/web/src/components/shared/templated-rich-editor/template-block-view.tsx
git commit -m "feat(editor): add templateBlock node schema with group-restricted content"
```

---

### Task 8: `TemplateBlockView` NodeView (chrome: drag handle, save, delete)

**Files:**
- Modify: `apps/web/src/components/shared/templated-rich-editor/template-block-view.tsx`
- Test: `apps/web/src/components/shared/templated-rich-editor/template-block-view.test.tsx`

**Interfaces:**
- Consumes: `TemplateBlockAttrs`, `TemplateBlockOptions` (Task 7).
- Produces: `TemplateBlockView` React component (used by `template-block-node.ts`'s `addNodeView`), rendering a "Reordenar bloco" drag handle (`data-drag-handle`), "Salvar bloco como modelo", and "Remover bloco" buttons — visible only when `editor.isEditable`.

- [ ] **Step 1: Write the failing test**

React NodeViews only mount through React's own lifecycle — specifically, `ReactNodeViewRenderer` checks `editor.contentComponent`, which is only ever set by `<EditorContent>`'s mount effect (`PureEditorContent`'s `componentDidMount`/`componentDidUpdate` → `init()`, in `@tiptap/react`'s source). A bare `new Editor({ element, ... })` — the pattern used in Task 7's test — never sets `contentComponent`, so `ReactNodeViewRenderer` silently returns `{}` and ProseMirror falls back to plain schema `renderHTML` output: no `NodeViewWrapper`, no buttons, ever. This test must mount through `<EditorContent>` via `@testing-library/react`'s `render()`, and query asynchronously (`findBy*`), since the NodeView mounts after React's initial commit, not synchronously with it.

```tsx
// apps/web/src/components/shared/templated-rich-editor/template-block-view.test.tsx
// @vitest-environment happy-dom
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { EditorContent, useEditor } from "@tiptap/react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TemplateBlock, type TemplateBlockAttrs, TemplateBlockParagraph } from "./template-block-node";

afterEach(cleanup);

const DOC = {
  type: "doc",
  content: [
    {
      type: "templateBlock",
      attrs: { templateId: "t1", templateScope: "personal", label: "Vitamina D" },
      content: [{ type: "paragraph", content: [{ type: "text", text: "2000ui" }] }],
    },
  ],
};

function TestHarness({
  onRequestSave,
  onRequestDelete,
  editable,
}: {
  onRequestSave: (pos: number, attrs: TemplateBlockAttrs) => void;
  onRequestDelete: (pos: number, attrs: TemplateBlockAttrs) => void;
  editable: boolean;
}) {
  const editor = useEditor({
    extensions: [
      Document,
      Text,
      TemplateBlockParagraph,
      TemplateBlock.configure({ onRequestSave, onRequestDelete }),
    ],
    content: DOC,
    editable,
    immediatelyRender: false,
  });

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}

describe("TemplateBlockView", () => {
  it("renders drag/save/delete controls when editable, and calls onRequestSave/onRequestDelete", async () => {
    const onRequestSave = vi.fn();
    const onRequestDelete = vi.fn();

    render(
      <TestHarness onRequestSave={onRequestSave} onRequestDelete={onRequestDelete} editable />,
    );

    const saveButton = await screen.findByLabelText("Salvar bloco como modelo");
    const deleteButton = await screen.findByLabelText("Remover bloco");
    const dragHandle = await screen.findByLabelText("Reordenar bloco");

    expect(saveButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
    expect(dragHandle).toBeInTheDocument();

    saveButton.click();
    expect(onRequestSave).toHaveBeenCalledWith(0, {
      templateId: "t1",
      templateScope: "personal",
      label: "Vitamina D",
    });

    deleteButton.click();
    expect(onRequestDelete).toHaveBeenCalledWith(0, {
      templateId: "t1",
      templateScope: "personal",
      label: "Vitamina D",
    });
  });

  it("hides all chrome when the editor is not editable", async () => {
    render(<TestHarness onRequestSave={vi.fn()} onRequestDelete={vi.fn()} editable={false} />);

    // Wait for the NodeView to actually mount (confirmed via its content, which renders
    // regardless of editable state) before asserting the chrome is absent — otherwise
    // "not yet mounted" would look identical to "correctly hidden" and the test would
    // pass vacuously.
    await screen.findByText("2000ui");

    expect(screen.queryByLabelText("Salvar bloco como modelo")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Remover bloco")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Reordenar bloco")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- template-block-view.test.tsx`
Expected: FAIL — stub renders no buttons.

- [ ] **Step 3: Write the NodeView**

```tsx
// apps/web/src/components/shared/templated-rich-editor/template-block-view.tsx
"use client";

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@ventre/ui/utils";
import { GripVertical, Save, Trash2 } from "lucide-react";
import type { TemplateBlockAttrs, TemplateBlockOptions } from "./template-block-node";

export function TemplateBlockView({ node, editor, getPos, extension }: ReactNodeViewProps) {
  const attrs = node.attrs as TemplateBlockAttrs;
  const options = extension.options as TemplateBlockOptions;
  const editable = editor.isEditable;

  function handleSave() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    options.onRequestSave(pos, attrs);
  }

  function handleDelete() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    options.onRequestDelete(pos, attrs);
  }

  return (
    <NodeViewWrapper
      className={cn(
        "rounded-lg",
        editable &&
          "group relative my-2 border border-input border-dashed p-3 hover:border-primary/50",
      )}
    >
      {editable && (
        <div
          contentEditable={false}
          className="mb-2 flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100"
        >
          <button
            type="button"
            data-drag-handle
            className="cursor-grab text-muted-foreground hover:text-foreground"
            aria-label="Reordenar bloco"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSave}
              className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Salvar bloco como modelo"
            >
              <Save className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remover bloco"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <NodeViewContent />
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- template-block-view.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Verify types**

Run: `pnpm check-types`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/shared/templated-rich-editor/template-block-view.tsx apps/web/src/components/shared/templated-rich-editor/template-block-view.test.tsx
git commit -m "feat(editor): add TemplateBlockView chrome (drag handle, save, delete)"
```

---

### Task 9: Insert-between-blocks "+" control

**Files:**
- Create: `apps/web/src/components/shared/templated-rich-editor/insert-between-blocks-extension.ts`
- Test: `apps/web/src/components/shared/templated-rich-editor/insert-between-blocks-extension.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `InsertBetweenBlocks` (Tiptap `Extension`, no options needed — fully self-contained via ProseMirror's `handleDOMEvents.click`), consumed by Task 12.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/components/shared/templated-rich-editor/insert-between-blocks-extension.test.ts
// @vitest-environment happy-dom
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { InsertBetweenBlocks } from "./insert-between-blocks-extension";
import { TemplateBlock, TemplateBlockParagraph } from "./template-block-node";

describe("InsertBetweenBlocks", () => {
  it("renders one insert widget before each top-level block, plus one at the end", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, Paragraph, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "um" }] },
          { type: "paragraph", content: [{ type: "text", text: "dois" }] },
        ],
      },
    });

    const widgets = element.querySelectorAll("[data-insert-block-at]");
    expect(widgets.length).toBe(3);

    editor.destroy();
    element.remove();
  });

  it("clicking a widget inserts an empty templateBlock at that position", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const editor = new Editor({
      element,
      extensions: [Document, Text, TemplateBlockParagraph, TemplateBlock, InsertBetweenBlocks],
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "existente" }] }],
      },
    });

    const firstWidget = element.querySelector("[data-insert-block-at]") as HTMLButtonElement;
    firstWidget.click();

    const json = editor.getJSON();
    expect(json.content?.some((node) => node.type === "templateBlock")).toBe(true);

    editor.destroy();
    element.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- insert-between-blocks-extension.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the extension**

```typescript
// apps/web/src/components/shared/templated-rich-editor/insert-between-blocks-extension.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const pluginKey = new PluginKey("insertBetweenBlocks");

const WIDGET_CLASS =
  "absolute left-1/2 top-0 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-background text-xs text-muted-foreground opacity-0 transition-opacity hover:opacity-100 hover:text-foreground focus-visible:opacity-100";

function makeInsertWidget(pos: number): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.insertBlockAt = String(pos);
  button.setAttribute("contenteditable", "false");
  button.setAttribute("aria-label", "Inserir bloco");
  button.className = WIDGET_CLASS;
  button.textContent = "+";
  return button;
}

export const InsertBetweenBlocks = Extension.create({
  name: "insertBetweenBlocks",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pluginKey,
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];

            state.doc.forEach((_node, offset) => {
              decorations.push(
                Decoration.widget(offset, () => makeInsertWidget(offset), {
                  side: -1,
                  key: `insert-${offset}`,
                }),
              );
            });

            const endPos = state.doc.content.size;
            decorations.push(
              Decoration.widget(endPos, () => makeInsertWidget(endPos), {
                side: 1,
                key: "insert-end",
              }),
            );

            return DecorationSet.create(state.doc, decorations);
          },
          handleDOMEvents: {
            click: (view, event) => {
              const target = event.target as HTMLElement;
              const posAttr = target
                .closest("[data-insert-block-at]")
                ?.getAttribute("data-insert-block-at");
              if (posAttr === null || posAttr === undefined) return false;

              const insertPos = Number(posAttr);
              const emptyBlock = view.state.schema.nodeFromJSON({
                type: "templateBlock",
                attrs: { templateId: null, templateScope: null, label: null },
                content: [{ type: "paragraph" }],
              });

              view.dispatch(view.state.tr.insert(insertPos, emptyBlock));
              return true;
            },
          },
        },
      }),
    ];
  },
});
```

`handleDOMEvents: { click }` is used instead of `handleClick` deliberately: ProseMirror's
`handleClick` is wired through the `mousedown`→`mouseup` pipeline (`prosemirror-view`'s
`LeftMouseDown.up()` → `handleSingleClick`), not the DOM `click` event — a raw
`element.click()` call (per the WHATWG spec) dispatches only `"click"`, with no
`mousedown`/`mouseup`, so `handleClick` never fires from it (confirmed empirically during
implementation — this is not a testing-environment quirk, it reproduces in a real browser
too, since `handleClick`'s `pos` argument is document-position-resolved and this widget
isn't really "document content" the same way clicked text is). `handleDOMEvents.click`
responds directly to the DOM `click` event instead, which real mouse clicks and
`element.click()` both dispatch — a better fit here since the insert position already
comes from the widget's own `data-insert-block-at` attribute, not from `handleClick`'s
position-resolution machinery, which this code never used anyway.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- insert-between-blocks-extension.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/templated-rich-editor/insert-between-blocks-extension.ts apps/web/src/components/shared/templated-rich-editor/insert-between-blocks-extension.test.ts
git commit -m "feat(editor): add insert-between-blocks '+' control"
```

---

### Task 10: `SaveBlockChoiceModal`

**Files:**
- Create: `apps/web/src/components/shared/templated-rich-editor/save-block-choice-modal.tsx`
- Test: `apps/web/src/components/shared/templated-rich-editor/save-block-choice-modal.test.tsx`

**Interfaces:**
- Consumes: `ContentModal` (`@ventre/ui/shared/content-modal`).
- Produces: `SaveBlockChoiceModal` component, props `{ open, onOpenChange, isPending, canOverwrite, onSaveCurrent, onCreateNew }`, consumed by Task 12.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shared/templated-rich-editor/save-block-choice-modal.test.tsx
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveBlockChoiceModal } from "./save-block-choice-modal";

afterEach(cleanup);

describe("SaveBlockChoiceModal", () => {
  it("calls onCreateNew when 'Criar novo modelo' is clicked", async () => {
    const onCreateNew = vi.fn();
    render(
      <SaveBlockChoiceModal
        open
        onOpenChange={() => {}}
        isPending={false}
        canOverwrite
        onSaveCurrent={() => {}}
        onCreateNew={onCreateNew}
      />,
    );

    await userEvent.click(screen.getByText("Criar novo modelo"));
    expect(onCreateNew).toHaveBeenCalledOnce();
  });

  it("calls onSaveCurrent when 'Sobrescrever modelo atual' is clicked", async () => {
    const onSaveCurrent = vi.fn();
    render(
      <SaveBlockChoiceModal
        open
        onOpenChange={() => {}}
        isPending={false}
        canOverwrite
        onSaveCurrent={onSaveCurrent}
        onCreateNew={() => {}}
      />,
    );

    await userEvent.click(screen.getByText("Sobrescrever modelo atual"));
    expect(onSaveCurrent).toHaveBeenCalledOnce();
  });

  it("hides the overwrite button when canOverwrite is false (global template)", () => {
    render(
      <SaveBlockChoiceModal
        open
        onOpenChange={() => {}}
        isPending={false}
        canOverwrite={false}
        onSaveCurrent={() => {}}
        onCreateNew={() => {}}
      />,
    );

    expect(screen.queryByText("Sobrescrever modelo atual")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- save-block-choice-modal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the modal**

```tsx
// apps/web/src/components/shared/templated-rich-editor/save-block-choice-modal.tsx
"use client";

import { Button } from "@ventre/ui/button";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2 } from "lucide-react";

interface SaveBlockChoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  canOverwrite: boolean;
  onSaveCurrent: () => void;
  onCreateNew: () => void;
}

export function SaveBlockChoiceModal({
  open,
  onOpenChange,
  isPending,
  canOverwrite,
  onSaveCurrent,
  onCreateNew,
}: SaveBlockChoiceModalProps) {
  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Salvar modelo"
      description="Deseja sobrescrever o modelo atual ou criar um novo?"
    >
      <div className="flex gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCreateNew}
          disabled={isPending}
          className="flex-1"
        >
          Criar novo modelo
        </Button>
        {canOverwrite && (
          <Button type="button" onClick={onSaveCurrent} disabled={isPending} className="flex-1">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sobrescrever modelo atual
          </Button>
        )}
      </div>
    </ContentModal>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- save-block-choice-modal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/templated-rich-editor/save-block-choice-modal.tsx apps/web/src/components/shared/templated-rich-editor/save-block-choice-modal.test.tsx
git commit -m "feat(editor): add SaveBlockChoiceModal"
```

---

### Task 11: `SaveBlockTemplateModal`

**Files:**
- Create: `apps/web/src/components/shared/templated-rich-editor/save-block-template-modal.tsx`
- Test: `apps/web/src/components/shared/templated-rich-editor/save-block-template-modal.test.tsx`

**Interfaces:**
- Consumes: `ContentModal`, `Form`/`FormField`/etc. (`@ventre/ui/form`), `Input` (`@ventre/ui/input`).
- Produces: `SaveBlockTemplateModal` component, props `{ open, onOpenChange, isPending, onConfirm(title: string) }`, consumed by Task 12.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shared/templated-rich-editor/save-block-template-modal.test.tsx
// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveBlockTemplateModal } from "./save-block-template-modal";

afterEach(cleanup);

describe("SaveBlockTemplateModal", () => {
  it("calls onConfirm with the entered name on submit", async () => {
    const onConfirm = vi.fn();
    render(
      <SaveBlockTemplateModal
        open
        onOpenChange={() => undefined}
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.type(screen.getByLabelText("Nome"), "Vitamina D");
    await userEvent.click(screen.getByText("Salvar"));

    expect(onConfirm).toHaveBeenCalledWith("Vitamina D");
  });

  it("does not call onConfirm when the name is empty", async () => {
    const onConfirm = vi.fn();
    render(
      <SaveBlockTemplateModal
        open
        onOpenChange={() => undefined}
        isPending={false}
        onConfirm={onConfirm}
      />,
    );

    await userEvent.click(screen.getByText("Salvar"));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByText("O nome não pode estar vazio")).toBeInTheDocument();
  });

  it("calls onOpenChange(false) when cancelled", async () => {
    const onOpenChange = vi.fn();
    render(
      <SaveBlockTemplateModal
        open
        onOpenChange={onOpenChange}
        isPending={false}
        onConfirm={() => undefined}
      />,
    );

    await userEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- save-block-template-modal.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the modal**

```tsx
// apps/web/src/components/shared/templated-rich-editor/save-block-template-modal.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@ventre/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@ventre/ui/form";
import { Input } from "@ventre/ui/input";
import { ContentModal } from "@ventre/ui/shared/content-modal";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const schema = z.object({
  title: z.string().min(1, "O nome não pode estar vazio"),
});

type FormValues = z.infer<typeof schema>;

interface SaveBlockTemplateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPending: boolean;
  onConfirm: (title: string) => void;
}

export function SaveBlockTemplateModal({
  open,
  onOpenChange,
  isPending,
  onConfirm,
}: SaveBlockTemplateModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: "" },
  });

  function onSubmit(values: FormValues) {
    onConfirm(values.title);
    form.reset();
  }

  return (
    <ContentModal
      open={open}
      onOpenChange={onOpenChange}
      title="Salvar como novo modelo"
      description="Dê um nome para este novo modelo."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do modelo" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending} className="flex-1">
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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- save-block-template-modal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/shared/templated-rich-editor/save-block-template-modal.tsx apps/web/src/components/shared/templated-rich-editor/save-block-template-modal.test.tsx
git commit -m "feat(editor): add SaveBlockTemplateModal"
```

---

### Task 12: `TemplatedRichEditor` (wires everything together)

**Files:**
- Create: `apps/web/src/components/shared/templated-rich-editor/templated-rich-editor.tsx`
- Test: `apps/web/src/components/shared/templated-rich-editor/templated-rich-editor.test.tsx`

**Interfaces:**
- Consumes: `TemplateBlock`, `TemplateBlockParagraph/Heading/BulletList/OrderedList` (Task 7), `TemplateBlockView` (Task 8, via `TemplateBlock`'s `addNodeView`), `InsertBetweenBlocks` (Task 9), `SaveBlockChoiceModal` (Task 10), `SaveBlockTemplateModal` (Task 11), `ConfirmModal` (`@ventre/ui/shared/confirm-modal`), `Tables<"document_templates">` (`@ventre/supabase/types`).
- Produces: `TemplatedRichEditor` component — props `{ content: JSONContent, onChange: (content: JSONContent) => void, templates: Tables<"document_templates">[], onOverwriteTemplate: (templateId: string, content: JSONContent) => Promise<void>, onCreateTemplate: (title: string, content: JSONContent) => Promise<{ id: string }>, disabled?: boolean, className?: string }`. This is the component a future document-type screen (e.g. an exam-request screen) will wire up with real server actions via `useAction` — that wiring itself is out of scope here (no screen exists yet).

- [ ] **Step 1: Write the failing test**

```tsx
// apps/web/src/components/shared/templated-rich-editor/templated-rich-editor.test.tsx
// @vitest-environment happy-dom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Tables } from "@ventre/supabase/types";
import { TemplatedRichEditor } from "./templated-rich-editor";

afterEach(cleanup);

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

const PERSONAL_TEMPLATE = {
  id: "t1",
  category: "exame",
  title: "Hemograma completo",
  scope: "personal",
  owner_id: "professional-1",
  content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }] },
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
} as unknown as Tables<"document_templates">;

describe("TemplatedRichEditor", () => {
  it("inserts a templateBlock when a sidebar template's '+' is clicked", async () => {
    const onChange = vi.fn();

    render(
      <TemplatedRichEditor
        content={EMPTY_DOC}
        onChange={onChange}
        templates={[PERSONAL_TEMPLATE]}
        onOverwriteTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
      />,
    );

    // findByLabelText, not getByLabelText: useEditor uses immediatelyRender: false (same as
    // RichEditor), so the editor — and this sidebar, gated behind `if (!editor) return null`
    // — isn't necessarily present in the very first synchronous render commit.
    await userEvent.click(await screen.findByLabelText("Inserir modelo Hemograma completo"));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      expect(
        lastCall?.content?.some(
          (node: { type?: string; attrs?: { templateId?: string } }) =>
            node.type === "templateBlock" && node.attrs?.templateId === "t1",
        ),
      ).toBe(true);
    });
  });

  it("opens the choice modal when saving a block with an existing personal templateId, and calls onOverwriteTemplate", async () => {
    const onOverwriteTemplate = vi.fn().mockResolvedValue(undefined);
    const content = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Hemograma completo" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
      ],
    };

    render(
      <TemplatedRichEditor
        content={content}
        onChange={vi.fn()}
        templates={[]}
        onOverwriteTemplate={onOverwriteTemplate}
        onCreateTemplate={vi.fn()}
      />,
    );

    // findByLabelText, not getByLabelText: this button lives inside templateBlock's
    // NodeView, which mounts via ReactNodeViewRenderer/EditorContent's own lifecycle —
    // the same async-mount timing Task 8 had to account for.
    await userEvent.click(await screen.findByLabelText("Salvar bloco como modelo"));
    expect(await screen.findByText("Sobrescrever modelo atual")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Sobrescrever modelo atual"));

    await waitFor(() => {
      expect(onOverwriteTemplate).toHaveBeenCalledWith(
        "t1",
        expect.objectContaining({ type: "doc" }),
      );
    });
  });

  it("skips the choice modal and opens the name modal directly for a block with no templateId", async () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: null, templateScope: null, label: null },
          content: [{ type: "paragraph", content: [{ type: "text", text: "novo conteúdo" }] }],
        },
      ],
    };

    render(
      <TemplatedRichEditor
        content={content}
        onChange={vi.fn()}
        templates={[]}
        onOverwriteTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByLabelText("Salvar bloco como modelo"));

    expect(await screen.findByText("Salvar como novo modelo")).toBeInTheDocument();
    expect(screen.queryByText("Sobrescrever modelo atual")).not.toBeInTheDocument();
  });

  it("removes a block after confirming deletion", async () => {
    const onChange = vi.fn();
    const content = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Hemograma completo" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
      ],
    };

    render(
      <TemplatedRichEditor
        content={content}
        onChange={onChange}
        templates={[]}
        onOverwriteTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByLabelText("Remover bloco"));
    expect(await screen.findByText("Remover bloco")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Confirmar"));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      expect(lastCall?.content?.some((node: { type?: string }) => node.type === "templateBlock")).toBe(
        false,
      );
    });
  });

  it("inserts a new templateBlock as a top-level sibling, not nested, when the caret is inside an existing templateBlock", async () => {
    // This is the one test exercising the actual reason resolveTopLevelInsertPos exists:
    // Task 7 confirmed the schema alone does NOT reject a templateBlock nested inside
    // another one, so this insertion-position logic is the only thing standing between
    // the feature and nested blocks. The other insertion test (test 1) inserts into an
    // empty doc, where the caret is already at the top level — it never exercises the
    // depth-2 case (caret inside an existing block's paragraph) this helper is for.
    const onChange = vi.fn();
    const content = {
      type: "doc",
      content: [
        {
          type: "templateBlock",
          attrs: { templateId: "t1", templateScope: "personal", label: "Hemograma completo" },
          content: [{ type: "paragraph", content: [{ type: "text", text: "HEMOGRAMA" }] }],
        },
      ],
    };

    render(
      <TemplatedRichEditor
        content={content}
        onChange={onChange}
        templates={[PERSONAL_TEMPLATE]}
        onOverwriteTemplate={vi.fn()}
        onCreateTemplate={vi.fn()}
      />,
    );

    // Click into the existing block's text to move the caret there — ProseMirror syncs
    // its selection off the browser's own Selection/Range state on click. If this
    // doesn't reliably move ProseMirror's selection under happy-dom (unlike a real
    // browser), that's worth escalating rather than guessing around: try
    // editor.commands.setTextSelection at a known position instead (this requires
    // exposing the editor instance for the test, e.g. a test-only ref/callback prop —
    // only add that if the click-based approach genuinely doesn't work here).
    const existingText = await screen.findByText("HEMOGRAMA");
    await userEvent.click(existingText);

    await userEvent.click(await screen.findByLabelText("Inserir modelo Hemograma completo"));

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0];
      const topLevelNodes: { type?: string; content?: { type?: string }[] }[] =
        lastCall?.content ?? [];

      expect(topLevelNodes.filter((node) => node.type === "templateBlock").length).toBe(2);
      for (const node of topLevelNodes) {
        // `content ?? []`, not `content?.`: a childless top-level node (e.g. a trailing
        // empty paragraph ProseMirror can append after an `isolating` templateBlock) has
        // no `content` key at all in its JSON — `[].some(...)` is correctly `false`
        // ("vacuously has no nested templateBlock"), whereas `undefined?.some(...)` is
        // `undefined`, which fails `.toBe(false)` even though the assertion should pass.
        expect((node.content ?? []).some((child) => child.type === "templateBlock")).toBe(false);
      }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- templated-rich-editor.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

```tsx
// apps/web/src/components/shared/templated-rich-editor/templated-rich-editor.tsx
"use client";

import type { JSONContent } from "@tiptap/core";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyleKit } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import type { Tables } from "@ventre/supabase/types";
import { ConfirmModal } from "@ventre/ui/shared/confirm-modal";
import { cn } from "@ventre/ui/utils";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  List,
  ListOrdered,
  Plus,
  Underline,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InsertBetweenBlocks } from "./insert-between-blocks-extension";
import { SaveBlockChoiceModal } from "./save-block-choice-modal";
import { SaveBlockTemplateModal } from "./save-block-template-modal";
import {
  TemplateBlock,
  type TemplateBlockAttrs,
  TemplateBlockBulletList,
  TemplateBlockHeading,
  TemplateBlockOrderedList,
  TemplateBlockParagraph,
  type TemplateBlockScope,
} from "./template-block-node";

export interface TemplatedRichEditorProps {
  content: JSONContent;
  onChange: (content: JSONContent) => void;
  templates: Tables<"document_templates">[];
  onOverwriteTemplate: (templateId: string, content: JSONContent) => Promise<void>;
  onCreateTemplate: (title: string, content: JSONContent) => Promise<{ id: string }>;
  disabled?: boolean;
  className?: string;
}

export function TemplatedRichEditor({
  content,
  onChange,
  templates,
  onOverwriteTemplate,
  onCreateTemplate,
  disabled,
  className,
}: TemplatedRichEditorProps) {
  const [activeBlock, setActiveBlock] = useState<{ pos: number; attrs: TemplateBlockAttrs } | null>(
    null,
  );
  const [saveStep, setSaveStep] = useState<"choice" | "name" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ paragraph: false, heading: false, bulletList: false, orderedList: false }),
      TemplateBlockParagraph,
      TemplateBlockHeading,
      TemplateBlockBulletList,
      TemplateBlockOrderedList,
      TextStyleKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      TemplateBlock.configure({
        onRequestSave: (pos, attrs) => {
          setActiveBlock({ pos, attrs });
          setSaveStep(attrs.templateId && attrs.templateScope === "personal" ? "choice" : "name");
        },
        onRequestDelete: (pos, attrs) => {
          setActiveBlock({ pos, attrs });
          setDeleteTarget(pos);
        },
      }),
      InsertBetweenBlocks,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content,
    editorProps: {
      attributes: { class: "min-h-[200px] px-4 py-3 text-sm focus:outline-none" },
    },
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });

  // useEditor only applies `content` at creation time — it does not re-parse it into the
  // doc on later prop updates. A consuming screen that loads its document asynchronously
  // (the expected real usage) would otherwise see a permanently blank editor. Mirrors the
  // same fix already used by the sibling RichEditor (packages/ui/src/shared/rich-editor/
  // rich-editor.tsx:61-65), adapted for JSON (RichEditor compares HTML strings) — the
  // stringify comparison guards against clobbering the user's own in-flight edits on every
  // onChange round-trip (onChange fires with the same content `content` was just set to).
  //
  // Known caveat (found during Task 12's review fix round, via a standalone A/B repro):
  // if `content` doesn't byte-match Tiptap's own schema-normalized JSON (e.g. missing
  // `attrs: { textAlign: null }`), this comparison treats it as "changed" and calls
  // setContent even when nothing meaningfully differs. For a document whose LAST
  // top-level node is a templateBlock specifically, that redundant setContent call can
  // append a trailing empty paragraph (ProseMirror needs a cursor-reachable position
  // after an `isolating` node). Content round-tripped through this editor's own onChange
  // already carries normalized attrs, so this mainly affects hand-authored fixtures or
  // content predating this schema — same class of imprecision RichEditor's own
  // string-equality check already accepts, not something this task introduces new risk
  // for. Worth a look if a future screen sees an unexpected trailing blank line on
  // documents ending in a template block.
  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(content) === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent(content);
  }, [editor, content]);

  if (!editor) return null;

  // Resolves to the position right after the top-level block containing `pos` (or `pos`
  // itself if already at the top level). Used to guarantee new templateBlock nodes are
  // always inserted as top-level siblings, never inside an existing templateBlock's
  // content — see the "No nesting" Global Constraint: the schema alone doesn't reject
  // invalid nesting, so insertion call sites have to avoid producing it in the first
  // place.
  const resolveTopLevelInsertPos = (pos: number): number => {
    const $pos = editor.state.doc.resolve(pos);
    return $pos.depth === 0 ? pos : $pos.after(1);
  };

  const insertTemplate = (template: Tables<"document_templates">) => {
    const pos = resolveTopLevelInsertPos(editor.state.selection.to);
    const templateContent = template.content as unknown as JSONContent;
    // document_templates.scope is a plain `text` column (constrained by a CHECK, not a
    // Postgres enum), so the generated type is `string`, not the "personal" | "global"
    // union TemplateBlockAttrs expects — the cast is safe because the DB constraint
    // already guarantees one of those two values.
    editor
      .chain()
      .insertContentAt(pos, {
        type: "templateBlock",
        attrs: {
          templateId: template.id,
          templateScope: template.scope as TemplateBlockScope,
          label: template.title,
        },
        content: templateContent.content ?? [{ type: "paragraph" }],
      })
      .run();
  };

  const handleOverwrite = async () => {
    if (!activeBlock?.attrs.templateId) return;
    setIsSaving(true);
    try {
      const nodeJson = editor.state.doc.nodeAt(activeBlock.pos)?.toJSON() as JSONContent | undefined;
      if (!nodeJson?.content) return;
      await onOverwriteTemplate(activeBlock.attrs.templateId, {
        type: "doc",
        content: nodeJson.content,
      });
      setSaveStep(null);
    } catch (error) {
      // Surfacing this to the user (toast, inline error) is the consuming screen's
      // responsibility — onOverwriteTemplate is expected to come from a hook like
      // next-safe-action's useAction, which has its own onError handling. This catch
      // exists only so a rejection doesn't become an unhandled promise rejection;
      // leaving saveStep untouched (not calling setSaveStep(null)) keeps the modal open
      // so the user can retry instead of it silently closing as if it had succeeded.
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async (title: string) => {
    if (!activeBlock) return;
    setIsSaving(true);
    try {
      const nodeJson = editor.state.doc.nodeAt(activeBlock.pos)?.toJSON() as JSONContent | undefined;
      if (!nodeJson?.content) return;
      const { id } = await onCreateTemplate(title, { type: "doc", content: nodeJson.content });
      editor
        .chain()
        .command(({ tr }) => {
          tr.setNodeAttribute(activeBlock.pos, "templateId", id);
          tr.setNodeAttribute(activeBlock.pos, "templateScope", "personal");
          tr.setNodeAttribute(activeBlock.pos, "label", title);
          return true;
        })
        .run();
      setSaveStep(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = () => {
    if (deleteTarget === null) return;
    const node = editor.state.doc.nodeAt(deleteTarget);
    if (node) {
      editor.chain().deleteRange({ from: deleteTarget, to: deleteTarget + node.nodeSize }).run();
    }
    setDeleteTarget(null);
  };

  const toolbarBtn = (active: boolean) =>
    cn(
      "rounded p-1 transition-colors",
      active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
      disabled && "pointer-events-none opacity-50",
    );

  return (
    <div className={cn("flex gap-4", className)}>
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-input">
        <div className="flex shrink-0 flex-wrap items-center gap-1 p-2">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={toolbarBtn(editor.isActive("bold"))}
            disabled={disabled}
            aria-label="Negrito"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={toolbarBtn(editor.isActive("italic"))}
            disabled={disabled}
            aria-label="Itálico"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={toolbarBtn(editor.isActive("underline"))}
            disabled={disabled}
            aria-label="Sublinhado"
          >
            <Underline className="h-4 w-4" />
          </button>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={toolbarBtn(editor.isActive("bulletList"))}
            disabled={disabled}
            aria-label="Lista com marcadores"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={toolbarBtn(editor.isActive("orderedList"))}
            disabled={disabled}
            aria-label="Lista numerada"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={toolbarBtn(editor.isActive({ textAlign: "left" }))}
            disabled={disabled}
            aria-label="Alinhar à esquerda"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={toolbarBtn(editor.isActive({ textAlign: "center" }))}
            disabled={disabled}
            aria-label="Centralizar"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={toolbarBtn(editor.isActive({ textAlign: "right" }))}
            disabled={disabled}
            aria-label="Alinhar à direita"
          >
            <AlignRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
            className={toolbarBtn(editor.isActive({ textAlign: "justify" }))}
            disabled={disabled}
            aria-label="Justificar"
          >
            <AlignJustify className="h-4 w-4" />
          </button>
        </div>
        <div className="relative flex-1 overflow-y-auto [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div className="w-56 shrink-0">
        <h3 className="mb-2 font-medium text-sm">Modelos</h3>
        <ul className="space-y-1">
          {templates.map((template) => (
            <li
              key={template.id}
              className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-accent"
            >
              <span>{template.title}</span>
              <button
                type="button"
                onClick={() => insertTemplate(template)}
                disabled={disabled}
                aria-label={`Inserir modelo ${template.title}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      <SaveBlockChoiceModal
        open={saveStep === "choice"}
        onOpenChange={(open) => !open && setSaveStep(null)}
        isPending={isSaving}
        canOverwrite={activeBlock?.attrs.templateScope === "personal"}
        onSaveCurrent={handleOverwrite}
        onCreateNew={() => setSaveStep("name")}
      />

      <SaveBlockTemplateModal
        open={saveStep === "name"}
        onOpenChange={(open) => !open && setSaveStep(null)}
        isPending={isSaving}
        onConfirm={handleCreateNew}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remover bloco"
        description="Tem certeza que deseja remover este bloco do documento? Essa ação não pode ser desfeita."
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- templated-rich-editor.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Verify types and lint across the whole feature**

Run: `pnpm check-types && npx biome lint apps/web/src/components/shared/templated-rich-editor apps/web/src/actions apps/web/src/lib/validations`
Expected: no errors. Fix any Biome class-sorting warnings with `npx biome lint --write --unsafe <file>` per project convention.

- [ ] **Step 6: Run the full test suite for the touched packages**

Run: `pnpm --filter web test`
Expected: all tests pass, including every test file created in Tasks 2-12.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/shared/templated-rich-editor/templated-rich-editor.tsx apps/web/src/components/shared/templated-rich-editor/templated-rich-editor.test.tsx
git commit -m "feat(editor): add TemplatedRichEditor, wiring node/NodeView/modals/sidebar together"
```

---

## Self-Review Notes

- **Spec coverage**: DB schema (Task 1), template CRUD actions (Tasks 2-5), no-`<script>`/JSON-storage decision (Task 6 constant, enforced throughout), NodeView chrome — drag/save/delete (Task 8), save-as-template overwrite-vs-new flow (Tasks 10-12), delete-with-confirmation (Task 12), "+" insert-between-blocks (Task 9), no-nesting schema constraint (Task 7) — all covered. The `documents` table, document-type screens, Memed integration, and `apps/admin` CRUD for global templates are explicitly out of scope per the spec and not included here.
- **Placeholder scan**: no TBD/TODO; the one place with residual uncertainty (Task 7 Step 2's nesting-behavior assertion, Task 8's `NodeViewProps` export name) is flagged with a concrete fallback action, not left open-ended.
- **Type consistency**: `TemplateBlockAttrs` (Task 7) is used identically in Tasks 8 and 12; `Tables<"document_templates">` (Task 1) flows unchanged through Task 12's props; `unwrapTemplateBlocks(node: JSONContent)` (Task 6) matches its only current caller (none yet — reserved for future PDF/preview work, as noted in its task).
