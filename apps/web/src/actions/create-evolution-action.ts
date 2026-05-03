"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { createEvolutionSchema } from "@/lib/validations/evolution";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  data: createEvolutionSchema,
});

export const createEvolutionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: evolution, error } = await supabase
      .from("patient_evolutions")
      .insert({
        patient_id: parsedInput.patientId,
        professional_id: user.id,
        content: parsedInput.data.content,
      })
      .select("*, professional:professional_id(id, name)")
      .single();

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", parsedInput.patientId)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Evolução registrada",
        description: patient
          ? `Nova evolução registrada para ${patient.name}`
          : "Nova evolução registrada",
        actionType: "clinical",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: parsedInput.patientId,
        metadata: { evolution_id: evolution.id },
      });
    }

    return { evolution };
  });
