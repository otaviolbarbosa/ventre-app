# Feature: Preview Real de PDF via pdf.js (Fase 7)

## Summary

Fase 7 (Should-have) do PRD `patient-contract-signature`. Hoje `contract-signature-preview.tsx`,
`contract-settings-screen.tsx` e `personal-contract-settings-screen.tsx` (mais o componente
interno `ContractDocument` em `patient-contract.tsx`) renderizam uma simulação em HTML/CSS do
contrato — título, blocos de cabeçalho, cláusulas via `dangerouslySetInnerHTML`, e um rodapé de
assinatura com caixas vazias no lugar do carimbo — nunca um PDF de verdade. O pipeline de
geração de PDF real já existe e é 100% reaproveitável: `renderContractPdfBuffer()`
(`@react-pdf/renderer`) é uma função pura, sem acoplamento a banco ou Storage, que já aceita
tanto dados persistidos quanto dados de rascunho em memória (confirmado pelos dois agentes de
exploração). Este plano adiciona `react-pdf` (wojtekmaj, não confundir com `@react-pdf/renderer`
já usado para geração) como dependência de renderização client-side, cria uma ação leve
`preview-contract-pdf-action.ts` que gera os bytes do PDF sob demanda a partir do estado do
formulário (sem persistir nada em Storage/DB), e um componente `PdfViewer` que substitui a
simulação em HTML nos três alvos do PRD. Para o caso de contrato já assinado, reaproveita a
ação de download já existente (`getDocumentDownloadUrlAction`) para alimentar o mesmo
`PdfViewer` com a URL assinada do documento imutável.

## User Story

Como profissional, quero ver o PDF real do contrato (rascunho ou já assinado) durante a edição
e a visualização, para conferir exatamente o documento que será gerado/já foi gerado, em vez de
uma aproximação em HTML que pode divergir do PDF final.

## Problem Statement

`ContractSignaturePreview` (`apps/web/src/components/shared/contract-signature-preview.tsx`)
e os blocos que a envolvem em `contract-settings-screen.tsx:266-363`,
`personal-contract-settings-screen.tsx:269-343` e `patient-contract.tsx:660-761`
(`ContractDocument`) mostram uma aproximação visual do contrato — não o PDF que
`renderContractPdfBuffer()` de fato produziria. `pdfjs-dist` não é dependência hoje em nenhum
`package.json` do monorepo.

## Solution Statement

Adicionar `react-pdf` (wrapper React sobre `pdfjs-dist`, mantido ativamente, compatível com
React 19 desde a v4.1.0, versão atual 10.4.1 empacota `pdfjs-dist@5.4.296`) como dependência de
`apps/web`. Copiar o worker `pdf.worker.min.mjs` para `public/` via script de
build/dev — pesquisa confirmou que o padrão `new URL(..., import.meta.url)` recomendado pela
documentação do pdf.js quebra sob Turbopack (bug rastreado em
`vercel/next.js#65406`/Linear `PACK-3046`, sem correção confirmada); servir o worker como
asset estático em `/public` contorna o bug completamente. Criar
`apps/web/src/components/shared/pdf-viewer.tsx` — Client Component (`"use client"` +
`next/dynamic(..., { ssr: false })`, já que `pdfjs-dist` usa `DOMMatrix`/canvas, APIs
inexistentes em SSR) que recebe uma fonte (`{ url: string }` para documento já persistido ou
`{ base64: string }` para preview de rascunho) e renderiza as páginas via `<Document>`/`<Page>`
do `react-pdf`. Criar `preview-contract-pdf-action.ts` — ação leve que chama
`renderContractPdfBuffer()` diretamente com `headerBlocks`/`title`/`clausesHtml` do estado em
memória (sem tocar em `contracts` nem `patient_documents`) e retorna os bytes em base64 — assim
o preview de rascunho (inclusive nas telas de template, que não têm paciente real) nunca precisa
de um `patientId` nem de um upload de Storage. Para o caso já assinado, reaproveitar
`getDocumentDownloadUrlAction` (já usado em `patient-contract.tsx:253-263`) sem nenhuma
mudança.

## Metadata

| Field            | Value                                             |
| ---------------- | -------------------------------------------------- |
| Type             | ENHANCEMENT                                        |
| Complexity       | MEDIUM                                             |
| Systems Affected | apps/web (nova dependência, nova action, novo componente client, 3 telas/componentes alvo) |
| Dependencies     | **Nova**: `react-pdf@^10.4.1` (bundla `pdfjs-dist@5.4.296` internamente, sem instalar `pdfjs-dist` direto). Existentes reaproveitados: `@react-pdf/renderer@4.5.1` (geração, inalterado), `react@^19.2.0`, `next@16.1.0` |
| Estimated Tasks  | 8                                                   |

---

## UX Design

### Before State
```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              BEFORE STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  contract-settings-screen.tsx / personal-contract-settings-screen.tsx        ║
║    └─► ContractPreview: título + blocos tracejados "[dados preenchidos       ║
║         automaticamente]" + dangerouslySetInnerHTML(clausesHtml) +           ║
║         ContractSignaturePreview (caixas vazias no lugar do carimbo)         ║
║                                                                               ║
║  patient-contract.tsx (modal "Preview do Contrato" + modo readonly)          ║
║    └─► ContractDocument: mesma simulação em HTML, dados reais da gestante    ║
║         mas ainda não é o PDF de fato gerado por renderContractPdfBuffer     ║
║                                                                               ║
║  USER_FLOW: profissional vê uma aproximação visual, não o documento real.    ║
║  PAIN_POINT: divergência possível entre o preview e o PDF assinado de fato.  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

╔═══════════════════════════════════════════════════════════════════════════════╗
║                               AFTER STATE                                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  contract-settings-screen.tsx / personal-contract-settings-screen.tsx        ║
║    └─► [Visualizar PDF] ──► previewContractPdfAction(headerBlocks*, title,   ║
║         clausesHtml) ──► renderContractPdfBuffer() (sem persistir) ──►       ║
║         base64 ──► <PdfViewer source={{ base64 }} />                         ║
║         (* headerBlocks com paciente placeholder, já que é preview de       ║
║         modelo — mesmo texto "[não informado]" que já aparece hoje)          ║
║                                                                               ║
║  patient-contract.tsx (modal "Preview do Contrato", modo editing)            ║
║    └─► mesma previewContractPdfAction, agora com headerBlocks reais da       ║
║         gestante ──► <PdfViewer source={{ base64 }} />                       ║
║                                                                               ║
║  patient-contract.tsx (modo readonly, contrato já assinado)                  ║
║    └─► getDocumentDownloadUrlAction (já existente) ──► <PdfViewer            ║
║         source={{ url: signedUrl }} />                                       ║
║                                                                               ║
║  USER_FLOW: profissional vê o PDF de verdade, gerado pelo mesmo pipeline     ║
║  que produz o documento final assinado.                                       ║
║  VALUE_ADD: zero divergência entre preview e documento real.                  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Interaction Changes

| Location | Before | After | User Impact |
|----------|--------|-------|--------------|
| `contract-signature-preview.tsx` + telas de template | Simulação HTML do rodapé de assinatura | Substituído pelo PDF real renderizado via `PdfViewer` | Vê o rodapé exatamente como sairá no PDF |
| `patient-contract.tsx` (modal preview, modo editing) | `ContractDocument` (HTML) | `PdfViewer` alimentado por `previewContractPdfAction` | Preview fiel ao PDF final antes de assinar |
| `patient-contract.tsx` (modo readonly) | `ContractDocument` (HTML) | `PdfViewer` alimentado pela URL assinada do documento já gerado | Vê o próprio arquivo PDF armazenado, não uma aproximação |

---

## Mandatory Reading

**CRITICAL: Implementation agent MUST read these files before starting any task:**

| Priority | File | Lines | Why Read This |
|----------|------|-------|-----------------|
| P0 | `apps/web/src/lib/contract-pdf.ts` | 1-39 | `renderContractPdfBuffer` — função pura a reaproveitar diretamente na nova ação (Task 3); NÃO precisa de `supabase`/`supabaseAdmin` |
| P0 | `apps/web/src/lib/contract-header-text.ts` | 56-90 | `ContractHeaderBlocks` (shape simples: 3 strings) e `buildContractHeaderBlocks` — usar para montar o header placeholder nas telas de template (Task 6) |
| P0 | `apps/web/src/actions/get-document-download-url-action.ts` | 10-28 | Ação já pronta a reaproveitar sem alteração para o caso "já assinado" (Task 5) |
| P0 | `apps/web/src/components/shared/patient-contract.tsx` | 249-278, 636-655, 337-393, 660-761 | `handleExportPdf` (padrão de obtenção de URL assinada), o modal de preview (`isPreviewOpen`), o modo `readonly`, e `ContractDocument` — todos os pontos a editar na Task 5 |
| P0 | `apps/web/next.config.js` | 1-39 | Config atual (`turbopack: {}`, `outputFileTracingIncludes`) — Task 2 precisa adicionar o script de cópia do worker sem quebrar o tracing já configurado para `@react-pdf/renderer` |
| P1 | `apps/web/src/screens/contract-settings-screen.tsx` | 1-45, 266-363 | Estado local (`title`, `clausesHtml`, `city`, `state`) e `ContractPreview` — MIRROR para Task 6 |
| P1 | `apps/web/src/screens/personal-contract-settings-screen.tsx` | (equivalente) | Mesma estrutura da tela de contrato pessoal — mesma edição da Task 6 |
| P1 | `apps/web/src/components/shared/contract-signature-preview.tsx` | 1-55 | Componente a substituir/aposentar (Task 7) — usado nos 3 alvos |
| P1 | `apps/web/app/api/patients/[id]/contract/pdf/route.ts` | 1-173 | Referência do padrão "renderizar sem persistir vs. persistir e assinar URL" já em produção — a nova ação (Task 3) segue a metade "renderizar sem persistir", nunca a metade de upload |
| P2 | `apps/web/src/actions/sign-patient-contract-action.ts` | 119-136 | Confirma que `sanitizeClausesHtml` deve sempre rodar antes de `renderContractPdfBuffer` — mesma chamada a replicar na nova ação |

**External Documentation:**

| Source | Section | Why Needed |
|--------|---------|--------------|
| [vercel/next.js#65406](https://github.com/vercel/next.js/issues/65406) | Turbopack `webpackIgnore` bug | Confirma por que o padrão `new URL(..., import.meta.url)` documentado pelo pdf.js NÃO deve ser usado neste repo (Turbopack ativo em `next.config.js:11`) — Task 2 usa o workaround de asset estático em vez disso |
| [react-pdf.org/compatibility](https://react-pdf.org/compatibility) | Compatibility table | Confirma `react-pdf@10.4.1` suporta `react@^19` como peer dep (React 19 support desde v4.1.0) — sem esse dado, seria necessário fixar uma versão mais antiga |
| [wojtekmaj/react-pdf#1855](https://github.com/wojtekmaj/react-pdf/issues/1855) | `workerSrc` overwritten | GOTCHA: setar `workerSrc` no mesmo módulo client onde `<Document>` é renderizado, não em um arquivo compartilhado separado — aplica-se à Task 4 |
| [wojtekmaj/react-pdf#2039](https://github.com/wojtekmaj/react-pdf/issues/2039) | `DOMMatrix` SSR crash | Confirma que `ssr: false` via `next/dynamic` é obrigatório, não opcional — aplica-se à Task 4 |
| [wojtekmaj/react-pdf#2062](https://github.com/wojtekmaj/react-pdf/issues/2062) | Range requests em URLs presigned | GOTCHA de baixo risco (PDFs de 2-5 páginas) documentado nos Risks — sem ação necessária no MVP, só monitorar |

---

## Patterns to Mirror

**GERAÇÃO DE PDF PURA (a reaproveitar sem modificação):**

```typescript
// SOURCE: apps/web/src/lib/contract-pdf.ts:23-39
export async function renderContractPdfBuffer({
  headerBlocks, title, clausesHtml, signature,
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

**PADRÃO "RENDERIZAR SEM PERSISTIR" (a mirror, metade do que a rota POST já faz):**

```typescript
// SOURCE: apps/web/app/api/patients/[id]/contract/pdf/route.ts:140-144
// COPY THIS PATTERN (mas SEM o uploadContractPdf que vem logo depois):
const buffer = await renderContractPdfBuffer({
  headerBlocks,
  title: contract.title,
  clausesHtml: sanitizeClausesHtml(contract.clauses_html),
});
```

**PADRÃO "OBTER URL ASSINADA PARA DOCUMENTO JÁ EXISTENTE" (a reaproveitar sem alteração):**

```typescript
// SOURCE: apps/web/src/components/shared/patient-contract.tsx:253-263
if (signatureInfo?.signedDocumentId) {
  const res = await getDownloadUrl({ documentId: signatureInfo.signedDocumentId });
  if (res?.data?.url) {
    window.open(res.data.url, "_blank");
  } else {
    toast.error(res?.serverError ?? "Erro ao baixar contrato assinado");
  }
  return;
}
```

**AÇÃO SIMPLES SEM PERSISTÊNCIA (mirror estrutural de uma action leve):**

```typescript
// SOURCE: apps/web/src/actions/get-document-download-url-action.ts:10-28
// COPY THIS PATTERN (estrutura authActionClient + inputSchema + return simples):
export const getDocumentDownloadUrlAction = authActionClient
  .inputSchema(z.object({ documentId: z.string().uuid() }))
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin } }) => {
    // ...
    return { url: signedUrl.signedUrl, fileName: document.file_name };
  });
```

---

## Files to Change

| File | Action | Justification |
|------|--------|------------------|
| `apps/web/package.json` | UPDATE | Adiciona `react-pdf@^10.4.1` + scripts de cópia do worker |
| `apps/web/src/actions/preview-contract-pdf-action.ts` | CREATE | Nova ação — gera bytes de PDF de rascunho sem persistir |
| `apps/web/src/components/shared/pdf-viewer.tsx` | CREATE | Componente client `react-pdf` — substitui a simulação HTML |
| `apps/web/src/components/shared/contract-signature-preview.tsx` | DELETE (ou mantido só como referência morta — ver Task 7 GOTCHA) | Rodapé simulado, substituído pelo PDF real |
| `apps/web/src/screens/contract-settings-screen.tsx` | UPDATE | `ContractPreview` passa a usar `PdfViewer` |
| `apps/web/src/screens/personal-contract-settings-screen.tsx` | UPDATE | Mesma mudança |
| `apps/web/src/components/shared/patient-contract.tsx` | UPDATE | `ContractDocument`/modal de preview/modo readonly passam a usar `PdfViewer` |
| `apps/web/next.config.js` | UPDATE (se necessário) | Confirmar que `outputFileTracingIncludes` não precisa de entrada extra para `public/pdf.worker.min.mjs` (é servido estaticamente por padrão pelo Next, sem tracing) |

---

## NOT Building (Scope Limits)

- Toolbar de viewer completo (zoom, busca, thumbnails, paginação com miniaturas) — o PRD pede
  apenas "renderização real do PDF", não um leitor completo; `PdfViewer` renderiza todas as
  páginas em sequência verticalmente (scroll natural), sem controles adicionais.
- Proxy de Route Handler para contornar o problema de range-request em URLs presigned
  (`wojtekmaj/react-pdf#2062`) — documentos de 2-5 páginas não devem disparar esse problema na
  prática; se surgir intermitência de carregamento em produção, tratar como bug separado, não
  como parte deste plano.
- Migrar `@react-pdf/renderer` (geração server-side) para qualquer outra lib — permanece
  exatamente como está; `react-pdf` (nova dependência) é só para renderização client-side, sem
  nenhuma sobreposição de responsabilidade.
- Cache/memoização do PDF de rascunho gerado (ex: não re-renderizar se `clausesHtml` não mudou
  desde o último preview) — otimização futura, não bloqueia a validação da fase.
- Suporte a preview automático "ao vivo" enquanto o usuário digita (debounce por keystroke) — o
  preview é gerado sob demanda (clique em "Visualizar PDF" / abrir o modal), não continuamente,
  para evitar chamadas repetidas de `renderToBuffer` (não é uma operação barata).

---

## Step-by-Step Tasks

Execute em ordem. Cada task é atômica e verificável independentemente.

### Task 1: UPDATE `apps/web/package.json`

- **ACTION**: Adicionar `react-pdf` como dependência
- **IMPLEMENT**: Adicionar `"react-pdf": "^10.4.1"` em `dependencies` (mesma seção onde
  `@react-pdf/renderer` já está listado, `package.json:34`)
- **GOTCHA**: `react-pdf` (wojtekmaj, viewer client-side) e `@react-pdf/renderer` (geração
  server-side, já em uso) são pacotes NPM completamente diferentes com nomes parecidos — não
  confundir nem tentar unificar; ambos ficam lado a lado no mesmo `package.json`.
- **VALIDATE**: `pnpm install`; confirmar `node -e "console.log(require('react-pdf/package.json').version)"` reporta `10.4.x`

### Task 2: UPDATE `apps/web/package.json` (scripts) — cópia do worker do pdf.js

- **ACTION**: Adicionar script que copia `pdf.worker.min.mjs` para `public/` antes de `dev`/`build`
- **IMPLEMENT**: Adicionar aos `scripts` de `apps/web/package.json`:
  ```json
  "copy-pdf-worker": "cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs",
  "predev": "pnpm copy-pdf-worker",
  "prebuild": "pnpm copy-pdf-worker"
  ```
  (ajustar os nomes dos scripts existentes de `dev`/`build` em `apps/web/package.json` para
  confirmar que `pre*` do pnpm dispara automaticamente antes deles — se o monorepo usa Turborepo
  para orquestrar `pnpm dev`/`pnpm build` na raiz, confirmar que os scripts `pre*` do workspace
  `apps/web` ainda disparam corretamente nesse contexto; caso não disparem, adicionar
  `copy-pdf-worker` como `dependsOn` explícito de `dev`/`build` em `turbo.json` em vez de
  depender de `pre*`)
- **MIRROR**: Nenhum padrão existente no repo para scripts de cópia de asset — este é o
  primeiro. Comentário em `next.config.js:14-16` já documenta que `@react-pdf/renderer` tem uma
  necessidade parecida de asset runtime, mas resolvida via `outputFileTracingIncludes`
  (mecanismo diferente, pois aquele asset é lido via `fs` no servidor, não servido como arquivo
  estático ao browser).
- **GOTCHA**: O caminho `node_modules/pdfjs-dist/build/pdf.worker.min.mjs` assume que
  `pdfjs-dist` foi hoisted para a raiz do `node_modules` pelo pnpm — em monorepos pnpm com
  `node-linker` estrito, o caminho real pode ser
  `node_modules/.pnpm/pdfjs-dist@5.4.296/node_modules/pdfjs-dist/build/pdf.worker.min.mjs` ou
  `apps/web/node_modules/react-pdf/node_modules/pdfjs-dist/...` — rodar
  `pnpm --filter web exec find . -name "pdf.worker.min.mjs" -not -path "*/node_modules/.pnpm/*"`
  (ou equivalente) para confirmar o caminho real antes de finalizar o script; usar `find` +
  fallback no script se necessário. A versão do worker copiado DEVE bater exatamente com a
  versão de `pdfjs-dist` que `react-pdf` usa internamente (5.4.296 na v10.4.1) — confirmar após
  a cópia rodando o app e checando o console do navegador por erros de "API version does not
  match Worker version".
- **VALIDATE**: `pnpm dev` (ou `pnpm --filter web dev`); confirmar que `public/pdf.worker.min.mjs` existe após rodar o script

### Task 3: CREATE `apps/web/src/actions/preview-contract-pdf-action.ts`

- **ACTION**: Nova ação — gera bytes de PDF de rascunho a partir de dados em memória, sem persistir nada
- **IMPLEMENT**:
  ```typescript
  "use server";

  import { renderContractPdfBuffer, sanitizeClausesHtml } from "@/lib/contract-pdf";
  import { authActionClient } from "@/lib/safe-action";
  import { z } from "zod";

  const contractHeaderBlocksSchema = z.object({
    contratanteBlock: z.string(),
    contratadaBlock: z.string(),
    teamMembersBlock: z.string().nullable(),
  });

  export const previewContractPdfAction = authActionClient
    .inputSchema(
      z.object({
        headerBlocks: contractHeaderBlocksSchema,
        title: z.string(),
        clausesHtml: z.string(),
      }),
    )
    .action(async ({ parsedInput: { headerBlocks, title, clausesHtml } }) => {
      const buffer = await renderContractPdfBuffer({
        headerBlocks,
        title,
        clausesHtml: sanitizeClausesHtml(clausesHtml),
      });

      return { pdfBase64: buffer.toString("base64") };
    });
  ```
- **MIRROR**: `apps/web/app/api/patients/[id]/contract/pdf/route.ts:140-144` (a chamada de
  `renderContractPdfBuffer`, sem a parte de upload que vem depois na rota original),
  `apps/web/src/actions/get-document-download-url-action.ts:10-28` (estrutura geral de uma
  ação simples com `authActionClient`)
- **GOTCHA**: Esta ação deliberadamente NÃO recebe `patientId` nem escreve em
  `contracts`/`patient_documents`/Storage — isso é o que permite reaproveitá-la tanto para o
  preview por paciente (`patient-contract.tsx`) quanto para o preview de modelo/template
  (`contract-settings-screen.tsx`, sem paciente real nenhum). Qualquer usuário autenticado
  (`authActionClient`) pode chamar — não há dado sensível de outro paciente envolvido, já que
  os `headerBlocks` vêm inteiramente do input, não de uma consulta ao banco; não é necessário
  checar propriedade/autorização de paciente aqui (diferente de `getPatientContractAction`, que
  lê dados reais do banco por `patientId`).
- **VALIDATE**: `pnpm check-types`

### Task 4: CREATE `apps/web/src/components/shared/pdf-viewer.tsx`

- **ACTION**: Componente client que renderiza um PDF via `react-pdf`, a partir de uma URL ou de bytes base64
- **IMPLEMENT**:
  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { Document, Page, pdfjs } from "react-pdf";
  import "react-pdf/dist/Page/AnnotationLayer.css";
  import "react-pdf/dist/Page/TextLayer.css";

  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  type PdfSource = { url: string } | { base64: string };

  export function PdfViewer({ source }: { source: PdfSource }) {
    const [numPages, setNumPages] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const file = "url" in source ? source.url : { data: atob(source.base64) };

    return (
      <div className="flex flex-col items-center gap-4 overflow-auto bg-muted/30 py-4">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm">
            {error}
          </div>
        )}
        <Document
          file={file}
          onLoadSuccess={({ numPages }) => {
            setNumPages(numPages);
            setError(null);
          }}
          onLoadError={() => setError("Não foi possível carregar o PDF.")}
          loading={<p className="text-muted-foreground text-sm">Carregando PDF...</p>}
        >
          {Array.from({ length: numPages ?? 0 }, (_, i) => (
            <Page
              key={`page-${i + 1}`}
              pageNumber={i + 1}
              width={794}
              className="mb-4 shadow-md"
            />
          ))}
        </Document>
      </div>
    );
  }
  ```
- **MIRROR**: Nenhum padrão existente no repo para `next/dynamic({ ssr: false })` — este é o
  primeiro; documentado explicitamente para o time (ver GOTCHA). Largura `794` mirror do
  `w-[794px]` já usado como largura de página A4 simulada em `ContractDocument`/`ContractPreview`
  (`patient-contract.tsx`, `contract-settings-screen.tsx`) para manter a proporção visual
  consistente com o que já existia.
- **GOTCHA**: `pdfjs.GlobalWorkerOptions.workerSrc` é setado no topo deste MESMO módulo, não em
  um arquivo compartilhado separado — `wojtekmaj/react-pdf#1855` documenta que setar em outro
  lugar pode ser sobrescrito pelo valor default do `react-pdf` antes de surtir efeito. Este
  componente já tem `"use client"`, mas AINDA PRECISA ser importado pelos consumidores via
  `next/dynamic(() => import("@/components/shared/pdf-viewer").then((m) => m.PdfViewer), { ssr: false })`
  (Tasks 5 e 6) — `"use client"` sozinho não impede a tentativa de SSR do lado do Server
  Component pai; é o `ssr: false` do `next/dynamic` que garante isso, por causa do uso de
  `DOMMatrix`/canvas (`wojtekmaj/react-pdf#2039`). Para a fonte `{ base64 }`, `atob()` decodifica
  para uma string binária que `react-pdf`/pdf.js aceita via `{ data: string }` — não precisa de
  conversão manual para `Uint8Array` (a prop `data` do `Document` do react-pdf aceita string
  binária diretamente).
- **VALIDATE**: `pnpm check-types`

### Task 5: UPDATE `apps/web/src/components/shared/patient-contract.tsx`

- **ACTION**: Trocar `ContractDocument` (HTML) por `PdfViewer` no modal de preview (modo
  editing) e no modo readonly
- **IMPLEMENT**:
  1. Importar dinamicamente: `const PdfViewer = dynamic(() => import("@/components/shared/pdf-viewer").then((m) => m.PdfViewer), { ssr: false, loading: () => <p className="text-muted-foreground text-sm">Carregando visualizador...</p> });` e `import dynamic from "next/dynamic";`, `import { previewContractPdfAction } from "@/actions/preview-contract-pdf-action";`
  2. Adicionar estado: `const [previewPdfBase64, setPreviewPdfBase64] = useState<string | null>(null);`
  3. No handler que abre o modal de preview (`onClick` que hoje só faz `setIsPreviewOpen(true)`), antes de abrir, chamar `previewContractPdfAction({ headerBlocks, title, clausesHtml })` e guardar `data.pdfBase64` em `previewPdfBase64`, com loading state e `toast.error` em caso de falha (mirror do padrão `onError` já usado em outras `useAction` deste arquivo)
  4. No JSX do `ContentModal` de preview (`:636-655`), trocar `<ContractDocument ... />` por `previewPdfBase64 ? <PdfViewer source={{ base64: previewPdfBase64 }} /> : <p>Carregando...</p>`
  5. No modo `readonly` (`:337-393`), quando `signatureInfo?.signedDocumentId` existe, buscar a URL assinada (reaproveitando `getDownloadUrl` já disponível em `:173`) e renderizar `<PdfViewer source={{ url }} />` no lugar do `<ContractDocument mode="readonly" ... />` atual
- **MIRROR**: `apps/web/src/components/shared/patient-contract.tsx:249-278` (`handleExportPdf`,
  padrão de chamar uma action e tratar `res?.data`/`res?.serverError`), `:636-655` (modal a
  editar)
- **GOTCHA**: A geração do preview de rascunho (`previewContractPdfAction`) deve ser disparada
  SOB DEMANDA (ao abrir o modal ou clicar em "Visualizar"), nunca a cada keystroke do
  `RichEditor` — `renderToBuffer` não é barato. Para o modo readonly, a URL assinada expira em
  300s (`getDocumentDownloadUrlAction`) — buscar a URL só quando o usuário efetivamente abre a
  visualização (não no carregamento inicial da página), mesmo cuidado já documentado pela
  pesquisa externa para não deixar a URL expirar antes do `PdfViewer` montar. `ContractDocument`
  como componente pode ser removido inteiramente se não sobrar nenhum call site após esta
  mudança — confirmar antes de apagar (ver Task 7).
- **VALIDATE**: `pnpm check-types`

### Task 6: UPDATE `apps/web/src/screens/contract-settings-screen.tsx` e `personal-contract-settings-screen.tsx`

- **ACTION**: Trocar `ContractPreview` (HTML) por `PdfViewer`, alimentado por `previewContractPdfAction` com um `headerBlocks` placeholder
- **IMPLEMENT**:
  1. Construir o `headerBlocks` de preview a partir de `buildContractHeaderBlocks` com um
     `PatientRow` totalmente placeholder (`{ name: null, email: null, phone: null,
     date_of_birth: null, rg: null, cpf: null, marital_status: null, occupation: null }`) e
     `pregnancy: null`, passando o `headerData`/`PersonalHeaderData` já disponível na tela —
     isso produz um `contratanteBlock` cheio de `[não informado]`, textualmente equivalente ao
     placeholder tracejado já mostrado hoje, mas agora dentro do PDF real
  2. Mesmo padrão de disparo sob demanda da Task 5: botão "Visualizar PDF" (já existe um botão
     de preview com ícone `Eye`, `Eye` já importado em `contract-settings-screen.tsx:16`) chama
     `previewContractPdfAction({ headerBlocks, title, clausesHtml })` e abre o `ContentModal`
     com `<PdfViewer source={{ base64: data.pdfBase64 }} />` no lugar de `<ContractPreview ... />`
  3. `ContractPreview` (a função local em cada arquivo) pode ser removida depois que a troca
     estiver completa
- **MIRROR**: `apps/web/src/screens/contract-settings-screen.tsx:266-363` (`ContractPreview`,
  função a substituir), Task 5 (mesmo padrão de disparo sob demanda + `next/dynamic`)
- **GOTCHA**: Diferente de `patient-contract.tsx`, estas duas telas NUNCA têm um `patientId`
  real — por isso `previewContractPdfAction` (Task 3) foi desenhada para não exigir um. Repetir
  a mesma lógica de placeholder nas duas telas (`contract-settings-screen.tsx` e
  `personal-contract-settings-screen.tsx`) — elas já duplicam a mesma estrutura de
  `ContractPreview` hoje, então esta não é uma duplicação nova introduzida por este plano.
- **VALIDATE**: `pnpm check-types`

### Task 7: DELETE (ou confirmar remoção segura de) `apps/web/src/components/shared/contract-signature-preview.tsx`

- **ACTION**: Remover o componente de simulação de rodapé, se não sobrar nenhum call site após as Tasks 5-6
- **IMPLEMENT**: Rodar `grep -rn "ContractSignaturePreview" apps/web/src apps/web/app` após
  completar as Tasks 5-6; se não houver mais nenhuma referência, apagar o arquivo e remover o
  import correspondente de qualquer lugar remanescente
- **GOTCHA**: Não apagar antes de confirmar que as Tasks 5 e 6 realmente substituíram todos os 3
  call sites listados na exploração original (`contract-settings-screen.tsx:353-358`,
  `personal-contract-settings-screen.tsx:333-338`, `patient-contract.tsx:748-755` dentro de
  `ContractDocument`) — se `ContractDocument` continuar existindo por qualquer motivo (ex: ainda
  usado em outro modo não coberto neste plano), o componente de assinatura simulada pode
  precisar continuar existindo até uma limpeza posterior.
- **VALIDATE**: `pnpm check-types`; `grep -rn "ContractSignaturePreview\|ContractDocument" apps/web/src apps/web/app` confirma ausência de referências órfãs

### Task 8: Validação estática completa e manual

- **ACTION**: `pnpm check-types` + exercício manual dos três alvos
- **IMPLEMENT**: `pnpm check-types`; depois, manualmente: (a) abrir `contract-settings-screen.tsx`
  e `personal-contract-settings-screen.tsx`, editar um modelo, clicar em "Visualizar PDF" e
  confirmar que um PDF real renderiza (não a simulação); (b) em `patient-contract.tsx`, no modo
  de edição de um contrato por paciente, abrir o preview e confirmar o mesmo; (c) assinar um
  contrato de teste e confirmar que o modo readonly mostra o PDF real já armazenado (via URL
  assinada), não mais a simulação; (d) checar o console do navegador por erros de versão do
  worker do pdf.js ("API version does not match Worker version") — se aparecer, revisitar o
  caminho copiado na Task 2.
- **VALIDATE**: Exit 0 em `check-types`; nenhum erro de worker/versão no console; PDF renderiza
  corretamente nos três alvos em `pnpm dev` E em `pnpm build && pnpm start` (o bug do Turbopack
  documentado na pesquisa pode se manifestar diferente entre dev e build — testar os dois)

---

## Testing Strategy

### Unit Tests to Write

Não há suíte de testes existente para nenhum dos três componentes/telas alvo, nem para as
actions de PDF já existentes (`get-document-download-url-action.ts`) — confirmado pelos dois
agentes de exploração. Este plano não introduz um padrão de teste novo. Validação via Level 1
(types) e Level 6 (manual, incluindo `dev` E `build`) abaixo.

### Edge Cases Checklist

- [ ] `clausesHtml` vazio (contrato ainda sem cláusulas) — `renderContractPdfBuffer` já lida
      com isso hoje no fluxo de assinatura real; confirmar que o preview também não quebra
- [ ] `headerBlocks` totalmente placeholder (tela de template, sem paciente) — PDF deve
      renderizar normalmente com `[não informado]` em todo canto, sem erro
- [ ] Worker do pdf.js com versão divergente de `pdfjs-dist` — erro visível no console,
      mitigado pela checagem manual da Task 2
- [ ] URL assinada expirada (usuário demora mais de 300s para abrir o preview do contrato
      assinado) — `PdfViewer`'s `onLoadError` deve mostrar a mensagem de erro amigável em vez de
      travar silenciosamente
- [ ] `pnpm build` (produção/Turbopack build) — testar especificamente, já que o bug de
      `webpackIgnore` documentado na pesquisa pode se comportar diferente entre `next dev` e
      `next build`

---

## Validation Commands

### Level 1: STATIC_ANALYSIS

```bash
pnpm check-types
```

**EXPECT**: Exit 0, sem erros

### Level 3: FULL_SUITE

```bash
pnpm build
```

**EXPECT**: Build sucede sem erro relacionado a `pdfjs-dist`/worker/Turbopack; `public/pdf.worker.min.mjs` presente no output

### Level 5: BROWSER_VALIDATION

- [ ] `contract-settings-screen.tsx`: "Visualizar PDF" renderiza um PDF real (não simulação)
- [ ] `personal-contract-settings-screen.tsx`: idem
- [ ] `patient-contract.tsx`, modo editing: modal de preview renderiza PDF real com dados da gestante
- [ ] `patient-contract.tsx`, modo readonly (contrato assinado): renderiza o PDF real já armazenado
- [ ] Nenhum erro de versão de worker no console do navegador em nenhum dos quatro casos acima
- [ ] Repetir os quatro casos acima após `pnpm build && pnpm start` (não só `pnpm dev`)

### Level 6: MANUAL_VALIDATION

Ver Task 8.

---

## Acceptance Criteria

- [ ] `react-pdf` instalado e funcional sob Turbopack (dev e build)
- [ ] Worker do pdf.js servido como asset estático em `/public`, versão batendo com `pdfjs-dist` interno do `react-pdf`
- [ ] `previewContractPdfAction` gera PDF de rascunho sem persistir nada em Storage/DB, reutilizável tanto para telas de template (sem paciente) quanto para contrato por paciente
- [ ] `contract-signature-preview.tsx`, `contract-settings-screen.tsx` e `personal-contract-settings-screen.tsx` renderizam PDF real via `PdfViewer`, não mais a simulação em HTML
- [ ] Contrato já assinado (modo readonly) mostra o PDF real armazenado, via URL assinada já existente
- [ ] `pnpm check-types` e `pnpm build` passam sem erros

---

## Completion Checklist

- [ ] Todas as 8 tasks completadas em ordem de dependência
- [ ] Level 1 (static analysis) passa
- [ ] Level 3 (build) passa
- [ ] Level 5 (browser validation, dev E build) passa
- [ ] Level 6 (manual validation) passa
- [ ] Todos os critérios de aceitação atendidos

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|--------------|
| Bug do Turbopack (`vercel/next.js#65406`) se manifesta mesmo com o worker servido estaticamente, em algum caminho de código não coberto pela pesquisa | LOW | HIGH | Task 8 exige testar explicitamente `pnpm dev` E `pnpm build`; se o bug aparecer mesmo assim, o fallback documentado na pesquisa é rodar com webpack em vez de Turbopack para este build específico (não recomendado como solução permanente, só diagnóstico) |
| Versão do worker copiado diverge da versão de `pdfjs-dist` que `react-pdf` usa internamente | MEDIUM | MEDIUM | Task 2 GOTCHA já documenta a checagem manual do caminho real e da versão; erro é visível e claro no console ("API version does not match Worker version"), não falha silenciosa |
| Range requests em URLs presigned do Supabase Storage falham intermitentemente para PDFs maiores | LOW | LOW | Fora de escopo para PDFs de 2-5 páginas (ver "NOT Building"); documentado como risco conhecido caso apareça em produção |
| Duplicação de lógica de placeholder `headerBlocks` entre `contract-settings-screen.tsx` e `personal-contract-settings-screen.tsx` | LOW | LOW | Já é uma duplicação pré-existente (`ContractPreview` já duplicada nas duas telas) — este plano não piora a situação; extrair um helper compartilhado fica como melhoria futura fora de escopo |

---

## Notes

- Esta é a última fase pendente do PRD `patient-contract-signature` — após esta fase, todas as
  7 fases estarão pelo menos `in-progress`.
- `ContractSignaturePreview` e `ContractDocument` (função local em `patient-contract.tsx`) podem
  não ser 100% removíveis nesta fase se houver algum modo/caminho não identificado na exploração
  que ainda dependa deles — Task 7 já trata isso como uma checagem explícita, não uma remoção
  cega.
