"use server";

import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  examId: z.string().uuid(),
});

export const deleteLabExamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase } }) => {
    const { examId } = parsedInput;

    const { error } = await supabase
      .from("lab_exam_results")
      .delete()
      .eq("id", examId);

    if (error) throw new Error(error.message);

    return { success: true };
  });
