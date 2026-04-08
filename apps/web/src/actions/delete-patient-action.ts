"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const deletePatientAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { data: patient } = await supabase
      .from("patients")
      .select("created_by")
      .eq("id", parsedInput.patientId)
      .single();

    if (patient?.created_by !== user.id) {
      throw new Error("Apenas o criador pode excluir o paciente");
    }

    const { error } = await supabase.from("patients").delete().eq("id", parsedInput.patientId);

    if (error) throw new Error(error.message);

    return { success: true };
  });
