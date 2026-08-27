import {
  PartographPdfDocument,
  type PartographPdfData,
} from "@/components/shared/partograph-pdf-document";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import React from "react";

// Server-only module: imports @react-pdf/renderer. Never import from client components.

export async function renderPartographPdfBuffer(data: PartographPdfData): Promise<Buffer> {
  return renderToBuffer(
    React.createElement(PartographPdfDocument, { data }) as React.ReactElement<DocumentProps>,
  );
}

function sanitizePatientNameForFile(patientName: string): string {
  return patientName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toUpperCase();
}

export function buildPartographPdfFileName(patientName: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `PARTOGRAMA_${sanitizePatientNameForFile(patientName)}_${dateStr}.pdf`;
}
