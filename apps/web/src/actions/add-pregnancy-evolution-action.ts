"use server";

import { pregnancyEvolutionSchema } from "@/lib/validations/prenatal";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: pregnancyEvolutionSchema,
});

export const addPregnancyEvolutionAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { pregnancyId, data } = parsedInput;

    const { error } = await supabase.from("pregnancy_evolutions").insert({
      pregnancy_id: pregnancyId,
      ...data,
    });

    if (error) throw new Error(error.message);

    return { success: true };
  });
