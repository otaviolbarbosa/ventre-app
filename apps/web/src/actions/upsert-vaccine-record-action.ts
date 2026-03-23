"use server";

import { vaccineRecordSchema } from "@/lib/validations/prenatal";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  recordId: z.string().uuid().optional(),
  data: vaccineRecordSchema,
});

export const upsertVaccineRecordAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { pregnancyId, recordId, data } = parsedInput;

    if (recordId) {
      const { error } = await supabase
        .from("vaccine_records")
        .update({ ...data })
        .eq("id", recordId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("vaccine_records").insert({
        pregnancy_id: pregnancyId,
        ...data,
      });
      if (error) throw new Error(error.message);
    }

    return { success: true };
  });
