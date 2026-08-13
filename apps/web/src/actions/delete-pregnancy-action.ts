"use server";

import { isStaff } from "@/lib/access-control";
import { insertActivityLog } from "@/lib/activity-log";
import { captureServerEvent } from "@/lib/posthog/server";
import { authActionClient } from "@/lib/safe-action";
import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

const schema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
});

export const deletePregnancyAction = authActionClient
  .inputSchema(schema)
  .action(async ({ parsedInput, ctx: { supabase, supabaseAdmin, user, profile } }) => {
    const { data: pregnancy, error: pregnancyError } = await supabase
      .from("pregnancies")
      .select("id, patient:patients(name, created_by)")
      .eq("patient_id", parsedInput.patientId)
      .eq("has_finished", false)
      .single();

    if (!pregnancy || pregnancyError) {
      throw new Error("Erro: Gestante não encontrada.");
    }

    const isCreator = pregnancy?.patient?.created_by === user.id;
    if (!isCreator && !isStaff(profile)) {
      throw new Error("Apenas o criador ou um membro da staff pode excluir a gestante");
    }

    const { error } = await supabase
      .from("pregnancies")
      .update({
        has_finished: true,
      })
      .eq("patient_id", parsedInput.patientId)
      .eq("has_finished", false);

    if (error) throw new Error(error.message);

    revalidatePath("/patients");
    updateTag(`home-patients-${user.id}`);
    updateTag(`home-data-${user.id}`);

    if (profile.enterprise_id) {
      updateTag(`enterprise-patients-${profile.enterprise_id}`);
    }
    insertActivityLog({
      supabaseAdmin,
      actionName: "Gestante excluída",
      description: pregnancy?.patient?.name
        ? `Gestante ${pregnancy.patient.name} excluída`
        : "Gestante excluída",
      actionType: "patient",
      userId: user.id,
      enterpriseId: profile.enterprise_id,
      metadata: { patient_id: parsedInput.patientId, pregnancy_id: pregnancy?.id },
    });

    await captureServerEvent(user.id, "delete_pregnancy", {
      patient_id: parsedInput.patientId,
      pregnancy_id: pregnancy?.id,
    });

    return { success: true };
  });
