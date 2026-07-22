"use server";

import { z } from "zod";
import { authActionClient } from "@/lib/safe-action";
import { createInviteForPatientTeamMember } from "@/services/invite";

const schema = z.object({
	patientId: z.string().uuid("ID do paciente inválido"),
});

export const createTeamMemberInviteAction = authActionClient
	.inputSchema(schema)
	.action(async ({ parsedInput, ctx: { supabase, user } }) => {
		const invite = await createInviteForPatientTeamMember(
			supabase,
			user.id,
			parsedInput.patientId,
		);
		return { invite };
	});
