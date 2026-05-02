"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { labExamSchema } from "@/lib/validations/prenatal";
import { z } from "zod";

const schema = z.object({
  examId: z.string().uuid(),
  data: labExamSchema,
});

export const updateLabExamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { examId, data } = parsedInput;

    const { error } = await supabase.from("lab_exam_results").update(data).eq("id", examId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
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

      insertActivityLog({
        supabaseAdmin,
        actionName: "Exame laboratorial atualizado",
        description: patient
          ? `Exame laboratorial de ${patient.name} atualizado`
          : "Exame laboratorial atualizado",
        actionType: "exam",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { exam_id: examId },
      });
    }

    return { success: true };
  });
