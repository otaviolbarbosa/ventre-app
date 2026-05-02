"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { leaveTeam } from "@/services/team";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const leaveTeamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    await leaveTeam(supabase, user.id, parsedInput.patientId);

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", parsedInput.patientId)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Saiu da equipe",
        description: patient
          ? `Profissional saiu da equipe de ${patient.name}`
          : "Profissional saiu da equipe",
        actionType: "team",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: parsedInput.patientId,
        metadata: { patient_id: parsedInput.patientId },
      });
    }

    return { success: true };
  });
