# Feature: Verificação Pública de Contrato Assinado (Phase 3)

## Summary

Criar uma rota pública `/check/[codigo]` (sem login) onde qualquer pessoa pode enviar o PDF de
um contrato assinado que possui em mãos. O servidor busca o `contracts` por `verification_code`
via `createServerSupabaseAdmin()` (RLS não permite leitura anônima), recalcula SHA-256 sobre os
bytes do arquivo enviado com o mesmo algoritmo já usado em `sign-patient-contract-action.ts`, e
compara com o `content_hash` armazenado. Exibe um estado de sucesso (nome de quem assinou +
data/hora) ou falha, seguindo o padrão visual de página pública já usado em
`register-confirmation`/`payment-confirmation`.

## User Story

Como qualquer pessoa (paciente, advogado, parte interessada) que possui um PDF de contrato
assinado eletronicamente,
Eu quero enviar esse PDF em uma página pública e ver se ele é autêntico,
Para confirmar, sem depender da palavra da clínica, que o documento não foi alterado desde a
assinatura.

## Problem Statement

Hoje (pós Fases 1 e 2) o contrato assinado já tem hash SHA-256, código de verificação único e
selo visual mostrando um link `/check/{codigo}` — mas essa rota não existe. O link estampado no
PDF é morto; não há forma pública de validar autenticidade sem acesso interno ao banco.

## Solution Statement

Duas peças novas, ambas fora dos grupos `(auth)`/`(dashboard)` (portanto sem chrome
autenticado, herdando apenas `app/layout.tsx`):

1. **Route Handler** `apps/web/app/api/check/[codigo]/route.ts` (`POST`): recebe o PDF via
   `request.formData()`, valida tipo/tamanho, calcula `createHash("sha256").update(buffer).digest("hex")`
   sobre os bytes recebidos (mesmo algoritmo de `sign-patient-contract-action.ts:100`), busca o
   `contracts` por `verification_code` usando `createServerSupabaseAdmin()` (RLS bloqueia leitura
   anônima — confirmado nas policies), resolve o nome do signatário via join em `users` (também
   via admin, sem sessão), compara o hash calculado com `content_hash` e retorna um JSON de
   resultado.
2. **Page** `apps/web/app/check/[codigo]/page.tsx` (client component): formulário de upload de
   um único PDF (drag-and-drop + input escondido, padrão simplificado de
   `patient-documents.tsx`), chama o Route Handler via `fetch`, exibe loading → sucesso (ícone
   verde, nome + data/hora formatada) ou falha (ícone vermelho, mensagem genérica) reutilizando
   o layout centralizado de `register-confirmation/page.tsx`.

Comparação de hash usa `===` simples (string) — não é um segredo, é um check de integridade
público; `crypto.timingSafeEqual` seria over-engineering aqui (ver Risks).

## Metadata

| Field            | Value                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                                        |
| Complexity       | MEDIUM                                                                |
| Systems Affected | Public routing (`apps/web/app/check/`), Route Handler (file upload + hash), Supabase admin client, RLS-gated `contracts`/`users` read |
| Dependencies     | None new — Node `crypto`, Next.js 15 Route Handlers, existing `@ventre/supabase/server` |
| Estimated Tasks  | 4                                                                      |

---

## UX Design

### Before State

```
╔══════════════════════════════════════════════════════════════════╗
║                          BEFORE STATE                              ║
╠══════════════════════════════════════════════════════════════════╣
║  Signed PDF stamp shows: "https://app.../check/ABC123XYZ9"          ║
║  → link is DEAD, no route exists (404)                              ║
║                                                                      ║
║  No way for a patient/lawyer/third party to verify a PDF without    ║
║  contacting the clinic directly and trusting their word.            ║
╚══════════════════════════════════════════════════════════════════╝
```

### After State

```
╔══════════════════════════════════════════════════════════════════╗
║                           AFTER STATE                               ║
╠══════════════════════════════════════════════════════════════════╣
║  GET /check/ABC123XYZ9                                              ║
║  ┌────────────────────────────────────────────┐                     ║
║  │  [Ventre logo]                               │                     ║
║  │  Verificação de Contrato                     │                     ║
║  │  Código: ABC123XYZ9                          │                     ║
║  │                                               │                     ║
║  │  ┌──────────────────────────────┐            │                     ║
║  │  │  Arraste o PDF aqui ou       │            │                     ║
║  │  │  clique para selecionar      │            │                     ║
║  │  └──────────────────────────────┘            │                     ║
║  └────────────────────────────────────────────┘                     ║
║                          │                                           ║
║                          ▼ (upload PDF)                              ║
║                                                                      ║
║  SUCCESS state:                    FAILURE state:                   ║
║  ✔ Documento autêntico             ✘ Documento não confere          ║
║  Assinado por {nome}                Não foi possível confirmar a    ║
║  em {data/hora}                     autenticidade deste arquivo.    ║
╚══════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `apps/web/app/check/[codigo]/page.tsx` | Route doesn't exist (404) | Public upload page, no auth | Verification link on the stamp actually works |
| `apps/web/app/api/check/[codigo]/route.ts` | N/A | `POST` accepts PDF, returns `{ valid: boolean, signedByName?, signedAt? }` | Anyone can confirm authenticity without contacting the clinic |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/app/api/patients/[id]/documents/route.ts` | 73-133 | Full `POST` — mirror `formData()` parsing, type/size validation, error response shape |
| P0 | `apps/web/src/actions/sign-patient-contract-action.ts` | 71-100 | Exact hash algorithm to reproduce: `createHash("sha256").update(buffer).digest("hex")` over the raw PDF bytes |
| P0 | `apps/web/app/register-confirmation/page.tsx` | 1-69 | Full file — chrome-less centered public page layout to mirror (logo, heading, icon-in-circle, divider, CTA) |
| P1 | `apps/web/src/components/shared/patient-documents.tsx` | 157-268 | Drag-and-drop handlers + hidden file input pattern (trim to single-file, `accept="application/pdf"`) |
| P1 | `packages/supabase/supabase/migrations/20260706000001_contract_signature.sql` | 1-17 | `contracts` signature columns + unique partial index on `verification_code` |
| P1 | `packages/supabase/supabase/migrations/20260630000002_contracts_enterprise_member_read.sql` | 8-23 | Confirms `contracts` SELECT RLS has no anonymous-access branch — admin client required |
| P2 | `apps/web/src/actions/get-patient-contract-action.ts` | 36-44 | `signedByName` resolution pattern — same join needed here, but via `supabaseAdmin` (no session) |
| P2 | `apps/web/src/lib/verification-url.ts` | 1-3 | Confirms URL shape `/check/{code}` this route must match exactly |
| P2 | `apps/web/app/layout.tsx` | 1-57 | Root layout — confirms a new top-level `app/check/` route gets only fonts + `<Providers>`, no dashboard/auth chrome |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) | `request.formData()` | Confirms no special config needed; standard Web API, `runtime = 'nodejs'` (default) required for `node:crypto` |
| [Next.js serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) | `bodySizeLimit` | Clarifies this setting does NOT apply to Route Handlers — only Server Actions; no Next.js-level cap on this endpoint |

---

## Patterns to Mirror

**ROUTE HANDLER FORMDATA + VALIDATION (mirror structure, trim to single PDF):**
```ts
// SOURCE: apps/web/app/api/patients/[id]/documents/route.ts:73-105
const formData = await request.formData();
const file = formData.get("file") as File | null;

if (!file) {
  return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
}

if (!ALLOWED_TYPES.includes(file.type)) {
  return NextResponse.json({ error: "..." }, { status: 400 });
}

if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json({ error: "..." }, { status: 400 });
}
```

**HASH ALGORITHM (must reproduce exactly, byte-for-byte):**
```ts
// SOURCE: sign-patient-contract-action.ts:79 (post-reorder, Phase 2)
const contentHash = createHash("sha256").update(buffer).digest("hex");
```

**ADMIN CLIENT FOR RLS BYPASS (mirror, no session available here):**
```ts
// SOURCE: sign-patient-contract-action.ts:76-82 (verification_code collision check)
const { data: collision } = await supabaseAdmin
  .from("contracts")
  .select("id")
  .eq("verification_code", candidate)
  .maybeSingle();
```

**SIGNER NAME RESOLUTION (mirror, but via supabaseAdmin instead of supabase — no session):**
```ts
// SOURCE: get-patient-contract-action.ts:36-44
let signedByName: string | null = null;
if (contract?.is_signed && contract.signed_by) {
  const { data: signer } = await supabase
    .from("users")
    .select("name")
    .eq("id", contract.signed_by)
    .maybeSingle();
  signedByName = signer?.name ?? null;
}
```

**PUBLIC PAGE LAYOUT (mirror wrapper, atmospheric background, logo, icon-in-circle, divider, CTA):**
```tsx
// SOURCE: apps/web/app/register-confirmation/page.tsx:7-67
<div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
  {/* Atmospheric background */}
  <div className="pointer-events-none fixed inset-0"> ... </div>
  {/* Logo */}
  <Image src="/logo.png" alt="Ventre — Agenda de Parto" width={180} height={64} priority className="object-contain" />
  <div className="w-full max-w-sm">
    <div className="flex flex-col items-center gap-6 px-8 py-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        {/* icon */}
      </div>
      {/* heading, divider, body, CTA */}
    </div>
  </div>
</div>
```

**DRAG-AND-DROP + HIDDEN INPUT (trim to single PDF, no upload list):**
```tsx
// SOURCE: apps/web/src/components/shared/patient-documents.tsx:157-189, 258-268
const handleDragEnter = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  dragCounter.current++;
  if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setDragging(true);
};
// ...handleDragLeave/handleDragOver/handleDrop mirror the same shape

<input
  ref={fileInputRef}
  type="file"
  className="hidden"
  accept="application/pdf"
  onChange={(e) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
    e.target.value = "";
  }}
/>
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `apps/web/app/api/check/[codigo]/route.ts` | CREATE | `POST` handler: parse formData, validate PDF, hash, admin-lookup by `verification_code`, resolve signer name, compare, return JSON |
| `apps/web/app/check/[codigo]/page.tsx` | CREATE | Public client page: upload UI + fetch to the route handler + success/failure states |

---

## NOT Building (Scope Limits)

- Re-fetching or storing the uploaded verification PDF anywhere — it is hashed in memory and
  discarded; only the computed hash is compared, never persisted.
- Rate limiting / CAPTCHA on the public endpoint — out of scope for this phase; the endpoint is
  read-only (no mutation), low-risk, and rate limiting can be added later at the infra layer if
  abuse is observed.
- Any change to the `contracts`/`patient_documents` RLS policies — the admin client bypass is
  sufficient and matches the existing pattern from Phase 1's collision check.
- `crypto.timingSafeEqual` for the hash comparison — not a secret-comparison scenario (see
  Research Summary in Risks).
- Displaying the contract's clauses/content on the verification page — only signer name +
  date/time + valid/invalid state, to avoid exposing patient contract content publicly.

---

## Step-by-Step Tasks

### Task 1: CREATE `apps/web/app/api/check/[codigo]/route.ts`

- **ACTION**: CREATE `POST` Route Handler
- **IMPLEMENT**:
  ```ts
  import { createHash } from "node:crypto";
  import { createServerSupabaseAdmin } from "@ventre/supabase/server";
  import { NextResponse } from "next/server";

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — signed contract PDFs are small text documents

  export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
    try {
      const { codigo } = await params;
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
      }

      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: "Envie um arquivo PDF" }, { status: 400 });
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Arquivo muito grande. O tamanho máximo é 10MB." }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const computedHash = createHash("sha256").update(buffer).digest("hex");

      const supabaseAdmin = await createServerSupabaseAdmin();
      const { data: contract } = await supabaseAdmin
        .from("contracts")
        .select("is_signed, signed_at, signed_by, content_hash")
        .eq("verification_code", codigo)
        .maybeSingle();

      if (!contract?.is_signed || !contract.content_hash) {
        return NextResponse.json({ valid: false });
      }

      if (computedHash !== contract.content_hash) {
        return NextResponse.json({ valid: false });
      }

      let signedByName: string | null = null;
      if (contract.signed_by) {
        const { data: signer } = await supabaseAdmin
          .from("users")
          .select("name")
          .eq("id", contract.signed_by)
          .maybeSingle();
        signedByName = signer?.name ?? null;
      }

      return NextResponse.json({
        valid: true,
        signedByName,
        signedAt: contract.signed_at,
      });
    } catch {
      return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
  }
  ```
- **MIRROR**: `apps/web/app/api/patients/[id]/documents/route.ts:73-105` (formData/validation shape), `sign-patient-contract-action.ts:79` (hash algorithm), `get-patient-contract-action.ts:36-44` (signer name join, adapted to `supabaseAdmin`)
- **GOTCHA**: This route MUST NOT use `createServerSupabaseClient()` (anon/session-based) for the `contracts` or `users` lookups — RLS has no anonymous-read branch (confirmed in `20260630000002_contracts_enterprise_member_read.sql:8-23`), so an anon-key query returns zero rows even for a valid code. Use `createServerSupabaseAdmin()` for both queries.
- **GOTCHA**: Return `{ valid: false }` (not a 404 or error) for "code not found," "not signed," or "hash mismatch" alike — do not leak *why* verification failed (e.g. don't distinguish "code doesn't exist" from "hash mismatch" in the response), since that could help an attacker probe for valid codes or understand tampering detection.
- **GOTCHA**: Do not set `export const runtime = "edge"` — `node:crypto`'s `createHash` requires the Node.js runtime (the default), unlike Web Crypto's `crypto.subtle`.
- **VALIDATE**: `pnpm check-types`

### Task 2: CREATE `apps/web/app/check/[codigo]/page.tsx`

- **ACTION**: CREATE public client page with upload UI and result states
- **IMPLEMENT**:
  - `"use client"` component, `params: Promise<{ codigo: string }>` unwrapped via `use()` (Next.js 15 pattern) or accept as a client-side prop from a thin server wrapper — mirror how other dynamic-param pages in this app already unwrap `params` in `(dashboard)` routes if a convention exists; otherwise use `React.use(params)`.
  - State machine: `"idle" | "uploading" | "success" | "failure"`.
  - Drag-and-drop + hidden `<input type="file" accept="application/pdf">`, single file only (trim `patient-documents.tsx`'s multi-file handling).
  - On file selected: `POST` a `FormData` with the file to `/api/check/${codigo}`, parse JSON, set state to `"success"` (with `signedByName`/`signedAt`) or `"failure"`.
  - Layout: mirror `register-confirmation/page.tsx`'s full-page centered wrapper (atmospheric background, logo, icon-in-circle, divider, body text). Use `BadgeCheck`/`CheckCircle` (green, `text-emerald-600`/`bg-emerald-500/10`) for success and `XCircle` (red/destructive) for failure, both from `lucide-react` (already a dependency, used elsewhere e.g. `BadgeCheck` in `patient-contract.tsx`).
  - Show the `codigo` param somewhere in the idle/upload state (e.g. "Verificando código: {codigo}") so the user confirms they're checking the right link.
  - Success state text: `Assinado eletronicamente por {signedByName ?? "Profissional"} em {new Date(signedAt).toLocaleString("pt-BR")}` (same formatting convention as `sign-patient-contract-action.ts`/`patient-contract.tsx`).
  - Failure state text: generic, e.g. "Não foi possível confirmar a autenticidade deste documento. Verifique se o arquivo não foi alterado e se o código está correto."
- **MIRROR**: `apps/web/app/register-confirmation/page.tsx:1-69` (full page layout), `apps/web/src/components/shared/patient-documents.tsx:157-189,258-268` (drag/drop + hidden input, trimmed to single file no upload list)
- **GOTCHA**: This page must NOT import anything from `@/hooks/use-auth` or any authenticated-only provider — it renders for anonymous visitors. Confirm no ambient auth guard exists at this route level (none does today — no `middleware.ts` in `apps/web`).
- **GOTCHA**: Client-side `accept="application/pdf"` is a UX hint only, not a security boundary — the real validation happens server-side in Task 1's route handler.
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/app/check/[codigo]/page.tsx apps/web/app/api/check/[codigo]/route.ts`

---

## Testing Strategy

No unit test runner exists in this repo (`apps/web/package.json` scripts limited to `lint`,
`format`, `check`, `check-types`, `build`). Verification is type-checking + manual/browser
validation.

### Edge Cases Checklist

- [ ] Genuine signed PDF (downloaded via "Baixar contrato") uploaded to its own `/check/{codigo}` → success, correct signer name + date/time.
- [ ] Same PDF with a single byte flipped (e.g. open and re-save, or manually corrupt) → failure.
- [ ] Valid PDF uploaded to a `/check/{wrong-codigo}` (mismatched code) → failure.
- [ ] Nonexistent verification code in the URL → failure (not a 404/crash).
- [ ] Non-PDF file uploaded (e.g. `.jpg` renamed to `.pdf` with wrong MIME) → clean 400 error, not a crash.
- [ ] File larger than 10MB → clean 400 error.
- [ ] Unsigned/draft contract's `verification_code` is always `null` (never set pre-signature) — confirm no draft can accidentally be "verified."
- [ ] Page renders correctly with no auth/session present (test in an incognito window or logged-out browser).

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/app/check/[codigo]/page.tsx apps/web/app/api/check/[codigo]/route.ts
```
**EXPECT**: Exit 0, no type errors, no lint warnings.

### Level 2: BUILD

```bash
pnpm --filter web build
```
**EXPECT**: Build succeeds; `/check/[codigo]` and `/api/check/[codigo]` appear in the route output as dynamic (`ƒ`) routes.

### Level 3: BROWSER_VALIDATION

- [ ] Sign a test patient's contract, download the signed PDF, note the verification code (from the stamp or the DB).
- [ ] In a logged-out/incognito window, navigate to `/check/{codigo}`, upload the downloaded PDF → confirm success state with correct name/date.
- [ ] Corrupt the PDF (append a byte, or re-save via a PDF tool) and re-upload → confirm failure state.
- [ ] Navigate to `/check/DOES-NOT-EXIST` and upload any PDF → confirm failure state, no crash.

### Level 4: MANUAL_VALIDATION

- [ ] Confirm the route requires no authentication (test with no cookies/session at all, e.g. `curl` or a fresh incognito window).
- [ ] Confirm the response for "hash mismatch" and "code not found" are indistinguishable (`{ valid: false }` in both cases) — no information leakage.

---

## Acceptance Criteria

- [ ] `/check/[codigo]` renders publicly with no login required and no dashboard/auth chrome.
- [ ] Uploading the genuine signed PDF for a given code returns success with the correct signer name and signed date/time.
- [ ] Uploading a tampered PDF, or a PDF for the wrong code, or a nonexistent code all return the same generic failure state.
- [ ] The link stamped on signed PDFs (`buildVerificationUrl`) now resolves to a working page instead of a 404.
- [ ] `pnpm check-types` and `pnpm --filter web build` pass with no errors.

---

## Completion Checklist

- [ ] Both tasks completed in order
- [ ] Level 1: `pnpm check-types` + biome lint pass
- [ ] Level 2: `pnpm --filter web build` succeeds
- [ ] Level 3: Browser validation performed (genuine PDF, tampered PDF, wrong/missing code)
- [ ] Level 4: No-auth + no-information-leakage checks performed
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| Anonymous endpoint used to probe `contracts` table (enumerate valid codes) | L | M | Uniform `{ valid: false }` response regardless of failure reason (missing code vs hash mismatch); `verification_code` is a 10-char random alphanumeric from a 32-symbol alphabet (~50 bits entropy) — not practically guessable |
| Large/malicious file uploads to a public, unauthenticated endpoint (memory exhaustion) | L | M | `MAX_FILE_SIZE = 10MB` check before buffering; MIME-type check on `file.type` (acceptable as a first-pass filter; not a strict security boundary but reduces accidental abuse) |
| Using `crypto.timingSafeEqual` instead of `===` for hash comparison (over-engineering) | — | — | Explicitly NOT doing this — `content_hash` is a public integrity fingerprint, not a secret; timing attacks are irrelevant here (see web research in plan generation) |
| Route Handler body size capped by deploy platform (e.g. Vercel's 4.5MB Serverless Function limit) | L | L | Signed contract PDFs are small (few hundred KB, text + one small stamp image) — well under any platform's ceiling; `MAX_FILE_SIZE = 10MB` is a safety net, not expected to be hit by genuine files |
| `edge` runtime accidentally selected, breaking `node:crypto` | L | M | Do not add `export const runtime = "edge"` — default `nodejs` runtime is required and is the default, no explicit config needed |

---

## Notes

- This completes all 3 phases of `contract-signature.prd.md`. After this phase, `git mv`/directory
  structure aside, no further contract-signature work is scoped — the PRD's "Success Metrics"
  (consent + hash + immutability + public verification working end-to-end) will be fully met.
- Phase 2 (stamp) already stamps `buildVerificationUrl(verificationCode)` onto both the PDF and
  the on-screen preview — no changes needed there; this phase only makes that URL resolve to a
  real page.
- Deploy target (Vercel vs self-hosted) was not confirmed in the codebase — the 10MB cap chosen
  here is a safety margin regardless of platform, not tuned to a specific known ceiling.
