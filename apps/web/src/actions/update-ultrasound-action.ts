"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { ultrasoundSchema } from "@/lib/validations/prenatal";
import { z } from "zod";

const schema = z.object({
  ultrasoundId: z.string().uuid(),
  data: ultrasoundSchema,
});

export const updateUltrasoundAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { ultrasoundId, data } = parsedInput;

    const { error } = await supabase.from("ultrasounds").update(data).eq("id", ultrasoundId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      const { data: usg } = await supabase
        .from("ultrasounds")
        .select("pregnancy_id")
        .eq("id", ultrasoundId)
        .single();
      const { data: pregnancy } = usg
        ? await supabase
            .from("pregnancies")
            .select("patient:patients(id, name)")
            .eq("id", usg.pregnancy_id)
            .single()
        : { data: null };
      const patient = pregnancy?.patient as { id: string; name: string } | null;

      insertActivityLog({
        supabaseAdmin,
        actionName: "Ultrassom atualizado",
        description: patient
          ? `Ultrassom de ${patient.name} atualizado`
          : "Ultrassom atualizado",
        actionType: "exam",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { ultrasound_id: ultrasoundId },
      });
    }

    return { success: true };
  });
