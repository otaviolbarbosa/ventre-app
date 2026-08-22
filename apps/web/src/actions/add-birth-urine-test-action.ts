"use server";

import {
  combineDateAndTime,
  duplicateWindowStart,
  resolvePregnancyPatientId,
  toDuplicateWarning,
} from "@/lib/birth-mode-duplicate-check";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { birthUrineTestSchema } from "@/lib/validations/birth-mode";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: birthUrineTestSchema,
});

export const addBirthUrineTestAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, user } }) => {
    const { pregnancyId, data } = parsedInput;

    const { data: recent } = await supabase
      .from("birth_urine_tests")
      .select("measured_at, professional_id, professional:users(name)")
      .eq("pregnancy_id", pregnancyId)
      .gte("measured_at", duplicateWindowStart())
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const duplicateWarning = toDuplicateWarning(user.id, recent, recent?.measured_at);

    const patientId = await resolvePregnancyPatientId(supabase, pregnancyId);

    const { date, time, ...rest } = data;

    const { error } = await supabase.from("birth_urine_tests").insert({
      pregnancy_id: pregnancyId,
      patient_id: patientId,
      professional_id: user.id,
      measured_at: combineDateAndTime(date, time),
      ...rest,
    });

    if (error) throw new Error(error.message);

    await captureServerEvent(user.id, "add_birth_urine_test", { pregnancy_id: pregnancyId });

    return { success: true, duplicateWarning };
  });
