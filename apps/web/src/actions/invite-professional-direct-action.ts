"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import dayjs from "dayjs";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  professionalId: z.string().uuid("ID do profissional inválido"),
});

export const inviteProfessionalDirectAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: existing } = await supabase
      .from("team_invites")
      .select("id")
      .eq("patient_id", parsedInput.patientId)
      .eq("invited_professional_id", parsedInput.professionalId)
      .eq("status", "pendente")
      .limit(1);

    if (existing?.[0]) {
      return { invite: existing[0] };
    }

    const { data: invite, error } = await supabase
      .from("team_invites")
      .insert({
        patient_id: parsedInput.patientId,
        invited_by: user.id,
        invited_professional_id: parsedInput.professionalId,
        expires_at: dayjs().add(4, "days").toISOString(),
      })
      .select()
      .single();

    if (error || !invite) {
      throw new Error(error?.message ?? "Erro ao criar convite");
    }

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", parsedInput.patientId)
        .single();

      insertActivityLog({
        supabaseAdmin,
        actionName: "Convite enviado",
        description: patient
          ? `Convite de equipe enviado para cuidar de ${patient.name}`
          : "Convite de equipe enviado",
        actionType: "team",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: parsedInput.patientId,
        metadata: { invite_id: invite.id, professional_id: parsedInput.professionalId },
      });
    }

    return { invite };
  });
