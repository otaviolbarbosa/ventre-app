"use server";

import { authActionClient } from "@/lib/safe-action";
import { personalDocumentsSchema } from "@/lib/validations/personal-documents";
import { professionalDocumentsSchema } from "@/lib/validations/professional-documents";
import { redirect } from "next/navigation";
import { z } from "zod";

const schema = z.object({
  professional_documents: professionalDocumentsSchema.optional(),
  personal_documents: personalDocumentsSchema.optional(),
});

export const setProfessionalDocumentsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    if (parsedInput.professional_documents || parsedInput.personal_documents) {
      const { error } = await supabase
        .from("users")
        .update({
          professional_documents: parsedInput.professional_documents ?? null,
          personal_documents: parsedInput.personal_documents ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw new Error("Erro ao salvar documentos profissionais");
    }

    redirect("/home");
  });
