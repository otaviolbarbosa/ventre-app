"use server";

import { authActionClient } from "@/lib/safe-action";
import { obstetricHistorySchema } from "@/lib/validations/prenatal";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid(),
  pregnancyId: z.string().uuid(),
  data: obstetricHistorySchema,
});

export const upsertObstetricHistoryAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { patientId, pregnancyId, data } = parsedInput;
    const {
      gestations_count,
      deliveries_count,
      cesareans_count,
      abortions_count,
      ...historyFields
    } = data;

    const { error } = await supabase.from("patient_obstetric_history").upsert(
      {
        patient_id: patientId,
        ...historyFields,
      },
      { onConflict: "patient_id" },
    );

    if (error) throw new Error(error.message);

    const { error: pregnancyError } = await supabase
      .from("pregnancies")
      .update({
        gestations_count: gestations_count ?? null,
        deliveries_count: deliveries_count ?? null,
        cesareans_count: cesareans_count ?? null,
        abortions_count: abortions_count ?? null,
      })
      .eq("id", pregnancyId);

    if (pregnancyError) throw new Error(pregnancyError.message);

    return { success: true };
  });
