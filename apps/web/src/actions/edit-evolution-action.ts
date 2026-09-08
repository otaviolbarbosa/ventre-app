"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { createEvolutionSchema } from "@/lib/validations/evolution";
import { z } from "zod";

const schema = z.object({
  evolutionId: z.string().uuid("ID da evolução inválido"),
  data: createEvolutionSchema,
});

export const editEvolutionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: evolution, error } = await supabase
      .from("patient_evolutions")
      .update({
        content: parsedInput.data.content,
        is_public: parsedInput.data.is_public,
      })
      .eq("id", parsedInput.evolutionId)
      .select("*, professional:professional_id(id, name)")
      .single();

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", evolution.patient_id)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Evolução editada",
        description: patient ? `Evolução editada para ${patient.name}` : "Evolução editada",
        actionType: "clinical",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: evolution.patient_id,
        metadata: { evolution_id: evolution.id },
      });
    }

    await captureServerEvent(user.id, "edit_evolution", { evolution_id: evolution.id });

    return { evolution };
  });
