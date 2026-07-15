# Feature: Selo de Autenticidade Visual no Contrato Assinado (Phase 2)

## Summary

Adicionar um selo visual de autenticidade (`digital-signature-stamp.png` + texto sobreposto:
nome do signatário, data/hora da assinatura, link de verificação) ao PDF final do contrato
assinado, usando `Image`/`Text`/`View` com `position: 'absolute'` do `@react-pdf/renderer`
(já em uso, v4.5.1), e replicar a mesma composição visual via CSS no preview em tela. Isso
exige reordenar `signPatientContractAction` para gerar o `verification_code` **antes** de
renderizar o PDF (hoje é gerado depois), pois o código precisa estar embutido no selo do
documento que será hasheado.

## User Story

Como profissional/secretária que administra contratos,
Eu quero ver e baixar um PDF assinado com selo visual de autenticidade (nome, data/hora,
código de verificação),
Para reforçar a percepção de validade jurídica do documento perante a paciente ou em uma
eventual disputa.

## Problem Statement

Hoje (pós Fase 1) o contrato assinado já tem hash SHA-256, código de verificação e
imutabilidade — mas o PDF armazenado não exibe nenhuma dessas informações visualmente. O
arquivo `digital-signature-stamp.png` foi adicionado em `apps/web/src/assets/` na Fase 1 mas
não é referenciado em nenhum lugar do código.

## Solution Statement

Compor o selo (imagem + texto absolutamente posicionados) dentro de `ContractPdfDocument`,
alimentado por um novo campo opcional `signature` em `ContractPdfData`. Como o selo precisa
mostrar o `verification_code`, a geração desse código em `sign-patient-contract-action.ts`
passa a acontecer **antes** da renderização do PDF (hoje acontece depois, num retry-loop pós
upload). O mesmo timestamp de assinatura é capturado uma única vez e reutilizado tanto no
selo renderizado quanto na coluna `signed_at`, garantindo que o valor hasheado no PDF seja
idêntico ao valor persistido no banco. No preview em tela (`ContractDocument` dentro de
`patient-contract.tsx`), a mesma composição é replicada com `div`s Tailwind
absolutamente posicionados, usando os dados já carregados por `getPatientContractAction`
(que passa a retornar também o nome de quem assinou, via `signed_by`).

## Metadata

| Field            | Value                                                               |
| ---------------- | -------------------------------------------------------------------- |
| Type             | ENHANCEMENT                                                          |
| Complexity       | MEDIUM                                                               |
| Systems Affected | PDF rendering (`@react-pdf/renderer`), server action (`sign-patient-contract-action`), read action (`get-patient-contract-action`), screen preview (`patient-contract.tsx`) |
| Dependencies     | `@react-pdf/renderer@4.5.1` (already installed, no new deps)          |
| Estimated Tasks  | 7                                                                     |

---

## UX Design

### Before State

```
╔══════════════════════════════════════════════════════════════════╗
║                          BEFORE STATE                              ║
╠══════════════════════════════════════════════════════════════════╣
║  patient-contract.tsx (readonly mode)                              ║
║  ┌────────────────────────────────────────────┐                    ║
║  │ ✔ Assinado eletronicamente em 06/07/2026    │  ← plain text      ║
║  │   · Código ABC123XYZ9                       │    banner, OUTSIDE ║
║  └────────────────────────────────────────────┘    the doc preview ║
║  ┌────────────────────────────────────────────┐                    ║
║  │ CONTRATANTE: ...                             │                    ║
║  │ CONTRATADA: ...                              │                    ║
║  │ <clauses html>                               │                    ║
║  │                                               │  ← no stamp here  ║
║  └────────────────────────────────────────────┘                    ║
║                                                                      ║
║  Downloaded PDF (signed_document_id): identical layout, no stamp,   ║
║  no visual indication it was electronically signed.                 ║
╚══════════════════════════════════════════════════════════════════╝
```

### After State

```
╔══════════════════════════════════════════════════════════════════╗
║                           AFTER STATE                               ║
╠══════════════════════════════════════════════════════════════════╣
║  patient-contract.tsx (readonly mode) — banner unchanged, PLUS:    ║
║  ┌────────────────────────────────────────────┐                    ║
║  │ CONTRATANTE: ...                             │                    ║
║  │ CONTRATADA: ...                              │                    ║
║  │ <clauses html>                               │                    ║
║  │                                    ┌────────┐│                    ║
║  │                                    │ [STAMP]││ ← image + text,   ║
║  │                                    │ Assinado│  bottom-right,     ║
║  │                                    │ por X   │  position:absolute ║
║  │                                    │ em DATA │                    ║
║  │                                    │ Código Y││                    ║
║  └────────────────────────────────────┴────────┘                    ║
║                                                                      ║
║  Downloaded PDF (signed_document_id): same stamp baked into the     ║
║  render pass that was hashed — anyone opening the PDF sees the      ║
║  seal, name, date/time and verification code directly on the page.  ║
╚══════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `contract-pdf-document.tsx` | No `Image`, no stamp | Absolutely-positioned `Image` + `Text` overlay when `data.signature` present | Signed PDF visually communicates authenticity |
| `patient-contract.tsx` (`ContractDocument`, readonly) | No stamp in preview | CSS-replicated stamp overlay shown when `signatureInfo` present | On-screen preview matches downloaded PDF |
| `sign-patient-contract-action.ts` | `verification_code` generated after PDF render/upload | Generated (and uniqueness-checked) **before** render, alongside a single captured `signedAt` timestamp | No user-visible change, but stamp/DB data now consistent |
| `get-patient-contract-action.ts` | Returns `signed_by` (uuid only) | Also resolves and returns `signedByName` | Preview stamp can show signer's name |

---

## Mandatory Reading

| Priority | File | Lines | Why Read This |
|----------|------|-------|----------------|
| P0 | `apps/web/src/components/shared/contract-pdf-document.tsx` | 1-87 | Full file — primary edit target, mirror existing `StyleSheet`/`Font.register` conventions |
| P0 | `apps/web/src/actions/sign-patient-contract-action.ts` | 1-141 | Full file — reorder verification-code generation before render |
| P1 | `apps/web/src/lib/contract-pdf.ts` | 1-31 | `renderContractPdfBuffer` signature to extend |
| P1 | `apps/web/src/lib/verification-code.ts` | 1-12 | `generateVerificationCode()` — reused for the pre-render uniqueness check |
| P1 | `apps/web/src/actions/get-patient-contract-action.ts` | 1-140 | Add `signedByName` resolution, mirror existing `Promise.all` query patterns |
| P2 | `apps/web/src/components/shared/patient-contract.tsx` | 27-31, 99-107, 267-289, 457-531 | `SignatureInfo` type, `ContractDocument`, readonly banner — where the CSS stamp overlay is added |
| P2 | `apps/web/src/lib/contract-header-text.ts` | 1-82 | `ContractHeaderBlocks` shape — confirms no structured "signer name" field exists there (must come from `signed_by`/`profile.name`, not header blocks) |

**External Documentation:**
| Source | Section | Why Needed |
|--------|---------|------------|
| [@react-pdf/renderer docs — Image](https://react-pdf.org/components#image) | `Image` component | `src` accepts a filesystem path string (same pattern as `Font.register` in this repo); no new dependency needed |
| [@react-pdf/renderer docs — Position](https://react-pdf.org/styling#position) | `position: 'absolute'` | Confirms absolute children are positioned relative to the nearest ancestor `View`/`Page`, same semantics as CSS |

---

## Patterns to Mirror

**FONT/ASSET LOADING (mirror for the stamp image path):**
```tsx
// SOURCE: contract-pdf-document.tsx:6-12
Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf"), fontWeight: "normal" },
    { src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf"), fontWeight: "bold" },
  ],
});
```
The stamp PNG must be moved from `src/assets/` (not guaranteed to exist in the server output
bundle) to `public/images/`, exactly like the fonts, and loaded the same way:
`path.join(process.cwd(), "public/images/digital-signature-stamp.png")`.

**STYLESHEET PATTERN:**
```tsx
// SOURCE: contract-pdf-document.tsx:20-27
const styles = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 11, paddingTop: 48, ... },
  title: { marginBottom: 16, fontSize: 16 },
  ...
});
```

**DOCUMENT DATA SHAPE (extend, don't replace):**
```tsx
// SOURCE: contract-pdf-document.tsx:51-54
export type ContractPdfData = ContractHeaderBlocks & {
  title: string;
  clausesHtml: string;
};
```

**SIGN ACTION STRUCTURE (reorder within, keep everything else identical):**
```ts
// SOURCE: sign-patient-contract-action.ts:71-126
const buffer = await renderContractPdfBuffer({ headerBlocks: parties_details, title, clausesHtml: sanitizeClausesHtml(clauses_html) });
const contentHash = createHash("sha256").update(buffer).digest("hex");
const h = await headers();
const signedIp = ...;
const signedUserAgent = h.get("user-agent") ?? null;
const { document, storagePath } = await uploadContractPdf({ ... });
let signed = false;
for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !signed; attempt++) {
  const code = generateVerificationCode();
  const { error } = await supabase.from("contracts").update({ is_signed: true, ..., verification_code: code, ... }).eq("id", contractId);
  ...
}
```

**SCREEN PREVIEW STRUCTURE (add relative positioning + overlay):**
```tsx
// SOURCE: patient-contract.tsx:473-483
<div className={cn(!isEditing && "overflow-auto rounded-md bg-muted/30 py-4")}>
  <div className={cn("w-full text-black text-sm", isEditing ? "px-0 py-0" : isPreview ? "mx-auto max-w-[794px] ..." : "mx-auto max-h-[400px] max-w-[794px] ...")}>
```

**ABSOLUTE URL PATTERN (mirror, don't invent a `headers()`-based builder):**
```ts
// SOURCE: apps/web/src/providers/auth-provider.tsx:101
`${process.env.NEXT_PUBLIC_APP_URL}/login?confirmation=success`
```

---

## Files to Change

| File | Action | Justification |
|------|--------|-----------------|
| `apps/web/src/assets/digital-signature-stamp.png` → `apps/web/public/images/digital-signature-stamp.png` | MOVE | Fonts already prove `public/` + `path.join(process.cwd(), ...)` works reliably at server runtime; `src/assets` has no such precedent and risks being excluded from the server bundle |
| `apps/web/src/lib/verification-url.ts` | CREATE | Tiny shared pure function `buildVerificationUrl(code)` — used identically by the server-rendered PDF stamp and the client-rendered screen stamp, must produce byte-identical text in both places |
| `apps/web/src/components/shared/contract-pdf-document.tsx` | UPDATE | Add `Image` import, stamp `StyleSheet` entries, extend `ContractPdfData` with optional `signature`, render the stamp block when present |
| `apps/web/src/lib/contract-pdf.ts` | UPDATE | Thread an optional `signature` param through `renderContractPdfBuffer` into `ContractPdfData` |
| `apps/web/src/actions/sign-patient-contract-action.ts` | UPDATE | Generate + uniqueness-check `verification_code` and capture `signedAt` **before** rendering; pass `signature` data into `renderContractPdfBuffer`; simplify the post-upload update to a single attempt (code already validated) |
| `apps/web/src/actions/get-patient-contract-action.ts` | UPDATE | Resolve `signedByName` from `contract.signed_by` (join on `users`) when `contract.is_signed` |
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | Extend `SignatureInfo` with `signedByName`; add `relative` positioning + CSS stamp overlay inside `ContractDocument`, shown only in readonly mode when signed |

---

## NOT Building (Scope Limits)

- Public verification route `/check/[codigo]` — that is Phase 3, tracked separately in the PRD and can run in parallel in another worktree.
- Any change to `app/api/patients/[id]/contract/pdf/route.ts` — it only renders **unsigned draft** PDFs (signed contracts are served straight from storage), so it never needs `signature` data and stays untouched.
- Any change to the "Assinado eletronicamente" banner text/format in `patient-contract.tsx:271-284` — it already shows date + code; only the in-document stamp is new.
- Any DB schema change — all columns needed (`verification_code`, `signed_at`, `signed_by`, `content_hash`) already exist from Phase 1.

---

## Step-by-Step Tasks

### Task 1: MOVE `apps/web/src/assets/digital-signature-stamp.png` → `apps/web/public/images/digital-signature-stamp.png`

- **ACTION**: `mkdir -p apps/web/public/images && git mv apps/web/src/assets/digital-signature-stamp.png apps/web/public/images/digital-signature-stamp.png`
- **GOTCHA**: Keep the exact filename — no other code references it yet, but keeping it stable avoids confusion with the PRD's naming.
- **VALIDATE**: `ls apps/web/public/images/digital-signature-stamp.png` exists; `git status` shows a rename, not a delete+add of unrelated content.

### Task 2: CREATE `apps/web/src/lib/verification-url.ts`

- **ACTION**: CREATE pure helper, no server-only imports (must be importable from both the server action and the `"use client"` preview component)
- **IMPLEMENT**:
  ```ts
  export function buildVerificationUrl(code: string): string {
    return `${process.env.NEXT_PUBLIC_APP_URL}/check/${code}`;
  }
  ```
- **MIRROR**: `apps/web/src/providers/auth-provider.tsx:101` — same `NEXT_PUBLIC_APP_URL` template pattern
- **GOTCHA**: Do NOT import `next/headers` here — this file must be usable client-side too; `NEXT_PUBLIC_APP_URL` is safe on both sides since it's a public env var.
- **VALIDATE**: `pnpm check-types`

### Task 3: UPDATE `apps/web/src/components/shared/contract-pdf-document.tsx`

- **ACTION**: Extend `ContractPdfData`, add stamp styles, render the stamp conditionally
- **IMPLEMENT**:
  - Add `Image` to the `@react-pdf/renderer` import on line 3.
  - Extend the type:
    ```tsx
    export type ContractPdfData = ContractHeaderBlocks & {
      title: string;
      clausesHtml: string;
      signature?: {
        signedByName: string;
        signedAtLabel: string; // pre-formatted "dd/mm/yyyy HH:MM" — formatting done by caller, keep this component presentation-only
        verificationCode: string;
        verificationUrl: string;
      };
    };
    ```
  - Add to `styles`:
    ```tsx
    stampContainer: {
      position: "absolute",
      bottom: 24,
      right: 60,
      width: 220,
      alignItems: "center",
    },
    stampImage: { width: 220, height: undefined, aspectRatio: 541 / 195 },
    stampText: { fontSize: 7, textAlign: "center", marginTop: 2, lineHeight: 1.3 },
    ```
  - Render as the last child of `<Page>`, sibling to the existing sections (after the clauses `Html` block, `contract-pdf-document.tsx:81-83`):
    ```tsx
    {data.signature && (
      <View style={styles.stampContainer} fixed>
        <Image src={path.join(process.cwd(), "public/images/digital-signature-stamp.png")} style={styles.stampImage} />
        <Text style={styles.stampText}>
          Assinado eletronicamente por {data.signature.signedByName}
        </Text>
        <Text style={styles.stampText}>{data.signature.signedAtLabel}</Text>
        <Text style={styles.stampText}>
          Código de verificação: {data.signature.verificationCode}
        </Text>
        <Text style={styles.stampText}>{data.signature.verificationUrl}</Text>
      </View>
    )}
    ```
- **MIRROR**: `contract-pdf-document.tsx:6-12` (path.join + process.cwd() loading pattern), `:20-27` (StyleSheet.create shape)
- **GOTCHA**: `path.join(process.cwd(), "public/images/...")` only resolves correctly on the server (this file is only ever imported from `contract-pdf.ts`, which already carries the `// Server-only module` guard comment — do not import this component from any `"use client"` file).
- **VALIDATE**: `pnpm check-types`

### Task 4: UPDATE `apps/web/src/lib/contract-pdf.ts`

- **ACTION**: Thread the optional `signature` field through `renderContractPdfBuffer`
- **IMPLEMENT**:
  ```ts
  export async function renderContractPdfBuffer({
    headerBlocks,
    title,
    clausesHtml,
    signature,
  }: {
    headerBlocks: ContractHeaderBlocks;
    title: string;
    clausesHtml: string;
    signature?: ContractPdfData["signature"];
  }): Promise<Buffer> {
    return renderToBuffer(
      React.createElement(ContractPdfDocument, {
        data: { ...headerBlocks, title, clausesHtml, signature },
      }) as React.ReactElement<DocumentProps>,
    );
  }
  ```
  Import `ContractPdfData` as a type alongside the existing `ContractPdfDocument` import (line 1).
- **MIRROR**: `contract-pdf.ts:17-31` (existing structure, minimal diff)
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/actions/sign-patient-contract-action.ts`

- **ACTION**: Reorder so `verification_code` + `signedAt` are determined before rendering, then pass them into the render call; simplify the post-upload update
- **IMPLEMENT**: Replace the block from line 71 (`const buffer = ...`) through line 136 with:
  ```ts
  const signedAt = new Date().toISOString();

  let verificationCode: string | null = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !verificationCode; attempt++) {
    const candidate = generateVerificationCode();
    const { data: collision } = await supabaseAdmin
      .from("contracts")
      .select("id")
      .eq("verification_code", candidate)
      .maybeSingle();
    if (!collision) verificationCode = candidate;
  }
  if (!verificationCode) throw new Error("Erro ao gerar código de verificação. Tente novamente.");

  const buffer = await renderContractPdfBuffer({
    headerBlocks: parties_details,
    title,
    clausesHtml: sanitizeClausesHtml(clauses_html),
    signature: {
      signedByName: profile.name ?? "Profissional",
      signedAtLabel: new Date(signedAt).toLocaleString("pt-BR"),
      verificationCode,
      verificationUrl: buildVerificationUrl(verificationCode),
    },
  });

  // Hash computed once over the stored buffer — never recomputed from a
  // re-render (react-pdf output is not byte-deterministic)
  const contentHash = createHash("sha256").update(buffer).digest("hex");

  const h = await headers();
  const signedIp =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const signedUserAgent = h.get("user-agent") ?? null;

  const { document, storagePath } = await uploadContractPdf({
    supabase,
    supabaseAdmin,
    patientId,
    userId: user.id,
    fileName: buildContractPdfFileName(patient.name),
    buffer,
    isImmutable: true,
  });

  const { error: signError } = await supabase
    .from("contracts")
    .update({
      is_signed: true,
      signed_at: signedAt,
      signed_by: user.id,
      signed_ip: signedIp,
      signed_user_agent: signedUserAgent,
      content_hash: contentHash,
      verification_code: verificationCode,
      signed_document_id: document.id,
    })
    .eq("id", contractId);

  if (signError) {
    // Compensate: the immutable-doc trigger blocks even service_role,
    // so unflag before deleting the orphaned document
    await supabaseAdmin
      .from("patient_documents")
      .update({ is_immutable: false })
      .eq("id", document.id);
    await supabaseAdmin.from("patient_documents").delete().eq("id", document.id);
    await supabaseAdmin.storage.from("patient_documents").remove([storagePath]);
    throw new Error("Erro ao assinar contrato. Tente novamente.");
  }
  ```
  Add import: `import { buildVerificationUrl } from "@/lib/verification-url";`
- **MIRROR**: Keep the exact compensating-delete pattern from the original file (`:116-124`, `:128-135`) — only collapse the two failure branches into one, since the retry loop that used to live after upload no longer exists (uniqueness is now checked before render, so post-upload failure is a single genuine error, not a collision to retry).
- **GOTCHA**: `verification_code` uniqueness check via `.maybeSingle()` on `supabaseAdmin` (not `supabase`) is used deliberately to bypass RLS — any authenticated user must be able to check for collisions across all clinics/contracts, not just their own visible rows, since the column is globally unique (partial unique index from Phase 1).
- **GOTCHA**: `profile.name` is the signer's own name (the authenticated user calling this action), which is exactly `signed_by` — no extra query needed, unlike the read-side action which must resolve a name for a `signed_by` that may not be the current viewer.
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/actions/get-patient-contract-action.ts`

- **ACTION**: Resolve `signedByName` when the contract is signed, for the on-screen stamp preview
- **IMPLEMENT**: After `const contract = contractResult.data ?? null;` (line 33), add:
  ```ts
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
  Add `signedByName` to the returned object (alongside `contract`, `savedParties`, etc. at line 126-139).
- **MIRROR**: Existing `Promise.all`/`maybeSingle()` query style used throughout this file (e.g. `:19-25`, `:37-43`)
- **VALIDATE**: `pnpm check-types`

### Task 7: UPDATE `apps/web/src/components/shared/patient-contract.tsx`

- **ACTION**: Extend `SignatureInfo`, populate it with `signedByName`, and render a CSS stamp overlay inside `ContractDocument` in readonly mode
- **IMPLEMENT**:
  - Extend the type (line 27-31):
    ```tsx
    type SignatureInfo = {
      signedAt: string | null;
      verificationCode: string | null;
      signedDocumentId: string | null;
      signedByName: string | null;
    };
    ```
  - In `fetchContract`'s `onSuccess` (line 99-107), add `signedByName: data.signedByName ?? null` to the object.
  - Pass `signatureInfo` into `ContractDocument` in readonly mode (line 285-289):
    ```tsx
    <ContractDocument
      headerBlocks={savedParties ?? headerBlocks}
      title={title}
      clausesHtml={clausesHtml}
      signatureInfo={signatureInfo}
    />
    ```
  - Extend `ContractDocument`'s props (line 457-469) with `signatureInfo?: SignatureInfo | null`.
  - Add `relative` to the inner card `className` (line 474-483) so the stamp anchors correctly:
    ```tsx
    className={cn(
      "relative w-full text-black text-sm",
      ...
    )}
    ```
  - Render the stamp as the last child inside that card (after the `children ?? <div dangerouslySetInnerHTML .../>` block, i.e. after line 527), only when signed:
    ```tsx
    {signatureInfo?.verificationCode && (
      <div className="absolute right-16 bottom-12 flex w-[180px] flex-col items-center gap-0.5 text-center">
        <img
          src="/images/digital-signature-stamp.png"
          alt="Selo de autenticidade"
          className="w-full"
        />
        <p className="text-[9px] leading-tight">
          Assinado eletronicamente por {signatureInfo.signedByName ?? "Profissional"}
        </p>
        {signatureInfo.signedAt && (
          <p className="text-[9px] leading-tight">
            {new Date(signatureInfo.signedAt).toLocaleString("pt-BR")}
          </p>
        )}
        <p className="text-[9px] leading-tight">
          Código de verificação: {signatureInfo.verificationCode}
        </p>
        <p className="text-[9px] leading-tight">
          {buildVerificationUrl(signatureInfo.verificationCode)}
        </p>
      </div>
    )}
    ```
  - Add import: `import { buildVerificationUrl } from "@/lib/verification-url";`
- **MIRROR**: `patient-contract.tsx:473-483` (existing `cn()` composition style), `:271-284` (existing signed-state conditional rendering pattern)
- **GOTCHA**: This stamp must render ONLY in readonly (signed) mode — do not pass `signatureInfo` into the `editing`-mode or `isPreviewOpen` calls of `ContractDocument` (lines 358, 446-451), since those are always unsigned drafts and `signatureInfo` is `null` at that point anyway (state is cleared/absent until a contract is fetched as signed).
- **VALIDATE**: `pnpm check-types && npx biome lint --write --unsafe apps/web/src/components/shared/patient-contract.tsx`

---

## Testing Strategy

No unit test runner exists in this repo (`apps/web/package.json` scripts are limited to
`lint`, `format`, `check`, `check-types`, `build` — no `test` script). Verification is
type-checking + manual/browser validation.

### Edge Cases Checklist

- [ ] Signing succeeds and the resulting PDF (open the `signed_document_id` download) shows the stamp with correct name/date/code.
- [ ] The on-screen readonly preview shows a stamp visually matching the PDF (same relative position, same text).
- [ ] Draft/unsigned contract preview (editing mode, `isPreviewOpen` modal) shows NO stamp.
- [ ] `profile.name` is `null`/empty for some edge-case account — stamp falls back to `"Profissional"` without crashing.
- [ ] Two contracts signed back-to-back never collide on `verification_code` (uniqueness pre-check via `supabaseAdmin`).
- [ ] `signed_at` value shown in the stamp (inside the hashed PDF) is byte-identical in meaning to the `signed_at` column value — confirm by comparing the DB row after signing to the visible stamp text.

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
npx biome lint --write --unsafe apps/web/src/components/shared/contract-pdf-document.tsx apps/web/src/lib/contract-pdf.ts apps/web/src/actions/sign-patient-contract-action.ts apps/web/src/actions/get-patient-contract-action.ts apps/web/src/components/shared/patient-contract.tsx apps/web/src/lib/verification-url.ts
```
**EXPECT**: Exit 0, no type errors, no lint warnings.

### Level 2: BUILD

```bash
pnpm --filter web build
```
**EXPECT**: Build succeeds — this specifically catches the `path.join(process.cwd(), "public/images/...")` resolution issue if the PNG isn't actually bundled/available at runtime.

### Level 3: BROWSER_VALIDATION

- [ ] Start dev server, open a patient's contract, click "Gerar e assinar", complete the consent flow.
- [ ] Confirm the readonly preview shows the new stamp overlay in the bottom-right of the document card.
- [ ] Click "Baixar contrato" and confirm the downloaded PDF shows the same stamp, correctly positioned, with the real verification code and signer name.
- [ ] Confirm editing/preview-modal (unsigned) flows show no stamp.

### Level 4: MANUAL_VALIDATION

- [ ] Query `contracts` row after signing (via Supabase MCP or SQL) and confirm `signed_at`, `verification_code`, `signed_by` match exactly what's rendered in the stamp.
- [ ] Attempt a direct SQL update of a signed contract's `clauses_html` — confirm the Phase 1 immutability trigger still blocks it (regression check, unrelated to this phase's changes but cheap to verify nothing broke).

---

## Acceptance Criteria

- [ ] Signed PDF (`signed_document_id`) visually displays the stamp image + signer name + date/time + verification code + verification URL text.
- [ ] On-screen readonly preview shows a CSS-replicated stamp with the same information, positioned similarly.
- [ ] `verification_code` is generated and uniqueness-checked before the PDF is rendered, and the same code appears in both the stamp and the `contracts.verification_code` column.
- [ ] `signed_at` captured once and reused identically for both the stamp label and the DB column.
- [ ] Unsigned/draft contract flows (editing, preview modal, draft PDF export route) are visually unchanged — no stamp.
- [ ] `pnpm check-types` and `pnpm --filter web build` pass with no errors.

---

## Completion Checklist

- [ ] All 7 tasks completed in order
- [ ] Level 1: `pnpm check-types` + biome lint pass
- [ ] Level 2: `pnpm --filter web build` succeeds
- [ ] Level 3: Browser validation performed (sign flow, preview, download)
- [ ] Level 4: DB spot-check performed
- [ ] All acceptance criteria met

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-------------|
| PNG under `src/assets` not present in server bundle at runtime | M | H | Moved to `public/images/`, mirroring the already-proven font-loading pattern (Task 1) |
| Reordering `verification_code` generation changes error-handling semantics subtly | L | M | Uniqueness pre-check against `supabaseAdmin` (bypasses RLS, sees all codes globally); genuine DB-level unique index from Phase 1 remains the final safety net |
| Stamp text overlaps clause content on a long contract (last page) | M | L | `position: 'absolute'` + `fixed` prop keeps the stamp pinned to the page corner regardless of content flow, consistent with react-pdf's documented behavior for `fixed` elements |
| On-screen CSS stamp drifts out of sync with PDF stamp over time (duplicated markup) | M | L | `buildVerificationUrl` is the one piece of logic shared between both renderers; the rest is intentionally duplicated per this codebase's existing PDF-vs-screen pattern (documented in Phase 2 exploration, not introduced by this plan) |

---

## Notes

- Phase 3 (`/check/[codigo]` public verification route) depends only on Phase 1 (already complete) and does not touch any file this plan modifies — it can be implemented concurrently in a separate worktree per the PRD's parallelism notes.
- `profile.name` availability: confirmed already used as the CONTRATADA display name in the "autonomous" branch of `buildPatientContractParties` (`apps/web/src/lib/contract-parties.ts:75-81`), so it is a safe, already-relied-upon field for the signer's name.
