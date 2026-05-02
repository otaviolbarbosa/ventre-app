"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { ultrasoundSchema } from "@/lib/validations/prenatal";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  pregnancyId: z.string().uuid(),
  data: ultrasoundSchema,
});

export const addUltrasoundAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { pregnancyId, data } = parsedInput;

    const { error } = await supabase.from("ultrasounds").insert({
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
        actionName: "Ultrassom registrado",
        description: patient ? `Ultrassom registrado para ${patient.name}` : "Ultrassom registrado",
        actionType: "exam",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { pregnancy_id: pregnancyId },
      });
    }

    return { success: true };
  });
