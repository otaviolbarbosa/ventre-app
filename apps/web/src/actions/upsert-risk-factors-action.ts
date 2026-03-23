"use server";

import { riskFactorsSchema } from "@/lib/validations/prenatal";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: riskFactorsSchema,
});

export const upsertRiskFactorsAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { pregnancyId, data } = parsedInput;

    const { error } = await supabase.from("pregnancy_risk_factors").upsert(
      {
        pregnancy_id: pregnancyId,
        ...data,
      },
      { onConflict: "pregnancy_id" },
    );

    if (error) throw new Error(error.message);

    return { success: true };
  });
