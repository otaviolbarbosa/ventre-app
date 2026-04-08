# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm check-types                # TypeScript check across all packages
pnpm db:push                    # Apply migrations to Supabase
pnpm db:pull                    # Pull remote schema
pnpm db:types                   # Regenerate TS types → packages/supabase/src/types/database.types.ts

# Fix Biome class sorting warnings
npx biome lint --write --unsafe <file>
```

After writing migrations, always run `pnpm db:types` to keep `database.types.ts` in sync.

## Architecture

**Monorepo** managed by Turborepo + pnpm workspaces:
- `apps/web` — Next.js 15 (main app, React 19, App Router)
- `packages/supabase` — Supabase clients and generated types
- `packages/ui` — shared component library

### Supabase clients

Exported from `@ventre/supabase/server`:

```ts
createServerSupabaseClient()  // anon key, respects RLS — use for most queries
createServerSupabaseAdmin()   // service_role key, bypasses RLS — use only after manual auth check
```

Browser client: `@ventre/supabase` (or `/client`). Types: `@ventre/supabase/types`.

**When to use admin:** Only for cross-user writes (e.g. creating a patient and adding the creator as team member) after explicitly verifying authorization. Never use it to silently skip RLS.

### Server actions

All mutations use `next-safe-action` via `authActionClient` from `@/lib/safe-action`. Context provides `{ supabase, supabaseAdmin, user }`. Client-side: `useAction` / `executeAsync` from `next-safe-action/hooks`.

### Database access patterns

- `team_members` — links professionals to patients; RLS uses `is_team_member(patient_id)`
- Patients visible to creator (`patients.user_id = auth.uid()`) and all team members
- UUID PKs via `extensions.uuid_generate_v4()`

### Frontend structure

- `app/(dashboard)/` — authenticated routes, `app/(auth)/` — login/register
- `src/screens/` — full-page client components (one per route)
- `src/components/shared/` — reusable components, `src/components/ui/` — Shadcn primitives
- `src/actions/` — server actions, `src/lib/` — utilities, safe-action setup, validations

### UI conventions

- All user-facing strings in **Portuguese (pt-BR)**
- Toast notifications via `sonner`, icons from `lucide-react`
- Responsive modals: `Dialog` on desktop, `Sheet` (bottom) on mobile — check `window.innerWidth < 640`
- `finished` patients are hidden from the main list; use `filter_type = 'finished'` in `get_filtered_patients` to show them

### PWA

Service worker via Serwist (`app/sw.ts`), disabled in development. `next.config.js` uses `withSerwist` wrapper.
