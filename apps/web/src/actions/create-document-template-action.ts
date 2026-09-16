"use server";

import type { Json } from "@ventre/supabase/types";
import { authActionClient } from "@/lib/safe-action";
import { createDocumentTemplateSchema } from "@/lib/validations/document-template";

export const createDocumentTemplateAction = authActionClient
  .inputSchema(createDocumentTemplateSchema)
  .action(async ({ parsedInput: { category, title, content }, ctx: { supabase, user } }) => {
    const { data: template, error } = await supabase
      .from("document_templates")
      .insert({
        category,
        title,
        content: content as Json,
        scope: "personal",
        owner_id: user.id,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return { template };
  });
