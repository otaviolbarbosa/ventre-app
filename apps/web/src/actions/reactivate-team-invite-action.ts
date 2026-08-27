"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { reactivateExpiredTeamInvite } from "@/services/invite";
import { z } from "zod";

const schema = z.object({
  inviteId: z.string().uuid("ID do convite inválido"),
});

export const reactivateTeamInviteAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const result = await reactivateExpiredTeamInvite(
      supabase,
      supabaseAdmin,
      user.id,
      parsedInput.inviteId,
    );

    if (profile.enterprise_id && result.patientId) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", result.patientId)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Convite reativado",
        description: patient
          ? `Convite expirado de equipe reativado para cuidar de ${patient.name}`
          : "Convite expirado de equipe reativado",
        actionType: "team",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: result.patientId,
        metadata: { invite_id: parsedInput.inviteId },
      });
    }

    await captureServerEvent(user.id, "reactivate_team_invite", {
      invite_id: parsedInput.inviteId,
    });

    return { success: true, expiresAt: result.expiresAt };
  });
