"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const getPatientPendingInvitesAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { data, error } = await supabase
      .from("team_invites")
      .select(`
        id,
        professional_type,
        invited_professional:users!team_invites_invited_professional_id_fkey(id, name, email, avatar_url, professional_type)
      `)
      .eq("patient_id", parsedInput.patientId)
      .eq("status", "pendente")
      .gt("expires_at", new Date().toISOString());

    if (error) throw new Error(error.message);

    return { invites: data ?? [] };
  });
