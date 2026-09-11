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

## Testing

Tests live in `apps/web` (Vitest — `pnpm test` from repo root runs `turbo run test`). CI runs them via `.github/workflows/test.yml` on push to `main` and on every PR.

- **Touching a file with no tests** — add unit tests (and integration tests where the change crosses a boundary, e.g. a server action hitting Supabase) covering the code you changed, not just the new lines.
- **Implementing a new feature** — ship it with unit and integration tests as part of the same change, not as a follow-up.
- **Pre-existing tests break from your changes** — do not silently fix the test or the implementation. Stop and report the broken test(s) to the developer with your analysis of the scenario (is the test asserting stale/wrong behavior, or is it catching a real regression?) so they can decide how to proceed.

## Architecture

**Monorepo** managed by Turborepo + pnpm workspaces:
- `apps/web` — Next.js 15 (main app, React 19, App Router)
- `apps/admin` — internal admin app
- `apps/storybook` — component workshop for `packages/ui`
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

### Feature flags (PostHog)

Gate incomplete/rolling-out features with PostHog flags rather than env vars:
- Client: `useFeatureFlagEnabled("flag-name")` from `posthog-js/react` (e.g. `disable-birth-mode-for-doulas` in `use-birth-mode-status.ts`)
- Server-side gating (blocking direct route access) is enforced separately in the route/middleware, not just hidden in the UI — see the doula birth-mode gate for the pattern of blocking both the UI entry point and direct navigation.

### Notifications — queue-based, multi-channel

Outbound push/email/WhatsApp notifications go through Postgres queues (`pgmq`-style), not direct sends from actions:
- `src/lib/notifications/queue.ts` — `enqueueNotification()` calls the `enqueue_notification` RPC with `queueName` (`push_notifications` | `whatsapp_notifications` | `email_notifications`), `notificationType`, `referenceType/Id`, `recipientType/Id`, optional `delaySeconds`/`dedupKey`
- `src/lib/notifications/*-queue-handlers.ts` — per-channel dequeue + send logic, invoked by `/api/cron/process-notification-queues`
- `src/lib/whatsapp/` — Meta WhatsApp Cloud API client (`client.ts`), message templates (`templates.ts`), inbound webhook payload schemas (`webhook-schemas.ts`) and HMAC signature verification (`webhook-signature.ts`)
- `/api/whatsapp/webhook` — `GET` handles Meta's verification handshake (`WHATSAPP_WEBHOOK_VERIFY_TOKEN`); `POST` verifies `x-hub-signature-256` against `WHATSAPP_APP_SECRET` before processing inbound messages/status updates/button replies (`WHATSAPP_INBOUND_BUTTON_HANDLERS`)

### Birth mode / Partograph

Labor-tracking feature (`app/(dashboard)/modo-parto`) activated per-pregnancy, with a realtime activation bar shown to professionals (`use-birth-mode-status.ts`, `use-birth-mode-realtime.ts`) and gated per-flag for doulas (see Feature flags above). The partograph PDF is composed by overlaying an SVG (FCF, dilatação/descida, pulso/PA, contrações bands) onto a template PNG via `sharp`, then uploaded to a dedicated Supabase Storage bucket with team-member RLS (`partograph_storage_rls_text_compare.sql` — RLS compares storage object names as text, not uuid).

### Payments — Stripe Payment Links

Plan checkout redirects to Stripe-managed Payment Links (via `get_active_payment_link(plan_id, frequence)`, precedence: active → priority → not exhausted → primary → most recent), falling back to a dynamic Checkout Session using `plans.value` only when no active link exists. `stripe_payment_link` tracks usage (`used_subscription`, incremented idempotently from the webhook). Because `client_reference_id` is client-editable, the webhook cross-checks the paying customer's email against the resolved account's email to catch account-attribution spoofing (mitigation, not a full guarantee). Admin CRUD lives under `apps/admin/.../plans/[id]/_components/plan-payment-links-section.tsx`.

### Scheduled jobs — two mechanisms

This repo drives cron-style work through two independent schedulers. If a scheduled job doesn't seem to be firing, check both:

- **Vercel Cron** (`apps/web/vercel.json`) — hits `apps/web/app/api/cron/*` routes directly (`billing-statuses`, `invite-statuses`). Each route checks `Authorization: Bearer $CRON_SECRET`.
- **`pg_cron` + `pg_net`** — SQL jobs (`SELECT cron.job`) that call a `SECURITY DEFINER` Postgres function, which uses `net.http_get`/`net.http_post` to call back into an `apps/web/app/api/cron/*` route with the same `CRON_SECRET` header. Used by `process_scheduled_notifications()` (legacy, `20260209000001_notification_cron.sql`) and `process_notification_queues()` (`20260805100006_process_notification_queues_cron.sql`), which drives `/api/cron/process-notification-queues`. This path requires `app.settings.web_app_url` / `app.settings.cron_secret` to be set at the database level (`ALTER DATABASE ... SET ...`) or the function silently no-ops.
