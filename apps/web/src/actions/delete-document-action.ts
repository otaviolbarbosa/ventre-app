"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  documentId: z.string().uuid(),
});

export const deleteDocumentAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: document, error: fetchError } = await supabase
      .from("patient_documents")
      .select("storage_path, patient_id, patient:patients(name)")
      .eq("id", parsedInput.documentId)
      .single();

    if (fetchError || !document) throw new Error("Documento não encontrado");

    const { error: deleteError } = await supabase
      .from("patient_documents")
      .delete()
      .eq("id", parsedInput.documentId);

    if (deleteError) throw new Error(deleteError.message);

    await supabaseAdmin.storage.from("patient_documents").remove([document.storage_path]);

    if (profile.enterprise_id) {
      const patient = document.patient as { name: string } | null;
      insertActivityLog({
        supabaseAdmin,
        actionName: "Documento excluído",
        description: patient
          ? `Documento de ${patient.name} excluído`
          : "Documento excluído",
        actionType: "patient",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: document.patient_id,
        metadata: { document_id: parsedInput.documentId },
      });
    }

    return { success: true };
  });
