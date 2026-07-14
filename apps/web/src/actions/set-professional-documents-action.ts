"use server";

import { authActionClient } from "@/lib/safe-action";
import { professionalDocumentsSchema } from "@/lib/validations/professional-documents";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  professional_documents: professionalDocumentsSchema.optional(),
});

export const setProfessionalDocumentsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    if (parsedInput.professional_documents) {
      const { error } = await supabase
        .from("users")
        .update({
          professional_documents: parsedInput.professional_documents,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw new Error("Erro ao salvar documentos profissionais");
    }

    redirect("/home");
  });
