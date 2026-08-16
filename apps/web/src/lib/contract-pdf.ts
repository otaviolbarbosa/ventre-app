import {
  type ContractCertificateData,
  ContractCertificateDocument,
} from "@/components/shared/contract-certificate-document";
import {
  type ContractPdfData,
  ContractPdfDocument,
} from "@/components/shared/contract-pdf-document";
import type { ContractHeaderBlocks } from "@/lib/contract-header-text";
import { sanitizeClausesHtml } from "@/lib/contract-html";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import type {
  createServerSupabaseAdmin,
  createServerSupabaseClient,
} from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";
import { PDFDocument } from "pdf-lib";
import React from "react";

// Server-only module: imports @react-pdf/renderer. Never import from client components.
// For sanitizeClausesHtml in client code, import from "@/lib/contract-html" instead.

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export { sanitizeClausesHtml };

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

function sanitizePatientNameForFile(patientName: string): string {
  return patientName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toUpperCase();
}

export function buildContractPdfFileName(patientName: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `CONTRATO_${sanitizePatientNameForFile(patientName)}_${dateStr}.pdf`;
}

export function buildFinalizedContractPdfFileName(patientName: string): string {
  const dateStr = new Date().toISOString().slice(0, 10);
  return `CONTRATO_${sanitizePatientNameForFile(patientName)}_${dateStr}_Finalizado.pdf`;
}

export async function renderContractCertificateBuffer(
  data: ContractCertificateData,
): Promise<Buffer> {
  return renderToBuffer(
    React.createElement(ContractCertificateDocument, {
      data,
    }) as React.ReactElement<DocumentProps>,
  );
}

// Concatenates whole PDFs in order (contract pages + certificate pages) — used to
// assemble the finalized document from two independently-rendered @react-pdf/renderer
// outputs, since react-pdf's own totalPages/pageNumber render callback is scoped to a
// single Document and we need the certificate's own page count independent of the
// contract's page count.
export async function mergePdfBuffers(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buffer of buffers) {
    const source = await PDFDocument.load(buffer);
    const pages = await merged.copyPages(source, source.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return Buffer.from(await merged.save());
}

export async function uploadContractPdf({
  supabase,
  supabaseAdmin,
  patientId,
  userId,
  fileName,
  buffer,
  isImmutable,
  id,
}: {
  supabase: SupabaseClient;
  supabaseAdmin: SupabaseAdmin;
  patientId: string;
  userId: string;
  fileName: string;
  buffer: Buffer;
  isImmutable: boolean;
  // Pre-generated id — lets callers embed the future patient_documents.id inside the
  // PDF content itself (e.g. the finalized document's certificate pages print their
  // own document id) before the row actually exists.
  id?: string;
}): Promise<{ document: Tables<"patient_documents">; storagePath: string }> {
  const storagePath = `contracts/${patientId}/${Date.now()}_${fileName}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from("patient_documents")
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: document, error: insertError } = await supabase
    .from("patient_documents")
    .insert({
      ...(id ? { id } : {}),
      patient_id: patientId,
      uploaded_by: userId,
      file_name: fileName,
      file_type: "application/pdf",
      file_size: buffer.byteLength,
      storage_path: storagePath,
      is_immutable: isImmutable,
    })
    .select("*")
    .single();

  if (insertError || !document) {
    await supabaseAdmin.storage.from("patient_documents").remove([storagePath]);
    throw new Error(insertError?.message ?? "Erro ao salvar documento");
  }

  return { document, storagePath };
}
