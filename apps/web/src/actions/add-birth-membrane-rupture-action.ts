"use server";

import { combineDateAndTime, resolvePregnancyPatientId } from "@/lib/birth-mode-duplicate-check";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { birthMembraneRuptureSchema } from "@/lib/validations/birth-mode";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: birthMembraneRuptureSchema,
});

export const addBirthMembraneRuptureAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { pregnancyId, data } = parsedInput;

    const patientId = await resolvePregnancyPatientId(supabase, pregnancyId);

    const { date, time, ...rest } = data;

    const { error } = await supabase.from("birth_membrane_ruptures").insert({
      pregnancy_id: pregnancyId,
      patient_id: patientId,
      professional_id: user.id,
      occurred_at: combineDateAndTime(date, time),
      ...rest,
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Bolsa rota já foi registrada para este parto");
      }
      throw new Error(error.message);
    }

    await captureServerEvent(user.id, "add_birth_membrane_rupture", { pregnancy_id: pregnancyId });

    return { success: true };
  });
