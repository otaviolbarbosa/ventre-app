"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const deletePatientAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: patient } = await supabase
      .from("patients")
      .select("created_by, name")
      .eq("id", parsedInput.patientId)
      .single();

    if (patient?.created_by !== user.id) {
      throw new Error("Apenas o criador pode excluir o paciente");
    }

    const { error } = await supabase.from("patients").delete().eq("id", parsedInput.patientId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Paciente excluída",
        description: patient?.name
          ? `Paciente ${patient.name} excluída`
          : "Paciente excluída",
        actionType: "patient",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        metadata: { patient_id: parsedInput.patientId },
      });
    }

    return { success: true };
  });
