"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  bornAt: z.string().optional(),
  description: z.string().max(5000).optional(),
});

export const finishPatientCareAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { error: updateError } = await supabase
      .from("patients")
      .update({
        has_finished: true,
        born_at: parsedInput.bornAt ?? null,
      })
      .eq("id", parsedInput.patientId);

    if (updateError) throw new Error(updateError.message);

    if (parsedInput.description) {
      const { error: evolutionError } = await supabase
        .from("patient_evolutions")
        .insert({
          patient_id: parsedInput.patientId,
          professional_id: user.id,
          content: parsedInput.description,
        });

      if (evolutionError) throw new Error(evolutionError.message);
    }

    return { success: true };
  });
