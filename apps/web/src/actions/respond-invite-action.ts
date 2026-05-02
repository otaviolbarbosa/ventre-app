"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { respondToInvite } from "@/services/invite";
import { z } from "zod";

const schema = z.object({
  inviteId: z.string().uuid("ID do convite inválido"),
  action: z.enum(["accept", "reject"]),
});

export const respondInviteAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const result = await respondToInvite(
      supabase,
      supabaseAdmin,
      profile,
      parsedInput.inviteId,
      parsedInput.action,
    );

    if (profile.enterprise_id && result.patientId) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", result.patientId)
        .single();

      const accepted = parsedInput.action === "accept";
      insertActivityLog({
        supabaseAdmin,
        actionName: accepted ? "Convite aceito" : "Convite recusado",
        description: accepted
          ? patient
            ? `Convite para equipe de ${patient.name} aceito`
            : "Convite de equipe aceito"
          : patient
            ? `Convite para equipe de ${patient.name} recusado`
            : "Convite de equipe recusado",
        actionType: "team",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: result.patientId,
        metadata: { invite_id: parsedInput.inviteId },
      });
    }

    return { success: true, patientId: result.patientId };
  });
