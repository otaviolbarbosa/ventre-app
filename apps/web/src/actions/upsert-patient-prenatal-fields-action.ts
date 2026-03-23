"use server";

import { updatePatientPrenatalSchema } from "@/lib/validations/prenatal";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid(),
  pregnancyId: z.string().uuid(),
  data: updatePatientPrenatalSchema,
});

export const upsertPatientPrenatalFieldsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { patientId, pregnancyId, data } = parsedInput;

    const allergiesArray = data.allergies
      ? data.allergies
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const { error: patientError } = await supabase
      .from("patients")
      .update({
        blood_type: data.blood_type ?? null,
        height_cm: data.height_cm ?? null,
        allergies: allergiesArray.length > 0 ? allergiesArray : null,
        personal_notes: data.personal_notes || null,
        family_history_diabetes: data.family_history_diabetes ?? null,
        family_history_hypertension: data.family_history_hypertension ?? null,
        family_history_twin: data.family_history_twin ?? null,
        family_history_others: data.family_history_others || null,
      })
      .eq("id", patientId);

    if (patientError) throw new Error(patientError.message);

    const { error: pregnancyError } = await supabase
      .from("pregnancies")
      .update({
        gestations_count: data.gestations_count ?? null,
        deliveries_count: data.deliveries_count ?? null,
        cesareans_count: data.cesareans_count ?? null,
        abortions_count: data.abortions_count ?? null,
        initial_weight_kg: data.initial_weight_kg ?? null,
      })
      .eq("id", pregnancyId);

    if (pregnancyError) throw new Error(pregnancyError.message);

    return { success: true };
  });
