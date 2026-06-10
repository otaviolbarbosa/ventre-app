"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { z } from "zod";

const schema = z.object({
  ultrasoundId: z.string().uuid(),
});

export const deleteUltrasoundAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { ultrasoundId } = parsedInput;

    const { data: ultrasound } = await supabase
      .from("ultrasounds")
      .select("pregnancy_id")
      .eq("id", ultrasoundId)
      .single();
    const { data: pregnancy } = ultrasound
      ? await supabase
          .from("pregnancies")
          .select("patient:patients(id, name)")
          .eq("id", ultrasound.pregnancy_id)
          .single()
      : { data: null };
    const patient = pregnancy?.patient as { id: string; name: string } | null;

    const { error } = await supabase.from("ultrasounds").delete().eq("id", ultrasoundId);

    if (error) throw new Error(error.message);

    if (profile.enterprise_id) {
      insertActivityLog({
        supabaseAdmin,
        actionName: "Ultrassom excluído",
        description: patient
          ? `Ultrassom de ${patient.name} excluído`
          : "Ultrassom excluído",
        actionType: "exam",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: patient?.id ?? null,
        metadata: { ultrasound_id: ultrasoundId },
      });
    }

    return { success: true };
  });
