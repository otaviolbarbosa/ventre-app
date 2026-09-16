"use server";

import type { Json } from "@ventre/supabase/types";
import { authActionClient } from "@/lib/safe-action";
import { updateDocumentTemplateSchema } from "@/lib/validations/document-template";

export const updateDocumentTemplateAction = authActionClient
  .inputSchema(updateDocumentTemplateSchema)
  .action(async ({ parsedInput: { templateId, title, content }, ctx: { supabase, user } }) => {
    const { data: template, error } = await supabase
      .from("document_templates")
      .update({
        content: content as Json,
        ...(title !== undefined ? { title } : {}),
      })
      .eq("id", templateId)
      .eq("owner_id", user.id)
      .eq("scope", "personal")
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return { template };
  });
