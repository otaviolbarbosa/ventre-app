"use server";

import { z } from "zod";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { createInviteForPatientTeamMember } from "@/services/invite";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const createTeamMemberInviteAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const invite = await createInviteForPatientTeamMember(supabase, user.id, parsedInput.patientId);

    await captureServerEvent(user.id, "create_invite", { patient_id: parsedInput.patientId });

    return { invite };
  });
