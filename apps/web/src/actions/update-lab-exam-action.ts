"use server";

import { authActionClient } from "@/lib/safe-action";
import { labExamSchema } from "@/lib/validations/prenatal";
import { z } from "zod";

const schema = z.object({
  examId: z.string().uuid(),
  data: labExamSchema,
});

export const updateLabExamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { examId, data } = parsedInput;

    const { error } = await supabase
      .from("lab_exam_results")
      .update(data)
      .eq("id", examId);

    if (error) throw new Error(error.message);

    return { success: true };
  });
