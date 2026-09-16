"use server";

import { authActionClient } from "@/lib/safe-action";
import { deleteDocumentTemplateSchema } from "@/lib/validations/document-template";

export const deleteDocumentTemplateAction = authActionClient
  .inputSchema(deleteDocumentTemplateSchema)
  .action(async ({ parsedInput: { templateId }, ctx: { supabase, user } }) => {
    const { data: template, error } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", templateId)
      .eq("owner_id", user.id)
      .eq("scope", "personal")
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return { template };
  });
