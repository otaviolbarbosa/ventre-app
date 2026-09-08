"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const getPatientEvolutionsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { data: evolutions, error } = await supabase
      .from("patient_evolutions")
      .select(
        "id, content, created_at, updated_at, is_public, patient_id, professional_id, edited_content, professional:professional_id(id, name, avatar_url)",
      )
      .eq("patient_id", parsedInput.patientId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return {
      evolutions: (evolutions ?? []).map(({ edited_content, ...evolution }) => ({
        ...evolution,
        hasUpdatedContent: (edited_content?.length ?? 0) > 0,
      })),
    };
  });
