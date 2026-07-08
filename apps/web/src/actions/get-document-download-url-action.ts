"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  documentId: z.string().uuid(),
});

export const getDocumentDownloadUrlAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin } }) => {
    const { data: document, error } = await supabase
      .from("patient_documents")
      .select("storage_path, file_name")
      .eq("id", parsedInput.documentId)
      .single();

    if (error || !document) throw new Error("Documento não encontrado");

    const { data: signedUrl, error: signError } = await supabaseAdmin.storage
      .from("patient_documents")
      .createSignedUrl(document.storage_path, 300, { download: document.file_name });

    if (signError || !signedUrl) throw new Error("Erro ao gerar URL de download");

    return { url: signedUrl.signedUrl, fileName: document.file_name };
  });
