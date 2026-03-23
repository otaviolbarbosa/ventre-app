"use server";

import { obstetricHistorySchema } from "@/lib/validations/prenatal";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid(),
  data: obstetricHistorySchema,
});

export const upsertObstetricHistoryAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { patientId, data } = parsedInput;

    const { error } = await supabase.from("patient_obstetric_history").upsert(
      {
        patient_id: patientId,
        ...data,
      },
      { onConflict: "patient_id" },
    );

    if (error) throw new Error(error.message);

    return { success: true };
  });
