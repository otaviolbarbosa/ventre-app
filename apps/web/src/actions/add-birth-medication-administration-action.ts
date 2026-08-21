"use server";

import {
  combineDateAndTime,
  duplicateWindowStart,
  resolvePregnancyPatientId,
  toDuplicateWarning,
} from "@/lib/birth-mode-duplicate-check";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { birthMedicationAdministrationSchema } from "@/lib/validations/birth-mode";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: birthMedicationAdministrationSchema,
});

export const addBirthMedicationAdministrationAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { pregnancyId, data } = parsedInput;

    const { data: recent } = await supabase
      .from("birth_medication_administrations")
      .select("administered_at, professional_id, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .gte("administered_at", duplicateWindowStart())
      .order("administered_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const duplicateWarning = toDuplicateWarning(user.id, recent, recent?.administered_at);

    const patientId = await resolvePregnancyPatientId(supabase, pregnancyId);

    const { date, time, ...rest } = data;

    const { error } = await supabase.from("birth_medication_administrations").insert({
      pregnancy_id: pregnancyId,
      patient_id: patientId,
      professional_id: user.id,
      administered_at: combineDateAndTime(date, time),
      ...rest,
    });

    if (error) throw new Error(error.message);

    await captureServerEvent(user.id, "add_birth_medication_administration", {
      pregnancy_id: pregnancyId,
    });

    return { success: true, duplicateWarning };
  });
