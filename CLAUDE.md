# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev                        # Run all apps (turbo)
cd apps/web && pnpm dev         # Run web app only (port 3000)

# Build & type checking
pnpm build                      # Build all apps
pnpm check-types                # TypeScript check across all packages

# Linting & formatting
pnpm lint                       # Biome lint (all packages)
pnpm check                      # Biome check (lint + format)
pnpm format                     # Biome format with write

# Database
pnpm db:push                    # Apply migrations to Supabase
pnpm db:pull                    # Pull remote schema
pnpm db:types                   # Regenerate TypeScript types from Supabase schema
                                # → writes to packages/supabase/src/types/database.types.ts

# Fix Biome class sorting warnings
npx biome lint --write --unsafe <file>
```

## Architecture

**Monorepo** managed by Turborepo + pnpm workspaces:
- `apps/web` — Next.js 16 (main app, React 19, App Router)
- `apps/admin`, `apps/docs` — secondary apps
- `packages/supabase` — Supabase clients and generated types
- `packages/ui` — shared component library

### Supabase clients

Exported from `@nascere/supabase/server`:

```ts
createServerSupabaseClient()  // uses anon key, respects RLS — use for most queries
createServerSupabaseAdmin()   // uses service_role key, bypasses RLS — use only after manual auth check
```

The browser client is at `@nascere/supabase` (or `/client`). Types are at `@nascere/supabase/types`.

**When to use admin:** Only for cross-user writes (e.g. creating a patient and adding the creator as team member) after explicitly verifying authorization. Never use it to silently skip RLS.

### Server actions

All mutations use `next-safe-action` via `authActionClient` from `@/lib/safe-action`:

```ts
"use server";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

export const myAction = authActionClient
  .inputSchema(z.object({ ... }))
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user } }) => {
    // supabase = RLS-enforced client
    // supabaseAdmin = bypass RLS (use sparingly)
    // user = authenticated Supabase user
  });
```

Client-side: `useAction(myAction)` / `executeAsync(...)` from `next-safe-action/hooks`.

### API routes

Next.js 15+ async params pattern is required:

```ts
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ...
}
```

### Database access patterns

- `patients.created_by` — the professional who created the patient
- `team_members` — links professionals to patients; RLS uses `is_team_member(patient_id)`
- Patients are visible to their creator (`patients.user_id = auth.uid()`) and all team members
- UUID PKs via `extensions.uuid_generate_v4()`
- Standard columns: `created_at timestamptz DEFAULT now()`

After writing migrations, always run `pnpm db:types` to keep `database.types.ts` in sync. The types file can also be edited manually as a temporary measure before applying migrations.

### Frontend structure

- `app/(dashboard)/` — authenticated dashboard routes
- `app/(auth)/` — login, register, forgot-password
- `src/screens/` — full-page client components (one per route)
- `src/components/shared/` — reusable components (`EmptyState`, `ConfirmModal`, `LoadingCard`, `ContentModal`, `FinishCareModal`, etc.)
- `src/components/ui/` — Shadcn-style primitives (Button, Input, Badge, Dialog, Sheet, etc.)
- `src/actions/` — all server actions
- `src/lib/` — utilities, safe-action setup, validations

### UI conventions

- All user-facing strings in **Portuguese (pt-BR)**
- Toast notifications via `sonner`
- Responsive modals: `Dialog` on desktop, `Sheet` (bottom) on mobile — check `window.innerWidth < 640`
- Icons from `lucide-react`
- Tailwind CSS — Biome enforces class sort order (`useSortedClasses: warn`); fix with `biome lint --write --unsafe`

### Key types

```ts
// apps/web/src/types/index.ts
PatientFilter = "all" | "recent" | "trim1" | "trim2" | "trim3" | "final" | "finished"
```

`finished` patients are hidden from the main list; use `filter_type = 'finished'` in `get_filtered_patients` to show them.

### PWA

Service worker via Serwist (`app/sw.ts`), disabled in development. `next.config.js` uses `withSerwist` wrapper.
