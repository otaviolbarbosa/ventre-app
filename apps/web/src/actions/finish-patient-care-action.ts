"use server";

import { insertActivityLog } from "@/lib/activity-log";
import { authActionClient } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  bornAt: z.string().optional(),
  deliveryMethod: z.enum(["cesarean", "vaginal"]).optional(),
  description: z.string().max(5000).optional(),
});

export const finishPatientCareAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { error: updateError } = await supabase
      .from("pregnancies")
      .update({
        has_finished: true,
        born_at: parsedInput.bornAt ?? null,
        delivery_method: parsedInput.deliveryMethod ?? null,
      })
      .eq("patient_id", parsedInput.patientId);

    if (updateError) throw new Error(updateError.message);

    if (parsedInput.description) {
      const { error: evolutionError } = await supabase.from("patient_evolutions").insert({
        patient_id: parsedInput.patientId,
        professional_id: user.id,
        content: parsedInput.description,
      });

      if (evolutionError) throw new Error(evolutionError.message);
    }

    revalidatePath("/patients");

    if (profile.enterprise_id) {
      const { data: patient } = await supabase
        .from("patients")
        .select("name")
        .eq("id", parsedInput.patientId)
        .single();
      const deliveryLabel =
        parsedInput.deliveryMethod === "cesarean" ? "parto cesariana" : "parto vaginal";
      insertActivityLog({
        supabaseAdmin,
        actionName: "Acompanhamento encerrado",
        description: patient
          ? `Acompanhamento de ${patient.name} encerrado (${deliveryLabel})`
          : "Acompanhamento encerrado",
        actionType: "patient",
        userId: user.id,
        enterpriseId: profile.enterprise_id,
        patientId: parsedInput.patientId,
        metadata: { delivery_method: parsedInput.deliveryMethod ?? null },
      });
    }

    return { success: true };
  });
