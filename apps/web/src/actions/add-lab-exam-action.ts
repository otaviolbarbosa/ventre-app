"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { labExamSchema } from "@/lib/validations/prenatal";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: labExamSchema,
});

export const addLabExamAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { pregnancyId, data } = parsedInput;

    const { error } = await supabase.from("lab_exam_results").insert({
      pregnancy_id: pregnancyId,
      ...data,
    });

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      const { data: pregnancy } = await supabase
        .from("pregnancies")
        .select("patient:patients(id, name)")
        .eq("id", pregnancyId)
        .single();
      const patient = pregnancy?.patient as { id: string; name: string } | null;
      insertActivityLog({
        supabaseAdmin,
        actionName: "Exame laboratorial registrado",
        description: patient
          ? `Exame laboratorial registrado para ${patient.name}`
          : "Exame laboratorial registrado",
        actionType: "exam",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { pregnancy_id: pregnancyId },
      });
    }

    return { success: true };
  });
