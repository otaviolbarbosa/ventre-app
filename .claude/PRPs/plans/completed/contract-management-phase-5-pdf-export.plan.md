# Feature: Contract Management — Phase 5: PDF Export

## Summary

Install `@react-pdf/renderer` + `react-pdf-html` in `apps/web`, create a server-side React PDF template that renders the contract header (CONTRATANTE/CONTRATADA/EQUIPE CONTRATADA) plus TipTap-generated HTML clauses, expose a Route Handler `POST /api/patients/[id]/contract/pdf` that generates the buffer, uploads to the `patient_documents` Supabase Storage bucket, inserts a `patient_documents` record, and returns a signed download URL. Add an "Exportar PDF" button to the existing `PatientContract` client component.

## User Story

As a profissional/gestora  
I want to export the patient's contract as a PDF with one click  
So that I can print or share a legally-formatted document without leaving the system

## Problem Statement

The `PatientContract` component (Phase 4) allows saving contract HTML but has no export mechanism. The PDF with the auto-generated header (CONTRATANTE/CONTRATADA) must be generated server-side, uploaded to Supabase Storage, and made available in the patient's Documentos section — all in a single click.

## Solution Statement

A new Route Handler `POST /api/patients/[id]/contract/pdf` orchestrates the end-to-end flow: fetches the saved contract, builds header text blocks, renders a `@react-pdf/renderer` document (with `react-pdf-html` for clause HTML), uploads the resulting Buffer to the `patient_documents` bucket, inserts a `patient_documents` row, and returns a signed URL. The `PatientContract` component calls this endpoint via `fetch` and opens the PDF on success.

## Metadata

| Field            | Value                                                     |
| ---------------- | --------------------------------------------------------- |
| Type             | NEW_CAPABILITY                                            |
| Complexity       | HIGH                                                      |
| Systems Affected | Route Handlers, Storage, patient_documents, PatientContract UI |
| Dependencies     | @react-pdf/renderer@4.5.1, react-pdf-html, Inter TTF fonts |
| Estimated Tasks  | 6                                                         |

---

## UX Design

### Before State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────────────┐      ┌──────────────────┐      ┌────────────────┐  ║
║   │  Patient Profile    │ ───► │ PatientContract  │ ───► │  Salvar HTML   │  ║
║   │  /patients/[id]/    │      │   Component      │      │  (DB only)     │  ║
║   │  profile (accordion)│      │                  │      └────────────────┘  ║
║   └─────────────────────┘      └──────────────────┘                          ║
║                                                                               ║
║   USER_FLOW: Profissional edita cláusulas → clica "Salvar contrato"          ║
║   PAIN_POINT: Não há como exportar PDF — tem de copiar para Word externo     ║
║   DATA_FLOW: clausesHtml → savePatientContractAction → contracts table       ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### After State

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║   ┌─────────────────────┐      ┌──────────────────┐      ┌────────────────┐  ║
║   │  Patient Profile    │ ───► │ PatientContract  │ ───► │  Salvar HTML   │  ║
║   │  /patients/[id]/    │      │   Component      │      │  (DB only)     │  ║
║   │  profile (accordion)│      │                  │      └────────────────┘  ║
║   └─────────────────────┘      │  [Exportar PDF]  │                          ║
║                                └────────┬─────────┘                          ║
║                                         │ POST /api/patients/[id]/contract/pdf║
║                                         ▼                                     ║
║                          ┌──────────────────────────┐                        ║
║                          │  Route Handler           │                        ║
║                          │  1. Fetch contract HTML  │                        ║
║                          │  2. Build header blocks  │                        ║
║                          │  3. renderToBuffer(PDF)  │                        ║
║                          │  4. Upload to Storage    │                        ║
║                          │  5. Insert patient_doc   │                        ║
║                          │  6. Return signedUrl     │                        ║
║                          └──────────────┬───────────┘                        ║
║                                         │                                     ║
║                                         ▼                                     ║
║                          ┌──────────────────────────┐                        ║
║                          │  patient_documents       │                        ║
║                          │  bucket: patient_docs    │                        ║
║                          │  path: contracts/${id}/  │                        ║
║                          │  CONTRATO_Nome_Date.pdf  │                        ║
║                          └──────────────────────────┘                        ║
║                                                                               ║
║   USER_FLOW: Salva → clica "Exportar PDF" → PDF abre numa aba nova           ║
║   VALUE_ADD: PDF formatado com cabeçalho legal disponível em Documentos      ║
║   DATA_FLOW: contractId → PDF buffer → Storage upload → patient_documents    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|-------------|
| `patient-contract.tsx` (editing mode) | Apenas botão "Salvar contrato" | Botões "Salvar contrato" + "Exportar PDF" | Pode gerar PDF sem sair do sistema |
| `/patients/[id]/profile` → Documentos | PDFs de contrato ausentes | PDF `CONTRATO_Nome_YYYY-MM-DD.pdf` aparece na lista | Rastreabilidade histórica do contrato |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|---------------|
| P0 | `apps/web/app/api/patients/[id]/documents/route.ts` | 73-156 | POST handler pattern to MIRROR: auth check → Storage upload (admin) → DB insert (anon) → rollback on error |
| P0 | `apps/web/app/api/patients/[id]/documents/[documentId]/route.ts` | 1-44 | Signed URL generation pattern via supabaseAdmin |
| P0 | `apps/web/src/components/shared/patient-contract.tsx` | 1-114 | Component to UPDATE — understand all state, modes, and action hooks |
| P1 | `apps/web/src/services/base-contract.ts` | 62-106 | `getContractHeaderData()` — call this from Route Handler to get CONTRATADA/EQUIPE data |
| P1 | `apps/web/src/screens/contract-settings-screen.tsx` | 75-129 | `ContractPreview` function — MIRROR its text block construction for PDF header |
| P1 | `apps/web/src/lib/safe-action.ts` | 1-37 | Context shape `{ supabase, supabaseAdmin, user, profile }` — not used in Route Handler but good reference |
| P2 | `packages/supabase/src/types/database.types.ts` | 317-381 | `contracts` table Row type — columns available |
| P2 | `packages/supabase/src/types/database.types.ts` | 824-871 | `patient_documents` Insert type — exact fields required |
| P2 | `packages/supabase/src/types/database.types.ts` | 1018-1038 | `patients` Row type — available patient fields |
| P2 | `packages/supabase/src/types/database.types.ts` | 1180-1202 | `pregnancies` Row type — `due_date` field |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|------------|
| [react-pdf.org/node](https://react-pdf.org/node) | renderToBuffer API | Async function that returns `Promise<Buffer>` — pass Buffer directly to Supabase Storage upload |
| [react-pdf.org/fonts](https://react-pdf.org/fonts) | Font registration | MUST register TTF font with pt-BR characters before rendering; default fonts omit ã, ç, é |
| [react-pdf-html GitHub](https://github.com/danomatic/react-pdf-html) | `<Html>` component | Maps HTML string (TipTap output) to react-pdf primitives |
| [Next.js serverExternalPackages](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages) | Config reference | @react-pdf/renderer is auto-listed; no manual config needed in Next.js 15 |

---

## Patterns to Mirror

**ROUTE_HANDLER_AUTH_PATTERN:**
```typescript
// SOURCE: apps/web/app/api/patients/[id]/documents/route.ts:21-29
// COPY THIS PATTERN exactly for the new Route Handler:
const supabase = await createServerSupabaseClient();
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
}
```

**STORAGE_UPLOAD_PATTERN:**
```typescript
// SOURCE: apps/web/app/api/patients/[id]/documents/route.ts:107-121
// COPY THIS PATTERN — admin bypasses Storage RLS, regular client for DB:
const timestamp = Date.now();
const storagePath = `contracts/${patientId}/${timestamp}_${fileName}`;

const supabaseAdmin = await createServerSupabaseAdmin();
const { error: uploadError } = await supabaseAdmin.storage
  .from("patient_documents")
  .upload(storagePath, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });

if (uploadError) {
  return NextResponse.json({ error: uploadError.message }, { status: 500 });
}
```

**DB_INSERT_WITH_ROLLBACK_PATTERN:**
```typescript
// SOURCE: apps/web/app/api/patients/[id]/documents/route.ts:123-141
// COPY THIS PATTERN — insert via anon client (RLS), rollback Storage on error:
const { data: document, error: insertError } = await supabase
  .from("patient_documents")
  .insert({
    patient_id: patientId,
    uploaded_by: user.id,
    file_name: fileName,
    file_type: "application/pdf",
    file_size: buffer.byteLength,
    storage_path: storagePath,
  })
  .select("*")
  .single();

if (insertError) {
  // Rollback: delete uploaded file
  await supabaseAdmin.storage.from("patient_documents").remove([storagePath]);
  return NextResponse.json({ error: insertError.message }, { status: 500 });
}
```

**SIGNED_URL_PATTERN:**
```typescript
// SOURCE: apps/web/app/api/patients/[id]/documents/[documentId]/route.ts:31-38
// COPY THIS PATTERN — admin generates signed URL (private bucket):
const { data: signedUrl, error: signError } = await supabaseAdmin.storage
  .from("patient_documents")
  .createSignedUrl(storagePath, 300);

if (signError || !signedUrl) {
  return NextResponse.json({ error: "Erro ao gerar URL de download" }, { status: 500 });
}
return NextResponse.json({ document, signedUrl: signedUrl.signedUrl });
```

**HEADER_TEXT_CONSTRUCTION:**
```typescript
// SOURCE: apps/web/src/screens/contract-settings-screen.tsx:76-95
// MIRROR this logic in buildContractHeaderBlocks():
const na = "[não informado]";
const contratadaBlock =
  headerData.type === "enterprise" && headerData.enterprise
    ? [
        `${headerData.enterprise.legal_name ?? headerData.enterprise.name ?? na}, pessoa jurídica de direito privado,`,
        `inscrita no CNPJ sob nº ${headerData.enterprise.cnpj ?? na},`,
        `com sede à ${[...].filter(Boolean).join(", ") || na},`,
        "doravante denominada simplesmente EQUIPE CONTRATADA.",
      ].join(" ")
    : `${headerData.user.name ?? na}, ${headerData.user.professional_type ?? na}, ...`
```

**ROUTE_HANDLER_ERROR_PATTERN:**
```typescript
// SOURCE: apps/web/app/api/patients/[id]/documents/route.ts:153-155
// ALL Route Handlers end with this catch:
} catch {
  return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
}
```

**CLIENT_FETCH_PATTERN (for PatientContract component):**
```typescript
// Follow the same pattern used in existing document components that call API routes
// Use native fetch — no library needed; cookies sent automatically (same-origin)
const [isExporting, setIsExporting] = useState(false);

async function handleExportPdf() {
  setIsExporting(true);
  try {
    const res = await fetch(`/api/patients/${patientId}/contract/pdf`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao exportar PDF");
    } else {
      toast.success("PDF gerado com sucesso! Disponível em Documentos.");
      window.open(data.signedUrl, "_blank");
    }
  } finally {
    setIsExporting(false);
  }
}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `apps/web/package.json` | UPDATE | Add `@react-pdf/renderer` and `react-pdf-html` to dependencies |
| `apps/web/public/fonts/Inter-Regular.ttf` | CREATE | Required for pt-BR character support; @react-pdf/renderer default fonts omit ã, ç, é |
| `apps/web/public/fonts/Inter-Bold.ttf` | CREATE | Required for `fontWeight: bold` in PDF (from TipTap `<strong>` via react-pdf-html) |
| `apps/web/src/lib/contract-header-text.ts` | CREATE | Pure utility — builds CONTRATANTE/CONTRATADA/EQUIPE text blocks; extracted from ContractPreview logic |
| `apps/web/src/components/shared/contract-pdf-document.tsx` | CREATE | React PDF document — NO `"use client"`, font registration at module level, uses `react-pdf-html` for clauses |
| `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | CREATE | POST Route Handler — orchestrates fetch→generate→upload→insert→signedUrl |
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | Add `isExporting` state + `handleExportPdf` + "Exportar PDF" button in editing mode |

---

## NOT Building (Scope Limits)

- **No download button on GET**: Export always generates a new PDF from current saved contract — no listing or re-download of old PDFs from this endpoint
- **No streaming response**: Return signed URL; the client opens the signed URL in new tab (no streaming PDF bytes to browser)
- **No email delivery**: PDF is uploaded to Storage and linked in Documentos — no email send
- **No versioning**: Re-exporting overwrites by creating a new `patient_documents` record (multiple PDFs may accumulate in Documentos — this is acceptable and matches `upsert: false` pattern)
- **No font customization**: Inter font only; no font selection UI
- **No watermark or signature block**: Out of scope v1

---

## Step-by-Step Tasks

Execute in strict order. Each task is independently verifiable.

### Task 1: Install dependencies in apps/web

- **ACTION**: ADD `@react-pdf/renderer` and `react-pdf-html` to `apps/web/package.json`
- **COMMAND**: `cd apps/web && pnpm add @react-pdf/renderer@4.5.1 react-pdf-html`
- **GOTCHA**: MUST install in `apps/web` directly — installing in a shared `packages/*` package causes a runtime crash (`TypeError: Cannot read properties of undefined (reading 'S')`) in Turborepo due to multiple React reconciler instances (GitHub issue #3285)
- **GOTCHA**: `@react-pdf/renderer` v4.5.1 is the minimum for React 19 support; earlier v4.x versions had breaking issues
- **GOTCHA**: `@react-pdf/renderer` is already on Next.js 15's automatic `serverExternalPackages` list — no `next.config.js` changes needed
- **VALIDATE**: `grep -A2 '"@react-pdf/renderer"' apps/web/package.json` — must show version `^4.5.1`

### Task 2: Download Inter TTF fonts to public/fonts/

- **ACTION**: CREATE `apps/web/public/fonts/` directory and download Inter-Regular.ttf and Inter-Bold.ttf
- **IMPLEMENT**: Download from Google Fonts (Inter v4) as TTF format. WOFF2 is NOT supported by @react-pdf/renderer.
  ```bash
  mkdir -p apps/web/public/fonts
  # Download Inter Regular TTF
  curl -L "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bslnt%2Cwght%5D.ttf" -o apps/web/public/fonts/Inter-Variable.ttf
  ```
  Or download static Inter-Regular.ttf and Inter-Bold.ttf from https://fonts.google.com/specimen/Inter (click Download family → extract static/*.ttf files)
- **ALTERNATIVE**: The variable font file works if react-pdf can read it; if not, download the static files from the inter npm package:
  ```bash
  cd apps/web && node -e "
  const fs = require('fs');
  const src = require.resolve('inter-font/Inter-Regular.ttf');
  fs.copyFileSync(src, 'public/fonts/Inter-Regular.ttf');
  "
  ```
- **GOTCHA**: TTF is the only supported format. WOFF, WOFF2, OTF, variable fonts are NOT supported. Use static TTF files.
- **VALIDATE**: `ls apps/web/public/fonts/` — must show `Inter-Regular.ttf` and `Inter-Bold.ttf` (each ~300-600KB)

### Task 3: CREATE `apps/web/src/lib/contract-header-text.ts`

- **ACTION**: CREATE pure utility functions to build contract header text blocks
- **MIRROR**: `apps/web/src/screens/contract-settings-screen.tsx:75-129` — `ContractPreview` function's text construction logic
- **IMPLEMENT**:

```typescript
// apps/web/src/lib/contract-header-text.ts
import type { ContractHeaderData } from "@/services/base-contract"
import type { Tables } from "@ventre/supabase/types"

const na = "[não informado]"

type PatientRow = Pick<Tables<"patients">, "name" | "email" | "phone" | "date_of_birth">
type PregnancyRow = Pick<Tables<"pregnancies">, "due_date"> | null

export type ContractHeaderBlocks = {
  contratanteBlock: string
  contratadaBlock: string
  teamMembersBlock: string | null
}

export function buildContractHeaderBlocks(
  patient: PatientRow,
  pregnancy: PregnancyRow,
  headerData: ContractHeaderData,
): ContractHeaderBlocks {
  const dueDateFormatted = pregnancy?.due_date
    ? new Date(pregnancy.due_date).toLocaleDateString("pt-BR")
    : na

  const contratanteBlock = [
    `${patient.name ?? na},`,
    `CPF: ${na}, RG: ${na},`,
    `${na},`,  // endereço
    `${patient.email ?? na}, telefone: ${patient.phone ?? na}`,
    `e data provável de parto: ${dueDateFormatted},`,
    "doravante denominada simplesmente GESTANTE.",
  ].join(" ")

  const contratadaBlock =
    headerData.type === "enterprise" && headerData.enterprise
      ? [
          `${headerData.enterprise.legal_name ?? headerData.enterprise.name ?? na}, pessoa jurídica de direito privado,`,
          `inscrita no CNPJ sob nº ${headerData.enterprise.cnpj ?? na},`,
          `com sede à ${[
            headerData.enterprise.street,
            headerData.enterprise.number,
            headerData.enterprise.neighborhood,
            headerData.enterprise.city,
            headerData.enterprise.state,
          ]
            .filter(Boolean)
            .join(", ") || na},`,
          "doravante denominada simplesmente EQUIPE CONTRATADA.",
        ].join(" ")
      : headerData.type === "autonomous"
        ? `${headerData.user.name ?? na}, ${headerData.user.professional_type ?? na}, ${headerData.user.email ?? na}, telefone: ${headerData.user.phone ?? na}, doravante denominada simplesmente EQUIPE CONTRATADA.`
        : na

  const teamMembersBlock =
    headerData.type === "enterprise" && headerData.teamMembers.length > 0
      ? headerData.teamMembers
          .map(
            (m) =>
              `${m.name ?? na}, ${m.professional_type ?? na}, ${m.email ?? na}, ${m.phone ?? na}`,
          )
          .join("\n")
      : null

  return { contratanteBlock, contratadaBlock, teamMembersBlock }
}
```

- **GOTCHA**: `patients` table does NOT have cpf, rg, nationality, civil_status, profession, or address fields — render as `[não informado]` per PRD risk mitigation
- **VALIDATE**: `pnpm check-types` — no TypeScript errors

### Task 4: CREATE `apps/web/src/components/shared/contract-pdf-document.tsx`

- **ACTION**: CREATE React PDF document component
- **IMPLEMENT**: No `"use client"` directive — this runs server-side only. Font registration at module level (outside component). Uses `react-pdf-html` `<Html>` to render TipTap HTML.

```typescript
// apps/web/src/components/shared/contract-pdf-document.tsx
// NO "use client" directive — server-only

import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import Html from "react-pdf-html"
import path from "path"
import type { ContractHeaderBlocks } from "@/lib/contract-header-text"

// Register fonts at module level — required before any renderToBuffer call
Font.register({
  family: "Inter",
  fonts: [
    {
      src: path.join(process.cwd(), "public/fonts/Inter-Regular.ttf"),
      fontWeight: "normal",
    },
    {
      src: path.join(process.cwd(), "public/fonts/Inter-Bold.ttf"),
      fontWeight: "bold",
    },
  ],
})

const styles = StyleSheet.create({
  page: {
    fontFamily: "Inter",
    fontSize: 11,
    paddingTop: 48,
    paddingBottom: 48,
    paddingLeft: 60,
    paddingRight: 60,
    lineHeight: 1.5,
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  divider: {
    borderBottom: "1 solid #e5e7eb",
    paddingBottom: 12,
    marginBottom: 12,
  },
  bodyText: {
    lineHeight: 1.6,
  },
})

export type ContractPdfData = ContractHeaderBlocks & {
  clausesHtml: string
}

export function ContractPdfDocument({ data }: { data: ContractPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.section, styles.divider]}>
          <Text style={styles.label}>CONTRATANTE:</Text>
          <Text style={styles.bodyText}>{data.contratanteBlock}</Text>
        </View>

        <View style={[styles.section, styles.divider]}>
          <Text style={styles.label}>CONTRATADA:</Text>
          <Text style={styles.bodyText}>{data.contratadaBlock}</Text>
        </View>

        {data.teamMembersBlock && (
          <View style={[styles.section, styles.divider]}>
            <Text style={styles.label}>EQUIPE CONTRATADA:</Text>
            <Text style={styles.bodyText}>{data.teamMembersBlock}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Html style={{ fontSize: 11, fontFamily: "Inter" }}>
            {data.clausesHtml || "<p></p>"}
          </Html>
        </View>
      </Page>
    </Document>
  )
}
```

- **GOTCHA**: `Font.register` must be at module level, NOT inside the component or the Route Handler — it must run once on module import
- **GOTCHA**: `react-pdf-html` passes HTML to its `<Html>` component as children, not a prop. Syntax: `<Html>{htmlString}</Html>`
- **GOTCHA**: If `react-pdf-html` v2.x is incompatible with `@react-pdf/renderer` v4.x at runtime, fallback plan: strip HTML tags with a simple regex and render plain text in a `<Text>` — acceptable for v1
- **VALIDATE**: `pnpm check-types` — no TypeScript errors (imports from `@react-pdf/renderer` and `react-pdf-html` must resolve)

### Task 5: CREATE `apps/web/app/api/patients/[id]/contract/pdf/route.ts`

- **ACTION**: CREATE POST Route Handler for PDF generation + Storage upload + patient_documents insert
- **MIRROR**: `apps/web/app/api/patients/[id]/documents/route.ts:73-156` — exact same auth/upload/insert/rollback pattern
- **IMPLEMENT**:

```typescript
// apps/web/app/api/patients/[id]/contract/pdf/route.ts
import { NextResponse } from "next/server"
import { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { ContractPdfDocument } from "@/components/shared/contract-pdf-document"
import { buildContractHeaderBlocks } from "@/lib/contract-header-text"
import { getContractHeaderData } from "@/services/base-contract"
import React from "react"

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    const { id: patientId } = await params
    const supabase = await createServerSupabaseClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    // Fetch the saved patient contract (is_base_contract = false)
    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("*")
      .eq("patient_id", patientId)
      .eq("is_base_contract", false)
      .maybeSingle()

    if (contractError) {
      return NextResponse.json({ error: contractError.message }, { status: 500 })
    }
    if (!contract) {
      return NextResponse.json({ error: "Contrato não encontrado para esta paciente" }, { status: 404 })
    }

    // Fetch patient data
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("id, name, email, phone, date_of_birth")
      .eq("id", patientId)
      .single()

    if (patientError || !patient) {
      return NextResponse.json({ error: "Paciente não encontrada" }, { status: 404 })
    }

    // Fetch pregnancy data if available
    let pregnancy: { due_date: string } | null = null
    if (contract.pregnancy_id) {
      const { data: preg } = await supabase
        .from("pregnancies")
        .select("due_date")
        .eq("id", contract.pregnancy_id)
        .maybeSingle()
      pregnancy = preg ?? null
    }

    // Fetch header data (CONTRATADA/EQUIPE) — uses cookies internally, works in Route Handler
    const headerData = await getContractHeaderData()

    // Build header text blocks
    const headerBlocks = buildContractHeaderBlocks(patient, pregnancy, headerData)

    // Generate PDF buffer
    const buffer = await renderToBuffer(
      React.createElement(ContractPdfDocument, {
        data: { ...headerBlocks, clausesHtml: contract.clauses_html },
      }),
    )

    // Build filename: CONTRATO_NomeSemAcentos_YYYY-MM-DD.pdf
    const sanitizedName = patient.name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toUpperCase()
    const dateStr = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const fileName = `CONTRATO_${sanitizedName}_${dateStr}.pdf`
    const timestamp = Date.now()
    const storagePath = `contracts/${patientId}/${timestamp}_${fileName}`

    // Upload to Storage via admin (bypasses Storage RLS)
    const supabaseAdmin = await createServerSupabaseAdmin()
    const { error: uploadError } = await supabaseAdmin.storage
      .from("patient_documents")
      .upload(storagePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    // Insert patient_documents record via anon client (RLS enforced)
    const { data: document, error: insertError } = await supabase
      .from("patient_documents")
      .insert({
        patient_id: patientId,
        uploaded_by: user.id,
        file_name: fileName,
        file_type: "application/pdf",
        file_size: buffer.byteLength,
        storage_path: storagePath,
      })
      .select("*")
      .single()

    if (insertError) {
      // Rollback: remove uploaded file
      await supabaseAdmin.storage.from("patient_documents").remove([storagePath])
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Generate signed URL (300 seconds — long enough to open in new tab)
    const { data: signedUrl, error: signError } = await supabaseAdmin.storage
      .from("patient_documents")
      .createSignedUrl(storagePath, 300)

    if (signError || !signedUrl) {
      return NextResponse.json({ error: "Erro ao gerar URL de download" }, { status: 500 })
    }

    return NextResponse.json({ document, signedUrl: signedUrl.signedUrl }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
```

- **GOTCHA**: `renderToBuffer` requires JSX — use `React.createElement(ContractPdfDocument, ...)` OR ensure the file is treated as TSX by the bundler. If using JSX syntax directly, name the file `.tsx` and import React.
- **GOTCHA**: `getContractHeaderData()` calls `getServerAuth()` internally which creates its own Supabase client with `createServerSupabaseClient()`. This works in a Route Handler because `next/headers` cookies are available. This is an additional DB query but acceptable.
- **GOTCHA**: `buffer.byteLength` gives the PDF size in bytes for the `file_size` column
- **GOTCHA**: `patient_documents` bucket has 50MB limit. A contract PDF will be <1MB; no size validation needed.
- **NAMING**: Route Handler file MUST be named `route.ts` (not `route.tsx`), but `React.createElement` call avoids needing JSX transforms. If JSX is needed, rename to `.tsx`.
- **VALIDATE**: `pnpm check-types` — no TypeScript errors

### Task 6: UPDATE `apps/web/src/components/shared/patient-contract.tsx`

- **ACTION**: ADD "Exportar PDF" button with loading state in `editing` mode
- **MIRROR**: Existing button patterns in the same file and sibling components
- **IMPORTS TO ADD**: `Download` from `"lucide-react"` (check it's available: `grep "Download" apps/web/src/components/shared/ -r`)
- **IMPLEMENT**: Modify the `editing` mode return block (lines 89-113) to add:
  1. `const [isExporting, setIsExporting] = useState(false);` alongside existing state declarations
  2. `handleExportPdf` async function using `fetch`
  3. "Exportar PDF" button with `Download` icon alongside "Salvar contrato" button

Full modified `editing` return block:
```tsx
const [isExporting, setIsExporting] = useState(false);

async function handleExportPdf() {
  setIsExporting(true);
  try {
    const res = await fetch(`/api/patients/${patientId}/contract/pdf`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Erro ao exportar PDF");
    } else {
      toast.success("PDF gerado com sucesso! Disponível em Documentos.");
      window.open(data.signedUrl, "_blank");
    }
  } finally {
    setIsExporting(false);
  }
}

// In the return JSX (editing mode), modify the button row at line 97:
<div className="flex justify-end gap-2">
  <Button
    variant="outline"
    disabled={isExporting || isSaving}
    onClick={handleExportPdf}
  >
    <Download className="mr-2 size-4" />
    {isExporting ? "Gerando PDF..." : "Exportar PDF"}
  </Button>
  <Button
    className="gradient-primary"
    disabled={isSaving || isExporting}
    onClick={() =>
      saveContract({
        patientId,
        pregnancyId: pregnancyId ?? null,
        clauses_html: clausesHtml,
      })
    }
  >
    {isSaving ? "Salvando..." : "Salvar contrato"}
  </Button>
</div>
```

- **GOTCHA**: `window.open` with `"_blank"` opens PDF in new tab. Signed URL expires in 300s — user has 5 minutes to open it. This is the same pattern as the existing document download flow.
- **GOTCHA**: `Download` icon import — `import { Download, FileText } from "lucide-react"` (add `Download` to existing import)
- **VALIDATE**: `pnpm check-types` — no TypeScript errors

---

## Testing Strategy

### Unit Tests to Write

No automated test files are expected for this phase (no existing test files found in the codebase to mirror). Manual validation is the acceptance standard.

### Edge Cases Checklist

- [ ] Patient with no pregnancy linked (contract.pregnancy_id is null) → due date shows `[não informado]`
- [ ] Autonomous professional (no enterprise) → CONTRATADA shows user data, no EQUIPE CONTRATADA section
- [ ] Enterprise professional → CONTRATADA shows company data + EQUIPE CONTRATADA section
- [ ] Patient has no email or phone (nullable) → shows `[não informado]`
- [ ] TipTap clauses_html is empty string → PDF renders with empty clause section (no crash)
- [ ] Patient name has accents (João, Conceição) → sanitized to `JOAO_CONCEICAO` in filename
- [ ] User clicks "Exportar PDF" before saving → 404 returned (no contract saved), error toast shown
- [ ] Storage upload fails → 500 returned, no patient_documents record created
- [ ] DB insert fails after Storage upload → rollback removes the uploaded file

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, no TypeScript errors across all packages

### Level 2: UNIT_TESTS

No automated tests in this codebase. Skip to Level 5.

### Level 3: BUILD

```bash
cd apps/web && pnpm build
```

**EXPECT**: Build succeeds. Watch for `@react-pdf/renderer` bundling warnings — they should be absent because Next.js 15 auto-marks it as a server external.

### Level 4: DATABASE_VALIDATION

Use Supabase MCP to verify (no schema changes in Phase 5 — table already exists from Phase 1):

```sql
-- Verify patient_documents accepts the new storagePath prefix
SELECT id, file_name, file_type, storage_path 
FROM patient_documents 
WHERE storage_path LIKE 'contracts/%'
ORDER BY created_at DESC LIMIT 5;
```

- [ ] Records appear with `storage_path` like `contracts/{patientId}/{timestamp}_CONTRATO_*.pdf`
- [ ] `file_type` = `application/pdf`

### Level 5: BROWSER_VALIDATION

Use Browser MCP / manual testing:

1. Navigate to a patient profile that has a saved contract (Phase 4 complete)
2. Open the "Contrato" accordion
3. Verify the "Exportar PDF" button is visible alongside "Salvar contrato"
4. Click "Exportar PDF"
5. Verify loading state: button shows "Gerando PDF..."
6. Verify success toast: "PDF gerado com sucesso! Disponível em Documentos."
7. Verify new tab opens with the PDF (signed URL)
8. Navigate to the patient's Documentos section
9. Verify `CONTRATO_NOME_YYYY-MM-DD.pdf` appears in the document list

### Level 6: MANUAL_VALIDATION

```
1. PDF content check:
   - Section "CONTRATANTE:" present with patient name, email, phone, due date
   - Fields without data show "[não informado]"
   - Section "CONTRATADA:" present with correct enterprise or user data
   - If enterprise: "EQUIPE CONTRATADA:" section shows team members
   - TipTap clause HTML rendered (paragraphs, bold, lists)
   - Portuguese accented characters visible (ã, ç, é, ó) — not garbled

2. File check:
   - Filename matches CONTRATO_NOME_YYYY-MM-DD.pdf pattern
   - File appears in patient's Documentos accordion
   - File is downloadable from Documentos view

3. Error check:
   - Navigate to a patient WITHOUT a saved contract
   - Click "Exportar PDF" — verify error toast appears (not a crash)
```

---

## Acceptance Criteria

- [ ] "Exportar PDF" button visible in PatientContract component when contract exists (editing mode)
- [ ] Clicking "Exportar PDF" shows loading state and generates a PDF
- [ ] PDF opens in a new browser tab with formatted contract (header + clauses)
- [ ] PDF is available in the patient's Documentos section with correct filename
- [ ] Portuguese characters (ã, ç, é) render correctly in the PDF
- [ ] `pnpm check-types` exits 0
- [ ] `pnpm build` succeeds
- [ ] Error cases show user-friendly toast messages in Portuguese

---

## Completion Checklist

- [ ] Task 1: `@react-pdf/renderer@4.5.1` and `react-pdf-html` in `apps/web/package.json`
- [ ] Task 2: `Inter-Regular.ttf` and `Inter-Bold.ttf` in `apps/web/public/fonts/`
- [ ] Task 3: `contract-header-text.ts` created and type-checks
- [ ] Task 4: `contract-pdf-document.tsx` created, no `"use client"`, type-checks
- [ ] Task 5: Route Handler `route.ts` created, mirrors existing documents pattern
- [ ] Task 6: `patient-contract.tsx` updated with export button
- [ ] Level 1: `pnpm check-types` passes
- [ ] Level 3: `pnpm build` succeeds
- [ ] Level 5: PDF generated, opens in new tab, appears in Documentos
- [ ] Level 6: Manual content and file validation complete

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `react-pdf-html` v2.x incompatible with `@react-pdf/renderer` v4.5.x at runtime | MEDIUM | HIGH | Test immediately after Task 4. Fallback: strip HTML tags with regex and render clause text as `<Text>` — loses bold/italic but ships v1 |
| Monorepo crash if `@react-pdf/renderer` resolved from wrong package | MEDIUM | HIGH | Install ONLY in `apps/web/package.json`. Verify with `ls apps/web/node_modules/@react-pdf` after pnpm install |
| Font files missing at `process.cwd()/public/fonts/` at Vercel runtime | LOW | HIGH | Verify with a `fs.existsSync` log in development. Vercel copies `public/` at build time — path resolves correctly. |
| `getContractHeaderData()` fails inside Route Handler (cookies unavailable) | LOW | MEDIUM | `next/headers` cookies() works in Route Handlers. If it fails, extract auth-dependent logic directly into the Route Handler using the already-fetched `supabase` client. |
| TipTap HTML contains complex CSS styles unsupported by react-pdf-html | MEDIUM | LOW | The RichEditor toolbar is limited to: Bold, Italic, Underline, OrderedList, BulletList, TextAlign — all supported by react-pdf-html. Complex layouts are unlikely. |
| PDF file size exceeds 50MB Storage limit | LOW | LOW | Contract PDFs are text-only, typically <500KB. The 50MB limit is far above any realistic contract PDF. |

---

## Notes

- The `patients` table does NOT have CPF, RG, nationality, civil status, profession, or address fields. All these render as `[não informado]` per PRD risk mitigation. If these fields are added to the schema in a future migration, `buildContractHeaderBlocks` in `contract-header-text.ts` is the single file to update.
- `getContractHeaderData()` in `base-contract.ts` makes 2 DB queries (enterprise + team_members) using `supabaseAdmin`. The Route Handler will make additional queries for contract, patient, and pregnancy — total ~5 queries for one PDF generation. Acceptable for a low-frequency action.
- The signed URL expires in 300 seconds (same as the existing `GET /api/patients/[id]/documents/[documentId]` pattern). If the PDF needs to be re-opened, the user goes to the Documentos section.
- `React.createElement(ContractPdfDocument, {...})` is used in the Route Handler instead of JSX to avoid naming the Route Handler file `.tsx` (Next.js expects `route.ts`). Alternatively, name it `route.tsx` — Next.js App Router also accepts `.tsx` for Route Handlers.
