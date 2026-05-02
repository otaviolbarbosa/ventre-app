"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  examId: z.string().uuid(),
});

export const deleteLabExamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { examId } = parsedInput;

    const { data: exam } = await supabase
      .from("lab_exam_results")
      .select("pregnancy_id")
      .eq("id", examId)
      .single();
    const { data: pregnancy } = exam
      ? await supabase
          .from("pregnancies")
          .select("patient:patients(id, name)")
          .eq("id", exam.pregnancy_id)
          .single()
      : { data: null };
    const patient = pregnancy?.patient as { id: string; name: string } | null;

    const { error } = await supabase.from("lab_exam_results").delete().eq("id", examId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Exame laboratorial excluído",
        description: patient
          ? `Exame laboratorial de ${patient.name} excluído`
          : "Exame laboratorial excluído",
        actionType: "exam",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { exam_id: examId },
      });
    }

    return { success: true };
  });
