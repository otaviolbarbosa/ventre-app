import { ContractPdfDocument, type ContractPdfData } from "@/components/shared/contract-pdf-document";
import type { ContractHeaderBlocks } from "@/lib/contract-header-text";
import { type DocumentProps, renderToBuffer } from "@react-pdf/renderer";
import type { createServerSupabaseAdmin, createServerSupabaseClient } from "@ventre/supabase/server";
import type { Tables } from "@ventre/supabase/types";
import React from "react";

// Server-only module: imports @react-pdf/renderer. Never import from client components.

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;
type SupabaseAdmin = Awaited<ReturnType<typeof createServerSupabaseAdmin>>;

export function sanitizeClausesHtml(html: string): string {
  return html.replace(/font-family\s*:[^;}"']+[;}"']/g, "");
}

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

export function buildContractPdfFileName(patientName: string): string {
  const sanitizedName = patientName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toUpperCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  return `CONTRATO_${sanitizedName}_${dateStr}.pdf`;
}

export async function uploadContractPdf({
  supabase,
  supabaseAdmin,
  patientId,
  userId,
  fileName,
  buffer,
  isImmutable,
}: {
  supabase: SupabaseClient;
  supabaseAdmin: SupabaseAdmin;
  patientId: string;
  userId: string;
  fileName: string;
  buffer: Buffer;
  isImmutable: boolean;
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
