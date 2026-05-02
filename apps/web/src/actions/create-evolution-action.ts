"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { sendNotificationToTeam } from "@/lib/notifications/send";
import { getNotificationTemplate } from "@/lib/notifications/templates";
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

    const [{ data: professionalProfile }, { data: patient }] = await Promise.all([
      supabase.from("users").select("name").eq("id", user.id).single(),
      supabase.from("patients").select("name").eq("id", parsedInput.patientId).single(),
    ]);

    if (professionalProfile && patient) {
      const template = getNotificationTemplate("evolution_added", {
        professionalName: professionalProfile.name,
        patientName: patient.name,
      });
      sendNotificationToTeam(parsedInput.patientId, user.id, {
        type: "evolution_added",
        ...template,
        data: { url: `/patients/${parsedInput.patientId}` },
      });
    }

    if (profile.enterprise_id) {
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
