"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  examId: z.string().uuid(),
});

export const deleteOtherExamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { examId } = parsedInput;

    const { data: exam } = await supabase
      .from("other_exams")
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

    const { error } = await supabase.from("other_exams").delete().eq("id", examId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Outro exame excluído",
        description: patient ? `Exame de ${patient.name} excluído` : "Exame excluído",
        actionType: "exam",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { exam_id: examId },
      });
    }

    return { success: true };
  });
