"use server";

import { authActionClient } from "@/lib/safe-action";
import { listDocumentTemplatesSchema } from "@/lib/validations/document-template";

export const listDocumentTemplatesAction = authActionClient
  .inputSchema(listDocumentTemplatesSchema)
  .action(async ({ parsedInput: { category }, ctx: { supabase, user } }) => {
    const { data: templates, error } = await supabase
      .from("document_templates")
      .select("*")
      .eq("category", category)
      .or(`scope.eq.global,owner_id.eq.${user.id}`)
      .order("scope", { ascending: false })
      .order("title", { ascending: true });

    if (error) throw new Error(error.message);

    return { templates: templates ?? [] };
  });
