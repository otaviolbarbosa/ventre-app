"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  evolutionId: z.string().uuid(),
});

export const deletePregnancyEvolutionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { evolutionId } = parsedInput;

    const { data: evolution } = await supabase
      .from("pregnancy_evolutions")
      .select("pregnancy_id")
      .eq("id", evolutionId)
      .single();
    const { data: pregnancy } = evolution
      ? await supabase
          .from("pregnancies")
          .select("patient:patients(id, name)")
          .eq("id", evolution.pregnancy_id)
          .single()
      : { data: null };
    const patient = pregnancy?.patient as { id: string; name: string } | null;

    const { error } = await supabase.from("pregnancy_evolutions").delete().eq("id", evolutionId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Evolução gestacional excluída",
        description: patient
          ? `Evolução gestacional de ${patient.name} excluída`
          : "Evolução gestacional excluída",
        actionType: "clinical",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { evolution_id: evolutionId },
      });
    }

    return { success: true };
  });
