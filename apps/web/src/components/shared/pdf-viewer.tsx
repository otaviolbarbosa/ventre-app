"use client";

import { useState } from "react";
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
    <div className="flex flex-col gap-4 overflow-auto bg-muted/30 lg:items-center">
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
          <Page key={`page-${i + 1}`} pageNumber={i + 1} width={794} className="mb-4 shadow-md" />
        ))}
      </Document>
    </div>
  );
}
